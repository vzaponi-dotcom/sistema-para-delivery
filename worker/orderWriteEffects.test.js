import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const loadEffects = async () => {
  try {
    return await import('./orderWriteEffects.js')
  } catch {
    return {}
  }
}

class EffectsDb {
  prepare(sql) {
    return {
      bind(...values) {
        return {
          async first() {
            if (sql.includes('FROM movements')) {
              const [businessId, orderId, source] = values
              if (businessId !== 'biz' || orderId !== 'o1' || source !== 'order-payment') return null
              return {
                id: 'm1', type: 'entrada', category: 'Vendas', description: 'Pagamento pedido', value_cents: 8050,
                source: 'order-payment', order_id: 'o1', payment_id: 'p1', movement_date: '2026-09-03', created_at: '2026-09-03T15:00:00.000Z',
              }
            }
            if (sql.includes('FROM table_tabs')) {
              const [id, businessId] = values
              if (id !== 't1' || businessId !== 'biz') return null
              return { id: 't1', table_id: 'table-1', table_identifier: '04', tab_number: 1042, status: 'closed', opened_at: '2026-09-03T14:00:00.000Z', closed_at: '2026-09-03T15:00:00.000Z' }
            }
            return null
          },
        }
      },
    }
  }
}

test('write-effect readers return mapped payment movement and current table tab', async () => {
  const effects = await loadEffects()
  assert.equal(typeof effects.loadMovementByOrderSource, 'function')
  assert.equal(typeof effects.loadTableTabById, 'function')

  const db = new EffectsDb()
  const movement = await effects.loadMovementByOrderSource(db, 'biz', 'o1', 'order-payment')
  const tableTab = await effects.loadTableTabById(db, 'biz', 't1')

  assert.deepEqual(movement, {
    id: 'm1', type: 'entrada', category: 'Vendas', description: 'Pagamento pedido', value: 80.5,
    source: 'order-payment', orderId: 'o1', paymentId: 'p1', paymentMethod: null,
    movementDate: '2026-09-03', date: '2026-09-03', createdAt: '2026-09-03T15:00:00.000Z', updatedAt: '2026-09-03T15:00:00.000Z',
  })
  assert.deepEqual(tableTab, {
    id: 't1', tableId: 'table-1', tableIdentifier: '04', tabNumber: 1042, status: 'closed', openedAt: '2026-09-03T14:00:00.000Z', closedAt: '2026-09-03T15:00:00.000Z',
  })
})

test('checkout and payment routes expose the authoritative effects to the client', async () => {
  const source = await readFile(new URL('./index.js', import.meta.url), 'utf8')
  assert.match(source, /loadMovementByOrderSource/)
  assert.match(source, /loadTableTabById/)
  assert.match(source, /return json\(\{ order, movement, tableTab, printJob \}/)
  assert.match(source, /return json\(\{ \.\.\.result, tableTab \}/)
})
