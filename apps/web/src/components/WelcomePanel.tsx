const SAMPLES = [
  { label: 'pump.fun', url: 'https://pump.fun' },
  { label: 'stripe.com', url: 'https://stripe.com' },
  { label: 'linear.app', url: 'https://linear.app' },
  { label: 'notion.so', url: 'https://www.notion.so' },
]

const STEPS = [
  { n: '01', t: 'analyse', d: 'headless chromium loads the site and maps its layout, fonts, colors, sections and contract addresses' },
  { n: '02', t: 'review', d: 'inspect the recipe — sections, tokens, notes — and tweak the name before generating' },
  { n: '03', t: 'generate', d: 'a runnable vite + react project is built (or a verbatim mirror), dependencies installed' },
  { n: '04', t: 'preview & push', d: 'preview locally, verify fidelity, then push it to your own github' },
]

export function WelcomePanel({ onPickUrl }: { onPickUrl: (url: string) => void }) {
  return (
    <section className="welcome reveal is-visible">
      <div className="launch-kicker">
        <span /> first run
      </div>
      <h2 className="welcome-title">
        turn any website <em>into yours</em>
      </h2>
      <p className="welcome-sub">
        paste a url below — or start from one of these — and clonedzz replicates it into a runnable project you own.
        Everything stays on your machine until you decide to push it.
      </p>
      <div className="welcome-steps">
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
      <div className="welcome-samples">
        <span className="welcome-samples-lbl">or try a sample:</span>
        {SAMPLES.map((s) => (
          <button key={s.url} className="sample-chip" onClick={() => onPickUrl(s.url)}>
            {s.label}
          </button>
        ))}
      </div>
    </section>
  )
}
