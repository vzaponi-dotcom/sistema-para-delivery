import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { useSessionRuntime } from './useSessionRuntime.js'

const flush = () => new Promise((resolve) => setImmediate(resolve))

function createHarness({
  api,
  isOnline = true,
  requestKey = null,
  setRequestKey = () => {},
  resetOperationalData = () => {},
  refreshBootstrap = async () => {},
  onClearApplicationState = () => {},
} = {}) {
  let current
  const Harness = () => {
    current = useSessionRuntime({
      api,
      isOnline,
      requestKey,
      setRequestKey,
      resetOperationalData,
      refreshBootstrap,
      onClearApplicationState,
    })
    return null
  }
  return { Harness, getCurrent: () => current }
}

async function mountHarness(t, options) {
  const harness = createHarness(options)
  let renderer
  await act(async () => {
    renderer = create(React.createElement(harness.Harness))
    await flush()
  })
  t.after(() => renderer.unmount())
  return harness
}

const anonymousApi = (overrides = {}) => ({
  getSession: async () => ({ authenticated: false }),
  login: async () => ({
    authenticated: true,
    businessId: 'amor-e-sabor',
    settingsContextId: 'ctx-1',
    capabilities: ['orders.view'],
  }),
  logout: async () => ({}),
  ...overrides,
})

const authenticatedSession = {
  authenticated: true,
  businessId: 'amor-e-sabor',
  settingsContextId: 'ctx-1',
  capabilities: ['orders.view'],
}

test('anonymous initial session skips bootstrap', async (t) => {
  let refreshBootstrapCalls = 0
  const harness = await mountHarness(t, {
    api: anonymousApi(),
    refreshBootstrap: async () => { refreshBootstrapCalls += 1 },
  })

  assert.equal(harness.getCurrent().authState, 'anonymous')
  assert.equal(harness.getCurrent().sessionContext, null)
  assert.equal(refreshBootstrapCalls, 0)
})

test('authenticated initial session establishes context and generation before bootstrap', async (t) => {
  let refreshBootstrapCalls = 0
  const harness = await mountHarness(t, {
    api: anonymousApi({ getSession: async () => authenticatedSession }),
    refreshBootstrap: async () => { refreshBootstrapCalls += 1 },
  })

  const current = harness.getCurrent()
  assert.equal(current.authState, 'authenticated')
  assert.equal(current.sessionContext.businessId, 'amor-e-sabor')
  assert.equal(current.sessionGeneration, 1)
  assert.equal(refreshBootstrapCalls, 1)
})

test('invalid PIN preserves the exact login error copy', async (t) => {
  const harness = await mountHarness(t, {
    api: anonymousApi({ login: async () => { throw { code: 'INVALID_PIN' } } }),
  })

  await act(async () => { await harness.getCurrent().handleLogin('0000') })

  assert.equal(harness.getCurrent().authState, 'anonymous')
  assert.equal(harness.getCurrent().loginError, 'PIN inválido. Confira e tente novamente.')
})

test('login surfaces the API error message for non-PIN failures', async (t) => {
  const harness = await mountHarness(t, {
    api: anonymousApi({ login: async () => { throw new Error('Falha de rede') } }),
  })

  await act(async () => { await harness.getCurrent().handleLogin('1234') })

  assert.equal(harness.getCurrent().loginError, 'Falha de rede')
})

test('logout clears operational and application state before returning anonymous', async (t) => {
  let logoutCalls = 0
  let resetOperationalDataCalls = 0
  let clearApplicationStateCalls = 0
  const harness = await mountHarness(t, {
    api: anonymousApi({
      getSession: async () => authenticatedSession,
      logout: async () => { logoutCalls += 1 },
    }),
    resetOperationalData: () => { resetOperationalDataCalls += 1 },
    onClearApplicationState: () => { clearApplicationStateCalls += 1 },
  })

  await act(async () => { await harness.getCurrent().handleLogout() })

  const current = harness.getCurrent()
  assert.equal(logoutCalls, 1)
  assert.equal(resetOperationalDataCalls, 1)
  assert.equal(clearApplicationStateCalls, 1)
  assert.equal(current.authState, 'anonymous')
  assert.equal(current.sessionContext, null)
  assert.equal(current.loginError, '')
})

test('expireSession clears state and preserves the exact expiry copy', async (t) => {
  let resetOperationalDataCalls = 0
  let clearApplicationStateCalls = 0
  const harness = await mountHarness(t, {
    api: anonymousApi({ getSession: async () => authenticatedSession }),
    resetOperationalData: () => { resetOperationalDataCalls += 1 },
    onClearApplicationState: () => { clearApplicationStateCalls += 1 },
  })

  await act(async () => { harness.getCurrent().expireSession() })

  const current = harness.getCurrent()
  assert.equal(resetOperationalDataCalls, 1)
  assert.equal(clearApplicationStateCalls, 1)
  assert.equal(current.authState, 'anonymous')
  assert.equal(current.sessionContext, null)
  assert.equal(current.loginError, 'Sua sessão expirou. Entre novamente.')
})

test('offline login is blocked without calling the API', async (t) => {
  let loginCalls = 0
  const harness = await mountHarness(t, {
    api: anonymousApi({ login: async () => { loginCalls += 1; return authenticatedSession } }),
    isOnline: false,
  })

  await act(async () => { await harness.getCurrent().handleLogin('1234') })

  assert.equal(loginCalls, 0)
  assert.equal(harness.getCurrent().authState, 'anonymous')
})

test('logout is blocked while another request owns requestKey', async (t) => {
  let logoutCalls = 0
  const harness = await mountHarness(t, {
    api: anonymousApi({
      getSession: async () => authenticatedSession,
      logout: async () => { logoutCalls += 1 },
    }),
    requestKey: 'order:create',
  })

  await act(async () => { await harness.getCurrent().handleLogout() })

  assert.equal(logoutCalls, 0)
  assert.equal(harness.getCurrent().authState, 'authenticated')
})
