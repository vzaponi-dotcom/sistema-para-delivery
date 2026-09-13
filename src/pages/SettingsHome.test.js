import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { readFile } from 'node:fs/promises'

import { buttonNamed, nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'
import { settingsGrants } from '../test-support/settingsFixtures.js'
import { resolveDestination } from '../app/navigation.js'

const allImplemented = new Set([
  'settings-home', 'settings-operations', 'settings-modalities', 'settings-payments',
  'settings-cancellations', 'settings-finance-categories', 'settings-printing', 'settings-device',
])

test('renders the seven implemented settings cards for full grants', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/pages/SettingsHome.jsx')
  const screen = await h.render(SettingsHome, { granted: settingsGrants, implemented: allImplemented, onNavigate() {} })

  const cards = screen.root.findByProps({ className: 'settings-home-grid' }).findAllByType('button')
  assert.deepEqual(cards.map((card) => card.props['aria-label']), [
    'Operação', 'Formas de pagamento', 'Modalidades de pedido', 'Motivos de cancelamento',
    'Categorias financeiras', 'Impressão', 'Preferências deste dispositivo',
  ])
  assert.deepEqual(cards.map((card) => nodeText(card)), [
    'OperaçãoTempos da cozinha e critérios de atraso.',
    'Formas de pagamentoMétodos aceitos, ordem e padrão.',
    'Modalidades de pedidoEntrega, retirada e consumo no local.',
    'Motivos de cancelamentoMotivos disponíveis ao cancelar pedidos.',
    'Categorias financeirasCategorias dos lançamentos manuais.',
    'ImpressãoVias do negócio, estação e impressora local.',
    'Preferências deste dispositivoTema e som de novos pedidos.',
  ])
})

test('offers only device preferences to a local-preferences-only user', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/pages/SettingsHome.jsx')
  const screen = await h.render(SettingsHome, {
    granted: new Set(['preferences.local']),
    implemented: new Set(['settings-home', 'settings-device']),
    onNavigate() {},
  })

  assert.ok(buttonNamed(screen.root, 'Preferências deste dispositivo'))
  assert.equal(buttonNamed(screen.root, 'Formas de pagamento'), undefined)
})

test('sidebar keeps the single settings area active while the Home is open', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Sidebar } = await h.load('/src/components/Sidebar.jsx')
  const calls = []
  const screen = await h.render(Sidebar, {
    activeTab: 'settings-home',
    granted: new Set(['preferences.local']),
    implemented: new Set(['settings-home', 'settings-device']),
    onNavigate: (id) => calls.push(id),
  })

  const settingsEntry = buttonNamed(screen.root.findByProps({ 'aria-label': 'Menu principal' }), 'Configurações')
  assert.equal(settingsEntry.props['aria-current'], 'page')
  await act(async () => settingsEntry.props.onClick())
  assert.deepEqual(calls, ['settings-home'])
})

test('omits unavailable future screens and activates an entire allowed card', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/pages/SettingsHome.jsx')
  const calls = []
  const screen = await h.render(SettingsHome, {
    granted: new Set(['operations.settings.view', 'payments.settings.view', 'preferences.local']),
    implemented: new Set(['settings-home', 'settings-payments', 'settings-device']),
    onNavigate: (id) => calls.push(id),
  })

  const paymentCard = buttonNamed(screen.root, 'Formas de pagamento')
  assert.equal(paymentCard.props.type, 'button')
  assert.equal(paymentCard.props['aria-label'], 'Formas de pagamento')
  assert.equal(buttonNamed(screen.root, 'Operação'), undefined)
  assert.equal(buttonNamed(screen.root, 'Modalidades de pedido'), undefined)
  assert.equal(buttonNamed(screen.root, 'Motivos de cancelamento'), undefined)
  assert.equal(nodeText(screen.root).includes('Em breve'), false)

  await act(async () => paymentCard.props.onClick())
  assert.deepEqual(calls, ['settings-payments'])
})

test('each printing view capability exposes a Home card with an allowed printing destination', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/pages/SettingsHome.jsx')
  for (const capability of ['printing.settings.view', 'printing.station.view']) {
    const granted = new Set([capability])
    const implemented = new Set(['settings-home', 'settings-printing'])
    const calls = []
    const screen = await h.render(SettingsHome, { granted, implemented, onNavigate: (id) => calls.push(id) })

    await act(async () => buttonNamed(screen.root, 'Impressão').props.onClick())
    assert.deepEqual(calls, ['settings-printing'])
    assert.deepEqual(resolveDestination(calls[0], granted, implemented), { status: 'allowed', id: 'settings-printing' })
  }
})

test('settings home style uses existing theme tokens and a mobile one-column grid', async () => {
  const css = await readFile(new URL('../settings.css', import.meta.url), 'utf8')
  assert.match(css, /background: var\(--surface\)/)
  assert.match(css, /color: var\(--text\)/)
  assert.match(css, /background: var\(--primary-soft\); color: var\(--primary\)/)
  assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*?\.settings-home-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/)
})

test('renders theme-aware Home cards under both document themes without inline palette values', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: SettingsHome }, { ThemeProvider }] = await Promise.all([
    h.load('/src/pages/SettingsHome.jsx'), h.load('/src/components/ThemeProvider.jsx'),
  ])
  for (const theme of ['light', 'dark']) {
    h.document.documentElement.dataset = {}
    h.localStorage.setItem('delivery-theme', theme)
    const HomeWithTheme = () => React.createElement(ThemeProvider, null, React.createElement(SettingsHome, {
      granted: settingsGrants, implemented: allImplemented, onNavigate() {},
    }))
    const screen = await h.render(HomeWithTheme)
    const card = buttonNamed(screen.root, 'Operação')
    assert.equal(h.document.documentElement.dataset.theme, theme)
    assert.equal(card.props.className, 'settings-home-card')
    assert.equal(card.props.style, undefined)
    assert.equal(card.findByProps({ className: 'settings-home-card-icon' }).props.style, undefined)
    await act(async () => screen.unmount())
  }
})
