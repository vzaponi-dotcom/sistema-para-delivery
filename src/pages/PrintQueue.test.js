import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import React, { useState } from 'react'
import { act } from 'react-test-renderer'
import { buildPrintQueueSummary, getPrintStationSummary } from './printQueueSummary.js'
import { filterPrintQueueJobs, getPrintQueueSearchText, PRINT_QUEUE_STATUS_FILTERS } from './printQueueFilters.js'
import { formatOrderCustomerIdentity } from '../../shared/orderPrintDocument.js'
import { getPrintJobDetails } from './printQueueDetails.js'
import { DEFAULT_PRINT_QUEUE_QUERY, sortPrintQueueJobsForDisplay } from './printQueueQuery.js'
import { nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

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

  assert.match(mobileNavigation, /const directItems = \[[\s\S]*?\{ id: 'comandas', label: 'Comandas', icon: 'clipboard' \},[\s\S]*?\{ id: 'clients', label: 'Clientes', icon: 'clients' \},\s*\]/)
  assert.match(mobileNavigation, /onClick=\{\(\) => navigate\('products'\)\}/)
  assert.doesNotMatch(mobileNavigation, /\{ id: 'print-queue', label: 'Fila de impressão', icon: 'printer' \}/)
  assert.match(mobileNavigation, /activeTab === 'print-queue'/)
  assert.match(mobileNavigation, /onClick=\{\(\) => navigate\('print-queue'\)\}/)
})

test('print queue summary uses the four server operational counters', () => {
  assert.deepEqual(buildPrintQueueSummary([
    { status: 'pending' },
    { status: 'awaiting_confirmation' },
    { status: 'awaiting_second_copy' },
    { status: 'requires_attention' },
    { status: 'processing' },
    { status: 'printed' },
    { status: 'discarded' },
  ]), {
    pending: 1,
    awaitingConfirmation: 1,
    waitingSecondCopy: 1,
    attention: 1,
  })
})

test('print station summary reports available health without inventing an online state', () => {
  assert.deepEqual(getPrintStationSummary({
    health: { online: true, qzReady: true, printerReady: false },
  }), {
    onlineLabel: 'Online',
    qzLabel: 'QZ conectado',
    printerLabel: 'Fila indisponível',
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

  for (const label of ['Cozinha PC', 'Aguardando impressão', 'Aguardando confirmação', 'Aguardando 2ª via', 'Requer atenção']) {
    assert.match(page, new RegExp(label))
  }
  assert.match(app, /<PrintQueue orders=\{orders\} printing=\{printing\}/)
  assert.match(styles, /\.print-queue-summary[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.print-queue-summary[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
})

test('print queue renders the empty state from the backend operational page', async () => {
  const page = await readSource('./PrintQueue.jsx')

  assert.match(page, /operationalJobs\.length === 0/)
  assert.match(page, /Os trabalhos de impressão aparecerão aqui\./)
  assert.match(page, /operationalJobs\.map/)
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
  assert.match(filters, /WAITING_CONFIRMATION/)
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

  assert.match(page, /onClick=\{\(\) => setSelectedJob\(operationalJobs\[index\]\)\}/)
  assert.match(page, /<Modal[\s\S]*selectedDetails\.title/)
  assert.match(page, /Fechar/)
  assert.match(page, /\['discard', 'skipSecondCopy'\]\.includes\(action\.key\)/)
  const tableRows = page.slice(page.indexOf('<tbody>'), page.indexOf('</tbody>') + '</tbody>'.length)
  assert.doesNotMatch(tableRows, /<Button/)
})

test('print queue modal orders actions by primary, destructive, ticket, close on mobile and close, ticket, destructive, primary on desktop', async () => {
  const [page, styles] = await Promise.all([
    readSource('./PrintQueue.jsx'),
    readSource('../print-queue.css'),
  ])

  assert.match(page, /\['discard', 'skipSecondCopy'\]\.includes\(action\.key\)/)
  assert.match(page, /!\['discard', 'skipSecondCopy'\]\.includes\(action\.key\)/)
  assert.match(styles, /\.print-queue-detail-actions[\s\S]*\.print-queue-detail-close/)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.print-queue-detail-primary[\s\S]*order: 1[\s\S]*\.print-queue-detail-destructive[\s\S]*order: 2[\s\S]*\.print-queue-detail-ticket[\s\S]*order: 3[\s\S]*\.print-queue-detail-close[\s\S]*order: 4/)
})

test('7F-A queue messages use UTF-8 Portuguese strings', async () => {
  const page = await readSource('./PrintQueue.jsx')
  const manager = await readSource('../printing/usePrintingManager.js')
  assert.match(page, /Trabalho de impressão descartado/)
  assert.match(page, /Impressão autorizada e enviada para a fila/)
  assert.doesNotMatch(page, /Ãƒ|Ã‚|ï¿½/)
  assert.doesNotMatch(manager, /Ãƒ|Ã‚|ï¿½/)
})

test('7F-B1 keeps reprint and ticket preview in the detail modal, using the immutable job snapshot', async () => {
  const [page, manager, styles] = await Promise.all([
    readSource('./PrintQueue.jsx'),
    readSource('../printing/usePrintingManager.js'),
    readSource('../print-queue.css'),
  ])

  assert.match(page, /import OrderTicketPreview/)
  assert.match(page, /requestReprint/)
  assert.match(manager, /const requestReprint = useCallback/)
  assert.match(page, /title=\{`Reimprimir \$\{selectedDetails\.title\}`\}/)
  assert.match(page, /\[1, 2\]\.map\(\(copies\)/)
  assert.match(page, /copies === 1 \? 'via' : 'vias'/)
  assert.match(page, /disabled=\{!reprintCopies \|\| actionPending\}/)
  assert.match(page, /Reimpressão adicionada à fila/)
  assert.match(page, /title=\{`Ticket do \$\{selectedDetails\.title\}`\}/)
  assert.match(page, /<OrderTicketPreview document=\{selectedJob\.document\} \/>/)
  assert.doesNotMatch(page, /getPreviewDocument/)
  assert.match(styles, /\.print-queue-detail-ticket \{ order: 3;/)
  assert.match(styles, /\.print-queue-detail-close \{ order: 4;/)
})

test('remote second-copy decisions use their approved toasts and confirmation variants', async () => {
  const page = await readSource('./PrintQueue.jsx')
  assert.match(page, /requestSecondCopy: '2ª via enviada para a fila'/)
  assert.match(page, /skipSecondCopy: '2ª via dispensada'/)
  assert.match(page, /confirmation === 'requestSecondCopy' \? 'primary'/)
  assert.match(page, /confirmation === 'skipSecondCopy' \? 'danger'/)
  assert.doesNotMatch(page, /printSecondCopy\(/)
})

test('print queue remains central-API-only for every operational action', async () => {
  const page = await readSource('./PrintQueue.jsx')

  for (const command of ['requestPrintNow', 'requestRetry', 'requestDiscard', 'requestForcePrint', 'requestReprint', 'requestSecondCopy', 'skipSecondCopy']) {
    assert.match(page, new RegExp(`printing\\?\\.${command}`))
  }
  assert.doesNotMatch(page, /printSecondCopy\(|claimPrintJob\(|claimNextPrintJob\(|dispatchRawBt|writeSerialBytes|\bqz\./)
})

test('print queue reads only the paginated main list and summary', async () => {
  const page = await readSource('./PrintQueue.jsx')

  assert.match(page, /getPrintJobs\(query\)/)
  assert.match(page, /getPrintQueueSummary\(\)/)
  assert.match(page, /pageInfo/)
  assert.doesNotMatch(page, /filterPrintQueueJobs\(jobs/)
})

test('print queue status filter exposes only jobs that still require operational follow-up', () => {
  assert.deepEqual(PRINT_QUEUE_STATUS_FILTERS.map(({ value, label }) => ({ value, label })), [
    { value: 'all', label: 'Todos' },
    { value: 'queued', label: 'Na fila' },
    { value: 'waiting_station', label: 'Aguardando estação' },
    { value: 'printing', label: 'Imprimindo' },
    { value: 'waiting_confirmation', label: 'Aguardando confirmação' },
    { value: 'waiting_second_copy', label: 'Aguardando 2ª via' },
    { value: 'attention', label: 'Requer atenção' },
  ])
})

test('main panel exposes sortable backend columns and page-aware mobile cards without a recent section', async () => {
  const [page, styles] = await Promise.all([
    readSource('./PrintQueue.jsx'),
    readSource('../print-queue.css'),
  ])

  for (const label of ['Pedido', 'Job', 'Status', 'Origem', 'Data/Hora']) assert.match(page, new RegExp(label))
  assert.doesNotMatch(page, /Impressões recentes/)
  assert.match(page, /aria-sort/)
  assert.match(page, /togglePrintQueueSort/)
  assert.match(page, /operationalJobs\.map/)
  assert.doesNotMatch(page, /recentJobs/)
  assert.doesNotMatch(styles, /print-queue-recent-section|print-queue-recent-row/)
  assert.match(styles, /print-queue-pagination/)
})

test('print queue identifies and sorts consolidated comandas from their immutable document', () => {
  const comanda = {
    id: 'comanda-42', type: 'table-tab', tableTabId: 'tab-42', trigger: 'manual', status: 'pending',
    copiesRequested: 1, copiesPrinted: 0,
    document: { type: 'table-tab', tableTab: { id: 'tab-42', number: 42, tableName: 'Mesa 7' } },
  }
  const details = getPrintJobDetails(comanda)
  assert.equal(details.title, 'Comanda #42')
  assert.equal(details.identity, 'Mesa 7')
  assert.deepEqual(sortPrintQueueJobsForDisplay([
    comanda,
    { ...comanda, id: 'comanda-7', document: { type: 'table-tab', tableTab: { id: 'tab-7', number: 7, tableName: 'Varanda' } } },
  ], { sortBy: 'orderNumber', sortDir: 'asc' }).map((job) => job.id), ['comanda-7', 'comanda-42'])
})

test('clicking a column header immediately reorders the displayed jobs even when the backend response order is stale', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: PrintQueue } = await harness.load('/src/pages/PrintQueue.jsx')
  const jobs = [
    { id: 'job-72', orderId: 'order-72', status: 'pending', trigger: 'automatic', copiesRequested: 1, copiesPrinted: 0, createdAt: '2026-09-10T22:42:00.000Z', document: { type: 'order', customer: {}, order: { id: 'order-72' } } },
    { id: 'job-71', orderId: 'order-71', status: 'pending', trigger: 'automatic', copiesRequested: 1, copiesPrinted: 0, createdAt: '2026-09-10T22:41:00.000Z', document: { type: 'order', customer: {}, order: { id: 'order-71' } } },
  ]
  globalThis.fetch = async (path) => {
    const url = String(path)
    if (url.startsWith('/api/printing/jobs?')) return { ok: true, json: async () => ({ jobs, pageInfo: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 } }) }
    if (url === '/api/printing/jobs/summary') return { ok: true, json: async () => ({ summary: { pending: 2, awaitingConfirmation: 0, awaitingSecondCopy: 0, attention: 0 } }) }
    throw new Error(`Unexpected request: ${url}`)
  }

  function ControlledPrintQueue(props) {
    const [queryState, setQueryState] = useState(() => ({ ...DEFAULT_PRINT_QUEUE_QUERY }))
    return React.createElement(PrintQueue, { ...props, queryState, onQueryChange: setQueryState })
  }

  const renderer = await harness.render(ControlledPrintQueue, {
    orders: [{ id: 'order-72', orderNumber: 72 }, { id: 'order-71', orderNumber: 71 }],
    printing: { localStation: null, printerHealth: { state: 'verifying' }, stations: [] },
  })
  const displayedOrders = () => renderer.root.findAllByProps({ className: 'print-queue-job-row' })
    .map((row) => nodeText(row).match(/Pedido #\d+/)?.[0])
  assert.deepEqual(displayedOrders(), ['Pedido #72', 'Pedido #71'])

  const orderHeader = renderer.root.findAllByProps({ className: 'print-queue-sort' })[0]
  await act(async () => { orderHeader.props.onClick(); await Promise.resolve(); await Promise.resolve() })
  await act(async () => { orderHeader.props.onClick(); await Promise.resolve(); await Promise.resolve() })

  assert.deepEqual(displayedOrders(), ['Pedido #71', 'Pedido #72'])
})

test('operational summary and unknown physical outcome use the approved safety language', () => {
  assert.deepEqual(buildPrintQueueSummary([
    { status: 'pending' },
    { status: 'awaiting_confirmation' },
    { status: 'awaiting_second_copy' },
    { status: 'requires_attention' },
  ]), {
    pending: 1,
    awaitingConfirmation: 1,
    waitingSecondCopy: 1,
    attention: 1,
  })

  const details = getPrintJobDetails({
    status: 'requires_attention',
    lastError: { code: 'PRINT_OUTCOME_UNKNOWN' },
  })
  assert.deepEqual(details.unknownOutcome, {
    title: 'Não foi possível confirmar esta impressão',
    message: 'Esta via pode ter sido impressa antes de a conexão ser interrompida.',
    duplicateRisk: 'Reenviar pode gerar uma impressão duplicada.',
  })
})
