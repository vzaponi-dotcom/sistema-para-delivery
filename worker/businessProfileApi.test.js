import test from 'node:test'
import assert from 'node:assert/strict'
import { APPLICATION_CAPABILITIES, SETTINGS_MANAGE_TO_VIEW } from '../shared/settingsAccess.js'
import { resolveSettingsAccess } from './settingsAccess.js'
import { handleBusinessProfileApi } from './businessProfileApi.js'
import { handleSettingsApi } from './settingsApi.js'
import { saveBusinessProfile } from './businessProfileRepository.js'
import { createSettingsDb } from './test-support/settingsDb.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-24T03:50:00.000Z')
const request = (path) => new Request(`https://delivery.test${path}`, {
  headers: { origin: 'https://delivery.test' },
})

test('business profile capabilities are canonical and manage implies view for both limited and broad sessions', async () => {
  assert.equal(APPLICATION_CAPABILITIES.includes('business.profile.view'), true)
  assert.equal(APPLICATION_CAPABILITIES.includes('business.profile.manage'), true)
  assert.equal(SETTINGS_MANAGE_TO_VIEW['business.profile.manage'], 'business.profile.view')

  const limited = await resolveSettingsAccess(
    { businessId: BUSINESS, sessionId: 'profile-manager' },
    new Set(['business.profile.manage']),
  )
  assert.equal(limited.granted.has('business.profile.manage'), true)
  assert.equal(limited.granted.has('business.profile.view'), true)

  const broad = await resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'legacy-admin' })
  assert.equal(broad.legacy, true)
  assert.equal(broad.granted.has('business.profile.manage'), true)
  assert.equal(broad.granted.has('business.profile.view'), true)
})

test('business profile GET requires view capability, uses context business and never leaks storage metadata', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)

  sqlite.prepare("INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES ('other', 'other', 'Outro Negócio', ?, ?)")
    .run(NOW.toISOString(), NOW.toISOString())
  sqlite.prepare(`INSERT INTO business_profiles (
    business_id, revision, phone, address_line, address_number, address_complement,
    neighborhood, city, state, postal_code, logo_object_key, logo_content_type,
    logo_sha256, logo_size_bytes, logo_updated_at, created_at, updated_at
  ) VALUES ('other', 1, '', '', '', '', '', '', '', '', ?, 'image/webp', ?, 12, ?, ?, ?)`)
    .run('businesses/other/logo/secret.webp', 'b'.repeat(64), NOW.toISOString(), NOW.toISOString(), NOW.toISOString())

  const reader = await resolveSettingsAccess(
    { businessId: BUSINESS, sessionId: 'profile-reader' },
    new Set(['business.profile.view']),
  )
  const url = new URL('https://delivery.test/api/settings/business-profile?businessId=other')
  const response = await handleBusinessProfileApi(request('/api/settings/business-profile?businessId=other'), { DB: db }, reader, url)
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.data.name, 'Amor & Sabor')
  assert.deepEqual(payload.data.logo, { present: false, version: null })
  assert.equal(JSON.stringify(payload).includes('secret.webp'), false)
  assert.equal(JSON.stringify(payload).includes('bbbbbbbb'), false)

  const denied = await resolveSettingsAccess(
    { businessId: BUSINESS, sessionId: 'profile-denied' },
    new Set(),
  )
  await assert.rejects(
    handleBusinessProfileApi(request('/api/settings/business-profile'), { DB: db }, denied,
      new URL('https://delivery.test/api/settings/business-profile')),
    { status: 403, code: 'FORBIDDEN' },
  )
})

test('business profile receipt lookup requires manage while invalid receipt resources remain rejected', async (t) => {
  const { db, close } = createSettingsDb()
  t.after(close)
  const receiptNow = new Date()

  await saveBusinessProfile(db, BUSINESS, {
    expectedRevision: 1,
    mutationId: 'profile-receipt',
    data: {
      name: 'Amor & Sabor Centro',
      phone: '',
      address: { line: '', number: '', complement: '', neighborhood: '', city: '', state: '', postalCode: '' },
    },
  }, undefined, receiptNow)

  const reader = await resolveSettingsAccess(
    { businessId: BUSINESS, sessionId: 'profile-reader' },
    new Set(['business.profile.view']),
  )
  const manager = await resolveSettingsAccess(
    { businessId: BUSINESS, sessionId: 'profile-manager' },
    new Set(['business.profile.manage']),
  )

  const receiptUrl = new URL('https://delivery.test/api/settings/receipts/profile-receipt?resource=businessProfile')
  await assert.rejects(
    handleSettingsApi(request(receiptUrl.pathname + receiptUrl.search), { DB: db }, reader, receiptUrl),
    { status: 403, code: 'FORBIDDEN' },
  )

  const allowed = await handleSettingsApi(request(receiptUrl.pathname + receiptUrl.search), { DB: db }, manager, receiptUrl)
  assert.equal(allowed.status, 200)
  const payload = await allowed.json()
  assert.equal(payload.status, 'confirmed')
  assert.equal(payload.receipt.mutationId, 'profile-receipt')
  assert.equal(payload.receipt.committedRevision, 2)

  const invalidUrl = new URL('https://delivery.test/api/settings/receipts/profile-receipt?resource=madeUp')
  await assert.rejects(
    handleSettingsApi(request(invalidUrl.pathname + invalidUrl.search), { DB: db }, manager, invalidUrl),
    { status: 400, code: 'SETTINGS_INVALID' },
  )
})
