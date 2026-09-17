import assert from 'node:assert/strict'
import test from 'node:test'
import { getSession, login, logout } from './api/client.js'
import { createPolicyEditingController } from './app/policy-editing/policyEditingController.js'
import { createSettingsPolicyAdapters } from './app/surfaces/settings/policies/registry.js'
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

const settingsPolicyTransport = () => {
  const adapters = createSettingsPolicyAdapters()
  return {
    load: (policyId, scopeId) => adapters[policyId].load(scopeId),
    save: (policyId, input, scopeId) => adapters[policyId].save(input, scopeId),
    loadReceipt: (policyId, mutationId, scopeId) => adapters[policyId].loadReceipt(mutationId, scopeId),
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
    const first = createPolicyEditingController({
      transport: settingsPolicyTransport(),
      context: { ownerId: session.businessId, generation: 1, contextId: session.settingsContextId, capabilities: session.capabilities },
      storage,
      createMutationId: () => 'mutation-1',
    })
    await first.load('operations')
    first.edit('operations', draftFixture)
    assert.equal(await first.save('operations'), false)
    assert.equal(puts, 1)

    const restoredSession = await getSession()
    const restored = createPolicyEditingController({
      transport: settingsPolicyTransport(),
      context: { ownerId: restoredSession.businessId, generation: 1, contextId: restoredSession.settingsContextId, capabilities: restoredSession.capabilities },
      storage,
    })
    await restored.load('operations')
    assert.equal(restored.getResources().operations.status, 'unconfirmed')
    assert.equal(await restored.reconcile('operations'), true)
    assert.equal(puts, 1)

    restored.reset()
    await logout()
    settingsContextId = 'session-context-2'
    const newSession = await login('4827')
    const next = createPolicyEditingController({
      transport: settingsPolicyTransport(),
      context: { ownerId: newSession.businessId, generation: 2, contextId: newSession.settingsContextId, capabilities: newSession.capabilities },
      storage,
    })
    await next.load('operations')
    assert.equal(next.getResources().operations.status, 'ready')
    assert.equal(storage.length, 0)
    assert.equal(puts, 1)
    assert.ok(requests.some(([url, method]) => url.startsWith('/api/settings/receipts/') && method === 'GET'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
