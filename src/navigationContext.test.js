import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { buttonNamed, workspaceHarness } from './test-support/renderWorkspace.js'

const implemented = new Set([
  'orders',
  'history',
  'new-order',
  'comandas',
  'print-queue',
  'dashboard',
  'receivables',
  'finance',
  'clients',
  'products',
  'tables',
])

test('query hook preserva filtros ao navegar e reset de sessão invalida callback antigo', async (t) => {
  const h = await workspaceHarness(t)
  const { useQueryContext } = await h.load('/src/app/useQueryContext.js')
  const api = React.createRef()

  const Probe = React.forwardRef(function Probe(_props, ref) {
    const current = useQueryContext()
    React.useImperativeHandle(ref, () => current, [current])
    return React.createElement('output', null, current.query.orders.search)
  })

  const renderer = await h.render(Probe, { ref: api })
  const stalePatch = api.current.patchQuery
  await act(async () => api.current.patchQuery('orders', { search: 'maria' }))
  assert.equal(renderer.root.findByType('output').children.join(''), 'maria')

  await act(async () => api.current.resetQueries())
  assert.equal(renderer.root.findByType('output').children.join(''), '')
  await act(async () => stalePatch('orders', { search: 'sessão anterior' }))
  assert.equal(renderer.root.findByType('output').children.join(''), '')
})

test('controlador usa A1 para negar destino explícito desconhecido ou sem capacidade', async (t) => {
  const h = await workspaceHarness(t)
  const { useNavigationController } = await h.load('/src/app/useNavigationController.js')
  const feedback = []
  const api = React.createRef()

  const Probe = React.forwardRef(function Probe(_props, ref) {
    const current = useNavigationController({
      granted: new Set(['orders.view']),
      implemented,
      checkoutPending: false,
      dirtyOrder: false,
      onDiscardOrder() {},
      onFeedback: (message) => feedback.push(message),
    })
    React.useImperativeHandle(ref, () => current, [current])
    return React.createElement('output', null, current.activeTab)
  })

  const renderer = await h.render(Probe, { ref: api })
  assert.equal(renderer.root.findByType('output').children.join(''), 'orders')
  await act(async () => api.current.requestNavigation('dashboard'))
  await act(async () => api.current.requestNavigation('future-page'))

  assert.equal(renderer.root.findByType('output').children.join(''), 'orders')
  assert.equal(feedback.length, 2)
})

test('checkout bloqueia e pedido sujo exige confirmação antes de navegar', async (t) => {
  const h = await workspaceHarness(t)
  const { useNavigationController } = await h.load('/src/app/useNavigationController.js')
  const discarded = []
  const api = React.createRef()

  const Probe = React.forwardRef(function Probe({ checkoutPending, dirtyOrder }, ref) {
    const current = useNavigationController({
      granted: new Set(['orders.view', 'orders.create', 'clients.view']),
      implemented,
      checkoutPending,
      dirtyOrder,
      onDiscardOrder: () => discarded.push('discarded'),
      onFeedback() {},
    })
    React.useImperativeHandle(ref, () => current, [current])
    return React.createElement('output', null, `${current.activeTab}:${current.pendingDestination || ''}`)
  })

  const renderer = await h.render(Probe, { ref: api, checkoutPending: true, dirtyOrder: true })
  await act(async () => api.current.requestNavigation('clients'))
  assert.equal(renderer.root.findByType('output').children.join(''), 'orders:')

  await act(async () => renderer.update(React.createElement(Probe, { ref: api, checkoutPending: false, dirtyOrder: true })))
  await act(async () => api.current.requestNavigation('new-order'))
  await act(async () => api.current.requestNavigation('clients'))
  assert.equal(renderer.root.findByType('output').children.join(''), 'new-order:clients')
  assert.deepEqual(discarded, [])

  await act(async () => api.current.confirmDiscard())
  assert.equal(renderer.root.findByType('output').children.join(''), 'clients:')
  assert.deepEqual(discarded, ['discarded'])
})

test('completeNavigation valida destino e não descarta pedido já salvo', async (t) => {
  const h = await workspaceHarness(t)
  const { useNavigationController } = await h.load('/src/app/useNavigationController.js')
  const discarded = []
  const api = React.createRef()

  const Probe = React.forwardRef(function Probe(_props, ref) {
    const current = useNavigationController({
      granted: new Set(['orders.view', 'orders.create']),
      implemented,
      checkoutPending: false,
      dirtyOrder: true,
      onDiscardOrder: () => discarded.push('discarded'),
      onFeedback() {},
    })
    React.useImperativeHandle(ref, () => current, [current])
    return React.createElement('output', null, current.activeTab)
  })

  const renderer = await h.render(Probe, { ref: api })
  await act(async () => api.current.requestNavigation('new-order'))
  await act(async () => api.current.completeNavigation('orders'))

  assert.equal(renderer.root.findByType('output').children.join(''), 'orders')
  assert.deepEqual(discarded, [])
})

test('App preserva consulta ao navegar e nova sessão rejeita callback da sessão anterior', async (t) => {
  const h = await workspaceHarness(t)
  globalThis.fetch = async (path) => {
    const responses = {
      '/api/auth/session': { authenticated: true },
      '/api/auth/logout': {},
      '/api/auth/login': {},
      '/api/bootstrap': { tables: [], tableTabs: [], orders: [], clients: [], products: [], movements: [], financeSettings: null },
      '/api/printing/stations': { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] },
      '/api/printing/jobs?limit=100': { jobs: [] },
    }
    assert.ok(Object.hasOwn(responses, path), `Unexpected request: ${path}`)
    return { ok: true, json: async () => responses[path] }
  }

  const { default: App } = await h.load('/src/App.jsx')
  const renderer = await h.render(App)
  const navigation = () => renderer.root.findByProps({ 'aria-label': 'Menu principal' })
  const kitchenSearch = () => renderer.root.findByProps({ placeholder: 'Buscar cliente, pedido, produto ou tipo' })

  const staleChange = kitchenSearch().props.onChange
  await act(async () => staleChange({ target: { value: 'maria' } }))
  await act(async () => buttonNamed(navigation(), 'Clientes').props.onClick())
  await act(async () => buttonNamed(navigation(), 'Pedidos').props.onClick())
  assert.equal(kitchenSearch().props.value, 'maria')

  await act(async () => buttonNamed(renderer.root, 'Sair do sistema').props.onClick())
  const pin = renderer.root.findByProps({ placeholder: 'Digite o PIN' })
  await act(async () => pin.props.onChange({ target: { value: '1234' } }))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.equal(kitchenSearch().props.value, '')

  await act(async () => staleChange({ target: { value: 'sessão anterior' } }))
  assert.equal(kitchenSearch().props.value, '')
})
