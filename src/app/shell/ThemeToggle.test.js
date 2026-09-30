import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed, nodeText } from '../../test-support/renderWorkspace.js'

async function setup(t, { mobile = false, preference = 'light', allowed = true } = {}) {
  const h = await workspaceHarness(t, { mobile })
  h.document.documentElement.dataset = {}
  h.localStorage.setItem('delivery-theme', preference)
  const { ThemeProvider } = await h.load('/src/app/shell/theme/ThemeProvider.jsx')
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AppTopBar } = await h.load('/src/app/shell/AppTopBar.jsx')
  const render = () => h.render(ThemeProvider, { children: React.createElement(NavigationProvider, {
    activeTab: 'comandas', granted: new Set(allowed ? ['preferences.local'] : []), implemented: new Set(['comandas', 'settings-device']),
  }, React.createElement(AppTopBar, { businessName: 'Mesiva' })) })
  return { h, render, r: await render() }
}

for (const mobile of [false, true]) test(`topbar theme toggle persists the global theme and survives remount (${mobile ? 'mobile' : 'desktop'})`, async (t) => {
  const { h, render, r } = await setup(t, { mobile })
  await act(async () => buttonNamed(r.root, 'Ativar tema escuro').props.onClick())
  assert.equal(h.document.documentElement.dataset.theme, 'dark')
  assert.equal(h.localStorage.getItem('delivery-theme'), 'dark')
  assert.ok(buttonNamed(r.root, 'Ativar tema claro'))
  await act(async () => r.unmount())
  const remounted = await render()
  await act(async () => buttonNamed(remounted.root, 'Ativar tema claro').props.onClick())
  assert.equal(h.document.documentElement.dataset.theme, 'light')
  assert.equal(h.localStorage.getItem('delivery-theme'), 'light')
})

test('automatic theme uses the current OS color scheme and leaves automatic mode on explicit toggle', async (t) => {
  const { h, r } = await setup(t, { preference: 'system' })
  assert.ok(buttonNamed(r.root, 'Ativar tema escuro'))
  await act(async () => { h.media.matches = true; h.media.dispatchEvent(new Event('change')) })
  assert.ok(buttonNamed(r.root, 'Ativar tema claro'))
  await act(async () => buttonNamed(r.root, 'Ativar tema claro').props.onClick())
  assert.equal(h.localStorage.getItem('delivery-theme'), 'light')
  await act(async () => { h.media.matches = false; h.media.dispatchEvent(new Event('change')); h.media.matches = true; h.media.dispatchEvent(new Event('change')) })
  assert.equal(h.document.documentElement.dataset.theme, 'light')
  assert.ok(buttonNamed(r.root, 'Ativar tema escuro'))
})

test('failed preference persistence reports an error and retains the current theme', async (t) => {
  const { h, r } = await setup(t)
  const save = h.localStorage.setItem
  h.localStorage.setItem = () => { throw new Error('Quota exceeded') }
  await act(async () => buttonNamed(r.root, 'Ativar tema escuro').props.onClick())
  assert.equal(h.document.documentElement.dataset.theme, 'light')
  assert.match(nodeText(r.root.findByProps({ role: 'alert' })), /Não foi possível salvar/)
  h.localStorage.setItem = save
  await act(async () => buttonNamed(r.root, 'Ativar tema escuro').props.onClick())
  assert.equal(h.document.documentElement.dataset.theme, 'dark')
  assert.equal(r.root.findAllByProps({ role: 'alert' }).length, 0)
})

test('theme shortcut respects local preference capability', async (t) => {
  const { r } = await setup(t, { allowed: false })
  assert.equal(buttonNamed(r.root, 'Ativar tema escuro'), undefined)
  assert.equal(buttonNamed(r.root, 'Ativar tema claro'), undefined)
})
