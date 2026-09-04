const apiRequest = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Não foi possível concluir a operação.')
    error.status = response.status
    error.code = payload?.error?.code || 'REQUEST_FAILED'
    throw error
  }
  return payload
}

const withJson = (method, payload) => ({ method, body: JSON.stringify(payload) })

export const getSession = () => apiRequest('/api/auth/session')
export const login = (pin) => apiRequest('/api/auth/login', withJson('POST', { pin }))
export const logout = () => apiRequest('/api/auth/logout', { method: 'POST' })
export const getBootstrap = () => apiRequest('/api/bootstrap')
export const getOrders = () => apiRequest('/api/orders')

export const createClient = (client) => apiRequest('/api/clients', withJson('POST', client))
export const updateClient = (id, client) => apiRequest(`/api/clients/${encodeURIComponent(id)}`, withJson('PATCH', client))
export const deleteClient = (id) => apiRequest(`/api/clients/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const createProduct = (product) => apiRequest('/api/products', withJson('POST', product))
export const updateProduct = (id, product) => apiRequest(`/api/products/${encodeURIComponent(id)}`, withJson('PATCH', product))
export const deleteProduct = (id) => apiRequest(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const createOrder = (order, idempotencyKey = crypto.randomUUID()) => apiRequest('/api/orders', {
  ...withJson('POST', order),
  headers: { 'idempotency-key': idempotencyKey },
})
export const updateOrderStatus = (id, status = 'Finalizado') => apiRequest(`/api/orders/${encodeURIComponent(id)}/status`, withJson('PATCH', { status }))
export const cancelOrder = (id, payload) => apiRequest(`/api/orders/${encodeURIComponent(id)}/cancel`, withJson('POST', payload))
export const refundOrder = (id, payload) => apiRequest(`/api/orders/${encodeURIComponent(id)}/refund`, withJson('POST', payload))
// Compatibility-only export while App.jsx is migrated away from its old handler.
// It never issues DELETE and therefore cannot erase an order.
export const deleteOrder = async () => {
  const error = new Error('Exclusão de pedidos foi substituída por cancelamento.')
  error.code = 'ORDER_DELETE_REMOVED'
  throw error
}
export const registerPayment = (id, method) => apiRequest(`/api/orders/${encodeURIComponent(id)}/payment`, withJson('POST', { method }))
export const registerTableTabPayment = (id, method) => apiRequest(`/api/table-tabs/${encodeURIComponent(id)}/payment`, withJson('POST', { method }))

export const createMovement = (movement) => apiRequest('/api/movements', withJson('POST', movement))
export const updateMovement = (id, movement) => apiRequest(`/api/movements/${encodeURIComponent(id)}`, withJson('PATCH', movement))
export const deleteMovement = (id) => apiRequest(`/api/movements/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const saveFinanceSettings = (settings) => apiRequest('/api/finance-settings', withJson('PUT', settings))
