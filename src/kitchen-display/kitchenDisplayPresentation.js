import { buildKitchenQueueModel } from '../domains/orders/index.js'
import { packKitchenDisplaySlots, positionKitchenDisplayGrid } from './kitchenDisplayContentLayout.js'

export const KITCHEN_TV_NEAR_LIMIT_MINUTES = 5
const KITCHEN_TV_SLOT_LIMIT = 6
const KITCHEN_TV_PREPARING_LIMIT_WITH_SCHEDULED = 5

const toIdSet = (value) => value instanceof Set ? value : new Set(value || [])

const presentationState = (entry, now, highlightedIds) => {
  if (highlightedIds.has(String(entry.order.id))) return 'new'
  if (entry.timingState === 'late' || entry.timingState === 'very-late') return 'late'
  const millisecondsToLimit = entry.lateAt instanceof Date ? entry.lateAt.getTime() - now.getTime() : Number.POSITIVE_INFINITY
  if (entry.phase === 'preparing' && entry.timingState === 'on-time' && millisecondsToLimit <= KITCHEN_TV_NEAR_LIMIT_MINUTES * 60_000) return 'near-limit'
  return entry.phase === 'scheduled' ? 'scheduled' : 'preparing'
}

const allocateVisibleCards = (queue, viewportHeight) => {
  if (!queue.scheduled.length) {
    return packKitchenDisplaySlots(queue.preparing, { maxSlots: KITCHEN_TV_SLOT_LIMIT, viewportHeight }).cards
  }

  const [protectedScheduled, ...additionalScheduled] = queue.scheduled
  const protectedPack = packKitchenDisplaySlots([protectedScheduled], { maxSlots: KITCHEN_TV_SLOT_LIMIT, viewportHeight })
  const protectedCard = protectedPack.cards[0]
  const protectedCost = protectedCard?.slotCost ?? 1
  const preparingCandidates = queue.preparing.slice(0, KITCHEN_TV_PREPARING_LIMIT_WITH_SCHEDULED)
  const preparingPack = packKitchenDisplaySlots(preparingCandidates, {
    maxSlots: KITCHEN_TV_SLOT_LIMIT - protectedCost,
    viewportHeight,
  })

  const scheduledCards = protectedCard ? [protectedCard] : []
  let usedSlots = preparingPack.usedSlots + protectedCost

  const noPreparingCandidateWasBlocked = preparingPack.cards.length === preparingCandidates.length
  if (noPreparingCandidateWasBlocked && usedSlots < KITCHEN_TV_SLOT_LIMIT && additionalScheduled.length) {
    const additionalPack = packKitchenDisplaySlots(additionalScheduled, {
      maxSlots: KITCHEN_TV_SLOT_LIMIT - usedSlots,
      viewportHeight,
    })
    scheduledCards.push(...additionalPack.cards)
    usedSlots += additionalPack.usedSlots
  }

  return [...preparingPack.cards, ...scheduledCards]
}

export function buildKitchenDisplayPresentation(orders = [], timing, now = new Date(), highlightedIds = new Set(), { viewportHeight } = {}) {
  const queue = buildKitchenQueueModel(orders, now, '', timing)
  const highlighted = toIdSet(highlightedIds)
  const visible = positionKitchenDisplayGrid(allocateVisibleCards(queue, viewportHeight))

  return {
    cards: visible.map((entry) => ({ ...entry, state: presentationState(entry, now, highlighted) })),
    counts: { preparing: queue.counts.preparing, late: queue.counts.late, scheduled: queue.counts.scheduled },
    overflow: Math.max(0, queue.totalVisible - visible.length),
  }
}
