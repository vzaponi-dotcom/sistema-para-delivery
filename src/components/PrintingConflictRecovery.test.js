import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'

import { buttonNamed, nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

const readyPolicy = {
  status: 'ready',
  confirmed: { data: { orderDefaultCopies: 1, tableTabDefaultCopies: 1 } },
}

const readyStation = {
  status: 'ready',
  confirmed: {
    data: { name: 'Cozinha Windows', platform: 'windows', autoPrintEnabled: true },
  },
}

const readyPrimary = {
  status: 'ready',
  confirmed: { data: { primaryStationId: 'station-real-7' } },
}

const printing = {
  transportKind: 'qz',
  supported: true,
  qzConnected: true,
  transportReady: true,
  printerQueueFound: true,
  printerHealth: { state: 'ready' },
  configuredPrinterName: 'Cozinha',
  availablePrinters: ['Cozinha'],
  jobs: [],
  localStation: {
    id: 'station-real-7',
    name: 'Cozinha Windows',
    platform: 'windows',
    autoPrintEnabled: true,
    isPrimary: true,
  },
}

const grants = new Set(['printing.settings', 'printing.station.configure', 'printing.execute'])

test('printing conflict stays human-readable and can reopen review after Continue editing', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PrintingSettingsContent } = await h.load('/src/components/PrintingSettingsContent.jsx')
  const review = { resource: 'printingPolicy', conflicts: [] }
  const opened = []
  let reviewCalls = 0
  const settings = {
    policyState: () => ({
      status: 'conflict',
      error: 'SETTINGS_REVISION_CONFLICT',
      dirty: true,
      draft: { orderDefaultCopies: 2, tableTabDefaultCopies: 1 },
      confirmed: { data: { orderDefaultCopies: 1, tableTabDefaultCopies: 1 } },
    }),
    stationState: () => readyStation,
    primaryState: () => readyPrimary,
    reviewPolicy: async () => { reviewCalls += 1; return review },
  }

  const screen = await h.render(PrintingSettingsContent, {
    printing,
    settings,
    granted: grants,
    onReviewConflict: (value) => opened.push(value),
  })
  const text = nodeText(screen.root)

  assert.doesNotMatch(text, /SETTINGS_REVISION_CONFLICT|settings_revision_conflict/i)
  assert.doesNotMatch(text, /Tentar novamente/)
  assert.match(text, /alterações.*outro dispositivo.*revisar/i)

  await act(async () => buttonNamed(screen.root, 'Revisar alterações').props.onClick())
  assert.equal(reviewCalls, 1)
  assert.deepEqual(opened, [review])
})

test('station configuration conflict uses the same review recovery instead of a raw backend error', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PrintingSettingsContent } = await h.load('/src/components/PrintingSettingsContent.jsx')
  const review = { resource: 'stationConfiguration', conflicts: [{ id: 'name' }] }
  const opened = []
  let reviewCalls = 0
  const settings = {
    policyState: () => readyPolicy,
    stationState: () => ({
      status: 'conflict',
      error: 'SETTINGS_REVISION_CONFLICT',
      dirty: true,
      draft: { name: 'Expedição', platform: 'windows', autoPrintEnabled: true },
      confirmed: readyStation.confirmed,
    }),
    primaryState: () => readyPrimary,
    reviewStation: async () => { reviewCalls += 1; return review },
  }

  const screen = await h.render(PrintingSettingsContent, {
    printing,
    settings,
    granted: grants,
    onReviewConflict: (value) => opened.push(value),
  })
  const text = nodeText(screen.root)

  assert.doesNotMatch(text, /SETTINGS_REVISION_CONFLICT|settings_revision_conflict/i)
  assert.doesNotMatch(text, /Tentar novamente/)
  assert.match(text, /alterações.*outro dispositivo.*revisar/i)

  await act(async () => buttonNamed(screen.root, 'Revisar alterações').props.onClick())
  assert.equal(reviewCalls, 1)
  assert.deepEqual(opened, [review])
})

test('primary station conflict remains reopenable after the review modal is closed', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PrintingSettingsContent } = await h.load('/src/components/PrintingSettingsContent.jsx')
  const review = { resource: 'stationPrimary', conflicts: [{ id: 'primary' }] }
  const opened = []
  let reviewCalls = 0
  const settings = {
    policyState: () => readyPolicy,
    stationState: () => readyStation,
    primaryState: () => ({
      status: 'conflict',
      error: 'SETTINGS_REVISION_CONFLICT',
      dirty: true,
      draft: { primaryStationId: 'station-real-7' },
      confirmed: { data: { primaryStationId: 'station-remote' } },
    }),
    reviewPrimary: async () => { reviewCalls += 1; return review },
  }

  const screen = await h.render(PrintingSettingsContent, {
    printing,
    settings,
    granted: grants,
    onReviewConflict: (value) => opened.push(value),
  })
  const text = nodeText(screen.root)

  assert.doesNotMatch(text, /SETTINGS_REVISION_CONFLICT|settings_revision_conflict/i)
  assert.match(text, /estação principal.*outro dispositivo.*revisada/i)

  await act(async () => buttonNamed(screen.root, 'Revisar alterações').props.onClick())
  assert.equal(reviewCalls, 1)
  assert.deepEqual(opened, [review])
})
