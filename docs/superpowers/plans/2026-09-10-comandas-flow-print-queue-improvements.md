# Comandas Flow and Print Queue Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start table-origin orders at products, refresh comandas silently, and queue one-copy consolidated comanda prints.

**Architecture:** Preserve the existing NewOrder and Comandas boundaries, adding only an initial-step decision and separate initial/background loading state. Extend the central print job model with a `table-tab` identity, create jobs from the canonical server document, and let the existing QZ executor render that snapshot.

**Tech Stack:** React 19, Node test runner, Cloudflare Worker, D1/SQLite, QZ Tray.

**Spec:** `docs/superpowers/specs/2026-09-10-comandas-flow-print-queue-improvements-design.md`

## Global Constraints

- A consolidated comanda job always requests exactly 1 copy.
- The requesting browser does not need QZ or a configured printer.
- Automatic order printing and normal NewOrder entry points retain existing behavior.
- Deploy only to staging; production remains untouched.

---

### Task 1: Order entry and stable refresh

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/pages/Comandas.jsx`
- Test: `src/pages/NewOrder.test.js`
- Test: `src/pages/Comandas.test.js`

**Interfaces:**
- Consumes: `initialTableId`, `NEW_ORDER_STEPS.PRODUCTS`, current comanda detail polling.
- Produces: NewOrder initialized at products for table context; first-load-only loading indicator.

- [ ] **Step 1: Write failing UI tests** asserting table-origin initialization renders the products step and a deferred background refresh keeps the loaded detail/actions visible without `Atualizando comanda`.
- [ ] **Step 2: Run `node --test src/pages/NewOrder.test.js src/pages/Comandas.test.js`** and confirm both new assertions fail for the intended behavior.
- [ ] **Step 3: Initialize `currentStep` and `maxReachedStep` from `initialTableId`, and track initial loading separately from silent refreshing.** Keep error/retry behavior when no detail has ever loaded.
- [ ] **Step 4: Run the focused UI tests** and confirm they pass.

### Task 2: Persist and create consolidated print jobs

**Files:**
- Create: `migrations/0022_table_tab_print_jobs.sql`
- Modify: `worker/orderPrintingRepository.js`
- Modify: `worker/orderPrintingApi.js`
- Modify: `worker/index.js`
- Test: `worker/orderPrintingMigration.test.js`
- Test: `worker/orderPrintingRepository.test.js`
- Test: `worker/tableTabRoutes.test.js`

**Interfaces:**
- Produces: `createManualTableTabPrintJob(db, businessId, { tableTabId, document })`; `POST /api/table-tabs/:id/print-jobs -> { job }` with status 201.

- [ ] **Step 1: Write failing persistence and HTTP tests** for `type: 'table-tab'`, one copy, immutable canonical snapshot, tenant/open-tab validation, and existing-row migration preservation.
- [ ] **Step 2: Run the focused worker tests** and confirm failures are caused by the missing schema/repository/route behavior.
- [ ] **Step 3: Add migration 0022 and the minimal repository/API route implementation.** Route construction must reuse `loadOpenTableTabDetail` and `createTableTabPrintDocument`.
- [ ] **Step 4: Run the focused worker tests** and confirm they pass.

### Task 3: Claim and display comanda jobs

**Files:**
- Modify: `worker/orderPrintingCentralClaim.js`
- Modify: `worker/orderPrintingRepository.js`
- Modify: `src/pages/PrintQueue.jsx`
- Modify: `src/pages/printQueueDetails.js`
- Modify: `src/pages/printQueueQuery.js`
- Test: `worker/orderPrintingCentralClaim.test.js`
- Test: `worker/orderPrintingRecovery.test.js`
- Test: `worker/orderPrintingQueueList.test.js`
- Test: `src/pages/PrintQueue.test.js`

**Interfaces:**
- Consumes: a pending manual `table-tab` job with a canonical document.
- Produces: primary-station claim and queue identity `Comanda #<number>` / table name.

- [ ] **Step 1: Write failing queue tests** proving central/recovery claim can select a table-tab job and the UI displays its comanda/table identity without changing order rows.
- [ ] **Step 2: Run the focused queue tests** and confirm the intended failures.
- [ ] **Step 3: Generalize manual claim/recovery predicates and derive table-tab display/sort/search values from the job identity/document.** Keep automatic eligibility, reprint, and second-copy rules order-only.
- [ ] **Step 4: Run the focused queue tests** and confirm they pass.

### Task 4: Submit from Comandas and verify

**Files:**
- Modify: `src/api/client.js`
- Modify: `src/printing/usePrintingManager.js`
- Test: `src/api/tableTabClient.test.js`
- Test: `src/printing/usePrintingManager.test.js`
- Test: `src/pages/Comandas.test.js`

**Interfaces:**
- Produces: `createManualTableTabPrintJob(tableTabId)` client helper; `printing.printTableTab(tableTabId)` returns the queued job response.

- [ ] **Step 1: Write failing client/manager tests** asserting one POST to `/api/table-tabs/:id/print-jobs`, no direct QZ call, duplicate-click suppression, and visible feedback.
- [ ] **Step 2: Run the focused client/manager/Comandas tests** and confirm failures are due to local-print behavior.
- [ ] **Step 3: Replace direct local printing with the queue API helper** and change success copy to `Comanda enviada para a fila de impressão`.
- [ ] **Step 4: Run all focused tests**, then `npm test`, `npm run lint`, and `npm run build`.
- [ ] **Step 5: Commit and deploy only to staging** after verification, applying migration 0022 to the staging D1 database before the Worker deployment.
