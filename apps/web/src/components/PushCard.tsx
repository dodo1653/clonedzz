import type { PushResult } from '../types'

export function PushCard({
  repo,
  onRepo,
  branch,
  onBranch,
  token,
  onToken,
  onPush,
  pushing,
  result,
}: {
  repo: string
  onRepo: (v: string) => void
  branch: string
  onBranch: (v: string) => void
  token: string
  onToken: (v: string) => void
  onPush: () => void
  pushing: boolean
  result: PushResult | null
}) {
  return (
    <div className="card">
      <h2>Deploy to GitHub</h2>
      <div className="field">
        <label>repo (owner/name)</label>
        <input
          placeholder="dodo1653/AFK"
          value={repo}
          onChange={(e) => onRepo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onPush()}
        />
      </div>
      <div className="row">
        <div className="field">
          <label>branch</label>
          <input value={branch} onChange={(e) => onBranch(e.target.value)} />
        </div>
        <div className="field">
          <label>PAT (optional — fallback to git credential manager)</label>
          <input type="password" placeholder="github_pat_…" value={token} onChange={(e) => onToken(e.target.value)} />
        </div>
      </div>
      <button className="primary block" onClick={onPush} disabled={pushing}>
        {pushing ? (
          <>
            <span className="spin" /> pushing…
          </>
        ) : (
          'Push to GitHub'
        )}
      </button>
      {result && (
        <div className="status ok">
          ✓ pushed <b>{result.branch}</b>@{result.commit.slice(0, 7)} to{' '}
          <a href={result.commitUrl} target="_blank" rel="noopener noreferrer">
            {result.repo}
          </a>
          {result.notes.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
              {result.notes.map((n, i) => (
                <div key={i}>· {n}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
