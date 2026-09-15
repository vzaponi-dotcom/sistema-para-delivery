import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_OPERATIONS } from '../shared/businessPolicies.js'
import { resolveSettingsAccess } from './settingsAccess.js'
import { handleSettingsApi } from './settingsApi.js'
import { handlePrintingApi } from './orderPrintingApi.js'
import { createSettingsDb } from './test-support/settingsDb.js'

const BUSINESS = 'amor-e-sabor'
const request = (path, method = 'GET', body) => new Request(`https://delivery.test${path}`, {
  method,
  headers: { origin: 'https://delivery.test', 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

test('limited server grants separate settings view from manage and ignore unknown capabilities', async (t) => {
  const { db, close } = createSettingsDb()
  t.after(close)
  const context = await resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'limited' },
    new Set(['operations.settings.view', 'made.up.capability']))

  assert.deepEqual([...context.granted], ['operations.settings.view'])
  assert.equal((await handleSettingsApi(request('/api/settings/operations'), { DB: db }, context,
    new URL('https://delivery.test/api/settings/operations'))).status, 200)
  await assert.rejects(handleSettingsApi(request('/api/settings/operations', 'PUT', {
    expectedRevision: 1, mutationId: 'denied', data: DEFAULT_OPERATIONS,
  }), { DB: db }, context, new URL('https://delivery.test/api/settings/operations')), { status: 403, code: 'FORBIDDEN' })
})

test('legacy access is explicitly broad only for an authenticated server session', async () => {
  const context = await resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'legacy' })
  assert.equal(context.legacy, true)
  assert.equal(context.granted.has('payments.settings.manage'), true)
  await assert.rejects(resolveSettingsAccess(null), { status: 401 })
})

test('an installed trusted resolver returning undefined fails closed instead of enabling legacy grants', async () => {
  const context = await resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'missing-profile' }, undefined)
  assert.equal(context.legacy, false)
  assert.deepEqual([...context.granted], [])
})

test('settings mutations use context business and reject browser authority fields', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  const context = await resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'manager' })
  await assert.rejects(handleSettingsApi(request('/api/settings/operations', 'PUT', {
    businessId: 'other-business', role: 'manager', granted: ['operations.settings.manage'],
    expectedRevision: 1, mutationId: 'forged', data: DEFAULT_OPERATIONS,
  }), { DB: db }, context, new URL('https://delivery.test/api/settings/operations')), { status: 400 })
  assert.equal(sqlite.prepare('SELECT revision FROM business_operation_settings WHERE business_id = ?').get(BUSINESS).revision, 1)
})

test('receipt lookup is scoped to an authorized resource', async (t) => {
  const { db, close } = createSettingsDb()
  t.after(close)
  const manager = await resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'manager' })
  await handleSettingsApi(request('/api/settings/operations', 'PUT', {
    expectedRevision: 1, mutationId: 'receipt-1', data: DEFAULT_OPERATIONS,
  }), { DB: db }, manager, new URL('https://delivery.test/api/settings/operations'))

  const allowed = await handleSettingsApi(request('/api/settings/receipts/receipt-1?resource=operations'),
    { DB: db }, manager, new URL('https://delivery.test/api/settings/receipts/receipt-1?resource=operations'))
  assert.equal((await allowed.json()).status, 'confirmed')
  const limited = await resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'reader' }, new Set(['operations.settings.view']))
  await assert.rejects(handleSettingsApi(request('/api/settings/receipts/receipt-1?resource=operations'),
    { DB: db }, limited, new URL('https://delivery.test/api/settings/receipts/receipt-1?resource=operations')), { status: 403 })
})

test('printing administration uses resolved view and manage capabilities', async (t) => {
  const { db, close } = createSettingsDb()
  t.after(close)
  const reader = await resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'print-reader' }, new Set(['printing.settings.view']))
  const get = request('/api/printing/settings')
  assert.equal((await handlePrintingApi(get, { DB: db }, reader, new URL(get.url))).status, 200)
  const put = request('/api/printing/settings', 'PUT', {
    expectedRevision: 1, mutationId: 'print-denied', data: { orderDefaultCopies: 2, tableTabDefaultCopies: 1 },
  })
  await assert.rejects(handlePrintingApi(put, { DB: db }, reader, new URL(put.url)), { status: 403, code: 'FORBIDDEN' })

  const noAccess = await resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'station-denied' }, new Set())
  const register = request('/api/printing/stations/new-station', 'PUT', {
    name: 'Cozinha', platform: 'windows', autoPrintEnabled: false, defaultCopies: 1,
  })
  await assert.rejects(handlePrintingApi(register, { DB: db }, noAccess, new URL(register.url)), { status: 403, code: 'FORBIDDEN' })
})
