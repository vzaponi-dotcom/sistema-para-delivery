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

const editableCancellationCatalog = () => ({
  items: nativeCancellationReasons().items.map(({ id, label, active, sortOrder }) => ({
    id,
    label,
    active,
    sortOrder,
  })),
})

test('native cancellation reasons preserve all current ids and labels with protected Outro active', () => {
  const catalog = nativeCancellationReasons()
  assert.deepEqual(catalog, { items: [
    { id: 'client_changed_mind', label: 'Cliente desistiu', active: true, sortOrder: 0, requiresNote: false },
    { id: 'duplicate_order', label: 'Pedido duplicado', active: true, sortOrder: 1, requiresNote: false },
    { id: 'product_unavailable', label: 'Produto indisponível', active: true, sortOrder: 2, requiresNote: false },
    { id: 'entry_error', label: 'Erro no lançamento', active: true, sortOrder: 3, requiresNote: false },
    { id: 'other', label: 'Outro', active: true, sortOrder: 4, requiresNote: true },
  ] })
  assert.equal(Object.isFrozen(catalog.items), true)
  assert.equal(Object.isFrozen(catalog.items.at(-1)), true)

  const editable = editableCancellationCatalog()
  const inactiveOther = structuredClone(editable)
  inactiveOther.items.at(-1).active = false
  expectSettingsInvalid(() => parseCatalog(inactiveOther, { kind: 'cancellation', existing: editable }), 'items.4.active')

  const forgedRule = structuredClone(editable)
  forgedRule.items.at(-1).requiresNote = false
  expectSettingsInvalid(() => parseCatalog(forgedRule, { kind: 'cancellation', existing: editable }), 'items.4.requiresNote')
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
  const catalog = editableCancellationCatalog()
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
  const cancellation = editableCancellationCatalog()
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

for (const fixture of [
  {
    kind: 'cancellation',
    base: editableCancellationCatalog,
    used: { id: 'weather', label: 'Chuva forte', active: false, sortOrder: 5 },
    tombstone: { id: 'retired-reason', label: 'Cliente ausente', active: false, sortOrder: 5 },
  },
  {
    kind: 'finance',
    base: nativeFinanceCategories,
    used: { id: 'marketing-expense', type: 'saida', label: 'Marketing', active: false, sortOrder: 11 },
    tombstone: { id: 'retired-income', type: 'entrada', label: 'Receita eventual', active: false, sortOrder: 2 },
  },
]) {
  test(`${fixture.kind} catalog trusts existing usage metadata to block rename and omission`, () => {
    const base = fixture.base()
    const existing = { items: [...base.items, { ...fixture.used, usedEver: true }] }
    const unchanged = { items: [...base.items, fixture.used] }
    assert.deepEqual(parseCatalog(unchanged, { kind: fixture.kind, existing }), unchanged)

    for (const metadata of ['usedEver', 'tombstone']) {
      const forgedMetadata = structuredClone(unchanged)
      forgedMetadata.items.at(-1)[metadata] = true
      expectSettingsInvalid(
        () => parseCatalog(forgedMetadata, { kind: fixture.kind, existing }),
        `items.${forgedMetadata.items.length - 1}.${metadata}`,
      )
    }

    const renamed = structuredClone(unchanged)
    renamed.items.at(-1).label = 'Nome diferente'
    expectSettingsInvalid(() => parseCatalog(renamed, { kind: fixture.kind, existing }), `items.${renamed.items.length - 1}.label`)

    expectSettingsInvalid(() => parseCatalog(base, { kind: fixture.kind, existing }), 'items')
  })

  test(`${fixture.kind} catalog trusts existing tombstones to block identity and normalized-name recreation`, () => {
    const base = fixture.base()
    const existing = { items: [...base.items, { ...fixture.tombstone, tombstone: true }] }
    assert.deepEqual(parseCatalog(base, { kind: fixture.kind, existing }), base)

    const sameIdentity = { items: [...base.items, fixture.tombstone] }
    expectSettingsInvalid(() => parseCatalog(sameIdentity, { kind: fixture.kind, existing }), `items.${base.items.length}.id`)

    const sameName = structuredClone(sameIdentity)
    sameName.items.at(-1).id = `${fixture.tombstone.id}-new`
    sameName.items.at(-1).label = `  ${fixture.tombstone.label.toLocaleUpperCase('pt-BR')}  `
    expectSettingsInvalid(() => parseCatalog(sameName, { kind: fixture.kind, existing }), `items.${base.items.length}.label`)
  })
}

test('finance catalog reserves automatic sales and refunds identities independent of labels', () => {
  const base = nativeFinanceCategories()
  for (const [id, label] of [['sales', 'Receita da loja'], ['refunds', 'Devoluções manuais']]) {
    const data = structuredClone(base)
    data.items.push({ id, type: 'entrada', label, active: true, sortOrder: 2 })
    expectSettingsInvalid(() => parseCatalog(data, { kind: 'finance', existing: base }), 'items.13.id')
  }
})
