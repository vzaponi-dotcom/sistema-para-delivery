export const MOBILE_SECTION_IDS = Object.freeze([
  'dashboard',
  'orders',
  'clients',
  'products',
  'receivables',
  'finance',
])

export const getAdjacentMobileSection = (activeTab, direction) => {
  const currentIndex = MOBILE_SECTION_IDS.indexOf(activeTab)
  if (currentIndex < 0) return activeTab
  const offset = direction === 'next' ? 1 : direction === 'previous' ? -1 : 0
  const nextIndex = Math.min(MOBILE_SECTION_IDS.length - 1, Math.max(0, currentIndex + offset))
  return MOBILE_SECTION_IDS[nextIndex]
}

export const getSwipeDirection = ({
  deltaX,
  deltaY,
  durationMs = Number.POSITIVE_INFINITY,
  threshold = 44,
  flickThreshold = 28,
  maxFlickDuration = 220,
}) => {
  const horizontalDistance = Math.abs(deltaX)
  const verticalDistance = Math.abs(deltaY)
  if (horizontalDistance <= verticalDistance) return null

  const crossedDistanceThreshold = horizontalDistance >= threshold
  const isQuickFlick = horizontalDistance >= flickThreshold && durationMs <= maxFlickDuration
  if (!crossedDistanceThreshold && !isQuickFlick) return null

  return deltaX < 0 ? 'next' : 'previous'
}

export const shouldIgnoreNavigationSwipe = (target) => {
  if (!target) return false
  const tagName = String(target.tagName || '').toLowerCase()
  if (['input', 'textarea', 'button', 'a', 'select'].includes(tagName)) return true
  if (typeof target.closest !== 'function') return false
  return Boolean(target.closest('[role="dialog"], [role="listbox"], [data-horizontal-interaction], [data-navigation-swipe-block]'))
}
