import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { CloneCard } from './components/CloneCard'
import { GenerateCard } from './components/GenerateCard'
import { PreviewCard } from './components/PreviewCard'
import { PushCard } from './components/PushCard'
import { RecipeCard } from './components/RecipeCard'
import { SectionsCard } from './components/SectionsCard'
import { Sidebar } from './components/Sidebar'
import { Toasts, type ToastKind } from './components/Toasts'
import { VerifyCard } from './components/VerifyCard'
import type {
  PreviewInfo,
  PushResult,
  Recipe,
  SessionItem,
  ThemeItem,
  TokenPreset,
  TokenSiteData,
  VerifyReport,
} from './types'

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
  const [url, setUrl] = useState('')
  const [token, setToken] = useState<TokenSiteData>({ name: '', ticker: '', ca: '', x: '', blurb: '' })
  const [tokenMode, setTokenMode] = useState(false)
  const [removeGates, setRemoveGates] = useState(false)
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
    <div className="app">
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
      />

      <main className="main">
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
