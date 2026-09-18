# Spec C5 — Table Service Domain Extraction Design

**Date:** 2026-09-18  
**Status:** approved by user; implementation plan written and awaiting user review  
**Program:** Spec C — Frontend modularization  
**Branch:** `feature/spec-c5-table-service`  
**Base/master SHA:** `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`  
**Parent design:** `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`  
**Implementation plan:** `docs/superpowers/plans/2026-09-18-frontend-modularization-c5-table-service-plan.md`

## 1. Purpose

C5 establishes `src/domains/table-service` as the frontend owner for Tables, Comandas, open table-tab identity, table occupancy semantics, comanda selection, table transfer, table-tab detail loading, and table-management commands.

C5 is an architectural extraction. It must preserve current behavior, current visuals, current backend contracts, and the central runtime as the only owner of official synchronized collections.

The slice must materially reduce `src/App.jsx` ownership rather than only relocate UI files.

## 2. Rollout alignment

C5 starts only after C4 has merged.

The approved C5 base is the C4 merge commit:

`a0b4f5dac865ae54ad9bec7086139b280ffda5f4`

C4 evidence carried into this slice:

- PR #48 merged successfully.
- C4 staging: Deploy #181 / run `35303388467` — SUCCESS.
- C4 manual QA: **19 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**.
- C4 post-merge Validate: #1291 / run `35357630853` — SUCCESS on the exact merge commit.
- C4 production deploy: **NO**.

The branch for this slice is:

`feature/spec-c5-table-service`

C6 must not begin before C5 is closed and merged.

## 3. Goals

C5 must:

- create a deliberate public boundary at `src/domains/table-service/index.js`;
- make Table Service the frontend owner of Tables and Comandas;
- make Table Service own canonical comanda selection semantics;
- preserve `tableTabId` as the durable identity of an open comanda;
- preserve table transfer conflict handling and stale-response protection;
- extract table-tab detail loading out of `Comandas.jsx`;
- extract table CRUD/reorder/transfer commands out of `App.jsx`;
- move Table Service-specific HTTP endpoints out of `src/api/client.js`;
- move Table Service-owned UI into `src/domains/table-service/ui/`;
- remove the runtime `onTablesCommitted` compatibility bridge;
- preserve payment and printing as external integrations;
- keep `tables` and `tableTabs` as official runtime collections;
- remove the dead `tableTabs → NewOrderRoute` contract;
- add permanent architecture checks for the new boundary;
- preserve all existing mobile, desktop, light, dark, capability, focus, retry, reconciliation, and error behavior.

## 4. Non-goals

C5 does not:

- redesign Tables or Comandas;
- add new UX;
- add new business rules;
- change Worker routes or response envelopes;
- change D1 schema or migrations;
- introduce a Table Service store or provider;
- create new polling;
- move payment ownership into Table Service;
- modularize payment reconciliation scheduled for C6;
- move print queue, QZ, print jobs, print transport, or printing policy scheduled for C9;
- move order lifecycle rules out of Orders;
- introduce Redux, Zustand, React Router, WebSocket, SSE, or microservices;
- reorganize CSS for aesthetic reasons.

If implementation discovers a backend contract change is actually required, execution must stop and obtain explicit approval rather than silently widening C5.

## 5. Ownership boundary

### 5.1 Table Service owns

C5 owns:

- Tables;
- Comandas;
- `tableTabs` as the table-service identity concept;
- canonical open-comanda identity `{ tableId, tableTabId }`;
- table occupancy interpretation;
- active/inactive table interpretation;
- comanda selection lifecycle;
- table transfer semantics;
- valid transfer destinations;
- table-tab detail loading and identity validation;
- create/rename/activate/deactivate/reorder table commands;
- transfer command preconditions;
- entry from Tables into the exact current comanda;
- emitting the exact comanda identity when adding a new order.

### 5.2 Table Service does not own

C5 does not own:

- order lifecycle;
- New Order draft state;
- financial settlement;
- payment method policy;
- payment reconciliation obligations;
- movement creation;
- print queue state;
- QZ transport;
- print job retry/recovery;
- official bootstrap/polling state;
- session/auth;
- navigation runtime.

Payment and printing are integrations into Table Service UI, not Table Service internals.

## 6. Target structure

The target is:

```text
src/
  domains/
    table-service/
      domain/
      application/
      infrastructure/
      ui/
      index.js

  app/
    surfaces/
      table-service/
        TableServiceExternalActions.jsx
```

Not every internal file name is required to match this design verbatim, but ownership and dependency direction must.

No `TableServiceProvider` is introduced.

## 7. Domain layer

`src/domains/table-service/domain/` contains pure rules only.

It must not import:

- React;
- React DOM;
- UI modules;
- `fetch`;
- browser storage;
- app runtime;
- QZ;
- Finance;
- Orders internals.

The pure rules must cover at least:

- ordering tables by `sortOrder`;
- determining active/inactive state;
- determining free/occupied state;
- finding the table currently holding a specific `tableTabId`;
- resolving a valid open comanda from `{ tableId, tableTabId }`;
- distinguishing "same comanda transferred" from "new comanda reused the same table";
- determining whether a controlled selection is still valid;
- projecting valid transfer destinations;
- validating transfer source identity;
- validating that destination remains active and free.

HTTP conflict handling, refresh, feedback, and retry behavior do not belong in this layer.

## 8. Canonical comanda identity

The canonical selected-comanda shape is:

```js
{
  tableId,
  tableTabId,
}
```

The durable identity is primarily `tableTabId`.

A transfer:

```text
Mesa 1 / tab-A
    ↓
Mesa 5 / tab-A
```

preserves the same comanda.

A reuse:

```text
Mesa 1 / tab-A
    ↓ close
Mesa 1 / tab-B
```

is a different comanda and invalidates the old selection.

Code must never treat `tableId` alone as sufficient identity for an open comanda.

## 9. Application layer

### 9.1 `useComandaSelection`

The Table Service application layer owns controlled selection and its lifecycle.

Conceptually it owns:

- current `selection`;
- selection generation/version;
- selecting a validated comanda;
- clearing selection;
- reconciling against official `tables`;
- following the same `tableTabId` when it moves to a different table;
- invalidating selection when the tab closes, disappears, or is replaced;
- preventing a stale operation from resurrecting retired selection.

The hook/controller receives official runtime data. It does not fetch a second official table collection.

Equivalent official data must not cause unnecessary identity churn.

A transfer of the same `tableTabId` updates `tableId` but is not a new comanda.

A real selection replacement or invalidation advances the generation.

Logout/session reset clears selection and invalidates prior ownership.

### 9.2 `useTableTabDetail`

Table-tab detail loading moves out of the visual `Comandas` component.

The application controller owns:

- initial load;
- loading state;
- retained current detail while a background refresh runs, where current behavior already does so;
- error state;
- retry;
- in-flight/queued refresh protection;
- request ownership;
- stale-result rejection;
- identity validation;
- forwarding current-owner 401 errors through the existing session/error port.

It receives the reconciled `{ tableId, tableTabId }` identity.

A response is accepted only if it still corresponds to the active ownership and the returned detail is an open table tab matching the current identity.

A result for an older tab or older table identity must not update the current detail, show an old error, or expire the session.

Official table changes that are relevant to the selected comanda must preserve the current refresh semantics without spawning uncontrolled duplicate reads.

### 9.3 `useTableServiceCommands`

Table-management and transfer handlers leave `App.jsx`.

The application command layer owns:

- create table;
- rename table;
- activate/deactivate table;
- reorder tables;
- transfer table tab.

It consumes narrow ports such as:

- `getOfficialTables()`;
- `applyOfficialEffects(...)`;
- a refresh/reconcile port where needed after a conflict;
- `writesBlocked`;
- capability flags;
- existing feedback/error ports.

It does not own the official collections.

Successful mutations use authoritative backend results rather than predicting table name, occupancy, order, or table-tab identity locally.

## 10. Runtime boundary

The central operational runtime remains the single official owner of:

- `tables[]`;
- `tableTabs[]`;
- bootstrap;
- polling;
- focus/visibility refresh;
- sync guards;
- official effect application.

C5 must not add another bootstrap or polling loop.

The flow is:

```text
Worker/API
  ↓
OperationalDataRuntime
  ↓
official tables/tableTabs
  ↓
Table Service application
  ↓
Table Service UI
```

Mutation flow is:

```text
Table Service UI
  ↓
Table Service application command
  ↓
Table Service API
  ↓
authoritative backend response
  ↓
applyOfficialEffects
  ↓
runtime updates official collections
  ↓
selection/detail reconcile
```

## 11. Removal of the table-commit bridge

The current runtime bridge:

`onTablesCommitted`

exists to let App-owned comanda selection react whenever official tables are committed.

C5 removes this bridge completely.

The replacement is unidirectional:

```text
official tables[]
  ↓
useComandaSelection(tables)
  ↓
reconciled selection
```

The runtime must not call Table Service behavior as a side effect of committing tables.

At C5 closure, the compatibility ledger must mark the operational data runtime table-commit bridge as removed.

## 12. API ownership

C5 creates:

`src/domains/table-service/infrastructure/tableServiceApi.js`

It owns these existing contracts:

- `createTable`;
- `updateTable`;
- `reorderTables`;
- `transferTableTab`;
- `getTableTabDetail`.

The endpoints remain behaviorally identical:

- create table: current `POST /api/tables`;
- update table: current `PATCH /api/tables/:id`;
- reorder: current `PUT /api/tables/order`;
- transfer: current `POST /api/tables/:sourceTableId/transfer`;
- detail: current `GET /api/table-tabs/:id`.

The transfer request continues to send exactly:

```js
{
  destinationTableId,
  expectedTableTabId,
}
```

The Table Service API uses the existing generic HTTP infrastructure rather than raw `fetch` in UI/application code.

At C5 closure, `src/api/client.js` must no longer export these five Table Service contracts.

## 13. APIs intentionally left for later slices

C5 must not opportunistically migrate:

- `registerTableTabPayment` — C6;
- `getTableTabPrintDocument` — C9;
- `createManualTableTabPrintJob` — C9.

The payment-receipt runtime bridge also remains until C6.

These are deliberate temporary boundaries, not C5 omissions.

## 14. Transfer semantics

Before transfer, application logic validates against official data that:

- the source still exists;
- the source still holds `expectedTableTabId`;
- the source represents an open comanda;
- the destination exists;
- the destination is active;
- the destination is free;
- source and destination differ.

The backend remains authoritative.

A successful result applies returned `tables` and `tableTab` as one official effect, preserving the current semantics.

### 14.1 Identity conflict

For `409 / TABLE_TAB_CHANGED`:

- do not retry automatically;
- refresh/reconcile official data;
- clear or relocate the selection according to the new official snapshot;
- surface the existing API feedback;
- require a new user action before another transfer attempt.

C5 must preserve the current one-request identity protection.

## 15. Tables → Comandas navigation

"Ver comanda" must carry exact current identity:

```js
{
  tableId,
  tableTabId,
}
```

Before navigation/selection, the target is validated against official tables.

A stale click target must not navigate as if it still referred to the old comanda and must never select a replacement tab now occupying the same table.

## 16. Comandas → New Order

Table Service emits the current comanda identity when the user requests an additional order.

The app/navigation composition opens Orders with:

```text
initialTableId = tableId
expectedTableTabId = tableTabId
returnDestination = comandas
```

Orders continues to own:

- the New Order draft;
- the payload;
- order creation;
- the `expectedTableTabId` conflict contract.

Table Service does not import Orders to accomplish this.

## 17. Orders → Table Service dependency direction

The approved domain direction is:

```text
Orders → table-service/index.js
```

for the narrow public contracts Orders actually needs, especially `LocalTableSelector`.

The forbidden direction is:

```text
Table Service → Orders
```

Table Service emits identities/intents upward to app composition instead.

Orders must not deep-import Table Service internals.

## 18. Dead New Order tableTabs contract

The current `NewOrderRoute` wiring still passes `tableTabs`, but the New Order wizard does not use it as a behavior input.

C5 removes:

- the `tableTabs` prop from the New Order route wiring;
- `tableTabsFromBootstrap` from the Orders public/UI route contract;
- characterization tests that exist only to preserve that dead prop.

C5 does **not** remove the official runtime `tableTabs` collection because C6 payment reconciliation still depends on it.

The protected Comandas → New Order flow remains based on:

- `initialTableId`;
- `expectedTableTabId`.

## 19. UI ownership

The following existing owners move into:

`src/domains/table-service/ui/`

- `src/pages/Tables.jsx`;
- `src/pages/Comandas.jsx`;
- `src/components/ComandaDetail.jsx`;
- `src/components/TableTransferDialog.jsx`;
- `src/components/LocalTableSelector.jsx`.

Their domain-specific tests move with them when appropriate.

Generic primitives such as `Button`, `Modal`, `ConfirmationDialog`, `Icon`, `PageHeader`, and generic media-query/browser hooks remain outside Table Service.

## 20. Comandas presentation responsibilities

After extraction, `Comandas` is a presentation/workspace surface.

It may own local visual behavior such as:

- mobile detail open/close;
- focus restoration;
- scroll restoration;
- the immediate button interaction that emits an external intent;
- rendering loading/error/detail states provided by application controllers.

It does not own the external overlay state after that intent is emitted.

It must not own:

- direct HTTP detail loading;
- official selection truth;
- transfer command implementation;
- payment workflow implementation;
- printing workflow implementation.

## 21. Payment and printing external actions

Payment and printing remain external to Table Service.

Table Service UI emits narrow intents such as:

- request payment for the current canonical detail;
- request ticket preview for the current canonical identity;
- request print for the current canonical identity;
- add order for the current canonical identity.

External intents that can outlive the immediate click carry enough ownership metadata to identify the selected comanda, conceptually:

```js
{
  tableId,
  tableTabId,
  selectionGeneration,
}
```

C5 may introduce a small composition surface in:

`src/app/surfaces/table-service/TableServiceExternalActions.jsx`

Its job is to own the external overlay/action state and materialize payment/printing integrations without acquiring Table Service business ownership.

It may compose the existing payment dialog, preview, and printing ports.

Visual results from preview/print/payment UI must be applied only when their captured identity/generation still owns the relevant UI. An accepted financial result must still reconcile globally even if its original visual selection has retired; that stronger payment obligation remains the existing C6-bound workflow.

It must not become a generic system workflow controller.

## 22. Payment preservation until C6

C5 preserves the current table-tab payment behavior and tests.

It must preserve:

- integral comanda payment;
- duplicate-submit blocking;
- accepted payment ownership after UI selection changes;
- reconciliation over `orders + movements + tableTabs + tables`;
- protection from stale collections;
- actionable retry when synchronization cannot be confirmed;
- independent obligations for multiple accepted payments;
- no old-selection success feedback leaking into a replacement selection.

C5 does not remove the payment-receipt runtime bridge.

C6 owns that extraction.

## 23. Printing preservation until C9

C5 preserves:

- "Ver ticket";
- "Imprimir comanda";
- canonical table-tab identity passed to printing;
- duplicate-action suppression;
- late preview/print results not affecting a newer selection;
- retry after printing failure;
- shared overlay scroll-lock behavior.

C5 does not move:

- print queue;
- print jobs;
- QZ;
- transport;
- print recovery;
- printing policy.

Those remain scheduled for C9.

## 24. CSS and visual invariants

C5 does not perform CSS architecture cleanup.

Existing files such as:

- `src/comandas.css`;
- `src/comandas-table-list-polish.css`;
- `src/table-management.css`;
- related existing Table/Comanda styles

remain physically where they are unless a minimal import-path adjustment is required.

The reason is cascade safety.

The following must remain visually equivalent:

- desktop;
- mobile/narrow;
- light theme;
- dark theme;
- empty/free/occupied states;
- read-only/capability states;
- dialogs;
- focus transitions.

CSS relocation may be considered in the final Spec C cleanup slice if still useful.

## 25. Capabilities and write blocking

C5 preserves existing capability behavior.

At minimum:

- table management commands respect `tables.manage`;
- transfer respects `comandas.transfer`;
- opening Comandas respects the existing destination capability;
- adding an order respects existing order-creation capability;
- printing still respects the existing printing capability;
- global `writesBlocked` continues to block mutations.

The domain extraction must not broaden or narrow authorization.

## 26. Error handling and async safety

### 26.1 Table command failure

A failed mutation does not predict or commit unofficial state.

The current feedback/error handling is preserved.

### 26.2 Unauthorized

A current-owner 401 is forwarded through the existing session/error boundary.

A stale 401 from a retired detail request must not expire the current session UI.

### 26.3 Stale detail result

A detail result for an old selection is ignored.

It cannot:

- replace current detail;
- show an old error;
- open an old overlay;
- release the busy state of a newer selection;
- expire the session.

### 26.4 Official table change

Polling/focus/mutation changes are reconciled from official tables.

The same `tableTabId` may move.

A replaced or closed tab invalidates selection.

### 26.5 Logout/session replacement

Selection and ownership generation are invalidated.

Late work from the previous session cannot affect the next session.

## 27. Public Table Service contract

`src/domains/table-service/index.js` is the only supported Table Service import path for code outside that domain.

It exports only deliberate contracts needed by consumers.

Expected categories include:

- Table Service surfaces consumed by app composition;
- `LocalTableSelector` consumed by Orders;
- application hooks/controllers used by composition;
- pure public helpers only when an external consumer actually needs them.

It must not become a blanket `export *` entry point.

Internal Table Service modules may use relative imports without routing through the public index.

## 28. Legacy owner migration

Temporary reexport facades are allowed only while a migration task is in progress and only if needed to keep intermediate commits green.

No C5 legacy owner facade survives the final architecture task.

At closure these paths are physically absent:

- `src/pages/Tables.jsx`;
- `src/pages/Comandas.jsx`;
- `src/components/ComandaDetail.jsx`;
- `src/components/TableTransferDialog.jsx`;
- `src/components/LocalTableSelector.jsx`.

No new logic may be added to a temporary facade.

## 29. Architecture enforcement

The permanent architecture checker must be extended during C5.

It must reject at least:

- external deep imports into `src/domains/table-service/`;
- reappearance of the exact migrated C5 legacy owners;
- reintroduction of the five migrated Table Service API exports in `src/api/client.js`;
- `table-service → orders` imports, including through the Orders public entry;
- cross-domain internal imports already covered by the general checker.

It must permit:

- Orders → `src/domains/table-service/index.js`;
- app composition → `src/domains/table-service/index.js`.

The final checker must make the C5 ownership boundary permanent.

## 30. App.jsx exit criteria

C5 must remove direct Table Service ownership from `App.jsx`.

At closure App must no longer own the implementation of:

- `comandaSelectionRef`;
- `comandaIdentityRef`;
- comanda selection generation logic;
- `resolveOpenComanda`;
- `onTablesCommitted`;
- create-table handler;
- rename-table handler;
- activate/deactivate-table handler;
- reorder-table handler;
- transfer-table-tab handler;
- direct calls to the five migrated Table Service API contracts.

App may still compose:

- runtime data;
- navigation;
- Table Service controllers/surfaces;
- payment workflow ports until C6;
- printing ports until C9.

## 31. Testing strategy

### 31.1 Strict RED → GREEN

Behavioral extraction uses strict TDD.

Each meaningful boundary begins with a test that fails for the intended reason before implementation.

Move-only refactors use characterization tests where current coverage is insufficient.

### 31.2 Pure domain coverage

Tests cover:

- active/free/occupied interpretation;
- sort order;
- exact open-comanda resolution;
- transfer following the same `tableTabId`;
- invalidation on close/replacement/disappearance;
- valid transfer destinations;
- source/destination transfer validation.

### 31.3 Selection controller coverage

Tests prove:

- user selection;
- stable equivalent snapshot;
- transfer to a new table;
- close;
- table reuse with a new tab;
- disappearance/inactivation;
- generation semantics;
- logout/reset;
- stale ownership cannot resurrect selection.

### 31.4 Detail controller coverage

Tests prove:

- loading;
- success;
- error;
- retry;
- current-owner 401;
- stale 401 ignored;
- stale success ignored;
- closed detail rejected;
- mismatched table identity rejected;
- queued/coalesced refresh behavior.

### 31.5 Command coverage

Tests prove:

- create uses authoritative returned tables;
- rename uses authoritative returned tables;
- activate/deactivate uses authoritative returned tables;
- reorder uses authoritative returned tables;
- transfer sends exact captured identity;
- transfer applies returned tables + tableTab;
- conflict does not retry;
- conflict triggers official refresh/reconcile;
- capability/write-blocked actions do not call APIs.

### 31.6 UI regression coverage

Existing Tables/Comandas tests remain evidence for:

- mobile focus;
- back behavior;
- scroll preservation;
- breakpoint transitions;
- accessibility labels;
- dialogs;
- disabled/read-only states;
- printing intents;
- payment intents;
- selection rendering.

### 31.7 Orders integration coverage

Tests prove:

- Orders imports Table Service only through the public index;
- Local table selection still works;
- Comandas → New Order uses `initialTableId + expectedTableTabId`;
- return destination remains Comandas;
- dead `tableTabsFromBootstrap` contract is removed.

### 31.8 Payment regression coverage

Current high-value payment reconciliation tests remain green through C5.

C5 changes their import/wiring expectations only where ownership moved.

### 31.9 Printing regression coverage

Current table-tab preview and printing tests remain green.

C5 changes their composition boundary without changing print semantics.

## 32. Full automated gates

Before staging, the branch must pass the project gate set, including:

- `npm test`;
- `npm run test:architecture`;
- `npm run lint`;
- `npm run build`;
- production Worker dry-run;
- staging Worker dry-run;
- local D1 migrations;
- Spec B D1 clean-install/upgrade validation.

When no local runner is connected, the GitHub `Validate application` workflow on the exact branch SHA is the authoritative remote execution evidence.

No local PASS may be claimed if commands were not actually run locally.

## 33. Manual staging homologation

C5 staging QA must cover at least:

1. Tables — create.
2. Tables — rename.
3. Tables — activate/deactivate.
4. Tables — reorder.
5. Occupied table — Ver comanda.
6. Comandas — open occupied table.
7. Free table — begin New Order.
8. Comanda — Add order.
9. New Order — return to same comanda.
10. Transfer comanda.
11. Selection follows transfer.
12. Transfer conflict / stale identity, if safely reproducible.
13. Closing a comanda clears selection.
14. Reusing the same table does not resurrect the old comanda.
15. Payment still works.
16. Payment synchronization state/retry still works.
17. View ticket still works.
18. Print comanda still works.
19. Capability/read-only behavior.
20. Desktop light/dark.
21. Mobile/narrow light/dark.
22. Mobile focus/back/list behavior.
23. Browser Console has no new C5-attributable runtime error.

Manual results use only:

- PASS;
- FAIL;
- BLOCKED.

Any FAIL stops merge preparation.

A case that cannot be reproduced safely is BLOCKED with an explicit reason, never converted to PASS.

## 34. Compatibility ledger obligations

At C5 start, these compatibility items remain intentional:

- generic/auth `src/api/client.js` reexports → C10 latest;
- payment-receipt runtime bridge → C6;
- table-commit runtime bridge → C5;
- `updateCollection` escape hatch → later Customers/Catalog cleanup, final enforcement C10.

At C5 closure:

- table-commit runtime bridge = removed;
- payment-receipt bridge = still active for C6;
- generic/auth reexports = still tracked;
- `updateCollection` remains only where later slices still need it.

C5 must not broaden any compatibility allowance.

## 35. Diff and release safety

C5 implementation occurs only on `feature/spec-c5-table-service`.

Before any implementation begins:

- verify the remote branch HEAD;
- verify it descends from the approved C5 base;
- reconcile any unexpected branch movement before editing.

C5 normally has no Worker or migration changes.

Before staging, audit:

- `worker/`;
- `migrations/`;
- printing runtime;
- payment workflow;
- Orders internals;
- architecture checker.

Production is not deployed during C5 implementation/homologation.

Production requires separate explicit authorization.

## 36. Acceptance criteria

C5 is complete only when all of the following are true:

- `src/domains/table-service` is the real Table Service owner;
- the public entry point exists and is deliberate;
- pure table/comanda rules have migrated;
- selection ownership is no longer implemented in App;
- table-tab detail HTTP ownership is no longer inside Comandas UI;
- table CRUD/reorder/transfer command ownership is no longer in App;
- `onTablesCommitted` is removed;
- the five approved Table Service APIs are removed from legacy `src/api/client.js`;
- Tables/Comandas/ComandaDetail/TableTransferDialog/LocalTableSelector legacy owner paths are absent;
- Orders consumes Table Service through its public index only;
- Table Service does not import Orders;
- `tableTabsFromBootstrap` and the dead New Order `tableTabs` prop are removed;
- payment C6 behavior remains intact;
- printing C9 behavior remains intact;
- external deep imports into Table Service are permanently rejected;
- no C5 legacy owner facade survives;
- automated gates are green;
- staging deployment succeeds;
- manual QA has 0 FAIL;
- any BLOCKED item is honestly documented;
- final branch HEAD has successful Validate;
- master drift is reconciled before merge;
- production remains untouched;
- merge occurs only after explicit user authorization.

## 37. Expected implementation approach

The implementation plan should decompose the slice into independently reviewable RED/GREEN tasks in this order:

1. public Table Service boundary + pure domain rules;
2. selection controller and removal of the runtime table-commit bridge;
3. detail controller;
4. Table Service API ownership;
5. table-management and transfer commands;
6. Table Service UI migration;
7. external payment/printing composition;
8. Orders integration cleanup;
9. final C5 architecture enforcement and legacy-owner removal;
10. full QA, staging, manual homologation, documentation, and merge gate.

The implementation plan must preserve frequent commits and must not combine unrelated boundaries only to reduce task count.

No implementation begins until this written spec is reviewed and approved, followed by a separately written implementation plan.
