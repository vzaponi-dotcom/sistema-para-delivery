import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const implemented = new Set([
  'orders', 'history', 'new-order', 'comandas', 'print-queue', 'dashboard',
  'receivables', 'finance', 'clients', 'products', 'tables',
  'settings-printing', 'settings-device',
])

const granted = new Set([
  'orders.view', 'orders.history', 'orders.create', 'comandas.view',
  'printing.queue', 'finance.overview', 'finance.receivables',
  'finance.movements', 'clients.view', 'products.view', 'tables.view',
  'printing.settings', 'preferences.local',
])

const navButtons = (root, label) => root.findByProps({ 'aria-label': label }).findAllByType('button')

test('sidebar exibe somente grupos e destinos aprovados, omitindo grupos vazios', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Sidebar } = await h.load('/src/components/Sidebar.jsx')
  const renderer = await h.render(Sidebar, { activeTab: 'history', granted, implemented, onNavigate() {} })
  const nav = renderer.root.findByProps({ 'aria-label': 'Menu principal' })
  const text = nodeText(nav)
  for (const group of ['OPERAÇÃO', 'FINANCEIRO', 'CADASTROS', 'CONFIGURAÇÕES']) assert.match(text, new RegExp(group))
  assert.deepEqual(nav.findAllByType('button').map(nodeText), [
    'Pedidos', 'Comandas', 'Fila de impressão', 'Visão geral', 'A receber',
    'Movimentações', 'Clientes', 'Produtos e preços', 'Mesas', 'Configurações',
  ])
  assert.equal(buttonNamed(nav, 'Pedidos').props['aria-current'], 'page')

  const reduced = await h.render(Sidebar, {
    activeTab: 'clients', granted: new Set(['clients.view']), implemented, onNavigate() {},
  })
  const reducedText = nodeText(reduced.root.findByProps({ 'aria-label': 'Menu principal' }))
  assert.doesNotMatch(reducedText, /OPERAÇÃO|FINANCEIRO|CONFIGURAÇÕES/)
  assert.match(reducedText, /CADASTROS/)
})

test('mobile tem quatro itens, ou três sem Financeiro, e usa fallback de área', async (t) => {
  const h = await workspaceHarness(t)
  const { default: MobileNavigation } = await h.load('/src/components/MobileNavigation.jsx')
  const calls = []
  const renderer = await h.render(MobileNavigation, {
    activeTab: 'receivables', granted, implemented, moreOpen: false,
    onOpenMore() {}, onCloseMore() {}, onNavigate: (id) => calls.push(id),
  })
  assert.deepEqual(navButtons(renderer.root, 'Navegação principal').map(nodeText), ['Pedidos', 'Comandas', 'Financeiro', 'Mais'])
  assert.equal(buttonNamed(renderer.root, 'Financeiro').props['aria-current'], 'page')

  await act(async () => buttonNamed(renderer.root, 'Financeiro').props.onClick())
  assert.deepEqual(calls, ['dashboard'])

  await act(async () => renderer.update(React.createElement(MobileNavigation, {
    activeTab: 'orders', granted: new Set(['orders.view', 'comandas.view']), implemented,
    moreOpen: false, onOpenMore() {}, onCloseMore() {}, onNavigate: (id) => calls.push(id),
  })))
  assert.deepEqual(navButtons(renderer.root, 'Navegação principal').map(nodeText), ['Pedidos', 'Comandas', 'Mais'])

  await act(async () => renderer.update(React.createElement(MobileNavigation, {
    activeTab: 'orders', granted: new Set(['orders.view', 'comandas.view', 'finance.receivables']), implemented,
    moreOpen: false, onOpenMore() {}, onCloseMore() {}, onNavigate: (id) => calls.push(id),
  })))
  await act(async () => buttonNamed(renderer.root, 'Financeiro').props.onClick())
  assert.equal(calls.at(-1), 'receivables')
})

test('destino financeiro explícito negado não faz fallback', async (t) => {
  const h = await workspaceHarness(t)
  const { useNavigationController } = await h.load('/src/app/useNavigationController.js')
  const api = React.createRef()
  const feedback = []
  const Probe = React.forwardRef(function Probe(_props, ref) {
    const controller = useNavigationController({
      granted: new Set(['orders.view', 'finance.receivables']), implemented,
      checkoutPending: false, dirtyOrder: false, onFeedback: (message) => feedback.push(message),
    })
    React.useImperativeHandle(ref, () => controller, [controller])
    return React.createElement('output', null, controller.activeTab)
  })
  await h.render(Probe, { ref: api })
  await act(async () => api.current.requestNavigation('dashboard'))
  assert.equal(api.current.activeTab, 'orders')
  assert.equal(feedback.length, 1)
})

test('AreaNavigation filtra capacidades e usa semântica de navegação por botões', async (t) => {
  const h = await workspaceHarness(t)
  const { default: AreaNavigation } = await h.load('/src/components/AreaNavigation.jsx')
  const calls = []
  const renderer = await h.render(AreaNavigation, {
    area: 'orders', activeTab: 'orders',
    granted: new Set(['orders.view']), implemented, onNavigate: (id) => calls.push(id),
  })
  const nav = renderer.root.findByProps({ 'aria-label': 'Navegação de Pedidos' })
  assert.ok(buttonNamed(nav, 'Cozinha'))
  assert.equal(buttonNamed(nav, 'Histórico'), undefined)
  assert.equal(buttonNamed(nav, 'Cozinha').props.type, 'button')
  assert.equal(buttonNamed(nav, 'Cozinha').props['aria-current'], 'page')
  assert.equal(nav.props.role, undefined)
  await act(async () => buttonNamed(nav, 'Cozinha').props.onFocus?.())
  assert.deepEqual(calls, [])
  await act(async () => buttonNamed(nav, 'Cozinha').props.onClick())
  assert.deepEqual(calls, ['orders'])
})

test('AreaNavigation destaca Histórico, Financeiro e Configurações corretamente', async (t) => {
  const h = await workspaceHarness(t)
  const { default: AreaNavigation } = await h.load('/src/components/AreaNavigation.jsx')
  for (const [area, activeTab, label, ariaLabel] of [
    ['orders', 'history', 'Histórico', 'Navegação de Pedidos'],
    ['finance', 'finance', 'Movimentações', 'Navegação de Financeiro'],
    ['settings', 'settings-device', 'Preferências deste dispositivo', 'Navegação de Configurações'],
  ]) {
    const renderer = await h.render(AreaNavigation, { area, activeTab, granted, implemented, onNavigate() {} })
    const nav = renderer.root.findByProps({ 'aria-label': ariaLabel })
    assert.equal(buttonNamed(nav, label).props['aria-current'], 'page')
    assert.equal(nav.findAllByProps({ 'aria-current': 'page' }).length, 1)
  }
})

test('Mais contém somente destinos aprovados e fecha antes de confirmar descarte', async (t) => {
  const h = await workspaceHarness(t)
  const { default: MobileNavigation } = await h.load('/src/components/MobileNavigation.jsx')
  let open = true
  const events = []
  const renderer = await h.render(MobileNavigation, {
    activeTab: 'new-order', granted, implemented, moreOpen: open,
    onOpenMore() { open = true }, onCloseMore() { events.push('close'); open = false },
    onNavigate(id) { events.push(`navigate:${id}`) }, onLogout() {},
  })
  const dialog = renderer.root.findByProps({ role: 'dialog' })
  const labels = dialog.findAllByType('button').map(nodeText).filter(Boolean)
  for (const label of ['Fila de impressão', 'Clientes', 'Produtos e preços', 'Mesas', 'Configurações', 'Sair']) assert.ok(labels.includes(label), label)
  for (const label of ['Histórico', 'Visão geral', 'A receber', 'Movimentações']) assert.equal(labels.includes(label), false, label)
  await act(async () => buttonNamed(dialog, 'Clientes').props.onClick())
  assert.deepEqual(events, ['navigate:clients'])
})

test('controlador fecha Mais antes da confirmação, cancela preservando e confirma uma vez', async (t) => {
  const h = await workspaceHarness(t)
  const { useNavigationController } = await h.load('/src/app/useNavigationController.js')
  const api = React.createRef()
  let dirty = true
  let discards = 0
  const Probe = React.forwardRef(function Probe({ checkoutPending = false }, ref) {
    const controller = useNavigationController({
      granted: new Set(['orders.create', 'clients.view']), implemented,
      checkoutPending, dirtyOrder: dirty,
      onDiscardOrder() { discards += 1; dirty = false }, onFeedback() {},
    })
    React.useImperativeHandle(ref, () => controller, [controller])
    return React.createElement('output', null, `${controller.activeTab}:${controller.moreOpen}:${controller.pendingDestination || ''}`)
  })
  const renderer = await h.render(Probe, { ref: api })
  await act(async () => api.current.completeNavigation('new-order'))
  await act(async () => api.current.openMore())
  await act(async () => api.current.requestNavigation('clients'))
  assert.equal(api.current.moreOpen, false)
  assert.equal(api.current.pendingDestination, 'clients')
  await act(async () => api.current.cancelDiscard())
  assert.equal(api.current.activeTab, 'new-order')
  assert.equal(discards, 0)

  await act(async () => api.current.requestNavigation('clients'))
  await act(async () => api.current.confirmDiscard())
  await act(async () => api.current.confirmDiscard())
  assert.equal(api.current.activeTab, 'clients')
  assert.equal(discards, 1)

  dirty = true
  await act(async () => renderer.update(React.createElement(Probe, { ref: api, checkoutPending: true })))
  await act(async () => api.current.completeNavigation('new-order'))
  await act(async () => api.current.requestNavigation('clients'))
  assert.equal(api.current.pendingDestination, null)
})

test('destino revogado antes da confirmação não descarta o rascunho', async (t) => {
  const h = await workspaceHarness(t)
  const { useNavigationController } = await h.load('/src/app/useNavigationController.js')
  const api = React.createRef()
  let discards = 0
  const Probe = React.forwardRef(function Probe({ caps }, ref) {
    const controller = useNavigationController({
      granted: caps, implemented, checkoutPending: false, dirtyOrder: true,
      onDiscardOrder() { discards += 1 }, onFeedback() {},
    })
    React.useImperativeHandle(ref, () => controller, [controller])
    return React.createElement('output', null, controller.activeTab)
  })
  const renderer = await h.render(Probe, { ref: api, caps: new Set(['orders.create', 'clients.view']) })
  await act(async () => api.current.completeNavigation('new-order'))
  await act(async () => api.current.requestNavigation('clients'))
  await act(async () => renderer.update(React.createElement(Probe, { ref: api, caps: new Set(['orders.create']) })))
  await act(async () => api.current.confirmDiscard())
  assert.equal(discards, 0)
  assert.equal(api.current.pendingDestination, null)
})
