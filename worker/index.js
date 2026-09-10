import { clearSessionCookie, createSession, getAuthenticatedSession, revokeSession, sessionCookie, SESSION_MAX_AGE, verifyPin } from './auth.js'
import { createManualMovement, softDeleteManualMovement, updateManualMovement, upsertFinanceSettings } from './financeRepository.js'
import { parseFinanceSettingsInput, parseManualMovementInput } from './financeValidation.js'
import { apiError, assertSameOriginMutation, handleError, json, readJson } from './http.js'
import { cancelOrder, registerOrderRefund } from './orderCancellation.js'
import { validateCheckoutInput } from './orderCheckout.js'
import { handlePrintingApi } from './orderPrintingApi.js'
import { createManualTableTabPrintJob, loadAutomaticPrintJobForOrder } from './orderPrintingRepository.js'
import { listOrders } from './orderReadRepository.js'
import { loadMovementByOrderSource, loadTableTabById } from './orderWriteEffects.js'
import { loadOpenTableTabDetail } from './tableTabDetailRepository.js'
import { updateOrderPaymentPromise } from './orderPaymentPromise.js'
import { createClient, createOrder, createProduct, deleteClient, deleteProduct, loadBootstrap, registerOrderPayment, registerTableTabPayment, updateClient, updateOrderStatus, updateProduct } from './repositories.js'
import { createTable, listTables, renameTable, reorderTables, setTableActive, transferOpenTableTab } from './tableRepository.js'
import { moneyToCents, optionalText, requireNonEmpty, validatePaymentMethod, validateProductCategory, validateStructuredPresentation } from './validation.js'
import { createTableTabPrintDocument } from '../shared/tableTabPrintDocument.js'

const BUSINESS_ID = 'amor-e-sabor'
const LOGIN_RATE_LIMIT_KEY = 'amor-e-sabor:auth-login'
const LEGACY_PRODUCT_CATEGORIES = {
  Marmita: 'Refeições',
  Bebida: 'Bebidas',
  Doce: 'Sobremesas',
  Adicional: 'Adicionais',
}

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
const productInput = (body) => {
  const category = validateProductCategory(LEGACY_PRODUCT_CATEGORIES[body.category] || body.category)
  const legacySize = optionalText(body.size)
  const presentation = body.presentationType
    ? validateStructuredPresentation(body)
    : validateStructuredPresentation(legacySize && !['Un', 'Unidade'].includes(legacySize)
      ? { presentationType: 'size', presentationValue: legacySize, presentationUnit: '' }
      : { presentationType: 'unit', presentationValue: '', presentationUnit: '' })
  return {
    category,
    name: requireNonEmpty(body.name, 'name'),
    priceCents: moneyToCents(body.price, 'price'),
    ...presentation,
  }
}

const tablePatchInput = (body) => {
  const keys = Object.keys(body)
  if (keys.length !== 1 || !['name', 'isActive'].includes(keys[0])) {
    throw apiError(400, 'INVALID_TABLE_PATCH', 'Informe somente name ou isActive.')
  }
  return keys[0]
}

const authenticatedApi = async (request, env) => {
  const session = await getAuthenticatedSession(request, env)
  if (!session) throw apiError(401, 'UNAUTHENTICATED', 'Sua sessão expirou. Entre novamente.')
  const url = new URL(request.url)

  const printingResponse = await handlePrintingApi(request, env, session, url)
  if (printingResponse) return printingResponse

  if (url.pathname === '/api/bootstrap' && request.method === 'GET') return json(await loadBootstrap(env.DB, session.businessId))
  if (url.pathname === '/api/tables' && request.method === 'POST') {
    assertSameOriginMutation(request)
    await createTable(env.DB, session.businessId, await readJson(request))
    return json({ tables: await listTables(env.DB, session.businessId) }, { status: 201 })
  }
  if (url.pathname === '/api/tables/order' && request.method === 'PUT') {
    assertSameOriginMutation(request)
    const { tableIds } = await readJson(request)
    return json({ tables: await reorderTables(env.DB, session.businessId, tableIds) })
  }
  const tableTransferMatch = url.pathname.match(/^\/api\/tables\/([^/]+)\/transfer$/)
  if (tableTransferMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const { destinationTableId } = await readJson(request)
    const tableTab = await transferOpenTableTab(
      env.DB,
      session.businessId,
      decodeURIComponent(tableTransferMatch[1]),
      destinationTableId,
    )
    return json({ tables: await listTables(env.DB, session.businessId), tableTab })
  }
  const tableMatch = url.pathname.match(/^\/api\/tables\/([^/]+)$/)
  if (tableMatch && request.method === 'PATCH') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const field = tablePatchInput(body)
    const tableId = decodeURIComponent(tableMatch[1])
    const table = field === 'name'
      ? await renameTable(env.DB, session.businessId, tableId, body.name)
      : await setTableActive(env.DB, session.businessId, tableId, body.isActive)
    if (!table) throw apiError(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')
    return json({ tables: await listTables(env.DB, session.businessId) })
  }
  if (url.pathname === '/api/clients' && request.method === 'POST') { assertSameOriginMutation(request); const client = await createClient(env.DB, session.businessId, clientInput(await readJson(request))); return json({ client }, { status: 201 }) }
  const clientMatch = url.pathname.match(/^\/api\/clients\/([^/]+)$/)
  if (clientMatch && request.method === 'PATCH') { assertSameOriginMutation(request); const client = await updateClient(env.DB, session.businessId, decodeURIComponent(clientMatch[1]), clientInput(await readJson(request))); if (!client) throw apiError(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.'); return json({ client }) }
  if (clientMatch && request.method === 'DELETE') { assertSameOriginMutation(request); const deleted = await deleteClient(env.DB, session.businessId, decodeURIComponent(clientMatch[1])); if (!deleted) throw apiError(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.'); return json({ deleted: true }) }

  if (url.pathname === '/api/orders' && request.method === 'GET') return json({ orders: await listOrders(env.DB, session.businessId) })
  if (url.pathname === '/api/orders' && request.method === 'POST') {
    assertSameOriginMutation(request)
    const input = validateCheckoutInput(await readJson(request), request.headers.get('idempotency-key'))
    const order = await createOrder(env.DB, session.businessId, input)
    const movement = input.paymentMethod
      ? await loadMovementByOrderSource(env.DB, session.businessId, order.id, 'order-payment')
      : null
    const tableTab = order.tableTabId
      ? await loadTableTabById(env.DB, session.businessId, order.tableTabId)
      : null
    const printJob = await loadAutomaticPrintJobForOrder(env.DB, session.businessId, order.id)
    const response = { order, movement, tableTab, printJob }
    if (order.tableTabId) response.tables = await listTables(env.DB, session.businessId)
    return json(response, { status: 201 })
  }
  const statusMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/)
  if (statusMatch && request.method === 'PATCH') { assertSameOriginMutation(request); const body = await readJson(request); if (body.status !== 'Finalizado') throw apiError(400, 'INVALID_STATUS', 'Transição de status inválida.'); const order = await updateOrderStatus(env.DB, session.businessId, decodeURIComponent(statusMatch[1])); if (!order) throw apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.'); return json({ order }) }
  const paymentMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/payment$/)
  if (paymentMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const { method } = await readJson(request)
    const result = await registerOrderPayment(env.DB, session.businessId, decodeURIComponent(paymentMatch[1]), validatePaymentMethod(method))
    const tableTab = result.order?.tableTabId
      ? await loadTableTabById(env.DB, session.businessId, result.order.tableTabId)
      : null
    return json({ ...result, tableTab }, { status: 201 })
  }
  const paymentPromiseMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/payment-promise$/)
  if (paymentPromiseMatch && request.method === 'PATCH') {
    assertSameOriginMutation(request)
    const { promisedPaymentDate } = await readJson(request)
    const order = await updateOrderPaymentPromise(env.DB, session.businessId, decodeURIComponent(paymentPromiseMatch[1]), promisedPaymentDate)
    return json({ order })
  }
  const cancelMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/)
  if (cancelMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const result = await cancelOrder(env.DB, session.businessId, decodeURIComponent(cancelMatch[1]), await readJson(request))
    return json(result)
  }
  const refundMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/refund$/)
  if (refundMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const result = await registerOrderRefund(env.DB, session.businessId, decodeURIComponent(refundMatch[1]), await readJson(request))
    return json(result, { status: 201 })
  }
  const tableTabPrintMatch = url.pathname.match(/^\/api\/table-tabs\/([^/]+)\/print-document$/)
  if (tableTabPrintMatch && request.method === 'GET') {
    const detail = await loadOpenTableTabDetail(env.DB, session.businessId, decodeURIComponent(tableTabPrintMatch[1]))
    if (!detail) throw apiError(404, 'TABLE_TAB_NOT_FOUND', 'Comanda aberta n\u00e3o encontrada.')
    return json({ document: createTableTabPrintDocument(detail) })
  }
  const tableTabPrintJobMatch = url.pathname.match(/^\/api\/table-tabs\/([^/]+)\/print-jobs$/)
  if (tableTabPrintJobMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const tableTabId = decodeURIComponent(tableTabPrintJobMatch[1])
    const detail = await loadOpenTableTabDetail(env.DB, session.businessId, tableTabId)
    if (!detail) throw apiError(404, 'TABLE_TAB_NOT_FOUND', 'Comanda aberta não encontrada.')
    const job = await createManualTableTabPrintJob(env.DB, session.businessId, {
      tableTabId,
      document: createTableTabPrintDocument(detail),
    })
    return json({ job }, { status: 201 })
  }
  const tableTabDetailMatch = url.pathname.match(/^\/api\/table-tabs\/([^/]+)$/)
  if (tableTabDetailMatch && request.method === 'GET') {
    const tableTab = await loadOpenTableTabDetail(env.DB, session.businessId, decodeURIComponent(tableTabDetailMatch[1]))
    if (!tableTab) throw apiError(404, 'TABLE_TAB_NOT_FOUND', 'Comanda aberta n\u00e3o encontrada.')
    return json({ tableTab })
  }
  const tableTabPaymentMatch = url.pathname.match(/^\/api\/table-tabs\/([^/]+)\/payment$/)
  if (tableTabPaymentMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const { method } = await readJson(request)
    const result = await registerTableTabPayment(env.DB, session.businessId, decodeURIComponent(tableTabPaymentMatch[1]), validatePaymentMethod(method))
    return json({ ...result, tables: await listTables(env.DB, session.businessId) }, { status: 201 })
  }

  if (url.pathname === '/api/movements' && request.method === 'POST') {
    assertSameOriginMutation(request)
    const movement = await createManualMovement(env.DB, session.businessId, parseManualMovementInput(await readJson(request)))
    return json({ movement }, { status: 201 })
  }
  const movementMatch = url.pathname.match(/^\/api\/movements\/([^/]+)$/)
  if (movementMatch && request.method === 'PATCH') {
    assertSameOriginMutation(request)
    const id = decodeURIComponent(movementMatch[1])
    const movement = await updateManualMovement(env.DB, session.businessId, id, parseManualMovementInput(await readJson(request)))
    if (!movement) throw apiError(404, 'MOVEMENT_NOT_FOUND', 'Movimentação não encontrada.')
    return json({ movement })
  }
  if (movementMatch && request.method === 'DELETE') {
    assertSameOriginMutation(request)
    const id = decodeURIComponent(movementMatch[1])
    const deletedMovementId = await softDeleteManualMovement(env.DB, session.businessId, id)
    if (!deletedMovementId) throw apiError(404, 'MOVEMENT_NOT_FOUND', 'Movimentação não encontrada.')
    return json({ deletedMovementId })
  }
  if (url.pathname === '/api/finance-settings' && request.method === 'PUT') {
    assertSameOriginMutation(request)
    const financeSettings = await upsertFinanceSettings(env.DB, session.businessId, parseFinanceSettingsInput(await readJson(request)))
    return json({ financeSettings })
  }

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
