import { Edit2, Loader2, Plus, RefreshCw, Save, Send, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '../components/Layout.tsx'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ColorInput,
  Input,
  Textarea,
} from '../components/ui.tsx'
import {
  deleteServerEmbed,
  getServerConfig,
  getServerEmbeds,
  postServerEmbed,
  refreshProjectsEmbed,
  type ServerConfig,
  type ServerEmbed,
  updateServerConfig,
  updateServerEmbed,
} from '../lib/api.ts'
import { hexToInt, intToHex } from '../lib/utils.ts'

// ── Shared embed form ─────────────────────────────────────────────────────────

interface EmbedFormValues {
  title: string
  description: string
  color: string
  footer: string
  image_url: string
}

function EmbedForm({
  initial,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  initial?: Partial<EmbedFormValues>
  onSubmit: (v: EmbedFormValues) => Promise<void>
  submitLabel: string
  onCancel?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [color, setColor] = useState(initial?.color ?? '#000000')
  const [footer, setFooter] = useState(initial?.footer ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSubmit({ title, description, color, footer, image_url: imageUrl })
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {error && <Alert variant="error">{error}</Alert>}

      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Embed title"
      />
      <Textarea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-28"
        placeholder="Supports Discord markdown…"
      />
      <div className="grid grid-cols-2 gap-3">
        <ColorInput label="Color" value={color} onChange={setColor} />
        <Input
          label="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <Input
        label="Footer"
        value={footer}
        onChange={(e) => setFooter(e.target.value)}
        placeholder="Footer text"
      />

      {(title || description) && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Preview</p>
          <div
            className="rounded-lg border-l-2 bg-secondary px-4 py-3 space-y-1.5"
            style={{ borderColor: color }}
          >
            {title && <p className="text-sm font-semibold">{title}</p>}
            {description && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{description}</p>
            )}
            {footer && (
              <p className="mt-1 border-t border-border pt-2 text-xs text-muted-foreground">
                {footer}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={loading} size="sm">
          <Send className="h-3.5 w-3.5" />
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

// ── Embed card ────────────────────────────────────────────────────────────────

function EmbedCard({
  embed,
  type,
  onUpdated,
  onDeleted,
}: {
  embed: ServerEmbed
  type: 'rules' | 'projects_info'
  onUpdated: (e: ServerEmbed) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteServerEmbed(type, embed.id)
      onDeleted(embed.id)
    } catch (err) {
      alert(String(err))
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: intToHex(embed.color) || '#e5e5e5' }}
            />
            <p className="truncate text-sm font-medium">{embed.title || '(no title)'}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditing((v) => !v)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        {!editing && embed.description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{embed.description}</p>
        )}
      </CardHeader>
      {editing && (
        <CardBody>
          <EmbedForm
            initial={{
              title: embed.title,
              description: embed.description,
              color: intToHex(embed.color),
              footer: embed.footer,
              image_url: embed.image_url,
            }}
            submitLabel="Update Embed"
            onCancel={() => setEditing(false)}
            onSubmit={async (v) => {
              const updated = await updateServerEmbed(type, embed.id, {
                ...v,
                color: hexToInt(v.color),
              })
              onUpdated(updated)
              setEditing(false)
            }}
          />
        </CardBody>
      )}
    </Card>
  )
}

// ── Channel tab ───────────────────────────────────────────────────────────────

function ChannelTab({
  type,
  label,
  channelName,
}: {
  type: 'rules' | 'projects_info'
  label: string
  channelName: string
}) {
  const [embeds, setEmbeds] = useState<ServerEmbed[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getServerEmbeds(type)
      .then(setEmbeds)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [type])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">#{channelName}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowNew((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          New Embed
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {showNew && (
        <Card>
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              New Embed
            </p>
          </CardHeader>
          <CardBody>
            <EmbedForm
              submitLabel="Post Embed"
              onCancel={() => setShowNew(false)}
              onSubmit={async (v) => {
                const em = await postServerEmbed(type, { ...v, color: hexToInt(v.color) })
                setEmbeds((prev) => [...prev, em])
                setShowNew(false)
              }}
            />
          </CardBody>
        </Card>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {!loading && embeds.length === 0 && !showNew && (
        <p className="text-xs text-muted-foreground">No embeds posted yet.</p>
      )}

      <div className="space-y-2">
        {embeds.map((em) => (
          <EmbedCard
            key={em.id}
            embed={em}
            type={type}
            onUpdated={(updated) =>
              setEmbeds((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
            }
            onDeleted={(id) => setEmbeds((prev) => prev.filter((e) => e.id !== id))}
          />
        ))}
      </div>
    </div>
  )
}

// ── Projects embed config ─────────────────────────────────────────────────────

function ProjectsEmbedConfig({
  config,
  onSaved,
}: {
  config: ServerConfig
  onSaved: (c: ServerConfig) => void
}) {
  const [title, setTitle] = useState(config.projects_embed_title)
  const [description, setDescription] = useState(config.projects_embed_description)
  const [color, setColor] = useState(intToHex(parseInt(config.projects_embed_color) || 0))
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    try {
      await updateServerConfig({
        projects_embed_title: title,
        projects_embed_description: description,
        projects_embed_color: String(hexToInt(color)),
      })
      onSaved({
        ...config,
        projects_embed_title: title,
        projects_embed_description: description,
        projects_embed_color: String(hexToInt(color)),
      })
      setMsg('Saved.')
    } catch (err) {
      setMsg('Error: ' + String(err))
    } finally {
      setLoading(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setMsg('')
    try {
      await refreshProjectsEmbed()
      setMsg('Projects embed refreshed.')
    } catch (err) {
      setMsg('Error: ' + String(err))
    } finally {
      setRefreshing(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Projects Overview Embed
          </p>
          <Button size="sm" variant="ghost" loading={refreshing} onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Always posted last in #projects-and-info. Lists all projects with links to their info
          channels.
        </p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSave} className="space-y-3.5">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Our Projects"
          />
          <Textarea
            label="Intro text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-16"
            placeholder="Explore our tools below."
          />
          <ColorInput label="Color" value={color} onChange={setColor} />
          {msg && (
            <p
              className={`text-xs ${msg.startsWith('Error') ? 'text-destructive' : 'text-accent'}`}
            >
              {msg}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={loading}>
              <Save className="h-3.5 w-3.5" /> Save & Refresh
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'rules' | 'projects_info'

export function ServerPage() {
  const [tab, setTab] = useState<Tab>('rules')
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getServerConfig()
      .then(setConfig)
      .finally(() => setLoading(false))
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'rules', label: 'Rules' },
    { id: 'projects_info', label: 'Projects & Info' },
  ]

  return (
    <>
      <PageHeader
        title="Server Channels"
        description="Manage embeds in your server's public channels."
      />

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <div className="flex gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {config && tab === 'rules' && (
          <ChannelTab type="rules" label="Rules Channel" channelName="rules" />
        )}

        {config && tab === 'projects_info' && (
          <div className="space-y-6">
            <ChannelTab
              type="projects_info"
              label="Projects & Info Channel"
              channelName="projects-and-info"
            />
            <ProjectsEmbedConfig config={config} onSaved={setConfig} />
          </div>
        )}
      </div>
    </>
  )
}
