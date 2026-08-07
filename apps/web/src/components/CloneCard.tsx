import type { TokenSiteData } from '../types'

export function CloneCard({
  url,
  onUrl,
  token,
  onToken,
  tokenMode,
  onTokenMode,
  onAnalyze,
  analyzing,
}: {
  url: string
  onUrl: (v: string) => void
  token: TokenSiteData
  onToken: (t: TokenSiteData) => void
  tokenMode: boolean
  onTokenMode: (v: boolean) => void
  onAnalyze: () => void
  analyzing: boolean
}) {
  return (
    <div className="card">
      <h2>Clone a site</h2>
      <div className="field">
        <label>source URL</label>
        <input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAnalyze()}
          autoFocus
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={tokenMode} onChange={(e) => onTokenMode(e.target.checked)} />
        <span>token-site factory — inject CA + token content</span>
      </label>
      {tokenMode && (
        <div className="row">
          <div className="field">
            <label>token name</label>
            <input value={token.name} onChange={(e) => onToken({ ...token, name: e.target.value })} />
          </div>
          <div className="field">
            <label>ticker</label>
            <input value={token.ticker} onChange={(e) => onToken({ ...token, ticker: e.target.value })} />
          </div>
          <div className="field">
            <label>CA (Solana)</label>
            <input value={token.ca} onChange={(e) => onToken({ ...token, ca: e.target.value })} />
          </div>
          <div className="field">
            <label>X community (optional)</label>
            <input placeholder="https://x.com/…" value={token.x} onChange={(e) => onToken({ ...token, x: e.target.value })} />
          </div>
        </div>
      )}
      <button className="primary block" onClick={onAnalyze} disabled={!url.trim() || analyzing}>
        {analyzing ? (
          <>
            <span className="spin" /> analyzing…
          </>
        ) : (
          'Analyze'
        )}
      </button>
    </div>
  )
}
