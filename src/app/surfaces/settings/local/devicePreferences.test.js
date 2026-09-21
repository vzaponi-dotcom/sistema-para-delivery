import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { buttonNamed, nodeText, workspaceHarness } from '../../../../test-support/renderWorkspace.js'

test('presents the established local device controls, diagnostics, and autosave feedback', async (t) => {
  const h = await workspaceHarness(t, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
  })
  h.document.documentElement.dataset = {}
  const [{ default: DevicePreferences }, { ThemeProvider }] = await Promise.all([
    h.load('/src/app/surfaces/settings/local/DevicePreferences.jsx'),
    h.load('/src/app/shell/theme/ThemeProvider.jsx'),
  ])
  const changes = []
  const screen = await h.render(() => React.createElement(ThemeProvider, null,
    React.createElement(DevicePreferences, {
      soundEnabled: true,
      onSoundEnabledChange(value) { changes.push(value); h.localStorage.setItem('kitchen-sound-enabled', String(value)); return true },
    })))

  const text = nodeText(screen.root)
  assert.match(text, /Preferências deste dispositivo/)
  assert.match(text, /Aparência/)
  assert.match(text, /Avisos da cozinha/)
  assert.match(text, /Informações locais/)
  assert.match(text, /Google Chrome 140/)
  assert.match(text, /Uso aproximado/)
  assert.match(text, /Última alteração/)
  assert.match(text, /salvas automaticamente/i)

  const group = screen.root.findByProps({ 'aria-label': 'Tema do sistema' })
  assert.deepEqual(group.findAllByType('button').map((button) => nodeText(button)), ['Claro', 'Escuro', 'Automático'])
  await act(async () => buttonNamed(group, 'Escuro').props.onClick())
  assert.equal(h.localStorage.getItem('delivery-theme'), 'dark')
  assert.ok(h.localStorage.getItem('delivery-device-preferences-updated-at'))
  assert.match(nodeText(screen.root), /Salvo automaticamente/i)

  await act(async () => screen.root.findByProps({ role: 'switch', 'aria-label': 'Som de novos pedidos' }).props.onClick())
  assert.deepEqual(changes, [false])
  assert.equal(h.localStorage.getItem('kitchen-sound-enabled'), 'false')
})

test('keeps safe values and reports persistence failures without a policy engine', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  h.localStorage.setItem = () => { throw new Error('blocked') }
  const [{ default: DevicePreferences }, { ThemeProvider }] = await Promise.all([
    h.load('/src/app/surfaces/settings/local/DevicePreferences.jsx'),
    h.load('/src/app/shell/theme/ThemeProvider.jsx'),
  ])
  let soundCalls = 0
  const screen = await h.render(() => React.createElement(ThemeProvider, null,
    React.createElement(DevicePreferences, {
      soundEnabled: true,
      onSoundEnabledChange() { soundCalls += 1; return false },
    })))

  const group = screen.root.findByProps({ 'aria-label': 'Tema do sistema' })
  await act(async () => buttonNamed(group, 'Escuro').props.onClick())
  assert.equal(buttonNamed(group, 'Automático').props['aria-pressed'], true)
  assert.match(nodeText(screen.root.findByProps({ role: 'alert' })), /não foi possível salvar.*dispositivo/i)
  assert.doesNotMatch(nodeText(screen.root), /Salvo automaticamente/i)

  await act(async () => screen.root.findByProps({ role: 'switch', 'aria-label': 'Som de novos pedidos' }).props.onClick())
  assert.equal(soundCalls, 1)
  assert.match(nodeText(screen.root.findByProps({ role: 'alert' })), /não foi possível salvar.*dispositivo/i)
})
