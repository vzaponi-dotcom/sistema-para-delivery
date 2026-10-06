import { apiError } from '../http.js'
import { loadAccountSessionRow, prepareSessionSnapshotAssertion, contextChanged } from '../identity/sessions.js'
import { prepareIdentityAssertion, commitIdentityStatements } from '../identity/transactions.js'
import { prepareAuditEvent } from '../access/audit.js'
import { loadRoleGrants } from '../access/roles.js'
import { ELIGIBLE_MANAGER_SQL as capableManager } from './membershipEligibility.js'
export { listEligibleBusinesses } from './eligibleBusinesses.js'

export async function prepareCompanyIssuer(db, context, { businessId, purpose = 'team', capability = null }, now = new Date()) {
  const row = await loadAccountSessionRow(db, context?.identitySessionId, now)
  if (!row || row.account_id !== context.accountId || row.context_id !== context.contextId) throw contextChanged()
  const granted = new Set(JSON.parse(row.role_grants_json)), platformGranted = new Set(JSON.parse(row.platform_grants_json))
  const allowed = purpose === 'first_manager' || purpose === 'team' && capability === 'platform.invitations.resend' && row.scope === 'platform'
    ? row.scope === 'platform' && platformGranted.has(capability || 'platform.businesses.create')
    : row.scope === 'business' && row.business_id === businessId && granted.has(capability || 'access.users.manage')
  if (!allowed) throw apiError(403, 'FORBIDDEN', 'Você não pode administrar estes acessos.')
  return { statement: prepareSessionSnapshotAssertion(db, row, now), snapshot: row, context: { ...context, granted, platformGranted,
    displayName: row.display_name, businessId: row.business_id, userId: row.user_id, sessionId: row.business_session_id } }
}

const memberSelect = `SELECT u.*,r.name AS role_name,a.email_normalized,a.email_verified_at AS account_verified,
  (SELECT max(s.last_seen_at) FROM identity_sessions s WHERE s.business_id = u.business_id AND s.user_id = u.id) AS last_access_at,
  i.id AS invite_id,i.expires_at AS invite_expires_at,i.revoked_at AS invite_revoked_at,i.consumed_at AS invite_consumed_at,i.delivery_status
  FROM users u JOIN accounts a ON a.id = u.account_id JOIN roles r ON r.id = u.role_id AND r.business_id = u.business_id
  LEFT JOIN company_invitations i ON i.id = (SELECT h.id FROM company_invitations h WHERE h.business_id = u.business_id AND h.user_id = u.id ORDER BY h.created_at DESC,h.id DESC LIMIT 1)`
const projectMember = (row, now) => ({ id: row.id, displayName: row.display_name, email: row.email_normalized, emailVerified: Boolean(row.account_verified),
  roleId: row.role_id, roleName: row.role_name, active: row.active === 1, membershipState: row.membership_state,
  credentialState: ['active', 'inactive'].includes(row.membership_state) ? 'active' : 'invited', passwordRecoveryPending: false, lastAccessAt: row.last_access_at,
  invite: row.invite_id && !row.invite_consumed_at ? { id: row.invite_id, purpose: 'company_invitation', expiresAt: row.invite_expires_at,
    status: row.invite_revoked_at ? 'revoked' : Date.parse(row.invite_expires_at) <= now.getTime() ? 'expired' : 'pending', deliveryStatus: row.delivery_status } : null })

export async function loadCompanyMember(db, businessId, userId, now = new Date()) {
  const row = await db.prepare(`${memberSelect} WHERE u.business_id = ? AND u.id = ?`).bind(businessId, userId).first()
  if (!row) throw apiError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.')
  return projectMember(row, now)
}

export async function listCompanyMembers(db, context, now = new Date()) {
  await prepareCompanyIssuer(db, context, { businessId: context.businessId, capability: 'access.users.view' }, now)
  const { results } = await db.prepare(`${memberSelect} WHERE u.business_id = ? ORDER BY u.display_name,u.id`).bind(context.businessId).all()
  const { results: roles } = await db.prepare('SELECT id,code,name,active,is_builtin FROM roles WHERE business_id = ? ORDER BY code').bind(context.businessId).all()
  const summaries = []
  for (const role of roles) summaries.push({ id: role.id, code: role.code, name: role.name, active: role.active === 1, isBuiltin: role.is_builtin === 1, capabilities: [...await loadRoleGrants(db, context.businessId, role.id)].sort() })
  return { users: results.map((row) => projectMember(row, now)), roles: summaries }
}

export async function updateMembership(db, context, userId, input, now = new Date()) {
  const started = performance.now()
  const issuer = await prepareCompanyIssuer(db, context, { businessId: context.businessId }, now)
  const row = await db.prepare('SELECT * FROM users WHERE business_id = ? AND id = ? AND account_id IS NOT NULL').bind(context.businessId, userId).first()
  if (!row) throw apiError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.')
  const keys = Object.keys(input)
  if (!keys.length || keys.some((key) => !['displayName', 'roleId', 'active'].includes(key)) || (Object.hasOwn(input, 'active') && typeof input.active !== 'boolean')) throw apiError(400, 'INVALID_USER_PATCH', 'Informe nome, perfil ou estado ativo válido.')
  const roleId = input.roleId ?? row.role_id
  const role = await db.prepare('SELECT id,version FROM roles WHERE business_id = ? AND id = ? AND active = 1').bind(context.businessId, roleId).first()
  if (!role) throw apiError(404, 'ROLE_NOT_FOUND', 'Perfil não encontrado.')
  const name = input.displayName ?? row.display_name
  if (typeof name !== 'string' || !name.trim() || Array.from(name.trim()).length > 200) throw apiError(400, 'INVALID_USER_INPUT', 'Informe um nome com até 200 caracteres.')
  const active = input.active === undefined ? row.active : input.active ? 1 : 0
  const managerPredicate = `SELECT NOT EXISTS (SELECT 1 FROM businesses b WHERE b.id = ? AND b.access_status = 'active')
    OR NOT EXISTS (SELECT 1 FROM users u JOIN accounts a ON a.id = u.account_id JOIN account_credentials c ON c.account_id = a.id
      JOIN roles r ON r.id = u.role_id AND r.business_id = u.business_id WHERE u.business_id = ? AND u.id = ? AND ${capableManager})
    OR (? = 1 AND EXISTS (SELECT 1 FROM role_capabilities WHERE business_id = ? AND role_id = ? AND capability = 'access.users.manage'))
    OR EXISTS (SELECT 1 FROM users u JOIN accounts a ON a.id = u.account_id JOIN account_credentials c ON c.account_id = a.id
      JOIN roles r ON r.id = u.role_id AND r.business_id = u.business_id WHERE u.business_id = ? AND u.id != ? AND ${capableManager})`
  const managerValues = [context.businessId, context.businessId, userId, active, context.businessId, roleId, context.businessId, userId]
  const managerCheck = await db.prepare(managerPredicate).bind(...managerValues).first()
  if (!Object.values(managerCheck)[0]) throw apiError(409, 'LAST_MANAGER', 'Mantenha pelo menos um gerente ativo.')
  const commitNow = new Date(now.getTime() + Math.max(0, Math.floor(performance.now() - started)))
  const timestamp = commitNow.toISOString()
  // An invitation that was never accepted stays invited when disabled/reactivated.
  const membershipState = row.membership_state === 'invited' ? 'invited' : active ? 'active' : 'inactive'
  const statements = [prepareSessionSnapshotAssertion(db, issuer.snapshot, commitNow),
    prepareIdentityAssertion(db, crypto.randomUUID(), 'SELECT EXISTS(SELECT 1 FROM users WHERE business_id = ? AND id = ? AND account_id = ? AND role_id = ? AND active = ? AND membership_state = ?)', [context.businessId, userId, row.account_id, row.role_id, row.active, row.membership_state]),
    prepareIdentityAssertion(db, crypto.randomUUID(), 'SELECT EXISTS(SELECT 1 FROM roles WHERE business_id = ? AND id = ? AND active = 1 AND version = ?)', [context.businessId, roleId, role.version]),
    prepareIdentityAssertion(db, crypto.randomUUID(), managerPredicate, managerValues),
    db.prepare('UPDATE users SET display_name = ?,role_id = ?,active = ?,membership_state = ?,updated_at = ? WHERE business_id = ? AND id = ?').bind(name.trim(), roleId, active, membershipState, timestamp, context.businessId, userId),
    db.prepare('UPDATE businesses SET management_revision=management_revision+1 WHERE id=?').bind(context.businessId),
  ]
  if (Object.hasOwn(input, 'roleId') || Object.hasOwn(input, 'active')) statements.push(
    db.prepare('UPDATE identity_sessions SET revoked_at = COALESCE(revoked_at,?) WHERE business_id = ? AND user_id = ?').bind(timestamp, context.businessId, userId),
    db.prepare('UPDATE sessions SET revoked_at = COALESCE(revoked_at,?) WHERE business_id = ? AND user_id = ?').bind(timestamp, context.businessId, userId),
    db.prepare('UPDATE company_invitations SET revoked_at = COALESCE(revoked_at,?) WHERE business_id = ? AND user_id = ? AND consumed_at IS NULL').bind(timestamp, context.businessId, userId),
  )
  statements.push(prepareAuditEvent(db, issuer.context, { action: Object.hasOwn(input, 'roleId') ? 'access.user.role-changed' : Object.hasOwn(input, 'active') ? active ? 'access.user.activated' : 'access.user.deactivated' : 'access.user.updated', resourceType: 'user', resourceId: userId, now: commitNow }))
  try { await commitIdentityStatements(db, statements) }
  catch (error) { if (/CHECK constraint failed: ok\s*=\s*1/.test(String(error?.message))) throw apiError(409, 'MEMBERSHIP_CHANGED', 'O acesso mudou. Atualize a tela antes de continuar.'); throw error }
  return { user: await loadCompanyMember(db, context.businessId, userId, now) }
}
