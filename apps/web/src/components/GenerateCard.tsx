export function GenerateCard({
  recipeName,
  onRecipeName,
  removeGates,
  onRemoveGates,
  onGenerate,
  onSaveTheme,
  generating,
  gen,
}: {
  recipeName: string
  onRecipeName: (v: string) => void
  removeGates: boolean
  onRemoveGates: (v: boolean) => void
  onGenerate: () => void
  onSaveTheme: () => void
  generating: boolean
  gen: { dir: string; files: string[] } | null
}) {
  return (
    <div className="card generate-card reveal">
      <h2>Generate replica</h2>
      <div className="field">
        <label>project name</label>
        <input value={recipeName} onChange={(e) => onRecipeName(e.target.value)} />
      </div>
      <label className="check">
        <input type="checkbox" checked={removeGates} onChange={(e) => onRemoveGates(e.target.checked)} />
        <span>remove login / wallet gates (auto-detect &amp; bypass wallet checks, isHolder-style access denial, login failure)</span>
      </label>
      <div className="actions">
        <button className="primary" onClick={onGenerate} disabled={generating}>
          {generating ? 'generating…' : 'Generate'}
        </button>
        <button onClick={onSaveTheme}>Save as theme</button>
      </div>
      {gen && (
        <div className="status ok">✓ generated {gen.files.length} files into {gen.dir}</div>
      )}
    </div>
  )
}
