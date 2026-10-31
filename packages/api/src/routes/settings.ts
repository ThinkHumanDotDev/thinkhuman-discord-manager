import { Hono } from 'hono'
import type { Env } from '../env.ts'

const settings = new Hono<{ Bindings: Env }>()

settings.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT key, value FROM settings').all()
  const obj: Record<string, string> = {}
  for (const row of rows.results as Array<{ key: string; value: string }>) {
    obj[row.key] = row.value
  }
  return c.json(obj)
})

settings.put('/', async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const allowed = [
    'support_role_below_id',
    'general_role_below_id',
    'category_below_id',
    'onboarding_question_id',
  ]
  const stmts = []
  for (const key of allowed) {
    if (key in body) {
      stmts.push(
        c.env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(
          key,
          body[key],
        ),
      )
    }
  }
  if (stmts.length > 0) {
    await c.env.DB.batch(stmts)
  }
  return c.json({ ok: true })
})

export default settings
