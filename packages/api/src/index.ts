import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { validateCfAccessJwt } from './auth.ts'
import type { Env } from './env.ts'
import embeds from './routes/embeds.ts'
import guild from './routes/guild.ts'
import projects from './routes/projects.ts'
import server from './routes/server.ts'
import settings from './routes/settings.ts'

const app = new Hono<{ Bindings: Env }>()

app.use(
  '/api/*',
  cors({
    origin: (origin) =>
      origin === 'https://thinkhuman-discord-tool-frontend.pages.dev' ||
      origin?.startsWith('http://localhost')
        ? origin
        : null,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

// Cloudflare Access JWT validation middleware
app.use('/api/*', async (c, next) => {
  // CF_ACCESS_AUD format: "team-domain:audience-tag"
  const [teamDomain, aud] = c.env.CF_ACCESS_AUD.split(':')
  if (!teamDomain || !aud) {
    return c.json({ error: 'Server misconfiguration: invalid CF_ACCESS_AUD' }, 500)
  }

  // Local dev bypass — set CF_ACCESS_AUD=dev:dev in wrangler.jsonc vars
  if (teamDomain === 'dev' && aud === 'dev') {
    await next()
    return
  }

  // CF-Access-Jwt-Assertion is injected by Cloudflare Access automatically
  const jwt =
    c.req.header('CF-Access-Jwt-Assertion') ?? c.req.header('Authorization')?.replace('Bearer ', '')

  if (!jwt) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    await validateCfAccessJwt(jwt, aud, teamDomain)
  } catch (err) {
    return c.json({ error: 'Unauthorized', detail: String(err) }, 401)
  }

  await next()
})

app.route('/api/projects', projects)
app.route('/api/settings', settings)
app.route('/api/guild', guild)
app.route('/api/embeds', embeds)
app.route('/api/server', server)

app.get('/health', (c) => c.json({ ok: true }))

export default app
