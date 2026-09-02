import { clearSessionCookie, createSession, getAuthenticatedSession, revokeSession, sessionCookie, SESSION_MAX_AGE, verifyPin } from './auth.js'
import { apiError, assertSameOriginMutation, handleError, json, readJson } from './http.js'
import { validateCheckoutInput } from './orderCheckout.js'
import { createClient, createMovement, createOrder, createProduct, deleteClient, deleteOrder, deleteProduct, loadBootstrap, registerOrderPayment, updateClient, updateOrderStatus, updateProduct } from './repositories.js'
import { moneyToCents, optionalText, requireNonEmpty, validateMovementType, validatePaymentMethod } from './validation.js'

const BUSINESS_ID = 'amor-e-sabor'
const LOGIN_RATE_LIMIT_KEY = 'amor-e-sabor:auth-login'

const assertLoginAllowed = async (env) => {
  if (!env.LOGIN_RATE_LIMITER?.limit) throw apiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Proteção de acesso indisponível. Tente novamente.')
  const { success } = await env.LOGIN_RATE_LIMITER.limit({ key: LOGIN_RATE_LIMIT_KEY })
  if (!success) throw apiError(429, 'LOGIN_RATE_LIMITED', 'Muitas tentativas de acesso. Aguarde um minuto e tente novamente.')
}

const login = async (request, env) => {
  assertSameOriginMutation(request)
  await assertLoginAllowed(env)
  const body = await readJson(request)
  const pin = requireNonEmpty(body.pin, 'pin')
  const credential = await env.DB.prepare('SELECT pin_hash FROM auth_credentials WHERE business_id = ? LIMIT 1').bind(BUSINESS_ID).first()
  if (!credential?.pin_hash) throw apiError(503, 'AUTH_NOT_CONFIGURED', 'O acesso por PIN ainda não foi configurado.')
  if (!(await verifyPin(pin, credential.pin_hash))) throw apiError(401, 'INVALID_PIN', 'PIN inválido.')
  const { token } = await createSession(env, BUSINESS_ID)
  return json({ authenticated: true, businessId: BUSINESS_ID }, { headers: { 'set-cookie': sessionCookie(token, SESSION_MAX_AGE) } })
}

const logout = async (request, env) => { assertSameOriginMutation(request); await revokeSession(request, env); return json({ authenticated: false }, { headers: { 'set-cookie': clearSessionCookie() } }) }
const sessionStatus = async (request, env) => { const session = await getAuthenticatedSession(request, env); return session ? json({ authenticated: true, businessId: session.businessId }) : json({ authenticated: false }) }
const clientInput = (body) => ({ name: requireNonEmpty(body.name, 'name'), phone: optionalText(body.phone), address: optionalText(body.address) })
const productInput = (body) => ({ category: requireNonEmpty(body.category, 'category'), size: optionalText(body.size), name: requireNonEmpty(body.name, 'name'), priceCents: moneyToCents(body.price, 'price') })
const movementInput = (body) => { const valueCents = moneyToCents(body.value, 'value'); if (valueCents <= 0) throw apiError(400, 'VALIDATION_ERROR', 'O valor deve ser maior que zero.'); return { type: validateMovementType(body.type), category: requireNonEmpty(body.category, 'category'), description: requireNonEmpty(body.description, 'description'), valueCents } }

const authenticatedApi = async (request, env) => {
  const session = await getAuthenticatedSession(request, env)
  if (!session) throw apiError(401, 'UNAUTHENTICATED', 'Sua sessão expirou. Entre novamente.')
  const url = new URL(request.url)

  if (url.pathname === '/api/bootstrap' && request.method === 'GET') return json(await loadBootstrap(env.DB, session.businessId))
  if (url.pathname === '/api/clients' && request.method === 'POST') { assertSameOriginMutation(request); const client = await createClient(env.DB, session.businessId, clientInput(await readJson(request))); return json({ client }, { status: 201 }) }
  const clientMatch = url.pathname.match(/^\/api\/clients\/([^/]+)$/)
  if (clientMatch && request.method === 'PATCH') { assertSameOriginMutation(request); const client = await updateClient(env.DB, session.businessId, decodeURIComponent(clientMatch[1]), clientInput(await readJson(request))); if (!client) throw apiError(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.'); return json({ client }) }
  if (clientMatch && request.method === 'DELETE') { assertSameOriginMutation(request); const deleted = await deleteClient(env.DB, session.businessId, decodeURIComponent(clientMatch[1])); if (!deleted) throw apiError(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.'); return json({ deleted: true }) }

  if (url.pathname === '/api/orders' && request.method === 'POST') {
    assertSameOriginMutation(request)
    const input = validateCheckoutInput(await readJson(request), request.headers.get('idempotency-key'))
    const order = await createOrder(env.DB, session.businessId, input)
    return json({ order }, { status: 201 })
  }
  const statusMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/)
  if (statusMatch && request.method === 'PATCH') { assertSameOriginMutation(request); const body = await readJson(request); if (body.status !== 'Finalizado') throw apiError(400, 'INVALID_STATUS', 'Transição de status inválida.'); const order = await updateOrderStatus(env.DB, session.businessId, decodeURIComponent(statusMatch[1])); if (!order) throw apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.'); return json({ order }) }
  const paymentMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/payment$/)
  if (paymentMatch && request.method === 'POST') { assertSameOriginMutation(request); const { method } = await readJson(request); const result = await registerOrderPayment(env.DB, session.businessId, decodeURIComponent(paymentMatch[1]), validatePaymentMethod(method)); return json(result, { status: 201 }) }
  const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/)
  if (orderMatch && request.method === 'DELETE') { assertSameOriginMutation(request); const deleted = await deleteOrder(env.DB, session.businessId, decodeURIComponent(orderMatch[1])); if (!deleted) throw apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.'); return json({ deleted: true }) }
  if (url.pathname === '/api/movements' && request.method === 'POST') { assertSameOriginMutation(request); const movement = await createMovement(env.DB, session.businessId, movementInput(await readJson(request))); return json({ movement }, { status: 201 }) }

  if (url.pathname === '/api/products' && request.method === 'POST') { assertSameOriginMutation(request); const product = await createProduct(env.DB, session.businessId, productInput(await readJson(request))); return json({ product }, { status: 201 }) }
  const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/)
  if (productMatch && request.method === 'PATCH') { assertSameOriginMutation(request); const product = await updateProduct(env.DB, session.businessId, decodeURIComponent(productMatch[1]), productInput(await readJson(request))); if (!product) throw apiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.'); return json({ product }) }
  if (productMatch && request.method === 'DELETE') { assertSameOriginMutation(request); const deleted = await deleteProduct(env.DB, session.businessId, decodeURIComponent(productMatch[1])); if (!deleted) throw apiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.'); return json({ deleted: true }) }
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
  } catch (error) { return handleError(error) }
}

export default { fetch: handleRequest }
