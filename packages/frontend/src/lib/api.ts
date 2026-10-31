import { API_BASE } from './utils.ts'

function getCfAccessToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)
  return match?.[1] ?? null
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getCfAccessToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }

  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

// --- Types ---
export interface ProjectLink {
  id: string
  label: string
  url: string
  sort_order: number
}

export interface Changelog {
  id: string
  project_id: string
  title: string
  version: string
  content: string
  message_id: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description: string
  color: number
  icon_url: string
  support_role_id: string
  general_role_id: string
  info_channel_id: string
  help_channel_id: string
  category_id: string
  info_message_id: string
  created_at: string
  links: ProjectLink[]
  changelogs?: Changelog[]
}

export interface Embed {
  id: string
  channel_id: string
  message_id: string
  title: string
  description: string
  color: number
  footer: string
  image_url: string
  created_at: string
}

export interface Settings {
  support_role_below_id: string
  general_role_below_id: string
  category_below_id: string
  onboarding_question_id: string
}

export interface DiscordChannel {
  id: string
  name: string
  type: number
  position: number
  parent_id?: string
}

export interface DiscordRole {
  id: string
  name: string
  color: number
  position: number
}

// --- Projects ---
export const getProjects = () => request<Project[]>('/projects')
export const getProject = (id: string) => request<Project>(`/projects/${id}`)

export const createProject = (data: {
  name: string
  description?: string
  color?: number
  icon_url?: string
  links?: Array<{ label: string; url: string }>
}) =>
  request<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const deleteProject = (id: string) =>
  request<{ ok: boolean; errors?: string[] }>(`/projects/${id}`, {
    method: 'DELETE',
  })

export const updateProject = (
  id: string,
  data: {
    description?: string
    color?: number
    icon_url?: string
    links?: Array<{ label: string; url: string }>
  },
) =>
  request<Project>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const refreshInfoEmbed = (id: string) =>
  request<{ ok: boolean; message_id: string }>(`/projects/${id}/embed`, {
    method: 'POST',
  })

export const configureHelpChannel = (id: string) =>
  request<{ ok: boolean }>(`/projects/${id}/configure-help`, {
    method: 'POST',
  })

export const postChangelog = (
  id: string,
  data: { title: string; version?: string; content: string },
) =>
  request<Changelog>(`/projects/${id}/changelog`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateChangelog = (
  projectId: string,
  clId: string,
  data: { title?: string; version?: string; content?: string },
) =>
  request<Changelog>(`/projects/${projectId}/changelog/${clId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

// --- Embeds ---
export const getEmbeds = () => request<Embed[]>('/embeds')
export const postEmbed = (data: {
  channel_id: string
  title?: string
  description?: string
  color?: number
  footer?: string
  image_url?: string
  fields?: Array<{ name: string; value: string; inline?: boolean }>
}) =>
  request<Embed>('/embeds', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateEmbed = (
  id: string,
  data: {
    title?: string
    description?: string
    color?: number
    footer?: string
    image_url?: string
    fields?: Array<{ name: string; value: string; inline?: boolean }>
  },
) =>
  request<Embed>(`/embeds/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

// --- Server channels ---
export interface ServerEmbed {
  id: string
  channel_type: string
  channel_id: string
  message_id: string
  title: string
  description: string
  color: number
  footer: string
  image_url: string
  sort_order: number
  created_at: string
}

export interface ServerConfig {
  rules_channel_id: string
  projects_info_channel_id: string
  projects_embed_title: string
  projects_embed_description: string
  projects_embed_color: string
  projects_embed_message_id: string
}

export const getServerConfig = () => request<ServerConfig>('/server/config')
export const updateServerConfig = (data: Partial<ServerConfig>) =>
  request<{ ok: boolean }>('/server/config', { method: 'PUT', body: JSON.stringify(data) })

export const getServerEmbeds = (type: 'rules' | 'projects_info') =>
  request<ServerEmbed[]>(`/server/embeds/${type}`)

export const postServerEmbed = (
  type: 'rules' | 'projects_info',
  data: {
    title?: string
    description?: string
    color?: number
    footer?: string
    image_url?: string
  },
) =>
  request<ServerEmbed>(`/server/embeds/${type}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateServerEmbed = (
  type: 'rules' | 'projects_info',
  id: string,
  data: {
    title?: string
    description?: string
    color?: number
    footer?: string
    image_url?: string
  },
) =>
  request<ServerEmbed>(`/server/embeds/${type}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteServerEmbed = (type: 'rules' | 'projects_info', id: string) =>
  request<{ ok: boolean }>(`/server/embeds/${type}/${id}`, { method: 'DELETE' })

export const refreshProjectsEmbed = () =>
  request<{ ok: boolean; message_id: string }>('/server/projects-embed/refresh', {
    method: 'POST',
  })

// --- Settings ---
export const getSettings = () => request<Settings>('/settings')
export const updateSettings = (data: Partial<Settings>) =>
  request<{ ok: boolean }>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export interface GuildInfo {
  id: string
  name: string
  icon: string | null
}

// --- Guild ---
export const getGuildInfo = () => request<GuildInfo>('/guild/info')
export const getChannels = () => request<DiscordChannel[]>('/guild/channels')
export const getRoles = () => request<DiscordRole[]>('/guild/roles')
