# Kitchen TV Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight, read-only Kitchen TV surface that reuses the current Cozinha operational rules, pairs once without the normal PIN, and displays only active kitchen-safe order data.

**Architecture:** Keep one project/deploy, but split `/cozinha-tv` into a dedicated lazy-loaded frontend entry that never bootstraps the administrative app. Add a restricted TV pairing/session boundary and a minimal active-only API in the Worker; keep the normal Cozinha as the only interactive operational surface and share only the small queue/timing logic needed by both UIs.

**Tech Stack:** React 19, Vite 8, Cloudflare Worker, Cloudflare D1/SQLite migrations, Web Crypto, Web Audio/Fullscreen browser APIs, Node `node:test`, `node:sqlite`, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-09-kitchen-tv-display-design.md`

## Global Constraints

- **Execution gate:** do not start Task 1 until the centralized QZ print-queue work is finished and homologated on its feature/staging path.
- At execution time, use `superpowers:using-git-worktrees` to create a fresh isolated worktree; do not implement inside an old dirty/diverged worktree.
- Before Task 1, update this feature on top of the **final remote HEAD that contains the completed centralized print queue**. The expected source is `origin/feature/centralized-qz-print-queue`; if that work has moved to the project's staging integration branch, use that final remote integration HEAD instead.
- Preserve the approved spec and this plan while rebasing; create the implementation branch from the rebased design branch, e.g. `feature/kitchen-tv-display`.
- Current migrations on the design base end at `0018_second_copy_decisions.sql`; Task 2 therefore uses `0019_kitchen_tv_access.sql`. If the completed print-queue work adds another migration before execution, renumber the Kitchen TV migration to the next sequential number before writing it, without changing its schema semantics.
- Run baseline verification before the first RED test: `npm test`, `npm run lint`, and `npm run build`. If baseline is not green after rebasing onto the final print-queue HEAD, resolve the base first; do not hide a print-queue regression inside Kitchen TV work.
- Strict TDD: write a focused failing test first for every behavior change, run it and observe RED, implement the minimum code, run GREEN, then run the nearest regression set.
- One TV only in v1. Do not introduce device lists, names, per-device configuration, or generalized multi-TV abstractions.
- TV is read-only. No finalize, cancel, print, edit, create, payment, finance, or administrative action may be callable from the TV session.
- TV mode must not call `/api/bootstrap` and must not load the administrative application tree before rendering.
- TV state must be active-only and whitelisted: no phone, address, prices, payment, finance, refunds, printing/QZ, product catalog, or completed history.
- Keep the existing 50-minute scheduled-preparation rule and current Cozinha ordering/late/arrival semantics unchanged.
- No `Novos` status/column; newly operational orders are normal `Em preparo` orders with temporary visual/audio feedback.
- Polling remains approximately 2 seconds; do not add WebSocket/SSE.
- TV theme is fixed dark/high-contrast and independent of the administrative theme.
- Visible capacity is 4 `Em preparo` + 3 `Agendados`; no pagination/carousel. Overflow is indicated and the next queued order fills a released slot automatically.
- No production deploy. Final deployment steps in this plan target staging only for homologation.

---

## File Structure Locked by This Plan

### Shared operational selection

- Create `src/utils/kitchenOperationalQueue.js` — pure queue/timing classification shared by normal Cozinha and TV.
- Create `src/utils/kitchenOperationalQueue.test.js` — boundary/order/late regression coverage.
- Modify `src/utils/kitchenQueue.js` — keep search + finished-today concerns here and delegate the operational queue to the new module.
- Keep `src/utils/orderRealtime.js` and `shared/orderTiming.js` as existing sources of truth.

### Worker / D1

- Create `migrations/0019_kitchen_tv_access.sql` — one Kitchen TV access row per business; renumber only if the execution base has moved beyond `0018`.
- Create `worker/testD1Adapter.js` — reusable test-only D1-shaped adapter over `node:sqlite` for Kitchen TV Worker tests.
- Create `worker/kitchenTvAccessMigration.test.js`.
- Create `worker/kitchenTvAccessRepository.js` and `worker/kitchenTvAccessRepository.test.js`.
- Create `worker/opaqueToken.js`; modify `worker/auth.js` only to reuse opaque token generation/hashing for normal admin session tokens.
- Create `worker/kitchenTvAuth.js` and `worker/kitchenTvAuth.test.js`.
- Create `worker/kitchenTvStateRepository.js` and `worker/kitchenTvStateRepository.test.js`.
- Create `worker/kitchenTvApi.js` and `worker/kitchenTvApi.test.js`.
- Modify `worker/index.js` only for route dispatch.

### Administrative Configurações

- Modify `src/api/client.js`; create `src/api/kitchenTvSettingsClient.test.js`.
- Create `src/pages/kitchenTvSettingsModel.js` and `src/pages/kitchenTvSettingsModel.test.js`.
- Create `src/pages/Settings.jsx` and `src/pages/Settings.test.js`.
- Create `src/kitchen-tv-settings.css`.
- Modify `src/App.jsx`, `src/components/Sidebar.jsx`, and `src/components/MobileNavigation.jsx` only for the new admin page/navigation.

### Lightweight TV frontend

- Create `src/AdminRoot.jsx`.
- Create `src/appEntryMode.js`, `src/appEntryMode.test.js`, and `src/mainKitchenTvEntry.test.js`.
- Modify `src/main.jsx` into a minimal dynamic entry loader.
- Create `src/tv/KitchenTvRoot.jsx`.
- Create TV-only `src/tv/kitchenTvApi.js`.
- Create pure lifecycle helpers `src/tv/kitchenTvSession.js` and `src/tv/kitchenTvSession.test.js`.
- Create `src/tv/kitchenTvAudio.js` and `src/tv/kitchenTvAudio.test.js`.
- Create `src/tv/KitchenTvApp.jsx` and `src/tv/KitchenTvApp.test.js`.
- Create `src/tv/kitchenTvPresentation.js` and `src/tv/kitchenTvPresentation.test.js`.
- Create `src/tv/KitchenTvBoard.jsx`, `src/tv/KitchenTvOrderCard.jsx`, `src/tv/KitchenTvBoard.test.js`.
- Create `src/tv/kitchen-tv.css`.

---

### Task 1: Extract the lightweight shared operational queue model

**Files:**
- Create: `src/utils/kitchenOperationalQueue.js`
- Create: `src/utils/kitchenOperationalQueue.test.js`
- Modify: `src/utils/kitchenQueue.js`
- Test: `src/utils/kitchenQueue.test.js`

**Interfaces:**
- Consumes `isScheduledWaiting`, `getOperationalStartAt`, `isOrderActive`, `getOrderTimingState`.
- Produces `buildKitchenOperationalQueue(orders = [], now = new Date()) -> { allActive, preparing, scheduled, counts }`.
- Each queue entry remains `{ order, phase, operationalStartAt, timingState, isLate }`.
- `counts` is `{ preparing, scheduled, late }`.
- `src/utils/kitchenQueue.js` remains the search-aware wrapper and still adds `finishedToday` + `totalVisible` for normal Cozinha.

- [ ] **Step 1: Write the failing core tests**

Create `src/utils/kitchenOperationalQueue.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKitchenOperationalQueue } from './kitchenOperationalQueue.js'

const ids = (entries) => entries.map(({ order }) => order.id)

test('scheduled order crosses at the existing 50-minute operational boundary', () => {
  const order = {
    id: 'scheduled-1', status: 'Em preparo', type: 'Entrega',
    createdAt: '2026-09-04T08:00:00.000Z',
    scheduledFor: '2026-09-04T15:00:00.000Z',
  }
  assert.deepEqual(ids(buildKitchenOperationalQueue([order], new Date('2026-09-04T14:09:59.999Z')).scheduled), ['scheduled-1'])
  assert.deepEqual(ids(buildKitchenOperationalQueue([order], new Date('2026-09-04T14:10:00.000Z')).preparing), ['scheduled-1'])
})

test('queues preserve current ordering and exclude terminal orders', () => {
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

- [ ] **Step 2: Run RED**

```bash
node --test src/utils/kitchenOperationalQueue.test.js
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure selector**

Create `src/utils/kitchenOperationalQueue.js`:

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
    return { order, phase, operationalStartAt: getOperationalStartAt(order), timingState, isLate: timingState !== 'on-time' }
  })
  const preparing = allActive.filter(({ phase }) => phase === 'preparing').sort(compareOperationalStart)
  const scheduled = allActive.filter(({ phase }) => phase === 'scheduled').sort(compareScheduledFor)
  return {
    allActive,
    preparing,
    scheduled,
    counts: { preparing: preparing.length, scheduled: scheduled.length, late: allActive.filter(({ isLate }) => isLate).length },
  }
}
```

- [ ] **Step 4: Make `kitchenQueue.js` delegate only operational classification**

Keep search and `finishedToday` in `kitchenQueue.js`:

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

Delete only the duplicated operational sort/classification helpers from `kitchenQueue.js`.

- [ ] **Step 5: Run GREEN + current Cozinha regressions**

```bash
node --test src/utils/kitchenOperationalQueue.test.js src/utils/kitchenQueue.test.js src/utils/orderRealtime.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/kitchenOperationalQueue.js src/utils/kitchenOperationalQueue.test.js src/utils/kitchenQueue.js
git commit -m "refactor: share kitchen operational queue model"
```

---

### Task 2: Add the single-TV D1 schema, D1 test adapter, and access repository

**Files:**
- Create: `migrations/0019_kitchen_tv_access.sql`
- Create: `worker/testD1Adapter.js`
- Create: `worker/kitchenTvAccessMigration.test.js`
- Create: `worker/kitchenTvAccessRepository.js`
- Create: `worker/kitchenTvAccessRepository.test.js`

**Interfaces:**
- Test helper: `createMigratedD1(businessId = 'amor-e-sabor') -> Promise<{ DB, sqlite }>`.
- Repository functions:
  - `loadKitchenTvAccess(db, businessId)`
  - `issueKitchenTvAccess(db, businessId, pairingTokenHash, now)`
  - `activateKitchenTvSession(db, businessId, pairingTokenHash, sessionTokenHash, now) -> boolean`
  - `loadKitchenTvSessionByHash(db, sessionTokenHash)`
  - `touchKitchenTvSession(db, businessId, now)`
  - `revokeKitchenTvAccess(db, businessId, now)`

- [ ] **Step 1: Write the migration RED test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createMigratedD1 } from './testD1Adapter.js'

test('Kitchen TV migration creates the monodispositivo credential table', async () => {
  const { sqlite } = await createMigratedD1()
  const columns = sqlite.prepare("SELECT name FROM pragma_table_info('kitchen_tv_access') ORDER BY cid").all().map(({ name }) => name)
  assert.deepEqual(columns, [
    'business_id', 'pairing_token_hash', 'session_token_hash',
    'created_at', 'paired_at', 'last_seen_at', 'revoked_at',
  ])
})
```

- [ ] **Step 2: Run RED**

```bash
node --test worker/kitchenTvAccessMigration.test.js
```

Expected: FAIL because `testD1Adapter.js`/the migration do not exist.

- [ ] **Step 3: Create the migration**

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

- [ ] **Step 4: Create the exact reusable D1-shaped test adapter**

`worker/testD1Adapter.js`:

```js
import { DatabaseSync } from 'node:sqlite'
import { readFile, readdir } from 'node:fs/promises'

const migrationsUrl = new URL('../migrations/', import.meta.url)

const wrapDb = (sqlite) => ({
  prepare(sql) {
    const statement = sqlite.prepare(sql)
    return {
      bind(...values) {
        return {
          async run() {
            const result = statement.run(...values)
            return { success: true, meta: { changes: Number(result.changes || 0) } }
          },
          async first() { return statement.get(...values) ?? null },
          async all() { return { results: statement.all(...values).map((row) => ({ ...row })) } },
        }
      },
    }
  },
})

export const createMigratedD1 = async (businessId = 'amor-e-sabor') => {
  const sqlite = new DatabaseSync(':memory:')
  const files = (await readdir(migrationsUrl)).filter((file) => file.endsWith('.sql')).sort()
  for (const file of files) sqlite.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
  const at = '2026-09-09T12:00:00.000Z'
  sqlite.prepare('INSERT OR IGNORE INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(businessId, businessId, 'Test Business', at, at)
  return { DB: wrapDb(sqlite), sqlite }
}
```

- [ ] **Step 5: Run migration GREEN**

```bash
node --test worker/kitchenTvAccessMigration.test.js
```

Expected: PASS.

- [ ] **Step 6: Write repository lifecycle RED tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createMigratedD1 } from './testD1Adapter.js'
import {
  issueKitchenTvAccess, activateKitchenTvSession, loadKitchenTvSessionByHash,
  touchKitchenTvSession, revokeKitchenTvAccess,
} from './kitchenTvAccessRepository.js'

test('pairing is one-use and revoke kills the active session', async () => {
  const { DB, sqlite } = await createMigratedD1()
  await issueKitchenTvAccess(DB, 'amor-e-sabor', 'pair-hash-1', new Date('2026-09-09T12:00:00.000Z'))
  assert.equal(await activateKitchenTvSession(DB, 'amor-e-sabor', 'pair-hash-1', 'session-hash-1', new Date('2026-09-09T12:01:00.000Z')), true)
  assert.equal(await activateKitchenTvSession(DB, 'amor-e-sabor', 'pair-hash-1', 'session-hash-2', new Date('2026-09-09T12:02:00.000Z')), false)
  assert.equal((await loadKitchenTvSessionByHash(DB, 'session-hash-1')).business_id, 'amor-e-sabor')
  await touchKitchenTvSession(DB, 'amor-e-sabor', new Date('2026-09-09T12:03:00.000Z'))
  assert.equal(sqlite.prepare('SELECT last_seen_at FROM kitchen_tv_access WHERE business_id = ?').get('amor-e-sabor').last_seen_at, '2026-09-09T12:03:00.000Z')
  await revokeKitchenTvAccess(DB, 'amor-e-sabor', new Date('2026-09-09T12:04:00.000Z'))
  assert.equal(await loadKitchenTvSessionByHash(DB, 'session-hash-1'), null)
})

test('issuing a new access invalidates the previous TV session', async () => {
  const { DB } = await createMigratedD1()
  await issueKitchenTvAccess(DB, 'amor-e-sabor', 'pair-1', new Date('2026-09-09T12:00:00.000Z'))
  await activateKitchenTvSession(DB, 'amor-e-sabor', 'pair-1', 'session-1', new Date('2026-09-09T12:01:00.000Z'))
  await issueKitchenTvAccess(DB, 'amor-e-sabor', 'pair-2', new Date('2026-09-09T12:02:00.000Z'))
  assert.equal(await loadKitchenTvSessionByHash(DB, 'session-1'), null)
})
```

- [ ] **Step 7: Run repository RED**

```bash
node --test worker/kitchenTvAccessRepository.test.js
```

Expected: FAIL because repository functions do not exist.

- [ ] **Step 8: Implement the repository**

Use an UPSERT for issue/regenerate and an atomic pairing consume:

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
  return Number(result?.meta?.changes || 0) > 0
}
```

Implement the load/touch/revoke statements directly against `kitchen_tv_access`; revoke sets both hashes to `NULL` and `revoked_at` to the supplied timestamp.

- [ ] **Step 9: Run GREEN**

```bash
node --test worker/kitchenTvAccessMigration.test.js worker/kitchenTvAccessRepository.test.js
```

- [ ] **Step 10: Commit**

```bash
git add migrations/*_kitchen_tv_access.sql worker/testD1Adapter.js worker/kitchenTvAccessMigration.test.js worker/kitchenTvAccessRepository.js worker/kitchenTvAccessRepository.test.js
git commit -m "feat: persist kitchen tv access"
```

---

### Task 3: Add opaque token reuse and dedicated TV auth/session semantics

**Files:**
- Create: `worker/opaqueToken.js`
- Modify: `worker/auth.js`
- Test: `worker/auth.test.js`
- Create: `worker/kitchenTvAuth.js`
- Create: `worker/kitchenTvAuth.test.js`

**Interfaces:**
- `createOpaqueToken(byteLength = 32) -> string`.
- `hashOpaqueToken(value) -> Promise<string>` returning 64-char SHA-256 hex.
- TV cookie name `amor_kitchen_tv`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/kitchen-tv`.
- `KITCHEN_TV_SESSION_MAX_AGE = 400 * 24 * 60 * 60` = `34560000` seconds; valid state reads refresh this cookie.
- `getKitchenTvSettings(env, businessId) -> { status, pairedAt, lastSeenAt }`, status in `not_configured | awaiting_pairing | active | revoked`.
- `generateKitchenTvAccess(env, businessId, now) -> { pairingToken, settings }`.
- `pairKitchenTvAccess(env, businessId, pairingToken, now) -> { sessionToken, businessId } | null`.
- `getKitchenTvSession(request, env, now) -> { businessId, sessionToken } | null`.
- `revokeKitchenTvAccessSession(env, businessId, now)`.

- [ ] **Step 1: Write RED tests**

`worker/kitchenTvAuth.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createMigratedD1 } from './testD1Adapter.js'
import { createOpaqueToken, hashOpaqueToken } from './opaqueToken.js'
import {
  generateKitchenTvAccess, pairKitchenTvAccess, getKitchenTvSession,
  kitchenTvSessionCookie, revokeKitchenTvAccessSession,
} from './kitchenTvAuth.js'

test('opaque credentials are URL-safe and stored only as hashes', async () => {
  const token = createOpaqueToken(32)
  assert.match(token, /^[A-Za-z0-9_-]+$/)
  assert.equal((await hashOpaqueToken(token)).length, 64)
  const { DB, sqlite } = await createMigratedD1()
  const { pairingToken } = await generateKitchenTvAccess({ DB }, 'amor-e-sabor', new Date('2026-09-09T12:00:00.000Z'))
  const row = sqlite.prepare('SELECT pairing_token_hash FROM kitchen_tv_access WHERE business_id = ?').get('amor-e-sabor')
  assert.notEqual(row.pairing_token_hash, pairingToken)
  assert.equal(row.pairing_token_hash.length, 64)
})

test('Kitchen TV pairing is one-use and yields a separate long-lived cookie session', async () => {
  const { DB } = await createMigratedD1()
  const env = { DB }
  const { pairingToken } = await generateKitchenTvAccess(env, 'amor-e-sabor', new Date('2026-09-09T12:00:00.000Z'))
  const first = await pairKitchenTvAccess(env, 'amor-e-sabor', pairingToken, new Date('2026-09-09T12:01:00.000Z'))
  assert.ok(first?.sessionToken)
  assert.equal(await pairKitchenTvAccess(env, 'amor-e-sabor', pairingToken, new Date('2026-09-09T12:02:00.000Z')), null)
  const cookie = kitchenTvSessionCookie(first.sessionToken)
  assert.match(cookie, /^amor_kitchen_tv=/)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
  assert.match(cookie, /Path=\/api\/kitchen-tv/)
  assert.match(cookie, /Max-Age=34560000/)
  const request = new Request('https://delivery.example/api/kitchen-tv/state', { headers: { cookie: cookie.split(';')[0] } })
  assert.equal((await getKitchenTvSession(request, env, new Date('2026-09-09T12:03:00.000Z'))).businessId, 'amor-e-sabor')
  await revokeKitchenTvAccessSession(env, 'amor-e-sabor', new Date('2026-09-09T12:04:00.000Z'))
  assert.equal(await getKitchenTvSession(request, env, new Date('2026-09-09T12:05:00.000Z')), null)
})
```

- [ ] **Step 2: Run RED**

```bash
node --test worker/kitchenTvAuth.test.js worker/auth.test.js
```

- [ ] **Step 3: Implement `worker/opaqueToken.js`**

```js
const encoder = new TextEncoder()
const toBase64Url = (bytes) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
const toHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

export const createOpaqueToken = (byteLength = 32) => toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
export const hashOpaqueToken = async (value) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value)))
  return toHex(new Uint8Array(digest))
}
```

- [ ] **Step 4: Modify admin `auth.js` only to reuse opaque session token generation/hashing**

Import `createOpaqueToken` and `hashOpaqueToken`; keep PBKDF2 PIN helpers, admin cookie name, seven-day expiry, and existing admin session schema unchanged. Existing `auth.test.js` must remain valid.

- [ ] **Step 5: Implement `kitchenTvAuth.js`**

Core pairing generation/consume:

```js
export const generateKitchenTvAccess = async (env, businessId, now = new Date()) => {
  const pairingToken = createOpaqueToken()
  await issueKitchenTvAccess(env.DB, businessId, await hashOpaqueToken(pairingToken), now)
  return { pairingToken, settings: await getKitchenTvSettings(env, businessId) }
}

export const pairKitchenTvAccess = async (env, businessId, pairingToken, now = new Date()) => {
  if (typeof pairingToken !== 'string' || !pairingToken) return null
  const sessionToken = createOpaqueToken()
  const activated = await activateKitchenTvSession(
    env.DB,
    businessId,
    await hashOpaqueToken(pairingToken),
    await hashOpaqueToken(sessionToken),
    now,
  )
  return activated ? { businessId, sessionToken } : null
}
```

`getKitchenTvSession` parses only `amor_kitchen_tv`, hashes it, uses `loadKitchenTvSessionByHash`, touches last-seen, and returns `{ businessId: row.business_id, sessionToken: originalCookieToken }`. It must never read `amor_session`.

- [ ] **Step 6: Run GREEN**

```bash
node --test worker/kitchenTvAuth.test.js worker/auth.test.js worker/kitchenTvAccessRepository.test.js
```

- [ ] **Step 7: Commit**

```bash
git add worker/opaqueToken.js worker/auth.js worker/auth.test.js worker/kitchenTvAuth.js worker/kitchenTvAuth.test.js
git commit -m "feat: add restricted kitchen tv auth"
```

---

### Task 4: Add the active-only whitelisted TV state repository

**Files:**
- Create: `worker/kitchenTvStateRepository.js`
- Create: `worker/kitchenTvStateRepository.test.js`

**Interface:**

```js
KitchenTvOrder = {
  id, orderNumber, client, type, status, createdAt, scheduledFor, tableIdentifier,
  items: [{ name, quantity, note }],
}
```

`listKitchenTvOrders(db, businessId) -> Promise<KitchenTvOrder[]>`.

- [ ] **Step 1: Write RED contract tests with a defined fake DB**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { listKitchenTvOrders } from './kitchenTvStateRepository.js'

const fakeDb = ({ orders, items }) => {
  const state = { orderSql: '', itemSql: '', call: 0 }
  return {
    get orderSql() { return state.orderSql },
    get itemSql() { return state.itemSql },
    prepare(sql) {
      const isOrderQuery = state.call++ === 0
      if (isOrderQuery) state.orderSql = sql
      else state.itemSql = sql
      return { bind() { return { async all() { return { results: isOrderQuery ? orders : items } } } } }
    },
  }
}

test('TV query returns only active kitchen-safe fields', async () => {
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

test('local/table customer label matches the normal order mapper convention', async () => {
  const db = fakeDb({
    orders: [{
      id: 'local-1', order_number: 1843, client_id: 'c2', client_name_snapshot: 'João',
      customer_identity_type: 'table', table_identifier: 'Mesa 03', type: 'Local', status: 'Em preparo',
      created_at: '2026-09-09T12:00:00.000Z', scheduled_for: null,
    }],
    items: [],
  })
  assert.equal((await listKitchenTvOrders(db, 'amor-e-sabor'))[0].client, 'Mesa 03 · João')
})
```

- [ ] **Step 2: Run RED**

```bash
node --test worker/kitchenTvStateRepository.test.js
```

- [ ] **Step 3: Implement exactly two active-only queries**

Order SQL:

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

Item SQL:

```sql
SELECT oi.order_id, oi.name_snapshot, oi.quantity, oi.note, oi.created_at
FROM order_items oi
JOIN orders o ON o.id = oi.order_id AND o.business_id = oi.business_id
WHERE oi.business_id = ?
  AND o.status NOT IN ('Finalizado', 'Cancelado')
ORDER BY oi.created_at ASC
```

Map only the documented TV keys. Do not call `mapOrderRow`/`mapOrderItemRow` because they intentionally add prices/contact/payment fields.

- [ ] **Step 4: Run GREEN + normal order regressions**

```bash
node --test worker/kitchenTvStateRepository.test.js worker/orderRepositories.test.js worker/orderIdentityRepositoryMapping.test.js
```

- [ ] **Step 5: Commit**

```bash
git add worker/kitchenTvStateRepository.js worker/kitchenTvStateRepository.test.js
git commit -m "feat: add minimal kitchen tv state query"
```

---

### Task 5: Add TV API routes without weakening admin auth

**Files:**
- Create: `worker/kitchenTvApi.js`
- Create: `worker/kitchenTvApi.test.js`
- Modify: `worker/index.js`

**Interfaces:**
- `handleKitchenTvPublicApi(request, env, url) -> Response | null` handles only `POST /api/kitchen-tv/pair` and `GET /api/kitchen-tv/state`.
- `handleKitchenTvAdminApi(request, env, session, url) -> Response | null` handles only `GET /api/kitchen-tv/settings`, `POST /api/kitchen-tv/access`, `POST /api/kitchen-tv/revoke`.
- Responses:
  - settings: `{ settings: { status, pairedAt, lastSeenAt } }`
  - access: `{ settings, pairingToken }`
  - pair: `{ paired: true }`
  - state: `{ orders }`

- [ ] **Step 1: Write the integration RED test using the Task 2 D1 adapter**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createSession } from './auth.js'
import { handleRequest } from './index.js'
import { createMigratedD1 } from './testD1Adapter.js'

const makeEnv = async () => {
  const { DB } = await createMigratedD1()
  return { DB, LOGIN_RATE_LIMITER: { async limit() { return { success: true } } } }
}
const origin = 'https://delivery.example'
const jsonBody = (method, body, cookie = '') => ({
  method,
  headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
})

test('admin generates access, one TV pairs, state works, revoke blocks next state', async () => {
  const env = await makeEnv()
  const { token: adminToken } = await createSession(env, 'amor-e-sabor', new Date('2026-09-09T12:00:00.000Z'))
  const adminCookie = `amor_session=${adminToken}`
  const accessResponse = await handleRequest(new Request(`${origin}/api/kitchen-tv/access`, { method: 'POST', headers: { origin, cookie: adminCookie } }), env)
  assert.equal(accessResponse.status, 200)
  const { pairingToken } = await accessResponse.json()

  const pairResponse = await handleRequest(new Request(`${origin}/api/kitchen-tv/pair`, jsonBody('POST', { token: pairingToken })), env)
  assert.equal(pairResponse.status, 200)
  const tvCookie = pairResponse.headers.get('set-cookie').split(';')[0]

  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, { headers: { cookie: tvCookie } }), env)).status, 200)
  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, { headers: { cookie: adminCookie } }), env)).status, 401)
  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/settings`, { headers: { cookie: tvCookie } }), env)).status, 401)

  const revokeResponse = await handleRequest(new Request(`${origin}/api/kitchen-tv/revoke`, { method: 'POST', headers: { origin, cookie: adminCookie } }), env)
  assert.equal(revokeResponse.status, 200)
  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, { headers: { cookie: tvCookie } }), env)).status, 401)
})
```

- [ ] **Step 2: Run RED**

```bash
node --test worker/kitchenTvApi.test.js
```

- [ ] **Step 3: Implement public/admin handlers**

Public pairing must call `assertSameOriginMutation`, use a high-entropy token, and return a generic invalid/used-token error. Reuse the existing rate limiter when present:

```js
const PAIR_RATE_LIMIT_KEY = 'amor-e-sabor:kitchen-tv-pair'
const assertPairAllowed = async (env) => {
  if (!env.LOGIN_RATE_LIMITER?.limit) return
  const { success } = await env.LOGIN_RATE_LIMITER.limit({ key: PAIR_RATE_LIMIT_KEY })
  if (!success) throw apiError(429, 'KITCHEN_TV_PAIR_RATE_LIMITED', 'Muitas tentativas de configuração. Aguarde um minuto e tente novamente.')
}
```

`GET /state` authenticates only `getKitchenTvSession`, returns `401 KITCHEN_TV_UNAUTHORIZED` if invalid/revoked, returns `listKitchenTvOrders` when valid, sets `Cache-Control: no-store`, and refreshes the same TV cookie lifetime via `Set-Cookie`.

Admin mutations remain same-origin protected.

- [ ] **Step 4: Integrate dispatch in `worker/index.js`**

Inside `authenticatedApi`, immediately after normal admin session/url setup:

```js
const kitchenTvAdminResponse = await handleKitchenTvAdminApi(request, env, session, url)
if (kitchenTvAdminResponse) return kitchenTvAdminResponse
```

Inside `handleRequest`, before the generic `/api/` -> `authenticatedApi` fallback:

```js
const kitchenTvPublicResponse = await handleKitchenTvPublicApi(request, env, url)
if (kitchenTvPublicResponse) return kitchenTvPublicResponse
```

Do not modify `getAuthenticatedSession` to know about TV cookies.

- [ ] **Step 5: Run GREEN + printing HTTP regressions**

```bash
node --test worker/kitchenTvApi.test.js worker/kitchenTvAuth.test.js worker/auth.test.js worker/orderPrintingHttp.test.js worker/orderPrintingPriorityHttp.test.js worker/orderPrintingReprintHttp.test.js
```

- [ ] **Step 6: Commit**

```bash
git add worker/kitchenTvApi.js worker/kitchenTvApi.test.js worker/index.js
git commit -m "feat: expose restricted kitchen tv api"
```

---

### Task 6: Add minimal `Configurações > TV da Cozinha`

**Files:**
- Modify: `src/api/client.js`
- Create: `src/api/kitchenTvSettingsClient.test.js`
- Create: `src/pages/kitchenTvSettingsModel.js`
- Create: `src/pages/kitchenTvSettingsModel.test.js`
- Create: `src/pages/Settings.jsx`
- Create: `src/pages/Settings.test.js`
- Create: `src/kitchen-tv-settings.css`
- Modify: `src/App.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/components/MobileNavigation.jsx`

**Interfaces:**
- Admin client: `getKitchenTvSettings`, `generateKitchenTvAccess`, `revokeKitchenTvAccess`.
- Pure model: `buildKitchenTvPairingUrl(origin, pairingToken)` and `formatKitchenTvLastSeen(value, now)`.
- `Settings` owns its own network/action state; `App.jsx` only renders it.

- [ ] **Step 1: Write admin API client RED test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getKitchenTvSettings, generateKitchenTvAccess, revokeKitchenTvAccess } from './client.js'

test('Kitchen TV admin client uses only the three authenticated settings routes', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (path, options = {}) => {
    calls.push([path, options.method || 'GET'])
    return Response.json({ settings: { status: 'not_configured', pairedAt: null, lastSeenAt: null }, pairingToken: 'secret' })
  }
  try {
    await getKitchenTvSettings()
    await generateKitchenTvAccess()
    await revokeKitchenTvAccess()
    assert.deepEqual(calls, [
      ['/api/kitchen-tv/settings', 'GET'],
      ['/api/kitchen-tv/access', 'POST'],
      ['/api/kitchen-tv/revoke', 'POST'],
    ])
  } finally { globalThis.fetch = originalFetch }
})
```

- [ ] **Step 2: Write pure settings-model RED tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKitchenTvPairingUrl, formatKitchenTvLastSeen } from './kitchenTvSettingsModel.js'

test('pairing URL stays same-origin and URL-encodes the one-time token', () => {
  assert.equal(buildKitchenTvPairingUrl('https://delivery.example', 'a+b/c'), 'https://delivery.example/cozinha-tv?token=a%2Bb%2Fc')
})

test('last seen uses compact friendly labels', () => {
  const now = new Date('2026-09-09T15:00:00.000Z')
  assert.equal(formatKitchenTvLastSeen(null, now), 'Ainda não conectado')
  assert.equal(formatKitchenTvLastSeen('2026-09-09T14:59:40.000Z', now), 'Agora')
  assert.equal(formatKitchenTvLastSeen('2026-09-09T14:55:00.000Z', now), 'Há 5 min')
})
```

- [ ] **Step 3: Run RED**

```bash
node --test src/api/kitchenTvSettingsClient.test.js src/pages/kitchenTvSettingsModel.test.js
```

- [ ] **Step 4: Add the exact admin client functions and pure model**

Append to `src/api/client.js`:

```js
export const getKitchenTvSettings = () => apiRequest('/api/kitchen-tv/settings')
export const generateKitchenTvAccess = () => apiRequest('/api/kitchen-tv/access', { method: 'POST' })
export const revokeKitchenTvAccess = () => apiRequest('/api/kitchen-tv/revoke', { method: 'POST' })
```

Model URL:

```js
export const buildKitchenTvPairingUrl = (origin, pairingToken) => `${String(origin).replace(/\/$/, '')}/cozinha-tv?token=${encodeURIComponent(pairingToken)}`
```

Implement `formatKitchenTvLastSeen` with the exact labels asserted above, then `Hoje, HH:mm` for same-day older values and `dd/mm/yyyy HH:mm` otherwise.

- [ ] **Step 5: Write the Settings UI source/structure RED test**

`src/pages/Settings.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'

const source = await readFile(new URL('./Settings.jsx', import.meta.url), 'utf8').catch(() => '')

test('Settings keeps Kitchen TV monodispositivo and exposes approved actions/states', async () => {
  assert.match(source, /TV da Cozinha/)
  assert.match(source, /Gerar acesso da TV/)
  assert.match(source, /Copiar link/)
  assert.match(source, /Gerar novo acesso/)
  assert.match(source, /Revogar acesso/)
  assert.match(source, /TV da cozinha ativa/)
  assert.doesNotMatch(source, /nome do dispositivo|Adicionar TV|lista de TVs/i)
  await transformWithOxc(source, 'Settings.jsx', { jsx: { runtime: 'automatic' } })
})
```

- [ ] **Step 6: Run UI RED**

```bash
node --test src/pages/Settings.test.js
```

- [ ] **Step 7: Implement `Settings.jsx` and styles**

Use local state only:

```js
const [settings, setSettings] = useState(null)
const [pairingToken, setPairingToken] = useState(null)
const [loading, setLoading] = useState(true)
const [action, setAction] = useState(null)
const [error, setError] = useState('')
const [confirmRevoke, setConfirmRevoke] = useState(false)
```

Required rendering:

- `not_configured` / `revoked`: explanation + `Gerar acesso da TV`.
- `awaiting_pairing` with local `pairingToken`: render `buildKitchenTvPairingUrl(window.location.origin, pairingToken)`, `Copiar link`, and “exibido somente agora” warning.
- `awaiting_pairing` without local token after reload: no secret/link; explain that a new access must be generated to obtain another link.
- `active`: `TV da cozinha ativa`, formatted last access, `Gerar novo acesso`, `Revogar acesso`.
- revoke opens `ConfirmationDialog`; confirmation calls `revokeKitchenTvAccess` and clears local token.
- copy uses `navigator.clipboard.writeText(pairingUrl)`.

No device name/list/theme/permissions.

- [ ] **Step 8: Wire only the admin navigation**

`App.jsx` imports `Settings` and renders:

```jsx
{activeTab === 'settings' && <Settings />}
```

`Sidebar.jsx` navigation gets:

```js
{ id: 'settings', label: 'Configurações', icon: 'settings' }
```

`MobileNavigation.jsx` adds `settings` to `moreActive` and one `Configurações` button under `Mais`; do not add it to `directItems`.

- [ ] **Step 9: Run GREEN + admin regressions**

```bash
node --test src/api/kitchenTvSettingsClient.test.js src/pages/kitchenTvSettingsModel.test.js src/pages/Settings.test.js src/components/PrintingSettings.test.js
npm run lint
```

- [ ] **Step 10: Commit**

```bash
git add src/api/client.js src/api/kitchenTvSettingsClient.test.js src/pages/kitchenTvSettingsModel.js src/pages/kitchenTvSettingsModel.test.js src/pages/Settings.jsx src/pages/Settings.test.js src/kitchen-tv-settings.css src/App.jsx src/components/Sidebar.jsx src/components/MobileNavigation.jsx
git commit -m "feat: add kitchen tv settings"
```

---

### Task 7: Split `/cozinha-tv` away from the administrative bundle

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
- `getAppEntryMode(pathname) -> 'tv' | 'admin'`, TV only for exact `/cozinha-tv`.
- `main.jsx` statically imports only React/ReactDOM + entry-mode helper; roots are dynamic imports.
- `AdminRoot.jsx` owns current admin CSS/theme initialization + `ThemeProvider` + `App`.
- `KitchenTvRoot.jsx` imports only TV CSS + `KitchenTvApp`.

- [ ] **Step 1: Write RED tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getAppEntryMode } from './appEntryMode.js'

test('only /cozinha-tv selects TV mode', () => {
  assert.equal(getAppEntryMode('/cozinha-tv'), 'tv')
  assert.equal(getAppEntryMode('/'), 'admin')
  assert.equal(getAppEntryMode('/orders'), 'admin')
})
```

`src/mainKitchenTvEntry.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const main = await readFile(new URL('./main.jsx', import.meta.url), 'utf8')
test('main dynamically selects admin or TV without static admin imports', () => {
  assert.doesNotMatch(main, /import App from/)
  assert.doesNotMatch(main, /ThemeProvider/)
  assert.match(main, /import\('\.\/AdminRoot\.jsx'\)/)
  assert.match(main, /import\('\.\/tv\/KitchenTvRoot\.jsx'\)/)
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/appEntryMode.test.js src/mainKitchenTvEntry.test.js
```

- [ ] **Step 3: Move current admin root concerns into `AdminRoot.jsx`**

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

- [ ] **Step 4: Implement pure entry mode and dynamic `main.jsx`**

```js
export const getAppEntryMode = (pathname) => pathname === '/cozinha-tv' ? 'tv' : 'admin'
```

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

- [ ] **Step 5: Add the independent TV root/shell**

`KitchenTvRoot.jsx` imports only `./kitchen-tv.css` and `KitchenTvApp`. At this task boundary `KitchenTvApp` renders a real dark loading surface `Carregando painel da cozinha…`; later tasks replace its internals with live behavior. It must not import admin App/theme/printing modules.

- [ ] **Step 6: Run GREEN + build**

```bash
node --test src/appEntryMode.test.js src/mainKitchenTvEntry.test.js
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/AdminRoot.jsx src/appEntryMode.js src/appEntryMode.test.js src/mainKitchenTvEntry.test.js src/main.jsx src/tv/KitchenTvRoot.jsx src/tv/KitchenTvApp.jsx src/tv/kitchen-tv.css
git commit -m "perf: split kitchen tv entry bundle"
```

---

### Task 8: Implement TV pairing/start/live-session lifecycle and sound/fullscreen

**Files:**
- Create: `src/tv/kitchenTvApi.js`
- Create: `src/tv/kitchenTvSession.js`
- Create: `src/tv/kitchenTvSession.test.js`
- Create: `src/tv/kitchenTvAudio.js`
- Create: `src/tv/kitchenTvAudio.test.js`
- Modify: `src/tv/KitchenTvApp.jsx`
- Create: `src/tv/KitchenTvApp.test.js`

**Interfaces:**
- TV network: `pairKitchenTv(token)`, `getKitchenTvState()`; no import from `src/api/client.js`.
- Pure session helpers:
  - `extractKitchenTvPairingToken(search)`
  - `bootstrapKitchenTvSession({ search, pair, getState, replaceUrl }) -> Promise<{ orders }>`
  - `refreshKitchenTvSession({ currentOrders, getState }) -> Promise<{ kind, orders, error? }>` where kind is `ok | stale | unauthorized`.
- Audio: `ensureKitchenTvAudio(ref) -> Promise<boolean>`, `playKitchenTvAlert(ref) -> Promise<boolean>`.
- App phases: `loading | ready | live | unauthorized | error`.
- Poll interval `2_000`; clock interval `1_000`; highlight `6_000` ms.

- [ ] **Step 1: Write concrete session-helper RED tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapKitchenTvSession, extractKitchenTvPairingToken, refreshKitchenTvSession } from './kitchenTvSession.js'

test('bootstrap pairs token, cleans URL and loads initial state', async () => {
  const calls = []
  const result = await bootstrapKitchenTvSession({
    search: '?token=pair%2Bsecret',
    pair: async (token) => { calls.push(['pair', token]) },
    getState: async () => { calls.push(['state']); return { orders: [{ id: 'o1' }] } },
    replaceUrl: (url) => { calls.push(['replace', url]) },
  })
  assert.equal(extractKitchenTvPairingToken('?token=pair%2Bsecret'), 'pair+secret')
  assert.deepEqual(result.orders, [{ id: 'o1' }])
  assert.deepEqual(calls, [['pair', 'pair+secret'], ['replace', '/cozinha-tv'], ['state']])
})

test('refresh preserves stale data on 500 and clears it on 401', async () => {
  const currentOrders = [{ id: 'o1' }]
  const serverError = Object.assign(new Error('server'), { status: 500 })
  const unauthorized = Object.assign(new Error('unauthorized'), { status: 401 })
  assert.deepEqual(await refreshKitchenTvSession({ currentOrders, getState: async () => { throw serverError } }), { kind: 'stale', orders: currentOrders, error: serverError })
  assert.deepEqual(await refreshKitchenTvSession({ currentOrders, getState: async () => { throw unauthorized } }), { kind: 'unauthorized', orders: [], error: unauthorized })
})
```

- [ ] **Step 2: Write TV audio RED test with a complete fake AudioContext**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureKitchenTvAudio, playKitchenTvAlert } from './kitchenTvAudio.js'

class FakeAudioContext {
  constructor() { this.state = 'suspended'; this.currentTime = 1; this.started = 0 }
  async resume() { this.state = 'running' }
  createOscillator() {
    return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start: () => { this.started += 1 }, stop() {} }
  }
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
  }
  get destination() { return {} }
}

test('audio helper unlocks and plays two tones without throwing', async () => {
  const previousWindow = globalThis.window
  globalThis.window = { AudioContext: FakeAudioContext }
  const ref = { current: null }
  try {
    assert.equal(await ensureKitchenTvAudio(ref), true)
    assert.equal(await playKitchenTvAlert(ref), true)
    assert.equal(ref.current.started, 2)
  } finally { globalThis.window = previousWindow }
})
```

- [ ] **Step 3: Run RED**

```bash
node --test src/tv/kitchenTvSession.test.js src/tv/kitchenTvAudio.test.js
```

- [ ] **Step 4: Implement the tiny TV-only API**

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
export const pairKitchenTv = (token) => request('/api/kitchen-tv/pair', { method: 'POST', body: JSON.stringify({ token }) })
export const getKitchenTvState = () => request('/api/kitchen-tv/state')
```

- [ ] **Step 5: Implement pure session helpers to satisfy Step 1 exactly**

`bootstrapKitchenTvSession` pairs only when token exists, calls `replaceUrl('/cozinha-tv')` immediately after successful pairing, then fetches state. `refreshKitchenTvSession` returns `{ kind:'ok', orders:payload.orders }` on success, stale current orders for non-401 errors, and empty orders for 401.

- [ ] **Step 6: Implement `kitchenTvAudio.js` to satisfy Step 2**

Use `window.AudioContext || window.webkitAudioContext`, resume when suspended, and play 784 Hz then 988 Hz sine tones with the same short envelope as current Cozinha. Catch policy/unsupported errors and return `false`.

- [ ] **Step 7: Write `KitchenTvApp` source-wiring RED test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'

const source = await readFile(new URL('./KitchenTvApp.jsx', import.meta.url), 'utf8'
test('TV app wires approved polling, arrival, fullscreen and audio behavior', async () => {
  assert.match(source, /bootstrapKitchenTvSession/)
  assert.match(source, /refreshKitchenTvSession/)
  assert.match(source, /detectOperationalArrivals/)
  assert.match(source, /2_000|2000/)
  assert.match(source, /1_000|1000/)
  assert.match(source, /6_000|6000/)
  assert.match(source, /requestFullscreen/)
  assert.match(source, /ensureKitchenTvAudio/)
  assert.match(source, /playKitchenTvAlert/)
  assert.match(source, /Iniciar painel da cozinha/)
  await transformWithOxc(source, 'KitchenTvApp.jsx', { jsx: { runtime: 'automatic' } })
})
```

Correct the missing closing parenthesis in the first `readFile(...)` line while creating the actual test file:

```js
const source = await readFile(new URL('./KitchenTvApp.jsx', import.meta.url), 'utf8')
```

- [ ] **Step 8: Run app-wiring RED**

```bash
node --test src/tv/KitchenTvApp.test.js
```

- [ ] **Step 9: Implement `KitchenTvApp` lifecycle**

Required behavior:

1. Boot with `bootstrapKitchenTvSession({ search: window.location.search, pair: pairKitchenTv, getState: getKitchenTvState, replaceUrl: (url) => history.replaceState(null, '', url) })`.
2. On boot success, seed orders and show phase `ready` with one `Iniciar painel da cozinha` button.
3. Start button calls `ensureKitchenTvAudio(audioContextRef)`, attempts `document.documentElement.requestFullscreen?.()`, then enters `live` even if fullscreen fails.
4. While live, update `now` every 1 second.
5. While live and visible, refresh immediately and every 2 seconds; also refresh on browser `online`, focus, and visibility becoming visible.
6. `ok` refresh updates orders/lastUpdated and clears stale state.
7. `stale` preserves current orders and shows stale state.
8. `unauthorized` clears orders and switches to unauthorized screen.
9. Use `detectOperationalArrivals` with `knownOperationalIdsRef` initially `undefined`; first evaluation seeds without alert.
10. New operational ids trigger `playKitchenTvAlert`, a 6-second highlight set, and `audioNeedsInteraction` if audio returns false.
11. If audio needs interaction, expose a small action that calls `ensureKitchenTvAudio` again.
12. Never persist queue data to LocalStorage/IndexedDB.

- [ ] **Step 10: Run GREEN + realtime regressions**

```bash
node --test src/tv/kitchenTvSession.test.js src/tv/kitchenTvAudio.test.js src/tv/KitchenTvApp.test.js src/utils/orderRealtime.test.js src/utils/kitchenOperationalQueue.test.js
```

- [ ] **Step 11: Commit**

```bash
git add src/tv/kitchenTvApi.js src/tv/kitchenTvSession.js src/tv/kitchenTvSession.test.js src/tv/kitchenTvAudio.js src/tv/kitchenTvAudio.test.js src/tv/KitchenTvApp.jsx src/tv/KitchenTvApp.test.js
git commit -m "feat: run live kitchen tv session"
```

---

### Task 9: Build the approved customer-first board with 4+3 capacity and no pagination

**Files:**
- Create: `src/tv/kitchenTvPresentation.js`
- Create: `src/tv/kitchenTvPresentation.test.js`
- Create: `src/tv/KitchenTvBoard.jsx`
- Create: `src/tv/KitchenTvOrderCard.jsx`
- Create: `src/tv/KitchenTvBoard.test.js`
- Modify: `src/tv/KitchenTvApp.jsx`
- Modify: `src/tv/kitchen-tv.css`

**Interfaces:**
- `PREPARING_VISIBLE_LIMIT = 4`, `SCHEDULED_VISIBLE_LIMIT = 3`.
- `buildKitchenTvPresentation(orders, now) -> { preparing, scheduled, preparingOverflow, scheduledOverflow, counts }`.
- `KitchenTvBoard({ orders, now, highlightedOrderIds, stale, lastUpdatedAt, audioNeedsInteraction, onEnableAudio })`.
- `KitchenTvOrderCard({ entry, now, variant, highlighted })`.

- [ ] **Step 1: Write complete presentation RED tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKitchenTvPresentation } from './kitchenTvPresentation.js'

const immediate = (id, minute) => ({
  id, orderNumber: Number(id.slice(1)), client: `Cliente ${id}`, type: 'Local', status: 'Em preparo',
  createdAt: `2026-09-09T10:${String(minute).padStart(2, '0')}:00.000Z`, scheduledFor: null, items: [],
})
const scheduled = (id, hour, minute) => ({
  id, orderNumber: Number(id.slice(1)), client: `Cliente ${id}`, type: 'Entrega', status: 'Em preparo',
  createdAt: '2026-09-09T10:00:00.000Z',
  scheduledFor: `2026-09-09T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`, items: [],
})
const now = new Date('2026-09-09T12:00:00.000Z')
const orders = [
  immediate('p1', 0), immediate('p2', 1), immediate('p3', 2), immediate('p4', 3), immediate('p5', 4), immediate('p6', 5),
  scheduled('s1', 14, 0), scheduled('s2', 14, 15), scheduled('s3', 14, 30), scheduled('s4', 14, 45), scheduled('s5', 15, 0),
]

test('presentation caps at four preparing and three scheduled and reports overflow', () => {
  const model = buildKitchenTvPresentation(orders, now)
  assert.deepEqual(model.preparing.map(({ order }) => order.id), ['p1', 'p2', 'p3', 'p4'])
  assert.deepEqual(model.scheduled.map(({ order }) => order.id), ['s1', 's2', 's3'])
  assert.equal(model.preparingOverflow, 2)
  assert.equal(model.scheduledOverflow, 2)
})

test('removing a visible order naturally pulls the next priority into its slot', () => {
  const model = buildKitchenTvPresentation(orders.filter(({ id }) => id !== 'p1'), now)
  assert.deepEqual(model.preparing.map(({ order }) => order.id), ['p2', 'p3', 'p4', 'p5'])
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/tv/kitchenTvPresentation.test.js
```

- [ ] **Step 3: Implement the pure presentation selector**

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

- [ ] **Step 4: Write board/card source RED tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'

const board = await readFile(new URL('./KitchenTvBoard.jsx', import.meta.url), 'utf8').catch(() => '')
const card = await readFile(new URL('./KitchenTvOrderCard.jsx', import.meta.url), 'utf8').catch(() => '')

test('board uses approved two-section read-only customer-first hierarchy', async () => {
  assert.match(board, /Cozinha TV/)
  assert.match(board, /Modo acompanhamento/)
  assert.match(board, /Apenas visualização/)
  assert.match(board, /Em preparo/)
  assert.match(board, /Agendados/)
  assert.doesNotMatch(board, /Novos/)
  assert.doesNotMatch(board + card, /Finalizar|Cancelar pedido|Imprimir|Novo pedido/)
  assert.match(card, /<h3>\{entry\.order\.client/)
  assert.match(card, /Acabou de entrar/)
  assert.match(card, /<small>/)
  await transformWithOxc(board, 'KitchenTvBoard.jsx', { jsx: { runtime: 'automatic' } })
  await transformWithOxc(card, 'KitchenTvOrderCard.jsx', { jsx: { runtime: 'automatic' } })
})
```

- [ ] **Step 5: Run board RED**

```bash
node --test src/tv/KitchenTvBoard.test.js
```

- [ ] **Step 6: Implement `KitchenTvOrderCard.jsx` with name first**

Use `formatOrderDisplayNumber`, `getOperationalElapsedMinutes`, `formatElapsedDuration`, and `formatOrderTime`. Required structure:

```jsx
<article className={`kitchen-tv-card ${variant}${highlighted ? ' recent' : ''}`}>
  <div className="kitchen-tv-card-head">
    <h3>{entry.order.client || 'Cliente'}</h3>
    {highlighted && <span className="kitchen-tv-recent-badge">Acabou de entrar</span>}
  </div>
  <div className="kitchen-tv-card-meta">
    <strong>{variant === 'scheduled' ? formatOrderTime(entry.order.scheduledFor) : formatElapsedDuration(getOperationalElapsedMinutes(entry.order, now))}</strong>
    <span className="kitchen-tv-type">{entry.order.type}</span>
    <small>{formatOrderDisplayNumber(entry.order)}</small>
  </div>
  <ul>
    {entry.order.items.map((item, index) => (
      <li key={`${entry.order.id}:${index}`}><b>{item.quantity}×</b> {item.name}{item.note && <em>{item.note}</em>}</li>
    ))}
  </ul>
</article>
```

- [ ] **Step 7: Implement `KitchenTvBoard.jsx` + fixed dark CSS**

Required layout:

- header: left `Cozinha TV`/Gestão Delivery identity; large current time centered with date below; right `Modo acompanhamento` + `Apenas visualização`;
- body: CSS grid `minmax(0, 3fr) minmax(18rem, 1fr)` for the approved ~75/25 split;
- preparing: stable 2×2 grid;
- scheduled: three stacked compact cards;
- preparing overflow text `+ N pedidos aguardando espaço`;
- scheduled overflow text `+ N agendados aguardando espaço`;
- stale banner exactly `Sem conexão — aguardando reconexão` for browser-offline state; for server transient failure use `Atualização interrompida — tentando reconectar`;
- CSS-only border/glow for `.recent`; no animation library/canvas/video/images;
- audio-reenable action only when `audioNeedsInteraction` is true.

- [ ] **Step 8: Wire live `KitchenTvApp` to the board**

For `phase === 'live'`, render `KitchenTvBoard` with current state. `ready`, `unauthorized`, `loading`, `error` remain dedicated simple screens outside the board.

- [ ] **Step 9: Run GREEN + lint/build**

```bash
node --test src/tv/kitchenTvPresentation.test.js src/tv/KitchenTvBoard.test.js src/tv/KitchenTvApp.test.js
npm run lint
npm run build
```

- [ ] **Step 10: Commit**

```bash
git add src/tv/kitchenTvPresentation.js src/tv/kitchenTvPresentation.test.js src/tv/KitchenTvBoard.jsx src/tv/KitchenTvOrderCard.jsx src/tv/KitchenTvBoard.test.js src/tv/KitchenTvApp.jsx src/tv/kitchen-tv.css
git commit -m "feat: render kitchen tv board"
```

---

### Task 10: Harden boundaries, run full regressions, and homologate only in staging

**Files:**
- Create: `src/tv/kitchenTvBoundary.test.js`
- Create: `worker/kitchenTvSecurityRegression.test.js`
- Modify only a responsible implementation file if a new acceptance test exposes a real defect; do not add product scope.

- [ ] **Step 1: Write frontend bundle-boundary test with all variables defined**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8')
const [main, root, app, api] = await Promise.all([
  read('../main.jsx'), read('./KitchenTvRoot.jsx'), read('./KitchenTvApp.jsx'), read('./kitchenTvApi.js'),
])
const tvSources = [root, app, api].join('\n')

test('TV entry does not import admin bootstrap or printing stack', () => {
  assert.doesNotMatch(tvSources, /\/api\/bootstrap/)
  assert.doesNotMatch(tvSources, /qz-tray|jspdf|usePrintingManager|PrintingSettings|AdminRoot/)
  assert.doesNotMatch(main, /import App from/)
  assert.match(main, /import\('\.\/tv\/KitchenTvRoot\.jsx'\)/)
})
```

- [ ] **Step 2: Write Worker security regression test with real pairing flow**

Use `createMigratedD1`, `createSession`, and `handleRequest` exactly as in Task 5. After obtaining a valid `tvCookie`, assert:

```js
for (const path of ['/api/orders', '/api/bootstrap', '/api/printing/settings', '/api/kitchen-tv/settings']) {
  const response = await handleRequest(new Request(`${origin}${path}`, { headers: { cookie: tvCookie } }), env)
  assert.equal(response.status, 401, path)
}
const state = await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, { headers: { cookie: tvCookie } }), env)
assert.equal(state.status, 200)
```

Then revoke with the admin cookie and assert the next state call is 401. Do not duplicate sensitive-field mapping assertions here; Task 4 is the nonempty payload contract test.

- [ ] **Step 3: Run acceptance tests RED/GREEN**

```bash
node --test src/tv/kitchenTvBoundary.test.js worker/kitchenTvSecurityRegression.test.js
```

If RED exposes a defect, edit only the responsible implementation file and rerun until PASS.

- [ ] **Step 4: Run focused Kitchen TV + Cozinha + printing regressions**

```bash
node --test \
  src/utils/kitchenOperationalQueue.test.js \
  src/utils/kitchenQueue.test.js \
  src/utils/orderRealtime.test.js \
  src/tv/*.test.js \
  src/pages/kitchenTvSettingsModel.test.js \
  src/pages/Settings.test.js \
  src/api/kitchenTvSettingsClient.test.js \
  worker/kitchenTv*.test.js \
  worker/auth.test.js \
  worker/orderPrintingHttp.test.js \
  worker/orderPrintingPriorityHttp.test.js \
  worker/orderPrintingReprintHttp.test.js
```

- [ ] **Step 5: Run full repository verification**

```bash
npm test
npm run lint
npm run build
```

Expected: all PASS; Vite still uses lazy AdminRoot/KitchenTvRoot chunks.

- [ ] **Step 6: Apply migrations locally and smoke locally**

```bash
npm run d1:migrate:local
npm run dev:worker
```

Manual local checklist:

1. Admin login still works.
2. `Configurações > TV da Cozinha` opens; centralized printing settings/fila still work.
3. Generate one access link.
4. Open it in a separate/incognito browser; pairing succeeds and URL becomes `/cozinha-tv` without token.
5. Open the consumed link in another incognito context; pairing fails generically.
6. Click `Iniciar painel da cozinha`; fullscreen is attempted; panel still works if denied.
7. Create immediate order in normal app; TV displays it within polling cadence, highlights, and attempts sound.
8. Finalize it in normal Cozinha; TV removes it and next queued card fills the space.
9. Toggle browser offline; last queue remains visible with stale warning; reconnect refreshes.
10. Revoke from Configurações; TV clears orders on next refresh and shows unauthorized state.

Stop the local worker after smoke.

- [ ] **Step 7: Commit final boundary tests**

```bash
git add src/tv/kitchenTvBoundary.test.js worker/kitchenTvSecurityRegression.test.js
git commit -m "test: harden kitchen tv boundaries"
```

- [ ] **Step 8: Check final remote integration head before staging deploy**

```bash
git fetch origin
git status --short
git log --oneline --decorate -10
```

If the intended staging base advanced after implementation began, rebase in the isolated worktree using the project's normal workflow, preserve both print-queue and TV contracts while resolving shared files, then rerun Steps 4–5.

- [ ] **Step 9: Apply only staging migration/deploy**

```bash
npm run d1:migrate:staging
npm run deploy:staging
```

Do not run `d1:migrate:production` or `deploy:production`.

- [ ] **Step 10: Staging homologation checklist**

1. Admin app and centralized printing still behave normally.
2. Configurações creates one one-time link.
3. TV network never requests `/api/bootstrap`.
4. TV initial/live network does not fetch QZ/printing/admin-page chunks.
5. `/api/kitchen-tv/state` contains only active kitchen-safe fields.
6. Immediate order appears, highlights and sounds once.
7. Automated timing tests prove scheduled order crosses at the existing 50-minute boundary; manually confirm scheduled visual placement with a future scheduled order.
8. Customer name is dominant; order number is secondary.
9. Maximum visible cards are 4 preparing + 3 scheduled; overflow is correct; no pagination.
10. Finalization in normal Cozinha removes card on next TV refresh.
11. Offline/transient failure keeps stale queue with explicit warning.
12. Revocation clears queue and blocks next state read.
13. Re-pair requires a new generated link.
14. Admin theme changes do not change fixed TV dark theme.
15. No production deployment occurs until explicit user approval after staging.

- [ ] **Step 11: Record homologation evidence**

Record the staging URL, tested commit SHA, applied Kitchen TV migration filename, automated commands/results, and browser/TV-box compatibility observations in the project's implementation ledger/PR notes. Do not mark production-ready until the user approves staging behavior.

---

## Plan Self-Review

### Spec coverage

- One TV / monodispositivo: Tasks 2, 3, 6.
- No normal PIN on TV: Tasks 3, 5, 8.
- One-time pairing and clean URL: Tasks 3, 5, 8.
- Persistent restricted TV session: Tasks 3, 5.
- TV/admin auth separation: Tasks 3, 5, 10.
- Minimal active-only payload: Task 4 + Task 10.
- No admin bootstrap/full app load: Task 7 + Task 10.
- Same Cozinha timing/order/late rules: Task 1 + Tasks 8–9.
- Immediate + scheduled operational arrival alert: Task 8.
- No `Novos`: Tasks 8–9.
- Customer-first cards: Task 9.
- 4 + 3 capacity/no pagination/natural refill: Task 9.
- Dark large-screen layout: Task 9.
- Audio/fullscreen interaction + audio fallback: Task 8 + Task 9.
- Offline stale vs revoked clear state: Task 8 + Task 10.
- Minimal Configurações UI: Task 6.
- Staging-only deploy/homologation: Task 10.
- Print-queue conflict control: Global Constraints + Task 10.

### Placeholder scan

No `TBD`, `TODO`, “implement later”, “similar to”, comment-only test bodies, or undefined fixture/helper names remain. Test helpers used by later tasks are explicitly defined in Task 2 or in the same test snippet.

### Type/name consistency

Producer/consumer names are fixed across tasks:

- `buildKitchenOperationalQueue`
- `createMigratedD1`
- `loadKitchenTvAccess`
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
- `revokeKitchenTvAccessSession`
- `listKitchenTvOrders`
- `handleKitchenTvPublicApi`
- `handleKitchenTvAdminApi`
- `getKitchenTvSettings` / `generateKitchenTvAccess` / `revokeKitchenTvAccess` in the **admin client module** (module-scoped names intentionally mirror HTTP actions; do not import them into Worker code)
- `pairKitchenTv`
- `getKitchenTvState`
- `bootstrapKitchenTvSession`
- `refreshKitchenTvSession`
- `buildKitchenTvPresentation`

Do not rename one side of an interface without updating its producing and consuming tasks together.

---

## Execution Handoff

This plan is **ready but intentionally blocked** until the centralized print queue is finished/homologated. Do not start Kitchen TV implementation merely because the plan exists.

After the execution gate is cleared:

1. **Subagent-Driven (recommended)** — use `superpowers:subagent-driven-development`; fresh subagent per task with review between tasks.
2. **Inline Execution** — use `superpowers:executing-plans`; execute in batches with checkpoints.

In either mode, begin with the isolated-worktree + final-print-queue rebase/baseline verification in Global Constraints, then execute Tasks 1–10 in order.
