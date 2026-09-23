import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'
import { RouterProvider, useLocation } from 'react-router'

import { workspaceHarness } from '../../test-support/renderWorkspace.js'

const implemented = new Set([
  'orders', 'history', 'new-order', 'comandas', 'print-queue',
  'dashboard', 'receivables', 'finance', 'clients', 'products', 'tables',
  'settings-home', 'settings-operations', 'settings-modalities',
  'settings-payments', 'settings-cancellations', 'settings-finance-categories',
  'settings-kitchen-tv', 'settings-printing', 'settings-device',
])

const full = new Set([
  'orders.view', 'orders.history', 'orders.create',
  'finance.overview', 'finance.receivables', 'finance.movements',
  'clients.view', 'operations.settings.view',
])

async function mountGate(t, {
  initialPath,
  ready = false,
  granted = full,
} = {}) {
  const h = await workspaceHarness(t)
  const [{ createAdminMemoryRouter }, { useRouteGate }] = await Promise.all([
    h.load('/src/app/navigation/adminRouter.jsx'),
    h.load('/src/app/navigation/useRouteGate.js'),
  ])
  const api = React.createRef()
  const feedback = []

  function Probe({ gateReady, capabilities }) {
    useRouteGate({
      ready: gateReady,
      granted: capabilities,
      implemented,
      onFeedback: (message) => feedback.push(message),
    })
    const location = useLocation()
    api.current = { pathname: location.pathname }
    return React.createElement('output', null, location.pathname)
  }

  let setProps
  function Host() {
    const [props, update] = React.useState({ gateReady: ready, capabilities: granted })
    setProps = update
    return React.createElement(Probe, props)
  }

  const router = createAdminMemoryRouter({
    rootElement: React.createElement(Host),
    initialEntries: [initialPath],
  })
  const renderer = await h.render(RouterProvider, { router })
  const update = async (next) => act(async () => setProps((current) => ({ ...current, ...next })))
  return { h, router, renderer, api, feedback, update }
}

test('Task 4 RED: root resolves to capability-aware home only when route context is ready', async (t) => {
  const fixture = await mountGate(t, { initialPath: '/', ready: false, granted: new Set(['orders.view']) })
  assert.equal(fixture.router.state.location.pathname, '/')
  await fixture.update({ gateReady: true })
  assert.equal(fixture.router.state.location.pathname, '/pedidos')
  assert.equal(fixture.feedback.length, 0)
})

test('Task 4 RED: allowed deep link survives login/bootstrap readiness', async (t) => {
  const fixture = await mountGate(t, {
    initialPath: '/financeiro/a-receber',
    ready: false,
    granted: new Set(['finance.receivables']),
  })
  assert.equal(fixture.router.state.location.pathname, '/financeiro/a-receber')
  await fixture.update({ gateReady: true })
  assert.equal(fixture.router.state.location.pathname, '/financeiro/a-receber')
  assert.equal(fixture.feedback.length, 0)
})

test('Task 4 RED: area root falls back inside the same area when its canonical destination is denied', async (t) => {
  const orders = await mountGate(t, {
    initialPath: '/pedidos',
    ready: true,
    granted: new Set(['orders.history']),
  })
  assert.equal(orders.router.state.location.pathname, '/pedidos/historico')

  const finance = await mountGate(t, {
    initialPath: '/financeiro',
    ready: true,
    granted: new Set(['finance.movements']),
  })
  assert.equal(finance.router.state.location.pathname, '/financeiro/movimentacoes')
})

test('Task 4 RED: denied and unknown routes replace to safe home without rendering them as current location', async (t) => {
  const denied = await mountGate(t, {
    initialPath: '/clientes',
    ready: true,
    granted: new Set(['orders.view']),
  })
  assert.equal(denied.router.state.location.pathname, '/pedidos')
  assert.equal(denied.feedback.at(-1), 'Você não tem acesso a este destino.')

  const unknown = await mountGate(t, {
    initialPath: '/rota-inexistente',
    ready: true,
    granted: new Set(['orders.view']),
  })
  assert.equal(unknown.router.state.location.pathname, '/pedidos')
  assert.equal(unknown.feedback.at(-1), 'Destino desconhecido.')
})

test('Task 4 RED: a route becoming denied is corrected with replace semantics', async (t) => {
  const fixture = await mountGate(t, {
    initialPath: '/clientes',
    ready: true,
    granted: new Set(['clients.view', 'orders.view']),
  })
  assert.equal(fixture.router.state.location.pathname, '/clientes')
  await fixture.update({ capabilities: new Set(['orders.view']) })
  assert.equal(fixture.router.state.location.pathname, '/pedidos')
})

test('Task 4 RED: session navigation reset targets root instead of resurrecting the previous home', async (t) => {
  const h = await workspaceHarness(t)
  const [{ createAdminMemoryRouter }, { useNavigationController }] = await Promise.all([
    h.load('/src/app/navigation/adminRouter.jsx'),
    h.load('/src/app/navigation/useNavigationController.js'),
  ])
  const api = React.createRef()

  function Probe() {
    const navigation = useNavigationController({
      granted: new Set(['orders.view', 'clients.view']),
      implemented,
      checkoutPending: false,
      dirtyOrder: false,
      onFeedback() {},
    })
    api.current = navigation
    return null
  }

  const router = createAdminMemoryRouter({
    rootElement: React.createElement(Probe),
    initialEntries: ['/clientes'],
  })
  await h.render(RouterProvider, { router })
  await act(async () => api.current.resetNavigation())
  assert.equal(router.state.location.pathname, '/')
})
