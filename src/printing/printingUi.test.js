import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const badge = await readFile(new URL('../components/PrintStatusBadge.jsx', import.meta.url), 'utf8')
const orders = await readFile(new URL('../pages/Orders.jsx', import.meta.url), 'utf8')
const detail = await readFile(new URL('../components/OrderDetail.jsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8')
const settings = await readFile(new URL('../components/PrintingSettings.jsx', import.meta.url), 'utf8')

test('print status badge exposes all friendly persisted job states', () => {
  for (const label of [
    'Pendente de impressão',
    'Imprimindo',
    'Enviado para impressão',
    'Aguardando 2ª via',
    'Falha na impressão',
    'Requer atenção',
  ]) assert.match(badge, new RegExp(label))
  assert.match(badge, /printed:\s*'Enviado para impressão'/)
  assert.doesNotMatch(badge, /printed:\s*'Impresso'/)
})

test('kitchen preserves the shared printing manager in details without moving printing into tickets', async () => {
  const ticket = await readFile(new URL('../components/KitchenTicket.jsx', import.meta.url), 'utf8')
  assert.match(orders, /latestJobByOrderId/)
  assert.match(orders, /<OrderDetail[^>]*printing=\{printing\}[^>]*printJob=\{detailPrintJob\}/)
  assert.match(app, /printing=\{printing\}/)
  assert.doesNotMatch(ticket, /printing|PrintStatusBadge|apiRequest|fetch\(/)
})

test('order detail keeps print actions separate and uses the shared printing manager', () => {
  for (const label of ['Visualizar ticket', 'Gerar PDF', 'Imprimir pedido', 'Imprimir 2ª via', 'Reimprimir', 'Tentar novamente', 'Imprimir agora']) {
    assert.match(detail, new RegExp(label))
  }
  assert.match(detail, /<h3>Impressão<\/h3>/)
  assert.match(detail, /getPreviewDocument/)
  assert.match(detail, /downloadOrderPdf/)
  assert.match(detail, /printOrder/)
  assert.match(detail, /printSecondCopy/)
  assert.match(detail, /retryJob/)
})

test('partial two-copy jobs wait for a tear and expose only the explicit second-copy action', () => {
  assert.match(detail, /copiesRequested.*2/)
  assert.match(detail, /copiesPrinted.*1/)
  assert.match(detail, /printing\?\.printSecondCopy\?\.\(printJob\)/)
  assert.match(detail, /1ª via impressa\. Destaque o papel na serrilha e, depois, imprima a 2ª via\./)

  const secondCopyBranch = detail.indexOf('Imprimir 2ª via')
  const reprintBranch = detail.indexOf('Reimprimir')
  assert.notEqual(secondCopyBranch, -1)
  assert.notEqual(reprintBranch, -1)
  assert.ok(secondCopyBranch < reprintBranch)
})

test('reprint requires confirmation with actual copy count while retries remain explicit interventions', () => {
  assert.match(detail, /ConfirmationDialog/)
  assert.match(detail, /copiesRequested|defaultCopies/)
  assert.match(detail, /mais .*cópi/)
  assert.match(detail, /confirmLabel="Reimprimir"/)
})

test('reprint confirmation never claims physical paper output from a technical printed state', () => {
  assert.match(detail, /Este pedido já foi enviado para impressão\./)
  assert.doesNotMatch(detail, /Este pedido já foi impresso\./)
})

test('printing diagnostics use persisted sanitized fields instead of raw exception stacks', () => {
  assert.match(detail, /lastError/)
  assert.match(detail, /processedAt/)
  assert.match(detail, /stationId/)
  assert.doesNotMatch(detail, /\.stack\b/)
})

test('future automatic jobs show scheduling and use a manual print action', () => {
  assert.match(detail, /availableAt/)
  assert.match(detail, /Impressão programada para \{formatOrderTime\(printJob\.availableAt\)\}/)
  assert.match(detail, /printing\.printOrder\(order\.id, defaultCopies\)/)
  assert.match(detail, /if \(scheduledPrintPending\) return <Button[^>]*onClick=\{handleFirstPrint\}[^>]*>Imprimir agora<\/Button>/)
  assert.match(detail, /\{!scheduledPrintPending && !awaitingSecondCopy && \['pending', 'processing'\]\.includes\(printJob\?\.status\)/)
  assert.doesNotMatch(detail, /if \(scheduledPrintPending\)[^\n]*handleRetry/)
})

test('app globally prompts one waiting second copy at a time and dismissal does not consume it', () => {
  assert.match(app, /import ConfirmationDialog from '\.\/components\/ConfirmationDialog'/)
  assert.match(app, /secondCopyPromptJobId/)
  assert.match(app, /dismissedSecondCopyJobIdsRef/)
  assert.match(app, /copiesRequested.*2/)
  assert.match(app, /copiesPrinted.*1/)
  assert.match(app, /printing\.printSecondCopy\(secondCopyPromptJob\)/)
  assert.match(app, /confirmLabel="Imprimir 2ª via"/)
  assert.match(app, /cancelLabel="Cancelar"/)
  assert.match(app, /Destaque o papel na serrilha antes de continuar\./)
  assert.match(app, /dismissedSecondCopyJobIdsRef\.current\.add\(secondCopyPromptJobId\)/)
})

test('printing settings exposes Windows QZ setup without regressing Android RawBT', () => {
  assert.match(settings, /QZ Tray/)
  assert.match(settings, /Configurar impressora|Trocar impressora/)
  assert.match(settings, /MPT-II/)
  assert.match(settings, /RawBT/)
  assert.doesNotMatch(settings, /Windows \+ Chrome com Web Serial disponível\./)
  assert.match(settings, /printing\?\.transportKind === 'qz'/)
  assert.match(settings, /printing\.refreshPrinters\(\)/)
  assert.match(settings, /printing\.selectPrinter\(printerName\)/)
  assert.match(settings, /printing\?\.availablePrinters/)
  assert.match(settings, /SystemSelect/)
  assert.doesNotMatch(settings, /<select\b/)
  assert.match(settings, /O QZ Tray deve permanecer aberto no Windows para impressão automática\./)
})
