import { DEFAULT_OPERATIONS } from '../../shared/businessPolicies.js'
import { loadOperations, saveOperations } from '../operationSettingsRepository.js'
import { readSettingsReceipt } from '../settingsTransactions.js'

const equal = (actual, expected, message) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify({ actual, expected })}`)
}
async function rejects(action, code, status) {
  try { await action() } catch (error) { equal([error.code, error.status], [code, status], 'rejection'); return error }
  throw new Error(`Expected ${code}`)
}
const value = (modality = 'Local') => ({ timing: { ...DEFAULT_OPERATIONS.timing, scheduledPrepLeadMinutes: 60 }, enabledModalities: [modality], defaultModality: modality })
const input = (mutationId, expectedRevision, data = value()) => ({ mutationId, expectedRevision, data })
const PRINT_BUSINESS = 'amor-e-sabor'
const PRINT_EARLY = '2026-01-01T10:00:00.000Z'
const PRINT_LATE = '2026-01-02T11:12:13.000Z'

const printStatement = (db, sql, ...values) => db.prepare(sql).bind(...values)

function printJob(status, index) {
  return {
    id: `probe-print-job-${status}`,
    orderId: `probe-print-order-${status}`,
    status,
    trigger: index === 0 ? 'automatic' : 'manual',
    priority: index % 2,
    parentJobId: index === 1 ? 'probe-print-job-pending' : null,
    copiesRequested: status === 'awaiting_second_copy' ? 2 : 1,
    copiesPrinted: status === 'awaiting_second_copy' ? 1 : status === 'printed' ? 1 : 0,
    snapshot: JSON.stringify({ status, document: `probe-snapshot-${index}` }),
    processingStartedAt: index > 0 ? PRINT_LATE : null,
    processedAt: ['printed', 'failed', 'discarded'].includes(status) ? PRINT_LATE : null,
    discardedAt: status === 'discarded' ? PRINT_LATE : null,
    attentionReason: status === 'requires_attention' ? 'paper-out' : null,
    actor: index % 2 ? 'Operador sintético' : null,
    actionAt: index % 2 ? PRINT_LATE : null,
    errorCode: ['failed', 'requires_attention'].includes(status) ? 'SYNTHETIC_ERROR' : null,
    errorMessage: ['failed', 'requires_attention'].includes(status) ? 'Synthetic failure' : null,
    promptedAt: status === 'awaiting_second_copy' ? PRINT_LATE : null,
    requestedAt: status === 'awaiting_second_copy' ? PRINT_LATE : null,
    skippedAt: status === 'discarded' ? PRINT_LATE : null,
  }
}

function insertPrintJob(db, job, overrides = {}) {
  const row = { ...job, tableTabId: null, type: 'order', stationId: 'probe-print-station-primary', ...overrides }
  return printStatement(db, `INSERT INTO print_jobs (
    id, business_id, order_id, table_tab_id, type, trigger, status, priority, parent_job_id,
    copies_requested, copies_printed, station_id, snapshot_json, created_at, available_at,
    processing_started_at, processed_at, discarded_at, attention_reason, action_actor_label,
    action_at, last_error_code, last_error_message, second_copy_prompted_at,
    second_copy_requested_at, second_copy_skipped_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  row.id, PRINT_BUSINESS, row.orderId, row.tableTabId, row.type, row.trigger, row.status, row.priority,
  row.parentJobId, row.copiesRequested, row.copiesPrinted, row.stationId, row.snapshot, PRINT_EARLY,
  PRINT_EARLY, row.processingStartedAt, row.processedAt, row.discardedAt, row.attentionReason,
  row.actor, row.actionAt, row.errorCode, row.errorMessage, row.promptedAt, row.requestedAt, row.skippedAt)
}

async function snapshotPrintContext(db) {
  const queries = [
    "SELECT * FROM print_jobs WHERE id LIKE 'probe-print-%' ORDER BY id",
    "SELECT * FROM print_job_attempts WHERE id LIKE 'probe-print-%' ORDER BY id",
    "SELECT * FROM print_stations WHERE id LIKE 'probe-print-%' ORDER BY id",
    'SELECT * FROM business_print_topology_settings WHERE business_id = ? ORDER BY business_id',
    `SELECT type, name, tbl_name, sql FROM sqlite_schema
      WHERE type IN ('index', 'trigger') AND tbl_name IN ('print_jobs', 'print_job_attempts', 'print_stations')
        AND sql IS NOT NULL ORDER BY type, name`,
  ]
  const results = await db.batch(queries.map((sql, index) => index === 3
    ? db.prepare(sql).bind(PRINT_BUSINESS) : db.prepare(sql)))
  return results.map(({ results: resultRows }) => resultRows)
}

async function seedPrintContextHistory(db) {
  const statuses = ['pending', 'processing', 'awaiting_confirmation', 'awaiting_second_copy', 'printed', 'failed', 'requires_attention', 'discarded']
  const statements = []
  statuses.forEach((status, index) => statements.push(printStatement(db, `INSERT INTO orders (
    id, business_id, client_name_snapshot, type, order_date, status, subtotal_cents,
    total_cents, delivery_fee_cents, created_at
  ) VALUES (?, ?, ?, 'Entrega', '2026-01-01', 'Finalizado', ?, ?, 0, ?)`,
  `probe-print-order-${status}`, PRINT_BUSINESS, `Cliente ${status}`, 1000 + index, 1000 + index, PRINT_EARLY)))
  statements.push(printStatement(db, `INSERT INTO table_tabs (
    id, business_id, table_identifier, status, opened_at, closed_at, created_at, updated_at, tab_number
  ) VALUES (?, ?, ?, 'closed', ?, ?, ?, ?, 17)`,
  'probe-print-tab-17', PRINT_BUSINESS, 'Mesa 17', PRINT_EARLY, PRINT_LATE, PRINT_EARLY, PRINT_LATE))
  statements.push(printStatement(db, `INSERT INTO print_stations (
    id, business_id, name, platform, is_primary, auto_print_enabled, default_copies,
    last_seen_at, created_at, updated_at, qz_ready, printer_ready, last_ready_at,
    physical_state, physical_status_text, physical_status_code, physical_status_at,
    last_offline_at, recovery_state, config_revision
  ) VALUES (?, ?, ?, 'windows', 1, 1, 2, ?, ?, ?, 1, 1, ?, 'ready', 'Ready', 200, ?, ?, 'active', 4)`,
  'probe-print-station-primary', PRINT_BUSINESS, 'Caixa sintético', PRINT_LATE, PRINT_EARLY,
  PRINT_LATE, PRINT_LATE, PRINT_LATE, PRINT_EARLY))
  statements.push(printStatement(db, `INSERT INTO print_stations (
    id, business_id, name, platform, is_primary, auto_print_enabled, default_copies,
    created_at, updated_at, qz_ready, printer_ready, physical_state, recovery_state, config_revision
  ) VALUES (?, ?, ?, 'windows', 0, 0, 1, ?, ?, 0, 0, 'printer_offline', 'deferred', 2)`,
  'probe-print-station-secondary', PRINT_BUSINESS, 'Cozinha sintética', PRINT_EARLY, PRINT_LATE))
  statements.push(printStatement(db, `UPDATE business_print_topology_settings
    SET primary_station_id = ?, revision = 3 WHERE business_id = ?`, 'probe-print-station-primary', PRINT_BUSINESS))
  statuses.forEach((status, index) => statements.push(insertPrintJob(db, printJob(status, index))))
  statements.push(insertPrintJob(db, printJob('printed', 8), {
    id: 'probe-print-job-table-tab', orderId: null, tableTabId: 'probe-print-tab-17',
    type: 'table-tab', trigger: 'manual', copiesRequested: 1, copiesPrinted: 1,
    snapshot: JSON.stringify({ type: 'table-tab', tableTab: { id: 'probe-print-tab-17', number: 17 } }),
  }))
  statements.push(insertPrintJob(db, printJob('printed', 9), {
    id: 'probe-print-job-test', orderId: null, tableTabId: null, type: 'test', trigger: 'manual',
    copiesRequested: 1, copiesPrinted: 1, snapshot: JSON.stringify({ type: 'test' }),
  }))
  const attemptStatuses = ['prepared', 'submitting', 'spooling', 'printing', 'complete', 'failed', 'unknown']
  attemptStatuses.forEach((status, index) => statements.push(printStatement(db, `INSERT INTO print_job_attempts (
    id, business_id, job_id, copy_number, attempt_number, station_id, spool_job_name,
    spool_job_id, status, submission_started_at, submitted_at, last_event_at, completed_at,
    resolution, resolution_actor_label, resolved_at, last_error_code, last_error_message,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  `probe-print-attempt-${status}`, PRINT_BUSINESS, printJob(statuses[index], index).id,
  index === 4 ? 2 : 1, index + 1, index === 6 ? 'probe-print-station-secondary' : 'probe-print-station-primary',
  `probe-spool-${status}`, 700 + index, status, index > 0 ? PRINT_EARLY : null,
  index > 1 ? PRINT_EARLY : null, index > 2 ? PRINT_LATE : null, status === 'complete' ? PRINT_LATE : null,
  status === 'unknown' ? 'manual_not_printed' : null, status === 'unknown' ? 'Operador sintético' : null,
  status === 'unknown' ? PRINT_LATE : null, status === 'failed' ? 'SPOOL_FAILED' : null,
  status === 'failed' ? 'Synthetic spool failure' : null, PRINT_EARLY, PRINT_LATE)))
  statements.push(printStatement(db, 'UPDATE print_stations SET recovery_job_id = ? WHERE id = ?',
    'probe-print-job-awaiting_second_copy', 'probe-print-station-primary'))
  await db.batch(statements)
}

async function rejectsPrintJob(db, overrides) {
  try { await insertPrintJob(db, printJob('pending', 20), { id: `probe-print-invalid-${crypto.randomUUID()}`, ...overrides }).run() }
  catch { return }
  throw new Error(`Invalid print job was accepted: ${JSON.stringify(overrides)}`)
}

async function insertTwoCopyTableTab(db, id) {
  return insertPrintJob(db, printJob('pending', 21), {
    id, orderId: null, tableTabId: 'probe-print-tab-17', type: 'table-tab', trigger: 'manual',
    copiesRequested: 2, copiesPrinted: 0,
    snapshot: JSON.stringify({ type: 'table-tab', tableTab: { id: 'probe-print-tab-17', number: 17 }, copies: 2 }),
  }).run()
}

async function verifyPrintContextConstraints(db, id) {
  await insertTwoCopyTableTab(db, id)
  equal(await db.prepare('SELECT copies_requested FROM print_jobs WHERE id = ?').bind(id).first('copies_requested'), 2, 'two-copy table-tab')
  await rejectsPrintJob(db, { orderId: null, type: 'order' })
  await rejectsPrintJob(db, { tableTabId: 'probe-print-tab-17', type: 'order' })
  await rejectsPrintJob(db, { orderId: null, tableTabId: null, type: 'table-tab', trigger: 'manual' })
  await rejectsPrintJob(db, { orderId: null, tableTabId: 'probe-print-tab-17', type: 'table-tab', trigger: 'automatic' })
  await rejectsPrintJob(db, { orderId: 'probe-print-order-pending', tableTabId: 'probe-print-tab-17', type: 'table-tab', trigger: 'manual' })
  await rejectsPrintJob(db, { orderId: 'probe-print-order-pending', tableTabId: null, type: 'test' })
  await rejectsPrintJob(db, { orderId: null, tableTabId: 'probe-print-tab-17', type: 'test' })
  await rejectsPrintJob(db, { copiesRequested: 0 })
  await rejectsPrintJob(db, { copiesRequested: 3 })
  equal((await db.prepare('PRAGMA foreign_key_check').all()).results, [], 'print foreign keys')
}

async function runLegacyPrintContextSeed(db) {
  await seedPrintContextHistory(db)
  try { await insertTwoCopyTableTab(db, 'probe-print-legacy-two-copy') }
  catch {
    return { ok: true, legacyRejectsTwoCopies: true, snapshot: await snapshotPrintContext(db) }
  }
  throw new Error('Pre-0025 schema accepted a two-copy table-tab job')
}

async function runUpgradedPrintContextProbe(db) {
  const preservedSnapshot = await snapshotPrintContext(db)
  await verifyPrintContextConstraints(db, 'probe-print-upgraded-two-copy')
  return { ok: true, runtime: 'D1 local Worker', preservedSnapshot, constraints: true }
}

async function runCleanPrintContextProbe(db) {
  await seedPrintContextHistory(db)
  await verifyPrintContextConstraints(db, 'probe-print-clean-two-copy')
  return { ok: true, runtime: 'D1 local Worker', cleanInstall: true }
}

async function snapshot(db, businessId) {
  const queries = [
    'SELECT * FROM business_operation_settings WHERE business_id = ? ORDER BY 1',
    'SELECT * FROM business_order_modalities WHERE business_id = ? ORDER BY code',
    'SELECT * FROM settings_mutation_receipts WHERE business_id = ? ORDER BY mutation_id',
  ]
  const results = await db.batch(queries.map((sql) => db.prepare(sql).bind(businessId)))
  return results.map(({ results }) => results)
}

// This facade only synchronizes arrival before each REAL D1 batch. All statements and
// transaction semantics belong to D1; no substitute database or repository is used.
function raceDatabase(db) {
  let arrivals = 0
  let release
  const ready = new Promise((resolve) => { release = resolve })
  return { prepare: (sql) => db.prepare(sql), async batch(statements) {
    if (++arrivals === 2) release()
    await ready
    return db.batch(statements)
  } }
}

export async function runSettingsProbe(db) {
  const now = new Date()
  const checks = {}
  const business = async (id) => {
    await db.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, id, id, now.toISOString(), now.toISOString()).run()
  }
  await business('probe-race')
  equal((await loadOperations(db, 'probe-race')).revision, 0, 'legitimate absence revision')
  equal((await loadOperations(db, 'probe-race')).data, DEFAULT_OPERATIONS, 'absence defaults')
  const raced = raceDatabase(db)
  const firstInputs = [input('left', 0), input('right', 0, value('Retirada'))]
  const result = await Promise.allSettled(firstInputs.map((body) => saveOperations(raced, 'probe-race', body, now)))
  equal(result.filter(({ status }) => status === 'fulfilled').length, 1, 'exactly one initialization winner')
  const winnerIndex = result.findIndex(({ status }) => status === 'fulfilled')
  const winner = result[winnerIndex].value
  const loser = result[1 - winnerIndex].reason
  equal([loser.code, loser.status], ['SETTINGS_REVISION_CONFLICT', 409], 'initialization loser')
  equal(winner.resource.revision, 1, 'initialization revision')
  const firstState = await snapshot(db, 'probe-race')
  equal(firstState[1].length, 3, 'native children initialized')
  equal(firstState[2].length, 1, 'loser receipt absent')
  equal((await loadOperations(db, 'probe-race')).data, winner.resource.data, 'loser children absent')
  checks.absenceAndInitializationRace = true

  const updateDb = raceDatabase(db)
  const updates = [input('update-left', 1, { ...value(), timing: { ...value().timing, scheduledPrepLeadMinutes: 70 } }), input('update-right', 1, { ...value('Entrega'), timing: { ...value().timing, scheduledPrepLeadMinutes: 80 } })]
  const updateResults = await Promise.allSettled(updates.map((body) => saveOperations(updateDb, 'probe-race', body, now)))
  equal(updateResults.filter(({ status }) => status === 'fulfilled').length, 1, 'one update winner')
  const updateWinner = updateResults.find(({ status }) => status === 'fulfilled').value
  equal(updateResults.find(({ status }) => status === 'rejected').reason.code, 'SETTINGS_REVISION_CONFLICT', 'update loser')
  equal((await snapshot(db, 'probe-race'))[2].length, 2, 'one update receipt')
  equal((await loadOperations(db, 'probe-race')).data, updateWinner.resource.data, 'only winning child changes')
  equal(updateWinner.resource.revision, 2, 'one revision advanced')
  checks.concurrentUpdate = true

  const beforeReplay = await snapshot(db, 'probe-race')
  const replay = await saveOperations(db, 'probe-race', firstInputs[winnerIndex], now)
  equal(replay.receipt.replayed, true, 'historical replay')
  equal(replay.resource, winner.resource, 'historical resource, data and timestamps')
  equal(await snapshot(db, 'probe-race'), beforeReplay, 'replay no writes')
  await rejects(() => saveOperations(db, 'probe-race', { ...firstInputs[winnerIndex], data: { ...value(), timing: { ...value().timing, scheduledPrepLeadMinutes: 100 } } }, now), 'SETTINGS_MUTATION_REUSED', 409)
  equal((await readSettingsReceipt(db, 'probe-race', 'operations', firstInputs[winnerIndex].mutationId, now)).committedRevision, 1, 'receipt recovery after lost response')
  checks.historicalReplayAndReuse = true

  await business('probe-rollback')
  await saveOperations(db, 'probe-rollback', input('seed', 0, DEFAULT_OPERATIONS), now)
  const beforeRollback = await snapshot(db, 'probe-rollback')
  await db.prepare(`CREATE TRIGGER probe_fail_child BEFORE UPDATE ON business_order_modalities
    WHEN NEW.business_id = 'probe-rollback' AND NEW.code = 'Retirada' BEGIN SELECT RAISE(ABORT, 'probe child failure'); END`).run()
  await rejects(() => saveOperations(db, 'probe-rollback', input('failed', 1), now), 'SETTINGS_UNAVAILABLE', 503)
  equal(await snapshot(db, 'probe-rollback'), beforeRollback, 'full intermediate rollback')
  await db.prepare('DROP TRIGGER probe_fail_child').run()
  await db.prepare(`CREATE TRIGGER probe_fail_receipt AFTER INSERT ON settings_mutation_receipts
    WHEN NEW.mutation_id = 'failed-receipt' BEGIN SELECT RAISE(ABORT, 'probe receipt failure'); END`).run()
  await rejects(() => saveOperations(db, 'probe-rollback', input('failed-receipt', 1), now), 'SETTINGS_UNAVAILABLE', 503)
  equal(await snapshot(db, 'probe-rollback'), beforeRollback, 'receipt insertion rollback')
  await db.prepare('DROP TRIGGER probe_fail_receipt').run()
  checks.intermediateAndReceiptRollback = true

  const noOp = input('noop-race', 1, DEFAULT_OPERATIONS)
  const noOpDb = raceDatabase(db)
  const noOps = await Promise.all([saveOperations(noOpDb, 'probe-rollback', noOp, now), saveOperations(noOpDb, 'probe-rollback', noOp, now)])
  equal(noOps.map(({ receipt }) => receipt.replayed).sort(), [false, true], 'duplicate receipt collision replays')
  equal(noOps.map(({ resource }) => resource.revision), [1, 1], 'no-op revision unchanged')
  equal((await snapshot(db, 'probe-rollback')).slice(0, 2), beforeRollback.slice(0, 2), 'no-op header/children unchanged')
  equal((await snapshot(db, 'probe-rollback'))[2].length, 2, 'one no-op receipt')
  checks.noOpAndReceiptCollision = true

  const beforeExpiration = await snapshot(db, 'probe-rollback')
  await rejects(() => saveOperations(db, 'probe-rollback', noOp, new Date(+now + 86400000)), 'SETTINGS_REVISION_CONFLICT', 409)
  equal(await snapshot(db, 'probe-rollback'), beforeExpiration, 'expired replay cannot mutate')
  equal((await readSettingsReceipt(db, 'probe-rollback', 'operations', 'noop-race', new Date(+now + 86399999))).committedRevision, 1, 'receipt valid until boundary')
  checks.receipt24Hours = true

  let pending
  const delayed = { prepare: (sql) => db.prepare(sql), async batch(statements) { pending = statements; throw new Error('probe timeout before commit') } }
  const unknown = await rejects(() => saveOperations(delayed, 'probe-rollback', input('pending', 1), now), 'SETTINGS_UNAVAILABLE', 503)
  equal(unknown.outcome, 'unconfirmed', 'timeout never claims rollback')
  equal(await readSettingsReceipt(db, 'probe-rollback', 'operations', 'pending', now), null, 'no receipt yet')
  await db.batch(pending)
  equal((await readSettingsReceipt(db, 'probe-rollback', 'operations', 'pending', now)).committedRevision, 2, 'delayed commit confirmation')
  const lost = { prepare: (sql) => db.prepare(sql), async batch(statements) { await db.batch(statements); throw new Error('probe lost response after commit') } }
  equal((await saveOperations(lost, 'probe-rollback', input('lost', 2, value('Retirada')), now)).receipt.replayed, true, 'lost response recovered')
  checks.unknownBeforeCommitAndLostResponse = true

  await business('probe-corrupt')
  await db.prepare("INSERT INTO business_order_modalities (business_id, code, active) VALUES ('probe-corrupt', 'Local', 1)").run()
  await rejects(() => loadOperations(db, 'probe-corrupt'), 'SETTINGS_UNAVAILABLE', 503)
  await rejects(() => saveOperations(db, 'probe-corrupt', input('corrupt', 0), now), 'SETTINGS_UNAVAILABLE', 503)
  checks.partialState = true
  equal((await db.prepare('SELECT count(*) AS n FROM settings_tx_assertions').first()).n, 0, 'assertion cleanup')
  equal((await db.prepare('PRAGMA foreign_key_check').all()).results, [], 'foreign keys valid')
  for (const column of ['check_key', 'valid']) {
    await db.prepare(`ALTER TABLE settings_tx_assertions RENAME COLUMN ${column} TO missing`).run()
    await rejects(() => loadOperations(db, 'probe-race'), 'SETTINGS_UNAVAILABLE', 503)
    await rejects(() => saveOperations(db, 'probe-race', firstInputs[winnerIndex], now), 'SETTINGS_UNAVAILABLE', 503)
    await db.prepare(`ALTER TABLE settings_tx_assertions RENAME COLUMN missing TO ${column}`).run()
  }
  await db.prepare('DROP TABLE settings_tx_assertions').run()
  await rejects(() => loadOperations(db, 'probe-race'), 'SETTINGS_UNAVAILABLE', 503)
  await rejects(() => saveOperations(db, 'probe-race', input('schema', 2), now), 'SETTINGS_UNAVAILABLE', 503)
  checks.missingSchema = true
  return { ok: true, runtime: 'D1 local Worker', checks }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return new Response('Local only', { status: 403 })
    if (url.pathname === '/health' && request.method === 'GET') return Response.json({ probe: env.PROBE_RUN_ID })
    if (request.method !== 'POST') return new Response('Not found', { status: 404 })
    const probes = {
      '/probe': runSettingsProbe,
      '/print-context/seed-legacy': runLegacyPrintContextSeed,
      '/print-context/verify-upgrade': runUpgradedPrintContextProbe,
      '/print-context/verify-clean': runCleanPrintContextProbe,
    }
    if (!probes[url.pathname]) return new Response('Not found', { status: 404 })
    try { return Response.json(await probes[url.pathname](env.DB)) }
    catch (error) { return Response.json({ ok: false, error: error.message, stack: error.stack }, { status: 500 }) }
  },
}
