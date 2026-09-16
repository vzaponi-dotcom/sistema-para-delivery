import { hasCapability } from '../access.js'
import {
  AREA_DESTINATION_IDS,
  HOME_AREA_ORDER,
  MOBILE_SECTION_IDS,
  NAVIGATION_DESTINATIONS,
  destinationById,
} from './registry.js'

const canAccess = (destination, granted) => destination.capability
  ? hasCapability(granted, destination.capability)
  : destination.anyCapability.some((key) => hasCapability(granted, key))

export function resolveDestination(id, granted, implemented) {
  const destination = destinationById.get(id)
  if (!destination) return { status: 'unknown' }
  if (!canAccess(destination, granted)) return { status: 'denied' }
  if (!(implemented instanceof Set) || !implemented.has(id)) return { status: 'unavailable' }
  return { status: 'allowed', id }
}

export function resolveArea(area, granted, implemented) {
  for (const id of AREA_DESTINATION_IDS[area] || []) {
    if (resolveDestination(id, granted, implemented).status === 'allowed') return id
  }
  return null
}

export function resolveHome(granted, implemented) {
  for (const area of HOME_AREA_ORDER) {
    const id = resolveArea(area, granted, implemented)
    if (id) return id
  }
  for (const { id } of NAVIGATION_DESTINATIONS) {
    if (id !== 'new-order' && resolveDestination(id, granted, implemented).status === 'allowed') return id
  }
  return null
}

export function resolveNavigationEntry(entry, granted, implemented) {
  const id = entry.area
    ? resolveArea(entry.area, granted, implemented)
    : resolveDestination(entry.id, granted, implemented).status === 'allowed'
      ? entry.id
      : null
  return id ? { ...entry, id, label: entry.label || destinationById.get(id)?.label } : null
}

export function decideNavigation({ allowed, checkoutPending, dirtyOrder, leavingOrder }) {
  if (!allowed) return 'reject'
  if (checkoutPending) return 'blocked'
  if (dirtyOrder && leavingOrder) return 'confirm'
  return 'navigate'
}

export function getMobilePageDirection(previousId, activeId) {
  const previousIndex = MOBILE_SECTION_IDS.indexOf(previousId)
  const activeIndex = MOBILE_SECTION_IDS.indexOf(activeId)
  if (previousId === activeId || previousIndex < 0 || activeIndex < 0) return 'none'
  return activeIndex > previousIndex ? 'forward' : 'backward'
}
