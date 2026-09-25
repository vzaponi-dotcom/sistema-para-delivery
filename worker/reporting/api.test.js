import test from 'node:test'
import assert from 'node:assert/strict'
import { handleRequest } from '../index.js'

const request = (path, options = {}) => new Request(`https://delivery.test${path}`, {
  ...options, headers: { origin: 'https://delivery.test', ...(options.headers || {}) },
})
const context = (capabilities, businessId = 'business-a') => ({ businessId, granted: new Set(capabilities) })

test('reporting routes remain behind the global authenticated boundary', async () => {
  const response = await handleRequest(new Request('https://delivery.test/api/reporting/overview'), { DB: {} })
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED')
})

test('reporting API authorizes read and export separately and ignores browser business authority', async () => {
  const { handleReportingApi } = await import('./api.js')
  const calls = []
  const env = { DB: {}, reportingService: { empty: async (businessId, query) => { calls.push([businessId, query]); return { data: {}, quality: {} } } } }
  const allowed = await handleReportingApi(request('/api/reporting/overview?businessId=business-b'), env, context(['reports.view']), new URL('https://delivery.test/api/reporting/overview?businessId=business-b'))
  assert.equal(allowed.status, 200)
  const readable = await handleReportingApi(request('/api/reporting/overview'), env, context(['reports.view']), new URL('https://delivery.test/api/reporting/overview'))
  assert.equal(readable.status, 200)
  assert.equal(calls[0][0], 'business-a')
  await assert.rejects(handleReportingApi(request('/api/reporting/sales'), env, context([])), { status: 403 })
  await assert.rejects(handleReportingApi(request('/api/reporting/export-model', { method: 'POST', body: '{}' }), env, context(['reports.view'])), { status: 403 })
  const exported = await handleReportingApi(request('/api/reporting/export-model', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ view: 'sales', businessId: 'business-b' }) }), env, context(['reports.export']), new URL('https://delivery.test/api/reporting/export-model'))
  assert.equal(exported.status, 200)
  assert.equal(calls.at(-1)[0], 'business-a')
})
