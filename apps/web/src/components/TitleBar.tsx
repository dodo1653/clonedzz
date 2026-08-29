import { useEffect, useState } from 'react'
import type { Theme } from '../types'
import { nextTheme } from '../types'

function MinimizeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M2.2 6.5h8.6" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <rect x="2.2" y="2.2" width="8.6" height="8.6" rx="1.4" stroke="currentColor" strokeWidth="1.15" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M4.9 3.9V2.4h6.1v6.1H9.5" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
      <rect x="2" y="4.4" width="6.1" height="6.1" rx="1.2" stroke="currentColor" strokeWidth="1.15" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M3.1 3.1l6.8 6.8M9.9 3.1L3.1 9.9" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 4h9M2.5 7h9M2.5 10h9" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  )
}

/**
 * App chrome title bar. Always rendered (browser + Electron) so the desktop
 * frame and the web dashboard share one identity header. Window actions go
 * through `window.desktop` (exposed by preload.cjs) and no-op in a browser.
 */
export default function TitleBar({ sidebarOpen, onToggleSidebar, theme, onToggleTheme }: { sidebarOpen: boolean; onToggleSidebar: () => void; theme: Theme; onToggleTheme: () => void }) {
  const [maximized, setMaximized] = useState(false)
  const desktop = window.desktop

  useEffect(() => {
    if (!desktop) return
    const off = desktop.onMaximized(setMaximized)
    return off
  }, [desktop])

  const themeIcon = theme === 'dark' ? '☾' : theme === 'light' ? '☼' : theme === 'dim' ? '◐' : theme === 'ocean' ? '◈' : theme === 'ember' ? '◉' : theme === 'violet' ? '◇' : '◎'
  const themeLabel = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : theme === 'dim' ? 'dim' : theme === 'ocean' ? 'ocean' : theme === 'ember' ? 'ember' : theme === 'violet' ? 'violet' : 'rose'

  return (
    <header className="titlebar" onDoubleClick={() => desktop?.toggleMaximize()}>
      <div className="titlebar-left">
        {!sidebarOpen && (
          <button
            type="button"
            className="tb-btn sidebar-hamburger"
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <MenuIcon />
          </button>
        )}
        <button
          type="button"
          className="tb-btn theme-btn"
          onClick={onToggleTheme}
          aria-label={`Switch to ${nextTheme(theme)} theme`}
          title={`switch to ${nextTheme(theme)} theme`}
        >
          <span className="tb-theme-icon">{themeIcon}</span>
          <span className="tb-theme-label">{themeLabel}</span>
        </button>
      </div>

      <div className="titlebar-brand">
        clone<em>dzz</em>
      </div>

      <div className="titlebar-controls">
        <button type="button" className="tb-btn" onClick={() => desktop?.minimize()} aria-label="Minimize" title="Minimize">
          <MinimizeIcon />
        </button>
        <button
          type="button"
          className="tb-btn"
          onClick={() => desktop?.toggleMaximize()}
          aria-label={maximized ? 'Restore' : 'Maximize'}
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button type="button" className="tb-btn tb-close" onClick={() => desktop?.close()} aria-label="Close" title="Close">
          <CloseIcon />
        </button>
      </div>
    </header>
  )
}
