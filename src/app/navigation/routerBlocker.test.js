import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'

import { workspaceHarness } from '../../test-support/renderWorkspace.js'

const implemented = new Set([
  'orders', 'history', 'new-order', 'comandas', 'print-queue',
  'dashboard', 'receivables', 'finance', 'clients', 'products', 'tables',
  'settings-home', 'settings-operations', 'settings-modalities',
  'settings-payments', 'settings-cancellations', 'settings-finance-categories',
  'settings-kitchen-tv', 'settings-printing', 'settings-device',
])

async function mountController(t, {
  initialEntries,
  initialIndex,
  granted,
  dirtyOrder = false,
  checkoutPending = false,
  draft = null,
} = {}) {
  const h = await workspaceHarness(t)
  const { useNavigationController } = await h.load('/src/app/navigation/useNavigationController.js')
  const api = React.createRef()
  const discardedOrders = []
  const discardedPolicies = []
  const feedback = []

  const Probe = React.forwardRef(function Probe(props, ref) {
    const navigation = useNavigationController({
      granted: props.granted,
      implemented,
      checkoutPending: props.checkoutPending,
      dirtyOrder: props.dirtyOrder,
      onDiscardOrder: () => discardedOrders.push('order'),
      getNavigationDraft: () => props.draft,
      discardNavigationDraft: (resourceKey) => {
        discardedPolicies.push(resourceKey)
        return true
      },
      onFeedback: (message) => feedback.push(message),
    })
    React.useImperativeHandle(ref, () => navigation, [navigation])
    return React.createElement(
      'output',
      null,
      `${navigation.activeTab}:${navigation.pendingDestination || ''}:${navigation.pendingDiscardKind || ''}`,
    )
  })

  const { renderer, router, updateApp } = await h.renderAdminApp(Probe, {
    ref: api,
    granted,
    dirtyOrder,
    checkoutPending,
    draft,
  }, {
    initialEntries,
    initialIndex,
  })

  return {
    h,
    api,
    renderer,
    router,
    updateApp,
    Probe,
    discardedOrders,
    discardedPolicies,
    feedback,
  }
}

test('Task 5 RED: browser Back from dirty New Order blocks, cancels, then confirms exactly once', async (t) => {
  const fixture = await mountController(t, {
    initialEntries: ['/pedidos', '/pedidos/novo'],
    initialIndex: 1,
    granted: new Set(['orders.view', 'orders.create', 'clients.view']),
    dirtyOrder: true,
  })

  await act(async () => { await fixture.router.navigate(-1) })

  assert.equal(fixture.router.state.location.pathname, '/pedidos/novo')
  assert.equal(fixture.api.current.pendingDestination, 'orders')
  assert.equal(fixture.api.current.pendingDiscardKind, 'order')

  const firstPending = fixture.api.current.pendingDestination
  let secondIntent
  await act(async () => { secondIntent = fixture.api.current.requestNavigation('clients') })
  assert.equal(secondIntent, false)
  assert.equal(fixture.api.current.pendingDestination, firstPending)

  await act(async () => fixture.api.current.cancelDiscard())
  assert.equal(fixture.router.state.location.pathname, '/pedidos/novo')
  assert.equal(fixture.api.current.pendingDestination, null)
  assert.deepEqual(fixture.discardedOrders, [])

  await act(async () => { await fixture.router.navigate(-1) })
  await act(async () => fixture.api.current.confirmDiscard())

  assert.equal(fixture.router.state.location.pathname, '/pedidos')
  assert.deepEqual(fixture.discardedOrders, ['order'])
})

test('Task 5 RED: checkout pending blocks browser history without opening discard modal', async (t) => {
  const fixture = await mountController(t, {
    initialEntries: ['/pedidos', '/pedidos/novo'],
    initialIndex: 1,
    granted: new Set(['orders.view', 'orders.create']),
    dirtyOrder: true,
    checkoutPending: true,
  })

  await act(async () => { await fixture.router.navigate(-1) })

  assert.equal(fixture.router.state.location.pathname, '/pedidos/novo')
  assert.equal(fixture.api.current.pendingDestination, null)
  assert.equal(fixture.feedback.at(-1), 'Aguarde o envio do pedido antes de navegar.')
})

test('Task 5 RED: direct Router navigation obeys Settings same-resource and leave-resource guard', async (t) => {
  const draft = {
    resourceKey: 'printingPolicy',
    dirty: true,
    status: 'ready',
    destinations: new Set(['settings-printing', 'settings-device']),
  }
  const fixture = await mountController(t, {
    initialEntries: ['/configuracoes/impressao'],
    granted: new Set(['printing.settings', 'preferences.local', 'clients.view', 'orders.view']),
    draft,
  })

  await act(async () => { await fixture.router.navigate('/configuracoes/dispositivo') })
  assert.equal(fixture.router.state.location.pathname, '/configuracoes/dispositivo')
  assert.equal(fixture.api.current.pendingDestination, null)

  await act(async () => { await fixture.router.navigate('/clientes') })
  assert.equal(fixture.router.state.location.pathname, '/configuracoes/dispositivo')
  assert.equal(fixture.api.current.pendingDestination, 'clients')
  assert.equal(fixture.api.current.pendingDiscardKind, 'policy')

  await act(async () => fixture.api.current.cancelDiscard())
  assert.equal(fixture.router.state.location.pathname, '/configuracoes/dispositivo')
  assert.deepEqual(fixture.discardedPolicies, [])
})

test('Task 5 RED: blocked destination is revalidated before discard and never proceeds after capability revoke', async (t) => {
  const draft = {
    resourceKey: 'printingPolicy',
    dirty: true,
    status: 'ready',
    destinations: new Set(['settings-printing']),
  }
  const fixture = await mountController(t, {
    initialEntries: ['/configuracoes/impressao'],
    granted: new Set(['printing.settings', 'clients.view', 'orders.view']),
    draft,
  })

  await act(async () => { await fixture.router.navigate('/clientes') })
  assert.equal(fixture.api.current.pendingDestination, 'clients')

  await fixture.updateApp({
    ref: fixture.api,
    granted: new Set(['printing.settings', 'orders.view']),
    dirtyOrder: false,
    checkoutPending: false,
    draft,
  })

  let confirmed
  await act(async () => { confirmed = fixture.api.current.confirmDiscard() })

  assert.equal(confirmed, false)
  assert.equal(fixture.router.state.location.pathname, '/configuracoes/impressao')
  assert.deepEqual(fixture.discardedPolicies, [])
  assert.equal(fixture.feedback.at(-1), 'Você não tem acesso a este destino.')
})

test('Task 5 RED: successful completion bypasses dirty-order blocker after commit', async (t) => {
  const fixture = await mountController(t, {
    initialEntries: ['/pedidos/novo'],
    granted: new Set(['orders.view', 'orders.create']),
    dirtyOrder: true,
  })

  let completed
  await act(async () => { completed = fixture.api.current.completeNavigation('orders') })

  assert.equal(completed, true)
  assert.equal(fixture.router.state.location.pathname, '/pedidos')
  assert.equal(fixture.api.current.pendingDestination, null)
  assert.deepEqual(fixture.discardedOrders, [])
})
