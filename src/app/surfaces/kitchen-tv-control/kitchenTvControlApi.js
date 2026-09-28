import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const getKitchenTvControl = () => apiRequest('/api/kitchen-tv/control')
export const setKitchenTvPage = (page) => apiRequest('/api/kitchen-tv/control/page', withJson('PATCH', { page }))

export const hideKitchenTvOrder = (orderId) => apiRequest(`/api/kitchen-tv/control/orders/${encodeURIComponent(orderId)}/hidden`, { method: 'PUT' })
export const restoreKitchenTvOrder = (orderId) => apiRequest(`/api/kitchen-tv/control/orders/${encodeURIComponent(orderId)}/hidden`, { method: 'DELETE' })
