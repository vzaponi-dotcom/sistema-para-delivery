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

test('table tab payment action is not exposed directly in the receivables ledger', () => {
  assert.doesNotMatch(receivables, /receivable-ledger-table-action/)
  assert.doesNotMatch(receivables, /entry\.kind === 'table_tab' && <button[^>]*onClick=\{\(\) => openTableTabPayment\(entry\)\}/)
  assert.match(detail, /Registrar pagamento da comanda/)
  assert.match(receivables, /tableTabPaymentGroup &&/)
  assert.match(receivables, /title="Registrar pagamento da comanda"/)
})

test('table tab detail keeps promise editing out of the aggregate branch and removes the obsolete danger treatment', () => {
  assert.match(detail, /if \(entry\.kind === 'table_tab'\)[\s\S]*Registrar pagamento da comanda/)
  assert.match(detail, /const order = entry\.order[\s\S]*onEditPaymentPromise\?\.\(order\)/)
  assert.doesNotMatch(detail, /table-tab-payment-action-button/)
  assert.doesNotMatch(styles, /\.table-tab-payment-action-button/)
})

test('table tab detail lists every order with readable item hierarchy, notes, subtotal, and one aggregate payment action', () => {
  assert.match(detail, /entry\.orders\.map\(\(order\) =>/)
  assert.match(detail, /Pedido #\{String\(order\.id \|\| ''\)\.slice\(-4\)\}/)
  assert.match(detail, /getOrderItems\(order\)\.map\(\(item\) =>/)
  assert.match(detail, /receivable-table-tab-item-quantity">\{item\.quantity\}x/)
  assert.match(detail, /receivable-table-tab-item-content[\s\S]*getOrderItemDisplayName\(item\)/)
  assert.match(detail, /item\.note && <span>↳ \{item\.note\}<\/span>/)
  assert.match(detail, /receivable-table-tab-order-subtotal[\s\S]*currency\(order\.total \?\? order\.subtotal \?\? 0\)/)
  assert.equal((detail.match(/Registrar pagamento da comanda/g) || []).length, 1)
})
