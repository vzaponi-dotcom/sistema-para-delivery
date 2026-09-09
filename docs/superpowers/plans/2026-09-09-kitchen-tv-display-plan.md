# Kitchen TV Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight, read-only Kitchen TV surface that reuses the current Cozinha operational rules, pairs once without the normal PIN, and displays only active kitchen-safe order data.

**Architecture:** Keep one project/deploy, but split `/cozinha-tv` into a dedicated lazy-loaded frontend entry that does not bootstrap the administrative app. Add a restricted TV pairing/session boundary and a minimal active-only API in the Worker; keep the normal Cozinha as the only interactive operational surface and share only the small queue/timing logic needed by both UIs.

**Tech Stack:** React 19, Vite 8, Cloudflare Worker, Cloudflare D1/SQLite migrations, Web Crypto, Web Audio/Fullscreen browser APIs, Node `node:test`, `node:sqlite`, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-09-kitchen-tv-display-design.md`

## Global Constraints

- **Execution gate:** do not start Task 1 until the centralized QZ print-queue work is finished and homologated on its feature/staging path.
- At execution time, use `superpowers:using-git-worktrees` to create a fresh isolated worktree; do not implement inside an old dirty/diverged worktree.
- Before Task 1, update this feature on top of the **final remote HEAD that contains the completed centralized print queue**. The expected source is `origin/feature/centralized-qz-print-queue`; if that work has moved to the project's staging integration branch, use that final remote integration HEAD instead.
- Preserve the approved spec and this plan while rebasing; create the implementation branch from the rebased design branch, e.g. `feature/kitchen-tv-display`.
- Current migrations on the design base end at `0018_second_copy_decisions.sql`; Task 2 therefore uses `0019_kitchen_tv_access.sql`. If the completed print-queue work adds another migration before execution, renumber the Kitchen TV migration to the next sequential number before writing it, without changing its contents/semantics.
- Run baseline verification before the first RED test: `npm test`, `npm run lint`, and `npm run build`. If baseline is not green after rebasing onto the final print-queue HEAD, stop and fix/resolve the base before Kitchen TV changes.
- Strict TDD: write a focused failing test first for every behavior change, run it and observe RED, implement the minimum code, run GREEN, then run the nearest regression set.
- One TV only in v1. Do not introduce device lists, names, per-device configuration, or generalized multi-TV abstractions.
- TV is read-only. No finalize, cancel, print, edit, create, payment, finance, or administrative action may be callable from the TV session.
- TV mode must not call `/api/bootstrap` and must not load the administrative application tree before rendering.
- TV state must be active-only and whitelisted: no phone, address, prices, payment, finance, refunds, printing/QZ, product catalog, or completed history.
- Keep the existing 50-minute scheduled-preparation rule and current Cozinha ordering/late/arrival semantics unchanged.
- No `Novos` status/column; newly operational orders are normal `Em preparo` orders with temporary visual/audio feedback.
- Polling remains approximately 2 seconds; do not add WebSocket/SSE.
- TV theme is fixed dark/high-contrast and independent of the administrative theme.
- Visible capacity target is 4 `Em preparo` + 3 `Agendados`; no pagination or carousel. Overflow is indicated and the next queued order fills a released slot automatically.
- No production deploy. Final deployment steps in this plan target staging only for homologation.

---

## File Structure Locked by This Plan

### Shared operational selection

- Create `src/utils/kitchenOperationalQueue.js` — pure queue/timing classification used by both normal Cozinha and TV.
- Create `src/utils/kitchenOperationalQueue.test.js` — boundary/order/late regression coverage.
- Modify `src/utils/kitchenQueue.js` — keep search + finished-today concerns here, delegating the operational queues to the new pure module.
- Keep `src/utils/orderRealtime.js` and `shared/orderTiming.js` as existing sources of truth; do not fork them.

### Worker / D1

- Create `migrations/0019_kitchen_tv_access.sql` — one Kitchen TV access row per business; renumber only if the final print-queue base has moved beyond `0018`.
- Create `worker/kitchenTvAccessMigration.test.js` — schema/migration constraints.
- Create `worker/kitchenTvAccessRepository.js` — single-record pairing/session persistence.
- Create `worker/kitchenTvAccessRepository.test.js` — repository lifecycle tests.
- Create `worker/opaqueToken.js` — cryptographically secure opaque token generation + SHA-256 hashing shared by admin session token creation and TV credentials.
- Modify `worker/auth.js` — use `opaqueToken.js` for normal session opaque tokens without changing PIN/session behavior.
- Create `worker/kitchenTvAuth.js` — dedicated TV cookie, pairing generation/consumption, session validation, status mapping, revoke/regenerate semantics.
- Create `worker/kitchenTvAuth.test.js` — one-time pairing, cookie, persistence, separation from admin auth.
- Create `worker/kitchenTvStateRepository.js` — active-only whitelisted order/item query.
- Create `worker/kitchenTvStateRepository.test.js` — no-sensitive-data and active-only contract tests.
- Create `worker/kitchenTvApi.js` — public TV `pair/state` handlers and admin-authenticated TV settings handlers.
- Create `worker/kitchenTvApi.test.js` — HTTP/authorization contract.
- Modify `worker/index.js` — minimal route dispatch only.

### Administrative Configurações

- Modify `src/api/client.js` — authenticated Kitchen TV settings/access/revoke calls only.
- Create `src/pages/Settings.jsx` — monodispositivo `Configurações > TV da Cozinha` UI.
- Create `src/pages/Settings.test.js` — settings state/action behavior using the existing Vite JSX transform test style.
- Create `src/kitchen-tv-settings.css` — settings-only admin styles.
- Modify `src/App.jsx` — import/render `Settings` only; do not move TV runtime state into `App`.
- Modify `src/components/Sidebar.jsx` — add Configurações entry.
- Modify `src/components/MobileNavigation.jsx` — add Configurações under `Mais` and include it in `moreActive`.

### Lightweight TV frontend

- Create `src/AdminRoot.jsx` — move current admin-only CSS/theme/App imports out of `main.jsx`.
- Create `src/appEntryMode.js` — pure pathname-to-entry decision.
- Create `src/appEntryMode.test.js` — route selection.
- Create `src/mainKitchenTvEntry.test.js` — guard that `main.jsx` uses dynamic imports and does not statically import the admin tree.
- Modify `src/main.jsx` — minimal dynamic loader for admin vs TV.
- Create `src/tv/KitchenTvRoot.jsx` — TV-only root importing TV-only CSS.
- Create `src/tv/KitchenTvApp.jsx` — pairing/start/poll/offline/unauthorized/audio/fullscreen lifecycle.
- Create `src/tv/KitchenTvApp.test.js` — lifecycle tests.
- Create `src/tv/kitchenTvApi.js` — TV-only network client; must not import `src/api/client.js`.
- Create `src/tv/kitchenTvAudio.js` — small Web Audio unlock/play helper.
- Create `src/tv/kitchenTvPresentation.js` — pure 4+3 visible-capacity/overflow selector.
- Create `src/tv/kitchenTvPresentation.test.js` — capacity/ordering tests.
- Create `src/tv/KitchenTvBoard.jsx` — board/header/sections/stale banner.
- Create `src/tv/KitchenTvOrderCard.jsx` — customer-first cards for preparing/scheduled.
- Create `src/tv/KitchenTvBoard.test.js` — semantic/source/UI contract guards.
- Create `src/tv/kitchen-tv.css` — fixed dark 16:9 layout and lightweight CSS-only arrival emphasis.

---

### Task 1: Extract the lightweight shared operational queue model

**Files:**
- Create: `src/utils/kitchenOperationalQueue.js`
- Create: `src/utils/kitchenOperationalQueue.test.js`
- Modify: `src/utils/kitchenQueue.js`
- Test: `src/utils/kitchenQueue.test.js`

**Interfaces:**
- Consumes: `isScheduledWaiting(order, now)`, `getOperationalStartAt(order)` from `shared/orderTiming.js`; `isOrderActive(order)` from `src/utils/orderLifecycle.js`; `getOrderTimingState(order, now)` from `src/utils/orderWorkflow.js`.
- Produces: `buildKitchenOperationalQueue(orders = [], now = new Date()) -> { allActive, preparing, scheduled, counts }` where every entry is `{ order, phase, operationalStartAt, timingState, isLate }` and `counts` is `{ preparing, scheduled, late }`.
- `src/utils/kitchenQueue.js` remains the search-aware wrapper and continues returning `finishedToday` and `totalVisible` for the current Cozinha UI.

- [ ] **Step 1: Write the failing core tests**

Create `src/utils/kitchenOperationalQueue.test.js` with focused tests that duplicate the current semantics before moving code:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKitchenOperationalQueue } from './kitchenOperationalQueue.js'

const ids = (entries) => entries.map(({ order }) => order.id)

test('scheduled order crosses from scheduled to preparing at the existing 50-minute boundary', () => {
  const order = {
    id: 'scheduled-1', status: 'Em preparo', type: 'Entrega',
    createdAt: '2026-09-04T08:00:00.000Z',
    scheduledFor: '2026-09-04T15:00:00.000Z',
  }
  assert.deepEqual(ids(buildKitchenOperationalQueue([order], new Date('2026-09-04T14:09:59.999Z')).scheduled), ['scheduled-1'])
  assert.deepEqual(ids(buildKitchenOperationalQueue([order], new Date('2026-09-04T14:10:00.000Z')).preparing), ['scheduled-1'])
})

test('operational queues preserve current sorting and exclude terminal orders', () => {
  const orders = [
    { id: 'prep-b', status: 'Em preparo', type: 'Local', createdAt: '2026-09-04T09:00:00.000Z' },
    { id: 'prep-a', status: 'Em preparo', type: 'Local', createdAt: '2026-09-04T09:00:00.000Z' },
    { id: 'scheduled-b', status: 'Em preparo', type: 'Entrega', createdAt: '2026-09-04T08:00:00.000Z', scheduledFor: '2026-09-04T16:30:00.000Z' },
    { id: 'scheduled-a', status: 'Em preparo', type: 'Entrega', createdAt: '2026-09-04T08:00:00.000Z', scheduledFor: '2026-09-04T16:00:00.000Z' },
    { id: 'done', status: 'Finalizado', type: 'Local', createdAt: '2026-09-04T08:00:00.000Z' },
    { id: 'cancelled', status: 'Cancelado', type: 'Local', createdAt: '2026-09-04T08:00:00.000Z' },
  ]
  const model = buildKitchenOperationalQueue(orders, new Date('2026-09-04T11:00:00.000Z'))
  assert.deepEqual(ids(model.preparing), ['prep-a', 'prep-b'])
  assert.deepEqual(ids(model.scheduled), ['scheduled-a', 'scheduled-b'])
  assert.equal(model.allActive.length, 4)
})
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test src/utils/kitchenOperationalQueue.test.js
```

Expected: FAIL because `src/utils/kitchenOperationalQueue.js` does not exist.

- [ ] **Step 3: Implement the pure operational selector**

Create `src/utils/kitchenOperationalQueue.js` with the logic currently embedded in `kitchenQueue.js`:

```js
import { getOperationalStartAt, isScheduledWaiting } from '../../shared/orderTiming.js'
import { isOrderActive } from './orderLifecycle.js'
import { getOrderTimingState } from './orderWorkflow.js'

const compareIds = (first, second) => String(first.order.id).localeCompare(String(second.order.id), 'pt-BR')
const timestamp = (value) => value instanceof Date && !Number.isNaN(value.getTime()) ? value.getTime() : Number.POSITIVE_INFINITY
const compareOperationalStart = (first, second) => timestamp(first.operationalStartAt) - timestamp(second.operationalStartAt) || compareIds(first, second)
const compareScheduledFor = (first, second) => timestamp(new Date(first.order.scheduledFor)) - timestamp(new Date(second.order.scheduledFor)) || compareIds(first, second)

export const buildKitchenOperationalQueue = (orders = [], now = new Date()) => {
  const allActive = orders.filter(isOrderActive).map((order) => {
    const phase = isScheduledWaiting(order, now) ? 'scheduled' : 'preparing'
    const timingState = getOrderTimingState(order, now)
    return {
      order,
      phase,
      operationalStartAt: getOperationalStartAt(order),
      timingState,
      isLate: timingState !== 'on-time',
    }
  })
  const preparing = allActive.filter(({ phase }) => phase === 'preparing').sort(compareOperationalStart)
  const scheduled = allActive.filter(({ phase }) => phase === 'scheduled').sort(compareScheduledFor)
  return {
    allActive,
    preparing,
    scheduled,
    counts: {
      preparing: preparing.length,
      scheduled: scheduled.length,
      late: allActive.filter(({ isLate }) => isLate).length,
    },
  }
}
```

- [ ] **Step 4: Refactor `kitchenQueue.js` to delegate without changing its public contract**

Replace only the operational classification/sorting block. Keep search normalization and `finishedToday` in the wrapper:

```js
const operational = buildKitchenOperationalQueue(orders, now)
const preparing = operational.preparing.filter(({ order }) => matchesKitchenSearch(order, normalizedSearch))
const scheduled = operational.scheduled.filter(({ order }) => matchesKitchenSearch(order, normalizedSearch))

return {
  ...operational,
  preparing,
  scheduled,
  totalVisible: preparing.length + scheduled.length,
  counts: {
    ...operational.counts,
    finishedToday: orders.filter((order) => order.status === 'Finalizado' && isFinishedToday(order, now)).length,
  },
}
```

Delete the now-duplicated sort/classification helpers from `kitchenQueue.js` and import `buildKitchenOperationalQueue`.

- [ ] **Step 5: Run core + existing Cozinha queue tests**

```bash
node --test src/utils/kitchenOperationalQueue.test.js src/utils/kitchenQueue.test.js src/utils/orderRealtime.test.js
```

Expected: PASS. Existing queue ordering/count/search behavior must be unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/utils/kitchenOperationalQueue.js src/utils/kitchenOperationalQueue.test.js src/utils/kitchenQueue.js src/utils/kitchenQueue.test.js
git commit -m "refactor: share kitchen operational queue model"
```

---

### Task 2: Add the single-TV D1 access record and repository

**Files:**
- Create: `migrations/0019_kitchen_tv_access.sql` (renumber only if required by the execution-base migration sequence)
- Create: `worker/kitchenTvAccessMigration.test.js`
- Create: `worker/kitchenTvAccessRepository.js`
- Create: `worker/kitchenTvAccessRepository.test.js`

**Interfaces:**
- Produces `loadKitchenTvAccess(db, businessId)`.
- Produces `issueKitchenTvAccess(db, businessId, pairingTokenHash, now)`; issuing/regenerating clears prior session/pairing timestamps and revocation.
- Produces `activateKitchenTvSession(db, businessId, pairingTokenHash, sessionTokenHash, now) -> boolean`; atomic one-time consume of the pairing hash.
- Produces `loadKitchenTvSessionByHash(db, sessionTokenHash)`.
- Produces `touchKitchenTvSession(db, businessId, now)`.
- Produces `revokeKitchenTvAccess(db, businessId, now)`; clears both hashes and sets `revoked_at`.

- [ ] **Step 1: Write the migration RED test**

Create `worker/kitchenTvAccessMigration.test.js` using the existing `node:sqlite` migration style:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'

const migrationsUrl = new URL('../migrations/', import.meta.url)
const applyAll = async (db) => {
  const files = (await readdir(migrationsUrl)).filter((file) => file.endsWith('.sql')).sort()
  for (const file of files) db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
}

test('kitchen TV migration creates one access row per business and hashed credential columns', async () => {
  const db = new DatabaseSync(':memory:')
  await applyAll(db)
  const columns = db.prepare("SELECT name FROM pragma_table_info('kitchen_tv_access') ORDER BY cid").all().map(({ name }) => name)
  assert.deepEqual(columns, [
    'business_id', 'pairing_token_hash', 'session_token_hash',
    'created_at', 'paired_at', 'last_seen_at', 'revoked_at',
  ])
  assert.equal(db.prepare("SELECT count(*) AS count FROM pragma_index_list('kitchen_tv_access')").get().count >= 2, true)
})
```

- [ ] **Step 2: Run migration test to verify RED**

```bash
node --test worker/kitchenTvAccessMigration.test.js
```

Expected: FAIL because the table does not exist.

- [ ] **Step 3: Add the migration**

Create the sequential migration with exactly one row per business:

```sql
CREATE TABLE kitchen_tv_access (
  business_id TEXT PRIMARY KEY NOT NULL,
  pairing_token_hash TEXT,
  session_token_hash TEXT,
  created_at TEXT NOT NULL,
  paired_at TEXT,
  last_seen_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX kitchen_tv_access_pairing_hash_idx
  ON kitchen_tv_access(pairing_token_hash)
  WHERE pairing_token_hash IS NOT NULL;

CREATE UNIQUE INDEX kitchen_tv_access_session_hash_idx
  ON kitchen_tv_access(session_token_hash)
  WHERE session_token_hash IS NOT NULL;
```

- [ ] **Step 4: Run migration test GREEN**

```bash
node --test worker/kitchenTvAccessMigration.test.js
```

Expected: PASS.

- [ ] **Step 5: Write repository lifecycle RED tests**

In `worker/kitchenTvAccessRepository.test.js`, use a small D1-shaped adapter over `DatabaseSync` and prove the whole single-record lifecycle:

```js
test('issuing, pairing, touching and revoking one Kitchen TV access is atomic', async () => {
  const db = await migratedD1Adapter()
  const issued = await issueKitchenTvAccess(db, 'amor-e-sabor', 'pair-hash-1', new Date('2026-09-09T12:00:00.000Z'))
  assert.equal(issued.pairing_token_hash, 'pair-hash-1')
  assert.equal(issued.session_token_hash, null)

  assert.equal(await activateKitchenTvSession(db, 'amor-e-sabor', 'pair-hash-1', 'session-hash-1', new Date('2026-09-09T12:01:00.000Z')), true)
  assert.equal(await activateKitchenTvSession(db, 'amor-e-sabor', 'pair-hash-1', 'session-hash-2', new Date('2026-09-09T12:02:00.000Z')), false)

  const session = await loadKitchenTvSessionByHash(db, 'session-hash-1')
  assert.equal(session.business_id, 'amor-e-sabor')

  await touchKitchenTvSession(db, 'amor-e-sabor', new Date('2026-09-09T12:03:00.000Z'))
  await revokeKitchenTvAccess(db, 'amor-e-sabor', new Date('2026-09-09T12:04:00.000Z'))
  assert.equal(await loadKitchenTvSessionByHash(db, 'session-hash-1'), null)
})

test('generating a new pairing invalidates the previous active TV session', async () => {
  const db = await migratedD1Adapter()
  await issueKitchenTvAccess(db, 'amor-e-sabor', 'pair-1', new Date('2026-09-09T12:00:00.000Z'))
  await activateKitchenTvSession(db, 'amor-e-sabor', 'pair-1', 'session-1', new Date('2026-09-09T12:01:00.000Z'))
  await issueKitchenTvAccess(db, 'amor-e-sabor', 'pair-2', new Date('2026-09-09T12:02:00.000Z'))
  assert.equal(await loadKitchenTvSessionByHash(db, 'session-1'), null)
})
```

- [ ] **Step 6: Run repository tests RED**

```bash
node --test worker/kitchenTvAccessRepository.test.js
```

Expected: FAIL because repository functions do not exist.

- [ ] **Step 7: Implement `kitchenTvAccessRepository.js` minimally**

Use D1 statements with an UPSERT for issue/regenerate and an atomic `UPDATE ... WHERE pairing_token_hash = ?` for one-time pairing. The key statements must have these semantics:

```js
export const issueKitchenTvAccess = async (db, businessId, pairingTokenHash, now = new Date()) => {
  const at = now.toISOString()
  await db.prepare(`
    INSERT INTO kitchen_tv_access (
      business_id, pairing_token_hash, session_token_hash, created_at,
      paired_at, last_seen_at, revoked_at
    ) VALUES (?, ?, NULL, ?, NULL, NULL, NULL)
    ON CONFLICT(business_id) DO UPDATE SET
      pairing_token_hash = excluded.pairing_token_hash,
      session_token_hash = NULL,
      paired_at = NULL,
      last_seen_at = NULL,
      revoked_at = NULL
  `).bind(businessId, pairingTokenHash, at).run()
  return loadKitchenTvAccess(db, businessId)
}

export const activateKitchenTvSession = async (db, businessId, pairingTokenHash, sessionTokenHash, now = new Date()) => {
  const at = now.toISOString()
  const result = await db.prepare(`
    UPDATE kitchen_tv_access
    SET pairing_token_hash = NULL, session_token_hash = ?, paired_at = ?, last_seen_at = ?, revoked_at = NULL
    WHERE business_id = ? AND pairing_token_hash = ? AND revoked_at IS NULL
  `).bind(sessionTokenHash, at, at, businessId, pairingTokenHash).run()
  return Number(result?.meta?.changes ?? result?.changes ?? 0) > 0
}
```

Implement the remaining load/touch/revoke functions exactly to the interfaces above; `revoke` must set both token hashes to `NULL`.

- [ ] **Step 8: Run repository + migration tests GREEN**

```bash
node --test worker/kitchenTvAccessMigration.test.js worker/kitchenTvAccessRepository.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add migrations/*_kitchen_tv_access.sql worker/kitchenTvAccessMigration.test.js worker/kitchenTvAccessRepository.js worker/kitchenTvAccessRepository.test.js
git commit -m "feat: persist kitchen tv access"
```

---

### Task 3: Add opaque-token reuse and dedicated TV pairing/session auth

**Files:**
- Create: `worker/opaqueToken.js`
- Modify: `worker/auth.js`
- Test: `worker/auth.test.js`
- Create: `worker/kitchenTvAuth.js`
- Create: `worker/kitchenTvAuth.test.js`

**Interfaces:**
- `createOpaqueToken(byteLength = 32) -> string` returns URL-safe high-entropy text.
- `hashOpaqueToken(value) -> Promise<string>` returns a 64-char SHA-256 hex digest.
- `KITCHEN_TV_SESSION_MAX_AGE = 400 * 24 * 60 * 60` seconds; requests refresh the cookie lifetime, giving effective persistence while the TV is used.
- `kitchenTvSessionCookie(token, maxAgeSeconds = KITCHEN_TV_SESSION_MAX_AGE)` and `clearKitchenTvSessionCookie()` use cookie name `amor_kitchen_tv`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/kitchen-tv`.
- `getKitchenTvSettings(env, businessId)` returns `{ status, pairedAt, lastSeenAt }` where status is `not_configured | awaiting_pairing | active | revoked`.
- `generateKitchenTvAccess(env, businessId, now) -> { pairingToken, settings }`.
- `pairKitchenTvAccess(env, businessId, pairingToken, now) -> { sessionToken, businessId } | null`.
- `getKitchenTvSession(request, env, now) -> { businessId, sessionToken } | null`.
- `revokeKitchenTvAccessSession(env, businessId, now)` delegates server-side revoke.

- [ ] **Step 1: Write opaque-token + admin-session regression tests**

Add to `worker/auth.test.js` and create a focused `worker/kitchenTvAuth.test.js` RED suite. Key assertions:

```js
test('opaque token helpers produce URL-safe random tokens and stable SHA-256 hashes', async () => {
  const token = createOpaqueToken(32)
  assert.match(token, /^[A-Za-z0-9_-]+$/)
  assert.equal((await hashOpaqueToken(token)).length, 64)
  assert.notEqual(await hashOpaqueToken(token), token)
})

test('Kitchen TV cookie is separate, long-lived and restricted to its API path', () => {
  const cookie = kitchenTvSessionCookie('tv-token')
  assert.match(cookie, /^amor_kitchen_tv=tv-token;/)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
  assert.match(cookie, /Path=\/api\/kitchen-tv/)
  assert.match(cookie, /Max-Age=34560000/)
})
```

Keep the existing `amor_session` tests unchanged.

- [ ] **Step 2: Run RED**

```bash
node --test worker/auth.test.js worker/kitchenTvAuth.test.js
```

Expected: FAIL because `opaqueToken.js` and `kitchenTvAuth.js` do not exist.

- [ ] **Step 3: Implement `worker/opaqueToken.js` and switch normal session token creation to it**

Use Web Crypto only:

```js
const encoder = new TextEncoder()
const bytesToBase64Url = (bytes) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
const bytesToHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

export const createOpaqueToken = (byteLength = 32) => bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
export const hashOpaqueToken = async (value) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value)))
  return bytesToHex(new Uint8Array(digest))
}
```

In `worker/auth.js`, replace only the local session random-token/SHA helpers with imports from `opaqueToken.js`. Do not alter PBKDF2 PIN hashing, session expiry, cookie name, or admin authorization behavior.

- [ ] **Step 4: Implement dedicated `worker/kitchenTvAuth.js`**

Use the Task 2 repository. Required one-time pairing core:

```js
export const generateKitchenTvAccess = async (env, businessId, now = new Date()) => {
  const pairingToken = createOpaqueToken()
  await issueKitchenTvAccess(env.DB, businessId, await hashOpaqueToken(pairingToken), now)
  return { pairingToken, settings: await getKitchenTvSettings(env, businessId) }
}

export const pairKitchenTvAccess = async (env, businessId, pairingToken, now = new Date()) => {
  if (typeof pairingToken !== 'string' || !pairingToken) return null
  const pairingHash = await hashOpaqueToken(pairingToken)
  const sessionToken = createOpaqueToken()
  const sessionHash = await hashOpaqueToken(sessionToken)
  const activated = await activateKitchenTvSession(env.DB, businessId, pairingHash, sessionHash, now)
  return activated ? { businessId, sessionToken } : null
}
```

`getKitchenTvSession()` must parse only `amor_kitchen_tv`, hash it, load the active row by session hash, touch `last_seen_at`, and return the original cookie token only so the state endpoint can refresh its cookie lifetime. It must not read or accept `amor_session`.

- [ ] **Step 5: Add one-time pairing and revoke tests**

Prove:

```js
const generated = await generateKitchenTvAccess(env, 'amor-e-sabor', now)
assert.notEqual(dbRow.pairing_token_hash, generated.pairingToken)
const first = await pairKitchenTvAccess(env, 'amor-e-sabor', generated.pairingToken, oneMinuteLater)
assert.ok(first)
assert.equal(await pairKitchenTvAccess(env, 'amor-e-sabor', generated.pairingToken, twoMinutesLater), null)
```

Also prove regenerate invalidates an active session and `getKitchenTvSession` returns `null` after revoke.

- [ ] **Step 6: Run auth suites GREEN**

```bash
node --test worker/auth.test.js worker/kitchenTvAuth.test.js worker/kitchenTvAccessRepository.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/opaqueToken.js worker/auth.js worker/auth.test.js worker/kitchenTvAuth.js worker/kitchenTvAuth.test.js
git commit -m "feat: add restricted kitchen tv auth"
```

---

### Task 4: Add the active-only whitelisted Kitchen TV state repository

**Files:**
- Create: `worker/kitchenTvStateRepository.js`
- Create: `worker/kitchenTvStateRepository.test.js`

**Interfaces:**
- Produces `listKitchenTvOrders(db, businessId) -> Promise<Array<KitchenTvOrder>>`.
- `KitchenTvOrder` exact shape:

```js
{
  id: string,
  orderNumber: number,
  client: string,
  type: 'Entrega' | 'Retirada' | 'Local' | string,
  status: string,
  createdAt: string,
  scheduledFor: string | null,
  tableIdentifier: string | null,
  items: Array<{ name: string, quantity: number, note: string }>,
}
```

- No full-order mapper from `repositories.js`; whitelist in this repository.

- [ ] **Step 1: Write RED contract tests**

Create a fake DB that captures SQL and returns rows containing extra sensitive fields to prove the mapper ignores them:

```js
test('TV state returns only active kitchen-safe fields', async () => {
  const db = fakeDb({
    orders: [{
      id: 'o1', order_number: 1842, client_id: 'c1', client_name_snapshot: 'Mariana Silva',
      customer_identity_type: 'registered_client', table_identifier: null,
      type: 'Entrega', status: 'Em preparo', created_at: '2026-09-09T12:00:00.000Z', scheduled_for: null,
      client_phone_snapshot: 'secret', client_address_snapshot: 'secret', total_cents: 9999,
    }],
    items: [{ order_id: 'o1', name_snapshot: 'Marmita M', quantity: 2, note: 'Sem cebola', unit_price_cents: 5000 }],
  })
  assert.deepEqual(await listKitchenTvOrders(db, 'amor-e-sabor'), [{
    id: 'o1', orderNumber: 1842, client: 'Mariana Silva', type: 'Entrega', status: 'Em preparo',
    createdAt: '2026-09-09T12:00:00.000Z', scheduledFor: null, tableIdentifier: null,
    items: [{ name: 'Marmita M', quantity: 2, note: 'Sem cebola' }],
  }])
  assert.doesNotMatch(db.orderSql, /client_phone|client_address|total_cents|payment|refund/i)
  assert.doesNotMatch(db.itemSql, /unit_price|catalog_price|price_reason/i)
})
```

Add a table/local-name test matching the current `mapOrderRow` convention: `Mesa 03 · João` when a table order has both table identifier and client snapshot; otherwise the table identifier alone.

- [ ] **Step 2: Run RED**

```bash
node --test worker/kitchenTvStateRepository.test.js
```

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement the active-only queries**

Use two small queries. The order query must not select sensitive columns:

```sql
SELECT
  o.id, o.order_number, o.client_id, o.client_name_snapshot,
  o.customer_identity_type, o.type, o.status, o.created_at, o.scheduled_for,
  tt.table_identifier AS table_identifier
FROM orders o
LEFT JOIN table_tabs tt ON tt.id = o.table_tab_id AND tt.business_id = o.business_id
WHERE o.business_id = ?
  AND o.status NOT IN ('Finalizado', 'Cancelado')
ORDER BY o.created_at ASC
```

Item query must also be active-only:

```sql
SELECT oi.order_id, oi.name_snapshot, oi.quantity, oi.note, oi.created_at
FROM order_items oi
JOIN orders o ON o.id = oi.order_id AND o.business_id = oi.business_id
WHERE oi.business_id = ?
  AND o.status NOT IN ('Finalizado', 'Cancelado')
ORDER BY oi.created_at ASC
```

Map only the documented `KitchenTvOrder` keys.

- [ ] **Step 4: Run GREEN**

```bash
node --test worker/kitchenTvStateRepository.test.js
```

Expected: PASS.

- [ ] **Step 5: Run current order-read regressions**

```bash
node --test worker/orderRepositories.test.js worker/orderIdentityRepositoryMapping.test.js worker/multiItemCheckoutRepository.test.js
```

Expected: PASS; this task must not modify the normal order repository.

- [ ] **Step 6: Commit**

```bash
git add worker/kitchenTvStateRepository.js worker/kitchenTvStateRepository.test.js
git commit -m "feat: add minimal kitchen tv state query"
```

---

### Task 5: Add TV API handlers and preserve the admin authorization boundary

**Files:**
- Create: `worker/kitchenTvApi.js`
- Create: `worker/kitchenTvApi.test.js`
- Modify: `worker/index.js`

**Interfaces:**
- Public TV handler: `handleKitchenTvPublicApi(request, env, url) -> Response | null` handles only:
  - `POST /api/kitchen-tv/pair`
  - `GET /api/kitchen-tv/state`
- Admin handler: `handleKitchenTvAdminApi(request, env, session, url) -> Response | null` handles only:
  - `GET /api/kitchen-tv/settings`
  - `POST /api/kitchen-tv/access`
  - `POST /api/kitchen-tv/revoke`
- Admin routes are reachable only after `getAuthenticatedSession()` succeeds in `authenticatedApi()`.
- TV session never satisfies admin authentication.
- Response contracts:

```js
// GET settings
{ settings: { status, pairedAt, lastSeenAt } }

// POST access
{ settings, pairingToken }

// POST pair
{ paired: true }

// GET state
{ orders: KitchenTvOrder[] }
```

- [ ] **Step 1: Write HTTP RED tests**

Cover the security boundary first:

```js
test('TV state requires the TV cookie, not the admin cookie', async () => {
  const adminOnly = new Request('https://delivery.example/api/kitchen-tv/state', {
    headers: { cookie: 'amor_session=admin-token' },
  })
  const response = await handleRequest(adminOnly, env)
  assert.equal(response.status, 401)
})

test('TV cookie cannot access admin Kitchen TV settings', async () => {
  const tvOnly = new Request('https://delivery.example/api/kitchen-tv/settings', {
    headers: { cookie: 'amor_kitchen_tv=tv-token' },
  })
  const response = await handleRequest(tvOnly, env)
  assert.equal(response.status, 401)
})
```

Also test successful admin access generation, one-time pair, state read, revoke, and state failure after revoke.

- [ ] **Step 2: Run RED**

```bash
node --test worker/kitchenTvApi.test.js
```

Expected: FAIL because routes/handlers are absent.

- [ ] **Step 3: Implement `worker/kitchenTvApi.js`**

Public pairing must be same-origin and may reuse the existing limiter binding when present:

```js
const BUSINESS_ID = 'amor-e-sabor'
const PAIR_RATE_LIMIT_KEY = 'amor-e-sabor:kitchen-tv-pair'

const assertPairAllowed = async (env) => {
  if (!env.LOGIN_RATE_LIMITER?.limit) return
  const { success } = await env.LOGIN_RATE_LIMITER.limit({ key: PAIR_RATE_LIMIT_KEY })
  if (!success) throw apiError(429, 'KITCHEN_TV_PAIR_RATE_LIMITED', 'Muitas tentativas de configuração. Aguarde um minuto e tente novamente.')
}
```

For `POST /pair`: call `assertSameOriginMutation`, read `{ token }`, pair through Task 3, return generic `401 KITCHEN_TV_PAIRING_INVALID` for invalid/used secrets, and set `kitchenTvSessionCookie(sessionToken)`.

For `GET /state`: call only `getKitchenTvSession`; on missing/revoked TV session return `401 KITCHEN_TV_UNAUTHORIZED`; otherwise return `listKitchenTvOrders(...)` and refresh the same TV cookie via `Set-Cookie`. Add `Cache-Control: no-store`.

Admin `POST access/revoke` must call `assertSameOriginMutation`.

- [ ] **Step 4: Integrate minimal dispatch in `worker/index.js`**

Import the two handlers. In `authenticatedApi`, after obtaining the normal admin session and creating `url`, dispatch admin TV routes before printing/general routes:

```js
const kitchenTvAdminResponse = await handleKitchenTvAdminApi(request, env, session, url)
if (kitchenTvAdminResponse) return kitchenTvAdminResponse
```

In `handleRequest`, before the generic `if (url.pathname.startsWith('/api/')) return authenticatedApi(...)`, dispatch the public TV handler:

```js
const kitchenTvPublicResponse = await handleKitchenTvPublicApi(request, env, url)
if (kitchenTvPublicResponse) return kitchenTvPublicResponse
```

Do not special-case TV cookies in `getAuthenticatedSession()`.

- [ ] **Step 5: Run API + auth GREEN**

```bash
node --test worker/kitchenTvApi.test.js worker/kitchenTvAuth.test.js worker/auth.test.js
```

Expected: PASS.

- [ ] **Step 6: Run printing route regressions because `worker/index.js` is shared**

```bash
node --test worker/orderPrintingHttp.test.js worker/orderPrintingPriorityHttp.test.js worker/orderPrintingReprintHttp.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/kitchenTvApi.js worker/kitchenTvApi.test.js worker/index.js
git commit -m "feat: expose restricted kitchen tv api"
```

---

### Task 6: Add minimal `Configurações > TV da Cozinha`

**Files:**
- Modify: `src/api/client.js`
- Create: `src/pages/Settings.jsx`
- Create: `src/pages/Settings.test.js`
- Create: `src/kitchen-tv-settings.css`
- Modify: `src/App.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/components/MobileNavigation.jsx`

**Interfaces:**
- Admin client exports:
  - `getKitchenTvSettings()` -> `GET /api/kitchen-tv/settings`
  - `generateKitchenTvAccess()` -> `POST /api/kitchen-tv/access`
  - `revokeKitchenTvAccess()` -> `POST /api/kitchen-tv/revoke`
- `Settings` owns its own loading/action state; `App.jsx` only renders it for `activeTab === 'settings'`.
- Pairing URL is built client-side as `${window.location.origin}/cozinha-tv?token=${encodeURIComponent(pairingToken)}`; the server does not need to know the public host.

- [ ] **Step 1: Add failing admin-client and UI tests**

Use the existing `transformWithOxc`/small-hook-scheduler style from `PrintingSettings.test.js`.

Key behavior tests:

```js
test('not configured state can generate and copy the one-time Kitchen TV link', async () => {
  // fake GET -> { settings: { status: 'not_configured', pairedAt: null, lastSeenAt: null } }
  // fake POST /access -> { settings: { status: 'awaiting_pairing', ... }, pairingToken: 'pair-secret' }
  // mount Settings, click "Gerar acesso da TV"
  // assert rendered text contains /cozinha-tv?token=pair-secret
  // invoke "Copiar link" and assert clipboard receives the full same-origin URL
})

test('active state shows last access and can revoke with confirmation', async () => {
  // fake GET -> active
  // open revoke confirmation and confirm
  // assert POST /api/kitchen-tv/revoke and revoked/not-configured-safe UI state
})

test('awaiting pairing after a page reload never invents or re-displays the secret', async () => {
  // GET returns status awaiting_pairing but no token
  // assert no URL is rendered and "Gerar novo acesso" is available
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/pages/Settings.test.js
```

Expected: FAIL because the page/client methods do not exist.

- [ ] **Step 3: Add the three authenticated API client functions**

Append to `src/api/client.js`:

```js
export const getKitchenTvSettings = () => apiRequest('/api/kitchen-tv/settings')
export const generateKitchenTvAccess = () => apiRequest('/api/kitchen-tv/access', { method: 'POST' })
export const revokeKitchenTvAccess = () => apiRequest('/api/kitchen-tv/revoke', { method: 'POST' })
```

- [ ] **Step 4: Implement `Settings.jsx` as one monodispositivo section**

Import `PageHeader`, `Button`, `ConfirmationDialog`, `Icon`, and the three API functions. Keep state local:

```js
const [settings, setSettings] = useState(null)
const [pairingToken, setPairingToken] = useState(null)
const [loading, setLoading] = useState(true)
const [action, setAction] = useState(null)
const [error, setError] = useState('')
const [confirmRevoke, setConfirmRevoke] = useState(false)
```

Required states:

- `not_configured` / `revoked`: explanatory text + `Gerar acesso da TV`.
- `awaiting_pairing` with `pairingToken` in component memory: show the one-time link + `Copiar link` + warning that it will not be recoverable later.
- `awaiting_pairing` after reload with no local token: explain that the secret is no longer displayable and offer `Gerar novo acesso`.
- `active`: `TV da cozinha ativa`, friendly `Último acesso`, `Gerar novo acesso`, `Revogar acesso`.

No device name, list, table, theme, or permission UI.

- [ ] **Step 5: Wire the page into admin navigation only**

In `src/App.jsx`, import `Settings` and add exactly:

```jsx
{activeTab === 'settings' && <Settings />}
```

In `Sidebar.jsx`, append:

```js
{ id: 'settings', label: 'Configurações', icon: 'settings' }
```

In `MobileNavigation.jsx`:

- include `activeTab === 'settings'` in `moreActive`;
- add a `Configurações` button in the `Mais` sheet using existing `settings` icon.

Do not add settings to the direct four mobile tabs.

- [ ] **Step 6: Run UI GREEN + navigation regressions**

```bash
node --test src/pages/Settings.test.js src/components/PrintingSettings.test.js
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/api/client.js src/pages/Settings.jsx src/pages/Settings.test.js src/kitchen-tv-settings.css src/App.jsx src/components/Sidebar.jsx src/components/MobileNavigation.jsx
git commit -m "feat: add kitchen tv settings"
```

---

### Task 7: Split the TV entry from the administrative bundle

**Files:**
- Create: `src/AdminRoot.jsx`
- Create: `src/appEntryMode.js`
- Create: `src/appEntryMode.test.js`
- Create: `src/mainKitchenTvEntry.test.js`
- Modify: `src/main.jsx`
- Create: `src/tv/KitchenTvRoot.jsx`
- Create: `src/tv/KitchenTvApp.jsx`
- Create: `src/tv/kitchen-tv.css`

**Interfaces:**
- `getAppEntryMode(pathname) -> 'tv' | 'admin'` returns `tv` only for exact `/cozinha-tv`.
- `main.jsx` statically imports only React/ReactDOM + `appEntryMode`; admin and TV roots are dynamic imports.
- `AdminRoot.jsx` owns the current admin CSS/theme initialization and wraps `App` with `ThemeProvider`.
- `KitchenTvRoot.jsx` imports only TV CSS and `KitchenTvApp`.

- [ ] **Step 1: Write route + source-architecture RED tests**

`src/appEntryMode.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getAppEntryMode } from './appEntryMode.js'

test('only the dedicated pathname selects the TV entry', () => {
  assert.equal(getAppEntryMode('/cozinha-tv'), 'tv')
  assert.equal(getAppEntryMode('/'), 'admin')
  assert.equal(getAppEntryMode('/pedidos'), 'admin')
})
```

`src/mainKitchenTvEntry.test.js` reads `main.jsx` as text and asserts:

```js
assert.doesNotMatch(mainSource, /import App from/)
assert.doesNotMatch(mainSource, /ThemeProvider/)
assert.match(mainSource, /import\('\.\/AdminRoot\.jsx'\)/)
assert.match(mainSource, /import\('\.\/tv\/KitchenTvRoot\.jsx'\)/)
```

- [ ] **Step 2: Run RED**

```bash
node --test src/appEntryMode.test.js src/mainKitchenTvEntry.test.js
```

Expected: FAIL because `appEntryMode.js`/dynamic entry do not exist.

- [ ] **Step 3: Move all current admin-root concerns into `AdminRoot.jsx`**

`AdminRoot.jsx` must contain the imports currently in `main.jsx` that the TV must not load:

```jsx
import './index.css'
import './success-feedback.css'
import './theme.css'
import './product-selection.css'
import './mobile-compact-controls.css'
import App from './App.jsx'
import { ThemeProvider } from './components/ThemeProvider.jsx'
import { initializeTheme } from './utils/theme.js'

initializeTheme()

export default function AdminRoot() {
  return <ThemeProvider><App /></ThemeProvider>
}
```

- [ ] **Step 4: Implement the minimal entry decision and dynamic loader**

`appEntryMode.js`:

```js
export const getAppEntryMode = (pathname) => pathname === '/cozinha-tv' ? 'tv' : 'admin'
```

`main.jsx` becomes conceptually:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getAppEntryMode } from './appEntryMode.js'

const loadRoot = () => getAppEntryMode(window.location.pathname) === 'tv'
  ? import('./tv/KitchenTvRoot.jsx')
  : import('./AdminRoot.jsx')

void loadRoot().then(({ default: Root }) => {
  createRoot(document.getElementById('root')).render(<StrictMode><Root /></StrictMode>)
})
```

- [ ] **Step 5: Add a working TV shell, not admin imports**

`KitchenTvRoot.jsx` imports only `./kitchen-tv.css` and `KitchenTvApp`. For this task, `KitchenTvApp` renders a real loading/start surface that later tasks enrich, e.g. `Carregando painel da cozinha…`; it must not import `App`, `ThemeProvider`, `src/api/client.js`, or any printing module.

TV CSS must at minimum define the full-screen dark root (`html`, `body`, `#root`, `.kitchen-tv-app`) without importing admin theme styles.

- [ ] **Step 6: Run tests and build GREEN**

```bash
node --test src/appEntryMode.test.js src/mainKitchenTvEntry.test.js
npm run build
```

Expected: PASS and Vite produces separate dynamic chunks for the admin root and TV root.

- [ ] **Step 7: Commit**

```bash
git add src/AdminRoot.jsx src/appEntryMode.js src/appEntryMode.test.js src/mainKitchenTvEntry.test.js src/main.jsx src/tv/KitchenTvRoot.jsx src/tv/KitchenTvApp.jsx src/tv/kitchen-tv.css
git commit -m "perf: split kitchen tv entry bundle"
```

---

### Task 8: Implement pairing, start, polling, offline, revoke, sound, and fullscreen lifecycle

**Files:**
- Create: `src/tv/kitchenTvApi.js`
- Create: `src/tv/kitchenTvAudio.js`
- Modify: `src/tv/KitchenTvApp.jsx`
- Create: `src/tv/KitchenTvApp.test.js`
- Test: `src/utils/orderRealtime.test.js`

**Interfaces:**
- TV-only API exports:
  - `pairKitchenTv(token)` -> POST `/api/kitchen-tv/pair`
  - `getKitchenTvState()` -> GET `/api/kitchen-tv/state`
- `kitchenTvApi.js` must not import `src/api/client.js`.
- `ensureKitchenTvAudio(audioContextRef) -> Promise<boolean>` unlocks/creates audio context.
- `playKitchenTvAlert(audioContextRef) -> Promise<boolean>` plays the existing-style two-tone alert and returns false if audio remains unavailable.
- `KitchenTvApp` phases: `loading`, `ready`, `live`, `unauthorized`, `error`.
- Polling interval: `2_000` ms; clock tick for timing/arrival detection: `1_000` ms.
- Highlight duration: use a single constant `KITCHEN_TV_NEW_ORDER_HIGHLIGHT_MS = 6_000`.

- [ ] **Step 1: Write TV API/lifecycle RED tests**

Use `transformWithOxc` and a hook scheduler like existing component tests. Cover these exact behaviors:

```js
test('pairing token is consumed through the TV API and removed from the visible URL', async () => {
  // window.location.search = '?token=secret'
  // fake pair -> 200, fake state -> { orders: [] }
  // settle component
  // assert POST /api/kitchen-tv/pair body { token: 'secret' }
  // assert history.replaceState ended at '/cozinha-tv'
  // assert ready/start UI
})

test('TV client never requests administrative bootstrap', async () => {
  // run boot/start/poll with fake fetch
  // assert every requested path is /api/kitchen-tv/pair or /api/kitchen-tv/state
  // assert none equals /api/bootstrap
})

test('transient state failure preserves last orders but unauthorized clears them', async () => {
  // first state success with order
  // next state 500 -> stale warning + order still present
  // next state 401 -> unauthorized phase and order removed
})
```

Also add a source guard:

```js
assert.doesNotMatch(tvApiSource, /\.\.\/api\/client/)
assert.doesNotMatch(tvApiSource, /\/api\/bootstrap/)
```

- [ ] **Step 2: Run RED**

```bash
node --test src/tv/KitchenTvApp.test.js
```

Expected: FAIL because the TV API/audio/live lifecycle is not implemented.

- [ ] **Step 3: Implement the tiny TV-only API client**

Use same-origin credentials and the same error shape as admin client, but only two functions:

```js
const request = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Não foi possível atualizar o painel.')
    error.status = response.status
    error.code = payload?.error?.code || 'REQUEST_FAILED'
    throw error
  }
  return payload
}

export const pairKitchenTv = (token) => request('/api/kitchen-tv/pair', {
  method: 'POST', body: JSON.stringify({ token }),
})
export const getKitchenTvState = () => request('/api/kitchen-tv/state')
```

- [ ] **Step 4: Implement `kitchenTvAudio.js`**

Follow the current Cozinha two-tone shape (784 Hz then 988 Hz) using only Web Audio. `ensureKitchenTvAudio` must catch browser policy failures and return false rather than crashing the panel.

- [ ] **Step 5: Implement boot and first-run interaction in `KitchenTvApp`**

Boot effect:

1. Read `token` from `window.location.search`.
2. If present, call `pairKitchenTv(token)`, then `history.replaceState(null, '', '/cozinha-tv')`.
3. Call `getKitchenTvState()` to validate session and seed `orders`.
4. Set `phase = 'ready'`.
5. `401` becomes `unauthorized`; other boot failure becomes retryable `error`.

`Iniciar painel da cozinha` action:

```js
const startPanel = async () => {
  const audioReady = await ensureKitchenTvAudio(audioContextRef)
  setAudioNeedsInteraction(!audioReady)
  try { await document.documentElement.requestFullscreen?.() } catch { /* fullscreen is optional */ }
  setPhase('live')
}
```

- [ ] **Step 6: Implement live polling and stale/unauthorized rules**

When `phase === 'live'`:

- fetch immediately;
- poll every 2 seconds while document is visible;
- refresh immediately on `online`, focus, or visibility becoming visible;
- successful state sets `orders`, `lastUpdatedAt`, `stale=false`;
- network/5xx sets `stale=true` and keeps previous orders;
- 401 clears orders and sets `phase='unauthorized'`.

Do not persist queue data to LocalStorage/IndexedDB.

- [ ] **Step 7: Reuse existing operational-arrival detection with a clock tick**

Maintain `now` every second while live and use the existing `detectOperationalArrivals(knownOperationalIdsRef.current, orders, now, alertedOrderIdsRef.current)`.

On initial live evaluation, `knownOperationalIdsRef.current` is `undefined`, so existing logic seeds without false alerts.

When `newIds.length > 0`:

- add them to `alertedOrderIdsRef`;
- set `highlightedOrderIds` to the new ids;
- call `playKitchenTvAlert(audioContextRef)`;
- if it returns false, set `audioNeedsInteraction=true`;
- clear the highlight after 6 seconds.

This same effect handles both immediate arrivals and scheduled orders crossing the 50-minute operational boundary.

- [ ] **Step 8: Run lifecycle + realtime GREEN**

```bash
node --test src/tv/KitchenTvApp.test.js src/utils/orderRealtime.test.js src/utils/kitchenOperationalQueue.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/tv/kitchenTvApi.js src/tv/kitchenTvAudio.js src/tv/KitchenTvApp.jsx src/tv/KitchenTvApp.test.js
git commit -m "feat: run live kitchen tv session"
```

---

### Task 9: Build the approved customer-first TV board with fixed capacity and no pagination

**Files:**
- Create: `src/tv/kitchenTvPresentation.js`
- Create: `src/tv/kitchenTvPresentation.test.js`
- Create: `src/tv/KitchenTvBoard.jsx`
- Create: `src/tv/KitchenTvOrderCard.jsx`
- Create: `src/tv/KitchenTvBoard.test.js`
- Modify: `src/tv/KitchenTvApp.jsx`
- Modify: `src/tv/kitchen-tv.css`

**Interfaces:**
- Constants: `PREPARING_VISIBLE_LIMIT = 4`, `SCHEDULED_VISIBLE_LIMIT = 3`.
- `buildKitchenTvPresentation(orders, now)` returns:

```js
{
  preparing: Entry[0..4],
  scheduled: Entry[0..3],
  preparingOverflow: number,
  scheduledOverflow: number,
  counts: { preparing, scheduled, late },
}
```

- `KitchenTvBoard` props: `{ orders, now, highlightedOrderIds, stale, lastUpdatedAt, audioNeedsInteraction, onEnableAudio }`.
- `KitchenTvOrderCard` receives `{ entry, now, variant, highlighted }`, where variant is `preparing | scheduled`.

- [ ] **Step 1: Write presentation RED tests**

```js
test('TV presentation shows four preparing, three scheduled, and exact overflow without reordering', () => {
  const model = buildKitchenTvPresentation(fixturesWithSixPreparingAndFiveScheduled, now)
  assert.deepEqual(model.preparing.map(({ order }) => order.id), expectedFirstFourPreparingIds)
  assert.deepEqual(model.scheduled.map(({ order }) => order.id), expectedFirstThreeScheduledIds)
  assert.equal(model.preparingOverflow, 2)
  assert.equal(model.scheduledOverflow, 2)
})
```

Also assert removing the first visible preparing order makes the previous fifth entry become visible, proving natural slot refill without pagination state.

- [ ] **Step 2: Run RED**

```bash
node --test src/tv/kitchenTvPresentation.test.js
```

Expected: FAIL because selector does not exist.

- [ ] **Step 3: Implement `kitchenTvPresentation.js` using Task 1 only**

```js
import { buildKitchenOperationalQueue } from '../utils/kitchenOperationalQueue.js'

export const PREPARING_VISIBLE_LIMIT = 4
export const SCHEDULED_VISIBLE_LIMIT = 3

export const buildKitchenTvPresentation = (orders = [], now = new Date()) => {
  const model = buildKitchenOperationalQueue(orders, now)
  return {
    preparing: model.preparing.slice(0, PREPARING_VISIBLE_LIMIT),
    scheduled: model.scheduled.slice(0, SCHEDULED_VISIBLE_LIMIT),
    preparingOverflow: Math.max(0, model.preparing.length - PREPARING_VISIBLE_LIMIT),
    scheduledOverflow: Math.max(0, model.scheduled.length - SCHEDULED_VISIBLE_LIMIT),
    counts: model.counts,
  }
}
```

- [ ] **Step 4: Write board/card RED contract tests**

`KitchenTvBoard.test.js` should use JSX transform/source assertions and prove visible semantics:

- customer name rendered in the card heading/primary class;
- order reference is a secondary small element;
- no action buttons for finalize/cancel/print/create;
- header contains `Cozinha TV`, centered clock/date, `Modo acompanhamento`, `Apenas visualização`;
- sections are only `Em preparo` and `Agendados`;
- no `Novos`, carousel, page index, next-page timer, or pagination controls;
- overflow messages appear when selector reports overflow;
- stale banner text is explicit.

- [ ] **Step 5: Implement `KitchenTvOrderCard.jsx` customer-first hierarchy**

Use existing pure formatters where lightweight:

- `formatOrderDisplayNumber(order)` for the small reference;
- `getOperationalElapsedMinutes(order, now)` + `formatElapsedDuration(...)` for preparing;
- `formatOrderTime(order.scheduledFor)` for scheduled.

Structure must keep the customer name as the strongest element:

```jsx
<article className={`kitchen-tv-card ${variant}${highlighted ? ' recent' : ''}`}>
  <div className="kitchen-tv-card-head">
    <h3>{entry.order.client || 'Cliente'}</h3>
    {highlighted && <span className="kitchen-tv-recent-badge">Acabou de entrar</span>}
  </div>
  <div className="kitchen-tv-card-meta">
    <strong>{variant === 'scheduled' ? formatOrderTime(entry.order.scheduledFor) : formatElapsedDuration(getOperationalElapsedMinutes(entry.order, now))}</strong>
    <span className={`kitchen-tv-type ${String(entry.order.type).toLowerCase()}`}>{entry.order.type}</span>
    <small>{formatOrderDisplayNumber(entry.order)}</small>
  </div>
  <ul>{entry.order.items.map((item) => <li key={`${entry.order.id}:${item.name}:${item.note}`}><b>{item.quantity}×</b> {item.name}{item.note && <em>{item.note}</em>}</li>)}</ul>
</article>
```

Do not put order number before the name.

- [ ] **Step 6: Implement `KitchenTvBoard.jsx` and fixed 16:9 dark CSS**

Board layout:

- top header with identity left, current time/date centered, read-only status right;
- main grid `minmax(0, 3fr) minmax(18rem, 1fr)` or equivalent ~75/25 split;
- preparing cards in a stable 2×2 grid;
- scheduled cards stacked 3 high;
- simple CSS glow/border for `.recent` only; no animation library;
- overflow footer text under each queue when nonzero;
- stale banner: `Sem conexão — aguardando reconexão` (or server-update equivalent for transient failures);
- audio fallback control only when `audioNeedsInteraction` is true.

- [ ] **Step 7: Wire live app to the board**

When `phase === 'live'`, `KitchenTvApp` renders `KitchenTvBoard` with current orders/clock/highlights/stale state. `ready`, `unauthorized`, and boot/error states remain outside the board.

- [ ] **Step 8: Run board + lifecycle GREEN**

```bash
node --test src/tv/kitchenTvPresentation.test.js src/tv/KitchenTvBoard.test.js src/tv/KitchenTvApp.test.js
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/tv/kitchenTvPresentation.js src/tv/kitchenTvPresentation.test.js src/tv/KitchenTvBoard.jsx src/tv/KitchenTvOrderCard.jsx src/tv/KitchenTvBoard.test.js src/tv/KitchenTvApp.jsx src/tv/kitchen-tv.css
git commit -m "feat: render kitchen tv board"
```

---

### Task 10: Harden boundaries, run full regressions, and homologate only in staging

**Files:**
- Create: `src/tv/kitchenTvBoundary.test.js`
- Create: `worker/kitchenTvSecurityRegression.test.js`
- Modify only if a failing acceptance test exposes a real defect in the implementation; do not add scope.

**Interfaces:**
- This task adds acceptance-level regression tests; it must not add new product behavior.

- [ ] **Step 1: Write final boundary tests before declaring completion**

`src/tv/kitchenTvBoundary.test.js` reads the TV/frontend entry sources and asserts:

```js
assert.doesNotMatch(tvRootAndApiSources, /\/api\/bootstrap/)
assert.doesNotMatch(tvRootAndApiSources, /qz-tray|jspdf|usePrintingManager|PrintingSettings/)
assert.doesNotMatch(mainSource, /import App from/)
assert.match(mainSource, /import\('\.\/tv\/KitchenTvRoot\.jsx'\)/)
```

`worker/kitchenTvSecurityRegression.test.js` exercises `handleRequest` and proves:

1. TV cookie can read only `/api/kitchen-tv/state`.
2. TV cookie alone receives 401 from `/api/orders`, `/api/bootstrap`, `/api/printing/settings`, `/api/kitchen-tv/settings`.
3. Admin cookie alone cannot read `/api/kitchen-tv/state`.
4. State payload has no forbidden keys recursively (`phone`, `address`, `total`, `price`, `payment`, `refund`, `print`, `qz`).
5. Revoke makes the next state request 401.

- [ ] **Step 2: Run final focused RED/GREEN cycle**

Run the new acceptance tests. If they expose a real defect, change only the responsible module and rerun until GREEN:

```bash
node --test src/tv/kitchenTvBoundary.test.js worker/kitchenTvSecurityRegression.test.js
```

Expected final state: PASS.

- [ ] **Step 3: Run all Kitchen TV + Cozinha + printing regressions**

```bash
node --test \
  src/utils/kitchenOperationalQueue.test.js \
  src/utils/kitchenQueue.test.js \
  src/utils/orderRealtime.test.js \
  src/tv/*.test.js \
  src/pages/Settings.test.js \
  worker/kitchenTv*.test.js \
  worker/auth.test.js \
  worker/orderPrintingHttp.test.js \
  worker/orderPrintingPriorityHttp.test.js \
  worker/orderPrintingReprintHttp.test.js
```

Expected: PASS.

- [ ] **Step 4: Run full repository verification**

```bash
npm test
npm run lint
npm run build
```

Expected: all PASS; build must still produce lazy admin/TV roots.

- [ ] **Step 5: Apply all migrations locally and smoke the Worker locally**

```bash
npm run d1:migrate:local
npm run dev:worker
```

Manual local smoke in a browser:

1. Admin login still works.
2. `Configurações > TV da Cozinha` loads without affecting printing settings.
3. Generate one access link.
4. Open the link in a separate/incognito browser.
5. Pair succeeds once and the URL becomes `/cozinha-tv` with no token.
6. Reopening the consumed pairing link in another incognito context fails generically.
7. Click `Iniciar painel da cozinha`; fullscreen is attempted and panel still works if denied.
8. Create an immediate order in admin: it appears on TV within polling cadence, highlights and attempts sound.
9. Finalize it in normal Cozinha: it disappears and the next queued order fills the slot.
10. Temporarily take TV browser offline: last queue remains with stale warning; reconnect refreshes automatically.
11. Revoke access in Configurações: TV clears order content on its next refresh and shows unauthorized state.

Stop the local worker after the smoke test.

- [ ] **Step 6: Commit final test hardening**

```bash
git add src/tv/kitchenTvBoundary.test.js worker/kitchenTvSecurityRegression.test.js
git commit -m "test: harden kitchen tv boundaries"
```

- [ ] **Step 7: Rebase/check the final feature branch against its intended staging base before deploy**

Because the print queue and TV touch shared integration files (`App.jsx`, `src/api/client.js`, navigation, `worker/index.js`, migrations), verify no newer remote commits landed after implementation began:

```bash
git fetch origin
git status --short
git log --oneline --decorate -10
```

If the intended staging base advanced, use the repository's normal rebase workflow in the isolated worktree, resolve conflicts by preserving both feature contracts, and rerun **Step 3 + Step 4** before any staging deploy.

- [ ] **Step 8: Apply migration and deploy to staging only**

```bash
npm run d1:migrate:staging
npm run deploy:staging
```

Do **not** run `d1:migrate:production` or `deploy:production`.

- [ ] **Step 9: Staging homologation checklist**

On staging, verify all acceptance criteria with real browser network inspection:

1. Admin app opens normally and centralized printing still initializes/operates as before.
2. Configurações generates one one-time pairing link.
3. TV page initial network does **not** request `/api/bootstrap`.
4. TV page does **not** load QZ/printing/admin-page chunks before/while showing the TV panel.
5. `/api/kitchen-tv/state` response contains only active kitchen-safe fields.
6. Immediate order appears and highlights/sounds once.
7. Scheduled order remains under `Agendados` until the shared operational boundary; use automated tests for exact 50-minute boundary if waiting is impractical during manual homologation.
8. Customer name is visually dominant; order number is secondary.
9. Maximum visible cards are 4 preparing + 3 scheduled; overflow count is correct; there is no pagination.
10. Finalization in normal Cozinha removes the card from TV on next refresh.
11. Offline/transient error keeps stale queue with explicit warning.
12. Revocation clears queue and blocks state on next refresh.
13. Re-pair requires generating a new access link.
14. Fixed dark TV theme does not change when admin theme changes.
15. No production deployment occurs until this staging homologation is explicitly approved.

- [ ] **Step 10: Record homologation result in the PR/implementation ledger used by the project**

Record exact staging URL, tested commit SHA, migration applied, automated test commands/results, and any observed browser/TV-box compatibility note. Do not mark the feature production-ready until the user approves the staging behavior.

---

## Plan Self-Review

### Spec coverage

- One TV / monodispositivo: Tasks 2, 3, 6.
- No normal PIN on TV: Tasks 3, 5, 8.
- One-time pairing and clean URL: Tasks 3, 5, 8.
- Persistent restricted session until revoke in normal use: Tasks 3, 5.
- TV/admin auth separation: Tasks 3, 5, 10.
- Minimal active-only payload: Task 4 + Task 10.
- No admin bootstrap/full app load: Task 7 + Task 10.
- Same Cozinha rules / 50-minute timing / ordering / late state: Task 1 + Tasks 8–9.
- Immediate + scheduled operational arrival alerts: Task 8.
- No `Novos`: Tasks 8–9.
- Customer-first cards: Task 9.
- 4 + 3 capacity, no pagination, natural refill: Task 9.
- Dark theme, large-screen layout: Task 9.
- Audio/fullscreen first interaction and audio fallback: Task 8 + Task 9.
- Offline stale state vs revoked clear state: Task 8 + Task 10.
- Configurações minimal UI: Task 6.
- Staging-only deployment/homologation: Task 10.
- Print-queue conflict control: Global Constraints + Task 10 rebase gate.

### Placeholder scan

No `TBD`, `TODO`, “implement later”, “similar to”, or unspecified error-handling steps are permitted. Every planned module has a named interface, required behavior, concrete test command, and commit boundary.

### Type/name consistency

The plan consistently uses:

- `buildKitchenOperationalQueue`
- `issueKitchenTvAccess`
- `activateKitchenTvSession`
- `loadKitchenTvSessionByHash`
- `touchKitchenTvSession`
- `revokeKitchenTvAccess`
- `createOpaqueToken`
- `hashOpaqueToken`
- `generateKitchenTvAccess`
- `pairKitchenTvAccess`
- `getKitchenTvSession`
- `getKitchenTvSettings`
- `listKitchenTvOrders`
- `handleKitchenTvPublicApi`
- `handleKitchenTvAdminApi`
- `pairKitchenTv`
- `getKitchenTvState`
- `buildKitchenTvPresentation`

Do not rename one side of an interface without updating the producing and consuming tasks together.

---

## Execution Handoff

This plan is intentionally **ready but blocked** until the centralized print queue is finished/homologated. Do not start Kitchen TV implementation merely because the plan exists.

After the execution gate is cleared, use one of these modes:

1. **Subagent-Driven (recommended)** — use `superpowers:subagent-driven-development`; fresh subagent per task with review between tasks.
2. **Inline Execution** — use `superpowers:executing-plans`; execute in batches with checkpoints.

In either mode, begin with the isolated-worktree + final-print-queue rebase/baseline verification in Global Constraints, then execute Tasks 1–10 in order.
