import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createFinanceApi = ({ request = apiRequest, json = withJson } = {}) => Object.freeze({
  createMovement: (movement) => request('/api/movements', json('POST', movement)),
  updateMovement: (id, movement) => request(`/api/movements/${encodeURIComponent(id)}`, json('PATCH', movement)),
  deleteMovement: (id) => request(`/api/movements/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  saveFinanceSettings: (settings) => request('/api/finance-settings', json('PUT', settings)),
})

export const financeApi = createFinanceApi()
