# Spec C4 — Orders Domain Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish `src/domains/orders` as the single frontend owner for order rules, order-specific application behavior, order UI, lifecycle API adapters, and Orders-owned settings policies while preserving the central runtime as the only official synchronized order store.

**Architecture:** Extract Orders incrementally behind `src/domains/orders/index.js`. Keep `app/runtime` responsible for official collections, polling, focus/visibility refresh, and sync guards; Orders receives official data and narrow commit ports. Keep Table Service, Finance, Customers, Catalog, and Printing integrations external through callbacks until C5/C6/C7/C8/C9.

**Tech Stack:** React 19.2.8, Vite 8.2.2, Node 22 `node:test`, `react-test-renderer` 19.2.8, oxlint 1.79.0, Cloudflare Worker/D1, GitHub Actions, QZ Tray 2.2.6 unchanged.

**Spec:** `docs/superpowers/specs/2026-09-17-frontend-modularization-c4-orders-design.md`

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

`src/domains/orders/domain/` will own pure order rules currently spread across `src/utils`: cart/search, lifecycle/refund presentation state, payment eligibility, workflow/date helpers, type options, New Order step flow, cancellation-reason effective-config projection, kitchen queue/ticket/clock rules, and realtime arrival detection.

`src/domains/orders/application/` will own `useKitchenClock`, the Cozinha arrival/highlight/sound lifecycle, the New Order draft lifecycle, and finalize/cancel command orchestration.

`src/domains/orders/infrastructure/` will own lifecycle HTTP endpoints and the operations/cancellation settings policy adapters. Generic HTTP remains in `src/infrastructure/api/`.

`src/domains/orders/ui/` will own Cozinha, Histórico, Novo Pedido, and components that have order-only meaning. Generic primitives, `LocalTableSelector`, payment workflow UI, printing runtime, and navigation stay outside the domain.

`src/domains/orders/index.js` is the only supported Orders import path for non-Orders code.

---

### Task 1: Establish the Orders public boundary and move core pure order rules

**Files:**
- Create: `src/domains/orders/index.js`
- Create/Test: `src/domains/orders/ordersPublicContract.test.js`
- Move: `src/utils/orderCart.js` → `src/domains/orders/domain/orderCart.js`
- Move: `src/utils/orderCart.test.js` → `src/domains/orders/domain/orderCart.test.js`
- Move: `src/utils/orderLifecycle.js` → `src/domains/orders/domain/orderLifecycle.js`
- Move: `src/utils/orderLifecycle.test.js` → `src/domains/orders/domain/orderLifecycle.test.js`
- Move: `src/utils/orderPaymentEligibility.js` → `src/domains/orders/domain/orderPaymentEligibility.js`
- Move: `src/utils/orderPaymentEligibility.test.js` → `src/domains/orders/domain/orderPaymentEligibility.test.js`
- Move: `src/utils/orderWorkflow.js` → `src/domains/orders/domain/orderWorkflow.js`
- Move: `src/utils/orderWorkflow.test.js` → `src/domains/orders/domain/orderWorkflow.test.js`
- Move: `src/utils/orderTypeOptions.js` → `src/domains/orders/domain/orderTypeOptions.js`
- Move: `src/utils/newOrderStepFlow.js` → `src/domains/orders/domain/newOrderStepFlow.js`
- Move: `src/utils/newOrderStepFlow.test.js` → `src/domains/orders/domain/newOrderStepFlow.test.js`
- Move: `src/utils/cancellationReasonOptions.js` → `src/domains/orders/domain/cancellationReasonOptions.js`
- Modify imports in: `src/App.jsx`, `src/pages/NewOrder.jsx`, `src/pages/OrderHistory.jsx`, and current order-specific components/tests that import the moved utilities.

**Interfaces:**
- Consumes: `shared/orderTiming.js`, `shared/orderDisplayNumber.js`, and existing capability helpers without copying them.
- Produces: public named exports from `src/domains/orders/index.js` for any moved rule currently consumed outside Orders; internal Orders code may later import direct domain paths.

- [ ] **Step 1: Add a failing public-contract characterization test**

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

test('orders public contract exposes the existing pure order rules', () => {
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

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test src/domains/orders/ordersPublicContract.test.js
```

Expected: FAIL because `src/domains/orders/index.js` and its exports do not exist yet.

- [ ] **Step 3: Move the files without changing their business logic**

Run:

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

Update relative `shared/` imports in the moved files from `../../shared/...` to `../../../../shared/...` only where required by the new directory depth.

- [ ] **Step 4: Create the first Orders public entry point**

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
export {
  formatCancellationDate,
  formatOrderDate,
  toLocalDateValue,
} from './domain/orderWorkflow.js'
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
export {
  cancellationOptionsFromEffective,
  cancellationRevisionFromEffective,
} from './domain/cancellationReasonOptions.js'
```

Use the exact export names already present in the moved source files; if `orderWorkflow.js` exports additional current consumers, export those names too rather than recreating wrappers.

- [ ] **Step 5: Rewrite non-Orders imports to the public boundary**

For current non-Orders consumers, replace imports such as:

```js
import { isOrderActive } from './utils/orderLifecycle.js'
import { getOrderItemsSearchText } from './utils/orderCart.js'
```

with:

```js
import { getOrderItemsSearchText, isOrderActive } from './domains/orders/index.js'
```

and use the equivalent relative public-index import from files under `src/pages/` and `src/components/`. Do not create compatibility reexport files under `src/utils/`.

- [ ] **Step 6: Run focused rule tests**

Run:

```bash
node --test \
  src/domains/orders/ordersPublicContract.test.js \
  src/domains/orders/domain/orderCart.test.js \
  src/domains/orders/domain/orderLifecycle.test.js \
  src/domains/orders/domain/orderPaymentEligibility.test.js \
  src/domains/orders/domain/orderWorkflow.test.js \
  src/domains/orders/domain/newOrderStepFlow.test.js
```

Expected: PASS, with no order-rule file left at the moved `src/utils/` paths.

- [ ] **Step 7: Verify old imports are gone**

Run:

```bash
rg "utils/(orderCart|orderLifecycle|orderPaymentEligibility|orderWorkflow|orderTypeOptions|newOrderStepFlow|cancellationReasonOptions)" src
```

Expected: no output.

- [ ] **Step 8: Commit Task 1**

```bash
git add src/domains/orders src/App.jsx src/pages src/components src/utils
git commit -m "refactor: establish orders domain rules"
```

---

### Task 2: Move Cozinha timing/queue rules and arrival notifications into Orders

**Files:**
- Move: `src/utils/kitchenClock.js` → `src/domains/orders/domain/kitchenClock.js`
- Move: `src/utils/kitchenClock.test.js` → `src/domains/orders/domain/kitchenClock.test.js`
- Move: `src/utils/kitchenQueue.js` → `src/domains/orders/domain/kitchenQueue.js`
- Move: `src/utils/kitchenQueue.test.js` → `src/domains/orders/domain/kitchenQueue.test.js`
- Move: `src/utils/kitchenTicket.js` → `src/domains/orders/domain/kitchenTicket.js`
- Move: `src/utils/kitchenTicket.test.js` → `src/domains/orders/domain/kitchenTicket.test.js`
- Move: `src/utils/orderRealtime.js` → `src/domains/orders/domain/orderRealtime.js`
- Move: `src/utils/orderRealtime.test.js` → `src/domains/orders/domain/orderRealtime.test.js`
- Move: `src/hooks/useKitchenClock.js` → `src/domains/orders/application/useKitchenClock.js`
- Move: `src/hooks/useKitchenClock.test.js` → `src/domains/orders/application/useKitchenClock.test.js`
- Create: `src/domains/orders/infrastructure/browserOrderAlert.js`
- Create: `src/domains/orders/application/useOrderArrivals.js`
- Create/Test: `src/domains/orders/application/useOrderArrivals.test.js`
- Modify: `src/domains/orders/index.js`
- Modify: `src/App.jsx`
- Modify current Cozinha components/tests that import kitchen utilities.

**Interfaces:**
- Consumes: official `orders[]`, `now`, `active`, and external/local `soundEnabled`.
- Produces: `useKitchenClock(orders, { active, currentTiming })`; `useOrderArrivals({ active, orders, now, soundEnabled, playSound? })` returning `{ newOrderIds, previewSound, reset }`.

- [ ] **Step 1: Write the failing arrival lifecycle test**

Create `src/domains/orders/application/useOrderArrivals.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useOrderArrivals } from './useOrderArrivals.js'

const activeOrder = (id) => ({ id, status: 'Em preparo', orderDate: '2026-09-17' })

test('useOrderArrivals establishes a baseline, alerts once, and clears highlight', async () => {
  const sounds = []
  let latest
  let renderer
  const timers = []
  const setTimeoutFn = (fn) => { timers.push(fn); return timers.length }
  const clearTimeoutFn = () => {}

  function Probe(props) {
    latest = useOrderArrivals({ ...props, setTimeoutFn, clearTimeoutFn })
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

  await act(async () => {
    renderer.update(<Probe active orders={[activeOrder('1'), activeOrder('2')]} now={new Date('2026-09-17T12:00:02-03:00')} soundEnabled playSound={() => sounds.push('sound')} />)
  })
  assert.equal(sounds.length, 1)

  await act(async () => { timers.at(-1)?.() })
  assert.deepEqual([...latest.newOrderIds], [])
  renderer.unmount()
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/domains/orders/application/useOrderArrivals.test.js
```

Expected: FAIL because `useOrderArrivals.js` does not exist.

- [ ] **Step 3: Move the existing kitchen rules and hook**

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

Update moved-file relative imports so they continue to consume `shared/orderTiming.js` rather than copying timing constants.

- [ ] **Step 4: Add the browser sound adapter**

Create `src/domains/orders/infrastructure/browserOrderAlert.js` with a module-scoped player factory:

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
      const playTone = (frequency, delay) => {
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
      playTone(784, 0)
      playTone(988, 0.16)
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

- [ ] **Step 5: Implement `useOrderArrivals` using the existing pure detector**

Create `src/domains/orders/application/useOrderArrivals.js` so that it:

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
  const play = playSound || player.play
  const knownIdsRef = useRef(undefined)
  const alertedIdsRef = useRef(new Set())
  const timerRef = useRef(null)
  const [newOrderIds, setNewOrderIds] = useState(() => new Set())

  const reset = useCallback(() => {
    knownIdsRef.current = undefined
    alertedIdsRef.current = new Set()
    if (timerRef.current) clearTimeoutFn(timerRef.current)
    timerRef.current = null
    setNewOrderIds(new Set())
  }, [clearTimeoutFn])

  const previewSound = useCallback(() => play(), [play])

  useEffect(() => {
    if (!active) {
      knownIdsRef.current = undefined
      return
    }
    const { currentIds, newIds } = detectOperationalArrivals(knownIdsRef.current, orders, now, alertedIdsRef.current)
    knownIdsRef.current = currentIds
    if (!newIds.length) return
    newIds.forEach((id) => alertedIdsRef.current.add(id))
    setNewOrderIds((current) => new Set([...current, ...newIds]))
    if (soundEnabled) void play()
    if (timerRef.current) clearTimeoutFn(timerRef.current)
    timerRef.current = setTimeoutFn(() => {
      setNewOrderIds(new Set())
      timerRef.current = null
    }, highlightDurationMs)
  }, [active, clearTimeoutFn, highlightDurationMs, now, orders, play, setTimeoutFn, soundEnabled])

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

If React dependency identity causes repeated effects, stabilize `play` with a ref/callback without changing the public return shape.

- [ ] **Step 6: Export the operational API from `index.js` and integrate App**

Export:

```js
export { useKitchenClock } from './application/useKitchenClock.js'
export { useOrderArrivals } from './application/useOrderArrivals.js'
export { buildKitchenQueueModel } from './domain/kitchenQueue.js'
export * from './domain/kitchenTicket.js'
```

In `App.jsx`, replace the old arrival refs/state/effects and audio context with:

```js
const kitchenNow = useKitchenClock(orders, { active: activeTab === 'orders', currentTiming })
const {
  newOrderIds,
  previewSound: previewKitchenOrderSound,
  reset: resetOrderArrivals,
} = useOrderArrivals({
  active: activeTab === 'orders',
  orders,
  now: kitchenNow,
  soundEnabled: kitchenSoundEnabled,
})
```

Keep `readKitchenSoundPreference` and localStorage persistence in App. When enabling sound, call `void previewKitchenOrderSound()` instead of App-owned WebAudio code. During business/session clear, call `resetOrderArrivals()` instead of mutating arrival refs.

- [ ] **Step 7: Run focused Cozinha tests**

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

- [ ] **Step 8: Commit Task 2**

```bash
git add src/domains/orders src/App.jsx src/pages src/components src/hooks src/utils
git commit -m "refactor: move kitchen operations into orders"
```

---

### Task 3: Move lifecycle HTTP endpoints into Orders and inject the runtime read port

**Files:**
- Create: `src/domains/orders/infrastructure/ordersApi.js`
- Create/Test: `src/domains/orders/infrastructure/ordersApi.test.js`
- Modify: `src/domains/orders/index.js`
- Modify: `src/app/runtime/data/useOperationalDataRuntime.js`
- Modify/Test: `src/app/runtime/data/useOperationalDataRuntime.test.js`
- Modify: `src/api/client.js` to remove `getOrders` now; keep create/status/cancel temporarily until Task 7 migrates their final consumer.

**Interfaces:**
- Produces `createOrdersApi({ request, json, randomUUID })` and singleton `ordersApi` with exact methods `getOrders`, `createOrder`, `updateOrderStatus`, `cancelOrder`.
- Runtime consumes `ordersApi.getOrders` through the Orders public index; polling cadence remains runtime-owned.

- [ ] **Step 1: Write the failing Orders API contract test**

Create `src/domains/orders/infrastructure/ordersApi.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { createOrdersApi } from './ordersApi.js'

test('orders api preserves lifecycle endpoints and idempotency header', async () => {
  const calls = []
  const request = async (path, options) => { calls.push([path, options]); return { ok: true } }
  const json = (method, body) => ({ method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  const api = createOrdersApi({ request, json, randomUUID: () => 'generated-key' })

  await api.getOrders()
  await api.createOrder({ client: 'Ana' })
  await api.updateOrderStatus('order / 1')
  await api.cancelOrder('order / 1', { reasonId: 'r-1' })

  assert.equal(calls[0][0], '/api/orders')
  assert.equal(calls[1][0], '/api/orders')
  assert.equal(calls[1][1].headers['idempotency-key'], 'generated-key')
  assert.equal(calls[2][0], '/api/orders/order%20%2F%201/status')
  assert.equal(JSON.parse(calls[2][1].body).status, 'Finalizado')
  assert.equal(calls[3][0], '/api/orders/order%20%2F%201/cancel')
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/domains/orders/infrastructure/ordersApi.test.js
```

Expected: FAIL because `ordersApi.js` does not exist.

- [ ] **Step 3: Implement the Orders API adapter**

Create `src/domains/orders/infrastructure/ordersApi.js`:

```js
import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createOrdersApi = ({
  request = apiRequest,
  json = withJson,
  randomUUID = () => crypto.randomUUID(),
} = {}) => Object.freeze({
  getOrders: () => request('/api/orders'),
  createOrder: (order, idempotencyKey = randomUUID()) => request('/api/orders', {
    ...json('POST', order),
    headers: {
      ...json('POST', order).headers,
      'idempotency-key': idempotencyKey,
    },
  }),
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

Avoid calling `json('POST', order)` twice in production code by assigning it once before spreading; preserve both the JSON content-type header and idempotency header.

- [ ] **Step 4: Export the adapter through the public boundary**

Add to `src/domains/orders/index.js`:

```js
export { createOrdersApi, ordersApi } from './infrastructure/ordersApi.js'
```

- [ ] **Step 5: Make runtime consume the Orders read port**

In `useOperationalDataRuntime.js`, change the default imports/adapter to:

```js
import { getBootstrap } from '../../../api/client.js'
import { ordersApi } from '../../../domains/orders/index.js'

const defaultApi = { getBootstrap, getOrders: ordersApi.getOrders }
```

Do not change `ORDER_SYNC_INTERVAL_MS`, `createRefreshSubscription`, `refreshOrders`, sync-guard checks, or 401 handoff.

- [ ] **Step 6: Add a runtime regression assertion**

In `useOperationalDataRuntime.test.js`, add/retain a test using an injected API with `getOrders` that verifies a stale read cannot replace a later mutation and that the dedicated interval remains `2_000`. The assertion must include:

```js
assert.equal(ORDER_SYNC_INTERVAL_MS, 2_000)
```

and must verify `refreshOrders()` uses the injected `getOrders` rather than a concrete endpoint.

- [ ] **Step 7: Remove only the migrated read export from `src/api/client.js`**

Delete:

```js
export const getOrders = () => apiRequest('/api/orders')
```

Keep `createOrder`, `updateOrderStatus`, and `cancelOrder` until Task 7 so there is no broken intermediate App import. Do not touch payment/refund/payment-promise/printing/table-tab APIs.

- [ ] **Step 8: Run focused tests**

```bash
node --test \
  src/domains/orders/infrastructure/ordersApi.test.js \
  src/app/runtime/data/useOperationalDataRuntime.test.js
npm run test:architecture
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add src/domains/orders src/app/runtime/data src/api/client.js
git commit -m "refactor: move orders api behind domain port"
```

---

### Task 4: Transfer Operations and Cancellation policy ownership into Orders

**Files:**
- Create: `src/infrastructure/api/policyHttp.js`
- Create/Test: `src/infrastructure/api/policyHttp.test.js`
- Create: `src/domains/orders/infrastructure/operationsPolicy.js`
- Create: `src/domains/orders/infrastructure/cancellationReasonsPolicy.js`
- Modify: `src/domains/orders/index.js`
- Modify: `src/app/surfaces/settings/policies/registry.js`
- Modify: `src/app/surfaces/settings/policies/paymentMethodsPolicy.js`
- Modify: `src/app/surfaces/settings/policies/financeCategoriesPolicy.js`
- Modify: `src/app/surfaces/settings/policies/printingPolicy.js` only if it imports helpers from the old `policyHttp.js`.
- Modify/Test: `src/app/surfaces/settings/policies/policyAdapters.test.js`
- Delete: `src/app/surfaces/settings/policies/operationsPolicy.js`
- Delete: `src/app/surfaces/settings/policies/cancellationReasonsPolicy.js`
- Delete: `src/app/surfaces/settings/policies/policyHttp.js`

**Interfaces:**
- Generic infrastructure produces `createPathPolicyAdapter`, `validatePolicyScope`, `loadPolicyReceipt`, `getJson`, and `putJson` without concrete resource knowledge.
- Orders public boundary produces `operationsPolicy` and `cancellationReasonsPolicy`.
- Settings registry continues to expose the same resource IDs and editor behavior.

- [ ] **Step 1: Write the failing ownership test**

Add to `policyAdapters.test.js`:

```js
import { cancellationReasonsPolicy, operationsPolicy } from '../../../../domains/orders/index.js'

test('operations and cancellation policies are supplied by the Orders public boundary', () => {
  assert.equal(getSettingsPolicy('operations'), operationsPolicy)
  assert.equal(getSettingsPolicy('cancellationReasons'), cancellationReasonsPolicy)
  assert.deepEqual(operationsPolicy.destinations, ['settings-operations', 'settings-modalities'])
  assert.equal(cancellationReasonsPolicy.capability, 'cancellations.settings.view')
})
```

Use the exact capability currently declared in the existing cancellation policy file if it differs; do not change capability semantics.

- [ ] **Step 2: Run RED**

```bash
node --test src/app/surfaces/settings/policies/policyAdapters.test.js
```

Expected: FAIL because the Orders public boundary does not yet export those adapters.

- [ ] **Step 3: Move the generic HTTP adapter out of Settings**

Copy the current logic from `src/app/surfaces/settings/policies/policyHttp.js` into `src/infrastructure/api/policyHttp.js`, changing only its HTTP import to:

```js
import { apiRequest, withJson } from './httpClient.js'
```

Preserve the current error codes, exact scope messages, receipt URL construction, envelope normalization, and `createPathPolicyAdapter` contract.

Add `src/infrastructure/api/policyHttp.test.js` with assertions for scoped/unscoped validation and receipt URL encoding, for example:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePolicyScope } from './policyHttp.js'

test('policy HTTP scope validation preserves existing error codes', () => {
  assert.throws(() => validatePolicyScope({ scoped: true }), { code: 'SETTINGS_SCOPE_REQUIRED' })
  assert.throws(() => validatePolicyScope({ scoped: false }, 'station-1'), { code: 'SETTINGS_SCOPE_INVALID' })
})
```

- [ ] **Step 4: Create the Orders-owned concrete adapters**

Create `src/domains/orders/infrastructure/operationsPolicy.js`:

```js
import { createPathPolicyAdapter } from '../../../infrastructure/api/policyHttp.js'

export const operationsPolicy = createPathPolicyAdapter({
  id: 'operations',
  path: '/api/settings/operations',
  destinations: Object.freeze(['settings-operations', 'settings-modalities']),
  capability: 'operations.settings.view',
})
```

Create `src/domains/orders/infrastructure/cancellationReasonsPolicy.js` with the same values currently present in the Settings-owned adapter, using `createPathPolicyAdapter` from generic infrastructure.

- [ ] **Step 5: Update the public boundary and Settings registry**

Export from `src/domains/orders/index.js`:

```js
export { operationsPolicy } from './infrastructure/operationsPolicy.js'
export { cancellationReasonsPolicy } from './infrastructure/cancellationReasonsPolicy.js'
```

Update Settings registry imports to:

```js
import { cancellationReasonsPolicy, operationsPolicy } from '../../../../domains/orders/index.js'
```

Update payment/finance/printing policy files to import generic helpers from `src/infrastructure/api/policyHttp.js` via the correct relative path.

- [ ] **Step 6: Delete the former Settings-owned adapters/factory**

```bash
git rm \
  src/app/surfaces/settings/policies/operationsPolicy.js \
  src/app/surfaces/settings/policies/cancellationReasonsPolicy.js \
  src/app/surfaces/settings/policies/policyHttp.js
```

- [ ] **Step 7: Run policy regression tests**

```bash
node --test \
  src/infrastructure/api/policyHttp.test.js \
  src/app/surfaces/settings/policies/policyAdapters.test.js \
  src/app/surfaces/settings/policies/navigation.test.js \
  src/app/surfaces/settings/OperationSettings.test.js \
  src/app/surfaces/settings/CancellationSettings.test.js
npm run test:architecture
```

Expected: PASS with the same Settings resource behavior.

- [ ] **Step 8: Commit Task 4**

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
- Controller public methods: `open(context)`, `discard()`, `setDirty(value)`, `beginSubmit()`, `isCurrent(token)`, `complete(token)`, `snapshot()`.
- `snapshot()` returns `{ context, dirty, renderKey }`; implementation-only generation and idempotency details stay hidden except inside the opaque submit token.

- [ ] **Step 1: Write the failing controller tests**

Create `src/domains/orders/application/newOrderDraft.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { createNewOrderDraftController } from './newOrderDraft.js'

test('new order draft owns generation, idempotency, dirtiness and stale invalidation', () => {
  const ids = ['key-1', 'key-2']
  const controller = createNewOrderDraftController({ randomUUID: () => ids.shift() })

  assert.deepEqual(controller.snapshot(), { context: null, dirty: false, renderKey: null })
  controller.open({ returnDestination: 'orders', tableId: '', expectedTableTabId: '' })
  controller.setDirty(true)
  const first = controller.beginSubmit()

  assert.equal(controller.snapshot().dirty, true)
  assert.equal(first.idempotencyKey, 'key-1')
  assert.equal(controller.isCurrent(first), true)

  controller.open({ returnDestination: 'comandas', tableId: 't-1', expectedTableTabId: 'tab-1' })
  assert.equal(controller.isCurrent(first), false)
  assert.equal(controller.snapshot().dirty, false)
  assert.equal(controller.beginSubmit().idempotencyKey, 'key-2')
})

test('discard and complete invalidate the current token', () => {
  const controller = createNewOrderDraftController({ randomUUID: () => 'key' })
  controller.open({ returnDestination: 'orders' })
  const token = controller.beginSubmit()
  assert.equal(controller.complete(token), true)
  assert.equal(controller.isCurrent(token), false)
  assert.equal(controller.snapshot().context, null)
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/domains/orders/application/newOrderDraft.test.js
```

Expected: FAIL because `newOrderDraft.js` does not exist.

- [ ] **Step 3: Implement the controller**

Create `newOrderDraft.js` with this state model:

```js
const normalizeContext = ({
  returnDestination = 'orders',
  tableId = '',
  expectedTableTabId = '',
} = {}) => ({ returnDestination, tableId, expectedTableTabId })

export const createNewOrderDraftController = ({ randomUUID = () => crypto.randomUUID() } = {}) => {
  let generation = 0
  let current = null

  const snapshot = () => ({
    context: current ? { ...current.context } : null,
    dirty: Boolean(current?.dirty),
    renderKey: current ? `new-order:${current.generation}` : null,
  })

  const invalidate = () => {
    generation += 1
    current = null
  }

  return Object.freeze({
    snapshot,
    open(context) {
      generation += 1
      current = {
        generation,
        context: normalizeContext(context),
        dirty: false,
        idempotencyKey: randomUUID(),
      }
      return snapshot()
    },
    discard() {
      invalidate()
      return snapshot()
    },
    setDirty(value) {
      if (current) current.dirty = Boolean(value)
      return snapshot()
    },
    beginSubmit() {
      if (!current) return null
      return Object.freeze({
        generation: current.generation,
        idempotencyKey: current.idempotencyKey,
        context: { ...current.context },
      })
    },
    isCurrent(token) {
      return Boolean(current && token?.generation === current.generation)
    },
    complete(token) {
      if (!current || token?.generation !== current.generation) return false
      invalidate()
      return true
    },
  })
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test src/domains/orders/application/newOrderDraft.test.js
```

Expected: PASS.

- [ ] **Step 5: Export the controller**

Add:

```js
export { createNewOrderDraftController } from './application/newOrderDraft.js'
```

to `src/domains/orders/index.js`.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/domains/orders
git commit -m "feat: own new order draft lifecycle"
```

---

### Task 6: Add the New Order application hook and remove draft internals from App

**Files:**
- Create: `src/domains/orders/application/useNewOrderDraft.js`
- Create/Test: `src/domains/orders/application/useNewOrderDraft.test.js`
- Modify: `src/domains/orders/index.js`
- Modify/Test: `src/App.jsx`
- Modify existing App New Order guard tests: `src/AppNewOrderGuard.test.js` and any current New Order navigation regression tests.

**Interfaces:**
- `useNewOrderDraft({ submitOrder, canSubmit, commitOfficialEffects, onCommitted, onSuccess, onError, onConflict })` returns `{ context, renderKey, dirty, checkoutPending, open, discard, setDirty, submit, reset }`.
- `onCommitted(result, context)` is the external port for C5/printing-origin effects after the official response is committed.
- `onConflict(context)` is called only for current-draft 409s that carry `expectedTableTabId`.

- [ ] **Step 1: Write the failing hook test**

Create `useNewOrderDraft.test.js` with a Probe component and assertions for stale response suppression and success commit:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useNewOrderDraft } from './useNewOrderDraft.js'

test('stale checkout result cannot commit into a replacement draft', async () => {
  let resolveFirst
  const committed = []
  let latest
  const submitOrder = () => new Promise((resolve) => { resolveFirst = resolve })

  function Probe() {
    latest = useNewOrderDraft({
      submitOrder,
      canSubmit: () => true,
      commitOfficialEffects: (result) => committed.push(result),
      onCommitted: () => {},
      onSuccess: () => {},
      onError: () => {},
      onConflict: async () => {},
    })
    return null
  }

  await act(async () => { TestRenderer.create(<Probe />) })
  await act(async () => { latest.open({ returnDestination: 'orders' }) })
  let pending
  await act(async () => { pending = latest.submit({ client: 'Ana' }) })
  await act(async () => { latest.open({ returnDestination: 'comandas' }) })
  await act(async () => { resolveFirst({ order: { id: 'o-1', status: 'Em preparo' } }); await pending })

  assert.equal(committed.length, 0)
  assert.equal(latest.context.returnDestination, 'comandas')
})
```

Add a second test that resolves while current and asserts `commitOfficialEffects` → `onCommitted` → `onSuccess` → draft cleared and `checkoutPending === false`.

- [ ] **Step 2: Run RED**

```bash
node --test src/domains/orders/application/useNewOrderDraft.test.js
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook around `createNewOrderDraftController`**

The hook must:

```js
const [snapshot, setSnapshot] = useState(() => controllerRef.current.snapshot())
const [checkoutPending, setCheckoutPending] = useState(false)
```

and expose stable callbacks that:

```js
open(context)      // controller.open + checkoutPending false + publish snapshot
discard()          // controller.discard + checkoutPending false + publish snapshot
setDirty(value)    // controller.setDirty + publish snapshot
reset()            // same invalidation semantics as discard
```

`submit(payload)` must execute exactly this order:

```js
const token = controller.beginSubmit()
if (!token || checkoutPending || !canSubmit(payload)) return false
setCheckoutPending(true)
try {
  const result = await submitOrder(payload, token.idempotencyKey)
  if (!controller.isCurrent(token)) return false
  commitOfficialEffects(result)
  await onCommitted(result, token.context)
  onSuccess(result.order, token.context)
  setCheckoutPending(false)
  controller.complete(token)
  publish()
  return true
} catch (error) {
  if (!controller.isCurrent(token)) return false
  if (error?.code === 'POLICY_CHANGED') {
    onError(error)
    return { ok: false, code: 'POLICY_CHANGED' }
  }
  if (error?.status === 409 && token.context.expectedTableTabId) await onConflict(token.context)
  if (controller.isCurrent(token)) onError(error)
  return false
} finally {
  if (controller.isCurrent(token)) setCheckoutPending(false)
}
```

Use refs for callback dependencies if necessary to prevent submit identity churn; do not expose the generation or idempotency key in the returned public state.

- [ ] **Step 4: Export the hook**

```js
export { useNewOrderDraft } from './application/useNewOrderDraft.js'
```

- [ ] **Step 5: Integrate App without moving C5 responsibilities**

In App, keep current table/comanda validation before opening New Order. After validation, call:

```js
newOrderDraft.open({
  tableId: currentTableId,
  expectedTableTabId,
  returnDestination: returnTab,
})
return completeNavigation('new-order')
```

Configure the hook with:

```js
const newOrderDraft = useNewOrderDraft({
  submitOrder: ordersApi.createOrder,
  canSubmit: (payload) => canCreateOrders
    && !writesBlockedWithoutOrderCheckout
    && (canAdjustOrders || !payload?.adjustment || payload.adjustment.type === 'none'),
  commitOfficialEffects: ({ order, movement, tableTab, tables: nextTables }) => {
    applyOfficialEffects({ order, movement, tableTab, tables: nextTables })
  },
  onCommitted: ({ order, tableTab, tables: nextTables }, context) => {
    if (context.returnDestination === 'comandas' && tableTab?.id) {
      const table = nextTables?.find((item) => item.isActive && item.occupancy === 'occupied' && item.openTableTab?.id === tableTab.id)
      if (table) selectComanda({ tableId: table.id, tableTabId: tableTab.id })
    }
    setOriginOrderIds(rememberOriginOrderId(order.id, typeof window === 'undefined' ? null : window.localStorage))
  },
  onSuccess: (order, context) => {
    showSuccessMessage(order.paymentStatus === 'Pago'
      ? 'Pedido salvo e pagamento recebido'
      : (order.status === 'Finalizado' ? 'Pedido anterior salvo no histórico' : 'Pedido enviado para a fila da cozinha'))
    completeNavigation(context.returnDestination)
  },
  onError: showApiError,
  onConflict: async () => { await refreshBootstrapSilently() },
})
```

Compute write blocking in two layers to avoid circular ownership:

```js
const writesBlockedWithoutOrderCheckout = !isOnline || requestKey !== null
const writesBlocked = writesBlockedWithoutOrderCheckout || newOrderDraft.checkoutPending
```

Use `newOrderDraft.dirty`, `newOrderDraft.checkoutPending`, and `newOrderDraft.discard` in `useNavigationController`. Use `newOrderDraft.context`, `renderKey`, `submit`, and `setDirty` when rendering New Order. Remove `newOrderContext`, `checkoutKey`, `newOrderDirty`, `newOrderOwnerRef`, `invalidateNewOrderDraft`, and `handleOrderCheckout` from App.

- [ ] **Step 6: Run focused draft/navigation tests**

```bash
node --test \
  src/domains/orders/application/newOrderDraft.test.js \
  src/domains/orders/application/useNewOrderDraft.test.js \
  src/AppNewOrderGuard.test.js \
  src/pages/NewOrderRoute.test.js \
  src/pages/NewOrder.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add src/domains/orders src/App.jsx src/AppNewOrderGuard.test.js src/pages
git commit -m "refactor: move new order draft out of app"
```

---

### Task 7: Move finalize/cancel command orchestration into Orders and retire lifecycle API exports from the legacy client

**Files:**
- Create: `src/domains/orders/application/useOrderCommands.js`
- Create/Test: `src/domains/orders/application/useOrderCommands.test.js`
- Modify: `src/domains/orders/index.js`
- Modify: `src/App.jsx`
- Modify: `src/api/client.js`

**Interfaces:**
- `useOrderCommands({ orders, api, canFinalizeOrders, canCancelOrders, canRefundPayments, writesBlocked, applyOfficialEffects, onSuccess, onError })` returns `{ actionKey, pending, finalizeOrder, cancelOrder }`.
- App passes these callbacks to Cozinha/Histórico; Finance/payment flows remain untouched.

- [ ] **Step 1: Write failing command tests**

Create `useOrderCommands.test.js` using a Probe component. Assert:

```js
await latest.finalizeOrder('o-1')
assert.deepEqual(commits.at(-1), { order: { id: 'o-1', status: 'Finalizado' } })
assert.equal(messages.at(-1), 'Pedido saiu para entrega')
```

for an `Entrega` order, and:

```js
await latest.cancelOrder('o-2', { reasonId: 'r-1', refundNow: true })
assert.equal(messages.at(-1), 'Pedido cancelado e estorno registrado')
```

with a result containing `{ order, movement, tableTab }`. Add an assertion that `refundNow: true` returns `false` without calling the API when `canRefundPayments` is false.

- [ ] **Step 2: Run RED**

```bash
node --test src/domains/orders/application/useOrderCommands.test.js
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the command hook**

Use local `actionKey` state. `finalizeOrder` must reject when another Orders command is pending, when globally blocked, when capability is absent, or when the order does not exist. It calls `api.updateOrderStatus(id, 'Finalizado')`, commits `{ order }`, and uses the exact current success copy.

`cancelOrder` must reject when another Orders command is pending, globally blocked, cancel capability is absent, or `payload.refundNow` lacks refund capability. It calls `api.cancelOrder`, commits `{ order, movement, tableTab }`, and uses the exact current success copy.

Both must route errors through `onError` and clear only their own local `actionKey` in `finally`.

- [ ] **Step 4: Export and integrate the hook**

Export:

```js
export { useOrderCommands } from './application/useOrderCommands.js'
```

In App, replace `handleFinalizeOrder` and `handleCancelOrder` with `orderCommands.finalizeOrder` and `orderCommands.cancelOrder`. Include `orderCommands.pending` in the effective global write block passed to other surfaces, while passing `orderCommands.actionKey` to Histórico where it currently receives the global request key for order lifecycle actions.

- [ ] **Step 5: Delete the three lifecycle write exports from `src/api/client.js`**

Delete only:

```js
export const createOrder = ...
export const updateOrderStatus = ...
export const cancelOrder = ...
```

`getOrders` was removed in Task 3. Keep `updateOrderPaymentPromise`, `refundOrder`, `registerPayment`, print APIs, and table-tab APIs.

- [ ] **Step 6: Verify no consumer imports migrated lifecycle functions from the legacy client**

```bash
rg "(createOrder|updateOrderStatus|cancelOrder) as .*Api|\b(createOrder|updateOrderStatus|cancelOrder)\b" src/api/client.js src/App.jsx src/app src/pages src/components
```

Expected: no lifecycle endpoint implementation/import remains in `src/api/client.js` or App; UI callback names such as `onCancelOrder` are allowed.

- [ ] **Step 7: Run focused tests**

```bash
node --test \
  src/domains/orders/application/useOrderCommands.test.js \
  src/pages/OrdersScheduled.test.js \
  src/pages/OrderHistory.test.js \
  src/AppNewOrderGuard.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit Task 7**

```bash
git add src/domains/orders src/App.jsx src/api/client.js src/pages
git commit -m "refactor: move order lifecycle commands to domain"
```

---

### Task 8: Move Novo Pedido UI and order-only creation components into Orders

**Files:**
- Move: `src/pages/NewOrder.jsx` → `src/domains/orders/ui/NewOrder.jsx`
- Move: `src/pages/NewOrderRoute.jsx` → `src/domains/orders/ui/NewOrderRoute.jsx`
- Move associated tests from `src/pages/NewOrder*.test.js` into `src/domains/orders/ui/`.
- Move order-only creation components into `src/domains/orders/ui/components/`: `NewOrderCustomerStep.jsx`, `NewOrderProductsStep.jsx`, `NewOrderReviewStep.jsx`, `NewOrderStepIndicator.jsx`, `NewOrderCartSummary.jsx`, `OrderCart.jsx`, `OrderCheckoutSummary.jsx`, `OrderProductCatalog.jsx` and their order-only tests.
- Leave generic/shared components in `src/components/`, including `Button`, `PageHeader`, `ClientDuplicateModal`, and `LocalTableSelector` because Table Service ownership is deferred.
- Modify: `src/domains/orders/index.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Public entry exports `NewOrderRoute` for App composition.
- The moved UI consumes Orders domain internals directly and external props for clients/products/tables/customer quick-create/settings/payment options.

- [ ] **Step 1: Write a failing public UI test before moving files**

Add `src/domains/orders/ordersPublicUi.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { NewOrderRoute } from './index.js'

test('orders public boundary exposes NewOrderRoute', () => {
  assert.equal(typeof NewOrderRoute, 'function')
})
```

- [ ] **Step 2: Run RED**

```bash
node --test src/domains/orders/ordersPublicUi.test.js
```

Expected: FAIL because `NewOrderRoute` is not exported from Orders yet.

- [ ] **Step 3: Establish a green characterization baseline before the move**

Run:

```bash
node --test \
  src/pages/NewOrder.test.js \
  src/pages/NewOrderMobile.test.js \
  src/pages/NewOrderRoute.test.js \
  src/pages/NewOrderWizard.test.js \
  src/components/OrderCheckoutSummary.test.js
```

Expected: PASS. Stop and investigate if baseline is not green.

- [ ] **Step 4: Move the page and order-only components/tests**

Use `git mv` for each file; do not copy-and-leave facades. Example:

```bash
mkdir -p src/domains/orders/ui/components
git mv src/pages/NewOrder.jsx src/domains/orders/ui/NewOrder.jsx
git mv src/pages/NewOrderRoute.jsx src/domains/orders/ui/NewOrderRoute.jsx
git mv src/pages/NewOrder.test.js src/domains/orders/ui/NewOrder.test.js
git mv src/pages/NewOrderMobile.test.js src/domains/orders/ui/NewOrderMobile.test.js
git mv src/pages/NewOrderRoute.test.js src/domains/orders/ui/NewOrderRoute.test.js
git mv src/pages/NewOrderWizard.test.js src/domains/orders/ui/NewOrderWizard.test.js
```

Move the listed order-only components and their existing tests similarly. Update imports to generic UI via `../../../components/...` (or the correct depth) and Orders rules via `../domain/...`/`../../domain/...`. Keep cross-runtime imports under `shared/` unchanged in meaning.

- [ ] **Step 5: Export New Order through the public boundary**

Add:

```js
export { NewOrderRoute } from './ui/NewOrderRoute.jsx'
```

Do not export every internal component.

- [ ] **Step 6: Update App to import only the public Orders route**

Remove the old page import and include `NewOrderRoute` in the existing Orders public import from `./domains/orders/index.js`.

- [ ] **Step 7: Run the moved UI suite**

```bash
node --test \
  src/domains/orders/ordersPublicUi.test.js \
  src/domains/orders/ui/NewOrder.test.js \
  src/domains/orders/ui/NewOrderMobile.test.js \
  src/domains/orders/ui/NewOrderRoute.test.js \
  src/domains/orders/ui/NewOrderWizard.test.js \
  src/domains/orders/ui/components/OrderCheckoutSummary.test.js
```

Expected: PASS with no `src/pages/NewOrder*.jsx` facade.

- [ ] **Step 8: Commit Task 8**

```bash
git add src/domains/orders src/App.jsx src/pages src/components
git commit -m "refactor: move new order ui into domain"
```

---

### Task 9: Move Cozinha and Histórico UI/components into Orders

**Files:**
- Move: `src/pages/Orders.jsx` → `src/domains/orders/ui/Orders.jsx`
- Move: `src/pages/OrderHistory.jsx` → `src/domains/orders/ui/OrderHistory.jsx`
- Move current Orders/History tests into `src/domains/orders/ui/`.
- Move order-only components into `src/domains/orders/ui/components/`: `CancelOrderDialog.jsx`, `KitchenTicket.jsx`, `KitchenTicketNotes.jsx`, `OrderDetail.jsx`, `OrderDetailTiming.js`, `OrderDetailTiming.jsx`, `OperationalHistoryAnalysis.jsx`, and their order-only tests.
- Leave generic payment/status/confirmation/navigation/printing primitives outside Orders.
- Modify: `src/domains/orders/index.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Public entry exports `Orders` and `OrderHistory` only as composition surfaces.
- Printing and payment remain injected props/callbacks; no deep imports into future domains are introduced.

- [ ] **Step 1: Extend the public UI test and verify RED**

Update `ordersPublicUi.test.js`:

```js
import { NewOrderRoute, OrderHistory, Orders } from './index.js'

test('orders public boundary exposes the three order surfaces', () => {
  assert.equal(typeof Orders, 'function')
  assert.equal(typeof OrderHistory, 'function')
  assert.equal(typeof NewOrderRoute, 'function')
})
```

Run:

```bash
node --test src/domains/orders/ordersPublicUi.test.js
```

Expected: FAIL because `Orders` and `OrderHistory` are not exported yet.

- [ ] **Step 2: Record a green pre-move characterization baseline**

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

- [ ] **Step 3: Move the surfaces/components/tests with `git mv`**

```bash
git mv src/pages/Orders.jsx src/domains/orders/ui/Orders.jsx
git mv src/pages/OrderHistory.jsx src/domains/orders/ui/OrderHistory.jsx
git mv src/pages/OrdersMobile.test.js src/domains/orders/ui/OrdersMobile.test.js
git mv src/pages/OrdersMultiItem.test.js src/domains/orders/ui/OrdersMultiItem.test.js
git mv src/pages/OrdersScheduled.test.js src/domains/orders/ui/OrdersScheduled.test.js
git mv src/pages/OrderHistory.test.js src/domains/orders/ui/OrderHistory.test.js
```

Move the listed order-only components/tests under `src/domains/orders/ui/components/`. Update internal Orders imports to direct domain/application paths and external generic UI/navigation/printing imports to their existing owners.

- [ ] **Step 4: Export the surfaces through `index.js`**

```js
export { default as Orders } from './ui/Orders.jsx'
export { default as OrderHistory } from './ui/OrderHistory.jsx'
```

- [ ] **Step 5: Update App composition to use only the Orders public boundary**

App should have one Orders import group conceptually equivalent to:

```js
import {
  NewOrderRoute,
  OrderHistory,
  Orders,
  cancellationOptionsFromEffective,
  cancellationRevisionFromEffective,
  getOrderItemsSearchText,
  getOrderRefundState,
  isOrderActive,
  isOrderCancelled,
  ordersApi,
  toLocalDateValue,
  useKitchenClock,
  useNewOrderDraft,
  useOrderArrivals,
  useOrderCommands,
} from './domains/orders/index.js'
```

Remove direct imports from legacy order pages/components/hooks/utils.

- [ ] **Step 6: Run moved UI tests**

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

- [ ] **Step 7: Commit Task 9**

```bash
git add src/domains/orders src/App.jsx src/pages src/components
git commit -m "refactor: move order surfaces into domain"
```

---

### Task 10: Enforce the Orders boundary and remove C4 legacy ownership paths

**Files:**
- Modify: `scripts/architecture/check-import-boundaries.mjs`
- Modify/Test: `scripts/architecture/check-import-boundaries.test.mjs`
- Modify: `src/App.jsx`
- Modify: `docs/superpowers/qa/spec-c-compatibility-facades.md` only to record C4 closure status, without changing C5/C6/C8-C10 removal schedules.
- Delete any remaining C4-owned legacy files under `src/pages`, `src/components`, `src/hooks`, and `src/utils` that were fully migrated and are not genuine shared/generic owners.

**Interfaces:**
- Architecture checker rejects deep imports into Orders from outside `src/domains/orders`.
- Architecture checker rejects reintroduced C4 legacy owners and migrated lifecycle endpoints in `src/api/client.js`.
- Existing C3 gates and cross-domain gates remain active.

- [ ] **Step 1: Write failing architecture tests**

In `check-import-boundaries.test.mjs`, add fixture tests that construct temporary files and assert these violation labels:

```js
assert.ok(violations.some((item) => item.startsWith('orders-deep-import:')))
assert.ok(violations.some((item) => item.startsWith('c4-legacy-orders-owner:')))
```

The deep-import fixture should make `src/App.jsx` import `./domains/orders/domain/orderLifecycle.js`. The legacy-owner fixture should create `src/pages/Orders.jsx` after the migration boundary is considered closed.

- [ ] **Step 2: Run RED**

```bash
node --test scripts/architecture/check-import-boundaries.test.mjs
```

Expected: FAIL because the C4-specific rules do not exist.

- [ ] **Step 3: Add the C4 legacy-owner set and Orders deep-import rule**

Add a `C4_LEGACY_ORDERS_OWNERS` set covering the exact legacy files migrated in Tasks 1, 2, 8, and 9. At minimum include the old page roots, hook, moved order utilities, and moved order-only components.

Add this rule inside the edge loop:

```js
if (!edge.from.startsWith('src/domains/orders/')
  && edge.resolvedPath?.startsWith('src/domains/orders/')
  && edge.resolvedPath !== 'src/domains/orders/index.js') {
  violations.push(`orders-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
}
```

Add source-path checks analogous to the C3 legacy-owner check:

```js
for (const legacyOwner of C4_LEGACY_ORDERS_OWNERS) {
  if (sourcePaths.has(legacyOwner)) violations.push(`c4-legacy-orders-owner: ${legacyOwner}`)
}
```

Do not forbid imports *within* Orders from its own layers.

- [ ] **Step 4: Add a source-content check for migrated API ownership**

Extend the checker so `src/api/client.js` containing lifecycle exports named `getOrders`, `createOrder`, `updateOrderStatus`, or `cancelOrder` produces `c4-legacy-orders-api`. Do not match callback names in other files and do not reject `refundOrder`, `registerPayment`, or `updateOrderPaymentPromise`.

- [ ] **Step 5: Remove all remaining C4 facades instead of reexporting them**

Verify and delete any migrated old owner paths that remain. Use:

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

- [ ] **Step 6: Verify App no longer owns C4 internals**

Run:

```bash
rg "newOrderOwnerRef|checkoutKey|knownOperationalOrderIdsRef|alertedOrderIdsRef|kitchenAudioContextRef|newOrderHighlightTimerRef|createOrderApi|updateOrderStatusApi|cancelOrderApi" src/App.jsx
```

Expected: no output.

- [ ] **Step 7: Run architecture and focused boundary tests**

```bash
node --test scripts/architecture/check-import-boundaries.test.mjs
npm run test:architecture
node --test src/domains/orders/ordersPublicContract.test.js src/domains/orders/ordersPublicUi.test.js
```

Expected: PASS and `Frontend architecture boundaries: OK`.

- [ ] **Step 8: Update the compatibility ledger without removing later-slice bridges**

Append a C4 status section recording that C4 introduced no surviving Orders compatibility facade, that lifecycle APIs moved out of `src/api/client.js`, and that the payment-receipt bridge remains C6, table-commit bridge remains C5, generic/auth facade remains C10-at-latest, and `updateCollection` keeps its existing schedule.

- [ ] **Step 9: Commit Task 10**

```bash
git add scripts/architecture src docs/superpowers/qa/spec-c-compatibility-facades.md
git commit -m "refactor: enforce orders domain boundary"
```

---

### Task 11: Full regression gates, QA record, GitHub validation, and staging handoff

**Files:**
- Create: `docs/superpowers/qa/spec-c4-orders-qa.md`
- Modify: `docs/superpowers/qa/spec-c-execution-ledger.md`
- Modify: `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
- No production workflow or production configuration changes.

**Interfaces:**
- Produces an auditable C4 executable SHA, local gate evidence, GitHub Validate evidence, staging deployment evidence, and a manual homologation matrix.
- Does not merge or deploy production.

- [ ] **Step 1: Run the complete local gate set on a clean executable tree**

Run in this order:

```bash
git status --short
git diff --check
npm test
npm run test:architecture
npm run lint
npm run build
npm run d1:migrate:local
```

Expected:
- no unexpected tracked working-tree changes before the gate;
- `git diff --check` exit 0;
- full tests exit 0;
- architecture prints `Frontend architecture boundaries: OK`;
- lint exit 0, allowing only already-known warning classes;
- build exit 0;
- local D1 migration exit 0.

If any command fails, stop Task 11 and fix the failure under TDD before continuing.

- [ ] **Step 2: Audit the C4 diff against the approved scope**

Run:

```bash
git diff --name-status origin/master...HEAD
git diff origin/master...HEAD -- worker migrations src/printing
rg "domains/orders/(domain|application|infrastructure|ui)/" src --glob '!domains/orders/**'
```

Expected:
- no Worker or migration changes;
- no C9 printing-runtime refactor;
- no non-Orders deep import into Orders internals;
- no payment/table-service ownership moved early.

- [ ] **Step 3: Record the executable SHA and local evidence**

Create `docs/superpowers/qa/spec-c4-orders-qa.md` with:

```markdown
# Spec C4 — Orders Domain Extraction — QA Record

## Execution identity
- Slice: **C4 — Orders**
- Branch: `feature/spec-c4-orders`
- Base SHA: `737beeac2150aabeb39024af823f2f60fee25108`
- Executable SHA: `<replace with git rev-parse HEAD when Task 11 starts>`
- Production deploy: **NO**
- Merge: **NO**

## Automated gates
Record command, exit code/result, and notable warnings for:
`git diff --check`, `npm test`, `npm run test:architecture`, `npm run lint`, `npm run build`, `npm run d1:migrate:local`.

## Scope audit
Record Worker/migrations/printing-runtime diff result and facade/deep-import audit.

## Manual staging matrix
Record direct observation separately from automated evidence.
```

Replace the executable SHA immediately with the exact output of `git rev-parse HEAD`; do not leave angle-bracket text in the committed file.

- [ ] **Step 4: Add the proportional manual matrix before staging**

The QA file must contain rows for at least these observable scenarios, initially `PENDING`:

```text
1. Novo Pedido imediato — open, fill, save, return destination
2. Novo Pedido agendado — time input and same-day validation
3. Dirty New Order navigation — stay/discard behavior
4. New Order from Comandas — table context and return to Comandas
5. Policy-changed checkout feedback/retry if safely reproducible
6. Cozinha — preparing/scheduled ordering and 50-minute timing behavior
7. Cozinha — search by client/order/product/type
8. Cozinha — new arrival appears without reload
9. Cozinha — one sound/highlight per arrival and sound preference behavior
10. Cozinha — finalize confirmation and success copy
11. Cozinha — cancellation entry, reason, optional refund permission behavior
12. Histórico — filters, detail, cancellation metadata
13. Histórico/Cozinha — payment action still opens existing external payment flow
14. Order detail printing entry still behaves as before
15. Settings Operação — load/edit/save/cancel
16. Settings Modalidades shares Operations draft without discard prompt
17. Settings Cancelamentos — add/edit/order/save/cancel/read-only behavior
18. Desktop light/dark visual regression for Cozinha/Novo Pedido/Histórico
19. Mobile/narrow visual regression for Cozinha/Novo Pedido/Histórico
20. No new C4-attributable console errors
```

Do not mark a manual scenario PASS from automated tests.

- [ ] **Step 5: Commit QA/ledger/rollout status as docs-only**

Update the execution ledger to `C4 — AUTOMATED GATES GREEN / STAGING PENDING` with the exact executable SHA. Update the rollout status block similarly, leaving C5 NOT STARTED.

```bash
git add docs/superpowers/qa/spec-c4-orders-qa.md docs/superpowers/qa/spec-c-execution-ledger.md docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md
git commit -m "docs: record c4 pre-staging qa"
```

- [ ] **Step 6: Push the feature branch and run GitHub Validate on the exact branch HEAD**

```bash
git push -u origin feature/spec-c4-orders
```

Trigger `Validate application` for `feature/spec-c4-orders` using the repository's existing workflow path. Record workflow run number, run ID, event, exact head SHA, and conclusion in the QA record only after the run completes successfully.

- [ ] **Step 7: Deploy staging manually from the validated C4 branch**

Trigger the existing manual staging deployment workflow for `feature/spec-c4-orders`. Verify the deployed SHA matches the intended C4 executable/docs descendant and record the run ID plus staging URL:

```text
https://sistema-para-delivery-staging.vzaponi.workers.dev
```

Do not trigger production.

- [ ] **Step 8: Hand off the manual homologation matrix to the user**

Guide the user through the 20 scenarios in the QA matrix. Record each as `PASS`, `FAIL`, or `BLOCKED` based only on direct observation. Any `FAIL` stops merge preparation and returns to systematic debugging/TDD.

- [ ] **Step 9: Re-run final Validate after documentation-only QA updates**

After manual results are committed, confirm the diff from the staged executable SHA to the final branch HEAD is documentation-only. Run `Validate application` again on the final branch HEAD and record the successful run.

- [ ] **Step 10: Stop at the merge gate**

C4 is eligible to ask for merge authorization only when:

```text
- executable code gates are green;
- staging workflow succeeded;
- manual matrix has 0 FAIL;
- all BLOCKED rows are honestly documented;
- final docs-only HEAD Validate is green;
- master has not moved unexpectedly or any movement has been reconciled;
- production remains untouched.
```

Do not create/merge the PR or deploy production without the user's explicit authorization at that point.
