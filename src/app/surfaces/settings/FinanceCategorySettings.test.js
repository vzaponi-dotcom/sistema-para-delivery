import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { nativeFinanceCategories } from '../../../../shared/settingsCatalogs.js'
import { buttonNamed, nodeText, workspaceHarness } from '../../../test-support/renderWorkspace.js'

const nativeItems = () => nativeFinanceCategories().items.map(({ id, type, label, active, sortOrder }) => ({ id, type, label, active, sortOrder }))
const nativeMeta = () => Object.fromEntries(nativeFinanceCategories().items.map((item) => [item.id, {
  isSystem: true, usedEver: false, canRename: false, canDelete: false, type: item.type,
}]))
const resourceState = (items = nativeItems(), meta = nativeMeta(), extra = {}) => ({
  status: 'ready',
  confirmed: { resource: 'financeCategories', revision: 4, data: { items }, meta: { items: meta } },
  base: { resource: 'financeCategories', revision: 4, data: { items }, meta: { items: meta } },
  draft: structuredClone({ items }), dirty: false, ...extra,
})
const row = (root, id) => root.findByProps({ 'data-finance-category-id': id })
const settingsSwitch = (root, id) => root.findByProps({ 'data-settings-switch': id })

async function renderEditable(h, Page, initial) {
  const edits = []
  let saves = 0
  function Editor() {
    const [state, setState] = React.useState(initial)
    return React.createElement(Page, {
      resourceState: state,
      onEdit(draft) { edits.push(draft); setState((current) => ({ ...current, draft, dirty: true })) },
      onSave() { saves += 1 }, onDiscard() {},
    })
  }
  return { screen: await h.render(Editor), edits, saves: () => saves }
}

test('settings route loads financeCategories and renders separate manual income and expense groups', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  const [{ default: Settings }, { ThemeProvider }] = await Promise.all([
    h.load('/src/pages/Settings.jsx'), h.load('/src/components/ThemeProvider.jsx'),
  ])
  const loaded = []
  const controller = { resources: { financeCategories: resourceState() }, load: (key) => loaded.push(key), edit() {}, save() {}, discard() {}, reconcile() {}, reviewConflict() {} }
  const screen = await h.render(() => React.createElement(ThemeProvider, null, React.createElement(Settings, {
    section: 'settings-finance-categories', settings: {}, printing: {},
    granted: new Set(['finance.categories.view', 'finance.categories.manage']), implemented: new Set(['settings-finance-categories']),
    onNavigate() {}, soundEnabled: true, onSoundEnabledChange() {}, businessSettings: controller,
  })))
  assert.deepEqual(loaded, ['financeCategories'])
  assert.ok(screen.root.findByProps({ id: 'manual-in-title' }))
  assert.ok(screen.root.findByProps({ id: 'manual-out-title' }))
  assert.equal(screen.root.findAll((node) => node.props?.['data-finance-category-type'] === 'entrada').length, 2)
  assert.equal(screen.root.findAll((node) => node.props?.['data-finance-category-type'] === 'saida').length, 11)
  assert.doesNotMatch(nodeText(screen.root), /Saldo inicial/)
})

test('adding asks for type, creates one stable UUID in that group and changes only the shared draft', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Page } = await h.load('/src/app/surfaces/settings/FinanceCategorySettings.jsx')
  const fixture = await renderEditable(h, Page, resourceState())
  await act(async () => buttonNamed(fixture.screen.root, 'Adicionar categoria').props.onClick())
  const type = fixture.screen.root.findByProps({ role: 'combobox', 'aria-label': 'Tipo' })
  await act(async () => type.props.onClick())
  await act(async () => buttonNamed(fixture.screen.root, 'Saída').props.onClick())
  const input = fixture.screen.root.findAllByType('input').find((node) => node.props.type === 'text')
  await act(async () => input.props.onChange({ target: { value: 'Marketing' } }))
  await act(async () => buttonNamed(fixture.screen.root, 'Adicionar à lista').props.onClick())
  const created = fixture.edits.at(-1).items.find((item) => item.label === 'Marketing')
  assert.match(created.id, /^[0-9a-f-]{36}$/i)
  assert.equal(created.type, 'saida')
  assert.equal(row(fixture.screen.root, created.id).props['data-finance-category-type'], 'saida')
  assert.equal(fixture.saves(), 0)
  await act(async () => settingsSwitch(row(fixture.screen.root, created.id), created.id).props.onClick())
  assert.equal(fixture.edits.at(-1).items.find((item) => item.id === created.id).id, created.id)
  assert.equal(fixture.edits.at(-1).items.find((item) => item.id === created.id).active, false)
})

test('existing category type is immutable and unused custom category can rename and delete only in draft', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Page } = await h.load('/src/app/surfaces/settings/FinanceCategorySettings.jsx')
  const items = nativeItems()
  items.push({ id: 'marketing', type: 'saida', label: 'Marketing', active: true, sortOrder: 11 })
  const fixture = await renderEditable(h, Page, resourceState(items, { ...nativeMeta(), marketing: { isSystem: false, usedEver: false, canRename: true, canDelete: true, type: 'saida' } }))
  await act(async () => buttonNamed(row(fixture.screen.root, 'marketing'), 'Renomear').props.onClick())
  assert.equal(fixture.screen.root.findByProps({ role: 'combobox', 'aria-label': 'Tipo' }).props.disabled, true)
  const input = fixture.screen.root.findAllByType('input').find((node) => node.props.type === 'text')
  await act(async () => input.props.onChange({ target: { value: 'Publicidade' } }))
  await act(async () => buttonNamed(fixture.screen.root, 'Aplicar ao rascunho').props.onClick())
  assert.equal(fixture.edits.at(-1).items.find((item) => item.id === 'marketing').type, 'saida')
  await act(async () => buttonNamed(row(fixture.screen.root, 'marketing'), 'Excluir').props.onClick())
  await act(async () => buttonNamed(fixture.screen.root, 'Excluir do rascunho').props.onClick())
  assert.equal(fixture.edits.at(-1).items.some((item) => item.id === 'marketing'), false)
  assert.equal(fixture.saves(), 0)
})

test('duplicate names are scoped to type so the same custom label can exist in both groups', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Page } = await h.load('/src/app/surfaces/settings/FinanceCategorySettings.jsx')
  const items = nativeItems()
  items.push({ id: 'expense-events', type: 'saida', label: 'Eventos', active: true, sortOrder: 11 })
  const fixture = await renderEditable(h, Page, resourceState(items, {
    ...nativeMeta(), 'expense-events': { isSystem: false, usedEver: false, canRename: true, canDelete: true, type: 'saida' },
  }))
  await act(async () => buttonNamed(fixture.screen.root, 'Adicionar categoria').props.onClick())
  const input = fixture.screen.root.findAllByType('input').find((node) => node.props.type === 'text')
  await act(async () => input.props.onChange({ target: { value: 'Eventos' } }))
  await act(async () => buttonNamed(fixture.screen.root, 'Adicionar à lista').props.onClick())
  const created = fixture.edits.at(-1).items.find((item) => item.type === 'entrada' && item.label === 'Eventos')
  assert.ok(created)
})

test('native and used categories expose no illegal rename/delete while used custom can toggle active', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Page } = await h.load('/src/app/surfaces/settings/FinanceCategorySettings.jsx')
  const items = nativeItems()
  items.push({ id: 'projects', type: 'entrada', label: 'Projetos', active: true, sortOrder: 2 })
  const state = resourceState(items, { ...nativeMeta(), projects: { isSystem: false, usedEver: true, canRename: false, canDelete: false, type: 'entrada' } })
  const screen = await h.render(Page, { resourceState: state, onEdit() {}, onSave() {}, onDiscard() {} })
  for (const id of ['contribution', 'projects']) {
    assert.equal(buttonNamed(row(screen.root, id), 'Renomear'), undefined)
    assert.equal(buttonNamed(row(screen.root, id), 'Excluir'), undefined)
    assert.equal(settingsSwitch(row(screen.root, id), id).props.disabled, false)
  }
  assert.doesNotMatch(nodeText(screen.root), /Vendas.*Renomear|Estornos.*Excluir/s)
})

test('missing trusted metadata fails closed for an existing category', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Page } = await h.load('/src/app/surfaces/settings/FinanceCategorySettings.jsx')
  const items = nativeItems()
  items.push({ id: 'legacy-custom', type: 'saida', label: 'Legado', active: true, sortOrder: 11 })
  const screen = await h.render(Page, {
    resourceState: resourceState(items, nativeMeta()), onEdit() {}, onSave() {}, onDiscard() {},
  })
  assert.equal(buttonNamed(row(screen.root, 'legacy-custom'), 'Renomear'), undefined)
  assert.equal(buttonNamed(row(screen.root, 'legacy-custom'), 'Excluir'), undefined)
})

test('read-only and mobile preserve values without editing actions or horizontal tables', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: Page } = await h.load('/src/app/surfaces/settings/FinanceCategorySettings.jsx')
  const screen = await h.render(Page, { resourceState: resourceState(), readOnly: true, onEdit() {}, onSave() {}, onDiscard() {} })
  assert.match(nodeText(screen.root), /Somente leitura/)
  assert.equal(buttonNamed(screen.root, 'Adicionar categoria'), undefined)
  const switches = screen.root.findAll((node) => node.props?.['data-settings-switch'])
  assert.equal(switches.length, 13)
  assert.equal(switches.every((node) => node.props.disabled), true)
  assert.equal(screen.root.findAllByType('table').length, 0)
})
