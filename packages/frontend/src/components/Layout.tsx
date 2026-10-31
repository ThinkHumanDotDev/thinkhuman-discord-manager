import {
  Hash,
  LayoutGrid,
  type LucideIcon,
  Megaphone,
  PanelLeft,
  PanelLeftClose,
  Server,
  Settings,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { type GuildInfo, getGuildInfo } from '../lib/api.ts'
import { cn } from '../lib/utils.ts'

// ── Dot pattern ──────────────────────────────────────────────────────────────

function PatternedBackground({ className }: { className?: string }) {
  const patternId = `pattern-${useId().replace(/:/g, '')}`
  return (
    <div className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}>
      <svg className="h-full w-full" aria-hidden>
        <pattern
          id={patternId}
          x="10"
          y="10"
          width="14.423223834988539"
          height="14.423223834988539"
          patternUnits="userSpaceOnUse"
          patternTransform="translate(-0.45072574484339184,-0.45072574484339184)"
        >
          <circle
            cx="0.45072574484339184"
            cy="0.45072574484339184"
            r="0.45072574484339184"
            fill="var(--pattern-dot)"
          />
        </pattern>
        <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  )
}

// ── Kbd hint ─────────────────────────────────────────────────────────────────

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground uppercase">
      {children}
    </kbd>
  )
}

// ── Nav config ────────────────────────────────────────────────────────────────

const nav: { to: string; label: string; icon: LucideIcon; shortcut: string; exact?: boolean }[] = [
  { to: '/', label: 'Projects', icon: LayoutGrid, shortcut: 'p', exact: true },
  { to: '/server', label: 'Server', icon: Server, shortcut: 'v' },
  { to: '/embeds', label: 'Post Embed', icon: Megaphone, shortcut: 'e' },
  { to: '/settings', label: 'Settings', icon: Settings, shortcut: 's' },
]

function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function GuildIcon({ info, size }: { info: GuildInfo; size: number }) {
  if (info.icon) {
    const url = `https://cdn.discordapp.com/icons/${info.id}/${info.icon}.webp?size=64`
    return (
      <img
        src={url}
        alt={info.name}
        width={size}
        height={size}
        className="rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md bg-violet-600"
      style={{ width: size, height: size }}
    >
      <Hash className="text-white" style={{ width: size * 0.6, height: size * 0.6 }} />
    </div>
  )
}

function Sidebar() {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [guildInfo, setGuildInfo] = useState<GuildInfo | null>(null)

  useEffect(() => {
    getGuildInfo()
      .then(setGuildInfo)
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      const item = nav.find(({ shortcut }) => shortcut === e.key.toLowerCase())
      if (item) {
        e.preventDefault()
        navigate(item.to)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col bg-sidebar transition-all duration-200',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      {/* Top bar */}
      <div
        className={cn(
          'flex items-center gap-2 p-2',
          collapsed ? 'justify-center' : 'justify-between pb-4',
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 px-2">
            {guildInfo ? (
              <GuildIcon info={guildInfo} size={24} />
            ) : (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-600">
                <Hash className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
              {guildInfo?.name ?? 'thinkhuman'}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'group rounded p-1 text-muted-foreground hover:bg-sidebar-accent transition-colors',
            collapsed ? '' : 'ml-auto',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
          ) : (
            <PanelLeftClose className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
          )}
        </button>
      </div>

      {!collapsed && <div className="mx-2 mb-1 h-px bg-sidebar-border" />}

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2 pt-2">
        {nav.map(({ to, label, icon: Icon, shortcut, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            title={collapsed ? `${label} (${shortcut})` : undefined}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
                collapsed ? 'justify-center' : 'w-full',
                isActive
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <Kbd>{shortcut}</Kbd>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="mx-2 mb-3 mt-2 px-2">
          <p className="text-xs text-muted-foreground">Protected by Cloudflare Access</p>
        </div>
      )}
    </aside>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-sidebar text-foreground md:py-3 md:pr-3">
      <Sidebar />
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/* dot pattern sits behind the floating card */}
        <PatternedBackground />
        <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-background md:rounded-lg md:border md:border-border">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </main>
    </div>
  )
}

// ── Page header ───────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
      <div>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
