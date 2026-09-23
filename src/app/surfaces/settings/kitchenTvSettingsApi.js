import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const getKitchenTvSettings = () => apiRequest('/api/kitchen-tv/settings')
export const approveKitchenTvPairing = (code) => apiRequest('/api/kitchen-tv/approve', withJson('POST', { code }))
export const revokeKitchenTvAccess = () => apiRequest('/api/kitchen-tv/revoke', { method: 'POST' })
