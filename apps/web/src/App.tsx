import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from './api'
import { CloneCard } from './components/CloneCard'
import { GenerateCard } from './components/GenerateCard'
import { PreviewCard } from './components/PreviewCard'
import { PushCard } from './components/PushCard'
import TitleBar from './components/TitleBar'
import AcidSquares from './components/AcidSquares'
import { useLenis } from './lib/useLenis'
import { RecipeCard } from './components/RecipeCard'
import { SectionsCard } from './components/SectionsCard'
import { Sidebar } from './components/Sidebar'
import { Toasts, type ToastKind } from './components/Toasts'
import { VerifyCard } from './components/VerifyCard'
import { WelcomePanel } from './components/WelcomePanel'
import type {
  PreviewInfo,
  PushResult,
  Recipe,
  SessionItem,
  Theme,
  ThemeItem,
  TokenPreset,
  TokenSiteData,
  VerifyReport,
} from './types'
import { nextTheme } from './types'

type Phase = 'idle' | 'analyzing' | 'ready' | 'generating' | 'generated' | 'verifying' | 'verified' | 'error'

function normUrl(u: string): string {
  try {
    const p = new URL(u)
    return p.origin + p.pathname.replace(/\/+$/, '')
  } catch {
    return u.replace(/\/+$/, '')
  }
}

export default function App() {
  useLenis()

  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [url, setUrl] = useState('')
  const [token, setToken] = useState<TokenSiteData>({ name: '', ticker: '', ca: '', x: '', blurb: '' })
  const [tokenMode, setTokenMode] = useState(false)
  const [removeGates, setRemoveGates] = useState(false)
  const [bakeAssets, setBakeAssets] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [recipeName, setRecipeName] = useState('')
  const [gen, setGen] = useState<{ dir: string; files: string[] } | null>(null)
  const [preview, setPreview] = useState<PreviewInfo | null>(null)
  const [verify, setVerify] = useState<VerifyReport | null>(null)
  const [themes, setThemes] = useState<ThemeItem[]>([])
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [tokens, setTokens] = useState<TokenPreset[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [pushRepo, setPushRepo] = useState('')
  const [pushToken, setPushToken] = useState('')
  const [pushBranch, setPushBranch] = useState('main')
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<PushResult | null>(null)
  const [toasts, setToasts] = useState<{ id: number; kind: ToastKind; text: string }[]>([])
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('clonedzz-theme')
    return saved === 'light' || saved === 'dim' ? saved : 'dark'
  })
  const firstThemeRun = useRef(true)

  useLayoutEffect(() => {
    const root = document.documentElement
    const apply = () => {
      root.classList.toggle('light', theme === 'light')
      root.classList.toggle('dim', theme === 'dim')
      localStorage.setItem('clonedzz-theme', theme)
    }
    // The switch-guard disables per-element CSS transitions while the theme
    // class swaps, so var()-driven colors land at their final values instead of
    // starting a (possibly frozen) transition.
    const guard = () => {
      root.classList.add('theme-switching')
      apply()
      void root.offsetHeight
    }
    // Guarded instant swap for hidden/occluded windows, reduced motion, or API errors.
    const snap = () => {
      guard()
      window.setTimeout(() => root.classList.remove('theme-switching'), 150)
    }
    // First run: apply the saved theme before first paint — no flash, no animation.
    if (firstThemeRun.current) {
      firstThemeRun.current = false
      apply()
      // StrictMode double-invokes effects in dev; reset the flag so the remount
      // also applies without starting a startup transition.
      return () => {
        firstThemeRun.current = true
      }
    }
    // Later runs: cross-fade smoothly via the View Transitions API (only works
    // while the window is visible — Chromium aborts it when hidden). The guard
    // suppresses per-element transitions during the cross-fade so the whole UI
    // lands at its new colors together — one quick, unified motion. The guard is
    // released exactly when the fade settles (promises are never timer-throttled,
    // so this is robust even if the transition is aborted).
    if (!reduceMotion && document.visibilityState === 'visible' && typeof document.startViewTransition === 'function') {
      try {
        const vt = document.startViewTransition(guard)
        vt.finished.then(
          () => root.classList.remove('theme-switching'),
          () => root.classList.remove('theme-switching'),
        )
      } catch {
        snap()
      }
      return
    }
    snap()
  }, [theme, reduceMotion])

  const pushToast = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, text }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])

  const refreshLibrary = useCallback(async () => {
    try {
      const [t, s, tk] = await Promise.all([api.themes(), api.sessions(), api.tokens()])
      setThemes(t)
      setSessions(s)
      setTokens(tk)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    refreshLibrary()
  }, [refreshLibrary])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible')),
      { threshold: 0.08 },
    )
    document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [recipe, gen, preview, verify, phase])

  const toggleSection = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }))

  const startRename = (s: SessionItem) => {
    setEditingId(s.id)
    setEditName(s.meta.name || s.summary.name)
  }

  const saveRename = async () => {
    if (!editingId) return
    const name = editName.trim()
    if (name) {
      try {
        await api.renameSession(editingId, name)
        refreshLibrary()
        setRecipeName(name)
        pushToast('ok', `renamed to "${name}"`)
      } catch (e) {
        pushToast('error', String(e))
      }
    }
    setEditingId(null)
    setEditName('')
  }

  const deleteSession = async (id: string) => {
    try {
      await api.deleteSession(id)
      if (sessionId === id) {
        setSessionId('')
        setRecipe(null)
        setPhase('idle')
      }
      refreshLibrary()
    } catch (e) {
      pushToast('error', String(e))
    }
  }

  const analyze = async () => {
    if (!url.trim()) return
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
      pushToast('error', String(e))
      setPhase('error')
    }
  }

  const generate = async (source: Recipe | null) => {
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
        bakeAssets,
      })
      setGen({ dir: res.dir, files: res.files })
      setPhase('generated')
      pushToast('ok', `generated ${res.files.length} files into ${res.dir} — dependencies installed`)
      refreshLibrary()
    } catch (e) {
      pushToast('error', String(e))
      setPhase('error')
    }
  }

  const startPreview = async (dir: string) => {
    try {
      if (preview) await api.previewStop(preview.port).catch(() => {})
      const p = await api.preview(dir)
      setPreview(p)
    } catch (e) {
      pushToast('error', String(e))
    }
  }

  const stopPreview = async () => {
    if (!preview) return
    await api.previewStop(preview.port).catch(() => {})
    setPreview(null)
  }

  const runVerify = async (dir: string) => {
    setPhase('verifying')
    try {
      const rep = await api.verify(url.trim(), dir)
      setVerify(rep)
      setPhase('verified')
      pushToast(rep.score >= 70 ? 'ok' : 'info', `fidelity score ${rep.score}%`)
    } catch (e) {
      pushToast('error', String(e))
      setPhase('error')
    }
  }

  const doPush = async (dir: string) => {
    setPushResult(null)
    if (!pushRepo.trim()) {
      pushToast('error', 'enter a GitHub repo as owner/name (e.g. dodo1653/AFK)')
      return
    }
    setPushing(true)
    try {
      const res = await api.push({
        dir,
        repo: pushRepo.trim(),
        branch: pushBranch.trim() || 'main',
        token: pushToken.trim() || undefined,
      })
      setPushResult(res)
      pushToast('ok', 'pushed to GitHub')
    } catch (e) {
      pushToast('error', String(e))
    } finally {
      setPushing(false)
    }
  }

  const saveTheme = async () => {
    if (!recipe) return
    try {
      await api.saveTheme(recipe.name, recipe)
      pushToast('ok', `saved theme "${recipe.name}"`)
      refreshLibrary()
    } catch (e) {
      pushToast('error', String(e))
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
      pushToast('error', String(e))
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

  const goHome = () => {
    setUrl('')
    setTokenMode(false)
    setRemoveGates(false)
    setBakeAssets(false)
    setPhase('idle')
    setRecipe(null)
    setSessionId('')
    setRecipeName('')
    setGen(null)
    setPreview(null)
    setVerify(null)
    setPushResult(null)
  }

  const analyzeRef = useRef(analyze)
  analyzeRef.current = analyze

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        analyzeRef.current()
      } else if (e.key === 'Escape') {
        setToasts([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const busy = phase === 'analyzing' || phase === 'generating' || phase === 'verifying'

  return (
    <div className="app has-titlebar">
      <TitleBar />
      {!reduceMotion && (
        <AcidSquares
          className="acid-bg"
          color1="#0d3a2c"
          color2="#b7e4c7"
          color3="#eafff2"
          detail="medium"
          speed={0.55}
          waveDepth={1.2}
          zoom={1.25}
          density={9}
          glow={1.15}
          exposure={2300}
          spread={0.28}
          stepSize={0.002}
          colorShift={0.6}
          contrast={1.05}
          brightness={1.15}
          opacity={0.9}
          mouseInteraction={false}
          mouseStrength={0.12}
          mouseRadius={0.4}
          blur={0}
          grain
          grainIntensity={0.04}
        />
      )}
      <div className="acid-veil" aria-hidden="true" />
      <Sidebar
        sessions={sessions}
        themes={themes}
        tokens={tokens}
        collapsed={collapsed}
        onToggle={toggleSection}
        activeSessionId={sessionId}
        editingId={editingId}
        editName={editName}
        onEditName={setEditName}
        onSelectSession={loadSession}
        onRenameSession={startRename}
        onSaveRename={saveRename}
        onCancelRename={() => setEditingId(null)}
        onDeleteSession={deleteSession}
        onLoadTheme={loadTheme}
        onApplyToken={applyToken}
        theme={theme}
        onToggleTheme={() => setTheme(nextTheme)}
        onHome={goHome}
      />

      <main className="main">
        {phase === 'idle' && sessions.length === 0 && <WelcomePanel onPickUrl={setUrl} />}
        <CloneCard
          url={url}
          onUrl={setUrl}
          token={token}
          onToken={setToken}
          tokenMode={tokenMode}
          onTokenMode={setTokenMode}
          onAnalyze={analyze}
          analyzing={phase === 'analyzing'}
          hasRecipe={Boolean(recipe)}
        />

        {phase === 'analyzing' && (
          <div className="loading">
            <span className="spin" /> Launching headless Chromium, sampling the page…
          </div>
        )}

        {recipe && (
          <section className="workflow-stack reveal">
            <RecipeCard recipe={recipe} sessionId={sessionId} />
            <SectionsCard components={recipe.components} />
            <GenerateCard
              recipeName={recipeName}
              onRecipeName={setRecipeName}
              removeGates={removeGates}
              onRemoveGates={setRemoveGates}
              bakeAssets={bakeAssets}
              onBakeAssets={setBakeAssets}
              onGenerate={() => generate(null)}
              onSaveTheme={saveTheme}
              generating={phase === 'generating'}
              gen={gen}
            />
          </section>
        )}

        {gen && (
          <>
            <PreviewCard
              preview={preview}
              dir={gen.dir}
              verifying={phase === 'verifying'}
              onStart={() => startPreview(gen.dir)}
              onClose={stopPreview}
              onVerify={() => runVerify(gen.dir)}
            />
            {verify && <VerifyCard verify={verify} />}
            <PushCard
              repo={pushRepo}
              onRepo={setPushRepo}
              branch={pushBranch}
              onBranch={setPushBranch}
              token={pushToken}
              onToken={setPushToken}
              onPush={() => doPush(gen.dir)}
              pushing={pushing}
              result={pushResult}
            />
          </>
        )}

        {tokens.length > 0 && (
          <div className="card">
            <div className="card-head">
              <h2>Saved token presets</h2>
              <span className="pill">{tokens.length}</span>
            </div>
            {tokens.map((t) => (
              <div key={t.id} className="tokrow">
                <span>
                  <b>{t.data.name}</b> ({t.data.ticker}) · <span className="mono">{t.data.ca.slice(0, 24)}…</span>
                </span>
                <button
                  className="small danger"
                  onClick={async () => {
                    try {
                      await api.deleteToken(t.id)
                      refreshLibrary()
                    } catch (e) {
                      pushToast('error', String(e))
                    }
                  }}
                >
                  delete
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={`busyline ${busy ? 'on' : ''}`} aria-hidden />
      </main>

      <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  )
}
