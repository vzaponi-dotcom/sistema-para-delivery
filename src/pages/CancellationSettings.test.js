import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { readFile } from 'node:fs/promises'

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

const resourceState = (data = cancellationData(), meta = metadata(), extra = {}) => ({
  status: 'ready',
  confirmed: { resource: 'cancellationReasons', revision: 3, data, meta: { items: meta } },
  base: { resource: 'cancellationReasons', revision: 3, data, meta: { items: meta } },
  draft: structuredClone(data),
  dirty: false,
  ...extra,
})

const row = (root, id) => root.findByProps({ 'data-cancellation-id': id })

async function renderEditable(h, CancellationSettings, initial = resourceState()) {
  const edits = []
  let saves = 0
  function Editor() {
    const [state, setState] = React.useState(initial)
    return React.createElement(CancellationSettings, {
      resourceState: state,
      onEdit(draft) {
        edits.push(draft)
        setState((current) => ({ ...current, draft, dirty: true }))
      },
      onSave() { saves += 1 },
      onDiscard() {},
    })
  }
  return { screen: await h.render(Editor), edits, saves: () => saves }
}

test('settings route loads the single cancellationReasons resource instead of falling back to printing', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  const [{ default: Settings }, { ThemeProvider }] = await Promise.all([
    h.load('/src/pages/Settings.jsx'), h.load('/src/components/ThemeProvider.jsx'),
  ])
  const loaded = []
  const controller = {
    resources: { cancellationReasons: resourceState() },
    load: (resource) => loaded.push(resource), edit() {}, save() {}, discard() {}, reconcile() {}, reviewConflict() {},
  }
  const Page = () => React.createElement(ThemeProvider, null, React.createElement(Settings, {
    section: 'settings-cancellations', settings: {}, printing: {},
    granted: new Set(['orders.settings.view', 'orders.settings.manage']),
    implemented: new Set(['settings-cancellations']), onNavigate() {}, soundEnabled: true,
    onSoundEnabledChange() {}, businessSettings: controller,
  }))
  const screen = await h.render(Page)
  assert.deepEqual(loaded, ['cancellationReasons'])
  assert.match(nodeText(screen.root), /Motivos de cancelamento/)
  assert.doesNotMatch(nodeText(screen.root), /Regras do negócio, estação e impressora local/)
})

test('renders the five native reasons and protects Outro with requires-note metadata', async (t) => {
  const h = await workspaceHarness(t)
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const screen = await h.render(CancellationSettings, {
    resourceState: resourceState(), onEdit() {}, onSave() {}, onDiscard() {},
  })
  assert.deepEqual(screen.root.findAll((node) => node.props?.['data-cancellation-id'])
    .map((node) => node.props['data-cancellation-id']),
  ['client_changed_mind', 'duplicate_order', 'product_unavailable', 'entry_error', 'other'])
  assert.match(nodeText(row(screen.root, 'other')), /Nativo.*Ativo.*Exige nota/s)
  assert.equal(buttonNamed(row(screen.root, 'other'), 'Renomear'), undefined)
  assert.equal(buttonNamed(row(screen.root, 'other'), 'Excluir'), undefined)
})

test('adding creates one stable UUID in the draft and never autosaves', async (t) => {
  const h = await workspaceHarness(t)
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const fixture = await renderEditable(h, CancellationSettings)
  await act(async () => buttonNamed(fixture.screen.root, 'Adicionar motivo').props.onClick())
  const input = fixture.screen.root.findAllByType('input').find((node) => node.props.type === 'text')
  await act(async () => input.props.onChange({ target: { value: 'Endereço incompleto' } }))
  await act(async () => buttonNamed(fixture.screen.root, 'Adicionar à lista').props.onClick())
  const created = fixture.edits.at(-1).items.find((item) => item.label === 'Endereço incompleto')
  assert.match(created.id, /^[0-9a-f-]{36}$/i)
  assert.equal(created.active, true)
  assert.equal(fixture.saves(), 0)

  await act(async () => buttonNamed(row(fixture.screen.root, created.id), 'Desativar').props.onClick())
  assert.equal(fixture.edits.at(-1).items.find((item) => item.id === created.id).id, created.id)
  assert.equal(fixture.saves(), 0)
})

test('unused custom reasons can be renamed or deleted while used reasons can only toggle status', async (t) => {
  const h = await workspaceHarness(t)
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const data = cancellationData()
  data.items.push(
    { id: 'unused-custom', label: 'Sem entregador', active: true, sortOrder: 5 },
    { id: 'used-custom', label: 'Chuva forte', active: true, sortOrder: 6 },
  )
  const state = resourceState(data, metadata({
    'unused-custom': { isSystem: false, usedEver: false, canRename: true, canDelete: true, requiresNote: false },
    'used-custom': { isSystem: false, usedEver: true, canRename: false, canDelete: false, requiresNote: false },
  }))
  const fixture = await renderEditable(h, CancellationSettings, state)
  assert.ok(buttonNamed(row(fixture.screen.root, 'unused-custom'), 'Renomear'))
  assert.ok(buttonNamed(row(fixture.screen.root, 'unused-custom'), 'Excluir'))
  assert.equal(buttonNamed(row(fixture.screen.root, 'used-custom'), 'Renomear'), undefined)
  assert.equal(buttonNamed(row(fixture.screen.root, 'used-custom'), 'Excluir'), undefined)
  assert.ok(buttonNamed(row(fixture.screen.root, 'used-custom'), 'Desativar'))

  await act(async () => buttonNamed(row(fixture.screen.root, 'unused-custom'), 'Renomear').props.onClick())
  await act(async () => fixture.screen.root.findByType('input').props.onChange({ target: { value: 'Cliente ausente' } }))
  await act(async () => buttonNamed(fixture.screen.root, 'Atualizar motivo').props.onClick())
  assert.equal(fixture.edits.at(-1).items.find((item) => item.id === 'unused-custom').label, 'Cliente ausente')
  assert.equal(fixture.saves(), 0)
})

test('deleting an unused custom reason removes only that draft item after confirmation and never autosaves', async (t) => {
  const h = await workspaceHarness(t)
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const data = cancellationData()
  data.items.push({ id: 'unused-custom', label: 'Sem entregador', active: true, sortOrder: 5 })
  const fixture = await renderEditable(h, CancellationSettings, resourceState(data, metadata({
    'unused-custom': { isSystem: false, usedEver: false, canRename: true, canDelete: true, requiresNote: false },
  })))

  await act(async () => buttonNamed(row(fixture.screen.root, 'unused-custom'), 'Excluir').props.onClick())
  assert.match(nodeText(fixture.screen.root.findByProps({ role: 'dialog' })), /Excluir motivo/)
  await act(async () => buttonNamed(fixture.screen.root, 'Excluir do rascunho').props.onClick())

  assert.equal(fixture.edits.at(-1).items.some((item) => item.id === 'unused-custom'), false)
  assert.equal(fixture.edits.at(-1).items.length, 5)
  assert.equal(fixture.saves(), 0)
})

test('read-only exposes values and no editing controls', async (t) => {
  const h = await workspaceHarness(t)
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const screen = await h.render(CancellationSettings, {
    resourceState: resourceState(), readOnly: true,
    onEdit() { throw new Error('read-only must not edit') }, onSave() { throw new Error('read-only must not save') }, onDiscard() {},
  })
  assert.match(nodeText(screen.root), /Somente leitura/)
  assert.equal(buttonNamed(screen.root, 'Adicionar motivo'), undefined)
  assert.equal(buttonNamed(screen.root, 'Salvar alterações'), undefined)
  assert.equal(buttonNamed(screen.root, 'Desativar'), undefined)
})

test('mobile cancellation settings use responsive rows and never a horizontal table', async (t) => {
  const css = await readFile(new URL('../settings.css', import.meta.url), 'utf8')
  assert.match(css, /\.cancellation-settings/)
  const h = await workspaceHarness(t, { mobile: true })
  const { default: CancellationSettings } = await h.load('/src/pages/CancellationSettings.jsx')
  const screen = await h.render(CancellationSettings, {
    resourceState: resourceState(), onEdit() {}, onSave() {}, onDiscard() {},
  })
  assert.equal(screen.root.findAllByType('table').length, 0)
  assert.equal(screen.root.findAll((node) => node.props?.['data-cancellation-id']).length, 5)
})