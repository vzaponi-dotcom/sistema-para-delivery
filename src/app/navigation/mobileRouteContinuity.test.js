import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'
import { RouterProvider } from 'react-router'

import { workspaceHarness } from '../../test-support/renderWorkspace.js'

const implemented = new Set([
  'orders', 'history', 'new-order', 'comandas', 'print-queue',
  'dashboard', 'receivables', 'finance', 'clients', 'products', 'tables',
  'settings-home', 'settings-operations', 'settings-modalities',
  'settings-payments', 'settings-cancellations', 'settings-finance-categories',
  'settings-kitchen-tv', 'settings-printing', 'settings-device',
])

test('Task 6 RED: More closes when a clean route change happens outside requestNavigation', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
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
    return React.createElement('output', null, `${navigation.activeTab}:${navigation.moreOpen}`)
  }

  const router = createAdminMemoryRouter({
    rootElement: React.createElement(Probe),
    initialEntries: ['/pedidos'],
  })
  const renderer = await h.render(RouterProvider, { router })

  await act(async () => api.current.openMore())
  assert.equal(renderer.root.findByType('output').children.join(''), 'orders:true')

  await act(async () => { await router.navigate('/clientes') })

  assert.equal(router.state.location.pathname, '/clientes')
  assert.equal(renderer.root.findByType('output').children.join(''), 'clients:false')
})
