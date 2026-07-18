import { create } from 'zustand'
import type { AspectRatio, ProjectState, RuntimeAsset, TierId } from './types'
import {
  addImages, addTier as addTierPure, clearImages as clearImagesPure, createDefaultProject,
  moveImage as moveImagePure, moveTier as moveTierPure, removeImage as removeImagePure,
  removeTier as removeTierPure, renameTier as renameTierPure, resetTiers,
  normalizeRankingColor,
} from './core/project'
import { loadWorkspace, persistWorkspace, runtimeAsset } from './db'
import { processImage } from './imageProcessing'

const HISTORY_LIMIT = 80
let persistTimer: number | undefined
let rankingColorEditStart: ProjectState | null = null
const schedulePersist = (project: ProjectState, assets: Record<string, RuntimeAsset>) => {
  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => void persistWorkspace(project, assets).catch(() => useAppStore.getState().notify('本地保存失败，请检查浏览器存储空间', 'error')), 180)
}

type ToastKind = 'info' | 'error'
interface Toast { id: number; message: string; kind: ToastKind }
interface AppStore {
  project: ProjectState
  assets: Record<string, RuntimeAsset>
  past: ProjectState[]
  future: ProjectState[]
  ready: boolean
  selectedImageId: string | null
  toast: Toast | null
  hydrate: () => Promise<void>
  commit: (project: ProjectState) => void
  uploadFiles: (files: File[]) => Promise<void>
  moveImage: (id: string, containerId: string, index: number) => void
  deleteImage: (id: string) => void
  addTier: () => void
  moveTier: (id: string, index: number) => void
  deleteTier: (id: string) => boolean
  renameTier: (id: TierId, name: string) => void
  clearImages: () => void
  reset: () => void
  setAspectRatio: (ratio: AspectRatio) => void
  setRankingColor: (color: string) => void
  previewRankingColor: (color: string) => void
  commitRankingColorEdit: (color: string) => void
  setIncludeQueue: (include: boolean) => void
  undo: () => void
  redo: () => void
  selectImage: (id: string | null) => void
  notify: (message: string, kind?: ToastKind) => void
  dismissToast: () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  project: createDefaultProject(), assets: {}, past: [], future: [], ready: false, selectedImageId: null, toast: null,
  hydrate: async () => {
    try {
      const { project, assets } = await loadWorkspace(); set({ project, assets, ready: true })
    } catch { set({ ready: true }); get().notify('无法读取本地项目，已使用初始设定', 'error') }
  },
  commit: (project) => set((state) => {
    rankingColorEditStart = null
    if (JSON.stringify(state.project) === JSON.stringify(project)) return state
    const next = { project, past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project], future: [] }
    schedulePersist(project, state.assets); return next
  }),
  uploadFiles: async (files) => {
    if (!files.length) return
    const added: RuntimeAsset[] = []
    const errors: string[] = []
    for (const file of files) {
      try { added.push(runtimeAsset(await processImage(file))) } catch (error) { errors.push(error instanceof Error ? error.message : file.name) }
    }
    if (added.length) {
      const assets = { ...get().assets, ...Object.fromEntries(added.map((asset) => [asset.id, asset])) }
      set({ assets })
      get().commit(addImages(get().project, added.map((asset) => asset.id)))
      get().notify(`已添加 ${added.length} 张图片`)
    }
    if (errors.length) get().notify(errors[0], 'error')
  },
  moveImage: (id, containerId, index) => get().commit(moveImagePure(get().project, id, containerId, index)),
  deleteImage: (id) => { get().commit(removeImagePure(get().project, id)); set({ selectedImageId: null }); get().notify('图片已删除，可撤销') },
  addTier: () => get().commit(addTierPure(get().project)),
  moveTier: (id, index) => get().commit(moveTierPure(get().project, id, index)),
  deleteTier: (id) => {
    if (get().project.tiers.length <= 1) { get().notify('至少需要保留一个层级', 'error'); return false }
    get().commit(removeTierPure(get().project, id)); get().notify('层级已删除，图片已移回等候区'); return true
  },
  renameTier: (id, name) => get().commit(renameTierPure(get().project, id, name)),
  clearImages: () => { get().commit(clearImagesPure(get().project)); set({ selectedImageId: null }); get().notify('所有图片已清空，可撤销') },
  reset: () => { get().commit(resetTiers(get().project)); get().notify('已恢复初始设定，图片保留在等候区') },
  setAspectRatio: (aspectRatio) => get().commit({ ...get().project, aspectRatio }),
  setRankingColor: (rankingColor) => get().commit({ ...get().project, rankingColor: normalizeRankingColor(rankingColor) }),
  previewRankingColor: (color) => set((state) => {
    const rankingColor = normalizeRankingColor(color)
    if (state.project.rankingColor === rankingColor) return state
    if (!rankingColorEditStart) rankingColorEditStart = state.project
    return { project: { ...state.project, rankingColor } }
  }),
  commitRankingColorEdit: (color) => set((state) => {
    const rankingColor = normalizeRankingColor(color)
    const project = { ...state.project, rankingColor }
    const start = rankingColorEditStart
    rankingColorEditStart = null
    if (!start) {
      if (state.project.rankingColor === rankingColor) return state
      const next = { project, past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project], future: [] }
      schedulePersist(project, state.assets)
      return next
    }
    if (start.rankingColor === rankingColor) {
      schedulePersist(project, state.assets)
      return { project }
    }
    const next = { project, past: [...state.past.slice(-(HISTORY_LIMIT - 1)), start], future: [] }
    schedulePersist(project, state.assets)
    return next
  }),
  setIncludeQueue: (includeQueueOnExport) => set((state) => {
    const project = { ...state.project, includeQueueOnExport }; schedulePersist(project, state.assets); return { project }
  }),
  undo: () => set((state) => {
    rankingColorEditStart = null
    const previous = state.past.at(-1); if (!previous) return state
    schedulePersist(previous, state.assets)
    return { project: previous, past: state.past.slice(0, -1), future: [state.project, ...state.future].slice(0, HISTORY_LIMIT) }
  }),
  redo: () => set((state) => {
    rankingColorEditStart = null
    const next = state.future[0]; if (!next) return state
    schedulePersist(next, state.assets)
    return { project: next, past: [...state.past, state.project].slice(-HISTORY_LIMIT), future: state.future.slice(1) }
  }),
  selectImage: (selectedImageId) => set({ selectedImageId }),
  notify: (message, kind = 'info') => {
    const toast = { id: Date.now(), message, kind }; set({ toast })
    window.setTimeout(() => { if (get().toast?.id === toast.id) set({ toast: null }) }, 3200)
  },
  dismissToast: () => set({ toast: null }),
}))

window.addEventListener('beforeunload', () => {
  Object.values(useAppStore.getState().assets).forEach((asset) => {
    URL.revokeObjectURL(asset.thumbnailUrl)
    URL.revokeObjectURL(asset.originalUrl)
  })
})
