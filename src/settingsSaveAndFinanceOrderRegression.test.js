import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { nativeFinanceCategories } from '../shared/settingsCatalogs.js'
import { buttonNamed, nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const financeState = () => {
  const items = nativeFinanceCategories().items.map(({ id, type, label, active, sortOrder }) => ({ id, type, label, active, sortOrder }))
  const meta = Object.fromEntries(nativeFinanceCategories().items.map((item) => [item.id, {
    isSystem: true,
    usedEver: false,
    canRename: false,
    canDelete: false,
    type: item.type,
  }]))
  return {
    status: 'ready',
    confirmed: { resource: 'financeCategories', revision: 4, data: { items }, meta: { items: meta } },
    base: { resource: 'financeCategories', revision: 4, data: { items }, meta: { items: meta } },
    draft: structuredClone({ items }),
    dirty: false,
  }
}

test('reordering finance categories persists the new order in the draft', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Page } = await h.load('/src/pages/FinanceCategorySettings.jsx')
  const edits = []
  const screen = await h.render(Page, {
    resourceState: financeState(),
    onEdit: (draft) => edits.push(draft),
    onSave() {},
    onDiscard() {},
    onNavigateHome() {},
  })

  const contribution = screen.root.findByProps({ 'data-finance-category-id': 'contribution' })
  await act(async () => buttonNamed(contribution, 'Mover para baixo').props.onClick({ currentTarget: { closest: () => null } }))

  assert.equal(edits.length, 1)
  assert.deepEqual(
    edits[0].items.filter((item) => item.type === 'entrada').map(({ id, sortOrder }) => ({ id, sortOrder })),
    [
      { id: 'other_income', sortOrder: 0 },
      { id: 'contribution', sortOrder: 1 },
    ],
  )
})

test('shared settings save shows informational feedback and skips save when nothing changed', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsEditorShell } = await h.load('/src/components/SettingsEditorShell.jsx')
  let saves = 0
  const screen = await h.render(SettingsEditorShell, {
    title: 'Configuração de teste',
    description: 'Teste do comportamento compartilhado de salvar',
    state: { status: 'ready', dirty: false },
    readOnly: false,
    onSave: () => { saves += 1 },
    onDiscard() {},
    children: React.createElement('div', null, 'Conteúdo'),
  })

  await act(async () => buttonNamed(screen.root, 'Salvar alterações').props.onClick())

  assert.equal(saves, 0)
  assert.match(nodeText(screen.root), /Não há alterações para salvar\./)
})

test('shared settings save still calls the real save when the draft is dirty', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsEditorShell } = await h.load('/src/components/SettingsEditorShell.jsx')
  let saves = 0
  const screen = await h.render(SettingsEditorShell, {
    title: 'Configuração de teste',
    description: 'Teste do comportamento compartilhado de salvar',
    state: { status: 'ready', dirty: true },
    readOnly: false,
    onSave: () => { saves += 1 },
    onDiscard() {},
    children: React.createElement('div', null, 'Conteúdo'),
  })

  await act(async () => buttonNamed(screen.root, 'Salvar alterações').props.onClick())

  assert.equal(saves, 1)
  assert.doesNotMatch(nodeText(screen.root), /Não há alterações para salvar\./)
})
