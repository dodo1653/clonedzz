export type ToastKind = 'info' | 'ok' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  text: string
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => onDismiss(t.id)}>
          <span className="txt">{t.text}</span>
          <button className="icon-btn">✕</button>
        </div>
      ))}
    </div>
  )
}
