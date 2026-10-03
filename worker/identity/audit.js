import { apiError } from '../http.js'

const ACTIONS = new Set([
  'login.success', 'login.failure', 'login.blocked', 'recovery.requested', 'recovery.processing.failure',
  'challenge.issued', 'challenge.completed', 'challenge.delivery.accepted', 'challenge.delivery.rejected', 'challenge.delivery.uncertain',
  'password.changed', 'session.created', 'session.selected', 'session.revoked', 'invitation.accepted',
])

export function prepareIdentityAudit(db, { accountId = null, sessionId = null, action, result = 'success', now = new Date() }) {
  if (!ACTIONS.has(action) || !['success', 'denied', 'failure'].includes(result)) throw apiError(400, 'INVALID_IDENTITY_EVENT', 'Evento de identidade inválido.')
  return db.prepare('INSERT INTO identity_audit_events(id,account_id,session_id,action,result,created_at) VALUES (?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), accountId, sessionId, action, result, now.toISOString())
}
