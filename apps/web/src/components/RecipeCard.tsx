import { useEffect, useState } from 'react'
import type { Fonts, Recipe } from '../types'

const FONT_RE = /^[A-Za-z0-9 +.-]{1,60}$/

function fontUrl(family: string): string | null {
  if (!family || !FONT_RE.test(family)) return null
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;700&display=swap`
}

function useFontLinks(fonts: Fonts) {
  useEffect(() => {
    const fams = [fonts?.display, fonts?.body, fonts?.mono].filter(Boolean) as string[]
    const els = fams.map(fontUrl).filter(Boolean).map((href) => {
      const el = document.createElement('link')
      el.rel = 'stylesheet'
      el.href = href!
      document.head.appendChild(el)
      return el
    })
    return () => els.forEach((el) => el.remove())
  }, [fonts?.display, fonts?.body, fonts?.mono])
}

function accentOf(recipe: Recipe): string {
  if (recipe.accent) return recipe.accent
  const key = Object.keys(recipe.tokens || {}).find((k) => /accent|brand|primary|highlight/i.test(k))
  const value = key ? recipe.tokens?.[key] : undefined
  return value && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : recipe.themeColor || recipe.background || '#b7e4c7'
}

function Swatch({ label, value }: { label: string; value?: string | null }) {
  const v = value || 'transparent'
  return <div className="swatch"><span className="chip" style={{ background: v, boxShadow: value ? `0 0 0 1px rgba(255,255,255,.14), 0 0 14px ${v}33` : undefined }} /><span className="k">{label}</span><span className="v">{value || '—'}</span></div>
}

function FontRow({ role, family }: { role: string; family?: string | null }) {
  return <div className="fitem"><span className="k">{role}</span><span className="demo" style={{ fontFamily: family ? `'${family}', sans-serif` : undefined }}>{family || '—'}</span><span className="v">{family || 'system fallback'}</span></div>
}

export function RecipeCard({ recipe, sessionId }: { recipe: Recipe; sessionId: string }) {
  const [showTokens, setShowTokens] = useState(false)
  useFontLinks(recipe.fonts)
  const accent = accentOf(recipe)
  const tokenEntries = Object.entries(recipe.tokens || {}).filter(([, v]) => /^#[0-9a-fA-F]{3,8}$/.test(v)).slice(0, 16)
  const navCount = recipe.nav?.links?.length ?? 0

  return (
    <div className="card recipe-overview reveal">
      <div className="card-head"><h2>Recipe</h2>{sessionId && <span className="pill mono">{sessionId.slice(0, 8)}…</span>}</div>
      <div className="nm-title">{recipe.name}</div>
      <div className="swatches"><Swatch label="background" value={recipe.background} /><Swatch label="accent" value={accent} /><Swatch label="theme-color" value={recipe.themeColor} /></div>

      <div className="recipe-grid">
        <div className="kv">
          <div className="k">title</div><div>{recipe.title || '—'}</div>
          <div className="k">source</div><div className="mono"><a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">{recipe.sourceUrl}</a></div>
          <div className="k">nav</div><div>{navCount > 0 ? `${navCount} links${recipe.nav?.transparent ? ' · transparent' : ''}` : '—'}{recipe.nav?.position && ` · ${recipe.nav.position}`}</div>
          <div className="k">media</div><div>{recipe.images?.length ? `${recipe.images.length} image(s)` : '—'}</div>
          <div className="k">socials</div><div>{recipe.socials?.length ? recipe.socials.map((s) => s.label).join(', ') : '—'}</div>
        </div>
        <div className="font-panel">
          <div className="mini-label">Type system</div>
          <div className="fonts"><FontRow role="display" family={recipe.fonts.display} /><FontRow role="body" family={recipe.fonts.body} /><FontRow role="mono" family={recipe.fonts.mono} /></div>
        </div>
      </div>

      {recipe.notes.length > 0 && <ul className="notes">{recipe.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      {tokenEntries.length > 0 && (
        <div className="token-disclosure">
          <div className="mini-label">CSS tokens</div>
          <button className="small" onClick={() => setShowTokens((s) => !s)}>{showTokens ? 'hide' : 'show'}</button>
          {showTokens && <div className="tokens">{tokenEntries.map(([k, v]) => <div key={k} className="tok"><span className="k">{k}</span><span className="chip sm" style={{ background: v }} /><span className="v">{v}</span></div>)}</div>}
        </div>
      )}
    </div>
  )
}
