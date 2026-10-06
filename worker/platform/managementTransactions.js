import { apiError } from '../http.js'
import { sha256Hex } from '../auth.js'
import { prepareIdentityAssertion } from '../identity/transactions.js'
import { prepareSessionSnapshotAssertion } from '../identity/sessions.js'
import { requireCurrentPlatformCapability } from './access.js'
import { preparePlatformAudit } from './audit.js'

export const MANAGEMENT_CAPABILITIES = Object.freeze({suspend:'platform.businesses.manage',resume:'platform.businesses.manage',restore:'platform.businesses.manage',delete:'platform.businesses.delete','membership.revoke':'platform.memberships.manage','membership.reactivate':'platform.memberships.manage','invitation.cancel':'platform.invitations.cancel','invitation.resend':'platform.invitations.resend'})
export const managementChanged = () => apiError(409,'BUSINESS_MANAGEMENT_CHANGED','O cadastro mudou. Atualize os dados e confirme novamente.')
const invalid = () => apiError(400,'INVALID_BUSINESS_MANAGEMENT','Informe motivo, revisão e confirmação válidos.')
export const validManagementKey = key => typeof key === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(key)

export function validateManagementInput(target,input,key) {
  const validId = id => typeof id === 'string' && id.trim() && Array.from(id).length <= 200
  if (!target || !Object.hasOwn(MANAGEMENT_CAPABILITIES,target.operation) || !validId(target.businessId) || !validManagementKey(key)
    || target.operation.startsWith('membership.') && !validId(target.userId) || target.operation.startsWith('invitation.') && !validId(target.invitationId)
    || !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['reason','expectedRevision',...(target.operation === 'delete' ? ['confirmationName'] : [])].includes(k))
    || typeof input.reason !== 'string' || Array.from(input.reason.trim()).length < 3 || Array.from(input.reason.trim()).length > 500
    || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
    || target.operation === 'delete' && (typeof input.confirmationName !== 'string' || input.confirmationName.length > 400)) throw invalid()
  return {reason:input.reason.trim(),expectedRevision:input.expectedRevision,...(target.operation === 'delete' ? {confirmationName:input.confirmationName.trim().normalize('NFC')} : {})}
}

export async function prepareManagementTransaction(db,context,target,input,{idempotencyKey,now=new Date(),monotonicNow=()=>performance.now()}={}) {
  const started=monotonicNow(), normalized=validateManagementInput(target,input,idempotencyKey)
  const current=await requireCurrentPlatformCapability(db,context,MANAGEMENT_CAPABILITIES[target.operation],now)
  const payloadHash=await sha256Hex(JSON.stringify({businessId:target.businessId,operation:target.operation,userId:target.userId||null,invitationId:target.invitationId||null,input:normalized}))
  const receipt=await db.prepare('SELECT business_id,operation,payload_hash,result_json FROM platform_management_receipts WHERE account_id=? AND idempotency_key=?').bind(context.accountId,idempotencyKey).first()
  if (receipt) {
    if (receipt.payload_hash!==payloadHash || receipt.business_id!==target.businessId || receipt.operation!==target.operation) throw managementChanged()
    await requireCurrentPlatformCapability(db,context,MANAGEMENT_CAPABILITIES[target.operation],now)
    return {replay:JSON.parse(receipt.result_json)}
  }
  const company=await db.prepare('SELECT id,name,access_status,lifecycle_status,management_revision FROM businesses WHERE id=?').bind(target.businessId).first()
  if (!company) throw apiError(404,'BUSINESS_NOT_FOUND','Empresa não encontrada.')
  if (company.management_revision!==normalized.expectedRevision) throw managementChanged()
  const commitNow=()=>new Date(now.getTime()+Math.max(0,Math.floor(monotonicNow()-started)))
  return {replay:null,company,snapshot:current.snapshot,context:current.context,target,input:normalized,idempotencyKey,payloadHash,commitNow,
    statements:[prepareSessionSnapshotAssertion(db,current.snapshot,commitNow()),prepareIdentityAssertion(db,crypto.randomUUID(),
      'SELECT EXISTS(SELECT 1 FROM businesses WHERE id=? AND management_revision=? AND lifecycle_status=? AND access_status=? AND name=?)',
      [company.id,company.management_revision,company.lifecycle_status,company.access_status,company.name])],
  }
}

export function prepareManagementCompletion(db,prepared,result,audit,now) {
  return [db.prepare('UPDATE businesses SET management_revision=management_revision+1,updated_at=? WHERE id=? AND management_revision=?').bind(now.toISOString(),prepared.company.id,prepared.company.management_revision),
    db.prepare('INSERT INTO platform_management_receipts(id,account_id,business_id,operation,idempotency_key,payload_hash,result_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),prepared.context.accountId,prepared.company.id,prepared.target.operation,prepared.idempotencyKey,prepared.payloadHash,JSON.stringify(result),now.toISOString()),
    preparePlatformAudit(db,prepared.context,{...audit,businessId:prepared.company.id,reason:prepared.input.reason,now,metadata:{...audit.metadata,managementRevision:result.managementRevision}}),
  ]
}
