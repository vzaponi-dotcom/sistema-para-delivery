import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { seedTenantResources } from '../test-support/tenantResources.js'

const relations = [
  ['orders', 'order', 'client_id', 'client'], ['orders', 'order', 'table_tab_id', 'tab'],
  ['order_items', 'item', 'order_id', 'order'], ['order_items', 'item', 'product_id', 'product'],
  ['payments', 'payment', 'order_id', 'order'], ['payment_receipts', 'receipt', 'table_tab_id', 'tab'],
  ['movements', 'movement', 'order_id', 'order'], ['movements', 'movement', 'payment_id', 'payment'],
  ['table_tabs', 'tab', 'table_id', 'table'], ['table_reservations', 'reservation', 'order_id', 'order'],
  ['table_reservations', 'reservation', 'table_id', 'table'], ['table_reservations', 'reservation', 'converted_table_tab_id', 'tab'],
  ['print_jobs', 'job', 'order_id', 'order'], ['print_jobs', 'job', 'table_tab_id', 'tab'],
  ['print_jobs', 'job', 'parent_job_id', 'job'], ['print_jobs', 'job', 'station_id', 'station'],
  ['print_job_attempts', 'attempt', 'job_id', 'job'], ['print_job_attempts', 'attempt', 'station_id', 'station'],
  ['print_stations', 'station', 'recovery_job_id', 'job'],
]
const mismatch = /TENANT_REFERENCE_MISMATCH|TABLE_RESERVATION_SCOPE_MISMATCH/
test('every operational relation rejects foreign-company references on INSERT and UPDATE', async t => {
  const f = await createTenancyFixture(t), a = seedTenantResources(f.sqlite, f.businesses.A, 'A'), b = seedTenantResources(f.sqlite, f.businesses.B, 'B')
  for (const [table, entity, field, parent] of relations) {
    const changes = { [field]: b[parent] }
    if (table === 'print_jobs' && field === 'table_tab_id') Object.assign(changes, { type: 'table-tab', order_id: null })
    if (table === 'table_reservations' && field === 'converted_table_tab_id') Object.assign(changes, { status: 'converted', converted_at: f.now.toISOString() })
    const row = f.sqlite.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(a[entity])
    assert.throws(() => f.sqlite.prepare(`UPDATE ${table} SET ${Object.keys(changes).map(key => `${key} = ?`).join(',')} WHERE id = ?`).run(...Object.values(changes), row.id), mismatch, `UPDATE ${table}.${field}`)
    const clone = { ...row, ...changes, id: crypto.randomUUID() }
    if (table === 'print_job_attempts') clone.spool_job_name = crypto.randomUUID()
    assert.throws(() => f.sqlite.prepare(`INSERT INTO ${table}(${Object.keys(clone).join(',')}) VALUES(${Object.keys(clone).map(() => '?').join(',')})`).run(...Object.values(clone)), mismatch, `INSERT ${table}.${field}`)
  }
  assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

test('company ownership is immutable while legitimate null references and snapshots remain valid', async t => {
  const f = await createTenancyFixture(t), a = seedTenantResources(f.sqlite, f.businesses.A, 'A')
  for (const [table, entity] of [['clients', 'client'], ['products', 'product'], ['orders', 'order'], ['order_items', 'item'], ['payments', 'payment'], ['payment_receipts', 'receipt'], ['movements', 'movement'], ['tables', 'table'], ['table_tabs', 'tab'], ['table_reservations', 'reservation'], ['print_jobs', 'job'], ['print_job_attempts', 'attempt'], ['print_stations', 'station']]) {
    assert.throws(() => f.sqlite.prepare(`UPDATE ${table} SET business_id = ? WHERE id = ?`).run(f.businesses.B, a[entity]), /TENANT_OWNERSHIP_IMMUTABLE/, table)
  }
  f.sqlite.prepare('UPDATE order_items SET product_id = NULL WHERE id = ?').run(a.item)
  assert.equal(f.sqlite.prepare('SELECT name_snapshot FROM order_items WHERE id = ?').get(a.item).name_snapshot, 'Private product A')
  f.sqlite.prepare('UPDATE orders SET client_id = NULL WHERE id = ?').run(a.order)
  f.sqlite.prepare('UPDATE print_jobs SET station_id = NULL,parent_job_id = NULL WHERE id = ?').run(a.job)
  assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

test('migration refuses preexisting crossed data without silently correcting or deleting it', async t => {
  const f = await createTenancyFixture(t), a = seedTenantResources(f.sqlite, f.businesses.A, 'A'), b = seedTenantResources(f.sqlite, f.businesses.B, 'B')
  for (const { name } of f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'tenant_%'").all()) f.sqlite.exec(`DROP TRIGGER ${name}`)
  f.sqlite.prepare('UPDATE orders SET client_id = ? WHERE id = ?').run(b.client, a.order)
  const migration = readFileSync(new URL('../../migrations/0039_tenant_reference_guards.sql', import.meta.url), 'utf8')
  assert.throws(() => f.sqlite.exec(migration), /CHECK constraint failed/)
  assert.equal(f.sqlite.prepare('SELECT client_id FROM orders WHERE id = ?').get(a.order).client_id, b.client)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM orders').get().n, 2)
})
