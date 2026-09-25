const NAME_CHARS_PER_VISUAL_LINE = 22
const NOTE_CHARS_PER_VISUAL_LINE = 28
const NOTE_LINE_WEIGHT = 0.75

const cleanSpaces = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')

export const formatKitchenDisplayItemName = (item) => {
  const name = cleanSpaces(item?.name || 'Item')
  const size = cleanSpaces(item?.size)
  if (!size) return name
  const normalizedName = name.toLocaleLowerCase('pt-BR')
  const normalizedSize = size.toLocaleLowerCase('pt-BR')
  return normalizedName === normalizedSize || normalizedName.endsWith(` ${normalizedSize}`) ? name : `${name} ${size}`
}

export const normalizeKitchenItemNote = (item) => cleanSpaces(item?.note)

const countVisualLines = (item) => {
  const nameLines = Math.max(1, Math.ceil(formatKitchenDisplayItemName(item).length / NAME_CHARS_PER_VISUAL_LINE))
  const note = normalizeKitchenItemNote(item)
  const noteLines = note ? Math.max(1, Math.ceil(note.length / NOTE_CHARS_PER_VISUAL_LINE)) : 0
  return nameLines + noteLines * NOTE_LINE_WEIGHT
}

export function getKitchenCardContentMetrics(items = []) {
  const safeItems = Array.isArray(items) ? items : []
  const visualLines = safeItems.reduce((total, item) => total + countVisualLines(item), 0)
  const itemCount = safeItems.length
  const density = visualLines >= 10 || itemCount >= 8
    ? 'dense'
    : visualLines >= 5 || itemCount >= 5
      ? 'compact'
      : 'comfortable'

  return {
    itemCount,
    visualLines,
    density,
    layoutDemand: density === 'dense' ? 'tall' : 'normal',
  }
}
