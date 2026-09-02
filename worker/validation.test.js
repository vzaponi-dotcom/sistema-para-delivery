import test from 'node:test'
import assert from 'node:assert/strict'
import { centsToMoney, moneyToCents, optionalText, requireNonEmpty, validateIsoDate, validateMovementType, validateOrderType, validatePaymentMethod, validatePositiveInteger } from './validation.js'

test('moneyToCents rounds BRL values to integer cents', () => {
  assert.equal(moneyToCents(32.1), 3210)
  assert.equal(moneyToCents('8.99'), 899)
  assert.equal(centsToMoney(899), 8.99)
})

test('moneyToCents rejects negative and invalid values', () => {
  assert.throws(() => moneyToCents(-1))
  assert.throws(() => moneyToCents('abc'))
  assert.throws(() => moneyToCents(''))
})

test('order type accepts only current operational values', () => {
  assert.equal(validateOrderType('Entrega'), 'Entrega')
  assert.equal(validateOrderType('Retirada'), 'Retirada')
  assert.equal(validateOrderType('Local'), 'Local')
  assert.throws(() => validateOrderType('Motoboy'))
})

test('requireNonEmpty trims valid strings and optionalText normalizes optional values', () => {
  assert.equal(requireNonEmpty('  Maria  ', 'name'), 'Maria')
  assert.equal(optionalText('  Centro  '), 'Centro')
  assert.equal(optionalText(null), '')
  assert.throws(() => requireNonEmpty('   ', 'name'))
})

test('payment method accepts exactly the existing UI methods', () => {
  for (const method of ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']) {
    assert.equal(validatePaymentMethod(method), method)
  }
  assert.throws(() => validatePaymentMethod('Cheque'))
})

test('date and positive integer validators reject impossible values', () => {
  assert.equal(validateIsoDate('2026-09-01'), '2026-09-01')
  assert.throws(() => validateIsoDate('2026-02-30'))
  assert.equal(validatePositiveInteger('2'), 2)
  assert.throws(() => validatePositiveInteger(0))
  assert.throws(() => validatePositiveInteger(1.5))
})

test('movement type accepts only entrada and saida', () => {
  assert.equal(validateMovementType('entrada'), 'entrada')
  assert.equal(validateMovementType('saida'), 'saida')
  assert.throws(() => validateMovementType('ajuste'))
})
