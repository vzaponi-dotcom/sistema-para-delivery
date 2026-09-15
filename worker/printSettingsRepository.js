import { parsePrintingPolicy } from '../shared/businessPolicies.js'
import { clearSettingsAssertions, hashSettingsPayload, prepareSettingsAssertion, readSettingsReceipt, settingsError } from './settingsTransactions.js'

const unavailable = (cause) => settingsError('SETTINGS_UNAVAILABLE', 503, { cause })
const revisionConflict = () => settingsError('SETTINGS_REVISION_CONFLICT', 409)
const validDate = (value) => Number.isFinite(Date.parse(value))
const DEFAULT_PRINTING_POLICY = Object.freeze({ orderDefaultCopies: 2, tableTabDefaultCopies: 1 })

function validateSaveInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => !['expectedRevision', 'mutationId', 'data'].includes(key)) ||
      !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= Number.MAX_SAFE_INTEGER ||
      typeof input.mutationId !== 'string' || !input.mutationId.trim() || input.mutationId.length > 120) {
    throw settingsError('SETTINGS_INVALID', 400)
  }
}

const replay = (receipt, payloadHash, resource) => {
  if (receipt.payloadHash !== payloadHash) throw settingsError('SETTINGS_MUTATION_REUSED', 409)
  if (!validDate(receipt.resourceCreatedAt) || !validDate(receipt.resourceUpdatedAt)) throw unavailable()
  return { resource: resource(receipt.committedRevision, receipt.resourceCreatedAt, receipt.resourceUpdatedAt), receipt: {
    mutationId: receipt.mutationId, committedRevision: receipt.committedRevision,
    committedAt: receipt.committedAt, replayed: true,
  } }
}

async function failedBatch(db, businessId, resourceKey, mutationId, payloadHash, makeResource, now, cause) {
  const receipt = await readSettingsReceipt(db, businessId, resourceKey, mutationId, now)
  if (receipt) return replay(receipt, payloadHash, makeResource)
  if (String(cause?.message).includes('SETTINGS_REVISION_CONFLICT')) throw revisionConflict()
  throw settingsError('SETTINGS_UNAVAILABLE', 503, { cause, outcome: 'unconfirmed' })
}

const policyResource = (revision, data, createdAt, updatedAt) => ({ resource: 'printingPolicy', revision, data, meta: { createdAt, updatedAt } })
const SELECT_POLICY = `SELECT h.business_id, h.default_copies, h.table_tab_default_copies, h.revision, h.created_at, h.updated_at,
  (SELECT count(*) FROM (SELECT mutation_id, payload_hash, committed_revision, committed_at, resource_created_at, resource_updated_at
    FROM settings_mutation_receipts WHERE business_id = b.id AND resource_key = 'printingPolicy')) AS receipt_count,
  (SELECT count(*) FROM (SELECT tx_id, check_key, valid FROM settings_tx_assertions WHERE tx_id = '')) AS assertion_check,
  (SELECT count(*) FROM sqlite_master WHERE type = 'trigger' AND name IN
    ('settings_tx_assertions_insert_guard', 'settings_tx_assertions_update_guard')) AS guards
  FROM businesses b LEFT JOIN business_print_settings h ON h.business_id = b.id WHERE b.id = ?`

function decodePolicy(row) {
  if (!row || row.guards !== 2) throw unavailable()
  if (row.business_id === null) {
    if (row.receipt_count) throw unavailable()
    return policyResource(0, DEFAULT_PRINTING_POLICY, null, null)
  }
  if (!Number.isSafeInteger(row.revision) || row.revision < 1 || !validDate(row.created_at) || !validDate(row.updated_at)) throw unavailable()
  try {
    return policyResource(row.revision, parsePrintingPolicy({
      orderDefaultCopies: row.default_copies, tableTabDefaultCopies: row.table_tab_default_copies,
    }), row.created_at, row.updated_at)
  } catch (cause) { throw unavailable(cause) }
}

export async function loadPrintingPolicy(db, businessId) {
  try { return decodePolicy(await db.prepare(SELECT_POLICY).bind(businessId).first()) }
  catch (cause) { throw cause?.code === 'SETTINGS_UNAVAILABLE' ? cause : unavailable(cause) }
}

export async function savePrintingPolicy(db, businessId, input, now = new Date()) {
  validateSaveInput(input)
  const data = parsePrintingPolicy(input.data)
  const { expectedRevision, mutationId } = input
  const resourceKey = 'printingPolicy'
  const payloadHash = await hashSettingsPayload({ businessId, resource: resourceKey, expectedRevision, data })
  const existing = await readSettingsReceipt(db, businessId, resourceKey, mutationId, now)
  const current = await loadPrintingPolicy(db, businessId)
  const makeResource = (revision, createdAt, updatedAt) => policyResource(revision, data, createdAt, updatedAt)
  if (existing) return replay(existing, payloadHash, makeResource)
  if (current.revision !== expectedRevision) {
    const raced = await readSettingsReceipt(db, businessId, resourceKey, mutationId, now)
    if (raced) return replay(raced, payloadHash, makeResource)
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
    'coalesce((SELECT revision FROM business_print_settings WHERE business_id = ?), 0) = ?', [businessId, expectedRevision])]
  if (initialize) {
    statements.push(prepareSettingsAssertion(db, txId, 'state', `NOT EXISTS (SELECT 1 FROM settings_mutation_receipts
      WHERE business_id = ? AND resource_key = 'printingPolicy')`, [businessId]))
    statements.push(db.prepare(`INSERT INTO business_print_settings
      (business_id, default_copies, table_tab_default_copies, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(businessId, data.orderDefaultCopies, data.tableTabDefaultCopies, committedRevision, createdAt, updatedAt))
  } else if (changed) {
    statements.push(db.prepare(`UPDATE business_print_settings SET default_copies = ?, table_tab_default_copies = ?, revision = ?, updated_at = ?
      WHERE business_id = ?`).bind(data.orderDefaultCopies, data.tableTabDefaultCopies, committedRevision, updatedAt, businessId))
  }
  statements.push(db.prepare(`INSERT INTO settings_mutation_receipts
    (business_id, resource_key, mutation_id, payload_hash, committed_revision, committed_at, resource_created_at, resource_updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(businessId, resourceKey, mutationId, payloadHash, committedRevision, committedAt, createdAt, updatedAt))
  statements.push(clearSettingsAssertions(db, txId), db.prepare(SELECT_POLICY).bind(businessId))
  try {
    const results = await db.batch(statements)
    return { resource: decodePolicy(results.at(-1).results[0]), receipt: { mutationId, committedRevision, committedAt, replayed: false } }
  } catch (cause) { return failedBatch(db, businessId, resourceKey, mutationId, payloadHash, makeResource, now, cause) }
}

function parseStationConfiguration(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).some((key) => !['name', 'platform', 'autoPrintEnabled'].includes(key))) throw settingsError('SETTINGS_INVALID', 400)
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (!name || name.length > 80 || !['windows', 'android', 'other'].includes(data.platform) || typeof data.autoPrintEnabled !== 'boolean') {
    throw settingsError('SETTINGS_INVALID', 400)
  }
  return Object.freeze({ name, platform: data.platform, autoPrintEnabled: data.autoPrintEnabled })
}

const stationKey = (stationId) => `stationConfiguration:${stationId}`
const stationResource = (stationId, revision, data, createdAt, updatedAt) => ({
  resource: 'stationConfiguration', scopeId: stationId, revision, data, meta: { createdAt, updatedAt },
})
const SELECT_STATION = `SELECT s.id, s.name, s.platform, s.auto_print_enabled, s.config_revision, s.created_at, s.updated_at,
  (SELECT count(*) FROM (SELECT mutation_id, payload_hash, committed_revision, committed_at, resource_created_at, resource_updated_at
    FROM settings_mutation_receipts WHERE business_id = b.id AND resource_key = ?)) AS receipt_count,
  (SELECT count(*) FROM (SELECT tx_id, check_key, valid FROM settings_tx_assertions WHERE tx_id = '')) AS assertion_check,
  (SELECT count(*) FROM sqlite_master WHERE type = 'trigger' AND name IN
    ('settings_tx_assertions_insert_guard', 'settings_tx_assertions_update_guard')) AS guards
  FROM businesses b LEFT JOIN print_stations s ON s.business_id = b.id AND s.id = ? WHERE b.id = ?`

function decodeStation(row, stationId) {
  if (!row || row.guards !== 2) throw unavailable()
  if (row.id === null) {
    if (row.receipt_count) throw unavailable()
    throw settingsError('PRINT_STATION_NOT_FOUND', 404)
  }
  if (!Number.isSafeInteger(row.config_revision) || row.config_revision < 1 || !validDate(row.created_at) || !validDate(row.updated_at)) throw unavailable()
  return stationResource(stationId, row.config_revision, parseStationConfiguration({
    name: row.name, platform: row.platform, autoPrintEnabled: row.auto_print_enabled === 1,
  }), row.created_at, row.updated_at)
}

export async function loadStationConfiguration(db, businessId, stationId) {
  const resourceKey = stationKey(stationId)
  try { return decodeStation(await db.prepare(SELECT_STATION).bind(resourceKey, stationId, businessId).first(), stationId) }
  catch (cause) {
    if (cause?.code === 'PRINT_STATION_NOT_FOUND' || cause?.code === 'SETTINGS_UNAVAILABLE') throw cause
    throw unavailable(cause)
  }
}

export async function saveStationConfiguration(db, businessId, stationId, input, now = new Date()) {
  validateSaveInput(input)
  const data = parseStationConfiguration(input.data)
  const { expectedRevision, mutationId } = input
  const resourceKey = stationKey(stationId)
  const payloadHash = await hashSettingsPayload({ businessId, resource: 'stationConfiguration', scopeId: stationId, expectedRevision, data })
  const existing = await readSettingsReceipt(db, businessId, resourceKey, mutationId, now)
  const current = await loadStationConfiguration(db, businessId, stationId)
  const makeResource = (revision, createdAt, updatedAt) => stationResource(stationId, revision, data, createdAt, updatedAt)
  if (existing) return replay(existing, payloadHash, makeResource)
  if (current.revision !== expectedRevision) {
    const raced = await readSettingsReceipt(db, businessId, resourceKey, mutationId, now)
    if (raced) return replay(raced, payloadHash, makeResource)
    throw revisionConflict()
  }
  const changed = JSON.stringify(current.data) !== JSON.stringify(data)
  const committedRevision = current.revision + Number(changed)
  const committedAt = now.toISOString()
  const createdAt = current.meta.createdAt
  const updatedAt = changed ? committedAt : current.meta.updatedAt
  const txId = crypto.randomUUID()
  const statements = [prepareSettingsAssertion(db, txId, 'revision',
    '(SELECT config_revision FROM print_stations WHERE business_id = ? AND id = ?) = ?', [businessId, stationId, expectedRevision])]
  if (changed) statements.push(db.prepare(`UPDATE print_stations SET name = ?, platform = ?, auto_print_enabled = ?,
    config_revision = ?, updated_at = ? WHERE business_id = ? AND id = ?`).bind(data.name, data.platform,
    Number(data.autoPrintEnabled), committedRevision, updatedAt, businessId, stationId))
  statements.push(db.prepare(`INSERT INTO settings_mutation_receipts
    (business_id, resource_key, mutation_id, payload_hash, committed_revision, committed_at, resource_created_at, resource_updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(businessId, resourceKey, mutationId, payloadHash, committedRevision, committedAt, createdAt, updatedAt))
  statements.push(clearSettingsAssertions(db, txId), db.prepare(SELECT_STATION).bind(resourceKey, stationId, businessId))
  try {
    const results = await db.batch(statements)
    return { resource: decodeStation(results.at(-1).results[0], stationId), receipt: { mutationId, committedRevision, committedAt, replayed: false } }
  } catch (cause) { return failedBatch(db, businessId, resourceKey, mutationId, payloadHash, makeResource, now, cause) }
}

function parseStationPrimary(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some((key) => key !== 'primaryStationId') ||
      typeof data.primaryStationId !== 'string' || !data.primaryStationId.trim() || data.primaryStationId.length > 120) {
    throw settingsError('SETTINGS_INVALID', 400)
  }
  return Object.freeze({ primaryStationId: data.primaryStationId })
}

const primaryResource = (revision, data, createdAt, updatedAt) => ({ resource: 'stationPrimary', revision, data, meta: { createdAt, updatedAt } })
const SELECT_PRIMARY = `SELECT h.business_id, h.primary_station_id, h.revision, h.created_at, h.updated_at,
  (SELECT count(*) FROM print_stations WHERE business_id = b.id AND is_primary = 1) AS primary_count,
  (SELECT id FROM print_stations WHERE business_id = b.id AND is_primary = 1 LIMIT 1) AS flagged_primary_id,
  (SELECT count(*) FROM (SELECT mutation_id, payload_hash, committed_revision, committed_at, resource_created_at, resource_updated_at
    FROM settings_mutation_receipts WHERE business_id = b.id AND resource_key = 'stationPrimary')) AS receipt_count,
  (SELECT count(*) FROM (SELECT tx_id, check_key, valid FROM settings_tx_assertions WHERE tx_id = '')) AS assertion_check,
  (SELECT count(*) FROM sqlite_master WHERE type = 'trigger' AND name IN
    ('settings_tx_assertions_insert_guard', 'settings_tx_assertions_update_guard')) AS guards
  FROM businesses b LEFT JOIN business_print_topology_settings h ON h.business_id = b.id WHERE b.id = ?`

function decodePrimary(row) {
  if (!row || row.guards !== 2) throw unavailable()
  if (row.business_id === null) {
    if (row.receipt_count || row.primary_count) throw unavailable()
    return primaryResource(0, { primaryStationId: null }, null, null)
  }
  if (!Number.isSafeInteger(row.revision) || row.revision < 1 || !validDate(row.created_at) || !validDate(row.updated_at) ||
      (row.primary_station_id === null ? row.primary_count !== 0 : row.primary_count !== 1 || row.flagged_primary_id !== row.primary_station_id)) throw unavailable()
  return primaryResource(row.revision, { primaryStationId: row.primary_station_id }, row.created_at, row.updated_at)
}

export async function loadStationPrimary(db, businessId) {
  try { return decodePrimary(await db.prepare(SELECT_PRIMARY).bind(businessId).first()) }
  catch (cause) { throw cause?.code === 'SETTINGS_UNAVAILABLE' ? cause : unavailable(cause) }
}

export async function saveStationPrimary(db, businessId, input, now = new Date()) {
  validateSaveInput(input)
  const data = parseStationPrimary(input.data)
  const { expectedRevision, mutationId } = input
  const resourceKey = 'stationPrimary'
  const payloadHash = await hashSettingsPayload({ businessId, resource: resourceKey, expectedRevision, data })
  const existing = await readSettingsReceipt(db, businessId, resourceKey, mutationId, now)
  const current = await loadStationPrimary(db, businessId)
  const makeResource = (revision, createdAt, updatedAt) => primaryResource(revision, data, createdAt, updatedAt)
  if (existing) return replay(existing, payloadHash, makeResource)
  if (current.revision !== expectedRevision) {
    const raced = await readSettingsReceipt(db, businessId, resourceKey, mutationId, now)
    if (raced) return replay(raced, payloadHash, makeResource)
    throw revisionConflict()
  }
  const changed = current.data.primaryStationId !== data.primaryStationId
  const committedRevision = current.revision + Number(changed)
  const committedAt = now.toISOString()
  const createdAt = current.meta.createdAt ?? committedAt
  const updatedAt = changed ? committedAt : current.meta.updatedAt
  const txId = crypto.randomUUID()
  const statements = [prepareSettingsAssertion(db, txId, 'revision',
    'coalesce((SELECT revision FROM business_print_topology_settings WHERE business_id = ?), 0) = ?', [businessId, expectedRevision]),
  prepareSettingsAssertion(db, txId, 'state', 'EXISTS (SELECT 1 FROM print_stations WHERE business_id = ? AND id = ?)',
    [businessId, data.primaryStationId])]
  if (current.revision === 0) statements.push(db.prepare(`INSERT INTO business_print_topology_settings
    (business_id, primary_station_id, revision, created_at, updated_at) VALUES (?, NULL, 1, ?, ?)`).bind(businessId, createdAt, updatedAt))
  if (changed) {
    statements.push(db.prepare('UPDATE print_stations SET is_primary = 0 WHERE business_id = ? AND is_primary = 1').bind(businessId))
    statements.push(db.prepare('UPDATE print_stations SET is_primary = 1 WHERE business_id = ? AND id = ?').bind(businessId, data.primaryStationId))
    statements.push(db.prepare(`UPDATE business_print_topology_settings SET primary_station_id = ?, revision = ?, updated_at = ?
      WHERE business_id = ?`).bind(data.primaryStationId, committedRevision, updatedAt, businessId))
  }
  statements.push(db.prepare(`INSERT INTO settings_mutation_receipts
    (business_id, resource_key, mutation_id, payload_hash, committed_revision, committed_at, resource_created_at, resource_updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(businessId, resourceKey, mutationId, payloadHash, committedRevision, committedAt, createdAt, updatedAt))
  statements.push(clearSettingsAssertions(db, txId), db.prepare(SELECT_PRIMARY).bind(businessId))
  try {
    const results = await db.batch(statements)
    return { resource: decodePrimary(results.at(-1).results[0]), receipt: { mutationId, committedRevision, committedAt, replayed: false } }
  } catch (cause) { return failedBatch(db, businessId, resourceKey, mutationId, payloadHash, makeResource, now, cause) }
}
