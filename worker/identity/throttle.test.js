import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { reserveIdentityLogin, completeIdentityLogin, reserveIdentityRecovery, prepareIdentityDeliveryReservation } from './throttle.js'
import { commitIdentityStatements } from './transactions.js'

test('login reservations enforce global account limit under concurrency and release only successes', async (t) => {
  const f = await createTenancyFixture(t)
  const input = { email: 'alice@example.test', originKey: 'test-origin', now: f.now }
  const attempts = await Promise.all(Array.from({ length: 8 }, () => reserveIdentityLogin(f.db, input)))
  assert.equal(attempts.filter((a) => a.allowed).length, 5)
  await completeIdentityLogin(f.db, attempts.find((a) => a.allowed).attemptId, true)
  assert.equal((await reserveIdentityLogin(f.db, input)).allowed, true)
  assert.equal((await reserveIdentityLogin(f.db, input)).allowed, false)
  const expired = new Date(f.now.getTime() + 15 * 60_000)
  assert.equal((await reserveIdentityLogin(f.db, { ...input, now: expired })).allowed, true)
  const stored = JSON.stringify(f.sqlite.prepare('SELECT * FROM identity_login_attempts').all())
  assert.equal(stored.includes(input.email) || stored.includes(input.originKey), false)
})

test('login origin permits exactly thirty reservations across accounts', async (t) => {
  const f = await createTenancyFixture(t)
  const attempts = await Promise.all(Array.from({ length: 32 }, (_, i) => reserveIdentityLogin(f.db, { email: `person${i}@example.test`, originKey: 'same-origin', now: f.now })))
  assert.equal(attempts.filter((a) => a.allowed).length, 30)
})

test('recovery has separate thirty-minute account and fifteen-minute origin windows', async (t) => {
  const f = await createTenancyFixture(t)
  const input = { email: 'alice@example.test', originKey: 'origin-one', now: f.now }
  for (let i = 0; i < 3; i++) assert.equal((await reserveIdentityRecovery(f.db, input)).allowed, true)
  assert.equal((await reserveIdentityRecovery(f.db, input)).allowed, false)
  assert.equal((await reserveIdentityRecovery(f.db, { ...input, now: new Date(f.now.getTime() + 15 * 60_000) })).allowed, false)
  assert.equal((await reserveIdentityRecovery(f.db, { ...input, now: new Date(f.now.getTime() + 30 * 60_000) })).allowed, true)
  const attempts = await Promise.all(Array.from({ length: 12 }, (_, i) => reserveIdentityRecovery(f.db, { email: `other${i}@example.test`, originKey: 'origin-two', now: f.now })))
  assert.equal(attempts.filter((a) => a.allowed).length, 10)
})

test('delivery cooldown and UTC budget cannot be bypassed by companies or concurrent batches', async (t) => {
  const f = await createTenancyFixture(t)
  const reserve = (subjectId, overrides = {}) => prepareIdentityDeliveryReservation(f.db, { accountId: f.accounts.alice, subjectId, emitterId: f.accounts.admin, businessId: f.businesses.A, now: f.now, dailyLimit: 2, ...overrides })
  await commitIdentityStatements(f.db, [reserve('first')])
  await assert.rejects(commitIdentityStatements(f.db, [reserve('too-soon')]))
  await commitIdentityStatements(f.db, [reserve('second', { businessId: f.businesses.B })])
  await assert.rejects(commitIdentityStatements(f.db, [reserve('third', { accountId: f.accounts.bob })]))
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_email_deliveries').get().n, 2)
  await commitIdentityStatements(f.db, [reserve('tomorrow', { now: new Date('2026-10-03T00:00:00.000Z') })])
  assert.throws(() => reserve('invalid', { dailyLimit: 0 }), { code: 'EMAIL_CONFIG_UNAVAILABLE' })
})

test('delivery reservation rejects concurrency without leaving partial application writes', async (t) => {
  const f = await createTenancyFixture(t)
  const attempts = await Promise.allSettled(['one', 'two'].map((subjectId) => commitIdentityStatements(f.db, [
    f.db.prepare('UPDATE accounts SET display_name = ? WHERE id = ?').bind(subjectId, f.accounts.alice),
    prepareIdentityDeliveryReservation(f.db, { accountId: f.accounts.alice, subjectId, now: f.now, dailyLimit: 1 }),
  ])))
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(f.sqlite.prepare('SELECT display_name FROM accounts WHERE id = ?').get(f.accounts.alice).display_name, 'one')
})

test('invitation quotas count the emitter across companies and the company across emitters', async (t) => {
  const f = await createTenancyFixture(t)
  const prepare = (subjectId, overrides = {}) => prepareIdentityDeliveryReservation(f.db, { accountId: f.accounts.alice, subjectId, emitterId: f.accounts.admin, businessId: f.businesses.A, now: f.now, cooldownSeconds: 0, emitterLimit: 2, businessLimit: 3, ...overrides })
  await commitIdentityStatements(f.db, [prepare('issuer-one')])
  await commitIdentityStatements(f.db, [prepare('issuer-two', { businessId: f.businesses.B })])
  await assert.rejects(commitIdentityStatements(f.db, [prepare('issuer-three', { businessId: f.businesses.B })]))
  await commitIdentityStatements(f.db, [prepare('other-issuer-one', { emitterId: f.accounts.carol })])
  await commitIdentityStatements(f.db, [prepare('other-issuer-two', { emitterId: f.accounts.carol })])
  await assert.rejects(commitIdentityStatements(f.db, [prepare('company-four', { emitterId: f.accounts.bob })]))
})

test('default environment budget admits exactly eighty sends and cleanup is bounded outside live windows', async (t) => {
  const f = await createTenancyFixture(t)
  for (let i = 0; i < 80; i++) await commitIdentityStatements(f.db, [prepareIdentityDeliveryReservation(f.db, { accountId: f.accounts.alice, subjectId: `daily-${i}`, cooldownSeconds: 0, now: f.now })])
  await assert.rejects(commitIdentityStatements(f.db, [prepareIdentityDeliveryReservation(f.db, { accountId: f.accounts.bob, subjectId: 'daily-81', cooldownSeconds: 0, now: f.now })]))
  const insert = f.sqlite.prepare('INSERT INTO identity_login_attempts(id,account_hash,origin_hash,created_at) VALUES(?,?,?,?)')
  for (let i = 0; i < 105; i++) insert.run(`old-${i}`, 'old-account', 'old-origin', '2026-09-28T00:00:00.000Z')
  insert.run('live-attempt', 'live-account', 'live-origin', f.now.toISOString())
  await reserveIdentityLogin(f.db, { email: 'alice@example.test', originKey: 'new-origin', now: f.now })
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM identity_login_attempts WHERE id LIKE 'old-%'").get().n, 5)
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM identity_login_attempts WHERE id = 'live-attempt'").get().n, 1)
})
