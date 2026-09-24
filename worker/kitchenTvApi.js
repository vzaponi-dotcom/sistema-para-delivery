import {
  clearKitchenTvPairingRequestCookie,
  createKitchenTvCredential,
  createKitchenTvPairingCode,
  hashKitchenTvToken,
  kitchenTvPairingExpiresAt,
  kitchenTvPairingRequestCookie,
  kitchenTvSessionCookie,
  readKitchenTvPairingRequestToken,
  readKitchenTvSessionToken,
} from './kitchenTvAuth.js'
import {
  activateKitchenTvApprovedRequest,
  approveKitchenTvPairingCode,
  createKitchenTvPairingRequest,
  loadKitchenTvAccess,
  loadKitchenTvPairingRequestByHash,
  loadKitchenTvPendingApproval,
  loadKitchenTvSessionByHash,
  revokeKitchenTvAccess,
  touchKitchenTvSession,
} from './kitchenTvRepository.js'
import { loadKitchenTvState } from './kitchenTvReadRepository.js'
import { apiError, assertSameOriginMutation, json, readJson } from './http.js'
import { requireCapability } from './settingsAccess.js'

const unauthorized = () => apiError(401, 'KITCHEN_TV_UNAUTHORIZED', 'Este painel não está mais autorizado.')
const pairingExpired = () => apiError(410, 'KITCHEN_TV_PAIRING_EXPIRED', 'O código expirou. Um novo código será gerado.')
const normalizePairingCode = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 6)
const needsLegacySessionTokenFallback = (request) => /\bTizen\b/i.test(request.headers.get('user-agent') || '')

const settingsPayload = (access, pending) => ({
  configured: Boolean(access?.sessionTokenHash || pending),
  waitingPairing: Boolean(pending),
  paired: Boolean(access?.sessionTokenHash && !access?.revokedAt),
  pairedAt: access?.pairedAt ?? null,
  lastSeenAt: access?.lastSeenAt ?? null,
  revokedAt: access?.revokedAt ?? null,
  pairingExpiresAt: pending?.expiresAt ?? null,
})

async function loadSettingsState(db, businessId, now) {
  const [access, pending] = await Promise.all([
    loadKitchenTvAccess(db, businessId),
    loadKitchenTvPendingApproval(db, businessId, now),
  ])
  return settingsPayload(access, pending)
}

async function pairingRequestToken(request) {
  const cookieToken = readKitchenTvPairingRequestToken(request)
  if (request.method !== 'POST') return cookieToken
  assertSameOriginMutation(request)
  try {
    const body = await readJson(request)
    const storedToken = typeof body.requestToken === 'string' ? body.requestToken.trim() : ''
    return storedToken || cookieToken
  } catch {
    return cookieToken
  }
}

export async function handleKitchenTvAdminApi(request, env, context, url = new URL(request.url), now = new Date()) {
  if (url.pathname === '/api/kitchen-tv/settings' && request.method === 'GET') {
    requireCapability(context, 'orders.settings.view')
    return json(await loadSettingsState(env.DB, context.businessId, now))
  }
  if (url.pathname === '/api/kitchen-tv/approve' && request.method === 'POST') {
    requireCapability(context, 'orders.settings.manage')
    assertSameOriginMutation(request)
    const access = await loadKitchenTvAccess(env.DB, context.businessId)
    if (access?.sessionTokenHash && !access.revokedAt) {
      throw apiError(409, 'KITCHEN_TV_ALREADY_PAIRED', 'Revogue a TV atual antes de conectar outra.')
    }
    const body = await readJson(request)
    const code = normalizePairingCode(body.code)
    if (code.length !== 6) throw apiError(400, 'KITCHEN_TV_PAIRING_CODE_INVALID', 'Informe o código de 6 dígitos exibido na TV.')
    const approved = await approveKitchenTvPairingCode(env.DB, code, context.businessId, now)
    if (!approved) throw apiError(404, 'KITCHEN_TV_PAIRING_CODE_INVALID', 'Código inválido ou expirado.')
    return json(await loadSettingsState(env.DB, context.businessId, now))
  }
  if (url.pathname === '/api/kitchen-tv/revoke' && request.method === 'POST') {
    requireCapability(context, 'orders.settings.manage')
    assertSameOriginMutation(request)
    await revokeKitchenTvAccess(env.DB, context.businessId, now)
    return json(await loadSettingsState(env.DB, context.businessId, now))
  }
  return null
}

export async function handleKitchenTvPublicApi(request, env, url = new URL(request.url), now = new Date()) {
  if (url.pathname === '/api/kitchen-tv/pairing-request' && request.method === 'POST') {
    assertSameOriginMutation(request)
    const expiresAt = kitchenTvPairingExpiresAt(now)
    let lastError
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const credential = await createKitchenTvCredential()
      const code = createKitchenTvPairingCode()
      try {
        await createKitchenTvPairingRequest(env.DB, credential.tokenHash, code, expiresAt, now)
        return json({ paired: false, code, expiresAt: expiresAt.toISOString(), requestToken: credential.token }, {
          status: 201,
          headers: { 'set-cookie': kitchenTvPairingRequestCookie(credential.token) },
        })
      } catch (error) {
        lastError = error
        if (!/UNIQUE|pairing_code/i.test(String(error?.message || error))) throw error
      }
    }
    throw apiError(503, 'KITCHEN_TV_PAIRING_UNAVAILABLE', lastError ? 'Não foi possível gerar um código agora.' : 'Pareamento indisponível.')
  }

  if (url.pathname === '/api/kitchen-tv/pairing-status' && ['GET', 'POST'].includes(request.method)) {
    const token = await pairingRequestToken(request)
    if (!token) throw pairingExpired()
    const requestHash = await hashKitchenTvToken(token)
    const pairing = await loadKitchenTvPairingRequestByHash(env.DB, requestHash)
    if (!pairing || pairing.consumedAt || pairing.expiresAt <= now.toISOString()) throw pairingExpired()
    if (!pairing.approvedBusinessId) {
      return json({ paired: false, code: pairing.pairingCode, expiresAt: pairing.expiresAt })
    }

    const sessionCredential = await createKitchenTvCredential()
    const access = await activateKitchenTvApprovedRequest(env.DB, requestHash, sessionCredential.tokenHash, now)
    if (!access) throw pairingExpired()
    const legacySessionTokenFallback = needsLegacySessionTokenFallback(request)
    const headers = new Headers()
    headers.append('set-cookie', kitchenTvSessionCookie(sessionCredential.token))
    if (!legacySessionTokenFallback) headers.append('set-cookie', clearKitchenTvPairingRequestCookie())
    return json(legacySessionTokenFallback
      ? { paired: true, sessionToken: sessionCredential.token }
      : { paired: true }, { headers })
  }

  if (url.pathname === '/api/kitchen-tv/state' && request.method === 'GET') {
    const token = readKitchenTvSessionToken(request)
    if (!token) throw unauthorized()
    const access = await loadKitchenTvSessionByHash(env.DB, await hashKitchenTvToken(token))
    if (!access) throw unauthorized()
    const state = await loadKitchenTvState(env.DB, access.businessId)
    const touched = await touchKitchenTvSession(env.DB, access.businessId, now, 300_000)
    return json({ serverNow: now.toISOString(), ...state }, touched
      ? { headers: { 'set-cookie': kitchenTvSessionCookie(token) } }
      : undefined)
  }
  return null
}
