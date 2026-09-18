# Spec C4 — Orders Domain Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish `src/domains/orders` as the single frontend owner for order rules, order-specific application behavior, order UI, lifecycle API adapters, and Orders-owned settings policies while preserving the central runtime as the only official synchronized order store.

**Architecture:** Extract Orders incrementally behind `src/domains/orders/index.js`. Keep `app/runtime` responsible for official collections, polling, focus/visibility refresh, and sync guards; Orders receives official data and narrow commit ports. Keep Table Service, Finance, Customers, Catalog, and Printing integrations external through callbacks until C5/C6/C7/C8/C9.

**Tech Stack:** React 19.2.8, Vite 8.2.2, Node 22 `node:test`, `react-test-renderer` 19.2.8, oxlint 1.79.0, Cloudflare Worker/D1, GitHub Actions, QZ Tray 2.2.6 unchanged.

**Spec:** `docs/superpowers/specs/2026-09-17-frontend-modularization-c4-orders-design.md`

## Execution status — checkpoint after Task 10 — 2026-09-17

- Branch: `feature/spec-c4-orders`
- Draft PR: #48
- Base/master SHA: `737beeac2150aabeb39024af823f2f60fee25108`
- Last fully validated executable SHA before this docs-only reconciliation: `d42bb42ba97f772c5e1fcd01dd1b9480ab02d0f4`
- Validate application #1261 / run `35297628138`: **SUCCESS**
- Tasks 1–10: **COMPLETE / GREEN**
- Task 11: NOT STARTED
- C5: NOT STARTED
- C4 staging/manual homologation: NOT STARTED
- Merge: NO
- Production deploy: NO

Task 8 implementation note: the planned public UI export was adapted to `./ui/NewOrderRoute.js` instead of statically exporting the `.jsx` module. This keeps `src/domains/orders/index.js` importable by pure Node `node --test` consumers while Vite loads the actual `NewOrder.jsx` UI. `NewOrderRoute.jsx` remains an internal reexport. This is an execution detail only; the public contract is still the named `NewOrderRoute` export and no legacy `src/pages/NewOrderRoute` facade survives.

Task 9 implementation note: Cozinha, Histórico and their order-only components now live under `src/domains/orders/ui/`. Public UI access uses `ui/orderSurfaces.js`, preserving the pure-Node public-contract tests while Vite loads the `.jsx` surfaces. `OrderDetail` is also exposed through the Orders public boundary because the existing Receivables surface still consumes order details until its later ownership slice; no legacy `src/components/OrderDetail.jsx` facade was recreated. During GREEN stabilization, the move also relocated the pure operational-history projection to `domain/orderHistoryAnalysis.js` and removed two circular dependencies introduced by the UI move. Validate #1258 closed with 1,684 tests, 0 failures.

Task 10 implementation note: Validate #1260 proved all three new architecture fixtures RED before implementation. The checker now rejects non-Orders deep imports, the exact migrated C4 legacy owner set, and reintroduced `getOrders` / `createOrder` / `updateOrderStatus` / `cancelOrder` declarations in `src/api/client.js`. Physical legacy-owner and App-internal audits were empty, and Validate #1261 closed with 1,687 tests / 0 failures plus `Frontend architecture boundaries: OK`.

## Global Constraints

- Work only on `feature/spec-c4-orders` in a fresh isolated worktree created from the remote branch; never implement directly on `master`.
- Preserve current user-visible behavior and visuals; C4 is an architectural extraction, not a redesign or feature change.
- Keep backend routes, response envelopes, D1 schema, and migrations unchanged.
- Keep the central runtime as the single owner of the official synchronized `orders` collection.
- Preserve `GLOBAL_SYNC_INTERVAL_MS = 5_000` and `ORDER_SYNC_INTERVAL_MS = 2_000`, including current focus/visibility behavior and stale-read guards.
- Keep `shared/orderTiming.js` as the cross-runtime timing source; do not duplicate the 50-minute timing rule inside Orders.
- Move only `getOrders`, `createOrder`, `updateOrderStatus`, and `cancelOrder` into Orders API ownership. Payment/refund/payment-promise APIs remain C6; table-tab APIs remain C5; printing APIs remain C9.
- Keep local `soundEnabled` persistence outside Orders. Orders owns arrival interpretation, highlight, alert deduplication, and sound execution only.
- Keep operations/modalities and cancellation-reasons policy adapters Orders-owned, while Settings remains the visual editor surface.
- Outside `src/domains/orders/`, consume Orders only through `src/domains/orders/index.js` once each migration task closes.
- Do not remove the payment-receipt runtime bridge before C6, the table-commit bridge before C5, or the generic/auth `src/api/client.js` compatibility exports before their scheduled cleanup.
- Use strict TDD for new behavior boundaries and characterization tests for move-only refactors. Every task must finish green before the next task starts.
- Do not deploy production, merge to `master`, force-push, reset, clean, or discard work without explicit user authorization.

---

## File ownership map locked by this plan

`src/domains/orders/domain/` owns pure order rules: cart/search, lifecycle/refund presentation state, payment eligibility, workflow/date helpers, type options, New Order step flow, cancellation-reason effective-config projection, kitchen queue/ticket/clock rules, and realtime arrival detection.

`src/domains/orders/application/` owns `useKitchenClock`, Cozinha arrival/highlight/sound lifecycle, New Order draft lifecycle, and finalize/cancel orchestration.

`src/domains/orders/infrastructure/` owns lifecycle HTTP endpoints and the operations/cancellation settings policy adapters. Generic HTTP remains in `src/infrastructure/api/`.

`src/domains/orders/ui/` owns Cozinha, Histórico, Novo Pedido, and these order-only components: `CancelOrderDialog`, `KitchenTicket`, `KitchenTicketNotes`, `NewOrderCartSummary`, `NewOrderCustomerStep`, `NewOrderProductsStep`, `NewOrderReviewStep`, `NewOrderStepIndicator`, `OperationalHistoryAnalysis`, `OrderCart`, `OrderCheckoutSummary`, `OrderDetail`, `OrderDetailTiming`, and `OrderProductCatalog`.

Generic primitives, `LocalTableSelector`, payment workflow UI, printing runtime, `OrderTicketPreview`, and navigation stay outside Orders for this slice.

`src/domains/orders/index.js` is the only supported Orders import path for non-Orders code.

---

### Task 1: Establish the Orders public boundary and move core pure order rules

**Files:**
- Create: `src/domains/orders/index.js`
- Create/Test: `src/domains/orders/ordersPublicContract.test.js`
- Move: `src/utils/orderCart.js` → `src/domains/orders/domain/orderCart.js`
- Move/Test: `src/utils/orderCart.test.js` → `src/domains/orders/domain/orderCart.test.js`
- Move: `src/utils/orderLifecycle.js` → `src/domains/orders/domain/orderLifecycle.js`
- Move/Test: `src/utils/orderLifecycle.test.js` → `src/domains/orders/domain/orderLifecycle.test.js`
- Move: `src/utils/orderPaymentEligibility.js` → `src/domains/orders/domain/orderPaymentEligibility.js`
- Move/Test: `src/utils/orderPaymentEligibility.test.js` → `src/domains/orders/domain/orderPaymentEligibility.test.js`
- Move: `src/utils/orderWorkflow.js` → `src/domains/orders/domain/orderWorkflow.js`
- Move/Test: `src/utils/orderWorkflow.test.js` → `src/domains/orders/domain/orderWorkflow.test.js`
- Move: `src/utils/orderTypeOptions.js` → `src/domains/orders/domain/orderTypeOptions.js`
- Move: `src/utils/newOrderStepFlow.js` → `src/domains/orders/domain/newOrderStepFlow.js`
- Move/Test: `src/utils/newOrderStepFlow.test.js` → `src/domains/orders/domain/newOrderStepFlow.test.js`
- Move: `src/utils/cancellationReasonOptions.js` → `src/domains/orders/domain/cancellationReasonOptions.js`
- Modify imports in: `src/App.jsx`, `src/pages/NewOrder.jsx`, `src/pages/OrderHistory.jsx`, and any current `src/components/*` consumer reported by `rg` before the move.

**Interfaces:**
- Consumes: `shared/orderTiming.js`, `shared/orderDisplayNumber.js`, existing capability helpers.
- Produces: public named exports from `src/domains/orders/index.js` for moved rules consumed outside Orders.

- [x] **Step 1: Add a failing public-contract characterization test**

Create `src/domains/orders/ordersPublicContract.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ORDER_TYPE_OPTIONS,
  canReceiveStandaloneOrder,
  getOrderItemsSearchText,
  getOrderRefundState,
  isOrderActive,
  isOrderCancelled,
  toLocalDateValue,
} from './index.js'

test('orders public contract exposes existing pure rules', () => {
  const active = { id: 'o-1', status: 'Em preparo', items: [{ name: 'Marmita P' }] }
  const cancelled = { id: 'o-2', status: 'Cancelado', paymentStatus: 'Pago' }
  assert.equal(isOrderActive(active), true)
  assert.equal(isOrderCancelled(cancelled), true)
  assert.equal(getOrderRefundState(cancelled), 'pending')
  assert.match(getOrderItemsSearchText(active), /marmita/i)
  assert.ok(Array.isArray(ORDER_TYPE_OPTIONS))
  assert.equal(typeof toLocalDateValue(new Date('2026-09-17T12:00:00-03:00')), 'string')
  assert.equal(typeof canReceiveStandaloneOrder, 'function')
})
```

- [x] **Step 2: Run RED**

```bash
node --test src/domains/orders/ordersPublicContract.test.js
```

Expected: FAIL because the Orders public entry point does not exist.

- [x] **Step 3: Move the rule files without changing business logic**

```bash
mkdir -p src/domains/orders/domain
git mv src/utils/orderCart.js src/domains/orders/domain/orderCart.js
git mv src/utils/orderCart.test.js src/domains/orders/domain/orderCart.test.js
git mv src/utils/orderLifecycle.js src/domains/orders/domain/orderLifecycle.js
git mv src/utils/orderLifecycle.test.js src/domains/orders/domain/orderLifecycle.test.js
git mv src/utils/orderPaymentEligibility.js src/domains/orders/domain/orderPaymentEligibility.js
git mv src/utils/orderPaymentEligibility.test.js src/domains/orders/domain/orderPaymentEligibility.test.js
git mv src/utils/orderWorkflow.js src/domains/orders/domain/orderWorkflow.js
git mv src/utils/orderWorkflow.test.js src/domains/orders/domain/orderWorkflow.test.js
git mv src/utils/orderTypeOptions.js src/domains/orders/domain/orderTypeOptions.js
git mv src/utils/newOrderStepFlow.js src/domains/orders/domain/newOrderStepFlow.js
git mv src/utils/newOrderStepFlow.test.js src/domains/orders/domain/newOrderStepFlow.test.js
git mv src/utils/cancellationReasonOptions.js src/domains/orders/domain/cancellationReasonOptions.js
```

Update moved `shared/` relative paths for the new directory depth; preserve the same shared modules.

- [x] **Step 4: Create the first public entry point**

Create `src/domains/orders/index.js`:

```js
export {
  addCartItem,
  buildOrderPayload,
  calculateOrderPreview,
  commitCartItemNote,
  decrementCartProduct,
  editCartItemNote,
  getOrderItemsSearchText,
  getOrderItemsSummary,
  removeCartItem,
  updateCartItem,
} from './domain/orderCart.js'
export { getOrderRefundState, isOrderActive, isOrderCancelled, isOrderFinished } from './domain/orderLifecycle.js'
export { canReceiveStandaloneOrder } from './domain/orderPaymentEligibility.js'
export { formatCancellationDate, formatOrderDate, toLocalDateValue } from './domain/orderWorkflow.js'
export { ORDER_TYPE_OPTIONS } from './domain/orderTypeOptions.js'
export {
  NEW_ORDER_STEPS,
  canNavigateToNewOrderStep,
  createNewOrderDirtySnapshot,
  getFurthestReachedStep,
  getNewOrderStepAccess,
  getOrderItemCount,
  getOrderItemsSubtotal,
  isNewOrderDraftDirty,
} from './domain/newOrderStepFlow.js'
export { cancellationOptionsFromEffective, cancellationRevisionFromEffective } from './domain/cancellationReasonOptions.js'
```

Before committing, compare these names against the moved modules and add any other *currently imported outside Orders* export by its existing name; do not create alias wrappers.

- [x] **Step 5: Rewrite non-Orders consumers to the public entry**

Example in App:

```js
import {
  getOrderItemsSearchText,
  getOrderRefundState,
  isOrderActive,
  isOrderCancelled,
  toLocalDateValue,
} from './domains/orders/index.js'
```

Use the equivalent relative `domains/orders/index.js` import from current pages/components. Do not create `src/utils` reexports.

- [x] **Step 6: Run focused rule tests**

```bash
node --test \
  src/domains/orders/ordersPublicContract.test.js \
  src/domains/orders/domain/orderCart.test.js \
  src/domains/orders/domain/orderLifecycle.test.js \
  src/domains/orders/domain/orderPaymentEligibility.test.js \
  src/domains/orders/domain/orderWorkflow.test.js \
  src/domains/orders/domain/newOrderStepFlow.test.js
```

Expected: PASS.

- [x] **Step 7: Verify old imports are gone**

```bash
rg "utils/(orderCart|orderLifecycle|orderPaymentEligibility|orderWorkflow|orderTypeOptions|newOrderStepFlow|cancellationReasonOptions)" src
```

Expected: no output.

- [x] **Step 8: Commit**

```bash
git add src/domains/orders src/App.jsx src/pages src/components src/utils
git commit -m "refactor: establish orders domain rules"
```

---

### Task 2: Move Cozinha timing/queue rules and arrival notifications into Orders

**Files:**
- Move: `src/utils/kitchenClock.js` → `src/domains/orders/domain/kitchenClock.js`
- Move/Test: `src/utils/kitchenClock.test.js` → `src/domains/orders/domain/kitchenClock.test.js`
- Move: `src/utils/kitchenQueue.js` → `src/domains/orders/domain/kitchenQueue.js`
- Move/Test: `src/utils/kitchenQueue.test.js` → `src/domains/orders/domain/kitchenQueue.test.js`
- Move: `src/utils/kitchenTicket.js` → `src/domains/orders/domain/kitchenTicket.js`
- Move/Test: `src/utils/kitchenTicket.test.js` → `src/domains/orders/domain/kitchenTicket.test.js`
- Move: `src/utils/orderRealtime.js` → `src/domains/orders/domain/orderRealtime.js`
- Move/Test: `src/utils/orderRealtime.test.js` → `src/domains/orders/domain/orderRealtime.test.js`
- Move: `src/hooks/useKitchenClock.js` → `src/domains/orders/application/useKitchenClock.js`
- Move/Test: `src/hooks/useKitchenClock.test.js` → `src/domains/orders/application/useKitchenClock.test.js`
- Create: `src/domains/orders/infrastructure/browserOrderAlert.js`
- Create: `src/domains/orders/application/useOrderArrivals.js`
- Create/Test: `src/domains/orders/application/useOrderArrivals.test.js`
- Modify: `src/domains/orders/index.js`, `src/App.jsx`, current Cozinha components/tests.

**Interfaces:**
- Consumes: official `orders[]`, `now`, `active`, external/local `soundEnabled`.
- Produces: `useKitchenClock(orders, { active, currentTiming })` and `useOrderArrivals({ active, orders, now, soundEnabled, playSound, setTimeoutFn, clearTimeoutFn })` returning `{ newOrderIds, previewSound, reset }`.

- [x] **Step 1: Write failing arrival lifecycle test**

Create `src/domains/orders/application/useOrderArrivals.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useOrderArrivals } from './useOrderArrivals.js'

const activeOrder = (id) => ({ id, status: 'Em preparo', orderDate: '2026-09-17' })

test('arrival baseline does not alert, then a new order alerts once and highlights', async () => {
  const sounds = []
  const timers = []
  let latest
  let renderer
  function Probe(props) {
    latest = useOrderArrivals({
      ...props,
      setTimeoutFn: (fn) => { timers.push(fn); return timers.length },
      clearTimeoutFn: () => {},
    })
    return null
  }

  await act(async () => {
    renderer = TestRenderer.create(<Probe active orders={[activeOrder('1')]} now={new Date('2026-09-17T12:00:00-03:00')} soundEnabled playSound={() => sounds.push('sound')} />)
  })
  assert.deepEqual([...latest.newOrderIds], [])

  await act(async () => {
    renderer.update(<Probe active orders={[activeOrder('1'), activeOrder('2')]} now={new Date('2026-09-17T12:00:01-03:00')} soundEnabled playSound={() => sounds.push('sound')} />)
  })
  assert.deepEqual([...latest.newOrderIds], ['2'])
  assert.equal(sounds.length, 1)

  await act(async () => { timers.at(-1)() })
  assert.deepEqual([...latest.newOrderIds], [])
  renderer.unmount()
})
```

- [x] **Step 2: Run RED**

```bash
node --test src/domains/orders/application/useOrderArrivals.test.js
```

Expected: FAIL because the hook does not exist.

- [x] **Step 3: Move existing pure rules/hook**

```bash
mkdir -p src/domains/orders/application src/domains/orders/infrastructure
git mv src/utils/kitchenClock.js src/domains/orders/domain/kitchenClock.js
git mv src/utils/kitchenClock.test.js src/domains/orders/domain/kitchenClock.test.js
git mv src/utils/kitchenQueue.js src/domains/orders/domain/kitchenQueue.js
git mv src/utils/kitchenQueue.test.js src/domains/orders/domain/kitchenQueue.test.js
git mv src/utils/kitchenTicket.js src/domains/orders/domain/kitchenTicket.js
git mv src/utils/kitchenTicket.test.js src/domains/orders/domain/kitchenTicket.test.js
git mv src/utils/orderRealtime.js src/domains/orders/domain/orderRealtime.js
git mv src/utils/orderRealtime.test.js src/domains/orders/domain/orderRealtime.test.js
git mv src/hooks/useKitchenClock.js src/domains/orders/application/useKitchenClock.js
git mv src/hooks/useKitchenClock.test.js src/domains/orders/application/useKitchenClock.test.js
```

Fix only relative import paths; `shared/orderTiming.js` remains the timing source.

- [x] **Step 4: Add browser alert adapter**

Create `src/domains/orders/infrastructure/browserOrderAlert.js`:

```js
export const createBrowserOrderAlertPlayer = ({ windowObject = globalThis.window } = {}) => {
  let context = null
  const ensureContext = () => {
    const AudioContextClass = windowObject?.AudioContext || windowObject?.webkitAudioContext
    if (!AudioContextClass) return null
    if (!context) context = new AudioContextClass()
    return context
  }

  const play = async () => {
    const audio = ensureContext()
    if (!audio) return false
    try {
      if (audio.state === 'suspended') await audio.resume()
      if (audio.state !== 'running') return false
      const tone = (frequency, delay) => {
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        const startsAt = audio.currentTime + delay
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, startsAt)
        gain.gain.setValueAtTime(0.0001, startsAt)
        gain.gain.exponentialRampToValueAtTime(0.14, startsAt + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.18)
        oscillator.connect(gain)
        gain.connect(audio.destination)
        oscillator.start(startsAt)
        oscillator.stop(startsAt + 0.2)
      }
      tone(784, 0)
      tone(988, 0.16)
      return true
    } catch {
      return false
    }
  }

  return Object.freeze({
    play,
    unlock: async () => {
      const audio = ensureContext()
      if (audio?.state === 'suspended') {
        try { await audio.resume() } catch { return false }
      }
      return audio?.state === 'running'
    },
    close: async () => {
      if (context?.close) await context.close()
      context = null
    },
  })
}
```

- [x] **Step 5: Implement `useOrderArrivals`**

Create `src/domains/orders/application/useOrderArrivals.js`:

```js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectOperationalArrivals } from '../domain/orderRealtime.js'
import { createBrowserOrderAlertPlayer } from '../infrastructure/browserOrderAlert.js'

export function useOrderArrivals({
  active,
  orders,
  now,
  soundEnabled,
  playSound,
  highlightDurationMs = 2600,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
}) {
  const player = useMemo(() => createBrowserOrderAlertPlayer(), [])
  const playRef = useRef(playSound || player.play)
  const knownRef = useRef(undefined)
  const alertedRef = useRef(new Set())
  const timerRef = useRef(null)
  const [newOrderIds, setNewOrderIds] = useState(() => new Set())
  useEffect(() => { playRef.current = playSound || player.play }, [playSound, player])

  const reset = useCallback(() => {
    knownRef.current = undefined
    alertedRef.current = new Set()
    if (timerRef.current) clearTimeoutFn(timerRef.current)
    timerRef.current = null
    setNewOrderIds(new Set())
  }, [clearTimeoutFn])

  const previewSound = useCallback(() => playRef.current(), [])

  useEffect(() => {
    if (!active) {
      knownRef.current = undefined
      return
    }
    const { currentIds, newIds } = detectOperationalArrivals(knownRef.current, orders, now, alertedRef.current)
    knownRef.current = currentIds
    if (!newIds.length) return
    newIds.forEach((id) => alertedRef.current.add(id))
    setNewOrderIds((current) => new Set([...current, ...newIds]))
    if (soundEnabled) void playRef.current()
    if (timerRef.current) clearTimeoutFn(timerRef.current)
    timerRef.current = setTimeoutFn(() => {
      setNewOrderIds(new Set())
      timerRef.current = null
    }, highlightDurationMs)
  }, [active, clearTimeoutFn, highlightDurationMs, now, orders, setTimeoutFn, soundEnabled])

  useEffect(() => {
    if (!soundEnabled || !globalThis.window) return undefined
    const unlock = () => { void player.unlock() }
    globalThis.window.addEventListener('pointerdown', unlock, { passive: true })
    globalThis.window.addEventListener('keydown', unlock)
    return () => {
      globalThis.window.removeEventListener('pointerdown', unlock)
      globalThis.window.removeEventListener('keydown', unlock)
    }
  }, [player, soundEnabled])

  useEffect(() => () => {
    if (timerRef.current) clearTimeoutFn(timerRef.current)
    void player.close()
  }, [clearTimeoutFn, player])

  return { newOrderIds, previewSound, reset }
}
```

- [x] **Step 6: Export and integrate**

Add to `index.js`:

```js
export { useKitchenClock } from './application/useKitchenClock.js'
export { useOrderArrivals } from './application/useOrderArrivals.js'
export { buildKitchenQueueModel } from './domain/kitchenQueue.js'
```

Replace App-owned arrival refs/audio/timer effects with:

```js
const kitchenNow = useKitchenClock(orders, { active: activeTab === 'orders', currentTiming })
const {
  newOrderIds,
  previewSound: previewKitchenOrderSound,
  reset: resetOrderArrivals,
} = useOrderArrivals({ active: activeTab === 'orders', orders, now: kitchenNow, soundEnabled: kitchenSoundEnabled })
```

Keep localStorage preference persistence in App. When enabling sound, call `void previewKitchenOrderSound()`. On session/business clear, call `resetOrderArrivals()`.

- [x] **Step 7: Run focused tests**

```bash
node --test \
  src/domains/orders/application/useOrderArrivals.test.js \
  src/domains/orders/application/useKitchenClock.test.js \
  src/domains/orders/domain/kitchenClock.test.js \
  src/domains/orders/domain/kitchenQueue.test.js \
  src/domains/orders/domain/kitchenTicket.test.js \
  src/domains/orders/domain/orderRealtime.test.js \
  src/pages/OrdersScheduled.test.js \
  src/pages/OrdersMultiItem.test.js
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add src/domains/orders src/App.jsx src/pages src/components src/hooks src/utils
git commit -m "refactor: move kitchen operations into orders"
```

---

### Task 3: Move lifecycle HTTP endpoints into Orders and inject runtime read port

**Files:**
- Create: `src/domains/orders/infrastructure/ordersApi.js`
- Create/Test: `src/domains/orders/infrastructure/ordersApi.test.js`
- Modify: `src/domains/orders/index.js`
- Modify/Test: `src/app/runtime/data/useOperationalDataRuntime.js`, `src/app/runtime/data/useOperationalDataRuntime.test.js`
- Modify: `src/api/client.js` to remove only `getOrders` in this task.

**Interfaces:**
- Produces `createOrdersApi({ request, json, randomUUID })` and singleton `ordersApi` with `getOrders`, `createOrder`, `updateOrderStatus`, `cancelOrder`.
- Runtime consumes `ordersApi.getOrders`; polling stays runtime-owned.

- [x] **Step 1: Write failing adapter test**

Create `ordersApi.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { createOrdersApi } from './ordersApi.js'

test('orders api preserves lifecycle routes and idempotency', async () => {
  const calls = []
  const request = async (path, options = {}) => { calls.push([path, options]); return { ok: true } }
  const json = (method, body) => ({ method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  const api = createOrdersApi({ request, json, randomUUID: () => 'generated-key' })
  await api.getOrders()
  await api.createOrder({ client: 'Ana' })
  await api.updateOrderStatus('order / 1')
  await api.cancelOrder('order / 1', { reasonId: 'r-1' })
  assert.equal(calls[0][0], '/api/orders')
  assert.equal(calls[1][1].headers['idempotency-key'], 'generated-key')
  assert.equal(calls[1][1].headers['content-type'], 'application/json')
  assert.equal(calls[2][0], '/api/orders/order%20%2F%201/status')
  assert.equal(JSON.parse(calls[2][1].body).status, 'Finalizado')
  assert.equal(calls[3][0], '/api/orders/order%20%2F%201/cancel')
})
```

- [x] **Step 2: Run RED**

```bash
node --test src/domains/orders/infrastructure/ordersApi.test.js
```

Expected: FAIL because the adapter does not exist.

- [x] **Step 3: Implement adapter**

Create `ordersApi.js`:

```js
import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createOrdersApi = ({ request = apiRequest, json = withJson, randomUUID = () => crypto.randomUUID() } = {}) => Object.freeze({
  getOrders: () => request('/api/orders'),
  createOrder: (order, idempotencyKey = randomUUID()) => {
    const options = json('POST', order)
    return request('/api/orders', {
      ...options,
      headers: { ...(options.headers || {}), 'idempotency-key': idempotencyKey },
    })
  },
  updateOrderStatus: (id, status = 'Finalizado') => request(
    `/api/orders/${encodeURIComponent(id)}/status`,
    json('PATCH', { status }),
  ),
  cancelOrder: (id, payload) => request(
    `/api/orders/${encodeURIComponent(id)}/cancel`,
    json('POST', payload),
  ),
})

export const ordersApi = createOrdersApi()
```

- [x] **Step 4: Export and inject into runtime**

Add:

```js
export { createOrdersApi, ordersApi } from './infrastructure/ordersApi.js'
```

In runtime:

```js
import { getBootstrap } from '../../../api/client.js'
import { ordersApi } from '../../../domains/orders/index.js'
const defaultApi = { getBootstrap, getOrders: ordersApi.getOrders }
```

Do not change `refreshOrders`, sync guards, or timing constants.

- [x] **Step 5: Add runtime regression assertion**

In `useOperationalDataRuntime.test.js`, assert:

```js
assert.equal(ORDER_SYNC_INTERVAL_MS, 2_000)
```

and use an injected `{ getBootstrap, getOrders }` fake to verify `refreshOrders()` applies the injected result and stale reads still lose to later mutations.

- [x] **Step 6: Remove only legacy `getOrders` export**

Delete `export const getOrders = () => apiRequest('/api/orders')` from `src/api/client.js`. Keep create/status/cancel there temporarily until Task 7 closes their last consumer.

- [x] **Step 7: Run tests**

```bash
node --test src/domains/orders/infrastructure/ordersApi.test.js src/app/runtime/data/useOperationalDataRuntime.test.js
npm run test:architecture
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add src/domains/orders src/app/runtime/data src/api/client.js
git commit -m "refactor: move orders api behind domain port"
```

---

### Task 4: Transfer Operations and Cancellation policy ownership into Orders

**Files:**
- Move: `src/app/surfaces/settings/policies/policyHttp.js` → `src/infrastructure/api/policyHttp.js`
- Create/Test: `src/infrastructure/api/policyHttp.test.js`
- Create: `src/domains/orders/infrastructure/operationsPolicy.js`
- Create: `src/domains/orders/infrastructure/cancellationReasonsPolicy.js`
- Modify: `src/domains/orders/index.js`
- Modify: `src/app/surfaces/settings/policies/registry.js`, `paymentMethodsPolicy.js`, `financeCategoriesPolicy.js`, `printingPolicy.js`
- Modify/Test: `src/app/surfaces/settings/policies/policyAdapters.test.js`
- Delete: old Settings-owned `operationsPolicy.js`, `cancellationReasonsPolicy.js`.

**Interfaces:**
- Generic infra produces `createPathPolicyAdapter`, `validatePolicyScope`, `loadPolicyReceipt`, `getJson`, `putJson`.
- Orders public entry produces `operationsPolicy`, `cancellationReasonsPolicy`.

- [x] **Step 1: Write failing ownership assertion**

Add to `policyAdapters.test.js`:

```js
import { cancellationReasonsPolicy, operationsPolicy } from '../../../../domains/orders/index.js'

test('operations and cancellation policies come from Orders', () => {
  assert.equal(getSettingsPolicy('operations'), operationsPolicy)
  assert.equal(getSettingsPolicy('cancellationReasons'), cancellationReasonsPolicy)
  assert.deepEqual(operationsPolicy.destinations, ['settings-operations', 'settings-modalities'])
  assert.equal(operationsPolicy.capability, 'operations.settings.view')
  assert.equal(cancellationReasonsPolicy.capability, 'orders.settings.view')
})
```

- [x] **Step 2: Run RED**

```bash
node --test src/app/surfaces/settings/policies/policyAdapters.test.js
```

Expected: FAIL because Orders does not export the adapters.

- [x] **Step 3: Move generic policy HTTP helper**

```bash
git mv src/app/surfaces/settings/policies/policyHttp.js src/infrastructure/api/policyHttp.js
```

Change its first import to:

```js
import { apiRequest, withJson } from './httpClient.js'
```

Preserve all current scope error codes/messages, envelope logic, and receipt URL behavior.

Create `policyHttp.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePolicyScope } from './policyHttp.js'

test('generic policy transport keeps scope error contracts', () => {
  assert.throws(() => validatePolicyScope({ scoped: true }), { code: 'SETTINGS_SCOPE_REQUIRED' })
  assert.throws(() => validatePolicyScope({ scoped: false }, 'station-1'), { code: 'SETTINGS_SCOPE_INVALID' })
})
```

- [x] **Step 4: Create Orders-owned policy adapters**

`operationsPolicy.js`:

```js
import { createPathPolicyAdapter } from '../../../infrastructure/api/policyHttp.js'
export const operationsPolicy = createPathPolicyAdapter({
  id: 'operations',
  path: '/api/settings/operations',
  destinations: Object.freeze(['settings-operations', 'settings-modalities']),
  capability: 'operations.settings.view',
})
```

`cancellationReasonsPolicy.js`:

```js
import { createPathPolicyAdapter } from '../../../infrastructure/api/policyHttp.js'
export const cancellationReasonsPolicy = createPathPolicyAdapter({
  id: 'cancellationReasons',
  path: '/api/settings/cancellation-reasons',
  destinations: Object.freeze(['settings-cancellations']),
  capability: 'orders.settings.view',
})
```

- [x] **Step 5: Wire Settings through the Orders public entry**

Add exports in `index.js`, then change `registry.js` to:

```js
import { cancellationReasonsPolicy, operationsPolicy } from '../../../../domains/orders/index.js'
```

Update the remaining Settings policies to import generic policy HTTP helpers from `src/infrastructure/api/policyHttp.js` at the correct relative depth.

- [x] **Step 6: Delete old concrete policy files**

```bash
git rm src/app/surfaces/settings/policies/operationsPolicy.js src/app/surfaces/settings/policies/cancellationReasonsPolicy.js
```

- [x] **Step 7: Run regressions**

```bash
node --test \
  src/infrastructure/api/policyHttp.test.js \
  src/app/surfaces/settings/policies/policyAdapters.test.js \
  src/app/surfaces/settings/policies/navigation.test.js \
  src/app/surfaces/settings/OperationSettings.test.js \
  src/app/surfaces/settings/CancellationSettings.test.js
npm run test:architecture
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add src/infrastructure/api src/domains/orders src/app/surfaces/settings
git commit -m "refactor: move order policies to orders domain"
```

---

### Task 5: Build the pure New Order draft lifecycle controller

**Files:**
- Create: `src/domains/orders/application/newOrderDraft.js`
- Create/Test: `src/domains/orders/application/newOrderDraft.test.js`
- Modify: `src/domains/orders/index.js`

**Interfaces:**
- Produces `createNewOrderDraftController({ randomUUID })`.
- Methods: `open(context)`, `discard()`, `setDirty(value)`, `beginSubmit()`, `isCurrent(token)`, `complete(token)`, `snapshot()`.
- `snapshot()` exposes only `{ context, dirty, renderKey }`; generation/idempotency stay internal or in opaque submit tokens.

- [x] **Step 1: Write failing controller tests**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { createNewOrderDraftController } from './newOrderDraft.js'

test('draft owns generation, idempotency, dirtiness, and stale invalidation', () => {
  const ids = ['key-1', 'key-2']
  const controller = createNewOrderDraftController({ randomUUID: () => ids.shift() })
  assert.deepEqual(controller.snapshot(), { context: null, dirty: false, renderKey: null })
  controller.open({ returnDestination: 'orders' })
  controller.setDirty(true)
  const first = controller.beginSubmit()
  assert.equal(first.idempotencyKey, 'key-1')
  assert.equal(controller.isCurrent(first), true)
  controller.open({ returnDestination: 'comandas', tableId: 't-1', expectedTableTabId: 'tab-1' })
  assert.equal(controller.isCurrent(first), false)
  assert.equal(controller.snapshot().dirty, false)
  assert.equal(controller.beginSubmit().idempotencyKey, 'key-2')
})

test('complete clears only the current draft', () => {
  const controller = createNewOrderDraftController({ randomUUID: () => 'key' })
  controller.open({ returnDestination: 'orders' })
  const token = controller.beginSubmit()
  assert.equal(controller.complete(token), true)
  assert.equal(controller.isCurrent(token), false)
  assert.equal(controller.snapshot().context, null)
})
```

- [x] **Step 2: Run RED**

```bash
node --test src/domains/orders/application/newOrderDraft.test.js
```

Expected: FAIL.

- [x] **Step 3: Implement controller**

```js
const normalizeContext = ({ returnDestination = 'orders', tableId = '', expectedTableTabId = '' } = {}) => ({
  returnDestination,
  tableId,
  expectedTableTabId,
})

export const createNewOrderDraftController = ({ randomUUID = () => crypto.randomUUID() } = {}) => {
  let generation = 0
  let current = null
  const snapshot = () => ({
    context: current ? { ...current.context } : null,
    dirty: Boolean(current?.dirty),
    renderKey: current ? `new-order:${current.generation}` : null,
  })
  const invalidate = () => { generation += 1; current = null }
  return Object.freeze({
    snapshot,
    open(context) {
      generation += 1
      current = { generation, context: normalizeContext(context), dirty: false, idempotencyKey: randomUUID() }
      return snapshot()
    },
    discard() { invalidate(); return snapshot() },
    setDirty(value) { if (current) current.dirty = Boolean(value); return snapshot() },
    beginSubmit() {
      if (!current) return null
      return Object.freeze({ generation: current.generation, idempotencyKey: current.idempotencyKey, context: { ...current.context } })
    },
    isCurrent(token) { return Boolean(current && token?.generation === current.generation) },
    complete(token) {
      if (!current || token?.generation !== current.generation) return false
      invalidate()
      return true
    },
  })
}
```

- [x] **Step 4: Run GREEN and export**

```bash
node --test src/domains/orders/application/newOrderDraft.test.js
```

Add `export { createNewOrderDraftController } from './application/newOrderDraft.js'` to `index.js`.

- [x] **Step 5: Commit**

```bash
git add src/domains/orders
git commit -m "feat: own new order draft lifecycle"
```

---

### Task 6: Add New Order application hook and remove draft internals from App

**Files:**
- Create: `src/domains/orders/application/useNewOrderDraft.js`
- Create/Test: `src/domains/orders/application/useNewOrderDraft.test.js`
- Modify: `src/domains/orders/index.js`, `src/App.jsx`, `src/AppNewOrderGuard.test.js`.

**Interfaces:**
- `useNewOrderDraft({ submitOrder, canSubmit, commitOfficialEffects, onCommitted, onSuccess, onError, onConflict })` returns `{ context, renderKey, dirty, checkoutPending, open, discard, setDirty, submit, reset }`.
- C5 table validation remains outside Orders before `open()`.

- [x] **Step 1: Write failing stale-checkout test**

Create a React Probe around `useNewOrderDraft`. Test this sequence:

```js
latest.open({ returnDestination: 'orders' })
const firstPromise = latest.submit({ client: 'Ana' })
latest.open({ returnDestination: 'comandas' })
resolveFirst({ order: { id: 'o-1', status: 'Em preparo' } })
await firstPromise
assert.equal(committed.length, 0)
assert.equal(latest.context.returnDestination, 'comandas')
```

Use `react-test-renderer` `act()` for each state change. Add a second test where the response is current and assert `commitOfficialEffects` runs before `onCommitted`, then `onSuccess`, and the draft is cleared.

- [x] **Step 2: Run RED**

```bash
node --test src/domains/orders/application/useNewOrderDraft.test.js
```

Expected: FAIL because the hook does not exist.

- [x] **Step 3: Implement hook around controller**

The submit body must be:

```js
const submit = useCallback(async (payload) => {
  const token = controllerRef.current.beginSubmit()
  if (!token || pendingRef.current || !canSubmitRef.current(payload)) return false
  pendingRef.current = true
  setCheckoutPending(true)
  try {
    const result = await submitOrderRef.current(payload, token.idempotencyKey)
    if (!controllerRef.current.isCurrent(token)) return false
    commitOfficialEffectsRef.current(result)
    await onCommittedRef.current(result, token.context)
    onSuccessRef.current(result.order, token.context)
    pendingRef.current = false
    setCheckoutPending(false)
    controllerRef.current.complete(token)
    publish()
    return true
  } catch (error) {
    if (!controllerRef.current.isCurrent(token)) return false
    if (error?.code === 'POLICY_CHANGED') {
      onErrorRef.current(error)
      return { ok: false, code: 'POLICY_CHANGED' }
    }
    if (error?.status === 409 && token.context.expectedTableTabId) await onConflictRef.current(token.context)
    if (controllerRef.current.isCurrent(token)) onErrorRef.current(error)
    return false
  } finally {
    if (controllerRef.current.isCurrent(token)) {
      pendingRef.current = false
      setCheckoutPending(false)
    }
  }
}, [publish])
```

Implement `open`, `discard`, `setDirty`, `reset` by mutating the controller then publishing `snapshot()`. Keep callback/function dependencies in refs so Orders does not expose owner/key internals.

- [x] **Step 4: Export and integrate App**

Export the hook. In App, keep existing Comanda/table validation, then call:

```js
newOrderDraft.open({ tableId: currentTableId, expectedTableTabId, returnDestination: returnTab })
return completeNavigation('new-order')
```

Configure `useNewOrderDraft` with `ordersApi.createOrder`, `applyOfficialEffects`, current success copy, origin-order tracking, C5 selection callback, `showApiError`, and `refreshBootstrapSilently` for 409 with expected table-tab context.

Use:

```js
const writesBlockedWithoutOrderCheckout = !isOnline || requestKey !== null
const writesBlocked = writesBlockedWithoutOrderCheckout || newOrderDraft.checkoutPending
```

Navigation receives `dirtyOrder: newOrderDraft.dirty`, `checkoutPending: newOrderDraft.checkoutPending`, and `onDiscardOrder: newOrderDraft.discard`. New Order rendering receives `context`, `renderKey`, `submit`, and `setDirty`.

Remove App state/refs/functions named `newOrderContext`, `checkoutKey`, `newOrderDirty`, `newOrderOwnerRef`, `invalidateNewOrderDraft`, and `handleOrderCheckout`.

- [x] **Step 5: Run focused tests**

```bash
node --test \
  src/domains/orders/application/newOrderDraft.test.js \
  src/domains/orders/application/useNewOrderDraft.test.js \
  src/AppNewOrderGuard.test.js \
  src/pages/NewOrderRoute.test.js \
  src/pages/NewOrder.test.js
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/domains/orders src/App.jsx src/AppNewOrderGuard.test.js src/pages
git commit -m "refactor: move new order draft out of app"
```

---

### Task 7: Move finalize/cancel orchestration and retire lifecycle exports from legacy API client

**Files:**
- Create: `src/domains/orders/application/useOrderCommands.js`
- Create/Test: `src/domains/orders/application/useOrderCommands.test.js`
- Modify: `src/domains/orders/index.js`, `src/App.jsx`, `src/api/client.js`.

**Interfaces:**
- `useOrderCommands({ orders, api, canFinalizeOrders, canCancelOrders, canRefundPayments, writesBlocked, applyOfficialEffects, onSuccess, onError })` returns `{ actionKey, pending, finalizeOrder, cancelOrder }`.

- [x] **Step 1: Write failing command tests**

Use a React Probe and injected API. Verify an `Entrega` order finalization commits `{ order }` and emits exact copy `Pedido saiu para entrega`. Verify cancel with `{ refundNow: true }` commits `{ order, movement, tableTab }` and emits `Pedido cancelado e estorno registrado`. Verify refund cancellation is rejected without `canRefundPayments`.

Core assertions:

```js
assert.deepEqual(commits[0], { order: { id: 'o-1', status: 'Finalizado' } })
assert.equal(messages[0], 'Pedido saiu para entrega')
assert.equal(await latest.cancelOrder('o-2', { refundNow: true }), false)
```

- [x] **Step 2: Run RED**

```bash
node --test src/domains/orders/application/useOrderCommands.test.js
```

Expected: FAIL.

- [x] **Step 3: Implement hook**

Use local `actionKey` state and these command rules:

```js
const finalizeOrder = async (orderId) => {
  if (!canFinalizeOrders || writesBlocked || actionKey) return false
  const currentOrder = orders.find((item) => item.id === orderId)
  if (!currentOrder) return false
  setActionKey(`order:status:${orderId}`)
  try {
    const { order } = await api.updateOrderStatus(orderId, 'Finalizado')
    applyOfficialEffects({ order })
    onSuccess(currentOrder.type === 'Entrega' ? 'Pedido saiu para entrega' : 'Pedido finalizado')
    return true
  } catch (error) {
    onError(error)
    return false
  } finally {
    setActionKey(null)
  }
}
```

Implement `cancelOrder` with the same pending guard, cancel capability, `refundNow` refund capability gate, `api.cancelOrder`, generic official-effect commit, exact current success copy, and `onError`.

- [x] **Step 4: Export and integrate App**

Export `useOrderCommands`. Replace App's `handleFinalizeOrder` and `handleCancelOrder`. Include `orderCommands.pending` in effective global write blocking and pass `orderCommands.actionKey` to Histórico.

- [x] **Step 5: Delete lifecycle endpoint exports from legacy client**

Delete exactly `createOrder`, `updateOrderStatus`, and `cancelOrder` from `src/api/client.js`. `getOrders` was removed in Task 3. Keep `updateOrderPaymentPromise`, `refundOrder`, `registerPayment`, all table-tab APIs, and all printing APIs.

- [x] **Step 6: Run focused tests**

```bash
node --test \
  src/domains/orders/application/useOrderCommands.test.js \
  src/pages/OrdersScheduled.test.js \
  src/pages/OrderHistory.test.js \
  src/AppNewOrderGuard.test.js
```

Expected: PASS.

- [x] **Step 7: Verify legacy API ownership is gone**

```bash
rg "export const (getOrders|createOrder|updateOrderStatus|cancelOrder)" src/api/client.js
rg "(createOrderApi|updateOrderStatusApi|cancelOrderApi)" src/App.jsx
```

Expected: no output.

- [x] **Step 8: Commit**

```bash
git add src/domains/orders src/App.jsx src/api/client.js
git commit -m "refactor: move order lifecycle commands to domain"
```

---

### Task 8: Move Novo Pedido UI and creation-only components into Orders

**Files:**
- Move pages/tests: `NewOrder.jsx`, `NewOrderRoute.jsx`, `NewOrder.test.js`, `NewOrderMobile.test.js`, `NewOrderRoute.test.js`, `NewOrderWizard.test.js` from `src/pages/` to `src/domains/orders/ui/`.
- Move components: `NewOrderCartSummary.jsx`, `NewOrderCustomerStep.jsx`, `NewOrderProductsStep.jsx`, `NewOrderReviewStep.jsx`, `NewOrderStepIndicator.jsx`, `OrderCart.jsx`, `OrderCheckoutSummary.jsx`, `OrderProductCatalog.jsx` and their existing tests into `src/domains/orders/ui/components/`.
- Modify: `src/domains/orders/index.js`, `src/App.jsx`.
- Leave `LocalTableSelector.jsx`, `ClientDuplicateModal.jsx`, generic primitives, and `OrderTicketPreview.jsx` outside Orders.

**Interfaces:**
- Public entry exports `NewOrderRoute` only; internal New Order components remain private.

- [x] **Step 1: Add failing UI-boundary test**

Create `src/domains/orders/ordersPublicUi.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { NewOrderRoute } from './index.js'

test('Orders exports NewOrderRoute as a composition surface', () => {
  assert.equal(typeof NewOrderRoute, 'function')
})
```

- [x] **Step 2: Run RED, then baseline existing UI**

```bash
node --test src/domains/orders/ordersPublicUi.test.js
node --test src/pages/NewOrder.test.js src/pages/NewOrderMobile.test.js src/pages/NewOrderRoute.test.js src/pages/NewOrderWizard.test.js src/components/OrderCheckoutSummary.test.js
```

Expected: first command FAIL, second command PASS.

- [x] **Step 3: Move exact files with `git mv`**

```bash
mkdir -p src/domains/orders/ui/components
git mv src/pages/NewOrder.jsx src/domains/orders/ui/NewOrder.jsx
git mv src/pages/NewOrderRoute.jsx src/domains/orders/ui/NewOrderRoute.jsx
git mv src/pages/NewOrder.test.js src/domains/orders/ui/NewOrder.test.js
git mv src/pages/NewOrderMobile.test.js src/domains/orders/ui/NewOrderMobile.test.js
git mv src/pages/NewOrderRoute.test.js src/domains/orders/ui/NewOrderRoute.test.js
git mv src/pages/NewOrderWizard.test.js src/domains/orders/ui/NewOrderWizard.test.js
```

Move each listed creation-only component/test that exists with `git mv`; update generic imports to `src/components` and Orders rule imports to `src/domains/orders/domain` internal paths.

- [x] **Step 4: Export and update App**

Add:

```js
export { NewOrderRoute } from './ui/NewOrderRoute.js'
```

Remove the old `src/pages/NewOrderRoute` import from App and use the Orders public import.

- [x] **Step 5: Run moved UI suite**

```bash
node --test \
  src/domains/orders/ordersPublicUi.test.js \
  src/domains/orders/ui/NewOrder.test.js \
  src/domains/orders/ui/NewOrderMobile.test.js \
  src/domains/orders/ui/NewOrderRoute.test.js \
  src/domains/orders/ui/NewOrderWizard.test.js \
  src/domains/orders/ui/components/OrderCheckoutSummary.test.js
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/domains/orders src/App.jsx src/pages src/components
git commit -m "refactor: move new order ui into domain"
```

---

### Task 9: Move Cozinha and Histórico UI/components into Orders

**Files:**
- Move pages/tests: `src/pages/Orders.jsx`, `OrdersMobile.test.js`, `OrdersMultiItem.test.js`, `OrdersScheduled.test.js`, `OrderHistory.jsx`, `OrderHistory.test.js` → `src/domains/orders/ui/`.
- Move components/tests: `CancelOrderDialog.jsx`, `KitchenTicket.jsx`, `KitchenTicketNotes.jsx`, `OperationalHistoryAnalysis.jsx`, `OrderDetail.jsx`, `OrderDetailTiming.js`, `OrderDetailTiming.jsx` and their existing order-only tests → `src/domains/orders/ui/components/`.
- Modify: `src/domains/orders/index.js`, `src/App.jsx`.
- Keep generic `PaymentBadge`, `StatusBadge`, `ConfirmationDialog`, `Button`, `PageHeader`, printing runtime/facades outside Orders.

**Interfaces:**
- Public entry exports default surfaces as named `Orders` and `OrderHistory`.
- Payment and printing remain props/callbacks.

- [x] **Step 1: Extend public UI test and verify RED**

```js
import { NewOrderRoute, OrderHistory, Orders } from './index.js'

test('Orders public boundary exposes all order surfaces', () => {
  assert.equal(typeof Orders, 'function')
  assert.equal(typeof OrderHistory, 'function')
  assert.equal(typeof NewOrderRoute, 'function')
})
```

Run:

```bash
node --test src/domains/orders/ordersPublicUi.test.js
```

Expected: FAIL because Cozinha/Histórico are not exported yet.

- [x] **Step 2: Establish green pre-move baseline**

```bash
node --test \
  src/pages/OrdersMobile.test.js \
  src/pages/OrdersMultiItem.test.js \
  src/pages/OrdersScheduled.test.js \
  src/pages/OrderHistory.test.js \
  src/components/KitchenTicket.test.js \
  src/components/CancelOrderDialog.test.js \
  src/components/OrderDetailTiming.test.js \
  src/components/OrderDetailPrinting.test.js
```

Expected: PASS.

- [x] **Step 3: Move page files/tests**

```bash
git mv src/pages/Orders.jsx src/domains/orders/ui/Orders.jsx
git mv src/pages/OrdersMobile.test.js src/domains/orders/ui/OrdersMobile.test.js
git mv src/pages/OrdersMultiItem.test.js src/domains/orders/ui/OrdersMultiItem.test.js
git mv src/pages/OrdersScheduled.test.js src/domains/orders/ui/OrdersScheduled.test.js
git mv src/pages/OrderHistory.jsx src/domains/orders/ui/OrderHistory.jsx
git mv src/pages/OrderHistory.test.js src/domains/orders/ui/OrderHistory.test.js
```

Move each listed order-only component/test with `git mv`. Use direct Orders-internal rule imports inside `src/domains/orders`; use existing external owners for generic UI/navigation/payment/printing.

- [x] **Step 4: Export surfaces and update App**

Add:

```js
export { default as Orders } from './ui/Orders.jsx'
export { default as OrderHistory } from './ui/OrderHistory.jsx'
```

Consolidate App into one Orders public import. App must not import `src/domains/orders/domain`, `application`, `infrastructure`, or `ui` paths directly.

- [x] **Step 5: Run moved UI suite**

```bash
node --test \
  src/domains/orders/ordersPublicUi.test.js \
  src/domains/orders/ui/OrdersMobile.test.js \
  src/domains/orders/ui/OrdersMultiItem.test.js \
  src/domains/orders/ui/OrdersScheduled.test.js \
  src/domains/orders/ui/OrderHistory.test.js \
  src/domains/orders/ui/components/KitchenTicket.test.js \
  src/domains/orders/ui/components/CancelOrderDialog.test.js \
  src/domains/orders/ui/components/OrderDetailTiming.test.js \
  src/domains/orders/ui/components/OrderDetailPrinting.test.js
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/domains/orders src/App.jsx src/pages src/components
git commit -m "refactor: move order surfaces into domain"
```

---

### Task 10: Enforce Orders boundary and remove all C4 legacy owner paths

**Files:**
- Modify: `scripts/architecture/check-import-boundaries.mjs`
- Modify/Test: `scripts/architecture/check-import-boundaries.test.mjs`
- Modify: `docs/superpowers/qa/spec-c-compatibility-facades.md`
- Delete any migrated C4 legacy file that still exists.

**Interfaces:**
- Non-Orders code may import only `src/domains/orders/index.js`.
- Checker rejects migrated legacy owner paths and reintroduced lifecycle endpoint exports in `src/api/client.js`.

- [x] **Step 1: Write failing architecture fixture tests**

Add fixtures that assert:

```js
assert.ok(violations.some((item) => item.startsWith('orders-deep-import:')))
assert.ok(violations.some((item) => item.startsWith('c4-legacy-orders-owner:')))
```

Deep-import fixture: `src/App.jsx` imports `./domains/orders/domain/orderLifecycle.js`. Legacy fixture: create `src/pages/Orders.jsx` in the temporary fixture tree.

- [x] **Step 2: Run RED**

```bash
node --test scripts/architecture/check-import-boundaries.test.mjs
```

Expected: FAIL because C4 rules are absent.

- [x] **Step 3: Add exact C4 legacy owner set**

Add this set to the checker:

```js
const C4_LEGACY_ORDERS_OWNERS = new Set([
  'src/pages/NewOrder.jsx',
  'src/pages/NewOrderRoute.jsx',
  'src/pages/OrderHistory.jsx',
  'src/pages/Orders.jsx',
  'src/hooks/useKitchenClock.js',
  'src/utils/cancellationReasonOptions.js',
  'src/utils/kitchenClock.js',
  'src/utils/kitchenQueue.js',
  'src/utils/kitchenTicket.js',
  'src/utils/newOrderStepFlow.js',
  'src/utils/orderCart.js',
  'src/utils/orderLifecycle.js',
  'src/utils/orderPaymentEligibility.js',
  'src/utils/orderRealtime.js',
  'src/utils/orderTypeOptions.js',
  'src/utils/orderWorkflow.js',
  'src/components/CancelOrderDialog.jsx',
  'src/components/KitchenTicket.jsx',
  'src/components/KitchenTicketNotes.jsx',
  'src/components/NewOrderCartSummary.jsx',
  'src/components/NewOrderCustomerStep.jsx',
  'src/components/NewOrderProductsStep.jsx',
  'src/components/NewOrderReviewStep.jsx',
  'src/components/NewOrderStepIndicator.jsx',
  'src/components/OperationalHistoryAnalysis.jsx',
  'src/components/OrderCart.jsx',
  'src/components/OrderCheckoutSummary.jsx',
  'src/components/OrderDetail.jsx',
  'src/components/OrderDetailTiming.js',
  'src/components/OrderDetailTiming.jsx',
  'src/components/OrderProductCatalog.jsx',
])
```

Add the same source-existence loop pattern already used for C3.

- [x] **Step 4: Add deep-import rule**

```js
if (!edge.from.startsWith('src/domains/orders/')
  && edge.resolvedPath?.startsWith('src/domains/orders/')
  && edge.resolvedPath !== 'src/domains/orders/index.js') {
  violations.push(`orders-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
}
```

Do not apply this to imports from within Orders itself.

- [x] **Step 5: Add migrated API ownership check**

Read `src/api/client.js` once in `findArchitectureViolations`. Match only declarations of these exact exported names:

```js
const migratedOrderApiPattern = /export\s+const\s+(getOrders|createOrder|updateOrderStatus|cancelOrder)\b/
```

If it matches, add `c4-legacy-orders-api: src/api/client.js`. Do not match `refundOrder`, `registerPayment`, `updateOrderPaymentPromise`, print APIs, or callback props.

- [x] **Step 6: Verify migrated old paths are physically gone**

```bash
for path in \
  src/pages/Orders.jsx \
  src/pages/OrderHistory.jsx \
  src/pages/NewOrder.jsx \
  src/pages/NewOrderRoute.jsx \
  src/hooks/useKitchenClock.js \
  src/utils/orderCart.js \
  src/utils/orderLifecycle.js \
  src/utils/orderPaymentEligibility.js \
  src/utils/orderRealtime.js \
  src/utils/orderWorkflow.js \
  src/utils/kitchenQueue.js; do
  test ! -e "$path" || { echo "legacy owner remains: $path"; exit 1; }
done
```

Expected: exit 0.

- [x] **Step 7: Verify App no longer owns Orders internals**

```bash
rg "newOrderOwnerRef|checkoutKey|knownOperationalOrderIdsRef|alertedOrderIdsRef|kitchenAudioContextRef|newOrderHighlightTimerRef|createOrderApi|updateOrderStatusApi|cancelOrderApi" src/App.jsx
```

Expected: no output.

- [x] **Step 8: Run architecture tests**

```bash
node --test scripts/architecture/check-import-boundaries.test.mjs
npm run test:architecture
node --test src/domains/orders/ordersPublicContract.test.js src/domains/orders/ordersPublicUi.test.js
```

Expected: PASS and `Frontend architecture boundaries: OK`.

- [x] **Step 9: Update compatibility ledger**

Add a C4 status subsection stating: no C4 Orders facade survives; lifecycle endpoints moved out of `src/api/client.js`; payment-receipt bridge still targets C6; table-commit bridge still targets C5; generic/auth facade still targets C10 at latest; `updateCollection` keeps its existing C8/C10 schedule.

- [x] **Step 10: Commit**

```bash
git add scripts/architecture src docs/superpowers/qa/spec-c-compatibility-facades.md
git commit -m "refactor: enforce orders domain boundary"
```

---

### Task 11: Run full gates, record QA, validate GitHub, deploy staging, and stop at merge gate

**Files:**
- Create: `docs/superpowers/qa/spec-c4-orders-qa.md`
- Modify: `docs/superpowers/qa/spec-c-execution-ledger.md`
- Modify: `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
- No production workflow/config changes.

**Interfaces:**
- Produces exact executable SHA evidence, local gate evidence, GitHub Validate evidence, staging evidence, and manual homologation results.
- Does not merge or deploy production.

- [ ] **Step 1: Run complete local gates**

```bash
git status --short
git diff --check
npm test
npm run test:architecture
npm run lint
npm run build
npm run d1:migrate:local
```

Expected: no unexpected tracked changes, diff-check exit 0, tests/architecture/lint/build/D1 commands exit 0. Existing warning classes may be recorded, but any error/failing exit stops the task.

- [ ] **Step 2: Audit scope**

```bash
git diff --name-status origin/master...HEAD
git diff origin/master...HEAD -- worker migrations src/printing
rg "domains/orders/(domain|application|infrastructure|ui)/" src --glob '!domains/orders/**'
```

Expected: no Worker/migration changes, no C9 runtime refactor, and no non-Orders deep import.

- [ ] **Step 3: Capture executable identity before creating QA docs**

Run:

```bash
git rev-parse HEAD
```

Store that exact 40-character SHA in the QA file created in the next step; the QA file must contain the real value, never a marker or symbolic ref.

- [ ] **Step 4: Create QA record with exact values**

Create `docs/superpowers/qa/spec-c4-orders-qa.md` with headings `Execution identity`, `Automated gates`, `Scope audit`, `GitHub Validate`, `Staging deployment`, and `Manual staging homologation matrix`. Under Execution identity write:

```text
Slice: C4 — Orders
Branch: feature/spec-c4-orders
Base SHA: 737beeac2150aabeb39024af823f2f60fee25108
Executable SHA: [paste the exact output captured in Step 3]
Production deploy: NO
Merge: NO
```

The bracketed instruction is not committed: replace that entire line value with the captured SHA before `git add`.

Add these 20 matrix rows as `PENDING`:

```text
1 Novo Pedido imediato — abrir, preencher, salvar, retornar
2 Novo Pedido agendado — horário e validação de mesmo dia
3 Draft sujo — continuar editando / descartar
4 Novo Pedido vindo de Comandas — contexto e retorno
5 POLICY_CHANGED — feedback/retry se reproduzível com segurança
6 Cozinha — filas imediato/agendado e regra temporal
7 Cozinha — busca cliente/pedido/produto/tipo
8 Cozinha — chegada nova sem reload
9 Cozinha — som/highlight uma vez e preferência local
10 Cozinha — finalização e mensagem de sucesso
11 Cozinha — cancelamento, motivo e permissão de estorno
12 Histórico — filtros, detalhes e metadados de cancelamento
13 Cozinha/Histórico — pagamento externo continua abrindo
14 Detalhe — entrada de impressão permanece igual
15 Settings Operação — carregar/editar/salvar/cancelar
16 Settings Modalidades — mesmo draft de Operação, sem prompt interno
17 Settings Cancelamentos — adicionar/editar/ordenar/salvar/cancelar/read-only
18 Desktop claro/escuro — Cozinha/Novo Pedido/Histórico
19 Mobile/narrow claro/escuro — Cozinha/Novo Pedido/Histórico
20 Console — nenhum novo erro atribuível à C4
```

Manual PASS requires direct observation; automated tests cannot upgrade a manual row.

- [ ] **Step 5: Record pre-staging status in ledger/rollout and commit docs**

Set C4 to `AUTOMATED GATES GREEN — STAGING PENDING`, include the exact executable SHA from Step 3, and keep C5 `NOT STARTED`.

```bash
git add docs/superpowers/qa/spec-c4-orders-qa.md docs/superpowers/qa/spec-c-execution-ledger.md docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md
git commit -m "docs: record c4 pre-staging qa"
```

- [ ] **Step 6: Push and run Validate on exact branch HEAD**

```bash
git push -u origin feature/spec-c4-orders
```

Trigger the existing `Validate application` workflow for `feature/spec-c4-orders`. Wait for completion; record run number, run ID, event, head SHA, and `success` conclusion in the QA file.

- [ ] **Step 7: Deploy staging manually**

Trigger the existing manual staging deployment for `feature/spec-c4-orders`. Confirm the deployment run succeeds and record its exact deployed SHA plus:

```text
https://sistema-para-delivery-staging.vzaponi.workers.dev
```

Do not trigger production.

- [ ] **Step 8: Execute manual matrix with the user**

Guide the user through rows 1–20. Record only `PASS`, `FAIL`, or `BLOCKED` from direct observation. Any `FAIL` stops merge preparation and returns to systematic debugging/TDD.

- [ ] **Step 9: Commit manual QA result and run final docs-head Validate**

After manual results are recorded, verify changes since the staged executable are documentation-only, commit the QA/ledger update, push, and run `Validate application` on the final branch HEAD. Record the final successful run.

- [ ] **Step 10: Stop at merge gate**

Ask for merge authorization only if all executable gates are green, staging succeeded, manual matrix has `0 FAIL`, every BLOCKED row is honestly documented, final branch HEAD Validate is green, master movement has been reconciled, and production remains untouched. Do not create/merge the PR or deploy production without explicit user authorization.
