import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { readFile } from 'node:fs/promises'

import { buttonNamed, nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

const paymentData = () => ({
  methods: [
    { code: 'pix', active: true, sortOrder: 0 },
    { code: 'cash', active: true, sortOrder: 1 },
    { code: 'debit_card', active: true, sortOrder: 2 },
    { code: 'credit_card', active: true, sortOrder: 3 },
    { code: 'transfer', active: true, sortOrder: 4 },
    { code: 'other', active: true, sortOrder: 5 },
  ],
  defaultMethod: 'pix',
})

const resourceState = (data = paymentData(), extra = {}) => ({
  status: 'ready',
  confirmed: { resource: 'paymentMethods', revision: 1, data },
  base: { resource: 'paymentMethods', revision: 1, data },
  draft: structuredClone(data),
  dirty: false,
  ...extra,
})

async function renderEditable(h, PaymentSettings, initial = resourceState()) {
  const edits = []
  let saves = 0
  function Editor() {
    const [state, setState] = React.useState(initial)
    return React.createElement(PaymentSettings, {
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

const row = (root, code) => root.findByProps({ 'data-payment-code': code })

test('renders the approved payment administration composition for the six native methods', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PaymentSettings } = await h.load('/src/pages/PaymentSettings.jsx')
  const screen = await h.render(PaymentSettings, {
    resourceState: resourceState(), readOnly: false, onEdit() {}, onSave() {}, onDiscard() {},
  })

  assert.deepEqual(
    screen.root.findAll((node) => node.props?.['data-payment-code']).map((node) => node.props['data-payment-code']),
    ['pix', 'cash', 'debit_card', 'credit_card', 'transfer', 'other'],
  )
  assert.match(nodeText(screen.root), /Pix.*Dinheiro.*Cartão de débito.*Cartão de crédito.*Transferência.*Outro/s)
  assert.match(nodeText(screen.root), /Configurações.*Formas de pagamento.*Gerencie os métodos de pagamento aceitos no seu delivery/s)
  assert.match(nodeText(screen.root), /Os métodos nativos não podem ser renomeados.*As alterações realizadas serão aplicadas após salvar/s)
  assert.ok(buttonNamed(screen.root, 'Adicionar forma'))
  assert.equal(screen.root.findByProps({ role: 'table', 'aria-label': 'Formas de pagamento' }).props.role, 'table')
  assert.match(nodeText(screen.root), /ORDEM.*FORMA.*STATUS.*PADRÃO.*AÇÕES/s)
  assert.match(nodeText(row(screen.root, 'pix')), /Pagamento instantâneo.*Ativo.*Padrão/s)
  assert.match(nodeText(row(screen.root, 'cash')), /Pagamento na entrega.*Ativo/s)
  assert.match(nodeText(row(screen.root, 'debit_card')), /Visa, Mastercard, Elo e outros/s)
  assert.match(nodeText(row(screen.root, 'transfer')), /TED, DOC ou transferência bancária/s)
  assert.equal(screen.root.findAll((node) => node.props?.['data-payment-drag-handle']).length, 6)
  assert.equal(screen.root.findAll((node) => node.props?.['data-payment-actions']).length, 6)
  assert.doesNotMatch(nodeText(screen.root), /Renomear|Excluir/i)
})

test('activation and default actions never create an impossible draft or autosave', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PaymentSettings } = await h.load('/src/pages/PaymentSettings.jsx')
  const fixture = await renderEditable(h, PaymentSettings)

  assert.equal(buttonNamed(row(fixture.screen.root, 'pix'), 'Desativar').props.disabled, true)
  assert.match(nodeText(row(fixture.screen.root, 'pix')), /padrão/i)
  await act(async () => buttonNamed(row(fixture.screen.root, 'cash'), 'Definir como padrão').props.onClick())
  assert.equal(fixture.edits.at(-1).defaultMethod, 'cash')
  assert.equal(fixture.edits.at(-1).methods.find((item) => item.code === 'cash').active, true)
  await act(async () => buttonNamed(row(fixture.screen.root, 'pix'), 'Desativar').props.onClick())
  assert.equal(fixture.edits.at(-1).methods.find((item) => item.code === 'pix').active, false)
  assert.equal(fixture.edits.at(-1).defaultMethod, 'cash')
  await act(async () => buttonNamed(row(fixture.screen.root, 'pix'), 'Ativar').props.onClick())
  assert.equal(fixture.edits.at(-1).methods.find((item) => item.code === 'pix').active, true)
  assert.equal(fixture.saves(), 0, 'draft actions must not autosave')

  const onlyCash = paymentData()
  onlyCash.defaultMethod = 'cash'
  onlyCash.methods = onlyCash.methods.map((item) => ({ ...item, active: item.code === 'cash' }))
  const last = await renderEditable(h, PaymentSettings, resourceState(onlyCash))
  assert.equal(buttonNamed(row(last.screen.root, 'cash'), 'Desativar').props.disabled, true)
  assert.equal(last.edits.length, 0)
})

test('controller-blocked states disable payment actions and reorder shortcuts', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PaymentSettings } = await h.load('/src/pages/PaymentSettings.jsx')
  const screen = await h.render(PaymentSettings, {
    resourceState: resourceState(paymentData(), { status: 'saving', dirty: true }),
    readOnly: false, onEdit() { throw new Error('saving state must not edit') }, onSave() {}, onDiscard() {},
  })

  assert.equal(buttonNamed(row(screen.root, 'cash'), 'Desativar').props.disabled, true)
  assert.equal(row(screen.root, 'cash').props.onKeyDown, undefined)
})

test('reorders by explicit action and Alt+Arrow keyboard without changing identities', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PaymentSettings } = await h.load('/src/pages/PaymentSettings.jsx')
  const fixture = await renderEditable(h, PaymentSettings)

  await act(async () => buttonNamed(row(fixture.screen.root, 'cash'), 'Mover para cima').props.onClick())
  assert.deepEqual(fixture.edits.at(-1).methods.map((item) => item.code), ['cash', 'pix', 'debit_card', 'credit_card', 'transfer', 'other'])
  assert.deepEqual(fixture.edits.at(-1).methods.map((item) => item.sortOrder), [0, 1, 2, 3, 4, 5])

  const debit = row(fixture.screen.root, 'debit_card')
  let prevented = false
  await act(async () => debit.props.onKeyDown({ altKey: true, key: 'ArrowUp', preventDefault() { prevented = true } }))
  assert.equal(prevented, true)
  assert.deepEqual(fixture.edits.at(-1).methods.map((item) => item.code), ['cash', 'debit_card', 'pix', 'credit_card', 'transfer', 'other'])
})

test('the drag handle is the only pointer reorder affordance and changes only the draft', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PaymentSettings } = await h.load('/src/pages/PaymentSettings.jsx')
  const fixture = await renderEditable(h, PaymentSettings)
  const cash = row(fixture.screen.root, 'cash')
  const handle = cash.findByProps({ 'data-payment-drag-handle': 'cash' })

  assert.equal(cash.props.draggable, undefined)
  assert.equal(handle.props['aria-label'], 'Reordenar Dinheiro')
  assert.equal(handle.props.draggable, true)
  assert.equal(typeof handle.props.onPointerDown, 'function')
  await act(async () => handle.props.onDragStart({ dataTransfer: { effectAllowed: '' } }))
  await act(async () => row(fixture.screen.root, 'pix').props.onDrop({ preventDefault() {} }))
  assert.deepEqual(fixture.edits.at(-1).methods.map((item) => item.code), ['cash', 'pix', 'debit_card', 'credit_card', 'transfer', 'other'])
  assert.equal(fixture.saves(), 0)
})

test('read-only uses the shared shell and exposes no editing actions', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PaymentSettings } = await h.load('/src/pages/PaymentSettings.jsx')
  const screen = await h.render(PaymentSettings, {
    resourceState: resourceState(), readOnly: true,
    onEdit() { throw new Error('read-only must not edit') },
    onSave() { throw new Error('read-only must not save') }, onDiscard() {},
  })
  assert.match(nodeText(screen.root), /Somente leitura/)
  assert.equal(buttonNamed(screen.root, 'Salvar alterações'), undefined)
  assert.equal(buttonNamed(screen.root, 'Ativar'), undefined)
  assert.equal(buttonNamed(screen.root, 'Desativar'), undefined)
})

test('mobile payment settings change to cards at the shell breakpoint and keep the real theme tokens', async (t) => {
  const css = await readFile(new URL('../payment-settings.css', import.meta.url), 'utf8')
  assert.match(css, /\.payment-settings-table/)
  assert.match(css, /@media \(max-width: 820px\) \{[\s\S]*?\.payment-settings-table-head[^}]*display:\s*none/)
  assert.doesNotMatch(css, /\.payment-settings[^{]*{[^}]*(?:#[0-9a-f]{3,8}|rgb\()/i)

  const h = await workspaceHarness(t, { mobile: true })
  const { default: PaymentSettings } = await h.load('/src/pages/PaymentSettings.jsx')
  const screen = await h.render(PaymentSettings, {
    resourceState: resourceState(), readOnly: false, onEdit() {}, onSave() {}, onDiscard() {},
  })
  assert.equal(screen.root.findAllByType('table').length, 0)
  assert.equal(screen.root.findAll((node) => node.props?.['data-payment-code']).length, 6)
})

test('payment save confirms only after success and Cancel discards then returns to settings home', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  const [{ default: Settings }, { ThemeProvider }] = await Promise.all([
    h.load('/src/pages/Settings.jsx'), h.load('/src/components/ThemeProvider.jsx'),
  ])
  const messages = []
  const calls = []
  let saved = true
  const controller = {
    resources: { paymentMethods: { ...resourceState(), dirty: true } },
    load() {}, edit() {}, reconcile() {}, reviewConflict() {},
    save: async () => saved,
    discard: () => calls.push('discard'),
  }
  const Page = () => React.createElement(ThemeProvider, null, React.createElement(Settings, {
    section: 'settings-payments', settings: {}, printing: {},
    granted: new Set(['payments.settings.view', 'payments.settings.manage']),
    implemented: new Set(['settings-home', 'settings-payments']), onNavigate: (destination) => calls.push(destination),
    soundEnabled: true, onSoundEnabledChange() {}, businessSettings: controller,
    onSuccessMessage: (message) => messages.push(message),
  }))
  const screen = await h.render(Page)

  await act(async () => buttonNamed(screen.root, 'Salvar alterações').props.onClick())
  assert.deepEqual(messages, ['Configurações de pagamento salvas com sucesso'])
  saved = false
  await act(async () => buttonNamed(screen.root, 'Salvar alterações').props.onClick())
  assert.equal(messages.length, 1)
  await act(async () => buttonNamed(screen.root, 'Cancelar').props.onClick())
  assert.deepEqual(calls, ['discard', 'settings-home'])
})

test('settings route loads and edits the single paymentMethods controller resource', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  const [{ default: Settings }, { ThemeProvider }] = await Promise.all([
    h.load('/src/pages/Settings.jsx'), h.load('/src/components/ThemeProvider.jsx'),
  ])
  const loaded = []
  const edited = []
  const controller = {
    resources: { paymentMethods: resourceState() },
    load: (resource) => loaded.push(resource),
    edit: (resource, draft) => edited.push([resource, draft]),
    save() {}, discard() {}, reconcile() {}, reviewConflict() {},
  }
  const Page = () => React.createElement(ThemeProvider, null, React.createElement(Settings, {
    section: 'settings-payments', settings: {}, printing: {},
    granted: new Set(['payments.settings.view', 'payments.settings.manage']),
    implemented: new Set(['settings-payments']), onNavigate() {},
    soundEnabled: true, onSoundEnabledChange() {}, businessSettings: controller,
  }))
  const screen = await h.render(Page)
  assert.deepEqual(loaded, ['paymentMethods'])
  await act(async () => buttonNamed(row(screen.root, 'cash'), 'Definir como padrão').props.onClick())
  assert.equal(edited.at(-1)[0], 'paymentMethods')
  assert.equal(edited.at(-1)[1].defaultMethod, 'cash')
})
