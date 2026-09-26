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

test('reporting API loads every view from its approved collection endpoint', async () => {
  const { createReportingApi } = await import('./reportingApi.js')
  const paths = []
  const api = createReportingApi({ request: async (path) => { paths.push(path); return { data: {} } } })
  for (const view of ['overview', 'operation', 'sales', 'products', 'detail']) {
    await api.load(view, { from: '2026-09-01', to: '2026-09-25', page: 2 })
  }
  assert.deepEqual(paths, [
    '/api/reporting/overview?from=2026-09-01&to=2026-09-25&page=2',
    '/api/reporting/operation?from=2026-09-01&to=2026-09-25&page=2',
    '/api/reporting/sales?from=2026-09-01&to=2026-09-25&page=2',
    '/api/reporting/products?from=2026-09-01&to=2026-09-25&page=2',
    '/api/reporting/orders?from=2026-09-01&to=2026-09-25&page=2',
  ])
})
