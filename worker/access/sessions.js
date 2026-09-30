import { cookieValue, sha256Hex } from '../auth.js'
import { APPLICATION_CAPABILITIES } from '../../shared/settingsAccess.js'
import { loadRoleGrants } from './roles.js'
import { apiError } from '../http.js'

export const SESSION_DURATIONS = Object.freeze({ shared: 12 * 60 * 60, personal: 7 * 24 * 60 * 60 })
export async function loadAuthMode(db, businessId) {
  const row = await db.prepare('SELECT mode FROM business_auth_state WHERE business_id = ? LIMIT 1').bind(businessId).first()
  return ['legacy', 'enrollment', 'user_only'].includes(row?.mode) ? row.mode : null
}
export async function prepareUserSession(db, { businessId, userId, deviceMode = 'shared', now = new Date(), credentialVerifier = null }) {
  if (!Object.hasOwn(SESSION_DURATIONS, deviceMode)) throw apiError(400, 'INVALID_DEVICE_MODE', 'Modo de dispositivo inválido.')
  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  const sessionId = crypto.randomUUID()
  const timestamp = now.toISOString()
  const expiresAt = new Date(now.getTime() + SESSION_DURATIONS[deviceMode] * 1000).toISOString()
  const statement = db.prepare(`INSERT INTO sessions
    (id,business_id,token_hash,created_at,expires_at,last_seen_at,user_id,device_mode)
    SELECT ?,u.business_id,?,?,?,?,u.id,? FROM users u
    JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id AND r.active=1
    JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id AND c.active=1
    JOIN business_auth_state a ON a.business_id=u.business_id AND a.mode IN ('enrollment','user_only')
    WHERE u.business_id=? AND u.id=? AND u.active=1 AND (? IS NULL OR c.password_verifier=?)`)
    .bind(sessionId, await sha256Hex(token), timestamp, expiresAt, timestamp, deviceMode, businessId, userId, credentialVerifier, credentialVerifier)
  return { token, sessionId, expiresAt, statement }
}
export async function createUserSession(env, options) {
  const { token, sessionId, expiresAt, statement } = await prepareUserSession(env.DB, options)
  const result = await statement.run()
  if (result.meta?.changes !== 1) throw apiError(401, 'INVALID_LOGIN', 'Identificador ou senha inválidos.')
  return { token, sessionId, expiresAt }
}
export async function authenticateHumanRequest(request, env, now = new Date()) {
  const token = cookieValue(request, 'amor_session')
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const row = await env.DB.prepare(`SELECT id,business_id,user_id,device_mode,expires_at,revoked_at
    FROM sessions WHERE token_hash = ? LIMIT 1`).bind(await sha256Hex(token)).first()
  if (!row || row.revoked_at || !row.expires_at || !Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= now.getTime()) return null
  const authMode = await loadAuthMode(env.DB, row.business_id)
  if (!authMode) return null
  let context
  if (!row.user_id) {
    if (authMode === 'user_only') return null
    context = { businessId: row.business_id, sessionId: row.id, userId: null, displayName: 'Acesso legado', roleName: null,
      deviceMode: null, authMode, legacy: true, granted: new Set(APPLICATION_CAPABILITIES.filter(c => !c.startsWith('access.'))) }
  } else {
    if (authMode === 'legacy' || !Object.hasOwn(SESSION_DURATIONS, row.device_mode)) return null
    const user = await env.DB.prepare(`SELECT u.display_name,u.role_id,r.name AS role_name FROM users u
      JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id AND r.active=1
      JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id AND c.active=1
      WHERE u.business_id=? AND u.id=? AND u.active=1`).bind(row.business_id, row.user_id).first()
    if (!user) return null
    const granted = await loadRoleGrants(env.DB, row.business_id, user.role_id)
    context = { businessId: row.business_id, userId: row.user_id, sessionId: row.id, displayName: user.display_name,
      roleName: user.role_name, roleId: user.role_id, granted: authMode === 'enrollment' ? new Set([...granted].filter(c => c.startsWith('access.'))) : granted,
      deviceMode: row.device_mode, authMode, legacy: false }
  }
  await env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ? AND business_id = ? AND revoked_at IS NULL')
    .bind(now.toISOString(), row.id, row.business_id).run()
  return context
}
export function prepareUserSessionRevocation(db, businessId, userId, now = new Date()) {
  return db.prepare('UPDATE sessions SET revoked_at = ? WHERE business_id = ? AND user_id = ? AND revoked_at IS NULL')
    .bind(now.toISOString(), businessId, userId)
}
export async function revokeUserSessions(db, businessId, userId, now = new Date()) {
  await prepareUserSessionRevocation(db, businessId, userId, now).run()
}
