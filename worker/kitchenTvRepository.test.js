import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { createSettingsDb } from './test-support/settingsDb.js'

const BUSINESS = 'amor-e-sabor'
const OTHER_BUSINESS = 'outra-cozinha'
const NOW = new Date('2026-09-22T18:00:00.000Z')
const migrations = new URL('../migrations/', import.meta.url)
const repositoryPromise = import('./kitchenTvRepository.js').catch(() => ({}))

function setup(t) {
  const fixture = createSettingsDb()
  fixture.sqlite.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(OTHER_BUSINESS, OTHER_BUSINESS, 'Outra cozinha', NOW.toISOString(), NOW.toISOString())
  t.after(fixture.close)
  return fixture
}

test('migration 0029 installs cleanly, upgrades an existing database and keeps foreign keys clean', () => {
  const files = readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
  const migration0029 = '0029_kitchen_tv_pairing_requests.sql'
  const migration0029Index = files.indexOf(migration0029)
  assert.ok(migration0029Index >= 0)

  const clean = createSettingsDb()
  try {
    assert.equal(clean.sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'kitchen_tv_access'").get().n, 1)
    assert.equal(clean.sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'kitchen_tv_pairing_requests'").get().n, 1)
    assert.deepEqual(clean.sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  } finally {
    clean.close()
  }

  const sqlite = new DatabaseSync(':memory:')
  try {
    for (const file of files.slice(0, migration0029Index)) sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
    sqlite.exec("INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES ('upgrade', 'upgrade', 'Upgrade', '2026-09-22', '2026-09-22')")
    sqlite.exec(readFileSync(new URL(migration0029, migrations), 'utf8'))
    sqlite.exec("INSERT INTO kitchen_tv_pairing_requests (request_token_hash, pairing_code, expires_at, created_at) VALUES ('request', '123456', '2026-09-22T19:00:00.000Z', '2026-09-22T18:00:00.000Z')")
    assert.equal(sqlite.prepare("SELECT pairing_code FROM kitchen_tv_pairing_requests WHERE request_token_hash = 'request'").get().pairing_code, '123456')
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  } finally {
    sqlite.close()
  }
})

test('pairing request is approved by short code and activates exactly one business TV session', async (t) => {
  const repository = await repositoryPromise
  const { db } = setup(t)
  const expires = new Date(+NOW + 1_800_000)

  const request = await repository.createKitchenTvPairingRequest(db, 'request-hash', '482731', expires, NOW)
  assert.equal(request.pairingCode, '482731')
  assert.equal(request.approvedBusinessId, null)

  const approved = await repository.approveKitchenTvPairingCode(db, '482731', BUSINESS, new Date(+NOW + 1_000))
  assert.equal(approved.approvedBusinessId, BUSINESS)
  assert.equal((await repository.loadKitchenTvPendingApproval(db, BUSINESS, new Date(+NOW + 2_000))).pairingCode, '482731')

  const access = await repository.activateKitchenTvApprovedRequest(db, 'request-hash', 'session-hash', new Date(+NOW + 3_000))
  assert.equal(access.businessId, BUSINESS)
  assert.equal(access.sessionTokenHash, 'session-hash')
  assert.equal((await repository.loadKitchenTvPairingRequestByHash(db, 'request-hash')).consumedAt, new Date(+NOW + 3_000).toISOString())
  assert.equal(await repository.loadKitchenTvPendingApproval(db, BUSINESS, new Date(+NOW + 4_000)), null)
})

test('codes are unique, expire, and cannot be approved by two businesses', async (t) => {
  const repository = await repositoryPromise
  const { db } = setup(t)
  await repository.createKitchenTvPairingRequest(db, 'request-a', '111111', new Date(+NOW + 1_800_000), NOW)
  await assert.rejects(repository.createKitchenTvPairingRequest(db, 'request-b', '111111', new Date(+NOW + 1_800_000), NOW))

  assert.equal(await repository.approveKitchenTvPairingCode(db, '999999', BUSINESS, NOW), null)
  const approved = await repository.approveKitchenTvPairingCode(db, '111111', BUSINESS, new Date(+NOW + 1_000))
  assert.equal(approved.approvedBusinessId, BUSINESS)
  assert.equal(await repository.approveKitchenTvPairingCode(db, '111111', OTHER_BUSINESS, new Date(+NOW + 2_000)), null)

  await repository.createKitchenTvPairingRequest(db, 'expired-request', '222222', new Date(+NOW + 10_000), NOW)
  assert.equal(await repository.approveKitchenTvPairingCode(db, '222222', BUSINESS, new Date(+NOW + 10_001)), null)
})

test('revocation removes active session and cancels a pending approved request', async (t) => {
  const repository = await repositoryPromise
  const { db } = setup(t)

  await repository.createKitchenTvPairingRequest(db, 'request-active', '333333', new Date(+NOW + 1_800_000), NOW)
  await repository.approveKitchenTvPairingCode(db, '333333', BUSINESS, NOW)
  await repository.activateKitchenTvApprovedRequest(db, 'request-active', 'session-active', new Date(+NOW + 1_000))
  assert.equal((await repository.loadKitchenTvSessionByHash(db, 'session-active')).businessId, BUSINESS)

  await repository.createKitchenTvPairingRequest(db, 'request-pending', '444444', new Date(+NOW + 1_800_000), NOW)
  await repository.approveKitchenTvPairingCode(db, '444444', BUSINESS, new Date(+NOW + 2_000))
  await repository.revokeKitchenTvAccess(db, BUSINESS, new Date(+NOW + 3_000))

  assert.equal(await repository.loadKitchenTvSessionByHash(db, 'session-active'), null)
  assert.equal(await repository.loadKitchenTvPendingApproval(db, BUSINESS, new Date(+NOW + 4_000)), null)
})

test('last seen touch writes only at or after the five minute threshold', async (t) => {
  const repository = await repositoryPromise
  const { db, sqlite } = setup(t)
  await repository.createKitchenTvPairingRequest(db, 'request-touch', '555555', new Date(+NOW + 1_800_000), NOW)
  await repository.approveKitchenTvPairingCode(db, '555555', BUSINESS, NOW)
  await repository.activateKitchenTvApprovedRequest(db, 'request-touch', 'session-touch', NOW)

  const before = sqlite.prepare('SELECT total_changes() AS n').get().n
  assert.equal(await repository.touchKitchenTvSession(db, BUSINESS, new Date(+NOW + 299_999), 300_000), false)
  assert.equal(sqlite.prepare('SELECT total_changes() AS n').get().n, before)
  assert.equal(await repository.touchKitchenTvSession(db, BUSINESS, new Date(+NOW + 300_000), 300_000), true)
  assert.equal((await repository.loadKitchenTvAccess(db, BUSINESS)).lastSeenAt, new Date(+NOW + 300_000).toISOString())
})
