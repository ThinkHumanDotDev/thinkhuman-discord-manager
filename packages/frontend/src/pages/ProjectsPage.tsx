import { ChevronRight, Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/Layout.tsx'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ColorInput,
  Input,
  Modal,
  Textarea,
} from '../components/ui.tsx'
import { createProject, getProjects, type Project } from '../lib/api.ts'
import { getContrastColor, hexToInt, intToHex } from '../lib/utils.ts'

function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (p: Project) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#000000')
  const [iconUrl, setIconUrl] = useState('')
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setName('')
    setDescription('')
    setColor('#000000')
    setIconUrl('')
    setLinks([])
    setError('')
  }

  function addLink() {
    setLinks((l) => [...l, { label: '', url: '' }])
  }
  function setLink(i: number, field: 'label' | 'url', value: string) {
    setLinks((l) => l.map((link, idx) => (idx === i ? { ...link, [field]: value } : link)))
  }
  function removeLink(i: number) {
    setLinks((l) => l.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const project = await createProject({
        name: name.trim(),
        description,
        color: hexToInt(color),
        icon_url: iconUrl,
        links: links.filter((l) => l.label && l.url),
      })
      onCreated(project)
      reset()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="New Project"
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <Alert variant="info">
          Creates Discord roles, a category, info channel, and help forum automatically.
        </Alert>

        <Input
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Tool"
          required
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this project do?"
          className="min-h-20"
        />

        <div className="grid grid-cols-2 gap-3">
          <ColorInput label="Embed Color" value={color} onChange={setColor} />
          <Input
            label="Icon URL"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Links</span>
            <Button type="button" variant="ghost" size="sm" onClick={addLink}>
              <Plus className="h-3 w-3" />
              Add Link
            </Button>
          </div>
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={link.label}
                onChange={(e) => setLink(i, 'label', e.target.value)}
                placeholder="Label"
                className="w-28 shrink-0"
              />
              <Input
                value={link.url}
                onChange={(e) => setLink(i, 'url', e.target.value)}
                placeholder="https://…"
              />
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="shrink-0 rounded px-2 text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <PageHeader
        title="Projects"
        description="Manage ThinkHuman tool projects and their Discord resources."
        action={
          <Button onClick={() => setCreating(true)} size="sm">
            <Plus className="h-3.5 w-3.5" />
            New Project
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-5xl flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        )}
        {error && <Alert variant="error">{error}</Alert>}

        {!loading && projects.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No projects yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create one to set up roles and channels automatically.
            </p>
            <Button className="mt-4" size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Project
            </Button>
          </div>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-colors hover:border-ring/40 group"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                {p.icon_url ? (
                  <img
                    src={p.icon_url}
                    alt=""
                    className="h-7 w-7 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="h-7 w-7 rounded-md shrink-0 border"
                    style={{
                      backgroundColor: intToHex(p.color) + '18',
                      borderColor: intToHex(p.color) + '33',
                    }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.description || 'No description'}
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </CardHeader>
              <CardBody className="flex flex-wrap gap-1.5">
                <Badge color={intToHex(p.color)}>
                  <span
                    className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: getContrastColor(intToHex(p.color)) }}
                  />
                  {intToHex(p.color)}
                </Badge>
                <Badge>{p.links?.length ?? 0} links</Badge>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      <CreateProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(p) => setProjects((prev) => [p, ...prev])}
      />
    </>
  )
}
