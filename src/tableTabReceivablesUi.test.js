import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const receivables = fs.readFileSync(new URL('./pages/Receivables.jsx', import.meta.url), 'utf8')
const detail = fs.readFileSync(new URL('./components/ReceivableDetail.jsx', import.meta.url), 'utf8')
const styles = fs.readFileSync(new URL('./receivables.css', import.meta.url), 'utf8')

test('receivables keeps table tabs consolidated and delegates aggregate payment through the detail action', () => {
  assert.match(receivables, /buildPendingReceivableEntries/)
  assert.match(detail, /entry\.kind === 'table_tab'/)
  assert.match(detail, /Pedidos pendentes/)
  assert.match(detail, /A comanda é recebida de forma integral/)
  assert.match(detail, /Registrar pagamento da comanda/)
  assert.match(detail, /onRegisterTableTabPayment/)
})

test('table tab detail keeps promise editing out of the aggregate branch and removes the obsolete danger treatment', () => {
  assert.match(detail, /if \(entry\.kind === 'table_tab'\)[\s\S]*Registrar pagamento da comanda/)
  assert.match(detail, /const order = entry\.order[\s\S]*onEditPaymentPromise\?\.\(order\)/)
  assert.doesNotMatch(detail, /table-tab-payment-action-button/)
  assert.doesNotMatch(styles, /\.table-tab-payment-action-button/)
})
