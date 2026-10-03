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
  coordinatorFactory,
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
      coordinatorFactory,
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

test('runtime holds credential transition through response and trusted verification and blocks local auth actions', async t => {
  let settlePost, settleVerification, sessionReads = 0, logins = 0, logouts = 0, broadcasts = 0
  const userSession = { ...authenticatedSession, user: { id: 'u' }, authMode: 'user_only' }
  const h = await mountHarness(t, { api: anonymousApi({ getSession: async () => ++sessionReads === 1 ? userSession : new Promise(resolve => { settleVerification = resolve }), login: async () => { logins++; return userSession }, logout: async () => { logouts++ } }), coordinatorFactory: () => ({ publish() { broadcasts++ }, close() {} }) })
  assert.equal(typeof h.getCurrent().runCredentialChange, 'function')
  let operation
  await act(async () => { operation = h.getCurrent().runCredentialChange(() => { assert.equal(h.getCurrent().isCredentialChangePending(), true); return new Promise(resolve => { settlePost = resolve }) }) })
  await act(async () => { assert.equal(await h.getCurrent().handleLogout(), false); assert.equal(await h.getCurrent().handleLogin({}), false) })
  assert.equal(logins, 0); assert.equal(logouts, 0)
  await act(async () => settlePost({ changed: true }))
  assert.equal(h.getCurrent().isCredentialChangePending(), true); assert.equal(broadcasts, 1)
  await act(async () => { settleVerification(userSession); await operation })
  assert.equal(h.getCurrent().isCredentialChangePending(), false)
})

test('late confirmed cookie change after other-tab invalidation broadcasts and verifies the currently installed cookie', async t => {
  let invalidate, settlePost, sessionReads = 0, broadcasts = 0
  const first = { ...authenticatedSession, user: { id: 'first' }, authMode: 'user_only' }
  const second = { ...first, user: { id: 'other-tab' } }
  let cookieSession = first
  const h = await mountHarness(t, { api: anonymousApi({ getSession: async () => { sessionReads++; return cookieSession } }), coordinatorFactory: ({ onInvalidate }) => { invalidate = onInvalidate; return { publish() { broadcasts++ }, close() {} } } })
  assert.equal(typeof h.getCurrent().runCredentialChange, 'function')
  let operation
  await act(async () => { operation = h.getCurrent().runCredentialChange(() => new Promise(resolve => { settlePost = resolve })) })
  cookieSession = second
  await act(async () => { invalidate(); await flush() })
  assert.equal(h.getCurrent().sessionContext.user.id, 'other-tab')
  cookieSession = first
  await act(async () => { settlePost({ changed: true }); await operation })
  assert.equal(h.getCurrent().sessionContext.user.id, 'first'); assert.equal(broadcasts, 1); assert.equal(sessionReads, 3)
  assert.equal(h.getCurrent().isCredentialChangePending(), false)
})
test('uncertain password response masks identity and holds exit guard until trusted cookie rediscovery', async t => {
  let rejectPost, verify, reads = 0, broadcasts = 0
  const session = { ...authenticatedSession, user: { id: 'u' }, authMode: 'user_only' }
  const h = await mountHarness(t, { api: anonymousApi({ getSession: async () => ++reads === 1 ? session : new Promise(resolve => { verify = resolve }) }), coordinatorFactory: () => ({ publish() { broadcasts++ }, close() {} }) })
  let operation
  await act(async () => { operation = h.getCurrent().runCredentialChange(() => new Promise((_resolve, reject) => { rejectPost = reject })).catch(error => error) })
  await act(async () => rejectPost(new Error('body stream interrupted after headers')))
  assert.equal(h.getCurrent().authState, 'checking')
  assert.equal(h.getCurrent().sessionContext, null)
  assert.equal(h.getCurrent().isCredentialChangePending(), true)
  assert.equal(broadcasts, 1)
  await act(async () => { verify(session); await operation })
  assert.equal(h.getCurrent().isCredentialChangePending(), false)
  assert.equal(reads, 2)
})
test('malformed password confirmation and failed rediscovery leave anonymous safe context without replay', async t => {
  let reads = 0, writes = 0
  const session = { ...authenticatedSession, user: { id: 'u' }, authMode: 'user_only' }
  const h = await mountHarness(t, { api: anonymousApi({ getSession: async () => { if (++reads > 1) throw new Error('offline'); return session } }), coordinatorFactory: () => ({ publish() {}, close() {} }) })
  await act(async () => { await assert.rejects(h.getCurrent().runCredentialChange(async () => { writes++; return null }), /confirmar a alteração/) })
  assert.equal(writes, 1); assert.equal(reads, 2)
  assert.equal(h.getCurrent().authState, 'anonymous'); assert.equal(h.getCurrent().sessionContext, null)
  assert.equal(h.getCurrent().isCredentialChangePending(), false)
})
test('superseded password verification keeps guard until the current tab invalidation read settles', async t => {
  let invalidate, reads = 0, firstVerification, currentVerification
  const session = { ...authenticatedSession, user: { id: 'u' }, authMode: 'user_only' }
  const h = await mountHarness(t, { api: anonymousApi({ getSession: async () => {
    if (++reads === 1) return session
    return new Promise(resolve => { if (reads === 2) firstVerification = resolve; else currentVerification = resolve })
  } }), coordinatorFactory: ({ onInvalidate }) => { invalidate = onInvalidate; return { publish() {}, close() {} } } })
  let operation
  await act(async () => { operation = h.getCurrent().runCredentialChange(async () => ({ changed: true })) })
  await act(async () => invalidate())
  await act(async () => firstVerification(session))
  assert.equal(h.getCurrent().isCredentialChangePending(), true)
  await act(async () => { currentVerification(session); await operation })
  assert.equal(h.getCurrent().isCredentialChangePending(), false)
})

for (const authAction of ['handleLogin', 'handleLogout']) test(`refresh clears an old request lock and superseded ${authAction} cannot clear the next lock`, async (t) => {
  let current, key, setKey, finishLogin, oldLogin, renderer
  const pendingAuth = () => new Promise((resolve) => { finishLogin = resolve })
  const api = anonymousApi({ getSession: async () => authenticatedSession, login: pendingAuth, logout: pendingAuth })
  const coordinatorFactory = () => ({ publish() {}, close() {} })
  function Probe() {
    const [requestKey, setRequestKey] = React.useState(null)
    key = requestKey; setKey = setRequestKey
    current = useSessionRuntime({ api, requestKey, setRequestKey, coordinatorFactory })
    return null
  }
  await act(async () => { renderer = create(React.createElement(Probe)); await flush() })
  t.after(() => renderer.unmount())
  await act(async () => setKey('client:create'))
  await act(async () => { await current.refreshSession() })
  assert.equal(key, null)
  await act(async () => { oldLogin = current[authAction]('1234') })
  assert.equal(key, authAction === 'handleLogin' ? 'auth:login' : 'auth:logout')
  await act(async () => { await current.refreshSession() })
  assert.equal(key, null)
  await act(async () => setKey('client:new-owner'))
  await act(async () => { finishLogin(authenticatedSession); await oldLogin })
  assert.equal(key, 'client:new-owner')
  assert.equal(current.authState, 'authenticated')
})

test('human enrollment skips operational bootstrap and exposes trusted login mode', async (t) => {
  let calls = 0
  const harness = await mountHarness(t, {
    api: anonymousApi({ getSession: async () => ({ ...authenticatedSession, authMode: 'enrollment', user: { id: 'u' }, capabilities: ['access.users.manage'] }) }),
    refreshBootstrap: async () => { calls++ },
  })
  assert.equal(harness.getCurrent().authMode, 'enrollment')
  assert.equal(harness.getCurrent().operationalAccess, false)
  assert.equal(calls, 0)
})

test('another tab session change immediately invalidates current identity before the new trusted reply', async (t) => {
  let invalidate, finish, reads = 0, publications = 0
  const harness = await mountHarness(t, { coordinatorFactory: ({ onInvalidate }) => { invalidate = onInvalidate; return { publish: () => publications++, close() {} } }, api: anonymousApi({ getSession: async () => ++reads === 1 ? authenticatedSession : new Promise((resolve) => { finish = resolve }) }) })
  const generation = harness.getCurrent().sessionGeneration
  await act(async () => invalidate())
  assert.equal(harness.getCurrent().authState, 'checking')
  assert.equal(harness.getCurrent().sessionContext, null)
  assert.ok(harness.getCurrent().sessionGeneration > generation)
  await act(async () => { finish({ ...authenticatedSession, user: { id: 'next' } }); await flush() })
  assert.equal(harness.getCurrent().sessionContext.user.id, 'next')
  assert.equal(publications, 0)
})

test('refresh masks the previous session immediately and ignores a late reply after expiry', async (t) => {
  let resolveRefresh
  let reads = 0
  const harness = await mountHarness(t, { api: anonymousApi({ getSession: async () => {
    if (++reads === 1) return authenticatedSession
    return new Promise((resolve) => { resolveRefresh = resolve })
  } }) })
  let refresh
  await act(async () => { refresh = harness.getCurrent().refreshSession() })
  assert.equal(harness.getCurrent().authState, 'checking')
  assert.equal(harness.getCurrent().sessionContext, null)
  await act(async () => { harness.getCurrent().expireSession() })
  await act(async () => { resolveRefresh(authenticatedSession); await refresh })
  assert.equal(harness.getCurrent().authState, 'anonymous')
})

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

test('successful login clears stale sync state without broad application cleanup before bootstrap', async (t) => {
  const calls = []
  const harness = await mountHarness(t, {
    api: anonymousApi({ getSession: async () => calls.length ? authenticatedSession : { authenticated: false } }),
    resetOperationalData: () => { calls.push('reset-operational') },
    onClearApplicationState: (scope) => { calls.push(`clear-application:${scope ?? 'full'}`) },
    refreshBootstrap: async () => { calls.push('refresh-bootstrap') },
  })

  await act(async () => { await harness.getCurrent().handleLogin('1234') })

  assert.deepEqual(calls, ['reset-operational', 'clear-application:sync', 'refresh-bootstrap'])
  assert.equal(harness.getCurrent().authState, 'authenticated')
  assert.equal(harness.getCurrent().sessionGeneration, 2)
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
      getSession: async () => logoutCalls ? { authenticated: false } : authenticatedSession,
      logout: async () => { logoutCalls += 1 },
    }),
    resetOperationalData: () => { resetOperationalDataCalls += 1 },
    onClearApplicationState: () => { clearApplicationStateCalls += 1 },
  })

  await act(async () => { await harness.getCurrent().handleLogout() })

  const current = harness.getCurrent()
  assert.equal(logoutCalls, 1)
  assert.equal(resetOperationalDataCalls, 2)
  assert.equal(clearApplicationStateCalls, 2)
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

for (const action of ['handleLogin', 'handleLogout']) for (const settlement of ['confirmed', 'body-interrupted', 'headers-interrupted']) {
  test(`${action} ${settlement} after other-tab change rediscovers actual cookie and invalidates observers without replay`, async t => {
    const { createSessionApi } = await import('../../../infrastructure/auth/sessionApi.js')
    const previousFetch = globalThis.fetch
    t.after(() => { globalThis.fetch = previousFetch })
    const first = { ...authenticatedSession, user: { id: 'a' } }
    const second = { ...first, user: { id: 'b' } }
    let cookie = first, release, invalidate, broadcasts = 0, writes = 0, verify, holdRead = false
    const clearScopes = []
    globalThis.fetch = async (path, options) => {
      if (options.method === 'POST') {
        writes++
        return new Promise((resolve, reject) => { release = () => {
          cookie = action === 'handleLogin' ? first : { authenticated: false }
          if (settlement === 'headers-interrupted') return reject(new Error('connection interrupted'))
          resolve({ ok: true, json: async () => { if (settlement === 'body-interrupted') throw new Error('body interrupted'); return { ok: true } } })
        } })
      }
      const currentCookie = cookie
      if (holdRead) return new Promise(resolve => { verify = () => resolve({ ok: true, json: async () => currentCookie }) })
      return { ok: true, json: async () => currentCookie }
    }
    const h = await mountHarness(t, { api: createSessionApi(), onClearApplicationState: scope => clearScopes.push(scope), coordinatorFactory: ({ onInvalidate }) => {
      invalidate = onInvalidate
      return { publish() { broadcasts++ }, close() {} }
    } })
    let pending
    await act(async () => { pending = h.getCurrent()[action]('1234') })
    cookie = second
    await act(async () => { invalidate(); await flush() })
    assert.equal(h.getCurrent().sessionContext.user.id, 'b')
    holdRead = true
    await act(async () => { release(); await flush() })
    assert.equal(broadcasts, 1)
    assert.equal(clearScopes.at(-1), undefined)
    assert.equal(h.getCurrent().sessionContext, null)
    assert.equal(h.getCurrent().authState, 'checking')
    holdRead = false
    await act(async () => { verify(); await pending })
    assert.equal(h.getCurrent().sessionContext?.user?.id ?? null, action === 'handleLogin' ? 'a' : null)
    assert.equal(writes, 1)
  })
}

test('each auth request releases its own lock after an older cookie settlement supersedes its UI discovery', async t => {
  let current, key, renderer, finishFirst, finishSecond, pendingFirst, pendingSecond, calls = 0
  const api = anonymousApi({ getSession: async () => authenticatedSession, login: () => new Promise(resolve => { if (++calls === 1) finishFirst = resolve; else finishSecond = resolve }) })
  const coordinatorFactory = () => ({ publish() {}, close() {} })
  function Probe() {
    const [requestKey, setRequestKey] = React.useState(null)
    key = requestKey
    current = useSessionRuntime({ api, requestKey, setRequestKey, coordinatorFactory })
    return null
  }
  await act(async () => { renderer = create(React.createElement(Probe)); await flush() })
  t.after(() => renderer.unmount())
  await act(async () => { pendingFirst = current.handleLogin('first') })
  await act(async () => { await current.refreshSession() })
  await act(async () => { pendingSecond = current.handleLogin('second') })
  await act(async () => { finishFirst(authenticatedSession); await pendingFirst })
  assert.equal(key, 'auth:login')
  await act(async () => { finishSecond(authenticatedSession); await pendingSecond })
  assert.equal(key, null)
})
