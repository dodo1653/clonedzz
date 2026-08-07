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
  hasRecipe,
}: {
  url: string
  onUrl: (v: string) => void
  token: TokenSiteData
  onToken: (t: TokenSiteData) => void
  tokenMode: boolean
  onTokenMode: (v: boolean) => void
  onAnalyze: () => void
  analyzing: boolean
  hasRecipe: boolean
}) {
  return (
    <section className={`card launch-card reveal ${hasRecipe ? 'has-recipe' : ''}`}>
      <div className="launch-kicker"><span /> {hasRecipe ? 'Source controls' : 'New replica'}</div>
      <div className="launch-heading">
        <div>
          <h1>{hasRecipe ? 'Refine the source.' : 'Start with a website.'}</h1>
          <p>{hasRecipe ? 'Replace the URL to begin a new analysis, or continue through the recipe below.' : 'CloneForge reads its visual language, then turns it into a runnable React project.'}</p>
        </div>
        <div className="launch-mark" aria-hidden="true">↗</div>
      </div>

      <div className="launch-input">
        <label>Source URL</label>
        <div className="url-input-wrap">
          <span className="url-mark" aria-hidden="true">⌁</span>
          <input
            placeholder="https://example.com"
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAnalyze()}
            autoFocus
          />
          <span className="key-hint">↵</span>
        </div>
      </div>

      <div className="launch-foot">
        <label className="check">
          <input type="checkbox" checked={tokenMode} onChange={(e) => onTokenMode(e.target.checked)} />
          <span>Token-site factory <em>— inject CA and token content</em></span>
        </label>
        <span className="launch-note">Visual recipe · React output</span>
      </div>

      {tokenMode && (
        <div className="row token-fields">
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
      <button className="primary block launch-action" onClick={onAnalyze} disabled={!url.trim() || analyzing}>
        {analyzing ? (
          <><span className="spin" /> analyzing…</>
        ) : (
          <>Analyze site <span aria-hidden="true">→</span></>
        )}
      </button>
    </section>
  )
}
