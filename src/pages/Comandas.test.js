import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { getEventListeners } from 'node:events'
import { workspaceHarness, workspaceTables, nodeText, buttonNamed } from '../test-support/renderWorkspace.js'
import { comandaDetail, deferred, detailResponse } from '../test-support/comandaFixtures.js'

const currency = (value) => `R$ ${value.toFixed(2)}`
const list = (renderer) => renderer.root.findByProps({ 'aria-label': 'Mesas ativas' })
const detail = (renderer) => renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' })
const tableTabDocument = (overrides = {}) => ({
  type: 'table-tab', business: { name: 'Restaurante' },
  tableTab: { id: 'tab-42', number: 42, tableName: 'Mesa 7' },
  items: [{ name: 'X-Bacon', presentation: 'Grande', note: 'Sem cebola', quantity: 3, lineTotalCents: 7500 }],
  financial: { totalCents: 12345 },
  message: 'PR\u00c9-CONTA \u2014 N\u00c3O \u00c9 COMPROVANTE DE PAGAMENTO',
  ...overrides,
})

test('detail loading, actionable error and retry never pass list totals off as payable detail', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  const pending = deferred()
  globalThis.fetch = () => pending.promise
  const r = await h.render(Comandas, { tables: workspaceTables, selectedTableId: 'occupied', currency })
  assert.match(nodeText(detail(r)), /Carregando/)
  assert.equal(buttonNamed(detail(r), 'Registrar pagamento'), undefined)
  await act(async () => pending.reject(new Error('Falha de rede')))
  assert.match(nodeText(detail(r)), /Falha de rede/)
  assert.ok(detail(r).findByProps({ role: 'alert' }))
  globalThis.fetch = async () => detailResponse()
  await act(async () => buttonNamed(detail(r), 'Tentar novamente').props.onClick())
  assert.match(nodeText(detail(r)), /Sem cebola/)
})

for (const mobile of [false, true]) test(`new selection and same-total official refresh ignore old detail success/error (${mobile})`, async (t) => {
  const h = await workspaceHarness(t, { mobile })
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  const pending = []
  globalThis.fetch = (path) => { const p = deferred(); pending.push({ ...p, path }); return p.promise }
  const tables = [...workspaceTables, { id: 'other', name: 'Terraço', isActive: true, occupancy: 'occupied', sortOrder: 4, openTableTab: { id: 'tab-43', number: 43, itemCount: 3, orderCount: 2, totalCents: 12345 } }]
  function Workspace({ tables }) {
    const [selectedTableId, onSelectTable] = React.useState('occupied')
    return React.createElement(Comandas, { tables, selectedTableId, onSelectTable, currency })
  }
  const r = await h.render(Workspace, { tables })
  assert.equal(pending[0]?.path, '/api/table-tabs/tab-42')
  await act(async () => list(r).findAllByType('button').at(-1).props.onClick())
  assert.equal(pending[1]?.path, '/api/table-tabs/tab-43')
  const other = { ...comandaDetail, id: 'tab-43', number: 43, table: { id: 'other', name: 'Terraço' }, items: [{ ...comandaDetail.items[0], note: 'Sem sal' }] }
  await act(async () => pending[1].resolve(detailResponse(other)))
  await act(async () => pending[0].resolve(detailResponse()))
  assert.match(nodeText(detail(r)), /Comanda 43.*Terraço.*Sem sal/)
  assert.doesNotMatch(nodeText(detail(r)), /Sem cebola/)
  await act(async () => r.update(React.createElement(Workspace, { tables: [...tables] })))
  assert.equal(pending.length, 3, 'same-total official refresh must refresh notes/options too')
  assert.doesNotMatch(nodeText(detail(r)), /Atualizando comanda/)
  assert.equal(buttonNamed(detail(r), 'Registrar pagamento').props.disabled, false)
  await act(async () => r.update(React.createElement(Workspace, { tables: [...tables] })))
  assert.equal(pending.length, 3, 'same-comanda refresh signals coalesce while a request is pending')
  await act(async () => pending[2].reject(new Error('Erro antigo')))
  assert.equal(pending.length, 4)
  await act(async () => pending[3].resolve(detailResponse({ ...other, items: [{ ...other.items[0], note: 'Molho separado' }] })))
  assert.match(nodeText(detail(r)), /Molho separado/)
  assert.doesNotMatch(nodeText(detail(r)), /Erro antigo/)
})

for (const kind of ['closed', 'foreign', 'transferred', 'replaced']) test(`unavailable ${kind} detail cannot expose writes or overwrite current selection`, async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  globalThis.fetch = async () => kind === 'foreign'
    ? { ok: false, status: 404, json: async () => ({ error: { message: 'Comanda aberta não encontrada.' } }) }
    : detailResponse({ ...comandaDetail, ...(kind === 'closed' ? { status: 'closed' } : kind === 'transferred' ? { table: { id: 'other', name: 'Mesa externa' } } : { id: 'replacement' }) })
  const r = await h.render(Comandas, { tables: workspaceTables, selectedTableId: 'occupied', currency })
  assert.ok(detail(r).findByProps({ role: 'alert' }))
  assert.equal(buttonNamed(detail(r), 'Registrar pagamento'), undefined)
  assert.doesNotMatch(nodeText(detail(r)), /Sem cebola|Mesa externa/)
})

test('active tables retain official ordering, textual occupancy and stable comanda summaries', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const renderer = await harness.render(Comandas, { tables: workspaceTables, currency })
  const cards = list(renderer).findAllByType('button')
  assert.equal(cards.length, 2)
  assert.match(nodeText(cards[0]), /Mesa 7.*Ocupada.*Comanda 42.*3 itens.*R\$ 123.45/)
  assert.match(nodeText(cards[1]), /Varanda.*Livre.*Toque para lançar pedido/)
  assert.match(nodeText(detail(renderer)), /Selecione uma mesa ocupada/)
  assert.equal(workspaceTables[0].id, 'free')
})

test('free tables request an order; blocked writes still allow occupied-table consultation', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const orders = [], selections = []
  const props = { tables: workspaceTables, currency, onAddOrder: (id) => orders.push(id), onSelectTable: (id) => selections.push(id) }
  const renderer = await harness.render(Comandas, props)
  await act(async () => list(renderer).findAllByType('button')[1].props.onClick())
  assert.deepEqual(orders, ['free'])
  assert.deepEqual(selections, [])
  await act(async () => renderer.update(React.createElement(Comandas, { ...props, disabled: true })))
  const [occupied, free] = list(renderer).findAllByType('button')
  assert.equal(free.props.disabled, true)
  assert.ok(!occupied.props.disabled)
  await act(async () => { free.props.onClick(); occupied.props.onClick() })
  assert.deepEqual(orders, ['free'])
  assert.deepEqual(selections, ['occupied'])
})

test('mobile back restores list scroll and focus without clearing selection; the same table reopens', async (t) => {
  const harness = await workspaceHarness(t, { mobile: true })
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const listElement = { scrollTop: 0 }
  let focus = ''
  function Workspace() {
    const [selectedTableId, onSelectTable] = React.useState(null)
    return React.createElement(Comandas, { tables: workspaceTables, selectedTableId, onSelectTable, currency })
  }
  const renderer = await harness.render(Workspace, {}, { createNodeMock: (element) => {
    if (element.props['aria-label'] === 'Mesas ativas') return listElement
    return { focus: () => { focus = element.type } }
  } })
  listElement.scrollTop = 240
  await act(async () => list(renderer).props.onScroll({ currentTarget: listElement }))
  await act(async () => list(renderer).findAllByType('button')[0].props.onClick())
  assert.ok(renderer.toJSON().props.className.includes('has-mobile-detail'))
  assert.match(nodeText(detail(renderer)), /Comanda 42.*Mesa 7.*3 itens.*R\$ 123.45/)
  assert.equal(focus, 'h2')
  listElement.scrollTop = 0 // Hiding a scroll container can reset its offset.
  await act(async () => buttonNamed(renderer.root, 'Voltar para mesas').props.onClick())
  assert.ok(!renderer.toJSON().props.className.includes('has-mobile-detail'))
  assert.equal(listElement.scrollTop, 240)
  assert.equal(focus, 'button')
  assert.equal(list(renderer).findAllByType('button')[0].props['aria-pressed'], true)
  await act(async () => list(renderer).findAllByType('button')[0].props.onClick())
  assert.ok(renderer.toJSON().props.className.includes('has-mobile-detail'))
})

test('official refresh updates totals and clears obsolete detail when a table becomes free or inactive', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const props = { tables: workspaceTables, selectedTableId: 'occupied', currency }
  const renderer = await harness.render(Comandas, props)
  const updated = workspaceTables.map((table) => table.id === 'occupied' ? { ...table, openTableTab: { ...table.openTableTab, itemCount: 1, totalCents: 2500 } } : table)
  globalThis.fetch = async () => detailResponse({ ...comandaDetail, itemCount: 1, totalCents: 2500 })
  await act(async () => renderer.update(React.createElement(Comandas, { ...props, tables: updated })))
  assert.match(nodeText(detail(renderer)), /Comanda 42.*1 item.*R\$ 25.00/)
  for (const change of [{ occupancy: 'free', openTableTab: null }, { isActive: false }]) {
    await act(async () => renderer.update(React.createElement(Comandas, { ...props, tables: workspaceTables.map((table) => ({ ...table, ...change })) })))
    assert.match(nodeText(detail(renderer)), /Selecione uma mesa ocupada/)
    assert.ok(!renderer.toJSON().props.className.includes('has-mobile-detail'))
  }
})

test('empty workspace announces absence of active tables', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const renderer = await harness.render(Comandas)
  assert.match(nodeText(renderer.root.findByProps({ role: 'status' })), /Nenhuma mesa ativa/)
})

test('ticket preview uses the canonical document and closes without changing the selected comanda', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  const calls = []
  const printing = {
    getTableTabPreviewDocument: async (id) => { calls.push(id); return tableTabDocument() },
    printTableTab: async () => assert.fail('preview must not print'),
  }
  h.document.body.style.overflow = 'scroll'
  const r = await h.render(Comandas, { tables: workspaceTables, selectedTableId: 'occupied', currency, printing })

  await act(async () => buttonNamed(detail(r), 'Ver ticket').props.onClick())
  assert.deepEqual(calls, ['tab-42'])
  assert.match(nodeText(r.root.findByProps({ role: 'dialog' })).replace(/\u00a0/g, ' '), /Restaurante.*PR\u00c9-CONTA.*COMANDA #42.*Mesa 7.*3x X-Bacon Grande.*Sem cebola.*R\$ 123,45/)
  assert.equal(h.document.body.style.overflow, 'hidden')
  await act(async () => buttonNamed(r.root.findByProps({ role: 'dialog' }), 'Fechar').props.onClick())
  assert.equal(r.root.findAllByProps({ role: 'dialog' }).length, 0)
  assert.equal(h.document.body.style.overflow, 'scroll')
  assert.match(nodeText(detail(r)), /Comanda 42.*Mesa 7/)
})

test('preview failure is actionable and retry opens only the successful canonical snapshot', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  let attempts = 0
  const printing = {
    getTableTabPreviewDocument: async () => {
      attempts += 1
      if (attempts === 1) throw new Error('N\u00e3o foi poss\u00edvel atualizar o ticket')
      return tableTabDocument({ items: [{ name: 'Suco', presentation: '500 ml', note: 'Sem gelo', quantity: 1, lineTotalCents: 12345 }] })
    },
    printTableTab: async () => {},
  }
  const r = await h.render(Comandas, { tables: workspaceTables, selectedTableId: 'occupied', currency, printing })

  await act(async () => buttonNamed(detail(r), 'Ver ticket').props.onClick())
  assert.match(nodeText(detail(r)), /N\u00e3o foi poss\u00edvel atualizar o ticket/)
  assert.match(nodeText(detail(r)), /Comanda 42.*Mesa 7/)
  await act(async () => buttonNamed(detail(r), 'Ver ticket').props.onClick())
  assert.match(nodeText(r.root.findByProps({ role: 'dialog' })), /1x Suco 500 ml.*Sem gelo/)
  assert.equal(attempts, 2)
})

test('manual print suppresses duplicates, preserves the open tab on failure, and retries successfully', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  const first = deferred()
  let attempts = 0
  const printing = {
    getTableTabPreviewDocument: async () => tableTabDocument(),
    printTableTab: (id) => {
      assert.equal(id, 'tab-42')
      attempts += 1
      return attempts === 1 ? first.promise : Promise.resolve({ status: 'printed', copiesPrinted: 1 })
    },
  }
  const r = await h.render(Comandas, { tables: workspaceTables, selectedTableId: 'occupied', currency, printing })
  const print = buttonNamed(detail(r), 'Imprimir comanda')
  await act(async () => {
    const pending = print.props.onClick()
    print.props.onClick()
    first.reject(new Error('Impressora desconectada'))
    await pending
  })
  assert.equal(attempts, 1)
  assert.match(nodeText(detail(r)), /Impressora desconectada/)
  assert.match(nodeText(detail(r)), /Comanda 42.*Mesa 7/)

  await act(async () => buttonNamed(detail(r), 'Imprimir comanda').props.onClick())
  assert.equal(attempts, 2)
  assert.match(nodeText(detail(r)), /Comanda enviada para a fila de impress\u00e3o/)
  assert.match(nodeText(detail(r)), /Comanda 42.*Mesa 7/)
})

test('late preview and print results cannot affect a newer selected tab or clear its busy action', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  const previews = [deferred(), deferred()]
  const prints = [deferred(), deferred()]
  let previewIndex = 0
  let printIndex = 0
  const tables = [...workspaceTables, { id: 'other', name: 'Terra\u00e7o', isActive: true, occupancy: 'occupied', sortOrder: 4, openTableTab: { id: 'tab-43', number: 43, itemCount: 1, totalCents: 5000 } }]
  globalThis.fetch = async (path) => detailResponse(path.endsWith('tab-43') ? { ...comandaDetail, id: 'tab-43', number: 43, table: { id: 'other', name: 'Terra\u00e7o' } } : comandaDetail)
  const printing = {
    getTableTabPreviewDocument: () => previews[previewIndex++].promise,
    printTableTab: () => prints[printIndex++].promise,
  }
  function Workspace() {
    const [selectedTableId, onSelectTable] = React.useState('occupied')
    return React.createElement(Comandas, { tables, selectedTableId, onSelectTable, currency, printing })
  }
  const r = await h.render(Workspace)
  let oldPreview
  await act(async () => { oldPreview = buttonNamed(detail(r), 'Ver ticket').props.onClick(); await Promise.resolve() })
  await act(async () => list(r).findAllByType('button').at(-1).props.onClick())
  let currentPrint
  await act(async () => { currentPrint = buttonNamed(detail(r), 'Imprimir comanda').props.onClick(); await Promise.resolve() })
  await act(async () => previews[0].resolve(tableTabDocument()))
  await oldPreview
  assert.equal(r.root.findAllByProps({ role: 'dialog' }).length, 0)
  assert.ok(buttonNamed(detail(r), 'Imprimir comanda').props.disabled, 'late old result must not release the newer action')
  await act(async () => prints[0].resolve({ status: 'printed', copiesPrinted: 1 }))
  await currentPrint
  assert.match(nodeText(detail(r)), /Comanda enviada para a fila de impress\u00e3o/)
  assert.match(nodeText(detail(r)), /Comanda 43.*Terra\u00e7o/)
})

test('late preview rejection after selection replacement cannot show an error or expire the session', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  const pending = deferred()
  const sessionErrors = []
  const tables = [...workspaceTables, { id: 'other', name: 'Terra\u00e7o', isActive: true, occupancy: 'occupied', sortOrder: 4, openTableTab: { id: 'tab-43', number: 43, itemCount: 1, totalCents: 5000 } }]
  globalThis.fetch = async (path) => detailResponse(path.endsWith('tab-43') ? { ...comandaDetail, id: 'tab-43', number: 43, table: { id: 'other', name: 'Terra\u00e7o' } } : comandaDetail)
  const printing = { getTableTabPreviewDocument: () => pending.promise, printTableTab: async () => ({ status: 'printed' }) }
  function Workspace() {
    const [selectedTableId, onSelectTable] = React.useState('occupied')
    return React.createElement(Comandas, { tables, selectedTableId, onSelectTable, currency, printing, onApiError: (error) => sessionErrors.push(error) })
  }
  const r = await h.render(Workspace)
  let oldPreview
  await act(async () => { oldPreview = buttonNamed(detail(r), 'Ver ticket').props.onClick(); await Promise.resolve() })
  await act(async () => list(r).findAllByType('button').at(-1).props.onClick())
  const staleError = Object.assign(new Error('Sess\u00e3o antiga'), { status: 401 })
  await act(async () => pending.reject(staleError))
  await oldPreview

  assert.deepEqual(sessionErrors, [])
  assert.doesNotMatch(nodeText(detail(r)), /Sess\u00e3o antiga/)
  assert.match(nodeText(detail(r)), /Comanda 43.*Terra\u00e7o/)
})

test('tab replacement closes its old preview and releases that overlay lock', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  const printing = { getTableTabPreviewDocument: async () => tableTabDocument(), printTableTab: async () => ({ status: 'printed' }) }
  h.document.body.style.overflow = 'scroll'
  const props = { tables: workspaceTables, selectedTableId: 'occupied', currency, printing }
  const r = await h.render(Comandas, props)
  await act(async () => buttonNamed(detail(r), 'Ver ticket').props.onClick())
  assert.equal(h.document.body.style.overflow, 'hidden')
  const replacedTables = workspaceTables.map((table) => table.id === 'occupied'
    ? { ...table, openTableTab: { ...table.openTableTab, id: 'tab-99', number: 99 } }
    : table)
  globalThis.fetch = async () => detailResponse({ ...comandaDetail, id: 'tab-99', number: 99 })
  await act(async () => r.update(React.createElement(Comandas, { ...props, tables: replacedTables })))
  assert.equal(r.root.findAllByProps({ role: 'dialog' }).length, 0)
  assert.equal(h.document.body.style.overflow, 'scroll')
})

test('preview and payment overlays release only their own shared scroll locks', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  const printing = { getTableTabPreviewDocument: async () => tableTabDocument(), printTableTab: async () => ({ status: 'printed' }) }
  h.document.body.style.overflow = 'auto'
  const r = await h.render(Comandas, { tables: workspaceTables, selectedTableId: 'occupied', currency, printing, onPay: async () => true })
  await act(async () => buttonNamed(detail(r), 'Ver ticket').props.onClick())
  await act(async () => buttonNamed(detail(r), 'Registrar pagamento').props.onClick())
  assert.equal(r.root.findAllByProps({ role: 'dialog' }).length, 2)
  assert.equal(h.document.body.style.overflow, 'hidden')
  await act(async () => buttonNamed(r.root.findAllByProps({ role: 'dialog' })[0], 'Fechar').props.onClick())
  assert.equal(r.root.findAllByProps({ role: 'dialog' }).length, 1)
  assert.equal(h.document.body.style.overflow, 'hidden')
  await act(async () => buttonNamed(r.root.findByProps({ role: 'dialog' }), 'Fechar').props.onClick())
  assert.equal(h.document.body.style.overflow, 'auto')
})

// DOM boundary for focus/containment. Targets are derived from rendered host nodes;
// no component state or handlers are replaced.
function focusDOM(harness) {
  let renderer
  const nodes = new Map()
  const text = (children) => React.Children.toArray(children).map((child) => typeof child === 'object' ? text(child.props.children) : child).join('')
  const keyFor = (type, props) => `${type}:${props['aria-label'] || workspaceTables.find((table) => text(props.children).startsWith(table.name))?.name || text(props.children)}`
  const host = (type, props) => {
    const key = keyFor(type, props)
    if (!nodes.has(key)) nodes.set(key, {
      key, scrollTop: 0, focus() {
        harness.document.activeElement = this
        renderer?.root.findAll((element) => element.type === 'div' && element.props.onFocusCapture)[0]?.props.onFocusCapture({ target: this })
      },
      get disabled() {
        const current = renderer?.root.findAllByType(type).find((element) => keyFor(type, element.props) === key)
        return Boolean((current?.props || props).disabled)
      },
    })
    const node = nodes.get(key)
    node.contains = (target) => type === 'section' && renderer && list(renderer).findAllByType('button').some((button) => host(button.type, button.props) === target)
    node.querySelector = () => {
      const button = list(renderer).findAllByType('button').find((button) => !button.props.disabled)
      return button ? host(button.type, button.props) : null
    }
    return node
  }
  return {
    options: { createNodeMock: (element) => host(element.type, element.props) },
    attach(value) { renderer = value },
    node: (element) => host(element.type, element.props),
    active: () => harness.document.activeElement,
  }
}

for (const invalidation of ['free', 'inactive', 'missing', 'blocked-free', 'empty']) {
  test(`mobile refresh ${invalidation} restores available list focus and never reopens on reoccupation`, async (t) => {
    const harness = await workspaceHarness(t, { mobile: true })
    const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
    const dom = focusDOM(harness)
    const selections = []
    function Workspace({ tables, disabled }) {
      const [selectedTableId, setSelectedTableId] = React.useState(null)
      return React.createElement(Comandas, { tables, currency, disabled, selectedTableId, onSelectTable: (id) => { selections.push(id); setSelectedTableId(id) } })
    }
    const renderer = await harness.render(Workspace, { tables: workspaceTables }, dom.options)
    dom.attach(renderer)
    const listElement = dom.node(list(renderer))
    listElement.scrollTop = 240
    await act(async () => list(renderer).findAllByType('button')[0].props.onClick())
    assert.equal(dom.active(), dom.node(detail(renderer).findByType('h2')))
    const tables = invalidation === 'empty' ? [] : workspaceTables.flatMap((table) => {
      if (table.id !== 'occupied') return [table]
      if (invalidation === 'missing') return []
      return [{ ...table, ...(invalidation === 'inactive' ? { isActive: false } : { occupancy: 'free', openTableTab: null }) }]
    })
    listElement.scrollTop = 0
    await act(async () => renderer.update(React.createElement(Workspace, { tables, disabled: invalidation === 'blocked-free' })))
    assert.ok(!renderer.toJSON().props.className.includes('has-mobile-detail'))
    const available = list(renderer).findAllByType('button').find((button) => !button.props.disabled)
    assert.equal(dom.active()?.key, dom.node(available || list(renderer)).key, 'focus must return to a visible enabled card, or the list when none are available')
    assert.equal(listElement.scrollTop, 240)
    if (!available) assert.equal(list(renderer).props.tabIndex, -1)
    const focusAfterInvalidation = dom.active()
    await act(async () => renderer.update(React.createElement(Workspace, { tables: workspaceTables })))
    assert.ok(!renderer.toJSON().props.className.includes('has-mobile-detail'), 'reoccupation must wait for a fresh user selection')
    assert.equal(dom.active(), focusAfterInvalidation, 'refresh must not steal focus')
    assert.deepEqual(selections, ['occupied'], 'controlled selection is preserved')
    await act(async () => list(renderer).findAllByType('button')[0].props.onClick())
    assert.ok(renderer.toJSON().props.className.includes('has-mobile-detail'))
    assert.equal(dom.active(), dom.node(detail(renderer).findByType('h2')))
  })
}

test('reoccupation cannot resurrect a mobile detail invalidated by refresh', async (t) => {
  const harness = await workspaceHarness(t, { mobile: true })
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const props = { tables: workspaceTables, currency, selectedTableId: 'occupied' }
  const renderer = await harness.render(Comandas, props)
  await act(async () => renderer.update(React.createElement(Comandas, { ...props, tables: [] })))
  await act(async () => renderer.update(React.createElement(Comandas, props)))
  assert.ok(!renderer.toJSON().props.className.includes('has-mobile-detail'))
})

test('mobile to desktop moves focus off the now-hidden back button', async (t) => {
  const harness = await workspaceHarness(t, { mobile: true })
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const dom = focusDOM(harness)
  const renderer = await harness.render(Comandas, { tables: workspaceTables, currency, selectedTableId: 'occupied' }, dom.options)
  dom.attach(renderer)
  dom.node(buttonNamed(renderer.root, 'Voltar para mesas')).focus()
  await act(async () => harness.setMobile(false))
  assert.equal(dom.active()?.key, dom.node(detail(renderer).findByType('h2')).key)
})

for (const mobile of [false, true]) {
  test(`breakpoint ${mobile ? 'mobile to desktop' : 'desktop to mobile'} restores focus even when CSS blurs before the media event`, async (t) => {
    const harness = await workspaceHarness(t, { mobile })
    const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
    const dom = focusDOM(harness)
    const renderer = await harness.render(Comandas, { tables: workspaceTables, currency, selectedTableId: 'occupied' }, dom.options)
    dom.attach(renderer)
    dom.node(mobile ? buttonNamed(renderer.root, 'Voltar para mesas') : list(renderer).findAllByType('button')[1]).focus()
    harness.document.activeElement = harness.document.body
    await act(async () => harness.setMobile(!mobile))
    assert.equal(dom.active()?.key, dom.node(detail(renderer).findByType('h2')).key)
  })
}

test('breakpoint changes move focus out of the hidden list/back button and preserve back scroll', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const dom = focusDOM(harness)
  const renderer = await harness.render(Comandas, { tables: workspaceTables, currency, selectedTableId: 'occupied' }, dom.options)
  dom.attach(renderer)
  const card = list(renderer).findAllByType('button')[1] // A different table may have keyboard focus.
  dom.node(card).focus()
  const listElement = dom.node(list(renderer))
  listElement.scrollTop = 180
  await act(async () => list(renderer).props.onScroll({ currentTarget: listElement }))
  await act(async () => harness.setMobile(true)) // 821 -> 820
  assert.equal(dom.active()?.key, dom.node(detail(renderer).findByType('h2')).key, 'the desktop table is hidden; focus must enter visible mobile detail')
  const back = buttonNamed(renderer.root, 'Voltar para mesas')
  dom.node(back).focus()
  await act(async () => harness.setMobile(false)) // 820 -> 821
  assert.equal(dom.active()?.key, dom.node(detail(renderer).findByType('h2')).key, 'the back button is hidden; focus must land on the visible detail heading')
  const outside = { key: 'external navigation' }
  harness.document.activeElement = outside
  await act(async () => harness.setMobile(true))
  assert.equal(dom.active(), outside, 'breakpoint changes must not steal unrelated visible focus')
  listElement.scrollTop = 0
  await act(async () => buttonNamed(renderer.root, 'Voltar para mesas').props.onClick())
  assert.equal(listElement.scrollTop, 180)
  assert.equal(dom.active(), dom.node(list(renderer).findAllByType('button')[0]))
  assert.equal(list(renderer).findAllByType('button')[0].props['aria-pressed'], true)
  await act(async () => renderer.unmount())
  assert.equal(getEventListeners(harness.media, 'change').length, 0, 'media subscription must be cleaned up')
})
