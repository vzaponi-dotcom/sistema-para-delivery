import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PAYMENT_METHODS,
  getBusinessDate,
  getManualMovementCategoryOptions,
  getMovementCategoryLabel,
  isManualMovementCategory,
  normalizeMovementCategory,
} from './finance.js'

test('manual categories are distinct by movement type', () => {
  assert.deepEqual(getManualMovementCategoryOptions('entrada').map((item) => item.value), ['contribution', 'other_income'])
  assert.equal(isManualMovementCategory('entrada', 'sales'), false)
  assert.equal(isManualMovementCategory('saida', 'packaging'), true)
  assert.equal(isManualMovementCategory('saida', 'contribution'), false)
})

test('legacy categories normalize without rewriting the stored row', () => {
  assert.equal(normalizeMovementCategory({ type: 'entrada', category: 'Vendas', source: 'order-payment' }), 'sales')
  assert.equal(normalizeMovementCategory({ type: 'saida', category: 'Estornos', source: 'order-refund' }), 'refunds')
  assert.equal(normalizeMovementCategory({ type: 'saida', category: 'Insumos', source: 'manual' }), 'supplies')
  assert.equal(normalizeMovementCategory({ type: 'entrada', category: 'Outros', source: 'manual' }), 'other_income')
  assert.equal(getMovementCategoryLabel({ type: 'saida', category: 'packaging', source: 'manual' }), 'Embalagens')
})

test('finance business date uses America/Sao_Paulo', () => {
  assert.equal(getBusinessDate(new Date('2026-09-04T01:30:00.000Z')), '2026-09-03')
})

test('payment methods match the operational payment vocabulary', () => {
  assert.deepEqual(PAYMENT_METHODS, ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro'])
})
