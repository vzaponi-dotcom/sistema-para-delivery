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

test('quick payment delegates to the existing App payment flow and excludes table tabs', async () => {
  const page = await read('./Receivables.jsx')
  const quickUrl = new URL('../components/ReceivablesQuickPaymentDialog.jsx', import.meta.url)
  await assert.doesNotReject(() => access(quickUrl))
  const quick = await read('../components/ReceivablesQuickPaymentDialog.jsx')
  const app = await read('../App.jsx')

  assert.match(page, /Registrar recebimento/)
  assert.match(page, /pendingEntries\.filter\(\(entry\) => entry\.kind === 'order'\)/)
  assert.match(page, /onSelect=\{onRegisterPayment\}/)
  assert.match(quick, /onSelect\(entry\.order\.id\)/)
  assert.match(app, /<Modal title="Registrar pagamento"[\s\S]*<SystemSelect/)
  assert.doesNotMatch(quick, /registerPaymentApi|\/payment/)
})

test('table tabs keep aggregate payment and never expose promise editing', async () => {
  const detail = await read('../components/ReceivableDetail.jsx')
  assert.match(detail, /Registrar pagamento da comanda/)
  assert.match(detail, /entry\.kind === 'table_tab'/)
  assert.doesNotMatch(detail, /entry\.kind === 'table_tab'[\s\S]{0,1200}onEditPaymentPromise/)
})
