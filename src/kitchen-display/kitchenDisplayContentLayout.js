const NAME_CHARS_PER_VISUAL_LINE = 22
const NOTE_CHARS_PER_VISUAL_LINE = 28
const NOTE_LINE_WEIGHT = 0.75

const VIEWPORT_LINE_CAPACITY = Object.freeze({
  spacious: Object.freeze({ normal: 9, tall: 22 }),
  standard: Object.freeze({ normal: 7, tall: 17 }),
  constrained: Object.freeze({ normal: 6, tall: 14 }),
})

const BOARD_LINE_CAPACITY = Object.freeze({
  focus: VIEWPORT_LINE_CAPACITY,
  balanced: Object.freeze({
    spacious: Object.freeze({ normal: 7, tall: 18 }),
    standard: Object.freeze({ normal: 6, tall: 15 }),
    constrained: Object.freeze({ normal: 5, tall: 12 }),
  }),
  compact: Object.freeze({
    spacious: Object.freeze({ normal: 5, tall: 11, full: 19 }),
    standard: Object.freeze({ normal: 4, tall: 9, full: 16 }),
    constrained: Object.freeze({ normal: 3, tall: 7, full: 12 }),
  }),
})

const KITCHEN_BOARD_PROFILES = Object.freeze({
  focus: Object.freeze({ id: 'focus', columns: 3, rows: 2, gridRows: 6, maxSlots: 18 }),
  balanced: Object.freeze({ id: 'balanced', columns: 4, rows: 2, gridRows: 8, maxSlots: 32 }),
  compact: Object.freeze({ id: 'compact', columns: 4, rows: 3, gridRows: 12, maxSlots: 48 }),
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

const normalizeBoardProfile = (value) => {
  const id = typeof value === 'string' ? value : value?.id
  return KITCHEN_BOARD_PROFILES[id] || KITCHEN_BOARD_PROFILES.focus
}

export function resolveKitchenBoardProfile({ viewportWidth, viewportHeight, queueSize = 0 } = {}) {
  const width = Math.trunc(Number(viewportWidth))
  const height = Math.trunc(Number(viewportHeight))
  const count = Math.max(0, Math.trunc(Number(queueSize)) || 0)
  const hasViewport = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0

  if (!hasViewport || count <= 4) return { ...KITCHEN_BOARD_PROFILES.focus }
  if (count >= 9 && width >= 1440 && height >= 820) return { ...KITCHEN_BOARD_PROFILES.compact }
  if (width >= 1100 && height >= 620) return { ...KITCHEN_BOARD_PROFILES.balanced }
  return { ...KITCHEN_BOARD_PROFILES.focus }
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

const resolveFitStrategy = ({ visualLines, twoColumnVisualLines, viewportProfile, boardProfile }) => {
  const profile = normalizeBoardProfile(boardProfile)
  const profileCapacity = BOARD_LINE_CAPACITY[profile.id] || VIEWPORT_LINE_CAPACITY
  const capacity = profileCapacity[viewportProfile] || profileCapacity.standard || VIEWPORT_LINE_CAPACITY.standard

  if (visualLines <= capacity.normal) {
    return { layoutDemand: 'normal', rowSpan: 1, columnCount: 1, fitStrategy: 'normal-one-column', capacity, profile }
  }
  if (twoColumnVisualLines <= capacity.normal) {
    return { layoutDemand: 'normal', rowSpan: 1, columnCount: 2, fitStrategy: 'normal-two-columns', capacity, profile }
  }
  if (profile.rows >= 2 && visualLines <= capacity.tall) {
    return { layoutDemand: 'tall', rowSpan: 2, columnCount: 1, fitStrategy: 'tall-one-column', capacity, profile }
  }
  if (profile.rows >= 2 && twoColumnVisualLines <= capacity.tall) {
    return { layoutDemand: 'tall', rowSpan: 2, columnCount: 2, fitStrategy: 'tall-two-columns', capacity, profile }
  }
  if (profile.rows >= 3) {
    const fullCapacity = capacity.full ?? capacity.tall * 1.65
    if (visualLines <= fullCapacity) {
      return {
        layoutDemand: 'full',
        rowSpan: 3,
        columnCount: 1,
        fitStrategy: 'full-one-column',
        capacity: { ...capacity, full: fullCapacity },
        profile,
      }
    }
    return {
      layoutDemand: 'full',
      rowSpan: 3,
      columnCount: 2,
      fitStrategy: 'full-two-columns',
      capacity: { ...capacity, full: fullCapacity },
      profile,
      overflowRisk: twoColumnVisualLines > fullCapacity,
    }
  }
  return {
    layoutDemand: 'tall',
    rowSpan: 2,
    columnCount: 2,
    fitStrategy: 'tall-two-columns',
    capacity,
    profile,
    overflowRisk: twoColumnVisualLines > capacity.tall,
  }
}

const resolveGridSpan = ({ profile, visualLines, twoColumnVisualLines, density, layoutDemand, overflowRisk }) => {
  if (profile.id === 'focus') return layoutDemand === 'normal' ? 3 : 6
  if (profile.id === 'balanced') return layoutDemand === 'normal' ? 4 : 8

  if (layoutDemand === 'full') return overflowRisk ? 12 : 9
  if (layoutDemand === 'tall') return 6
  if (density === 'comfortable' && Math.min(visualLines, twoColumnVisualLines || visualLines) <= 3) return 3
  return 4
}

export function getKitchenCardContentMetrics(items = [], { viewportHeight, boardProfile } = {}) {
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
  const fit = resolveFitStrategy({ visualLines, twoColumnVisualLines, viewportProfile, boardProfile })
  const gridSpan = resolveGridSpan({
    profile: fit.profile,
    visualLines,
    twoColumnVisualLines,
    density,
    layoutDemand: fit.layoutDemand,
    overflowRisk: fit.overflowRisk === true,
  })

  return {
    itemCount,
    visualLines,
    twoColumnVisualLines,
    density,
    viewportProfile,
    boardProfile: fit.profile.id,
    layoutDemand: fit.layoutDemand,
    rowSpan: fit.rowSpan,
    gridSpan,
    columnCount: fit.columnCount,
    fitStrategy: fit.fitStrategy,
    normalLineCapacity: fit.capacity.normal,
    tallLineCapacity: fit.capacity.tall,
    fullLineCapacity: fit.capacity.full ?? null,
    overflowRisk: fit.overflowRisk === true,
  }
}

const normalizedSlotCeiling = (value, fallback = 6) => {
  const parsed = Math.trunc(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const cardGridSpan = (card, profile, boardProfileProvided) => {
  if (!boardProfileProvided) {
    return Math.min(
      Math.max(1, Math.trunc(Number(card?.rowSpan ?? card?.contentMetrics?.rowSpan ?? (card?.layoutDemand === 'tall' ? 2 : 1))) || 1),
      Math.max(1, profile.rows),
    )
  }
  return Math.min(
    Math.max(1, Math.trunc(Number(card?.gridSpan ?? card?.contentMetrics?.gridSpan)) || 1),
    Math.max(1, profile.gridRows),
  )
}

const assignKitchenGrid = (cards, boardProfile, boardProfileProvided = true) => {
  const profile = normalizeBoardProfile(boardProfile)
  const source = Array.isArray(cards) ? cards : []
  const rowCount = boardProfileProvided ? profile.gridRows : profile.rows
  const occupancy = Array.from({ length: rowCount }, () => Array(profile.columns).fill(false))
  const placements = new Array(source.length)

  for (let index = 0; index < source.length; index += 1) {
    const span = cardGridSpan(source[index], profile, boardProfileProvided)
    let placed = false

    for (let row = 0; row <= rowCount - span && !placed; row += 1) {
      for (let column = 0; column < profile.columns; column += 1) {
        let available = true
        for (let offset = 0; offset < span; offset += 1) {
          if (occupancy[row + offset][column]) {
            available = false
            break
          }
        }
        if (!available) continue

        for (let offset = 0; offset < span; offset += 1) occupancy[row + offset][column] = true
        placements[index] = {
          gridColumn: column + 1,
          gridRow: span > 1 ? `${row + 1} / span ${span}` : row + 1,
          rowSpan: span,
        }
        placed = true
        break
      }
    }

    if (!placed) return null
  }

  return placements
}

export function packKitchenDisplaySlots(entries = [], { maxSlots, viewportHeight, boardProfile } = {}) {
  const source = Array.isArray(entries) ? entries : []
  const profile = normalizeBoardProfile(boardProfile)
  const hasBoardProfile = Boolean(boardProfile)
  const slotCeiling = normalizedSlotCeiling(maxSlots, hasBoardProfile ? profile.maxSlots : 6)
  const cards = []
  let usedSlots = 0

  for (const entry of source) {
    const metrics = getKitchenCardContentMetrics(entry?.order?.items, { viewportHeight, boardProfile })
    const slotCost = hasBoardProfile ? metrics.gridSpan : metrics.rowSpan
    if (usedSlots + slotCost > slotCeiling) break

    const candidate = {
      ...entry,
      contentMetrics: metrics,
      layoutDemand: metrics.layoutDemand,
      rowSpan: metrics.rowSpan,
      gridSpan: metrics.gridSpan,
      slotCost,
    }
    if (hasBoardProfile && !assignKitchenGrid([...cards, candidate], profile, true)) break

    cards.push(candidate)
    usedSlots += slotCost
  }

  return {
    cards,
    usedSlots,
    remainingSlots: slotCeiling - usedSlots,
    overflow: Math.max(0, source.length - cards.length),
  }
}

export function positionKitchenDisplayGrid(cards = [], { boardProfile } = {}) {
  const source = Array.isArray(cards) ? cards : []
  const profile = normalizeBoardProfile(boardProfile)
  const hasBoardProfile = Boolean(boardProfile)
  const placement = assignKitchenGrid(source, profile, hasBoardProfile)

  if (!placement) return source.map((card) => ({
    ...card,
    gridPosition: { gridColumn: 1, gridRow: 1, rowSpan: cardGridSpan(card, profile, hasBoardProfile) },
  }))

  return source.map((card, index) => ({
    ...card,
    gridPosition: placement[index],
  }))
}
