import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { buildPolicyConflict } from './app/policy-editing/policyConflict.js'
import { buttonNamed, nodeText, renderWithNavigation, workspaceHarness } from './test-support/renderWorkspace.js'

const effective = (items, revision = 8) => ({ version: 'finance-v8', revisions: { financeCategories: revision }, financeCategories: { items } })
const categories = [
  { id: 'projects', type: 'entrada', label: 'Projetos' },
  { id: 'marketing', type: 'saida', label: 'Marketing' },
]
const movement = { id: 'm1', source: 'manual', type: 'saida', category: 'legacy-events', categoryLabel: 'Eventos antigos', description: 'Feira', value: 25, movementDate: '2026-09-13', paymentMethod: 'Pix' }

test('effective projection returns only server-provided active categories by type and accepts revision zero', async () => {
  const { financeCategoryOptionsFromEffective, financeCategoryRevisionFromEffective } = await import('./domains/finance/index.js')
  assert.deepEqual(financeCategoryOptionsFromEffective(effective(categories), 'entrada'), [{ value: 'projects', id: 'projects', type: 'entrada', label: 'Projetos' }])
  assert.deepEqual(financeCategoryOptionsFromEffective(effective(categories), 'saida'), [{ value: 'marketing', id: 'marketing', type: 'saida', label: 'Marketing' }])
  assert.deepEqual(financeCategoryOptionsFromEffective(null, 'saida'), [])
  assert.equal(financeCategoryRevisionFromEffective(effective(categories, 0)), 0)
})

test('new movement receives active categories only for its type and submits their revision', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/domains/finance/ui/MovementDialog.jsx')
  const submissions = []
  const screen = await h.render(Dialog, {
    open: true, today: '2026-09-13', categoryOptions: categories.map((item) => ({ ...item, value: item.id })), categoryRevision: 8,
    paymentOptions: [{ value: 'Pix', label: 'Pix' }], onClose() {}, onSubmit: (payload) => submissions.push(payload),
  })
  const categorySelect = screen.root.findByProps({ role: 'combobox', 'aria-label': 'Categoria' })
  await act(async () => categorySelect.props.onClick())
  assert.ok(buttonNamed(screen.root, 'Projetos'))
  assert.equal(buttonNamed(screen.root, 'Marketing'), undefined)
  await act(async () => buttonNamed(screen.root, 'Projetos').props.onClick())
  const inputs = screen.root.findAllByType('input')
  await act(async () => inputs.find((node) => node.props.placeholder === 'Ex.: Compra de embalagens').props.onChange({ target: { value: 'Projeto A' } }))
  await act(async () => inputs.find((node) => node.props.inputMode === 'decimal').props.onChange({ target: { value: '100' } }))
  const payment = screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma ou meio' })
  await act(async () => payment.props.onClick())
  await act(async () => buttonNamed(screen.root, 'Pix').props.onClick())
  await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await act(async () => buttonNamed(screen.root, 'Salvar movimento').props.onClick())
  assert.equal(submissions[0].category, 'projects')
  assert.equal(submissions[0].expectedRevision, 8)
})

test('empty active group blocks only new creation for that type without fallback', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/domains/finance/ui/MovementDialog.jsx')
  const screen = await h.render(Dialog, {
    open: true, today: '2026-09-13', categoryOptions: [{ value: 'marketing', id: 'marketing', type: 'saida', label: 'Marketing' }],
    categoryRevision: 8, paymentOptions: [{ value: 'Pix', label: 'Pix' }], onClose() {}, onSubmit() {},
  })
  assert.match(nodeText(screen.root), /Nenhuma categoria ativa de entrada/)
  assert.equal(buttonNamed(screen.root, 'Revisar movimento').props.disabled, true)
  const type = screen.root.findByProps({ role: 'combobox', 'aria-label': 'Tipo do movimento' })
  await act(async () => type.props.onClick())
  await act(async () => buttonNamed(screen.root, 'Saída').props.onClick())
  assert.doesNotMatch(nodeText(screen.root), /Nenhuma categoria ativa de saída/)
})

test('editing preserves an inactive historical category and label when it is not changed', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/domains/finance/ui/MovementDialog.jsx')
  const submissions = []
  const screen = await h.render(Dialog, {
    open: true, movement, today: '2026-09-13', categoryOptions: [{ value: 'marketing', id: 'marketing', type: 'saida', label: 'Marketing' }],
    categoryRevision: 8, paymentOptions: [{ value: 'Pix', label: 'Pix' }], onClose() {}, onSubmit: (payload) => submissions.push(payload),
  })
  assert.match(nodeText(screen.root), /Eventos antigos.*inativa.*preservada/i)
  assert.notEqual(buttonNamed(screen.root, 'Revisar alterações').props.disabled, true)
  await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.match(nodeText(screen.root), /Eventos antigos/)
  await act(async () => buttonNamed(screen.root, 'Salvar alterações').props.onClick())
  assert.equal(submissions[0].category, 'legacy-events')
  assert.equal(submissions[0].paymentMethod, 'Pix')
})

test('changing an old movement requires a category that remains active through confirmation', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/domains/finance/ui/MovementDialog.jsx')
  const active = { value: 'marketing', id: 'marketing', type: 'saida', label: 'Marketing' }
  const props = {
    open: true, movement, today: '2026-09-13', categoryOptions: [active], categoryRevision: 8,
    paymentOptions: [{ value: 'Pix', label: 'Pix' }], onClose() {}, onSubmit() {},
  }
  const screen = await h.render(Dialog, props)
  await act(async () => screen.root.findByProps({ label: 'Categoria' }).props.onChange('marketing'))
  await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await act(async () => screen.update(React.createElement(Dialog, { ...props, categoryOptions: [], categoryRevision: 9 })))
  assert.match(nodeText(screen.root), /categoria escolhida não está mais ativa/i)
  assert.equal(buttonNamed(screen.root, 'Salvar alterações').props.disabled, true)
})

test('first-use conflict preserves a finance rename intention for explicit review', () => {
  const data = { items: [{ id: 'marketing', type: 'saida', label: 'Marketing', active: true, sortOrder: 0 }] }
  const base = { revision: 1, data, meta: { items: { marketing: { isSystem: false, usedEver: false, canRename: true, canDelete: true } } } }
  const draft = { items: [{ ...data.items[0], label: 'Publicidade' }] }
  const current = { revision: 2, data, meta: { items: { marketing: { isSystem: false, usedEver: true, canRename: false, canDelete: false } } } }
  const review = buildPolicyConflict({ base, draft, current })
  const protectedRename = review.conflicts.find((entry) => entry.kind === 'protected-action')
  assert.ok(protectedRename)
  assert.equal(protectedRename.draft, 'Publicidade')
  assert.deepEqual(protectedRename.choices, ['current'])
  assert.match(protectedRename.message, /primeiro uso|passou a ser usado/i)
})

test('finance history displays the worker-resolved label instead of an inactive custom id', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Finance } = await h.load('/src/domains/finance/ui/Finance.jsx')
  const screen = await renderWithNavigation(h, Finance, {
    totals: { entries: 0, exits: 25, balance: -25 }, movements: [movement], currency: (value) => `R$ ${value}`,
    paymentOptions: [], granted: new Set(), implemented: new Set(['finance']), onNavigate() {}, activeTab: 'finance', canManageMovements: false,
  })
  assert.match(nodeText(screen.root), /Eventos antigos/)
  assert.doesNotMatch(nodeText(screen.root), /legacy-events/)
})

test('finance history exposes edit and confirmed delete only for manual movements', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Finance } = await h.load('/src/domains/finance/ui/Finance.jsx')
  const edits = []
  const deletes = []
  const automatic = { ...movement, id: 'sale', source: 'order-payment', category: 'sales', categoryLabel: 'Vendas', description: 'Venda' }
  const screen = await renderWithNavigation(h, Finance, {
    totals: { entries: 25, exits: 25, balance: 0 }, movements: [movement, automatic], currency: (value) => `R$ ${value}`,
    paymentOptions: [], granted: new Set(), implemented: new Set(['finance']), onNavigate() {}, activeTab: 'finance',
    canManageMovements: true, onEditMovement: (item) => edits.push(item.id), onDeleteMovement: (id) => deletes.push(id),
  })
  const hostButton = (label) => screen.root.findAllByType('button').find((node) => node.props['aria-label'] === label)
  assert.ok(hostButton('Editar Feira'))
  assert.ok(hostButton('Excluir Feira'))
  assert.equal(screen.root.findAllByType('button').some((node) => node.props['aria-label'] === 'Editar Venda'), false)
  await act(async () => hostButton('Editar Feira').props.onClick())
  assert.deepEqual(edits, ['m1'])
  await act(async () => hostButton('Excluir Feira').props.onClick())
  assert.match(nodeText(screen.root), /Excluir movimentação.*Feira/s)
  await act(async () => buttonNamed(screen.root, 'Excluir movimentação').props.onClick())
  assert.deepEqual(deletes, ['m1'])
})
