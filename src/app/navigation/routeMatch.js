import { useMatches } from 'react-router'

export function destinationFromMatches(matches) {
  if (!Array.isArray(matches)) return null
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const destinationId = matches[index]?.handle?.destinationId
    if (typeof destinationId === 'string') return destinationId
    if (destinationId === null) return null
  }
  return null
}

export function useMatchedDestination() {
  return destinationFromMatches(useMatches())
}
