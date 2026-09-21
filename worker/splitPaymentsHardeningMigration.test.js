import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'

const migrations = new URL('../migrations/', import.meta.url)
const AT = '2026-09-21T12:00:00.000Z'

const applyThrough = (maximum) => {
  const sqlite = new DatabaseSync(':memory:')
  const files = readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
  for (const file of files.filter((name) => Number(name.slice(0, 4)) <= maximum)) {
    sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
  }
  sqlite.exec('PRAGMA foreign_keys = ON')
  return sqlite
}

const seedOrder = (sqlite) => sqlite.exec(`
  INSERT INTO orders (id, business_id, client_name_snapshot, type, order_date, status, subtotal_cents, total_cents, created_at)
  VALUES ('hard-order', 'amor-e-sabor', 'Cliente', 'Entrega', '2026-09-21', 'Finalizado', 1000, 1000, '${AT}');
`)

const legacyPaymentInsert = (sqlite, id = 'legacy-pay') => sqlite.prepare(`INSERT INTO payments
  (id, business_id, order_id, receipt_id, amount_cents, method, paid_at, created_at)
  VALUES (?, 'amor-e-sabor', 'hard-order', NULL, 1000, 'Pix', ?, ?)`)
  .run(id, AT, AT)

test('0027 rejects scalar or receipt-less new payments that 0026 still permits', () => {
  const before = applyThrough(26)
  try {
    seedOrder(before)
    assert.doesNotThrow(() => legacyPaymentInsert(before))
  } finally {
    before.close()
  }

  const after = applyThrough(27)
  try {
    seedOrder(after)
    assert.throws(() => legacyPaymentInsert(after), /SPLIT_PAYMENT_REQUIRED/)
  } finally {
    after.close()
  }
})

test('0027 rejects sale movements without receipt and allocation identities', () => {
  const sqlite = applyThrough(27)
  try {
    seedOrder(sqlite)
    sqlite.exec(`
      INSERT INTO payment_receipts (id, business_id, total_cents, paid_at, created_at)
      VALUES ('receipt-hard', 'amor-e-sabor', 1000, '${AT}', '${AT}');
      INSERT INTO payment_allocations (id, business_id, receipt_id, method_code, method_label, amount_cents, created_at)
      VALUES ('allocation-hard', 'amor-e-sabor', 'receipt-hard', 'pix', 'Pix', 1000, '${AT}');
      INSERT INTO payments (id, business_id, order_id, receipt_id, amount_cents, method, paid_at, created_at)
      VALUES ('payment-hard', 'amor-e-sabor', 'hard-order', 'receipt-hard', 1000, NULL, '${AT}', '${AT}');
    `)
    assert.throws(() => sqlite.exec(`INSERT INTO movements
      (id, business_id, type, category, description, value_cents, source, order_id, payment_id, movement_date, created_at, payment_method, updated_at)
      VALUES ('bad-sale', 'amor-e-sabor', 'entrada', 'Vendas', 'Venda', 1000, 'order-payment', 'hard-order', 'payment-hard', '2026-09-21', '${AT}', 'Pix', '${AT}')`), /SPLIT_PAYMENT_MOVEMENT_REQUIRED/)
    assert.doesNotThrow(() => sqlite.exec(`INSERT INTO movements
      (id, business_id, type, category, description, value_cents, source, order_id, payment_id, movement_date, created_at, payment_method, updated_at, receipt_id, payment_allocation_id)
      VALUES ('good-sale', 'amor-e-sabor', 'entrada', 'Vendas', 'Venda', 1000, 'order-payment', 'hard-order', 'payment-hard', '2026-09-21', '${AT}', 'Pix', '${AT}', 'receipt-hard', 'allocation-hard')`))
  } finally {
    sqlite.close()
  }
})
