import { apiRequest, withJson } from '../api/httpClient.js'

export const createSessionApi = ({ request = apiRequest, json = withJson } = {}) => {
  const getSession = () => request('/api/auth/session')
  const login = async (credentials) => {
    const payload = typeof credentials === 'string' ? { pin: credentials }
      : { identifier: credentials.identifier, password: credentials.password, deviceMode: credentials.deviceMode === 'personal' ? 'personal' : 'shared' }
    await request('/api/auth/login', json('POST', payload))
    const session = await getSession()
    if (!session?.authenticated || typeof session.businessId !== 'string' || !session.businessId
      || typeof session.settingsContextId !== 'string' || !session.settingsContextId
      || !Array.isArray(session.capabilities)) {
      throw Object.assign(new Error('Não foi possível confirmar o contexto da sessão.'), {
        code: 'SESSION_CONTEXT_UNAVAILABLE',
      })
    }
    return session
  }
  const logout = () => request('/api/auth/logout', { method: 'POST' })
  return { getSession, login, logout }
}

export const { getSession, login, logout } = createSessionApi()
