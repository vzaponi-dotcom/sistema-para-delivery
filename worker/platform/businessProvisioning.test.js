import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { createBusiness } from './businessProvisioning.js'
import { acceptCompanyInvitation } from '../tenancy/companyInvitations.js'

const payload = { name: ' Company New ', managerName: ' First Manager ', managerEmail: ' NEW@example.test ' }
const environment = f => ({ DB: f.db, AUTH_MULTI_COMPANY_ENABLED: 'true', AUTH_EMAIL_FROM: 'Mesiva <access@example.test>', AUTH_PUBLIC_ORIGIN: 'https://example.test', RESEND_API_KEY: 'synthetic-fixture-key' })
const pendingWork = () => { const work = []; return { work, waitUntil: promise => work.push(promise) } }

test('provision commits one pending company and hash-only invitation before background delivery; acceptance activates both', async t => {
  const f = await createTenancyFixture(t), background = pendingWork(), idempotencyKey = crypto.randomUUID()
  let message, release
  const gate = new Promise(resolve => { release = resolve })
  const result = await createBusiness(environment(f), f.contexts.admin, payload, { idempotencyKey, now: f.now, waitUntil: background.waitUntil, deliver: async (_env, msg) => { message = msg; await gate; return { status: 'accepted' } } })
  assert.equal(result.created, true)
  assert.equal(result.deliveryStatus, 'pending')
  assert.equal('token' in result, false)
  assert.equal(f.sqlite.prepare('SELECT access_status FROM businesses WHERE id = ?').get(result.businessId).access_status, 'pending')
  const invitation = f.sqlite.prepare('SELECT * FROM company_invitations WHERE id = ?').get(result.invitationId)
  assert.ok(invitation.token_hash)
  assert.equal(JSON.stringify(invitation).includes(message.token), false)
  release()
  await Promise.all(background.work)
  assert.equal(f.sqlite.prepare('SELECT delivery_status FROM company_invitations WHERE id = ?').get(result.invitationId).delivery_status, 'accepted')
  await acceptCompanyInvitation(f.db, { token: message.token, password: 'New manager password 2026!', now: f.now })
  assert.equal(f.sqlite.prepare('SELECT access_status FROM businesses WHERE id = ?').get(result.businessId).access_status, 'active')
  assert.equal(f.sqlite.prepare('SELECT membership_state FROM users WHERE id = ?').get(result.firstManagerId).membership_state, 'active')
})

test('idempotent replay works after response loss and full quota, while changed payload conflicts and a different key creates a new intent', async t => {
  const f = await createTenancyFixture(t), env = environment(f), background = pendingWork(), key = crypto.randomUUID()
  const options = { idempotencyKey: key, now: f.now, waitUntil: background.waitUntil, deliver: async () => ({ status: 'rejected' }) }
  const first = await createBusiness(env, f.contexts.admin, payload, options)
  await Promise.all(background.work)
  const replay = await createBusiness({ ...env, AUTH_EMAIL_DAILY_LIMIT: 1 }, f.contexts.admin, { ...payload, name: payload.name.trim() }, options)
  assert.equal(replay.businessId, first.businessId)
  assert.equal(replay.created, false)
  assert.equal(replay.deliveryStatus, 'rejected')
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_email_deliveries').get().n, 1)
  await assert.rejects(createBusiness(env, f.contexts.admin, { ...payload, name: 'Different' }, options), { code: 'PROVISIONING_KEY_REUSED' })
  const second = await createBusiness(env, f.contexts.admin, payload, { ...options, idempotencyKey: crypto.randomUUID() })
  assert.notEqual(second.businessId, first.businessId)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM accounts WHERE email_normalized = ?').get('new@example.test').n, 1)
  await Promise.all(background.work)
})

test('concurrent duplicate requests create one company, reservation and delivery', async t => {
  const f = await createTenancyFixture(t), background = pendingWork(), options = { idempotencyKey: crypto.randomUUID(), now: f.now, waitUntil: background.waitUntil, deliver: async () => ({ status: 'accepted' }) }
  const results = await Promise.all([createBusiness(environment(f), f.contexts.admin, payload, options), createBusiness(environment(f), f.contexts.admin, payload, options)])
  assert.equal(results[0].businessId, results[1].businessId)
  assert.equal(results.filter(r => r.created).length, 1)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM platform_provisioning_receipts').get().n, 1)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_email_deliveries').get().n, 1)
  assert.equal(background.work.length, 1)
  await Promise.all(background.work)
})

test('different companies for an existing email retain one identity and its credential', async t => {
  const f = await createTenancyFixture(t), background = pendingWork()
  const before = f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id = ?').get(f.accounts.carol)
  const results = await Promise.all([1, 2].map(n => createBusiness(environment(f), f.contexts.admin, { ...payload, name: `Company ${n}`, managerEmail: 'carol@example.test' }, { idempotencyKey: crypto.randomUUID(), now: f.now, waitUntil: background.waitUntil, deliver: async () => ({ status: 'uncertain' }) })))
  assert.notEqual(results[0].businessId, results[1].businessId)
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id = ?').get(f.accounts.carol), before)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM accounts WHERE email_normalized = ?').get('carol@example.test').n, 1)
  await Promise.all(background.work)
})

test('absent execution context, invalid fields, quota exhaustion and business scope cannot create partial companies', async t => {
  const f = await createTenancyFixture(t), background = pendingWork(), env = environment(f)
  const initialCount = f.sqlite.prepare('SELECT count(*) n FROM businesses').get().n
  const options = { idempotencyKey: crypto.randomUUID(), now: f.now, waitUntil: background.waitUntil, deliver: async () => ({ status: 'rejected' }) }
  await assert.rejects(createBusiness(env, f.contexts.admin, payload, { ...options, waitUntil: undefined }), { code: 'EXECUTION_CONTEXT_UNAVAILABLE' })
  await assert.rejects(createBusiness(env, f.contexts.admin, { ...payload, name: 'x'.repeat(201) }, options), { status: 400 })
  await assert.rejects(createBusiness(env, f.contexts.admin, payload, { ...options, idempotencyKey: 'arbitrary' }), { status: 400 })
  await assert.rejects(createBusiness(env, f.contexts.aliceA, payload, options), { status: 403 })
  await createBusiness({ ...env, AUTH_EMAIL_DAILY_LIMIT: 1 }, f.contexts.admin, payload, options)
  await assert.rejects(createBusiness({ ...env, AUTH_EMAIL_DAILY_LIMIT: 1 }, f.contexts.admin, { ...payload, managerEmail: 'other@example.test' }, { ...options, idempotencyKey: crypto.randomUUID() }), { code: 'EMAIL_DELIVERY_LIMITED' })
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM businesses').get().n, initialCount + 1)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM accounts WHERE email_normalized = ?').get('other@example.test').n, 0)
  await Promise.all(background.work)
})

test('platform grant revoked during preparation rolls back defaults, receipt, identity and invitation', async t => {
  const f = await createTenancyFixture(t), originalBatch = f.db.batch.bind(f.db), background = pendingWork()
  const initialCount = f.sqlite.prepare('SELECT count(*) n FROM businesses').get().n
  f.db.batch = async statements => {
    f.sqlite.prepare("DELETE FROM platform_grants WHERE account_id = ? AND capability = 'platform.businesses.create'").run(f.accounts.admin)
    return originalBatch(statements)
  }
  await assert.rejects(createBusiness(environment(f), f.contexts.admin, payload, { idempotencyKey: crypto.randomUUID(), now: f.now, waitUntil: background.waitUntil }), { code: 'PROVISIONING_CONTEXT_CHANGED' })
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM businesses').get().n, initialCount)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM platform_provisioning_receipts').get().n, 0)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM accounts WHERE email_normalized = ?').get('new@example.test').n, 0)
  assert.equal(background.work.length, 0)
})

test('expired administrative session during preparation cannot commit a new company', async t => {
  const f = await createTenancyFixture(t), background = pendingWork(), readings = [0, 13 * 3600_000]
  const count = f.sqlite.prepare('SELECT count(*) n FROM businesses').get().n
  await assert.rejects(createBusiness(environment(f), f.contexts.admin, payload, { idempotencyKey: crypto.randomUUID(), now: f.now, waitUntil: background.waitUntil, monotonicNow: () => readings.shift() }), { code: 'PROVISIONING_CONTEXT_CHANGED' })
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM businesses').get().n, count)
  assert.equal(background.work.length, 0)
})

test('concurrent new-company requests for a new email resolve the same global account without a credential', async t => {
  const f = await createTenancyFixture(t), background = pendingWork()
  const results = await Promise.all([1, 2].map(n => createBusiness(environment(f), f.contexts.admin, { ...payload, name: `Company ${n}` }, { idempotencyKey: crypto.randomUUID(), now: f.now, waitUntil: background.waitUntil, deliver: async () => ({ status: 'accepted' }) })))
  const members = results.map(result => f.sqlite.prepare('SELECT account_id FROM users WHERE id = ?').get(result.firstManagerId))
  assert.equal(members[0].account_id, members[1].account_id)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_credentials WHERE account_id = ?').get(members[0].account_id).n, 0)
  await Promise.all(background.work)
})
