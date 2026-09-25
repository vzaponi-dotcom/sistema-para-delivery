const NAME_CHARS_PER_VISUAL_LINE = 22
const NOTE_CHARS_PER_VISUAL_LINE = 28
const NOTE_LINE_WEIGHT = 0.75

const VIEWPORT_LINE_CAPACITY = Object.freeze({
  spacious: Object.freeze({ normal: 9, tall: 22 }),
  standard: Object.freeze({ normal: 7, tall: 17 }),
  constrained: Object.freeze({ normal: 6, tall: 14 }),
})

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

export function resolveKitchenViewportProfile(viewportHeight) {
  const height = Math.trunc(Number(viewportHeight))
  if (!Number.isFinite(height) || height <= 0) return 'standard'
  if (height >= 900) return 'spacious'
  if (height <= 640) return 'constrained'
  return 'standard'
}

const countTwoColumnVisualLines = (lineHeights) => {
  let total = 0
  for (let index = 0; index < lineHeights.length; index += 2) {
    total += Math.max(lineHeights[index] || 0, lineHeights[index + 1] || 0)
  }
  return total
}

const resolveFitStrategy = ({ visualLines, twoColumnVisualLines, viewportProfile }) => {
  const capacity = VIEWPORT_LINE_CAPACITY[viewportProfile] || VIEWPORT_LINE_CAPACITY.standard
  if (visualLines <= capacity.normal) {
    return { layoutDemand: 'normal', columnCount: 1, fitStrategy: 'normal-one-column', capacity }
  }
  if (twoColumnVisualLines <= capacity.normal) {
    return { layoutDemand: 'normal', columnCount: 2, fitStrategy: 'normal-two-columns', capacity }
  }
  if (visualLines <= capacity.tall) {
    return { layoutDemand: 'tall', columnCount: 1, fitStrategy: 'tall-one-column', capacity }
  }
  return { layoutDemand: 'tall', columnCount: 2, fitStrategy: 'tall-two-columns', capacity }
}

export function getKitchenCardContentMetrics(items = [], { viewportHeight } = {}) {
  const safeItems = Array.isArray(items) ? items : []
  const itemLineHeights = safeItems.map(countVisualLines)
  const visualLines = itemLineHeights.reduce((total, lines) => total + lines, 0)
  const twoColumnVisualLines = countTwoColumnVisualLines(itemLineHeights)
  const itemCount = safeItems.length
  const density = visualLines >= 10 || itemCount >= 8
    ? 'dense'
    : visualLines >= 5 || itemCount >= 5
      ? 'compact'
      : 'comfortable'
  const viewportProfile = resolveKitchenViewportProfile(viewportHeight)
  const fit = resolveFitStrategy({ visualLines, twoColumnVisualLines, viewportProfile })

  return {
    itemCount,
    visualLines,
    twoColumnVisualLines,
    density,
    viewportProfile,
    layoutDemand: fit.layoutDemand,
    columnCount: fit.columnCount,
    fitStrategy: fit.fitStrategy,
    normalLineCapacity: fit.capacity.normal,
    tallLineCapacity: fit.capacity.tall,
  }
}

const normalizedSlotCeiling = (value) => {
  const parsed = Math.trunc(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6
}

export function packKitchenDisplaySlots(entries = [], { maxSlots = 6, viewportHeight } = {}) {
  const source = Array.isArray(entries) ? entries : []
  const slotCeiling = normalizedSlotCeiling(maxSlots)
  const cards = []
  let usedSlots = 0

  for (const entry of source) {
    const metrics = getKitchenCardContentMetrics(entry?.order?.items, { viewportHeight })
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
