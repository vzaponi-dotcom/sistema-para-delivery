import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { getEventListeners } from 'node:events'
import { workspaceHarness, workspaceTables, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'
import { comandaDetail, deferred, detailResponse } from '../../../test-support/comandaFixtures.js'

const currency = (value) => `R$ ${value.toFixed(2)}`
const occupiedSelection = { tableId: 'occupied', tableTabId: 'tab-42' }
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
  const { default: Comandas } = await h.load('/src/domains/table-service/ui/Comandas.jsx')
  const pending = deferred()
  globalThis.fetch = () => pending.promise
  const r = await h.render(Comandas, { tables: workspaceTables, selection: occupiedSelection, currency })
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
  const { default: Comandas } = await h.load('/src/domains/table-service/ui/Comandas.jsx')
  const pending = []
  globalThis.fetch = (path) => { const p = deferred(); pending.push({ ...p, path }); return p.promise }
  const tables = [...workspaceTables, { id: 'other', name: 'Terraço', isActive: true, occupancy: 'occupied', sortOrder: 4, openTableTab: { id: 'tab-43', number: 43, itemCount: 3, orderCount: 2, totalCents: 12345 } }]
  function Workspace({ tables }) {
    const [selection, onSelectComanda] = React.useState(occupiedSelection)
    return React.createElement(Comandas, { tables, selection, onSelectComanda, currency })
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
  const { default: Comandas } = await h.load('/src/domains/table-service/ui/Comandas.jsx')
  globalThis.fetch = async () => kind === 'foreign'
    ? { ok: false, status: 404, json: async () => ({ error: { message: 'Comanda aberta não encontrada.' } }) }
    : detailResponse({ ...comandaDetail, ...(kind === 'closed' ? { status: 'closed' } : kind === 'transferred' ? { table: { id: 'other', name: 'Mesa externa' } } : { id: 'replacement' }) })
  const r = await h.render(Comandas, { tables: workspaceTables, selection: occupiedSelection, currency })
  assert.ok(detail(r).findByProps({ role: 'alert' }))
  assert.equal(buttonNamed(detail(r), 'Registrar pagamento'), undefined)
  assert.doesNotMatch(nodeText(detail(r)), /Sem cebola|Mesa externa/)
})

test('active tables retain official ordering, textual occupancy and stable comanda summaries', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: Comandas } = await harness.load('/src/domains/table-service/ui/Comandas.jsx')
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
  const { default: Comandas } = await harness.load('/src/domains/table-service/ui/Comandas.jsx')
  const orders = [], selections = []
  const props = { tables: workspaceTables, currency, onAddOrder: (intent) => orders.push(intent), onSelectComanda: (identity) => selections.push(identity) }
  const renderer = await harness.render(Comandas, props)
  await act(async () => list(renderer).findAllByType('button')[1].props.onClick())
  assert.deepEqual(orders, [{ tableId: 'free', tableTabId: '', selectionGeneration: 0 }])
  assert.deepEqual(selections, [])
  await act(async () => renderer.update(React.createElement(Comandas, { ...props, disabled: true })))
  const [occupied, free] = list(renderer).findAllByType('button')
  assert.equal(free.props.disabled, true)
  assert.ok(!occupied.props.disabled)
  await act(async () => { free.props.onClick(); occupied.props.onClick() })
  assert.deepEqual(orders, [{ tableId: 'free', tableTabId: '', selectionGeneration: 0 }])
  assert.deepEqual(selections, [occupiedSelection])
})

test('mobile back restores list scroll and focus without clearing selection; the same table reopens', async (t) => {
  const harness = await workspaceHarness(t, { mobile: true })
  const { default: Comandas } = await harness.load('/src/domains/table-service/ui/Comandas.jsx')
  const listElement = { scrollTop: 0 }
  let focus = ''
  function Workspace() {
    const [selection, onSelectComanda] = React.useState(null)
    return React.createElement(Comandas, { tables: workspaceTables, selection, onSelectComanda, currency })
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
  const { default: Comandas } = await harness.load('/src/domains/table-service/ui/Comandas.jsx')
  const props = { tables: workspaceTables, selection: occupiedSelection, currency }
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
  const { default: Comandas } = await harness.load('/src/domains/table-service/ui/Comandas.jsx')
  const renderer = await harness.render(Comandas)
  assert.match(nodeText(renderer.root.findByProps({ role: 'status' })), /Nenhuma mesa ativa/)
})

test('selected comanda emits canonical external intents without owning overlay workflows', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Comandas } = await h.load('/src/domains/table-service/ui/Comandas.jsx')
  globalThis.fetch = async () => detailResponse()
  const intents = { add: [], pay: [], preview: [], print: [] }
  const r = await h.render(Comandas, {
    tables: workspaceTables,
    selection: occupiedSelection,
    selectionGeneration: 7,
    currency,
    printingAvailable: true,
    onAddOrder: (intent) => intents.add.push(intent),
    onRequestPayment: (intent) => intents.pay.push(intent),
    onRequestPreview: (intent) => intents.preview.push(intent),
    onRequestPrint: (intent) => intents.print.push(intent),
  })

  await act(async () => buttonNamed(detail(r), 'Adicionar pedido').props.onClick())
  await act(async () => buttonNamed(detail(r), 'Registrar pagamento').props.onClick())
  await act(async () => buttonNamed(detail(r), 'Ver ticket').props.onClick())
  await act(async () => buttonNamed(detail(r), 'Imprimir comanda').props.onClick())

  const owner = { tableId: 'occupied', tableTabId: 'tab-42', selectionGeneration: 7 }
  assert.deepEqual(intents.add, [owner])
  assert.deepEqual(intents.preview, [owner])
  assert.deepEqual(intents.print, [owner])
  assert.equal(intents.pay.length, 1)
  assert.deepEqual(
    { tableId: intents.pay[0].tableId, tableTabId: intents.pay[0].tableTabId, selectionGeneration: intents.pay[0].selectionGeneration },
    owner,
  )
  assert.equal(intents.pay[0].detail.id, 'tab-42')
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
    const { default: Comandas } = await harness.load('/src/domains/table-service/ui/Comandas.jsx')
    const dom = focusDOM(harness)
    const selections = []
    function Workspace({ tables, disabled }) {
      const [selection, setSelection] = React.useState(null)
      return React.createElement(Comandas, { tables, currency, disabled, selection, onSelectComanda: (identity) => { selections.push(identity); setSelection(identity) } })
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
    assert.deepEqual(selections, [occupiedSelection], 'controlled selection is preserved')
    await act(async () => list(renderer).findAllByType('button')[0].props.onClick())
    assert.ok(renderer.toJSON().props.className.includes('has-mobile-detail'))
    assert.equal(dom.active(), dom.node(detail(renderer).findByType('h2')))
  })
}

test('reoccupation cannot resurrect a mobile detail invalidated by refresh', async (t) => {
  const harness = await workspaceHarness(t, { mobile: true })
  const { default: Comandas } = await harness.load('/src/domains/table-service/ui/Comandas.jsx')
  const props = { tables: workspaceTables, currency, selection: occupiedSelection }
  const renderer = await harness.render(Comandas, props)
  await act(async () => renderer.update(React.createElement(Comandas, { ...props, tables: [] })))
  await act(async () => renderer.update(React.createElement(Comandas, props)))
  assert.ok(!renderer.toJSON().props.className.includes('has-mobile-detail'))
})

test('mobile to desktop moves focus off the now-hidden back button', async (t) => {
  const harness = await workspaceHarness(t, { mobile: true })
  const { default: Comandas } = await harness.load('/src/domains/table-service/ui/Comandas.jsx')
  const dom = focusDOM(harness)
  const renderer = await harness.render(Comandas, { tables: workspaceTables, currency, selection: occupiedSelection }, dom.options)
  dom.attach(renderer)
  dom.node(buttonNamed(renderer.root, 'Voltar para mesas')).focus()
  await act(async () => harness.setMobile(false))
  assert.equal(dom.active()?.key, dom.node(detail(renderer).findByType('h2')).key)
})

for (const mobile of [false, true]) {
  test(`breakpoint ${mobile ? 'mobile to desktop' : 'desktop to mobile'} restores focus even when CSS blurs before the media event`, async (t) => {
    const harness = await workspaceHarness(t, { mobile })
    const { default: Comandas } = await harness.load('/src/domains/table-service/ui/Comandas.jsx')
    const dom = focusDOM(harness)
    const renderer = await harness.render(Comandas, { tables: workspaceTables, currency, selection: occupiedSelection }, dom.options)
    dom.attach(renderer)
    dom.node(mobile ? buttonNamed(renderer.root, 'Voltar para mesas') : list(renderer).findAllByType('button')[1]).focus()
    harness.document.activeElement = harness.document.body
    await act(async () => harness.setMobile(!mobile))
    assert.equal(dom.active()?.key, dom.node(detail(renderer).findByType('h2')).key)
  })
}

test('breakpoint changes move focus out of the hidden list/back button and preserve back scroll', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: Comandas } = await harness.load('/src/domains/table-service/ui/Comandas.jsx')
  const dom = focusDOM(harness)
  const renderer = await harness.render(Comandas, { tables: workspaceTables, currency, selection: occupiedSelection }, dom.options)
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
