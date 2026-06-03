CREATE TABLE IF NOT EXISTS server_embeds (
  id TEXT PRIMARY KEY NOT NULL,
  channel_type TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  color INTEGER NOT NULL DEFAULT 0,
  footer TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings VALUES ('rules_channel_id', '1511795599186595921');
INSERT OR IGNORE INTO settings VALUES ('projects_info_channel_id', '1511819210643476590');
INSERT OR IGNORE INTO settings VALUES ('projects_embed_message_id', '');
INSERT OR IGNORE INTO settings VALUES ('projects_embed_title', 'Our Projects');
INSERT OR IGNORE INTO settings VALUES ('projects_embed_color', '2105893');
INSERT OR IGNORE INTO settings VALUES ('projects_embed_description', 'Explore our tools below.');
