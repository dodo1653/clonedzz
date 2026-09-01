import { useEffect, useRef, useState } from 'react'
import Beams from './components/Beams'
import { useLenis } from './lib/useLenis'

const GITHUB_URL = 'https://github.com/dodo1653/clonedzz'
const DOWNLOAD_URL = 'https://github.com/dodo1653/clonedzz/releases/tag/v1.1.1'

export default function App() {
  useLenis()
  const scoreFillRef = useRef<HTMLDivElement>(null)

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Nav scroll state
  useEffect(() => {
    const nav = document.getElementById('nav')
    const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Score bar animation
  useEffect(() => {
    const el = scoreFillRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('animated')
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <>
      {/* ═══ NAV ═══ */}
      <nav className="nav" id="nav">
        <div className="nav-inner">
          <a href="#" className="nav-brand">cloned<span className="dot">zz</span></a>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#how" className="nav-link">How it works</a>
            <a href="#fidelity" className="nav-link">Fidelity</a>
            <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="nav-cta">Download v1.1.1</a>
          </div>
        </div>
      </nav>

      {/* ═══ HERO with Beams ═══ */}
      <section className="hero">
        <div className="hero-beams">
          <Beams
            beamWidth={2}
            beamHeight={15}
            beamNumber={12}
            lightColor="#b7e4c7"
            speed={2}
            noiseIntensity={1.75}
            scale={0.2}
            rotation={0}
            beamColor="#09110d"
            backgroundColor="#0b0c0f"
          />
        </div>
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-ring hero-ring-a" aria-hidden="true" />
        <div className="hero-ring hero-ring-b" aria-hidden="true" />

        <div className="hero-content">
          <div className="hero-badge reveal">
            <span className="hero-badge-dot" />
            visual site replication engine
          </div>

          <h1 className="reveal reveal-delay-1">
            Clone any<br /><em>website.</em>
          </h1>

          <p className="hero-sub reveal reveal-delay-2">
            Paste a URL. clonedzz reads the visual language — fonts, layout, colors, components — and rebuilds it as a runnable React project you own.
          </p>

          <div className="hero-actions reveal reveal-delay-3">
            <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Download for Windows
              <span aria-hidden="true">↓</span>
            </a>
            <a href="#how" className="btn-secondary">
              See how it works
            </a>
          </div>

          <p className="hero-meta reveal reveal-delay-4">
            Open source · Vite + React · Desktop app available
          </p>
        </div>
      </section>

      {/* ═══ PROOF BAR ═══ */}
      <div className="proof">
        <div className="proof-inner container">
          <div className="proof-stat reveal">
            <div className="proof-num">13</div>
            <div className="proof-label">Fidelity metrics</div>
          </div>
          <div className="proof-stat reveal reveal-delay-1">
            <div className="proof-num">4</div>
            <div className="proof-label">Pipeline stages</div>
          </div>
          <div className="proof-stat reveal reveal-delay-2">
            <div className="proof-num">100%</div>
            <div className="proof-label">React output</div>
          </div>
          <div className="proof-stat reveal reveal-delay-3">
            <div className="proof-num">0</div>
            <div className="proof-label">Dependencies required</div>
          </div>
        </div>
      </div>

      {/* ═══ FEATURES ═══ */}
      <section id="features">
        <div className="container">
          <div className="section-label reveal">Capabilities</div>
          <h2 className="section-title reveal reveal-delay-1">Everything you need<br />to replicate a site.</h2>
          <p className="section-desc reveal reveal-delay-2">
            From headless analysis to a production-ready project — every step automated.
          </p>

          <div className="features-grid">
            <div className="feature-card reveal">
              <div className="feature-icon">⟡</div>
              <h3>Visual Analysis</h3>
              <p>
                Headless Chromium maps the full visual hierarchy — fonts, computed colors,
                section backgrounds, nav structure, animations, and component boundaries.
              </p>
              <span className="feature-tag">Playwright engine</span>
            </div>

            <div className="feature-card reveal reveal-delay-1">
              <div className="feature-icon">⟐</div>
              <h3>Token-site Factory</h3>
              <p>
                Inject a Solana contract address and token content. clonedzz generates a
                complete token landing page with CA copy, pump.fun link, and token blurb.
              </p>
              <span className="feature-tag">Solana native</span>
            </div>

            <div className="feature-card reveal reveal-delay-2">
              <div className="feature-icon">◈</div>
              <h3>Theme Library</h3>
              <p>
                Save any analyzed site as a reusable theme JSON. Re-generate clones from saved
                themes without re-analyzing — session history persists locally.
              </p>
              <span className="feature-tag">Local persistence</span>
            </div>

            <div className="feature-card reveal reveal-delay-3">
              <div className="feature-icon">◇</div>
              <h3>Fidelity Verification</h3>
              <p>
                Automated headless comparison scores 13 metrics — title, theme-color, heading
                styles, nav position, body background, font families, and more.
              </p>
              <span className="feature-tag">13-point scorecard</span>
            </div>
          </div>
        </div>
      </section>

      <div className="divider container" />

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="section-label reveal" style={{ justifyContent: 'center' }}>Process</div>
          <h2 className="section-title reveal reveal-delay-1" style={{ margin: '0 auto 14px' }}>Three steps.<br />One command.</h2>
          <p className="section-desc reveal reveal-delay-2" style={{ margin: '0 auto' }}>
            The engine handles everything between input and output.
          </p>

          <div className="steps">
            <div className="step reveal">
              <div className="step-num">01</div>
              <h3>Analyse</h3>
              <p>
                Paste any URL. A headless browser samples the page — extracting fonts, colors,
                layout structure, nav links, social links, and contract addresses.
              </p>
            </div>

            <div className="step reveal reveal-delay-1">
              <div className="step-num">02</div>
              <h3>Generate</h3>
              <p>
                The engine auto-maps the analysis into a recipe, then scaffolds a complete
                Vite + React project with components, styles, and data files.
              </p>
            </div>

            <div className="step reveal reveal-delay-2">
              <div className="step-num">03</div>
              <h3>Preview &amp; push</h3>
              <p>
                Boot a live preview, run the fidelity scorecard, then push the standalone
                project to your own GitHub repository.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="divider container" />

      {/* ═══ FIDELITY ═══ */}
      <section id="fidelity">
        <div className="container">
          <div className="fidelity">
            <div className="fidelity-visual reveal">
              <div className="fidelity-bar-top">
                <div className="fidelity-dots">
                  <span /><span /><span />
                </div>
                <div className="fidelity-url">source vs. replica</div>
              </div>
              <div className="fidelity-body">
                <div className="score-display">
                  <div className="score-big"><span className="pct">94</span></div>
                  <div className="score-unit">% fidelity</div>
                </div>
                <div className="score-bar">
                  <div className="score-fill" ref={scoreFillRef} />
                </div>
                <div className="score-metrics">
                  <div className="metric">
                    <span className="metric-name">Title</span>
                    <span className="metric-val pass">✓ match</span>
                  </div>
                  <div className="metric">
                    <span className="metric-name">Theme color</span>
                    <span className="metric-val pass">✓ match</span>
                  </div>
                  <div className="metric">
                    <span className="metric-name">Heading size</span>
                    <span className="metric-val pass">✓ match</span>
                  </div>
                  <div className="metric">
                    <span className="metric-name">Body font</span>
                    <span className="metric-val pass">✓ match</span>
                  </div>
                  <div className="metric">
                    <span className="metric-name">Nav position</span>
                    <span className="metric-val pass">✓ match</span>
                  </div>
                  <div className="metric">
                    <span className="metric-name">Background</span>
                    <span className="metric-val warn">~ close</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="fidelity-text">
              <div className="section-label reveal">Verification</div>
              <h2 className="section-title reveal reveal-delay-1">Know exactly<br />how close you are.</h2>
              <p className="section-desc reveal reveal-delay-2">
                clonedzz doesn't just generate and hope. The built-in verifier boots both
                source and replica side-by-side, snapshots them, and scores 13 fidelity metrics
                so you know exactly what matches — and what needs a touch.
              </p>
              <ul className="fidelity-list reveal reveal-delay-3">
                <li>Title, meta description, and theme-color match</li>
                <li>Heading font family, size, and weight comparison</li>
                <li>Body text size and family verification</li>
                <li>Navigation position, transparency, and link count</li>
                <li>Background color and section alternation rhythm</li>
                <li>Hero content density and word count</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="divider container" />

      {/* ═══ CODE PREVIEW ═══ */}
      <section className="preview-section">
        <div className="container">
          <div className="section-label reveal" style={{ justifyContent: 'center' }}>CLI</div>
          <h2 className="section-title reveal reveal-delay-1" style={{ margin: '0 auto 14px' }}>One command.<br />Full project.</h2>
          <p className="section-desc reveal reveal-delay-2" style={{ margin: '0 auto' }}>
            The engine works as a CLI tool, a server API, or through the web dashboard.
          </p>

          <div className="code-block reveal reveal-delay-3">
            <div className="code-header">
              <div className="code-header-dots">
                <span /><span /><span />
              </div>
              <span className="code-header-title">terminal</span>
            </div>
            <div className="code-body">
              <div><span className="comment"># analyse a site and generate a replica</span></div>
              <div><span className="prompt">$</span> node packages/engine/src/cli.ts https://example.com --out outputs --name my-clone</div>
              <div>&nbsp;</div>
              <div><span className="comment"># token-site factory — inject a Solana CA</span></div>
              <div><span className="prompt">$</span> node packages/engine/src/cli.ts https://example.com --name token-page \</div>
              <div>&nbsp;&nbsp;--token-name "Salary Cat" --token-ticker "SALARY" --token-ca "&lt;solana-ca&gt;"</div>
              <div>&nbsp;</div>
              <div><span className="comment"># generate + auto-install + fidelity score</span></div>
              <div><span className="prompt">$</span> node packages/engine/src/cli.ts https://example.com --out outputs --name clone --verify</div>
              <div>&nbsp;</div>
              <div><span className="comment"># run the dashboard</span></div>
              <div><span className="prompt">$</span> npm run dev</div>
              <div><span className="comment">&nbsp; server on :4747 · dashboard on :5174</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="divider container" />

      {/* ═══ CTA ═══ */}
      <section className="cta-section" id="get-started">
        <div className="container">
          <div className="cta-box reveal">
            <h2>Ready to clone?</h2>
            <p>
              clonedzz is open source. Install it, run the dashboard, and start replicating
              sites in seconds.
            </p>
            <div className="hero-actions" style={{ marginTop: 0 }}>
              <a href={DOWNLOAD_URL} className="btn-primary" target="_blank" rel="noopener noreferrer">
                Download v1.1.1
                <span aria-hidden="true">↓</span>
              </a>
              <a href={GITHUB_URL} className="btn-secondary" target="_blank" rel="noopener noreferrer">
                View on GitHub
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <div className="footer-brand">cloned<span className="dot">zz</span></div>
            <p className="footer-copy">
              Visual site replication engine. Analyse any website, extract its visual recipe,
              and generate a runnable React project.
            </p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Product</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#how">How it works</a></li>
                <li><a href="#fidelity">Fidelity scoring</a></li>
                <li><a href="#get-started">Get started</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <ul>
                <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Documentation</a></li>
                <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">CLI reference</a></li>
                <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">API docs</a></li>
                <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Changelog</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Community</h4>
              <ul>
                <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a></li>
                <li><a href="https://x.com" target="_blank" rel="noopener noreferrer">Twitter / X</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
