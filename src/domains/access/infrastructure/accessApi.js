import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createAccessApi = ({ request = apiRequest } = {}) => ({
  listUsers: () => request('/api/access/users'),
  createUser: (input) => request('/api/access/users', withJson('POST', input)),
  updateUser: (id, input) => request(`/api/access/users/${encodeURIComponent(id)}`, withJson('PATCH', input)),
  resetPassword: (id) => request(`/api/access/users/${encodeURIComponent(id)}/reset`, { method: 'POST' }),
  changePassword: (input) => request('/api/access/me/password', withJson('POST', input)),
  acceptInvitation: (input) => request('/api/access/invitations/accept', withJson('POST', input)),
  listActivity: (filters = {}) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value != null))
    return request(`/api/access/activity?${query}`)
  },
})
export const accessApi = createAccessApi()
