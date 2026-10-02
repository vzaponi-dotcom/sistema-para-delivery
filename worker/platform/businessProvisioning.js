import { apiError } from '../http.js'
import { sha256Hex } from '../auth.js'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { prepareBusinessDefaults } from '../tenancy/businessDefaults.js'
import { prepareMembershipInvitation, deliverPersistedCompanyInvitation } from '../tenancy/companyInvitations.js'
import { prepareCompanyIssuer } from '../tenancy/memberships.js'
import { readEmailConfig } from '../access/emailDelivery.js'
import { loadAccountSessionRow, prepareSessionSnapshotAssertion } from '../identity/sessions.js'
import { commitIdentityStatements } from '../identity/transactions.js'

const changed = () => apiError(409, 'PROVISIONING_CONTEXT_CHANGED', 'Seu acesso mudou. Atualize a sessão antes de criar a empresa.')
const reused = () => apiError(409, 'PROVISIONING_KEY_REUSED', 'Esta tentativa já foi usada com outros dados. Confira a empresa criada.')
const cleanName = value => {
  if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > 200) throw apiError(400, 'INVALID_BUSINESS_INPUT', 'Informe nomes com até 200 caracteres.')
  return value.trim()
}
const receipt = (db, accountId, key) => db.prepare('SELECT payload_hash,business_id FROM platform_provisioning_receipts WHERE account_id = ? AND idempotency_key = ?').bind(accountId, key).first()
async function projection(db, businessId, created) {
  const row = await db.prepare(`SELECT h.id,h.user_id,h.expires_at,h.delivery_status FROM company_invitations h
    WHERE h.business_id = ? AND h.purpose = 'first_manager' ORDER BY h.created_at DESC,h.id DESC LIMIT 1`).bind(businessId).first()
  return { businessId, firstManagerId: row.user_id, invitationId: row.id, created, deliveryStatus: row.delivery_status, expiresAt: row.expires_at }
}

export async function createBusiness(env, platformContext, input, { idempotencyKey, now = new Date(), waitUntil, deliver, monotonicNow = () => performance.now() } = {}) {
  const started = monotonicNow(), db = env.DB
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(idempotencyKey || '')) throw apiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Tentativa de cadastro inválida.')
  if (!input || Object.keys(input).some(key => !['name', 'managerName', 'managerEmail'].includes(key))) throw apiError(400, 'INVALID_BUSINESS_INPUT', 'Dados de cadastro inválidos.')
  const data = { name: cleanName(input.name), managerName: cleanName(input.managerName), managerEmail: normalizeAccessEmail(input.managerEmail) }
  const payloadHash = await sha256Hex(JSON.stringify(data))
  const issuer = await prepareCompanyIssuer(db, platformContext, { purpose: 'first_manager', capability: 'platform.businesses.create' }, now)
  const replay = await receipt(db, platformContext.accountId, idempotencyKey)
  if (replay) {
    if (replay.payload_hash !== payloadHash) throw reused()
    return projection(db, replay.business_id, false)
  }
  if (typeof waitUntil !== 'function') throw apiError(503, 'EXECUTION_CONTEXT_UNAVAILABLE', 'Processamento de convite indisponível. Tente novamente mais tarde.')
  const config = readEmailConfig(env), businessId = crypto.randomUUID()
  const source = await loadAccountSessionRow(db, platformContext.identitySessionId, now)
  if (!source) throw changed()
  const prepared = await prepareMembershipInvitation(db, { businessId, accountEmail: data.managerEmail, displayName: data.managerName, roleId: `${businessId}:manager`, issuer: platformContext, purpose: 'first_manager', creatingBusiness: true, dailyLimit: config.dailyLimit, now })
  const commitNow = new Date(now.getTime() + Math.max(0, Math.floor(monotonicNow() - started)))
  try {
    await commitIdentityStatements(db, [issuer.statement, prepareSessionSnapshotAssertion(db, source, commitNow),
      ...prepareBusinessDefaults(db, { businessId, name: data.name, now }), ...prepared.statements,
      db.prepare('INSERT INTO platform_provisioning_receipts(id,account_id,idempotency_key,payload_hash,business_id,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), platformContext.accountId, idempotencyKey, payloadHash, businessId, commitNow.toISOString()),
      db.prepare("INSERT INTO platform_audit_events(id,account_id,business_id,action,result,created_at) VALUES(?,?,?,'business.created','success',?)").bind(crypto.randomUUID(), platformContext.accountId, businessId, commitNow.toISOString()),
    ])
  } catch (error) {
    // Another identical request may have won while this preparation was awaiting crypto/reads.
    const winner = await receipt(db, platformContext.accountId, idempotencyKey)
    if (winner) {
      if (winner.payload_hash !== payloadHash) throw reused()
      await prepareCompanyIssuer(db, platformContext, { purpose: 'first_manager', capability: 'platform.businesses.create' }, commitNow)
      return projection(db, winner.business_id, false)
    }
    if (/NOT NULL constraint failed: identity_email_deliveries.created_at/.test(String(error?.message))) throw apiError(429, 'EMAIL_DELIVERY_LIMITED', 'Limite de envio atingido. Aguarde antes de criar outra empresa.')
    if (/CHECK constraint failed: ok\s*=\s*1/.test(String(error?.message))) throw changed()
    throw error
  }
  waitUntil(deliverPersistedCompanyInvitation(db, env, prepared.value, { deliver, now }).catch(() => undefined))
  return projection(db, businessId, true)
}
