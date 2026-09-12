import assert from 'node:assert/strict'
import test from 'node:test'
import {
  nativeCancellationReasons,
  nativeFinanceCategories,
  parseCatalog,
} from './settingsCatalogs.js'

const expectSettingsInvalid = (fn, field) => assert.throws(fn, (error) => (
  error?.status === 400
  && error?.code === 'SETTINGS_INVALID'
  && (!field || error?.field === field)
))

test('native cancellation reasons preserve all current ids and labels with protected Outro active', () => {
  const catalog = nativeCancellationReasons()
  assert.deepEqual(catalog, { items: [
    { id: 'client_changed_mind', label: 'Cliente desistiu', active: true, sortOrder: 0 },
    { id: 'duplicate_order', label: 'Pedido duplicado', active: true, sortOrder: 1 },
    { id: 'product_unavailable', label: 'Produto indisponível', active: true, sortOrder: 2 },
    { id: 'entry_error', label: 'Erro no lançamento', active: true, sortOrder: 3 },
    { id: 'other', label: 'Outro', active: true, sortOrder: 4 },
  ] })
  assert.equal(Object.isFrozen(catalog.items), true)

  const inactiveOther = structuredClone(catalog)
  inactiveOther.items.at(-1).active = false
  expectSettingsInvalid(() => parseCatalog(inactiveOther, { kind: 'cancellation', existing: catalog }), 'items.4.active')
})

test('native finance categories preserve the manual ids, labels, types and per-type order', () => {
  assert.deepEqual(nativeFinanceCategories(), { items: [
    { id: 'contribution', type: 'entrada', label: 'Aporte', active: true, sortOrder: 0 },
    { id: 'other_income', type: 'entrada', label: 'Outros recebimentos', active: true, sortOrder: 1 },
    { id: 'supplies', type: 'saida', label: 'Insumos', active: true, sortOrder: 0 },
    { id: 'packaging', type: 'saida', label: 'Embalagens', active: true, sortOrder: 1 },
    { id: 'delivery_costs', type: 'saida', label: 'Delivery / Frete', active: true, sortOrder: 2 },
    { id: 'gas', type: 'saida', label: 'Gás', active: true, sortOrder: 3 },
    { id: 'water', type: 'saida', label: 'Água', active: true, sortOrder: 4 },
    { id: 'electricity', type: 'saida', label: 'Energia', active: true, sortOrder: 5 },
    { id: 'rent', type: 'saida', label: 'Aluguel', active: true, sortOrder: 6 },
    { id: 'maintenance', type: 'saida', label: 'Manutenção', active: true, sortOrder: 7 },
    { id: 'fees', type: 'saida', label: 'Taxas', active: true, sortOrder: 8 },
    { id: 'owner_draw', type: 'saida', label: 'Retirada', active: true, sortOrder: 9 },
    { id: 'other_expense', type: 'saida', label: 'Outros', active: true, sortOrder: 10 },
  ] })
})

test('parseCatalog trims labels and rejects unknown keys, empty names, duplicate ids and normalized cancellation collisions', () => {
  const catalog = nativeCancellationReasons()
  const withCustom = structuredClone(catalog)
  withCustom.items.push({ id: 'weather', label: '  Chuva   forte  ', active: true, sortOrder: 5 })
  assert.equal(parseCatalog(withCustom, { kind: 'cancellation', existing: catalog }).items.at(-1).label, 'Chuva forte')

  const invalidCases = [
    [{ ...structuredClone(catalog), unexpected: true }, 'unexpected'],
    [{ items: [...catalog.items, { id: 'x', label: 'Nome', active: true, sortOrder: 5, extra: true }] }, 'items.5.extra'],
    [{ items: [...catalog.items, { id: 'x', label: '   ', active: true, sortOrder: 5 }] }, 'items.5.label'],
    [{ items: [...catalog.items, { id: 'x', label: 'x'.repeat(81), active: true, sortOrder: 5 }] }, 'items.5.label'],
    [{ items: [...catalog.items, { id: 'other', label: 'Outro 2', active: true, sortOrder: 5 }] }, 'items'],
    [{ items: [...catalog.items, { id: 'x', label: ' ERRO NO LANCAMENTO ', active: true, sortOrder: 5 }] }, 'items.5.label'],
  ]

  for (const [value, field] of invalidCases) {
    expectSettingsInvalid(() => parseCatalog(value, { kind: 'cancellation', existing: catalog }), field)
  }
})

test('parseCatalog keeps finance collision scopes separate, reserves automatic names and forbids type mutation', () => {
  const existing = nativeFinanceCategories()
  const data = structuredClone(existing)
  data.items.push(
    { id: 'marketing-income', type: 'entrada', label: 'Marketing', active: true, sortOrder: 2 },
    { id: 'marketing-expense', type: 'saida', label: ' marketing ', active: true, sortOrder: 11 },
  )
  assert.deepEqual(parseCatalog(data, { kind: 'finance', existing }).items.slice(-2), [
    { id: 'marketing-income', type: 'entrada', label: 'Marketing', active: true, sortOrder: 2 },
    { id: 'marketing-expense', type: 'saida', label: 'marketing', active: true, sortOrder: 11 },
  ])

  const duplicateWithinType = structuredClone(data)
  duplicateWithinType.items.at(-1).label = '  insúmos '
  expectSettingsInvalid(() => parseCatalog(duplicateWithinType, { kind: 'finance', existing }), 'items.14.label')

  const reserved = structuredClone(existing)
  reserved.items.push({ id: 'sales-copy', type: 'entrada', label: ' Vêndas ', active: true, sortOrder: 2 })
  expectSettingsInvalid(() => parseCatalog(reserved, { kind: 'finance', existing }), 'items.13.label')

  const changedType = structuredClone(existing)
  changedType.items[0].type = 'saida'
  changedType.items[0].sortOrder = 11
  expectSettingsInvalid(() => parseCatalog(changedType, { kind: 'finance', existing }), 'items.0.type')
})

test('parseCatalog rejects unsupported kinds, repeated positions and omitted native items', () => {
  const cancellation = nativeCancellationReasons()
  expectSettingsInvalid(() => parseCatalog(cancellation, { kind: 'unknown', existing: cancellation }), 'kind')

  const repeatedOrder = structuredClone(cancellation)
  repeatedOrder.items[1].sortOrder = 0
  expectSettingsInvalid(() => parseCatalog(repeatedOrder, { kind: 'cancellation', existing: cancellation }), 'items.1.sortOrder')

  const decimalOrder = structuredClone(cancellation)
  decimalOrder.items[1].sortOrder = 1.5
  expectSettingsInvalid(() => parseCatalog(decimalOrder, { kind: 'cancellation', existing: cancellation }), 'items.1.sortOrder')

  const notANumberOrder = structuredClone(cancellation)
  notANumberOrder.items[1].sortOrder = Number.NaN
  expectSettingsInvalid(() => parseCatalog(notANumberOrder, { kind: 'cancellation', existing: cancellation }), 'items.1.sortOrder')

  const missingNative = structuredClone(cancellation)
  missingNative.items.shift()
  expectSettingsInvalid(() => parseCatalog(missingNative, { kind: 'cancellation', existing: cancellation }), 'items')
})
