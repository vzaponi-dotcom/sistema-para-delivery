import assert from 'node:assert/strict'
import test from 'node:test'

const apiPromise = import('./kitchenTvControlApi.js').catch(() => ({}))

test('reads control state and sends absolute page commands through same-origin JSON requests', async (t) => {
  const { getKitchenTvControl, setKitchenTvPage } = await apiPromise
  assert.equal(typeof getKitchenTvControl, 'function')
  assert.equal(typeof setKitchenTvPage, 'function')

  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const calls = []
  globalThis.fetch = async (path, options = {}) => {
    calls.push([path, options])
    return new Response(JSON.stringify({
      paired: true,
      control: { revision: 1, requestedPage: 2, updatedAt: '2026-09-28T21:00:00.000Z' },
      telemetry: null,
      hiddenOrderIds: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  await getKitchenTvControl()
  await setKitchenTvPage(3)

  assert.deepEqual(calls.map(([path, options]) => [
    path, options.method, options.credentials, options.body,
  ]), [
    ['/api/kitchen-tv/control', undefined, 'same-origin', undefined],
    ['/api/kitchen-tv/control/page', 'PATCH', 'same-origin', JSON.stringify({ page: 3 })],
  ])
})
