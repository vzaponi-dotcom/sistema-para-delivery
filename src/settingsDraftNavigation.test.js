import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'

import { workspaceHarness } from './test-support/renderWorkspace.js'

const implemented = new Set(['orders', 'new-order', 'clients', 'settings-printing', 'settings-device'])
const fullGranted = new Set(['orders.view', 'orders.create', 'clients.view', 'printing.settings', 'preferences.local'])
const dirtyDraft = { resourceKey: 'operations', dirty: true, status: 'ready', destinations: new Set(['settings-printing']) }

async function mountNavigation(t, initial = {}) {
  const h = await workspaceHarness(t)
  const { useNavigationController } = await h.load('/src/app/useNavigationController.js')
  const api = React.createRef()
  const discarded = []
  const feedback = []
  const Probe = React.forwardRef(function Probe({ granted = fullGranted, draft = dirtyDraft }, ref) {
    const navigation = useNavigationController({
      granted,
      implemented,
      checkoutPending: false,
      dirtyOrder: false,
      onDiscardOrder() {},
      getSettingsDraft: () => draft,
      onDiscardSettings: (resourceKey) => discarded.push(resourceKey),
      onFeedback: (message) => feedback.push(message),
    })
    React.useImperativeHandle(ref, () => navigation, [navigation])
    return React.createElement('output', null, `${navigation.activeTab}:${navigation.pendingDestination || ''}:${navigation.moreOpen}`)
  })
  const renderer = await h.render(Probe, { ref: api, ...initial })
  return { h, api, renderer, Probe, discarded, feedback }
}

test('leaving a dirty settings editor waits for discard while cancel preserves the exact draft', async (t) => {
  const fixture = await mountNavigation(t)
  const original = dirtyDraft
  await act(async () => fixture.api.current.requestNavigation('settings-printing'))
  await act(async () => fixture.api.current.requestNavigation('clients'))
  assert.equal(fixture.api.current.activeTab, 'settings-printing')
  assert.equal(fixture.api.current.pendingDestination, 'clients')
  await act(async () => fixture.api.current.cancelDiscard())
  assert.equal(fixture.api.current.activeTab, 'settings-printing')
  assert.deepEqual(fixture.discarded, [])
  assert.equal(original, dirtyDraft)
})

test('discard revalidates capability and never executes a destination revoked while open', async (t) => {
  const fixture = await mountNavigation(t)
  await act(async () => fixture.api.current.requestNavigation('settings-printing'))
  await act(async () => fixture.api.current.requestNavigation('clients'))
  await act(async () => fixture.renderer.update(React.createElement(fixture.Probe, {
    ref: fixture.api,
    granted: new Set(['orders.view', 'printing.settings', 'preferences.local']),
    draft: dirtyDraft,
  })))

  let confirmed
  await act(async () => { confirmed = await fixture.api.current.confirmDiscard() })
  assert.equal(confirmed, false)
  assert.equal(fixture.api.current.activeTab, 'settings-printing')
  assert.deepEqual(fixture.discarded, [])
  assert.equal(fixture.feedback.length, 1)
})

test('discard and duplicate decisions perform one discard and one navigation intent', async (t) => {
  const fixture = await mountNavigation(t)
  await act(async () => fixture.api.current.requestNavigation('settings-printing'))
  await act(async () => {
    fixture.api.current.openMore()
    fixture.api.current.requestNavigation('clients')
    fixture.api.current.requestNavigation('clients')
  })
  assert.equal(fixture.api.current.moreOpen, false)
  const decide = fixture.api.current.confirmDiscard
  await act(async () => {
    decide()
    decide()
  })
  assert.equal(fixture.api.current.activeTab, 'clients')
  assert.deepEqual(fixture.discarded, ['operations'])
})

test('destinations in the same settings aggregate preserve the draft without confirmation', async (t) => {
  const draft = { ...dirtyDraft, destinations: new Set(['settings-printing', 'settings-device']) }
  const fixture = await mountNavigation(t, { draft })
  await act(async () => fixture.api.current.requestNavigation('settings-printing'))
  let navigated
  await act(async () => { navigated = await fixture.api.current.requestNavigation('settings-device') })
  assert.equal(navigated, true)
  assert.equal(fixture.api.current.activeTab, 'settings-device')
  assert.equal(fixture.api.current.pendingDestination, null)
  assert.deepEqual(fixture.discarded, [])
})

test('explicit settings cancellation discards once and navigates immediately', async (t) => {
  const fixture = await mountNavigation(t)
  await act(async () => fixture.api.current.requestNavigation('settings-printing'))

  let navigated
  await act(async () => { navigated = fixture.api.current.discardSettingsAndNavigate('clients') })

  assert.equal(navigated, true)
  assert.equal(fixture.api.current.activeTab, 'clients')
  assert.equal(fixture.api.current.pendingDestination, null)
  assert.deepEqual(fixture.discarded, ['operations'])
})

test('saving or unconfirmed settings commitments can navigate without discard or another write decision', async (t) => {
  for (const status of ['saving', 'unconfirmed']) {
    const fixture = await mountNavigation(t, { draft: { ...dirtyDraft, status } })
    await act(async () => fixture.api.current.requestNavigation('settings-printing'))
    let navigated
    await act(async () => { navigated = await fixture.api.current.requestNavigation('clients') })
    assert.equal(navigated, true)
    assert.equal(fixture.api.current.activeTab, 'clients')
    assert.equal(fixture.api.current.pendingDestination, null)
    assert.deepEqual(fixture.discarded, [])
  }
})

test('beforeunload risk exists only for dirty drafts or relevant pending commitments', async (t) => {
  const h = await workspaceHarness(t)
  const { hasSettingsUnloadRisk } = await h.load('/src/app/useNavigationController.js')
  assert.equal(hasSettingsUnloadRisk({ operations: { dirty: false, status: 'ready' } }), false)
  assert.equal(hasSettingsUnloadRisk({ operations: { dirty: true, status: 'ready' } }), true)
  assert.equal(hasSettingsUnloadRisk({ operations: { dirty: false, status: 'saving' } }), true)
  assert.equal(hasSettingsUnloadRisk({ operations: { dirty: false, status: 'unconfirmed' } }), true)
})
