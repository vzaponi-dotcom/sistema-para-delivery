import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { nativeFinanceCategories } from '../../shared/settingsCatalogs.js'
import { buttonNamed, nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

const nativeItems = () => nativeFinanceCategories().items.map(({ id, type, label, active, sortOrder }) => ({ id, type, label, active, sortOrder }))
const nativeMeta = () => Object.fromEntries(nativeFinanceCategories().items.map((item) => [item.id, {
  isSystem: true,
  usedEver: false,
  canRename: false,
  canDelete: false,
  type: item.type,
}]))
const resourceState = (items = nativeItems(), meta = nativeMeta()) => ({
  status: 'ready',
  confirmed: { resource: 'financeCategories', revision: 4, data: { items }, meta: { items: meta } },
  base: { resource: 'financeCategories', revision: 4, data: { items }, meta: { items: meta } },
  draft: structuredClone({ items }),
  dirty: false,
})
const row = (root, id) => root.findByProps({ 'data-finance-category-id': id })

async function renderEditable(h, Page, initial = resourceState()) {
  const edits = []
  function Editor() {
    const [state, setState] = React.useState(initial)
    return React.createElement(Page, {
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

test('finance categories follow the approved grouped table contract with icons and sortable rows', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Page } = await h.load('/src/pages/FinanceCategorySettings.jsx')
  const screen = await h.render(Page, {
    resourceState: resourceState(), onEdit() {}, onSave() {}, onDiscard() {}, onNavigateHome() {},
  })

  assert.ok(buttonNamed(screen.root, 'Configurações'))
  assert.ok(buttonNamed(screen.root, 'Adicionar categoria'))
  assert.match(nodeText(screen.root), /Organize as categorias manuais de receitas e despesas/)
  assert.match(nodeText(screen.root), /Categorias automáticas.*Vendas.*Estornos.*gerenciadas pelo sistema/is)

  const groups = screen.root.findAll((node) => node.props?.['data-finance-category-group'])
  assert.deepEqual(groups.map((node) => node.props['data-finance-category-group']), ['entrada', 'saida'])
  assert.match(nodeText(groups[0]), /Entradas manuais.*Categorias de receitas que você lança manualmente/s)
  assert.match(nodeText(groups[1]), /Saídas manuais.*Categorias de despesas que você lança manualmente/s)
  for (const group of groups) assert.match(nodeText(group.findByProps({ role: 'table' })), /ORDEM.*CATEGORIA.*TIPO.*STATUS.*AÇÕES/s)

  assert.match(nodeText(row(screen.root, 'contribution')), /1.*Aporte.*Receita.*Ativa/s)
  assert.match(nodeText(row(screen.root, 'supplies')), /1.*Insumos.*Despesa.*Ativa/s)
  assert.ok(row(screen.root, 'contribution').findByProps({ 'data-finance-category-icon': 'contribution' }))
  assert.ok(row(screen.root, 'supplies').findByProps({ 'data-finance-category-icon': 'supplies' }))
  assert.equal(screen.root.findAll((node) => node.props?.['data-finance-category-drag-handle']).length, 13)
  assert.doesNotMatch(nodeText(screen.root), /Nativa|Personalizada/)
})

test('finance category menu actions stay compact, close after success and keep permissions', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Page } = await h.load('/src/pages/FinanceCategorySettings.jsx')
  const fixture = await renderEditable(h, Page)
  const details = { open: true }
  let focusCount = 0
  const summary = { focus() { focusCount += 1 } }
  details.querySelector = (selector) => selector === 'summary' ? summary : null

  const aporte = row(fixture.screen.root, 'contribution')
  assert.equal(buttonNamed(aporte, 'Renomear'), undefined)
  assert.equal(buttonNamed(aporte, 'Excluir'), undefined)
  await act(async () => buttonNamed(aporte, 'Desativar').props.onClick({
    currentTarget: { closest: (selector) => selector === 'details' ? details : null },
  }))

  assert.equal(fixture.edits.at(-1).items.find((item) => item.id === 'contribution').active, false)
  assert.equal(details.open, false)
  assert.equal(focusCount, 1)
})

test('inactive finance category dims only the row content while preserving the action menu', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Page } = await h.load('/src/pages/FinanceCategorySettings.jsx')
  const items = nativeItems().map((item) => item.id === 'packaging' ? { ...item, active: false } : item)
  const screen = await h.render(Page, {
    resourceState: resourceState(items), onEdit() {}, onSave() {}, onDiscard() {}, onNavigateHome() {},
  })

  assert.match(row(screen.root, 'packaging').props.className, /\bis-inactive\b/)
  assert.doesNotMatch(row(screen.root, 'supplies').props.className, /\bis-inactive\b/)
  assert.ok(row(screen.root, 'packaging').findByProps({ 'data-finance-category-actions': 'packaging' }))
  assert.ok(buttonNamed(row(screen.root, 'packaging'), 'Ativar'))
})

test('mobile finance categories render compact cards with horizontal type and status metadata', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: Page } = await h.load('/src/pages/FinanceCategorySettings.jsx')
  const screen = await h.render(Page, {
    resourceState: resourceState(), onEdit() {}, onSave() {}, onDiscard() {}, onNavigateHome() {},
  })

  assert.equal(screen.root.findAllByType('table').length, 0)
  const aporte = row(screen.root, 'contribution')
  const metadata = aporte.findByProps({ 'data-finance-category-meta': 'contribution' })
  assert.match(nodeText(metadata), /Receita.*Ativa/s)
  assert.equal(metadata.props.className, 'finance-category-meta')
  assert.ok(aporte.findByProps({ 'data-finance-category-actions': 'contribution' }))
  assert.equal(aporte.findAll((node) => node.props?.className?.includes?.('settings-item-action')).length, 0)
})

test('settings finance category route uses breadcrumb layout instead of legacy settings tabs', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  const [{ default: Settings }, { ThemeProvider }] = await Promise.all([
    h.load('/src/pages/Settings.jsx'), h.load('/src/components/ThemeProvider.jsx'),
  ])
  const controller = {
    resources: { financeCategories: resourceState() },
    load() {}, edit() {}, save() {}, discard() {}, reconcile() {}, reviewConflict() {},
  }
  const navigations = []
  const screen = await h.render(ThemeProvider, { children: React.createElement(Settings, {
    section: 'settings-finance-categories', settings: {}, printing: {},
    granted: new Set(['finance.categories.view', 'finance.categories.manage', 'orders.settings.view']),
    implemented: new Set(['settings-finance-categories', 'settings-cancellations', 'settings-operations']),
    onNavigate: (target) => navigations.push(target), soundEnabled: true, onSoundEnabledChange() {}, businessSettings: controller,
  }) })

  assert.equal(screen.root.findAll((node) => node.props?.className === 'area-navigation').length, 0)
  await act(async () => buttonNamed(screen.root, 'Configurações').props.onClick())
  assert.deepEqual(navigations, ['settings-home'])
})
