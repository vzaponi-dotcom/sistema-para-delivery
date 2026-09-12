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

test('standard receivables render a flat ledger instead of client cards', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, /receivables-ledger/)
  assert.match(page, /receivable-ledger-row/)
  assert.doesNotMatch(page, /receivable-client-card/)
  assert.doesNotMatch(page, /groupPendingOrders/)
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
  const quickUrl = new URL('../components/ReceivablesQuickPaymentDialog.jsx', import.meta.url)
  await assert.doesNotReject(() => access(quickUrl))
  const quick = await read('../components/ReceivablesQuickPaymentDialog.jsx')
  const app = await read('../App.jsx')

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
  assert.match(app, /<Modal title="Registrar pagamento"[\s\S]*<SystemSelect/)
  assert.doesNotMatch(quick, /registerPaymentApi|\/payment/)
})
