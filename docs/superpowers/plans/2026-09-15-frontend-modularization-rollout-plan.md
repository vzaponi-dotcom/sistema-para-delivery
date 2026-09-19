# Spec C Frontend Modularization Rollout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the administrative frontend into a modular, domain-oriented architecture while preserving the current UX, business behavior, synchronization semantics, and release safety.

**Architecture:** Keep the Worker/backend contract stable and refactor the frontend incrementally. Central application runtime owns session/bootstrap/synchronization, domain modules own business rules and domain-specific APIs/UI, cross-domain operations live in `app/workflows`, and infrastructure adapters isolate HTTP/browser/QZ details. Each slice is independently testable, staged, homologated, and merged before the next slice starts.

**Tech Stack:** React 19, Vite 8, Node 22 `node:test`, oxlint, Cloudflare Worker/D1, QZ Tray 2.2.6, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`

## Current rollout status — 2026-09-18

- C1 — Runtime central is **RELEASED / COMPLETE** on `master` at `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`.
- C2 — Navigation and App composition is **MERGED / COMPLETE** by PR #46 at `de24b2ceb807440d4c339200b44ae2ed6583b27a`.
- C3 — Settings surface and versioned policy engine is **MERGED / COMPLETE** by PR #47 at `737beeac2150aabeb39024af823f2f60fee25108`.
- C4 — Orders is **MERGED / COMPLETE** by PR #48 at `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`. Staging #181 / run `35303388467` passed; manual QA closed at **19 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**; final branch Validate #1290 and post-merge Validate #1291 passed. No production deploy occurred.
- C5 — Table Service is **MERGED / COMPLETE** by PR #49 at `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`. Final branch Validate #1341 / run `35400357800` passed; post-merge Validate #1342 / run `35401628448` passed on the exact merge commit. Manual staging QA closed at **22 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**. No production deploy occurred.
- Active slice: **C6 — Finance and cross-domain payment workflows**, branch `feature/spec-c6-finance-workflows`, base `master` `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`.
- C6 written design and implementation plan are **APPROVED**. Implementation is active on `feature/spec-c6-finance-workflows` with draft PR #50.
- C5 Task 1 — public Table Service boundary + pure domain rules — is **COMPLETE / GREEN**. RED `9d247b31e2ff15589eddc84d4da8b3cf96ee91aa` failed Validate #1293 for the intended missing-module reason; GREEN `e8f490808900d56c2c23d6683ed5365da4921b80` passed Validate #1294 with **1,698 tests / 1,697 pass / 0 fail / 1 skipped**.
- C5 Task 2 — controlled comanda selection + runtime table-commit bridge removal — is **COMPLETE / GREEN**. Final fix `1eb0f4b51283ad2f6274720a6eaafa63156fbe00` passed Validate #1298 with **1,702 tests / 1,701 pass / 0 fail / 1 skipped** and all remaining workflow gates green.
- C5 Task 3 — table-tab detail controller — is **COMPLETE / GREEN**. RED `8f460f139845e2288abe1d454d5d83c89643fb7b` failed Validate #1300 for the intended missing-controller reason; GREEN `4fcfff12a3357dfbeb1587142b643a0db55702bf` passed Validate #1306 with **1,712 tests / 1,711 pass / 0 fail / 1 skipped**.
- C5 Task 4 — Table Service API ownership — is **COMPLETE / GREEN**. RED `78d246915eed7847b3db9719e5c2e02137d996c7` failed Validate #1308 for the intended missing `tableServiceApi.js` boundary; GREEN `7ef5fc7a68292e17372bb15a9d23131c38ecfd48` passed Validate #1309 with **1,711 tests / 1,710 pass / 0 fail / 1 skipped** and all remaining workflow gates green.
- C5 Task 5 — table-management and transfer commands — is **COMPLETE / GREEN**. RED `ec27b99d4528d9e0ae4af2eed5d369f04658eeaa` failed Validate #1311 for the intended missing `useTableServiceCommands.js` boundary. GREEN candidate `aab6ca4ccb0461510a65bbb3a079808174229d4d` passed all new command tests but exposed one stale source-contract in `tablesNavigation.test.js`; the test-only alignment commit `44f9b9e0f4410ae909873811fff70b2c5b80f083` passed Validate #1313 with **1,716 tests / 1,715 pass / 0 fail / 1 skipped** and all remaining workflow gates green.
- C5 Task 6 — Tables + LocalTableSelector UI ownership — is **COMPLETE / GREEN**. RED `567bc2c6f93e6769ca920e448af90a0037c57a8e` failed Validate #1315 because the Table Service public entry did not yet export `Tables` / `LocalTableSelector`. The first complete move at `2c7fe92039e3694d676d64dc6681df79a97efc5f` exposed only stale test references to removed legacy paths in Validate #1318. Test-only alignment commits `66007fcf2f30fece36800faf393f78125dd65dde` and `3c9fce53a594de182b7dd34948926a83cf464baa` closed those characterizations; Validate #1320 / run `35384747211` passed with **1,716 tests / 1,715 pass / 0 fail / 1 skipped** and all remaining workflow gates green.
- `Tables` and `LocalTableSelector` now live under `domains/table-service/ui` and are consumed externally only through `domains/table-service/index.js`. The old `src/pages/Tables.jsx`, `src/pages/Tables.test.js` and `src/components/LocalTableSelector.jsx` paths are absent.
- C5 Task 7 — Comandas + ComandaDetail + TableTransferDialog UI ownership — is **COMPLETE / GREEN**. RED `b785f500b677c518f1baea1f8e662468504877e6` failed Validate #1322 because `Comandas` was not yet exported by the Table Service public entry. New owners/public composition landed in `c315a0d20fda5344a4336807f44e547d8115f529`, consumers migrated in `6770d3d83089194ecafe14bf5559f0be1127ef78`, and legacy owners were removed in `d30252ec536ef9bb5945b8b98b0a03b73963316e`. A final path audit found two internal imports plus moved-test references still targeting removed owners; `d040bf730c786af4aea815c1bcdbfb306f4e0b1e` corrected only those paths. Validate #1326 / run `35386530872` passed with **1,716 tests / 1,715 pass / 0 fail / 1 skipped** and all remaining workflow gates green.
- `Comandas` is now public only through `domains/table-service/index.js`; `ComandaDetail` and `TableTransferDialog` are internal Table Service UI owners. The legacy `src/pages/Comandas.jsx`, `src/pages/Comandas.test.js`, `src/components/ComandaDetail.jsx`, `src/components/ComandaDetail.test.js` and `src/components/TableTransferDialog.jsx` paths are absent.
- C5 Task 8 — app-owned payment/printing external actions — is **COMPLETE / GREEN**. RED `c8ed819478fc981ffd5463d976282f48f9c4b0f5` failed Validate #1328 / run `35387492807` for the intended missing `TableServiceExternalActions.jsx` boundary. GREEN candidate `88c3974f349aebface02ccd18f4954b069aceeea` moved payment/preview/print overlay ownership to the app surface but Validate #1329 exposed two stale test contracts; `17f72918fba548186ea8c04ad88c1293c58a987f` reduced that to one residual toast ownership characterization, and `23963386b140c2bea90eaa80c0dc60874fcf025a` closed it. Validate #1331 / run `35388385418` passed with **1,717 tests / 1,716 pass / 0 fail / 1 skipped** and all remaining workflow gates green.
- `Comandas` now emits identity+generation intents only; it no longer imports payment/preview overlays or calls printing ports. `TableServiceExternalActions` owns external visual state with ref-backed stale-result protection. Accepted payment reconciliation remains in App/runtime for C6, and printing API/queue/QZ ownership remains deferred to C9.
- C5 Task 9 — Orders ↔ Table Service route cleanup — is **COMPLETE / GREEN**. RED `1756611e7603991927b45b576637880d06f117a2` failed Validate #1334 / run `35389482528` for the intended reason: the route module still exposed the dead bootstrap table-tab helper. GREEN `8a69d6d6b1643ae865bbf976225bbe46e237fd89` removed that helper/export and the dead `tableTabs` prop from App route wiring while preserving `tables`, `initialTableId` and `expectedTableTabId`. Validate #1335 / run `35389776835` passed with **1,717 tests / 1,716 pass / 0 fail / 1 skipped** and all remaining workflow gates green.
- Runtime `tableTabs` remains intentionally owned by `useOperationalDataRuntime` and consumed by accepted-payment reconciliation for C6; only the dead Orders route prop/helper were removed. Orders continues to consume `LocalTableSelector` through `domains/table-service/index.js` with no deep Table Service import.
- C5 Task 10 — permanent Table Service architecture boundary — is **COMPLETE / GREEN**. RED `b24def5f6cbe29f2e7b0ae8b9d305980a0c44dde` failed Validate #1337 with the intended five failures: external deep import, Table Service → Orders import, legacy C5 owner reappearance, legacy C5 API reintroduction, and an over-broad public entry. GREEN `bf871adb3c21de2cd3c6143214d12a5e825c1bda` extended the architecture checker, added the App extraction contract, and reduced the Table Service public API to exactly six externally consumed contracts. Validate #1338 / run `35391943036` passed with **1,724 tests / 1,723 pass / 0 fail / 1 skipped** and all remaining workflow gates green.
- C5 architecture audits now prove: five legacy UI owner paths absent; five migrated C5 API exports absent from `src/api/client.js`; no Table Service → Orders production imports; no external Table Service deep imports accepted by the checker; and the operational runtime table-commit bridge has no remaining consumer and is formally **REMOVED IN C5**.
- `getTableTabDetail` plus table-management/transfer commands now belong to Table Service. `src/api/client.js` no longer exports `createTable`, `updateTable`, `reorderTables`, `transferTableTab` or `getTableTabDetail`. Payment/printing endpoints remain deferred to C6/C9.
- The operational data runtime table-commit bridge is **REMOVED IN C5**; Task 10 architecture evidence makes the removal permanent.
- The operational data runtime payment-receipt bridge remains scheduled for C6.
- C5 Task 11 staging homologation is **COMPLETE / 0 FAIL** on executable SHA `f0db4d8bc8c17196cd7070e4766363f9d66a8f7b`. Validate #1339 / run `35392353832` passed with **1,724 tests / 1,723 pass / 0 fail / 1 skipped**. Deploy staging #182 / run `35393748126` succeeded on the exact same SHA, including remote migration check/application and real login smoke HTTP 200.
- Manual C5 staging matrix closed at **22 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**. The sole BLOCKED case is capability/read-only behavior because staging exposes only the full-capability PIN session; automated capability tests remain green. Physical printer output was not observed for the print case, but UI feedback and the actual queued print job were verified.
- QA/ledger commit `61bc0461677fd643e7cf07920a81518a6272bbd8` passed final docs-only Validate #1340 / run `35400039611` with **1,724 tests / 1,723 pass / 0 fail / 1 skipped** and all workflow gates green. Its diff audit is clean: **0 trailing-whitespace issues**, **0 worker/migration changes**, and **0 core `src/printing/` changes**.
- C5 final branch HEAD `5c86585e10ad04e36fcb507cbfee7bbc1e84c767` passed Validate #1341 / run `35400357800`, then PR #49 merged to `master` at `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`; post-merge Validate #1342 / run `35401628448` passed all gates. C5 is **MERGED / COMPLETE** and production remains untouched.
- C6 Task 1 — Finance public boundary + payment/finance-category ownership — is **COMPLETE / GREEN**. RED `9476b0b74d7c18305466eb6079314f8b24d8ae00` failed Validate #1344 for the intended missing-module reason. GREEN `2fa0ce1e27e4992d4eb904cce6a85cbb89ea0eaf` passed Validate #1345 / run `35403573350` with **1,729 tests / 1,728 pass / 0 fail / 1 skipped** and all remaining gates green.
- C6 Task 2 — Finance-owned Settings content — is **COMPLETE / GREEN**. RED `bc52cdb8b60e8c79a6390b51b5b973fbe0ee8ef4` failed Validate #1349 for the intended ownership assertions. GREEN candidate `68ba38df6165171686ab91a27550b410df5ba892` moved the editors/model/policies but exposed stale test paths plus a Node-incompatible direct `.jsx` public export in Validate #1350. Fix `1f38c21c56af2d2dda7ed292365c9685b5ce6ad5` introduced the same `.js` surface-wrapper pattern used by Orders/Table Service and aligned stale path tests; Validate #1351 / run `35405016988` passed with **1,731 tests / 1,730 pass / 0 fail / 1 skipped** and all remaining gates green.
- C6 Task 3 — pure Finance rules and receivable projections — is **COMPLETE / GREEN**. RED `8bfc9926e6f9718fb461e41f59ce54a351fd2f8d` failed Validate #1353 for the intended missing-module reason. GREEN `54dcbd1ff44f2dc715a469bc60c78c458ac42318` passed Validate #1354 / run `35406034390` with **1,745 tests / 1,744 pass / 0 fail / 1 skipped** and all remaining gates green. `cashFlow` now owns financial periods, balances, history filters and received-today netting; `receivables` owns pure receivable projections while consuming Orders financial-state predicates by injection, so Finance still has no Orders/Table Service import.
- C6 Task 4 — Finance API/commands/workspace ownership — is **COMPLETE / GREEN**. RED `f5fe1563d871c3cb5135cb06e86be58e80f57877` failed Validate #1356 for the intended missing owners. GREEN candidate `9974799a3440ae9bbe59ba0e80d28c9b70b5112e` moved Finance/MovementDialog/OpeningBalanceDialog and added `financeApi`, `useFinanceCommands`, and `FinanceWorkspace`; Validate #1357 found stale extraction/UI/capability characterizations. `2665e82a97207eb118497b8f3e2cf44cda5ccc39` aligned extraction/UI tests; Validate #1358 left two capability contracts. Final `f76b223245f1a2fcaaf981694d052365e5ca9ffb` aligned those contracts and passed Validate #1359 / run `35408051011` with **1,750 tests / 1,749 pass / 0 fail / 1 skipped** and all remaining gates green. App no longer owns movement/opening-balance state or finance CRUD handlers; Finance emits refund intent without importing Orders.
- C6 Task 5 — Receivables + payment-promise ownership — is **COMPLETE / GREEN**. RED `d26a537cb8d5487a23aa48430e816feadf49cbfb` failed Validate #1361 for the intended missing surface/hook/API method. GREEN candidate `675b66c2746681421b15dfa8bab9383aa7f4d2f6` moved `Receivables` and finance-exclusive supporting UI under `domains/finance`, introduced app-owned `ReceivablesSurface`, and moved payment-promise writes to Orders; Validate #1362 found stale shared test paths/assertions only. Fix `895690be64baa8284b0e5b31dda1969f1f9dadb5` aligned those contracts and passed Validate #1363 / run `35409732928` with **1,755 tests / 1,754 pass / 0 fail / 1 skipped** and all remaining gates green. Finance stays free of Orders imports; the app surface injects Orders presentation/state rules and real `OrderDetail`.
- C6 Task 6 — standalone order-payment workflow — is **COMPLETE / GREEN**. RED `6fba4beac9686a0ecf0053b04a76a56aaeb92581` failed Validate #1365 for the intended missing workflow/API modules. GREEN candidate `bab27fc3d33ffede2be2ab96a91ec94441b7c6e9` moved order payment owner state, race protection, uncertain-result refresh and modal UI to `app/workflows/payments`; Validate #1366 exposed only four stale source characterizations. Test-alignment `c2ece77fe403f72f88c42af9fb060fe1352d5fe3` passed Validate #1367 / run `35411096051` with **1,762 tests / 1,761 pass / 0 fail / 1 skipped** and all remaining gates green. Orders/History/A Receber now open the same workflow; App retains no standalone payment refs or submit handler. Table-tab payment/reconciliation and the runtime payment-receipt bridge remain scheduled for Task 7.

The rollout contracts below are unchanged; this block is execution status only.

## Global Constraints

- Preserve current visual behavior and business behavior; no redesign, new UX, new feature, or deliberate rule change.
- Do not introduce Redux, Zustand, React Router, WebSocket/SSE, or microservices.
- Do not refactor the Worker except for a minimal change required to preserve an existing client contract.
- Keep backend responses as the source of truth; do not create independent official stores per domain.
- Keep current polling semantics until a separately approved change.
- Keep QZ as the active physical transport while isolating it behind printing infrastructure.
- Preserve Spec B settings guarantees: explicit save, optimistic revision, conflict review, unknown-result reconciliation, pending recovery, and abandonment guards.
- Preserve Spec A navigation semantics; React Router remains deferred to Issue #43.
- Users/profiles/authorization redesign remains deferred to Issue #44.
- Kitchen TV remains outside Spec C; `orders` must expose reusable operational rules for that future surface.
- Spec D remains outside Spec C; `catalog` is only prepared as a clean ownership boundary.
- Implementation never happens directly on `master`; each slice uses a fresh branch/worktree from the latest merged `master`.
- Production requires separate explicit authorization.
- Before completing any slice: focused tests, proportional regression tests, `npm test`, `npm run lint`, `npm run test:architecture` once introduced, `npm run build`, `npm run d1:migrate:local`, diff review, staging, and proportional homologation.

---

## 1. Current dependency map — `master` at `af8266549603fc2d392880c812bc1c0d608a6dbc`

### 1.1 Global composition hot spot

`src/App.jsx` (~89 KB) currently owns or coordinates:

- authentication/session lifecycle;
- online/offline state;
- bootstrap and background refresh;
- order-only polling while Cozinha is active;
- official collections: `clients`, `products`, `orders`, `tables`, `tableTabs`, `movements`, `financeSettings`;
- sync guards and official revision tracking;
- effective settings bootstrap/cache handoff;
- navigation guards and pending navigation;
- new-order draft ownership;
- comanda selection identity;
- order/comanda payments and reconciliation;
- client CRUD and duplicate handling;
- product CRUD;
- finance movements/opening balance;
- kitchen sound/arrival highlighting;
- printing prompt/recovery coordination;
- global toasts/success overlays;
- page composition and modal composition.

This file is the primary extraction seam but must not be rewritten in one step.

### 1.2 Existing seams to preserve/reuse

`src/app/` already contains:

- `access.js`;
- `navigation.js` + `navigation.test.js`;
- `queryContext.js` + tests;
- `useQueryContext.js`;
- `useNavigationController.js`;
- `settingsState.js` + tests;
- `settingsConflict.js` + tests;
- `settingsConflictPresentation.js`;
- `settingsPendingStorage.js` + tests;
- `useBusinessSettingsController.js` + tests;
- `usePrintingSettingsController.js`;
- `useEffectiveBusinessConfig.js` + `effectiveBusinessConfig.test.js`.

These are not discarded; later slices relocate them according to ownership.

### 1.3 API concentration

`src/api/client.js` contains generic HTTP plus endpoints for:

- auth/session/bootstrap;
- tables/table tabs;
- clients;
- products;
- orders/cancellation/refunds/payments;
- finance/movements;
- printing jobs/stations/QZ signing.

`src/api/settingsClient.js` separately owns typed settings/effective-config endpoints.

Migration direction:

- generic request mechanics → `src/infrastructure/api/httpClient.js`;
- auth endpoints → `src/infrastructure/auth/sessionApi.js`;
- domain endpoints → each domain's `infrastructure/` directory;
- compatibility reexports remain only while consumers migrate.

### 1.4 Current domain candidates

**Orders**

- `src/pages/Orders.jsx`
- `src/pages/OrderHistory.jsx`
- `src/pages/NewOrderRoute.jsx`
- `src/components/CancelOrderDialog.jsx`
- `src/hooks/useKitchenClock.js`
- `src/utils/orderCart*`
- `src/utils/orderLifecycle.js`
- `src/utils/orderPaymentEligibility.js`
- `src/utils/orderRealtime.js`
- `src/utils/orderWorkflow*`
- shared order timing/display modules used by both client and Worker remain outside `src` when backend sharing requires it.

**Table service**

- `src/pages/Tables.jsx`
- `src/pages/Comandas.jsx`
- `src/components/ComandaDetail.jsx`
- table-tab API functions currently in `src/api/client.js`
- comanda selection/payment ownership currently embedded in `App.jsx`.

**Finance**

- `src/pages/Finance.jsx`
- `src/pages/Receivables.jsx`
- `src/components/MovementDialog.jsx`
- `src/components/OpeningBalanceDialog.jsx`
- `src/utils/finance.js`
- `src/utils/paymentWorkflow*`
- `src/utils/receivables.js`
- `src/utils/paymentMethodOptions.js`
- `src/utils/financeCategoryOptions.js`.

**Customers**

- `src/pages/Clients.jsx`
- `src/components/ClientDuplicateModal.jsx`
- `shared/clientIdentity.js` remains shared with backend if required;
- client API functions and App handlers.

**Catalog**

- `src/pages/Products.jsx`
- `src/components/ProductForm.jsx`
- `shared/productCatalog.js` remains cross-runtime if required;
- product API functions and App handlers.

**Printing**

- `src/pages/PrintQueue.jsx`
- `src/components/PrintingSettings.jsx`
- `src/components/PrintingSettingsContent.jsx`
- `src/printing/*`
- `src/app/usePrintingSettingsController.js`
- printing/QZ endpoints in `src/api/client.js`.

`src/printing/usePrintingManager.js` currently imports `qz-tray` directly and is the main C9 seam.

### 1.5 Composition surfaces

**Settings**

`src/pages/Settings.jsx` currently composes:

- `OperationSettings`;
- `PaymentSettings`;
- `CancellationSettings`;
- `FinanceCategorySettings`;
- printing settings content;
- device preferences/theme;
- typed settings load/save/conflict calls.

Target: `app/surfaces/settings` with policy editors owned by their true domains.

**Dashboard**

`src/pages/Dashboard.jsx` and dashboard chart components remain an application surface that consumes public domain projections.

### 1.6 Shared/runtime utilities

- `src/utils/dataSync.js` contains `createCollectionSyncGuard`, `upsertById`, `upsertManyById`, `removeById` and is directly relevant to C1 runtime extraction.
- `src/app/useEffectiveBusinessConfig.js` already has an independently testable cache/owner model and should remain behaviorally unchanged until C3 ownership cleanup.
- `src/hooks/useMediaQuery.js` is a likely `shared/hooks` candidate.
- CSS remains in current locations until C10 unless a move is mechanically required.

### 1.7 CI/staging state

Current `validate.yml` runs:

1. `npm test`;
2. `npm run lint`;
3. `npm run build`;
4. production Worker dry-run;
5. staging Worker dry-run;
6. `npm run d1:migrate:local`;
7. Spec B D1 clean-install/upgrade gate.

Current `deploy-staging.yml` supports `workflow_dispatch` and has an old automatic push trigger for `feature/spec-b-settings-policies`. Spec C slices must use manual `workflow_dispatch` on the exact branch unless a separately approved exact-branch trigger is added. Do not add a broad `feature/**` staging trigger.

---

## 2. Program execution model

This architecture spans multiple independently reviewable subsystems. Do not execute C1-C10 from one long-lived implementation branch or from a single frozen detailed plan.

For each slice:

1. merge the previous approved slice to `master`;
2. verify latest `master` HEAD and green baseline;
3. create a fresh isolated worktree/branch using `superpowers:using-git-worktrees`;
4. refresh the dependency map for the files touched by that slice;
5. use the detailed slice plan from the current base;
6. execute with strict TDD for behavioral boundaries and characterization tests where extraction risk is high;
7. review, run full gates, deploy staging manually, homologate;
8. merge only after explicit approval;
9. create the next slice plan from the new `master`.

This rollout plan defines slice contracts and acceptance. `C1` has a detailed executable plan now. C2-C10 each require their own detailed plan from the actual post-merge base so exact paths/signatures cannot silently become stale.

---

## 3. Slice contracts

### C1 — Runtime central

**Branch:** `feature/spec-c1-runtime`

**Goal:** Remove session/bootstrap/sync/feedback mechanics from `App.jsx` without moving domain CRUD/workflows yet.

**Primary current files:**

- `src/App.jsx`
- `src/api/client.js`
- `src/utils/dataSync.js`
- `src/app/useEffectiveBusinessConfig.js`
- `src/AppNewOrderGuard.test.js`
- `src/AppReceivablesPromise.test.js`
- `src/actionCapabilities.test.js`
- `package.json`
- `.github/workflows/validate.yml`

**Expected new areas:**

- `src/app/runtime/session/`
- `src/app/runtime/data/`
- `src/app/runtime/feedback/`
- `src/infrastructure/api/`
- `src/infrastructure/auth/`
- `scripts/architecture/`

**Must preserve:** session initialization/login/logout/expiry, bootstrap readiness screens, 5s global refresh semantics, 2s Cozinha order refresh semantics, sync-guard behavior, official collection mutation precedence, current effective-config handoff, request blocking semantics, current App UI.

**Acceptance:** Detailed plan `docs/superpowers/plans/2026-09-15-frontend-modularization-c1-runtime-plan.md` passes all tasks and C1 staging homologation.

### C2 — Navigation and composition

**Branch:** `feature/spec-c2-navigation-composition`

**Goal:** Create `AppRoot`/shell composition and isolate current active-tab navigation without introducing React Router.

**Current files expected to move/refactor:**

- `src/App.jsx` after C1;
- `src/components/AppShell.jsx`;
- `src/components/Sidebar.jsx`;
- `src/components/MobileNavigation.jsx`;
- `src/components/AreaNavigation.jsx`;
- `src/app/navigation.js`;
- `src/app/useNavigationController.js`;
- `src/app/queryContext.js`;
- `src/app/useQueryContext.js`;
- navigation/query tests.

**Target areas:**

- `src/app/shell/`
- `src/app/navigation/`

**Must preserve:** destination IDs, capability fallbacks, mobile `Mais`, new-order return owner/context, settings/new-order discard guards, focus behavior, query continuity, active mobile entry, all Spec A navigation invariants.

**Do not:** change URLs/history semantics or add React Router.

### C3 — Settings surface and versioned policy engine

**Branch:** `feature/spec-c3-settings-surface`

**Goal:** Turn Settings into an application surface while preserving the generic versioned-edit engine and assigning policy ownership to domains.

**Current files expected:**

- `src/pages/Settings.jsx`
- `src/pages/SettingsHome.jsx`
- `src/pages/OperationSettings.jsx`
- `src/pages/PaymentSettings.jsx`
- `src/pages/CancellationSettings.jsx`
- `src/pages/FinanceCategorySettings.jsx`
- settings tests;
- `src/app/settingsState.js`;
- `src/app/settingsConflict.js`;
- `src/app/settingsConflictPresentation.js`;
- `src/app/settingsPendingStorage.js`;
- `src/app/useBusinessSettingsController.js`;
- `src/app/usePrintingSettingsController.js`;
- `src/api/settingsClient.js`.

**Target:** `app/surfaces/settings` + shared application policy-edit engine + domain-owned policy adapters.

**Ownership:** operation/modalities/cancellation → orders; payment methods/categories → finance; printing policy → printing; local device preferences → app/infrastructure.

**Must preserve:** all Spec B save/cancel/conflict/reconcile/read-only/load-failure behavior and light/dark/mobile visuals.

### C4 — Orders

**Branch:** `feature/spec-c4-orders`

**Goal:** Establish `domains/orders` and move New Order, Cozinha, History, lifecycle/timing/search/arrival logic and order API adapter.

**Expected current files:** Orders/NewOrderRoute/OrderHistory pages, order-specific components/hooks/utils, order endpoints from legacy API client.

**Target:** `domains/orders/{domain,application,infrastructure,ui}` + deliberate `domains/orders/index.js`.

**Must preserve:** immediate/scheduled timing, 50-minute rule from shared source, arrivals/sound/highlight semantics, lifecycle status, cancellation/refund entry behavior, payment eligibility, new-order draft ownership, current Kitchen visual behavior.

**Kitchen TV preparation:** expose only pure operational queue/timing contracts needed later; do not implement TV.

### C5 — Table Service

**Branch:** `feature/spec-c5-table-service`

**Goal:** Establish `domains/table-service` for Tables + Comandas + table-tabs and isolate identity/selection/transfer semantics.

**Expected files:** `Tables.jsx`, `Comandas.jsx`, `ComandaDetail.jsx`, table/tab endpoints, App selection refs/handlers still present after earlier slices.

**Must preserve:** table occupancy, current-tab identity, transfer conflict handling, selection generation, stale-response protection, new-order return to Comandas, consolidated print entry points.

### C6 — Finance and cross-domain workflows

**Branch:** `feature/spec-c6-finance-workflows`

**Goal:** Establish `domains/finance` and extract cross-domain payment/refund workflows from App/runtime.

**Expected files:** Finance/Receivables, finance dialogs/utils/APIs, payment method policy adapter, App payment ownership/reconcile refs and handlers.

**Target:** `domains/finance/*` + `app/workflows/payments/*` and refund workflow only where the operation truly crosses domains.

**Must preserve:** accepted-payment reconciliation, stale selection protection, sync status, double-submit prevention, 409 refresh behavior, movement effects, receivables promises, opening balance, refunds.

### C7 — Customers

**Branch:** `feature/spec-c7-customers`

**Goal:** Establish `domains/customers` and remove client CRUD/duplicate orchestration from App.

**Expected files:** `Clients.jsx`, `ClientDuplicateModal.jsx`, client API adapter, App client form/CRUD handlers, customer tests.

**Must preserve:** duplicate phone/name semantics, use-existing flow, create/update/delete behavior, search/sort, current mobile/desktop UI.

### C8 — Catalog

**Branch:** `feature/spec-c8-catalog`

**Goal:** Establish `domains/catalog` for the existing product model only.

**Expected files:** `Products.jsx`, `ProductForm.jsx`, product catalog helpers/API, App product form/CRUD handlers.

**Must preserve:** current categories/presentation behavior, BRL formatting, add/edit/delete behavior, existing layout.

**Do not:** implement Spec D entities or pricing engine.

### C9 — Printing and QZ separation

**Branch:** `feature/spec-c9-printing`

**Goal:** Establish `domains/printing` and make QZ an infrastructure transport adapter.

**Expected files:** all `src/printing/*`, PrintQueue, PrintingSettings components/controller, printing API functions, App prompt/recovery coordination.

**Target:** printing domain/application/infrastructure/UI plus `src/infrastructure/qz/`.

**Must preserve:** primary station, queue-only remote behavior, auto print, 1/2 copies, second-copy prompts, recovery affinity, unknown-result handling, retry/reprint, physical status, QZ security/signing.

**Physical QA:** required proportional hardware round before merge.

### C10 — Closure and cleanup

**Branch:** `feature/spec-c10-architecture-closure`

**Goal:** Remove remaining temporary facades, finish `shared`/infrastructure ownership, perform safe CSS relocation only where justified, and make architectural gates reflect the final target rather than migration allowances.

**Must end with:**

- temporary facade ledger empty;
- no prohibited cross-domain internal imports;
- no domain-layer React/QZ/fetch/browser dependencies;
- QZ imports confined to approved infrastructure;
- legacy API client no longer central;
- AppRoot/App global free of domain CRUD/rules;
- complete gates green;
- final staging homologated;
- architecture audit against the spec recorded.

---

## 4. Architecture gate rollout

Introduce the gate in C1 with rules that can be enforced immediately on new architecture while preserving explicit legacy allowances. Tighten it after every slice.

**C1 initial rules:**

- `src/app/runtime/**` cannot import pages/components with domain-specific UI;
- new `src/domains/**/domain/**` cannot import React, `qz-tray`, `src/infrastructure`, browser storage/DOM modules, or another domain's internals;
- `src/shared/**` cannot import `src/domains/**`;
- QZ imports outside existing legacy printing files and approved `src/infrastructure/qz/**` are rejected;
- maintain an explicit migration allowlist file for known legacy paths, never wildcard the whole `src` tree.

Each slice removes its migrated files from the allowlist. C10 deletes the allowlist or reduces it to documented permanent exceptions.

---

## 5. Temporary facade ledger

Create/maintain `docs/superpowers/qa/spec-c-compatibility-facades.md` during implementation.

Every entry records:

| Old path | New owner/path | Remaining consumers | Removal slice |
|---|---|---|---|

Do not add a facade without adding/removing its ledger row in the same commit.

C10 acceptance requires no temporary rows.

---

## 6. Testing execution strategy

### Development loop

Run the smallest focused test command that proves the changed unit/workflow, for example a direct `node --test` list under the current slice.

### Slice gate

Run focused regression set plus:

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
```

Then inspect the full diff against the slice base.

### CI

Add `npm run test:architecture` to `.github/workflows/validate.yml` after `npm test` and before build. Keep the existing full suite as a required gate.

Do not remove tests merely to reduce runtime. After domain boundaries stabilize, parallelization/caching may be proposed separately without weakening the full integration gate.

---

## 7. Staging/homologation protocol for every slice

1. PR branch has full validation green.
2. Manually dispatch `Deploy staging` selecting the exact Cn branch.
3. Require all existing staging gates: tests, lint, build, local D1, Worker dry-run, remote staging migrations, deploy, real login smoke.
4. Execute the slice-specific manual matrix recorded in its detailed plan.
5. Record run ID, SHA, tested surfaces, and user acceptance in a Cn QA ledger.
6. Merge only after explicit approval.
7. Do not deploy production as part of a normal Cn slice.

---

## 8. Planning checkpoints

Before C2-C10 implementation, create a detailed plan file from the latest merged `master` using `superpowers:writing-plans`. Each detailed plan must:

- cite this rollout plan and the Spec C design;
- refresh actual file paths and current HEAD;
- include exact interfaces/signatures introduced by preceding slices;
- include RED/GREEN test steps for behavioral extractions;
- include exact regression commands;
- include the staging matrix;
- include facade ledger changes;
- include architecture allowlist tightening;
- receive explicit approval before implementation.

This checkpoint is intentional: exact C8/C9 code paths must be based on the code produced by C1-C7, not on guesses frozen before those PRs exist.

---

## 9. Program completion

After C10, run and record:

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
```

Require GitHub validation dry-runs/gates, final staging deployment, and the final manual regression matrix.

Compare final `master` architecture against `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md` and explicitly verify all 18 final success criteria in the spec.

Do not mark Spec C complete solely because `App.jsx` is smaller or files were moved.
