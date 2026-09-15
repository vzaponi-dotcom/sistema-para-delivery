import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from './test-support/settingsDb.js'
import { hashSettingsPayload, prepareSettingsAssertion, clearSettingsAssertions, readSettingsReceipt } from './settingsTransactions.js'

test('canonical hash ignores object key order, preserves lists and includes scope/resource/revision', async () => {
  const input = { businessId: 'a', resource: 'operations', expectedRevision: 1, data: { a: 1, b: ['x', 'y'] } }
  const hash = await hashSettingsPayload(input)
  assert.match(hash ?? '', /^[a-f0-9]{64}$/)
  assert.equal(await hashSettingsPayload({ ...input, data: { b: ['x', 'y'], a: 1 } }), hash)
  for (const change of [{ businessId: 'b' }, { resource: 'printingPolicy' }, { scopeId: 'station' }, { expectedRevision: 2 }, { data: { a: 1, b: ['y', 'x'] } }]) {
    assert.notEqual(await hashSettingsPayload({ ...input, ...change }), hash)
  }
  await assert.rejects(hashSettingsPayload({ data: { missing: undefined } }), { code: 'SETTINGS_INVALID' })
})

test('false bound assertion aborts SQL with a classified error and rolls back preceding writes', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  for (const [key, code] of [['revision', 'SETTINGS_REVISION_CONFLICT'], ['unused', 'SETTINGS_ITEM_USED'], ['policy', 'POLICY_CHANGED'], ['state', 'SETTINGS_INVALID']]) {
    const statement = prepareSettingsAssertion(db, key, key, '? = ?', [1, 2])
    assert.ok(statement, 'missing SQL assertion')
    await assert.rejects(db.batch([db.prepare('UPDATE business_operation_settings SET revision = 9'), statement]), new RegExp(code))
    assert.equal(sqlite.prepare('SELECT revision FROM business_operation_settings').get().revision, 1)
  }
  await db.batch([prepareSettingsAssertion(db, 'ok', 'revision', '? = ?', [1, 1]), clearSettingsAssertions(db, 'ok')])
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})

test('receipt query is scoped, expires at 24 hours and missing is unconfirmed rather than rollback', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  const now = new Date('2026-09-12T12:00:00.000Z')
  sqlite.prepare('INSERT INTO settings_mutation_receipts (business_id, resource_key, mutation_id, payload_hash, committed_revision, committed_at) VALUES (?, ?, ?, ?, ?, ?)').run('amor-e-sabor', 'operations', 'saved', 'hash', 2, '2026-09-11T12:00:00.001Z')
  const receipt = await readSettingsReceipt(db, 'amor-e-sabor', 'operations', 'saved', now)
  assert.equal(receipt?.committedRevision, 2)
  assert.equal(receipt.payloadHash, 'hash')
  assert.equal(await readSettingsReceipt(db, 'amor-e-sabor', 'other', 'saved', now), null)
  assert.equal(await readSettingsReceipt(db, 'another', 'operations', 'saved', now), null)
  assert.equal(await readSettingsReceipt(db, 'amor-e-sabor', 'operations', 'pending', now), null)
  sqlite.prepare('UPDATE settings_mutation_receipts SET committed_at = ?').run('2026-09-11T12:00:00.000Z')
  await assert.rejects(readSettingsReceipt(db, 'amor-e-sabor', 'operations', 'saved', now), { status: 409, code: 'SETTINGS_REVISION_CONFLICT' })
  sqlite.exec('DROP TABLE settings_mutation_receipts')
  await assert.rejects(readSettingsReceipt(db, 'amor-e-sabor', 'operations', 'saved', now), { status: 503, code: 'SETTINGS_UNAVAILABLE' })
})
