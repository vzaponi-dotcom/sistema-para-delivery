import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('receivables has only pending and paid primary tabs', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, />Pendentes</)
  assert.match(page, />Quitados</)
  assert.doesNotMatch(page, /Parciais/)
})

test('receivables exposes today upcoming overdue summaries and pending filters', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, /Receber hoje/)
  assert.match(page, /Próximos/)
  assert.match(page, /Em atraso/)
  assert.match(page, /Todos/)
  assert.match(page, /aria-pressed/)
  assert.match(page, /calculateReceivableSummary/)
})

test('pending receivables default to client grouping while preserving the flat order list mode', async () => {
  const page = await read('./Receivables.jsx')
  const group = await read('./ReceivableClientGroup.jsx')
  const panel = await read('./ReceivableClientPanel.jsx')

  assert.match(page, /displayMode = 'client'/)
  assert.match(page, />Por cliente</)
  assert.match(page, />Lista de pedidos</)
  assert.match(page, /groupReceivableEntriesByClient/)
  assert.match(page, /sortReceivableGroups/)
  assert.match(page, /<ReceivableClientGroup/)
  assert.match(page, /<ReceivableClientPanel/)
  assert.match(page, /displayMode === 'orders'[\s\S]*receivables-ledger/)
  assert.match(group, /className="receivable-client-card"/)
  assert.match(group, /aria-expanded=\{expanded\}/)
  assert.match(panel, /Selecionar todos/)
  assert.match(panel, /Receber selecionados/)
  assert.match(panel, /selectedOrderIds/)
})

test('receivables keeps search and exposes urgency recent and value sorting', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, /Buscar identificação, pedido ou produto/)
  assert.match(page, /Mais urgente/)
  assert.match(page, /Mais recente/)
  assert.match(page, /Maior valor/)
})

test('business date is refreshed while the page remains open', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, /getBusinessDate/)
  assert.match(page, /setInterval/)
})

test('receivables controls remain semantic and keyboard accessible', async () => {
  const page = await read('./Receivables.jsx')

  assert.match(page, /receivables-filter-strip[\s\S]*aria-pressed=\{timingFilter === filter && !exactDateFilter\}/)
  assert.match(page, /aria-label="Previsão de recebimentos"/)
  assert.doesNotMatch(page, /<div[^>]*className=["'`]receivable-ledger-row["'`][^>]*onClick=/)
  assert.match(page, /<button[^>]*className="receivable-ledger-row"/)
})

test('quick payment delegates to the existing App payment flow and excludes table tabs', async () => {
  const page = await read('./Receivables.jsx')
  const quickUrl = new URL('./ReceivablesQuickPaymentDialog.jsx', import.meta.url)
  await assert.doesNotReject(() => access(quickUrl))
  const quick = await read('./ReceivablesQuickPaymentDialog.jsx')
  const paymentDialog = await read('../../../app/workflows/payments/order/OrderPaymentDialog.jsx')
  const paymentEditor = await read('../../../app/workflows/payments/PaymentCompositionEditor.jsx')

  assert.match(page, /Registrar recebimento/)
  assert.match(page, /quickPaymentEntries/)
  assert.match(page, /entry\.kind === 'order'/)
  assert.match(page, /onSelect=\{registerQuickPayment\}/)
  assert.match(page, /const registerQuickPayment = \(orderId\) => \{\s*if \(!canReceivePayments\) return false/)
  assert.match(page, /className="receivables-payment-fab"[\s\S]{0,500}<Icon name="plus"/)
  assert.match(quick, /onSelect\(entry\.order\.id\)/)
  const selectIndex = quick.indexOf('onSelect(entry.order.id)')
  const closeIndex = quick.indexOf('onClose?.()', selectIndex)
  assert.ok(selectIndex >= 0 && closeIndex > selectIndex, 'quick selector must delegate before closing itself')
  assert.match(quick, /Nenhum pedido pendente encontrado\./)
  assert.doesNotMatch(quick, /table_tab/)
  assert.match(paymentDialog, /<Modal title="Registrar pagamento"[\s\S]*<PaymentCompositionEditor/)
  assert.match(paymentEditor, /<SystemSelect/)
  assert.doesNotMatch(quick, /registerPaymentApi|\/payment/)
})


test('client grouped receivables expose desktop selection totals and optional customer navigation', async () => {
  const page = await read('./Receivables.jsx')
  const panel = await read('./ReceivableClientPanel.jsx')

  assert.match(page, /visibleClientGroups/)
  assert.match(page, /selectedClientGroup/)
  assert.match(page, /clientSelection\.activateGroup/)
  assert.match(page, /clientSelection\.reconcile/)
  assert.match(page, /requestSelectedPayment/)
  assert.match(panel, /selectedTotal/)
  assert.match(panel, /onOpenClient/)
  assert.match(panel, /Ver cliente/)
  assert.match(panel, /type="checkbox"/)
  assert.match(panel, /aria-label=.*pedido/i)
})

test('client grouping search includes phone and mode changes clear incompatible selection state', async () => {
  const page = await read('./Receivables.jsx')

  assert.match(page, /order\.clientPhone/)
  assert.match(page, /Buscar cliente, telefone ou pedido/)
  assert.match(page, /selectDisplayMode/)
  assert.match(page, /clientSelection\.clear\(\)/)
  assert.match(page, /selectedEntryKey: null/)
})