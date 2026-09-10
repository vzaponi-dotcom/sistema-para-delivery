import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const receivables = fs.readFileSync(new URL('./pages/Receivables.jsx', import.meta.url), 'utf8')
const detail = fs.readFileSync(new URL('./components/ReceivableDetail.jsx', import.meta.url), 'utf8')

test('receivables keeps its pending-order detail and payment flow scoped to ordinary orders', () => {
  assert.match(receivables, /onRegisterPayment=\{registerPaymentFromDetail\}/)
  assert.match(receivables, /onEditPaymentPromise=\{editPaymentPromiseFromDetail\}/)
  assert.doesNotMatch(receivables, /onRegisterTableTabPayment/)
  assert.doesNotMatch(receivables, /tableTabPayment/)
})

test('receivable detail exposes only the ordinary order payment and promise actions', () => {
  assert.match(detail, /onRegisterPayment/)
  assert.match(detail, /onEditPaymentPromise/)
  assert.doesNotMatch(detail, /table_tab/)
  assert.doesNotMatch(detail, /onRegisterTableTabPayment/)
})
