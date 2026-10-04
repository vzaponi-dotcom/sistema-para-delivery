import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyProductionAuth } from './production-auth-smoke.mjs'

const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
})

test('production prepare smoke keeps legacy login and checks preparation endpoints', async () => {
  const calls = []
  const result = await verifyProductionAuth({
    baseUrl: 'https://production.example.test',
    phase: 'prepare',
    pin: '1234',
    log() {},
    fetchImpl: async (url, options = {}) => {
      calls.push([url, options])
      if (url.endsWith('/api/auth/session')) return response({ authenticated: false })
      if (url.endsWith('/api/auth/login')) return response({ authenticated: true })
      return response({ error: { code: 'INVALID_TOKEN' } }, 400)
    },
  })
  assert.equal(result.legacyLogin, true)
  assert.equal(result.prepareEndpoints, true)
  assert.equal(calls.length, 4)
})

test('production multi-company smoke requires anonymous multi-company mode and rejects PIN', async () => {
  const result = await verifyProductionAuth({
    baseUrl: 'https://production.example.test',
    phase: 'multi_company',
    pin: '1234',
    log() {},
    fetchImpl: async (url) => url.endsWith('/api/auth/session')
      ? response({ authenticated: false, authMode: 'multi_company' })
      : response({ error: { code: 'INVALID_LOGIN' } }, 401),
  })
  assert.equal(result.authMode, 'multi_company')
  assert.equal(result.pinRejected, true)
})

test('production multi-company smoke fails if legacy PIN is still accepted', async () => {
  await assert.rejects(verifyProductionAuth({
    baseUrl: 'https://production.example.test',
    phase: 'multi_company',
    pin: '1234',
    log() {},
    fetchImpl: async (url) => url.endsWith('/api/auth/session')
      ? response({ authenticated: false, authMode: 'multi_company' })
      : response({ authenticated: true }),
  }), /PIN login remained available/)
})

test('production smoke retries only within a bounded custom-domain propagation window', async () => {
  let sessionReads = 0
  const delays = []
  const result = await verifyProductionAuth({
    baseUrl: 'https://app.mesiva.com.br',
    phase: 'prepare',
    pin: '1234',
    attempts: 3,
    sleep: async ms => delays.push(ms),
    log() {},
    fetchImpl: async (url) => {
      if (url.endsWith('/api/auth/session')) {
        sessionReads += 1
        if (sessionReads < 3) return response({ error: { code: 'NOT_READY' } }, 503)
        return response({ authenticated: false, authMode: 'legacy' })
      }
      if (url.endsWith('/api/auth/login')) return response({ authenticated: true })
      return response({ error: { code: 'INVALID_TOKEN' } }, 400)
    },
  })
  assert.equal(result.legacyLogin, true)
  assert.equal(sessionReads, 3)
  assert.deepEqual(delays, [5000, 5000])
})

test('production smoke fails after the bounded propagation window', async () => {
  const delays = []
  await assert.rejects(verifyProductionAuth({
    baseUrl: 'https://app.mesiva.com.br',
    phase: 'prepare',
    pin: '1234',
    attempts: 2,
    sleep: async ms => delays.push(ms),
    log() {},
    fetchImpl: async () => response({ error: { code: 'NOT_READY' } }, 503),
  }), /bounded propagation window/)
  assert.deepEqual(delays, [5000])
})
