import type { TokenSiteData } from '../types'

const STEPS = [
  { n: '01', t: 'analyse', d: 'headless chromium maps layout, fonts, colors and contract addresses' },
  { n: '02', t: 'review', d: 'inspect the recipe and fine-tune the token before generating' },
  { n: '03', t: 'generate', d: 'a runnable vite + react project — or bake everything locally' },
  { n: '04', t: 'preview & push', d: 'verify fidelity, then push it to your own github' },
]

export function Hero({
  url,
  onUrl,
  token,
  onToken,
  tokenMode,
  onTokenMode,
  onAnalyze,
  analyzing,
  recent,
}: {
  url: string
  onUrl: (v: string) => void
  token: TokenSiteData
  onToken: (t: TokenSiteData) => void
  tokenMode: boolean
  onTokenMode: (v: boolean) => void
  onAnalyze: () => void
  analyzing: boolean
  recent: { label: string; url: string }[]
}) {
  return (
    <section className="hero">
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-ring hero-ring-a" aria-hidden="true" />
      <div className="hero-ring hero-ring-b" aria-hidden="true" />

      <div className="hero-chips" aria-hidden="true">
        <span className="chip-float c1">$PUMP</span>
        <span className="chip-float c2">0x8f3c…b3a2</span>
        <span className="chip-float c3">BUY ↗</span>
        <span className="chip-float c4">$WIF</span>
        <span className="chip-float c5">X</span>
        <span className="chip-float c6">CA</span>
      </div>

      <div className="hero-inner">
        <div className="launch-kicker hero-kicker">
          <span /> clonedzz · visual site replication
        </div>

        <h1 className="hero-title">
          <span className="hero-line">clone token</span>
          <span className="hero-line hero-accent">websites,</span>
          <span className="hero-line hero-tag">
            designed for <em>pump.fun</em>
          </span>
        </h1>

        <p className="hero-sub">
          paste any site — clonedzz reads its visual language, then rebuilds it as a runnable React project you own.
          Rewire the token, download everything locally, preview and push to GitHub.
        </p>

        <div className="hero-cta-row">
          <div className="url-input-wrap hero-url">
            <input
              placeholder="paste any site"
              value={url}
              onChange={(e) => onUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAnalyze()}
              autoFocus
            />
            <span className="key-hint">↵</span>
          </div>
          <button className="primary hero-go" onClick={onAnalyze} disabled={!url.trim() || analyzing}>
            {analyzing ? (
              <>
                <span className="spin" /> analyzing…
              </>
            ) : (
              <>
                Analyze <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </div>

        <div className="hero-foot">
          <label className="check">
            <input type="checkbox" checked={tokenMode} onChange={(e) => onTokenMode(e.target.checked)} />
            <span>
              Token-site factory <em>— inject CA and token content</em>
            </span>
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

        <div className="welcome-steps hero-steps">
          {STEPS.map((s) => (
            <div key={s.n} className="wstep">
              <span className="wstep-n">{s.n}</span>
              <div className="wstep-main">
                <div className="wstep-t">{s.t}</div>
                <div className="wstep-d">{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        {recent.length > 0 && (
          <div className="welcome-samples hero-samples">
            <span className="welcome-samples-lbl">recent clones:</span>
            {recent.map((s) => (
              <button key={s.url} className="sample-chip" onClick={() => onUrl(s.url)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
