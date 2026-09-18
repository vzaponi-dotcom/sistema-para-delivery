# Spec C4 — Orders Domain Extraction Design

**Date:** 2026-09-17
**Branch:** `feature/spec-c4-orders`
**Base:** `master` at `737beeac2150aabeb39024af823f2f60fee25108`
**Status:** Design approved in brainstorming; implementation not started

## 1. Purpose

C4 establishes a real `orders` domain boundary for the administrative frontend while preserving the current user experience, business rules, synchronization behavior, backend contracts, and release safety.

This slice moves ownership of order-specific rules, use cases, UI, and API adapters into `src/domains/orders/`, but deliberately does **not** create an independent official order store. The central application runtime remains the owner of the synchronized official `orders` collection and of polling/focus/visibility mechanics introduced in C1.

C4 is an architectural extraction. It is not a redesign, not a new-feature slice, and not a backend rewrite.

The intended end state is:

- `src/domains/orders/` owns order-domain rules and order-specific application behavior;
- Orders owns New Order draft lifecycle and order lifecycle commands;
- Orders owns the order API adapter and the operations/cancellation policy adapters transferred from C3;
- the central runtime continues to own official synchronized collections and synchronization scheduling;
- Settings continues to own the Settings UI, but consumes Orders-owned policies through the Orders public contract;
- Table Service, Finance, Customers, Catalog, and Printing remain external owners until C5/C6/C7/C8/C9;
- `App.jsx`, Settings, and runtime consume Orders only through a deliberate public boundary.

## 2. Rollout alignment

This spec refines the C4 contract in `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`.

C4 begins from the post-C3 `master` merge SHA `737beeac2150aabeb39024af823f2f60fee25108`.

C4 is responsible for:

- Cozinha / active orders UI;
- Histórico de pedidos;
- Novo Pedido UI and draft lifecycle;
- order lifecycle/status rules;
- order timing/search/queue/arrival logic;
- order API adapter for order-lifecycle operations;
- operations/modalities policy ownership;
- cancellation-reasons policy ownership;
- the narrow public contract required by App, Settings, and the central runtime.

C4 must not preempt ownership assigned to later slices.

## 3. Goals

C4 must:

1. establish `src/domains/orders/{domain,application,infrastructure,ui}`;
2. expose a deliberate `src/domains/orders/index.js` public boundary;
3. move order-specific pages/components/hooks/utils out of legacy `src/pages`, `src/components`, `src/hooks`, and `src/utils` locations when their ownership is unambiguously Orders;
4. move `getOrders`, `createOrder`, `updateOrderStatus`, and `cancelOrder` endpoint adapters out of `src/api/client.js` into Orders infrastructure;
5. preserve the central runtime as the single official owner of synchronized order state;
6. preserve C1 polling intervals and sync-guard behavior;
7. move New Order draft lifecycle, owner/generation, idempotency-key, dirty-state, checkout-pending, and stale-response protection into Orders application code;
8. move operational arrival detection, temporary highlight, deduplication, kitchen clock ownership, and sound execution into Orders application/domain code;
9. preserve local sound preference as an external/local preference rather than domain state;
10. transfer operations/modalities and cancellation-reasons policy adapters from the Settings surface into Orders ownership;
11. preserve all current order capabilities, cancellation/refund entry behavior, payment eligibility, scheduled/immediate timing, 50-minute rule, queue ordering, search, arrival sound/highlight, and current visuals;
12. keep Table Service, Finance, Customers, Catalog, and Printing ownership external through narrow callbacks/ports until their scheduled slices;
13. remove C4-specific legacy facades/reexports before staging unless a real blocker is explicitly recorded in the compatibility ledger;
14. strengthen architecture tests so consumers cannot bypass the Orders public boundary.

## 4. Non-goals

C4 does not:

- redesign Cozinha, Novo Pedido, Histórico, or Settings;
- change labels, copy, icons, spacing, responsive behavior, or theme behavior intentionally;
- change URLs/history semantics or introduce React Router;
- change Worker routes or response envelopes;
- change D1 schemas or migrations;
- change the 5-second global synchronization cadence;
- change the approximately 2-second Cozinha order synchronization cadence;
- move official synchronized order state out of `app/runtime`;
- introduce Redux, Zustand, a new cache/store, WebSocket, or SSE;
- take ownership of tables/comandas/table-tabs; that belongs to C5;
- take ownership of payments, refunds, payment promises, or finance reconciliation; that belongs to C6;
- take ownership of customer management/quick-create internals; that belongs to C7;
- take ownership of product/catalog management; that belongs to C8;
- refactor QZ, print queue, print transport, print-job ownership, or order print documents; that belongs to C9;
- implement Kitchen TV; C4 only exposes pure operational contracts useful to that future surface;
- broadly relocate CSS; shared-CSS cleanup remains C10 unless a mechanical import-path move is necessary.

## 5. Chosen architecture

The approved architecture is a balanced domain extraction with external ports for later slices:

```text
src/domains/orders/
  index.js

  domain/
    lifecycle.js
    queue.js
    search.js
    realtime.js
    workflow.js
    paymentEligibility.js
    historyAnalysis.js

  application/
    newOrderDraft.js
    useNewOrderDraft.js
    orderCommands.js
    orderArrivals.js

  infrastructure/
    ordersApi.js
    operationsPolicy.js
    cancellationReasonsPolicy.js

  ui/
    Orders.jsx
    OrderHistory.jsx
    NewOrder.jsx
    NewOrderRoute.jsx

    components/
      CancelOrderDialog.jsx
      KitchenTicket.jsx
      OrderDetail.jsx
      OperationalHistoryAnalysis.jsx
      ...other components that are exclusively order-owned
```

Exact filenames may be refined in the implementation plan to match the real code seams, but the ownership boundaries above are normative.

### 5.1 `domains/orders/domain`

This layer owns pure order rules. It must be deterministic, side-effect-free, and independently testable.

Expected responsibilities include:

- active/finished/cancelled lifecycle classification;
- refund-state interpretation only where needed to present order lifecycle state, without taking finance ownership;
- order-item search text and summaries;
- kitchen queue construction and ordering;
- immediate versus scheduled operational classification;
- late/on-time operational classification;
- order workflow/date formatting helpers that are truly order-owned;
- pure arrival detection;
- standalone-order payment eligibility as an order-facing rule;
- pure history analysis/projections used by the order history surface.

The domain layer may consume stable cross-runtime helpers from `shared/`, but must not duplicate them.

### 5.2 `domains/orders/application`

This layer owns order-specific state machines and use-case orchestration that are not global application runtime concerns.

It owns:

- New Order draft lifecycle;
- draft generation/ownership and stale-response invalidation;
- idempotency-key lifecycle for order creation;
- dirty state and checkout-pending state;
- open/discard/submit semantics for New Order;
- finalize-order and cancel-order command orchestration;
- order arrival tracking while Cozinha is active;
- highlight TTL/timer behavior;
- alert deduplication so the same order does not trigger repeatedly;
- invoking an injected/browser sound adapter when an eligible new operational order arrives.

It does not own the official synchronized `orders` collection.

### 5.3 `domains/orders/infrastructure`

This layer isolates Orders-specific external interfaces.

It owns:

- the HTTP adapter for lifecycle-owned order endpoints;
- operations/modalities policy adapter transferred from C3;
- cancellation-reasons policy adapter transferred from C3;
- any minimal browser/audio adapter if keeping sound execution outside application code improves testability.

It must depend on the generic infrastructure HTTP client rather than reimplement request mechanics.

### 5.4 `domains/orders/ui`

This layer owns order-specific presentation and local page interaction state.

It includes:

- Cozinha (`Orders`);
- Histórico (`OrderHistory`);
- Novo Pedido (`NewOrder` / `NewOrderRoute`);
- cancellation dialog;
- kitchen ticket;
- order detail;
- operational history analysis;
- other components whose meaning is specific to orders.

Generic UI primitives such as Button, Modal, PageHeader, StatCard, Icon, SystemSelect, and application navigation remain outside the Orders domain.

## 6. Official order state and runtime boundary

C4 must not create a second official order store.

`useOperationalDataRuntime` remains the source of truth for the synchronized official `orders` collection. It continues to own:

- bootstrap application of official order state;
- the order collection setter;
- synchronization guards;
- mutation precedence over stale reads;
- official revision tracking;
- global synchronization scheduling;
- Cozinha-specific order polling scheduling;
- focus and visibility refresh semantics;
- unauthorized-session handoff.

Orders receives current official data and narrow mutation/commit ports.

Conceptually:

```text
app/runtime
  owns official orders[]
  owns polling + sync guards
        |
        v
orders UI/application
  derives queue/history/search
  issues lifecycle commands
        |
        v
orders infrastructure
  calls backend
        |
        v
official response
        |
        v
app/runtime applyOfficialEffects(...)
```

A successful command never updates an independent Orders store. The official backend response is committed through the existing runtime mechanism.

## 7. Polling and Orders API ownership

The scheduling of order synchronization stays in `app/runtime`.

The implementation of `getOrders()` moves to Orders infrastructure.

The runtime must no longer need to know the concrete `/api/orders` endpoint. Instead, it consumes a narrow Orders read port/injected adapter.

The following existing behavior must remain unchanged:

- global background refresh remains around 5 seconds;
- dedicated Cozinha order refresh remains around 2 seconds;
- the dedicated order refresh is active only under the same conditions as before;
- visibility/focus refresh behavior remains unchanged;
- stale reads must not overwrite newer mutations;
- `401` must still flow through the global session-expiry path.

C4 moves endpoint ownership, not synchronization ownership.

## 8. Order API ownership

The following endpoints belong to Orders in C4:

```text
getOrders()
createOrder(payload, idempotencyKey)
updateOrderStatus(orderId, status)
cancelOrder(orderId, payload)
```

These move to `domains/orders/infrastructure/ordersApi.js` or an equivalent Orders-owned adapter.

The following endpoints remain outside Orders ownership even though some use `/api/orders/...` routes:

- `registerPayment()` -> C6 Finance/payment workflow;
- `refundOrder()` -> C6;
- `updateOrderPaymentPromise()` -> C6/Receivables;
- `createManualPrintJob()` -> C9 Printing;
- `getOrderPrintDocument()` -> C9 Printing;
- all `table-tabs` operations -> C5 Table Service.

Endpoint path is not the ownership rule; business responsibility is.

### 8.1 Cancellation special case

`cancelOrder()` remains an Orders command because cancellation is order lifecycle.

If `cancelOrder()` returns cross-domain effects such as:

- `movement`;
- `tableTab`;
- `tables`;

Orders must not interpret or own those foreign-domain structures. It passes the official response through the existing generic official-effects commit path. The runtime continues to distribute official effects to the corresponding synchronized collections.

This preserves current behavior while avoiding premature C5/C6 ownership.

## 9. New Order draft ownership

C4 moves New Order lifecycle ownership out of `App.jsx`.

The public contract is conceptually equivalent to:

```text
openNewOrder({
  returnDestination,
  tableId?,
  expectedTableTabId?
})

discardNewOrder()
submitNewOrder(payload)
setNewOrderDirty(isDirty)

isNewOrderDirty
checkoutPending
currentNewOrderContext
```

Exact API shape may use a hook/provider/controller, but the ownership is fixed.

Orders application code must own:

- draft generation/owner token;
- checkout idempotency key;
- invalidation when a draft is discarded/replaced;
- ignoring stale async completion from a superseded draft;
- dirty tracking;
- checkout-pending tracking;
- return destination;
- optional `tableId` and `expectedTableTabId` context received from Table Service.

`App.jsx` must stop owning or understanding:

- `newOrderOwnerRef`;
- `checkoutKey` internals;
- draft generation tokens;
- stale-checkout identity rules.

### 9.1 Table Service integration

When New Order is opened from Comandas, Orders receives table context as external input only.

C4 does not take ownership of:

- current table-tab identity;
- table occupancy;
- transfer semantics;
- table-tab generation;
- comanda selection reconciliation.

Those remain C5 responsibilities.

The current return-to-Comandas behavior must remain unchanged.

## 10. Cozinha queue, clock, arrivals, highlight, and sound

C4 makes Orders the owner of the meaning of an operational order arrival.

### 10.1 Pure rules

Orders domain code owns:

- queue partitioning into preparing/scheduled;
- order priority ordering;
- late state;
- finished-today count;
- search filtering;
- pure detection of new operational arrivals.

The implementation must continue to use `shared/orderTiming.js` as the common source for timing rules used across frontend/backend. The 50-minute operational rule must not be copied into a new Orders-only constant.

### 10.2 Clock

`useKitchenClock` or its replacement becomes Orders-owned because its purpose is to drive Orders operational projections.

This move must not change its tick behavior or user-visible timing semantics.

### 10.3 Arrival lifecycle

Orders application code owns:

- known operational order IDs for the active Cozinha session;
- already-alerted IDs;
- temporary `newOrderIds` highlight state;
- highlight timer cleanup;
- suppressing duplicate sound/highlight for the same order;
- resetting the right transient state when leaving/re-entering Cozinha;
- executing the new-order sound when allowed.

Arrival detection must use the official runtime-provided order list; it must not perform its own polling.

### 10.4 Sound preference

The preference `soundEnabled` remains a local application/device preference.

Orders receives that value and respects it, but does not persist or own the preference itself.

This preserves the C3 distinction between domain behavior and local device preference.

## 11. Settings policy ownership transfer

C3 intentionally left some policy adapters under Settings until their true domains existed.

C4 transfers the following adapters to Orders ownership:

- operations/modalities policy;
- cancellation-reasons policy.

The visual Settings editors remain in `app/surfaces/settings` because they are part of the Settings application surface.

Settings consumes the Orders-owned policy descriptors/adapters through the Orders public contract. Settings must not import deep paths from `domains/orders/infrastructure`.

The following C3 temporary adapters remain under Settings until their scheduled owner exists:

- payment methods -> C6 Finance;
- finance categories -> C6 Finance;
- printing policy/station/primary station -> C9 Printing.

The generic `app/policy-editing` engine remains domain-agnostic.

## 12. External integration ports

C4 deliberately keeps later-domain integrations outside Orders ownership.

Order UI/application may receive narrow callbacks/ports for:

### C5 Table Service

- initial table context for New Order;
- table-tab-related official effects returned by backend;
- return destination to Comandas.

### C6 Finance

- register payment from Cozinha/Histórico details;
- refund/payment flows not intrinsic to order cancellation command ownership;
- payment-method options needed by the current UI;
- payment promises handled by Receivables.

### C7 Customers

- quick-create customer callback used by New Order.

### C8 Catalog

- official product collection supplied for New Order composition.

### C9 Printing

- current printing facade/object consumed by order detail/Cozinha/Histórico;
- print actions;
- print queue navigation;
- order print-document/job operations.

C4 must not replace these external dependencies with deep imports into later-domain internals.

## 13. Public Orders contract

`src/domains/orders/index.js` is the supported import boundary for non-Orders code.

Consumers outside the domain must not import `domains/orders/domain/**`, `application/**`, `infrastructure/**`, or `ui/**` directly.

The public contract may expose, as needed:

- Orders/Cozinha surface component;
- Order History surface component;
- New Order route/surface component;
- New Order lifecycle hook/controller/provider;
- Orders runtime read port / API adapter needed by central polling;
- operations policy adapter/descriptor;
- cancellation-reasons policy adapter/descriptor;
- narrowly selected pure projections that are genuinely cross-domain/application consumers.

The exact export list should be minimal and implementation-driven.

Do not export every internal helper for convenience.

## 14. Legacy file migration and facade policy

Files that are unambiguously Orders-owned should move into the domain rather than remain duplicated.

Expected migration candidates include current order-specific files under:

- `src/pages/Orders.jsx`;
- `src/pages/OrderHistory.jsx`;
- `src/pages/NewOrder.jsx`;
- `src/pages/NewOrderRoute.jsx`;
- `src/components/CancelOrderDialog.jsx`;
- order-only Kitchen/Order detail/history-analysis components;
- `src/hooks/useKitchenClock.js`;
- `src/utils/kitchenQueue.js`;
- `src/utils/orderCart*`;
- `src/utils/orderLifecycle.js`;
- `src/utils/orderPaymentEligibility.js`;
- `src/utils/orderRealtime.js`;
- `src/utils/orderWorkflow*`.

Before moving any component/helper, the implementation plan must verify that it is truly Orders-owned and not a shared/later-domain primitive.

C4 must not leave silent reexport facades at the old paths merely to make imports easier.

If a compatibility path is temporarily unavoidable during implementation, it must be removed before staging unless there is a documented blocker added to `docs/superpowers/qa/spec-c-compatibility-facades.md` with a specific owner and removal slice.

The existing compatibility ledger must otherwise remain respected:

- payment-receipt runtime bridge remains until C6;
- table-commit runtime bridge remains until C5;
- generic/auth compatibility in `src/api/client.js` remains on its scheduled migration path;
- runtime `updateCollection` escape hatch is not opportunistically removed outside its assigned program plan.

## 15. `src/api/client.js` after C4

C4 removes Orders-owned endpoint implementations from `src/api/client.js` once all consumers are migrated.

It must not remove unrelated compatibility exports assigned to later slices.

The target is that `src/api/client.js` no longer owns:

- `getOrders`;
- `createOrder`;
- `updateOrderStatus`;
- `cancelOrder`.

Finance/payment, table-service, printing, client, product, and other remaining endpoints stay until their owning slices migrate them.

No permanent compatibility reexports for those four Orders endpoints should survive staging unless explicitly recorded as debt.

## 16. Shared cross-runtime modules

Shared modules used by both frontend and Worker remain under `shared/` when cross-runtime ownership requires it.

C4 must not pull the following into `src/domains/orders` if doing so would duplicate or break backend sharing:

- `shared/orderTiming.js`;
- `shared/orderDisplayNumber.js`;
- `shared/orderCustomerIdentity.js` where applicable;
- `shared/orderPrintDocument.js`;
- business-policy/timing helpers used by both runtimes.

Orders may wrap or compose these helpers, but there must remain one source of truth.

The 50-minute timing rule must continue to come from the shared timing source.

## 17. Kitchen TV preparation

C4 does not implement Kitchen TV.

It should, however, keep pure operational projections reusable so a future Kitchen TV can consume queue/timing semantics without reading current page internals.

The reusable part should be pure domain projection functions, not a TV-specific abstraction or UI.

YAGNI applies: no TV routes, components, stores, transports, or subscriptions are created in C4.

## 18. Error handling and consistency

C4 preserves current error semantics.

### 18.1 Command failure

If an Orders API mutation fails with a known failure:

- no optimistic official order state is invented;
- the central official collection remains unchanged unless the backend response is confirmed and committed;
- current application feedback behavior is preserved;
- request/pending state is released correctly.

### 18.2 Unauthorized

A `401` continues to flow through the global session-expiry/unauthorized mechanism. Orders must not create a parallel auth policy.

### 18.3 Offline

Current offline write blocking remains unchanged. Orders must not create independent offline persistence or retry queues.

### 18.4 Stale New Order completion

A submit response from a superseded/discarded New Order draft must not mutate current draft UI state as if it belonged to the current owner. Existing stale-owner protection is preserved inside Orders application code.

Official backend effects that are valid and confirmed still follow the established official-effects commit semantics.

### 18.5 Cross-domain effects

Foreign effects returned by an Orders command are passed through, not reinterpreted by Orders.

## 19. Capabilities and authorization

C4 preserves all existing capability behavior.

Examples include:

- `orders.create`;
- `orders.finalize`;
- `orders.cancel`;
- `orders.discount`;
- `orders.history`;
- `orders.analysis`;
- external capabilities such as payment/refund/printing/local-preference permissions where current order UI exposes those actions.

C4 may centralize Orders-facing capability derivations, but it must not change capability names, fallback semantics, or permission outcomes.

Read-only/hidden action behavior must remain unchanged.

## 20. Visual and interaction invariants

C4 must preserve existing user-observable behavior exactly unless a mechanical file move requires a no-op import adjustment.

Invariants include:

- Cozinha layout and cards/tickets;
- immediate/scheduled queues;
- search behavior;
- finalize confirmation;
- cancellation dialog behavior;
- detail modal behavior;
- printing entry points;
- sound toggle appearance and local preference semantics;
- new-order highlight behavior;
- Histórico filters and details;
- Novo Pedido fields, validation, client quick-create, scheduling controls, totals, payment/modality selection, adjustments, and cancel/return behavior;
- desktop/mobile behavior;
- light/dark themes.

Any user-observable difference found in staging is a regression unless separately approved.

## 21. Architecture enforcement

`npm run test:architecture` must be extended so the new Orders boundary cannot silently erode.

At minimum, architecture checks should reject:

1. `App.jsx` importing deep `domains/orders/**` internals instead of the public index;
2. Settings importing `domains/orders/infrastructure/**` directly;
3. application/runtime consumers importing Orders UI/internal domain files by deep path;
4. Orders importing legacy order-specific files that should have been migrated and removed;
5. new Orders-owned lifecycle endpoints being reintroduced into `src/api/client.js`;
6. Orders taking direct ownership of C5/C6/C7/C8/C9 modules prematurely;
7. new compatibility facades/reexports at legacy Orders paths without a documented compatibility-ledger exception.

The gate should enforce architecture without blocking legitimate shared primitives or explicit external ports.

## 22. Testing strategy

C4 uses strict TDD for behavioral boundaries and characterization tests before risky extraction.

### 22.1 Characterization coverage before moves

Before relocating high-risk behavior, tests must pin current semantics for:

- immediate orders;
- scheduled orders;
- shared 50-minute timing behavior;
- preparing/scheduled queue ordering;
- late state;
- finished-today counts;
- order search;
- lifecycle classification;
- payment eligibility from Orders surfaces;
- order creation idempotency lifecycle;
- New Order dirty/discard semantics;
- stale/superseded New Order owner behavior;
- New Order opened from Orders versus Comandas;
- return destination after cancel/create;
- finalize order;
- cancel order, including refund-now permission boundary;
- Histórico filtering/details;
- arrival detection;
- duplicate-alert suppression;
- temporary highlight lifecycle;
- sound-enabled and sound-disabled behavior;
- capability/read-only boundaries;
- operations/modalities policy adapter behavior;
- cancellation-reasons policy adapter behavior.

### 22.2 RED/GREEN discipline

For each extracted behavior:

1. write or relocate a test that fails against the intended new boundary where relevant;
2. make the smallest implementation move to satisfy it;
3. keep existing regression tests green;
4. only then remove the old implementation/path.

Mechanical file moves still require focused regression evidence before and after import rewiring.

### 22.3 Focused and full gates

Before C4 is considered staging-ready, run:

- focused Orders domain/application/UI tests;
- focused Settings policy tests for operations/cancellations;
- navigation/New Order guard tests;
- runtime synchronization tests;
- printing integration regressions used by order surfaces;
- `npm test`;
- `npm run test:architecture`;
- `npm run lint`;
- `npm run build`;
- `npm run d1:migrate:local`;
- `git diff --check`;
- targeted diff audit for Worker/migrations/printing/finance/table-service ownership.

No green claim is made without fresh command evidence.

## 23. Staging and manual homologation

C4 requires a manual staging deployment from the exact executable branch HEAD after automated gates pass.

Manual homologation should cover, proportionally:

### Cozinha

- initial active/scheduled queues;
- new order appears through the existing synchronization cadence;
- one sound notification per eligible arrival when enabled;
- no sound when disabled;
- temporary new-order highlight;
- search;
- details;
- finalize;
- cancel;
- payment entry point still opens correctly;
- print entry points still work as before.

### Novo Pedido

- open from normal Orders flow;
- dirty navigation guard;
- discard/cancel;
- create immediate order;
- create scheduled order;
- modality/default settings;
- payment options;
- adjustment permissions;
- quick-create client entry point;
- open from Comandas with table context;
- correct return to Comandas;
- duplicate/stale submit protection where safely reproducible.

### Histórico

- filters;
- details;
- finalized/cancelled presentation;
- cancellation from history where allowed;
- payment/printing entry points;
- analysis visibility/capabilities.

### Settings

- Operação save/cancel;
- Modalidades shared draft behavior;
- navigation between Operação and Modalidades remains prompt-free while sharing one resource;
- cancellation reasons edit/save/cancel;
- conflict/retry behavior where safely reproducible.

### Visual matrix

Where the extraction touches import/component boundaries, verify desktop/mobile and light/dark for Cozinha, Novo Pedido, Histórico, and the affected Settings screens.

Blocked manual scenarios remain BLOCKED; automated evidence is complementary and must not be relabeled as manual PASS.

## 24. Diff and release safety

Before merge authorization, verify:

- no unintended Worker changes;
- no migration changes;
- no QZ/printing-runtime refactor;
- no Finance-domain extraction;
- no Table Service extraction;
- no Customers/Catalog extraction beyond external contracts needed by New Order;
- no production workflow change;
- no production deployment.

Staging remains manual `workflow_dispatch` unless an exact-branch trigger is separately approved.

Production requires a separate explicit authorization after merge and post-merge validation; C4 merge authorization is not production authorization.

## 25. Acceptance criteria

C4 is ready for merge authorization only when all of the following are true:

1. `domains/orders` exists with clear domain/application/infrastructure/ui ownership;
2. non-Orders consumers use the Orders public boundary rather than deep imports;
3. official `orders` state remains central-runtime-owned;
4. C1 polling/sync semantics are preserved;
5. New Order draft lifecycle no longer lives in `App.jsx`;
6. order arrival/highlight/sound execution no longer lives in `App.jsx`;
7. Orders lifecycle API endpoints are Orders-owned;
8. Finance/Table Service/Printing endpoints remain with their scheduled owners;
9. operations/modalities and cancellation-reasons policy adapters are Orders-owned;
10. Settings UI continues to work through public policy contracts;
11. shared timing remains a single cross-runtime source of truth;
12. legacy Orders paths/facades are removed or explicitly documented as blocking debt;
13. architecture gates enforce the new boundary;
14. focused tests and full gates pass with fresh evidence;
15. staging deploy succeeds on the exact executable SHA;
16. proportional manual homologation records zero unexplained C4 regressions;
17. production remains untouched until separately authorized.

## 26. Expected implementation approach

The implementation plan should sequence the extraction so behavior is pinned before ownership changes. A likely order is:

1. baseline and characterization tests;
2. create Orders domain/public boundary and move pure rules;
3. move Orders API adapter and inject the read port into central runtime;
4. transfer C3 operations/cancellation policy adapters;
5. extract New Order draft lifecycle/application controller;
6. extract order commands from App;
7. extract Cozinha arrival/highlight/sound behavior;
8. move Orders UI/components and rewire composition through the public index;
9. remove legacy paths/facades;
10. strengthen architecture gates;
11. run full gates, diff audit, staging, and homologation.

The detailed implementation plan may adjust task boundaries after inspecting exact dependencies, but it must preserve the architecture and non-goals defined in this spec.
