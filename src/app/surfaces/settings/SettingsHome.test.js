import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { readFile } from 'node:fs/promises'

import { buttonNamed, nodeText, renderWithNavigation, workspaceHarness } from '../../../test-support/renderWorkspace.js'
import { settingsGrants } from '../../../test-support/settingsFixtures.js'
import { resolveDestination } from '../../navigation/resolution.js'

const allImplemented = new Set([
  'settings-home', 'settings-business-profile', 'settings-operations', 'settings-modalities', 'settings-payments',
  'settings-cancellations', 'settings-finance-categories', 'settings-kitchen-tv', 'settings-printing', 'settings-device',
])

test('renders one operation card for timing and modalities even when the modalities deep link is implemented', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/app/surfaces/settings/SettingsHome.jsx')
  const screen = await h.render(SettingsHome, { granted: settingsGrants, implemented: allImplemented, onNavigate() {} })

  const cards = screen.root.findAllByType('button')
  assert.deepEqual(cards.map((card) => card.props['aria-label']), [
    'Dados da empresa', 'Regras da operação', 'Motivos de cancelamento', 'TV da Cozinha',
    'Impressão', 'Formas de pagamento', 'Categorias financeiras', 'Aparência e som',
  ])
  assert.deepEqual(cards.map((card) => nodeText(card)), [
    'Dados da empresaNome, logo, contato e endereço.',
    'Regras da operaçãoTempos e modalidades de pedido.',
    'Motivos de cancelamentoMotivos disponíveis nos pedidos.',
    'TV da CozinhaConexão da TV com os pedidos.',
    'ImpressãoVias, estação e impressora.',
    'Formas de pagamentoMétodos aceitos, ordem e padrão.',
    'Categorias financeirasCategorias dos lançamentos manuais.',
    'Aparência e somTema e alertas de novos pedidos.',
  ])
  assert.equal(buttonNamed(screen.root, 'Modalidades de pedido'), undefined)
})

test('offers only device preferences to a local-preferences-only user', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/app/surfaces/settings/SettingsHome.jsx')
  const screen = await h.render(SettingsHome, {
    granted: new Set(['preferences.local']),
    implemented: new Set(['settings-home', 'settings-device']),
    onNavigate() {},
  })

  assert.ok(buttonNamed(screen.root, 'Aparência e som'))
  assert.deepEqual(screen.root.findAllByType('h2').map(nodeText), ['Este dispositivo'])
  assert.equal(buttonNamed(screen.root, 'Formas de pagamento'), undefined)
})

test('desktop sidebar leaves settings and logout exclusively to the global top bar', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Sidebar } = await h.load('/src/app/shell/Sidebar.jsx')
  const screen = await renderWithNavigation(h, Sidebar, {
    activeTab: 'settings-home',
    granted: new Set(['preferences.local']),
    implemented: new Set(['settings-home', 'settings-device']),
    onLogout() {},
  })

  const navigation = screen.root.findByProps({ 'aria-label': 'Menu principal' })
  assert.equal(buttonNamed(navigation, 'Configurações'), undefined)
  assert.equal(buttonNamed(screen.root, 'Sair do sistema'), undefined)
})

test('omits unavailable future screens and activates an entire allowed card', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/app/surfaces/settings/SettingsHome.jsx')
  const calls = []
  const screen = await h.render(SettingsHome, {
    granted: new Set(['operations.settings.view', 'payments.settings.view', 'preferences.local']),
    implemented: new Set(['settings-home', 'settings-payments', 'settings-device']),
    onNavigate: (id) => calls.push(id),
  })

  const paymentCard = buttonNamed(screen.root, 'Formas de pagamento')
  assert.equal(paymentCard.props.type, 'button')
  assert.equal(paymentCard.props['aria-label'], 'Formas de pagamento')
  assert.equal(buttonNamed(screen.root, 'Regras da operação'), undefined)
  assert.equal(buttonNamed(screen.root, 'Modalidades de pedido'), undefined)
  assert.equal(buttonNamed(screen.root, 'Motivos de cancelamento'), undefined)
  assert.equal(nodeText(screen.root).includes('Em breve'), false)

  await act(async () => paymentCard.props.onClick())
  assert.deepEqual(calls, ['settings-payments'])
})

test('printing configuration Home card requires an administrative printing capability', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/app/surfaces/settings/SettingsHome.jsx')
  const implemented = new Set(['settings-home', 'settings-printing'])

  for (const capability of ['printing.settings.view', 'printing.settings', 'printing.station.configure']) {
    const granted = new Set([capability])
    const calls = []
    const screen = await h.render(SettingsHome, { granted, implemented, onNavigate: (id) => calls.push(id) })
    await act(async () => buttonNamed(screen.root, 'Impressão').props.onClick())
    assert.deepEqual(calls, ['settings-printing'])
    assert.deepEqual(resolveDestination(calls[0], granted, implemented), { status: 'allowed', id: 'settings-printing' })
    await act(async () => screen.unmount())
  }

  const operator = new Set(['printing.station.view', 'printing.queue', 'printing.execute', 'preferences.local'])
  const screen = await h.render(SettingsHome, { granted: operator, implemented, onNavigate() {} })
  assert.equal(buttonNamed(screen.root, 'Impressão'), undefined)
  assert.deepEqual(resolveDestination('settings-printing', operator, implemented), { status: 'denied' })
})

test('settings home style uses existing theme tokens and a mobile one-column grid', async () => {
  const css = await readFile(new URL('../../../settings.css', import.meta.url), 'utf8')
  assert.match(css, /background: var\(--surface\)/)
  assert.match(css, /color: var\(--text\)/)
  assert.match(css, /background: var\(--primary-soft\); color: var\(--primary\)/)
  assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*?\.settings-home-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/)
})

test('renders theme-aware Home cards under both document themes without inline palette values', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: SettingsHome }, { ThemeProvider }] = await Promise.all([
    h.load('/src/app/surfaces/settings/SettingsHome.jsx'), h.load('/src/app/shell/theme/ThemeProvider.jsx'),
  ])
  for (const theme of ['light', 'dark']) {
    h.document.documentElement.dataset = {}
    h.localStorage.setItem('delivery-theme', theme)
    const HomeWithTheme = () => React.createElement(ThemeProvider, null, React.createElement(SettingsHome, {
      granted: settingsGrants, implemented: allImplemented, onNavigate() {},
    }))
    const screen = await h.render(HomeWithTheme)
    const card = buttonNamed(screen.root, 'Regras da operação')
    assert.equal(h.document.documentElement.dataset.theme, theme)
    assert.equal(card.props.className, 'settings-home-card')
    assert.equal(card.props.style, undefined)
    assert.equal(card.findByProps({ className: 'settings-home-card-icon' }).props.style, undefined)
    await act(async () => screen.unmount())
  }
})


test('business profile card is first, capability-gated and opens the dedicated destination', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/app/surfaces/settings/SettingsHome.jsx')
  const calls = []
  const implemented = new Set(['settings-home', 'settings-business-profile'])

  const allowed = await h.render(SettingsHome, {
    granted: new Set(['business.profile.view']),
    implemented,
    onNavigate: (id) => calls.push(id),
  })
  const cards = allowed.root.findAllByType('button')
  assert.equal(cards[0].props['aria-label'], 'Dados da empresa')
  await act(async () => cards[0].props.onClick())
  assert.deepEqual(calls, ['settings-business-profile'])

  await act(async () => allowed.unmount())
  const denied = await h.render(SettingsHome, {
    granted: new Set(),
    implemented,
    onNavigate() {},
  })
  assert.equal(buttonNamed(denied.root, 'Dados da empresa'), undefined)
})

test('groups only implemented and permitted destinations without empty section headings', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/app/surfaces/settings/SettingsHome.jsx')
  const calls = []
  const screen = await h.render(SettingsHome, {
    granted: new Set(['access.audit.view', 'orders.settings.view', 'payments.settings.view']),
    implemented: new Set(['access-activity', 'settings-cancellations', 'settings-payments']),
    onNavigate: (id) => calls.push(id),
  })
  assert.deepEqual(screen.root.findAllByType('h2').map(nodeText), ['Empresa e equipe', 'Operação', 'Financeiro'])
  assert.equal(buttonNamed(screen.root, 'Equipe e acessos'), undefined)
  assert.equal(buttonNamed(screen.root, 'TV da Cozinha'), undefined)
  assert.equal(buttonNamed(screen.root, 'Aparência e som'), undefined)
  for (const label of ['Histórico de atividades', 'Motivos de cancelamento', 'Formas de pagamento']) {
    await act(async () => buttonNamed(screen.root, label).props.onClick())
  }
  assert.deepEqual(calls, ['access-activity', 'settings-cancellations', 'settings-payments'])
})

test('header follows the current company and actual access profile when context changes', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/app/surfaces/settings/SettingsHome.jsx')
  const props = { granted: settingsGrants, implemented: allImplemented, onNavigate() {} }
  const screen = await h.render(SettingsHome, { ...props, businessName: 'Restaurante A', user: { roleName: 'Supervisão' } })
  const header = () => nodeText(screen.root.findByType('header'))
  assert.match(header(), /Restaurante A/)
  assert.match(header(), /Supervisão/)
  await act(async () => screen.update(React.createElement(SettingsHome, { ...props, businessName: 'Restaurante B', user: { roleName: 'Consulta' } })))
  assert.match(header(), /Restaurante B/)
  assert.match(header(), /Consulta/)
  assert.doesNotMatch(header(), /Restaurante A|Supervisão|Gerente/)
  await act(async () => screen.update(React.createElement(SettingsHome, { ...props, user: { roleName: 'Consulta' } })))
  assert.match(header(), /Consulta/)
  assert.doesNotMatch(header(), /Restaurante A|Restaurante B|Supervisão|Gerente/)
})
