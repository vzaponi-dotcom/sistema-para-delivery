import { buildKitchenQueueModel } from '../domains/orders/index.js'
import {
  packKitchenDisplaySlots,
  positionKitchenDisplayGrid,
  resolveKitchenBoardCandidates,
} from './kitchenDisplayContentLayout.js'

export const KITCHEN_TV_NEAR_LIMIT_MINUTES = 5

const toIdSet = (value) => value instanceof Set ? value : new Set(value || [])

const presentationState = (entry, now, highlightedIds) => {
  if (highlightedIds.has(String(entry.order.id))) return 'new'
  if (entry.timingState === 'late' || entry.timingState === 'very-late') return 'late'
  const millisecondsToLimit = entry.lateAt instanceof Date ? entry.lateAt.getTime() - now.getTime() : Number.POSITIVE_INFINITY
  if (entry.phase === 'preparing' && entry.timingState === 'on-time' && millisecondsToLimit <= KITCHEN_TV_NEAR_LIMIT_MINUTES * 60_000) return 'near-limit'
  return entry.phase === 'scheduled' ? 'scheduled' : 'preparing'
}

const packForProfile = (entries, profile, viewportWidth, viewportHeight) => packKitchenDisplaySlots(entries, {
  maxSlots: profile.maxSlots,
  viewportWidth,
  viewportHeight,
  boardProfile: profile,
})

const allocateForProfile = (queue, profile, viewportWidth, viewportHeight) => {
  const preparing = packForProfile(queue.preparing, profile, viewportWidth, viewportHeight)

  // Waiting scheduled orders never displace work that is already in preparation.
  // They can use only genuine leftover capacity after the complete preparing
  // queue fits. Once a scheduled order reaches its preparation window, the
  // domain queue promotes it to phase=preparing and it receives normal priority.
  if (preparing.cards.length !== queue.preparing.length || !queue.scheduled.length) {
    return {
      profile,
      cards: preparing.cards,
    }
  }

  const selected = [...queue.preparing]
  for (const candidate of queue.scheduled) {
    const trialEntries = [...selected, candidate]
    const trial = packForProfile(trialEntries, profile, viewportWidth, viewportHeight)
    if (trial.cards.length !== trialEntries.length) break
    selected.push(candidate)
  }

  return {
    profile,
    cards: packForProfile(selected, profile, viewportWidth, viewportHeight).cards,
  }
}

const preparingPriorityPrefixLength = (cards, preparing) => {
  const visibleIds = new Set(cards.map(({ order }) => String(order.id)))
  let length = 0
  for (const entry of preparing) {
    if (!visibleIds.has(String(entry.order.id))) break
    length += 1
  }
  return length
}

const allocateVisibleCards = (queue, { viewportWidth, viewportHeight } = {}) => {
  const candidates = resolveKitchenBoardCandidates({ viewportWidth, viewportHeight, queueSize: queue.totalVisible })
  const allocations = candidates.map((profile) => allocateForProfile(queue, profile, viewportWidth, viewportHeight))

  const complete = allocations.find(({ cards }) => cards.length === queue.totalVisible)
  if (complete) return complete

  return allocations.reduce((best, candidate) => {
    const bestPriorityPrefix = preparingPriorityPrefixLength(best.cards, queue.preparing)
    const candidatePriorityPrefix = preparingPriorityPrefixLength(candidate.cards, queue.preparing)
    if (candidatePriorityPrefix !== bestPriorityPrefix) {
      return candidatePriorityPrefix > bestPriorityPrefix ? candidate : best
    }
    return candidate.cards.length > best.cards.length ? candidate : best
  }, allocations[0])
}

export function buildKitchenDisplayPresentation(
  orders = [],
  timing,
  now = new Date(),
  highlightedIds = new Set(),
  { viewportWidth, viewportHeight } = {},
) {
  const queue = buildKitchenQueueModel(orders, now, '', timing)
  const highlighted = toIdSet(highlightedIds)
  const allocation = allocateVisibleCards(queue, { viewportWidth, viewportHeight })
  const visible = positionKitchenDisplayGrid(allocation.cards, { boardProfile: allocation.profile, fillAvailable: true })

  return {
    profile: allocation.profile,
    cards: visible.map((entry) => ({ ...entry, state: presentationState(entry, now, highlighted) })),
    counts: { preparing: queue.counts.preparing, late: queue.counts.late, scheduled: queue.counts.scheduled },
    overflow: Math.max(0, queue.totalVisible - visible.length),
  }
}


export function buildKitchenDisplayPages(
  orders = [],
  timing,
  now = new Date(),
  highlightedIds = new Set(),
  { viewportWidth, viewportHeight } = {},
) {
  const queue = buildKitchenQueueModel(orders, now, '', timing)
  const globalCounts = {
    preparing: queue.counts.preparing,
    late: queue.counts.late,
    scheduled: queue.counts.scheduled,
  }
  let remainingOrders = [...queue.preparing, ...queue.scheduled].map(({ order }) => order)
  const totalVisible = remainingOrders.length
  const pages = []
  const unrenderableOrderIds = []

  while (remainingOrders.length) {
    const presentation = buildKitchenDisplayPresentation(
      remainingOrders,
      timing,
      now,
      highlightedIds,
      { viewportWidth, viewportHeight },
    )
    const visibleIds = new Set(presentation.cards.map(({ order }) => String(order.id)))

    if (!visibleIds.size) {
      unrenderableOrderIds.push(...remainingOrders.map(({ id }) => String(id)))
      break
    }

    pages.push({
      ...presentation,
      counts: { ...globalCounts },
    })
    remainingOrders = remainingOrders.filter(({ id }) => !visibleIds.has(String(id)))
  }

  return {
    pages,
    totalVisible,
    unrenderableOrderIds,
  }
}
