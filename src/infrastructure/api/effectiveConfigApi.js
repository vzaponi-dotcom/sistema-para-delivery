import { apiRequest } from './httpClient.js'

export const createEffectiveConfigApi = ({ request = apiRequest } = {}) => Object.freeze({
  getEffectiveConfig: (knownVersion) => {
    const params = new URLSearchParams()
    if (knownVersion) params.set('knownVersion', knownVersion)
    return request(`/api/settings/effective${params.size ? `?${params}` : ''}`)
  },
})

export const { getEffectiveConfig } = createEffectiveConfigApi()
