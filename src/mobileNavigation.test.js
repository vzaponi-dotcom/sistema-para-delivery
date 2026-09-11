import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed } from './test-support/renderWorkspace.js'

test('Produtos opens from Mais, closes the sheet and keeps Mais current', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: MobileNavigation } = await harness.load('/src/components/MobileNavigation.jsx')
  function Navigation() {
    const [activeTab, onNavigate] = React.useState('dashboard')
    return React.createElement(MobileNavigation, { activeTab, onNavigate })
  }
  const renderer = await harness.render(Navigation)
  assert.ok(!buttonNamed(renderer.root.findByType('nav'), 'Produtos'), 'Produtos belongs in Mais')
  await act(async () => buttonNamed(renderer.root, 'Mais').props.onClick())
  const dialog = renderer.root.findByProps({ role: 'dialog' })
  for (const name of ['Produtos', 'Histórico', 'A Receber', 'Financeiro', 'Mesas']) assert.ok(buttonNamed(dialog, name), name)
  await act(async () => buttonNamed(dialog, 'Produtos').props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
  assert.equal(buttonNamed(renderer.root, 'Mais').props['aria-current'], 'page')
})

test('Mais preserves theme cycling, logout and closing without navigation', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: MobileNavigation } = await harness.load('/src/components/MobileNavigation.jsx')
  const { ThemeContext } = await harness.load('/src/components/themeContext.js')
  let logouts = 0
  function Navigation() {
    const [themePreference, setThemePreference] = React.useState('system')
    return React.createElement(ThemeContext.Provider, { value: { themePreference, setThemePreference } },
      React.createElement(MobileNavigation, { activeTab: 'comandas', onNavigate: () => assert.fail('unexpected navigation'), onLogout: () => logouts++ }))
  }
  const renderer = await harness.render(Navigation)
  await act(async () => buttonNamed(renderer.root, 'Mais').props.onClick())
  for (const label of ['Automático', 'Claro', 'Escuro']) {
    await act(async () => buttonNamed(renderer.root, `Tema atual: ${label}. Clique para alternar`).props.onClick())
  }
  assert.ok(buttonNamed(renderer.root, 'Tema atual: Automático. Clique para alternar'))
  await act(async () => buttonNamed(renderer.root, 'Sair do sistema').props.onClick())
  assert.equal(logouts, 1)
  await act(async () => buttonNamed(renderer.root, 'Fechar').props.onClick())
  assert.equal(buttonNamed(renderer.root, 'Mais').props['aria-expanded'], false)
})
