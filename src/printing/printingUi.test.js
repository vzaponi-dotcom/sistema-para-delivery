import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const badge = await readFile(new URL('../components/PrintStatusBadge.jsx', import.meta.url), 'utf8')
const orders = await readFile(new URL('../pages/Orders.jsx', import.meta.url), 'utf8')
const detail = await readFile(new URL('../components/OrderDetail.jsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8')

test('print status badge exposes all friendly persisted job states', () => {
  for (const label of [
    'Aguardando impressão',
    'Imprimindo',
    'Aguardando confirmação',
    'Impresso',
    'Aguardando 2ª via',
    'Falha na impressão',
    'Requer atenção',
  ]) assert.match(badge, new RegExp(label))
  assert.match(badge, /printed:\s*'Impresso'/)
  assert.doesNotMatch(badge, /printed:\s*'Enviado para impressão'/)
})

test('kitchen preserves the shared printing manager in details without moving printing into tickets', async () => {
  const ticket = await readFile(new URL('../components/KitchenTicket.jsx', import.meta.url), 'utf8')
  assert.match(orders, /latestJobByOrderId/)
  assert.match(orders, /<OrderDetail[^>]*printing=\{printing\}[^>]*printJob=\{detailPrintJob\}/)
  assert.match(app, /printing=\{printing\}/)
  assert.doesNotMatch(ticket, /printing|PrintStatusBadge|apiRequest|fetch\(/)
})

test('kitchen communicates deadline-based priority instead of age-based ordering', () => {
  assert.match(orders, /Prioridade por prazo/)
  assert.doesNotMatch(orders, /Mais antigos primeiro/)
})

test('order detail keeps print actions separate and uses the central queue commands', () => {
  for (const label of ['Visualizar ticket', 'Gerar PDF', 'Imprimir pedido', 'Imprimir 2ª via', 'Reimprimir', 'Tentar novamente', 'Imprimir agora']) {
    assert.match(detail, new RegExp(label))
  }
  assert.match(detail, /<h3>Impressão<\/h3>/)
  assert.match(detail, /getPreviewDocument/)
  assert.match(detail, /downloadOrderPdf/)
  assert.match(detail, /printOrder/)
  assert.match(detail, /requestPrintNow/)
  assert.match(detail, /requestSecondCopy/)
  assert.match(detail, /requestRetry/)
  assert.match(detail, /requestReprint/)
  assert.doesNotMatch(detail, /printSecondCopy/)
  assert.doesNotMatch(detail, /retryJob/)
  assert.doesNotMatch(detail, /claimPrintJob|claimNextPrintJob|dispatchRawBt|writeSerialBytes|\bqz\./)
  assert.doesNotMatch(detail, /printing\?\.supported === false/)
})

test('partial two-copy jobs wait for a tear and expose only the explicit second-copy action', () => {
  assert.match(detail, /copiesRequested.*2/)
  assert.match(detail, /copiesPrinted.*1/)
  assert.match(detail, /printing\?\.requestSecondCopy\?\.\(printJob\)/)
  assert.match(detail, /1ª via impressa\. A 2ª via continua pendente na fila da cozinha\./)

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

test('future automatic jobs show scheduling and use central priority', () => {
  assert.match(detail, /availableAt/)
  assert.match(detail, /Impressão programada para \{formatOrderTime\(printJob\.availableAt\)\}/)
  assert.match(detail, /printing\?\.requestPrintNow\?\.\(printJob\)/)
  assert.match(detail, /if \(scheduledPrintPending\) return <Button[^>]*onClick=\{handlePrintNow\}[^>]*>Imprimir agora<\/Button>/)
  assert.match(detail, /\{!scheduledPrintPending && !awaitingSecondCopy && \['pending', 'processing'\]\.includes\(printJob\?\.status\)/)
  assert.doesNotMatch(detail, /if \(scheduledPrintPending\)[^\n]*handleRetry/)
})

test('app globally prompts an unacknowledged waiting second copy and persists the acknowledgment', () => {
  assert.match(app, /import ConfirmationDialog from '\.\/components\/ConfirmationDialog'/)
  assert.match(app, /secondCopyPromptJobId/)
  assert.match(app, /canPresentSecondCopyPrompt/)
  assert.match(app, /acknowledgeAndOpenSecondCopyPrompt\(\{[\s\S]*acknowledge: acknowledgeSecondCopyPrompt/)
  assert.match(app, /printing\.printSecondCopy\(secondCopyPromptJob\)/)
  assert.match(app, /confirmLabel="Imprimir 2ª via"/)
  assert.match(app, /cancelLabel="Depois"/)
  assert.match(app, /Destaque o papel na serrilha antes de continuar\./)
  assert.doesNotMatch(app, /dismissedSecondCopyJobIdsRef/)
})

test('the originating non-QZ device can request, but never execute, its second copy', () => {
  assert.match(app, /findOriginSecondCopyPrompt/)
  assert.match(app, /rememberOriginOrderId\(order\.id/)
  assert.match(app, /printTransportKind === 'qz'/)
  assert.match(app, /confirmLabel="Solicitar 2ª via"/)
  assert.match(app, /printing\.requestSecondCopy\(originSecondCopyPromptJob\)/)
  assert.doesNotMatch(app, /printing\.printSecondCopy\(originSecondCopyPromptJob\)/)
})

test('physical popup remains separate from remote queue decisions', async () => {
  const queue = await readFile(new URL('../pages/PrintQueue.jsx', import.meta.url), 'utf8')
  const details = await readFile(new URL('../pages/printQueueDetails.js', import.meta.url), 'utf8')
  assert.match(app, /printing\.printSecondCopy\(secondCopyPromptJob\)/)
  assert.match(app, /cancelLabel="Depois"/)
  assert.match(queue, /printing\?\.requestSecondCopy\?\.\(selectedJob\)/)
  assert.match(queue, /printing\?\.skipSecondCopy\?\.\(selectedJob\)/)
  assert.doesNotMatch(queue, /printSecondCopy\(/)
  assert.match(details, /Não impressa por decisão do operador/)
})

test('successful active order creation confirms queueing without invoking a local transport', () => {
  const start = app.indexOf('const handleOrderCheckout = async')
  const end = app.indexOf('const handleQuickCreateClient', start)
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  const checkout = app.slice(start, end)

  assert.match(checkout, /Pedido enviado para a fila da cozinha/)
  assert.match(checkout, /setToastMessage/)
  assert.doesNotMatch(checkout, /\bprinting\.|printOrder|printSecondCopy|claimPrintJob|claimNextPrintJob|dispatchRawBt|writeSerialBytes|\bqz\./)
})

test('remote order actions announce approved queue outcomes and never retain a local printing error', () => {
  for (const message of [
    'Pedido enviado para a fila da cozinha',
    'Pedido priorizado na fila',
    'Nova tentativa enviada para a fila',
    'Reimpressão adicionada à fila',
    '2ª via enviada para a fila',
  ]) assert.match(detail, new RegExp(message))
  assert.match(detail, /onToast/)
  assert.doesNotMatch(detail, /useState\(''\).*printingError|setPrintingError|order-printing-error/)
})

test('only deduplicated physical job failures surface a human queue-attention toast without a global error modal', () => {
  assert.match(app, /usePrintingManager\(\{[^}]*onPhysicalJobFailure:/)
  assert.match(app, /Impressão requer atenção na fila/)
  assert.doesNotMatch(app, /printErrorModal|pendingPrintError|showPrintError|printingError/)
})

test('a failed physical second copy closes its prompt instead of keeping a blocking retry loop', () => {
  const start = app.indexOf('const handleGlobalSecondCopy = async')
  const end = app.indexOf('const validateClientIdentity', start)
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  const handler = app.slice(start, end)

  assert.match(handler, /if \(result\?\.status !== 'printed'\) \{\s*setSecondCopyPromptJobId\(null\)/)
  assert.match(handler, /catch \(error\) \{\s*setSecondCopyPromptJobId\(null\)/)
})

test('reload has no persisted global print-error dialog to reopen', () => {
  assert.doesNotMatch(app, /localStorage[^\n]*(?:printError|printingError)|(?:printError|printingError)[^\n]*localStorage/)
  assert.doesNotMatch(app, /<ConfirmationDialog[^>]*(?:printError|printingError|lastError)/)
})
