import { apiError } from '../http.js'
import { sha256Hex } from '../auth.js'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { PLATFORM_CAPABILITIES } from '../../shared/companyAccess.js'
import { isSupportedPasswordVerifier } from '../access/credentials.js'
import { prepareBuiltinRoles } from '../access/roles.js'
import { prepareAccountCreation, findAccountByEmail } from '../identity/accounts.js'
import { prepareIdentityChallenge } from '../identity/challenges.js'
import { randomIdentityToken } from '../identity/sessions.js'
import { prepareIdentityDeliveryReservation } from '../identity/throttle.js'
import { prepareIdentityAssertion, commitIdentityStatements } from '../identity/transactions.js'
import { preparePlatformAudit } from './audit.js'

const unavailable = () => apiError(409, 'MULTI_COMPANY_NOT_READY', 'A preparação mudou ou o acesso ainda não está confirmado.')
const ownership = verified => { if (verified !== true) throw apiError(403, 'OWNERSHIP_REQUIRED', 'Confirme a titularidade antes de preparar o acesso.') }
const guard = (db, sql, values) => prepareIdentityAssertion(db, crypto.randomUUID(), sql, values)
const accountSql = `SELECT a.*,c.password_verifier,c.revision,c.version FROM accounts a LEFT JOIN account_credentials c ON c.account_id=a.id WHERE a.id=?`
const usable = row => row?.active === 1 && !!row.email_verified_at && row.version === 1 && isSupportedPasswordVerifier(row.password_verifier)
const adminScope = accountId => ({ scope: 'platform', accountId })
async function commit(db, statements) {
  try { await commitIdentityStatements(db, statements) } catch (error) {
    if (/CHECK constraint failed|UNIQUE constraint failed/.test(String(error?.message))) throw unavailable()
    if (/NOT NULL constraint failed: identity_email_deliveries.created_at/.test(String(error?.message))) throw apiError(429, 'EMAIL_DELIVERY_LIMITED', 'Aguarde 60 segundos ou confira o limite diário.')
    throw error
  }
}
const adminPredicate = `SELECT EXISTS(SELECT 1 FROM platform_bootstraps p JOIN accounts a ON a.id=p.account_id
  JOIN account_credentials c ON c.account_id=a.id WHERE p.environment='staging' AND a.id=? AND a.active=1
  AND a.email_verified_at IS NOT NULL AND c.version=1 AND c.password_verifier=? AND c.revision=?
  AND (SELECT count(*) FROM platform_grants g WHERE g.account_id=a.id AND g.capability IN ('platform.businesses.view','platform.businesses.create','platform.invitations.resend'))=3)`

export async function preparePlatformAdministrator(db, { name, email, ownershipVerified, now = new Date(), environment = 'staging', dailyLimit = 80 }) {
  ownership(ownershipVerified)
  if (!['staging', 'production'].includes(environment)) throw unavailable()
  email = normalizeAccessEmail(email)
  const creation = prepareAccountCreation(db, { email, displayName: name, now }), timestamp = now.toISOString()
  await commit(db, [...creation.statements,
    db.prepare(`INSERT INTO platform_bootstraps(environment,account_id,created_at,legacy_inventory_json)
      SELECT ?,a.id,?,(SELECT COALESCE(json_group_array(json_object('businessId',business_id,'userId',id)),'[]') FROM users WHERE account_id IS NULL)
      FROM accounts a WHERE a.email_normalized=? ON CONFLICT(environment) DO NOTHING`).bind(environment, timestamp, email),
    guard(db, 'SELECT EXISTS(SELECT 1 FROM platform_bootstraps p JOIN accounts a ON a.id=p.account_id WHERE p.environment=? AND a.email_normalized=? AND a.active=1)', [environment, email]),
    ...PLATFORM_CAPABILITIES.map(capability => db.prepare('INSERT INTO platform_grants(account_id,capability,created_at) SELECT id,?,? FROM accounts WHERE email_normalized=? ON CONFLICT(account_id,capability) DO NOTHING').bind(capability, timestamp, email)),
  ])
  const account = await findAccountByEmail(db, email), row = await db.prepare(accountSql).bind(account.id).first()
  if (row.email_verified_at || row.password_verifier) {
    if (!usable(row)) throw unavailable()
    return { accountId: account.id, activated: true }
  }
  const challenge = await prepareIdentityChallenge(db, { accountId: account.id, purpose: 'activation', now })
  await commit(db, [prepareIdentityDeliveryReservation(db, { accountId: account.id, subjectId: challenge.value.id, kind: 'activation', dailyLimit, now }), ...challenge.statements,
    preparePlatformAudit(db, adminScope(account.id), { action: 'administrator.prepared', now })])
  return { accountId: account.id, activated: false, challenge: { ...challenge.value, displayName: name.trim() } }
}

export async function prepareExistingBusinessManager(db, { businessId, name, email, ownershipVerified, now = new Date(), dailyLimit = 80 }) {
  ownership(ownershipVerified)
  email = normalizeAccessEmail(email)
  const bootstrap = await db.prepare("SELECT * FROM platform_bootstraps WHERE environment='staging'").first()
  const admin = bootstrap && await db.prepare(accountSql).bind(bootstrap.account_id).first()
  if (!usable(admin)) throw unavailable()
  const creation = prepareAccountCreation(db, { email, displayName: name, now })
  // This procedure operates on inventoried fictitious staging identities only.
  // Preserve the old display name/history; retire a conflicting legacy login.
  await commit(db, [guard(db, adminPredicate, [admin.id, admin.password_verifier, admin.revision]), ...creation.statements,
    db.prepare(`UPDATE users SET login_normalized=login_normalized || ':legacy:' || id WHERE business_id=? AND login_normalized=? AND account_id IS NULL
      AND EXISTS(SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.businessId')=users.business_id AND json_extract(j.value,'$.userId')=users.id)`).bind(businessId, email, bootstrap.legacy_inventory_json),
  ])
  const account = await findAccountByEmail(db, email), credential = await db.prepare(accountSql).bind(account.id).first()
  const existing = await db.prepare('SELECT * FROM users WHERE business_id=? AND account_id=?').bind(businessId, account.id).first()
  if (existing?.membership_state === 'active') {
    const readiness = await readMultiCompanyReadiness(db, { adminAccountId: admin.id, managerAccountId: account.id, businessId })
    if (!readiness.ready) throw unavailable()
    return { accountId: account.id, userId: existing.id, activated: true }
  }
  const timestamp = now.toISOString(), userId = existing?.id || crypto.randomUUID(), id = crypto.randomUUID(), token = randomIdentityToken()
  const expiresAt = new Date(now.getTime() + 24 * 3600_000).toISOString(), roleId = `${businessId}:manager`
  const alreadyVerified = usable(credential)
  if ((credential.email_verified_at || credential.password_verifier) && !alreadyVerified) throw unavailable()
  const statements = [guard(db, adminPredicate, [admin.id, admin.password_verifier, admin.revision]),
    guard(db, "SELECT EXISTS(SELECT 1 FROM businesses WHERE id=? AND access_status IN ('legacy','pending'))", [businessId]),
    db.prepare("UPDATE businesses SET access_status='pending',updated_at=? WHERE id=?").bind(timestamp, businessId),
    ...prepareBuiltinRoles(db, businessId, now),
    guard(db, "SELECT EXISTS(SELECT 1 FROM roles WHERE business_id=? AND id=? AND code='manager' AND active=1 AND is_builtin=1)", [businessId, roleId]),
    existing ? db.prepare('UPDATE users SET active=1,role_id=?,display_name=?,updated_at=? WHERE business_id=? AND id=? AND membership_state=\'invited\'').bind(roleId, name.trim(), timestamp, businessId, userId)
      : db.prepare("INSERT INTO users(id,business_id,display_name,login_normalized,role_id,account_id,membership_state,created_at,updated_at) VALUES(?,?,?,?,?,?,'invited',?,?)").bind(userId, businessId, name.trim(), email, roleId, account.id, timestamp, timestamp),
  ]
  if (alreadyVerified) statements.push(
    guard(db, `SELECT EXISTS(SELECT 1 FROM account_credentials c JOIN accounts a ON a.id=c.account_id
      WHERE c.account_id=? AND c.version=1 AND c.revision=? AND c.password_verifier=? AND a.active=1 AND a.email_verified_at IS NOT NULL)`, [account.id, credential.revision, credential.password_verifier]),
    db.prepare("UPDATE users SET membership_state='active',email_verified_at=? WHERE business_id=? AND id=?").bind(timestamp, businessId, userId),
    db.prepare("UPDATE businesses SET access_status='active' WHERE id=?").bind(businessId),
  )
  else statements.push(
    prepareIdentityDeliveryReservation(db, { accountId: account.id, subjectId: id, emitterId: admin.id, businessId, kind: 'company_invitation', dailyLimit, now }),
    db.prepare('UPDATE company_invitations SET revoked_at=COALESCE(revoked_at,?) WHERE business_id=? AND user_id=? AND consumed_at IS NULL').bind(timestamp, businessId, userId),
    db.prepare(`INSERT INTO company_invitations(id,business_id,account_id,user_id,email_normalized,role_id,expected_role_version,issued_by_account_id,issuer_scope,purpose,token_hash,created_at,expires_at)
      SELECT ?,?,?,?,?,?,version,?,'platform','first_manager',?,?,? FROM roles WHERE business_id=? AND id=?`).bind(id, businessId, account.id, userId, email, roleId, admin.id, await sha256Hex(token), timestamp, expiresAt, businessId, roleId),
  )
  statements.push(preparePlatformAudit(db, adminScope(admin.id), { action: 'invitation.issued', businessId, now }))
  await commit(db, statements)
  return { accountId: account.id, userId, activated: alreadyVerified, ...(!alreadyVerified ? { invitation: { invitationId: id, subjectId: id, token, expiresAt, userId, businessId, email, displayName: name.trim(), purpose: 'first_manager' } } : {}) }
}

const managerPredicate = `SELECT EXISTS(SELECT 1 FROM users u JOIN businesses b ON b.id=u.business_id JOIN roles r ON r.id=u.role_id AND r.business_id=u.business_id
  JOIN accounts a ON a.id=u.account_id JOIN account_credentials c ON c.account_id=a.id
  WHERE u.business_id=? AND u.account_id=? AND u.active=1 AND u.membership_state='active' AND b.access_status='active' AND r.active=1
  AND a.active=1 AND a.email_verified_at IS NOT NULL AND c.version=1 AND c.password_verifier=? AND c.revision=?
  AND EXISTS(SELECT 1 FROM role_capabilities rc WHERE rc.role_id=r.id AND rc.business_id=r.business_id AND rc.capability='access.users.manage'))`
export async function readMultiCompanyReadiness(db, { adminAccountId, businessId, managerAccountId }) {
  const admin = await db.prepare(accountSql).bind(adminAccountId).first(), manager = await db.prepare(accountSql).bind(managerAccountId).first()
  const adminResult = usable(admin) ? await db.prepare(adminPredicate).bind(adminAccountId, admin.password_verifier, admin.revision).first() : null
  const adminReady = adminResult && Object.values(adminResult)[0] === 1
  const managerResult = usable(manager) ? await db.prepare(managerPredicate).bind(businessId, managerAccountId, manager.password_verifier, manager.revision).first() : null
  const managerReady = managerResult && Object.values(managerResult)[0] === 1
  return { ready: Boolean(adminReady && managerReady), adminAccountId, businessId, managerAccountId }
}

export async function finalizeMultiCompanyStaging(db, inventory, readiness, { now = new Date() } = {}) {
  if (readiness?.loginVerified !== true) throw unavailable()
  const current = await readMultiCompanyReadiness(db, readiness)
  if (!current.ready) throw unavailable()
  const record = await db.prepare("SELECT * FROM platform_bootstraps WHERE environment='staging' AND account_id=?").bind(current.adminAccountId).first()
  if (!Array.isArray(inventory) || JSON.stringify(inventory) !== record.legacy_inventory_json) throw unavailable()
  const admin = await db.prepare(accountSql).bind(current.adminAccountId).first(), manager = await db.prepare(accountSql).bind(current.managerAccountId).first()
  const timestamp = now.toISOString(), statements = [guard(db, adminPredicate, [admin.id, admin.password_verifier, admin.revision]),
    guard(db, managerPredicate, [current.businessId, manager.id, manager.password_verifier, manager.revision]),
    guard(db, "SELECT EXISTS(SELECT 1 FROM platform_bootstraps WHERE environment='staging' AND account_id=? AND legacy_inventory_json=?)", [admin.id, JSON.stringify(inventory)])]
  if (!record.finalized_at) {
    for (const item of inventory) {
      const target = 'business_id=? AND id=? AND account_id IS NULL'
      statements.push(db.prepare(`UPDATE users SET active=0,updated_at=? WHERE ${target}`).bind(timestamp, item.businessId, item.userId))
      for (const table of ['user_credentials', 'sessions', 'access_invites', 'auth_email_challenges']) {
        const mutation = table === 'user_credentials' ? 'active=0,revision=revision+1,updated_at=?' : 'revoked_at=COALESCE(revoked_at,?)'
        statements.push(db.prepare(`UPDATE ${table} SET ${mutation} WHERE business_id=? AND user_id=? AND EXISTS(SELECT 1 FROM users u WHERE u.business_id=? AND u.id=? AND u.account_id IS NULL)`).bind(timestamp, item.businessId, item.userId, item.businessId, item.userId))
      }
    }
    statements.push(db.prepare('UPDATE sessions SET revoked_at=COALESCE(revoked_at,?) WHERE business_id=? AND user_id IS NULL').bind(timestamp, current.businessId),
      db.prepare("UPDATE business_auth_state SET mode='user_only',updated_at=? WHERE business_id=?").bind(timestamp, current.businessId),
      db.prepare('DELETE FROM auth_credentials WHERE business_id=?').bind(current.businessId),
      db.prepare("UPDATE platform_bootstraps SET finalized_at=? WHERE environment='staging' AND account_id=?").bind(timestamp, admin.id),
      preparePlatformAudit(db, adminScope(admin.id), { action: 'legacy.finalized', businessId: current.businessId, now }))
  }
  await commit(db, statements)
  return { finalized: true, changed: !record.finalized_at }
}

export async function issueVerifiedAccountRecovery(db, { accountId, ownershipVerified, now = new Date() }) {
  ownership(ownershipVerified)
  const account = await db.prepare(accountSql).bind(accountId).first()
  if (!usable(account)) throw unavailable()
  const prepared = await prepareIdentityChallenge(db, { accountId, purpose: 'password_reset', expectedRevision: account.revision, now })
  await commit(db, prepared.statements)
  return prepared.value
}
