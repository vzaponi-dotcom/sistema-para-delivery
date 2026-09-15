import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createManualMovement,
  softDeleteManualMovement,
  updateManualMovement,
  upsertFinanceSettings,
} from './financeRepository.js'
import { createSettingsDb } from './test-support/settingsDb.js'

const BUSINESS = 'amor-e-sabor'
const input = {
  type: 'saida', category: 'packaging', description: 'Caixas', valueCents: 2550,
  movementDate: '2026-09-02', paymentMethod: 'Pix',
}
const now = new Date('2026-09-03T20:00:00.000Z')
const later = new Date('2026-09-03T21:00:00.000Z')

function setup(t) {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  return fixture
}

test('manual movement CRUD persists metadata and soft deletion', async (t) => {
  const { db, sqlite } = setup(t)
  const created = await createManualMovement(db, BUSINESS, input, now)
  assert.equal(created.source, 'manual')
  assert.equal(created.paymentMethod, 'Pix')
  assert.equal(created.movementDate, '2026-09-02')

  const updated = await updateManualMovement(db, BUSINESS, created.id, { ...input, valueCents: 3000 }, later)
  assert.equal(updated.value, 30)
  assert.equal(updated.createdAt, created.createdAt)
  assert.notEqual(updated.updatedAt, created.updatedAt)

  const deletedId = await softDeleteManualMovement(db, BUSINESS, created.id, later)
  assert.equal(deletedId, created.id)
  assert.ok(sqlite.prepare('SELECT deleted_at FROM movements WHERE id = ?').get(created.id).deleted_at)
  assert.equal(await updateManualMovement(db, BUSINESS, created.id, input, later), null)
})

test('system-managed movements cannot be edited or deleted', async (t) => {
  const { db, sqlite } = setup(t)
  for (const source of ['order-payment', 'order-refund']) {
    const id = `m-${source}`
    sqlite.prepare(`INSERT INTO movements (id, business_id, type, category, description, value_cents, source,
      order_id, payment_id, payment_method, movement_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Sistema', 1000, ?, NULL, NULL, 'Pix', '2026-09-03', ?, ?)`).run(
      id, BUSINESS, source === 'order-payment' ? 'entrada' : 'saida',
      source === 'order-payment' ? 'Vendas' : 'Estornos', source, now.toISOString(), now.toISOString(),
    )
    await assert.rejects(() => updateManualMovement(db, BUSINESS, id, input, later),
      (error) => error?.status === 409 && error?.code === 'MOVEMENT_MANAGED_BY_SYSTEM')
    await assert.rejects(() => softDeleteManualMovement(db, BUSINESS, id, later),
      (error) => error?.status === 409 && error?.code === 'MOVEMENT_MANAGED_BY_SYSTEM')
  }
})

test('finance settings upsert preserves createdAt while updating opening values', async (t) => {
  const { db } = setup(t)
  const first = await upsertFinanceSettings(db, BUSINESS,
    { openingBalanceCents: -1000, openingDate: '2026-09-01' }, now)
  assert.equal(first.openingBalance, -10)
  assert.equal(first.openingDate, '2026-09-01')

  const second = await upsertFinanceSettings(db, BUSINESS,
    { openingBalanceCents: 2500, openingDate: '2026-09-02' }, later)
  assert.equal(second.openingBalance, 25)
  assert.equal(second.createdAt, first.createdAt)
  assert.notEqual(second.updatedAt, first.updatedAt)
})
