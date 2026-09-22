import test from 'node:test'
import assert from 'node:assert/strict'
import { getNavigationBadge } from './navigationBadges.js'

test('formats operational badges and caps only the visual value', () => {
  assert.deepEqual(getNavigationBadge({ id: 'orders', label: 'Pedidos' }, { orders: 127 }), { count: 127, text: '99+', ariaLabel: 'Pedidos, 127 pedidos em andamento' })
  assert.equal(getNavigationBadge({ id: 'orders', label: 'Pedidos' }, { orders: 0 }), null)
})

test('formats singular comanda copy', () => {
  assert.equal(getNavigationBadge({ id: 'comandas', label: 'Comandas' }, { comandas: 1 }).ariaLabel, 'Comandas, 1 comanda aberta')
})

test('history fallback never exposes the operational Orders count', () => {
  assert.equal(getNavigationBadge({ id: 'history', area: 'orders', label: 'Pedidos' }, { orders: 8 }), null)
})
