# Spec C Frontend Modularization Rollout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the administrative frontend into a modular, domain-oriented architecture while preserving the current UX, business behavior, synchronization semantics, and release safety.

**Architecture:** Keep the Worker/backend contract stable and refactor the frontend incrementally. Central application runtime owns session/bootstrap/synchronization, domain modules own business rules and domain-specific APIs/UI, cross-domain operations live in `app/workflows`, and infrastructure adapters isolate HTTP/browser/QZ details. Each slice is independently testable, staged, homologated, and merged before the next slice starts.

**Tech Stack:** React 19, Vite 8, Node 22 `node:test`, oxlint, Cloudflare Worker/D1, QZ Tray 2.2.6, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`

## Current rollout status — 2026-09-17

- C1 — Runtime central is **RELEASED / COMPLETE** on `master` at `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210` after PR #45, post-merge validation and explicitly authorized production release.
- C2 — Navigation and App composition was merged by PR #46; `master` is now `de24b2ceb807440d4c339200b44ae2ed6583b27a`.
- C2 homologated executable SHA: `882fa7bb3a7bfd3abc3a6ba6a9c58e407da201b8`; Validate application #1213 / run `35139754603` and Manual Deploy staging #178 / run `35141467373` passed. The C2 QA record remains `docs/superpowers/qa/spec-c2-navigation-composition-qa.md`.
- Active slice: **C3 — Settings surface and versioned policy engine**, branch `feature/spec-c3-settings-surface`, executable SHA `17673b66774a1b532fc22972603407dcbb932bad`.
- C3 local gates passed on the executable SHA: `npm test`, `npm run test:architecture`, `npm run lint` (existing warnings only), `npm run build`, and `npm run d1:migrate:local`. The diff audit found no changes under `worker`, `migrations`, or `src/printing`.
- C3 Validate #1216 / run `35176245887` passed on branch HEAD `8b01af19a4f74fd4725394860edd6a85d50d4915`. Manual Deploy staging #179 / run `35176387507` passed on branch HEAD `471d377f973864be6d3037e47a743a02f6a59df0`, including staging login verification. The 23-item manual UI matrix remains blocked because no browser surface is available in this session; production remains untouched and C3 is not ready for merge authorization. Evidence is in `docs/superpowers/qa/spec-c3-settings-surface-qa.md`.
- C3 did not deploy production and was not merged.
- Temporary compatibility bridges inherited from C1 remain tracked in `docs/superpowers/qa/spec-c-compatibility-facades.md`; C3 left no C3 compatibility facade.
- The rollout contracts below are unchanged; this block is execution status only.

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
