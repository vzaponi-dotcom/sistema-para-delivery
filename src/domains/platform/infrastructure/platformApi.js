import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'
export const createPlatformApi = ({ request = apiRequest } = {}) => Object.freeze({
  listBusinesses: (input = {}, options = {}) => {
    const query = new URLSearchParams(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''))
    return request(`/api/platform/businesses${query.size ? `?${query}` : ''}`, options)
  },
  getBusiness: (id, options = {}) => request(`/api/platform/businesses/${encodeURIComponent(id)}`, options),
  createBusiness: (input, idempotencyKey) => request('/api/platform/businesses', { ...withJson('POST', input), headers: { 'Idempotency-Key': idempotencyKey } }),
  resendFirstManagerInvitation: id => request(`/api/platform/businesses/${encodeURIComponent(id)}/first-manager-invitation/resend`, { method: 'POST' }),
})
export const platformApi = createPlatformApi()
