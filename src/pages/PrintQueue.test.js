import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { buildPrintQueueSummary, getPrintStationSummary } from './printQueueSummary.js'

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
