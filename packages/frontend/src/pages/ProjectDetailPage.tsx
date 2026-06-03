import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/Layout.tsx";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Modal,
  Input,
  Textarea,
  ColorInput,
  Alert,
  Separator,
} from "../components/ui.tsx";
import {
  getProject,
  updateProject,
  deleteProject,
  refreshInfoEmbed,
  postChangelog,
  updateChangelog,
  type Project,
  type Changelog,
} from "../lib/api.ts";
import { intToHex, hexToInt } from "../lib/utils.ts";
import { ArrowLeft, RefreshCw, Plus, Edit2, ExternalLink, Loader2, Trash2 } from "lucide-react";

function DiscordIdRow({ label, id }: { label: string; id: string }) {
  if (!id) return null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{id}</code>
    </div>
  );
}

function EditProjectModal({
  project,
  open,
  onClose,
  onSaved,
}: {
  project: Project;
  open: boolean;
  onClose: () => void;
  onSaved: (p: Project) => void;
}) {
  const [description, setDescription] = useState(project.description);
  const [color, setColor] = useState(intToHex(project.color));
  const [iconUrl, setIconUrl] = useState(project.icon_url);
  const [links, setLinks] = useState(project.links.map((l) => ({ label: l.label, url: l.url })));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDescription(project.description);
      setColor(intToHex(project.color));
      setIconUrl(project.icon_url);
      setLinks(project.links.map((l) => ({ label: l.label, url: l.url })));
      setError("");
    }
  }, [project, open]);

  function addLink() { setLinks((l) => [...l, { label: "", url: "" }]); }
  function setLink(i: number, f: "label" | "url", v: string) {
    setLinks((l) => l.map((link, idx) => (idx === i ? { ...link, [f]: v } : link)));
  }
  function removeLink(i: number) { setLinks((l) => l.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const updated = await updateProject(project.id, {
        description,
        color: hexToInt(color),
        icon_url: iconUrl,
        links: links.filter((l) => l.label && l.url),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit: ${project.name}`} className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20" />
        <div className="grid grid-cols-2 gap-3">
          <ColorInput label="Embed Color" value={color} onChange={setColor} />
          <Input label="Icon URL" value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Links</span>
            <Button type="button" variant="ghost" size="sm" onClick={addLink}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <Input value={link.label} onChange={(e) => setLink(i, "label", e.target.value)} placeholder="Label" className="w-28 shrink-0" />
              <Input value={link.url} onChange={(e) => setLink(i, "url", e.target.value)} placeholder="https://…" />
              <button type="button" onClick={() => removeLink(i)} className="shrink-0 rounded px-2 text-muted-foreground hover:text-foreground">×</button>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

function ChangelogModal({
  projectId,
  projectColor,
  existing,
  open,
  onClose,
  onSaved,
}: {
  projectId: string;
  projectColor: number;
  existing?: Changelog;
  open: boolean;
  onClose: () => void;
  onSaved: (cl: Changelog) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [version, setVersion] = useState(existing?.version ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(existing?.title ?? "");
      setVersion(existing?.version ?? "");
      setContent(existing?.content ?? "");
      setError("");
    }
  }, [existing, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setError("Title and content are required."); return; }
    setLoading(true);
    setError("");
    try {
      const cl = existing
        ? await updateChangelog(projectId, existing.id, { title, version, content })
        : await postChangelog(projectId, { title, version, content });
      onSaved(cl);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? "Edit Changelog Entry" : "New Changelog Entry"} className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What changed?" />
          </div>
          <Input label="Version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.2.0" />
        </div>
        <Textarea
          label="Content (supports markdown)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-36"
          placeholder={`- Fixed X\n- Added Y\n- Improved Z`}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{existing ? "Update" : "Post Changelog"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteModal({
  project,
  open,
  onClose,
  onDeleted,
}: {
  project: Project;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    try {
      const result = await deleteProject(project.id);
      if (result.errors?.length) {
        // Partial success — some Discord resources may have already been deleted
        setError(`Deleted from DB but some Discord items failed:\n${result.errors.join("\n")}`);
        setTimeout(onDeleted, 2000);
      } else {
        onDeleted();
      }
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete Project">
      {error ? (
        <div className="space-y-4">
          <Alert variant="error" className="whitespace-pre-wrap">{error}</Alert>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete <span className="font-medium text-foreground">{project.name}</span> and remove:
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-muted-foreground" />Both Discord roles</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-muted-foreground" />Info channel, help channel, and category</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-muted-foreground" />Onboarding option and default channel entry</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-muted-foreground" />All changelogs stored in this tool</li>
          </ul>
          <Alert variant="error">This cannot be undone.</Alert>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button variant="destructive" loading={loading} onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete Project
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingLog, setChangingLog] = useState(false);
  const [editingCl, setEditingCl] = useState<Changelog | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  useEffect(() => {
    if (!id) return;
    getProject(id)
      .then(setProject)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRefreshEmbed() {
    if (!project) return;
    setRefreshing(true);
    setRefreshMsg("");
    try {
      await refreshInfoEmbed(project.id);
      setRefreshMsg("Embed updated.");
    } catch (err) {
      setRefreshMsg("Error: " + String(err));
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !project) {
    return <div className="p-6"><Alert variant="error">{error || "Project not found."}</Alert></div>;
  }

  const changelogs = project.changelogs ?? [];

  return (
    <>
      <PageHeader
        title={project.name}
        description="Manage this project's Discord presence."
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-5xl flex-1 overflow-auto p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-4">
            {/* Embed preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Info Embed</p>
                  <Button size="sm" variant="ghost" loading={refreshing} onClick={handleRefreshEmbed}>
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                <div
                  className="rounded-lg border-l-2 bg-secondary px-4 py-3 space-y-2"
                  style={{ borderColor: intToHex(project.color) }}
                >
                  <div className="flex items-start gap-3">
                    {project.icon_url && (
                      <img src={project.icon_url} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{project.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                        {project.description || "No description."}
                      </p>
                    </div>
                  </div>
                  {project.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {project.links.map((l) => (
                        <a
                          key={l.id}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {refreshMsg && (
                  <p className={`mt-2 text-xs ${refreshMsg.startsWith("Error") ? "text-destructive" : "text-accent"}`}>
                    {refreshMsg}
                  </p>
                )}
              </CardBody>
            </Card>

            {/* Discord IDs */}
            <Card>
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Discord Resources</p>
              </CardHeader>
              <CardBody className="divide-y divide-border">
                <DiscordIdRow label="Support Role" id={project.support_role_id} />
                <DiscordIdRow label="General Role" id={project.general_role_id} />
                <DiscordIdRow label="Info Channel" id={project.info_channel_id} />
                <DiscordIdRow label="Help Channel" id={project.help_channel_id} />
                <DiscordIdRow label="Category" id={project.category_id} />
              </CardBody>
            </Card>
          </div>

          {/* Right column — changelog */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Changelog</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setEditingCl(undefined); setChangingLog(true); }}
                >
                  <Plus className="h-3.5 w-3.5" /> New Entry
                </Button>
              </div>
            </CardHeader>
            <CardBody className="flex-1 overflow-y-auto space-y-2 max-h-[520px]">
              {changelogs.length === 0 && (
                <p className="text-xs text-muted-foreground">No entries yet.</p>
              )}
              {changelogs.map((cl) => (
                <div
                  key={cl.id}
                  className="group rounded-lg border border-border p-3 transition-colors hover:border-ring/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {cl.title}
                        {cl.version && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">v{cl.version}</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                        {cl.content}
                      </p>
                    </div>
                    <button
                      onClick={() => { setEditingCl(cl); setChangingLog(true); }}
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(cl.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <EditProjectModal project={project} open={editing} onClose={() => setEditing(false)} onSaved={setProject} />
      <DeleteModal
        project={project}
        open={deleting}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate("/")}
      />
      <ChangelogModal
        projectId={project.id}
        projectColor={project.color}
        existing={editingCl}
        open={changingLog}
        onClose={() => { setChangingLog(false); setEditingCl(undefined); }}
        onSaved={(cl) => {
          setProject((p) => {
            if (!p) return p;
            const changelogs = editingCl
              ? (p.changelogs ?? []).map((c) => (c.id === cl.id ? cl : c))
              : [cl, ...(p.changelogs ?? [])];
            return { ...p, changelogs };
          });
        }}
      />
    </>
  );
}
