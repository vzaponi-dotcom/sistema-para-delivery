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

const normalizedSlotCeiling = (value) => {
  const parsed = Math.trunc(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6
}

export function packKitchenDisplaySlots(entries = [], { maxSlots = 6 } = {}) {
  const source = Array.isArray(entries) ? entries : []
  const slotCeiling = normalizedSlotCeiling(maxSlots)
  const cards = []
  let usedSlots = 0

  for (const entry of source) {
    const metrics = getKitchenCardContentMetrics(entry?.order?.items)
    const slotCost = metrics.layoutDemand === 'tall' ? 2 : 1
    if (usedSlots + slotCost > slotCeiling) break

    cards.push({
      ...entry,
      contentMetrics: metrics,
      layoutDemand: metrics.layoutDemand,
      slotCost,
    })
    usedSlots += slotCost
  }

  return {
    cards,
    usedSlots,
    remainingSlots: slotCeiling - usedSlots,
    overflow: Math.max(0, source.length - cards.length),
  }
}

export function positionKitchenDisplayGrid(cards = []) {
  const source = Array.isArray(cards) ? cards : []
  const tallCards = source.filter((card) => card?.layoutDemand === 'tall')
  const normalCards = source.filter((card) => card?.layoutDemand !== 'tall')
  const placement = new Map()

  tallCards.slice(0, 3).forEach((card, index) => {
    placement.set(card, { gridColumn: index + 1, gridRow: '1 / span 2' })
  })

  const normalColumns = [1, 2, 3].slice(Math.min(3, tallCards.length))
  normalCards.forEach((card, index) => {
    if (!normalColumns.length) return
    const rowIndex = Math.floor(index / normalColumns.length)
    placement.set(card, {
      gridColumn: normalColumns[index % normalColumns.length],
      gridRow: Math.min(2, rowIndex + 1),
    })
  })

  return source.map((card) => ({
    ...card,
    gridPosition: placement.get(card) ?? { gridColumn: 1, gridRow: 1 },
  }))
}
