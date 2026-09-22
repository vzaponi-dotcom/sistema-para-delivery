import assert from 'node:assert/strict'
import test from 'node:test'
import { createSettingsDb } from './test-support/settingsDb.js'

const BUSINESS = 'amor-e-sabor'
const repositoryPromise = import('./kitchenTvReadRepository.js').catch(() => ({}))

function setup(t) {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  fixture.sqlite.prepare(`UPDATE business_operation_settings SET
    scheduled_prep_lead_minutes = 37,
    scheduled_late_grace_minutes = 9,
    immediate_late_after_minutes = 21,
    immediate_very_late_after_minutes = 44
    WHERE business_id = ?`).run(BUSINESS)

  const insertOrder = fixture.sqlite.prepare(`INSERT INTO orders (
    id, business_id, client_name_snapshot, type, order_date, status,
    subtotal_cents, total_cents, created_at, finished_at, scheduled_for,
    cancelled_at, order_number
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  insertOrder.run('active-now', BUSINESS, 'Ana Souza', 'Entrega', '2026-09-22', 'Em preparo', 4200, 4200,
    '2026-09-22T17:40:00.000Z', null, null, null, 1042)
  insertOrder.run('active-scheduled', BUSINESS, 'Ricardo Martins', 'Retirada', '2026-09-22', 'Agendado', 3800, 3800,
    '2026-09-22T17:45:00.000Z', null, '2026-09-22T20:00:00.000Z', null, 1043)
  insertOrder.run('finished', BUSINESS, 'Finalizado', 'Local', '2026-09-22', 'Finalizado', 1000, 1000,
    '2026-09-22T16:00:00.000Z', '2026-09-22T16:30:00.000Z', null, null, 1040)
  insertOrder.run('cancelled', BUSINESS, 'Cancelado', 'Entrega', '2026-09-22', 'Cancelado', 1000, 1000,
    '2026-09-22T16:10:00.000Z', null, null, '2026-09-22T16:20:00.000Z', 1041)

  const insertItem = fixture.sqlite.prepare(`INSERT INTO order_items (
    id, business_id, order_id, name_snapshot, category_snapshot, size_snapshot,
    quantity, catalog_price_cents, unit_price_cents, price_reason, note, created_at
  ) VALUES (?, ?, ?, ?, '', '', ?, ?, ?, '', ?, ?)`)
  insertItem.run('item-1', BUSINESS, 'active-now', 'Burger Clássico', 1, 4200, 4200, 'Sem cebola', '2026-09-22T17:40:01.000Z')
  insertItem.run('item-2', BUSINESS, 'active-scheduled', 'Suco Natural', 2, 1900, 1900, '', '2026-09-22T17:45:01.000Z')
  return fixture
}

test('returns only active kitchen-safe fields, future scheduled orders and current operation timing', async (t) => {
  const repository = await repositoryPromise
  assert.equal(typeof repository.loadKitchenTvState, 'function')
  const { db } = setup(t)
  const forbiddenSql = /client_phone|client_address|subtotal|total_cents|delivery_fee|adjustment|payment|movement|refund|print_job|catalog_price|unit_price/i
  const guardedDb = { ...db, prepare(sql) {
    assert.doesNotMatch(sql, forbiddenSql)
    return db.prepare(sql)
  } }

  const state = await repository.loadKitchenTvState(guardedDb, BUSINESS)
  assert.deepEqual(state.timing, {
    scheduledPrepLeadMinutes: 37,
    scheduledLateGraceMinutes: 9,
    immediateLateAfterMinutes: 21,
    immediateVeryLateAfterMinutes: 44,
  })
  assert.deepEqual(state.orders, [
    {
      id: 'active-now', orderNumber: 1042, client: 'Ana Souza', type: 'Entrega', status: 'Em preparo',
      orderDate: '2026-09-22', createdAt: '2026-09-22T17:40:00.000Z', scheduledFor: null,
      items: [{ quantity: 1, name: 'Burger Clássico', note: 'Sem cebola' }],
    },
    {
      id: 'active-scheduled', orderNumber: 1043, client: 'Ricardo Martins', type: 'Retirada', status: 'Agendado',
      orderDate: '2026-09-22', createdAt: '2026-09-22T17:45:00.000Z', scheduledFor: '2026-09-22T20:00:00.000Z',
      items: [{ quantity: 2, name: 'Suco Natural', note: '' }],
    },
  ])
})

test('serialized state never exposes contact, financial, refund, printing or catalog fields', async (t) => {
  const repository = await repositoryPromise
  const { db } = setup(t)
  const serialized = JSON.stringify(await repository.loadKitchenTvState(db, BUSINESS)).toLowerCase()
  for (const forbidden of [
    'phone', 'address', 'subtotal', 'totalcents', 'deliveryfee', 'adjustment', 'payment',
    'movement', 'refund', 'printer', 'printjob', 'qz', 'productid', 'clientid',
  ]) assert.equal(serialized.includes(forbidden), false, `forbidden Kitchen TV field: ${forbidden}`)
})
