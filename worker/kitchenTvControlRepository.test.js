import assert from 'node:assert/strict'
import test from 'node:test'
import { createSettingsDb } from './test-support/settingsDb.js'

const BUSINESS = 'amor-e-sabor'
const OTHER = 'outra-cozinha'
const NOW = new Date('2026-09-28T20:00:00.000Z')
const repositoryPromise = import('./kitchenTvControlRepository.js').catch(() => ({}))

function insertOrder(sqlite, {
  id,
  businessId = BUSINESS,
  number,
  status = 'Em preparo',
  scheduledFor = null,
  finishedAt = null,
  cancelledAt = null,
}) {
  sqlite.prepare(`INSERT INTO orders (
    id, business_id, client_name_snapshot, type, order_date, status,
    subtotal_cents, total_cents, created_at, finished_at, scheduled_for,
    cancelled_at, order_number
  ) VALUES (?, ?, ?, 'Entrega', '2026-09-28', ?, 1000, 1000, ?, ?, ?, ?, ?)`)
    .run(id, businessId, `Cliente ${id}`, status, NOW.toISOString(), finishedAt, scheduledFor, cancelledAt, number)
}

function setup(t) {
  const fixture = createSettingsDb()
  fixture.sqlite.prepare('INSERT INTO businesses (id,slug,name,created_at,updated_at) VALUES (?,?,?,?,?)')
    .run(OTHER, OTHER, 'Outra cozinha', NOW.toISOString(), NOW.toISOString())
  insertOrder(fixture.sqlite, { id: 'active', number: 1 })
  insertOrder(fixture.sqlite, { id: 'scheduled', number: 2, scheduledFor: '2026-09-28T22:00:00.000Z' })
  insertOrder(fixture.sqlite, { id: 'finished', number: 3, status: 'Finalizado', finishedAt: '2026-09-28T20:10:00.000Z' })
  insertOrder(fixture.sqlite, { id: 'other-active', businessId: OTHER, number: 1 })
  t.after(fixture.close)
  return fixture
}

test('control defaults to page one and page commands increment a monotonic revision', async (t) => {
  const repository = await repositoryPromise
  assert.equal(typeof repository.loadKitchenTvControl, 'function')
  assert.equal(typeof repository.setKitchenTvRequestedPage, 'function')
  const { db } = setup(t)

  assert.deepEqual(await repository.loadKitchenTvControl(db, BUSINESS), {
    revision: 0,
    requestedPage: 1,
    updatedAt: null,
    telemetry: null,
  })

  const first = await repository.setKitchenTvRequestedPage(db, BUSINESS, 2, NOW)
  assert.equal(first.revision, 1)
  assert.equal(first.requestedPage, 2)
  const second = await repository.setKitchenTvRequestedPage(db, BUSINESS, 3, new Date(+NOW + 1_000))
  assert.equal(second.revision, 2)
  assert.equal(second.requestedPage, 3)
})

test('telemetry is stored separately without changing the requested page revision', async (t) => {
  const repository = await repositoryPromise
  const { db } = setup(t)

  await repository.setKitchenTvRequestedPage(db, BUSINESS, 2, NOW)
  const reported = await repository.reportKitchenTvDisplay(db, BUSINESS, {
    appliedRevision: 1,
    currentPage: 2,
    pageCount: 3,
    viewportWidth: 960,
    viewportHeight: 540,
    visibleOrderIds: ['active'],
  }, new Date(+NOW + 2_000))

  assert.equal(reported.revision, 1)
  assert.equal(reported.requestedPage, 2)
  assert.deepEqual(reported.telemetry, {
    appliedRevision: 1,
    currentPage: 2,
    pageCount: 3,
    viewportWidth: 960,
    viewportHeight: 540,
    visibleOrderIds: ['active'],
    reportedAt: new Date(+NOW + 2_000).toISOString(),
  })
})

test('hide and restore are idempotent and only active preparing orders are eligible', async (t) => {
  const repository = await repositoryPromise
  const { db, sqlite } = setup(t)

  assert.deepEqual(await repository.listKitchenTvHiddenOrderIds(db, BUSINESS), [])
  assert.equal(await repository.hideKitchenTvOrder(db, BUSINESS, 'active', NOW), true)
  assert.equal(await repository.hideKitchenTvOrder(db, BUSINESS, 'active', new Date(+NOW + 1_000)), true)
  assert.deepEqual(await repository.listKitchenTvHiddenOrderIds(db, BUSINESS), ['active'])
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM kitchen_tv_hidden_orders WHERE business_id=? AND order_id='active'").get(BUSINESS).n, 1)

  assert.equal(await repository.hideKitchenTvOrder(db, BUSINESS, 'scheduled', NOW), false)
  assert.equal(await repository.hideKitchenTvOrder(db, BUSINESS, 'finished', NOW), false)
  assert.equal(await repository.hideKitchenTvOrder(db, BUSINESS, 'other-active', NOW), false)
  assert.deepEqual(await repository.listKitchenTvHiddenOrderIds(db, BUSINESS), ['active'])

  assert.equal(await repository.restoreKitchenTvOrder(db, BUSINESS, 'active'), true)
  assert.equal(await repository.restoreKitchenTvOrder(db, BUSINESS, 'active'), true)
  assert.deepEqual(await repository.listKitchenTvHiddenOrderIds(db, BUSINESS), [])
})

test('hidden order listing is isolated by business', async (t) => {
  const repository = await repositoryPromise
  const { db } = setup(t)

  assert.equal(await repository.hideKitchenTvOrder(db, BUSINESS, 'active', NOW), true)
  assert.equal(await repository.hideKitchenTvOrder(db, OTHER, 'other-active', NOW), true)

  assert.deepEqual(await repository.listKitchenTvHiddenOrderIds(db, BUSINESS), ['active'])
  assert.deepEqual(await repository.listKitchenTvHiddenOrderIds(db, OTHER), ['other-active'])
})


test('two controllers keep a monotonic revision and the latest page is confirmed by telemetry', async (t) => {
  const repository = await repositoryPromise
  const { db } = setup(t)

  const controllerA = await repository.setKitchenTvRequestedPage(db, BUSINESS, 2, NOW)
  assert.equal(controllerA.revision, 1)
  assert.equal(controllerA.requestedPage, 2)

  const controllerB = await repository.setKitchenTvRequestedPage(db, BUSINESS, 3, new Date(+NOW + 1_000))
  assert.equal(controllerB.revision, 2)
  assert.equal(controllerB.requestedPage, 3)

  const confirmed = await repository.reportKitchenTvDisplay(db, BUSINESS, {
    appliedRevision: controllerB.revision,
    currentPage: 3,
    pageCount: 3,
    viewportWidth: 1920,
    viewportHeight: 1080,
    visibleOrderIds: ['active'],
  }, new Date(+NOW + 2_000))

  assert.equal(confirmed.revision, 2)
  assert.equal(confirmed.requestedPage, 3)
  assert.equal(confirmed.telemetry.appliedRevision, 2)
  assert.equal(confirmed.telemetry.currentPage, 3)
})
