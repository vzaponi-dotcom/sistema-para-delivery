import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatPaymentSummary,
  hasMixedPayment,
  paymentSearchText,
} from './paymentPresentation.js'

const mixed = [
  { methodCode: 'cash', methodLabel: 'Dinheiro', amountCents: 1200 },
  { methodCode: 'pix', methodLabel: 'Pix', amountCents: 3000 },
]

test('payment presentation preserves a simple historical label and summarizes mixed receipts compactly', () => {
  assert.equal(formatPaymentSummary([{ methodCode: 'pix', methodLabel: 'Pix', amountCents: 4200 }]), 'Pix')
  assert.equal(formatPaymentSummary([], 'Cartão de débito'), 'Cartão de débito')
  assert.equal(formatPaymentSummary(mixed), '2 formas')
  assert.equal(hasMixedPayment(mixed), true)
  assert.equal(hasMixedPayment(mixed.slice(0, 1)), false)
})

test('payment search text includes allocation labels and stable codes without a synthetic persisted value', () => {
  assert.match(paymentSearchText(mixed), /dinheiro/)
  assert.match(paymentSearchText(mixed), /cash/)
  assert.match(paymentSearchText(mixed), /pix/)
  assert.doesNotMatch(paymentSearchText(mixed), /dinheiro \+ pix/)
})
