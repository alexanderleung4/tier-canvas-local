import { expect, test, type Locator, type Page } from '@playwright/test'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

async function drag(page: Page, source: Locator, target: Locator, offset = { x: 0.5, y: 0.5 }) {
  const from = await source.boundingBox(); const to = await target.boundingBox()
  if (!from || !to) throw new Error('拖拽元素不可见')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 3 })
  await page.mouse.move(to.x + to.width * offset.x, to.y + to.height * offset.y, { steps: 10 })
  await page.mouse.up()
}

async function startDrag(page: Page, source: Locator, target: Locator, offset = { x: 0.5, y: 0.5 }) {
  const from = await source.boundingBox(); const to = await target.boundingBox()
  if (!from || !to) throw new Error('拖拽元素不可见')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 3 })
  await page.mouse.move(to.x + to.width * offset.x, to.y + to.height * offset.y, { steps: 10 })
}

async function readPngPixel(page: Page, filePath: string, sample: { x: number; y: number }) {
  const dataUrl = `data:image/png;base64,${(await readFile(filePath)).toString('base64')}`
  return page.evaluate(async ({ dataUrl, sample }) => {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    return [...context.getImageData(Math.floor(canvas.width * sample.x), Math.floor(canvas.height * sample.y), 1, 1).data]
  }, { dataUrl, sample })
}

async function setRankingColor(page: Page, color: string) {
  await page.getByTestId('ranking-color-input').fill(color)
}

async function dragRankingColor(page: Page, colors: string[]) {
  await page.getByTestId('ranking-color-input').evaluate(async (input, values) => {
    const colorInput = input as HTMLInputElement
    for (const value of values) {
      colorInput.value = value
      colorInput.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise(requestAnimationFrame)
    }
    colorInput.dispatchEvent(new Event('change', { bubbles: true }))
  }, colors)
}

test('图片虚影跟随预测落点并在放下后成为真实位置', async ({ page }) => {
  await page.goto('/')
  const fixture = path.resolve('output/playwright/final-16-9.png')
  await page.getByTestId('file-input').setInputFiles([fixture, fixture, fixture])
  const queue = page.getByTestId('waiting-queue')
  const queueImages = queue.locator('[data-image-id]')
  const firstTierGrid = page.locator('.tier-grid-scroll').first()

  await startDrag(page, queueImages.first(), firstTierGrid)
  const placeholder = firstTierGrid.locator('.image-drop-placeholder')
  await expect(placeholder).toHaveCount(1)
  await expect(placeholder).toHaveAttribute('data-placeholder-index', '0')
  await expect(firstTierGrid.locator('.empty-drop-hint')).toHaveCount(0)
  await expect(queue.locator('.image-tile.is-origin')).toBeHidden()
  await expect(queue.locator('.image-drop-placeholder')).toHaveCount(0)
  await page.mouse.up()

  await expect(firstTierGrid.locator('[data-image-id]')).toHaveCount(1)
  await expect(page.locator('.image-drop-placeholder')).toHaveCount(0)

  await startDrag(page, queueImages.first(), firstTierGrid, { x: 0.02, y: 0.5 })
  await expect(firstTierGrid.locator('.image-drop-placeholder')).toHaveCount(1)
  await page.mouse.up()
  await expect(firstTierGrid.locator('[data-image-id]')).toHaveCount(2)
})

test('排行底色可调整、撤销并在刷新后恢复，图片槽位保持透明', async ({ page }) => {
  await page.goto('/')
  await dragRankingColor(page, ['#345678', '#234567', '#123456'])
  await expect(page.getByTestId('ranking-color-input')).toHaveValue('#123456')
  await expect(page.locator('.tier-grid-scroll').first()).toHaveCSS('background-color', 'rgb(18, 52, 86)')
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByTestId('ranking-color-input')).toHaveValue('#c8c8c8')
  await page.getByRole('button', { name: '重做' }).click()
  await expect(page.getByTestId('ranking-color-input')).toHaveValue('#123456')

  const redPng = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ff0000'
    context.fillRect(0, 0, 8, 8)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByTestId('file-input').setInputFiles({ name: 'transparent-slot.png', mimeType: 'image/png', buffer: Buffer.from(redPng, 'base64') })
  await expect(page.locator('.image-tile').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

  await page.getByRole('button', { name: '撤销' }).click()
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByTestId('ranking-color-input')).toHaveValue('#c8c8c8')
  await page.getByRole('button', { name: '重做' }).click()
  await expect(page.getByTestId('ranking-color-input')).toHaveValue('#123456')
  await page.waitForTimeout(300)
  await page.reload()
  await expect(page.getByTestId('ranking-color-input')).toHaveValue('#123456')
  await expect(page.locator('.tier-grid-scroll').first()).toHaveCSS('background-color', 'rgb(18, 52, 86)')
  await page.getByRole('button', { name: '恢复默认排行底色' }).click()
  await expect(page.getByTestId('ranking-color-input')).toHaveValue('#c8c8c8')
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByTestId('ranking-color-input')).toHaveValue('#123456')
  await page.getByRole('button', { name: '恢复初始设定' }).click()
  await expect(page.getByTestId('ranking-color-input')).toHaveValue('#c8c8c8')
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByTestId('ranking-color-input')).toHaveValue('#123456')
})

test('导出的 PNG 确实包含排行图片像素', async ({ page }) => {
  await page.goto('/')
  await setRankingColor(page, '#123456')
  await page.waitForTimeout(300)
  await page.reload()
  const redPng = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ff0000'
    context.fillRect(0, 0, 16, 16)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByTestId('file-input').setInputFiles({ name: 'red.png', mimeType: 'image/png', buffer: Buffer.from(redPng, 'base64') })
  const queueImage = page.locator('[data-container-id="queue"]').first()
  const tierGrid = page.locator('.tier-grid-scroll').first()
  await drag(page, queueImage, tierGrid)
  await expect(page.locator('.drag-preview')).toHaveCount(0)
  await page.waitForTimeout(200)

  const sample = await tierGrid.locator('[data-image-id]').first().evaluate((tile) => {
    const root = document.getElementById('ranking-export')!
    const rootRect = root.getBoundingClientRect()
    const tileRect = tile.getBoundingClientRect()
    return {
      x: (tileRect.left + tileRect.width / 2 - rootRect.left) / rootRect.width,
      y: (tileRect.top + tileRect.height / 2 - rootRect.top) / rootRect.height,
    }
  })

  await page.getByRole('button', { name: '导出 PNG' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出 2× PNG/ }).click()
  const download = await downloadPromise
  const downloadPath = await download.path()
  if (!downloadPath) throw new Error('无法读取导出的 PNG')
  const pixel = await readPngPixel(page, downloadPath, sample)
  expect(pixel[0]).toBeGreaterThan(240)
  expect(pixel[1]).toBeLessThan(20)
  expect(pixel[2]).toBeLessThan(20)
  expect(pixel[3]).toBe(255)
  const backgroundPixel = await readPngPixel(page, downloadPath, { x: 0.8, y: 0.9 })
  expect(backgroundPixel).toEqual([18, 52, 86, 255])

  await expect(page.getByRole('dialog')).toBeHidden()
  const fullSample = await tierGrid.locator('[data-image-id]').first().evaluate((tile) => {
    const root = document.getElementById('tier-board')!
    const rootRect = root.getBoundingClientRect()
    const tileRect = tile.getBoundingClientRect()
    return {
      x: (tileRect.left + tileRect.width / 2 - rootRect.left) / rootRect.width,
      y: (tileRect.top + tileRect.height / 2 - rootRect.top) / rootRect.height,
    }
  })
  await page.getByRole('button', { name: '导出 PNG' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('checkbox', { name: /包含等候区/ }).check()
  await page.getByRole('button', { name: '1×' }).click()
  const fullDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出 1× PNG/ }).click()
  const fullDownloadPath = await (await fullDownloadPromise).path()
  if (!fullDownloadPath) throw new Error('无法读取包含等候区的 PNG')
  const fullPixel = await readPngPixel(page, fullDownloadPath, fullSample)
  expect(fullPixel[0]).toBeGreaterThan(240)
  expect(fullPixel[1]).toBeLessThan(20)
  expect(fullPixel[2]).toBeLessThan(20)
  expect(fullPixel[3]).toBe(255)
})

test('上传、插入排序、层级操作、撤销与导出主流程', async ({ page }) => {
  await page.goto('/')
  const rows = page.locator('.tier-row')
  await expect(rows).toHaveCount(5)
  await expect(rows.nth(0)).toHaveAttribute('data-tier-name', '夯')
  await expect(rows.nth(4)).toHaveAttribute('data-tier-name', '拉完了')

  const fixture = path.resolve('output/playwright/final-16-9.png')
  await page.getByTestId('file-input').setInputFiles([fixture, fixture, fixture])
  const queueImages = page.locator('[data-container-id="queue"]')
  await expect(queueImages).toHaveCount(3)

  const imagePreview = page.getByTestId('image-zoom-overlay')
  await queueImages.first().dblclick()
  await expect(imagePreview).toBeVisible()
  await page.keyboard.press('Delete')
  await expect(imagePreview).toBeHidden()
  await expect(queueImages).toHaveCount(3)

  const tierGrid = page.getByTestId('tier-grid-夯')
  await drag(page, queueImages.nth(0), tierGrid)
  await expect(page.locator('[data-tier-name="夯"] [data-image-id]')).toHaveCount(1)
  await page.locator('[data-tier-name="夯"] [data-image-id]').first().dblclick()
  await expect(imagePreview).toBeVisible()
  await imagePreview.click({ position: { x: 8, y: 8 } })
  await expect(imagePreview).toBeHidden()
  await drag(page, queueImages.nth(0), page.locator('[data-tier-name="夯"] [data-image-id]').first(), { x: 0.08, y: 0.5 })
  await expect(page.locator('[data-tier-name="夯"] [data-image-id]')).toHaveCount(2)

  await drag(page, page.getByTestId('tier-header-人上人'), page.locator('[data-tier-name="顶级"]'), { x: 0.5, y: 0.15 })
  await expect(rows.nth(1)).toHaveAttribute('data-tier-name', '人上人')
  await page.getByTestId('tier-header-人上人').dblclick()
  const nameInput = page.getByLabel('层级名称')
  await nameInput.fill('超强')
  await nameInput.press('Enter')
  await expect(page.locator('[data-tier-name="超强"]')).toBeVisible()

  await drag(page, page.getByTestId('tier-header-夯'), page.getByTestId('trash-zone'))
  await expect(rows).toHaveCount(4)
  await expect(queueImages).toHaveCount(3)
  await expect(page.locator('.drag-preview')).toHaveCount(0)
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(rows).toHaveCount(5)
  await expect(queueImages).toHaveCount(1)

  await page.getByRole('button', { name: '导出 PNG' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出 2× PNG/ }).click()
  expect((await download).suggestedFilename()).toMatch(/从夯到拉-\d+\.png/)
})

test('长行图片拖出排行区域时不会带动来源行或留下移动残影', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')

  const fixture = path.resolve('output/playwright/final-16-9.png')
  await page.getByTestId('file-input').setInputFiles(Array.from({ length: 40 }, () => fixture))
  const queueImages = page.locator('[data-container-id="queue"]')
  const tierGrid = page.getByTestId('tier-grid-夯')
  await expect(queueImages).toHaveCount(40)

  for (let index = 0; index < 40; index += 1) await drag(page, queueImages.first(), tierGrid)

  const tierImages = page.locator('[data-tier-name="夯"] [data-image-id]')
  await expect(tierImages).toHaveCount(40)
  const overflow = await tierGrid.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
  expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth)
  await tierGrid.evaluate((element) => { element.scrollLeft = 0 })

  const source = tierImages.nth(0)
  const sibling = tierImages.nth(1)
  const sourceBefore = await source.boundingBox()
  const siblingBefore = await sibling.boundingBox()
  if (!sourceBefore || !siblingBefore) throw new Error('回归测试图片不可见')
  const idsBefore = await tierImages.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-image-id')))

  await page.mouse.move(sourceBefore.x + sourceBefore.width / 2, sourceBefore.y + sourceBefore.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBefore.x + sourceBefore.width / 2 + 12, sourceBefore.y + sourceBefore.height / 2, { steps: 3 })
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('无法读取测试视口')
  await page.mouse.move(viewport.width - 5, viewport.height - 5, { steps: 12 })
  await page.waitForTimeout(250)

  const scrollLeftDuringDrag = await tierGrid.evaluate((element) => element.scrollLeft)
  const sourceTransform = await source.evaluate((element) => getComputedStyle(element).transform)
  const sourceDuring = await source.boundingBox()
  const siblingDuring = await sibling.boundingBox()
  expect(scrollLeftDuringDrag).toBe(0)
  expect(sourceTransform).toBe('none')
  expect(sourceDuring?.x).toBeCloseTo(sourceBefore.x, 0)
  expect(sourceDuring?.y).toBeCloseTo(sourceBefore.y, 0)
  expect(siblingDuring?.x).toBeCloseTo(siblingBefore.x, 0)
  expect(siblingDuring?.y).toBeCloseTo(siblingBefore.y, 0)

  await page.mouse.up()
  await page.waitForTimeout(200)
  const idsAfter = await tierImages.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-image-id')))
  expect(idsAfter).toEqual(idsBefore)
  expect(await tierGrid.evaluate((element) => element.scrollLeft)).toBe(0)
  await expect(page.locator('.drag-preview')).toHaveCount(0)
})
