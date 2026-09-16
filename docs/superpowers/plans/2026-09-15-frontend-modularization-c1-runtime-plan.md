# Spec C C1 Runtime Centralization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract session, network status, feedback, bootstrap/official-data synchronization, and architecture enforcement from `App.jsx` while preserving every current business/UI behavior and leaving domain CRUD/payment/printing workflows for later Spec C slices.

**Architecture:** C1 creates small runtime hooks under `src/app/runtime`, extracts generic HTTP/auth adapters, and moves official collection synchronization behind `useOperationalDataRuntime`. Temporary legacy bridges let App-owned comanda/payment workflows observe table/bootstrap receipts without moving those workflows early. Architectural checks are introduced now with a shrinking legacy allowlist so later slices cannot recreate cross-layer coupling.

**Tech Stack:** React 19.2, react-test-renderer 19.2, Vite 8.2, Node 22 `node:test`, oxlint, Cloudflare Worker/D1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`

**Rollout:** `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`

## Global Constraints

- Start implementation from the latest merged `master`, not from `docs/spec-c-frontend-modularization` or an old Spec B worktree.
- Before code, use `superpowers:using-git-worktrees` and create `feature/spec-c1-runtime` from current `origin/master`.
- Run baseline `npm test`, `npm run lint`, `npm run build`, `npm run d1:migrate:local` before the first RED test. If baseline is not green, diagnose the base separately.
- Preserve UI, strings, timing, endpoints, payloads, capabilities, storage keys, sync ownership, and polling intervals.
- Keep `GLOBAL_SYNC_INTERVAL_MS = 5_000` and `ORDER_SYNC_INTERVAL_MS = 2_000` behavior equivalent.
- Do not move client/product/order/table/finance/printing CRUD handlers to their domains in C1.
- Do not rewrite payment/comanda reconciliation in C1. Use explicit temporary bridges from operational runtime to current App-owned payment/table selection logic.
- Do not add React Router, Redux, Zustand, WebSocket/SSE, or new product behavior.
- Do not move CSS in C1.
- Do not deploy production.
- Add every compatibility bridge/reexport to `docs/superpowers/qa/spec-c-compatibility-facades.md` in the same commit that introduces it.
- Every behavioral extraction uses RED → GREEN; purely mechanical import moves use nearest regression tests plus full gates.

---

## File structure locked by C1

### Generic infrastructure

- Create `src/infrastructure/api/httpClient.js` — generic request mechanics only.
- Create `src/infrastructure/api/httpClient.test.js`.
- Create `src/infrastructure/auth/sessionApi.js` — `getSession`, `login`, `logout`.
- Create `src/infrastructure/auth/sessionApi.test.js`.
- Modify `src/api/client.js` — compatibility exports/use of new infrastructure without changing public API.

### Runtime

- Create `src/app/runtime/network/useOnlineStatus.js`.
- Create `src/app/runtime/network/useOnlineStatus.test.js`.
- Create `src/app/runtime/feedback/useFeedbackRuntime.js`.
- Create `src/app/runtime/feedback/useFeedbackRuntime.test.js`.
- Create `src/app/runtime/data/useOperationalDataRuntime.js`.
- Create `src/app/runtime/data/useOperationalDataRuntime.test.js`.
- Create `src/app/runtime/session/useSessionRuntime.js`.
- Create `src/app/runtime/session/useSessionRuntime.test.js`.
- Modify `src/App.jsx` to consume these runtimes while retaining domain/workflow handlers.

### Architecture enforcement

- Create `scripts/architecture/check-import-boundaries.mjs`.
- Create `scripts/architecture/check-import-boundaries.test.mjs`.
- Create `scripts/architecture/legacy-import-allowlist.json`.
- Modify `package.json` to add `test:architecture`.
- Modify `.github/workflows/validate.yml` to run the architecture gate.
- Modify `.github/workflows/deploy-staging.yml` to run the architecture gate before build/deploy.

### QA/compatibility records

- Create `docs/superpowers/qa/spec-c-compatibility-facades.md`.
- Create `docs/superpowers/qa/2026-09-15-spec-c1-runtime-qa.md`.

---

### Task 1: Extract generic HTTP mechanics and auth API

**Files:**
- Create: `src/infrastructure/api/httpClient.js`
- Create: `src/infrastructure/api/httpClient.test.js`
- Create: `src/infrastructure/auth/sessionApi.js`
- Create: `src/infrastructure/auth/sessionApi.test.js`
- Modify: `src/api/client.js`
- Test: `src/api/client.test.js`

**Interfaces:**
- `buildRequestOptions(options = {}) -> RequestInit`
- `requestError(response, payload) -> Error & { status, code }`
- `apiRequest(path, options = {}) -> Promise<any>`
- `apiTextRequest(path, options = {}) -> Promise<string>`
- `withJson(method, payload) -> { method, body }`
- `getSession() -> Promise<SessionPayload>`
- `login(pin) -> Promise<AuthenticatedSessionPayload>`
- `logout() -> Promise<any>`
- `src/api/client.js` must continue exporting `getSession`, `login`, `logout`, `apiRequest`, and `withJson` compatibility names used by current consumers/tests.

- [ ] **Step 1: Write failing generic HTTP tests**

Create `src/infrastructure/api/httpClient.test.js` with focused tests using a temporary `globalThis.fetch` stub:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { apiRequest, apiTextRequest, withJson } from './httpClient.js'

test('apiRequest keeps same-origin credentials and JSON content type', async (t) => {
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

test('apiRequest preserves status/code/message contract on failure', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'CONFLICT', message: 'Conflito de teste' },
  }), { status: 409, headers: { 'content-type': 'application/json' } })

  await assert.rejects(
    () => apiRequest('/api/test'),
    (error) => error.status === 409 && error.code === 'CONFLICT' && error.message === 'Conflito de teste',
  )
})

test('apiTextRequest returns text and maps JSON error payloads identically', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response('certificate', { status: 200 })
  assert.equal(await apiTextRequest('/api/text'), 'certificate')
})
```

- [ ] **Step 2: Run RED for missing infrastructure module**

Run:

```bash
node --test src/infrastructure/api/httpClient.test.js
```

Expected: FAIL because `httpClient.js` does not exist.

- [ ] **Step 3: Implement generic HTTP module by moving behavior, not redesigning it**

Create `src/infrastructure/api/httpClient.js` with the same semantics currently at the top of `src/api/client.js`:

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
    try { payload = JSON.parse(text) } catch { /* keep standard fallback */ }
    throw requestError(response, payload)
  }
  return text
}

export const withJson = (method, payload) => ({ method, body: JSON.stringify(payload) })
```

- [ ] **Step 4: Run HTTP tests GREEN**

```bash
node --test src/infrastructure/api/httpClient.test.js
```

Expected: PASS.

- [ ] **Step 5: Write auth adapter RED tests**

Create `src/infrastructure/auth/sessionApi.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionApi } from './sessionApi.js'

test('login confirms the authenticated session after posting the PIN', async () => {
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

test('login rejects an incomplete authenticated session context', async () => {
  const api = createSessionApi({
    request: async (path) => path === '/api/auth/login' ? {} : { authenticated: true },
    json: (method, payload) => ({ method, body: JSON.stringify(payload) }),
  })
  await assert.rejects(() => api.login('1234'), { code: 'SESSION_CONTEXT_UNAVAILABLE' })
})
```

- [ ] **Step 6: Run auth RED**

```bash
node --test src/infrastructure/auth/sessionApi.test.js
```

Expected: FAIL because `sessionApi.js` does not exist.

- [ ] **Step 7: Implement session API**

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

- [ ] **Step 8: Convert `src/api/client.js` to use/reexport infrastructure helpers**

At the top of `src/api/client.js`, remove duplicate generic/auth implementations and use:

```js
import { apiRequest, apiTextRequest, withJson } from '../infrastructure/api/httpClient.js'
import { getSession, login, logout } from '../infrastructure/auth/sessionApi.js'

export { apiRequest, withJson, getSession, login, logout }
```

Keep every other existing endpoint signature/body unchanged.

- [ ] **Step 9: Run compatibility regressions**

```bash
node --test \
  src/infrastructure/api/httpClient.test.js \
  src/infrastructure/auth/sessionApi.test.js \
  src/api/client.test.js \
  src/api/printingClient.test.js \
  src/api/settingsClient.test.js
```

Expected: PASS.

- [ ] **Step 10: Record compatibility export and commit**

Add a row to `docs/superpowers/qa/spec-c-compatibility-facades.md` stating that `src/api/client.js` temporarily reexports generic/auth infrastructure for legacy consumers, removal target C7-C9/C10 depending remaining imports.

Commit:

```bash
git add src/infrastructure src/api/client.js docs/superpowers/qa/spec-c-compatibility-facades.md
git commit -m "refactor: extract http and session infrastructure"
```

---

### Task 2: Add architecture import gate early

**Files:**
- Create: `scripts/architecture/check-import-boundaries.mjs`
- Create: `scripts/architecture/check-import-boundaries.test.mjs`
- Create: `scripts/architecture/legacy-import-allowlist.json`
- Modify: `package.json`
- Modify: `.github/workflows/validate.yml`
- Modify: `.github/workflows/deploy-staging.yml`

**Interfaces:**
- `collectImportEdges(rootDir) -> Array<{ from, specifier, resolvedPath|null }>`
- `findArchitectureViolations({ rootDir, allowlist }) -> string[]`
- CLI exits `0` with no violations, `1` and one line per violation otherwise.
- `npm run test:architecture` runs the checker on repository root.

- [ ] **Step 1: Write gate RED tests with temporary fixtures**

Create `scripts/architecture/check-import-boundaries.test.mjs` using `node:test`, `fs.mkdtemp`, and a small synthetic source tree. Include these cases:

```js
await t.test('domain code cannot import React', async () => {
  await write('src/domains/orders/domain/rules.js', "import React from 'react'\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: [] })
  assert.ok(violations.some((value) => value.includes('domain-react')))
})

await t.test('shared cannot import domains', async () => {
  await write('src/shared/utils/a.js', "import x from '../../domains/orders/index.js'\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: [] })
  assert.ok(violations.some((value) => value.includes('shared-domain')))
})

await t.test('external domain consumer cannot import another domain internal path', async () => {
  await write('src/domains/finance/application/a.js', "import x from '../../orders/domain/x.js'\n")
  const violations = await findArchitectureViolations({ rootDir, allowlist: [] })
  assert.ok(violations.some((value) => value.includes('cross-domain-internal')))
})
```

Also test that importing `../../orders/index.js` is allowed and that an allowlisted legacy QZ path suppresses only that exact violation.

- [ ] **Step 2: Run RED**

```bash
node --test scripts/architecture/check-import-boundaries.test.mjs
```

Expected: FAIL because checker module does not exist.

- [ ] **Step 3: Implement the lightweight import scanner**

Implement `scripts/architecture/check-import-boundaries.mjs` with Node built-ins only:

- recursively scan `.js`, `.jsx`, `.mjs` under `src/`;
- parse static `import ... from`, bare `import '...'`, and static dynamic `import('...')` specifiers with explicit regexes;
- normalize repository-relative POSIX paths;
- enforce:
  - files under `src/domains/*/domain/` cannot import `react`, `react-dom`, `qz-tray`, `src/infrastructure/**`, another domain internal path, or browser-only modules declared by relative path;
  - files under `src/shared/` cannot resolve into `src/domains/`;
  - cross-domain imports must resolve to the other domain's `index.js` public entry;
  - direct `qz-tray` import is permitted only for exact paths in allowlist or `src/infrastructure/qz/**`.
- export functions for tests;
- execute CLI only when invoked as main module.

Use allowlist shape:

```json
{
  "qzDirectImports": [
    "src/printing/usePrintingManager.js"
  ],
  "crossDomainInternals": []
}
```

The QZ legacy row is removed in C9.

- [ ] **Step 4: Run gate tests GREEN**

```bash
node --test scripts/architecture/check-import-boundaries.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add npm script and CI steps**

Modify `package.json` scripts:

```json
"test:architecture": "node scripts/architecture/check-import-boundaries.mjs"
```

In both `.github/workflows/validate.yml` and `.github/workflows/deploy-staging.yml`, add after `npm test` and before lint/build:

```yaml
      - name: Validate frontend architecture
        run: npm run test:architecture
```

- [ ] **Step 6: Run gate on current repository**

```bash
npm run test:architecture
```

Expected: PASS using only the explicit QZ legacy allowance above. Do not add broad directory wildcards to make failures disappear.

- [ ] **Step 7: Run workflow-adjacent gates and commit**

```bash
node --test scripts/architecture/check-import-boundaries.test.mjs
npm run lint
npm run build
```

Commit:

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
- `readOnlineStatus(navigatorObject = globalThis.navigator) -> boolean`
- `subscribeOnlineStatus(windowObject, callback) -> () => void`
- `useOnlineStatus() -> boolean`

- [ ] **Step 1: Write RED tests for status default and listener cleanup**

Test pure helpers without a browser:

```js
test('readOnlineStatus preserves current navigator semantics', () => {
  assert.equal(readOnlineStatus(undefined), true)
  assert.equal(readOnlineStatus({ onLine: false }), false)
  assert.equal(readOnlineStatus({ onLine: true }), true)
})

test('subscribeOnlineStatus publishes online/offline and removes both listeners', () => {
  const listeners = new Map()
  const removed = []
  const fakeWindow = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => removed.push([name, fn]),
  }
  const values = []
  const unsubscribe = subscribeOnlineStatus(fakeWindow, (value) => values.push(value))
  listeners.get('online')()
  listeners.get('offline')()
  unsubscribe()
  assert.deepEqual(values, [true, false])
  assert.equal(removed.length, 2)
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/app/runtime/network/useOnlineStatus.test.js
```

Expected: FAIL missing module.

- [ ] **Step 3: Implement helper + hook**

`useOnlineStatus.js` uses `useEffect/useState`, initializes from `readOnlineStatus()`, subscribes once, and returns boolean. Preserve current meaning that missing navigator means online.

- [ ] **Step 4: Replace App-owned online state/effect**

Remove only:

- `const [isOnline, setIsOnline] = ...`;
- the online/offline `useEffect`.

Replace with:

```js
const isOnline = useOnlineStatus()
```

Do not move any write-blocking logic yet.

- [ ] **Step 5: Run focused regressions**

```bash
node --test src/app/runtime/network/useOnlineStatus.test.js src/actionCapabilities.test.js
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/runtime/network src/App.jsx
git commit -m "refactor: extract network status runtime"
```

---

### Task 4: Extract feedback runtime without changing timings or copy

**Files:**
- Create: `src/app/runtime/feedback/useFeedbackRuntime.js`
- Create: `src/app/runtime/feedback/useFeedbackRuntime.test.js`
- Modify: `src/App.jsx`

**Interfaces:**
- `TOAST_DISMISS_MS = 2600`
- `SUCCESS_DISMISS_MS = 1800`
- `useFeedbackRuntime() -> { toastMessage, successMessage, setToastMessage, setSuccessMessage, showSuccessMessage }`
- `showSuccessMessage(message = 'Ação salva com sucesso')` preserves current default copy.

- [ ] **Step 1: Write RED hook test**

Use `react-test-renderer` with `act` and Node mock timers. The test must prove:

1. `setToastMessage('x')` exposes `toastMessage === 'x'`;
2. timeout at `2599ms` does not clear;
3. reaching `2600ms` clears;
4. success default copy is `Ação salva com sucesso`;
5. success clears at `1800ms`.

Keep the renderer harness minimal and restore mock timers after the test.

- [ ] **Step 2: Run RED**

```bash
node --test src/app/runtime/feedback/useFeedbackRuntime.test.js
```

Expected: FAIL missing module.

- [ ] **Step 3: Implement hook by moving current state/timer effects**

The hook owns only feedback state and auto-dismiss timers. It must not inspect domains, request state, navigation, or capabilities.

- [ ] **Step 4: Wire App**

Replace App's local `toastMessage`/`successMessage` states, their two timer effects, and local `showSuccessMessage` function with the hook return. Keep the existing portal markup exactly where it is in `App.jsx` during C1.

- [ ] **Step 5: Run focused UI regressions**

```bash
node --test \
  src/app/runtime/feedback/useFeedbackRuntime.test.js \
  src/businessOperationsUi.test.js \
  src/businessPaymentOptions.test.js
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/app/runtime/feedback src/App.jsx
git commit -m "refactor: extract feedback runtime"
```

---

### Task 5: Extract official collections/bootstrap runtime with explicit legacy bridges

**Files:**
- Create: `src/app/runtime/data/useOperationalDataRuntime.js`
- Create: `src/app/runtime/data/useOperationalDataRuntime.test.js`
- Modify: `src/App.jsx`
- Modify: `docs/superpowers/qa/spec-c-compatibility-facades.md`

**Interfaces:**

```js
useOperationalDataRuntime({
  api: { getBootstrap, getOrders },
  onUnauthorized,
  globalSyncEnabled,
  ordersSyncEnabled,
  effectiveConfigVersion,
  legacyBridges: {
    capturePaymentOwners,
    settlePaymentOwners,
    onTablesCommitted,
  },
})
```

Returns:

```js
{
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

Temporary C1 bridges are intentionally explicit and must be removed later:

- `capturePaymentOwners` / `settlePaymentOwners` → removal C6;
- `onTablesCommitted` → removal C5;
- `updateCollection` compatibility escape hatch → removal as C4-C8 move CRUD handlers.

**Behavior locked from current App:**

- collections: `clients`, `products`, `orders`, `tables`, `tableTabs`, `movements`, `financeSettings`;
- `DATA_COLLECTIONS` and `PAYMENT_COLLECTIONS` semantics unchanged;
- global bootstrap read uses `effectiveConfigVersion` only for background refresh;
- initial load sets `bootstrapState=loading` then `ready`, failed non-401 initial load → `error`;
- stale reads cannot overwrite newer mutations via `createCollectionSyncGuard`;
- table commits use the bridge before/with the same synchronous official snapshot semantics;
- captured accepted-payment owners are the owners present when a bootstrap read begins;
- order-only poll modifies only `orders` and increments official revision;
- 401 invokes `onUnauthorized`;
- only one bootstrap and one order refresh may be in flight;
- reset creates a fresh sync guard and clears official revision/tables/config snapshot.

- [ ] **Step 1: Write RED runtime tests**

Create a React hook harness and fake deferred API. Include at least these tests:

```js
test('initial bootstrap publishes the same official collections and ready state', async () => { /* assert exact collections */ })

test('a mutation after a bootstrap read starts prevents stale collection overwrite', async () => { /* begin deferred bootstrap, applyOfficialEffects({ order }), resolve old read */ })

test('bootstrap captures payment owners at read start and settles against that receipt only', async () => { /* assert bridge owner snapshot */ })

test('table snapshots invoke onTablesCommitted and remain queryable as official tables', async () => { /* assert callback + getOfficialTables */ })

test('order refresh updates only orders and rejects stale/unauthorized results', async () => { /* assert no other collection changed */ })

test('reset clears all official collections and invalidates the previous sync guard identity', async () => { /* compare getSyncGuard before/after */ })
```

Use concrete fixtures with IDs such as `order-1`, `table-1`, `tab-1`, `client-1`, not generic placeholders.

- [ ] **Step 2: Run RED**

```bash
node --test src/app/runtime/data/useOperationalDataRuntime.test.js
```

Expected: FAIL missing runtime module.

- [ ] **Step 3: Implement runtime by moving existing App synchronization code**

Move, preserving logic:

- official collection states;
- `syncGuardRef`;
- `bootstrapSyncInFlightRef`;
- `ordersSyncInFlightRef`;
- `officialRevisionRef`;
- `officialTablesRef`;
- bootstrap effective config snapshot;
- `applyBootstrapCollections`;
- generic parts of `applyOfficialEffects`;
- `refreshBootstrap` / silent wrapper;
- order refresh function;
- reset of official sync state.

Keep `createCollectionSyncGuard`, `upsertById`, `upsertManyById`, `removeById` in `src/utils/dataSync.js` for C1; ownership cleanup occurs after domain migration.

For table application, runtime does:

```js
const commitTables = (nextTables) => {
  officialTablesRef.current = nextTables
  legacyBridges.onTablesCommitted?.(nextTables)
  setTables(nextTables)
}
```

For accepted-payment receipt bridge:

```js
const paymentOwners = legacyBridges.capturePaymentOwners?.() ?? []
// after receipt is constructed
legacyBridges.settlePaymentOwners?.(paymentOwners, receipt)
```

Do not move `settleAcceptedPayment` itself.

- [ ] **Step 4: Add runtime-owned polling effects**

Inside the hook, preserve existing trigger semantics:

- when `globalSyncEnabled`, immediately call silent refresh, then every 5000ms only while visible, plus visibility/focus refresh;
- when `ordersSyncEnabled`, immediately call order refresh, then every 2000ms only while visible, plus visibility/focus refresh;
- cleanup all timers/listeners when flags turn false/unmount.

Export interval constants for tests:

```js
export const GLOBAL_SYNC_INTERVAL_MS = 5_000
export const ORDER_SYNC_INTERVAL_MS = 2_000
```

- [ ] **Step 5: Wire App legacy bridges**

In `App.jsx`, keep payment/comanda refs and functions, but replace official collection states/sync refs/functions with runtime values.

Define bridges with `useCallback`/stable references:

```js
const capturePaymentOwners = useCallback(() => [...paymentSyncRef.current], [])
const settlePaymentOwners = useCallback((owners, receipt) => {
  owners.forEach((owner) => settleAcceptedPayment(owner, receipt))
}, [settleAcceptedPayment])
const onTablesCommitted = useCallback((nextTables) => {
  // existing comanda identity/selection reconciliation, without setTables
}, [/* existing dependencies */])
```

Avoid a render loop from unstable `legacyBridges`; memoize the bridge object.

Replace direct sync refs in App handlers with `getSyncGuard()`, `getOfficialRevision()`, `getOfficialTables()`, `applyOfficialEffects`, and `updateCollection` only where C1 must retain legacy handler code.

- [ ] **Step 6: Record all temporary bridges in facade ledger**

Add rows for:

- operational runtime → App payment-owner bridge (remove C6);
- operational runtime → App table-selection bridge (remove C5);
- `updateCollection` legacy mutation escape hatch (remove by C8/C10).

- [ ] **Step 7: Run focused runtime + sync regressions**

```bash
node --test \
  src/app/runtime/data/useOperationalDataRuntime.test.js \
  src/utils/dataSync.test.js \
  src/AppReceivablesPromise.test.js \
  src/actionCapabilities.test.js \
  src/pages/Comandas.test.js
npm run lint
```

All must PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/runtime/data src/App.jsx docs/superpowers/qa/spec-c-compatibility-facades.md
git commit -m "refactor: extract operational data runtime"
```

---

### Task 6: Extract session lifecycle after data runtime exists

**Files:**
- Create: `src/app/runtime/session/useSessionRuntime.js`
- Create: `src/app/runtime/session/useSessionRuntime.test.js`
- Modify: `src/App.jsx`

**Interfaces:**

```js
useSessionRuntime({
  api: { getSession, login, logout },
  isOnline,
  requestKey,
  setRequestKey,
  resetOperationalData,
  refreshBootstrap,
  onClearApplicationState,
})
```

Returns:

```js
{
  authState,
  sessionContext,
  sessionGeneration,
  loginError,
  handleLogin,
  handleLogout,
  expireSession,
}
```

`authState` values remain `checking | anonymous | authenticated`.

- [ ] **Step 1: Write RED session tests**

Using a hook harness, cover:

1. initialize unauthenticated → `anonymous`, bootstrap callback not called;
2. initialize authenticated → set context/generation/authenticated and await `refreshBootstrap()`;
3. login invalid PIN error code → exact `PIN inválido. Confira e tente novamente.` copy;
4. login network/API error → current fallback message;
5. logout calls API, clears application state, resets operational data, returns anonymous;
6. `expireSession()` clears state and sets exact `Sua sessão expirou. Entre novamente.` message;
7. login/logout refuse to start when offline or request key is already occupied, matching current guards.

- [ ] **Step 2: Run RED**

```bash
node --test src/app/runtime/session/useSessionRuntime.test.js
```

Expected: FAIL missing module.

- [ ] **Step 3: Implement by moving current session effects/handlers**

Move from `App.jsx`:

- `authState`;
- `sessionKey` → rename return to `sessionGeneration` but App local alias may remain `sessionKey` for compatibility;
- `sessionContext`;
- `loginError`;
- initial `getSession` effect;
- `handleLogin`;
- `handleLogout`;
- `expireSession`.

Preserve sequence:

```text
auth confirmed
→ operational reset/context reset as current flow requires
→ authenticated state/context/generation
→ await refreshBootstrap
```

and on clear/logout/expiry call `onClearApplicationState` for still-App-owned navigation/forms/dialogs.

Do not move domain forms/dialogs into session runtime.

- [ ] **Step 4: Keep capabilities calculation behavior identical**

`App.jsx` may continue computing `granted` from `sessionContext`, `authState`, and optional test `capabilities` prop in C1. Do not move `legacyCapabilities`/capability decisions yet.

- [ ] **Step 5: Run session and App guard regressions**

```bash
node --test \
  src/app/runtime/session/useSessionRuntime.test.js \
  src/AppNewOrderGuard.test.js \
  src/AppReceivablesPromise.test.js \
  src/actionCapabilities.test.js \
  src/app/effectiveBusinessConfig.test.js
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/app/runtime/session src/App.jsx
git commit -m "refactor: extract session runtime"
```

---

### Task 7: Finish App integration without crossing into later domains

**Files:**
- Modify: `src/App.jsx`
- Test existing App/page/runtime suites only; no CSS move.

**Interfaces:**
- App continues exporting default `App` and supports existing optional `{ capabilities }` test prop.
- Existing pages receive the same props/callback semantics as before C1.

- [ ] **Step 1: Diff App responsibilities before changing more**

Confirm C1 App still owns intentionally deferred logic:

- navigation/query composition;
- settings composition;
- payment/comanda owner/reconcile workflows;
- client/product/finance/table CRUD handlers;
- kitchen sound/arrival UI behavior;
- printing prompts/recovery UI behavior;
- page/modal rendering.

If any of those were accidentally moved into runtime, move them back before proceeding.

- [ ] **Step 2: Remove duplicate dead state/effects/imports left by extraction**

Remove only now-unused:

- generic HTTP/auth imports moved to infrastructure;
- online state/listener code;
- feedback states/timers;
- official collection state/sync refs/functions now owned by data runtime;
- session state/effect/handlers now owned by session runtime.

Do not change copy, CSS imports, page props, order of visible overlays/modals, or `IMPLEMENTED_DESTINATIONS`.

- [ ] **Step 3: Add a structural characterization test for C1 boundary**

Create or extend an architecture-focused test that reads `src/App.jsx` and asserts it no longer contains these implementation tokens:

```text
getSessionApi(
getBootstrapApi(
getOrdersApi(
window.addEventListener('online'
syncGuardRef = useRef(
bootstrapSyncInFlightRef
```

The test must not assert line counts. It should assert removal of the responsibilities C1 explicitly extracted.

A suitable path is `src/app/runtime/runtimeExtractionContract.test.js`.

- [ ] **Step 4: Run the extraction contract RED before final App cleanup if tokens remain, then GREEN after cleanup**

```bash
node --test src/app/runtime/runtimeExtractionContract.test.js
```

Expected before cleanup: FAIL for any still-owned C1 token.

Expected after cleanup: PASS.

- [ ] **Step 5: Run broad frontend regression set**

```bash
node --test \
  src/app/runtime/**/*.test.js \
  src/AppNewOrderGuard.test.js \
  src/AppReceivablesPromise.test.js \
  src/actionCapabilities.test.js \
  src/app/*.test.js \
  src/pages/Comandas.test.js \
  src/hooks/useKitchenClock.test.js
```

If the shell does not expand `**` in the execution environment, enumerate the runtime test files explicitly rather than changing the test intent.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/app/runtime/runtimeExtractionContract.test.js
git commit -m "refactor: complete c1 runtime integration"
```

---

### Task 8: Full C1 gates, diff review, staging, and QA ledger

**Files:**
- Create: `docs/superpowers/qa/2026-09-15-spec-c1-runtime-qa.md`
- Modify if needed: `docs/superpowers/qa/spec-c-compatibility-facades.md`

**Interfaces:** none; this task verifies the slice.

- [ ] **Step 1: Run full local gates**

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
```

Expected: all exit `0`.

- [ ] **Step 2: Perform diff safety review against C1 base**

Run:

```bash
git diff --stat <C1_BASE_SHA>...HEAD
git diff <C1_BASE_SHA>...HEAD -- src/App.jsx src/app/runtime src/infrastructure src/api/client.js package.json .github/workflows
```

Replace `<C1_BASE_SHA>` with the actual SHA recorded when the C1 branch/worktree is created; do not guess it.

Review specifically for accidental changes to:

- messages/copy;
- `GLOBAL_SYNC_INTERVAL_MS` / `ORDER_SYNC_INTERVAL_MS`;
- endpoint strings;
- headers/payloads;
- session capability validation;
- 401/409 behavior;
- collection names;
- request blocking conditions;
- page props;
- CSS imports.

No unrelated feature/polish belongs in this diff.

- [ ] **Step 3: Push branch and require PR validation**

Open PR from `feature/spec-c1-runtime` to `master`. Require Validate application success including new architecture gate, Worker dry-runs, local D1 and Spec B D1 gate.

- [ ] **Step 4: Manually deploy the exact C1 branch to staging**

Use GitHub Actions → `Deploy staging` → Run workflow → choose `feature/spec-c1-runtime`.

Require success for:

- tests;
- architecture gate;
- lint;
- build;
- local D1 migrations;
- staging Worker dry-run;
- remote staging migrations;
- staging deploy;
- real staging login smoke.

- [ ] **Step 5: Perform C1 manual homologation matrix**

Record PASS/FAIL for:

1. initial authenticated session reload loads the system normally;
2. anonymous session shows Login;
3. invalid PIN keeps exact current error behavior;
4. successful login reaches the same default destination after bootstrap;
5. logout clears business data and returns to Login;
6. session expiry/401 returns to Login with current expiry copy;
7. offline banner and write blocking remain equivalent;
8. reconnect refreshes official data;
9. Cozinha receives order updates while active at current cadence/behavior;
10. switching away from Cozinha stops order-only polling while global sync remains correct;
11. basic Clients/Products/Finance/Comandas data render after bootstrap;
12. existing payment/comanda flow still settles/reconciles correctly in a representative staging payment test;
13. Settings effective config still loads and current draft/save behavior is unchanged;
14. no visible desktop/mobile/light/dark regression attributable to runtime extraction.

C1 does not require a full physical printing matrix, but open Cozinha/Fila de impressão and confirm the existing printing manager initializes without new runtime errors. Physical printing is not changed in C1.

- [ ] **Step 6: Write QA ledger with real evidence**

Create `docs/superpowers/qa/2026-09-15-spec-c1-runtime-qa.md` containing:

- C1 branch;
- base SHA;
- final SHA;
- PR number;
- Validate workflow run ID/result;
- staging workflow run ID/result;
- each manual matrix result;
- compatibility bridges still open and removal slices;
- explicit statement that no production deploy occurred.

Do not invent IDs or PASS results before they exist.

- [ ] **Step 7: Final verification commit if QA docs were added after code SHA**

If the QA ledger is committed after homologation, verify it is docs-only with a compare/diff and rerun required validation for that documentation commit. It does not require a second staging deploy if no executable file changed.

Commit message:

```bash
git add docs/superpowers/qa
git commit -m "docs: record spec c1 runtime qa"
```

---

## C1 acceptance checklist

C1 is ready for merge only if all are true:

- generic HTTP/auth behavior moved without API contract change;
- `App.jsx` no longer owns online/offline listeners;
- `App.jsx` no longer owns feedback auto-dismiss timers;
- official collection/bootstrap/order-sync mechanics live in operational runtime;
- session initialize/login/logout/expiry live in session runtime;
- payment/table selection logic remains behaviorally in App via documented temporary bridges;
- architecture gate is permanent in validate + staging workflows;
- no React Router/state library/CSS redesign/domain CRUD migration was introduced;
- full tests/lint/architecture/build/local D1 pass;
- PR validation passes;
- exact C1 branch staging deploy passes;
- C1 manual matrix is homologated;
- facade ledger records every temporary compatibility bridge;
- production was not deployed.

After C1 merge, do not start C2 from this branch. Update `master`, create a fresh worktree/branch, refresh dependencies, and write/approve the C2 detailed plan from that new base.