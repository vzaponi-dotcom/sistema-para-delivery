import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createOrdersApi = ({ request = apiRequest, json = withJson, randomUUID = () => crypto.randomUUID() } = {}) => Object.freeze({
  getOrders: () => request('/api/orders'),
  createOrder: (order, idempotencyKey = randomUUID()) => {
    const options = json('POST', order)
    return request('/api/orders', {
      ...options,
      headers: { ...(options.headers || {}), 'idempotency-key': idempotencyKey },
    })
  },
  updateOrderStatus: (id, status = 'Finalizado') => request(
    `/api/orders/${encodeURIComponent(id)}/status`,
    json('PATCH', { status }),
  ),
  cancelOrder: (id, payload) => request(
    `/api/orders/${encodeURIComponent(id)}/cancel`,
    json('POST', payload),
  ),
})

export const ordersApi = createOrdersApi()
