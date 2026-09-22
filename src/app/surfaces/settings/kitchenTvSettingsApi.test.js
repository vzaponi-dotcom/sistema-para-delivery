import assert from 'node:assert/strict'
import test from 'node:test'
const apiPromise = import('./kitchenTvSettingsApi.js').catch(() => ({}))

test('uses same-origin JSON requests for Kitchen TV settings lifecycle', async (t) => {
  const { generateKitchenTvAccess, getKitchenTvSettings, revokeKitchenTvAccess } = await apiPromise
  assert.equal(typeof getKitchenTvSettings, 'function')
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const calls = []
  globalThis.fetch = async (path, options = {}) => {
    calls.push([path, options])
    return new Response(JSON.stringify(path.endsWith('/settings')
      ? { configured: false, waitingPairing: false, paired: false }
      : { configured: true, waitingPairing: path.endsWith('/access'), paired: false }), {
      status: path.endsWith('/access') ? 201 : 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  await getKitchenTvSettings()
  await generateKitchenTvAccess()
  await revokeKitchenTvAccess()
  assert.deepEqual(calls.map(([path, options]) => [path, options.method, options.credentials]), [
    ['/api/kitchen-tv/settings', undefined, 'same-origin'],
    ['/api/kitchen-tv/access', 'POST', 'same-origin'],
    ['/api/kitchen-tv/revoke', 'POST', 'same-origin'],
  ])
})
