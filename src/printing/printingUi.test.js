import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const badge = await readFile(new URL('../components/PrintStatusBadge.jsx', import.meta.url), 'utf8')
const orders = await readFile(new URL('../pages/Orders.jsx', import.meta.url), 'utf8')
const detail = await readFile(new URL('../components/OrderDetail.jsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8')

test('print status badge exposes all friendly persisted job states', () => {
  for (const label of [
    'Pendente de impressão',
    'Imprimindo',
    'Impresso',
    'Falha na impressão',
    'Requer atenção',
  ]) assert.match(badge, new RegExp(label))
})

test('order cards show a print badge only when an official job exists', () => {
  assert.match(orders, /PrintStatusBadge/)
  assert.match(orders, /latestJobByOrderId/)
  assert.match(orders, /printJob\s*&&\s*<PrintStatusBadge/)
  assert.match(app, /printing=\{printing\}/)
})

test('order detail keeps print actions separate and uses the shared printing manager', () => {
  for (const label of ['Visualizar ticket', 'Gerar PDF', 'Imprimir pedido', 'Reimprimir', 'Tentar novamente', 'Imprimir agora']) {
    assert.match(detail, new RegExp(label))
  }
  assert.match(detail, /Impressão do pedido/)
  assert.match(detail, /getPreviewDocument/)
  assert.match(detail, /downloadOrderPdf/)
  assert.match(detail, /printOrder/)
  assert.match(detail, /retryJob/)
})

test('reprint requires confirmation with actual copy count while retries remain explicit interventions', () => {
  assert.match(detail, /ConfirmationDialog/)
  assert.match(detail, /copiesRequested|defaultCopies/)
  assert.match(detail, /mais .*cópi/)
  assert.match(detail, /confirmLabel="Reimprimir"/)
})

test('printing diagnostics use persisted sanitized fields instead of raw exception stacks', () => {
  assert.match(detail, /lastError/)
  assert.match(detail, /processedAt/)
  assert.match(detail, /stationId/)
  assert.doesNotMatch(detail, /\.stack\b/)
})
