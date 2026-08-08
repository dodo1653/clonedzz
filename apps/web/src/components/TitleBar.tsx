import { useEffect, useState } from 'react'

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

/**
 * App chrome title bar. Always rendered (browser + Electron) so the desktop
 * frame and the web dashboard share one identity header. Window actions go
 * through `window.desktop` (exposed by preload.cjs) and no-op in a browser.
 */
export default function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const desktop = window.desktop

  useEffect(() => {
    if (!desktop) return
    const off = desktop.onMaximized(setMaximized)
    return off
  }, [desktop])

  return (
    <header className="titlebar" onDoubleClick={() => desktop?.toggleMaximize()}>
      <div className="titlebar-left" aria-hidden="true" />

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
