# Order Cancellation, Refunds and History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace order hard-delete with irreversible cancellation, preserve payment history, add full-refund handling and pending-refund management, and move finished/cancelled orders into a dedicated History screen.

**Architecture:** Persist cancellation metadata on `orders`; represent completed refunds as `movements` with `source = 'order-refund'`, linked to both `order_id` and `payment_id`. Keep backend validation authoritative, derive refund status instead of persisting it, and split active operations (`Pedidos`) from terminal records (`Histórico`).

**Tech Stack:** React 19, Vite 8, Node test runner (`node --test`), Cloudflare Worker, D1/SQLite, Wrangler 4.128.0, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-03-order-cancellation-refunds-history-design.md`

## Global Constraints

- Cancellation is irreversible.
- `Em preparo` and `Finalizado` may be cancelled; `Cancelado` is terminal.
- Cancellation reason is mandatory; `Outro` requires a non-empty note.
- Cancellation refunds are always 100% of the amount actually paid; partial refunds are out of scope.
- Paid-order cancellation must preserve the original payment and payment movement.
- Refund method is mandatory; UI suggests the original payment method but does not force it.
- Do not persist a redundant `refund_status`; derive `none`, `pending`, or `refunded` from order/payment/refund movement data.
- Cancelled orders are excluded from sales analytics, receivables, active-order counts, and table-tab pending checks.
- `Recebido hoje` becomes payment inflows minus order-refund outflows recorded on that day.
- Desktop navigation adds History immediately after Orders; mobile keeps History inside More plus a `Ver histórico` shortcut on Orders.
- Public hard-delete is removed from the operational order flow.
- Keep the migration additive and compatible with all existing rows.
- Every implementation task follows RED -> minimal GREEN -> focused regression -> commit.
- Final verification is `npm test`, `npm run lint`, `npm run build`, and `npx --yes wrangler@4.128.0 deploy --dry-run`.

---

## File Structure

**Create**
- `migrations/0008_order_cancellation_refunds.sql` — additive cancellation columns and refund uniqueness/indexing support.
- `worker/orderCancellation.js` — cancellation reason normalization, refund-state derivation, cancellation/refund repository orchestration.
- `worker/orderCancellation.test.js` — focused repository/domain tests for cancel/refund rules.
- `src/utils/orderLifecycle.js` — shared frontend predicates and refund-state helpers.
- `src/utils/orderLifecycle.test.js` — frontend domain helper tests.
- `src/pages/OrderHistory.jsx` — History screen for Finalized and Cancelled orders.
- `src/pages/OrderHistory.test.js` — History filtering/status/action tests.
- `src/components/CancelOrderDialog.jsx` — reason + paid/refund decision flow.
- `src/components/CancelOrderDialog.test.js` — dialog validation/branch tests.
- `src/components/RegisterRefundDialog.jsx` — mandatory refund-method confirmation.
- `src/components/RegisterRefundDialog.test.js` — refund dialog validation/default tests.

**Modify**
- `worker/repositories.js` — order mapping/list queries, payment/refund lookup helpers, table-tab settlement query.
- `worker/index.js` — semantic cancel/refund routes; remove public DELETE-order route.
- `worker/index.test.js` — HTTP contract/error tests.
- `src/api/client.js` (or the existing API client module under `src/api/`) — `cancelOrderApi` and `refundOrderApi`; remove operational `deleteOrderApi` use.
- `src/App.jsx` — state handlers, active/history routing, totals, cancellation/refund state refresh.
- `src/pages/Orders.jsx` — active-only list, `Cancelar pedido`, `Ver histórico`.
- `src/pages/Finance.jsx` — pending-refund section and register-refund action.
- `src/pages/Dashboard.jsx` and `src/utils/dashboardAnalytics.js` — exclude cancelled orders from commercial metrics.
- `src/components/Sidebar.jsx` — desktop History item.
- `src/components/MobileNavigation.jsx` — History inside More.
- `src/utils/mobileNavigation.js` — include History in the appropriate mobile section ordering without adding a bottom-tab item.
- `src/App.css` plus the nearest existing mobile/finance/order CSS files — styles for cancellation, history, badges, refund pending cards.
- Existing regression tests under `src/pages/`, `src/components/`, `src/utils/`, and `worker/` where current hard-delete/finished assumptions are encoded.

---

### Task 1: Additive D1 schema for cancellation and refund identity

**Files:**
- Create: `migrations/0008_order_cancellation_refunds.sql`
- Create: `worker/orderCancellationMigration.test.js`

**Interfaces:**
- Produces order columns `cancelled_at TEXT`, `cancel_reason TEXT`, `cancel_reason_note TEXT`.
- Produces a database-level guard preventing more than one `order-refund` movement per `(business_id, order_id)`.
- Existing `movements.payment_id` is used to link the refund to the original payment; no refund table is introduced.

- [ ] **Step 1: Write the failing migration contract test**

Create a Node test that reads `migrations/0008_order_cancellation_refunds.sql` and asserts all three `ALTER TABLE orders ADD COLUMN` statements plus a partial unique index for `source = 'order-refund'`.

```js
assert.match(sql, /ALTER TABLE orders ADD COLUMN cancelled_at TEXT/i)
assert.match(sql, /ALTER TABLE orders ADD COLUMN cancel_reason TEXT/i)
assert.match(sql, /ALTER TABLE orders ADD COLUMN cancel_reason_note TEXT/i)
assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*movements[\s\S]*business_id[\s\S]*order_id[\s\S]*order-refund/i)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test worker/orderCancellationMigration.test.js`
Expected: FAIL because migration `0008` does not exist.

- [ ] **Step 3: Add the migration**

Use an additive migration only:

```sql
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE orders ADD COLUMN cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN cancel_reason_note TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_movements_one_order_refund
ON movements (business_id, order_id)
WHERE source = 'order-refund' AND order_id IS NOT NULL;
```

- [ ] **Step 4: Re-run focused test**

Run: `node --test worker/orderCancellationMigration.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add migrations/0008_order_cancellation_refunds.sql worker/orderCancellationMigration.test.js
git commit -m "feat: add order cancellation schema"
```

---

### Task 2: Backend cancellation and refund domain layer

**Files:**
- Create: `worker/orderCancellation.js`
- Create: `worker/orderCancellation.test.js`
- Modify: `worker/repositories.js`

**Interfaces:**
- Produces `CANCEL_REASONS = ['client_changed_mind','duplicate_order','product_unavailable','entry_error','other']`.
- Produces `cancelOrder(db, businessId, orderId, input)` where `input = { reason, note, refundNow, refundMethod }`.
- Produces `registerOrderRefund(db, businessId, orderId, { refundMethod })`.
- Produces `getOrderRefundState(order)` returning `'none' | 'pending' | 'refunded'` from mapped payment/refund information.
- `cancelOrder` returns the updated mapped order; `registerOrderRefund` returns `{ order, movement }`.

- [ ] **Step 1: Write RED tests for validation and state transitions**

Cover: missing reason; invalid reason; `other` without note; already-cancelled order; unpaid cancel; paid cancel without refund; paid cancel with immediate refund; second refund rejected; refund for non-cancelled/unpaid order rejected.

Use stable domain error codes in assertions:

```js
'ORDER_CANCEL_REASON_REQUIRED'
'ORDER_CANCEL_REASON_NOTE_REQUIRED'
'ORDER_ALREADY_CANCELLED'
'ORDER_REFUND_NOT_ALLOWED'
'ORDER_ALREADY_REFUNDED'
'ORDER_REFUND_METHOD_REQUIRED'
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test worker/orderCancellation.test.js`
Expected: FAIL because the module/functions do not exist.

- [ ] **Step 3: Implement reason normalization and validation**

Implement pure helpers first. Trim note/method input; require note only for `other`; reject values outside `CANCEL_REASONS`.

- [ ] **Step 4: Implement repository reads and order mapping support**

In `worker/repositories.js`, ensure order reads expose cancellation fields, payment id/method/paid amount, and whether an `order-refund` movement exists. Add focused helper queries rather than broad rewrites.

- [ ] **Step 5: Implement cancellation write path**

For unpaid orders: update `status`, `cancelled_at`, `cancel_reason`, `cancel_reason_note`; do not create/delete payments or movements. After cancellation call table-tab settlement logic using a query that treats `Cancelado` as non-pending.

For paid orders with `refundNow = false`: persist only cancellation metadata and preserve payment/payment movement.

For paid orders with `refundNow = true`: validate `refundMethod`, update cancellation metadata and create exactly one `saida` movement with `source = 'order-refund'`, `order_id`, `payment_id`, and amount equal to the backend-read paid amount. Execute through one D1 batch/transactional unit so the operation does not report partial success.

- [ ] **Step 6: Implement deferred refund path**

`registerOrderRefund` must read authoritative payment/order state, reject invalid cases, and insert the same `order-refund` movement shape without accepting a client-supplied amount.

- [ ] **Step 7: Make table-tab settlement cancellation-aware**

Change pending-order SQL from absence-of-payment semantics to explicitly exclude `status = 'Cancelado'` while preserving existing paid/pending behavior.

- [ ] **Step 8: Run focused tests**

Run: `node --test worker/orderCancellation.test.js worker/multiItemCheckoutRepository.test.js`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add worker/orderCancellation.js worker/orderCancellation.test.js worker/repositories.js
git commit -m "feat: add cancellation and refund domain logic"
```

---

### Task 3: Replace public hard-delete with semantic HTTP APIs

**Files:**
- Modify: `worker/index.js`
- Modify: `worker/index.test.js`

**Interfaces:**
- `POST /api/orders/:id/cancel` body: `{ reason, note?, refundNow: boolean, refundMethod? }`.
- `POST /api/orders/:id/refund` body: `{ refundMethod }`.
- Remove operational `DELETE /api/orders/:id` handling; it must no longer return success for authenticated callers.
- Both routes retain same-origin mutation protection and business scoping.

- [ ] **Step 1: Add RED HTTP contract tests**

Assert authenticated cancel success, deferred refund success, immediate-refund success, invalid-domain errors mapped to 4xx JSON, duplicate refund rejection, and `DELETE /api/orders/:id` no longer invokes repository hard-delete.

- [ ] **Step 2: Run HTTP tests and verify RED**

Run: `node --test worker/index.test.js`
Expected: new cancellation/refund cases FAIL.

- [ ] **Step 3: Wire semantic routes**

Parse request JSON, invoke `cancelOrder` / `registerOrderRefund`, return `{ order }` or `{ order, movement }`, and preserve existing `apiError`/same-origin conventions.

- [ ] **Step 4: Remove DELETE order route/import**

Delete the public order hard-delete branch and any now-unused import from `worker/index.js`. Do not remove unrelated repository deletion helpers unless tests prove they are dead and task scope remains safe.

- [ ] **Step 5: Run Worker tests**

Run: `node --test worker/index.test.js worker/orderCancellation.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/index.js worker/index.test.js
git commit -m "feat: expose order cancellation and refund APIs"
```

---

### Task 4: Frontend lifecycle helpers and API client

**Files:**
- Create: `src/utils/orderLifecycle.js`
- Create: `src/utils/orderLifecycle.test.js`
- Modify: existing API client module under `src/api/`
- Modify: API-client regression tests already colocated with that module, or create `src/api/orderCancellation.test.js` if none exists.

**Interfaces:**
- `isOrderCancelled(order)` => boolean.
- `isOrderFinished(order)` => true for `Finalizado` or `Cancelado` terminal lifecycle where terminal checks are intended.
- `isOrderActive(order)` => false for `Finalizado` and `Cancelado`.
- `getOrderRefundState(order)` => `'none' | 'pending' | 'refunded'`.
- `cancelOrderApi(id, payload)` => POST cancel endpoint.
- `refundOrderApi(id, payload)` => POST refund endpoint.

- [ ] **Step 1: Write RED helper tests**

Use representative unpaid/paid/cancelled/refunded objects and assert active/terminal/refund-state semantics explicitly.

- [ ] **Step 2: Run focused helper tests and verify RED**

Run: `node --test src/utils/orderLifecycle.test.js`
Expected: FAIL because helper module does not exist.

- [ ] **Step 3: Implement pure lifecycle helpers**

Keep all status string comparisons centralized in this module so pages do not each reinvent `Cancelado` semantics.

- [ ] **Step 4: Add API client tests and implementation**

Verify method, URL and JSON body for both semantic endpoints. Remove frontend dependence on `deleteOrderApi` for orders.

- [ ] **Step 5: Run focused tests**

Run: `node --test src/utils/orderLifecycle.test.js src/api/*.test.js`
Expected: PASS for matching API test files; if shell glob finds unrelated files, run the exact created/modified test path instead.

- [ ] **Step 6: Commit**

```bash
git add src/utils/orderLifecycle.js src/utils/orderLifecycle.test.js src/api
git commit -m "feat: add frontend order lifecycle APIs"
```

---

### Task 5: Active Orders cancellation UX and dedicated History screen

**Files:**
- Create: `src/components/CancelOrderDialog.jsx`
- Create: `src/components/CancelOrderDialog.test.js`
- Create: `src/pages/OrderHistory.jsx`
- Create: `src/pages/OrderHistory.test.js`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/pages/OrdersMobile.test.js`
- Modify: `src/App.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/components/MobileNavigation.jsx`
- Modify: `src/utils/mobileNavigation.js`
- Modify: relevant CSS files.

**Interfaces:**
- `CancelOrderDialog({ open, order, onClose, onConfirm, submitting })` calls `onConfirm({ reason, note, refundNow, refundMethod })` only with valid data.
- `OrderHistory({ orders, onCancelOrder, actionKey, onNavigate })` renders terminal orders and supports `Todos | Finalizados | Cancelados`.
- `Orders` receives only active-order presentation responsibility and exposes `onNavigateHistory`.

- [ ] **Step 1: Write RED dialog tests**

Assert mandatory reason, mandatory note for `Outro`, unpaid flow skips refund question, paid flow asks whether already refunded, and `Sim` requires refund method with original method preselected when present.

- [ ] **Step 2: Implement minimal `CancelOrderDialog`**

Reuse existing Modal/BottomSheet patterns, existing form controls, disabled/submitting conventions, and current mobile target-size rules.

- [ ] **Step 3: Write RED History tests**

Assert only Finalizado/Cancelado render; filters work; cancelled rows show reason and refund state; Finalizado exposes `Cancelar pedido`; Cancelado does not expose reactivation/cancel again.

- [ ] **Step 4: Implement `OrderHistory`**

Preserve current order-card visual language, extract/reuse small display helpers from `Orders.jsx` only when needed to avoid duplicating large card logic.

- [ ] **Step 5: Write RED Orders/App navigation tests**

Assert active Orders excludes Finalizado and Cancelado, no trash/delete control remains, `Cancelar pedido` is explicit, and `Ver histórico` navigates to `history`.

- [ ] **Step 6: Wire `App.jsx` cancellation handler**

Replace `handleDeleteOrder` with a cancel handler calling `cancelOrderApi`. Update the returned order in state instead of filtering it out entirely. Keep it out of active UI through lifecycle predicates while preserving it for History and analytics filtering.

- [ ] **Step 7: Add History routing/navigation**

Desktop Sidebar order: Dashboard, Pedidos, Histórico, Clientes, Produtos, A Receber, Financeiro. Mobile: add História/Histórico action only inside More; do not add a sixth bottom-tab. Update swipe/adjacency behavior intentionally so History does not break existing bottom-nav contracts.

- [ ] **Step 8: Run focused UI tests**

Run: `node --test src/components/CancelOrderDialog.test.js src/pages/OrderHistory.test.js src/pages/OrdersMobile.test.js`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/CancelOrderDialog.jsx src/components/CancelOrderDialog.test.js src/pages/OrderHistory.jsx src/pages/OrderHistory.test.js src/pages/Orders.jsx src/pages/OrdersMobile.test.js src/App.jsx src/components/Sidebar.jsx src/components/MobileNavigation.jsx src/utils/mobileNavigation.js src/*.css
git commit -m "feat: add cancellation flow and order history"
```

---

### Task 6: Finance pending-refund management

**Files:**
- Create: `src/components/RegisterRefundDialog.jsx`
- Create: `src/components/RegisterRefundDialog.test.js`
- Modify: `src/pages/Finance.jsx`
- Modify: `src/pages/FinanceMoreMobile.test.js`
- Modify: `src/App.jsx`
- Modify: relevant finance CSS.

**Interfaces:**
- `RegisterRefundDialog({ open, order, onClose, onConfirm, submitting })` calls `onConfirm({ refundMethod })`.
- `Finance` receives `pendingRefundOrders`, `onRegisterRefund`, and existing movement totals/handlers.
- `App.jsx` derives `pendingRefundOrders` from cancelled + paid + no-refund orders; it does not persist a separate UI-only status field.

- [ ] **Step 1: Write RED refund-dialog tests**

Assert refund method required, original payment method preselected when available, amount is displayed read-only from paid amount, and submit payload contains method only.

- [ ] **Step 2: Implement `RegisterRefundDialog`**

No editable refund amount field. Copy must clearly say the full amount will be registered as a refund.

- [ ] **Step 3: Write RED Finance pending section tests**

Assert section appears only with pending refunds; each row shows order identity/client/value/cancel date and `Registrar estorno`; refunded orders disappear from pending list while movement history remains.

- [ ] **Step 4: Wire deferred refund handler in `App.jsx`**

Call `refundOrderApi`, replace returned order in `orders`, append/replace the returned movement in `movements` without duplicating by id, and use existing success/error feedback patterns.

- [ ] **Step 5: Run focused finance tests**

Run: `node --test src/components/RegisterRefundDialog.test.js src/pages/FinanceMoreMobile.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/RegisterRefundDialog.jsx src/components/RegisterRefundDialog.test.js src/pages/Finance.jsx src/pages/FinanceMoreMobile.test.js src/App.jsx src/*.css
git commit -m "feat: manage pending order refunds in finance"
```

---

### Task 7: Commercial analytics, receivables, received-today, and table-tab regressions

**Files:**
- Modify: `src/utils/dashboardAnalytics.js`
- Modify: `src/pages/DashboardAnalytics.test.js`
- Modify: `src/App.jsx`
- Modify: receivables tests/pages that currently infer unpaid solely from payment state.
- Modify: Worker table-tab regression tests that encode pending-order behavior.

**Interfaces:**
- All commercial order collections first exclude `status === 'Cancelado'`.
- `receivedToday` uses movements: sum `entrada` movements with `source = 'order-payment'` for today minus `saida` movements with `source = 'order-refund'` for today.
- Receivables excludes cancelled orders before calculating pending amount.

- [ ] **Step 1: Add RED dashboard analytics tests**

Create fixtures where a cancelled order has historical items/payment and assert it contributes zero to sales, valid order count, average ticket, top products and payment-method sales mix.

- [ ] **Step 2: Add RED `Recebido hoje` regression**

Fixture: +80 order-payment today and -80 order-refund today => `receivedToday === 0`. Fixture with refund tomorrow leaves today at +80.

- [ ] **Step 3: Add RED receivables regression**

Unpaid cancelled order must not contribute to A Receber.

- [ ] **Step 4: Implement minimal filtering/calculation changes**

Use lifecycle helpers instead of scattered literal comparisons where frontend module boundaries permit.

- [ ] **Step 5: Add/adjust table-tab repository regression**

Cancelled unpaid order must not keep a tab open; another non-cancelled unpaid order must keep it open.

- [ ] **Step 6: Run focused regressions**

Run: `node --test src/pages/DashboardAnalytics.test.js worker/*table*test.js`
Expected: PASS for the matching files. Also run the exact receivables test path modified in this task.

- [ ] **Step 7: Commit**

```bash
git add src/utils/dashboardAnalytics.js src/pages/DashboardAnalytics.test.js src/App.jsx src/pages worker
git commit -m "fix: exclude cancelled orders from financial metrics"
```

---

### Task 8: Remove stale hard-delete UI/tests and run full verification

**Files:**
- Modify: any remaining tests/components referring to `Excluir pedido`, trash delete semantics, `deleteOrderApi`, or order hard-delete.
- Modify: `docs/superpowers/qa/` only if an existing QA checklist covers Orders/Finance and must reflect History/cancellation; otherwise no new QA document is required.

**Interfaces:**
- No user-visible order delete action remains.
- No frontend call path invokes `DELETE /api/orders/:id`.
- Cancelled rows remain queryable in bootstrap/history data.

- [ ] **Step 1: Search for stale semantics**

Run:

```bash
grep -R "Excluir pedido\|deleteOrderApi\|DELETE.*api/orders\|onDeleteOrder" -n src worker --exclude-dir=node_modules
```

Expected: no operational references; test-only assertions should explicitly verify removal rather than preserve old behavior.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: exit 0 and Vite build succeeds.

- [ ] **Step 5: Run Worker dry-run**

Run: `npx --yes wrangler@4.128.0 deploy --dry-run`
Expected: exit 0 with Worker bundle validation successful; do not deploy production in this step.

- [ ] **Step 6: Review migration safety**

Run: `npm run d1:migrate:local`
Expected: migration `0008_order_cancellation_refunds.sql` applies locally without destructive rebuild or existing-row transformation.

- [ ] **Step 7: Final commit if verification required cleanup**

```bash
git add -A
git commit -m "test: verify order cancellation workflow"
```

Skip this commit if the working tree is already clean after verification.

---

## Self-Review Results

- **Spec coverage:** All approved spec areas are mapped: persistent cancellation metadata, mandatory reasons, irreversibility, paid/unpaid branches, immediate/deferred full refunds, explicit refund method, History separation, desktop/mobile navigation, Finance pending refunds, commercial metric exclusion, net `Recebido hoje`, table-tab behavior, backend authority/idempotency, hard-delete removal, additive migration, and full verification.
- **Placeholder scan:** No TBD/TODO/“implement later” instructions are present. Each code-changing task specifies concrete behavior and focused tests.
- **Type/interface consistency:** Backend payload names are consistently `reason`, `note`, `refundNow`, `refundMethod`; frontend dialogs emit the same names. Refund identity is consistently represented by `source = 'order-refund'` plus `order_id` and `payment_id`. Refund state vocabulary is consistently `none | pending | refunded` internally and rendered as Portuguese UI copy.
