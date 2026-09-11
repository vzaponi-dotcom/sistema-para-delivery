import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed, nodeText } from './test-support/renderWorkspace.js'

const implemented = new Set(['orders', 'history', 'comandas', 'print-queue', 'dashboard', 'receivables', 'finance', 'clients', 'products', 'tables', 'settings-printing', 'settings-device'])
const granted = new Set(['orders.view', 'orders.history', 'comandas.view', 'printing.queue', 'finance.overview', 'finance.receivables', 'finance.movements', 'clients.view', 'products.view', 'tables.view', 'printing.settings', 'preferences.local'])

test('Produtos opens from Mais, closes the sheet and keeps Mais current', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: MobileNavigation } = await harness.load('/src/components/MobileNavigation.jsx')
  function Navigation() {
    const [activeTab, onNavigate] = React.useState('dashboard')
    const [moreOpen, setMoreOpen] = React.useState(false)
    const navigate = (id) => { onNavigate(id); setMoreOpen(false) }
    return React.createElement(MobileNavigation, { activeTab, granted, implemented, moreOpen, onOpenMore: () => setMoreOpen(true), onCloseMore: () => setMoreOpen(false), onNavigate: navigate })
  }
  const renderer = await harness.render(Navigation)
  assert.ok(!buttonNamed(renderer.root.findByType('nav'), 'Produtos'), 'Produtos belongs in Mais')
  await act(async () => buttonNamed(renderer.root, 'Mais').props.onClick())
  const dialog = renderer.root.findByProps({ role: 'dialog' })
  for (const name of ['Fila de impressão', 'Clientes', 'Produtos e preços', 'Mesas', 'Configurações']) assert.ok(buttonNamed(dialog, name), name)
  for (const name of ['Histórico', 'Visão geral', 'A receber', 'Movimentações']) assert.equal(buttonNamed(dialog, name), undefined, name)
  await act(async () => buttonNamed(dialog, 'Produtos e preços').props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
  assert.equal(buttonNamed(renderer.root, 'Mais').props['aria-current'], 'page')
})

test('Mais exposes Configurações and Sair, has no theme selector, and closes without navigation', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: MobileNavigation } = await harness.load('/src/components/MobileNavigation.jsx')
  let logouts = 0
  function Navigation() {
    const [moreOpen, setMoreOpen] = React.useState(false)
    return React.createElement(MobileNavigation, { activeTab: 'comandas', granted, implemented, moreOpen, onOpenMore: () => setMoreOpen(true), onCloseMore: () => setMoreOpen(false), onNavigate: () => assert.fail('unexpected navigation'), onLogout: () => logouts++ })
  }
  const renderer = await harness.render(Navigation)
  await act(async () => buttonNamed(renderer.root, 'Mais').props.onClick())
  const dialog = renderer.root.findByProps({ role: 'dialog' })
  assert.ok(buttonNamed(dialog, 'Configurações'))
  assert.doesNotMatch(nodeText(dialog), /Tema|Automático|Claro|Escuro/)
  await act(async () => buttonNamed(renderer.root, 'Sair').props.onClick())
  assert.equal(logouts, 1)
  await act(async () => buttonNamed(renderer.root, 'Fechar').props.onClick())
  assert.equal(buttonNamed(renderer.root, 'Mais').props['aria-expanded'], false)
})
