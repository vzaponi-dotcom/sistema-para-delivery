import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { createBusiness } from './businessProvisioning.js'
import { listPlatformBusinesses, getPlatformBusiness } from './businessesRepository.js'

const env = f => ({ DB: f.db, AUTH_MULTI_COMPANY_ENABLED: true, RESEND_API_KEY: 'synthetic', AUTH_EMAIL_FROM: 'Mesiva <access@example.test>', AUTH_PUBLIC_ORIGIN: 'https://example.test' })
test('registration projection paginates with validated cursor and never includes credentials, tokens or operational data', async t => {
  const f = await createTenancyFixture(t), work = []
  const created = await createBusiness(env(f), f.contexts.admin, { name: 'Test 100% New', managerName: 'First', managerEmail: 'carol@example.test' }, { idempotencyKey: crypto.randomUUID(), now: f.now, waitUntil: p => work.push(p), deliver: async () => ({ status: 'uncertain', payload: 'private-upstream' }) })
  await Promise.all(work)
  const first = await listPlatformBusinesses(f.db, { limit: 1 })
  const second = await listPlatformBusinesses(f.db, { limit: 1, cursor: first.nextCursor })
  assert.notEqual(first.items[0].id, second.items[0].id)
  assert.equal((await listPlatformBusinesses(f.db, { query: '100%' })).items.length, 1)
  assert.equal((await listPlatformBusinesses(f.db, { query: 'missing' })).items.length, 0)
  const detail = await getPlatformBusiness(f.db, created.businessId, f.now)
  assert.equal(detail.firstManager.email, 'carol@example.test')
  assert.equal(detail.accessStatus, 'pending')
  assert.equal(detail.invitation.deliveryStatus, 'uncertain')
  assert.equal(detail.invitation.status, 'pending')
  const body = JSON.stringify(detail)
  for (const forbidden of ['password_verifier', 'token_hash', 'private-upstream', f.businesses.B, 'orders', 'capabilities']) assert.equal(body.includes(forbidden), false)
  assert.equal((await getPlatformBusiness(f.db, created.businessId, new Date('2026-10-04T00:00:00Z'))).invitation.status, 'expired')
  f.sqlite.prepare("UPDATE businesses SET access_status = 'active' WHERE id = ?").run(created.businessId)
  f.sqlite.prepare("UPDATE users SET membership_state = 'active' WHERE id = ?").run(created.firstManagerId)
  assert.equal((await getPlatformBusiness(f.db, created.businessId, f.now)).invitation.canResend, false)
  for (const invalid of [{ limit: 51 }, { limit: 0 }, { cursor: 'malformed' }, { query: 'a'.repeat(201) }, { query: 'changed', cursor: first.nextCursor }]) await assert.rejects(listPlatformBusinesses(f.db, invalid), { status: 400 })
  await assert.rejects(getPlatformBusiness(f.db, 'foreign-unknown', f.now), { status: 404 })
})
