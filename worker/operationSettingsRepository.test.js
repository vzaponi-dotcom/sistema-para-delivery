import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from './test-support/settingsDb.js'
import { DEFAULT_OPERATIONS } from '../shared/businessPolicies.js'
import { loadOperations, saveOperations } from './operationSettingsRepository.js'
import { readSettingsReceipt } from './settingsTransactions.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-12T12:00:00.000Z')
const data = (modality = 'Local') => ({ timing: { ...DEFAULT_OPERATIONS.timing, scheduledPrepLeadMinutes: 60 }, enabledModalities: [modality], defaultModality: modality })
const input = (mutationId = 'first', expectedRevision = 1, value = data()) => ({ mutationId, expectedRevision, data: value })
const state = (sqlite) => ['business_operation_settings', 'business_order_modalities', 'settings_mutation_receipts', 'settings_tx_assertions'].map((table) => sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all().map((row) => ({ ...row })))
function setup(t) { const fixture = createSettingsDb(); t.after(fixture.close); return fixture }

test('two concurrent saves at the same revision have one winner and no losing child or receipt changes', async (t) => {
  const { db, sqlite } = setup(t)
  const results = await Promise.allSettled([saveOperations(db, BUSINESS, input('left'), NOW), saveOperations(db, BUSINESS, input('right', 1, data('Retirada')), NOW)])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const winner = results.find((result) => result.status === 'fulfilled').value
  const loser = results.find((result) => result.status === 'rejected').reason
  assert.equal(loser.code, 'SETTINGS_REVISION_CONFLICT')
  assert.equal(loser.status, 409)
  assert.equal(winner.resource.revision, 2)
  assert.deepEqual((await loadOperations(db, BUSINESS)).data, winner.resource.data)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_mutation_receipts').get().n, 1)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})

test('failure in the second child update rolls back header, children, assertions and receipt', async (t) => {
  const { db, sqlite } = setup(t)
  const before = state(sqlite)
  sqlite.exec("CREATE TRIGGER fail_second BEFORE UPDATE ON business_order_modalities WHEN NEW.code = 'Retirada' BEGIN SELECT RAISE(ABORT, 'injected child failure'); END")
  await assert.rejects(saveOperations(db, BUSINESS, input(), NOW), { status: 503, code: 'SETTINGS_UNAVAILABLE' })
  assert.deepEqual(state(sqlite), before)
})

test('replay recovers the historical result after later commits and different payload reuse is rejected', async (t) => {
  const { db, sqlite } = setup(t)
  const saved = await saveOperations(db, BUSINESS, input(), NOW)
  assert.equal(saved?.receipt.committedRevision, 2)
  await saveOperations(db, BUSINESS, input('later', 2, data('Retirada')), new Date(+NOW + 1000))
  const before = state(sqlite)
  const replay = await saveOperations(db, BUSINESS, input(), new Date(+NOW + 2000))
  assert.equal(replay.receipt.replayed, true)
  assert.equal(replay.resource.revision, 2)
  assert.deepEqual(replay.resource.data, data())
  assert.equal(replay.receipt.committedAt, NOW.toISOString())
  assert.deepEqual(state(sqlite), before)
  await assert.rejects(saveOperations(db, BUSINESS, input('first', 1, data('Retirada')), NOW), { status: 409, code: 'SETTINGS_MUTATION_REUSED' })
  assert.equal((await readSettingsReceipt(db, BUSINESS, 'operations', 'first', NOW)).committedRevision, 2)
})

test('fresh no-op creates a receipt without updating revision, timestamp or children; duplicate no-op race replays', async (t) => {
  const { db, sqlite } = setup(t)
  const before = state(sqlite)
  const noOp = input('noop', 1, DEFAULT_OPERATIONS)
  const results = await Promise.all([saveOperations(db, BUSINESS, noOp, NOW), saveOperations(db, BUSINESS, noOp, NOW)])
  assert.equal(results[0]?.resource.revision, 1)
  assert.deepEqual(results.map((result) => result.receipt.replayed).sort(), [false, true])
  assert.deepEqual(state(sqlite).slice(0, 2), before.slice(0, 2))
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_mutation_receipts').get().n, 1)
})

test('valid schema absence reads revision zero and initialization races atomically', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.exec("INSERT INTO businesses VALUES ('new', 'new', 'New', '2026-09-12', '2026-09-12')")
  const absent = await loadOperations(db, 'new')
  assert.equal(absent?.revision, 0)
  assert.deepEqual(absent.data, DEFAULT_OPERATIONS)
  const results = await Promise.allSettled([saveOperations(db, 'new', input('a', 0), NOW), saveOperations(db, 'new', input('b', 0, data('Retirada')), NOW)])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'SETTINGS_REVISION_CONFLICT')
  assert.equal((await loadOperations(db, 'new')).revision, 1)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM business_order_modalities WHERE business_id = 'new'").get().n, 3)
})

test('schema absence and partial or corrupt state fail closed on reads and writes', async (t) => {
  for (const corrupt of [
    "DROP TABLE settings_tx_assertions",
    "DROP TRIGGER settings_tx_assertions_insert_guard",
    "DELETE FROM business_order_modalities WHERE code = 'Local'",
    'DELETE FROM business_operation_settings',
    "PRAGMA ignore_check_constraints = ON; UPDATE business_operation_settings SET revision = 0",
    "PRAGMA ignore_check_constraints = ON; UPDATE business_operation_settings SET scheduled_prep_lead_minutes = -1",
  ]) {
    const { db, sqlite, close } = createSettingsDb()
    t.after(close)
    sqlite.exec(corrupt)
    await assert.rejects(loadOperations(db, BUSINESS), { status: 503, code: 'SETTINGS_UNAVAILABLE' })
    await assert.rejects(saveOperations(db, BUSINESS, input(), NOW), { status: 503, code: 'SETTINGS_UNAVAILABLE' })
  }
})

test('invalid aggregate and injected trusted metadata fail before any SQL is prepared', async () => {
  const db = { prepare() { assert.fail('invalid input reached SQL preparation') } }
  for (const invalid of [input('', 1), input('x', -1), input('x', 1.5), { ...input(), role: 'admin' }, input('x', 1, { ...data(), businessId: 'other' }), input('x', 1, { ...data(), timing: { ...data().timing, usedEver: true } })]) {
    await assert.rejects(saveOperations(db, BUSINESS, invalid, NOW), { status: 400, code: 'SETTINGS_INVALID' })
  }
})

test('expired receipt requires review even when the revision still matches a no-op', async (t) => {
  const { db, sqlite } = setup(t)
  const noop = input('expired', 1, DEFAULT_OPERATIONS)
  const saved = await saveOperations(db, BUSINESS, noop, NOW)
  assert.equal(saved?.resource.revision, 1)
  const before = state(sqlite)
  await assert.rejects(saveOperations(db, BUSINESS, noop, new Date(+NOW + 86400000)), { status: 409, code: 'SETTINGS_REVISION_CONFLICT' })
  assert.deepEqual(state(sqlite), before)
})

test('a duplicate committing between receipt lookup and resource read still returns replay', async (t) => {
  const { db } = setup(t)
  let first = true
  const interleaved = { ...db, prepare(sql) {
    const statement = db.prepare(sql)
    if (!first) return statement
    first = false
    return { bind(...values) { const bound = statement.bind(...values); return { async first() {
      const row = await bound.first()
      await saveOperations(db, BUSINESS, input(), NOW)
      return row
    } } } }
  } }
  const result = await saveOperations(interleaved, BUSINESS, input(), NOW)
  assert.equal(result.receipt.replayed, true)
  assert.equal(result.resource.revision, 2)
})

test('absent aggregate still rejects missing typed schema columns', async (t) => {
  for (const sql of [
    'ALTER TABLE business_operation_settings RENAME COLUMN scheduled_prep_lead_minutes TO missing',
    'ALTER TABLE settings_mutation_receipts RENAME COLUMN payload_hash TO missing',
  ]) {
    const { db, sqlite, close } = createSettingsDb()
    t.after(close)
    sqlite.exec("INSERT INTO businesses VALUES ('new', 'new', 'New', '2026-09-12', '2026-09-12')")
    sqlite.exec(sql)
    await assert.rejects(loadOperations(db, 'new'), { code: 'SETTINGS_UNAVAILABLE', status: 503 })
  }
})

test('transport failure after commit reconciles by receipt; before commit stays unconfirmed and may commit later', async (t) => {
  const { db, sqlite } = setup(t)
  let batches = 0
  const lostResponse = { ...db, async batch(statements) { batches++; await db.batch(statements); throw new Error('transport timeout after commit') } }
  const recovered = await saveOperations(lostResponse, BUSINESS, input(), NOW)
  assert.equal(recovered.receipt.replayed, true)
  assert.equal(batches, 1)
  let pending
  const beforeCommit = { ...db, async batch(statements) { pending = statements; throw new Error('transport timeout before commit') } }
  await assert.rejects(saveOperations(beforeCommit, BUSINESS, input('pending', 2, data('Retirada')), NOW), { status: 503, code: 'SETTINGS_UNAVAILABLE', outcome: 'unconfirmed' })
  assert.equal(await readSettingsReceipt(db, BUSINESS, 'operations', 'pending', NOW), null)
  await db.batch(pending)
  assert.equal((await readSettingsReceipt(db, BUSINESS, 'operations', 'pending', NOW)).committedRevision, 3)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_mutation_receipts').get().n, 2)
})

test('an existing receipt cannot hide corrupt schema on replay', async (t) => {
  const { db, sqlite } = setup(t)
  await saveOperations(db, BUSINESS, input(), NOW)
  sqlite.exec('DROP TABLE settings_tx_assertions')
  await assert.rejects(saveOperations(db, BUSINESS, input(), NOW), { code: 'SETTINGS_UNAVAILABLE', status: 503 })
})

test('late failure after receipt insertion rolls the entire mutation back', async (t) => {
  const { db, sqlite } = setup(t)
  const before = state(sqlite)
  sqlite.exec("CREATE TRIGGER fail_receipt AFTER INSERT ON settings_mutation_receipts BEGIN SELECT RAISE(ABORT, 'late receipt failure'); END")
  await assert.rejects(saveOperations(db, BUSINESS, input(), NOW), { code: 'SETTINGS_UNAVAILABLE', status: 503 })
  assert.deepEqual(state(sqlite), before)
})

test('concurrent mutation ID reuse with differing payload rejects the loser without a second mutation', async (t) => {
  const { db, sqlite } = setup(t)
  const results = await Promise.allSettled([saveOperations(db, BUSINESS, input(), NOW), saveOperations(db, BUSINESS, input('first', 1, data('Retirada')), NOW)])
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
  assert.equal(results.find(({ status }) => status === 'rejected').reason.code, 'SETTINGS_MUTATION_REUSED')
  assert.equal(sqlite.prepare('SELECT revision FROM business_operation_settings').get().revision, 2)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_mutation_receipts').get().n, 1)
})

for (const column of ['check_key', 'valid']) {
  for (const operation of ['load', 'replay']) {
    test(`missing assertion ${column} rejects ${operation} with 503`, async (t) => {
      const { db, sqlite } = setup(t)
      await saveOperations(db, BUSINESS, input(), NOW)
      sqlite.exec(`ALTER TABLE settings_tx_assertions RENAME COLUMN ${column} TO missing`)
      await assert.rejects(operation === 'load' ? loadOperations(db, BUSINESS) : saveOperations(db, BUSINESS, input(), NOW),
        { code: 'SETTINGS_UNAVAILABLE', status: 503 })
    })
  }
}
