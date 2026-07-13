export type ImageId = string
export type TierId = string
export type AspectRatio = '16:9' | '9:16' | '1:1'

export interface Tier { id: TierId; name: string; imageIds: ImageId[] }

export interface ProjectState {
  version: 1
  tiers: Tier[]
  queueImageIds: ImageId[]
  aspectRatio: AspectRatio
  includeQueueOnExport: boolean
}

export interface ImageAssetRecord {
  id: ImageId
  name: string
  mimeType: string
  width: number
  height: number
  createdAt: number
  thumbnail: Blob
  original: Blob
}

export interface RuntimeAsset extends ImageAssetRecord {
  thumbnailUrl: string
  originalUrl: string
}

export interface ImageLocation { containerId: string; index: number }
