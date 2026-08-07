import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type {
  ComponentSpec,
  OutputItem,
  PreviewInfo,
  Recipe,
  SessionItem,
  ThemeItem,
  TokenPreset,
  TokenSiteData,
  VerifyReport,
} from './types'

type Phase = 'idle' | 'analyzing' | 'ready' | 'generating' | 'generated' | 'verifying' | 'verified' | 'error'

const TYPE_COLORS: Record<string, string> = {
  Hero: '#38bdf8',
  Cards: '#a78bfa',
  Stats: '#4ade80',
  Quote: '#fbbf24',
  LogoStrip: '#f472b6',
  Video: '#f87171',
  FAQ: '#34d399',
  TokenBar: '#fb923c',
  Footer: '#94a3b8',
  Custom: '#64748b',
}

function normUrl(u: string): string {
  try {
    const p = new URL(u)
    return p.origin + p.pathname.replace(/\/+$/, '')
  } catch {
    return u.replace(/\/+$/, '')
  }
}

export default function App() {
  const [url, setUrl] = useState('')
  const [token, setToken] = useState<TokenSiteData>({ name: '', ticker: '', ca: '', blurb: '' })
  const [tokenMode, setTokenMode] = useState(false)
  const [removeGates, setRemoveGates] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [recipeName, setRecipeName] = useState('')
  const [gen, setGen] = useState<{ dir: string; files: string[] } | null>(null)
  const [preview, setPreview] = useState<PreviewInfo | null>(null)
  const [verify, setVerify] = useState<VerifyReport | null>(null)
  const [themes, setThemes] = useState<ThemeItem[]>([])
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [tokens, setTokens] = useState<TokenPreset[]>([])
  const [outputs, setOutputs] = useState<OutputItem[]>([])

  const refreshLibrary = useCallback(async () => {
    try {
      const [t, s, tk, o] = await Promise.all([api.themes(), api.sessions(), api.tokens(), api.outputs()])
      setThemes(t)
      setSessions(s)
      setTokens(tk)
      setOutputs(o)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    refreshLibrary()
  }, [refreshLibrary])

  const analyze = async () => {
    setError('')
    setMsg('')
    setVerify(null)
    setGen(null)
    setPreview(null)
    setPhase('analyzing')
    try {
      const res = await api.analyze(url.trim(), undefined)
      setRecipe(res.recipe)
      setSessionId(res.id)
      setRecipeName(res.recipe.name)
      setPhase('ready')
    } catch (e) {
      setError(String(e))
      setPhase('error')
    }
  }

  const generate = async (source: Recipe | null) => {
    setError('')
    setMsg('')
    setPhase('generating')
    setGen(null)
    setVerify(null)
    setPreview(null)
    try {
      const target = url.trim()
      let sess = sessionId
      let rec: Recipe | null = source ?? recipe
      if (!rec || (target && normUrl(rec.sourceUrl) !== normUrl(target))) {
        const res = await api.analyze(target || rec?.sourceUrl || 'https://example.com', undefined)
        sess = res.id
        rec = res.recipe
        setRecipe(rec)
        setSessionId(res.id)
        setRecipeName(rec.name)
      }
      const name = recipeName || rec?.name || 'clone'
      const res = await api.generate({
        sessionId: source ? undefined : sess,
        recipe: source ?? undefined,
        name,
        token: tokenMode && token.ca ? token : null,
        install: true,
        removeGates,
      })
      setGen({ dir: res.dir, files: res.files })
      setPhase('generated')
      setMsg(`generated ${res.files.length} files into ${res.dir} — dependencies installed`)
      refreshLibrary()
    } catch (e) {
      setError(String(e))
      setPhase('error')
    }
  }

  const startPreview = async (dir: string) => {
    setError('')
    try {
      if (preview) await api.previewStop(preview.port).catch(() => {})
      const p = await api.preview(dir)
      setPreview(p)
    } catch (e) {
      setError(String(e))
    }
  }

  const runVerify = async (dir: string) => {
    setError('')
    setPhase('verifying')
    try {
      const rep = await api.verify(url.trim(), dir)
      setVerify(rep)
      setPhase('verified')
    } catch (e) {
      setError(String(e))
      setPhase('error')
    }
  }

  const saveTheme = async () => {
    if (!recipe) return
    try {
      await api.saveTheme(recipe.name, recipe)
      setMsg(`saved theme "${recipe.name}"`)
      refreshLibrary()
    } catch (e) {
      setError(String(e))
    }
  }

  const loadSession = async (id: string) => {
    try {
      const r = await api.session(id)
      setRecipe(r)
      setSessionId(id)
      setRecipeName(r.name)
      setPhase('ready')
      setVerify(null)
      setGen(null)
      setPreview(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const loadTheme = (t: ThemeItem) => {
    setRecipe(t.recipe)
    setSessionId('')
    setRecipeName(t.recipe.name)
    setPhase('ready')
    setUrl(t.recipe.sourceUrl || '')
    setVerify(null)
    setGen(null)
    setPreview(null)
  }

  const applyToken = (t: TokenPreset) => {
    setToken(t.data)
    setTokenMode(true)
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="brand">
          clone<span>forge</span>
        </div>
        <div className="brand-sub">replicate any website's style → runnable Vite+React</div>

        <h3 className="side">sessions</h3>
        {sessions.length === 0 && <div className="empty">no analyses yet</div>}
        {sessions.map((s) => (
          <div key={s.id} className="session-item" onClick={() => loadSession(s.id)}>
            <div className="nm">{s.summary.name}</div>
            <div className="sub">
              {s.summary.title} · {s.summary.background}
            </div>
            <div className="sub">{s.meta.sourceUrl}</div>
          </div>
        ))}

        <h3 className="side">themes</h3>
        {themes.length === 0 && <div className="empty">no saved themes</div>}
        {themes.map((t) => (
          <div key={t.name} className="theme-item" onClick={() => loadTheme(t)}>
            <div className="nm">{t.recipe.name}</div>
            <div className="sub">
              {t.recipe.components.map((c) => c.type).slice(0, 5).join(' · ')}
            </div>
          </div>
        ))}

        <h3 className="side">token presets</h3>
        {tokens.length === 0 && <div className="empty">none saved</div>}
        {tokens.map((t) => (
          <div key={t.id} className="token-item" onClick={() => applyToken(t)}>
            <div className="nm">
              {t.data.name} / {t.data.ticker}
            </div>
            <div className="sub">{t.data.ca.slice(0, 16)}…</div>
          </div>
        ))}

        <h3 className="side">outputs</h3>
        {outputs.length === 0 && <div className="empty">nothing generated yet</div>}
        {outputs.map((o) => (
          <div key={o.name} className="output-item" onClick={() => startPreview(o.path)}>
            <div className="nm">{o.name}</div>
            <div className="sub">{o.sourceUrl || 'no source url'}</div>
            <div className="sub">{o.installed ? 'deps installed' : 'deps missing'} · click to preview</div>
          </div>
        ))}
      </div>

      <div className="main">
        <div className="card">
          <h2>Clone a site</h2>
          <div className="field">
            <label>source URL</label>
            <input
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analyze()}
            />
          </div>
          <label style={{ fontSize: 11, color: 'var(--muted)' }}>
            <input type="checkbox" checked={tokenMode} onChange={(e) => setTokenMode(e.target.checked)} style={{ width: 'auto', marginRight: 6 }} />
            token-site factory (inject CA + token content)
          </label>
          {tokenMode && (
            <div className="row" style={{ marginTop: 10 }}>
              <div className="field">
                <label>token name</label>
                <input value={token.name} onChange={(e) => setToken({ ...token, name: e.target.value })} />
              </div>
              <div className="field">
                <label>ticker</label>
                <input value={token.ticker} onChange={(e) => setToken({ ...token, ticker: e.target.value })} />
              </div>
              <div className="field">
                <label>CA (Solana)</label>
                <input value={token.ca} onChange={(e) => setToken({ ...token, ca: e.target.value })} />
              </div>
            </div>
          )}
          <button className="primary block" onClick={analyze} disabled={!url.trim() || phase === 'analyzing' || phase === 'generating' || phase === 'verifying'}>
            {phase === 'analyzing' ? (
              <>
                <span className="spin" /> analyzing…
              </>
            ) : (
              'Analyze'
            )}
          </button>
          {error && <div className="status error">error: {error}</div>}
        </div>

        {phase === 'analyzing' && (
          <div className="loading">
            <span className="spin" /> Launching headless Chromium, sampling the page…
          </div>
        )}

        {recipe && (
          <>
            <div className="card">
              <h2>
                Recipe: {recipe.name}
                {sessionId && <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> · session {sessionId.slice(0, 8)}…</span>}
              </h2>
              <div className="kv">
                <div className="k">title</div>
                <div>{recipe.title}</div>
                <div className="k">background</div>
                <div>{recipe.background}</div>
                <div className="k">accent</div>
                <div>{recipe.accent}</div>
                <div className="k">fonts</div>
                <div>
                  display={recipe.fonts.display} · body={recipe.fonts.body}
                  {recipe.fonts.mono && ` · mono=${recipe.fonts.mono}`}
                </div>
                <div className="k">source</div>
                <div>{recipe.sourceUrl}</div>
              </div>
              {recipe.notes.length > 0 && (
                <ul className="notes">
                  {recipe.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <h2>Sections</h2>
              {recipe.components.map((c: ComponentSpec) => (
                <div key={c.index} className="comp">
                  <div className="t">
                    <span className="ty" style={{ color: TYPE_COLORS[c.type] }}>
                      {c.type}
                    </span>
                    <span className="hd">{c.headline || c.caption || c.sub || (c.body?.[0] ?? '')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h2>Generate replica</h2>
              <div className="field">
                <label>project name</label>
                <input value={recipeName} onChange={(e) => setRecipeName(e.target.value)} />
              </div>
              <label style={{ fontSize: 11, color: 'var(--muted)' }}>
                <input type="checkbox" checked={removeGates} onChange={(e) => setRemoveGates(e.target.checked)} style={{ width: 'auto', marginRight: 6 }} />
                remove login / wallet gates (auto-detect &amp; bypass wallet checks, isHolder-style access denial, login failure)
              </label>
              <div className="actions">
                <button className="primary" onClick={() => generate(null)} disabled={phase === 'generating' || phase === 'verifying'}>
                  {phase === 'generating' ? 'generating…' : 'Generate'}
                </button>
                <button onClick={saveTheme}>Save as theme</button>
              </div>
              {gen && (
                <div className="status">
                  ✓ generated {gen.files.length} files into {gen.dir}
                </div>
              )}
            </div>
          </>
        )}

        {gen && (
          <>
            <div className="card">
              <h2>Preview & verify</h2>
              <div className="actions">
                <button onClick={() => startPreview(gen.dir)} disabled={phase === 'verifying'}>
                  {preview ? 'Restart preview' : 'Open preview'}
                </button>
                <button onClick={() => runVerify(gen.dir)} disabled={phase === 'verifying'}>
                  {phase === 'verifying' ? (
                    <>
                      <span className="spin" /> verifying…
                    </>
                  ) : (
                    'Verify fidelity'
                  )}
                </button>
              </div>
              {msg && <div className="status">{msg}</div>}
            </div>

            {preview && (
              <div className="card">
                <h2>
                  Preview{' '}
                  <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}>
                    · {gen.dir.split(/[\\/]/).pop()} · {preview.url}
                  </span>
                </h2>
                <iframe className="preview" src={preview.url} title="replica preview" />
              </div>
            )}

            {verify && (
              <div className="card">
                <h2>Fidelity report</h2>
                <div className="score">
                  {verify.score}
                  <span className="pct">%</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400, marginLeft: 10 }}>
                    {verify.metrics.filter((m) => m.pass).length}/{verify.metrics.length} metrics matched
                  </span>
                </div>
                <div style={{ marginTop: 12 }}>
                  {verify.metrics.map((it, i) => (
                    <div key={i} className="verify-item">
                      <span className={it.pass ? 'pass' : 'fail'}>{it.pass ? '✓' : '✗'}</span>
                      <span className="m">{it.label}</span>
                      <span className="s">
                        src {it.source}
                        {it.note ? ` → ${it.note}` : it.replica ? ` → ${it.replica}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tokens.length > 0 && (
          <div className="card">
            <h2>Saved token presets</h2>
            {tokens.map((t) => (
              <div key={t.id} className="comp" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <b>{t.data.name}</b> ({t.data.ticker}) · {t.data.ca.slice(0, 24)}…
                </span>
                <button className="small danger" onClick={async () => { await api.deleteToken(t.id); refreshLibrary() }}>
                  delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
