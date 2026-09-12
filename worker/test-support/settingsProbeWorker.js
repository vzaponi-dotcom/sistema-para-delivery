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
    if (url.pathname !== '/probe' || request.method !== 'POST') return new Response('Not found', { status: 404 })
    try { return Response.json(await runSettingsProbe(env.DB)) }
    catch (error) { return Response.json({ ok: false, error: error.message, stack: error.stack }, { status: 500 }) }
  },
}
