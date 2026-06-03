import { useState, useEffect } from "react";
import { PageHeader } from "../components/Layout.tsx";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
  ColorInput,
  Select,
  Alert,
  Separator,
} from "../components/ui.tsx";
import {
  getEmbeds,
  postEmbed,
  updateEmbed,
  getChannels,
  type Embed,
  type DiscordChannel,
} from "../lib/api.ts";
import { intToHex, hexToInt } from "../lib/utils.ts";
import { Send, Edit2, Loader2, Plus, Trash2 } from "lucide-react";

const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_ANNOUNCEMENT = 5;

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

function EmbedForm({
  channels,
  initial,
  onSubmit,
  submitLabel,
}: {
  channels: DiscordChannel[];
  initial?: Partial<Embed>;
  onSubmit: (data: {
    channel_id?: string;
    title: string;
    description: string;
    color: number;
    footer: string;
    image_url: string;
    fields: EmbedField[];
  }) => Promise<void>;
  submitLabel: string;
}) {
  const [channelId, setChannelId] = useState(initial?.channel_id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(intToHex(initial?.color ?? 0x000000));
  const [footer, setFooter] = useState(initial?.footer ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [fields, setFields] = useState<EmbedField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function addField() { setFields((f) => [...f, { name: "", value: "", inline: false }]); }
  function setField<K extends keyof EmbedField>(i: number, key: K, value: EmbedField[K]) {
    setFields((f) => f.map((field, idx) => (idx === i ? { ...field, [key]: value } : field)));
  }
  function removeField(i: number) { setFields((f) => f.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!initial?.channel_id && !channelId) { setError("Please select a channel."); return; }
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      await onSubmit({
        channel_id: channelId || undefined,
        title,
        description,
        color: hexToInt(color),
        footer,
        image_url: imageUrl,
        fields: fields.filter((f) => f.name && f.value),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const textChannels = channels
    .filter((c) => c.type === CHANNEL_TYPE_TEXT || c.type === CHANNEL_TYPE_ANNOUNCEMENT)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">Embed posted successfully!</Alert>}

      {!initial && (
        <Select
          label="Channel"
          value={channelId}
          onChange={setChannelId}
          placeholder="Select a channel…"
          options={textChannels.map((c) => ({ value: c.id, label: `#${c.name}` }))}
        />
      )}

      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Embed title" />

      <Textarea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-28"
        placeholder="Supports Discord markdown…"
      />

      <div className="grid grid-cols-2 gap-3">
        <ColorInput label="Color" value={color} onChange={setColor} />
        <Input label="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
      </div>

      <Input label="Footer" value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Footer text" />

      {/* Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Fields</span>
          <Button type="button" variant="ghost" size="sm" onClick={addField}>
            <Plus className="h-3 w-3" /> Add Field
          </Button>
        </div>
        {fields.map((field, i) => (
          <div key={i} className="flex gap-2 items-center rounded-lg border border-border p-2">
            <Input
              value={field.name}
              onChange={(e) => setField(i, "name", e.target.value)}
              placeholder="Name"
              className="w-32 shrink-0"
            />
            <Input
              value={field.value}
              onChange={(e) => setField(i, "value", e.target.value)}
              placeholder="Value"
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <input
                type="checkbox"
                checked={field.inline}
                onChange={(e) => setField(i, "inline", e.target.checked)}
                className="rounded"
              />
              Inline
            </label>
            <button type="button" onClick={() => removeField(i)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Live preview */}
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
            {fields.filter((f) => f.name && f.value).length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {fields.filter((f) => f.name && f.value).map((f, i) => (
                  <div key={i} className={f.inline ? "" : "col-span-2"}>
                    <p className="text-xs font-semibold">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.value}</p>
                  </div>
                ))}
              </div>
            )}
            {footer && (
              <p className="mt-1 border-t border-border pt-2 text-xs text-muted-foreground">{footer}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button type="submit" loading={loading} size="sm">
          <Send className="h-3.5 w-3.5" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function EmbedsPage() {
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [embeds, setEmbeds] = useState<Embed[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEmbed, setEditingEmbed] = useState<Embed | null>(null);

  useEffect(() => {
    Promise.all([getChannels(), getEmbeds()])
      .then(([ch, em]) => { setChannels(ch); setEmbeds(em); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Post Embed"
        description="Send formatted embeds to any channel."
      />

      <div className="mx-auto w-full max-w-5xl flex-1 overflow-auto p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          {/* Form */}
          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New Embed</p>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading channels…
                </div>
              ) : (
                <EmbedForm
                  channels={channels}
                  submitLabel="Post Embed"
                  onSubmit={async (data) => {
                    const em = await postEmbed(data as Parameters<typeof postEmbed>[0]);
                    setEmbeds((prev) => [em, ...prev]);
                  }}
                />
              )}
            </CardBody>
          </Card>

          {/* History */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Posted Embeds</p>
            {embeds.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground">No embeds posted yet.</p>
            )}
            {embeds.map((em) => (
              <Card key={em.id}>
                <CardHeader className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: intToHex(em.color) }} />
                      <p className="truncate text-sm font-medium">{em.title || "(no title)"}</p>
                    </div>
                    <button
                      onClick={() => setEditingEmbed(editingEmbed?.id === em.id ? null : em)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    #{channels.find((c) => c.id === em.channel_id)?.name ?? em.channel_id}
                    {" · "}
                    {new Date(em.created_at).toLocaleDateString()}
                  </p>
                </CardHeader>
                {editingEmbed?.id === em.id && (
                  <CardBody>
                    <EmbedForm
                      channels={channels}
                      initial={em}
                      submitLabel="Update Embed"
                      onSubmit={async (data) => {
                        const updated = await updateEmbed(em.id, data);
                        setEmbeds((prev) => prev.map((e) => (e.id === em.id ? updated : e)));
                        setEditingEmbed(null);
                      }}
                    />
                  </CardBody>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
