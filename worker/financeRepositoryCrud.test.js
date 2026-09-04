import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createManualMovement,
  softDeleteManualMovement,
  updateManualMovement,
  upsertFinanceSettings,
} from './financeRepository.js'

class FinanceDb {
  constructor() {
    this.movements = new Map()
    this.settings = new Map()
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        return {
          async first() {
            if (sql.includes('FROM movements')) {
              const [id, businessId] = values
              const row = db.movements.get(id)
              return row?.business_id === businessId && !row.deleted_at ? { ...row } : null
            }
            if (sql.includes('FROM finance_settings')) {
              const [businessId] = values
              return db.settings.get(businessId) ?? null
            }
            return null
          },
          async run() {
            if (sql.includes('INSERT INTO movements')) {
              const [id, businessId, type, category, description, valueCents, source, orderId, paymentId, paymentMethod, movementDate, createdAt, updatedAt] = values
              db.movements.set(id, {
                id, business_id: businessId, type, category, description, value_cents: valueCents,
                source, order_id: orderId, payment_id: paymentId, payment_method: paymentMethod,
                movement_date: movementDate, created_at: createdAt, updated_at: updatedAt, deleted_at: null,
              })
            } else if (sql.includes('UPDATE movements SET type')) {
              const [type, category, description, valueCents, paymentMethod, movementDate, updatedAt, id, businessId] = values
              const row = db.movements.get(id)
              if (row?.business_id === businessId && !row.deleted_at) Object.assign(row, {
                type, category, description, value_cents: valueCents, payment_method: paymentMethod,
                movement_date: movementDate, updated_at: updatedAt,
              })
            } else if (sql.includes('UPDATE movements SET deleted_at')) {
              const [deletedAt, updatedAt, id, businessId] = values
              const row = db.movements.get(id)
              if (row?.business_id === businessId && !row.deleted_at) Object.assign(row, { deleted_at: deletedAt, updated_at: updatedAt })
            } else if (sql.includes('INSERT INTO finance_settings')) {
              const [businessId, openingBalanceCents, openingDate, createdAt, updatedAt] = values
              const existing = db.settings.get(businessId)
              db.settings.set(businessId, {
                business_id: businessId,
                opening_balance_cents: openingBalanceCents,
                opening_date: openingDate,
                created_at: existing?.created_at ?? createdAt,
                updated_at: updatedAt,
              })
            }
            return { success: true }
          },
        }
      },
    }
  }
}

const input = {
  type: 'saida', category: 'packaging', description: 'Caixas', valueCents: 2550,
  movementDate: '2026-09-02', paymentMethod: 'Pix',
}
const now = new Date('2026-09-03T20:00:00.000Z')
const later = new Date('2026-09-03T21:00:00.000Z')

test('manual movement CRUD persists metadata and soft deletion', async () => {
  const db = new FinanceDb()
  const created = await createManualMovement(db, 'biz', input, now)
  assert.equal(created.source, 'manual')
  assert.equal(created.paymentMethod, 'Pix')
  assert.equal(created.movementDate, '2026-09-02')

  const updated = await updateManualMovement(db, 'biz', created.id, { ...input, valueCents: 3000 }, later)
  assert.equal(updated.value, 30)
  assert.equal(updated.createdAt, created.createdAt)
  assert.notEqual(updated.updatedAt, created.updatedAt)

  const deletedId = await softDeleteManualMovement(db, 'biz', created.id, later)
  assert.equal(deletedId, created.id)
  assert.ok(db.movements.get(created.id).deleted_at)
  assert.equal(await updateManualMovement(db, 'biz', created.id, input, later), null)
})

test('system-managed movements cannot be edited or deleted', async () => {
  for (const source of ['order-payment', 'order-refund']) {
    const db = new FinanceDb()
    db.movements.set(`m-${source}`, {
      id: `m-${source}`, business_id: 'biz', type: source === 'order-payment' ? 'entrada' : 'saida',
      category: source === 'order-payment' ? 'Vendas' : 'Estornos', description: 'Sistema', value_cents: 1000,
      source, order_id: 'o1', payment_id: 'p1', payment_method: 'Pix', movement_date: '2026-09-03',
      created_at: now.toISOString(), updated_at: now.toISOString(), deleted_at: null,
    })
    await assert.rejects(() => updateManualMovement(db, 'biz', `m-${source}`, input, later), (error) => error?.status === 409 && error?.code === 'MOVEMENT_MANAGED_BY_SYSTEM')
    await assert.rejects(() => softDeleteManualMovement(db, 'biz', `m-${source}`, later), (error) => error?.status === 409 && error?.code === 'MOVEMENT_MANAGED_BY_SYSTEM')
  }
})

test('finance settings upsert preserves createdAt while updating opening values', async () => {
  const db = new FinanceDb()
  const first = await upsertFinanceSettings(db, 'biz', { openingBalanceCents: -1000, openingDate: '2026-09-01' }, now)
  assert.equal(first.openingBalance, -10)
  assert.equal(first.openingDate, '2026-09-01')

  const second = await upsertFinanceSettings(db, 'biz', { openingBalanceCents: 2500, openingDate: '2026-09-02' }, later)
  assert.equal(second.openingBalance, 25)
  assert.equal(second.createdAt, first.createdAt)
  assert.notEqual(second.updatedAt, first.updatedAt)
})
