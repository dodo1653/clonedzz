import { useState } from 'react'

export interface UpdateBannerProps {
  status: UpdateStatus
  onInstall: () => void
}

/**
 * Desktop auto-update banner. Only ever receives meaningful statuses when running
 * inside the Electron app (main.cjs sends `update:status` events); in a plain
 * browser it simply never renders.
 */
export function UpdateBanner({ status, onInstall }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const downloading = status.state === 'downloading' || status.state === 'available'
  const percent = status.percent ?? 0

  return (
    <div className={`update-banner ${status.state === 'error' ? 'err' : ''}`} role="status">
      <span className={`update-dot ${status.state}`} aria-hidden="true" />
      {downloading ? (
        <span className="update-txt">
          updating clonedzz {status.version ? `to ${status.version} ` : ''}
          <span className="update-pct">{percent}%</span>
        </span>
      ) : status.state === 'downloaded' ? (
        <span className="update-txt">
          clonedzz {status.version ?? ''} is ready — restart to install
        </span>
      ) : (
        <span className="update-txt">update failed — {status.message ?? 'try again later'}</span>
      )}

      {downloading && (
        <span className="update-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, Math.max(2, percent))}%` }} />
        </span>
      )}

      {status.state === 'downloaded' && (
        <button type="button" className="update-cta" onClick={onInstall}>
          restart now
        </button>
      )}

      {status.state !== 'downloaded' && (
        <button type="button" className="icon-btn update-x" aria-label="dismiss" onClick={() => setDismissed(true)}>
          ✕
        </button>
      )}
    </div>
  )
}
