import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateCurrentBalance,
  filterFinanceHistory,
  filterMovementsByPeriod,
  getFinancePeriodRange,
  hasFinanceSecondaryFilters,
  summarizeFinancePeriod,
} from './finance.js'

test('today, 7d, 30d and custom finance ranges are inclusive', () => {
  assert.deepEqual(getFinancePeriodRange({ key: 'today' }, '2026-09-03'), { startDate: '2026-09-03', endDate: '2026-09-03' })
  assert.deepEqual(getFinancePeriodRange({ key: '7d' }, '2026-09-03'), { startDate: '2026-08-28', endDate: '2026-09-03' })
  assert.deepEqual(getFinancePeriodRange({ key: '30d' }, '2026-09-03'), { startDate: '2026-08-05', endDate: '2026-09-03' })
  assert.deepEqual(getFinancePeriodRange({ key: 'custom', startDate: '2026-08-10', endDate: '2026-08-12' }, '2026-09-03'), { startDate: '2026-08-10', endDate: '2026-08-12' })
})

test('period summary and current balance ignore deleted rows and respect opening date', () => {
  const movements = [
    { id: 'before', type: 'entrada', value: 100, movementDate: '2026-08-31' },
    { id: 'open', type: 'entrada', value: 50, movementDate: '2026-09-01' },
    { id: 'exit', type: 'saida', value: 20, movementDate: '2026-09-02' },
    { id: 'deleted', type: 'entrada', value: 999, movementDate: '2026-09-02', deletedAt: '2026-09-03T12:00:00.000Z' },
  ]

  const range = { startDate: '2026-09-01', endDate: '2026-09-03' }
  assert.deepEqual(filterMovementsByPeriod(movements, range).map((item) => item.id), ['open', 'exit'])
  assert.deepEqual(summarizeFinancePeriod(movements, range), { entries: 50, exits: 20, result: 30 })
  assert.equal(calculateCurrentBalance(movements, { openingBalance: 200, openingDate: '2026-09-01' }), 230)
  assert.equal(calculateCurrentBalance(movements, null), null)
})

test('history filters combine search, type, normalized category and payment method', () => {
  const movements = [
    { id: 'm-packaging', type: 'saida', category: 'packaging', description: 'Compra de embalagem kraft', value: 25, paymentMethod: 'Pix', movementDate: '2026-09-03' },
    { id: 'm-supplies', type: 'saida', category: 'Insumos', description: 'Arroz', value: 40, paymentMethod: null, movementDate: '2026-09-03' },
    { id: 'm-income', type: 'entrada', category: 'Aporte', description: 'Reforço de caixa', value: 100, paymentMethod: 'Dinheiro', movementDate: '2026-09-03' },
  ]

  assert.deepEqual(filterFinanceHistory(movements, {
    search: 'embalagem', type: 'saida', category: 'packaging', paymentMethod: 'Pix',
  }).map((item) => item.id), ['m-packaging'])

  assert.deepEqual(filterFinanceHistory(movements, {
    search: '', type: 'saida', category: 'supplies', paymentMethod: '__missing__',
  }).map((item) => item.id), ['m-supplies'])
})

test('secondary filter detection ignores an empty filter set', () => {
  assert.equal(hasFinanceSecondaryFilters({ search: '', type: '', category: '', paymentMethod: '' }), false)
  assert.equal(hasFinanceSecondaryFilters({ search: 'arroz', type: '', category: '', paymentMethod: '' }), true)
  assert.equal(hasFinanceSecondaryFilters({ search: '', type: 'saida', category: '', paymentMethod: '' }), true)
})
