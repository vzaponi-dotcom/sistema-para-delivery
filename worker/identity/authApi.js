import { apiError, assertSameOriginMutation, handleError, json, readJson } from '../http.js'
import { accountSessionCookie, clearAccountSessionCookie, clearSessionCookie } from '../auth.js'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { PLATFORM_CAPABILITIES } from '../../shared/companyAccess.js'
import { resolveSettingsAccess } from '../settingsAccess.js'
import { readEmailConfig, unavailableEmailConfig } from '../access/emailDelivery.js'
import { RECOVERY_MESSAGE } from '../access/emailAuthApi.js'
import { verifyAccountLogin, findAccountByEmail } from './accounts.js'
import { reserveIdentityLogin, completeIdentityLogin, reserveIdentityRecovery, prepareIdentityDeliveryReservation } from './throttle.js'
import { prepareIdentityAudit } from './audit.js'
import { prepareAccountSession, authenticateAccountRequest, revokeBrowserFamily, contextChanged } from './sessions.js'
import { prepareIdentityChallenge, inspectIdentityChallenge, completeIdentityChallenge, changeAccountPassword } from './challenges.js'
import { commitIdentityStatements } from './transactions.js'
import { deliverPersistedIdentityMessage } from './emailMessages.js'
import { requireIdentityContext } from '../tenancy/businessContext.js'
import { selectAccountScope } from '../tenancy/scopeSelection.js'
import { listEligibleBusinesses } from '../tenancy/eligibleBusinesses.js'

const response = (body, init = {}) => json(body, { ...init, headers: { 'cache-control': 'no-store', ...init.headers } })
const invalidLogin = () => apiError(401, 'INVALID_LOGIN', 'E-mail ou senha inválidos.')
const methods = new Map([
  ['/api/auth/login', 'POST'], ['/api/auth/session', 'GET'], ['/api/auth/logout', 'POST'], ['/api/auth/businesses', 'GET'],
  ['/api/auth/select-business', 'POST'], ['/api/auth/select-platform', 'POST'], ['/api/auth/password-recovery', 'POST'],
  ['/api/auth/email-challenges/inspect', 'POST'], ['/api/auth/email-challenges/complete', 'POST'], ['/api/access/me/password', 'POST'],
])

export async function accountSessionView(db, context) {
  if (!context) return { authenticated: false, authMode: 'multi_company' }
  const eligibleBusinesses = await listEligibleBusinesses(db, context.accountId)
  const { results } = await db.prepare('SELECT capability FROM platform_grants WHERE account_id = ? ORDER BY capability').bind(context.accountId).all()
  const view = { authenticated: true, authMode: 'multi_company', account: { id: context.accountId, displayName: context.accountDisplayName, email: context.email, emailVerified: true },
    scope: context.scope, contextId: context.contextId, expiresAt: context.expiresAt, deviceMode: context.deviceMode, capabilities: [],
    eligibleBusinessCount: eligibleBusinesses.length,
    platformCapabilities: results.map((row) => row.capability).filter((capability) => PLATFORM_CAPABILITIES.includes(capability)) }
  if (context.scope === 'business') {
    const resolved = await resolveSettingsAccess(context, context.granted)
    Object.assign(view, { businessId: context.businessId, settingsContextId: resolved.settingsContextId, capabilities: [...resolved.granted],
      user: { id: context.userId, displayName: context.displayName, roleName: context.roleName, email: context.email, emailVerified: true } })
  }
  return view
}

async function sessionResponse(request, env, value, now) {
  const current = await authenticateAccountRequest(new Request(request.url, { headers: { cookie: `mesiva_session=${value.token}` } }), env, now)
  if (!current) throw contextChanged()
  return response(await accountSessionView(env.DB, current), { headers: { 'set-cookie': accountSessionCookie(value.token, value.expiresAt, now) } })
}

async function login(request, env, body, now) {
  if (body.destination !== undefined && body.destination !== 'platform') throw apiError(400, 'INVALID_LOGIN_DESTINATION', 'Destino de entrada inválido.')
  const attempt = await reserveIdentityLogin(env.DB, { email: body.email, originKey: request.headers.get('CF-Connecting-IP') || 'unknown', now })
  if (!attempt.allowed) throw apiError(429, 'LOGIN_RATE_LIMITED', 'Muitas tentativas de acesso. Aguarde e tente novamente.')
  const account = await verifyAccountLogin(env.DB, body)
  if (!account) { await prepareIdentityAudit(env.DB, { action: 'login.failure', result: 'failure', now }).run(); throw invalidLogin() }
  const businesses = await listEligibleBusinesses(env.DB, account.id)
  const platform = await env.DB.prepare("SELECT 1 AS allowed FROM platform_grants WHERE account_id = ? AND capability = 'platform.businesses.view'").bind(account.id).first()
  let scope = 'identity', businessId = null
  if (body.destination === 'platform') {
    if (!platform) throw apiError(403, 'FORBIDDEN', 'Você não tem acesso ao painel Mesiva.')
    scope = 'platform'
  } else if (businesses.length === 1) { scope = 'business'; businessId = businesses[0].businessId }
  else if (businesses.length === 0 && platform) scope = 'platform'
  const prepared = await prepareAccountSession(env.DB, { accountId: account.id, expectedCredentialRevision: account.credential_revision, scope, businessId, deviceMode: body.deviceMode ?? 'shared', now })
  await commitIdentityStatements(env.DB, [...prepared.statements, prepareIdentityAudit(env.DB, { accountId: account.id, sessionId: prepared.value.identitySessionId, action: 'login.success', now })])
  const result = await sessionResponse(request, env, prepared.value, now)
  await completeIdentityLogin(env.DB, attempt.attemptId, true)
  return result
}

async function processRecovery(env, email, config, now, fetchImpl) {
  const account = await findAccountByEmail(env.DB, email)
  if (!account?.active || !account.email_verified_at) return
  const credential = await env.DB.prepare('SELECT revision FROM account_credentials WHERE account_id = ? AND version = 1').bind(account.id).first()
  if (!credential) return
  const prepared = await prepareIdentityChallenge(env.DB, { accountId: account.id, purpose: 'password_reset', expectedRevision: credential.revision, now })
  await commitIdentityStatements(env.DB, [prepareIdentityDeliveryReservation(env.DB, { accountId: account.id, subjectId: prepared.value.id, kind: 'password_reset', cooldownSeconds: 0, dailyLimit: config.dailyLimit, now }), ...prepared.statements])
  await deliverPersistedIdentityMessage(env.DB, env, { ...prepared.value, displayName: account.display_name }, { now, fetchImpl })
}

export async function handleGlobalAuthApi(request, env, { waitUntil, now = new Date(), fetchImpl = fetch } = {}) {
  const path = new URL(request.url).pathname
  if (!methods.has(path)) return null
  if (request.method !== methods.get(path)) return response({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }, { status: 405 })
  try {
    assertSameOriginMutation(request)
    if (path === '/api/auth/session') return response(await accountSessionView(env.DB, await authenticateAccountRequest(request, env, now)))
    // Platform selection, like logout, is a bodyless command. Its authority and
    // source scope come solely from the authenticated cookie and context marker.
    const body = request.method === 'POST' && !['/api/auth/logout', '/api/auth/select-platform'].includes(path) ? await readJson(request) : {}
    if (path === '/api/auth/login') return await login(request, env, body, now)
    if (path === '/api/auth/password-recovery') {
      const config = readEmailConfig(env), email = normalizeAccessEmail(body.email)
      if (typeof waitUntil !== 'function') throw unavailableEmailConfig()
      const quota = await reserveIdentityRecovery(env.DB, { email, originKey: request.headers.get('CF-Connecting-IP') || 'unknown', now })
      if (!quota.allowed) throw apiError(429, 'RECOVERY_RATE_LIMITED', 'Muitas solicitações. Aguarde antes de tentar novamente.')
      waitUntil(processRecovery(env, email, config, now, fetchImpl).catch(async () => {
        try { await prepareIdentityAudit(env.DB, { action: 'recovery.processing.failure', result: 'failure', now }).run() } catch { /* No private failure data is logged. */ }
      }))
      return response({ message: RECOVERY_MESSAGE })
    }
    if (path === '/api/auth/email-challenges/inspect') return response(await inspectIdentityChallenge(env.DB, { token: body.token, now }))
    if (path === '/api/auth/email-challenges/complete') return response(await completeIdentityChallenge(env.DB, { token: body.token, password: body.password, now }))
    const context = requireIdentityContext(request, await authenticateAccountRequest(request, env, now))
    if (path === '/api/auth/businesses') return response({ businesses: await listEligibleBusinesses(env.DB, context.accountId) })
    if (path === '/api/auth/logout') {
      await revokeBrowserFamily(env.DB, context, now)
      const result = response({ authenticated: false }, { headers: { 'set-cookie': clearAccountSessionCookie() } })
      result.headers.append('set-cookie', clearSessionCookie())
      return result
    }
    if (path === '/api/auth/select-business' || path === '/api/auth/select-platform') {
      const value = await selectAccountScope(env.DB, context, { scope: path.endsWith('select-platform') ? 'platform' : 'business', businessId: path.endsWith('select-platform') ? null : body.businessId, contextId: body.contextId ?? context.contextId }, now)
      return await sessionResponse(request, env, value, now)
    }
    const value = await changeAccountPassword(env.DB, context, body, now)
    return response({ changed: true, expiresAt: value.expiresAt ?? null }, { headers: { 'set-cookie': value.token ? accountSessionCookie(value.token, value.expiresAt, now) : clearAccountSessionCookie() } })
  } catch (error) { const result = handleError(error); result.headers.set('cache-control', 'no-store'); return result }
}
