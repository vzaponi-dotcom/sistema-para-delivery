import test from 'node:test'
import assert from 'node:assert/strict'
import { nativeCancellationReasons } from '../shared/settingsCatalogs.js'
import { createSettingsDb } from './test-support/settingsDb.js'
import { loadCancellationReasons, saveCancellationReasons } from './cancellationSettingsRepository.js'
import { readSettingsReceipt } from './settingsTransactions.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-12T16:00:00.000Z')
const input = (mutationId, data, expectedRevision = 1) => ({ mutationId, expectedRevision, data })

function setup(t) {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  return fixture
}

function editableNatives() {
  return { items: nativeCancellationReasons().items.map(({ id, label, active, sortOrder }) => ({ id, label, active, sortOrder })) }
}

function withCustom(data = editableNatives(), overrides = {}) {
  const result = structuredClone(data)
  result.items.push({ id: 'weather-delay', label: 'Chuva forte', active: true, sortOrder: result.items.length, ...overrides })
  return result
}

const state = (sqlite) => ['business_cancellation_settings', 'business_cancel_reasons', 'settings_mutation_receipts', 'settings_tx_assertions']
  .map((table) => sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all().map((row) => ({ ...row })))

test('load preserves all five native reasons and exposes trusted server restrictions', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare("UPDATE business_cancel_reasons SET first_used_at = ? WHERE id = 'client_changed_mind'")
    .run('2026-09-01T10:00:00.000Z')

  const loaded = await loadCancellationReasons(db, BUSINESS)

  assert.equal(loaded.resource, 'cancellationReasons')
  assert.equal(loaded.revision, 1)
  assert.deepEqual(loaded.data, editableNatives())
  assert.deepEqual(loaded.meta.items.client_changed_mind, {
    label: 'Cliente desistiu', isSystem: true, requiresNote: false,
    usedEver: true, canRename: false, canDelete: false,
  })
  assert.deepEqual(loaded.meta.items.other, {
    label: 'Outro', isSystem: true, requiresNote: true,
    usedEver: false, canRename: false, canDelete: false,
  })
})

test('custom reasons can be created, reordered, disabled, reactivated and renamed before use', async (t) => {
  const { db, sqlite } = setup(t)
  const created = await saveCancellationReasons(db, BUSINESS, input('create-custom', withCustom()), NOW)
  const edited = structuredClone(created.resource.data)
  const custom = edited.items.find(({ id }) => id === 'weather-delay')
  custom.label = 'Temporal'
  custom.active = false
  custom.sortOrder = 0
  edited.items.filter(({ id }) => id !== custom.id).forEach((item, index) => { item.sortOrder = index + 1 })
  edited.items.sort((left, right) => left.sortOrder - right.sortOrder)

  const disabled = await saveCancellationReasons(db, BUSINESS, input('edit-custom', edited, 2), new Date(+NOW + 1000))
  assert.equal(disabled.resource.revision, 3)
  assert.deepEqual(disabled.resource.data.items[0], { id: 'weather-delay', label: 'Temporal', active: false, sortOrder: 0 })
  assert.equal(disabled.resource.meta.items['weather-delay'].canRename, true)
  assert.equal(disabled.resource.meta.items['weather-delay'].canDelete, true)

  const reactivated = structuredClone(disabled.resource.data)
  reactivated.items[0].active = true
  const saved = await saveCancellationReasons(db, BUSINESS, input('reactivate-custom', reactivated, 3), new Date(+NOW + 2000))
  assert.equal(saved.resource.data.items[0].active, true)
  assert.equal(sqlite.prepare("SELECT is_system FROM business_cancel_reasons WHERE id = 'weather-delay'").get().is_system, 0)
})

test('native identity, Other activation and server-owned metadata cannot be changed by payload', async () => {
  const invalidCases = []
  const missingNative = editableNatives()
  missingNative.items.shift()
  invalidCases.push(missingNative)
  const renamedNative = editableNatives()
  renamedNative.items[0].label = 'Mudou de ideia'
  invalidCases.push(renamedNative)
  const disabledOther = editableNatives()
  disabledOther.items.find(({ id }) => id === 'other').active = false
  invalidCases.push(disabledOther)
  const forgedMetadata = editableNatives()
  forgedMetadata.items[0].usedEver = false
  invalidCases.push(forgedMetadata)

  for (const [index, data] of invalidCases.entries()) {
    const db = { prepare() { assert.fail(`invalid case ${index} reached SQL`) } }
    await assert.rejects(saveCancellationReasons(db, BUSINESS, input(`invalid-${index}`, data), NOW), {
      status: 400, code: 'SETTINGS_INVALID',
    })
  }
})

test('normalized duplicate names, excessive names and duplicate order fail before SQL', async () => {
  const duplicateName = withCustom(editableNatives(), { label: '  CLIENTE   DESISTIU  ' })
  const longName = withCustom(editableNatives(), { label: 'x'.repeat(81) })
  const duplicateOrder = withCustom(editableNatives(), { sortOrder: 0 })
  const outOfRangeOrder = withCustom(editableNatives(), { sortOrder: 9 })

  for (const [index, data] of [duplicateName, longName, duplicateOrder, outOfRangeOrder].entries()) {
    const db = { prepare() { assert.fail(`invalid case ${index} reached SQL`) } }
    await assert.rejects(saveCancellationReasons(db, BUSINESS, input(`invalid-name-${index}`, data), NOW), {
      status: 400, code: 'SETTINGS_INVALID',
    })
  }
})

test('used custom reason cannot be renamed or deleted but can be deactivated', async (t) => {
  const { db, sqlite } = setup(t)
  const created = await saveCancellationReasons(db, BUSINESS, input('create-used', withCustom()), NOW)
  sqlite.prepare("UPDATE business_cancel_reasons SET first_used_at = ? WHERE id = 'weather-delay'")
    .run('2026-09-12T16:01:00.000Z')

  const used = await loadCancellationReasons(db, BUSINESS)
  assert.equal(used.meta.items['weather-delay'].usedEver, true)
  assert.equal(used.meta.items['weather-delay'].canRename, false)
  assert.equal(used.meta.items['weather-delay'].canDelete, false)

  const renamed = structuredClone(used.data)
  renamed.items.find(({ id }) => id === 'weather-delay').label = 'Temporal'
  await assert.rejects(saveCancellationReasons(db, BUSINESS, input('rename-used', renamed, created.resource.revision), NOW), {
    status: 400, code: 'SETTINGS_INVALID',
  })
  const removed = structuredClone(used.data)
  removed.items = removed.items.filter(({ id }) => id !== 'weather-delay')
  await assert.rejects(saveCancellationReasons(db, BUSINESS, input('delete-used', removed, created.resource.revision), NOW), {
    status: 400, code: 'SETTINGS_INVALID',
  })

  const disabled = structuredClone(used.data)
  disabled.items.find(({ id }) => id === 'weather-delay').active = false
  const saved = await saveCancellationReasons(db, BUSINESS, input('disable-used', disabled, created.resource.revision), NOW)
  assert.equal(saved.resource.data.items.find(({ id }) => id === 'weather-delay').active, false)
})

test('unused custom deletion is atomic and a late first use rejects rename/delete', async (t) => {
  const { db, sqlite } = setup(t)
  const created = await saveCancellationReasons(db, BUSINESS, input('create-delete', withCustom()), NOW)
  const removed = structuredClone(created.resource.data)
  removed.items = removed.items.filter(({ id }) => id !== 'weather-delay')
  const deleted = await saveCancellationReasons(db, BUSINESS, input('delete-unused', removed, 2), new Date(+NOW + 1000))
  assert.equal(deleted.resource.data.items.some(({ id }) => id === 'weather-delay'), false)

  const recreated = await saveCancellationReasons(db, BUSINESS, input('recreate', withCustom(deleted.resource.data), 3), new Date(+NOW + 2000))
  const rename = structuredClone(recreated.resource.data)
  rename.items.find(({ id }) => id === 'weather-delay').label = 'Temporal'
  const racingDb = {
    prepare: db.prepare,
    async batch(statements) {
      sqlite.prepare("UPDATE business_cancel_reasons SET first_used_at = ? WHERE id = 'weather-delay'")
        .run('2026-09-12T16:03:00.000Z')
      return db.batch(statements)
    },
  }
  await assert.rejects(saveCancellationReasons(racingDb, BUSINESS, input('late-rename', rename, 4), new Date(+NOW + 3000)), {
    status: 409, code: 'SETTINGS_ITEM_USED',
  })
  assert.equal(sqlite.prepare("SELECT label FROM business_cancel_reasons WHERE id = 'weather-delay'").get().label, 'Chuva forte')
})

test('rollback, competing revisions, no-op and receipt replay preserve the T03 protocol', async (t) => {
  const { db, sqlite } = setup(t)
  const before = state(sqlite)
  sqlite.exec("CREATE TRIGGER fail_custom AFTER INSERT ON business_cancel_reasons WHEN NEW.id = 'weather-delay' BEGIN SELECT RAISE(ABORT, 'injected cancellation failure'); END")
  await assert.rejects(saveCancellationReasons(db, BUSINESS, input('rollback', withCustom()), NOW), {
    status: 503, code: 'SETTINGS_UNAVAILABLE',
  })
  assert.deepEqual(state(sqlite), before)
  sqlite.exec('DROP TRIGGER fail_custom')

  const alternatives = [withCustom(), withCustom(editableNatives(), { id: 'traffic', label: 'TrÃ¢nsito' })]
  const results = await Promise.allSettled(alternatives.map((data, index) => (
    saveCancellationReasons(db, BUSINESS, input(`race-${index}`, data), NOW)
  )))
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
  assert.equal(results.find(({ status }) => status === 'rejected').reason.code, 'SETTINGS_REVISION_CONFLICT')
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM settings_mutation_receipts WHERE resource_key = 'cancellationReasons'").get().n, 1)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)

  const winner = results.find(({ status }) => status === 'fulfilled').value
  const replay = await saveCancellationReasons(db, BUSINESS, input(winner.receipt.mutationId, winner.resource.data), new Date(+NOW + 1000))
  assert.equal(replay.receipt.replayed, true)
  const noop = await saveCancellationReasons(db, BUSINESS, input('noop', winner.resource.data, 2), new Date(+NOW + 2000))
  assert.equal(noop.resource.revision, 2)
  assert.equal((await readSettingsReceipt(db, BUSINESS, 'cancellationReasons', 'noop', new Date(+NOW + 2000))).committedRevision, 2)
})

test('valid absent aggregate initializes natives while corrupt state fails closed', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.exec("INSERT INTO businesses VALUES ('new', 'new', 'New', '2026-09-12', '2026-09-12')")
  const absent = await loadCancellationReasons(db, 'new')
  assert.equal(absent.revision, 0)
  assert.deepEqual(absent.data, editableNatives())
  const initialized = await saveCancellationReasons(db, 'new', input('initialize', withCustom(), 0), NOW)
  assert.equal(initialized.resource.revision, 1)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM business_cancel_reasons WHERE business_id = 'new'").get().n, 6)

  for (const corrupt of [
    "DROP TRIGGER business_cancel_reasons_delete_guard; DELETE FROM business_cancel_reasons WHERE business_id = 'amor-e-sabor' AND id = 'other'",
    'DROP TABLE settings_tx_assertions',
    'ALTER TABLE business_cancellation_settings RENAME COLUMN revision TO missing',
  ]) {
    const fixture = createSettingsDb()
    t.after(fixture.close)
    fixture.sqlite.exec(corrupt)
    await assert.rejects(loadCancellationReasons(fixture.db, BUSINESS), { status: 503, code: 'SETTINGS_UNAVAILABLE' })
  }
})
