import {
  createKitchenTvCredential,
  hashKitchenTvToken,
  kitchenTvPairingExpiresAt,
  kitchenTvSessionCookie,
  readKitchenTvSessionToken,
} from './kitchenTvAuth.js'
import {
  consumeKitchenTvPairing,
  issueKitchenTvPairing,
  loadKitchenTvAccess,
  loadKitchenTvSessionByHash,
  revokeKitchenTvAccess,
  touchKitchenTvSession,
} from './kitchenTvRepository.js'
import { loadKitchenTvState } from './kitchenTvReadRepository.js'
import { apiError, assertSameOriginMutation, json, readJson } from './http.js'
import { requireCapability } from './settingsAccess.js'

const pairingFailure = () => apiError(
  401,
  'KITCHEN_TV_PAIRING_FAILED',
  'Não foi possível configurar esta TV. Gere um novo acesso no Gestão Delivery.',
)
const unauthorized = () => apiError(401, 'KITCHEN_TV_UNAUTHORIZED', 'Este painel não está mais autorizado.')

const settingsPayload = (access) => ({
  configured: Boolean(access?.pairingTokenHash || access?.sessionTokenHash),
  waitingPairing: Boolean(access?.pairingTokenHash),
  paired: Boolean(access?.sessionTokenHash && !access?.revokedAt),
  pairedAt: access?.pairedAt ?? null,
  lastSeenAt: access?.lastSeenAt ?? null,
  revokedAt: access?.revokedAt ?? null,
})

export async function handleKitchenTvAdminApi(request, env, context, url = new URL(request.url), now = new Date()) {
  if (url.pathname === '/api/kitchen-tv/settings' && request.method === 'GET') {
    requireCapability(context, 'orders.settings.view')
    return json(settingsPayload(await loadKitchenTvAccess(env.DB, context.businessId)))
  }
  if (url.pathname === '/api/kitchen-tv/access' && request.method === 'POST') {
    requireCapability(context, 'orders.settings.manage')
    assertSameOriginMutation(request)
    const credential = await createKitchenTvCredential()
    const expiresAt = kitchenTvPairingExpiresAt(now)
    await issueKitchenTvPairing(env.DB, context.businessId, credential.tokenHash, expiresAt, now)
    const pairingUrl = new URL('/cozinha-tv', url.origin)
    pairingUrl.hash = new URLSearchParams({ token: credential.token }).toString()
    return json({ pairingUrl: pairingUrl.toString(), expiresAt: expiresAt.toISOString() }, { status: 201 })
  }
  if (url.pathname === '/api/kitchen-tv/revoke' && request.method === 'POST') {
    requireCapability(context, 'orders.settings.manage')
    assertSameOriginMutation(request)
    return json(settingsPayload(await revokeKitchenTvAccess(env.DB, context.businessId, now)))
  }
  return null
}

export async function handleKitchenTvPublicApi(request, env, url = new URL(request.url), now = new Date()) {
  if (url.pathname === '/api/kitchen-tv/pair' && request.method === 'POST') {
    assertSameOriginMutation(request)
    let token
    try {
      const body = await readJson(request)
      token = typeof body.token === 'string' ? body.token.trim() : ''
    } catch {
      throw pairingFailure()
    }
    if (!token) throw pairingFailure()
    const [pairingHash, sessionCredential] = await Promise.all([
      hashKitchenTvToken(token),
      createKitchenTvCredential(),
    ])
    const access = await consumeKitchenTvPairing(env.DB, pairingHash, sessionCredential.tokenHash, now)
    if (!access) throw pairingFailure()
    return json({ paired: true }, { headers: { 'set-cookie': kitchenTvSessionCookie(sessionCredential.token) } })
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
