import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { buildPrintQueueSummary, getPrintStationSummary } from './printQueueSummary.js'
import { filterPrintQueueJobs, getPrintQueueSearchText } from './printQueueFilters.js'
import { formatOrderCustomerIdentity } from '../../shared/orderPrintDocument.js'
import { getPrintJobDetails } from './printQueueDetails.js'

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('print queue page provides the initial structural heading', async () => {
  const page = await readSource('./PrintQueue.jsx')

  assert.match(page, /title="Fila de impressão"/)
  assert.match(page, /Acompanhe e gerencie as impressões da cozinha/)
  assert.match(page, /Configurações/)
  assert.match(page, /aria-label="Configurações de impressão"/)
  assert.match(page, /icon="settings"/)
  assert.match(page, /onOpenPrintingSettings/)
})

test('desktop navigation and the kitchen printing shortcut open the print queue', async () => {
  const [app, sidebar, orders] = await Promise.all([
    readSource('../App.jsx'),
    readSource('../components/Sidebar.jsx'),
    readSource('./Orders.jsx'),
  ])

  assert.match(app, /import PrintQueue from '\.\/pages\/PrintQueue'/)
  assert.match(app, /import PrintingSettings from '\.\/components\/PrintingSettings'/)
  assert.match(app, /activeTab === 'print-queue' && <PrintQueue/)
  assert.match(app, /onOpenPrintingSettings=\{\(\) => setShowPrintingSettings\(true\)\}/)
  assert.match(app, /showPrintingSettings && <PrintingSettings printing=\{printing\}/)
  assert.match(sidebar, /\{ id: 'print-queue', label: 'Fila de impressão', icon: 'printer' \}/)
  assert.match(orders, /onNavigatePrintQueue/)
  assert.match(orders, /onClick=\{onNavigatePrintQueue\}>Impressão<\/Button>/)
})

test('mobile keeps five bottom tabs and exposes the print queue through Mais', async () => {
  const mobileNavigation = await readSource('../components/MobileNavigation.jsx')

  assert.match(mobileNavigation, /const directItems = \[[\s\S]*?\{ id: 'products', label: 'Produtos', icon: 'products' \},\s*\]/)
  assert.doesNotMatch(mobileNavigation, /\{ id: 'print-queue', label: 'Fila de impressão', icon: 'printer' \}/)
  assert.match(mobileNavigation, /activeTab === 'print-queue'/)
  assert.match(mobileNavigation, /onClick=\{\(\) => navigate\('print-queue'\)\}/)
})

test('print queue summary counts only the four operational queue states', () => {
  assert.deepEqual(buildPrintQueueSummary([
    { status: 'pending' },
    { queueState: 'waiting_station' },
    { status: 'awaiting_second_copy' },
    { status: 'requires_attention' },
    { status: 'processing' },
    { status: 'printed' },
    { status: 'discarded' },
  ], { stationReady: true }), {
    queued: 1,
    waitingStation: 1,
    waitingSecondCopy: 1,
    attention: 1,
  })
})

test('print station summary reports available health without inventing an online state', () => {
  assert.deepEqual(getPrintStationSummary({
    health: { online: true, qzReady: true, printerReady: false },
  }), {
    onlineLabel: 'Online',
    qzLabel: 'QZ disponível',
    printerLabel: 'Impressora indisponível',
  })
  assert.deepEqual(getPrintStationSummary(null), {
    onlineLabel: 'Status indisponível',
    qzLabel: null,
    printerLabel: null,
  })
})

test('print queue renders station health and a responsive four-card summary', async () => {
  const [app, page, styles] = await Promise.all([
    readSource('../App.jsx'),
    readSource('./PrintQueue.jsx'),
    readSource('../print-queue.css'),
  ])

  for (const label of ['Cozinha PC', 'Na fila', 'Aguardando estação', 'Aguardando 2ª via', 'Requer atenção']) {
    assert.match(page, new RegExp(label))
  }
  assert.match(app, /<PrintQueue orders=\{orders\} printing=\{printing\}/)
  assert.match(styles, /\.print-queue-summary[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.print-queue-summary[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
})

test('print queue renders the empty state only when jobs are absent', async () => {
  const page = await readSource('./PrintQueue.jsx')

  assert.match(page, /const jobs = Array\.isArray\(printing\?\.jobs\) \? printing\.jobs : \[\]/)
  assert.match(page, /jobs\.length === 0/)
  assert.match(page, /Os trabalhos de impressão aparecerão aqui\./)
  assert.match(page, /filteredJobs\.map/)
})

test('print queue job rows expose identity, origin, copies, status, time and station', async () => {
  const page = await readSource('./PrintQueue.jsx')

  for (const pattern of [
    /orderNumber/,
    /document\?\.customer\?\.name/,
    /job\?\.trigger/,
    /job\?\.copiesPrinted/,
    /job\?\.copiesRequested/,
    /job\?\.createdAt/,
    /job\?\.stationId/,
    /job\?\.attentionReason/,
    /getPrintQueueLabel/,
  ]) assert.match(page, pattern)
})

test('print queue keeps structured desktop rows and compact mobile cards without horizontal overflow', async () => {
  const [page, styles] = await Promise.all([
    readSource('./PrintQueue.jsx'),
    readSource('../print-queue.css'),
  ])

  assert.match(page, /print-queue-jobs-table/)
  assert.match(page, /print-queue-job-card/)
  assert.match(styles, /\.print-queue-jobs-table/)
  assert.match(styles, /\.print-queue-job-card/)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.print-queue-jobs-table[\s\S]*display: none/)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.print-queue-job-card[\s\S]*display: grid/)
})

test('print queue uses an operational order number and never treats a UUID suffix as one', async () => {
  const page = await readSource('./PrintQueue.jsx')

  assert.match(page, /formatOrderDisplayNumber/)
  assert.match(page, /displayNumber|operationalNumber|orderNumber/)
  assert.match(page, /ordersById/)
  assert.doesNotMatch(page, /String\(.*order.*\)\.slice\(-4\)/)
})

test('print queue preserves official table and customer identity with a neutral fallback', async () => {
  const page = await readSource('./PrintQueue.jsx')

  assert.match(page, /getCustomerOrTable/)
  assert.match(page, /tableIdentifier/)
  assert.match(page, /customerOrTable: getCustomerOrTable/)
  assert.match(page, /formatOrderDisplayNumber\(order\)/)
})

test('print queue reuses the operational local identity for table and customer', () => {
  assert.equal(formatOrderCustomerIdentity({ tableIdentifier: 'Mesa 3', customerName: 'Ana' }), 'Mesa 3 · Ana')
})

test('print queue keeps the table identity when no customer is present', () => {
  assert.equal(formatOrderCustomerIdentity({ tableIdentifier: 'Mesa 3', customerName: '' }), 'Mesa 3')
})

test('print queue keeps the customer identity when no table is present', () => {
  assert.equal(formatOrderCustomerIdentity({ tableIdentifier: '', customerName: 'Ana' }), 'Ana')
})

test('print queue uses the neutral fallback when table and customer are absent', () => {
  assert.equal(formatOrderCustomerIdentity({ tableIdentifier: '', customerName: '' }), null)
})

const filterJobs = [
  {
    id: 'customer-job',
    trigger: 'automatic',
    status: 'pending',
    orderId: 'order-104',
    document: { customer: { name: 'Ana Souza' }, tableIdentifier: 'Mesa 4', order: { number: '0000' } },
  },
  {
    id: 'table-job',
    trigger: 'manual',
    status: 'printed',
    orderId: 'order-205',
    document: { customer: { name: 'Bruno Lima' }, tableIdentifier: 'Mesa 12', order: { displayNumber: '0000' } },
  },
  {
    id: 'technical-id-job',
    trigger: 'automatic',
    status: 'attention',
    orderId: 'order-123',
    document: { customer: { name: 'Carla Dias' }, order: { id: '123e4567-e89b-12d3-a456-426614174000', number: '123e4567-e89b-12d3-a456-426614174000' } },
  },
]

const filterOrders = [
  { id: 'order-104', orderNumber: 104 },
  { id: 'order-205', orderNumber: 205 },
  { id: 'order-123', orderNumber: 123 },
]

test('print queue search matches customer case-insensitively', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: 'ANA SOUZA', orders: filterOrders }).map((job) => job.id), ['customer-job'])
})

test('print queue search matches table identifiers', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: 'mesa 12', orders: filterOrders }).map((job) => job.id), ['table-job'])
})

test('print queue search matches an available operational order number', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: 'Pedido 205', orders: filterOrders }).map((job) => job.id), ['table-job'])
})

test('print queue search does not match technical UUIDs', () => {
  assert.equal(getPrintQueueSearchText(filterJobs[2], filterOrders).includes('123e4567-e89b-12d3-a456-426614174000'), false)
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: '123e4567-e89b-12d3-a456-426614174000', orders: filterOrders }), [])
})

test('print queue filters by canonical status and combines status with search', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { status: 'printed' }).map((job) => job.id), ['table-job'])
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: 'mesa', status: 'printed', orders: filterOrders }).map((job) => job.id), ['table-job'])
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { status: 'queued' }).map((job) => job.id), ['customer-job'])
})

test('print queue filters by reliable origin values', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { origin: 'automatic' }).map((job) => job.id), ['customer-job', 'technical-id-job'])
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { origin: 'manual' }).map((job) => job.id), ['table-job'])
})

test('print queue returns no jobs when active filters match nothing', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: 'inexistente', status: 'printed', orders: filterOrders }), [])
})

test('print queue exposes responsive filter controls without structural horizontal overflow', async () => {
  const [page, filters, styles] = await Promise.all([
    readSource('./PrintQueue.jsx'),
    readSource('./printQueueFilters.js'),
    readSource('../print-queue.css'),
  ])

  assert.match(page, /Buscar pedido, cliente ou mesa/)
  assert.match(filters, /Todos/)
  assert.match(filters, /Manual\/Reimpressão/)
  assert.match(styles, /\.print-queue-filters/)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.print-queue-filters[\s\S]*flex-direction: column/)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.print-queue-search[\s\S]*width: 100%/)
})

test('print queue resolves the official number from orders for jobs with legacy snapshots', async () => {
  const jobs = [{ id: 'job-1', orderId: 'order-1', document: { order: { id: 'order-1', number: '0000' } }, trigger: 'automatic', status: 'pending' }]
  const orders = [{ id: 'order-1', orderNumber: 58 }]

  assert.deepEqual(filterPrintQueueJobs(jobs, { search: 'Pedido 58', orders }).map((job) => job.id), ['job-1'])
  assert.deepEqual(filterPrintQueueJobs(jobs, { search: '550e8400-e29b-41d4-a716-446655440000', orders }), [])
})

test('print queue receives orders for current operational identity lookup', async () => {
  const page = await readSource('./PrintQueue.jsx')
  assert.match(page, /function PrintQueue\(\{[^}]*orders/)
  assert.match(page, /orderId/)
  assert.match(page, /orderNumber/)
})

test('print job details expose official identity, canonical status, origin, copies and station', () => {
  const details = getPrintJobDetails({
    orderId: 'order-1',
    trigger: 'automatic',
    status: 'pending',
    priority: 1,
    copiesRequested: 2,
    copiesPrinted: 1,
    stationId: 'station-1',
    document: { customer: { name: 'Ana' }, tableIdentifier: 'Mesa 3' },
  }, {
    order: { id: 'order-1', orderNumber: 42 },
    stations: [{ id: 'station-1', name: 'Cozinha PC' }],
    stationReady: true,
  })

  assert.equal(details.title, 'Pedido #42')
  assert.equal(details.identity, 'Mesa 3 · Ana')
  assert.equal(details.status, 'Na fila')
  assert.equal(details.origin, 'Automático')
  assert.equal(details.copies, '1/2')
  assert.equal(details.priority, 'Imprimir agora')
  assert.equal(details.station, 'Cozinha PC')
})

test('print job details include available timestamps, attention, error, reprint link and audit', () => {
  const details = getPrintJobDetails({
    orderId: 'order-1',
    parentJobId: 'job-previous-uuid',
    trigger: 'manual',
    status: 'requires_attention',
    attentionReason: 'A estação não confirmou',
    lastError: { code: 'QZ_PRINT_FAILED', message: 'Falha na impressora' },
    createdAt: '2026-09-08T10:00:00.000Z',
    availableAt: '2026-09-08T10:01:00.000Z',
    processingStartedAt: '2026-09-08T10:02:00.000Z',
    processedAt: null,
    discardedAt: null,
    actionActorLabel: 'Victor',
    actionAt: '2026-09-08T10:03:00.000Z',
    document: { customer: { name: 'Ana' }, tableIdentifier: 'Mesa 3' },
  }, { order: { id: 'order-1', orderNumber: 42 }, stationReady: true })

  assert.equal(details.status, 'Requer atenção')
  assert.equal(details.origin, 'Manual/Reimpressão')
  assert.equal(details.attentionReason, 'A estação não confirmou')
  assert.deepEqual(details.error, { code: 'QZ_PRINT_FAILED', message: 'Falha na impressora' })
  assert.equal(details.reprintOf, 'Reimpressão de trabalho anterior')
  assert.equal(details.audit.actor, 'Victor')
  assert.match(details.times.created.value, /08\/09\/2026/)
  assert.doesNotMatch(JSON.stringify(details), /job-previous-uuid/)
})

test('print job details omit absent values instead of rendering undefined or null', () => {
  const details = getPrintJobDetails({ status: 'printed', document: {} }, { stationReady: true })

  assert.equal(details.identity, null)
  assert.equal(details.station, null)
  assert.equal(details.priority, null)
  assert.deepEqual(details.times, {})
  assert.equal(details.attentionReason, null)
  assert.equal(details.error, null)
  assert.equal(details.reprintOf, null)
  assert.equal(JSON.stringify(details).includes('undefined'), false)
  assert.equal(JSON.stringify(details).includes('null'), true)
})

test('print queue opens details from desktop rows and mobile cards, with actions confined to the modal', async () => {
  const page = await readSource('./PrintQueue.jsx')

  assert.match(page, /onClick=\{\(\) => setSelectedJob\(filteredJobs\[index\]\)\}/)
  assert.match(page, /<Modal[\s\S]*selectedDetails\.title/)
  assert.match(page, /Fechar/)
  assert.match(page, /selectedDetails\.actions\.map/)
  const queueRows = page.slice(page.indexOf('<tbody>'), page.indexOf('{selectedDetails &&'))
  assert.doesNotMatch(queueRows, /<Button/)
})

test('7F-A queue messages use UTF-8 Portuguese strings', async () => {
  const page = await readSource('./PrintQueue.jsx')
  const manager = await readSource('../printing/usePrintingManager.js')
  assert.match(page, /Trabalho de impressão descartado/)
  assert.match(page, /Impressão autorizada e enviada para a fila/)
  assert.doesNotMatch(page, /Ãƒ|Ã‚|ï¿½/)
  assert.doesNotMatch(manager, /Ãƒ|Ã‚|ï¿½/)
})
