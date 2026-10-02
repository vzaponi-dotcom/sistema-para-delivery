import { apiRequest, withJson } from '../api/httpClient.js'

export const createSessionApi = ({ request = apiRequest, json = withJson } = {}) => {
  const unavailable = () => Object.assign(new Error('Não foi possível confirmar o contexto da sessão.'), { code: 'SESSION_CONTEXT_UNAVAILABLE' })
  const getSession = async ({ requireContext = false } = {}) => {
    const session = await request('/api/auth/session')
    if (requireContext && session?.authenticated && session.authMode === 'multi_company') {
      if (!['identity', 'platform', 'business'].includes(session.scope) || !session.contextId || !session.account?.id
        || (session.scope === 'business' && (!session.businessId || !session.settingsContextId || !Array.isArray(session.capabilities)))) throw unavailable()
    } else if (requireContext && session?.authenticated && (typeof session.businessId !== 'string' || !session.businessId
      || typeof session.settingsContextId !== 'string' || !session.settingsContextId
      || !Array.isArray(session.capabilities))) throw unavailable()
    return session
  }
  const login = async (credentials, { discover = true } = {}) => {
    const payload = typeof credentials === 'string' ? { pin: credentials }
      : { email: credentials.email, password: credentials.password, deviceMode: credentials.deviceMode === 'personal' ? 'personal' : 'shared' }
    const response = await request('/api/auth/login', json('POST', payload))
    // The runtime owns invalidation and discovery when a UI operation can be superseded.
    if (!discover) return response
    const session = await getSession({ requireContext: true })
    if (!session?.authenticated) throw unavailable()
    return session
  }
  const scoped = (context, path, options) => request(path, { ...options, ...(context?.contextId ? { headers: { 'X-Mesiva-Context': context.contextId } } : {}) })
  const logout = (context) => scoped(context, '/api/auth/logout', { method: 'POST' })
  const listBusinesses = context => scoped(context, '/api/auth/businesses')
  const selectBusiness = (businessId, context) => scoped(context, '/api/auth/select-business', json('POST', { businessId }))
  const selectPlatform = context => scoped(context, '/api/auth/select-platform', { method: 'POST' })
  return { getSession, login, logout, listBusinesses, selectBusiness, selectPlatform }
}

export const { getSession, login, logout, listBusinesses, selectBusiness, selectPlatform } = createSessionApi()
