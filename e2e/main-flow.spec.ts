import { expect, test, type Locator, type Page } from '@playwright/test'
import path from 'node:path'

async function drag(page: Page, source: Locator, target: Locator, offset = { x: 0.5, y: 0.5 }) {
  const from = await source.boundingBox(); const to = await target.boundingBox()
  if (!from || !to) throw new Error('拖拽元素不可见')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 3 })
  await page.mouse.move(to.x + to.width * offset.x, to.y + to.height * offset.y, { steps: 10 })
  await page.mouse.up()
}

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
