import { clearSessionCookie, createSession, getAuthenticatedSession, revokeSession, sessionCookie, SESSION_MAX_AGE, verifyPin } from './auth.js'
import { apiError, assertSameOriginMutation, handleError, json, readJson } from './http.js'
import { loadBootstrap } from './repositories.js'
import { requireNonEmpty } from './validation.js'

const BUSINESS_ID = 'amor-e-sabor'
const LOGIN_RATE_LIMIT_KEY = 'amor-e-sabor:auth-login'

const assertLoginAllowed = async (env) => {
  if (!env.LOGIN_RATE_LIMITER?.limit) {
    throw apiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Proteção de acesso indisponível. Tente novamente.')
  }
  const { success } = await env.LOGIN_RATE_LIMITER.limit({ key: LOGIN_RATE_LIMIT_KEY })
  if (!success) throw apiError(429, 'LOGIN_RATE_LIMITED', 'Muitas tentativas de acesso. Aguarde um minuto e tente novamente.')
}

const login = async (request, env) => {
  assertSameOriginMutation(request)
  await assertLoginAllowed(env)
  const body = await readJson(request)
  const pin = requireNonEmpty(body.pin, 'pin')
  const credential = await env.DB.prepare(
    'SELECT pin_hash FROM auth_credentials WHERE business_id = ? LIMIT 1',
  ).bind(BUSINESS_ID).first()

  if (!credential?.pin_hash) {
    throw apiError(503, 'AUTH_NOT_CONFIGURED', 'O acesso por PIN ainda não foi configurado.')
  }

  if (!(await verifyPin(pin, credential.pin_hash))) {
    throw apiError(401, 'INVALID_PIN', 'PIN inválido.')
  }

  const { token } = await createSession(env, BUSINESS_ID)
  return json(
    { authenticated: true, businessId: BUSINESS_ID },
    { headers: { 'set-cookie': sessionCookie(token, SESSION_MAX_AGE) } },
  )
}

const logout = async (request, env) => {
  assertSameOriginMutation(request)
  await revokeSession(request, env)
  return json(
    { authenticated: false },
    { headers: { 'set-cookie': clearSessionCookie() } },
  )
}

const sessionStatus = async (request, env) => {
  const session = await getAuthenticatedSession(request, env)
  if (!session) return json({ authenticated: false })
  return json({ authenticated: true, businessId: session.businessId })
}

const authenticatedApi = async (request, env) => {
  const session = await getAuthenticatedSession(request, env)
  if (!session) throw apiError(401, 'UNAUTHENTICATED', 'Sua sessão expirou. Entre novamente.')

  const url = new URL(request.url)
  if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
    return json(await loadBootstrap(env.DB, session.businessId))
  }

  throw apiError(404, 'NOT_FOUND', 'Rota de API não encontrada.')
}

export const handleRequest = async (request, env) => {
  try {
    const url = new URL(request.url)

    if (url.pathname === '/api/auth/login' && request.method === 'POST') return await login(request, env)
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') return await logout(request, env)
    if (url.pathname === '/api/auth/session' && request.method === 'GET') return await sessionStatus(request, env)
    if (url.pathname.startsWith('/api/')) return await authenticatedApi(request, env)

    if (!env.ASSETS?.fetch) throw apiError(404, 'NOT_FOUND', 'Página não encontrada.')
    return env.ASSETS.fetch(request)
  } catch (error) {
    return handleError(error)
  }
}

export default {
  fetch: handleRequest,
}
