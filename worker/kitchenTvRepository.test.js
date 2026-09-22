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

test('migration 0028 installs cleanly, upgrades an existing database and keeps foreign keys clean', () => {
  const files = readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
  assert.equal(files.at(-1), '0028_kitchen_tv_access.sql')

  const clean = createSettingsDb()
  try {
    assert.equal(clean.sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'kitchen_tv_access'").get().n, 1)
    assert.deepEqual(clean.sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  } finally {
    clean.close()
  }

  const sqlite = new DatabaseSync(':memory:')
  try {
    for (const file of files.slice(0, -1)) sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
    sqlite.exec("INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES ('upgrade', 'upgrade', 'Upgrade', '2026-09-22', '2026-09-22')")
    sqlite.exec(readFileSync(new URL(files.at(-1), migrations), 'utf8'))
    sqlite.exec("INSERT INTO kitchen_tv_access (business_id, created_at, updated_at) VALUES ('upgrade', '2026-09-22', '2026-09-22')")
    assert.equal(sqlite.prepare("SELECT business_id FROM kitchen_tv_access WHERE business_id = 'upgrade'").get().business_id, 'upgrade')
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  } finally {
    sqlite.close()
  }
})

test('one row per business and unique non-null hashes are enforced by the schema', () => {
  const fixture = createSettingsDb()
  try {
    const insert = fixture.sqlite.prepare(`INSERT INTO kitchen_tv_access
      (business_id, pairing_token_hash, session_token_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    insert.run(BUSINESS, 'pair-a', 'session-a', NOW.toISOString(), NOW.toISOString())
    assert.throws(() => insert.run(BUSINESS, 'pair-b', 'session-b', NOW.toISOString(), NOW.toISOString()))
    fixture.sqlite.prepare("INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES ('other', 'other', 'Other', '2026-09-22', '2026-09-22')").run()
    assert.throws(() => insert.run('other', 'pair-a', 'session-b', NOW.toISOString(), NOW.toISOString()))
  } finally {
    fixture.close()
  }
})

test('issuing access stores only the supplied hash and invalidates prior pairing and session state', async (t) => {
  const repository = await repositoryPromise
  assert.equal(typeof repository.issueKitchenTvPairing, 'function')
  const { db, sqlite } = setup(t)

  await repository.issueKitchenTvPairing(db, BUSINESS, 'sha256:first', new Date(+NOW + 1_800_000), NOW)
  await repository.consumeKitchenTvPairing(db, 'sha256:first', 'sha256:session-old', new Date(+NOW + 1_000))
  await repository.issueKitchenTvPairing(db, BUSINESS, 'sha256:second', new Date(+NOW + 1_801_000), new Date(+NOW + 1_000))

  const row = sqlite.prepare('SELECT * FROM kitchen_tv_access WHERE business_id = ?').get(BUSINESS)
  assert.equal(row.pairing_token_hash, 'sha256:second')
  assert.equal(row.session_token_hash, null)
  assert.equal(row.paired_at, null)
  assert.equal(row.last_seen_at, null)
  assert.equal(JSON.stringify(row).includes('first-plaintext-secret'), false)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM kitchen_tv_access WHERE business_id = ?').get(BUSINESS).n, 1)
})

test('valid pairing is consumed atomically once and an expired or used token cannot be consumed', async (t) => {
  const repository = await repositoryPromise
  const { db } = setup(t)
  await repository.issueKitchenTvPairing(db, BUSINESS, 'pair-valid', new Date(+NOW + 1_800_000), NOW)

  const paired = await repository.consumeKitchenTvPairing(db, 'pair-valid', 'session-valid', new Date(+NOW + 1_000))
  assert.equal(paired.businessId, BUSINESS)
  assert.equal(paired.sessionTokenHash, 'session-valid')
  assert.equal(await repository.consumeKitchenTvPairing(db, 'pair-valid', 'session-other', new Date(+NOW + 2_000)), null)

  await repository.issueKitchenTvPairing(db, OTHER_BUSINESS, 'pair-expired', new Date(+NOW - 1), NOW)
  assert.equal(await repository.consumeKitchenTvPairing(db, 'pair-expired', 'session-expired', NOW), null)
})

test('session lookup is business-bound and revocation removes the active session', async (t) => {
  const repository = await repositoryPromise
  const { db } = setup(t)
  await repository.issueKitchenTvPairing(db, BUSINESS, 'pair-main', new Date(+NOW + 1_800_000), NOW)
  await repository.consumeKitchenTvPairing(db, 'pair-main', 'session-main', new Date(+NOW + 1_000))

  const active = await repository.loadKitchenTvSessionByHash(db, 'session-main')
  assert.equal(active.businessId, BUSINESS)
  assert.equal(active.sessionTokenHash, 'session-main')
  assert.equal(await repository.loadKitchenTvSessionByHash(db, 'session-main', OTHER_BUSINESS), null)

  await repository.revokeKitchenTvAccess(db, BUSINESS, new Date(+NOW + 2_000))
  assert.equal(await repository.loadKitchenTvSessionByHash(db, 'session-main'), null)
  const revoked = await repository.loadKitchenTvAccess(db, BUSINESS)
  assert.equal(revoked.sessionTokenHash, null)
  assert.equal(revoked.revokedAt, new Date(+NOW + 2_000).toISOString())
})

test('last seen touch writes only at or after the five minute threshold', async (t) => {
  const repository = await repositoryPromise
  const { db, sqlite } = setup(t)
  await repository.issueKitchenTvPairing(db, BUSINESS, 'pair-touch', new Date(+NOW + 1_800_000), NOW)
  await repository.consumeKitchenTvPairing(db, 'pair-touch', 'session-touch', NOW)

  const before = sqlite.prepare('SELECT total_changes() AS n').get().n
  assert.equal(await repository.touchKitchenTvSession(db, BUSINESS, new Date(+NOW + 299_999), 300_000), false)
  assert.equal(sqlite.prepare('SELECT total_changes() AS n').get().n, before)
  assert.equal(await repository.touchKitchenTvSession(db, BUSINESS, new Date(+NOW + 300_000), 300_000), true)
  assert.equal((await repository.loadKitchenTvAccess(db, BUSINESS)).lastSeenAt, new Date(+NOW + 300_000).toISOString())
})
