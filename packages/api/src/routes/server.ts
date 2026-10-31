import { Hono } from 'hono'
import { discordRequest, editMessage, sendMessage } from '../discord.ts'
import type { Env } from '../env.ts'

const server = new Hono<{ Bindings: Env }>()

function nanoid(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 16)
}

async function getSetting(db: D1Database, key: string): Promise<string> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>()
  return row?.value ?? ''
}

async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .bind(key, value)
    .run()
}

function buildEmbedPayload(embed: {
  title: string
  description: string
  color: number
  footer: string
  image_url: string
}): object {
  return {
    embeds: [
      {
        title: embed.title || undefined,
        description: embed.description || undefined,
        color: embed.color || undefined,
        footer: embed.footer ? { text: embed.footer } : undefined,
        image: embed.image_url ? { url: embed.image_url } : undefined,
      },
    ],
  }
}

async function buildProjectsEmbed(
  db: D1Database,
  guildId: string,
  title: string,
  description: string,
  color: number,
): Promise<object> {
  const rows = await db
    .prepare('SELECT name, info_channel_id FROM projects ORDER BY created_at ASC')
    .all<{ name: string; info_channel_id: string }>()

  const lines = rows.results.map(
    (p) =>
      `**${p.name}**: ${p.info_channel_id ? `<#${p.info_channel_id}>` : '_No channel configured_'}`,
  )

  return {
    embeds: [
      {
        title: title || 'Our Projects',
        description: [description, '', ...lines].filter(Boolean).join('\n'),
        color: color || undefined,
      },
    ],
  }
}

async function deleteMessageSafe(env: Env, channelId: string, messageId: string): Promise<void> {
  if (!channelId || !messageId) return
  await discordRequest(env, 'DELETE', `/channels/${channelId}/messages/${messageId}`).catch(
    () => {},
  )
}

async function repostProjectsEmbed(env: Env, db: D1Database, channelId: string): Promise<void> {
  const [title, description, colorStr, oldMsgId] = await Promise.all([
    getSetting(db, 'projects_embed_title'),
    getSetting(db, 'projects_embed_description'),
    getSetting(db, 'projects_embed_color'),
    getSetting(db, 'projects_embed_message_id'),
  ])

  await deleteMessageSafe(env, channelId, oldMsgId)

  const payload = await buildProjectsEmbed(
    db,
    env.GUILD_ID,
    title,
    description,
    parseInt(colorStr) || 0,
  )

  const msg = await sendMessage(env, channelId, payload)
  await setSetting(db, 'projects_embed_message_id', msg.id)
}

// ── Config ────────────────────────────────────────────────────────────────────

server.get('/config', async (c) => {
  const keys = [
    'rules_channel_id',
    'projects_info_channel_id',
    'projects_embed_title',
    'projects_embed_description',
    'projects_embed_color',
    'projects_embed_message_id',
  ]
  const obj: Record<string, string> = {}
  for (const key of keys) {
    obj[key] = await getSetting(c.env.DB, key)
  }
  return c.json(obj)
})

server.put('/config', async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const allowed = [
    'rules_channel_id',
    'projects_info_channel_id',
    'projects_embed_title',
    'projects_embed_description',
    'projects_embed_color',
  ]
  for (const key of allowed) {
    if (key in body) await setSetting(c.env.DB, key, body[key]!)
  }
  return c.json({ ok: true })
})

// ── Embeds for a channel type ─────────────────────────────────────────────────

server.get('/embeds/:type', async (c) => {
  const type = c.req.param('type')
  const rows = await c.env.DB.prepare(
    'SELECT * FROM server_embeds WHERE channel_type = ? ORDER BY sort_order ASC, created_at ASC',
  )
    .bind(type)
    .all()
  return c.json(rows.results)
})

server.post('/embeds/:type', async (c) => {
  const type = c.req.param('type')
  const body = await c.req.json<{
    title?: string
    description?: string
    color?: number
    footer?: string
    image_url?: string
  }>()

  const channelId =
    type === 'rules'
      ? await getSetting(c.env.DB, 'rules_channel_id')
      : await getSetting(c.env.DB, 'projects_info_channel_id')

  if (!channelId) return c.json({ error: 'Channel not configured' }, 400)

  const id = nanoid()

  // Get next sort_order
  const maxRow = await c.env.DB.prepare(
    'SELECT MAX(sort_order) as m FROM server_embeds WHERE channel_type = ?',
  )
    .bind(type)
    .first<{ m: number | null }>()
  const sortOrder = (maxRow?.m ?? -1) + 1

  const payload = buildEmbedPayload({
    title: body.title ?? '',
    description: body.description ?? '',
    color: body.color ?? 0,
    footer: body.footer ?? '',
    image_url: body.image_url ?? '',
  })

  const msg = await sendMessage(c.env, channelId, payload)

  await c.env.DB.prepare(
    `INSERT INTO server_embeds (id, channel_type, channel_id, message_id, title, description, color, footer, image_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      type,
      channelId,
      msg.id,
      body.title ?? '',
      body.description ?? '',
      body.color ?? 0,
      body.footer ?? '',
      body.image_url ?? '',
      sortOrder,
    )
    .run()

  // For projects_info, always repost the projects embed after so it stays last
  if (type === 'projects_info') {
    await repostProjectsEmbed(c.env, c.env.DB, channelId)
  }

  const row = await c.env.DB.prepare('SELECT * FROM server_embeds WHERE id = ?').bind(id).first()
  return c.json(row, 201)
})

server.put('/embeds/:type/:id', async (c) => {
  const { type, id } = c.req.param()
  const body = await c.req.json<{
    title?: string
    description?: string
    color?: number
    footer?: string
    image_url?: string
  }>()

  const embed = await c.env.DB.prepare(
    'SELECT * FROM server_embeds WHERE id = ? AND channel_type = ?',
  )
    .bind(id, type)
    .first<{
      channel_id: string
      message_id: string
      title: string
      description: string
      color: number
      footer: string
      image_url: string
    }>()

  if (!embed) return c.json({ error: 'Not found' }, 404)

  const newTitle = body.title ?? embed.title
  const newDesc = body.description ?? embed.description
  const newColor = body.color ?? embed.color
  const newFooter = body.footer ?? embed.footer
  const newImageUrl = body.image_url ?? embed.image_url

  await c.env.DB.prepare(
    'UPDATE server_embeds SET title=?, description=?, color=?, footer=?, image_url=? WHERE id=?',
  )
    .bind(newTitle, newDesc, newColor, newFooter, newImageUrl, id)
    .run()

  await editMessage(
    c.env,
    embed.channel_id,
    embed.message_id,
    buildEmbedPayload({
      title: newTitle,
      description: newDesc,
      color: newColor,
      footer: newFooter,
      image_url: newImageUrl,
    }),
  ).catch(() => {})

  return c.json(await c.env.DB.prepare('SELECT * FROM server_embeds WHERE id = ?').bind(id).first())
})

server.delete('/embeds/:type/:id', async (c) => {
  const { type, id } = c.req.param()

  const embed = await c.env.DB.prepare(
    'SELECT * FROM server_embeds WHERE id = ? AND channel_type = ?',
  )
    .bind(id, type)
    .first<{ channel_id: string; message_id: string }>()

  if (!embed) return c.json({ error: 'Not found' }, 404)

  await deleteMessageSafe(c.env, embed.channel_id, embed.message_id)
  await c.env.DB.prepare('DELETE FROM server_embeds WHERE id = ?').bind(id).run()

  return c.json({ ok: true })
})

// ── Projects embed refresh ────────────────────────────────────────────────────

server.post('/projects-embed/refresh', async (c) => {
  const channelId = await getSetting(c.env.DB, 'projects_info_channel_id')
  if (!channelId) return c.json({ error: 'projects_info_channel_id not configured' }, 400)

  await repostProjectsEmbed(c.env, c.env.DB, channelId)
  const msgId = await getSetting(c.env.DB, 'projects_embed_message_id')
  return c.json({ ok: true, message_id: msgId })
})

export default server
