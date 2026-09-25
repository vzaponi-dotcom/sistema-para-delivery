import { apiRequest } from '../../../infrastructure/api/httpClient.js'

const queryString = (query = {}) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== null && value !== undefined && value !== '') params.set(key, String(value))
  return params.toString()
}

export const createReportingApi = ({ request = apiRequest } = {}) => Object.freeze({
  load: (view, query, { signal } = {}) => {
    const search = queryString(query)
    return request(`/api/reporting/${view}${search ? `?${search}` : ''}`, { signal })
  },
  loadOrder: (id, { signal } = {}) => request(`/api/reporting/orders/${encodeURIComponent(id)}`, { signal }),
  exportModel: (query, columns, { signal } = {}) => request('/api/reporting/export-model', {
    method: 'POST', body: JSON.stringify({ query, columns }), signal,
  }),
})

export const reportingApi = createReportingApi()
