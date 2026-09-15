import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from './test-support/settingsDb.js'
import { createManualMovement, softDeleteManualMovement, updateManualMovement } from './financeRepository.js'
import { loadFinanceCategories, saveFinanceCategories } from './financeCategoryRepository.js'
import { loadPaymentMethods, savePaymentMethods } from './paymentSettingsRepository.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-12T17:00:00.000Z')
const LATER = new Date('2026-09-12T18:00:00.000Z')
const baseInput = (overrides = {}) => ({
  type: 'saida', category: 'supplies', description: 'Compra', valueCents: 1000,
  movementDate: '2026-09-12', paymentMethod: 'Pix', ...overrides,
})

function setup(t) {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  return fixture
}

async function addCustom(db, id = 'marketing', type = 'saida') {
  const before = await loadFinanceCategories(db, BUSINESS)
  const data = structuredClone(before.data)
  data.items.push({ id, type, label: id === 'marketing' ? 'Marketing' : 'Projetos', active: true,
    sortOrder: data.items.filter((item) => item.type === type).length })
  return saveFinanceCategories(db, BUSINESS, {
    expectedRevision: before.revision, mutationId: `add-${id}`, data,
  }, NOW)
}

async function setActive(db, resource, ids, active, mutationId) {
  const data = structuredClone(resource.data)
  for (const item of data.items) if (ids.includes(item.id)) item.active = active
  return saveFinanceCategories(db, BUSINESS, {
    expectedRevision: resource.revision, mutationId, data,
  }, LATER)
}

test('creates a manual movement and permanently marks category first use in one transaction', async (t) => {
  const { db, sqlite } = setup(t)
  const catalog = await addCustom(db)
  const movement = await createManualMovement(db, BUSINESS,
    baseInput({ category: 'marketing', expectedRevision: catalog.resource.revision }), LATER)

  assert.equal(movement.category, 'marketing')
  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_finance_categories WHERE id = 'marketing'").get().first_used_at,
    LATER.toISOString())
  const after = await loadFinanceCategories(db, BUSINESS)
  assert.equal(after.meta.items.marketing.usedEver, true)
  assert.equal(after.meta.items.marketing.canRename, false)
  assert.equal(after.meta.items.marketing.canDelete, false)
})

test('revision-zero defaults initialize atomically with the first manual movement for a new business', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  sqlite.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('new-business', 'new-business', 'New', NOW.toISOString(), NOW.toISOString())
  const paymentMethods = await loadPaymentMethods(db, 'new-business')
  await savePaymentMethods(db, 'new-business', {
    expectedRevision: 0, mutationId: 'initialize-payment-methods', data: paymentMethods.data,
  }, NOW)

  const movement = await createManualMovement(db, 'new-business', baseInput({ expectedRevision: 0 }), LATER)

  assert.equal(movement.category, 'supplies')
  assert.equal(movement.categoryLabel, 'Insumos')
  assert.equal(sqlite.prepare("SELECT revision FROM business_finance_category_settings WHERE business_id = 'new-business'").get().revision, 1)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM business_finance_categories WHERE business_id = 'new-business'").get().n, 13)
  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_finance_categories WHERE business_id = 'new-business' AND id = 'supplies'").get().first_used_at, LATER.toISOString())
})

test('rolls back first use when movement insertion fails', async (t) => {
  const { db, sqlite } = setup(t)
  const catalog = await addCustom(db)
  sqlite.exec("CREATE TRIGGER reject_manual_movement BEFORE INSERT ON movements WHEN NEW.source = 'manual' BEGIN SELECT RAISE(ABORT, 'injected'); END")

  await assert.rejects(createManualMovement(db, BUSINESS,
    baseInput({ category: 'marketing', expectedRevision: catalog.resource.revision }), LATER))
  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_finance_categories WHERE id = 'marketing'").get().first_used_at, null)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM movements WHERE category = 'marketing'").get().n, 0)
})

test('blocks new selections when a type has no active categories without affecting automatic history', async (t) => {
  const { db, sqlite } = setup(t)
  const before = await loadFinanceCategories(db, BUSINESS)
  const disabled = await setActive(db, before,
    before.data.items.filter(({ type }) => type === 'saida').map(({ id }) => id), false, 'disable-expenses')
  sqlite.prepare(`INSERT INTO movements (id, business_id, type, category, description, value_cents, source,
    movement_date, created_at, updated_at) VALUES ('sale-history', ?, 'entrada', 'Vendas', 'Venda', 2000,
    'order-payment', '2026-09-12', ?, ?)`).run(BUSINESS, NOW.toISOString(), NOW.toISOString())

  await assert.rejects(createManualMovement(db, BUSINESS,
    baseInput({ expectedRevision: disabled.resource.revision }), LATER), { code: 'POLICY_CHANGED', status: 409 })
  const automatic = sqlite.prepare("SELECT category, value_cents FROM movements WHERE id = 'sale-history'").get()
  assert.equal(automatic.category, 'Vendas')
  assert.equal(automatic.value_cents, 2000)
})

test('editing keeps the server-loaded inactive reference but rejects a different inactive category', async (t) => {
  const { db, sqlite } = setup(t)
  await addCustom(db, 'marketing')
  const secondCatalog = await addCustom(db, 'projects')
  const created = await createManualMovement(db, BUSINESS,
    baseInput({ category: 'marketing', expectedRevision: secondCatalog.resource.revision }), LATER)
  const disabled = await setActive(db, secondCatalog.resource, ['marketing', 'projects'], false, 'disable-customs')

  const retained = await updateManualMovement(db, BUSINESS, created.id,
    baseInput({ category: 'marketing', description: 'Compra revisada', expectedRevision: disabled.resource.revision }),
    new Date(+LATER + 1000))
  assert.equal(retained.category, 'marketing')
  await assert.rejects(updateManualMovement(db, BUSINESS, created.id,
    baseInput({ category: 'projects', expectedRevision: disabled.resource.revision }), new Date(+LATER + 2000)), {
    code: 'POLICY_CHANGED', status: 409,
  })
  assert.equal(sqlite.prepare('SELECT category FROM movements WHERE id = ?').get(created.id).category, 'marketing')

  sqlite.exec("INSERT INTO businesses VALUES ('second', 'second', 'Second', '2026-09-12', '2026-09-12')")
  sqlite.prepare(`INSERT INTO movements (id, business_id, type, category, description, value_cents, source,
    movement_date, created_at, updated_at) VALUES ('other-business-movement', 'second', 'saida', 'supplies',
    'Privado', 1000, 'manual', '2026-09-12', ?, ?)`).run(NOW.toISOString(), NOW.toISOString())
  assert.equal(await updateManualMovement(db, BUSINESS, 'other-business-movement',
    baseInput({ category: 'marketing' }), LATER), null)
})

test('editing preserves a legacy Portuguese category value without treating it as a new selection', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare(`INSERT INTO movements (id, business_id, type, category, description, value_cents, source,
    payment_method, movement_date, created_at, updated_at) VALUES ('legacy-supplies', ?, 'saida', 'Insumos',
    'Compra antiga', 1000, 'manual', 'Pix', '2026-09-12', ?, ?)`).run(BUSINESS, NOW.toISOString(), NOW.toISOString())

  const updated = await updateManualMovement(db, BUSINESS, 'legacy-supplies',
    baseInput({ category: 'Insumos', description: 'Compra antiga revisada' }), LATER)

  assert.equal(updated.category, 'Insumos')
  assert.equal(updated.description, 'Compra antiga revisada')
  assert.equal(sqlite.prepare("SELECT category FROM movements WHERE id = 'legacy-supplies'").get().category, 'Insumos')
})

test('first use survives category changes and soft deletion of the movement', async (t) => {
  const { db, sqlite } = setup(t)
  const custom = await addCustom(db)
  const created = await createManualMovement(db, BUSINESS,
    baseInput({ category: 'marketing', expectedRevision: custom.resource.revision }), LATER)
  await updateManualMovement(db, BUSINESS, created.id,
    baseInput({ category: 'supplies', expectedRevision: custom.resource.revision }), new Date(+LATER + 1000))
  await softDeleteManualMovement(db, BUSINESS, created.id, new Date(+LATER + 2000))

  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_finance_categories WHERE id = 'marketing'").get().first_used_at,
    LATER.toISOString())
  const admin = await loadFinanceCategories(db, BUSINESS)
  const renamed = structuredClone(admin.data)
  renamed.items.find(({ id }) => id === 'marketing').label = 'Marketing novo'
  await assert.rejects(saveFinanceCategories(db, BUSINESS, {
    expectedRevision: admin.revision, mutationId: 'rename-used', data: renamed,
  }, new Date(+LATER + 3000)), { code: 'SETTINGS_ITEM_USED', status: 409 })
  const removed = structuredClone(admin.data)
  removed.items = removed.items.filter(({ id }) => id !== 'marketing')
  removed.items.filter(({ type }) => type === 'saida').forEach((item, sortOrder) => { item.sortOrder = sortOrder })
  await assert.rejects(saveFinanceCategories(db, BUSINESS, {
    expectedRevision: admin.revision, mutationId: 'delete-used', data: removed,
  }, new Date(+LATER + 4000)), { code: 'SETTINGS_ITEM_USED', status: 409 })
})

test('a policy revision race rolls back both first use and the movement', async (t) => {
  const { db, sqlite } = setup(t)
  const custom = await addCustom(db)
  const racingDb = {
    prepare: db.prepare,
    async batch(statements) {
      await setActive(db, custom.resource, ['marketing'], false, 'disable-during-create')
      return db.batch(statements)
    },
  }

  await assert.rejects(createManualMovement(racingDb, BUSINESS,
    baseInput({ category: 'marketing', expectedRevision: custom.resource.revision }), LATER), {
    code: 'POLICY_CHANGED', status: 409,
  })
  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_finance_categories WHERE id = 'marketing'").get().first_used_at, null)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM movements WHERE category = 'marketing'").get().n, 0)
})

test('delete and first use races have one valid winner and never leave a lost reference', async (t) => {
  const { db, sqlite } = setup(t)
  const custom = await addCustom(db)
  const removed = structuredClone(custom.resource.data)
  removed.items = removed.items.filter(({ id }) => id !== 'marketing')
  removed.items.filter(({ type }) => type === 'saida').forEach((item, sortOrder) => { item.sortOrder = sortOrder })
  const racingAdminDb = {
    prepare: db.prepare,
    async batch(statements) {
      await createManualMovement(db, BUSINESS,
        baseInput({ category: 'marketing', expectedRevision: custom.resource.revision }), LATER)
      return db.batch(statements)
    },
  }

  await assert.rejects(saveFinanceCategories(racingAdminDb, BUSINESS, {
    expectedRevision: custom.resource.revision, mutationId: 'delete-race', data: removed,
  }, new Date(+LATER + 1000)), { code: 'SETTINGS_ITEM_USED', status: 409 })
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM business_finance_categories WHERE id = 'marketing'").get().n, 1)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM movements WHERE category = 'marketing'").get().n, 1)
})
