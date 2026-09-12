import { DEFAULT_PAYMENT_METHODS, parsePaymentMethods, paymentLabel } from '../shared/businessPolicies.js'
import { clearSettingsAssertions, hashSettingsPayload, prepareSettingsAssertion, readSettingsReceipt, settingsError } from './settingsTransactions.js'

const RESOURCE = 'paymentMethods'
const CODES = DEFAULT_PAYMENT_METHODS.methods.map(({ code }) => code)
const unavailable = (cause) => settingsError('SETTINGS_UNAVAILABLE', 503, { cause })
const revisionConflict = () => settingsError('SETTINGS_REVISION_CONFLICT', 409)
const nameKey = (label) => label.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')

const itemMeta = (methods) => Object.fromEntries(methods.map(({ code, label, isSystem, firstUsedAt }) => [code, {
  label,
  isSystem,
  usedEver: firstUsedAt !== null,
  canRename: false,
  canDelete: false,
}]))

const defaultMeta = () => itemMeta(CODES.map((code) => ({
  code,
  label: paymentLabel(code),
  isSystem: true,
  firstUsedAt: null,
})))

const resource = (revision, data, createdAt, updatedAt, items) => ({
  resource: RESOURCE,
  revision,
  data,
  meta: { createdAt, updatedAt, items },
})

// Header, children, receipt schema and assertion guards are observed in one SQL snapshot.
const SELECT_PAYMENT_METHODS = `SELECT h.business_id, h.revision, h.created_at, h.updated_at,
  h.default_method, h.default_active,
  (SELECT json_group_array(json_object('code', code, 'label', label, 'nameKey', name_key,
    'active', active, 'isSystem', is_system, 'sortOrder', sort_order, 'firstUsedAt', first_used_at))
    FROM (SELECT code, label, name_key, active, is_system, sort_order, first_used_at
      FROM business_payment_methods WHERE business_id = b.id ORDER BY sort_order)) AS methods,
  (SELECT count(*) FROM (SELECT mutation_id, payload_hash, committed_revision, committed_at,
    resource_created_at, resource_updated_at FROM settings_mutation_receipts
    WHERE business_id = b.id AND resource_key = 'paymentMethods')) AS receipt_count,
  (SELECT count(*) FROM (SELECT tx_id, check_key, valid FROM settings_tx_assertions WHERE tx_id = '')) AS assertion_check,
  (SELECT count(*) FROM sqlite_master WHERE type = 'trigger'
    AND name IN ('settings_tx_assertions_insert_guard', 'settings_tx_assertions_update_guard')) AS guards
  FROM businesses b LEFT JOIN business_payment_settings h ON h.business_id = b.id WHERE b.id = ?`

function decode(row) {
  if (!row || row.guards !== 2) throw unavailable()
  const methods = JSON.parse(row.methods)
  if (row.business_id === null) {
    if (methods.length || row.receipt_count) throw unavailable()
    return resource(0, DEFAULT_PAYMENT_METHODS, null, null, defaultMeta())
  }
  if (!Number.isSafeInteger(row.revision) || row.revision < 1 || row.default_active !== 1 ||
      !Number.isFinite(Date.parse(row.created_at)) || !Number.isFinite(Date.parse(row.updated_at)) ||
      methods.length !== CODES.length || new Set(methods.map(({ code }) => code)).size !== CODES.length ||
      methods.some(({ code, label, nameKey: storedNameKey, active, isSystem, sortOrder, firstUsedAt }) => (
        !CODES.includes(code) || label !== paymentLabel(code) || storedNameKey !== nameKey(label) ||
        (active !== 0 && active !== 1) || isSystem !== 1 || !Number.isSafeInteger(sortOrder) ||
        sortOrder < 0 || sortOrder >= CODES.length ||
        (firstUsedAt !== null && !Number.isFinite(Date.parse(firstUsedAt)))
      ))) throw unavailable()

  const data = parsePaymentMethods({
    methods: methods.map(({ code, active, sortOrder }) => ({ code, active: active === 1, sortOrder })),
    defaultMethod: row.default_method,
  })
  return resource(row.revision, data, row.created_at, row.updated_at,
    itemMeta(methods.map((method) => ({ ...method, isSystem: method.isSystem === 1 }))))
}

export async function loadPaymentMethods(db, businessId) {
  try { return decode(await db.prepare(SELECT_PAYMENT_METHODS).bind(businessId).first()) }
  catch (cause) { throw unavailable(cause) }
}

function savedFromReceipt(receipt, payloadHash, data, items) {
  if (receipt.payloadHash !== payloadHash) throw settingsError('SETTINGS_MUTATION_REUSED', 409)
  if (!Number.isFinite(Date.parse(receipt.resourceCreatedAt)) || !Number.isFinite(Date.parse(receipt.resourceUpdatedAt))) throw unavailable()
  return {
    resource: resource(receipt.committedRevision, data, receipt.resourceCreatedAt, receipt.resourceUpdatedAt, items),
    receipt: {
      mutationId: receipt.mutationId,
      committedRevision: receipt.committedRevision,
      committedAt: receipt.committedAt,
      replayed: true,
    },
  }
}

// Authentication and authorization stay at the caller boundary. This repository exposes no route.
export async function savePaymentMethods(db, businessId, input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => !['expectedRevision', 'mutationId', 'data'].includes(key)) ||
      !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= Number.MAX_SAFE_INTEGER ||
      typeof input.mutationId !== 'string' || !input.mutationId.trim() || input.mutationId.length > 120) {
    throw settingsError('SETTINGS_INVALID', 400)
  }
  const data = parsePaymentMethods(input.data)
  const { expectedRevision, mutationId } = input
  const payloadHash = await hashSettingsPayload({ businessId, resource: RESOURCE, expectedRevision, data })
  const existingReceipt = await readSettingsReceipt(db, businessId, RESOURCE, mutationId, now)
  const current = await loadPaymentMethods(db, businessId)
  if (existingReceipt) return savedFromReceipt(existingReceipt, payloadHash, data, current.meta.items)
  if (current.revision !== expectedRevision) {
    const racedReceipt = await readSettingsReceipt(db, businessId, RESOURCE, mutationId, now)
    if (racedReceipt) return savedFromReceipt(racedReceipt, payloadHash, data, current.meta.items)
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
    'coalesce((SELECT revision FROM business_payment_settings WHERE business_id = ?), 0) = ?', [businessId, expectedRevision])]

  if (initialize) {
    statements.push(prepareSettingsAssertion(db, txId, 'state',
      `NOT EXISTS (SELECT 1 FROM business_payment_methods WHERE business_id = ?)
       AND NOT EXISTS (SELECT 1 FROM settings_mutation_receipts WHERE business_id = ? AND resource_key = 'paymentMethods')`,
      [businessId, businessId]))
    statements.push(db.prepare('INSERT INTO business_payment_settings (business_id, created_at, updated_at) VALUES (?, ?, ?)')
      .bind(businessId, createdAt, updatedAt))
    for (const method of DEFAULT_PAYMENT_METHODS.methods) {
      const label = paymentLabel(method.code)
      statements.push(db.prepare(`INSERT INTO business_payment_methods
        (business_id, code, label, name_key, active, is_system, sort_order)
        VALUES (?, ?, ?, ?, 1, 1, ?)`).bind(businessId, method.code, label, nameKey(label), method.sortOrder))
    }
  } else {
    statements.push(prepareSettingsAssertion(db, txId, 'state',
      '(SELECT count(*) FROM business_payment_methods WHERE business_id = ?) = 6', [businessId]))
  }

  if (changed) {
    statements.push(db.prepare(`UPDATE business_payment_settings SET default_method = ?, revision = ?, updated_at = ?
      WHERE business_id = ?`).bind(data.defaultMethod, committedRevision, updatedAt, businessId))
    for (const method of data.methods) {
      const previous = current.data.methods.find(({ code }) => code === method.code)
      if (method.active !== previous?.active || method.sortOrder !== previous?.sortOrder) {
        statements.push(db.prepare(`UPDATE business_payment_methods SET active = ?, sort_order = ?
          WHERE business_id = ? AND code = ?`).bind(Number(method.active), method.sortOrder, businessId, method.code))
      }
    }
  }

  statements.push(db.prepare(`INSERT INTO settings_mutation_receipts
    (business_id, resource_key, mutation_id, payload_hash, committed_revision, committed_at, resource_created_at, resource_updated_at)
    VALUES (?, 'paymentMethods', ?, ?, ?, ?, ?, ?)`)
    .bind(businessId, mutationId, payloadHash, committedRevision, committedAt, createdAt, updatedAt))
  statements.push(clearSettingsAssertions(db, txId), db.prepare(SELECT_PAYMENT_METHODS).bind(businessId))

  try {
    const results = await db.batch(statements)
    return {
      resource: decode(results.at(-1).results[0]),
      receipt: { mutationId, committedRevision, committedAt, replayed: false },
    }
  } catch (cause) {
    const receipt = await readSettingsReceipt(db, businessId, RESOURCE, mutationId, now)
    if (receipt) return savedFromReceipt(receipt, payloadHash, data, current.meta.items)
    if (String(cause?.message).includes('SETTINGS_REVISION_CONFLICT')) throw revisionConflict()
    throw settingsError('SETTINGS_UNAVAILABLE', 503, { cause, outcome: 'unconfirmed' })
  }
}
