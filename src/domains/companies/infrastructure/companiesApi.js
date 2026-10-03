import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createCompaniesApi = ({ request = apiRequest } = {}) => Object.freeze({
  listBusinesses: () => request('/api/auth/businesses'),
  inspectInvitation: input => request('/api/auth/company-invitations/inspect', withJson('POST', input)),
  acceptInvitation: (input, session) => request('/api/auth/company-invitations/accept', { ...withJson('POST', input), ...(session?.contextId ? { headers: { 'X-Mesiva-Context': session.contextId } } : {}) }),
  selectBusiness: businessId => request('/api/auth/select-business', withJson('POST', { businessId })),
  selectPlatform: () => request('/api/auth/select-platform', { method: 'POST' }),
})
export const companiesApi = createCompaniesApi()
