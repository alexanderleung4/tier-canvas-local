import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical, Trash2 } from 'lucide-react'
import { calculateGrid } from '../core/grid'
import { QUEUE_ID } from '../core/project'
import { rankingContrastColors, tierColor } from '../core/colors'
import { useAppStore } from '../store'
import type { ImageDropProjection, RuntimeAsset, Tier } from '../types'
import { useElementSize } from './useElementSize'

interface ImageTileProps { id: string; containerId: string; index: number; size: number; presentation: boolean; onPreviewImage: (id: string) => void; exporting?: boolean }
export function ImageTile({ id, containerId, index, size, presentation, onPreviewImage }: ImageTileProps) {
  const asset = useAppStore((state) => state.assets[id])
  const selected = useAppStore((state) => state.selectedImageId === id)
  const selectImage = useAppStore((state) => state.selectImage)
  const drag = useDraggable({ id: `drag-image-${id}`, data: { type: 'image', imageId: id, containerId, index } })
  const drop = useDroppable({ id: `drop-image-${id}`, disabled: drag.isDragging, data: { type: 'image-target', imageId: id, containerId, index } })
  if (!asset) return null
  const setRef = (node: HTMLElement | null) => { drag.setNodeRef(node); drop.setNodeRef(node) }
  return (
    <button
      ref={setRef}
      type="button"
      className={`image-tile ${selected ? 'is-selected' : ''} ${drag.isDragging ? 'is-origin' : ''}`}
      style={{ width: size, height: size }}
      {...drag.listeners}
      {...drag.attributes}
      onClick={(event) => { event.stopPropagation(); selectImage(id) }}
      onDoubleClick={(event) => { event.stopPropagation(); selectImage(id); onPreviewImage(id) }}
      aria-label={`图片 ${asset.name}`}
      data-image-id={id}
      data-container-id={containerId}
      title={presentation ? undefined : asset.name}
    >
      <img src={asset.thumbnailUrl} alt={asset.name} draggable={false} />
    </button>
  )
}

function ImageDropPlaceholder({ imageId, containerId, index, size }: { imageId: string; containerId: string; index: number; size: number }) {
  const asset = useAppStore((state) => state.assets[imageId])
  const drop = useDroppable({ id: `drop-image-placeholder-${imageId}`, data: { type: 'projection-target', imageId, containerId, index } })
  if (!asset) return null
  return (
    <div
      ref={drop.setNodeRef}
      className={`image-drop-placeholder ${drop.isOver ? 'is-over' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
      data-placeholder-image-id={imageId}
      data-placeholder-container-id={containerId}
      data-placeholder-index={index}
    >
      <img src={asset.thumbnailUrl} alt="" draggable={false} />
    </div>
  )
}

type ProjectedItem = { type: 'image'; id: string; sourceIndex: number } | { type: 'placeholder' }

function projectedItems(ids: string[], containerId: string, activeImageId: string | null, projection: ImageDropProjection | null): ProjectedItem[] {
  const items: ProjectedItem[] = ids
    .map((id, sourceIndex) => ({ type: 'image' as const, id, sourceIndex }))
    .filter((item) => item.id !== activeImageId)
  if (projection && projection.mode !== 'trash' && projection.targetContainerId === containerId) {
    const index = Math.max(0, Math.min(projection.finalIndex, items.length))
    items.splice(index, 0, { type: 'placeholder' })
  }
  return items
}

function ContainerImages({ ids, containerId, size, presentation, onPreviewImage, exporting, activeImageId, projection }: {
  ids: string[]
  containerId: string
  size: number
  presentation: boolean
  onPreviewImage: (id: string) => void
  exporting: boolean
  activeImageId: string | null
  projection: ImageDropProjection | null
}) {
  const activeIndex = activeImageId ? ids.indexOf(activeImageId) : -1
  const items = projectedItems(ids, containerId, activeImageId, projection)
  return (
    <>
      {activeIndex >= 0 && activeImageId && <ImageTile key={activeImageId} id={activeImageId} containerId={containerId} index={activeIndex} size={size} presentation={presentation} onPreviewImage={onPreviewImage} exporting={exporting} />}
      {items.map((item) => item.type === 'image'
        ? <ImageTile key={item.id} id={item.id} containerId={containerId} index={item.sourceIndex} size={size} presentation={presentation} onPreviewImage={onPreviewImage} exporting={exporting} />
        : <ImageDropPlaceholder key={`placeholder-${activeImageId}`} imageId={activeImageId!} containerId={containerId} index={projection!.finalIndex} size={size} />)}
    </>
  )
}

interface ImageGridProps { tier: Tier; rowHeight: number; presentation: boolean; onPreviewImage: (id: string) => void; exporting: boolean; activeImageId: string | null; projection: ImageDropProjection | null }
function TierImageGrid({ tier, rowHeight, presentation, onPreviewImage, exporting, activeImageId, projection }: ImageGridProps) {
  const { ref, width, height } = useElementSize<HTMLDivElement>()
  const drop = useDroppable({ id: `drop-container-${tier.id}`, data: { type: 'container', containerId: tier.id } })
  const itemCount = projectedItems(tier.imageIds, tier.id, activeImageId, projection).length
  const layout = useMemo(() => calculateGrid(height || rowHeight, width || 800, itemCount, 40, 4), [height, width, rowHeight, itemCount])
  const setRef = (node: HTMLDivElement | null) => { ref.current = node; drop.setNodeRef(node) }
  const style = { '--slot': `${layout.slotSize}px`, '--content-width': `${layout.contentWidth}px` } as CSSProperties
  return (
    <div ref={setRef} className={`tier-grid-scroll ${layout.overflow ? 'has-overflow' : ''} ${drop.isOver ? 'is-over' : ''}`} data-testid={`tier-grid-${tier.name}`}>
      <div className="tier-grid" style={style}>
        <ContainerImages ids={tier.imageIds} containerId={tier.id} size={layout.slotSize} presentation={presentation} onPreviewImage={onPreviewImage} exporting={exporting} activeImageId={activeImageId} projection={projection} />
        {!itemCount && <span className="empty-drop-hint">拖入图片</span>}
      </div>
    </div>
  )
}

interface TierHeaderProps { tier: Tier; index: number; total: number; rowHeight: number; presentation: boolean }
function TierHeader({ tier, index, total, rowHeight, presentation }: TierHeaderProps) {
  const renameTier = useAppStore((state) => state.renameTier)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tier.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const drag = useDraggable({ id: `drag-tier-${tier.id}`, disabled: editing || presentation, data: { type: 'tier', tierId: tier.id, index } })
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  useEffect(() => setDraft(tier.name), [tier.name])
  const save = () => { if (draft.trim()) renameTier(tier.id, draft); else setDraft(tier.name); setEditing(false) }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') save()
    if (event.key === 'Escape') { setDraft(tier.name); setEditing(false) }
    event.stopPropagation()
  }
  const fontSize = Math.max(12, Math.min(30, rowHeight * (tier.name.length > 5 ? 0.2 : tier.name.length > 3 ? 0.26 : 0.31)))
  return (
    <div
      ref={drag.setNodeRef}
      className={`tier-header ${drag.isDragging ? 'is-origin' : ''}`}
      style={{ width: rowHeight, background: tierColor(index, total), fontSize }}
      title={tier.name}
      data-testid={`tier-header-${tier.name}`}
      {...(editing ? {} : drag.listeners)}
      {...(editing ? {} : drag.attributes)}
      onDoubleClick={() => { if (!presentation) setEditing(true) }}
    >
      {editing ? (
        <input ref={inputRef} value={draft} maxLength={80} onChange={(event) => setDraft(event.target.value)} onBlur={save} onKeyDown={onKeyDown} aria-label="层级名称" />
      ) : (
        <><span>{tier.name}</span>{!presentation && <GripVertical className="tier-grip" aria-hidden="true" />}</>
      )}
    </div>
  )
}

interface TierRowProps { tier: Tier; index: number; total: number; rowHeight: number; presentation: boolean; onPreviewImage: (id: string) => void; exporting: boolean; activeImageId: string | null; projection: ImageDropProjection | null }
function TierRow({ tier, index, total, rowHeight, presentation, onPreviewImage, exporting, activeImageId, projection }: TierRowProps) {
  const drop = useDroppable({ id: `drop-tier-${tier.id}`, data: { type: 'tier-target', tierId: tier.id, index } })
  return (
    <div ref={drop.setNodeRef} className={`tier-row ${drop.isOver ? 'tier-target' : ''}`} style={{ height: rowHeight }} data-tier-name={tier.name}>
      <TierHeader tier={tier} index={index} total={total} rowHeight={rowHeight} presentation={presentation} />
      <TierImageGrid tier={tier} rowHeight={rowHeight} presentation={presentation} onPreviewImage={onPreviewImage} exporting={exporting} activeImageId={activeImageId} projection={projection} />
    </div>
  )
}

function WaitingQueue({ presentation, onPreviewImage, exporting, activeImageId, projection }: { presentation: boolean; onPreviewImage: (id: string) => void; exporting: boolean; activeImageId: string | null; projection: ImageDropProjection | null }) {
  const ids = useAppStore((state) => state.project.queueImageIds)
  const { ref, height } = useElementSize<HTMLDivElement>()
  const drop = useDroppable({ id: 'drop-container-queue', data: { type: 'container', containerId: QUEUE_ID } })
  const slot = Math.max(44, (height || 120) - 42)
  const setRef = (node: HTMLDivElement | null) => { ref.current = node; drop.setNodeRef(node) }
  return (
    <div ref={setRef} className={`waiting-queue ${drop.isOver ? 'is-over' : ''}`} data-testid="waiting-queue">
      <div className="queue-label">等候区 <span>· {ids.length}</span></div>
      <div className="queue-scroll">
        <div className="queue-grid">
          <ContainerImages ids={ids} containerId={QUEUE_ID} size={slot} presentation={presentation} onPreviewImage={onPreviewImage} exporting={exporting} activeImageId={activeImageId} projection={projection} />
          {!projectedItems(ids, QUEUE_ID, activeImageId, projection).length && <span className="queue-empty">上传图片后会出现在这里</span>}
        </div>
      </div>
    </div>
  )
}

export function TrashZone({ activeType }: { activeType: 'image' | 'tier' | null }) {
  const drop = useDroppable({ id: 'drop-trash', data: { type: 'trash' } })
  return (
    <div ref={drop.setNodeRef} className={`trash-zone ${activeType ? 'is-active' : ''} ${drop.isOver ? 'is-over' : ''}`} data-testid="trash-zone" data-export-exclude="true">
      <Trash2 aria-hidden="true" />
      <strong>{activeType === 'tier' ? '删除层级' : '删除图片'}</strong>
      <span>{activeType === 'tier' ? '图片将移回等候区' : '拖到此处'}</span>
    </div>
  )
}

interface BoardProps { presentation: boolean; activeType: 'image' | 'tier' | null; activeImageId: string | null; imageProjection: ImageDropProjection | null; onPreviewImage: (id: string) => void; exporting?: boolean }
export function Board({ presentation, activeType, activeImageId, imageProjection, onPreviewImage, exporting = false }: BoardProps) {
  const project = useAppStore((state) => state.project)
  const selectImage = useAppStore((state) => state.selectImage)
  const { ref: viewportRef, width: viewportWidth, height: viewportHeight } = useElementSize<HTMLDivElement>()
  const { ref: listRef, height: listHeight } = useElementSize<HTMLDivElement>()
  const dimensions = project.aspectRatio === '16:9' ? { width: 1280, height: 720 } : project.aspectRatio === '9:16' ? { width: 720, height: 1280 } : { width: 900, height: 900 }
  const scale = Math.min((viewportWidth - 24) / dimensions.width, (viewportHeight - 24) / dimensions.height, 1)
  const rowHeight = Math.max(56, (listHeight || dimensions.height * 0.8) / project.tiers.length)
  const contrast = rankingContrastColors(project.rankingColor)
  const boardStyle = {
    width: dimensions.width,
    height: dimensions.height,
    transform: `scale(${scale})`,
    '--ranking-color': project.rankingColor,
    '--ranking-divider': contrast.divider,
    '--ranking-hint': contrast.hint,
    '--ranking-hover': contrast.hover,
  } as CSSProperties
  return (
    <main ref={viewportRef} className="canvas-viewport" onClick={() => selectImage(null)}>
      <div className="canvas-scaler" style={{ width: dimensions.width * scale, height: dimensions.height * scale }}>
        <section
          id="tier-board"
          className={`tier-board ${exporting ? 'is-exporting' : ''}`}
          style={boardStyle}
          data-aspect-ratio={project.aspectRatio}
        >
          <div className="ranking-area" id="ranking-export">
            <div className="ranking-main">
              <div ref={listRef} className="tier-list">
                {project.tiers.map((tier, index) => <TierRow key={tier.id} tier={tier} index={index} total={project.tiers.length} rowHeight={rowHeight} presentation={presentation} onPreviewImage={onPreviewImage} exporting={exporting} activeImageId={activeImageId} projection={imageProjection} />)}
              </div>
              <TrashZone activeType={activeType} />
            </div>
          </div>
          <WaitingQueue presentation={presentation} onPreviewImage={onPreviewImage} exporting={exporting} activeImageId={activeImageId} projection={imageProjection} />
        </section>
      </div>
    </main>
  )
}

export function DragPreview({ asset, tier, type }: { asset?: RuntimeAsset; tier?: Tier; type: 'image' | 'tier' | null }) {
  if (type === 'image' && asset) return <div className="drag-preview image-preview"><img src={asset.thumbnailUrl} alt="" /></div>
  if (type === 'tier' && tier) return <div className="drag-preview tier-preview"><span>{tier.name}</span><span>{tier.imageIds.length} 张图片</span></div>
  return null
}
