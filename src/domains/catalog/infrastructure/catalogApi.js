import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export function createCatalogApi({
  request = apiRequest,
  json = withJson,
} = {}) {
  return {
    createProduct: (product) => request('/api/products', json('POST', product)),
    updateProduct: (id, product) => request(`/api/products/${encodeURIComponent(id)}`, json('PATCH', product)),
    deleteProduct: (id) => request(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }
}

export const catalogApi = createCatalogApi()
