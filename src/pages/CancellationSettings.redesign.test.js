import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { buttonNamed, nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

const cancellationData = () => ({
  items: [
    { id: 'client_changed_mind', label: 'Cliente desistiu', active: true, sortOrder: 0 },
    { id: 'duplicate_order', label: 'Pedido duplicado', active: true, sortOrder: 1 },
    { id: 'product_unavailable', label: 'Produto indisponível', active: true, sortOrder: 2 },
    { id: 'entry_error', label: 'Erro no lançamento', active: true, sortOrder: 3 },
    { id: 'other', label: 'Outro', active: true, sortOrder: 4 },
  ],
})

const metadata = (custom = {}) => ({
  client_changed_mind: { isSystem: true, usedEver: false, canRename: false, canDelete: false, requiresNote: false },
  duplicate_order: { isSystem: true, usedEver: false, canRename: false, canDelete: false, requiresNote: false },
  product_unavailable: { isSystem: true, usedEver: false, canRename: false, canDelete: false, requiresNote: false },
  entry_error: { isSystem: true, usedEver: false, canRename: false, canDelete: false, requiresNote: false },
  other: { isSystem: true, usedEver: true, canRename: false, canDelete: false, requiresNote: true },
  ...custom,
})

const resourceState = (data = cancellationData(), meta = metadata()) => ({
  status: 'ready',
  confirmed: { resource: 'cancellationReasons', revision: 3, data, meta: { items: meta } },
  base: { resource: 'cancellationReasons', revision: 3, data, meta: { items: meta } },
  draft: structuredClone(data),
  dirty: false,
})

const row = (root, id) => root.findByProps({ 'data-cancellation-id': id })
const settingsSwitch = (root, id) => root.findByProps({ 'data-settings-switch': id })

async function renderEditable(h, CancellationSettings, initial = resourceState()) {
  const edits = []
  function Editor() {
    const [state, setState] = React.useState(initial)
    return React.createElement(CancellationSettings, {
      resourceState: state,
      onEdit(draft) {
        edits.push(draft)
        setState((current) => ({ ...current, draft, dirty: true }))
      },
      onSave() {},
      onDiscard() {},
      onNavigateHome() {},
    })
  }
  return { screen: await h.render(Editor), edits }
}

test('cancellation settings follow the approved table contract with sortable rows', async (t) => {
  const h = await workspaceHarness(t)
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const screen = await h.render(CancellationSettings, {
    resourceState: resourceState(), onEdit() {}, onSave() {}, onDiscard() {}, onNavigateHome() {},
  })

  const table = screen.root.findByProps({ role: 'table' })
  assert.match(nodeText(table), /ORDEM.*MOTIVO.*TIPO.*STATUS.*AÇÕES/s)
  assert.equal(table.findAll((node) => node.props?.['data-cancellation-drag-handle']).length, 5)
  assert.match(nodeText(row(screen.root, 'client_changed_mind')), /1.*Cliente desistiu.*Nativo/s)
  assert.doesNotMatch(nodeText(row(screen.root, 'client_changed_mind')), /Ativo|Inativo/)
  assert.match(nodeText(row(screen.root, 'other')), /5.*Outro.*Nativo.*Protegido/s)
  assert.doesNotMatch(nodeText(row(screen.root, 'other')), /Ativo|Inativo/)
})

test('renaming a custom reason opens the modal with the real reason text', async (t) => {
  const h = await workspaceHarness(t)
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const data = cancellationData()
  data.items.push({ id: 'unused-custom', label: 'Sem entregador', active: true, sortOrder: 5 })
  const fixture = await renderEditable(h, CancellationSettings, resourceState(data, metadata({
    'unused-custom': { isSystem: false, usedEver: false, canRename: true, canDelete: true, requiresNote: false },
  })))

  await act(async () => buttonNamed(row(fixture.screen.root, 'unused-custom'), 'Renomear').props.onClick())
  const input = fixture.screen.root.findAllByType('input').find((node) => node.props.type === 'text')
  assert.equal(input.props.value, 'Sem entregador')
  assert.notEqual(String(input.props.value), '[object Object]')
  assert.ok(buttonNamed(fixture.screen.root, 'Atualizar motivo'))
})

test('new unsaved reasons also require explicit delete confirmation', async (t) => {
  const h = await workspaceHarness(t)
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const fixture = await renderEditable(h, CancellationSettings)

  await act(async () => buttonNamed(fixture.screen.root, 'Adicionar motivo').props.onClick())
  const input = fixture.screen.root.findAllByType('input').find((node) => node.props.type === 'text')
  await act(async () => input.props.onChange({ target: { value: 'Endereço incompleto' } }))
  await act(async () => buttonNamed(fixture.screen.root, 'Adicionar à lista').props.onClick())
  const created = fixture.edits.at(-1).items.find((item) => item.label === 'Endereço incompleto')

  await act(async () => buttonNamed(row(fixture.screen.root, created.id), 'Excluir').props.onClick())
  assert.match(nodeText(fixture.screen.root.findByProps({ role: 'dialog' })), /Excluir motivo/)
  assert.equal(fixture.edits.at(-1).items.some((item) => item.id === created.id), true)

  await act(async () => buttonNamed(fixture.screen.root, 'Excluir do rascunho').props.onClick())
  assert.equal(fixture.edits.at(-1).items.some((item) => item.id === created.id), false)
  assert.match(nodeText(fixture.screen.root), /Motivo removido.*Salve as alterações para confirmar/s)
})

test('inactive cancellation reason keeps a direct enabled activation switch and its complementary action menu', async (t) => {
  const h = await workspaceHarness(t)
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const data = cancellationData()
  data.items = data.items.map((item) => item.id === 'duplicate_order' ? { ...item, active: false } : item)
  const screen = await h.render(CancellationSettings, {
    resourceState: resourceState(data), onEdit() {}, onSave() {}, onDiscard() {}, onNavigateHome() {},
  })

  assert.match(row(screen.root, 'duplicate_order').props.className, /\bis-inactive\b/)
  assert.doesNotMatch(row(screen.root, 'client_changed_mind').props.className, /\bis-inactive\b/)
  assert.ok(row(screen.root, 'duplicate_order').findByProps({ 'data-cancellation-actions': 'duplicate_order' }))
  const activation = settingsSwitch(row(screen.root, 'duplicate_order'), 'duplicate_order')
  assert.equal(activation.props['aria-checked'], false)
  assert.equal(activation.props.disabled, false)
})

test('successful complementary cancellation menu action closes the menu and restores focus', async (t) => {
  const h = await workspaceHarness(t)
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const fixture = await renderEditable(h, CancellationSettings)
  const details = { open: true }
  let focusCount = 0
  const summary = { focus() { focusCount += 1 } }
  details.querySelector = (selector) => selector === 'summary' ? summary : null

  await act(async () => buttonNamed(row(fixture.screen.root, 'duplicate_order'), 'Mover para baixo').props.onClick({
    currentTarget: { closest: (selector) => selector === 'details' ? details : null },
  }))

  assert.equal(fixture.edits.at(-1).items.find((item) => item.id === 'duplicate_order').sortOrder, 2)
  assert.equal(details.open, false)
  assert.equal(focusCount, 1)
})

test('cancellation notice explains history protection and Outro rule', async (t) => {
  const h = await workspaceHarness(t)
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const screen = await h.render(CancellationSettings, {
    resourceState: resourceState(), onEdit() {}, onSave() {}, onDiscard() {}, onNavigateHome() {},
  })
  const text = nodeText(screen.root)
  assert.match(text, /Motivos utilizados permanecem no histórico/)
  assert.match(text, /Outro.*protegido.*sempre ativo.*exige.*descrição/is)
  assert.ok(buttonNamed(screen.root, 'Cancelar'))
})

test('settings cancellation route uses breadcrumb layout instead of the legacy settings tabs', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  const [{ default: Settings }, { ThemeProvider }] = await Promise.all([
    h.load('/src/pages/Settings.jsx'), h.load('/src/components/ThemeProvider.jsx'),
  ])
  const navigations = []
  const controller = {
    resources: { cancellationReasons: resourceState() },
    load() {}, edit() {}, save() {}, discard() {}, reconcile() {}, reviewConflict() {},
  }
  const screen = await h.render(ThemeProvider, { children: React.createElement(Settings, {
    section: 'settings-cancellations', settings: {}, printing: {},
    granted: new Set(['orders.settings.view', 'orders.settings.manage', 'payments.settings.view', 'operations.settings.view']),
    implemented: new Set(['settings-cancellations', 'settings-payments', 'settings-operations']),
    onNavigate: (target) => navigations.push(target), soundEnabled: true, onSoundEnabledChange() {}, businessSettings: controller,
  }) })

  assert.equal(screen.root.findAll((node) => node.props?.className === 'area-navigation').length, 0)
  const backLink = buttonNamed(screen.root, 'Voltar para Configurações')
  assert.match(nodeText(backLink), /←.*Configurações/)
  await act(async () => backLink.props.onClick())
  assert.deepEqual(navigations, ['settings-home'])
})
