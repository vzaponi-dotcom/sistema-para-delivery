import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const settings = await readFile(new URL('./PrintingSettings.jsx', import.meta.url), 'utf8')
const orders = await readFile(new URL('../pages/Orders.jsx', import.meta.url), 'utf8')
const manager = await readFile(new URL('../printing/usePrintingManager.js', import.meta.url), 'utf8')
const css = await readFile(new URL('../printing/printing.css', import.meta.url), 'utf8')

test('Orders header exposes printing settings and mounts the shared settings modal', () => {
  assert.match(orders, /PrintingSettings/)
  assert.match(orders, />Impressão</)
  assert.match(orders, /showPrintingSettings/)
  assert.match(orders, /printing=\{printing\}/)
})

test('printing settings expose honest connection, station and transport states', () => {
  for (const label of ['Conectada', 'Desconectada', 'Não configurada', 'Navegador incompatível', 'RawBT pronto']) {
    assert.match(settings, new RegExp(label))
  }
  for (const label of ['Estação', 'Plataforma', 'Driver', 'Estação principal', 'Impressão automática', 'Cópias por pedido']) {
    assert.match(settings, new RegExp(label))
  }
  assert.match(settings, /Windows/)
  assert.match(settings, /Web Serial/)
  assert.match(settings, /Android/)
  assert.match(settings, /RawBT/)
  assert.match(settings, /MPT-II/)
})

test('Android RawBT hides Web Serial connection chooser but preserves test and station controls', () => {
  assert.match(settings, /printing\?\.transportKind === 'rawbt'/)
  assert.match(settings, /!isRawBt && \(/)
  assert.match(settings, /Conectar impressora/)
  assert.match(settings, /Trocar impressora/)
  assert.match(settings, /Testar impressão/)
  assert.match(settings, /Configure a MPT-II no RawBT/)
})

test('settings actions use the printing manager and persist only one or two copies', () => {
  assert.match(settings, /connectPrinter/)
  assert.match(settings, /testPrint/)
  assert.match(settings, /saveStationSettings/)
  assert.match(settings, /makePrimary/)
  assert.match(settings, /defaultCopies/)
  assert.match(settings, /value=\{1\}/)
  assert.match(settings, /value=\{2\}/)
  assert.match(settings, /Imprimir novos pedidos automaticamente/)
})

test('making a station primary requires the shared confirmation dialog with exclusivity warning', () => {
  assert.match(settings, /ConfirmationDialog/)
  assert.match(settings, /Tornar estação principal/)
  assert.match(settings, /única estação responsável pela impressão automática/)
  assert.match(settings, /confirmLabel="Tornar principal"/)
})

test('manager distinguishes RawBT driver readiness and Web Serial connection states honestly', () => {
  assert.match(manager, /'driver-ready'/)
  assert.match(manager, /'unsupported'/)
  assert.match(manager, /'unconfigured'/)
  assert.match(manager, /'disconnected'/)
  assert.match(manager, /'connected'/)
  assert.match(manager, /getPrinterFingerprint/)
})

test('printing settings expose stable themed hooks without changing control semantics', () => {
  for (const className of [
    'printing-status-card',
    'printing-info-card',
    'printing-actions-row',
    'printing-toggle-row',
    'printing-copy-options',
    'printing-primary-card',
    'printing-compatibility',
  ]) assert.match(settings, new RegExp(className))

  assert.match(settings, /type="checkbox"/)
  assert.match(settings, /type="radio"/)
  assert.match(settings, /value=\{1\}/)
  assert.match(settings, /value=\{2\}/)
})

test('printing settings styling uses semantic tokens and complete interaction states', () => {
  assert.doesNotMatch(css, /var\(--[^,]+,\s*#[0-9a-f]{3,8}\)/i)
  assert.match(css, /\.printing-status-card[\s\S]*background:\s*var\(--surface-soft\)/)
  assert.match(css, /\.printing-info-card[\s\S]*background:\s*var\(--surface\)/)
  assert.match(css, /\.printing-toggle-row input[\s\S]*accent-color:\s*var\(--primary\)/)
  assert.match(css, /\.printing-settings[^}]*color:\s*var\(--text\)/)
  assert.match(css, /\.printing-settings[\s\S]*:focus-visible/)
  assert.match(css, /\.printing-settings[\s\S]*:hover/)
  assert.match(css, /\.printing-settings[\s\S]*:disabled/)
  assert.match(css, /cursor:\s*not-allowed/)
  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.printing-actions-row[\s\S]*width:\s*100%/)
})
