# Deployment Guide

## Prerequisites

- Cloudflare account with Workers, D1, and Pages enabled
- A Discord bot application with a bot token
- Cloudflare Access set up for your team domain
- `wrangler` CLI authenticated (`wrangler login`)
- `bun` installed

---

## 1. Create the D1 Database

```bash
wrangler d1 create thinkhuman-db
```

Copy the `database_id` from the output and paste it into `packages/api/wrangler.jsonc`:

```jsonc
"database_id": "YOUR_DATABASE_ID_HERE"
```

Run the migration:

```bash
bun run --cwd packages/api db:migrate
```

---

## 2. Configure `packages/api/wrangler.jsonc`

Set these `vars`:

| Key | Value |
|---|---|
| `GUILD_ID` | Your Discord server ID |
| `CF_ACCESS_AUD` | `your-team-domain:your-access-aud-tag` — format is `teamdomain:aud` where teamdomain is the subdomain of `.cloudflareaccess.com` |

Then set the bot token secret:

```bash
wrangler secret put DISCORD_BOT_TOKEN --config packages/api/wrangler.jsonc
```

---

## 3. Configure `packages/bot/wrangler.jsonc`

Set `GUILD_ID` in vars, then set secrets:

```bash
wrangler secret put DISCORD_PUBLIC_KEY --config packages/bot/wrangler.jsonc
wrangler secret put DISCORD_BOT_TOKEN --config packages/bot/wrangler.jsonc
wrangler secret put DISCORD_APPLICATION_ID --config packages/bot/wrangler.jsonc
```

---

## 4. Deploy the API Worker

```bash
bun run deploy:api
```

Note the Worker URL (e.g. `https://thinkhuman-api.YOUR_SUBDOMAIN.workers.dev`).

---

## 5. Deploy the Bot Worker

```bash
bun run deploy:bot
```

Note the bot Worker URL. Go to your Discord Developer Portal → your application → General Information → set the **Interactions Endpoint URL** to this Worker URL.

---

## 6. Deploy the Frontend

Build and deploy to Cloudflare Pages:

```bash
bun run --cwd packages/frontend build
wrangler pages deploy packages/frontend/dist --project-name thinkhuman-frontend
```

Or create the Pages project first:

```bash
wrangler pages project create thinkhuman-frontend
```

---

## 7. Wire up Cloudflare Access

1. Go to **Cloudflare Zero Trust → Access → Applications**
2. Create a new **Self-hosted** application
3. Set the domain to your Pages URL (e.g. `tool.yourdomain.com`)
4. Set the policy to allow your email (`mx.amory@gmail.com`)
5. Under **Settings → CORS**, also add your Pages URL as an allowed origin
6. Copy the **Application Audience (AUD) tag** and set it in `packages/api/wrangler.jsonc` as `CF_ACCESS_AUD` in the format `your-team:aud-tag`

Also add the **API worker URL** as a second Access application (same policy) so the API is protected separately.

---

## 8. Configure the bot for forum help channels

The bot posts a "Ping Support" button in help forum channels when new threads are opened. Because Workers can't maintain a WebSocket gateway, this is triggered by Discord's **outgoing webhook** (thread create event):

1. In Discord Developer Portal → your bot → add a **Webhook** for `THREAD_CREATE` events
2. Point it to `https://your-bot-worker.workers.dev/` — the bot will handle interaction buttons
3. Alternatively, use a Discord bot library on a separate long-running server if you need full gateway events

> **Note:** The `/internal/new-post` endpoint on the bot worker is available for the API worker or any trusted automation to POST to, triggering the support button message manually. It requires `Authorization: Bearer YOUR_BOT_TOKEN`.

---

## 9. Set the Settings in the UI

Once deployed, open the tool and go to **Settings**:

- **Support Role below ID**: `1511842020254154853`
- **General Role below ID**: `1511842182666125372`
- **Category below ID**: `1511798296744562809`
- **Onboarding Question ID**: paste the prompt ID from your Discord server's onboarding config

---

## Local Development

```bash
# Terminal 1 — API worker (with local D1)
bun run dev:api

# Terminal 2 — Frontend (proxies /api to :8788)
bun run dev:frontend
```

The frontend at `http://localhost:5173` proxies all `/api` requests to the local API worker.

For local dev, the CF Access JWT check will fail since there's no real token. You can temporarily bypass it by setting `CF_ACCESS_AUD` to `dev:dev` and modifying `src/index.ts` to skip validation when `env.CF_ACCESS_AUD === 'dev:dev'`.
