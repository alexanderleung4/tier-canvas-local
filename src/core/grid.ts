export interface GridLayout { rows: number; columns: number; slotSize: number; overflow: boolean; contentWidth: number }

export function calculateGrid(height: number, width: number, count: number, minSlot = 40, gap = 4): GridLayout {
  const safeHeight = Math.max(1, height); const safeWidth = Math.max(1, width)
  const maxRows = Math.max(1, Math.floor((safeHeight + gap) / (minSlot + gap)))
  for (let rows = 1; rows <= maxRows; rows += 1) {
    const slotSize = (safeHeight - gap * (rows - 1)) / rows
    const columns = Math.max(1, Math.floor((safeWidth + gap) / (slotSize + gap)))
    if (columns * rows >= Math.max(1, count)) return { rows, columns, slotSize, overflow: false, contentWidth: safeWidth }
  }
  const rows = maxRows
  const slotSize = Math.max(minSlot, (safeHeight - gap * (rows - 1)) / rows)
  const columns = Math.max(1, Math.floor((safeWidth + gap) / (slotSize + gap)))
  const neededColumns = Math.max(columns, Math.ceil(Math.max(1, count) / rows))
  return { rows, columns, slotSize, overflow: count > columns * rows, contentWidth: neededColumns * slotSize + Math.max(0, neededColumns - 1) * gap }
}
