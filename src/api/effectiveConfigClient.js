import { apiRequest } from './client.js'

export const getEffectiveConfig = (knownVersion) => {
  const params = new URLSearchParams()
  if (knownVersion) params.set('knownVersion', knownVersion)
  return apiRequest(`/api/settings/effective${params.size ? `?${params}` : ''}`)
}
