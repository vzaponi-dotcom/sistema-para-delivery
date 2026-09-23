import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { readFile } from 'node:fs/promises'
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

const granted = new Set([
  'orders.view', 'orders.history', 'orders.create', 'comandas.view', 'printing.queue',
  'finance.overview', 'finance.receivables', 'finance.movements',
  'clients.view', 'products.view', 'tables.view',
  'operations.settings.view', 'payments.settings.view', 'orders.settings.view',
  'finance.categories.view', 'printing.settings', 'preferences.local',
])

test('Task 3 RED: matched URL is the navigation source of truth', async (t) => {
  const h = await workspaceHarness(t)
  const [{ createAdminMemoryRouter }, { useNavigationController }] = await Promise.all([
    h.load('/src/app/navigation/adminRouter.jsx'),
    h.load('/src/app/navigation/useNavigationController.js'),
  ])
  const api = React.createRef()

  function Probe() {
    const navigation = useNavigationController({
      granted,
      implemented,
      checkoutPending: false,
      dirtyOrder: false,
      onDiscardOrder() {},
      onFeedback() {},
    })
    const location = useLocation()
    api.current = navigation
    return React.createElement('output', null, `${navigation.activeTab}:${location.pathname}`)
  }

  const router = createAdminMemoryRouter({
    rootElement: React.createElement(Probe),
    initialEntries: ['/clientes'],
  })
  const renderer = await h.render(RouterProvider, { router })

  assert.equal(renderer.root.findByType('output').children.join(''), 'clients:/clientes')

  let navigated
  await act(async () => { navigated = api.current.requestNavigation('receivables') })
  assert.equal(navigated, true)
  assert.equal(router.state.location.pathname, '/financeiro/a-receber')
  assert.equal(renderer.root.findByType('output').children.join(''), 'receivables:/financeiro/a-receber')

  await act(async () => { navigated = api.current.requestNavigation({ area: 'orders' }) })
  assert.equal(navigated, true)
  assert.equal(router.state.location.pathname, '/pedidos')
  assert.equal(renderer.root.findByType('output').children.join(''), 'orders:/pedidos')

  await act(async () => { await router.navigate('/configuracoes/impressao') })
  assert.equal(renderer.root.findByType('output').children.join(''), 'settings-printing:/configuracoes/impressao')
})

test('Task 3 RED: controller no longer owns an independent activeTab state', async () => {
  const source = await readFile(new URL('./useNavigationController.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /setActiveTab/)
  assert.doesNotMatch(source, /useState\(\(\) => resolveHome/)
  assert.match(source, /pathForDestination/)
  assert.match(source, /useMatchedDestination/)
})
