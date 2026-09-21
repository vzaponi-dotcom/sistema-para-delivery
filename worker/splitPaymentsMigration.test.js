import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'

const migrations = new URL('../migrations/', import.meta.url)
const BUSINESS = 'amor-e-sabor'
const EARLY = '2026-08-01T10:00:00.000Z'
const LATE = '2026-08-01T12:00:00.000Z'

const rows = (sqlite, sql, ...values) => sqlite.prepare(sql).all(...values).map((row) => ({ ...row }))
const one = (sqlite, sql, ...values) => rows(sqlite, sql, ...values)[0]
const tableNames = (sqlite) => rows(sqlite, "SELECT name FROM sqlite_master WHERE type = 'table'").map(({ name }) => name)

function insert(sqlite, table, data) {
  const keys = Object.keys(data)
  const placeholders = keys.map(() => '?').join(',')
  sqlite.prepare('INSERT INTO ' + table + ' (' + keys.join(',') + ') VALUES (' + placeholders + ')')
    .run(...Object.values(data))
}

function applyMigration(sqlite, file) {
  sqlite.exec('BEGIN')
  try {
    sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
    sqlite.exec('COMMIT')
  } catch (error) {
    sqlite.exec('ROLLBACK')
    throw error
  }
}

function createDatabaseThrough0025() {
  const sqlite = new DatabaseSync(':memory:')
  const files = readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
  try {
    for (const file of files.filter((name) => Number(name.slice(0, 4)) <= 23)) {
      sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
    }
    sqlite.exec('PRAGMA foreign_keys = ON')
    for (const file of files.filter((name) => {
      const number = Number(name.slice(0, 4))
      return number >= 24 && number <= 25
    })) applyMigration(sqlite, file)
    return sqlite
  } catch (error) {
    sqlite.close()
    throw error
  }
}

function read0026() {
  const files = readdirSync(migrations)
    .filter((name) => name.endsWith('.sql') && Number(name.slice(0, 4)) === 26)
    .sort()
  assert.equal(files.length, 1, 'missing migrations/0026_split_payments.sql')
  assert.equal(files[0], '0026_split_payments.sql')
  return readFileSync(new URL(files[0], migrations), 'utf8')
}

function seedHistoricalPayments(sqlite) {
  const tableId = one(sqlite,
    'SELECT id FROM tables WHERE business_id = ? ORDER BY sort_order, id LIMIT 1',
    BUSINESS).id

  insert(sqlite, 'table_tabs', {
    id: 'tab-history',
    business_id: BUSINESS,
    table_identifier: 'Mesa histórica',
    status: 'open',
    opened_at: EARLY,
    closed_at: null,
    created_at: EARLY,
    updated_at: LATE,
    table_id: tableId,
    tab_number: 500,
  })

  const orders = [
    ['order-pix', 'Pix histórico', null, 4200, 501],
    ['order-cash', 'Dinheiro histórico', null, 3000, 502],
    ['order-unknown', 'Método legado', null, 2500, 503],
    ['order-tab-a', 'Mesa histórica', 'tab-history', 1000, 504],
    ['order-tab-b', 'Mesa histórica', 'tab-history', 2000, 505],
  ]
  for (const [id, client, tableTabId, total, orderNumber] of orders) {
    insert(sqlite, 'orders', {
      id,
      business_id: BUSINESS,
      client_name_snapshot: client,
      customer_identity_type: tableTabId ? 'table' : 'guest_name',
      table_tab_id: tableTabId,
      type: tableTabId ? 'Local' : 'Entrega',
      order_date: '2026-08-01',
      status: 'Finalizado',
      subtotal_cents: total,
      total_cents: total,
      created_at: EARLY,
      finished_at: LATE,
      order_number: orderNumber,
    })
  }

  const payments = [
    ['pay-pix', 'order-pix', 4200, 'Pix'],
    ['pay-cash', 'order-cash', 3000, 'Dinheiro'],
    ['pay-unknown', 'order-unknown', 2500, 'Cheque legado'],
    ['pay-tab-a', 'order-tab-a', 1000, 'debito'],
    ['pay-tab-b', 'order-tab-b', 2000, 'Cartão de crédito'],
  ]
  for (const [id, orderId, amount, method] of payments) {
    insert(sqlite, 'payments', {
      id,
      business_id: BUSINESS,
      order_id: orderId,
      amount_cents: amount,
      method,
      paid_at: LATE,
      created_at: LATE,
    })
    insert(sqlite, 'movements', {
      id: 'mov-' + id,
      business_id: BUSINESS,
      type: 'entrada',
      category: 'Vendas',
      description: 'Pagamento histórico ' + orderId,
      value_cents: amount,
      source: 'order-payment',
      order_id: orderId,
      payment_id: id,
      movement_date: '2026-08-01',
      created_at: LATE,
      payment_method: method,
      updated_at: LATE,
      deleted_at: null,
    })
  }

  sqlite.prepare("UPDATE table_tabs SET status = 'closed', closed_at = ?, updated_at = ? WHERE id = 'tab-history'")
    .run(LATE, LATE)

  insert(sqlite, 'movements', {
    id: 'refund-pix',
    business_id: BUSINESS,
    type: 'saida',
    category: 'Estornos',
    description: 'Estorno histórico',
    value_cents: 4200,
    source: 'order-refund',
    order_id: 'order-pix',
    payment_id: 'pay-pix',
    movement_date: '2026-08-01',
    created_at: LATE,
    payment_method: 'Pix',
    updated_at: LATE,
    deleted_at: null,
  })
}

function apply0026(sqlite) {
  applyMigration(sqlite, '0026_split_payments.sql')
}

test('0026 clean install adds normalized payment receipt tables without fabricating data', () => {
  const sqlite = createDatabaseThrough0025()
  try {
    read0026()
    apply0026(sqlite)
    assert.ok(tableNames(sqlite).includes('payment_receipts'))
    assert.ok(tableNames(sqlite).includes('payment_allocations'))
    assert.equal(one(sqlite, 'SELECT count(*) AS n FROM payment_receipts').n, 0)
    assert.equal(one(sqlite, 'SELECT count(*) AS n FROM payment_allocations').n, 0)
    assert.deepEqual(rows(sqlite, 'PRAGMA foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})

test('0026 backfills every historical payment one-to-one and preserves all historical payment and movement bytes', () => {
  const sqlite = createDatabaseThrough0025()
  try {
    seedHistoricalPayments(sqlite)
    const paymentBefore = rows(sqlite, 'SELECT * FROM payments ORDER BY id')
    const movementBefore = rows(sqlite, 'SELECT * FROM movements ORDER BY id')
    const oldPaymentColumns = Object.keys(paymentBefore[0]).join(',')
    const oldMovementColumns = Object.keys(movementBefore[0]).join(',')

    read0026()
    apply0026(sqlite)

    assert.deepEqual(rows(sqlite, 'SELECT ' + oldPaymentColumns + ' FROM payments ORDER BY id'), paymentBefore)
    assert.deepEqual(rows(sqlite, 'SELECT ' + oldMovementColumns + ' FROM movements ORDER BY id'), movementBefore)
    assert.equal(one(sqlite, 'SELECT count(*) AS n FROM payment_receipts').n, 5)
    assert.equal(one(sqlite, 'SELECT count(*) AS n FROM payment_allocations').n, 5)

    assert.deepEqual(one(sqlite,
      "SELECT method_code, method_label, amount_cents FROM payment_allocations WHERE receipt_id = 'legacy-receipt:pay-pix'"),
      { method_code: 'pix', method_label: 'Pix', amount_cents: 4200 })
    assert.deepEqual(one(sqlite,
      "SELECT method_code, method_label, amount_cents FROM payment_allocations WHERE receipt_id = 'legacy-receipt:pay-cash'"),
      { method_code: 'cash', method_label: 'Dinheiro', amount_cents: 3000 })
    assert.deepEqual(one(sqlite,
      "SELECT method_code, method_label, amount_cents FROM payment_allocations WHERE receipt_id = 'legacy-receipt:pay-unknown'"),
      { method_code: null, method_label: 'Cheque legado', amount_cents: 2500 })
    assert.equal(one(sqlite,
      "SELECT method_code FROM payment_allocations WHERE receipt_id = 'legacy-receipt:pay-tab-a'").method_code, 'debit_card')
    assert.equal(one(sqlite,
      "SELECT method_code FROM payment_allocations WHERE receipt_id = 'legacy-receipt:pay-tab-b'").method_code, 'credit_card')

    assert.equal(one(sqlite, "SELECT receipt_id FROM payments WHERE id = 'pay-pix'").receipt_id, 'legacy-receipt:pay-pix')
    assert.equal(one(sqlite, "SELECT receipt_id FROM payments WHERE id = 'pay-tab-a'").receipt_id, 'legacy-receipt:pay-tab-a')
    assert.equal(one(sqlite, "SELECT receipt_id FROM payments WHERE id = 'pay-tab-b'").receipt_id, 'legacy-receipt:pay-tab-b')

    assert.deepEqual(one(sqlite,
      "SELECT receipt_id, payment_allocation_id FROM movements WHERE id = 'mov-pay-pix'"),
      { receipt_id: 'legacy-receipt:pay-pix', payment_allocation_id: 'legacy-allocation:pay-pix' })
    assert.deepEqual(one(sqlite,
      "SELECT receipt_id, payment_allocation_id FROM movements WHERE id = 'refund-pix'"),
      { receipt_id: null, payment_allocation_id: null })

    assert.equal(one(sqlite,
      "SELECT table_tab_id FROM payment_receipts WHERE id = 'legacy-receipt:pay-tab-a'").table_tab_id, null)
    assert.equal(one(sqlite,
      "SELECT table_tab_id FROM payment_receipts WHERE id = 'legacy-receipt:pay-tab-b'").table_tab_id, null)

    const indexNames = rows(sqlite,
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('payments', 'movements') ORDER BY name")
      .map(({ name }) => name)
    for (const name of [
      'payments_business_paid_idx',
      'movements_business_created_idx',
      'movements_business_date_active_idx',
      'idx_movements_one_order_refund',
    ]) assert.ok(indexNames.includes(name), name)

    assert.throws(() => sqlite.prepare(
      'INSERT INTO payments (id, business_id, order_id, amount_cents, method, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('duplicate-payment', BUSINESS, 'order-pix', 4200, 'Pix', LATE, LATE), /UNIQUE constraint/i)

    assert.deepEqual(rows(sqlite, 'PRAGMA foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})

test('0026 rollback restores the original schema and data after a late failure', () => {
  const sqlite = createDatabaseThrough0025()
  try {
    seedHistoricalPayments(sqlite)
    const paymentBefore = rows(sqlite, 'SELECT * FROM payments ORDER BY id')
    const movementBefore = rows(sqlite, 'SELECT * FROM movements ORDER BY id')
    const migration = read0026()

    sqlite.exec('BEGIN')
    try {
      sqlite.exec(migration)
      sqlite.exec('CREATE TABLE payment_receipts (id TEXT)')
      assert.fail('the injected late failure must abort')
    } catch (error) {
      assert.match(String(error?.message || error), /already exists/i)
      sqlite.exec('ROLLBACK')
    }

    assert.equal(tableNames(sqlite).includes('payment_receipts'), false)
    assert.equal(tableNames(sqlite).includes('payment_allocations'), false)
    assert.equal(rows(sqlite, 'PRAGMA table_info(payments)').some(({ name }) => name === 'receipt_id'), false)
    assert.equal(rows(sqlite, 'PRAGMA table_info(movements)').some(({ name }) => name === 'payment_allocation_id'), false)
    assert.deepEqual(rows(sqlite, 'SELECT * FROM payments ORDER BY id'), paymentBefore)
    assert.deepEqual(rows(sqlite, 'SELECT * FROM movements ORDER BY id'), movementBefore)
    assert.deepEqual(rows(sqlite, 'PRAGMA foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
