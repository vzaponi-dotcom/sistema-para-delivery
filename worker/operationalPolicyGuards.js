import { paymentCode } from '../shared/businessPolicies.js'
import { prepareSettingsAssertion } from './settingsTransactions.js'

const policyChanged = () => Object.assign(new Error('As configura\u00e7\u00f5es operacionais foram alteradas. Atualize e tente novamente.'), {
  status: 409, code: 'POLICY_CHANGED',
})

export async function readPaymentMethodExpectation(db, businessId, value) {
  const code = paymentCode(value)
  if (!code) throw policyChanged()
  const row = await db.prepare(`SELECT h.revision, m.active
    FROM business_payment_settings h
    LEFT JOIN business_payment_methods m ON m.business_id = h.business_id AND m.code = ?
    WHERE h.business_id = ? LIMIT 1`).bind(code, businessId).first()
  if (!Number.isSafeInteger(row?.revision) || row.revision < 1 || row.active !== 1) throw policyChanged()
  return { revision: row.revision, code }
}

export async function readOrderModalityExpectation(db, businessId, modality) {
  const row = await db.prepare(`SELECT h.revision, m.active
    FROM business_operation_settings h
    LEFT JOIN business_order_modalities m ON m.business_id = h.business_id AND m.code = ?
    WHERE h.business_id = ? LIMIT 1`).bind(modality, businessId).first()
  if (!Number.isSafeInteger(row?.revision) || row.revision < 1 || row.active !== 1) throw policyChanged()
  return { revision: row.revision, modality }
}

export function preparePolicyGuards(db, businessId, expectations, txId) {
  const predicates = []
  const bindings = []
  if (expectations?.paymentMethods) {
    predicates.push(`EXISTS (SELECT 1 FROM business_payment_settings h
      JOIN business_payment_methods m ON m.business_id = h.business_id
      WHERE h.business_id = ? AND h.revision = ? AND m.code = ? AND m.active = 1)`)
    bindings.push(businessId, expectations.paymentMethods.revision, expectations.paymentMethods.code)
  }
  if (expectations?.operations) {
    predicates.push(`EXISTS (SELECT 1 FROM business_operation_settings h
      JOIN business_order_modalities m ON m.business_id = h.business_id
      WHERE h.business_id = ? AND h.revision = ? AND m.code = ? AND m.active = 1)`)
    bindings.push(businessId, expectations.operations.revision, expectations.operations.modality)
  }
  return predicates.length
    ? [prepareSettingsAssertion(db, txId, 'policy', predicates.map((predicate) => `(${predicate})`).join(' AND '), bindings)]
    : []
}

export function rethrowPolicyChange(error) {
  if (String(error?.message || '').includes('POLICY_CHANGED')) throw policyChanged()
  throw error
}
