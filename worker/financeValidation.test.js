import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFinanceSettingsInput, parseManualMovementInput } from './financeValidation.js'

const now = new Date('2026-09-03T20:00:00.000Z')

const expectValidation = (fn, field) => assert.throws(fn, (error) => error?.status === 400 && error?.code === 'VALIDATION_ERROR' && (!field || error?.field === field))

test('manual movement input normalizes the full finance contract', () => {
  assert.deepEqual(parseManualMovementInput({
    type: 'saida', category: 'packaging', description: ' Caixas ', value: 25.5,
    movementDate: '2026-09-02', paymentMethod: 'Pix',
  }, now), {
    type: 'saida', category: 'packaging', description: 'Caixas', valueCents: 2550,
    movementDate: '2026-09-02', paymentMethod: 'Pix',
  })
})

test('manual movement validation rejects system categories, cross-type categories, invalid values, dates and methods', () => {
  expectValidation(() => parseManualMovementInput({ type: 'entrada', category: 'sales', description: 'Venda', value: 10, movementDate: '2026-09-03', paymentMethod: 'Pix' }, now), 'category')
  expectValidation(() => parseManualMovementInput({ type: 'entrada', category: 'packaging', description: 'Caixas', value: 10, movementDate: '2026-09-03', paymentMethod: 'Pix' }, now), 'category')
  expectValidation(() => parseManualMovementInput({ type: 'saida', category: 'packaging', description: 'Caixas', value: 0, movementDate: '2026-09-03', paymentMethod: 'Pix' }, now), 'value')
  expectValidation(() => parseManualMovementInput({ type: 'saida', category: 'packaging', description: 'Caixas', value: -1, movementDate: '2026-09-03', paymentMethod: 'Pix' }, now), 'value')
  expectValidation(() => parseManualMovementInput({ type: 'saida', category: 'packaging', description: 'Caixas', value: 10, movementDate: '2026-09-04', paymentMethod: 'Pix' }, now), 'movementDate')
  expectValidation(() => parseManualMovementInput({ type: 'saida', category: 'packaging', description: 'Caixas', value: 10, movementDate: '2026-02-30', paymentMethod: 'Pix' }, now), 'movementDate')
  expectValidation(() => parseManualMovementInput({ type: 'saida', category: 'packaging', description: 'Caixas', value: 10, movementDate: '2026-09-03', paymentMethod: 'Cheque' }, now), 'paymentMethod')
})

test('finance settings allow signed opening balance and reject future opening date', () => {
  assert.deepEqual(parseFinanceSettingsInput({ openingBalance: -125.5, openingDate: '2026-09-01' }, now), {
    openingBalanceCents: -12550,
    openingDate: '2026-09-01',
  })
  expectValidation(() => parseFinanceSettingsInput({ openingBalance: 0, openingDate: '2026-09-04' }, now), 'openingDate')
  expectValidation(() => parseFinanceSettingsInput({ openingBalance: 'abc', openingDate: '2026-09-01' }, now), 'openingBalance')
})
