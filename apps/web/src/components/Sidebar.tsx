import type { ReactNode } from 'react'
import type { SessionItem, ThemeItem, TokenPreset } from '../types'

function hostOf(u: string): string {
  try {
    return new URL(u).host
  } catch {
    return u
  }
}

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function SideSection({
  label,
  count,
  empty,
  collapsed,
  onToggle,
  children,
}: {
  label: string
  count: number
  empty: string
  collapsed?: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="side-sec">
      <div className="side-head" onClick={onToggle}>
        <span className="side-label">{label}</span>
        <span className="side-count">{count}</span>
        <span className={`chev ${collapsed ? 'closed' : ''}`}>▾</span>
      </div>
      {!collapsed && (
        <div className="side-body">
          {count === 0 && <div className="empty">{empty}</div>}
          {children}
        </div>
      )}
    </section>
  )
}

function SessionRow({
  item,
  active,
  editing,
  editName,
  onEditName,
  onSelect,
  onRename,
  onSave,
  onCancel,
  onDelete,
}: {
  item: SessionItem
  active: boolean
  editing: boolean
  editName: string
  onEditName: (v: string) => void
  onSelect: () => void
  onRename: () => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const name = item.meta.name || item.summary.name
  if (editing) {
    return (
      <div className="item editing" onClick={(e) => e.stopPropagation()}>
        <input
          className="rename-input"
          value={editName}
          autoFocus
          onChange={(e) => onEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave()
            if (e.key === 'Escape') onCancel()
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="item-actions">
          <button className="icon-btn ok" onClick={onSave} title="save">
            ✓
          </button>
          <button className="icon-btn" onClick={onCancel} title="cancel">
            ✕
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className={`item session ${active ? 'active' : ''}`} onClick={onSelect} title={item.meta.sourceUrl}>
      <div className="col">
        <div className="nm">{name}</div>
        <div className="sub">
          {hostOf(item.meta.sourceUrl)} · {when(item.meta.createdAt)}
        </div>
      </div>
      <div className="item-actions">
        <button
          className="icon-btn"
          onClick={(e) => {
            e.stopPropagation()
            onRename()
          }}
          title="rename"
        >
          ✎
        </button>
        <button
          className="icon-btn danger"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="delete"
        >
          🗑
        </button>
      </div>
    </div>
  )
}

export function Sidebar({
  sessions,
  themes,
  tokens,
  collapsed,
  onToggle,
  activeSessionId,
  editingId,
  editName,
  onEditName,
  onSelectSession,
  onRenameSession,
  onSaveRename,
  onCancelRename,
  onDeleteSession,
  onLoadTheme,
  onApplyToken,
  lightMode,
  onToggleTheme,
  onHome,
}: {
  sessions: SessionItem[]
  themes: ThemeItem[]
  tokens: TokenPreset[]
  collapsed: Record<string, boolean>
  onToggle: (k: string) => void
  activeSessionId: string
  editingId: string | null
  editName: string
  onEditName: (v: string) => void
  onSelectSession: (id: string) => void
  onRenameSession: (s: SessionItem) => void
  onSaveRename: () => void
  onCancelRename: () => void
  onDeleteSession: (id: string) => void
  onLoadTheme: (t: ThemeItem) => void
  onApplyToken: (t: TokenPreset) => void
  lightMode: boolean
  onToggleTheme: () => void
  onHome: () => void
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-topline brand-home" onClick={onHome} role="button" tabIndex={0} title="Return home" onKeyDown={(e) => e.key === 'Enter' && onHome()}>
          <div className="brand-line">
            clone<span>dzz</span>
          </div>
          <span className="brand-orbit" aria-hidden="true" />
        </div>
        <div className="brand-sub">replicate · runnable Vite+React</div>
        <button className="theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${lightMode ? 'dark' : 'light'} theme`}>
          <span className="theme-spark" aria-hidden="true">{lightMode ? '☾' : '☼'}</span>
          <span>{lightMode ? 'light room' : 'dark room'}</span>
        </button>
      </div>

      <SideSection
        label="sessions"
        count={sessions.length}
        empty="no analyses yet"
        collapsed={collapsed.sessions}
        onToggle={() => onToggle('sessions')}
      >
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            item={s}
            active={activeSessionId === s.id}
            editing={editingId === s.id}
            editName={editName}
            onEditName={onEditName}
            onSelect={() => onSelectSession(s.id)}
            onRename={() => onRenameSession(s)}
            onSave={onSaveRename}
            onCancel={onCancelRename}
            onDelete={() => onDeleteSession(s.id)}
          />
        ))}
      </SideSection>

      <SideSection
        label="themes"
        count={themes.length}
        empty="no saved themes"
        collapsed={collapsed.themes}
        onToggle={() => onToggle('themes')}
      >
        {themes.map((t) => (
          <div key={t.name} className="item" onClick={() => onLoadTheme(t)} title={t.recipe.sourceUrl}>
            <div className="col">
              <div className="nm">{t.recipe.name}</div>
              <div className="sub">{hostOf(t.recipe.sourceUrl)}</div>
            </div>
          </div>
        ))}
      </SideSection>

      <SideSection
        label="tokens"
        count={tokens.length}
        empty="none saved"
        collapsed={collapsed.tokens}
        onToggle={() => onToggle('tokens')}
      >
        {tokens.map((t) => (
          <div key={t.id} className="item" onClick={() => onApplyToken(t)}>
            <div className="col">
              <div className="nm">
                {t.data.name} / {t.data.ticker}
              </div>
              <div className="sub">{t.data.ca.slice(0, 20)}…</div>
            </div>
          </div>
        ))}
      </SideSection>
    </aside>
  )
}
