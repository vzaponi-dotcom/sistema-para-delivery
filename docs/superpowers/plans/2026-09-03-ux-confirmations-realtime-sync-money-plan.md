# UX Confirmations, Realtime Sync and Money Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make important writes explicit and trustworthy, format order money inputs in Brazilian Real, update the device that performed a write immediately, synchronize other screens/devices automatically without reload, and permanently fix refund/cancellation consistency.

**Architecture:** Keep `App.jsx` as the owner of the authenticated business collections (`clients`, `products`, `orders`, `tableTabs`, `movements`). Every successful write applies the authoritative objects returned by the Worker immediately and marks the affected collections as locally mutated. A per-collection synchronization guard prevents stale reads from overwriting newer local writes or newer reads. A silent global bootstrap refresh runs about every 5 seconds and on focus/visibility/reconnection; the Orders screen keeps its faster ~2 second order-only polling. Order read SQL is shared so bootstrap and `/api/orders` cannot drift on cancellation/refund fields.

**Tech Stack:** React 19, Vite 8, Node test runner (`node --test`), Cloudflare Worker, D1/SQLite, Wrangler 4.128.0, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-03-ux-confirmations-realtime-sync-money-design.md`

## Global Constraints

- Strict TDD for every behavior change: write the failing test, run it and confirm the expected RED, write the minimum production change, re-run GREEN, then refactor only while green.
- Delivery fee and fixed discount/surcharge display and edit as Brazilian Real (`R$ 12,50`). Percentage remains a numeric percentage input and is never currency-masked.
- Presentation masks must not leak into Worker payloads: calculations and API payloads remain numeric.
- Destructive, irreversible, or financially impactful actions require an explicit review/confirmation before the API call.
- A purpose-built review modal that clearly shows the consequence and has an explicit `Confirmar ...` CTA counts as the confirmation step. Do not stack a redundant second modal on existing payment/refund/comanda-payment review dialogs.
- Order cancellation is the explicit exception: after collecting reason/refund data, show a final cancellation review step before calling the API.
- Every significant successful persisted change uses the existing centered `successMessage` confirmation in `App.jsx`; errors continue using the existing error toast/form feedback.
- The device that performs a successful write updates immediately from the Worker response; it must not wait for polling or a full bootstrap refresh.
- Other devices/screens reconcile automatically in the background. Global cadence is approximately 5 seconds; Orders keeps approximately 2 seconds.
- Global sync also runs when the app gains focus, becomes visible again, or transitions from offline to online.
- No two global bootstrap refreshes run simultaneously.
- A response that started before a newer local write or a newer read of the same collection must not overwrite current state.
- Completed refunds disappear from `Estornos pendentes` immediately and must not reappear after `/api/orders` polling, global bootstrap, navigation, or another device refresh.
- Backend duplicate-refund protection remains authoritative and database uniqueness remains in place.
- New cancellations persist and return `cancelledAt`; History and Finance use that same official value.
- Keep `orderDate`, `cancelledAt`, `paidAt`, and `refundedAt` semantically distinct. Legacy rows with no `cancelledAt` stay unknown; never derive or invent a cancellation date.
- Preserve responsive behavior from 320–480 px and reuse the existing modal/bottom-sheet mobile foundation.
- Migration `0008_order_cancellation_refunds.sql` already contains the cancellation columns and unique refund index; this plan adds no D1 migration.
- Production deploy remains manual-only. Do not run production deploy or remote D1 migration without explicit user authorization.
- Final verification is `npm test`, `npm run lint`, `npm run build`, and `npx --yes wrangler@4.128.0 deploy --dry-run`.

---

## File Structure

**Create**
- `src/components/ConfirmationDialog.jsx` — reusable confirmation for irreversible actions that do not already have a purpose-built review dialog.
- `src/components/ConfirmationDialog.test.js` — confirmation contract and accessibility/source regression tests.
- `src/components/OrderCheckoutSummary.test.js` — money-input presentation regression coverage.
- `src/utils/dataSync.js` — per-collection read/mutation sequencing and idempotent entity helpers.
- `src/utils/dataSync.test.js` — stale-response, overlapping-read, and idempotent-upsert tests.
- `src/orderStateOwnershipRegression.test.js` — enforce that Orders/History do not own API writes or shadow order collections.
- `src/realtimeSyncRegression.test.js` — wiring contract for 5s global sync, 2s Orders sync, focus/visibility/reconnection, and background refresh behavior.
- `worker/orderReadSql.js` — one canonical order/item SELECT definition shared by bootstrap and `/api/orders`.
- `worker/orderReadRepository.test.js` — regression tests proving cancellation/refund fields survive `/api/orders` reads.

**Modify**
- `src/pages/NewOrder.jsx` — keep masked money presentation state but normalize to numbers for preview/payload.
- `src/components/OrderCheckoutSummary.jsx` — BRL text inputs for delivery fee/fixed adjustment; numeric input for percentage.
- `src/pages/NewOrder.test.js` — RED coverage for money normalization and mask usage.
- `src/App.jsx` — central write ownership, immediate effect application, mutation marking, global sync, centralized cancellation, success feedback.
- `src/components/AppShell.jsx` — stop instantiating a private History data source; render children only.
- `src/pages/Orders.jsx` — remove direct cancellation API/local cancelled-ID shadow state; add explicit finalization confirmation; delegate writes to App.
- `src/pages/OrderHistory.jsx` — consume central orders, remove self-fetch/direct cancellation API, display official cancellation date.
- `src/pages/Finance.jsx` — use shared official cancellation-date formatter.
- `src/pages/Products.jsx` — confirm product deletion before invoking App handler.
- `src/pages/Clients.jsx` — retain existing delete confirmation; no architectural rewrite required.
- `src/api/client.js` — consume richer write-response contracts without adding polling behavior.
- `src/utils/orderWorkflow.js` and `src/utils/orderWorkflow.test.js` — shared nullable cancellation-date formatter.
- `src/utils/orderLifecycle.test.js` — explicit pending/refunded regression cases.
- `src/successFeedbackRegression.test.js` — ensure newly centralized significant writes use the existing success overlay.
- `src/mobileOverlayRegression.test.js` and nearest order/product/new-order CSS only if a failing mobile regression requires a layout fix.
- `worker/repositories.js` — reuse canonical SELECT, export canonical order loader, return table-tab effects from payment, expose small effect lookup helpers.
- `worker/orderReadRepository.js` — reuse canonical SELECT instead of the currently incomplete duplicate query.
- `worker/orderCancellation.js` — return full canonical order plus refund/table-tab effects after cancellation/refund.
- `worker/index.js` — return complete write effects for create/cancel/payment/refund routes.
- `worker/orderCancellation.test.js`, `worker/orderCancellationHttp.test.js`, `worker/orderRepositories.test.js`, and focused route tests — authoritative write/read contract regressions.

---

### Task 1: Apply BRL masks to delivery fee and fixed order adjustments

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/components/OrderCheckoutSummary.jsx`
- Modify: `src/pages/NewOrder.test.js`
- Create: `src/components/OrderCheckoutSummary.test.js`

**Behavior:**
- Delivery fee starts and renders as `R$ 0,00`.
- Fixed discount/surcharge renders as BRL and uses the same typing behavior as Product price.
- Percentage renders as a plain numeric input with `max=100`.
- `calculateOrderPreview` and `buildOrderPayload` receive numeric money values.

- [ ] **Step 1: Write RED tests for the checkout input contract**

In `src/components/OrderCheckoutSummary.test.js`, read the JSX source and assert that delivery fee uses `type="text"`, `inputMode="decimal"`, `formatBRLCurrencyInput`, and that the adjustment branch renders currency text input only when `adjustment.mode === 'fixed'`; percentage keeps `type="number"`.

```js
assert.match(source, /formatBRLCurrencyInput/)
assert.match(source, /Taxa de entrega[\s\S]*type="text"[\s\S]*inputMode="decimal"/)
assert.match(source, /adjustment\.mode === 'fixed'/)
assert.match(source, /type="number"[\s\S]*max="100"/)
```

Extend `src/pages/NewOrder.test.js` to require `formatBRLCurrencyValue`, `parseBRLCurrencyInput`, a visible zero BRL default, and a normalized numeric draft before preview/payload creation.

- [ ] **Step 2: Run focused tests and verify RED for the intended reason**

Run:

```bash
node --test src/components/OrderCheckoutSummary.test.js src/pages/NewOrder.test.js
```

Expected: FAIL because delivery fee/fixed adjustment still use numeric inputs and `NewOrder` does not normalize BRL display strings.

- [ ] **Step 3: Store presentation values as formatted strings and derive a numeric draft**

Use the existing helpers instead of creating a second currency parser:

```js
import {
  formatBRLCurrencyValue,
  formatPhone,
  parseBRLCurrencyInput,
} from '../utils/formFormatting.js'

const emptyAdjustment = () => ({
  type: 'none',
  mode: 'fixed',
  value: formatBRLCurrencyValue(0),
  reason: '',
})

const [deliveryFee, setDeliveryFee] = useState(() => formatBRLCurrencyValue(0))
const [adjustment, setAdjustment] = useState(emptyAdjustment)

const numericDraft = {
  ...draft,
  deliveryFee: type === 'Entrega' ? parseBRLCurrencyInput(deliveryFee) : 0,
  adjustment: {
    ...adjustment,
    value: adjustment.mode === 'fixed'
      ? parseBRLCurrencyInput(adjustment.value)
      : Math.max(0, Number(adjustment.value) || 0),
  },
}
```

Use `numericDraft` for `calculateOrderPreview()` and `buildOrderPayload()`, while passing the display `draft` to the checkout component.

When switching modes, preserve the equivalent numeric value but convert presentation:

```js
if (patch.mode === 'fixed' && current.mode !== 'fixed') {
  next.value = formatBRLCurrencyValue(Number(current.value) || 0)
}
if (patch.mode === 'percentage' && current.mode !== 'percentage') {
  next.value = String(parseBRLCurrencyInput(current.value))
}
```

- [ ] **Step 4: Format only the fixed-money UI fields**

In `OrderCheckoutSummary.jsx` import `formatBRLCurrencyInput` and use the proven Product price pattern:

```jsx
<input
  type="text"
  inputMode="decimal"
  placeholder="R$ 0,00"
  value={draft.deliveryFee}
  onChange={(event) => onDeliveryFeeChange(formatBRLCurrencyInput(event.target.value))}
/>
```

Render the adjustment value as a BRL text input for `fixed`, and retain the current numeric percentage field for `percentage`.

- [ ] **Step 5: Run focused GREEN and order-cart regressions**

Run:

```bash
node --test src/components/OrderCheckoutSummary.test.js src/pages/NewOrder.test.js src/utils/formFormatting.test.js src/utils/orderCart.test.js
```

Expected: PASS; payload/preview tests continue proving numeric behavior.

- [ ] **Step 6: Commit**

```bash
git add src/pages/NewOrder.jsx src/components/OrderCheckoutSummary.jsx src/pages/NewOrder.test.js src/components/OrderCheckoutSummary.test.js
git commit -m "feat: format order money inputs in BRL"
```

---

### Task 2: Make `/api/orders` return the same canonical cancellation/refund fields as bootstrap

**Files:**
- Create: `worker/orderReadSql.js`
- Create: `worker/orderReadRepository.test.js`
- Modify: `worker/orderReadRepository.js`
- Modify: `worker/repositories.js`

**Root cause addressed:** `loadBootstrap()` currently selects `cancelled_at`, cancellation reason fields, and the `order-refund` movement join, while `listOrders()` has a separate older SELECT that omits them. The 2-second Orders poll can therefore overwrite a refunded/cancelled order with a representation missing `refundMovementId`, `refundedAt`, and `cancelledAt`.

- [ ] **Step 1: Write a behavior-level RED test against `listOrders()`**

Create a fake DB in `worker/orderReadRepository.test.js` that rejects an order query unless it contains:

```js
assert.match(sql, /o\.cancelled_at/)
assert.match(sql, /o\.cancel_reason/)
assert.match(sql, /o\.cancel_reason_note/)
assert.match(sql, /r\.id AS refund_movement_id/)
assert.match(sql, /r\.created_at AS refund_created_at/)
assert.match(sql, /source = 'order-refund'/)
```

Return a paid, cancelled row with a refund movement and assert:

```js
assert.equal(order.cancelledAt, '2026-09-03T13:00:00.000Z')
assert.equal(order.refundMovementId, 'refund-1')
assert.equal(order.refundedAt, '2026-09-03T13:05:00.000Z')
assert.equal(order.refundState, 'refunded')
```

Add a second legacy row assertion proving `cancelledAt === null` remains null.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test worker/orderReadRepository.test.js
```

Expected: FAIL because the current `worker/orderReadRepository.js` SELECT omits cancellation/refund fields.

- [ ] **Step 3: Extract one canonical SELECT definition**

Create `worker/orderReadSql.js` with the exact field set already used successfully by bootstrap:

```js
export const ORDER_SELECT = `SELECT o.id, o.client_id, o.client_name_snapshot,
  o.customer_identity_type, o.table_tab_id, o.type, o.order_date, o.status,
  o.subtotal_cents, o.delivery_fee_cents, o.adjustment_type, o.adjustment_mode,
  o.adjustment_value, o.adjustment_amount_cents, o.adjustment_reason, o.total_cents,
  o.created_at, o.finished_at, o.cancelled_at, o.cancel_reason, o.cancel_reason_note,
  p.id AS payment_id, p.method AS payment_method, p.paid_at,
  p.amount_cents AS paid_amount_cents,
  r.id AS refund_movement_id, r.created_at AS refund_created_at
  FROM orders o
  LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id
  LEFT JOIN movements r ON r.order_id = o.id AND r.business_id = o.business_id
    AND r.source = 'order-refund'`

export const ORDER_ITEM_SELECT = `SELECT id, order_id, product_id, name_snapshot,
  category_snapshot, size_snapshot, quantity, catalog_price_cents, unit_price_cents,
  price_reason, note, created_at FROM order_items`
```

Import these constants in both `worker/repositories.js` and `worker/orderReadRepository.js`; remove the duplicate local SELECT strings.

- [ ] **Step 4: Re-run focused read tests**

Run:

```bash
node --test worker/orderReadRepository.test.js worker/orderCancellation.test.js worker/orderRepositories.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/orderReadSql.js worker/orderReadRepository.js worker/orderReadRepository.test.js worker/repositories.js
git commit -m "fix: keep order read cancellation state canonical"
```

---

### Task 3: Return complete authoritative write effects from order APIs

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/orderCancellation.js`
- Modify: `worker/index.js`
- Modify: `worker/orderCancellation.test.js`
- Modify: `worker/orderCancellationHttp.test.js`
- Modify: `worker/orderRepositories.test.js`
- Modify: `src/api/client.js` only if response helpers/types are adjusted

**Contract:** Order-changing endpoints return enough official objects for immediate local state updates. Use nullable effects rather than forcing a bootstrap read.

```js
{
  order,                 // canonical full order including items/audit fields
  movement: null | {...},
  tableTab: null | {...}
}
```

Table-tab bulk payment keeps its existing `{ tableTab, orders, movements }` shape.

- [ ] **Step 1: Add RED cancellation/refund HTTP assertions**

Extend `worker/orderCancellationHttp.test.js` to require:

```js
assert.ok(body.order.cancelledAt)
assert.equal(body.order.cancelReason, 'client_changed_mind')
assert.equal(body.movement, null)
```

For immediate-refund cancellation:

```js
assert.equal(body.order.refundState, 'refunded')
assert.equal(body.movement.source, 'order-refund')
assert.equal(body.movement.orderId, 'o1')
```

For deferred refund endpoint, keep the duplicate-refund `409` assertion and require the returned canonical order to contain `cancelledAt` unchanged.

- [ ] **Step 2: Add RED payment/table-tab effect assertions**

In `worker/orderRepositories.test.js`, add a table-tab order case where paying the last pending order closes the tab. Assert `registerOrderPayment()` returns the closed `tableTab` together with `order` and `movement`.

Also add a focused test for a small helper that loads an `order-payment` movement by `(businessId, orderId, source)` so checkout can return the official payment movement created inside the existing batch.

- [ ] **Step 3: Run and verify RED**

Run:

```bash
node --test worker/orderCancellation.test.js worker/orderCancellationHttp.test.js worker/orderRepositories.test.js
```

Expected: FAIL because cancellation currently returns a partial order and discards its immediate refund movement/table-tab effect; single-order payment discards the closed table tab.

- [ ] **Step 4: Export the canonical order loader and minimal effect lookups**

In `worker/repositories.js`, export the existing loader instead of duplicating mapping logic:

```js
export const loadOrderById = async (db, businessId, id) => {
  // existing canonical ORDER_SELECT + item loading
}
```

Add narrow helpers:

```js
export const loadMovementByOrderSource = async (db, businessId, orderId, source) => { /* SELECT + mapMovementRow */ }
export const loadTableTabById = async (db, businessId, tableTabId) => { /* SELECT + mapTableTabRow */ }
```

Do not invent timestamps or reconstruct movement IDs on the frontend.

- [ ] **Step 5: Return full cancellation/refund effects**

Keep `readContext()` for validation, but after the write return the canonical order:

```js
const tableTab = await closeTableTabIfSettled(db, businessId, existing.table_tab_id, now)
return {
  order: await loadOrderById(db, businessId, orderId),
  movement: refund?.movement ?? null,
  tableTab,
}
```

For `registerOrderRefund()` return:

```js
return {
  order: await loadOrderById(db, businessId, orderId),
  movement: refund.movement,
}
```

Keep both the explicit existing-refund check and database unique-index race protection.

- [ ] **Step 6: Return related effects for checkout and payment**

In the POST `/api/orders` route, after `createOrder()`:

```js
const movement = order.paymentStatus === 'Pago'
  ? await loadMovementByOrderSource(env.DB, session.businessId, order.id, 'order-payment')
  : null
const tableTab = order.tableTabId
  ? await loadTableTabById(env.DB, session.businessId, order.tableTabId)
  : null
return json({ order, movement, tableTab }, { status: 201 })
```

In `registerOrderPayment()`, preserve the result of `closeTableTabIfSettled()` and include it in the returned object.

Change the cancel route from wrapping a returned partial object:

```js
const result = await cancelOrder(...)
return json(result)
```

- [ ] **Step 7: Re-run backend GREEN suite**

Run:

```bash
node --test worker/orderCancellation.test.js worker/orderCancellationHttp.test.js worker/orderRepositories.test.js worker/orderRoutes.test.js worker/orderReadRepository.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add worker/repositories.js worker/orderCancellation.js worker/index.js worker/orderCancellation.test.js worker/orderCancellationHttp.test.js worker/orderRepositories.test.js src/api/client.js
git commit -m "feat: return authoritative order write effects"
```

---

### Task 4: Introduce a per-collection stale-response guard and idempotent entity helpers

**Files:**
- Create: `src/utils/dataSync.js`
- Create: `src/utils/dataSync.test.js`

**Collections:** `clients`, `products`, `orders`, `tableTabs`, `movements`.

**Why per collection:** A newer 2-second Orders read should stale only an older `orders` snapshot, not prevent the same global bootstrap response from safely updating `clients`, `products`, `tableTabs`, or `movements`.

- [ ] **Step 1: Write RED tests for sequencing semantics**

Test these cases independently:

1. A read token becomes stale for `orders` after `markMutation(['orders'])`.
2. A later Orders read invalidates an older Orders read even when both are still in flight.
3. A later Orders read does **not** invalidate the `movements` portion of an older global token.
4. Mutating `movements` does not stale unrelated `clients`.
5. `upsertById()` replaces an existing entity without duplication and prepends a new entity.
6. `upsertManyById()` is idempotent when the same server result is applied twice.

Example desired API:

```js
const guard = createCollectionSyncGuard(['orders', 'movements'])
const global = guard.beginRead(['orders', 'movements'])
const ordersOnly = guard.beginRead(['orders'])

assert.equal(guard.canApply(global, 'orders'), false)
assert.equal(guard.canApply(global, 'movements'), true)
assert.equal(guard.canApply(ordersOnly, 'orders'), true)
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test src/utils/dataSync.test.js
```

Expected: FAIL because the utility does not exist yet.

- [ ] **Step 3: Implement the smallest tested guard**

Use monotonically increasing counters per collection:

```js
export const createCollectionSyncGuard = (keys) => {
  const readVersion = Object.fromEntries(keys.map((key) => [key, 0]))
  const mutationVersion = Object.fromEntries(keys.map((key) => [key, 0]))

  return {
    beginRead(collections) {
      const snapshot = {}
      for (const key of collections) {
        readVersion[key] += 1
        snapshot[key] = {
          readVersion: readVersion[key],
          mutationVersion: mutationVersion[key],
        }
      }
      return snapshot
    },
    markMutation(collections) {
      for (const key of collections) mutationVersion[key] += 1
    },
    canApply(token, key) {
      return Boolean(token?.[key])
        && token[key].readVersion === readVersion[key]
        && token[key].mutationVersion === mutationVersion[key]
    },
  }
}
```

Add tested `upsertById`, `upsertManyById`, and `removeById` helpers; do not add timers/network knowledge to this pure module.

- [ ] **Step 4: Run GREEN**

Run:

```bash
node --test src/utils/dataSync.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/dataSync.js src/utils/dataSync.test.js
git commit -m "feat: add collection sync guard"
```

---

### Task 5: Move cancellation and History onto the central App state

**Files:**
- Create: `src/orderStateOwnershipRegression.test.js`
- Modify: `src/App.jsx`
- Modify: `src/components/AppShell.jsx`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/pages/OrderHistory.jsx`
- Modify: `src/api/client.js` if needed for richer cancel response

**Behavior:** `App.jsx` is the only owner of the authenticated `orders` collection and the cancellation API call. Orders and History render props and keep only UI-local state (filter, detail modal, cancellation dialog draft).

- [ ] **Step 1: Write RED ownership regression tests**

Require:

```js
assert.doesNotMatch(ordersSource, /cancelOrder as cancelOrderApi/)
assert.doesNotMatch(ordersSource, /cancelledIds/)
assert.doesNotMatch(historySource, /getOrders as getOrdersApi/)
assert.doesNotMatch(historySource, /cancelOrder as cancelOrderApi/)
assert.doesNotMatch(shellSource, /<OrderHistory\s*\/>/)
assert.match(appSource, /cancelOrder as cancelOrderApi/)
assert.match(appSource, /<OrderHistory/)
```

Also assert the App cancellation handler applies returned `order`, optional `movement`, optional `tableTab`, and calls `showSuccessMessage` only after success.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test src/orderStateOwnershipRegression.test.js src/pages/OrderHistory.test.js
```

Expected: FAIL because Orders/History currently call cancellation/read APIs themselves and AppShell constructs History without App state.

- [ ] **Step 3: Centralize the cancellation write in App**

Add `cancelOrderApi` to the App API imports and implement a boolean-returning handler:

```js
const handleCancelOrder = async (orderId, payload) => {
  if (writesBlocked) return false
  setRequestKey(`order:cancel:${orderId}`)
  try {
    const result = await cancelOrderApi(orderId, payload)
    markAndApplyWrite(result, ['orders', 'movements', 'tableTabs'])
    showSuccessMessage(result.movement
      ? 'Pedido cancelado e estorno registrado'
      : 'Pedido cancelado com sucesso')
    return true
  } catch (error) {
    showApiError(error)
    return false
  } finally {
    setRequestKey(null)
  }
}
```

`markAndApplyWrite` must mark only collections that actually have returned effects before applying them idempotently.

- [ ] **Step 4: Make Orders delegate cancellation and stop shadowing central state**

Remove `cancelOrderApi`, `cancelledIds`, and local success feedback. Active orders derive solely from the `orders` prop. `confirmCancellation()` calls `onCancelOrder(cancelOrder.id, payload)` and closes the dialog only when it returns true.

- [ ] **Step 5: Make History a pure central-state view**

Remove `loadedOrders`, its fetch effect, and direct cancellation API. Receive `orders`, `currency`, and `onCancelOrder` from App. Keep filter/detail/dialog UI state only.

Move the `history` route rendering into App:

```jsx
{activeTab === 'history' && (
  <OrderHistory
    orders={orders}
    currency={currency}
    onCancelOrder={handleCancelOrder}
    actionKey={requestKey}
  />
)}
```

Simplify `AppShell` so it always renders `{children}`.

- [ ] **Step 6: Run focused GREEN tests**

Run:

```bash
node --test src/orderStateOwnershipRegression.test.js src/pages/OrderHistory.test.js src/components/CancelOrderDialog.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/AppShell.jsx src/pages/Orders.jsx src/pages/OrderHistory.jsx src/orderStateOwnershipRegression.test.js src/api/client.js
git commit -m "refactor: centralize order cancellation state"
```

---

### Task 6: Apply all successful writes immediately and add guarded global synchronization

**Files:**
- Create: `src/realtimeSyncRegression.test.js`
- Modify: `src/App.jsx`
- Modify: `src/utils/dataSync.js` only if the wiring exposes a missing tested primitive

**Behavior:**
- No successful write waits for `refreshBootstrap()` to become visible locally.
- Global refresh is silent while the app is already ready.
- Global refresh runs at ~5s and on focus/visibility/reconnection.
- Orders stays ~2s and participates in the same `orders` stale-response guard.

- [ ] **Step 1: Write RED wiring regressions**

In `src/realtimeSyncRegression.test.js`, assert source contracts including:

```js
assert.match(app, /GLOBAL_SYNC_INTERVAL_MS\s*=\s*5_000/)
assert.match(app, /ORDER_SYNC_INTERVAL_MS\s*=\s*2_000/)
assert.match(app, /createCollectionSyncGuard/)
assert.match(app, /bootstrapSyncInFlightRef/)
assert.match(app, /visibilitychange/)
assert.match(app, /window\.addEventListener\('focus'/)
assert.doesNotMatch(app, /order\.paymentStatus === 'Pago'\) await refreshBootstrap\(\)/)
```

Require the specialized order poll to call `beginRead(['orders'])` and check `canApply(..., 'orders')` before `setOrders`/new-order alert detection.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test src/realtimeSyncRegression.test.js src/utils/dataSync.test.js
```

Expected: FAIL because App currently has no 5-second global loop/guard and paid checkout still forces a full bootstrap.

- [ ] **Step 3: Add sync refs and collection-aware application helpers**

In App initialize once:

```js
const DATA_COLLECTIONS = ['clients', 'products', 'orders', 'tableTabs', 'movements']
const GLOBAL_SYNC_INTERVAL_MS = 5_000
const ORDER_SYNC_INTERVAL_MS = 2_000

const syncGuardRef = useRef(createCollectionSyncGuard(DATA_COLLECTIONS))
const bootstrapSyncInFlightRef = useRef(false)
const ordersSyncInFlightRef = useRef(false)
```

Create one helper for authoritative local writes:

```js
const applyOfficialEffects = ({ order, orders: nextOrders, movement, movements: nextMovements, tableTab, client, product }) => {
  const changed = []
  if (order || nextOrders?.length) changed.push('orders')
  if (movement || nextMovements?.length) changed.push('movements')
  if (tableTab) changed.push('tableTabs')
  if (client) changed.push('clients')
  if (product) changed.push('products')
  syncGuardRef.current.markMutation(changed)
  // then idempotent setState calls using upsert helpers
}
```

Keep delete handling explicit: mark the collection then `removeById()`.

- [ ] **Step 4: Convert every existing successful write to immediate official-effect application**

Cover at minimum:

- create order: upsert `order`, optional `movement`, optional `tableTab`; remove the paid-order `refreshBootstrap()` workaround;
- finalize order: upsert returned `order`;
- register single payment: upsert `order`, `movement`, optional closed `tableTab`;
- register table-tab payment: upsert returned `orders`, `movements`, `tableTab`;
- cancel order: Task 5 handler;
- deferred refund: upsert returned `order` and `movement`;
- client/product create/update: upsert returned entity;
- client/product delete: remove immediately after success and mark collection mutation;
- manual movement: upsert movement.

Do not synthesize server audit timestamps or movement IDs.

- [ ] **Step 5: Make bootstrap refresh safe for background use**

Split foreground initial/retry behavior from silent background reconciliation. Background refresh must not set the entire app back to `loading`.

Pseudo-contract:

```js
const refreshBootstrap = async ({ background = false } = {}) => {
  if (bootstrapSyncInFlightRef.current) return false
  bootstrapSyncInFlightRef.current = true
  const token = syncGuardRef.current.beginRead(DATA_COLLECTIONS)
  if (!background) setBootstrapState('loading')
  try {
    const data = await getBootstrapApi()
    applyBootstrapCollections(data, token)
    if (!background) setBootstrapState('ready')
    return true
  } catch (error) {
    if (error?.status === 401) expireSession()
    else if (!background) setBootstrapState('error')
    return false
  } finally {
    bootstrapSyncInFlightRef.current = false
  }
}
```

`applyBootstrapCollections()` checks `canApply(token, collection)` separately before replacing each collection.

- [ ] **Step 6: Add the ~5 second lifecycle-driven global reconciliation effect**

When authenticated, online, and bootstrap-ready:

```js
void refreshBootstrap({ background: true })
const timer = window.setInterval(() => {
  if (document.visibilityState === 'visible') void refreshBootstrap({ background: true })
}, GLOBAL_SYNC_INTERVAL_MS)

const onVisible = () => {
  if (document.visibilityState === 'visible') void refreshBootstrap({ background: true })
}
const onFocus = () => void refreshBootstrap({ background: true })
```

Keep the existing connectivity state listener. Transitioning `isOnline` back to true re-runs the effect and causes an immediate background refresh.

- [ ] **Step 7: Put the 2-second Orders poll behind the same orders guard**

Before `getOrdersApi()` call:

```js
const token = syncGuardRef.current.beginRead(['orders'])
```

After the response, return without applying or alerting if:

```js
if (!syncGuardRef.current.canApply(token, 'orders')) return
```

Only a response that wins the guard may update `knownActiveOrderIdsRef`, `setOrders`, highlight IDs, or play the new-order sound.

- [ ] **Step 8: Run focused GREEN tests**

Run:

```bash
node --test src/utils/dataSync.test.js src/realtimeSyncRegression.test.js src/orderStateOwnershipRegression.test.js src/utils/orderRealtime.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx src/utils/dataSync.js src/utils/dataSync.test.js src/realtimeSyncRegression.test.js
git commit -m "feat: sync business state without reload"
```

---

### Task 7: Complete confirmation-before / centered-success-after coverage

**Files:**
- Create: `src/components/ConfirmationDialog.jsx`
- Create: `src/components/ConfirmationDialog.test.js`
- Modify: `src/components/CancelOrderDialog.jsx`
- Modify: `src/components/CancelOrderDialog.test.js`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/pages/Products.jsx`
- Modify: `src/pages/Clients.jsx` only if test coverage needs stable labels; retain its existing delete confirmation behavior
- Modify: `src/App.jsx`
- Modify: `src/successFeedbackRegression.test.js`

**Confirmation classification for this task:**
- Existing single-payment modal: sufficient confirmation; it shows order/amount/payment method and final `Confirmar pagamento`.
- Existing table-tab payment modal: sufficient confirmation; it shows comanda/order count/total/payment method and final `Confirmar pagamento`.
- Existing refund dialog: sufficient confirmation; it shows full refund amount/financial consequence/method and final `Confirmar estorno`.
- Checkout itself is a review/commit surface showing totals; do not add a redundant modal to ordinary order save.
- Add missing explicit confirmation for product deletion and irreversible order finalization.
- Cancellation gets an additional final review stage as explicitly required by the approved spec.

- [ ] **Step 1: Write RED tests for a reusable irreversible-action confirmation**

`ConfirmationDialog.test.js` should require `Modal`, explicit title/description, cancel and confirm buttons, busy disabling, and a configurable danger style/label.

Run:

```bash
node --test src/components/ConfirmationDialog.test.js
```

Expected: FAIL because the component does not exist.

- [ ] **Step 2: Implement the minimal reusable dialog**

Expected component contract:

```jsx
<ConfirmationDialog
  open={Boolean(target)}
  title="Excluir produto?"
  description="Esta ação remove o produto do cardápio e não pode ser desfeita."
  confirmLabel="Excluir produto"
  tone="danger"
  submitting={...}
  onClose={...}
  onConfirm={...}
/>
```

Use existing `Modal` + `Button`; do not create a new overlay system.

- [ ] **Step 3: Write RED cancellation final-review tests**

Extend `CancelOrderDialog.test.js` to require a distinct final-review state and ensure the data-entry submit does not directly call `onConfirm`.

Required copy/semantics:

- identify the order;
- show selected cancellation reason;
- if paid and refund-now, show amount/method and that an estorno will be registered;
- if paid and deferred, state that estorno will remain pending;
- final destructive CTA `Cancelar pedido definitivamente` or equivalent;
- only this final CTA invokes `onConfirm(payload)`.

- [ ] **Step 4: Run and verify RED**

Run:

```bash
node --test src/components/CancelOrderDialog.test.js
```

Expected: FAIL because the current form submit invokes `onConfirm` immediately after validation.

- [ ] **Step 5: Implement two-stage cancellation in the same modal**

Use local `reviewing` state. First submit validates and moves to review. The final handler invokes `onConfirm` with the already validated payload. `Voltar` from review returns to the form without losing entered reason/refund choices. During `submitting`, neither stage can close.

- [ ] **Step 6: Confirm irreversible finalization and product deletion**

In Orders, clicking the final action opens `ConfirmationDialog` instead of calling `onFinalizeOrder` directly. The description must distinguish delivery from local/retirada where appropriate.

In Products, clicking the trash icon selects the product and opens `ConfirmationDialog`; only the confirm CTA invokes `onDelete(product.id)`.

Keep the existing client BottomSheet delete-confirm branch because it already explicitly says the action cannot be undone.

- [ ] **Step 7: Ensure significant successes use the centered App overlay**

Add missing success calls after successful deletes:

```js
showSuccessMessage('Cliente excluído com sucesso')
showSuccessMessage('Produto excluído com sucesso')
```

Keep existing success overlay for create/update/finalize/payment/comanda payment/refund/manual movement. The centralized cancellation handler from Task 5 provides cancellation success.

Extend `successFeedbackRegression.test.js` so source regressions cover delete and cancellation handlers using `showSuccessMessage`, and ensure page-level order cancellation no longer emits a competing success banner.

- [ ] **Step 8: Run focused GREEN tests**

Run:

```bash
node --test src/components/ConfirmationDialog.test.js src/components/CancelOrderDialog.test.js src/successFeedbackRegression.test.js src/orderStateOwnershipRegression.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/ConfirmationDialog.jsx src/components/ConfirmationDialog.test.js src/components/CancelOrderDialog.jsx src/components/CancelOrderDialog.test.js src/pages/Orders.jsx src/pages/Products.jsx src/App.jsx src/successFeedbackRegression.test.js
git commit -m "feat: confirm irreversible actions consistently"
```

---

### Task 8: Unify official cancellation date semantics and refund-pending derivation

**Files:**
- Modify: `src/utils/orderWorkflow.js`
- Modify: `src/utils/orderWorkflow.test.js`
- Modify: `src/utils/orderLifecycle.test.js`
- Modify: `src/pages/Finance.jsx`
- Modify: `src/pages/OrderHistory.jsx`
- Modify: `src/pages/OrderHistory.test.js`

**Behavior:** Finance and History display the same official `cancelledAt`; no legacy fallback is invented for display. Order date/payment/refund timestamps stay separate.

- [ ] **Step 1: Write RED formatter/date tests**

Add a shared nullable formatter contract:

```js
assert.equal(formatCancellationDate(null), 'Data não informada')
assert.equal(formatCancellationDate(''), 'Data não informada')
assert.equal(formatCancellationDate('invalid'), 'Data não informada')
assert.equal(formatCancellationDate('2026-09-03T13:00:00.000Z'), '03/09/2026')
```

Use the existing project timezone/date formatting conventions; do not derive from `orderDate`, `finishedAt`, or `createdAt` when `cancelledAt` is absent.

Extend `OrderHistory.test.js` to require visible `Cancelado em ...` metadata sourced from `order.cancelledAt`.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test src/utils/orderWorkflow.test.js src/pages/OrderHistory.test.js src/utils/orderLifecycle.test.js
```

Expected: FAIL because Finance has a local formatter and History does not visibly use the official cancellation timestamp.

- [ ] **Step 3: Add and reuse the shared formatter**

In `orderWorkflow.js`:

```js
export const formatCancellationDate = (value) => {
  if (!value) return 'Data não informada'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleDateString('pt-BR')
}
```

Delete the private formatter from `Finance.jsx` and import this helper in both Finance and History.

History may keep `cancelledAt || finishedAt || createdAt` only as a technical sorting fallback for legacy rows, but the visible cancellation metadata must be:

```jsx
<small className="order-cancel-meta">
  Cancelado em {formatCancellationDate(order.cancelledAt)} · Motivo: {cancelReason}
</small>
```

- [ ] **Step 4: Strengthen refund-state regression tests**

In `orderLifecycle.test.js`, explicitly cover:

```js
getOrderRefundState({ status: 'Cancelado', paymentStatus: 'Pago' }) === 'pending'
getOrderRefundState({ status: 'Cancelado', paymentStatus: 'Pago', refundMovementId: 'r1' }) === 'refunded'
getOrderRefundState({ status: 'Cancelado', paymentStatus: 'Pago', refundedAt: '...' }) === 'refunded'
```

Combined with Task 2's `/api/orders` test, this proves a completed refund cannot re-enter the pending set after polling.

- [ ] **Step 5: Run GREEN**

Run:

```bash
node --test src/utils/orderWorkflow.test.js src/pages/OrderHistory.test.js src/utils/orderLifecycle.test.js worker/orderReadRepository.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/orderWorkflow.js src/utils/orderWorkflow.test.js src/utils/orderLifecycle.test.js src/pages/Finance.jsx src/pages/OrderHistory.jsx src/pages/OrderHistory.test.js
git commit -m "fix: use official cancellation date everywhere"
```

---

### Task 9: Mobile 320–480 px regression pass for new confirmation and money flows

**Files:**
- Modify: `src/mobileOverlayRegression.test.js`
- Modify: `src/new-order.css`, `src/order-cancellation.css`, or nearest existing responsive stylesheet **only if the RED test exposes a real overflow/touch issue**

- [ ] **Step 1: Add RED mobile contract assertions before changing CSS**

Extend existing regression coverage to assert:

- confirmation dialogs use the existing `Modal` and therefore inherit dynamic viewport max-height/internal scrolling;
- cancellation review content stays inside the modal body rather than creating a nested fixed overlay;
- BRL text inputs use `min-width: 0`/existing form-grid responsive behavior rather than fixed widths;
- destructive confirmation action groups can wrap/stack under the existing mobile breakpoint;
- no new component introduces a fixed width greater than the 320 px viewport.

- [ ] **Step 2: Run the mobile-focused tests and verify RED only if a missing contract is found**

Run:

```bash
node --test src/mobileOverlayRegression.test.js src/components/ConfirmationDialog.test.js src/components/CancelOrderDialog.test.js src/components/OrderCheckoutSummary.test.js
```

If the new components already satisfy all shared mobile contracts, do **not** manufacture CSS changes merely to make a commit larger. In that case add only the regression assertions and keep production CSS untouched.

- [ ] **Step 3: Make the minimum responsive CSS fix if required**

Use existing CSS variables/breakpoints (`--mobile-overlay-max-height`, existing form grids, existing touch-target rules). Do not add a parallel modal layout or absolute pixel widths that break 320 px.

- [ ] **Step 4: Re-run GREEN**

Run the same focused command and expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mobileOverlayRegression.test.js src/new-order.css src/order-cancellation.css
git commit -m "test: protect mobile confirmation flows"
```

Only add CSS files that actually changed.

---

### Task 10: Full regression, lint, build, and Worker dry-run — no production deploy

**Files:**
- No feature files unless verification exposes a regression; any fix must restart RED → GREEN for that behavior before proceeding.

- [ ] **Step 1: Run the complete test suite**

```bash
npm test
```

Expected: all tests pass with no skipped feature regressions.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 3: Build production assets**

```bash
npm run build
```

Expected: Vite production build succeeds.

- [ ] **Step 4: Validate the Worker bundle only**

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: Worker dry-run succeeds. This command must remain `--dry-run`; do not deploy.

- [ ] **Step 5: Run focused high-risk regressions once more**

```bash
node --test \
  worker/orderReadRepository.test.js \
  worker/orderCancellation.test.js \
  worker/orderCancellationHttp.test.js \
  src/utils/dataSync.test.js \
  src/realtimeSyncRegression.test.js \
  src/orderStateOwnershipRegression.test.js \
  src/components/CancelOrderDialog.test.js \
  src/successFeedbackRegression.test.js
```

Expected: PASS. Specifically verify the tests cover: refunded order stays refunded after `/api/orders`, stale reads cannot overwrite local mutations, cancellation API is App-owned, final confirmation precedes cancellation API, and centralized success follows completed cancellation.

- [ ] **Step 6: Review the diff against the approved spec**

Check every spec section explicitly:

- BRL mask for delivery fee/fixed adjustment; percentage numeric;
- confirmation before irreversible/financial writes;
- centered success after significant persisted changes;
- cancellation final review before API;
- immediate local state effects;
- global ~5s + Orders ~2s sync;
- focus/visibility/reconnection refresh;
- global in-flight protection + per-collection stale response protection;
- refund pending bug fixed at canonical read source;
- duplicate refund still blocked;
- canonical `cancelledAt` returned and shown consistently;
- legacy missing `cancelledAt` remains unknown;
- 320–480 px responsive contracts retained;
- no deployment workflow change and no production deploy.

- [ ] **Step 7: Scan for accidental placeholders/debug leftovers**

```bash
grep -RInE "TODO|FIXME|console\.log|debugger|TBD" src worker docs/superpowers/plans/2026-09-03-ux-confirmations-realtime-sync-money-plan.md
```

Review each match; remove implementation leftovers, but keep intentional documentation wording only when semantically necessary.

- [ ] **Step 8: Commit final verification-only fixes if any**

If verification required code changes, those changes must already have their own RED/GREEN evidence and should be committed with a focused message. If no changes were required, do not create an empty commit.

- [ ] **Step 9: Stop before deployment**

Report the final test/lint/build/dry-run results and the final commit SHA. Do **not** run `wrangler deploy`, do not trigger `.github/workflows/deploy-production.yml`, and do not apply remote D1 migrations without a new explicit user authorization.

---

## Implementation Order Rationale

1. Fix money presentation independently first.
2. Repair the backend canonical read contract before adding more polling, so faster synchronization cannot amplify stale cancellation/refund data.
3. Make mutation endpoints return complete official effects before the frontend stops using bootstrap as a write workaround.
4. Build/test the pure sync guard before wiring timers.
5. Centralize cancellation/History ownership before relying on global reconciliation.
6. Apply all writes immediately, then add guarded periodic sync.
7. Finish confirmation/success UX after state ownership is centralized, avoiding duplicate page-level feedback paths.
8. Unify cancellation-date semantics on the now-canonical order representation.
9. Protect mobile behavior and run full verification.

## Explicit Non-Goals

- No WebSocket/SSE/Cloudflare Durable Object realtime transport in this round.
- No optimistic fake server IDs/timestamps for persisted objects.
- No new refund-status column or refund table.
- No backfill that invents `cancelledAt` for legacy cancelled rows.
- No partial refunds.
- No production deployment or remote migration execution.
