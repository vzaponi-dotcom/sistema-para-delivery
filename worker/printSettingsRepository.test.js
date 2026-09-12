import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from './test-support/settingsDb.js'
import { loadPrintingPolicy, savePrintingPolicy } from './printSettingsRepository.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-12T15:00:00.000Z')
const changed = { orderDefaultCopies: 1, tableTabDefaultCopies: 2 }
const input = (mutationId = 'print-1', expectedRevision = 1, data = changed) => ({ mutationId, expectedRevision, data })
const setup = (t, options) => { const fixture = createSettingsDb(options); t.after(fixture.close); return fixture }
const state = (sqlite) => [
  sqlite.prepare('SELECT * FROM business_print_settings ORDER BY business_id').all().map((row) => ({ ...row })),
  sqlite.prepare("SELECT * FROM settings_mutation_receipts WHERE resource_key = 'printingPolicy' ORDER BY business_id, mutation_id").all().map((row) => ({ ...row })),
  sqlite.prepare('SELECT * FROM settings_tx_assertions ORDER BY tx_id, check_key').all().map((row) => ({ ...row })),
]

test('printing policy preserves the existing order override and stores independent 1/2 defaults by context', async (t) => {
  const { db } = setup(t, { beforeSpecB(sqlite) {
    sqlite.exec("UPDATE business_print_settings SET default_copies = 1 WHERE business_id = 'amor-e-sabor'")
  } })
  assert.deepEqual((await loadPrintingPolicy(db, BUSINESS)).data, { orderDefaultCopies: 1, tableTabDefaultCopies: 1 })
  const saved = await savePrintingPolicy(db, BUSINESS, input(), NOW)
  assert.deepEqual(saved.resource.data, changed)
  assert.equal(saved.resource.revision, 2)
  assert.equal(saved.receipt.committedRevision, 2)
})

test('policy save is independent from station legacy copies and station configuration', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.exec(`INSERT INTO print_stations (id, business_id, name, platform, auto_print_enabled, default_copies, last_seen_at, created_at, updated_at)
    VALUES ('kitchen', '${BUSINESS}', 'Cozinha', 'windows', 0, 2, '${NOW.toISOString()}', '${NOW.toISOString()}', '${NOW.toISOString()}')`)
  await savePrintingPolicy(db, BUSINESS, input(), NOW)
  assert.deepEqual({ ...sqlite.prepare("SELECT default_copies, auto_print_enabled, config_revision FROM print_stations WHERE id = 'kitchen'").get() },
    { default_copies: 2, auto_print_enabled: 0, config_revision: 1 })
})

test('concurrent policy saves have one winner, while no-op, replay and mutation reuse keep receipt semantics', async (t) => {
  const { db, sqlite } = setup(t)
  const results = await Promise.allSettled([
    savePrintingPolicy(db, BUSINESS, input('same', 1, changed), NOW),
    savePrintingPolicy(db, BUSINESS, input('same', 1, { orderDefaultCopies: 2, tableTabDefaultCopies: 2 }), NOW),
  ])
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
  assert.equal(results.find(({ status }) => status === 'rejected').reason.code, 'SETTINGS_MUTATION_REUSED')
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM settings_mutation_receipts WHERE resource_key = 'printingPolicy'").get().n, 1)

  const winner = results.find(({ status }) => status === 'fulfilled').value
  const replay = await savePrintingPolicy(db, BUSINESS, input('same', 1, winner.resource.data), new Date(+NOW + 1000))
  assert.equal(replay.receipt.replayed, true)
  const noOp = await savePrintingPolicy(db, BUSINESS, input('noop', 2, winner.resource.data), new Date(+NOW + 2000))
  assert.equal(noOp.resource.revision, 2)
  assert.equal(noOp.resource.meta.updatedAt, winner.resource.meta.updatedAt)
})

test('policy validation and injected late failure leave header and receipt state unchanged', async (t) => {
  const { db, sqlite } = setup(t)
  const before = state(sqlite)
  await assert.rejects(savePrintingPolicy(db, BUSINESS, input('bad', 1, { orderDefaultCopies: 0, tableTabDefaultCopies: 2 }), NOW),
    { status: 400, code: 'SETTINGS_INVALID' })
  sqlite.exec("CREATE TRIGGER fail_print_receipt AFTER INSERT ON settings_mutation_receipts WHEN NEW.resource_key = 'printingPolicy' BEGIN SELECT RAISE(ABORT, 'injected'); END")
  await assert.rejects(savePrintingPolicy(db, BUSINESS, input(), NOW), { status: 503, code: 'SETTINGS_UNAVAILABLE' })
  assert.deepEqual(state(sqlite), before)
})

test('printing policies and receipts are isolated by business', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.exec("INSERT INTO businesses VALUES ('second', 'second', 'Second', '2026-09-12', '2026-09-12')")
  const second = await loadPrintingPolicy(db, 'second')
  assert.equal(second.revision, 0)
  await savePrintingPolicy(db, 'second', input('print-1', 0), NOW)
  assert.deepEqual((await loadPrintingPolicy(db, BUSINESS)).data, { orderDefaultCopies: 2, tableTabDefaultCopies: 1 })
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM settings_mutation_receipts WHERE mutation_id = 'print-1'").get().n, 1)
})
