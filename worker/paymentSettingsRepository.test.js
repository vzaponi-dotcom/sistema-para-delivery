import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_OPERATIONS, DEFAULT_PAYMENT_METHODS } from '../shared/businessPolicies.js'
import { createSettingsDb } from './test-support/settingsDb.js'
import { loadOperations, saveOperations } from './operationSettingsRepository.js'
import { loadPaymentMethods, savePaymentMethods } from './paymentSettingsRepository.js'
import { readSettingsReceipt } from './settingsTransactions.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-12T15:00:00.000Z')
const input = (mutationId, data, expectedRevision = 1) => ({ mutationId, expectedRevision, data })
const state = (sqlite) => ['business_payment_settings', 'business_payment_methods', 'settings_mutation_receipts', 'settings_tx_assertions']
  .map((table) => sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all().map((row) => ({ ...row })))

function setup(t) {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  return fixture
}

function changedPaymentMethods() {
  const data = structuredClone(DEFAULT_PAYMENT_METHODS)
  data.defaultMethod = 'cash'
  const pix = data.methods.find(({ code }) => code === 'pix')
  const cash = data.methods.find(({ code }) => code === 'cash')
  pix.active = false
  pix.sortOrder = 1
  cash.sortOrder = 0
  data.methods.sort((left, right) => left.sortOrder - right.sortOrder)
  return data
}

test('load returns the six native methods in configured order with server-owned restrictions', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare("UPDATE business_payment_methods SET first_used_at = ? WHERE code = 'pix'").run('2026-09-01T10:00:00.000Z')

  const loaded = await loadPaymentMethods(db, BUSINESS)

  assert.equal(loaded.resource, 'paymentMethods')
  assert.equal(loaded.revision, 1)
  assert.deepEqual(loaded.data, DEFAULT_PAYMENT_METHODS)
  assert.deepEqual(loaded.meta.items.pix, {
    label: 'Pix',
    isSystem: true,
    usedEver: true,
    canRename: false,
    canDelete: false,
  })
  assert.equal(loaded.meta.items.cash.label, 'Dinheiro')
  assert.equal(loaded.meta.items.cash.usedEver, false)
})

test('one save can select cash, deactivate the former default and reorder both atomically', async (t) => {
  const { db, sqlite } = setup(t)
  const saved = await savePaymentMethods(db, BUSINESS, input('payments-1', changedPaymentMethods()), NOW)

  assert.equal(saved.resource.revision, 2)
  assert.equal(saved.resource.data.defaultMethod, 'cash')
  assert.equal(saved.resource.data.methods.find(({ code }) => code === 'pix').active, false)
  assert.deepEqual(saved.resource.data.methods.slice(0, 2).map(({ code }) => code), ['cash', 'pix'])
  assert.deepEqual(saved.receipt, {
    mutationId: 'payments-1',
    committedRevision: 2,
    committedAt: NOW.toISOString(),
    replayed: false,
  })
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

test('validation rejects no active default, invented or missing methods, rename fields and duplicate order before SQL', async () => {
  const cases = []
  const inactive = structuredClone(DEFAULT_PAYMENT_METHODS)
  inactive.methods.forEach((method) => { method.active = false })
  cases.push(inactive)
  const invented = structuredClone(DEFAULT_PAYMENT_METHODS)
  invented.methods[5].code = 'voucher'
  cases.push(invented)
  const renamed = structuredClone(DEFAULT_PAYMENT_METHODS)
  renamed.methods[0].label = 'PIX alterado'
  cases.push(renamed)
  const duplicateOrder = structuredClone(DEFAULT_PAYMENT_METHODS)
  duplicateOrder.methods[5].sortOrder = 0
  cases.push(duplicateOrder)
  const missing = structuredClone(DEFAULT_PAYMENT_METHODS)
  missing.methods.pop()
  cases.push(missing)

  for (const [index, data] of cases.entries()) {
    const db = { prepare() { assert.fail(`invalid case ${index} reached SQL`) } }
    await assert.rejects(savePaymentMethods(db, BUSINESS, input(`invalid-${index}`, data), NOW), {
      status: 400,
      code: 'SETTINGS_INVALID',
    })
  }
})

test('failure after child updates rolls back header, all children, assertions and receipt', async (t) => {
  const { db, sqlite } = setup(t)
  const before = state(sqlite)
  sqlite.exec("CREATE TRIGGER fail_pix AFTER UPDATE ON business_payment_methods WHEN NEW.code = 'pix' BEGIN SELECT RAISE(ABORT, 'injected payment failure'); END")

  await assert.rejects(savePaymentMethods(db, BUSINESS, input('rollback', changedPaymentMethods()), NOW), {
    status: 503,
    code: 'SETTINGS_UNAVAILABLE',
  })
  assert.deepEqual(state(sqlite), before)
})

test('concurrent saves at one revision have one winner and the loser leaves no child or receipt changes', async (t) => {
  const { db, sqlite } = setup(t)
  const alternate = structuredClone(DEFAULT_PAYMENT_METHODS)
  alternate.defaultMethod = 'transfer'
  const results = await Promise.allSettled([
    savePaymentMethods(db, BUSINESS, input('cash-wins', changedPaymentMethods()), NOW),
    savePaymentMethods(db, BUSINESS, input('transfer-wins', alternate), NOW),
  ])

  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
  assert.equal(results.find(({ status }) => status === 'rejected').reason.code, 'SETTINGS_REVISION_CONFLICT')
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM settings_mutation_receipts WHERE resource_key = 'paymentMethods'").get().n, 1)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
  assert.deepEqual((await loadPaymentMethods(db, BUSINESS)).data, results.find(({ status }) => status === 'fulfilled').value.resource.data)
})

test('replay returns the historical payment result and mutation reuse with another payload is rejected', async (t) => {
  const { db } = setup(t)
  const data = changedPaymentMethods()
  await savePaymentMethods(db, BUSINESS, input('replay', data), NOW)
  const later = structuredClone(data)
  later.defaultMethod = 'transfer'
  await savePaymentMethods(db, BUSINESS, input('later', later, 2), new Date(+NOW + 1000))

  const replay = await savePaymentMethods(db, BUSINESS, input('replay', data), new Date(+NOW + 2000))
  assert.equal(replay.receipt.replayed, true)
  assert.equal(replay.resource.revision, 2)
  assert.deepEqual(replay.resource.data, data)
  await assert.rejects(savePaymentMethods(db, BUSINESS, input('replay', later), NOW), {
    status: 409,
    code: 'SETTINGS_MUTATION_REUSED',
  })
})

test('no-op creates a receipt without changing payment revision or timestamps', async (t) => {
  const { db, sqlite } = setup(t)
  const before = sqlite.prepare('SELECT * FROM business_payment_settings').get()
  const saved = await savePaymentMethods(db, BUSINESS, input('noop', structuredClone(DEFAULT_PAYMENT_METHODS)), NOW)

  assert.equal(saved.resource.revision, 1)
  assert.deepEqual(sqlite.prepare('SELECT * FROM business_payment_settings').get(), before)
  assert.equal((await readSettingsReceipt(db, BUSINESS, 'paymentMethods', 'noop', NOW)).committedRevision, 1)
})

test('payment and operation revisions remain independent', async (t) => {
  const { db } = setup(t)
  const operationData = structuredClone(DEFAULT_OPERATIONS)
  operationData.defaultModality = 'Retirada'
  await saveOperations(db, BUSINESS, { expectedRevision: 1, mutationId: 'operation', data: operationData }, NOW)

  const payment = await savePaymentMethods(db, BUSINESS, input('payment', changedPaymentMethods()), NOW)

  assert.equal((await loadOperations(db, BUSINESS)).revision, 2)
  assert.equal(payment.resource.revision, 2)
})

test('saving payment settings never rewrites historical payment or movement values', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare(`INSERT INTO orders (id, business_id, client_name_snapshot, type, order_date, status,
    subtotal_cents, total_cents, created_at) VALUES ('history-order', ?, 'Cliente', 'Retirada',
    '2026-09-12', 'finalizado', 1000, 1000, ?)`)
    .run(BUSINESS, NOW.toISOString())
  sqlite.prepare(`INSERT INTO payment_receipts (id, business_id, total_cents, paid_at, created_at)
    VALUES ('history-receipt', ?, 1000, ?, ?)`)
    .run(BUSINESS, NOW.toISOString(), NOW.toISOString())
  sqlite.prepare(`INSERT INTO payment_allocations (id, business_id, receipt_id, method_code, method_label,
    amount_cents, created_at) VALUES ('history-allocation', ?, 'history-receipt', 'cash', 'Dinheiro', 1000, ?)`)
    .run(BUSINESS, NOW.toISOString())
  sqlite.prepare(`INSERT INTO payments (id, business_id, order_id, receipt_id, amount_cents, method, paid_at, created_at)
    VALUES ('history-payment', ?, 'history-order', 'history-receipt', 1000, NULL, ?, ?)`)
    .run(BUSINESS, NOW.toISOString(), NOW.toISOString())
  for (const [index, value] of ['Dinheiro', 'Pix', 'debito', 'credito', 'Transferência', 'Outro'].entries()) {
    sqlite.prepare(`INSERT INTO movements (id, business_id, type, category, payment_method, description,
      value_cents, movement_date, created_at) VALUES (?, ?, 'entrada', 'Vendas', ?, 'Histórico',
      1000, '2026-09-12', ?)`)
      .run(`history-movement-${index}`, BUSINESS, value, NOW.toISOString())
  }
  const paymentBefore = sqlite.prepare("SELECT * FROM payments WHERE id = 'history-payment'").get()
  const allocationBefore = sqlite.prepare("SELECT * FROM payment_allocations WHERE id = 'history-allocation'").get()
  const movementsBefore = sqlite.prepare("SELECT * FROM movements WHERE id LIKE 'history-movement-%' ORDER BY id").all()

  await savePaymentMethods(db, BUSINESS, input('preserve-history', changedPaymentMethods()), NOW)

  assert.deepEqual(sqlite.prepare("SELECT * FROM payments WHERE id = 'history-payment'").get(), paymentBefore)
  assert.deepEqual(sqlite.prepare("SELECT * FROM payment_allocations WHERE id = 'history-allocation'").get(), allocationBefore)
  assert.deepEqual(sqlite.prepare("SELECT * FROM movements WHERE id LIKE 'history-movement-%' ORDER BY id").all(), movementsBefore)
})

test('valid absent aggregate initializes all native methods while partial or missing schema fails closed', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.exec("INSERT INTO businesses VALUES ('new', 'new', 'New', '2026-09-12', '2026-09-12')")
  const absent = await loadPaymentMethods(db, 'new')
  assert.equal(absent.revision, 0)
  assert.deepEqual(absent.data, DEFAULT_PAYMENT_METHODS)
  const initialized = await savePaymentMethods(db, 'new', input('initialize', changedPaymentMethods(), 0), NOW)
  assert.equal(initialized.resource.revision, 1)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM business_payment_methods WHERE business_id = 'new'").get().n, 6)

  for (const corrupt of [
    "DROP TRIGGER business_payment_methods_delete_guard; DELETE FROM business_payment_methods WHERE business_id = 'amor-e-sabor' AND code = 'other'",
    'DROP TABLE settings_tx_assertions',
    'ALTER TABLE business_payment_settings RENAME COLUMN default_method TO missing',
  ]) {
    const fixture = createSettingsDb()
    t.after(fixture.close)
    fixture.sqlite.exec(corrupt)
    await assert.rejects(loadPaymentMethods(fixture.db, BUSINESS), { status: 503, code: 'SETTINGS_UNAVAILABLE' })
  }
})
