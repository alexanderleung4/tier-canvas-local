import { useEffect, useMemo, useRef, useState } from 'react'
import { closestCenter, DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core'
import { toPng } from 'html-to-image'
import { X } from 'lucide-react'
import { Board, DragPreview } from './components/Board'
import { ImagePreview } from './components/ImagePreview'
import { Toolbar } from './components/Toolbar'
import { ConfirmDialog, ExportDialog } from './components/Dialogs'
import { useAppStore } from './store'
import { findImage, resolveImageMoveIndex } from './core/project'
import type { ImageDropProjection } from './types'

type ActiveItem = { type: 'image'; id: string } | { type: 'tier'; id: string } | null
type ImagePreviewState = { id: string; closing: boolean } | null
const autoScrollOptions = { canScroll: (element: Element) => element.classList.contains('tier-list') }

export default function App() {
  const store = useAppStore()
  const [active, setActive] = useState<ActiveItem>(null)
  const [imageProjection, setImageProjection] = useState<ImageDropProjection | null>(null)
  const imageProjectionRef = useRef<ImageDropProjection | null>(null)
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
    const collisions = pointerWithin(args).filter(({ id }) => type === 'tier'
      ? String(id).startsWith('drop-tier-') || id === 'drop-trash'
      : !String(id).startsWith('drop-tier-'))
    if (type !== 'image') return collisions
    const direct = collisions.filter(({ data }) => {
      const targetType = data?.droppableContainer.data.current?.type
      return targetType === 'trash' || targetType === 'image-target' || targetType === 'projection-target'
    })
    if (direct.length) return [...direct, ...collisions.filter((collision) => !direct.includes(collision))]
    const container = collisions.find(({ data }) => data?.droppableContainer.data.current?.type === 'container')
    const containerId = container?.data?.droppableContainer.data.current?.containerId
    if (!containerId) return collisions
    const imageTargets = args.droppableContainers.filter((item) => {
      const data = item.data.current
      return !item.disabled && data?.type === 'image-target' && data.containerId === containerId
    })
    const nearest = imageTargets.length ? closestCenter({ ...args, droppableContainers: imageTargets }) : []
    return nearest.length ? [...nearest, ...collisions] : collisions
  }
  const updateImageProjection = (projection: ImageDropProjection | null) => {
    imageProjectionRef.current = projection
    setImageProjection(projection)
  }
  const projectionFor = (imageId: string, targetContainerId: string, targetIndex: number): ImageDropProjection | null => {
    const source = findImage(store.project, imageId)
    const finalIndex = resolveImageMoveIndex(store.project, imageId, targetContainerId, targetIndex)
    if (!source || finalIndex === null) return null
    return {
      imageId,
      sourceContainerId: source.containerId,
      sourceIndex: source.index,
      targetContainerId,
      targetIndex,
      finalIndex,
      mode: source.containerId === targetContainerId && source.index === finalIndex ? 'original' : 'insert',
    }
  }
  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === 'image') {
      const imageId = String(data.imageId)
      const source = findImage(store.project, imageId)
      setActive({ type: 'image', id: imageId })
      updateImageProjection(source ? projectionFor(imageId, source.containerId, source.index) : null)
    }
    if (data?.type === 'tier') setActive({ type: 'tier', id: String(data.tierId) })
  }
  const onDragOver = (event: DragOverEvent) => {
    const data = event.active.data.current
    if (data?.type !== 'image') return
    const imageId = String(data.imageId)
    const source = findImage(store.project, imageId)
    if (!source) return
    const over = event.over?.data.current
    if (!over) {
      updateImageProjection(projectionFor(imageId, source.containerId, source.index))
      return
    }
    if (over.type === 'trash') {
      updateImageProjection({
        imageId,
        sourceContainerId: source.containerId,
        sourceIndex: source.index,
        targetContainerId: source.containerId,
        targetIndex: source.index,
        finalIndex: source.index,
        mode: 'trash',
      })
      return
    }
    if (over.type === 'projection-target') return
    let targetContainerId: string | null = null
    let targetIndex = 0
    if (over.type === 'container') {
      targetContainerId = String(over.containerId)
      const target = targetContainerId === 'queue' ? store.project.queueImageIds : store.project.tiers.find((tier) => tier.id === targetContainerId)?.imageIds
      targetIndex = target?.length ?? 0
    } else if (over.type === 'image-target') {
      targetContainerId = String(over.containerId)
      const translated = event.active.rect.current.translated
      const centerX = translated ? translated.left + translated.width / 2 : event.over?.rect.left ?? 0
      const overRect = event.over?.rect
      const after = overRect ? centerX > overRect.left + overRect.width / 2 : false
      targetIndex = Number(over.index) + (after ? 1 : 0)
    }
    if (targetContainerId) updateImageProjection(projectionFor(imageId, targetContainerId, targetIndex))
  }
  const onDragEnd = (event: DragEndEvent) => {
    const item = active
    const projection = imageProjectionRef.current
    setActive(null)
    updateImageProjection(null)
    if (!item) return
    if (item.type === 'image') {
      if (!projection || projection.imageId !== item.id) return
      if (projection.mode === 'trash') store.deleteImage(item.id)
      else store.moveImage(item.id, projection.targetContainerId, projection.targetIndex)
      return
    }
    if (!event.over) return
    const over = event.over.data.current
    if (over?.type === 'trash') {
      store.deleteTier(item.id)
      return
    }
    if (over?.type === 'tier-target') {
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
      <DndContext sensors={sensors} collisionDetection={collisionDetection} autoScroll={autoScrollOptions} onDragStart={onDragStart} onDragOver={onDragOver} onDragCancel={() => { setActive(null); updateImageProjection(null) }} onDragEnd={onDragEnd}>
        <Board presentation={presentation} activeType={active?.type ?? null} activeImageId={active?.type === 'image' ? active.id : null} imageProjection={imageProjection} onPreviewImage={(id) => setImagePreview({ id, closing: false })} exporting={exporting} />
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
