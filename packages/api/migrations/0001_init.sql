-- ThinkHuman Discord Tool - Initial Schema

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- Default configurable positions
INSERT OR IGNORE INTO settings VALUES ('support_role_below_id', '1511842020254154853');
INSERT OR IGNORE INTO settings VALUES ('general_role_below_id', '1511842182666125372');
INSERT OR IGNORE INTO settings VALUES ('category_below_id', '1511798296744562809');
INSERT OR IGNORE INTO settings VALUES ('onboarding_question_id', '');

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  color INTEGER NOT NULL DEFAULT 5793266, -- 0x586772 neutral grey
  icon_url TEXT NOT NULL DEFAULT '',
  support_role_id TEXT NOT NULL DEFAULT '',
  general_role_id TEXT NOT NULL DEFAULT '',
  info_channel_id TEXT NOT NULL DEFAULT '',
  help_channel_id TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL DEFAULT '',
  info_message_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_links (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS changelogs (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  message_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS embeds (
  id TEXT PRIMARY KEY NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  color INTEGER NOT NULL DEFAULT 5793266,
  footer TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
