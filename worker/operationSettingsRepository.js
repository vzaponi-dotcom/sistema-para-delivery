import { DEFAULT_OPERATIONS, parseOperations } from '../shared/businessPolicies.js'
import { clearSettingsAssertions, hashSettingsPayload, prepareSettingsAssertion, readSettingsReceipt, settingsError } from './settingsTransactions.js'

const MODALITIES = DEFAULT_OPERATIONS.enabledModalities
const unavailable = (cause) => settingsError('SETTINGS_UNAVAILABLE', 503, { cause })
const revisionConflict = () => settingsError('SETTINGS_REVISION_CONFLICT', 409)
const normalized = (data) => ({ ...data, enabledModalities: MODALITIES.filter((code) => data.enabledModalities.includes(code)) })
const resource = (revision, data, createdAt, updatedAt) => ({ resource: 'operations', revision, data, meta: { createdAt, updatedAt } })

// One SQL snapshot prevents a read of an old header paired with newly committed children.
const SELECT_OPERATIONS = `SELECT h.business_id, h.revision, h.created_at, h.updated_at,
  h.scheduled_prep_lead_minutes, h.scheduled_late_grace_minutes, h.immediate_late_after_minutes,
  h.immediate_very_late_after_minutes, h.default_modality, h.default_active,
  (SELECT json_group_array(json_object('code', code, 'active', active)) FROM business_order_modalities WHERE business_id = b.id) AS modalities,
  (SELECT count(*) FROM (SELECT mutation_id, payload_hash, committed_revision, committed_at, resource_created_at, resource_updated_at
    FROM settings_mutation_receipts WHERE business_id = b.id AND resource_key = 'operations')) AS receipt_count,
  (SELECT count(*) FROM settings_tx_assertions WHERE tx_id = '') AS assertion_check,
  (SELECT count(*) FROM sqlite_master WHERE type = 'trigger' AND name IN ('settings_tx_assertions_insert_guard', 'settings_tx_assertions_update_guard')) AS guards
  FROM businesses b LEFT JOIN business_operation_settings h ON h.business_id = b.id WHERE b.id = ?`

function decode(row) {
  if (!row || row.guards !== 2) throw unavailable()
  const modalities = JSON.parse(row.modalities)
  if (row.business_id === null) {
    if (modalities.length || row.receipt_count) throw unavailable()
    return resource(0, DEFAULT_OPERATIONS, null, null)
  }
  if (!Number.isSafeInteger(row.revision) || row.revision < 1 || row.default_active !== 1 ||
      !Number.isFinite(Date.parse(row.created_at)) || !Number.isFinite(Date.parse(row.updated_at)) ||
      modalities.length !== 3 || new Set(modalities.map(({ code }) => code)).size !== 3 ||
      modalities.some(({ code, active }) => !MODALITIES.includes(code) || (active !== 0 && active !== 1))) throw unavailable()
  const data = parseOperations({ timing: {
    scheduledPrepLeadMinutes: row.scheduled_prep_lead_minutes,
    scheduledLateGraceMinutes: row.scheduled_late_grace_minutes,
    immediateLateAfterMinutes: row.immediate_late_after_minutes,
    immediateVeryLateAfterMinutes: row.immediate_very_late_after_minutes,
  }, enabledModalities: MODALITIES.filter((code) => modalities.some((item) => item.code === code && item.active === 1)), defaultModality: row.default_modality })
  return resource(row.revision, data, row.created_at, row.updated_at)
}

export async function loadOperations(db, businessId) {
  try { return decode(await db.prepare(SELECT_OPERATIONS).bind(businessId).first()) }
  catch (cause) { throw unavailable(cause) }
}

function savedFromReceipt(receipt, payloadHash, data) {
  if (receipt.payloadHash !== payloadHash) throw settingsError('SETTINGS_MUTATION_REUSED', 409)
  if (!Number.isFinite(Date.parse(receipt.resourceCreatedAt)) || !Number.isFinite(Date.parse(receipt.resourceUpdatedAt))) throw unavailable()
  return { resource: resource(receipt.committedRevision, data, receipt.resourceCreatedAt, receipt.resourceUpdatedAt), receipt: {
    mutationId: receipt.mutationId, committedRevision: receipt.committedRevision, committedAt: receipt.committedAt, replayed: true,
  } }
}

// Authentication and authorization are the caller's boundary; businessId is trusted context,
// never client data. This repository intentionally registers no HTTP endpoint.
export async function saveOperations(db, businessId, input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => !['expectedRevision', 'mutationId', 'data'].includes(key)) ||
      !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= Number.MAX_SAFE_INTEGER ||
      typeof input.mutationId !== 'string' || !input.mutationId.trim() || input.mutationId.length > 120) {
    throw settingsError('SETTINGS_INVALID', 400)
  }
  const parsed = parseOperations(input.data) // Complete validation before preparing any SQL.
  const data = normalized(parsed)
  const { expectedRevision, mutationId } = input
  const payloadHash = await hashSettingsPayload({ businessId, resource: 'operations', expectedRevision, data: parsed })
  const existingReceipt = await readSettingsReceipt(db, businessId, 'operations', mutationId, now)
  const current = await loadOperations(db, businessId)
  if (existingReceipt) return savedFromReceipt(existingReceipt, payloadHash, data)
  if (current.revision !== expectedRevision) {
    const racedReceipt = await readSettingsReceipt(db, businessId, 'operations', mutationId, now)
    if (racedReceipt) return savedFromReceipt(racedReceipt, payloadHash, data)
    throw revisionConflict()
  }
  const initialize = current.revision === 0
  const changed = initialize || JSON.stringify(current.data) !== JSON.stringify(data)
  const committedRevision = current.revision + Number(changed)
  const committedAt = now.toISOString()
  const createdAt = current.meta.createdAt ?? committedAt
  const updatedAt = changed ? committedAt : current.meta.updatedAt
  const txId = crypto.randomUUID()
  const statements = [prepareSettingsAssertion(db, txId, 'revision',
    `coalesce((SELECT revision FROM business_operation_settings WHERE business_id = ?), 0) = ?`, [businessId, expectedRevision])]
  if (initialize) {
    statements.push(prepareSettingsAssertion(db, txId, 'state',
      `NOT EXISTS (SELECT 1 FROM business_order_modalities WHERE business_id = ?)
       AND NOT EXISTS (SELECT 1 FROM settings_mutation_receipts WHERE business_id = ? AND resource_key = 'operations')`, [businessId, businessId]))
    statements.push(db.prepare(`INSERT INTO business_operation_settings (business_id, created_at, updated_at) VALUES (?, ?, ?)`).bind(businessId, createdAt, updatedAt))
    for (const code of MODALITIES) statements.push(db.prepare('INSERT INTO business_order_modalities (business_id, code, active) VALUES (?, ?, 1)').bind(businessId, code))
  } else {
    statements.push(prepareSettingsAssertion(db, txId, 'state',
      '(SELECT count(*) FROM business_order_modalities WHERE business_id = ?) = 3', [businessId]))
  }
  if (changed) {
    statements.push(db.prepare(`UPDATE business_operation_settings SET scheduled_prep_lead_minutes = ?, scheduled_late_grace_minutes = ?,
      immediate_late_after_minutes = ?, immediate_very_late_after_minutes = ?, default_modality = ?, revision = ?, updated_at = ? WHERE business_id = ?`)
      .bind(data.timing.scheduledPrepLeadMinutes, data.timing.scheduledLateGraceMinutes, data.timing.immediateLateAfterMinutes,
        data.timing.immediateVeryLateAfterMinutes, data.defaultModality, committedRevision, updatedAt, businessId))
    for (const code of MODALITIES) {
      const active = data.enabledModalities.includes(code)
      if (active !== current.data.enabledModalities.includes(code)) statements.push(db.prepare(
        'UPDATE business_order_modalities SET active = ? WHERE business_id = ? AND code = ?').bind(Number(active), businessId, code))
    }
  }
  statements.push(db.prepare(`INSERT INTO settings_mutation_receipts
    (business_id, resource_key, mutation_id, payload_hash, committed_revision, committed_at, resource_created_at, resource_updated_at)
    VALUES (?, 'operations', ?, ?, ?, ?, ?, ?)`).bind(businessId, mutationId, payloadHash, committedRevision, committedAt, createdAt, updatedAt))
  statements.push(clearSettingsAssertions(db, txId), db.prepare(SELECT_OPERATIONS).bind(businessId))
  try {
    const results = await db.batch(statements)
    return { resource: decode(results.at(-1).results[0]), receipt: { mutationId, committedRevision, committedAt, replayed: false } }
  } catch (cause) {
    // A duplicate receipt/revision race or lost batch response is reconciled by reads only.
    // Never resubmit a mutation batch, even when no receipt has appeared yet.
    const receipt = await readSettingsReceipt(db, businessId, 'operations', mutationId, now)
    if (receipt) return savedFromReceipt(receipt, payloadHash, data)
    if (String(cause?.message).includes('SETTINGS_REVISION_CONFLICT')) throw revisionConflict()
    throw settingsError('SETTINGS_UNAVAILABLE', 503, { cause, outcome: 'unconfirmed' })
  }
}
