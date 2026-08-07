import { useState } from 'react'
import type { ComponentSpec } from '../types'

export const TYPE_COLORS: Record<string, string> = {
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

function SectionCard({ c }: { c: ComponentSpec }) {
  const color = TYPE_COLORS[c.type] || '#64748b'
  const head = c.headline || c.body?.[0] || 'untitled section'
  const hints: string[] = []
  if (c.items?.length) hints.push(`${c.items.length} item${c.items.length > 1 ? 's' : ''}`)
  if (c.media?.length) hints.push(c.media.length > 1 ? `${c.media.length} media` : 'media')
  if (c.links?.length) hints.push(`${c.links.length} link${c.links.length > 1 ? 's' : ''}`)
  if (c.align) hints.push(c.align)

  return (
    <div className="sec">
      <span className="ty" style={{ color, borderColor: `${color}44`, background: `${color}14` }}>
        {c.type}
      </span>
      <div className="sec-main">
        <div className="hd">{head}</div>
        <div className="hints">
          {c.bg && (
            <span className="hint bg" title={`background ${c.bg}`}>
              <span className="chip sm" style={{ background: c.bg }} />
              {c.bg}
            </span>
          )}
          {hints.map((h) => (
            <span key={h} className="hint">
              {h}
            </span>
          ))}
        </div>
      </div>
      <span className="idx">#{c.index}</span>
    </div>
  )
}

export function SectionsCard({ components }: { components: ComponentSpec[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? components : components.slice(0, 6)
  const remaining = components.length - visible.length
  return (
    <div className="card sections-card reveal">
      <div className="card-head">
        <h2>Sections</h2>
        <span className="pill">{components.length}</span>
      </div>
      {components.length === 0 ? (
        <div className="empty">no sections detected</div>
      ) : (
        <div className="secs">
          {visible.map((c) => (
            <SectionCard key={c.index} c={c} />
          ))}
        </div>
      )}
      {components.length > 6 && (
        <button className="section-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : `Show ${remaining} more sections`} <span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
        </button>
      )}
    </div>
  )
}
