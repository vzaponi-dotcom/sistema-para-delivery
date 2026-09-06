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
  assert.match(detail, /entry\.kind === 'table_tab'/)
  assert.match(detail, /Registrar pagamento da comanda/)
})

test('payment promise dialog supports save and removal with overdue warning', () => {
  const dialog = source('../components/PaymentPromiseDialog.jsx')
  assert.match(dialog, /Data prometida de pagamento/)
  assert.match(dialog, /min=\{today\}/)
  assert.match(dialog, /Remover data prometida/)
  assert.match(dialog, /Sem a data prometida, este pedido será classificado como atrasado/)
})
