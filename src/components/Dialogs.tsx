import { Download, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ConfirmDialogProps { open: boolean; title: string; description: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }
export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open) confirmRef.current?.focus() }, [open])
  if (!open) return null
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="关闭"><X /></button>
        <h2 id="confirm-title">{title}</h2><p>{description}</p>
        <div className="dialog-actions"><button type="button" onClick={onClose}>取消</button><button ref={confirmRef} className="danger" type="button" onClick={onConfirm}>{confirmLabel}</button></div>
      </section>
    </div>
  )
}

interface ExportDialogProps {
  open: boolean; includeQueue: boolean; scale: number; busy: boolean
  onIncludeQueue: (value: boolean) => void; onScale: (value: number) => void; onExport: () => void; onClose: () => void
}
export function ExportDialog({ open, includeQueue, scale, busy, onIncludeQueue, onScale, onExport, onClose }: ExportDialogProps) {
  if (!open) return null
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <section className="dialog-card export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <button className="dialog-close" type="button" onClick={onClose} disabled={busy} aria-label="关闭"><X /></button>
        <div className="dialog-icon"><Download /></div><h2 id="export-title">导出 PNG</h2><p>导出内容不会包含工具栏、垃圾桶、选中框与滚动条。</p>
        <label className="toggle-row"><span><strong>包含等候区</strong><small>关闭时只导出排行区域</small></span><input type="checkbox" checked={includeQueue} onChange={(event) => onIncludeQueue(event.target.checked)} /></label>
        <fieldset><legend>分辨率</legend><div className="scale-options">{[1, 2, 4].map((value) => <button key={value} type="button" className={scale === value ? 'selected' : ''} onClick={() => onScale(value)}>{value}×</button>)}</div></fieldset>
        <button className="export-submit" type="button" disabled={busy} onClick={onExport}>{busy ? '正在生成…' : `导出 ${scale}× PNG`}</button>
      </section>
    </div>
  )
}
