import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { handlePlatformBusinessesApi } from './businessesApi.js'

const env = f => ({ DB: f.db, AUTH_MULTI_COMPANY_ENABLED: true, RESEND_API_KEY: 'synthetic', AUTH_EMAIL_FROM: 'Mesiva <access@example.test>', AUTH_PUBLIC_ORIGIN: 'https://example.test' })
const request = (context, path = '/api/platform/businesses', method = 'GET', body, origin = 'https://example.test') => new Request(`https://example.test${path}`, { method, headers: { origin, 'X-Mesiva-Context': context.contextId, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
const input = () => ({ name: 'API Company', managerName: 'API Manager', managerEmail: 'api@example.test', idempotencyKey: crypto.randomUUID() })

test('platform API enforces scope, current grant, context marker and same origin before registration reads/writes', async t => {
  const f = await createTenancyFixture(t), work = [], options = { now: f.now, waitUntil: p => work.push(p), deliver: async () => ({ status: 'accepted' }) }
  assert.equal((await handlePlatformBusinessesApi(request(f.contexts.aliceA), env(f), f.contexts.aliceA, options)).status, 403)
  const stale = request(f.contexts.admin); stale.headers.set('X-Mesiva-Context', 'old-context')
  assert.equal((await handlePlatformBusinessesApi(stale, env(f), f.contexts.admin, options)).status, 409)
  assert.equal((await handlePlatformBusinessesApi(request(f.contexts.admin, undefined, 'POST', input(), 'https://foreign.test'), env(f), f.contexts.admin, options)).status, 403)
  const result = await handlePlatformBusinessesApi(request(f.contexts.admin, undefined, 'POST', input()), env(f), f.contexts.admin, options)
  assert.equal(result.status, 201)
  assert.equal(result.headers.get('cache-control'), 'no-store')
  const created = await result.json()
  assert.equal('token' in created, false)
  await Promise.all(work)
  const detail = await handlePlatformBusinessesApi(request(f.contexts.admin, `/api/platform/businesses/${created.businessId}`), env(f), f.contexts.admin, options)
  assert.equal(detail.status, 200)
  assert.equal((await detail.json()).invitation.deliveryStatus, 'accepted')
  const resendPath = `/api/platform/businesses/${created.businessId}/first-manager-invitation/resend`
  assert.equal((await handlePlatformBusinessesApi(request(f.contexts.admin, `/api/platform/businesses/${f.businesses.A}/first-manager-invitation/resend`, 'POST'), env(f), f.contexts.admin, options)).status, 409)
  const resendOptions = { ...options, now: new Date(f.now.getTime() + 61_000) }
  const attempts = await Promise.all([1, 2].map(() => handlePlatformBusinessesApi(request(f.contexts.admin, resendPath, 'POST'), env(f), f.contexts.admin, resendOptions)))
  assert.equal(attempts.filter(r => r.ok).length, 1)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM company_invitations WHERE business_id = ? AND revoked_at IS NULL').get(created.businessId).n, 1)
  f.sqlite.prepare("UPDATE businesses SET access_status = 'active' WHERE id = ?").run(created.businessId)
  assert.equal((await handlePlatformBusinessesApi(request(f.contexts.admin, resendPath, 'POST'), env(f), f.contexts.admin, { ...options, now: new Date(f.now.getTime() + 122_000) })).status, 409)
  f.sqlite.prepare("DELETE FROM platform_grants WHERE account_id = ? AND capability = 'platform.businesses.view'").run(f.accounts.admin)
  assert.equal((await handlePlatformBusinessesApi(request(f.contexts.admin), env(f), f.contexts.admin, options)).status, 409)
})

test('resend preparation cannot commit after the administrative session expires', async t => {
  const f = await createTenancyFixture(t), work = [], options = { now: f.now, waitUntil: p => work.push(p), deliver: async () => ({ status: 'accepted' }) }
  const response = await handlePlatformBusinessesApi(request(f.contexts.admin, undefined, 'POST', input()), env(f), f.contexts.admin, options)
  const created = await response.json(); await Promise.all(work)
  const readings = [0, 13 * 3600_000]
  const resend = await handlePlatformBusinessesApi(request(f.contexts.admin, `/api/platform/businesses/${created.businessId}/first-manager-invitation/resend`, 'POST'), env(f), f.contexts.admin, { ...options, now: new Date(f.now.getTime() + 61_000), monotonicNow: () => readings.shift() })
  assert.equal(resend.status, 409)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM company_invitations WHERE business_id = ?').get(created.businessId).n, 1)
})

test('administrative resend cannot target a team invitation or cross a revoked grant during commit', async t => {
  const f = await createTenancyFixture(t), work = [], options = { now: f.now, waitUntil: p => work.push(p), deliver: async () => ({ status: 'accepted' }) }
  const result = await handlePlatformBusinessesApi(request(f.contexts.admin, undefined, 'POST', input()), env(f), f.contexts.admin, options)
  const created = await result.json(); await Promise.all(work)
  const original = f.db.batch.bind(f.db)
  f.db.batch = async statements => {
    f.sqlite.prepare("DELETE FROM platform_grants WHERE account_id = ? AND capability = 'platform.invitations.resend'").run(f.accounts.admin)
    return original(statements)
  }
  const response = await handlePlatformBusinessesApi(request(f.contexts.admin, `/api/platform/businesses/${created.businessId}/first-manager-invitation/resend`, 'POST'), env(f), f.contexts.admin, { ...options, now: new Date(f.now.getTime() + 61_000) })
  assert.equal(response.status, 409)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM company_invitations WHERE business_id = ?').get(created.businessId).n, 1)
})
