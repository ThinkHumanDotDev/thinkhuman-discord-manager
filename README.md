# ThinkHuman Discord Manager

Internal tool for managing the ThinkHuman Discord server. Provides a dashboard for projects, settings, and server configuration.

## Packages

- `packages/api` — Cloudflare Worker (Hono), D1 database, protected by Cloudflare Access JWT validation
- `packages/bot` — Cloudflare Worker, Discord interactions endpoint
- `packages/frontend` — React/Vite app, deployed to Cloudflare Pages

## Setup

See [DEPLOY.md](DEPLOY.md) for full deployment instructions.

For local dev:

```bash
# Terminal 1
bun run dev:api

# Terminal 2
bun run dev:frontend
```

The frontend at `http://localhost:5173` proxies `/api` to the local worker at port 8788.

## Lint and format

```bash
bun run lint      # Biome: format, lint and import order; bun run lint:fix applies the safe fixes
```

Biome's settings come from the org's shared `@thinkhuman/biome-config` (`biome.jsonc` extends it). CI
runs it through the org's reusable workflow in `.github/workflows/lint.yml`.
