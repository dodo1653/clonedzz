const STEPS = ['Clone', 'Recipe', 'Generate', 'Preview', 'Deploy']

export function Steps({ current, busy }: { current: number; busy: number | null }) {
  return (
    <div className="steps">
      {STEPS.map((label, i) => {
        const n = i + 1
        const state = busy === n ? 'busy' : current > n ? 'done' : current === n ? 'active' : ''
        return (
          <div key={label} className={`step ${state}`}>
            <span className="dot">{current > n && busy !== n ? '✓' : n}</span>
            <span className="lbl">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
