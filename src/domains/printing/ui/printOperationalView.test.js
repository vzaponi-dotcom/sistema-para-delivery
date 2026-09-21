import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPrintOperationalView } from './printOperationalView.js'

const primary = { id: 'windows-primary', name: 'Cozinha Windows', platform: 'windows', isPrimary: true }

const status = (code, overrides = {}) => ({
  code,
  primaryStation: primary,
  isLocalPrimary: false,
  source: 'heartbeat',
  physicalState: null,
  ...overrides,
})

test('ready remote view names the primary station and reports pending work without technical local telemetry', () => {
  assert.deepEqual(buildPrintOperationalView(status('ready'), { pendingCount: 3 }), {
    code: 'ready',
    tone: 'success',
    title: 'Impressão disponível',
    description: 'Gerenciada pela estação Cozinha Windows.',
    helper: '3 trabalhos aguardando impressão.',
    primaryStationName: 'Cozinha Windows',
  })
})

test('ready local-primary view may expose the configured local printer name', () => {
  assert.deepEqual(buildPrintOperationalView(status('ready', { isLocalPrimary: true, source: 'local' }), {
    pendingCount: 0,
    localPrinterName: 'Elgin i9',
  }), {
    code: 'ready',
    tone: 'success',
    title: 'Impressão disponível',
    description: 'Elgin i9 · Impressora desta estação.',
    helper: null,
    primaryStationName: 'Cozinha Windows',
  })
})

test('no-primary view guides configuration without claiming the station is offline', () => {
  assert.deepEqual(buildPrintOperationalView({
    code: 'no_primary',
    primaryStation: null,
    isLocalPrimary: false,
    source: 'none',
    physicalState: null,
  }, { pendingCount: 1 }), {
    code: 'no_primary',
    tone: 'warning',
    title: 'Estação de impressão não configurada',
    description: 'Defina uma estação Windows como responsável pela impressão automática.',
    helper: '1 trabalho aguardando uma estação principal.',
    primaryStationName: null,
  })
})

test('offline primary escalates when pending jobs are affected', () => {
  assert.deepEqual(buildPrintOperationalView(status('primary_offline'), { pendingCount: 3 }), {
    code: 'primary_offline',
    tone: 'danger',
    title: 'Estação de impressão indisponível',
    description: 'A estação Cozinha Windows está offline.',
    helper: '3 trabalhos aguardando a estação voltar.',
    primaryStationName: 'Cozinha Windows',
  })
  assert.equal(buildPrintOperationalView(status('primary_offline'), { pendingCount: 0 }).tone, 'warning')
})

test('QZ unavailable is attributed to the primary station', () => {
  const view = buildPrintOperationalView(status('qz_unavailable'), { pendingCount: 2 })

  assert.equal(view.title, 'QZ Tray desconectado na estação principal')
  assert.equal(view.description, 'A estação Cozinha Windows está online, mas o QZ Tray não está disponível.')
  assert.equal(view.helper, '2 trabalhos aguardando impressão.')
  assert.equal(view.tone, 'danger')
})

test('local unconfigured printer has a specific actionable view', () => {
  const view = buildPrintOperationalView(status('printer_unconfigured', {
    isLocalPrimary: true,
    source: 'local',
  }), { pendingCount: 0 })

  assert.equal(view.title, 'Impressora não configurada')
  assert.equal(view.description, 'Selecione a impressora desta estação para começar a imprimir.')
  assert.equal(view.tone, 'warning')
})

test('printer unavailable refines only causes supported by physical state', () => {
  const offline = buildPrintOperationalView(status('printer_unavailable', { physicalState: 'printer_offline' }), { pendingCount: 2 })
  assert.equal(offline.title, 'Impressora indisponível')
  assert.equal(offline.description, 'A impressora está desligada ou desconectada.')
  assert.equal(offline.tone, 'danger')

  const attention = buildPrintOperationalView(status('printer_unavailable', { physicalState: 'printer_attention' }))
  assert.equal(attention.description, 'A impressora requer atenção antes de continuar.')

  const generic = buildPrintOperationalView(status('printer_unavailable'))
  assert.equal(generic.description, 'A estação principal não consegue usar a impressora no momento.')
})

test('verifying stays neutral and never invents an offline cause', () => {
  assert.deepEqual(buildPrintOperationalView(status('verifying'), { pendingCount: 2 }), {
    code: 'verifying',
    tone: 'neutral',
    title: 'Verificando impressão',
    description: 'Verificando a estação Cozinha Windows.',
    helper: '2 trabalhos permanecem na fila enquanto o status é verificado.',
    primaryStationName: 'Cozinha Windows',
  })
})
