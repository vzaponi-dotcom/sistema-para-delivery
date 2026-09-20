import { apiRequest } from './httpClient.js'

export const createBootstrapApi = ({ request = apiRequest } = {}) => Object.freeze({
  getBootstrap: (knownEffectiveConfigVersion) => {
    const params = new URLSearchParams()
    if (knownEffectiveConfigVersion) params.set('knownEffectiveConfigVersion', knownEffectiveConfigVersion)
    return request(`/api/bootstrap${params.size ? `?${params}` : ''}`)
  },
})

export const { getBootstrap } = createBootstrapApi()
