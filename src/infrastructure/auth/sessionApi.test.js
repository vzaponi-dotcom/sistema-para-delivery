import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionApi } from './sessionApi.js'

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
