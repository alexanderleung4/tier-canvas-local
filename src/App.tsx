import { useEffect, useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { toPng } from 'html-to-image'
import { X } from 'lucide-react'
import { Board, DragPreview } from './components/Board'
import { ImagePreview } from './components/ImagePreview'
import { Toolbar } from './components/Toolbar'
import { ConfirmDialog, ExportDialog } from './components/Dialogs'
import { useAppStore } from './store'

type ActiveItem = { type: 'image'; id: string } | { type: 'tier'; id: string } | null
type ImagePreviewState = { id: string; closing: boolean } | null

export default function App() {
  const store = useAppStore()
  const [active, setActive] = useState<ActiveItem>(null)
  const [presentation, setPresentation] = useState(false)
  const [imagePreview, setImagePreview] = useState<ImagePreviewState>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScale, setExportScale] = useState(2)
  const [exporting, setExporting] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => { void store.hydrate() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement
      if (event.key === 'Escape' && imagePreview) { setImagePreview((current) => current ? { ...current, closing: true } : null); return }
      if (event.key === 'Escape' && presentation) { setPresentation(false); return }
      if (editing) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? store.redo() : store.undo(); return }
      if ((event.key === 'Delete' || event.key === 'Backspace') && imagePreview) { event.preventDefault(); setImagePreview((current) => current ? { ...current, closing: true } : null); return }
      if ((event.key === 'Delete' || event.key === 'Backspace') && store.selectedImageId) { event.preventDefault(); store.deleteImage(store.selectedImageId) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [imagePreview, presentation, store.selectedImageId, store.undo, store.redo, store.deleteImage])

  useEffect(() => {
    if (imagePreview && !store.assets[imagePreview.id]) setImagePreview(null)
  }, [imagePreview, store.assets])

  const collisionDetection: CollisionDetection = (args) => {
    const type = args.active.data.current?.type
    return pointerWithin(args).filter(({ id }) => type === 'tier'
      ? String(id).startsWith('drop-tier-') || id === 'drop-trash'
      : !String(id).startsWith('drop-tier-'))
  }
  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === 'image') setActive({ type: 'image', id: String(data.imageId) })
    if (data?.type === 'tier') setActive({ type: 'tier', id: String(data.tierId) })
  }
  const onDragEnd = (event: DragEndEvent) => {
    const item = active; setActive(null)
    if (!item || !event.over) return
    const over = event.over.data.current
    if (over?.type === 'trash') {
      item.type === 'image' ? store.deleteImage(item.id) : store.deleteTier(item.id)
      return
    }
    if (item.type === 'image') {
      if (over?.type === 'container') {
        const target = over.containerId === 'queue' ? store.project.queueImageIds : store.project.tiers.find((tier) => tier.id === over.containerId)?.imageIds
        store.moveImage(item.id, String(over.containerId), target?.length ?? 0)
      } else if (over?.type === 'image-target') {
        const translated = event.active.rect.current.translated
        const centerX = translated ? translated.left + translated.width / 2 : event.over.rect.left
        const after = centerX > event.over.rect.left + event.over.rect.width / 2
        store.moveImage(item.id, String(over.containerId), Number(over.index) + (after ? 1 : 0))
      }
    } else if (over?.type === 'tier-target') {
      const translated = event.active.rect.current.translated
      const centerY = translated ? translated.top + translated.height / 2 : event.over.rect.top
      const after = centerY > event.over.rect.top + event.over.rect.height / 2
      store.moveTier(item.id, Number(over.index) + (after ? 1 : 0))
    }
  }

  const activeAsset = active?.type === 'image' ? store.assets[active.id] : undefined
  const activeTier = active?.type === 'tier' ? store.project.tiers.find((tier) => tier.id === active.id) : undefined
  const previewAsset = imagePreview ? store.assets[imagePreview.id] : undefined
  const closePreview = () => setImagePreview((current) => current ? { ...current, closing: true } : null)
  const exportPng = async () => {
    setExporting(true)
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      await document.fonts.ready
      const root = document.getElementById(store.project.includeQueueOnExport ? 'tier-board' : 'ranking-export')
      if (!root) throw new Error('找不到导出画布')
      await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)))
      const dataUrl = await toPng(root, {
        pixelRatio: exportScale,
        cacheBust: false,
        backgroundColor: '#0b0d10',
        filter: (node) => !(node instanceof HTMLElement && node.dataset.exportExclude === 'true'),
      })
      const link = document.createElement('a')
      link.download = `从夯到拉-${Date.now()}.png`
      link.href = dataUrl
      document.body.append(link)
      link.click()
      link.remove()
      store.notify('PNG 已生成')
      setExportOpen(false)
    } catch (error) { store.notify(error instanceof Error ? `导出失败：${error.message}` : '导出失败', 'error') }
    finally { setExporting(false) }
  }

  const readyClass = store.ready ? '' : 'is-loading'
  return (
    <div className={`app-shell ${presentation ? 'presentation-mode' : ''} ${readyClass}`}>
      {!presentation && <Toolbar onClear={() => { setImagePreview(null); setClearOpen(true) }} onExport={() => { setImagePreview(null); setExportOpen(true) }} onPresentation={() => setPresentation(true)} />}
      {presentation && <button className="exit-presentation" type="button" onClick={() => setPresentation(false)}><X />退出演示</button>}
      <DndContext sensors={sensors} collisionDetection={collisionDetection} autoScroll onDragStart={onDragStart} onDragCancel={() => setActive(null)} onDragEnd={onDragEnd}>
        <Board presentation={presentation} activeType={active?.type ?? null} onPreviewImage={(id) => setImagePreview({ id, closing: false })} exporting={exporting} />
        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}><DragPreview type={active?.type ?? null} asset={activeAsset} tier={activeTier} /></DragOverlay>
      </DndContext>
      {imagePreview && previewAsset && <ImagePreview asset={previewAsset} closing={imagePreview.closing} onClose={closePreview} onClosed={() => setImagePreview(null)} />}
      {!store.ready && <div className="loading-state"><span></span>正在恢复本地项目…</div>}
      {store.toast && <div className={`toast ${store.toast.kind}`} role="status"><span>{store.toast.message}</span><button type="button" onClick={store.dismissToast} aria-label="关闭提示"><X /></button></div>}
      <ConfirmDialog open={clearOpen} title="清空所有图片？" description="这会从等候区和所有层级中移除图片，但不会改变层级。清空后仍可撤销。" confirmLabel="清空图片" onClose={() => setClearOpen(false)} onConfirm={() => { store.clearImages(); setClearOpen(false) }} />
      <ExportDialog open={exportOpen} includeQueue={store.project.includeQueueOnExport} scale={exportScale} busy={exporting} onIncludeQueue={store.setIncludeQueue} onScale={setExportScale} onClose={() => !exporting && setExportOpen(false)} onExport={() => void exportPng()} />
    </div>
  )
}
