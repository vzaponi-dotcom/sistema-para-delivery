import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { adminFixture } from './test-support/settingsFixtures.js'
import { buttonNamed, nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const operationState = () => ({
  status: 'ready',
  confirmed: adminFixture,
  base: adminFixture,
  draft: structuredClone(adminFixture.data),
  dirty: false,
})

const paymentData = () => ({
  methods: [
    { code: 'pix', active: true, sortOrder: 0 },
    { code: 'cash', active: true, sortOrder: 1 },
  ],
  defaultMethod: 'pix',
})
const paymentState = () => ({
  status: 'ready',
  confirmed: { resource: 'paymentMethods', revision: 1, data: paymentData() },
  base: { resource: 'paymentMethods', revision: 1, data: paymentData() },
  draft: paymentData(),
  dirty: false,
})

const cancellationData = () => ({
  items: [
    { id: 'duplicate_order', label: 'Pedido duplicado', active: true, sortOrder: 0 },
    { id: 'other', label: 'Outro', active: true, sortOrder: 1 },
  ],
})
const cancellationMeta = {
  duplicate_order: { isSystem: true, usedEver: false, canRename: false, canDelete: false, requiresNote: false },
  other: { isSystem: true, usedEver: true, canRename: false, canDelete: false, requiresNote: true },
}
const cancellationState = () => ({
  status: 'ready',
  confirmed: { resource: 'cancellationReasons', revision: 1, data: cancellationData(), meta: { items: cancellationMeta } },
  base: { resource: 'cancellationReasons', revision: 1, data: cancellationData(), meta: { items: cancellationMeta } },
  draft: cancellationData(),
  dirty: false,
})

const financeData = () => ({
  items: [
    { id: 'contribution', type: 'entrada', label: 'Aporte', active: true, sortOrder: 0 },
    { id: 'supplies', type: 'saida', label: 'Insumos', active: true, sortOrder: 0 },
  ],
})
const financeState = () => ({
  status: 'ready',
  confirmed: { resource: 'financeCategories', revision: 1, data: financeData(), meta: { items: {} } },
  base: { resource: 'financeCategories', revision: 1, data: financeData(), meta: { items: {} } },
  draft: financeData(),
  dirty: false,
})

const findSwitch = (root, id) => root.findByProps({ 'data-settings-switch': id })

test('all completed settings editors expose the same visual back affordance', async (t) => {
  const h = await workspaceHarness(t)
  const modules = await Promise.all([
    h.load('/src/app/surfaces/settings/OperationSettings.jsx'),
    h.load('/src/domains/finance/ui/settings/PaymentSettings.jsx'),
    h.load('/src/app/surfaces/settings/CancellationSettings.jsx'),
    h.load('/src/domains/finance/ui/settings/FinanceCategorySettings.jsx'),
  ])
  const cases = [
    ['operation', modules[0].default, operationState()],
    ['payments', modules[1].default, paymentState()],
    ['cancellations', modules[2].default, cancellationState()],
    ['finance', modules[3].default, financeState()],
  ]
  const navigated = []

  for (const [key, Component, resourceState] of cases) {
    const screen = await h.render(Component, {
      resourceState,
      onEdit() {}, onSave() {}, onDiscard() {},
      onNavigateHome: () => navigated.push(key),
    })
    const back = buttonNamed(screen.root, 'Voltar para Configurações')
    assert.ok(back, `${key} must expose the shared back control`)
    assert.match(nodeText(back), /←\s*Configurações/)
    await act(async () => back.props.onClick())
  }

  assert.deepEqual(navigated, ['operation', 'payments', 'cancellations', 'finance'])
})

test('printing header uses the same back control and returns to settings home', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  const [{ default: SettingsSurface }, { PolicyEditingContext }, { ThemeProvider }] = await Promise.all([
    h.load('/src/app/surfaces/settings/SettingsSurface.jsx'),
    h.load('/src/app/policy-editing/policyEditingContext.js'),
    h.load('/src/app/shell/theme/ThemeProvider.jsx'),
  ])
  const navigations = []
  const policyEditing = {
    resources: {}, load() {}, edit() {}, save() {}, discard() {}, reconcile() {}, reviewConflict() {},
    activeConflict: null, acceptActiveConflict() {}, dismissActiveConflict() {}, reset() {},
  }
  const screen = await h.render(ThemeProvider, { children: React.createElement(PolicyEditingContext.Provider, { value: policyEditing }, React.createElement(SettingsSurface, {
    section: 'settings-printing',
    printing: { localStation: { id: 'station-1', platform: 'windows' }, transportKind: 'central', jobs: [] },
    granted: new Set(['printing.settings.view', 'printing.station.view']),
    implemented: new Set(['settings-home', 'settings-printing']),
    onNavigate: (target) => navigations.push(target),
    soundEnabled: true,
    onSoundEnabledChange() {},
    onSuccessMessage() {},
  })) })

  const back = buttonNamed(screen.root, 'Voltar para Configurações')
  assert.ok(back)
  assert.match(nodeText(back), /←\s*Configurações/)
  await act(async () => back.props.onClick())
  assert.deepEqual(navigations, ['settings-home'])
})

test('activation controls share one switch contract while preserving each business rule', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: OperationSettings }, { default: PaymentSettings }, { default: CancellationSettings }, { default: FinanceCategorySettings }] = await Promise.all([
    h.load('/src/app/surfaces/settings/OperationSettings.jsx'),
    h.load('/src/domains/finance/ui/settings/PaymentSettings.jsx'),
    h.load('/src/app/surfaces/settings/CancellationSettings.jsx'),
    h.load('/src/domains/finance/ui/settings/FinanceCategorySettings.jsx'),
  ])

  const operation = await h.render(OperationSettings, {
    resourceState: operationState(), onEdit() {}, onSave() {}, onDiscard() {}, onNavigateHome() {},
  })
  const modality = findSwitch(operation.root, 'Entrega')
  assert.equal(modality.props.role, 'switch')
  assert.match(modality.props.className, /settings-switch/)
  assert.equal(modality.props.disabled, true, 'default modality stays protected')

  const paymentEdits = []
  const payment = await h.render(PaymentSettings, {
    resourceState: paymentState(), onEdit: (draft) => paymentEdits.push(draft), onSave() {}, onDiscard() {}, onNavigateHome() {},
  })
  const pix = findSwitch(payment.root, 'pix')
  const cash = findSwitch(payment.root, 'cash')
  assert.equal(pix.props.disabled, true, 'default payment stays protected')
  assert.equal(cash.props['aria-checked'], true)
  assert.equal(buttonNamed(payment.root.findByProps({ 'data-payment-code': 'cash' }), 'Desativar'), undefined)
  await act(async () => cash.props.onClick())
  assert.equal(paymentEdits.at(-1).methods.find((item) => item.code === 'cash').active, false)

  const cancellationEdits = []
  const cancellation = await h.render(CancellationSettings, {
    resourceState: cancellationState(), onEdit: (draft) => cancellationEdits.push(draft), onSave() {}, onDiscard() {}, onNavigateHome() {},
  })
  const other = findSwitch(cancellation.root, 'other')
  const duplicate = findSwitch(cancellation.root, 'duplicate_order')
  assert.equal(other.props.disabled, true, 'Outro stays protected and active')
  assert.equal(buttonNamed(cancellation.root.findByProps({ 'data-cancellation-id': 'duplicate_order' }), 'Desativar'), undefined)
  await act(async () => duplicate.props.onClick())
  assert.equal(cancellationEdits.at(-1).items.find((item) => item.id === 'duplicate_order').active, false)

  const financeEdits = []
  const finance = await h.render(FinanceCategorySettings, {
    resourceState: financeState(), onEdit: (draft) => financeEdits.push(draft), onSave() {}, onDiscard() {}, onNavigateHome() {},
  })
  const contribution = findSwitch(finance.root, 'contribution')
  assert.equal(contribution.props.role, 'switch')
  assert.equal(buttonNamed(finance.root.findByProps({ 'data-finance-category-id': 'contribution' }), 'Desativar'), undefined)
  await act(async () => contribution.props.onClick())
  assert.equal(financeEdits.at(-1).items.find((item) => item.id === 'contribution').active, false)
})
