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
