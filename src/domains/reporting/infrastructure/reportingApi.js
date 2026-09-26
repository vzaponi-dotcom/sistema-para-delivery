import { apiRequest } from '../../../infrastructure/api/httpClient.js'

const queryString = (query = {}) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== null && value !== undefined && value !== '') params.set(key, String(value))
  return params.toString()
}

const COLLECTION_PATHS = Object.freeze({
  overview: '/api/reporting/overview',
  operation: '/api/reporting/operation',
  sales: '/api/reporting/sales',
  products: '/api/reporting/products',
  detail: '/api/reporting/orders',
})

export const createReportingApi = ({ request = apiRequest } = {}) => Object.freeze({
  load: (view, query, { signal } = {}) => {
    const path = COLLECTION_PATHS[view]
    if (!path) throw new Error(`Visão de relatório desconhecida: ${view}`)
    const search = queryString(query)
    return request(`${path}${search ? `?${search}` : ''}`, { signal })
  },
  loadOrder: (id, { signal } = {}) => request(`/api/reporting/orders/${encodeURIComponent(id)}`, { signal }),
  exportModel: (query, columns, { signal, format } = {}) => request('/api/reporting/export-model', {
    method: 'POST', body: JSON.stringify({ query, columns, format }), signal,
  }),
})

export const reportingApi = createReportingApi()