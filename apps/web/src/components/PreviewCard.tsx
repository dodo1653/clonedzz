import { useState } from 'react'
import type { PreviewInfo } from '../types'

export function PreviewCard({
  preview,
  dir,
  verifying,
  onStart,
  onClose,
  onVerify,
}: {
  preview: PreviewInfo | null
  dir: string
  verifying: boolean
  onStart: () => void
  onClose: () => void
  onVerify: () => void
}) {
  const [frameKey, setFrameKey] = useState(0)

  return (
    <div className="card">
      <div className="card-head">
        <h2>Preview &amp; verify</h2>
        <span className="pill mono">{dir.split(/[\\/]/).pop()}</span>
      </div>
      <div className="actions">
        <button className="primary" onClick={onStart} disabled={verifying}>
          {preview ? 'Restart preview' : 'Open preview'}
        </button>
        <button onClick={onVerify} disabled={verifying}>
          {verifying ? (
            <>
              <span className="spin" /> verifying…
            </>
          ) : (
            'Verify fidelity'
          )}
        </button>
        <button onClick={() => setFrameKey((k) => k + 1)} disabled={!preview}>
          Refresh frame
        </button>
        <button onClick={onClose} disabled={!preview}>
          Close
        </button>
      </div>
      {preview && (
        <div className="browser">
          <div className="addrbar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span className="addr mono">{preview.url}</span>
            <span className="br-actions">
              <button className="icon-btn" title="open in browser" onClick={() => window.open(preview.url, '_blank')}>
                ⤢
              </button>
            </span>
          </div>
          <iframe key={frameKey} className="preview" src={preview.url} title="replica preview" />
        </div>
      )}
    </div>
  )
}
