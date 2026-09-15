import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from './test-support/settingsDb.js'
import { loadFinanceCategories, saveFinanceCategories } from './financeCategoryRepository.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-12T17:00:00.000Z')
const input = (mutationId, data, expectedRevision = 1) => ({ mutationId, expectedRevision, data })

function setup(t) {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  return fixture
}

function withCustom(resource, overrides = {}) {
  const data = structuredClone(resource.data)
  const type = overrides.type ?? 'saida'
  data.items.push({
    id: overrides.id ?? 'marketing',
    type,
    label: overrides.label ?? 'Marketing',
    active: overrides.active ?? true,
    sortOrder: data.items.filter((item) => item.type === type).length,
  })
  return data
}

test('loads the complete manual catalog with protected native identities and per-type ordering', async (t) => {
  const { db } = setup(t)
  const resource = await loadFinanceCategories(db, BUSINESS)

  assert.equal(resource.resource, 'financeCategories')
  assert.equal(resource.revision, 1)
  assert.deepEqual(resource.data.items.filter(({ type }) => type === 'entrada').map(({ id }) => id), [
    'contribution', 'other_income',
  ])
  assert.deepEqual(resource.data.items.filter(({ type }) => type === 'saida').map(({ id }) => id), [
    'supplies', 'packaging', 'delivery_costs', 'gas', 'water', 'electricity', 'rent',
    'maintenance', 'fees', 'owner_draw', 'other_expense',
  ])
  assert.equal(resource.data.items.some(({ id }) => ['sales', 'refunds'].includes(id)), false)
  assert.equal(resource.meta.items.supplies.isSystem, true)
  assert.equal(resource.meta.items.supplies.canRename, false)
  assert.equal(resource.meta.items.supplies.canDelete, false)
})

test('allows activation, ordering and never-used custom lifecycle while protecting identity and type', async (t) => {
  const { db } = setup(t)
  const before = await loadFinanceCategories(db, BUSINESS)
  const created = await saveFinanceCategories(db, BUSINESS, input('create', withCustom(before)), NOW)
  assert.equal(created.resource.revision, 2)
  assert.equal(created.resource.meta.items.marketing.canRename, true)

  const edited = structuredClone(created.resource.data)
  const marketing = edited.items.find(({ id }) => id === 'marketing')
  marketing.label = '  Marketing digital  '
  marketing.active = false
  const expenseItems = edited.items.filter(({ type }) => type === 'saida')
  expenseItems.forEach((item, sortOrder) => { item.sortOrder = expenseItems.length - 1 - sortOrder })
  const saved = await saveFinanceCategories(db, BUSINESS, input('edit', edited, 2), new Date(+NOW + 1000))
  assert.equal(saved.resource.data.items.find(({ id }) => id === 'marketing').label, 'Marketing digital')
  assert.equal(saved.resource.data.items.find(({ id }) => id === 'marketing').active, false)

  const invalidType = structuredClone(saved.resource.data)
  invalidType.items.find(({ id }) => id === 'marketing').type = 'entrada'
  await assert.rejects(saveFinanceCategories(db, BUSINESS, input('change-type', invalidType, 3), NOW), {
    code: 'SETTINGS_INVALID', status: 400,
  })
  const missingNative = structuredClone(saved.resource.data)
  missingNative.items = missingNative.items.filter(({ id }) => id !== 'supplies')
  await assert.rejects(saveFinanceCategories(db, BUSINESS, input('delete-native', missingNative, 3), NOW), {
    code: 'SETTINGS_INVALID', status: 400,
  })

  const removed = structuredClone(saved.resource.data)
  removed.items = removed.items.filter(({ id }) => id !== 'marketing')
  removed.items.filter(({ type }) => type === 'saida').sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((item, sortOrder) => { item.sortOrder = sortOrder })
  const deleted = await saveFinanceCategories(db, BUSINESS, input('delete', removed, 3), new Date(+NOW + 2000))
  assert.equal(deleted.resource.data.items.some(({ id }) => id === 'marketing'), false)
})

test('normalizes names within each type, permits the same name across types and reserves automatic categories', async (t) => {
  const { db } = setup(t)
  const before = await loadFinanceCategories(db, BUSINESS)
  const duplicate = withCustom(before, { id: 'duplicate', label: '  APORTE  ', type: 'entrada' })
  await assert.rejects(saveFinanceCategories(db, BUSINESS, input('duplicate', duplicate), NOW), {
    code: 'SETTINGS_INVALID', status: 400,
  })
  const automatic = withCustom(before, { id: 'automatic', label: 'Vendas', type: 'saida' })
  await assert.rejects(saveFinanceCategories(db, BUSINESS, input('automatic', automatic), NOW), {
    code: 'SETTINGS_INVALID', status: 400,
  })

  const sameAcrossTypes = withCustom(before, { id: 'entry-marketing', label: 'Marketing', type: 'entrada' })
  sameAcrossTypes.items.push({ id: 'exit-marketing', type: 'saida', label: 'Marketing', active: true,
    sortOrder: sameAcrossTypes.items.filter(({ type }) => type === 'saida').length })
  const saved = await saveFinanceCategories(db, BUSINESS, input('same-across-types', sameAcrossTypes), NOW)
  assert.equal(saved.resource.data.items.filter(({ label }) => label === 'Marketing').length, 2)
})

test('supports empty active lists, atomic multi-edit swaps, revision races, no-op and replay receipts', async (t) => {
  const { db, sqlite } = setup(t)
  const before = await loadFinanceCategories(db, BUSINESS)
  const data = structuredClone(before.data)
  data.items.forEach((item) => { item.active = false })
  const [a, b] = await Promise.allSettled([
    saveFinanceCategories(db, BUSINESS, input('race-a', data), NOW),
    saveFinanceCategories(db, BUSINESS, input('race-b', withCustom(before)), NOW),
  ])
  const winner = [a, b].find(({ status }) => status === 'fulfilled').value
  const loser = [a, b].find(({ status }) => status === 'rejected').reason
  assert.equal(loser.code, 'SETTINGS_REVISION_CONFLICT')
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM settings_mutation_receipts WHERE resource_key = 'financeCategories'").get().n, 1)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)

  const replay = await saveFinanceCategories(db, BUSINESS,
    input(winner.receipt.mutationId, winner.resource.data), new Date(+NOW + 1000))
  assert.equal(replay.receipt.replayed, true)
  const noop = await saveFinanceCategories(db, BUSINESS,
    input('noop', winner.resource.data, winner.resource.revision), new Date(+NOW + 2000))
  assert.equal(noop.resource.revision, winner.resource.revision)
})

test('rolls back parent, items and receipt after an intermediate failure and fails closed on corrupt state', async (t) => {
  const { db, sqlite } = setup(t)
  const before = await loadFinanceCategories(db, BUSINESS)
  sqlite.exec("CREATE TRIGGER reject_finance_item BEFORE UPDATE OF active ON business_finance_categories WHEN NEW.id = 'packaging' BEGIN SELECT RAISE(ABORT, 'injected'); END")
  const changed = structuredClone(before.data)
  changed.items.find(({ id }) => id === 'supplies').active = false
  changed.items.find(({ id }) => id === 'packaging').active = false
  await assert.rejects(saveFinanceCategories(db, BUSINESS, input('rollback', changed), NOW), {
    code: 'SETTINGS_UNAVAILABLE', status: 503,
  })
  assert.equal((await loadFinanceCategories(db, BUSINESS)).revision, 1)
  assert.equal(sqlite.prepare("SELECT active FROM business_finance_categories WHERE id = 'supplies'").get().active, 1)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM settings_mutation_receipts WHERE mutation_id = 'rollback'").get().n, 0)

  sqlite.exec('DROP TRIGGER reject_finance_item; DROP TRIGGER business_finance_categories_identity_guard')
  await assert.rejects(loadFinanceCategories(db, BUSINESS), { code: 'SETTINGS_UNAVAILABLE', status: 503 })
})

test('stages transient name collisions across multiple edits in one save', async (t) => {
  const { db } = setup(t)
  const before = await loadFinanceCategories(db, BUSINESS)
  const createdData = withCustom(before, { id: 'marketing', label: 'Marketing' })
  createdData.items.push({ id: 'projects', type: 'saida', label: 'Projetos', active: true,
    sortOrder: createdData.items.filter(({ type }) => type === 'saida').length })
  const created = await saveFinanceCategories(db, BUSINESS, input('create-pair', createdData), NOW)

  const swapped = structuredClone(created.resource.data)
  swapped.items.find(({ id }) => id === 'marketing').label = 'Projetos'
  swapped.items.find(({ id }) => id === 'projects').label = 'Marketing'
  const saved = await saveFinanceCategories(db, BUSINESS, input('swap-pair', swapped, 2), new Date(+NOW + 1000))
  assert.equal(saved.resource.data.items.find(({ id }) => id === 'marketing').label, 'Projetos')
  assert.equal(saved.resource.data.items.find(({ id }) => id === 'projects').label, 'Marketing')
})

test('initializes a legitimately absent aggregate and reconciles a receipt before later usage restrictions', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.exec("INSERT INTO businesses VALUES ('new-business', 'new-business', 'New', '2026-09-12', '2026-09-12')")
  const absent = await loadFinanceCategories(db, 'new-business')
  assert.equal(absent.revision, 0)
  assert.equal(absent.data.items.length, 13)
  const initialized = await saveFinanceCategories(db, 'new-business', input('initialize', absent.data, 0), NOW)
  assert.equal(initialized.resource.revision, 1)

  const before = await loadFinanceCategories(db, BUSINESS)
  const data = withCustom(before)
  const saved = await saveFinanceCategories(db, BUSINESS, input('lost-response', data), NOW)
  sqlite.prepare("UPDATE business_finance_categories SET first_used_at = ? WHERE business_id = ? AND id = 'marketing'")
    .run(new Date(+NOW + 1000).toISOString(), BUSINESS)
  const replay = await saveFinanceCategories(db, BUSINESS, input('lost-response', data), new Date(+NOW + 2000))
  assert.equal(replay.receipt.replayed, true)
  assert.equal(replay.receipt.committedRevision, saved.receipt.committedRevision)
  assert.equal(replay.resource.meta.items.marketing.usedEver, true)
})
