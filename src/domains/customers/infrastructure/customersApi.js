import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export function createCustomersApi({
  request = apiRequest,
  json = withJson,
} = {}) {
  return {
    createClient: (client) => request('/api/clients', json('POST', client)),
    updateClient: (id, client) => request(`/api/clients/${encodeURIComponent(id)}`, json('PATCH', client)),
    deleteClient: (id) => request(`/api/clients/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }
}

export const customersApi = createCustomersApi()
