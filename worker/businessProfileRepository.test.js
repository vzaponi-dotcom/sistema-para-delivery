import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from './test-support/settingsDb.js'
import { EMPTY_BUSINESS_PROFILE } from '../shared/businessProfile.js'
import { loadBusinessProfile, saveBusinessProfile } from './businessProfileRepository.js'
import { readSettingsReceipt } from './settingsTransactions.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-24T03:30:00.000Z')
const changed = () => ({
  name: 'Amor & Sabor Centro',
  phone: '(19) 99999-9999',
  address: {
    line: 'Rua das Flores',
    number: '123',
    complement: 'Fundos',
    neighborhood: 'Centro',
    city: 'Monte Mor',
    state: 'SP',
    postalCode: '13190000',
  },
})
const input = (mutationId = 'profile-1', expectedRevision = 1, data = changed()) => ({ mutationId, expectedRevision, data })
const logo = Object.freeze({
  objectKey: 'businesses/amor-e-sabor/logo/logo-1.webp',
  contentType: 'image/webp',
  sha256: 'a'.repeat(64),
  sizeBytes: 12345,
  updatedAt: NOW.toISOString(),
})
const state = (sqlite) => ({
  business: { ...sqlite.prepare("SELECT id, slug, name, updated_at FROM businesses WHERE id = ?").get(BUSINESS) },
  profile: sqlite.prepare("SELECT * FROM business_profiles WHERE business_id = ?").get(BUSINESS)
    ? { ...sqlite.prepare("SELECT * FROM business_profiles WHERE business_id = ?").get(BUSINESS) } : null,
  receipts: sqlite.prepare("SELECT * FROM settings_mutation_receipts WHERE business_id = ? AND resource_key = 'businessProfile' ORDER BY mutation_id").all(BUSINESS).map((row) => ({ ...row })),
  assertions: sqlite.prepare('SELECT * FROM settings_tx_assertions ORDER BY tx_id, check_key').all().map((row) => ({ ...row })),
})

function setup(t) {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  return fixture
}

test('load exposes safe business profile data without leaking logo storage metadata', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare(`UPDATE business_profiles SET logo_object_key = ?, logo_content_type = ?, logo_sha256 = ?,
    logo_size_bytes = ?, logo_updated_at = ? WHERE business_id = ?`)
    .run(logo.objectKey, logo.contentType, logo.sha256, logo.sizeBytes, logo.updatedAt, BUSINESS)

  const loaded = await loadBusinessProfile(db, BUSINESS)

  assert.equal(loaded.resource, 'businessProfile')
  assert.equal(loaded.revision, 1)
  assert.equal(loaded.data.name, 'Amor & Sabor')
  assert.deepEqual(loaded.data.address, EMPTY_BUSINESS_PROFILE.address)
  assert.deepEqual(loaded.data.logo, { present: true, version: NOW.toISOString() })
  assert.equal(JSON.stringify(loaded).includes(logo.objectKey), false)
  assert.equal(JSON.stringify(loaded).includes(logo.sha256), false)
})

test('save updates businesses.name, profile fields, logo metadata and receipt atomically', async (t) => {
  const { db, sqlite } = setup(t)

  const saved = await saveBusinessProfile(db, BUSINESS, input(), logo, NOW)

  assert.equal(saved.resource.revision, 2)
  assert.deepEqual(saved.resource.data, { ...changed(), logo: { present: true, version: NOW.toISOString() } })
  assert.deepEqual(saved.receipt, {
    mutationId: 'profile-1',
    committedRevision: 2,
    committedAt: NOW.toISOString(),
    replayed: false,
  })
  assert.equal(sqlite.prepare("SELECT name FROM businesses WHERE id = ?").get(BUSINESS).name, 'Amor & Sabor Centro')
  const stored = sqlite.prepare("SELECT * FROM business_profiles WHERE business_id = ?").get(BUSINESS)
  assert.equal(stored.logo_object_key, logo.objectKey)
  assert.equal(stored.logo_sha256, logo.sha256)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})

test('fresh no-op creates a receipt without changing revision or timestamps', async (t) => {
  const { db, sqlite } = setup(t)
  const current = await loadBusinessProfile(db, BUSINESS)
  const before = state(sqlite)

  const saved = await saveBusinessProfile(db, BUSINESS, input('noop', 1, {
    name: current.data.name,
    phone: current.data.phone,
    address: current.data.address,
  }), undefined, NOW)

  assert.equal(saved.resource.revision, 1)
  assert.deepEqual(state(sqlite).business, before.business)
  assert.deepEqual(state(sqlite).profile, before.profile)
  assert.equal((await readSettingsReceipt(db, BUSINESS, 'businessProfile', 'noop', NOW)).committedRevision, 1)
})

test('valid profile absence reads revision zero and initializes safely', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare("INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES ('new', 'new', 'Nova', ?, ?)")
    .run(NOW.toISOString(), NOW.toISOString())

  const absent = await loadBusinessProfile(db, 'new')
  assert.equal(absent.revision, 0)
  assert.deepEqual(absent.data, { ...EMPTY_BUSINESS_PROFILE, name: 'Nova', logo: { present: false, version: null } })

  const initialized = await saveBusinessProfile(db, 'new', {
    mutationId: 'init',
    expectedRevision: 0,
    data: { ...EMPTY_BUSINESS_PROFILE, name: 'Nova Unidade' },
  }, undefined, NOW)
  assert.equal(initialized.resource.revision, 1)
  assert.equal(sqlite.prepare("SELECT name FROM businesses WHERE id = 'new'").get().name, 'Nova Unidade')
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM business_profiles WHERE business_id = 'new'").get().n, 1)
})

test('revision conflicts, replay and mutation ID reuse follow settings semantics', async (t) => {
  const { db } = setup(t)
  const saved = await saveBusinessProfile(db, BUSINESS, input(), undefined, NOW)
  assert.equal(saved.resource.revision, 2)

  const replay = await saveBusinessProfile(db, BUSINESS, input(), undefined, new Date(+NOW + 1000))
  assert.equal(replay.receipt.replayed, true)
  assert.equal(replay.resource.revision, 2)

  await assert.rejects(saveBusinessProfile(db, BUSINESS, input('profile-1', 1, {
    ...changed(),
    phone: 'outro',
  }), undefined, NOW), { status: 409, code: 'SETTINGS_MUTATION_REUSED' })

  await assert.rejects(saveBusinessProfile(db, BUSINESS, input('stale', 1, {
    ...changed(),
    phone: 'stale',
  }), undefined, NOW), { status: 409, code: 'BUSINESS_PROFILE_REVISION_CONFLICT' })
})

test('partial/corrupt profile state and missing typed schema fail closed', async (t) => {
  for (const corrupt of [
    "PRAGMA ignore_check_constraints = ON; UPDATE business_profiles SET revision = 0 WHERE business_id = 'amor-e-sabor'",
    "UPDATE business_profiles SET logo_object_key = 'orphan.webp' WHERE business_id = 'amor-e-sabor'",
    'ALTER TABLE business_profiles RENAME COLUMN phone TO missing',
    'DROP TABLE settings_tx_assertions',
  ]) {
    const fixture = createSettingsDb()
    t.after(fixture.close)
    fixture.sqlite.exec(corrupt)
    await assert.rejects(loadBusinessProfile(fixture.db, BUSINESS), { status: 503, code: 'BUSINESS_PROFILE_UNAVAILABLE' })
  }
})

test('invalid aggregate and invalid trusted logo metadata fail before SQL is prepared', async () => {
  const db = { prepare() { assert.fail('invalid input reached SQL preparation') } }
  await assert.rejects(saveBusinessProfile(db, BUSINESS, { ...input(), role: 'admin' }, undefined, NOW), { status: 400, code: 'BUSINESS_PROFILE_INVALID' })
  await assert.rejects(saveBusinessProfile(db, BUSINESS, input(), { ...logo, objectKey: '' }, NOW), { status: 400, code: 'BUSINESS_PROFILE_INVALID' })
})

test('failure late in the D1 batch rolls back name, profile, assertions and receipt', async (t) => {
  const { db, sqlite } = setup(t)
  const before = state(sqlite)
  sqlite.exec("CREATE TRIGGER fail_business_profile_receipt AFTER INSERT ON settings_mutation_receipts WHEN NEW.resource_key = 'businessProfile' BEGIN SELECT RAISE(ABORT, 'late receipt failure'); END")

  await assert.rejects(saveBusinessProfile(db, BUSINESS, input(), logo, NOW), { status: 503, code: 'BUSINESS_PROFILE_UNAVAILABLE' })
  assert.deepEqual(state(sqlite), before)
})

test('transport failure after commit reconciles by receipt and failure before commit remains unconfirmed without retry', async (t) => {
  const { db } = setup(t)
  let batches = 0
  const lostResponse = { ...db, async batch(statements) { batches += 1; await db.batch(statements); throw new Error('transport timeout after commit') } }
  const recovered = await saveBusinessProfile(lostResponse, BUSINESS, input(), undefined, NOW)
  assert.equal(recovered.receipt.replayed, true)
  assert.equal(batches, 1)

  let pending
  const beforeCommit = { ...db, async batch(statements) { batches += 1; pending = statements; throw new Error('transport timeout before commit') } }
  await assert.rejects(saveBusinessProfile(beforeCommit, BUSINESS, input('pending', 2, {
    ...changed(),
    phone: 'novo',
  }), undefined, new Date(+NOW + 1000)), {
    status: 503,
    code: 'BUSINESS_PROFILE_UNAVAILABLE',
    outcome: 'unconfirmed',
  })
  assert.equal(batches, 2)
  assert.equal(await readSettingsReceipt(db, BUSINESS, 'businessProfile', 'pending', new Date(+NOW + 1000)), null)
  await db.batch(pending)
  assert.equal((await readSettingsReceipt(db, BUSINESS, 'businessProfile', 'pending', new Date(+NOW + 1000))).committedRevision, 3)
})

test('business isolation keeps another profile independent', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare("INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES ('other', 'other', 'Outro', ?, ?)").run(NOW.toISOString(), NOW.toISOString())

  await saveBusinessProfile(db, 'other', {
    mutationId: 'other-profile',
    expectedRevision: 0,
    data: { ...EMPTY_BUSINESS_PROFILE, name: 'Outro Renomeado' },
  }, undefined, NOW)

  assert.equal((await loadBusinessProfile(db, BUSINESS)).data.name, 'Amor & Sabor')
  assert.equal((await loadBusinessProfile(db, 'other')).data.name, 'Outro Renomeado')
  assert.equal(sqlite.prepare("SELECT name FROM businesses WHERE id = ?").get(BUSINESS).name, 'Amor & Sabor')
})
