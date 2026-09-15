import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { buttonNamed, nodeText, workspaceHarness } from './test-support/renderWorkspace.js'
import { saveThemePreference } from './utils/theme.js'

test('theme persistence reports a storage failure instead of returning a successful value', () => {
  const storage = { setItem() { throw new Error('blocked') } }
  assert.throws(() => saveThemePreference('dark', storage), /blocked/)
})

test('device page offers only light dark automatic and sound without any settings API write', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  const [{ default: Settings }, { ThemeProvider }] = await Promise.all([
    h.load('/src/pages/Settings.jsx'),
    h.load('/src/components/ThemeProvider.jsx'),
  ])
  let sound = true
  let settingsCalls = 0
  globalThis.fetch = async () => { settingsCalls += 1; throw new Error('device preferences must not use settings API') }
  const DevicePage = () => React.createElement(ThemeProvider, null,
    React.createElement(Settings, {
      section: 'settings-device', granted: new Set(['preferences.local']), implemented: new Set(['settings-device']),
      onNavigate() {}, soundEnabled: sound,
      onSoundEnabledChange(value) { sound = value; h.localStorage.setItem('kitchen-sound-enabled', String(value)); return true },
    }))
  const screen = await h.render(DevicePage)
  const group = screen.root.findByProps({ 'aria-label': 'Tema do sistema' })
  assert.deepEqual(group.findAllByType('button').map((button) => nodeText(button)), ['Claro', 'Escuro', 'Automático'])
  await act(async () => buttonNamed(group, 'Escuro').props.onClick())
  assert.equal(h.localStorage.getItem('delivery-theme'), 'dark')
  await act(async () => screen.root.findByProps({ role: 'switch', 'aria-label': 'Som de novos pedidos' }).props.onClick())
  assert.equal(h.localStorage.getItem('kitchen-sound-enabled'), 'false')
  assert.equal(settingsCalls, 0)
})

test('device page presents the approved local-preferences layout and confirms successful autosave', async (t) => {
  const h = await workspaceHarness(t, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
  })
  h.document.documentElement.dataset = {}
  const [{ default: Settings }, { ThemeProvider }] = await Promise.all([
    h.load('/src/pages/Settings.jsx'),
    h.load('/src/components/ThemeProvider.jsx'),
  ])
  let navigated = null
  let sound = true
  const DevicePage = () => React.createElement(ThemeProvider, null,
    React.createElement(Settings, {
      section: 'settings-device', granted: new Set(['preferences.local']), implemented: new Set(['settings-device']),
      onNavigate(value) { navigated = value }, soundEnabled: sound,
      onSoundEnabledChange(value) { sound = value; h.localStorage.setItem('kitchen-sound-enabled', String(value)); return true },
    }))
  const screen = await h.render(DevicePage)
  const text = nodeText(screen.root)
  assert.match(text, /Preferências deste dispositivo/)
  assert.match(text, /Aparência/)
  assert.match(text, /Avisos da cozinha/)
  assert.match(text, /Informações locais/)
  assert.match(text, /Google Chrome 140/)
  assert.match(text, /Uso aproximado/)
  assert.match(text, /Última alteração/)
  assert.match(text, /salvas automaticamente/i)

  await act(async () => screen.root.findByProps({ 'aria-label': 'Voltar para Configurações' }).props.onClick())
  assert.equal(navigated, 'settings-home')

  await act(async () => buttonNamed(screen.root.findByProps({ 'aria-label': 'Tema do sistema' }), 'Escuro').props.onClick())
  assert.ok(h.localStorage.getItem('delivery-device-preferences-updated-at'))
  assert.match(nodeText(screen.root), /Salvo automaticamente/i)
})

test('failed theme or sound storage keeps the safe value and never announces Saved', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  const originalSetItem = h.localStorage.setItem
  h.localStorage.setItem = () => { throw new Error('blocked') }
  const [{ default: Settings }, { ThemeProvider }] = await Promise.all([
    h.load('/src/pages/Settings.jsx'),
    h.load('/src/components/ThemeProvider.jsx'),
  ])
  let sound = true
  const DevicePage = () => React.createElement(ThemeProvider, null,
    React.createElement(Settings, {
      section: 'settings-device', granted: new Set(['preferences.local']), implemented: new Set(['settings-device']),
      onNavigate() {}, soundEnabled: sound,
      onSoundEnabledChange() { return false },
    }))
  const screen = await h.render(DevicePage)
  await act(async () => buttonNamed(screen.root.findByProps({ 'aria-label': 'Tema do sistema' }), 'Escuro').props.onClick())
  assert.equal(buttonNamed(screen.root.findByProps({ 'aria-label': 'Tema do sistema' }), 'Automático').props['aria-pressed'], true)
  assert.match(nodeText(screen.root.findByProps({ role: 'alert' })), /não foi possível salvar.*dispositivo/i)
  assert.doesNotMatch(nodeText(screen.root), /Salvo/i)

  await act(async () => screen.root.findByProps({ role: 'switch', 'aria-label': 'Som de novos pedidos' }).props.onClick())
  assert.equal(sound, true)
  assert.match(nodeText(screen.root.findByProps({ role: 'alert' })), /não foi possível salvar.*dispositivo/i)
  assert.doesNotMatch(nodeText(screen.root), /Salvo/i)
  h.localStorage.setItem = originalSetItem
})
