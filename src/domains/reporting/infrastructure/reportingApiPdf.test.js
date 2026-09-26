import test from 'node:test'
import assert from 'node:assert/strict'

test('frontend export API explicitly marks PDF requests so the server can enrich the executive model', async () => {
  const { createReportingApi } = await import('./reportingApi.js')
  const calls = []
  const signal = new AbortController().signal
  const api = createReportingApi({ request: async (path, options) => { calls.push([path, options]); return { data: {} } } })
  await api.exportModel({ view: 'overview', from: '2026-09-01', to: '2026-09-25' }, null, { format: 'pdf', signal })
  assert.equal(calls[0][0], '/api/reporting/export-model')
  assert.strictEqual(calls[0][1].signal, signal)
  assert.equal(JSON.parse(calls[0][1].body).format, 'pdf')
})