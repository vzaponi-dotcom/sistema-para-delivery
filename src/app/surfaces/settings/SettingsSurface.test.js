import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'

import { nodeText, workspaceHarness } from '../../../test-support/renderWorkspace.js'

const context = { ownerId: 'business-1', generation: 1, contextId: 'context-1', capabilities: [] }
const policyData = {
  operations: { timing: {}, enabledModalities: ['Entrega'], defaultModality: 'Entrega' },
  paymentMethods: { methods: [], defaultMethod: '' },
  cancellationReasons: { items: [] },
  financeCategories: { items: [] },
  printingPolicy: { orderDefaultCopies: 1, tableTabDefaultCopies: 1 },
  stationConfiguration: { name: 'Cozinha', platform: 'windows', autoPrintEnabled: false },
  stationPrimary: { primaryStationId: 'station-1' },
}
const operationsData = {
  timing: {
    scheduledPrepLeadMinutes: 0,
    scheduledLateGraceMinutes: 0,
    immediateLateAfterMinutes: 30,
    immediateVeryLateAfterMinutes: 60,
  },
  enabledModalities: ['Entrega'],
  defaultModality: 'Entrega',
}

async function renderSection(t, section, { granted = new Set(), printing = { localStation: { id: 'station-1' } } } = {}) {
  const h = await workspaceHarness(t)
  const calls = []
  const [{ PolicyEditingProvider }, { default: SettingsSurface }] = await Promise.all([
    h.load('/src/app/policy-editing/PolicyEditingProvider.jsx'),
    h.load('/src/app/surfaces/settings/SettingsSurface.jsx'),
  ])
  const screen = await h.render(PolicyEditingProvider, {
    context,
    storage: h.sessionStorage,
    transport: {
      load: async (id, scopeId) => {
        calls.push(['load', id, scopeId])
        return { revision: 1, data: policyData[id] }
      },
      save: async () => ({ resource: { revision: 2, data: {} }, receipt: { committedRevision: 2 } }),
      loadReceipt: async () => ({ status: 'unconfirmed' }),
    },
    children: React.createElement(SettingsSurface, {
      section, printing, granted, implemented: new Set(['settings-home']), onNavigate() {}, soundEnabled: true,
      onSoundEnabledChange() {}, onSuccessMessage() {},
    }),
  })
  await act(async () => {})
  return { calls, screen }
}

test('loads the policy selected by each versioned Settings destination', async (t) => {
  for (const [section, expected] of [
    ['settings-operations', ['operations', undefined]],
    ['settings-modalities', ['operations', undefined]],
    ['settings-payments', ['paymentMethods', undefined]],
    ['settings-cancellations', ['cancellationReasons', undefined]],
    ['settings-finance-categories', ['financeCategories', undefined]],
  ]) {
    const { calls } = await renderSection(t, section)
    assert.deepEqual(calls, [['load', ...expected]])
  }
})

test('loads printing policy and permitted station policies, while device preferences stay local', async (t) => {
  const printing = await renderSection(t, 'settings-printing', {
    granted: new Set(['printing.settings.view', 'printing.station.view']),
  })
  assert.deepEqual(printing.calls, [
    ['load', 'printingPolicy', undefined],
    ['load', 'stationConfiguration', 'station-1'],
    ['load', 'stationPrimary', undefined],
  ])
  assert.match(nodeText(printing.screen.root), /Impress/)

  const device = await renderSection(t, 'settings-device')
  assert.deepEqual(device.calls, [])
  assert.match(nodeText(device.screen.root), /Prefer.ncias deste dispositivo/)
})

test('renders Settings Home without loading a versioned policy', async (t) => {
  const { calls, screen } = await renderSection(t, 'settings-home')
  assert.deepEqual(calls, [])
  assert.match(nodeText(screen.root), /Configura/)
})

test('closing the active conflict modal leaves the policy conflicted and lets its review reopen', async (t) => {
  const h = await workspaceHarness(t)
  let reads = 0
  const [{ PolicyEditingProvider }, { usePolicyEditing }, { default: SettingsSurface }] = await Promise.all([
    h.load('/src/app/policy-editing/PolicyEditingProvider.jsx'),
    h.load('/src/app/policy-editing/policyEditingContext.js'),
    h.load('/src/app/surfaces/settings/SettingsSurface.jsx'),
  ])
  const api = React.createRef()
  function Probe() {
    const value = usePolicyEditing()
    React.useImperativeHandle(api, () => value, [value])
    return null
  }
  const surface = React.createElement(SettingsSurface, {
    section: 'settings-operations', printing: {}, granted: new Set(['operations.settings.manage']),
    implemented: new Set(), onNavigate() {}, soundEnabled: false, onSoundEnabledChange() {}, onSuccessMessage() {},
  })
  const screen = await h.render(PolicyEditingProvider, {
    context, storage: h.sessionStorage,
    transport: {
      load: async () => ++reads === 1
        ? { revision: 1, data: operationsData }
        : { revision: 2, data: { ...operationsData, remote: true } },
      save: async () => { throw { status: 409 } },
      loadReceipt: async () => ({ status: 'unconfirmed' }),
    },
    children: React.createElement(React.Fragment, null, surface, React.createElement(Probe)),
  })
  await act(async () => {})
  await act(async () => api.current.edit('operations', { ...operationsData, defaultModality: 'Retirada' }))
  await act(async () => assert.equal(await api.current.save('operations'), false))

  assert.match(nodeText(screen.root), /Revisar altera/)
  await act(async () => api.current.dismissActiveConflict())
  assert.equal(api.current.resources.operations.status, 'conflict')
  assert.doesNotMatch(nodeText(screen.root), /Aplicar revis/)
  await act(async () => api.current.reviewConflict('operations'))
  assert.match(nodeText(screen.root), /Aplicar revis/)
})
