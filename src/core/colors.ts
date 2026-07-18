const ANCHORS = ['#D94B3D', '#F2C84B', '#FFF44F', '#F6EED3', '#FFFFFF']
const hexToRgb = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0').toUpperCase()

export function tierColor(index: number, total: number): string {
  if (total <= 1) return ANCHORS[0]
  const t = Math.max(0, Math.min(1, index / (total - 1)))
  const position = t * (ANCHORS.length - 1)
  const left = Math.floor(position)
  const right = Math.min(ANCHORS.length - 1, left + 1)
  const mix = position - left
  const a = hexToRgb(ANCHORS[left]); const b = hexToRgb(ANCHORS[right])
  return `#${a.map((value, channel) => toHex(value + (b[channel] - value) * mix)).join('')}`
}

export function rankingContrastColors(hex: string) {
  const [red, green, blue] = hexToRgb(hex).map((value) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  const dark = luminance < 0.34
  return {
    divider: dark ? 'rgba(255,255,255,.30)' : 'rgba(0,0,0,.38)',
    hint: dark ? 'rgba(255,255,255,.62)' : 'rgba(17,24,28,.55)',
    hover: dark ? 'rgba(255,255,255,.34)' : 'rgba(0,0,0,.28)',
  }
}
