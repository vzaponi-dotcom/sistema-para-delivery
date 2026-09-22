import assert from 'node:assert/strict'
import test from 'node:test'
const apiPromise = import('./kitchenTvSettingsApi.js').catch(() => ({}))

test('uses same-origin JSON requests for settings, code approval and revocation', async (t) => {
  const { approveKitchenTvPairing, getKitchenTvSettings, revokeKitchenTvAccess } = await apiPromise
  assert.equal(typeof approveKitchenTvPairing, 'function')
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const calls = []
  globalThis.fetch = async (path, options = {}) => {
    calls.push([path, options])
    return new Response(JSON.stringify({ configured: path.endsWith('/approve'), waitingPairing: path.endsWith('/approve'), paired: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  await getKitchenTvSettings()
  await approveKitchenTvPairing('482731')
  await revokeKitchenTvAccess()
  assert.deepEqual(calls.map(([path, options]) => [path, options.method, options.credentials, options.body]), [
    ['/api/kitchen-tv/settings', undefined, 'same-origin', undefined],
    ['/api/kitchen-tv/approve', 'POST', 'same-origin', JSON.stringify({ code: '482731' })],
    ['/api/kitchen-tv/revoke', 'POST', 'same-origin', undefined],
  ])
})
