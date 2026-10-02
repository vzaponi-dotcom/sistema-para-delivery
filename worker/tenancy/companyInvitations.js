import { apiError } from '../http.js'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { sha256Hex } from '../auth.js'
import { hashHumanPassword } from '../access/credentials.js'
import { prepareAuditEvent } from '../access/audit.js'
import { readEmailConfig } from '../access/emailDelivery.js'
import { prepareAccountCreation, findAccountByEmail } from '../identity/accounts.js'
import { prepareIdentityAssertion, commitIdentityStatements } from '../identity/transactions.js'
import { randomIdentityToken, loadAccountSessionRow, prepareSessionSnapshotAssertion } from '../identity/sessions.js'
import { prepareCredentialChallengeRevocation } from '../identity/challenges.js'
import { prepareIdentityAudit } from '../identity/audit.js'
import { prepareIdentityDeliveryReservation } from '../identity/throttle.js'
import { deliverIdentityMessage } from '../identity/emailMessages.js'
import { prepareCompanyIssuer } from './memberships.js'

export const invalidCompanyInvitation = () => apiError(400, 'INVALID_COMPANY_INVITATION', 'Convite inválido ou expirado. Solicite um novo convite.')
const loginRequired = () => apiError(401, 'INVITATION_LOGIN_REQUIRED', 'Entre com o e-mail que recebeu o convite para aceitar.')
const changedInvitation = () => apiError(409, 'INVITATION_CHANGED', 'O convite mudou. Atualize a tela antes de continuar.')

export async function prepareMembershipInvitation(db, {
  businessId, accountEmail, displayName, roleId, issuer, purpose = 'team', userId = null, now = new Date(),
  dailyLimit = 80, issuerCapability = null, expectedInvitationId = null, creatingBusiness = false,
}) {
  if (!['first_manager', 'team'].includes(purpose)) throw invalidCompanyInvitation()
  accountEmail = normalizeAccessEmail(accountEmail)
  if (typeof displayName !== 'string' || !displayName.trim() || Array.from(displayName.trim()).length > 200) throw apiError(400, 'INVALID_USER_INPUT', 'Informe um nome com até 200 caracteres.')
  const issuing = await prepareCompanyIssuer(db, issuer, { businessId, purpose, capability: issuerCapability }, now)
  let role = await db.prepare(`SELECT r.id,r.version,r.code,r.is_builtin,b.access_status FROM roles r JOIN businesses b ON b.id = r.business_id
    WHERE r.business_id = ? AND r.id = ? AND r.active = 1`).bind(businessId, roleId).first()
  // Only the private provisioner can prepare the built-in first manager before defaults are committed.
  // The role/business assertion below still requires the real rows in the same atomic batch.
  if (!role && creatingBusiness && purpose === 'first_manager' && roleId === `${businessId}:manager`
    && !await db.prepare('SELECT id FROM businesses WHERE id = ?').bind(businessId).first()) {
    role = { id: roleId, version: 1, code: 'manager', is_builtin: 1, access_status: 'pending' }
  }
  if (!role) throw apiError(404, 'ROLE_NOT_FOUND', 'Perfil não encontrado.')
  if ((purpose === 'team' && role.access_status !== 'active') || (purpose === 'first_manager' && (role.access_status !== 'pending' || role.code !== 'manager' || role.is_builtin !== 1))) throw invalidCompanyInvitation()
  const account = await findAccountByEmail(db, accountEmail)
  if (account && account.active !== 1) throw apiError(409, 'ACCOUNT_UNAVAILABLE', 'Não foi possível convidar este e-mail.')
  const existing = await db.prepare('SELECT * FROM users WHERE business_id = ? AND login_normalized = ?').bind(businessId, accountEmail).first()
  if (existing && (!existing.account_id || existing.account_id !== account?.id)) throw apiError(409, 'MEMBERSHIP_MIGRATION_REQUIRED', 'Este cadastro precisa ser preparado para o novo acesso.')
  if (existing?.membership_state === 'active' || existing?.membership_state === 'historical') throw apiError(409, 'MEMBERSHIP_ALREADY_ACTIVE', 'Esta pessoa já aceitou o acesso. Use a gestão de perfil ou a recuperação pessoal de senha.')
  if (expectedInvitationId && existing?.active !== 1) throw apiError(409, 'MEMBERSHIP_INACTIVE', 'Ative este vínculo antes de reenviar o convite.')
  if (expectedInvitationId && (existing.role_id !== roleId || existing.display_name !== displayName.trim())) throw changedInvitation()
  if (userId && existing && userId !== existing.id) throw invalidCompanyInvitation()
  userId = existing?.id || userId || crypto.randomUUID()
  const timestamp = now.toISOString(), invitationId = crypto.randomUUID(), token = randomIdentityToken()
  const expiresAt = new Date(now.getTime() + 24 * 3600_000).toISOString()
  const creation = prepareAccountCreation(db, { email: accountEmail, displayName, now })
  const statements = [issuing.statement,
    prepareIdentityAssertion(db, crypto.randomUUID(), `SELECT EXISTS(SELECT 1 FROM roles r JOIN businesses b ON b.id = r.business_id
      WHERE r.business_id = ? AND r.id = ? AND r.version = ? AND r.active = 1 AND b.access_status = ?
      AND (? != 'first_manager' OR (r.code = 'manager' AND r.is_builtin = 1)))`, [businessId, roleId, role.version, role.access_status, purpose]),
    ...creation.statements,
    prepareIdentityAssertion(db, crypto.randomUUID(), 'SELECT EXISTS(SELECT 1 FROM accounts WHERE email_normalized = ? AND active = 1)', [accountEmail]),
  ]
  if (existing) statements.push(prepareIdentityAssertion(db, crypto.randomUUID(), 'SELECT EXISTS(SELECT 1 FROM users WHERE id = ? AND business_id = ? AND account_id = ? AND membership_state = ? AND role_id = ? AND active = ? AND display_name = ?)', [userId, businessId, existing.account_id, existing.membership_state, existing.role_id, existing.active, existing.display_name]))
  if (expectedInvitationId) statements.push(prepareIdentityAssertion(db, crypto.randomUUID(), `SELECT EXISTS(SELECT 1 FROM company_invitations
    WHERE id = ? AND business_id = ? AND user_id = ? AND consumed_at IS NULL AND id = (SELECT id FROM company_invitations WHERE business_id = ? AND user_id = ? ORDER BY created_at DESC,id DESC LIMIT 1))`, [expectedInvitationId, businessId, userId, businessId, userId]))
  statements.push(existing
    ? expectedInvitationId
      ? db.prepare('UPDATE users SET updated_at = ? WHERE business_id = ? AND id = ?').bind(timestamp, businessId, userId)
      : db.prepare("UPDATE users SET display_name = ?,role_id = ?,active = 1,membership_state = 'invited',email_verified_at = NULL,updated_at = ? WHERE business_id = ? AND id = ?").bind(displayName.trim(), roleId, timestamp, businessId, userId)
    : db.prepare(`INSERT INTO users(id,business_id,display_name,login_normalized,role_id,account_id,membership_state,active,created_at,updated_at)
      VALUES (?,?,?,?,?,(SELECT id FROM accounts WHERE email_normalized = ?),'invited',1,?,?)`).bind(userId, businessId, displayName.trim(), accountEmail, roleId, accountEmail, timestamp, timestamp))
  statements.push(
    prepareIdentityDeliveryReservation(db, { accountEmail, subjectId: invitationId, emitterId: issuer.accountId, businessId, kind: 'company_invitation', dailyLimit, now }),
    db.prepare('UPDATE company_invitations SET revoked_at = COALESCE(revoked_at,?) WHERE business_id = ? AND user_id = ? AND consumed_at IS NULL').bind(timestamp, businessId, userId),
    db.prepare(`INSERT INTO company_invitations(id,business_id,account_id,user_id,email_normalized,role_id,expected_role_version,
      issued_by_account_id,issuer_scope,purpose,token_hash,created_at,expires_at)
      SELECT ?,u.business_id,u.account_id,u.id,?,u.role_id,?,?,?,?,?,?,? FROM users u WHERE u.business_id = ? AND u.id = ?`)
      .bind(invitationId, accountEmail, role.version, issuer.accountId, purpose === 'team' ? 'business' : 'platform', purpose, await sha256Hex(token), timestamp, expiresAt, businessId, userId),
  )
  if (purpose === 'team') statements.push(prepareAuditEvent(db, issuing.context, { action: expectedInvitationId ? 'access.invitation.resent' : 'access.user.created', resourceType: 'user', resourceId: userId, now }))
  return { statements, value: { invitationId, subjectId: invitationId, token, expiresAt, userId, businessId, email: accountEmail, displayName: displayName.trim(), purpose } }
}

const invitationSelect = `SELECT h.*,b.name AS business_name,r.name AS role_name,a.email_verified_at,c.revision AS credential_revision
  FROM company_invitations h JOIN businesses b ON b.id = h.business_id
  JOIN users u ON u.business_id = h.business_id AND u.id = h.user_id AND u.account_id = h.account_id
  JOIN accounts a ON a.id = h.account_id AND a.email_normalized = h.email_normalized
  JOIN roles r ON r.business_id = h.business_id AND r.id = h.role_id
  LEFT JOIN account_credentials c ON c.account_id = a.id
  JOIN accounts issuer ON issuer.id = h.issued_by_account_id
  WHERE h.token_hash = ? AND h.expires_at > ? AND h.consumed_at IS NULL AND h.revoked_at IS NULL
  AND a.active = 1 AND u.active = 1 AND u.membership_state = 'invited' AND u.role_id = h.role_id
  AND r.active = 1 AND r.version = h.expected_role_version AND issuer.active = 1 AND issuer.email_verified_at IS NOT NULL
  AND ((h.purpose = 'team' AND b.access_status = 'active' AND EXISTS (SELECT 1 FROM users iu JOIN roles ir ON ir.id = iu.role_id AND ir.business_id = iu.business_id
    JOIN role_capabilities rc ON rc.business_id = ir.business_id AND rc.role_id = ir.id AND rc.capability = 'access.users.manage'
    WHERE iu.account_id = h.issued_by_account_id AND iu.business_id = h.business_id AND iu.active = 1 AND iu.membership_state = 'active' AND ir.active = 1))
    OR (h.purpose = 'first_manager' AND b.access_status = 'pending' AND r.code = 'manager' AND r.is_builtin = 1
      AND EXISTS (SELECT 1 FROM platform_grants WHERE account_id = h.issued_by_account_id AND capability IN ('platform.businesses.create','platform.invitations.resend'))))
  AND ((a.email_verified_at IS NULL AND c.account_id IS NULL) OR (a.email_verified_at IS NOT NULL AND c.version = 1))`

async function loadInvitation(db, token, now) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalidCompanyInvitation()
  const hash = await sha256Hex(token)
  const row = await db.prepare(invitationSelect).bind(hash, now.toISOString()).first()
  if (!row) throw invalidCompanyInvitation()
  return { row, hash }
}

export async function inspectCompanyInvitation(db, { token, now = new Date() }) {
  const { row } = await loadInvitation(db, token, now)
  return { purpose: 'company_invitation', businessName: row.business_name, roleName: row.role_name, expiresAt: row.expires_at, requiresLogin: row.credential_revision !== null }
}

export async function acceptCompanyInvitation(db, { token, password, context = null, now = new Date(), monotonicNow = () => performance.now() }) {
  const started = monotonicNow()
  const { row, hash } = await loadInvitation(db, token, now)
  if (context && context.accountId !== row.account_id) throw apiError(403, 'INVITATION_ACCOUNT_MISMATCH', 'Entre com o e-mail que recebeu este convite.')
  const existingIdentity = row.credential_revision !== null
  if (existingIdentity && !context) throw loginRequired()
  if (existingIdentity && password !== undefined) throw apiError(400, 'INVITATION_PASSWORD_NOT_ALLOWED', 'Use sua senha atual para entrar e aceitar o convite.')
  const identity = existingIdentity ? await loadAccountSessionRow(db, context.identitySessionId, now) : null
  if (existingIdentity && (!identity || identity.account_id !== row.account_id || identity.context_id !== context.contextId)) throw loginRequired()
  const verifier = existingIdentity ? null : await hashHumanPassword(password)
  const commitNow = new Date(now.getTime() + Math.max(0, Math.floor(monotonicNow() - started))), timestamp = commitNow.toISOString()
  try {
    await commitIdentityStatements(db, [
      prepareIdentityAssertion(db, crypto.randomUUID(), `SELECT EXISTS(${invitationSelect} AND h.id = ? AND h.account_id = ?
        AND (? = 1 OR c.account_id IS NULL))`, [hash, timestamp, row.id, row.account_id, existingIdentity ? 1 : 0]),
      ...(identity ? [prepareSessionSnapshotAssertion(db, identity, commitNow)] : [
        db.prepare('INSERT INTO account_credentials(account_id,password_verifier,version,revision,password_changed_at,created_at,updated_at) VALUES (?,?,1,1,?,?,?)').bind(row.account_id, verifier, timestamp, timestamp, timestamp),
        db.prepare('UPDATE accounts SET email_verified_at = ?,updated_at = ? WHERE id = ?').bind(timestamp, timestamp, row.account_id),
        prepareCredentialChallengeRevocation(db, row.account_id, commitNow),
      ]),
      db.prepare("UPDATE users SET membership_state = 'active',email_verified_at = ?,updated_at = ? WHERE business_id = ? AND id = ?").bind(timestamp, timestamp, row.business_id, row.user_id),
      db.prepare("UPDATE businesses SET access_status = 'active',updated_at = ? WHERE id = ? AND access_status = 'pending'").bind(timestamp, row.business_id),
      db.prepare('UPDATE company_invitations SET consumed_at = ? WHERE id = ?').bind(timestamp, row.id),
      prepareIdentityAudit(db, { accountId: row.account_id, action: 'invitation.accepted', now: commitNow }),
      prepareAuditEvent(db, { businessId: row.business_id, actorType: 'system' }, { action: 'access.invitation.accepted', resourceType: 'user', resourceId: row.user_id, now: commitNow }),
    ])
  } catch (error) {
    if (/CHECK constraint failed: ok\s*=\s*1/.test(String(error?.message))) {
      if (!existingIdentity && await db.prepare('SELECT account_id FROM account_credentials WHERE account_id = ?').bind(row.account_id).first()) throw loginRequired()
      throw invalidCompanyInvitation()
    }
    throw error
  }
  return { accepted: true, businessId: row.business_id }
}

export async function deliverPersistedCompanyInvitation(db, env, message, { deliver = deliverIdentityMessage, now = new Date(), fetchImpl } = {}) {
  const row = await db.prepare('SELECT h.account_id,b.name FROM company_invitations h JOIN businesses b ON b.id = h.business_id WHERE h.id = ? AND h.business_id = ?').bind(message.invitationId, message.businessId).first()
  if (!row) throw invalidCompanyInvitation()
  let result
  try { result = await deliver(env, { ...message, purpose: 'company_invitation', businessName: row.name }, { fetchImpl }) } catch { result = { status: 'uncertain' } }
  const status = ['accepted', 'rejected', 'uncertain'].includes(result?.status) ? result.status : 'uncertain'
  const providerId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(result?.providerId || '') ? result.providerId : null
  await db.prepare("UPDATE company_invitations SET delivery_status = ?,provider_id = ?,revoked_at = CASE WHEN ? = 'rejected' THEN COALESCE(revoked_at,?) ELSE revoked_at END WHERE id = ? AND business_id = ?")
    .bind(status, providerId, status, now.toISOString(), message.invitationId, message.businessId).run()
  return { status, expiresAt: message.expiresAt }
}

export async function resendCompanyInvitation(env, issuer, invitationId, options = {}) {
  const now = options.now || new Date(), db = env.DB
  const row = await db.prepare('SELECT h.*,u.display_name,u.membership_state,u.active AS membership_active,u.role_id AS current_role_id FROM company_invitations h JOIN users u ON u.id = h.user_id AND u.business_id = h.business_id WHERE h.id = ?').bind(invitationId).first()
  if (!row || (issuer.scope === 'business' && issuer.businessId !== row.business_id)) throw apiError(404, 'INVITATION_NOT_FOUND', 'Convite não encontrado.')
  if (row.consumed_at || ['active', 'inactive'].includes(row.membership_state)) throw apiError(409, 'MEMBERSHIP_ALREADY_ACTIVE', 'Este acesso já foi aceito. A senha é recuperada pelo próprio e-mail.')
  if (row.membership_active !== 1) throw apiError(409, 'MEMBERSHIP_INACTIVE', 'Ative este vínculo antes de reenviar o convite.')
  const config = readEmailConfig(env)
  const prepared = await prepareMembershipInvitation(db, { businessId: row.business_id, accountEmail: row.email_normalized, displayName: row.display_name, roleId: row.current_role_id,
    issuer, purpose: row.purpose, userId: row.user_id, expectedInvitationId: row.id, issuerCapability: row.purpose === 'first_manager' ? 'platform.invitations.resend' : null, dailyLimit: config.dailyLimit, now })
  try { await commitIdentityStatements(db, prepared.statements) }
  catch (error) {
    if (/NOT NULL constraint failed: identity_email_deliveries.created_at/.test(String(error?.message))) throw apiError(429, 'EMAIL_DELIVERY_LIMITED', 'Aguarde antes de reenviar o convite.')
    if (/CHECK constraint failed: ok\s*=\s*1/.test(String(error?.message))) throw changedInvitation()
    throw error
  }
  const delivery = await deliverPersistedCompanyInvitation(db, env, prepared.value, { ...options, now })
  return { invitationId: prepared.value.invitationId, userId: prepared.value.userId, expiresAt: prepared.value.expiresAt, delivery }
}
