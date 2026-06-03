import type { Env } from "./env.ts";

export async function discordRequest(
  env: Env,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${env.DISCORD_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "ThinkHumanTool/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Discord API ${method} ${path} failed ${res.status}: ${text}`,
    );
  }
  return text ? JSON.parse(text) : null;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  mentionable: boolean;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id?: string;
}

// Channel types
export const CHANNEL_TYPE_TEXT = 0;
export const CHANNEL_TYPE_FORUM = 15;
export const CHANNEL_TYPE_CATEGORY = 4;

export async function createRole(
  env: Env,
  name: string,
  color: number,
  mentionable: boolean,
): Promise<DiscordRole> {
  return (await discordRequest(env, "POST", `/guilds/${env.GUILD_ID}/roles`, {
    name,
    color,
    mentionable,
    permissions: "0",
  })) as DiscordRole;
}

export async function repositionRole(
  env: Env,
  roleId: string,
  belowRoleId: string,
): Promise<void> {
  const roles = (await discordRequest(
    env,
    "GET",
    `/guilds/${env.GUILD_ID}/roles`,
  )) as DiscordRole[];
  const anchor = roles.find((r) => r.id === belowRoleId);
  if (!anchor) return;
  // Place just above the anchor (anchor.position + 1)
  await discordRequest(env, "PATCH", `/guilds/${env.GUILD_ID}/roles`, [
    { id: roleId, position: anchor.position + 1 },
  ]);
}

export async function createCategory(
  env: Env,
  name: string,
): Promise<DiscordChannel> {
  return (await discordRequest(
    env,
    "POST",
    `/guilds/${env.GUILD_ID}/channels`,
    {
      name,
      type: CHANNEL_TYPE_CATEGORY,
    },
  )) as DiscordChannel;
}

export async function createTextChannel(
  env: Env,
  name: string,
  parentId: string,
  permissionOverwrites?: unknown[],
): Promise<DiscordChannel> {
  return (await discordRequest(
    env,
    "POST",
    `/guilds/${env.GUILD_ID}/channels`,
    {
      name,
      type: CHANNEL_TYPE_TEXT,
      parent_id: parentId,
      permission_overwrites: permissionOverwrites ?? [],
    },
  )) as DiscordChannel;
}

export async function createForumChannel(
  env: Env,
  name: string,
  parentId: string,
  permissionOverwrites?: unknown[],
): Promise<DiscordChannel> {
  return (await discordRequest(
    env,
    "POST",
    `/guilds/${env.GUILD_ID}/channels`,
    {
      name,
      type: CHANNEL_TYPE_FORUM,
      parent_id: parentId,
      permission_overwrites: permissionOverwrites ?? [],
    },
  )) as DiscordChannel;
}

export interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
}

export async function getGuildInfo(env: Env): Promise<GuildInfo> {
  const guild = (await discordRequest(env, "GET", `/guilds/${env.GUILD_ID}`)) as GuildInfo;
  return { id: guild.id, name: guild.name, icon: guild.icon };
}

export async function deleteRole(env: Env, roleId: string): Promise<void> {
  await discordRequest(env, "DELETE", `/guilds/${env.GUILD_ID}/roles/${roleId}`);
}

export async function deleteChannel(env: Env, channelId: string): Promise<void> {
  await discordRequest(env, "DELETE", `/channels/${channelId}`);
}

export async function removeOnboardingRole(
  env: Env,
  questionId: string,
  roleId: string,
): Promise<void> {
  if (!questionId || !roleId) return;
  const onboarding = (await discordRequest(
    env,
    "GET",
    `/guilds/${env.GUILD_ID}/onboarding`,
  )) as {
    prompts: Array<{
      id: string;
      options: Array<{ id: string; role_ids: string[] }>;
    }>;
    default_channel_ids: string[];
    enabled: boolean;
    mode: number;
  };

  const prompt = onboarding.prompts.find((p) => p.id === questionId);
  if (!prompt) return;

  prompt.options = prompt.options.filter((o) => !o.role_ids.includes(roleId));

  await discordRequest(env, "PUT", `/guilds/${env.GUILD_ID}/onboarding`, {
    prompts: onboarding.prompts,
    default_channel_ids: onboarding.default_channel_ids,
    enabled: onboarding.enabled,
    mode: onboarding.mode,
  });
}

export async function removeDefaultChannel(
  env: Env,
  channelId: string,
): Promise<void> {
  const onboarding = (await discordRequest(
    env,
    "GET",
    `/guilds/${env.GUILD_ID}/onboarding`,
  )) as {
    prompts: unknown[];
    default_channel_ids: string[];
    enabled: boolean;
    mode: number;
  };

  onboarding.default_channel_ids = onboarding.default_channel_ids.filter(
    (id) => id !== channelId,
  );

  await discordRequest(env, "PUT", `/guilds/${env.GUILD_ID}/onboarding`, {
    prompts: onboarding.prompts,
    default_channel_ids: onboarding.default_channel_ids,
    enabled: onboarding.enabled,
    mode: onboarding.mode,
  });
}

export async function getGuildChannels(env: Env): Promise<DiscordChannel[]> {
  return (await discordRequest(
    env,
    "GET",
    `/guilds/${env.GUILD_ID}/channels`,
  )) as DiscordChannel[];
}

export async function getGuildRoles(env: Env): Promise<DiscordRole[]> {
  return (await discordRequest(
    env,
    "GET",
    `/guilds/${env.GUILD_ID}/roles`,
  )) as DiscordRole[];
}

export async function sendMessage(
  env: Env,
  channelId: string,
  payload: unknown,
): Promise<{ id: string }> {
  return (await discordRequest(
    env,
    "POST",
    `/channels/${channelId}/messages`,
    payload,
  )) as { id: string };
}

export async function editMessage(
  env: Env,
  channelId: string,
  messageId: string,
  payload: unknown,
): Promise<void> {
  await discordRequest(
    env,
    "PATCH",
    `/channels/${channelId}/messages/${messageId}`,
    payload,
  );
}

export async function addOnboardingRole(
  env: Env,
  questionId: string,
  roleId: string,
  label: string,
  description: string,
): Promise<void> {
  if (!questionId) return;
  const onboarding = (await discordRequest(
    env,
    "GET",
    `/guilds/${env.GUILD_ID}/onboarding`,
  )) as {
    prompts: Array<{
      id: string;
      options: Array<{ id: string; role_ids: string[]; title: string; description: string }>;
    }>;
    default_channel_ids: string[];
  };

  const prompt = onboarding.prompts.find((p) => p.id === questionId);
  if (!prompt) return;

  prompt.options.push({
    id: "0",
    role_ids: [roleId],
    title: label,
    description,
  });

  await discordRequest(env, "PUT", `/guilds/${env.GUILD_ID}/onboarding`, {
    prompts: onboarding.prompts,
    default_channel_ids: onboarding.default_channel_ids,
    enabled: true,
    mode: 1,
  });
}

export async function configureHelpChannel(
  env: Env,
  channelId: string,
  projectName: string,
  supportRoleId: string,
): Promise<void> {
  const guidelines =
    `**Welcome To ${projectName} Help!**\n` +
    `Ask questions, report bugs, and share feature requests for ${projectName}.\n` +
    `ㅤ\n` +
    `**How To Get Support**\n` +
    `To get support just create a post. Feature requests can also be sent here, just create a post like any other and add the \`feature request\` tag.\n\n` +
    `When you send a message be sure to ping <@&${supportRoleId}>`;

  await discordRequest(env, "PATCH", `/channels/${channelId}`, {
    topic: guidelines,
    default_forum_layout: 1, // list view
    available_tags: [
      { name: "Help", emoji_name: "❓", moderated: false },
      { name: "Bug", emoji_name: "🐛", moderated: false },
      { name: "Feature Request", emoji_name: "💡", moderated: false },
      { name: "Advice", emoji_name: "🤝", moderated: false },
      { name: "Solved", emoji_name: "✅", moderated: true },
    ],
  });
}

export async function addDefaultChannel(
  env: Env,
  channelId: string,
): Promise<void> {
  const onboarding = (await discordRequest(
    env,
    "GET",
    `/guilds/${env.GUILD_ID}/onboarding`,
  )) as {
    prompts: unknown[];
    default_channel_ids: string[];
    enabled: boolean;
    mode: number;
  };

  if (!onboarding.default_channel_ids.includes(channelId)) {
    onboarding.default_channel_ids.push(channelId);
  }

  await discordRequest(env, "PUT", `/guilds/${env.GUILD_ID}/onboarding`, {
    prompts: onboarding.prompts,
    default_channel_ids: onboarding.default_channel_ids,
    enabled: onboarding.enabled,
    mode: onboarding.mode,
  });
}

// Build a Discord embed for project info
export function buildInfoEmbed(project: {
  name: string;
  description: string;
  color: number;
  icon_url: string;
  links: Array<{ label: string; url: string }>;
}): object {
  // Link buttons (style 5) — up to 5 per row, up to 5 rows
  const buttons = project.links.slice(0, 25).map((l) => ({
    type: 2,    // button
    style: 5,   // link
    label: l.label,
    url: l.url,
  }));

  // Split buttons into rows of 5
  const components: object[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    components.push({ type: 1, components: buttons.slice(i, i + 5) });
  }

  return {
    embeds: [
      {
        title: project.name,
        description: project.description,
        color: project.color,
        thumbnail: project.icon_url ? { url: project.icon_url } : undefined,
        footer: { text: "ThinkHuman" },
        timestamp: new Date().toISOString(),
      },
    ],
    components: components.length > 0 ? components : undefined,
  };
}

export function buildChangelogEmbed(entry: {
  title: string;
  version: string;
  content: string;
  color: number;
}): object {
  return {
    embeds: [
      {
        title: entry.version
          ? `📋 ${entry.title} v${entry.version}`
          : `📋 ${entry.title}`,
        description: entry.content,
        color: entry.color,
        timestamp: new Date().toISOString(),
        footer: { text: "Changelog" },
      },
    ],
  };
}
