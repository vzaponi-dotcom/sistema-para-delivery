import { apiRequest, withJson } from '../infrastructure/api/httpClient.js'
import { getSession, login, logout } from '../infrastructure/auth/sessionApi.js'

export { apiRequest, withJson, getSession, login, logout }

export const getBootstrap = (knownEffectiveConfigVersion) => {
  const params = new URLSearchParams()
  if (knownEffectiveConfigVersion) params.set('knownEffectiveConfigVersion', knownEffectiveConfigVersion)
  return apiRequest(`/api/bootstrap${params.size ? `?${params}` : ''}`)
}

// Compatibility-only export while App.jsx is migrated away from its old handler.
// It never issues DELETE and therefore cannot erase an order.
export const deleteOrder = async () => {
  const error = new Error('Exclusão de pedidos foi substituída por cancelamento.')
  error.code = 'ORDER_DELETE_REMOVED'
  throw error
}
