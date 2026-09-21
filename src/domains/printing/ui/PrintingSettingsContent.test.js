import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { nodeText, workspaceHarness } from '../../../test-support/renderWorkspace.js'

import * as printing from '../index.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('Printing owns PrintingSettingsContent behind its public surface', () => {
  assert.equal(typeof printing.PrintingSettingsContent, 'function')
  assert.equal(existsSync(new URL('./PrintingSettingsContent.jsx', import.meta.url)), true)
  assert.equal(existsSync(new URL('../../../components/PrintingSettingsContent.jsx', import.meta.url)), false)
})

test('Printing Settings keeps independent order and table copy fields after the move', () => {
  assert.equal(existsSync(new URL('./PrintingSettingsContent.jsx', import.meta.url)), true)
  if (!existsSync(new URL('./PrintingSettingsContent.jsx', import.meta.url))) return
  const settingsSource = read('./PrintingSettingsContent.jsx')
  assert.match(settingsSource, /orderDefaultCopies/)
  assert.match(settingsSource, /tableTabDefaultCopies/)
  assert.match(settingsSource, /Apenas novas solicitações de impressão/)
})

test('SettingsSurface consumes Printing settings UI only through the public entry', () => {
  const surface = read('../../../app/surfaces/settings/SettingsSurface.jsx')
  assert.match(surface, /domains\/printing\/index\.js/)
  assert.doesNotMatch(surface, /components\/PrintingSettingsContent\.jsx/)
})


const cleanResource = (data) => ({
  status: 'clean',
  dirty: false,
  error: null,
  draft: data,
  confirmed: { data },
})

const settingsFixture = ({ station, primaryStationId }) => ({
  policyState: () => cleanResource({ orderDefaultCopies: 2, tableTabDefaultCopies: 1 }),
  stationState: () => cleanResource({
    name: station.name,
    platform: station.platform,
    autoPrintEnabled: Boolean(station.autoPrintEnabled),
  }),
  primaryState: () => cleanResource({ primaryStationId }),
})

test('task 4 queue-only settings reuse the business operational status without physical local controls', async (t) => {
  const h = await workspaceHarness(t, { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8)' })
  const { default: PrintingSettingsContent } = await h.load('/src/domains/printing/ui/PrintingSettingsContent.jsx')

  const local = {
    id: 'android-secondary',
    name: 'PC Victor',
    platform: 'android',
    isPrimary: false,
    autoPrintEnabled: false,
    health: { online: false, qzReady: false, printerReady: false, ready: false },
  }
  const primary = {
    id: 'windows-primary',
    name: 'Cozinha Windows',
    platform: 'windows',
    isPrimary: true,
    autoPrintEnabled: true,
    physicalState: 'ready',
    health: { online: true, qzReady: true, printerReady: true, ready: true },
  }
  const screen = await h.render(PrintingSettingsContent, {
    printing: {
      transportKind: 'queue-only',
      localStation: local,
      stations: [local, primary],
      printerState: 'unsupported',
      qzConnected: false,
      configuredPrinterName: null,
      printerQueueFound: false,
      printerHealth: { state: 'verifying', ready: false },
      jobs: [
        { id: 'job-1', status: 'pending' },
        { id: 'job-2', status: 'awaiting_confirmation' },
      ],
    },
    settings: settingsFixture({ station: local, primaryStationId: primary.id }),
    granted: new Set(['printing.station.view']),
  })

  const text = nodeText(screen.root)
  assert.match(text, /Impressão do negócio/)
  assert.match(text, /Impressão disponível/)
  assert.match(text, /Gerenciada pela estação Cozinha Windows/)
  assert.match(text, /Estação responsável/)
  assert.match(text, /Cozinha Windows/)
  assert.match(text, /Esta estação acompanha a fila central e não realiza impressão física\./)

  assert.doesNotMatch(text, /Impressora local \(QZ Tray\)/)
  assert.doesNotMatch(text, /Impressora configurada/)
  assert.doesNotMatch(text, /Testar impressão/)
  assert.doesNotMatch(text, /Trocar impressora/)
})

test('task 4 QZ settings keep local printer controls under Impressão nesta estação', async (t) => {
  const h = await workspaceHarness(t, { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })
  const { default: PrintingSettingsContent } = await h.load('/src/domains/printing/ui/PrintingSettingsContent.jsx')

  const local = {
    id: 'windows-primary',
    name: 'Cozinha Windows',
    platform: 'windows',
    isPrimary: true,
    autoPrintEnabled: true,
    physicalState: 'ready',
    health: { online: true, qzReady: true, printerReady: true, ready: true },
  }
  const screen = await h.render(PrintingSettingsContent, {
    printing: {
      transportKind: 'qz',
      localStation: local,
      stations: [local],
      printerState: 'connected',
      qzConnected: true,
      configuredPrinterName: 'Elgin i9',
      printerQueueFound: true,
      transportReady: true,
      printerHealth: { state: 'ready', ready: true },
      availablePrinters: ['Elgin i9'],
      jobs: [{ id: 'job-1', status: 'pending' }],
    },
    settings: settingsFixture({ station: local, primaryStationId: local.id }),
    granted: new Set(['printing.station.configure', 'printing.execute']),
  })

  const text = nodeText(screen.root)
  assert.match(text, /Impressão nesta estação/)
  assert.match(text, /Impressão disponível/)
  assert.match(text, /Elgin i9/)
  assert.match(text, /Testar impressão/)
  assert.match(text, /Trocar impressora/)
  assert.doesNotMatch(text, /Impressão do negócio/)
})

test('task 4 settings source consumes the same operational resolver and view as the queue', () => {
  const source = read('./PrintingSettingsContent.jsx')
  assert.match(source, /derivePrintOperationalStatus/)
  assert.match(source, /buildPrintOperationalView/)
  assert.doesNotMatch(source, /const operationalLabel = !isQz/)
})


test('task 5 contextual settings expose textual operational status without null or undefined leaks', async (t) => {
  const h = await workspaceHarness(t, { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8)' })
  const { default: PrintingSettingsContent } = await h.load('/src/domains/printing/ui/PrintingSettingsContent.jsx')
  const local = { id: 'android-secondary', name: 'PC Victor', platform: 'android', isPrimary: false }
  const screen = await h.render(PrintingSettingsContent, {
    printing: {
      transportKind: 'queue-only',
      localStation: local,
      stations: [local],
      printerState: 'unsupported',
      qzConnected: false,
      configuredPrinterName: null,
      printerQueueFound: false,
      printerHealth: { state: 'verifying', ready: false },
      jobs: [],
    },
    settings: settingsFixture({ station: local, primaryStationId: null }),
    granted: new Set(['printing.station.view']),
  })

  const text = nodeText(screen.root)
  assert.match(text, /Estação de impressão não configurada/)
  assert.match(text, /Status da impressão/)
  assert.doesNotMatch(text, /\bundefined\b|\bnull\b/)
  assert.doesNotMatch(text, /Testar impressão|Trocar impressora/)
})
