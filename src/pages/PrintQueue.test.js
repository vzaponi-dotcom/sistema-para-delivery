import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { buildPrintQueueSummary, getPrintStationSummary } from './printQueueSummary.js'
import { filterPrintQueueJobs, getPrintQueueSearchText } from './printQueueFilters.js'

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
  assert.match(app, /<PrintQueue printing=\{printing\}/)
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
    /order\.number/,
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

  assert.match(page, /getOperationalOrderNumber/)
  assert.match(page, /displayNumber|operationalNumber|orderNumber/)
  assert.match(page, /order\.number/)
  assert.doesNotMatch(page, /String\(.*order.*\)\.slice\(-4\)/)
})

test('print queue preserves official table and customer identity with a neutral fallback', async () => {
  const page = await readSource('./PrintQueue.jsx')

  assert.match(page, /getCustomerOrTable/)
  assert.match(page, /tableIdentifier/)
  assert.match(page, /customerOrTable: getCustomerOrTable/)
  assert.match(page, /orderNumber \? `Pedido #\$\{job\.orderNumber\}` : 'Pedido'/)
})

const filterJobs = [
  {
    id: 'customer-job',
    trigger: 'automatic',
    status: 'pending',
    document: { customer: { name: 'Ana Souza' }, tableIdentifier: 'Mesa 4', order: { number: '104' } },
  },
  {
    id: 'table-job',
    trigger: 'manual',
    status: 'printed',
    document: { customer: { name: 'Bruno Lima' }, tableIdentifier: 'Mesa 12', order: { displayNumber: '205' } },
  },
  {
    id: 'technical-id-job',
    trigger: 'automatic',
    status: 'attention',
    document: { customer: { name: 'Carla Dias' }, order: { id: '123e4567-e89b-12d3-a456-426614174000', number: '123e4567-e89b-12d3-a456-426614174000' } },
  },
]

test('print queue search matches customer case-insensitively', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: 'ANA SOUZA' }).map((job) => job.id), ['customer-job'])
})

test('print queue search matches table identifiers', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: 'mesa 12' }).map((job) => job.id), ['table-job'])
})

test('print queue search matches an available operational order number', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: '205' }).map((job) => job.id), ['table-job'])
})

test('print queue search does not match technical UUIDs', () => {
  assert.equal(getPrintQueueSearchText(filterJobs[2]).includes('123e4567-e89b-12d3-a456-426614174000'), false)
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: '123e4567-e89b-12d3-a456-426614174000' }), [])
})

test('print queue filters by canonical status and combines status with search', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { status: 'printed' }).map((job) => job.id), ['table-job'])
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: 'mesa', status: 'printed' }).map((job) => job.id), ['table-job'])
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { status: 'queued' }).map((job) => job.id), ['customer-job'])
})

test('print queue filters by reliable origin values', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { origin: 'automatic' }).map((job) => job.id), ['customer-job', 'technical-id-job'])
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { origin: 'manual' }).map((job) => job.id), ['table-job'])
})

test('print queue returns no jobs when active filters match nothing', () => {
  assert.deepEqual(filterPrintQueueJobs(filterJobs, { search: 'inexistente', status: 'printed' }), [])
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
