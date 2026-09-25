import test from 'node:test'
import assert from 'node:assert/strict'

test('reporting API encodes the normalized query and forwards AbortSignal', async () => {
  const { createReportingApi } = await import('./reportingApi.js')
  const calls = []
  const signal = new AbortController().signal
  const api = createReportingApi({ request: async (path, options) => { calls.push([path, options]); return { data: {} } } })
  await api.load('overview', { from: '2026-09-01', to: '2026-09-25', search: 'Ana & Bia' }, { signal })
  assert.equal(calls[0][0], '/api/reporting/overview?from=2026-09-01&to=2026-09-25&search=Ana+%26+Bia')
  assert.strictEqual(calls[0][1].signal, signal)
})
