# Notification Center and Operation Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent authenticated top-bar utilities, operational badges for Pedidos and Comandas, and a device-local notification center that initially publishes Gestão Delivery release notes.

**Architecture:** Orders and Table Service own their operational counters and expose them through public domain entries. The app shell receives only calculated counts plus the authenticated `businessId`; notification state lives under `src/app/notifications/`, persists per device in `localStorage`, and renders through one top-bar entry point with desktop drawer/mobile BottomSheet behavior. No new backend endpoint, migration, polling loop, WebSocket or SSE is introduced.

**Tech Stack:** React 19.2.8, React DOM 19.2.8, Node `node:test`, react-test-renderer 19.2.8, Vite 8.2.2, existing CSS token system, browser `localStorage`.

**Spec:** `docs/superpowers/specs/2026-09-21-notification-center-and-operation-shell-design.md`

## Global Constraints

- Work only on `feature/notifications-center-shell`; do not implement on `master`.
- Follow TDD RED → GREEN for every product task and commit each independently reviewable GREEN.
- Do not add an API endpoint, Worker route, D1 table, migration, WebSocket, SSE, service worker or push-notification dependency.
- Do not create a new polling loop for either operational badge.
- Reuse the existing 5 s global sync and 2 s Orders sync.
- `Pedidos` badge means operational-now orders; scheduled orders still waiting for their preparation window do not count.
- `Comandas` badge means distinct open comandas, deduplicated by `tableTabId`.
- Notification read/presented state is per device and per authenticated `businessId`; logout must not clear it.
- The V1 notification source is only the frontend release catalog.
- Initial notification page size is exactly 20; each `Ver mais notificações` adds exactly 20.
- Visual badge copy is capped at `99+`, while accessible copy retains the real count.
- Desktop notification center uses a right-side drawer; mobile uses the existing `BottomSheet`.
- Mobile notification detail replaces the list inside the same BottomSheet; do not stack a detail modal over it.
- Desktop may stack the existing accessible `Modal` detail above the drawer.
- `AS` means Amor & Sabor / current operation, not a personal user profile.
- Existing navigation capability resolution is authoritative; do not create parallel access rules.
- Use existing design tokens for light/dark themes; do not introduce a notification-specific palette.
- Merge and production deployment require explicit user authorization after staging QA.

## File Structure

### Domain ownership

- `src/domains/orders/domain/orderRealtime.js` — operational Orders identity/count and schedule-window semantics.
- `src/domains/orders/domain/orderRealtime.test.js` — pure Orders counter and current-timing tests.
- `src/domains/orders/application/useOrderArrivals.js` / test — keep sound/highlight arrival semantics aligned with the same current timing.
- `src/domains/orders/index.js` — public export for `getOperationalOrderCount`.
- `src/domains/table-service/domain/comandaActivity.js` — pure distinct-open-comanda selector/count.
- `src/domains/table-service/domain/comandaActivity.test.js` — open/closed/transfer/duplicate projection tests.
- `src/domains/table-service/index.js` — public export for `getOpenComandaCount`.

### Shell ownership

- `src/app/shell/navigationBadges.js` / test — shared badge formatting and accessible copy from resolved navigation entries.
- `src/app/shell/Sidebar.jsx` — desktop badge rendering only.
- `src/app/shell/MobileNavigation.jsx` — mobile badge rendering only.
- `src/app/shell/NavigationBadgesUi.test.js` — Sidebar/MobileNavigation integration and capability fallback privacy.
- `src/app/shell/OperationMenu.jsx` / test — `AS` menu, navigation shortcuts, about surface, logout.
- `src/app/shell/AppTopBar.jsx` / test — global authenticated utility bar composition.
- `src/app/shell/AppShell.jsx` / test — place top bar inside main shell and distribute badge props.
- `src/navigation-badges.css` — shared desktop/mobile operational-badge positioning and visual treatment.
- `src/app-top-bar.css` — top bar and operation-menu styling.
- `src/mobile-navigation.css` — existing bottom-nav layout; modify only if badge fit needs a mobile-specific adjustment.
- `src/shared/ui/Icon.jsx` — add bell/logout icons if absent.

### Notification ownership

- `src/app/notifications/notificationCatalog.js` — normalized V1 release catalog and current release metadata.
- `src/app/notifications/notificationStore.js` / test — per-business storage key, baseline, pruning, presented/read transitions and localStorage fallback.
- `src/app/notifications/useNotifications.js` / test — React state wrapper around the pure store.
- `src/app/notifications/NotificationCenter.jsx` — list, incremental 20-item window and mobile inline detail.
- `src/app/notifications/ReleaseNotesModal.jsx` — automatic release notice and desktop detail modal body.
- `src/app/notifications/NotificationsEntryPoint.jsx` / test — bell, unread badge, desktop drawer/mobile sheet, detail orchestration; accepts optional `catalog`/`storage` injection for deterministic tests.
- `src/notification-center.css` — drawer, list/detail, unread and responsive styling.
- `src/shared/ui/Modal.jsx` — optional backdrop class for right-side drawer placement without duplicating focus/scroll-lock behavior.
- `src/bottomSheet.test.js` — preserve shared modal accessibility while adding the optional class.

### App composition and regression

- `src/App.jsx` — derive domain counts, pass current timing to arrivals, pass `businessId` and badges into `AppShell`.
- `src/realtimeSyncRegression.test.js` — prove no polling/network cadence change.
- `src/appShellNotificationsRegression.test.js` — source-level shell/notifications ownership and responsive regression.
- `src/actionCapabilities.test.js` — prove restricted capability sessions do not expose unauthorized shortcuts.
- `docs/superpowers/qa/notification-center-shell-qa.md` — staging/manual QA evidence after executable GREEN.

## Review Focus

1. **Restricted Orders access that resolves the area to Histórico instead of Cozinha:** the user must not see the active-order count; Task 3 adds an explicit fallback-capability test.
2. **Malformed, unavailable or quota-failing `localStorage`:** the shell must still load and the notification state must continue in memory; Tasks 4–5 test read and write failures.
3. **Two or more releases added while a device was offline:** only the newest catalog item may auto-open; older unseen releases remain accessible/unread without becoming a modal queue; Task 5 pins this.
4. **Transient Table Service projections during transfer/payment:** duplicate `tableTabId` values must count once and a known closed tab must not count even if a stale table projection still says occupied; Task 2 pins both cases.
5. **Same browser authenticates a different `businessId`:** read state must not bleed across businesses; Task 5 remounts/rekeys the hook and proves isolation.

---

### Task 1: Make Orders expose the authoritative operational count

**Files:**
- Modify: `src/domains/orders/domain/orderRealtime.js`
- Modify: `src/domains/orders/domain/orderRealtime.test.js`
- Modify: `src/domains/orders/application/useOrderArrivals.js`
- Modify: `src/domains/orders/application/useOrderArrivals.test.js`
- Modify: `src/domains/orders/index.js`

**Interfaces:**
- Consumes: `isScheduledWaiting(order, now, currentTiming)`, existing order lifecycle semantics.
- Produces: `getOperationalOrderCount(orders, now?, currentTiming?) -> number`; existing arrival functions accept optional `currentTiming` without breaking current callers.

- [ ] **Step 1: Write RED tests for custom timing and count**

Add to `orderRealtime.test.js`:

```js
import {
  detectOperationalArrivals,
  getNewOperationalOrderIds,
  getOperationalOrderCount,
  operationalOrderIdSet,
} from './orderRealtime.js'

test('operational count uses the current timing policy and excludes future scheduled work', () => {
  const order = {
    id: 'scheduled-policy',
    type: 'Entrega',
    status: 'Em preparo',
    createdAt: '2026-09-21T12:00:00.000Z',
    scheduledFor: '2026-09-21T15:00:00.000Z',
  }
  const timing = {
    scheduledPrepLeadMinutes: 30,
    scheduledLateGraceMinutes: 15,
    immediateLateAfterMinutes: 30,
    immediateVeryLateAfterMinutes: 60,
  }

  assert.equal(getOperationalOrderCount([order], new Date('2026-09-21T14:29:59.000Z'), timing), 0)
  assert.equal(getOperationalOrderCount([order], new Date('2026-09-21T14:30:00.000Z'), timing), 1)
})

test('operational count excludes terminal and legacy finished statuses', () => {
  const now = new Date('2026-09-21T18:00:00-03:00')
  assert.equal(getOperationalOrderCount([
    { id: 'active', status: 'Em preparo' },
    { id: 'finalized', status: 'Finalizado' },
    { id: 'cancelled', status: 'Cancelado' },
    { id: 'delivered', status: 'Entregue' },
    { id: 'dispatched', status: 'Despachado' },
  ], now), 1)
})
```

Extend `useOrderArrivals.test.js` with a probe that supplies a non-legacy `currentTiming` and proves the scheduled order alerts exactly at that configured boundary.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test src/domains/orders/domain/orderRealtime.test.js src/domains/orders/application/useOrderArrivals.test.js
```

Expected: FAIL because `getOperationalOrderCount` does not exist and arrival detection ignores `currentTiming`.

- [ ] **Step 3: Implement the minimal domain contract**

Change signatures in `orderRealtime.js`:

```js
export const operationalOrderIdSet = (orders = [], now = new Date(), currentTiming) => new Set(
  orders
    .filter((order) => isActiveOrder(order) && !isScheduledWaiting(order, now, currentTiming))
    .map((order) => String(order.id)),
)

export const getOperationalOrderCount = (orders = [], now = new Date(), currentTiming) => (
  operationalOrderIdSet(orders, now, currentTiming).size
)

export const getNewOperationalOrderIds = (previousIds, orders = [], now = new Date(), currentTiming) => {
  const knownIds = previousIds instanceof Set ? previousIds : new Set(previousIds ?? [])
  return [...operationalOrderIdSet(orders, now, currentTiming)].filter((id) => !knownIds.has(id))
}

export const detectOperationalArrivals = (
  previousIds,
  orders = [],
  now = new Date(),
  alertedIds = new Set(),
  currentTiming,
) => {
  const currentIds = operationalOrderIdSet(orders, now, currentTiming)
  if (previousIds === undefined || previousIds === null) return { currentIds, newIds: [] }
  const knownIds = previousIds instanceof Set ? previousIds : new Set(previousIds)
  const alreadyAlerted = alertedIds instanceof Set ? alertedIds : new Set(alertedIds ?? [])
  const newIds = [...currentIds].filter((id) => !knownIds.has(id) && !alreadyAlerted.has(id))
  return { currentIds, newIds }
}
```

Update `useOrderArrivals`:

```js
export function useOrderArrivals({
  active,
  orders,
  now,
  currentTiming,
  soundEnabled,
  // existing injected dependencies...
}) {
  // ...
  const { currentIds, newIds } = detectOperationalArrivals(
    knownRef.current,
    orders,
    now,
    alertedRef.current,
    currentTiming,
  )
  // ...
}
```

Add `currentTiming` to that effect dependency list and export `getOperationalOrderCount` from `src/domains/orders/index.js`.

- [ ] **Step 4: Run GREEN**

Run:

```bash
node --test src/domains/orders/domain/orderRealtime.test.js src/domains/orders/application/useOrderArrivals.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/orders/domain/orderRealtime.js src/domains/orders/domain/orderRealtime.test.js src/domains/orders/application/useOrderArrivals.js src/domains/orders/application/useOrderArrivals.test.js src/domains/orders/index.js
git commit -m "feat: expose operational order count"
```

---

### Task 2: Add the Table Service open-comanda count

**Files:**
- Create: `src/domains/table-service/domain/comandaActivity.js`
- Create: `src/domains/table-service/domain/comandaActivity.test.js`
- Modify: `src/domains/table-service/index.js`

**Interfaces:**
- Consumes: `isOccupiedTable(table)`.
- Produces: `getOpenComandaCount(tables = [], tableTabs = []) -> number`.

- [ ] **Step 1: Write RED tests for open, close, transfer and stale projections**

Create `comandaActivity.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getOpenComandaCount } from './comandaActivity.js'

const occupied = (tableId, tabId) => ({
  id: tableId,
  isActive: true,
  occupancy: 'occupied',
  openTableTab: { id: tabId },
})

test('counts distinct open comandas and ignores free or identity-less tables', () => {
  assert.equal(getOpenComandaCount([
    occupied('table-1', 'tab-A'),
    occupied('table-2', 'tab-B'),
    { id: 'free', isActive: true, occupancy: 'free', openTableTab: null },
    { id: 'broken', isActive: true, occupancy: 'occupied', openTableTab: null },
  ], [
    { id: 'tab-A', status: 'open' },
    { id: 'tab-B', status: 'open' },
  ]), 2)
})

test('transfer or duplicate projections of the same tableTabId count once', () => {
  assert.equal(getOpenComandaCount([
    occupied('old-table', 'tab-A'),
    occupied('new-table', 'tab-A'),
  ], [{ id: 'tab-A', status: 'open' }]), 1)
})

test('known closed tab vetoes a stale occupied table projection', () => {
  assert.equal(getOpenComandaCount(
    [occupied('table-1', 'tab-A')],
    [{ id: 'tab-A', status: 'closed' }],
  ), 0)
})

test('missing tableTabs projection can temporarily trust the valid occupied table identity', () => {
  assert.equal(getOpenComandaCount([occupied('table-1', 'tab-A')], []), 1)
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/domains/table-service/domain/comandaActivity.test.js
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure selector**

Create `comandaActivity.js`:

```js
import { isOccupiedTable } from './tables.js'

export const getOpenComandaCount = (tables = [], tableTabs = []) => {
  const tabStatus = new Map(
    tableTabs
      .filter((tab) => tab?.id)
      .map((tab) => [String(tab.id), tab.status]),
  )
  const openIds = new Set()

  for (const table of tables) {
    if (!isOccupiedTable(table)) continue
    const tabId = String(table.openTableTab.id)
    if (tabStatus.has(tabId) && tabStatus.get(tabId) !== 'open') continue
    openIds.add(tabId)
  }

  return openIds.size
}
```

Export it from `src/domains/table-service/index.js`.

- [ ] **Step 4: Run GREEN plus existing identity tests**

```bash
node --test src/domains/table-service/domain/comandaActivity.test.js src/domains/table-service/domain/comandaIdentity.test.js src/domains/table-service/domain/tables.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/table-service/domain/comandaActivity.js src/domains/table-service/domain/comandaActivity.test.js src/domains/table-service/index.js
git commit -m "feat: expose open comanda count"
```

---

### Task 3: Render shared operational badges in desktop and mobile navigation

**Files:**
- Create: `src/app/shell/navigationBadges.js`
- Create: `src/app/shell/navigationBadges.test.js`
- Create: `src/app/shell/NavigationBadgesUi.test.js`
- Modify: `src/app/shell/Sidebar.jsx`
- Modify: `src/app/shell/MobileNavigation.jsx`
- Create: `src/navigation-badges.css`
- Modify: `src/mobile-navigation.css`

**Interfaces:**
- Consumes: resolved navigation entries from `resolveNavigationEntry`; `badges = { orders: number, comandas: number }`.
- Produces: `getNavigationBadge(entry, badges) -> null | { text, ariaLabel, count }`.

- [ ] **Step 1: Write RED pure tests including the restricted fallback case**

Create `navigationBadges.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getNavigationBadge } from './navigationBadges.js'

test('formats operational badges and caps only the visual value', () => {
  assert.deepEqual(getNavigationBadge(
    { id: 'orders', label: 'Pedidos' },
    { orders: 127 },
  ), {
    count: 127,
    text: '99+',
    ariaLabel: 'Pedidos, 127 pedidos em andamento',
  })
  assert.equal(getNavigationBadge({ id: 'orders', label: 'Pedidos' }, { orders: 0 }), null)
})

test('formats singular comanda copy', () => {
  assert.equal(
    getNavigationBadge({ id: 'comandas', label: 'Comandas' }, { comandas: 1 }).ariaLabel,
    'Comandas, 1 comanda aberta',
  )
})

test('history fallback never exposes the operational Orders count', () => {
  assert.equal(
    getNavigationBadge({ id: 'history', area: 'orders', label: 'Pedidos' }, { orders: 8 }),
    null,
  )
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/app/shell/navigationBadges.test.js
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the helper**

```js
const normalizedCount = (value) => {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

const copy = {
  orders: (count) => `${count} ${count === 1 ? 'pedido em andamento' : 'pedidos em andamento'}`,
  comandas: (count) => `${count} ${count === 1 ? 'comanda aberta' : 'comandas abertas'}`,
}

export const getNavigationBadge = (entry, badges = {}) => {
  const formatter = copy[entry?.id]
  if (!formatter) return null
  const count = normalizedCount(badges[entry.id])
  if (!count) return null
  return {
    count,
    text: count > 99 ? '99+' : String(count),
    ariaLabel: `${entry.label}, ${formatter(count)}`,
  }
}
```

- [ ] **Step 4: Write RED UI integration tests**

Create `NavigationBadgesUi.test.js` using `workspaceHarness`, `NavigationProvider`, `Sidebar` and `MobileNavigation`. Assert:

```js
const badges = { orders: 3, comandas: 2 }

assert.equal(
  renderer.root.findAllByProps({ className: 'navigation-badge' }).map((node) => node.children.join('')),
  ['3', '2'],
)
assert.ok(renderer.root.findByProps({ 'aria-label': 'Pedidos, 3 pedidos em andamento' }))
assert.ok(renderer.root.findByProps({ 'aria-label': 'Comandas, 2 comandas abertas' }))
```

Add a second render where `granted = new Set(['orders.history'])` and assert there is no `Pedidos, 3 pedidos em andamento` label.

- [ ] **Step 5: Run RED UI tests**

```bash
node --test src/app/shell/NavigationBadgesUi.test.js src/mobileNavigation.test.js
```

Expected: FAIL because Sidebar/MobileNavigation do not accept/render badges.

- [ ] **Step 6: Wire badges into both navigation components**

Change signatures to:

```js
function Sidebar({ onLogout, logoutDisabled = false, badges = {} }) { /* ... */ }
function MobileNavigation({ onLogout, logoutDisabled = false, badges = {} }) { /* ... */ }
```

For each already-resolved item:

```jsx
const badge = getNavigationBadge(item, badges)
<button
  // existing props
  aria-label={badge?.ariaLabel}
>
  <span className="navigation-icon-wrap">
    <Icon name={item.icon} size={20} />
    {badge && <span className="navigation-badge" aria-hidden="true">{badge.text}</span>}
  </span>
  <span>{item.label}</span>
</button>
```

Do not derive counts or statuses inside these components.

Import `../../navigation-badges.css` from both navigation components (Vite will deduplicate the stylesheet). Add CSS so the badge anchors to the icon and does not change nav-item width/height. Use existing `--primary`, `--surface`, `--text`/contrast tokens.

- [ ] **Step 7: Run GREEN**

```bash
node --test src/app/shell/navigationBadges.test.js src/app/shell/NavigationBadgesUi.test.js src/mobileNavigation.test.js src/app/navigation/resolution.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/shell/navigationBadges.js src/app/shell/navigationBadges.test.js src/app/shell/NavigationBadgesUi.test.js src/app/shell/Sidebar.jsx src/app/shell/MobileNavigation.jsx src/navigation-badges.css src/mobile-navigation.css
git commit -m "feat: show operational navigation badges"
```

---

### Task 4: Build the pure notification catalog and device store

**Files:**
- Create: `src/app/notifications/notificationCatalog.js`
- Create: `src/app/notifications/notificationStore.js`
- Create: `src/app/notifications/notificationStore.test.js`

**Interfaces:**
- Produces:
  - `SYSTEM_NOTIFICATIONS: readonly Notification[]`
  - `CURRENT_RELEASE: Notification`
  - `normalizeNotificationCatalog(items) -> Notification[]`
  - `notificationStorageKey(businessId) -> string | null`
  - `loadNotificationState({ storage, businessId, catalog }) -> NotificationState`
  - `saveNotificationState({ storage, businessId, state }) -> boolean`
  - `markPresented(state, id) -> NotificationState`
  - `markRead(state, id) -> NotificationState`
  - `getUnreadCount(catalog, state) -> number`
  - `getAutomaticNotification(catalog, state) -> Notification | null`

State shape:

```js
{
  version: 1,
  knownIds: string[],
  presentedIds: string[],
  readIds: string[],
}
```

- [ ] **Step 1: Write RED store tests**

Cover these exact cases:

```js
test('first device baseline reads older releases but leaves only latest unread and unpresented', () => {
  const catalog = normalizeNotificationCatalog([
    release('new', '2026-09-21T20:00:00-03:00'),
    release('old', '2026-09-01T20:00:00-03:00'),
  ])
  const state = loadNotificationState({ storage: memoryStorage(), businessId: 'amor-e-sabor', catalog })
  assert.deepEqual(state.knownIds, ['new', 'old'])
  assert.deepEqual(state.readIds, ['old'])
  assert.deepEqual(state.presentedIds, ['old'])
  assert.equal(getAutomaticNotification(catalog, state).id, 'new')
  assert.equal(getUnreadCount(catalog, state), 1)
})

test('malformed persisted JSON degrades to a safe baseline', () => {
  const storage = memoryStorage({ 'delivery-notifications:v1:amor-e-sabor': '{bad-json' })
  const state = loadNotificationState({ storage, businessId: 'amor-e-sabor', catalog: [release('new')] })
  assert.equal(state.version, 1)
  assert.deepEqual(state.readIds, [])
})

test('storage read/write exceptions never escape', () => {
  const storage = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('quota') },
  }
  const state = loadNotificationState({ storage, businessId: 'amor-e-sabor', catalog: [release('new')] })
  assert.doesNotThrow(() => saveNotificationState({ storage, businessId: 'amor-e-sabor', state }))
  assert.equal(saveNotificationState({ storage, businessId: 'amor-e-sabor', state }), false)
})

test('different business IDs use different keys', () => {
  assert.equal(notificationStorageKey('a'), 'delivery-notifications:v1:a')
  assert.equal(notificationStorageKey('b'), 'delivery-notifications:v1:b')
})

test('invalid and duplicate catalog entries are ignored without crashing', () => {
  const catalog = normalizeNotificationCatalog([
    release('same', '2026-09-21T20:00:00-03:00'),
    release('same', '2026-09-20T20:00:00-03:00'),
    { id: '', title: 'invalid' },
  ])
  assert.equal(catalog.length, 1)
  assert.equal(catalog[0].id, 'same')
})
```

Also prove orphan IDs are pruned on load and `markRead` adds both read and presented.

- [ ] **Step 2: Run RED**

```bash
node --test src/app/notifications/notificationStore.test.js
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Create the release catalog**

Use structured data only:

```js
export const SYSTEM_NOTIFICATIONS = Object.freeze([
  Object.freeze({
    id: 'release-2026-09-operation-shell',
    type: 'release',
    publishedAt: '2026-09-21T23:00:00-03:00',
    title: 'Novidades do Gestão Delivery',
    summary: 'Badges de Pedidos e Comandas, Central de notificações e nova barra superior.',
    sections: Object.freeze([
      Object.freeze({
        title: 'Pedidos e Comandas em andamento',
        body: 'Os menus agora mostram quantos pedidos precisam de acompanhamento e quantas comandas estão abertas.',
      }),
      Object.freeze({
        title: 'Central de notificações',
        body: 'O novo sino reúne novidades do sistema e mantém o histórico disponível neste dispositivo.',
      }),
      Object.freeze({
        title: 'Nova barra superior',
        body: 'A barra superior reúne notificações e atalhos da operação sem ocupar a área principal de trabalho.',
      }),
    ]),
  }),
])
```

`normalizeNotificationCatalog` must validate `id`, parseable `publishedAt`, non-empty `title` and `summary`, deduplicate by ID and sort descending by date then ID. Export `CURRENT_RELEASE = SYSTEM_NOTIFICATIONS[0]` so the operation menu can show current release information without reading `package.json.version`.

- [ ] **Step 4: Implement storage reconciliation**

Core rules:

```js
export const notificationStorageKey = (businessId) => {
  const id = String(businessId || '').trim()
  return id ? `delivery-notifications:v1:${id}` : null
}

export const markPresented = (state, id) => ({
  ...state,
  presentedIds: addId(state.presentedIds, id),
})

export const markRead = (state, id) => ({
  ...state,
  presentedIds: addId(state.presentedIds, id),
  readIds: addId(state.readIds, id),
})

export const getAutomaticNotification = (catalog, state) => {
  const latest = catalog[0]
  return latest && !state.presentedIds.includes(latest.id) ? latest : null
}
```

When there is no valid persisted state, baseline all catalog IDs as known; mark every item except index 0 as read+presented. When persisted state exists, prune IDs not in the current catalog and add new IDs only to `knownIds`.

- [ ] **Step 5: Run GREEN**

```bash
node --test src/app/notifications/notificationStore.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/notifications/notificationCatalog.js src/app/notifications/notificationStore.js src/app/notifications/notificationStore.test.js
git commit -m "feat: add device notification store"
```

---

### Task 5: Add the notification React controller

**Files:**
- Create: `src/app/notifications/useNotifications.js`
- Create: `src/app/notifications/useNotifications.test.js`

**Interfaces:**
- Consumes: Task 4 store/catalog.
- Produces:

```js
useNotifications({ businessId, catalog = SYSTEM_NOTIFICATIONS, storage = globalThis.localStorage }) => ({
  notifications,
  unreadCount,
  automaticNotification,
  isRead(id),
  markPresented(id),
  markRead(id),
})
```

- [ ] **Step 1: Write RED hook tests**

Using react-test-renderer, test:

1. `automaticNotification` is the latest release only.
2. Closing via `markPresented` removes the automatic candidate but leaves unread count unchanged.
3. `markRead` removes it from unread count and persists.
4. Remount with the same `businessId` preserves read state.
5. Remount with another `businessId` receives an independent baseline.
6. If two new release IDs appear since the saved state, only the newest can auto-open; the other remains unread but never becomes the automatic candidate while it is not catalog index 0.
7. A storage object whose `setItem` throws still updates in-memory state.

Representative assertion:

```js
await act(async () => latest.markPresented('release-new'))
assert.equal(latest.automaticNotification, null)
assert.equal(latest.unreadCount, 1)

await act(async () => latest.markRead('release-new'))
assert.equal(latest.unreadCount, 0)
```

- [ ] **Step 2: Run RED**

```bash
node --test src/app/notifications/useNotifications.test.js
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook without clearing storage on unmount/logout**

Use state initialized from `loadNotificationState`. Reinitialize only when `businessId` or the normalized catalog identity changes. Persist inside the state updater, but catch storage failures in the pure save function.

Do not add a `clear` method.

- [ ] **Step 4: Run GREEN**

```bash
node --test src/app/notifications/notificationStore.test.js src/app/notifications/useNotifications.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/notifications/useNotifications.js src/app/notifications/useNotifications.test.js
git commit -m "feat: manage notification read state"
```

---

### Task 6: Build the notification bell, drawer, sheet and release detail

**Files:**
- Modify: `src/shared/ui/Modal.jsx`
- Modify: `src/bottomSheet.test.js`
- Create: `src/app/notifications/NotificationCenter.jsx`
- Create: `src/app/notifications/ReleaseNotesModal.jsx`
- Create: `src/app/notifications/NotificationsEntryPoint.jsx`
- Create: `src/app/notifications/NotificationsEntryPoint.test.js`
- Create: `src/notification-center.css`
- Modify: `src/shared/ui/Icon.jsx`

**Interfaces:**
- Consumes: Task 5 hook; existing `BottomSheet`, `Modal`, `useMediaQuery('(max-width: 820px)')`.
- Produces: `<NotificationsEntryPoint businessId catalog? storage? />`, fully owning bell/open/list/detail/automatic-notice UI state; production callers pass only `businessId`.

- [ ] **Step 1: Write RED for optional Modal backdrop class**

Extend `src/bottomSheet.test.js` source contract:

```js
test('Modal accepts an optional backdrop class without changing default accessibility', async () => {
  const source = await read('./shared/ui/Modal.jsx')
  assert.match(source, /backdropClassName/)
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/bottomSheet.test.js
```

Expected: FAIL on `backdropClassName`.

- [ ] **Step 3: Extend Modal minimally**

Change the signature and backdrop only:

```jsx
function Modal({
  title,
  onClose,
  children,
  footer,
  className = '',
  backdropClassName = '',
  initialFocusSelector,
}) {
  // existing focus/scroll-lock behavior unchanged
  return (
    <div
      className={['modal-backdrop', backdropClassName].filter(Boolean).join(' ')}
      onMouseDown={onClose}
    >
      {/* existing card */}
    </div>
  )
}
```

- [ ] **Step 4: Write RED UI behavior tests**

Create `NotificationsEntryPoint.test.js` with an injectable `catalog` and `storage` prop for deterministic tests. Cover:

- bell has accessible `Notificações, 1 não lida`;
- visual unread badge shows `99+` at 100;
- desktop click opens a dialog whose card has `notification-center-drawer`;
- initial list renders only 20 of 45 notifications;
- `Ver mais notificações` grows to 40 then 45;
- opening a desktop release marks it read and opens detail Modal;
- mobile click opens BottomSheet; selecting an item swaps list to detail in the same dialog and exposes `Voltar`;
- automatic release modal appears once;
- automatic close marks only presented;
- `Entendi` marks read;
- `Ver histórico` marks presented and opens the center.

- [ ] **Step 5: Run RED**

```bash
node --test src/app/notifications/NotificationsEntryPoint.test.js src/bottomSheet.test.js
```

Expected: FAIL because notification UI modules/icons/styles do not exist.

- [ ] **Step 6: Implement the pure list/detail component**

`NotificationCenter.jsx` must accept:

```js
{
  notifications,
  visibleCount,
  isRead,
  onOpen,
  onLoadMore,
  detailNotification,
  onBack,
  mobile,
}
```

Render `notifications.slice(0, visibleCount)`; show `Ver mais notificações` only when more remain.

Each list item shows type icon, title, formatted date, `summary`, and a textual unread marker in addition to visual styling.

- [ ] **Step 7: Implement `ReleaseNotesModal`**

Props:

```js
{
  notification,
  mode, // 'automatic' | 'detail'
  onClose,
  onAcknowledge,
  onOpenHistory,
}
```

Automatic footer:

```jsx
<>
  <Button type="button" onClick={onAcknowledge}>Entendi</Button>
  <Button type="button" variant="secondary" onClick={onOpenHistory}>Ver histórico</Button>
</>
```

Detail mode has no second read-state transition; it is already read when opened from the center.

- [ ] **Step 8: Implement `NotificationsEntryPoint`**

Use exactly one `useNotifications` controller. Keep `centerOpen`, `selectedId`, and `visibleCount` as local UI state.

Desktop:

```jsx
<Modal
  title="Notificações"
  onClose={closeCenter}
  className="notification-center-drawer"
  backdropClassName="notification-center-backdrop"
>
  <NotificationCenter ... />
</Modal>
```

Mobile:

```jsx
<BottomSheet open={centerOpen} title="Notificações" onClose={closeCenter}>
  <NotificationCenter mobile ... />
</BottomSheet>
```

Selecting an item must call `markRead(id)` before showing detail.

Automatic close must call `markPresented(id)`. `Entendi` calls `markRead(id)`. `Ver histórico` calls `markPresented(id)` and opens the center.

- [ ] **Step 9: Add bell/logout icons and CSS**

Add a `bell` icon to `Icon.jsx`; add `logout` now because Task 7 consumes it.

`notification-center.css` must:

- right-align desktop drawer using `notification-center-backdrop`;
- keep drawer width bounded, e.g. `min(420px, calc(100vw - 24px))`;
- use `max-height: 100dvh` safely;
- use existing `--surface`, `--surface-soft`, `--border`, `--text`, `--muted`, `--primary` tokens;
- visually distinguish unread with more than color alone (e.g. dot + `Não lida` text);
- keep list scroll local to the drawer/sheet;
- avoid mobile drawer rules because mobile uses BottomSheet.

- [ ] **Step 10: Run GREEN**

```bash
node --test src/app/notifications/notificationStore.test.js src/app/notifications/useNotifications.test.js src/app/notifications/NotificationsEntryPoint.test.js src/bottomSheet.test.js
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/shared/ui/Modal.jsx src/shared/ui/Icon.jsx src/bottomSheet.test.js src/app/notifications src/notification-center.css
git commit -m "feat: add notification center experience"
```

---

### Task 7: Add the operation menu and global top bar

**Files:**
- Create: `src/app/shell/OperationMenu.jsx`
- Create: `src/app/shell/OperationMenu.test.js`
- Create: `src/app/shell/AppTopBar.jsx`
- Create: `src/app/shell/AppTopBar.test.js`
- Create: `src/app-top-bar.css`

**Interfaces:**
- Consumes: `useNavigation()`, `resolveNavigationEntry`, Task 6 `NotificationsEntryPoint`.
- Produces: `<AppTopBar businessId onLogout logoutDisabled />`.

- [ ] **Step 1: Write RED OperationMenu tests**

Using `NavigationProvider`, prove:

- trigger accessible name is `Amor & Sabor, operação atual`;
- `Configurações` appears when the settings area resolves;
- `Preferências deste dispositivo` appears only with `preferences.local`;
- restricted session without settings capabilities does not see either shortcut;
- clicking a shortcut calls `requestNavigation(resolvedId)` and closes;
- Escape closes and restores trigger focus;
- outside `mousedown` closes;
- `Sobre o Gestão Delivery` opens a Modal and never says `Meu perfil`, a person name or `Administrador`;
- logout calls the passed callback and respects `logoutDisabled`.

- [ ] **Step 2: Run RED**

```bash
node --test src/app/shell/OperationMenu.test.js
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement OperationMenu using official navigation resolution**

Build candidate shortcuts:

```js
const settingsEntry = resolveNavigationEntry(
  { area: 'settings', label: 'Configurações', icon: 'settings' },
  granted,
  implemented,
)
const deviceEntry = resolveNavigationEntry(
  { id: 'settings-device', label: 'Preferências deste dispositivo', icon: 'system' },
  granted,
  implemented,
)
```

Do not call `resolveDestination` with hardcoded capability checks.

Import `CURRENT_RELEASE` from `../notifications/notificationCatalog.js`. The always-available `Sobre o Gestão Delivery` action opens the existing `Modal` with this exact information structure:

```jsx
<Modal title="Sobre o Gestão Delivery" onClose={closeAbout}>
  <div className="operation-about-copy">
    <strong>Gestão Delivery</strong>
    <span>Operação atual: Amor &amp; Sabor</span>
    <span>Atualização atual: {CURRENT_RELEASE.title}</span>
    <span>{formatReleaseDate(CURRENT_RELEASE.publishedAt)}</span>
  </div>
</Modal>
```

Keep `formatReleaseDate` local and deterministic with `Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })`.

Use a trigger ref/root ref and the same outside-click pattern already used by `SystemSelect`. Escape calls `close()`, which restores focus with `requestAnimationFrame`.

- [ ] **Step 4: Write RED AppTopBar test**

Assert:

```js
assert.ok(renderer.root.findByProps({ className: 'app-topbar' }))
assert.match(nodeText(renderer.root), /Gestão Delivery/)
assert.ok(buttonNamed(renderer.root, /Notificações/))
assert.ok(buttonNamed(renderer.root, /Amor & Sabor, operação atual/))
```

The `Gestão Delivery` brand element is present in markup but CSS hides it on desktop and shows it under 820 px.

- [ ] **Step 5: Implement AppTopBar**

```jsx
function AppTopBar({ businessId, onLogout, logoutDisabled = false }) {
  return (
    <header className="app-topbar">
      <div className="app-topbar-brand" aria-label="Gestão Delivery">
        <Icon name="meal" size={20} />
        <strong>Gestão Delivery</strong>
      </div>
      <div className="app-topbar-actions">
        <NotificationsEntryPoint businessId={businessId} />
        <OperationMenu onLogout={onLogout} logoutDisabled={logoutDisabled} />
      </div>
    </header>
  )
}
```

- [ ] **Step 6: Style the top bar**

Desktop:

- sticky or normal shell row according to current scroll behavior, but it must remain at the top of `.app-main`;
- minimum height around 52–56 px;
- right-aligned utilities;
- no duplicated desktop brand.

Mobile `max-width: 820px`:

- show `.app-topbar-brand`;
- keep bell and AS trigger within one row;
- no horizontal scroll;
- honor `env(safe-area-inset-top)` where the existing shell uses safe-area tokens.

- [ ] **Step 7: Run GREEN**

```bash
node --test src/app/shell/OperationMenu.test.js src/app/shell/AppTopBar.test.js src/app/navigation/resolution.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/shell/OperationMenu.jsx src/app/shell/OperationMenu.test.js src/app/shell/AppTopBar.jsx src/app/shell/AppTopBar.test.js src/app-top-bar.css
git commit -m "feat: add global operation top bar"
```

---

### Task 8: Compose badges and notification utilities through AppShell/App

**Files:**
- Modify: `src/app/shell/AppShell.jsx`
- Modify: `src/app/shell/AppShell.test.js`
- Modify: `src/app/shell/AppRoot.test.js`
- Modify: `src/App.jsx`
- Modify: `src/realtimeSyncRegression.test.js`
- Modify: `src/actionCapabilities.test.js`

**Interfaces:**
- Consumes:
  - `getOperationalOrderCount(orders, now, currentTiming)`
  - `getOpenComandaCount(tables, tableTabs)`
  - `sessionContext.businessId`
- AppShell signature becomes:

```js
AppShell({
  businessId,
  navigationBadges = {},
  onLogout,
  logoutDisabled = false,
  children,
})
```

- [ ] **Step 1: Write RED AppShell composition tests**

Extend `AppShell.test.js`:

```js
const shell = React.createElement(AppShell, {
  businessId: 'amor-e-sabor',
  navigationBadges: { orders: 3, comandas: 2 },
  children: React.createElement('span', null, 'content'),
})
```

Assert `AppTopBar` exists, Sidebar and MobileNavigation receive the same badge object, and existing page-direction focus behavior still passes.

- [ ] **Step 2: Write RED App integration regression**

In `realtimeSyncRegression.test.js`, assert source contains:

```js
assert.match(app, /getOperationalOrderCount/)
assert.match(app, /getOpenComandaCount/)
assert.match(app, /businessId={sessionContext?.businessId/)
assert.match(app, /navigationBadges={{\s*orders:/)
assert.match(app, /currentTiming={currentTiming}/)
```

Extend `AppRoot.test.js` so checking, anonymous, bootstrap loading/error renders contain no `.app-topbar`, while the ready child path may contain it. This pins the spec rule that the utility bar exists only inside the authenticated ready shell.

Keep the existing exact assertions:

```js
assert.match(app, /globalSyncEnabled: isOnline && authState === 'authenticated'/)
assert.match(app, /ordersSyncEnabled: activeTab === 'orders' && isOnline && authState === 'authenticated'/)
```

Also assert none of `AppTopBar.jsx`, `navigationBadges.js`, `comandaActivity.js` contains `setInterval`, `fetch(`, `WebSocket` or `EventSource`.

- [ ] **Step 3: Run RED**

```bash
node --test src/app/shell/AppShell.test.js src/app/shell/AppRoot.test.js src/realtimeSyncRegression.test.js src/actionCapabilities.test.js
```

Expected: FAIL on missing AppShell props/top bar and App domain-count wiring.

- [ ] **Step 4: Wire AppShell**

```jsx
function AppShell({
  businessId,
  navigationBadges = {},
  onLogout,
  logoutDisabled = false,
  children,
}) {
  // existing direction/focus state
  return (
    <div className="app-shell">
      <Sidebar
        badges={navigationBadges}
        onLogout={onLogout}
        logoutDisabled={logoutDisabled}
      />
      <main className="app-main">
        <AppTopBar
          businessId={businessId}
          onLogout={onLogout}
          logoutDisabled={logoutDisabled}
        />
        <div ref={contentRef} key={activeTab} className="app-content page-transition" data-direction={pageDirection} tabIndex={-1}>
          {children}
        </div>
      </main>
      <MobileNavigation
        badges={navigationBadges}
        onLogout={onLogout}
        logoutDisabled={logoutDisabled}
      />
    </div>
  )
}
```

- [ ] **Step 5: Derive counts in App from public domain contracts**

Import public functions from each domain.

After `currentTiming` and `kitchenNow` are available:

```js
const operationalNow = activeTab === 'orders' ? kitchenNow : new Date()
const operationalOrderCount = getOperationalOrderCount(orders, operationalNow, currentTiming)
const openComandaCount = getOpenComandaCount(tables, tableTabs)
const navigationBadges = {
  orders: operationalOrderCount,
  comandas: openComandaCount,
}
```

Pass `currentTiming` into `useOrderArrivals`:

```js
useOrderArrivals({
  active: activeTab === 'orders',
  orders,
  now: kitchenNow,
  currentTiming,
  soundEnabled: kitchenSoundEnabled,
})
```

Render:

```jsx
<AppShell
  businessId={sessionContext?.businessId}
  navigationBadges={navigationBadges}
  onLogout={handleLogout}
  logoutDisabled={writesBlocked}
>
```

Do not add a timer for `operationalNow`; existing global/order sync renders are the refresh source outside/inside Cozinha.

- [ ] **Step 6: Add capability regression**

In `actionCapabilities.test.js`, create a session with `orders.history` but not `orders.view`; provide active orders in bootstrap and assert there is no accessible active-order badge in the rendered navigation.

Also prove a session without `comandas.view` has no Comandas entry/badge.

- [ ] **Step 7: Run GREEN**

```bash
node --test src/app/shell/AppShell.test.js src/app/shell/AppRoot.test.js src/realtimeSyncRegression.test.js src/actionCapabilities.test.js src/app/shell/NavigationBadgesUi.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/shell/AppShell.jsx src/app/shell/AppShell.test.js src/app/shell/AppRoot.test.js src/App.jsx src/realtimeSyncRegression.test.js src/actionCapabilities.test.js
git commit -m "feat: compose operation indicators in app shell"
```

---

### Task 9: Harden responsive, theme and accessibility regression

**Files:**
- Create: `src/appShellNotificationsRegression.test.js`
- Modify: `src/navigation-badges.css`
- Modify: `src/app-top-bar.css`
- Modify: `src/notification-center.css`
- Modify: `src/mobile-navigation.css` only if the regression exposes a real mobile issue.

**Interfaces:**
- Consumes: completed shell/notification UI.
- Produces: permanent source/CSS guards for desktop/mobile behavior.

- [ ] **Step 1: Write RED regression assertions**

Create `appShellNotificationsRegression.test.js` to read source/CSS and assert:

```js
test('global utility shell stays responsive without duplicating navigation', async () => {
  assert.match(shell, /<AppTopBar/)
  assert.doesNotMatch(topbar, /MOBILE_DIRECT_ENTRIES|DESKTOP_NAV_GROUPS/)
  assert.match(topbarCss, /@media\s*\(max-width:\s*820px\)/)
  assert.match(topbarCss, /\.app-topbar-brand/)
})

test('notification center has distinct desktop drawer and mobile sheet contracts', async () => {
  assert.match(entry, /notification-center-drawer/)
  assert.match(entry, /<BottomSheet/)
  assert.match(centerCss, /\.notification-center-backdrop/)
  assert.doesNotMatch(centerCss, /#[0-9a-f]{3,8}/i)
})

test('new surfaces use the existing focus-managed Modal and BottomSheet', async () => {
  assert.match(entry, /<Modal/)
  assert.match(entry, /<BottomSheet/)
  assert.doesNotMatch(entry, /document\.body\.style\.overflow/)
})
```

Add checks that badge classes exist in both desktop/mobile CSS contexts and that no new `position: fixed` top bar overlaps the bottom nav on mobile.

- [ ] **Step 2: Run RED**

```bash
node --test src/appShellNotificationsRegression.test.js
```

Expected: FAIL on any missing responsive/token/accessibility contract.

- [ ] **Step 3: Apply only the CSS/markup fixes required by the regression**

Keep all values token-based. Do not add duplicate navigation labels or mobile-only business logic.

- [ ] **Step 4: Run focused UI regression suite**

```bash
node --test   src/appShellNotificationsRegression.test.js   src/app/shell/AppTopBar.test.js   src/app/shell/OperationMenu.test.js   src/app/shell/NavigationBadgesUi.test.js   src/app/notifications/NotificationsEntryPoint.test.js   src/mobileNavigation.test.js   src/mobileViewportRegression.test.js   src/mobileStabilityRegression.test.js   src/mobileOverlayRegression.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/appShellNotificationsRegression.test.js src/navigation-badges.css src/app-top-bar.css src/notification-center.css src/mobile-navigation.css
git commit -m "test: harden notification shell responsiveness"
```

---

### Task 10: Full verification, documentation and staging handoff

**Files:**
- Create: `docs/superpowers/qa/notification-center-shell-qa.md`
- Modify only if evidence requires it: PR body / issue body; do not change product code after the verified SHA unless a new RED→GREEN correction cycle is started.

**Interfaces:**
- Consumes: Tasks 1–9 final executable SHA.
- Produces: complete automated evidence plus a manual staging checklist; no merge.

- [ ] **Step 1: Run the complete local gates on the final executable SHA**

Run in this order:

```bash
node --test
npm run test:architecture
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --env staging --dry-run
git diff --check
```

Expected:

- full suite: 0 failures;
- architecture: PASS;
- lint: 0 errors;
- build: PASS;
- local D1: PASS with no feature migration introduced;
- production/staging dry-runs: PASS;
- `git diff --check`: exit 0.

- [ ] **Step 2: Create QA evidence document**

Create `docs/superpowers/qa/notification-center-shell-qa.md` with:

```md
# Notification Center and Operation Shell QA

## Automated
- Executable SHA: copy the exact output of `git rev-parse HEAD` from the verified executable run
- Full node:test: PASS
- Architecture: PASS
- Lint: PASS
- Build: PASS
- Local D1: PASS
- Worker production dry-run: PASS
- Worker staging dry-run: PASS
- New migrations: 0

## Staging manual checklist

### Desktop
- [ ] Top bar visible in Pedidos, Comandas, Financeiro, Clientes and Configurações.
- [ ] Top bar absent from login/loading screens.
- [ ] Pedidos badge increments/decrements with operational orders.
- [ ] Future scheduled order does not count before preparation window.
- [ ] Comandas badge increments on open and decrements on payment/close.
- [ ] Comanda transfer keeps the same count.
- [ ] Bell unread count and 99+ visual cap.
- [ ] Notification drawer opens/closes and restores focus.
- [ ] Release detail opens above drawer.
- [ ] AS menu shortcuts respect capabilities.
- [ ] Light and dark themes at ~1024, 1280 and 1440 px.

### Mobile
- [ ] Compact top bar at ~320–390 px.
- [ ] Pedidos and Comandas badges fit the bottom navigation.
- [ ] Bell opens BottomSheet.
- [ ] Selecting a notification swaps list → detail in the same sheet.
- [ ] Back returns detail → list.
- [ ] Automatic release notice appears once per device.
- [ ] Closing automatic notice keeps it unread but prevents auto-reopen.
- [ ] Entendi marks it read.
- [ ] Logout/login preserves notification state on the same device.

## Production
- NOT DEPLOYED
- Merge requires explicit authorization.
```

During execution, write the exact verified SHA from `git rev-parse HEAD` into the evidence document before committing it.

- [ ] **Step 3: Commit QA scaffold/evidence after automated gates**

```bash
git add docs/superpowers/qa/notification-center-shell-qa.md
git commit -m "docs: add notification shell qa evidence"
```

- [ ] **Step 4: Push branch and wait for Validate**

```bash
git push origin feature/notifications-center-shell
```

Record the Validate run number, run ID, final SHA and result in the PR/QA evidence. Do not infer success while the workflow is running.

- [ ] **Step 5: Deploy the exact executable/docs-final branch to staging**

Use the existing manual `Deploy staging` workflow with `feature/notifications-center-shell`.

Verify:

- workflow head SHA equals the branch HEAD intended for QA;
- tests/lint/build/architecture steps pass;
- no unexpected remote migration is applied;
- readiness passes;
- staging login returns HTTP 200.

- [ ] **Step 6: Stop for user manual homologation**

Present the checklist from the QA document in manageable groups. Do not merge and do not deploy production.

- [ ] **Step 7: After manual PASS, record evidence and rerun Validate on the docs-final HEAD**

Update the QA document with PASS/FAIL/BLOCKED results, staging run/version ID, and final counts. Commit:

```bash
git add docs/superpowers/qa/notification-center-shell-qa.md
git commit -m "docs: close notification shell staging qa"
git push origin feature/notifications-center-shell
```

Wait for the final Validate to be SUCCESS before requesting merge authorization.

---

## Completion Criteria

Implementation is ready for merge review only when all are true:

- Orders and Comandas badge selectors are domain-owned and publicly exported.
- Sidebar and MobileNavigation show the same authorized badge values.
- Restricted navigation fallbacks do not leak operational counts.
- Notification storage is isolated by `businessId`, survives logout and degrades safely when storage fails.
- Only the newest release can auto-open; older history does not become a modal queue.
- Notification list loads 20 at a time and unread visual count caps at `99+`.
- Desktop drawer/mobile BottomSheet/detail behavior matches the Spec.
- Global top bar appears only inside the authenticated ready shell.
- Operation menu contains operation shortcuts, not fake personal-profile concepts.
- Existing polling cadence remains unchanged.
- Full automated gates are green.
- Staging manual QA is complete.
- PR remains unmerged until explicit user authorization.
- Production remains unchanged until explicit user authorization.
