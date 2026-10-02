import { apiError } from '../http.js'

const select = `SELECT b.id,b.name,b.created_at,b.access_status,h.id AS invitation_id,h.expires_at,h.delivery_status,h.revoked_at,h.consumed_at,
  u.id AS member_id,u.display_name,COALESCE(a.email_normalized,u.login_normalized) AS login_normalized,u.membership_state,u.active AS member_active
  FROM businesses b LEFT JOIN company_invitations h ON h.id = (SELECT id FROM company_invitations
    WHERE business_id = b.id AND purpose = 'first_manager' ORDER BY created_at DESC,id DESC LIMIT 1)
  LEFT JOIN users u ON u.id = COALESCE(h.user_id, (SELECT m.id FROM users m
    JOIN roles r ON r.id=m.role_id AND r.business_id=m.business_id
    JOIN accounts linked ON linked.id=m.account_id
    WHERE m.business_id=b.id AND m.membership_state='active' AND m.active=1
      AND r.code='manager' AND r.active=1 AND linked.active=1 AND linked.email_verified_at IS NOT NULL
    ORDER BY m.created_at,m.id LIMIT 1)) AND u.business_id = b.id
  LEFT JOIN accounts a ON a.id=u.account_id`
const invalidPage = () => apiError(400, 'INVALID_BUSINESS_PAGE', 'Busca ou página inválida.')
function project(row, now) {
  const accepted = row.consumed_at || ['active', 'inactive'].includes(row.membership_state)
  return { id: row.id, name: row.name, createdAt: row.created_at, accessStatus: row.access_status,
    firstManager: row.member_id ? { id: row.member_id, name: row.display_name, email: row.login_normalized, membershipState: row.membership_state, active: row.member_active === 1, source: row.invitation_id ? 'invitation' : 'membership' } : null,
    invitation: row.invitation_id ? { id: row.invitation_id, expiresAt: row.expires_at, deliveryStatus: row.delivery_status,
      status: accepted ? 'accepted' : row.revoked_at ? 'revoked' : Date.parse(row.expires_at) <= now.getTime() ? 'expired' : 'pending',
      canResend: row.access_status === 'pending' && row.membership_state === 'invited' && row.member_active === 1 } : null }
}
const encodeCursor = data => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(data)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
function decodeCursor(cursor, query) {
  try {
    if (typeof cursor !== 'string' || cursor.length > 2000 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw invalidPage()
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(cursor.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))))
    if (Object.keys(data).sort().join(',') !== 'createdAt,id,query' || data.query !== query || typeof data.id !== 'string'
      || !data.id || data.id.length > 200 || typeof data.createdAt !== 'string' || new Date(data.createdAt).toISOString() !== data.createdAt) throw invalidPage()
    return data
  } catch { throw invalidPage() }
}
export async function listPlatformBusinesses(db, { query = '', cursor = null, limit = 20, now = new Date() } = {}) {
  if (typeof query !== 'string' || Array.from(query.trim()).length > 200 || !Number.isSafeInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 50) throw invalidPage()
  query = query.trim(); limit = Number(limit)
  const clauses = [], values = []
  if (query) { clauses.push("b.name LIKE ? ESCAPE '\\'"); values.push(`%${query.replace(/[\\%_]/g, c => `\\${c}`)}%`) }
  if (cursor !== null) { const page = decodeCursor(cursor, query); clauses.push('(b.created_at < ? OR (b.created_at = ? AND b.id < ?))'); values.push(page.createdAt, page.createdAt, page.id) }
  const { results } = await db.prepare(`${select} ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY b.created_at DESC,b.id DESC LIMIT ?`).bind(...values, limit + 1).all()
  const items = results.slice(0, limit), last = items.at(-1)
  return { items: items.map(row => project(row, now)), nextCursor: results.length > limit ? encodeCursor({ createdAt: last.created_at, id: last.id, query }) : null }
}
export async function getPlatformBusiness(db, businessId, now = new Date()) {
  if (typeof businessId !== 'string' || !businessId || businessId.length > 200) throw apiError(404, 'BUSINESS_NOT_FOUND', 'Empresa não encontrada.')
  const row = await db.prepare(`${select} WHERE b.id = ?`).bind(businessId).first()
  if (!row) throw apiError(404, 'BUSINESS_NOT_FOUND', 'Empresa não encontrada.')
  const { results } = await db.prepare('SELECT action,result,created_at FROM platform_audit_events WHERE business_id = ? ORDER BY created_at DESC,id DESC LIMIT 20').bind(businessId).all()
  return { ...project(row, now), history: results.map(event => ({ action: event.action, result: event.result, occurredAt: event.created_at })) }
}
