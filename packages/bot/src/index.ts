import type {
  APIInteraction,
  APIMessageComponentGuildInteraction,
  APIMessageComponentInteraction,
} from 'discord-api-types/v10'
import { InteractionResponseType, InteractionType, MessageFlags } from 'discord-api-types/v10'
import { verifySignature } from './verify.ts'

interface Env {
  DISCORD_PUBLIC_KEY: string
  DISCORD_BOT_TOKEN: string
  DISCORD_APPLICATION_ID: string
  DISCORD_API_BASE: string
  GUILD_ID: string
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function discordApi(
  env: Env,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${env.DISCORD_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ThinkHumanBot/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Discord ${method} ${path} ${res.status}: ${t}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// When someone posts in a help forum channel, the bot posts a message with a
// support-ping button. The button custom_id is: ping_support:{project_name}:{support_role_id}
async function handleNewPost(
  env: Env,
  channelId: string,
  supportRoleId: string,
  projectName: string,
): Promise<void> {
  await discordApi(env, 'POST', `/channels/${channelId}/messages`, {
    content: `Need help with **${projectName}**?`,
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 4, // danger / red
            label: '🔔 Ping Support',
            custom_id: `ping_support:${projectName}:${supportRoleId}`,
          },
        ],
      },
    ],
  })
}

async function handlePingSupportButton(
  env: Env,
  interaction: APIMessageComponentInteraction,
): Promise<Response> {
  const parts = interaction.data.custom_id.split(':')
  // custom_id: ping_support:{projectName}:{supportRoleId}
  const projectName = parts[1] ?? 'this project'
  const roleId = parts[2]

  if (!roleId) {
    return json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '⚠️ Could not determine support role.',
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  // Check if the button was already clicked (disable it)
  const guildInteraction = interaction as APIMessageComponentGuildInteraction
  const member = guildInteraction.member

  // Defer update to disable the button immediately
  const ack: Response = json({
    type: InteractionResponseType.UpdateMessage,
    data: {
      content: `<@&${roleId}> — a user needs help with **${projectName}**! 🆘`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 2, // secondary / grey — disabled
              label: '✅ Support Pinged',
              custom_id: `ping_support_done`,
              disabled: true,
            },
          ],
        },
      ],
    },
  })

  return ack
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Internal webhook endpoint called by forum post events (via Discord gateway
    // or via the API worker triggering it). Since the bot runs as a Worker it
    // can't maintain a gateway connection; instead, the API worker can call this
    // endpoint when it detects new help channel posts via a webhook.
    if (url.pathname === '/internal/new-post' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization')
      if (authHeader !== `Bearer ${env.DISCORD_BOT_TOKEN}`) {
        return new Response('Unauthorized', { status: 401 })
      }
      const body = await request.json<{
        channel_id: string
        support_role_id: string
        project_name: string
      }>()
      await handleNewPost(env, body.channel_id, body.support_role_id, body.project_name)
      return new Response('ok')
    }

    if (request.method !== 'POST' || url.pathname !== '/') {
      return new Response('Not Found', { status: 404 })
    }

    const bodyText = await request.text()
    const signature = request.headers.get('x-signature-ed25519')
    const timestamp = request.headers.get('x-signature-timestamp')

    if (
      !signature ||
      !timestamp ||
      !(await verifySignature(env.DISCORD_PUBLIC_KEY, signature, timestamp, bodyText))
    ) {
      return new Response('Invalid request signature', { status: 401 })
    }

    const interaction: APIInteraction = JSON.parse(bodyText)

    if (interaction.type === InteractionType.Ping) {
      return json({ type: InteractionResponseType.Pong })
    }

    if (interaction.type === InteractionType.MessageComponent) {
      const data = interaction.data
      if (data.custom_id.startsWith('ping_support:')) {
        return handlePingSupportButton(env, interaction as APIMessageComponentInteraction)
      }
    }

    return json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: 'Unknown interaction', flags: MessageFlags.Ephemeral },
    })
  },
}
