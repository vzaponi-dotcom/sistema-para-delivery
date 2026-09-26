import test from 'node:test'
import assert from 'node:assert/strict'
import { mountReportingHook } from '../../../test-support/reportingHookHarness.js'

test('reporting data ignores a stale response after the query changes and aborts its request', async (t) => {
  const { useReportingData } = await import('./useReportingData.js')
  const pending = []
  const api = { load: (view, query, { signal }) => new Promise((resolve) => pending.push({ view, query, signal, resolve })) }
  const firstQuery = { view: 'overview', from: '2026-09-01', to: '2026-09-01' }
  const secondQuery = { view: 'sales', from: '2026-09-02', to: '2026-09-02' }
  const hook = await mountReportingHook(t, useReportingData, { query: firstQuery, api })
  await hook.rerender({ query: secondQuery, api })
  assert.equal(pending[0].signal.aborted, true)
  pending[1].resolve({ data: { marker: 'new' } })
  await hook.rerender({ query: secondQuery, api })
  pending[0].resolve({ data: { marker: 'old' } })
  await hook.rerender({ query: secondQuery, api })
  assert.equal(hook.current().data.marker, 'new')
})

test('reporting data retains quality, warnings and metadata from the API envelope', async (t) => {
  const { useReportingData } = await import('./useReportingData.js')
  const api = { load: async () => ({
    data: { metrics: { ordersCount: 0 } }, comparison: { available: false },
    quality: { eligibleCount: 1 }, warnings: ['Cobertura limitada'],
    generatedAt: '2026-09-25T12:00:00.000Z', timezone: 'America/Sao_Paulo',
    normalizedQuery: { view: 'overview' },
  }) }
  const hook = await mountReportingHook(t, useReportingData, { query: { view: 'overview' }, api })
  await hook.rerender({ query: { view: 'overview' }, api })
  assert.deepEqual(hook.current().quality, { eligibleCount: 1 })
  assert.deepEqual(hook.current().warnings, ['Cobertura limitada'])
  assert.equal(hook.current().timezone, 'America/Sao_Paulo')
})

test('reporting data never exposes the previous view payload while the next view is loading', async (t) => {
  const { useReportingData } = await import('./useReportingData.js')
  const pending = []
  const api = { load: (view, query, { signal }) => new Promise((resolve) => pending.push({ view, query, signal, resolve })) }
  const overviewQuery = { view: 'overview', from: '2026-09-01', to: '2026-09-25' }
  const salesQuery = { view: 'sales', from: '2026-09-01', to: '2026-09-25' }
  const hook = await mountReportingHook(t, useReportingData, { query: overviewQuery, api })

  pending[0].resolve({ data: { metrics: { salesCents: 1000 } } })
  await hook.rerender({ query: overviewQuery, api })
  assert.equal(hook.current().data.metrics.salesCents, 1000)

  await hook.rerender({ query: salesQuery, api })
  assert.equal(hook.current().loading, true)
  assert.equal(hook.current().data, null)

  pending[1].resolve({ data: { paymentMix: [], salesSeries: [], ordersSeries: [], receivedSeries: [], refundSeries: [] } })
  await hook.rerender({ query: salesQuery, api })
  assert.deepEqual(hook.current().data.paymentMix, [])
})
