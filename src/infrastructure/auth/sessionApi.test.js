import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionApi } from './sessionApi.js'

test('individual login defaults to shared mode and sends personal only by explicit choice', async () => {
  const bodies = []
  const api = createSessionApi({ request: async (path, options) => {
    if (path.endsWith('/login')) { bodies.push(JSON.parse(options.body)); return {} }
    return { authenticated: true, businessId: 'b', settingsContextId: 's', capabilities: [], user: { id: 'u' } }
  } })
  await api.login({ email: 'ana@example.test', password: 'long password' })
  await api.login({ email: 'ana@example.test', password: 'long password', deviceMode: 'personal' })
  assert.deepEqual(bodies, [
    { email: 'ana@example.test', password: 'long password', deviceMode: 'shared' },
    { email: 'ana@example.test', password: 'long password', deviceMode: 'personal' },
  ])
})

test('login posts the PIN then confirms the authenticated context', async () => {
  const calls = []
  const api = createSessionApi({
    request: async (path, options = {}) => {
      calls.push({ path, options })
      if (path === '/api/auth/login') return { ok: true }
      return {
        authenticated: true,
        businessId: 'amor-e-sabor',
        settingsContextId: 'ctx-1',
        capabilities: ['orders.view'],
      }
    },
    json: (method, payload) => ({ method, body: JSON.stringify(payload) }),
  })

  const session = await api.login('1234')
  assert.equal(session.businessId, 'amor-e-sabor')
  assert.deepEqual(calls.map(({ path }) => path), ['/api/auth/login', '/api/auth/session'])
})

test('login rejects an incomplete authenticated context', async () => {
  const api = createSessionApi({
    request: async (path) => path === '/api/auth/login' ? {} : { authenticated: true },
    json: (method, payload) => ({ method, body: JSON.stringify(payload) }),
  })

  await assert.rejects(
    () => api.login('1234'),
    (error) => error.code === 'SESSION_CONTEXT_UNAVAILABLE',
  )
})

test('session API preserves GET session and POST logout routes', async () => {
  const calls = []
  const api = createSessionApi({
    request: async (path, options = {}) => {
      calls.push([path, options.method || 'GET'])
      return path === '/api/auth/session' ? { authenticated: false } : { ok: true }
    },
  })

  await api.getSession()
  await api.logout()

  assert.deepEqual(calls, [
    ['/api/auth/session', 'GET'],
    ['/api/auth/logout', 'POST'],
  ])
})

test('trusted discovery rejects an incomplete context when the runtime owns login discovery', async () => {
  const api = createSessionApi({ request: async path => path.endsWith('/login') ? {} : { authenticated: true } })
  await api.login('1234', { discover: false })
  await assert.rejects(api.getSession({ requireContext: true }), { code: 'SESSION_CONTEXT_UNAVAILABLE' })
})
test('explicit platform login preserves destination without affecting ordinary login', async () => {
  const bodies = []
  const api = createSessionApi({ request: async (_, options) => { bodies.push(JSON.parse(options.body)); return {} } })
  await api.login({ email: 'admin@example.test', password: 'password', destination: 'platform' }, { discover: false })
  assert.equal(bodies[0].destination, 'platform')
})
