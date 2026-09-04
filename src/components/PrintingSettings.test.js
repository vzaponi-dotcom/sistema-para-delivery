import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const settings = await readFile(new URL('./PrintingSettings.jsx', import.meta.url), 'utf8')
const orders = await readFile(new URL('../pages/Orders.jsx', import.meta.url), 'utf8')
const manager = await readFile(new URL('../printing/usePrintingManager.js', import.meta.url), 'utf8')

test('Orders header exposes printing settings and mounts the shared settings modal', () => {
  assert.match(orders, /PrintingSettings/)
  assert.match(orders, />Impressão</)
  assert.match(orders, /showPrintingSettings/)
  assert.match(orders, /printing=\{printing\}/)
})

test('printing settings expose honest connection, station and compatibility states', () => {
  for (const label of ['Conectada', 'Desconectada', 'Não configurada', 'Navegador incompatível']) {
    assert.match(settings, new RegExp(label))
  }
  for (const label of ['Estação', 'Plataforma', 'Estação principal', 'Impressão automática', 'Cópias por pedido']) {
    assert.match(settings, new RegExp(label))
  }
  assert.match(settings, /Windows/)
  assert.match(settings, /Chrome/)
  assert.match(settings, /Android/)
  assert.match(settings, /138\+/)
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
  assert.match(settings, /Conectar impressora/)
  assert.match(settings, /Trocar impressora/)
  assert.match(settings, /Testar impressão/)
})

test('making a station primary requires the shared confirmation dialog with exclusivity warning', () => {
  assert.match(settings, /ConfirmationDialog/)
  assert.match(settings, /Tornar estação principal/)
  assert.match(settings, /única estação responsável pela impressão automática/)
  assert.match(settings, /confirmLabel="Tornar principal"/)
})

test('manager distinguishes unsupported, unconfigured, disconnected and connected states honestly', () => {
  assert.match(manager, /'unsupported'/)
  assert.match(manager, /'unconfigured'/)
  assert.match(manager, /'disconnected'/)
  assert.match(manager, /'connected'/)
  assert.match(manager, /getPrinterFingerprint/)
})
