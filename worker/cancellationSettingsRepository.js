import { nativeCancellationReasons, parseCatalog } from '../shared/settingsCatalogs.js'
import { clearSettingsAssertions, hashSettingsPayload, prepareSettingsAssertion, readSettingsReceipt, settingsError } from './settingsTransactions.js'

const RESOURCE = 'cancellationReasons'
const NATIVE = nativeCancellationReasons()
const DEFAULT_DATA = { items: NATIVE.items.map(({ id, label, active, sortOrder }) => ({ id, label, active, sortOrder })) }
const NATIVE_BY_ID = new Map(NATIVE.items.map((item) => [item.id, item]))
const unavailable = (cause) => settingsError('SETTINGS_UNAVAILABLE', 503, { cause })
const revisionConflict = () => settingsError('SETTINGS_REVISION_CONFLICT', 409)
const itemUsed = () => settingsError('SETTINGS_ITEM_USED', 409)
const nameKey = (label) => label.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR')

const itemMeta = (items) => Object.fromEntries(items.map(({ id, label, isSystem, requiresNote, firstUsedAt }) => {
  const usedEver = firstUsedAt !== null
  return [id, { label, isSystem, requiresNote, usedEver, canRename: !isSystem && !usedEver, canDelete: !isSystem && !usedEver }]
}))

const defaultMeta = () => itemMeta(NATIVE.items.map((item) => ({ ...item, isSystem: true, firstUsedAt: null })))
const resource = (revision, data, createdAt, updatedAt, items) => ({ resource: RESOURCE, revision, data, meta: { createdAt, updatedAt, items } })

const SELECT_CANCELLATION_REASONS = `SELECT h.business_id, h.revision, h.created_at, h.updated_at,
  (SELECT json_group_array(json_object('id', id, 'label', label, 'nameKey', name_key,
    'active', active, 'isSystem', is_system, 'requiresNote', requires_note,
    'sortOrder', sort_order, 'firstUsedAt', first_used_at))
    FROM (SELECT id, label, name_key, active, is_system, requires_note, sort_order, first_used_at
      FROM business_cancel_reasons WHERE business_id = b.id ORDER BY sort_order)) AS reasons,
  (SELECT count(*) FROM (SELECT mutation_id, payload_hash, committed_revision, committed_at,
    resource_created_at, resource_updated_at FROM settings_mutation_receipts
    WHERE business_id = b.id AND resource_key = 'cancellationReasons')) AS receipt_count,
  (SELECT count(*) FROM (SELECT tx_id, check_key, valid FROM settings_tx_assertions WHERE tx_id = '')) AS assertion_check,
  (SELECT count(*) FROM sqlite_master WHERE type = 'trigger'
    AND name IN ('settings_tx_assertions_insert_guard', 'settings_tx_assertions_update_guard')) AS assertion_guards,
  (SELECT count(*) FROM sqlite_master WHERE type = 'trigger'
    AND name IN ('business_cancel_reasons_usage_guard', 'business_cancel_reasons_identity_guard',
      'business_cancel_reasons_delete_guard')) AS catalog_guards
  FROM businesses b LEFT JOIN business_cancellation_settings h ON h.business_id = b.id WHERE b.id = ?`

function decode(row) {
  if (!row || row.assertion_guards !== 2 || row.catalog_guards !== 3) throw unavailable()
  const reasons = JSON.parse(row.reasons)
  if (row.business_id === null) {
    if (reasons.length || row.receipt_count) throw unavailable()
    return resource(0, DEFAULT_DATA, null, null, defaultMeta())
  }
  const positions = new Set(reasons.map(({ sortOrder }) => sortOrder))
  if (!Number.isSafeInteger(row.revision) || row.revision < 1 ||
      !Number.isFinite(Date.parse(row.created_at)) || !Number.isFinite(Date.parse(row.updated_at)) ||
      reasons.length < NATIVE.items.length || new Set(reasons.map(({ id }) => id)).size !== reasons.length ||
      positions.size !== reasons.length || reasons.some(({ id, label, nameKey: storedNameKey, active,
        isSystem, requiresNote, sortOrder, firstUsedAt }) => {
        const native = NATIVE_BY_ID.get(id)
        return (active !== 0 && active !== 1) || (isSystem !== 0 && isSystem !== 1) ||
          (requiresNote !== 0 && requiresNote !== 1) || !Number.isSafeInteger(sortOrder) || sortOrder < 0 ||
          sortOrder >= reasons.length || storedNameKey !== nameKey(label) ||
          (firstUsedAt !== null && !Number.isFinite(Date.parse(firstUsedAt))) ||
          (native ? isSystem !== 1 || label !== native.label || requiresNote !== Number(native.requiresNote) :
            isSystem !== 0 || requiresNote !== 0)
      }) || NATIVE.items.some(({ id }) => !reasons.some((reason) => reason.id === id))) throw unavailable()

  const existing = reasons.map((reason) => ({ id: reason.id, label: reason.label, active: reason.active === 1,
    sortOrder: reason.sortOrder, usedEver: reason.firstUsedAt !== null }))
  const data = parseCatalog({ items: existing.map(({ id, label, active, sortOrder }) => ({ id, label, active, sortOrder })) },
    { kind: 'cancellation', existing })
  return resource(row.revision, data, row.created_at, row.updated_at,
    itemMeta(reasons.map((reason) => ({ ...reason, isSystem: reason.isSystem === 1, requiresNote: reason.requiresNote === 1 }))))
}

export async function loadCancellationReasons(db, businessId) {
  try { return decode(await db.prepare(SELECT_CANCELLATION_REASONS).bind(businessId).first()) }
  catch (cause) { throw unavailable(cause) }
}

const metadataForData = (data, currentItems) => itemMeta(data.items.map((item) => {
  const current = currentItems[item.id]
  const native = NATIVE_BY_ID.get(item.id)
  return { id: item.id, label: item.label, isSystem: current?.isSystem ?? Boolean(native),
    requiresNote: current?.requiresNote ?? Boolean(native?.requiresNote), firstUsedAt: current?.usedEver ? 'used' : null }
}))

function savedFromReceipt(receipt, payloadHash, data, currentItems) {
  if (receipt.payloadHash !== payloadHash) throw settingsError('SETTINGS_MUTATION_REUSED', 409)
  if (!Number.isFinite(Date.parse(receipt.resourceCreatedAt)) || !Number.isFinite(Date.parse(receipt.resourceUpdatedAt))) throw unavailable()
  return {
    resource: resource(receipt.committedRevision, data, receipt.resourceCreatedAt, receipt.resourceUpdatedAt,
      metadataForData(data, currentItems)),
    receipt: { mutationId: receipt.mutationId, committedRevision: receipt.committedRevision,
      committedAt: receipt.committedAt, replayed: true },
  }
}

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => !['expectedRevision', 'mutationId', 'data'].includes(key)) ||
      !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= Number.MAX_SAFE_INTEGER ||
      typeof input.mutationId !== 'string' || !input.mutationId.trim() || input.mutationId.length > 120) {
    throw settingsError('SETTINGS_INVALID', 400)
  }
}

function parseCancellationData(data, existing) {
  const parsed = parseCatalog(data, { kind: 'cancellation', existing })
  if (parsed.items.some(({ sortOrder }) => sortOrder >= parsed.items.length)) {
    throw settingsError('SETTINGS_INVALID', 400)
  }
  return parsed
}

export async function saveCancellationReasons(db, businessId, input, now = new Date()) {
  validateInput(input)
  const preliminaryData = parseCancellationData(input.data)
  const { expectedRevision, mutationId } = input
  const payloadHash = await hashSettingsPayload({ businessId, resource: RESOURCE, expectedRevision, data: preliminaryData })
  const existingReceipt = await readSettingsReceipt(db, businessId, RESOURCE, mutationId, now)
  const current = await loadCancellationReasons(db, businessId)
  if (existingReceipt) return savedFromReceipt(existingReceipt, payloadHash, preliminaryData, current.meta.items)
  const receiptAfterLoad = await readSettingsReceipt(db, businessId, RESOURCE, mutationId, now)
  if (receiptAfterLoad) return savedFromReceipt(receiptAfterLoad, payloadHash, preliminaryData, current.meta.items)
  const submittedById = new Map(preliminaryData.items.map((item) => [item.id, item]))
  if (current.data.items.some((item) => current.meta.items[item.id].usedEver &&
      (!submittedById.has(item.id) || submittedById.get(item.id).label !== item.label))) throw itemUsed()
  const existing = current.data.items.map((item) => ({ ...item, ...current.meta.items[item.id] }))
  const data = parseCancellationData(input.data, existing)
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
    'coalesce((SELECT revision FROM business_cancellation_settings WHERE business_id = ?), 0) = ?', [businessId, expectedRevision])]

  if (initialize) {
    statements.push(prepareSettingsAssertion(db, txId, 'state',
      `NOT EXISTS (SELECT 1 FROM business_cancel_reasons WHERE business_id = ?)
       AND NOT EXISTS (SELECT 1 FROM settings_mutation_receipts WHERE business_id = ? AND resource_key = 'cancellationReasons')`,
      [businessId, businessId]))
    statements.push(db.prepare('INSERT INTO business_cancellation_settings (business_id, created_at, updated_at) VALUES (?, ?, ?)')
      .bind(businessId, createdAt, updatedAt))
    for (const item of data.items) {
      const native = NATIVE_BY_ID.get(item.id)
      statements.push(db.prepare(`INSERT INTO business_cancel_reasons
        (business_id, id, label, name_key, active, is_system, requires_note, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(businessId, item.id, item.label, nameKey(item.label), Number(item.active), Number(Boolean(native)), Number(Boolean(native?.requiresNote)), item.sortOrder))
    }
  } else if (changed) {
    const nextById = new Map(data.items.map((item) => [item.id, item]))
    const protectedIds = current.data.items.filter((previous) => {
      const next = nextById.get(previous.id)
      return !next || next.label !== previous.label
    }).map(({ id }) => id)
    if (protectedIds.length) {
      const placeholders = protectedIds.map(() => '?').join(', ')
      statements.push(prepareSettingsAssertion(db, txId, 'unused',
        `(SELECT count(*) FROM business_cancel_reasons
          WHERE business_id = ? AND id IN (${placeholders}) AND is_system = 0 AND first_used_at IS NULL) = ?`,
        [businessId, ...protectedIds, protectedIds.length]))
    }
    const renamed = current.data.items.filter((previous) => {
      const next = nextById.get(previous.id)
      return next && next.label !== previous.label
    })
    renamed.forEach((previous, index) => {
      statements.push(db.prepare('UPDATE business_cancel_reasons SET name_key = ? WHERE business_id = ? AND id = ?')
        .bind(`__pending__${txId}-${index}`, businessId, previous.id))
    })
    for (const previous of current.data.items.filter(({ id }) => !nextById.has(id))) {
      statements.push(db.prepare('DELETE FROM business_cancel_reasons WHERE business_id = ? AND id = ?').bind(businessId, previous.id))
    }
    for (const previous of current.data.items) {
      const next = nextById.get(previous.id)
      if (next && (next.label !== previous.label || next.active !== previous.active || next.sortOrder !== previous.sortOrder)) {
        statements.push(db.prepare(`UPDATE business_cancel_reasons SET label = ?, name_key = ?, active = ?, sort_order = ?
          WHERE business_id = ? AND id = ?`)
          .bind(next.label, nameKey(next.label), Number(next.active), next.sortOrder, businessId, next.id))
      }
    }
    const previousIds = new Set(current.data.items.map(({ id }) => id))
    for (const item of data.items.filter(({ id }) => !previousIds.has(id))) {
      statements.push(db.prepare(`INSERT INTO business_cancel_reasons
        (business_id, id, label, name_key, active, is_system, requires_note, sort_order)
        VALUES (?, ?, ?, ?, ?, 0, 0, ?)`)
        .bind(businessId, item.id, item.label, nameKey(item.label), Number(item.active), item.sortOrder))
    }
    statements.push(db.prepare('UPDATE business_cancellation_settings SET revision = ?, updated_at = ? WHERE business_id = ?')
      .bind(committedRevision, updatedAt, businessId))
  }

  statements.push(db.prepare(`INSERT INTO settings_mutation_receipts
    (business_id, resource_key, mutation_id, payload_hash, committed_revision, committed_at, resource_created_at, resource_updated_at)
    VALUES (?, 'cancellationReasons', ?, ?, ?, ?, ?, ?)`)
    .bind(businessId, mutationId, payloadHash, committedRevision, committedAt, createdAt, updatedAt))
  statements.push(clearSettingsAssertions(db, txId), db.prepare(SELECT_CANCELLATION_REASONS).bind(businessId))

  try {
    const results = await db.batch(statements)
    return { resource: decode(results.at(-1).results[0]),
      receipt: { mutationId, committedRevision, committedAt, replayed: false } }
  } catch (cause) {
    const receipt = await readSettingsReceipt(db, businessId, RESOURCE, mutationId, now)
    if (receipt) return savedFromReceipt(receipt, payloadHash, data, current.meta.items)
    if (String(cause?.message).includes('SETTINGS_REVISION_CONFLICT')) throw revisionConflict()
    if (String(cause?.message).includes('SETTINGS_ITEM_USED') || String(cause?.message).includes('SETTINGS_CATALOG_IDENTITY_PROTECTED')) throw itemUsed()
    throw settingsError('SETTINGS_UNAVAILABLE', 503, { cause, outcome: 'unconfirmed' })
  }
}

export function prepareCancellationUse(db, businessId, reasonId, expectedRevision, txId, at) {
  if (typeof businessId !== 'string' || !businessId || typeof reasonId !== 'string' || !reasonId || reasonId.length > 120 ||
      !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || typeof txId !== 'string' || !txId ||
      !(at instanceof Date) || !Number.isFinite(+at)) throw settingsError('SETTINGS_INVALID', 400)
  if (expectedRevision === 0) {
    if (!NATIVE_BY_ID.has(reasonId)) throw settingsError('SETTINGS_INVALID', 400)
    const statements = [
      prepareSettingsAssertion(db, txId, 'policy',
        `coalesce((SELECT revision FROM business_cancellation_settings WHERE business_id = ?), 0) = 0
         AND NOT EXISTS (SELECT 1 FROM business_cancel_reasons WHERE business_id = ?)`, [businessId, businessId]),
      db.prepare('INSERT INTO business_cancellation_settings (business_id, created_at, updated_at) VALUES (?, ?, ?)')
        .bind(businessId, at.toISOString(), at.toISOString()),
    ]
    for (const item of NATIVE.items) {
      statements.push(db.prepare(`INSERT INTO business_cancel_reasons
        (business_id, id, label, name_key, active, is_system, requires_note, sort_order, first_used_at)
        VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?)`)
        .bind(businessId, item.id, item.label, nameKey(item.label), Number(item.requiresNote), item.sortOrder,
          item.id === reasonId ? at.toISOString() : null))
    }
    return statements
  }
  return [
    prepareSettingsAssertion(db, txId, 'policy',
      `EXISTS (SELECT 1 FROM business_cancellation_settings h
        JOIN business_cancel_reasons r ON r.business_id = h.business_id
        WHERE h.business_id = ? AND h.revision = ? AND r.id = ? AND r.active = 1)`,
      [businessId, expectedRevision, reasonId]),
    db.prepare(`UPDATE business_cancel_reasons SET first_used_at = COALESCE(first_used_at, ?)
      WHERE business_id = ? AND id = ?`).bind(at.toISOString(), businessId, reasonId),
  ]
}
