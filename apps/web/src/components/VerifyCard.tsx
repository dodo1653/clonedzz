import type { VerifyReport } from '../types'

export function VerifyCard({ verify }: { verify: VerifyReport }) {
  const passed = verify.metrics.filter((m) => m.pass).length
  const pct = verify.metrics.length ? Math.round((passed / verify.metrics.length) * 100) : 0
  return (
    <div className="card">
      <div className="card-head">
        <h2>Fidelity report</h2>
        <span className="pill mono">src → replica</span>
      </div>
      <div className="score-row">
        <div className="score">
          {verify.score}
          <span className="pct">%</span>
        </div>
        <div className="score-meta">
          <div className="bar">
            <div className="fill" style={{ width: `${Math.min(100, verify.score)}%` }} />
          </div>
          <div className="bar-lbl">
            <span>
              {passed}/{verify.metrics.length} metrics matched
            </span>
            <span className={verify.score >= 70 ? 'ok' : 'bad'}>{verify.score >= 70 ? 'passing' : 'below target'}</span>
          </div>
        </div>
      </div>
      <div className="verify">
        {verify.metrics.map((it, i) => (
          <div key={i} className="verify-item">
            <span className={it.pass ? 'pass' : 'fail'}>{it.pass ? '✓' : '✗'}</span>
            <span className="m">{it.label}</span>
            <span className="s">
              {String(it.source)}
              {it.note ? ` → ${it.note}` : it.replica !== undefined ? ` → ${String(it.replica)}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
