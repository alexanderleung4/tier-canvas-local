import { describe, expect, it } from 'vitest'
import { tierColor } from '../src/core/colors'
import { calculateGrid } from '../src/core/grid'
import { containRect } from '../src/core/exportCanvas'
import {
  addImages, addTier, allImageIds, clearImages, createDefaultProject, moveImage, resolveImageMoveIndex,
  moveTier, QUEUE_ID, removeTier, renameTier, resetTiers,
} from '../src/core/project'

describe('层级颜色插值', () => {
  it.each([1, 2, 5, 6, 10])('%i 层时固定首尾颜色', (total) => {
    expect(tierColor(0, total)).toBe('#D94B3D')
    if (total > 1) expect(tierColor(total - 1, total)).toBe('#FFFFFF')
  })
  it('五层命中所有锚点', () => {
    expect(Array.from({ length: 5 }, (_, index) => tierColor(index, 5))).toEqual(['#D94B3D', '#F2C84B', '#FFF44F', '#F6EED3', '#FFFFFF'])
  })
})

describe('项目状态操作', () => {
  it('新增、改名和插入式重排层级', () => {
    const original = createDefaultProject()
    const added = addTier(original)
    expect(added.tiers).toHaveLength(6)
    expect(added.tiers.at(-1)?.name).toBe('新层级')
    const renamed = renameTier(added, added.tiers[5].id, '测试层')
    const moved = moveTier(renamed, renamed.tiers[5].id, 1)
    expect(moved.tiers.map((tier) => tier.name).slice(0, 3)).toEqual(['夯', '测试层', '顶级'])
  })

  it('删除层级时图片按原顺序追加至等候区', () => {
    const project = createDefaultProject()
    project.queueImageIds = ['q1']
    project.tiers[1].imageIds = ['a', 'b']
    const next = removeTier(project, project.tiers[1].id)
    expect(next.queueImageIds).toEqual(['q1', 'a', 'b'])
    expect(next.tiers).toHaveLength(4)
  })

  it('图片可跨区域移动并在同区域插入，不产生重复 ID', () => {
    let project = addImages(createDefaultProject(), ['a', 'b', 'c'])
    project = moveImage(project, 'b', project.tiers[0].id, 0)
    project = moveImage(project, 'a', project.tiers[0].id, 0)
    expect(project.tiers[0].imageIds).toEqual(['a', 'b'])
    project = moveImage(project, 'b', project.tiers[0].id, 0)
    expect(project.tiers[0].imageIds).toEqual(['b', 'a'])
    project = moveImage(project, 'a', QUEUE_ID, 1)
    expect(project.queueImageIds).toEqual(['c', 'a'])
    expect(new Set(allImageIds(project)).size).toBe(allImageIds(project).length)
  })

  it('清空图片保留层级；恢复初始设定保留图片', () => {
    let project = addImages(createDefaultProject(), ['a', 'b'])
    project = moveImage(project, 'a', project.tiers[0].id, 0)
    const cleared = clearImages(project)
    expect(cleared.tiers.map((tier) => tier.name)).toEqual(project.tiers.map((tier) => tier.name))
    expect(allImageIds(cleared)).toEqual([])
    const reset = resetTiers(project)
    expect(reset.tiers.map((tier) => tier.name)).toEqual(['夯', '顶级', '人上人', 'NPC', '拉完了'])
    expect(reset.queueImageIds).toEqual(['b', 'a'])
  })
})

describe('行内 Grid', () => {
  it('优先使用最少排数', () => {
    expect(calculateGrid(100, 500, 4).rows).toBe(1)
    expect(calculateGrid(100, 500, 8).rows).toBe(2)
  })
  it('达到最小槽位后横向溢出', () => {
    const result = calculateGrid(100, 160, 50, 40, 4)
    expect(result.slotSize).toBeGreaterThanOrEqual(40)
    expect(result.overflow).toBe(true)
    expect(result.contentWidth).toBeGreaterThan(160)
  })
})

describe('拖拽落点投影', () => {
  it('预览索引与最终插入索引使用同一套规则', () => {
    const project = addImages(createDefaultProject(), ['a', 'b', 'c', 'd'])
    expect(resolveImageMoveIndex(project, 'a', QUEUE_ID, 3)).toBe(2)
    expect(resolveImageMoveIndex(project, 'c', QUEUE_ID, 0)).toBe(0)
    expect(resolveImageMoveIndex(project, 'b', project.tiers[0].id, 0)).toBe(0)
  })
})

describe('导出图片布局', () => {
  it('横图和竖图都按 contain 规则居中且不裁切', () => {
    expect(containRect({ x: 10, y: 20, width: 100, height: 100 }, 200, 100)).toEqual({ x: 10, y: 45, width: 100, height: 50 })
    expect(containRect({ x: 10, y: 20, width: 100, height: 100 }, 100, 200)).toEqual({ x: 35, y: 20, width: 50, height: 100 })
  })
})
