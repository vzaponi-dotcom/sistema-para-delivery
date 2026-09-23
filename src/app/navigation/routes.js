import { NAVIGATION_DESTINATIONS, destinationById } from './registry.js'

const destinationByPath = new Map(
  NAVIGATION_DESTINATIONS.map((destination) => [destination.path, destination]),
)

const normalizePathname = (value) => {
  if (typeof value !== 'string') return null
  let pathname = value.trim()
  if (!pathname.startsWith('/')) return null
  const suffixIndex = pathname.search(/[?#]/)
  if (suffixIndex >= 0) pathname = pathname.slice(0, suffixIndex)
  pathname = pathname.replace(/\/+$/, '') || '/'
  return pathname
}

export function pathForDestination(id) {
  return destinationById.get(id)?.path ?? null
}

export function destinationForPath(pathname) {
  const normalized = normalizePathname(pathname)
  return normalized ? destinationByPath.get(normalized)?.id ?? null : null
}

export function routeDefinitionsForImplemented(implemented) {
  if (!(implemented instanceof Set)) return []
  return NAVIGATION_DESTINATIONS
    .filter(({ id }) => implemented.has(id))
    .map(({ id, path }) => ({ id, path }))
}
