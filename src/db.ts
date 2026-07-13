import Dexie, { type EntityTable } from 'dexie'
import type { ImageAssetRecord, ProjectState, RuntimeAsset } from './types'
import { allImageIds, createDefaultProject, normalizeProject } from './core/project'

interface ProjectRecord { key: 'current'; project: ProjectState }
class TierCanvasDb extends Dexie {
  projects!: EntityTable<ProjectRecord, 'key'>
  assets!: EntityTable<ImageAssetRecord, 'id'>
  constructor() {
    super('tier-canvas-local-v1')
    this.version(1).stores({ projects: 'key', assets: 'id, createdAt' })
  }
}

export const db = new TierCanvasDb()

export function runtimeAsset(record: ImageAssetRecord): RuntimeAsset {
  return { ...record, thumbnailUrl: URL.createObjectURL(record.thumbnail), originalUrl: URL.createObjectURL(record.original) }
}

export async function loadWorkspace(): Promise<{ project: ProjectState; assets: Record<string, RuntimeAsset> }> {
  const saved = await db.projects.get('current')
  const project = normalizeProject(saved?.project ?? createDefaultProject())
  const records = await db.assets.bulkGet(allImageIds(project))
  const assets: Record<string, RuntimeAsset> = {}
  records.forEach((record) => { if (record) assets[record.id] = runtimeAsset(record) })
  const valid = new Set(Object.keys(assets))
  project.queueImageIds = project.queueImageIds.filter((id) => valid.has(id))
  project.tiers.forEach((tier) => { tier.imageIds = tier.imageIds.filter((id) => valid.has(id)) })
  return { project, assets }
}

export async function persistWorkspace(project: ProjectState, assets: Record<string, RuntimeAsset>) {
  const activeIds = new Set(allImageIds(project))
  await db.transaction('rw', db.projects, db.assets, async () => {
    await db.projects.put({ key: 'current', project })
    const existing = await db.assets.toCollection().primaryKeys()
    const obsolete = existing.filter((id) => !activeIds.has(String(id))) as string[]
    if (obsolete.length) await db.assets.bulkDelete(obsolete)
    const records = [...activeIds].map((id) => assets[id]).filter(Boolean).map(({ thumbnailUrl: _t, originalUrl: _o, ...record }) => record)
    if (records.length) await db.assets.bulkPut(records)
  })
}
