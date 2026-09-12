import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('receivables reuses one detail component in bottom sheet and desktop panel', () => {
  const page = source('./Receivables.jsx')
  assert.match(page, /import BottomSheet/)
  assert.match(page, /import ReceivableDetail/)
  assert.match(page, /<BottomSheet[\s\S]*<ReceivableDetail/)
  assert.match(page, /receivables-detail-panel[\s\S]*<ReceivableDetail/)
})

test('order detail exposes payment promise and view-order actions only where allowed', () => {
  const detail = source('../components/ReceivableDetail.jsx')
  assert.match(detail, /Registrar recebimento/)
  assert.match(detail, /Definir data prometida|Alterar data prometida/)
  assert.match(detail, /Ver pedido/)
})

test('detail actions replace the current detail overlay before opening the next flow', () => {
  const page = source('./Receivables.jsx')
  assert.match(page, /const registerPaymentFromDetail = \(orderId\) => \{\s*if \(!canReceivePayments\) return false\s*setMobileDetailOpen\(false\)\s*patchQuery\(\{ selectedEntryKey: null \}\)\s*onRegisterPayment\?\.\(orderId\)\s*return true\s*\}/)
  assert.match(page, /const editPaymentPromiseFromDetail = \(order\) => \{\s*if \(!canManagePaymentPromises\) return false\s*setMobileDetailOpen\(false\)\s*patchQuery\(\{ selectedEntryKey: null \}\)\s*setPromiseOrder\(order\)\s*return true\s*\}/)
  assert.match(page, /const viewOrderFromDetail = \(order\) => \{\s*setMobileDetailOpen\(false\)\s*patchQuery\(\{ selectedEntryKey: null \}\)\s*setDetailOrder\(order\)\s*\}/)
  assert.match(page, /onRegisterPayment=\{registerPaymentFromDetail\}/)
  assert.match(page, /onEditPaymentPromise=\{editPaymentPromiseFromDetail\}/)
  assert.match(page, /onViewOrder=\{viewOrderFromDetail\}/)
})

test('payment promise dialog supports save and removal with overdue warning', () => {
  const dialog = source('../components/PaymentPromiseDialog.jsx')
  assert.match(dialog, /Data prometida de pagamento/)
  assert.match(dialog, /min=\{today\}/)
  assert.match(dialog, /Remover data prometida/)
  assert.match(dialog, /Sem a data prometida, este pedido será classificado como atrasado/)
})
