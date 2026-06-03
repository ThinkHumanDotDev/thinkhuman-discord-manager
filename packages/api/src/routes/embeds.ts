import { Hono } from "hono";
import type { Env } from "../env.ts";
import { sendMessage, editMessage } from "../discord.ts";

const embeds = new Hono<{ Bindings: Env }>();

function nanoid(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 16);
}

embeds.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT * FROM embeds ORDER BY created_at DESC",
  ).all();
  return c.json(rows.results);
});

embeds.post("/", async (c) => {
  const body = await c.req.json<{
    channel_id: string;
    title?: string;
    description?: string;
    color?: number;
    footer?: string;
    image_url?: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  }>();

  if (!body.channel_id) return c.json({ error: "channel_id required" }, 400);

  const id = nanoid();
  const embed: Record<string, unknown> = {
    title: body.title,
    description: body.description,
    color: body.color,
    footer: body.footer ? { text: body.footer } : undefined,
    image: body.image_url ? { url: body.image_url } : undefined,
    fields: body.fields,
    timestamp: new Date().toISOString(),
  };

  const msg = await sendMessage(c.env, body.channel_id, { embeds: [embed] });

  await c.env.DB.prepare(
    `INSERT INTO embeds (id, channel_id, message_id, title, description, color, footer, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.channel_id,
      msg.id,
      body.title ?? "",
      body.description ?? "",
      body.color ?? 5793266,
      body.footer ?? "",
      body.image_url ?? "",
    )
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM embeds WHERE id = ?")
    .bind(id)
    .first();

  return c.json(row, 201);
});

embeds.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    title?: string;
    description?: string;
    color?: number;
    footer?: string;
    image_url?: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  }>();

  const row = await c.env.DB.prepare("SELECT * FROM embeds WHERE id = ?")
    .bind(id)
    .first<{
      channel_id: string;
      message_id: string;
      title: string;
      description: string;
      color: number;
      footer: string;
      image_url: string;
    }>();

  if (!row) return c.json({ error: "Not found" }, 404);

  const newTitle = body.title ?? row.title;
  const newDesc = body.description ?? row.description;
  const newColor = body.color ?? row.color;
  const newFooter = body.footer ?? row.footer;
  const newImageUrl = body.image_url ?? row.image_url;

  await c.env.DB.prepare(
    "UPDATE embeds SET title = ?, description = ?, color = ?, footer = ?, image_url = ? WHERE id = ?",
  )
    .bind(newTitle, newDesc, newColor, newFooter, newImageUrl, id)
    .run();

  const embed: Record<string, unknown> = {
    title: newTitle || undefined,
    description: newDesc || undefined,
    color: newColor,
    footer: newFooter ? { text: newFooter } : undefined,
    image: newImageUrl ? { url: newImageUrl } : undefined,
    fields: body.fields,
    timestamp: new Date().toISOString(),
  };

  await editMessage(c.env, row.channel_id, row.message_id, {
    embeds: [embed],
  }).catch(() => { /* non-fatal if message was deleted */ });

  const updated = await c.env.DB.prepare("SELECT * FROM embeds WHERE id = ?")
    .bind(id)
    .first();

  return c.json(updated);
});

export default embeds;
