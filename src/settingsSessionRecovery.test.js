import assert from 'node:assert/strict'
import test from 'node:test'
import { getSession, login, logout } from './api/client.js'
import { createBusinessSettingsController } from './app/useBusinessSettingsController.js'
import { adminFixture, draftFixture } from './test-support/settingsFixtures.js'

const json = (payload) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'content-type': 'application/json' },
})
const memoryStorage = () => {
  const values = new Map()
  return {
    get length() { return values.size }, key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key),
  }
}

test('login context recovers an uncertain save after reload only by receipt and resource GETs', async () => {
  const originalFetch = globalThis.fetch
  const storage = memoryStorage()
  const requests = []
  let authenticated = false
  let settingsContextId = 'session-context-1'
  let committed = false
  let puts = 0
  const saved = { ...adminFixture, revision: 2, data: draftFixture }
  globalThis.fetch = async (path, options = {}) => {
    const url = String(path)
    const method = options.method || 'GET'
    requests.push([url, method])
    if (url === '/api/auth/login' && method === 'POST') { authenticated = true; return json({ authenticated: true, businessId: 'business-1' }) }
    if (url === '/api/auth/session') return json(authenticated ? {
      authenticated: true, businessId: 'business-1', settingsContextId,
      capabilities: ['operations.settings.view', 'operations.settings.manage'],
    } : { authenticated: false })
    if (url === '/api/auth/logout' && method === 'POST') { authenticated = false; return json({ authenticated: false }) }
    if (url === '/api/settings/operations' && method === 'GET') return json(committed ? saved : adminFixture)
    if (url === '/api/settings/operations' && method === 'PUT') { puts += 1; committed = true; throw new TypeError('response lost') }
    if (url.startsWith('/api/settings/receipts/mutation-1?') && method === 'GET') {
      return json({ status: 'confirmed', receipt: { mutationId: 'mutation-1', committedRevision: 2 } })
    }
    throw new Error(`Unexpected request: ${url} ${method}`)
  }
  try {
    const session = await login('4827')
    assert.equal(session.settingsContextId, 'session-context-1')
    const first = createBusinessSettingsController({ context: { ...session, generation: 1 }, storage, createMutationId: () => 'mutation-1' })
    await first.load('operations')
    first.edit('operations', draftFixture)
    assert.equal(await first.save('operations'), false)
    assert.equal(puts, 1)

    const restoredSession = await getSession()
    const restored = createBusinessSettingsController({ context: { ...restoredSession, generation: 1 }, storage })
    await restored.load('operations')
    assert.equal(restored.getResources().operations.status, 'unconfirmed')
    assert.equal(await restored.reconcile('operations'), true)
    assert.equal(puts, 1)

    restored.reset()
    await logout()
    settingsContextId = 'session-context-2'
    const newSession = await login('4827')
    const next = createBusinessSettingsController({ context: { ...newSession, generation: 2 }, storage })
    await next.load('operations')
    assert.equal(next.getResources().operations.status, 'ready')
    assert.equal(storage.length, 0)
    assert.equal(puts, 1)
    assert.ok(requests.some(([url, method]) => url.startsWith('/api/settings/receipts/') && method === 'GET'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
