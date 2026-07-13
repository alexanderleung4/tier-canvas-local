import type { ImageAssetRecord } from './types'

const accepted = new Set(['image/png', 'image/jpeg', 'image/webp'])

async function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片缩略图生成失败')), type, quality))
}

export async function processImage(file: File): Promise<ImageAssetRecord> {
  if (!accepted.has(file.type)) throw new Error(`${file.name} 不是支持的 PNG、JPG 或 WebP 图片`)
  const bitmap = await createImageBitmap(file)
  const max = 512
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) throw new Error('浏览器无法创建图片画布')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const thumbnail = await canvasBlob(canvas, file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp', 0.86)
  return {
    id: crypto.randomUUID(), name: file.name, mimeType: file.type,
    width: canvas.width / scale, height: canvas.height / scale, createdAt: Date.now(),
    thumbnail, original: file,
  }
}
