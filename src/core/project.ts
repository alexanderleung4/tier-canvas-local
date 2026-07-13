import type { ImageId, ImageLocation, ProjectState, Tier, TierId } from '../types'

export const DEFAULT_TIER_NAMES = ['夯', '顶级', '人上人', 'NPC', '拉完了'] as const
export const QUEUE_ID = 'queue'
const randomId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
const makeTier = (name: string, index: number): Tier => ({ id: `tier-${index + 1}-${randomId()}`, name, imageIds: [] })

export function createDefaultProject(): ProjectState {
  return { version: 1, tiers: DEFAULT_TIER_NAMES.map(makeTier), queueImageIds: [], aspectRatio: '16:9', includeQueueOnExport: false }
}
export function cloneProject(project: ProjectState): ProjectState { return structuredClone(project) }
export function allImageIds(project: ProjectState): ImageId[] { return [...project.queueImageIds, ...project.tiers.flatMap((tier) => tier.imageIds)] }

export function findImage(project: ProjectState, imageId: ImageId): ImageLocation | null {
  const queueIndex = project.queueImageIds.indexOf(imageId)
  if (queueIndex >= 0) return { containerId: QUEUE_ID, index: queueIndex }
  for (const tier of project.tiers) {
    const index = tier.imageIds.indexOf(imageId)
    if (index >= 0) return { containerId: tier.id, index }
  }
  return null
}

function listFor(project: ProjectState, containerId: string): ImageId[] | null {
  if (containerId === QUEUE_ID) return project.queueImageIds
  return project.tiers.find((tier) => tier.id === containerId)?.imageIds ?? null
}

export function normalizeProject(project: ProjectState): ProjectState {
  const seen = new Set<ImageId>()
  const unique = (ids: ImageId[]) => ids.filter((id) => { if (seen.has(id)) return false; seen.add(id); return true })
  return {
    ...project,
    tiers: project.tiers.length ? project.tiers.map((tier) => ({ ...tier, imageIds: unique(tier.imageIds) })) : [makeTier('夯', 0)],
    queueImageIds: unique(project.queueImageIds),
  }
}

export function moveImage(project: ProjectState, imageId: ImageId, targetContainerId: string, targetIndex: number): ProjectState {
  const source = findImage(project, imageId)
  const next = cloneProject(project)
  const target = listFor(next, targetContainerId)
  if (!source || !target) return project
  const sourceList = listFor(next, source.containerId)
  if (!sourceList) return project
  sourceList.splice(source.index, 1)
  let adjustedIndex = targetIndex
  if (source.containerId === targetContainerId && source.index < targetIndex) adjustedIndex -= 1
  adjustedIndex = Math.max(0, Math.min(adjustedIndex, target.length))
  target.splice(adjustedIndex, 0, imageId)
  return normalizeProject(next)
}

export function addImages(project: ProjectState, ids: ImageId[]): ProjectState {
  const existing = new Set(allImageIds(project))
  return { ...project, queueImageIds: [...project.queueImageIds, ...ids.filter((id) => !existing.has(id))] }
}
export function removeImage(project: ProjectState, imageId: ImageId): ProjectState {
  const next = cloneProject(project)
  next.queueImageIds = next.queueImageIds.filter((id) => id !== imageId)
  next.tiers.forEach((tier) => { tier.imageIds = tier.imageIds.filter((id) => id !== imageId) })
  return next
}
export function addTier(project: ProjectState, name = '新层级'): ProjectState { return { ...project, tiers: [...project.tiers, makeTier(name, project.tiers.length)] } }
export function renameTier(project: ProjectState, tierId: TierId, name: string): ProjectState {
  const trimmed = name.trim()
  if (!trimmed) return project
  return { ...project, tiers: project.tiers.map((tier) => tier.id === tierId ? { ...tier, name: trimmed } : tier) }
}
export function moveTier(project: ProjectState, tierId: TierId, targetIndex: number): ProjectState {
  const sourceIndex = project.tiers.findIndex((tier) => tier.id === tierId)
  if (sourceIndex < 0) return project
  const tiers = project.tiers.map((tier) => ({ ...tier, imageIds: [...tier.imageIds] }))
  const [tier] = tiers.splice(sourceIndex, 1)
  let adjusted = targetIndex
  if (sourceIndex < targetIndex) adjusted -= 1
  tiers.splice(Math.max(0, Math.min(adjusted, tiers.length)), 0, tier)
  return { ...project, tiers }
}
export function removeTier(project: ProjectState, tierId: TierId): ProjectState {
  if (project.tiers.length <= 1) return project
  const tier = project.tiers.find((item) => item.id === tierId)
  if (!tier) return project
  return { ...project, tiers: project.tiers.filter((item) => item.id !== tierId), queueImageIds: [...project.queueImageIds, ...tier.imageIds] }
}
export function clearImages(project: ProjectState): ProjectState {
  return { ...project, queueImageIds: [], tiers: project.tiers.map((tier) => ({ ...tier, imageIds: [] })) }
}
export function resetTiers(project: ProjectState): ProjectState {
  const reset = createDefaultProject()
  return { ...reset, aspectRatio: project.aspectRatio, includeQueueOnExport: project.includeQueueOnExport, queueImageIds: allImageIds(project) }
}
