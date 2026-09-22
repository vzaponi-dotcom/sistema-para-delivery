import { apiRequest } from '../../../infrastructure/api/httpClient.js'

export const getKitchenTvSettings = () => apiRequest('/api/kitchen-tv/settings')
export const generateKitchenTvAccess = () => apiRequest('/api/kitchen-tv/access', { method: 'POST' })
export const revokeKitchenTvAccess = () => apiRequest('/api/kitchen-tv/revoke', { method: 'POST' })
