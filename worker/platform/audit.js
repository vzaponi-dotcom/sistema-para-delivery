import { apiError } from '../http.js'

const actions = new Set(['business.created', 'invitation.issued', 'invitation.resent', 'invitation.delivery.accepted', 'invitation.delivery.rejected', 'invitation.delivery.uncertain', 'administrator.prepared', 'legacy.finalized', 'account.recovery.issued'])
export function preparePlatformAudit(db, context, { action, businessId = null, result = 'success', now = new Date() }) {
  if (context?.scope !== 'platform' || !context.accountId) throw apiError(403, 'FORBIDDEN', 'Evento administrativo inválido.')
  if (!actions.has(action) || !['success', 'denied', 'failure'].includes(result)) throw apiError(400, 'INVALID_PLATFORM_EVENT', 'Evento administrativo inválido.')
  return db.prepare('INSERT INTO platform_audit_events(id,account_id,business_id,action,result,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), context.accountId, businessId, action, result, now.toISOString())
}
