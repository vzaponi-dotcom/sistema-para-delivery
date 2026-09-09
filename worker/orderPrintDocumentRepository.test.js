import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { loadOrderPrintDocument } from './orderPrintDocumentRepository.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      CREATE TABLE businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        order_number INTEGER,
        client_id TEXT,
        client_name_snapshot TEXT NOT NULL,
        client_phone_snapshot TEXT NOT NULL DEFAULT '',
        client_address_snapshot TEXT NOT NULL DEFAULT '',
        customer_identity_type TEXT NOT NULL DEFAULT 'registered_client',
        table_tab_id TEXT,
        type TEXT NOT NULL,
        order_date TEXT NOT NULL,
        subtotal_cents INTEGER NOT NULL,
        delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
        adjustment_type TEXT NOT NULL DEFAULT 'none',
        adjustment_amount_cents INTEGER NOT NULL DEFAULT 0,
        adjustment_reason TEXT NOT NULL DEFAULT '',
        total_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        name_snapshot TEXT NOT NULL,
        size_snapshot TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        method TEXT NOT NULL,
        paid_at TEXT NOT NULL
      );
      CREATE TABLE table_tabs (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        table_identifier TEXT NOT NULL
      );
    `)
  }

  prepare(sql) {
    const database = this.sqlite
    return {
      bind(...values) {
        return {
          async first() { return database.prepare(sql).get(...values) ?? null },
          async all() { return { results: database.prepare(sql).all(...values) } },
          async run() {
            const result = database.prepare(sql).run(...values)
            return { success: true, meta: { changes: Number(result.changes || 0) } }
          },
        }
      },
    }
  }

  exec(sql) { this.sqlite.exec(sql) }
}

const seedOrder = (db) => {
  db.exec(`
    INSERT INTO businesses (id, name) VALUES ('amor-e-sabor', 'Amor & Sabor'), ('other', 'Outro');
    INSERT INTO orders (
      id, business_id, client_name_snapshot, client_phone_snapshot, client_address_snapshot,
      order_number, type, order_date, subtotal_cents, delivery_fee_cents, adjustment_type,
      adjustment_amount_cents, adjustment_reason, total_cents, created_at
    ) VALUES (
      'o1', 'amor-e-sabor', 'João Silva', '(11) 99876-5432', 'Rua das Flores, 123',
      58, 'Entrega', '2026-09-03', 7950, 800, 'discount', 200, 'fidelidade', 8550,
      '2026-09-03T23:31:00.000Z'
    );
    INSERT INTO order_items (
      id, business_id, order_id, name_snapshot, size_snapshot, quantity, unit_price_cents, note, created_at
    ) VALUES
      ('i1', 'amor-e-sabor', 'o1', 'X-BURGER', '', 2, 3000, 'sem cebola', '2026-09-03T23:31:00.000Z'),
      ('i2', 'amor-e-sabor', 'o1', 'BATATA', 'G', 1, 1950, '', '2026-09-03T23:31:01.000Z');
    INSERT INTO payments (id, business_id, order_id, method, paid_at)
      VALUES ('p1', 'amor-e-sabor', 'o1', 'Pix', '2026-09-03T23:32:00.000Z');

    INSERT INTO table_tabs (id, business_id, table_identifier) VALUES ('tab-4', 'amor-e-sabor', 'Mesa 4');
    INSERT INTO orders (
      id, business_id, client_id, client_name_snapshot, client_phone_snapshot, client_address_snapshot, customer_identity_type, table_tab_id,
      order_number, type, order_date, subtotal_cents, delivery_fee_cents, adjustment_type,
      adjustment_amount_cents, adjustment_reason, total_cents, created_at
    ) VALUES (
      'local-with-client', 'amor-e-sabor', 'client-4', 'Hugo', '', '', 'table', 'tab-4',
      59, 'Local', '2026-09-03', 3200, 0, 'none', 0, '', 3200,
      '2026-09-03T20:00:00.000Z'
    );

    INSERT INTO orders (
      id, business_id, client_name_snapshot, client_phone_snapshot, client_address_snapshot,
      order_number, type, order_date, subtotal_cents, delivery_fee_cents, adjustment_type,
      adjustment_amount_cents, adjustment_reason, total_cents, created_at
    ) VALUES (
      'legacy', 'amor-e-sabor', 'Mesa A-01', '', '',
      60, 'Local', '2026-09-03', 3200, 0, 'none', 0, '', 3200,
      '2026-09-03T20:00:00.000Z'
    );
    INSERT INTO order_items (
      id, business_id, order_id, name_snapshot, size_snapshot, quantity, unit_price_cents, note, created_at
    ) VALUES ('legacy-i1', 'amor-e-sabor', 'legacy', 'Marmita', 'G', 1, 3200, '', '2026-09-03T20:00:00.000Z');
  `)
}

test('current order print document is rebuilt from immutable order/item snapshots and raw integer cents', async () => {
  const db = new D1Sqlite()
  seedOrder(db)

  const document = await loadOrderPrintDocument(db, 'amor-e-sabor', 'o1')

  assert.equal(document.business.name, 'Amor & Sabor')
  assert.equal(document.order.id, 'o1')
  assert.equal(document.order.number, '58')
  assert.equal(document.customer.name, 'João Silva')
  assert.equal(document.customer.phone, '(11) 99876-5432')
  assert.equal(document.customer.address, 'Rua das Flores, 123')
  assert.equal(document.items.length, 2)
  assert.equal(document.items[0].name, 'X-BURGER')
  assert.equal(document.items[0].note, 'sem cebola')
  assert.equal(document.items[0].unitPriceCents, 3000)
  assert.equal(document.items[1].presentation, 'G')
  assert.equal(document.financial.subtotalCents, 7950)
  assert.equal(document.financial.deliveryFeeCents, 800)
  assert.deepEqual(document.financial.adjustment, {
    type: 'discount', amountCents: 200, reason: 'fidelidade',
  })
  assert.equal(document.financial.totalCents, 8550)
  assert.deepEqual(document.payment, { status: 'Pago', method: 'Pix' })
})

test('legacy-compatible blank contact snapshots stay blank and unpaid order stays pending', async () => {
  const db = new D1Sqlite()
  seedOrder(db)

  const document = await loadOrderPrintDocument(db, 'amor-e-sabor', 'legacy')

  assert.deepEqual(document.customer, { name: 'Mesa A-01', phone: '', address: '' })
  assert.deepEqual(document.payment, { status: 'Pendente', method: '' })
  assert.equal(document.financial.deliveryFeeCents, 0)
})

test('local ticket identity comes from the immutable table tab snapshot after a table rename', async () => {
  const db = new D1Sqlite()
  seedOrder(db)

  const document = await loadOrderPrintDocument(db, 'amor-e-sabor', 'local-with-client')

  assert.equal(document.customer.name, 'Mesa 4 · Hugo')
})

test('order print document lookup is business scoped and missing orders return null', async () => {
  const db = new D1Sqlite()
  seedOrder(db)

  assert.equal(await loadOrderPrintDocument(db, 'other', 'o1'), null)
  assert.equal(await loadOrderPrintDocument(db, 'amor-e-sabor', 'missing'), null)
})
