import { Hono } from "hono";
import type { Env } from "../env.ts";
import {
  createRole,
  repositionRole,
  createCategory,
  createTextChannel,
  createForumChannel,
  configureHelpChannel,
  addOnboardingRole,
  addDefaultChannel,
  deleteRole,
  deleteChannel,
  removeOnboardingRole,
  removeDefaultChannel,
  buildInfoEmbed,
  buildChangelogEmbed,
  sendMessage,
  editMessage,
} from "../discord.ts";

// Discord permission bits
const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const READ_MESSAGE_HISTORY = 1n << 16n;
const EVERYONE_ROLE_ID = "0"; // @everyone uses guild id but we'll pass "0" as placeholder

const projects = new Hono<{ Bindings: Env }>();

function nanoid(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 16);
}

async function getSetting(db: D1Database, key: string): Promise<string> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? "";
}

projects.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT * FROM projects ORDER BY created_at DESC",
  ).all();

  const projectList = await Promise.all(
    (rows.results as Array<Record<string, unknown>>).map(async (p) => {
      const links = await c.env.DB.prepare(
        "SELECT * FROM project_links WHERE project_id = ? ORDER BY sort_order ASC",
      )
        .bind(p["id"])
        .all();
      return { ...p, links: links.results };
    }),
  );

  return c.json(projectList);
});

projects.get("/:id", async (c) => {
  const id = c.req.param("id");
  const project = await c.env.DB.prepare(
    "SELECT * FROM projects WHERE id = ?",
  )
    .bind(id)
    .first<Record<string, unknown>>();

  if (!project) return c.json({ error: "Not found" }, 404);

  const links = await c.env.DB.prepare(
    "SELECT * FROM project_links WHERE project_id = ? ORDER BY sort_order ASC",
  )
    .bind(id)
    .all();

  const changelogs = await c.env.DB.prepare(
    "SELECT * FROM changelogs WHERE project_id = ? ORDER BY created_at DESC",
  )
    .bind(id)
    .all();

  return c.json({ ...project, links: links.results, changelogs: changelogs.results });
});

projects.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    description?: string;
    color?: number;
    icon_url?: string;
    links?: Array<{ label: string; url: string }>;
  }>();

  if (!body.name) return c.json({ error: "name is required" }, 400);

  const id = nanoid();
  const color = body.color ?? 5793266;
  const name = body.name.trim();
  const safeName = name.toLowerCase().replace(/\s+/g, "-");

  // Fetch settings for role/channel positions
  const supportBelowId = await getSetting(c.env.DB, "support_role_below_id");
  const generalBelowId = await getSetting(c.env.DB, "general_role_below_id");
  const categoryBelowId = await getSetting(c.env.DB, "category_below_id");
  const onboardingQuestionId = await getSetting(c.env.DB, "onboarding_question_id");
  const guildId = c.env.GUILD_ID;

  // 1. Create roles
  const supportRole = await createRole(
    c.env,
    `${name}-support`,
    0xe74c3c, // #e74c3c
    true,
  );
  const generalRole = await createRole(c.env, name, 0, false);

  // 2. Reposition roles
  if (supportBelowId) {
    await repositionRole(c.env, supportRole.id, supportBelowId);
  }
  if (generalBelowId) {
    await repositionRole(c.env, generalRole.id, generalBelowId);
  }

  // 3. Create category under staff category
  const category = await createCategory(c.env, name);

  // 4. Permission overwrites for info channel: read-only for @everyone + general role
  // @everyone: deny send messages, allow view + read history
  // general role: allow view
  const infoPerms = [
    {
      id: guildId, // @everyone
      type: 0,
      allow: String(VIEW_CHANNEL | READ_MESSAGE_HISTORY),
      deny: String(SEND_MESSAGES),
    },
    {
      id: generalRole.id,
      type: 0,
      allow: String(VIEW_CHANNEL | READ_MESSAGE_HISTORY),
      deny: "0",
    },
  ];

  // 5. Create info (text) and help (forum) channels
  const infoChannel = await createTextChannel(
    c.env,
    `${safeName}-info`,
    category.id,
    infoPerms,
  );

  const helpChannel = await createForumChannel(
    c.env,
    `${safeName}-help`,
    category.id,
    // Inherits category perms, but let's be explicit
    [],
  );

  // 6. Configure help forum channel
  await configureHelpChannel(c.env, helpChannel.id, name, supportRole.id).catch(() => { /* non-fatal */ });

  // 7. Add general role to onboarding question
  if (onboardingQuestionId) {
    await addOnboardingRole(
      c.env,
      onboardingQuestionId,
      generalRole.id,
      name,
      body.description ?? name,
    ).catch(() => { /* non-fatal */ });
  }

  // 8. Add category to onboarding default channels
  await addDefaultChannel(c.env, category.id).catch(() => { /* non-fatal */ });

  // 9. Save to DB
  const projectLinks = body.links ?? [];
  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `INSERT INTO projects (id, name, description, color, icon_url, support_role_id, general_role_id, info_channel_id, help_channel_id, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      name,
      body.description ?? "",
      color,
      body.icon_url ?? "",
      supportRole.id,
      generalRole.id,
      infoChannel.id,
      helpChannel.id,
      category.id,
    ),
    ...projectLinks.map((link, i) =>
      c.env.DB.prepare(
        "INSERT INTO project_links (id, project_id, label, url, sort_order) VALUES (?, ?, ?, ?, ?)",
      ).bind(nanoid(), id, link.label, link.url, i),
    ),
  ];
  await c.env.DB.batch(stmts);

  // 9. Post initial info embed
  const links = await c.env.DB.prepare(
    "SELECT * FROM project_links WHERE project_id = ? ORDER BY sort_order ASC",
  )
    .bind(id)
    .all();

  const embed = buildInfoEmbed({
    name,
    description: body.description ?? "",
    color,
    icon_url: body.icon_url ?? "",
    links: links.results as Array<{ label: string; url: string }>,
  });

  const msg = await sendMessage(c.env, infoChannel.id, embed);
  await c.env.DB.prepare(
    "UPDATE projects SET info_message_id = ? WHERE id = ?",
  )
    .bind(msg.id, id)
    .run();

  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first();

  return c.json({ ...project, links: links.results }, 201);
});

projects.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    description?: string;
    color?: number;
    icon_url?: string;
    links?: Array<{ label: string; url: string }>;
  }>();

  const project = await c.env.DB.prepare(
    "SELECT * FROM projects WHERE id = ?",
  )
    .bind(id)
    .first<{
      id: string;
      name: string;
      description: string;
      color: number;
      icon_url: string;
      info_channel_id: string;
      info_message_id: string;
    }>();

  if (!project) return c.json({ error: "Not found" }, 404);

  const newDescription = body.description ?? project.description;
  const newColor = body.color ?? project.color;
  const newIconUrl = body.icon_url ?? project.icon_url;

  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(
      "UPDATE projects SET description = ?, color = ?, icon_url = ? WHERE id = ?",
    ).bind(newDescription, newColor, newIconUrl, id),
  ];

  if (body.links !== undefined) {
    stmts.push(
      c.env.DB.prepare(
        "DELETE FROM project_links WHERE project_id = ?",
      ).bind(id),
    );
    for (let i = 0; i < body.links.length; i++) {
      const link = body.links[i]!;
      stmts.push(
        c.env.DB.prepare(
          "INSERT INTO project_links (id, project_id, label, url, sort_order) VALUES (?, ?, ?, ?, ?)",
        ).bind(nanoid(), id, link.label, link.url, i),
      );
    }
  }

  await c.env.DB.batch(stmts);

  const links = await c.env.DB.prepare(
    "SELECT * FROM project_links WHERE project_id = ? ORDER BY sort_order ASC",
  )
    .bind(id)
    .all();

  // Update the info embed if it exists
  if (project.info_channel_id && project.info_message_id) {
    const embed = buildInfoEmbed({
      name: project.name,
      description: newDescription,
      color: newColor,
      icon_url: newIconUrl,
      links: links.results as Array<{ label: string; url: string }>,
    });
    await editMessage(
      c.env,
      project.info_channel_id,
      project.info_message_id,
      embed,
    ).catch(() => { /* non-fatal */ });
  }

  const updated = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first();

  return c.json({ ...updated, links: links.results });
});

// Post/refresh info embed
projects.post("/:id/embed", async (c) => {
  const id = c.req.param("id");
  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first<{
      id: string;
      name: string;
      description: string;
      color: number;
      icon_url: string;
      info_channel_id: string;
      info_message_id: string;
    }>();

  if (!project) return c.json({ error: "Not found" }, 404);

  const links = await c.env.DB.prepare(
    "SELECT * FROM project_links WHERE project_id = ? ORDER BY sort_order ASC",
  )
    .bind(id)
    .all();

  const embed = buildInfoEmbed({
    name: project.name,
    description: project.description,
    color: project.color,
    icon_url: project.icon_url,
    links: links.results as Array<{ label: string; url: string }>,
  });

  if (project.info_message_id) {
    await editMessage(
      c.env,
      project.info_channel_id,
      project.info_message_id,
      embed,
    );
    return c.json({ ok: true, message_id: project.info_message_id });
  }

  const msg = await sendMessage(c.env, project.info_channel_id, embed);
  await c.env.DB.prepare("UPDATE projects SET info_message_id = ? WHERE id = ?")
    .bind(msg.id, id)
    .run();

  return c.json({ ok: true, message_id: msg.id });
});

// Post a changelog entry
projects.post("/:id/changelog", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    title: string;
    version?: string;
    content: string;
  }>();

  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first<{ id: string; color: number; info_channel_id: string }>();

  if (!project) return c.json({ error: "Not found" }, 404);

  const clId = nanoid();
  const embed = buildChangelogEmbed({
    title: body.title,
    version: body.version ?? "",
    content: body.content,
    color: project.color,
  });

  const msg = await sendMessage(c.env, project.info_channel_id, embed);

  await c.env.DB.prepare(
    "INSERT INTO changelogs (id, project_id, version, title, content, message_id) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(clId, id, body.version ?? "", body.title, body.content, msg.id)
    .run();

  const cl = await c.env.DB.prepare(
    "SELECT * FROM changelogs WHERE id = ?",
  )
    .bind(clId)
    .first();

  return c.json(cl, 201);
});

// Update a changelog entry
projects.put("/:id/changelog/:clId", async (c) => {
  const { id, clId } = c.req.param();
  const body = await c.req.json<{
    title?: string;
    version?: string;
    content?: string;
  }>();

  const cl = await c.env.DB.prepare(
    "SELECT * FROM changelogs WHERE id = ? AND project_id = ?",
  )
    .bind(clId, id)
    .first<{
      id: string;
      project_id: string;
      title: string;
      version: string;
      content: string;
      message_id: string;
    }>();

  if (!cl) return c.json({ error: "Not found" }, 404);

  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first<{ color: number; info_channel_id: string }>();

  if (!project) return c.json({ error: "Project not found" }, 404);

  const newTitle = body.title ?? cl.title;
  const newVersion = body.version ?? cl.version;
  const newContent = body.content ?? cl.content;

  await c.env.DB.prepare(
    "UPDATE changelogs SET title = ?, version = ?, content = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(newTitle, newVersion, newContent, clId)
    .run();

  if (cl.message_id) {
    const embed = buildChangelogEmbed({
      title: newTitle,
      version: newVersion,
      content: newContent,
      color: project.color,
    });
    await editMessage(
      c.env,
      project.info_channel_id,
      cl.message_id,
      embed,
    ).catch(() => { /* non-fatal */ });
  }

  const updated = await c.env.DB.prepare(
    "SELECT * FROM changelogs WHERE id = ?",
  )
    .bind(clId)
    .first();

  return c.json(updated);
});

projects.post("/:id/configure-help", async (c) => {
  const id = c.req.param("id");
  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first<{ id: string; name: string; help_channel_id: string; support_role_id: string }>();

  if (!project) return c.json({ error: "Not found" }, 404);
  if (!project.help_channel_id) return c.json({ error: "No help channel on this project" }, 400);

  await configureHelpChannel(c.env, project.help_channel_id, project.name, project.support_role_id);

  return c.json({ ok: true });
});

projects.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first<{
      id: string;
      name: string;
      support_role_id: string;
      general_role_id: string;
      info_channel_id: string;
      help_channel_id: string;
      category_id: string;
    }>();

  if (!project) return c.json({ error: "Not found" }, 404);

  const onboardingQuestionId = await getSetting(c.env.DB, "onboarding_question_id");
  const errors: string[] = [];

  // Delete help channel first (child of category), then info channel, then category
  if (project.help_channel_id) {
    await deleteChannel(c.env, project.help_channel_id).catch((e) =>
      errors.push(`help channel: ${e.message}`),
    );
  }
  if (project.info_channel_id) {
    await deleteChannel(c.env, project.info_channel_id).catch((e) =>
      errors.push(`info channel: ${e.message}`),
    );
  }
  if (project.category_id) {
    await removeDefaultChannel(c.env, project.category_id).catch(() => {});
    await deleteChannel(c.env, project.category_id).catch((e) =>
      errors.push(`category: ${e.message}`),
    );
  }

  // Remove general role from onboarding, then delete both roles
  if (onboardingQuestionId && project.general_role_id) {
    await removeOnboardingRole(c.env, onboardingQuestionId, project.general_role_id).catch(
      () => {},
    );
  }
  if (project.support_role_id) {
    await deleteRole(c.env, project.support_role_id).catch((e) =>
      errors.push(`support role: ${e.message}`),
    );
  }
  if (project.general_role_id) {
    await deleteRole(c.env, project.general_role_id).catch((e) =>
      errors.push(`general role: ${e.message}`),
    );
  }

  // Remove from DB (cascades to project_links and changelogs)
  await c.env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();

  return c.json({ ok: true, errors: errors.length > 0 ? errors : undefined });
});

export default projects;
