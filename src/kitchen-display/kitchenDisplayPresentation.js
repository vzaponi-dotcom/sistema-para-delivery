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
  if (!queue.scheduled.length) {
    return {
      profile,
      cards: packForProfile(queue.preparing, profile, viewportWidth, viewportHeight).cards,
    }
  }

  const [protectedScheduled, ...additionalScheduled] = queue.scheduled
  const preparingCards = []
  let preparingBlocked = false

  for (const candidate of queue.preparing) {
    const trialEntries = [...preparingCards, candidate, protectedScheduled]
    const trial = packForProfile(trialEntries, profile, viewportWidth, viewportHeight)
    if (trial.cards.length !== trialEntries.length) {
      preparingBlocked = true
      break
    }
    preparingCards.push(candidate)
  }

  const selected = [...preparingCards, protectedScheduled]

  if (!preparingBlocked) {
    for (const candidate of additionalScheduled) {
      const trialEntries = [...selected, candidate]
      const trial = packForProfile(trialEntries, profile, viewportWidth, viewportHeight)
      if (trial.cards.length !== trialEntries.length) break
      selected.push(candidate)
    }
  }

  return {
    profile,
    cards: packForProfile(selected, profile, viewportWidth, viewportHeight).cards,
  }
}

const allocateVisibleCards = (queue, { viewportWidth, viewportHeight } = {}) => {
  const candidates = resolveKitchenBoardCandidates({ viewportWidth, viewportHeight })
  const allocations = candidates.map((profile) => allocateForProfile(queue, profile, viewportWidth, viewportHeight))

  const complete = allocations.find(({ cards }) => cards.length === queue.totalVisible)
  if (complete) return complete

  return allocations.reduce((best, candidate) => (
    candidate.cards.length > best.cards.length ? candidate : best
  ), allocations[0])
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
  const visible = positionKitchenDisplayGrid(allocation.cards, { boardProfile: allocation.profile })

  return {
    profile: allocation.profile,
    cards: visible.map((entry) => ({ ...entry, state: presentationState(entry, now, highlighted) })),
    counts: { preparing: queue.counts.preparing, late: queue.counts.late, scheduled: queue.counts.scheduled },
    overflow: Math.max(0, queue.totalVisible - visible.length),
  }
}
