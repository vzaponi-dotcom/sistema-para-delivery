import { paymentCode } from '../shared/businessPolicies.js'
import { prepareSettingsAssertion } from './settingsTransactions.js'
import { loadPrintingPolicy } from './printSettingsRepository.js'

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

export async function readPaymentMethodExpectations(db, businessId, values) {
  if (!Array.isArray(values) || values.length === 0) throw policyChanged()
  const seen = new Set()
  const codes = values.map((value) => {
    const code = paymentCode(value)
    if (!code || code !== value || seen.has(code)) throw policyChanged()
    seen.add(code)
    return code
  })
  const header = await db.prepare('SELECT revision FROM business_payment_settings WHERE business_id = ? LIMIT 1').bind(businessId).first()
  if (!Number.isSafeInteger(header?.revision) || header.revision < 1) throw policyChanged()
  const methods = []
  for (const code of codes) {
    const row = await db.prepare(`SELECT code, label, active FROM business_payment_methods
      WHERE business_id = ? AND code = ? LIMIT 1`).bind(businessId, code).first()
    if (!row || row.active !== 1 || typeof row.label !== 'string' || !row.label.trim()) throw policyChanged()
    methods.push({ code: row.code, label: row.label })
  }
  return { revision: header.revision, methods }
}
export async function readOrderModalityExpectation(db, businessId, modality) {
  const row = await db.prepare(`SELECT h.revision, m.active
    FROM business_operation_settings h
    LEFT JOIN business_order_modalities m ON m.business_id = h.business_id AND m.code = ?
    WHERE h.business_id = ? LIMIT 1`).bind(modality, businessId).first()
  if (!Number.isSafeInteger(row?.revision) || row.revision < 1 || row.active !== 1) throw policyChanged()
  return { revision: row.revision, modality }
}

export async function readPrintingPolicyExpectation(db, businessId) {
  const policy = await loadPrintingPolicy(db, businessId)
  return { revision: policy.revision, policy: policy.data }
}

export function preparePolicyGuards(db, businessId, expectations, txId) {
  const predicates = []
  const bindings = []
  if (expectations?.paymentMethods) {
    const paymentMethods = expectations.paymentMethods
    if (Array.isArray(paymentMethods.methods)) {
      predicates.push('coalesce((SELECT revision FROM business_payment_settings WHERE business_id = ?), 0) = ?')
      bindings.push(businessId, paymentMethods.revision)
      for (const method of paymentMethods.methods) {
        predicates.push(`EXISTS (SELECT 1 FROM business_payment_methods m
          WHERE m.business_id = ? AND m.code = ? AND m.active = 1)`)
        bindings.push(businessId, method.code)
      }
    } else {
      predicates.push(`EXISTS (SELECT 1 FROM business_payment_settings h
        JOIN business_payment_methods m ON m.business_id = h.business_id
        WHERE h.business_id = ? AND h.revision = ? AND m.code = ? AND m.active = 1)`)
      bindings.push(businessId, paymentMethods.revision, paymentMethods.code)
    }
  }
  if (expectations?.operations) {
    predicates.push(`EXISTS (SELECT 1 FROM business_operation_settings h
      JOIN business_order_modalities m ON m.business_id = h.business_id
      WHERE h.business_id = ? AND h.revision = ? AND m.code = ? AND m.active = 1)`)
    bindings.push(businessId, expectations.operations.revision, expectations.operations.modality)
  }
  if (expectations?.printing) {
    predicates.push(`coalesce((SELECT revision FROM business_print_settings WHERE business_id = ?), 0) = ?`)
    bindings.push(businessId, expectations.printing.revision)
  }
  return predicates.length
    ? [prepareSettingsAssertion(db, txId, 'policy', predicates.map((predicate) => `(${predicate})`).join(' AND '), bindings)]
    : []
}

export function rethrowPolicyChange(error) {
  if (String(error?.message || '').includes('POLICY_CHANGED')) throw policyChanged()
  throw error
}
