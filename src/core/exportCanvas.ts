import { toCanvas } from 'html-to-image'
import type { RuntimeAsset } from '../types'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function containRect(container: Rect, sourceWidth: number, sourceHeight: number): Rect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || container.width <= 0 || container.height <= 0) {
    return { ...container, width: 0, height: 0 }
  }
  const ratio = Math.min(container.width / sourceWidth, container.height / sourceHeight)
  const width = sourceWidth * ratio
  const height = sourceHeight * ratio
  return {
    x: container.x + (container.width - width) / 2,
    y: container.y + (container.height - height) / 2,
    width,
    height,
  }
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('浏览器无法生成 PNG 文件')), 'image/png')
  })
}

function mappedRect(rect: DOMRect, rootRect: DOMRect, scaleX: number, scaleY: number): Rect {
  return {
    x: (rect.left - rootRect.left) * scaleX,
    y: (rect.top - rootRect.top) * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  }
}

function clipAncestors(context: CanvasRenderingContext2D, tile: HTMLElement, root: HTMLElement, rootRect: DOMRect, scaleX: number, scaleY: number) {
  let ancestor = tile.parentElement
  while (ancestor && ancestor !== root) {
    if (ancestor.matches('.tier-grid-scroll, .queue-scroll')) {
      const rect = mappedRect(ancestor.getBoundingClientRect(), rootRect, scaleX, scaleY)
      context.beginPath()
      context.rect(rect.x, rect.y, rect.width, rect.height)
      context.clip()
    }
    ancestor = ancestor.parentElement
  }
}

function clipRoundedTile(context: CanvasRenderingContext2D, rect: Rect, radius: number) {
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2))
  context.beginPath()
  context.moveTo(rect.x + r, rect.y)
  context.lineTo(rect.x + rect.width - r, rect.y)
  context.arcTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + r, r)
  context.lineTo(rect.x + rect.width, rect.y + rect.height - r)
  context.arcTo(rect.x + rect.width, rect.y + rect.height, rect.x + rect.width - r, rect.y + rect.height, r)
  context.lineTo(rect.x + r, rect.y + rect.height)
  context.arcTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - r, r)
  context.lineTo(rect.x, rect.y + r)
  context.arcTo(rect.x, rect.y, rect.x + r, rect.y, r)
  context.closePath()
  context.clip()
}

export async function renderExportPng(root: HTMLElement, assets: Record<string, RuntimeAsset>, pixelRatio: number): Promise<{ blob: Blob; imageCount: number }> {
  const rootRect = root.getBoundingClientRect()
  if (!rootRect.width || !rootRect.height) throw new Error('导出画布尺寸无效')

  const tiles = [...root.querySelectorAll<HTMLElement>('.image-tile[data-image-id]')]
    .filter((tile) => getComputedStyle(tile).visibility !== 'hidden')

  const canvas = await toCanvas(root, {
    pixelRatio,
    cacheBust: false,
    backgroundColor: '#0b0d10',
    filter: (node) => {
      if (node instanceof HTMLImageElement) return false
      return !(node instanceof HTMLElement && node.dataset.exportExclude === 'true')
    },
  })
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器无法创建导出画布')
  const scaleX = canvas.width / rootRect.width
  const scaleY = canvas.height / rootRect.height
  let imageCount = 0

  for (const tile of tiles) {
    const imageId = tile.dataset.imageId
    const asset = imageId ? assets[imageId] : undefined
    if (!imageId || !asset) throw new Error('导出图片数据不完整，请刷新页面后重试')

    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await createImageBitmap(asset.original)
      const tileRect = mappedRect(tile.getBoundingClientRect(), rootRect, scaleX, scaleY)
      const target = containRect(tileRect, bitmap.width, bitmap.height)
      context.save()
      clipAncestors(context, tile, root, rootRect, scaleX, scaleY)
      clipRoundedTile(context, tileRect, 4 * Math.min(scaleX, scaleY))
      context.drawImage(bitmap, target.x, target.y, target.width, target.height)
      context.restore()
      imageCount += 1
    } catch (error) {
      throw new Error(`图片“${asset.name}”无法写入 PNG${error instanceof Error && error.message ? `：${error.message}` : ''}`)
    } finally {
      bitmap?.close()
    }
  }

  if (imageCount !== tiles.length) throw new Error('部分图片未能写入 PNG，请重试')
  return { blob: await canvasBlob(canvas), imageCount }
}
