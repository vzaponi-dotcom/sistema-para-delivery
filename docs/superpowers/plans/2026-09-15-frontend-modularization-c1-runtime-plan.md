# Spec C C1 Runtime Centralization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract session, network status, feedback, bootstrap/official-data synchronization, and architecture enforcement from `App.jsx` while preserving all current UX/business behavior and deliberately leaving domain CRUD/payment/printing workflows for later Spec C slices.

**Architecture:** C1 creates small runtime hooks under `src/app/runtime`, extracts generic HTTP/auth adapters, and moves official collection synchronization behind `useOperationalDataRuntime`. Temporary bridges let App-owned table/payment workflows observe the same table snapshots and payment receipts without moving those workflows early. Architectural checks are introduced now with an explicit shrinking legacy allowlist.

**Tech Stack:** React 19.2, react-test-renderer 19.2, Vite 8.2, Node 22 `node:test`, oxlint, Cloudflare Worker/D1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`

**Rollout:** `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`

## Execution status — 2026-09-16

- Tasks 1–7 have been implemented on `feature/spec-c1-runtime`; **Task 8 is the only active task**.
- Task 5 RED contract: commit `ef3bd4921368c0dce0f648d1fe19d45fc5354809`, Validate #1163 / run `35050387434`.
- Task 5 isolated runtime GREEN: Validate #1166 / run `35051086481`.
- Task 5 final executable evidence before session extraction: `8212a8ee61c9f1eca2c3fe5fc74bc84c412d6166`, Validate #1175 / run `35054633792`, fully GREEN.
- Task 6 extracted session lifecycle into `src/app/runtime/session/useSessionRuntime.js` with dedicated tests preserving `checking | anonymous | authenticated`, exact invalid-PIN/expiry copy, login/logout ordering, reset and cleanup scope.
- Task 7 added `src/app/runtime/runtimeExtractionContract.test.js` and completed the C1 App runtime boundary (`9bb7b043`), followed by regression hardening through `f2633c8a`.
- Pre-reconciliation SHA `87644cba4e9b3255b92bdcff851cc7a84c17ce8e` passed Validate #1194 / run `35075714168` and manual Deploy staging #101 / run `35078821466` (`workflow_dispatch`).
- The accidental automatic staging trigger for `feature/spec-c1-runtime` was removed in `d8b105e55fa42da476c6b2e79f73ce584a815a5c`; manual dispatch is again the only Spec C staging path.
- Reconciliation HEAD `5ac91141beed2bc76886fd295cd21c9bc5e5dfcf` passed Validate #1199 / run `35104231026` across tests, architecture, lint, build, both Worker dry-runs, local D1 and Spec B D1 clean-install/upgrade.
- The payment-receipt bridge, table-commit bridge and `updateCollection` escape hatch remain active with the original C6/C5/C8-C10 removal targets. Tasks 6–7 introduced no additional compatibility facade/bridge.
- Remaining Task 8 gates: require validation on the final documentation-reconciled HEAD, manually dispatch `Deploy staging` for that exact branch/HEAD, execute the 15-item manual matrix below, then write `docs/superpowers/qa/spec-c1-runtime-qa.md` from real evidence only.
- Production remains untouched. C2 must not start until C1 is homologated, approved and merged.
- The approved task definitions below remain normative; this status block records execution evidence only and does not alter their requirements.

## Global Constraints

- Start from the latest merged `master` after the approved Spec C documentation is integrated.
- Use `superpowers:using-git-worktrees`; create a fresh isolated `feature/spec-c1-runtime` worktree from current `origin/master`.
- Record the actual branch base with `git rev-parse HEAD` before the first code change.
- Run baseline `npm test`, `npm run lint`, `npm run build`, and `npm run d1:migrate:local`; resolve any baseline regression separately before C1.
- Preserve all current UI copy, layout, light/dark/mobile behavior, API endpoints/payloads, capabilities, storage keys, polling timing, sync ownership, and error semantics.
- Preserve global synchronization at 5000 ms and Cozinha-only order synchronization at 2000 ms.
- Do not move client/product/order/table/finance/printing CRUD handlers into domains during C1.
- Do not rewrite payment/comanda reconciliation in C1; bridge it explicitly and remove those bridges in C5/C6.
- Do not add React Router, Redux, Zustand, WebSocket/SSE, new product behavior, or CSS restructuring.
- Do not deploy production.
- Every compatibility export/bridge is recorded in `docs/superpowers/qa/spec-c-compatibility-facades.md` in the same commit that introduces it.
- Behavioral extraction follows RED → GREEN. Mechanical import cleanup uses focused regressions plus full gates.

---

## Locked C1 file structure

### Generic infrastructure

- Create `src/infrastructure/api/httpClient.js`
- Create `src/infrastructure/api/httpClient.test.js`
- Create `src/infrastructure/auth/sessionApi.js`
- Create `src/infrastructure/auth/sessionApi.test.js`
- Modify `src/api/client.js`

### Runtime

- Create `src/app/runtime/network/useOnlineStatus.js`
- Create `src/app/runtime/network/useOnlineStatus.test.js`
- Create `src/app/runtime/feedback/useFeedbackRuntime.js`
- Create `src/app/runtime/feedback/useFeedbackRuntime.test.js`
- Create `src/app/runtime/data/useOperationalDataRuntime.js`
- Create `src/app/runtime/data/useOperationalDataRuntime.test.js`
- Create `src/app/runtime/session/useSessionRuntime.js`
- Create `src/app/runtime/session/useSessionRuntime.test.js`
- Create `src/app/runtime/runtimeExtractionContract.test.js`
- Modify `src/App.jsx`

### Architecture enforcement

- Create `scripts/architecture/check-import-boundaries.mjs`
- Create `scripts/architecture/check-import-boundaries.test.mjs`
- Create `scripts/architecture/legacy-import-allowlist.json`
- Modify `package.json`
- Modify `.github/workflows/validate.yml`
- Modify `.github/workflows/deploy-staging.yml`

### QA records

- Create `docs/superpowers/qa/spec-c-compatibility-facades.md`
- Create `docs/superpowers/qa/spec-c1-runtime-qa.md` after real C1 evidence exists

---

### Task 1: Extract generic HTTP mechanics and session API

**Files:**
- Create: `src/infrastructure/api/httpClient.js`
- Create: `src/infrastructure/api/httpClient.test.js`
- Create: `src/infrastructure/auth/sessionApi.js`
- Create: `src/infrastructure/auth/sessionApi.test.js`
- Create: `docs/superpowers/qa/spec-c-compatibility-facades.md`
- Modify: `src/api/client.js`
- Test: `src/api/client.test.js`

**Interfaces:**

```js
buildRequestOptions(options = {}) -> RequestInit
requestError(response, payload) -> Error & { status, code }
apiRequest(path, options = {}) -> Promise<any>
apiTextRequest(path, options = {}) -> Promise<string>
withJson(method, payload) -> { method, body }
createSessionApi({ request, json }) -> { getSession, login, logout }
getSession() -> Promise<SessionPayload>
login(pin) -> Promise<AuthenticatedSessionPayload>
logout() -> Promise<any>
```

`src/api/client.js` continues exporting `apiRequest`, `withJson`, `getSession`, `login`, and `logout` while legacy consumers remain.

- [ ] **Step 1: Write HTTP RED tests**

Create `src/infrastructure/api/httpClient.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { apiRequest, apiTextRequest, withJson } from './httpClient.js'

test('apiRequest preserves same-origin JSON request semantics', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let captured
  globalThis.fetch = async (path, options) => {
    captured = { path, options }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  assert.deepEqual(await apiRequest('/api/test', withJson('POST', { value: 1 })), { ok: true })
  assert.equal(captured.path, '/api/test')
  assert.equal(captured.options.credentials, 'same-origin')
  assert.equal(captured.options.headers['content-type'], 'application/json')
  assert.equal(captured.options.body, JSON.stringify({ value: 1 }))
})

test('apiRequest preserves error status/code/message', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'CONFLICT', message: 'Conflito de teste' },
  }), { status: 409, headers: { 'content-type': 'application/json' } })

  await assert.rejects(
    () => apiRequest('/api/test'),
    (error) => error.status === 409
      && error.code === 'CONFLICT'
      && error.message === 'Conflito de teste',
  )
})

test('apiTextRequest returns successful text payloads', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response('certificate', { status: 200 })
  assert.equal(await apiTextRequest('/api/text'), 'certificate')
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/infrastructure/api/httpClient.test.js
```

Expected: module-not-found failure for `httpClient.js`.

- [ ] **Step 3: Implement the generic HTTP module by moving current behavior exactly**

Create `src/infrastructure/api/httpClient.js`:

```js
export const buildRequestOptions = (options = {}) => ({
  ...options,
  credentials: 'same-origin',
  headers: { 'content-type': 'application/json', ...(options.headers || {}) },
})

export const requestError = (response, payload) => {
  const error = new Error(payload?.error?.message || 'Não foi possível concluir a operação.')
  error.status = response.status
  error.code = payload?.error?.code || 'REQUEST_FAILED'
  return error
}

export const apiRequest = async (path, options = {}) => {
  const response = await fetch(path, buildRequestOptions(options))
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw requestError(response, payload)
  return payload
}

export const apiTextRequest = async (path, options = {}) => {
  const response = await fetch(path, buildRequestOptions(options))
  const text = await response.text()
  if (!response.ok) {
    let payload = null
    try { payload = JSON.parse(text) } catch { /* preserve standard fallback */ }
    throw requestError(response, payload)
  }
  return text
}

export const withJson = (method, payload) => ({ method, body: JSON.stringify(payload) })
```

- [ ] **Step 4: Run HTTP GREEN**

```bash
node --test src/infrastructure/api/httpClient.test.js
```

Expected: PASS.

- [ ] **Step 5: Write session API RED tests**

Create `src/infrastructure/auth/sessionApi.test.js`:

```js
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
```

- [ ] **Step 6: Run session API RED**

```bash
node --test src/infrastructure/auth/sessionApi.test.js
```

Expected: module-not-found failure for `sessionApi.js`.

- [ ] **Step 7: Implement the session API**

Create `src/infrastructure/auth/sessionApi.js`:

```js
import { apiRequest, withJson } from '../api/httpClient.js'

export const createSessionApi = ({ request = apiRequest, json = withJson } = {}) => {
  const getSession = () => request('/api/auth/session')
  const login = async (pin) => {
    await request('/api/auth/login', json('POST', { pin }))
    const session = await getSession()
    if (!session?.authenticated || typeof session.businessId !== 'string' || !session.businessId
      || typeof session.settingsContextId !== 'string' || !session.settingsContextId
      || !Array.isArray(session.capabilities)) {
      throw Object.assign(new Error('Não foi possível confirmar o contexto da sessão.'), {
        code: 'SESSION_CONTEXT_UNAVAILABLE',
      })
    }
    return session
  }
  const logout = () => request('/api/auth/logout', { method: 'POST' })
  return { getSession, login, logout }
}

export const { getSession, login, logout } = createSessionApi()
```

- [ ] **Step 8: Keep `src/api/client.js` backward compatible**

Replace its duplicated generic/auth implementation with:

```js
import { apiRequest, apiTextRequest, withJson } from '../infrastructure/api/httpClient.js'
import { getSession, login, logout } from '../infrastructure/auth/sessionApi.js'

export { apiRequest, withJson, getSession, login, logout }
```

Leave every non-auth endpoint signature/body unchanged.

- [ ] **Step 9: Create the compatibility ledger**

Create `docs/superpowers/qa/spec-c-compatibility-facades.md`:

```markdown
# Spec C — compatibility facade ledger

Temporary compatibility paths must be removed by the listed slice.

| Old path/bridge | New owner/path | Remaining consumers | Removal slice |
|---|---|---|---|
| `src/api/client.js` generic/auth reexports | `src/infrastructure/api/httpClient.js` + `src/infrastructure/auth/sessionApi.js` | legacy frontend imports during domain migration | C10 at latest |
```

- [ ] **Step 10: Run regressions and commit**

```bash
node --test \
  src/infrastructure/api/httpClient.test.js \
  src/infrastructure/auth/sessionApi.test.js \
  src/api/client.test.js \
  src/api/printingClient.test.js \
  src/api/settingsClient.test.js
npm run lint
```

Expected: PASS.

```bash
git add src/infrastructure src/api/client.js docs/superpowers/qa/spec-c-compatibility-facades.md
git commit -m "refactor: extract http and session infrastructure"
```

---

### Task 2: Add the permanent architecture gate

**Files:**
- Create: `scripts/architecture/check-import-boundaries.mjs`
- Create: `scripts/architecture/check-import-boundaries.test.mjs`
- Create: `scripts/architecture/legacy-import-allowlist.json`
- Modify: `package.json`
- Modify: `.github/workflows/validate.yml`
- Modify: `.github/workflows/deploy-staging.yml`

**Interfaces:**

```js
collectImportEdges(rootDir) -> Array<{ from, specifier, resolvedPath }>
findArchitectureViolations({ rootDir, allowlist }) -> string[]
```

CLI exit code: `0` with no violations; `1` with one printed line per violation.

- [ ] **Step 1: Write RED checker tests**

Create a temporary fixture tree in `scripts/architecture/check-import-boundaries.test.mjs` and assert these concrete cases:

```js
await write('src/domains/orders/domain/rules.js', "import React from 'react'\n")
assert.ok((await violations()).some((value) => value.includes('domain-react')))

await resetFixture()
await write('src/shared/utils/a.js', "import x from '../../domains/orders/index.js'\n")
assert.ok((await violations()).some((value) => value.includes('shared-domain')))

await resetFixture()
await write('src/domains/finance/application/a.js', "import x from '../../orders/domain/x.js'\n")
assert.ok((await violations()).some((value) => value.includes('cross-domain-internal')))

await resetFixture()
await write('src/domains/finance/application/a.js', "import { x } from '../../orders/index.js'\n")
assert.deepEqual(await violations(), [])
```

Also assert that an exact allowlist entry suppresses only `src/printing/usePrintingManager.js` direct `qz-tray` import, not a second synthetic file.

- [ ] **Step 2: Run RED**

```bash
node --test scripts/architecture/check-import-boundaries.test.mjs
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement the checker with Node built-ins only**

`check-import-boundaries.mjs` must:

- recursively scan `.js`, `.jsx`, `.mjs` under `src/`;
- collect static `import ... from`, bare `import '...'`, and static `import('...')` specifiers;
- normalize repo-relative POSIX paths;
- reject React/React DOM/QZ/infrastructure imports from `domains/*/domain`;
- reject `shared -> domains`;
- reject cross-domain imports that target anything other than the other domain's public `index.js`;
- reject direct `qz-tray` imports outside `src/infrastructure/qz/**` unless exact path is allowlisted;
- export checker functions for tests;
- run as CLI when invoked directly.

Create `scripts/architecture/legacy-import-allowlist.json` exactly as:

```json
{
  "qzDirectImports": ["src/printing/usePrintingManager.js"],
  "crossDomainInternals": []
}
```

Current inspection confirms `qzTrayTransport.js` receives a `qzApi` dependency and does not itself import `qz-tray`; the current direct package import is in `usePrintingManager.js`.

- [ ] **Step 4: Run checker tests GREEN**

```bash
node --test scripts/architecture/check-import-boundaries.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add script and workflow gates**

Add to `package.json`:

```json
"test:architecture": "node scripts/architecture/check-import-boundaries.mjs"
```

Add this step after `npm test` in both `.github/workflows/validate.yml` and `.github/workflows/deploy-staging.yml`:

```yaml
      - name: Validate frontend architecture
        run: npm run test:architecture
```

- [ ] **Step 6: Verify repository and commit**

```bash
npm run test:architecture
node --test scripts/architecture/check-import-boundaries.test.mjs
npm run lint
npm run build
```

Expected: all PASS; do not broaden allowlists to hide unexpected failures.

```bash
git add scripts/architecture package.json .github/workflows/validate.yml .github/workflows/deploy-staging.yml
git commit -m "test: enforce frontend architecture boundaries"
```

---

### Task 3: Extract online/offline runtime

**Files:**
- Create: `src/app/runtime/network/useOnlineStatus.js`
- Create: `src/app/runtime/network/useOnlineStatus.test.js`
- Modify: `src/App.jsx`

**Interfaces:**

```js
readOnlineStatus(navigatorObject = globalThis.navigator) -> boolean
subscribeOnlineStatus(windowObject, callback) -> () => void
useOnlineStatus() -> boolean
```

- [ ] **Step 1: Write RED tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readOnlineStatus, subscribeOnlineStatus } from './useOnlineStatus.js'

test('readOnlineStatus preserves current fallback semantics', () => {
  assert.equal(readOnlineStatus(undefined), true)
  assert.equal(readOnlineStatus({ onLine: false }), false)
  assert.equal(readOnlineStatus({ onLine: true }), true)
})

test('subscribeOnlineStatus publishes both browser events and cleans up', () => {
  const listeners = new Map()
  const removals = []
  const fakeWindow = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => removals.push([name, fn]),
  }
  const values = []
  const unsubscribe = subscribeOnlineStatus(fakeWindow, (value) => values.push(value))
  listeners.get('online')()
  listeners.get('offline')()
  unsubscribe()
  assert.deepEqual(values, [true, false])
  assert.equal(removals.length, 2)
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/app/runtime/network/useOnlineStatus.test.js
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement and wire**

Create the pure helpers plus a `useState/useEffect` hook. Replace only App's `isOnline` state initializer and online/offline listener effect with:

```js
const isOnline = useOnlineStatus()
```

Keep `writesBlocked` and all callers in App.

- [ ] **Step 4: Run regressions and commit**

```bash
node --test src/app/runtime/network/useOnlineStatus.test.js src/actionCapabilities.test.js
npm run lint
```

```bash
git add src/app/runtime/network src/App.jsx
git commit -m "refactor: extract network status runtime"
```

---

### Task 4: Extract feedback runtime with injectable scheduling

**Files:**
- Create: `src/app/runtime/feedback/useFeedbackRuntime.js`
- Create: `src/app/runtime/feedback/useFeedbackRuntime.test.js`
- Modify: `src/App.jsx`

**Interfaces:**

```js
TOAST_DISMISS_MS = 2600
SUCCESS_DISMISS_MS = 1800
useFeedbackRuntime({ schedule, cancel } = {}) -> {
  toastMessage,
  successMessage,
  setToastMessage,
  setSuccessMessage,
  showSuccessMessage,
}
```

Default `schedule` is `globalThis.setTimeout`, default `cancel` is `globalThis.clearTimeout`. `showSuccessMessage()` defaults to exact copy `Ação salva com sucesso`.

- [ ] **Step 1: Write RED hook test with a deterministic fake scheduler**

The test harness stores the latest hook return in `current`. Use:

```js
const scheduled = []
const schedule = (callback, delay) => {
  const token = { callback, delay, cancelled: false }
  scheduled.push(token)
  return token
}
const cancel = (token) => { token.cancelled = true }
```

Assert:

```js
await act(() => current.setToastMessage('Teste'))
assert.equal(current.toastMessage, 'Teste')
assert.equal(scheduled.at(-1).delay, 2600)
await act(() => scheduled.at(-1).callback())
assert.equal(current.toastMessage, '')

await act(() => current.showSuccessMessage())
assert.equal(current.successMessage, 'Ação salva com sucesso')
assert.equal(scheduled.at(-1).delay, 1800)
await act(() => scheduled.at(-1).callback())
assert.equal(current.successMessage, '')
```

Also unmount and assert outstanding tokens are cancelled.

- [ ] **Step 2: Run RED**

```bash
node --test src/app/runtime/feedback/useFeedbackRuntime.test.js
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement and wire**

Move only the two feedback states, default success helper, and auto-dismiss effects into the hook. Keep portal markup in `App.jsx` unchanged.

- [ ] **Step 4: Run regressions and commit**

```bash
node --test \
  src/app/runtime/feedback/useFeedbackRuntime.test.js \
  src/businessOperationsUi.test.js \
  src/businessPaymentOptions.test.js
npm run lint
```

```bash
git add src/app/runtime/feedback src/App.jsx
git commit -m "refactor: extract feedback runtime"
```

---

### Task 5: Extract official collections, bootstrap, and polling runtime

**Files:**
- Create: `src/app/runtime/data/useOperationalDataRuntime.js`
- Create: `src/app/runtime/data/useOperationalDataRuntime.test.js`
- Modify: `src/App.jsx`
- Modify: `docs/superpowers/qa/spec-c-compatibility-facades.md`

**Interfaces:**

```js
export const GLOBAL_SYNC_INTERVAL_MS = 5_000
export const ORDER_SYNC_INTERVAL_MS = 2_000

createRefreshSubscription({
  run,
  intervalMs,
  windowObject,
  documentObject,
  setIntervalFn,
  clearIntervalFn,
}) -> () => void

useOperationalDataRuntime({
  api,
  onUnauthorized,
  globalSyncEnabled,
  ordersSyncEnabled,
  effectiveConfigVersion,
  legacyBridges,
}) -> {
  bootstrapState,
  bootstrapEffectiveConfig,
  clients,
  products,
  orders,
  tables,
  tableTabs,
  movements,
  financeSettings,
  refreshBootstrap,
  refreshBootstrapSilently,
  refreshOrders,
  applyOfficialEffects,
  updateCollection,
  resetOperationalData,
  getSyncGuard,
  getOfficialRevision,
  getOfficialTables,
}
```

`api` defaults to current `getBootstrap`/`getOrders` client functions. `legacyBridges` shape:

```js
{
  capturePaymentOwners: () => [],
  settlePaymentOwners: (owners, receipt) => {},
  onTablesCommitted: (nextTables) => {},
}
```

Temporary removal targets:

- payment owner capture/settlement → C6;
- table selection callback → C5;
- `updateCollection` escape hatch → removed incrementally C4-C8, gone by C10.

- [ ] **Step 1: Write pure polling subscription RED tests**

Use fake window/document/listeners and fake interval registration. Assert exactly:

```js
assert.equal(runCount, 1) // immediate run
intervalCallback()
assert.equal(runCount, 2)
documentObject.visibilityState = 'hidden'
intervalCallback()
assert.equal(runCount, 2)
documentObject.visibilityState = 'visible'
visibilityListener()
focusListener()
assert.equal(runCount, 4)
unsubscribe()
assert.equal(clearIntervalCalls, 1)
assert.deepEqual(removedEventNames.sort(), ['focus', 'visibilitychange'])
```

- [ ] **Step 2: Write operational data hook RED tests**

Use a hook harness with `globalSyncEnabled: false` and `ordersSyncEnabled: false` so tests call refresh methods explicitly.

Concrete bootstrap fixture:

```js
const bootstrap = {
  clients: [{ id: 'client-1', name: 'Ana' }],
  products: [{ id: 'product-1', name: 'Marmita' }],
  orders: [{ id: 'order-1', status: 'Em preparo' }],
  tables: [{ id: 'table-1', occupancy: 'occupied', openTableTab: { id: 'tab-1' } }],
  tableTabs: [{ id: 'tab-1', status: 'open' }],
  movements: [{ id: 'movement-1', type: 'entrada', value: 10 }],
  financeSettings: { openingBalance: 20 },
  effectiveBusinessConfig: { version: 'cfg-1', revisions: {} },
}
```

Test 1: after `await current.refreshBootstrap()`, assert every returned collection equals the fixture and `bootstrapState === 'ready'`.

Test 2: stale bootstrap protection:

1. start a deferred `refreshBootstrapSilently()` whose response contains old `order-1`;
2. call `current.applyOfficialEffects({ order: { id: 'order-1', status: 'Finalizado' } })`;
3. resolve deferred bootstrap;
4. assert `current.orders[0].status === 'Finalizado'`.

Test 3: payment receipt owner capture:

- bridge `capturePaymentOwners` returns `[ownerA]` when read starts;
- change future capture result to `[ownerB]` before resolving the API;
- resolve bootstrap;
- assert `settlePaymentOwners` received `[ownerA]`, not `[ownerB]`.

Test 4: table snapshot bridge:

- refresh bootstrap;
- assert `onTablesCommitted` received the exact `bootstrap.tables` array;
- assert `current.getOfficialTables()` returns the same table IDs.

Test 5: order-only refresh:

- initial bootstrap loads all collections;
- fake `getOrders` returns `{ orders: [{ id: 'order-2', status: 'Em preparo' }] }`;
- `await current.refreshOrders()`;
- assert only orders changed and clients/products/movements remain deep-equal to their pre-refresh values.

Test 6: reset:

- capture `const firstGuard = current.getSyncGuard()`;
- call `current.resetOperationalData()`;
- assert all collections are empty/null as current App clear behavior expects;
- assert `current.getSyncGuard() !== firstGuard`;
- assert `current.getOfficialRevision() === 0`.

- [ ] **Step 3: Run RED**

```bash
node --test src/app/runtime/data/useOperationalDataRuntime.test.js
```

Expected: module-not-found failure.

- [ ] **Step 4: Implement runtime by relocating current App logic**

Move into the hook, without semantic simplification:

- official collection states;
- `syncGuardRef`;
- `bootstrapSyncInFlightRef`;
- `ordersSyncInFlightRef`;
- `officialRevisionRef`;
- `officialTablesRef`;
- bootstrap effective-config snapshot;
- `applyBootstrapCollections` mechanics;
- generic `applyOfficialEffects` collection updates;
- bootstrap and order refresh functions;
- reset logic;
- polling effects using `createRefreshSubscription`.

Keep `createCollectionSyncGuard`, `upsertById`, `upsertManyById`, `removeById` in `src/utils/dataSync.js` during C1.

Table commit logic inside runtime:

```js
const commitTables = (nextTables) => {
  officialTablesRef.current = nextTables
  legacyBridges.onTablesCommitted?.(nextTables)
  setTables(nextTables)
}
```

Payment bridge inside bootstrap:

```js
const paymentOwners = legacyBridges.capturePaymentOwners?.() ?? []
const receipt = applyBootstrapCollections(data, token)
legacyBridges.settlePaymentOwners?.(paymentOwners, receipt)
```

A background bootstrap passes `effectiveConfigVersion` to `getBootstrap`; an initial bootstrap does not.

- [ ] **Step 5: Convert App's table-selection block into the explicit table bridge**

Before constructing `legacyBridges`, make `retirePaymentUI` a stable callback, then implement:

```js
const onTablesCommitted = useCallback((nextTables) => {
  const identity = comandaIdentityRef.current
  const currentTable = identity?.tableTabId
    ? nextTables.find((table) => table.isActive
      && table.occupancy === 'occupied'
      && table.openTableTab?.id === identity.tableTabId)
    : null

  if (currentTable) {
    if (currentTable.id !== identity.tableId) {
      const nextIdentity = { tableId: currentTable.id, tableTabId: identity.tableTabId }
      comandaIdentityRef.current = nextIdentity
      setSelectedComanda(nextIdentity)
    }
    return
  }

  if (identity) {
    retirePaymentUI()
    comandaSelectionRef.current += 1
    setSelectedComandaGeneration(comandaSelectionRef.current)
    comandaIdentityRef.current = null
    setSelectedComanda(null)
  }
}, [retirePaymentUI])
```

Keep `settleAcceptedPayment` in App. Make it stable, then bridge bootstrap owners with:

```js
const capturePaymentOwners = useCallback(() => [...paymentSyncRef.current], [])
const settlePaymentOwners = useCallback((owners, receipt) => {
  owners.forEach((owner) => settleAcceptedPayment(owner, receipt))
}, [settleAcceptedPayment])

const legacyBridges = useMemo(() => ({
  capturePaymentOwners,
  settlePaymentOwners,
  onTablesCommitted,
}), [capturePaymentOwners, onTablesCommitted, settlePaymentOwners])
```

- [ ] **Step 6: Replace App's direct sync internals with runtime contract**

App may temporarily call:

```js
getSyncGuard()
getOfficialRevision()
getOfficialTables()
applyOfficialEffects(...)
updateCollection('clients', updater)
updateCollection('products', updater)
```

only where later domain/workflow slices have not yet removed the legacy handler.

Do not expose raw runtime refs from the hook.

- [ ] **Step 7: Extend facade ledger**

Add these exact rows:

```markdown
| operational data runtime payment-receipt bridge | App-owned payment reconciliation | C1 legacy payment workflow | C6 |
| operational data runtime table-commit bridge | App-owned comanda selection reconciliation | C1 legacy table-service workflow | C5 |
| `updateCollection` runtime escape hatch | temporary legacy App CRUD handlers | clients/products handlers not migrated yet | C8, with final enforcement C10 |
```

- [ ] **Step 8: Run GREEN and focused regressions**

```bash
node --test \
  src/app/runtime/data/useOperationalDataRuntime.test.js \
  src/utils/dataSync.test.js \
  src/AppReceivablesPromise.test.js \
  src/actionCapabilities.test.js \
  src/pages/Comandas.test.js
npm run lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/runtime/data src/App.jsx docs/superpowers/qa/spec-c-compatibility-facades.md
git commit -m "refactor: extract operational data runtime"
```

---

### Task 6: Extract session lifecycle after operational runtime exists

**Files:**
- Create: `src/app/runtime/session/useSessionRuntime.js`
- Create: `src/app/runtime/session/useSessionRuntime.test.js`
- Modify: `src/App.jsx`

**Interfaces:**

```js
useSessionRuntime({
  api,
  isOnline,
  requestKey,
  setRequestKey,
  resetOperationalData,
  refreshBootstrap,
  onClearApplicationState,
}) -> {
  authState,
  sessionContext,
  sessionGeneration,
  loginError,
  handleLogin,
  handleLogout,
  expireSession,
}
```

`authState` remains exactly `checking | anonymous | authenticated`.

- [ ] **Step 1: Write RED session hook tests**

Use a renderer harness and fake APIs/callback counters. Implement these concrete tests:

1. `getSession` returns `{ authenticated: false }` → state becomes `anonymous`, `refreshBootstrapCalls === 0`.
2. `getSession` returns a valid authenticated session → `sessionContext.businessId === 'amor-e-sabor'`, `sessionGeneration === 1`, state `authenticated`, `refreshBootstrapCalls === 1`.
3. `api.login` throws `{ code: 'INVALID_PIN' }` → exact `loginError === 'PIN inválido. Confira e tente novamente.'`.
4. `api.login` throws `new Error('Falha de rede')` → `loginError === 'Falha de rede'`.
5. `handleLogout` calls `api.logout`, `resetOperationalData`, `onClearApplicationState`, then returns to `anonymous` with blank login error.
6. `expireSession` calls both cleanup callbacks and sets exact `Sua sessão expirou. Entre novamente.`.
7. with `isOnline === false`, `handleLogin('1234')` does not call API.
8. with `requestKey === 'order:create'`, logout does not call API.

- [ ] **Step 2: Run RED**

```bash
node --test src/app/runtime/session/useSessionRuntime.test.js
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement by moving current App session behavior**

Move:

- `authState`;
- `sessionContext`;
- `sessionKey` as `sessionGeneration`;
- `loginError`;
- initial session-check effect;
- login handler;
- logout handler;
- expiry handler.

Preserve current operation order: authenticated context/generation/state are established, then `refreshBootstrap()` is awaited; errors keep the same anonymous/bootstrap-reset behavior through the supplied callbacks.

`onClearApplicationState` remains App-owned and clears navigation/forms/dialogs that C1 intentionally does not migrate.

- [ ] **Step 4: Wire App and preserve capability derivation**

App continues deriving `granted` from `sessionContext`, `authState`, optional `capabilities` prop, `hasCapability`, and `legacyCapabilities`. Do not move capability policy in C1.

- [ ] **Step 5: Run GREEN and regressions**

```bash
node --test \
  src/app/runtime/session/useSessionRuntime.test.js \
  src/AppNewOrderGuard.test.js \
  src/AppReceivablesPromise.test.js \
  src/actionCapabilities.test.js \
  src/app/effectiveBusinessConfig.test.js
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/runtime/session src/App.jsx
git commit -m "refactor: extract session runtime"
```

---

### Task 7: Enforce the C1 App boundary and remove dead duplicate code

**Files:**
- Create: `src/app/runtime/runtimeExtractionContract.test.js`
- Modify: `src/App.jsx`

**Interfaces:** App still exports default `App` and still accepts existing optional `{ capabilities }` test prop.

- [ ] **Step 1: Write RED structural contract test**

Create a test that reads `src/App.jsx` with `fs.readFile` and rejects these C1-owned implementation tokens:

```js
const forbidden = [
  'getSessionApi(',
  'getBootstrapApi(',
  'getOrdersApi(',
  "window.addEventListener('online'",
  'bootstrapSyncInFlightRef',
  'ordersSyncInFlightRef',
  'syncGuardRef = useRef(',
]
for (const token of forbidden) assert.equal(source.includes(token), false, token)
```

Also assert App still contains these intentionally deferred responsibilities so C1 does not overreach:

```js
for (const token of [
  'settleAcceptedPayment',
  'handleRegisterTableTabPayment',
  'handleAddClient',
  'handleAddProduct',
  'handleSaveMovement',
  'handleGlobalSecondCopy',
]) assert.equal(source.includes(token), true, token)
```

- [ ] **Step 2: Run RED before final cleanup**

```bash
node --test src/app/runtime/runtimeExtractionContract.test.js
```

Expected: FAIL for any extracted responsibility token still present.

- [ ] **Step 3: Remove only dead/duplicate C1 implementation from App**

Remove unused imports/states/effects/functions for:

- old generic auth API names;
- online listener state/effect;
- feedback timer states/effects;
- official collection/sync refs now owned by operational runtime;
- session state/effect/handlers now owned by session runtime.

Do not change CSS imports, `IMPLEMENTED_DESTINATIONS`, visible render ordering, page props, or domain handlers.

- [ ] **Step 4: Run structural contract GREEN**

```bash
node --test src/app/runtime/runtimeExtractionContract.test.js
```

Expected: PASS.

- [ ] **Step 5: Run broad C1 regression set**

```bash
node --test \
  src/infrastructure/api/httpClient.test.js \
  src/infrastructure/auth/sessionApi.test.js \
  src/app/runtime/network/useOnlineStatus.test.js \
  src/app/runtime/feedback/useFeedbackRuntime.test.js \
  src/app/runtime/data/useOperationalDataRuntime.test.js \
  src/app/runtime/session/useSessionRuntime.test.js \
  src/app/runtime/runtimeExtractionContract.test.js \
  src/AppNewOrderGuard.test.js \
  src/AppReceivablesPromise.test.js \
  src/actionCapabilities.test.js \
  src/app/effectiveBusinessConfig.test.js \
  src/app/navigation.test.js \
  src/app/queryContext.test.js \
  src/pages/Comandas.test.js \
  src/hooks/useKitchenClock.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/app/runtime/runtimeExtractionContract.test.js
git commit -m "refactor: complete c1 runtime boundary"
```

---

### Task 8: Full C1 verification, staging, and QA evidence

**Files:**
- Create after real evidence: `docs/superpowers/qa/spec-c1-runtime-qa.md`
- Modify only if bridge status changes: `docs/superpowers/qa/spec-c-compatibility-facades.md`

- [ ] **Step 1: Run full local gates**

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
```

Expected: every command exits `0`.

- [ ] **Step 2: Calculate and review the actual C1 base diff**

```bash
C1_BASE_SHA="$(git merge-base HEAD origin/master)"
test -n "$C1_BASE_SHA"
printf 'C1 base: %s\n' "$C1_BASE_SHA"
git diff --stat "$C1_BASE_SHA"...HEAD
git diff "$C1_BASE_SHA"...HEAD -- \
  src/App.jsx \
  src/app/runtime \
  src/infrastructure \
  src/api/client.js \
  package.json \
  .github/workflows
```

Review specifically for accidental changes to copy, 5000/2000 ms timing, endpoint strings, headers/payloads, capability validation, 401/409 handling, collection names, request blocking, page props, and CSS imports.

- [ ] **Step 3: Open PR and require validation**

Open `feature/spec-c1-runtime` → `master`. Require Validate application success including tests, architecture gate, lint, build, both Worker dry-runs, local D1, and the existing Spec B D1 gate.

- [ ] **Step 4: Manually deploy the exact C1 branch to staging**

GitHub Actions → `Deploy staging` → Run workflow → select `feature/spec-c1-runtime`.

Require SUCCESS for tests, architecture gate, lint, build, local D1, staging Worker dry-run, staging credentials, pending migrations, remote staging migrations, deploy, and real login smoke.

- [ ] **Step 5: Execute the C1 manual matrix**

Record real PASS/FAIL for:

1. authenticated reload loads current operation normally;
2. anonymous session displays Login;
3. invalid PIN shows the same error;
4. valid login reaches the same post-bootstrap destination;
5. logout clears business state and returns to Login;
6. a 401/session expiry returns to Login with the current expiry copy;
7. offline banner/write blocking remain equivalent;
8. reconnect/focus/visibility global refresh behavior remains correct;
9. Cozinha receives order updates while active with current behavior;
10. leaving Cozinha stops its dedicated order refresh while global sync remains operational;
11. Clients, Products, Finance and Comandas show bootstrap data correctly;
12. one representative comanda payment still settles/reconciles without stale-selection regression;
13. Settings effective config/draft/save behavior remains unchanged;
14. opening Cozinha and Fila de impressão shows no new printing-runtime initialization error;
15. no visible desktop/mobile/light/dark regression attributable to C1.

C1 does not change physical printing behavior, so a full hardware matrix is not required in this slice.

- [ ] **Step 6: Write the QA ledger using only real evidence**

Create `docs/superpowers/qa/spec-c1-runtime-qa.md` with:

- branch name;
- actual base SHA from Step 2;
- final executable SHA;
- PR number;
- Validate run number/ID/result;
- staging run number/ID/result;
- all 15 manual matrix results;
- open compatibility bridges and their planned removal slices;
- explicit statement that production was not deployed.

Do not write workflow IDs or PASS statuses until observed.

- [ ] **Step 7: If QA documentation is committed after the homologated executable SHA, prove it is docs-only**

```bash
QA_PARENT="$(git rev-parse HEAD^)"
git diff --name-only "$QA_PARENT"..HEAD
```

Expected: only `docs/superpowers/qa/*` paths. Require normal validation on the docs commit; do not redeploy staging solely for docs when no executable file changed.

Commit:

```bash
git add docs/superpowers/qa
git commit -m "docs: record spec c1 runtime qa"
```

---

## C1 Acceptance Checklist

C1 is merge-ready only when all statements are true:

- generic HTTP/auth behavior moved with compatibility exports intact;
- App no longer owns browser online/offline listeners;
- App no longer owns feedback dismiss timers;
- official collections/bootstrap/order-sync mechanics live in operational runtime;
- session check/login/logout/expiry live in session runtime;
- App-owned payment/table workflows are preserved through documented temporary bridges;
- architecture checks run locally, in Validate application, and in Deploy staging;
- no React Router/state-library/CSS/domain-CRUD migration was introduced;
- focused regressions and full suite pass;
- lint, architecture, build, local D1 and GitHub workflow gates pass;
- exact C1 branch staging deploy succeeds;
- C1 manual matrix is homologated;
- facade ledger contains every temporary bridge/export;
- production was not deployed.

After C1 merge, do not continue from the C1 branch. Refresh `master`, create a fresh isolated C2 branch/worktree, inspect the post-C1 tree, and write/approve the C2 detailed plan from that real base.