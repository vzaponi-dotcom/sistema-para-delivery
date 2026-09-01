# Order Operations Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual multi-stage order statuses with one active `Em preparo` queue and one finalization action per order.

**Architecture:** Keep order state in `App.jsx`, extract pure workflow calculations into `src/utils/orderWorkflow.js`, and make `Orders.jsx` render derived operational groups. Normalize legacy localStorage orders on read so existing prototype data remains usable without migration infrastructure.

**Tech Stack:** React 19, Vite 8, CSS, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-01-order-operations-workflow.md`

## Global Constraints

- Work directly on `master` as explicitly approved by the user.
- Preserve existing localStorage keys.
- New orders start as `Em preparo` automatically.
- Only finalization is manual: `Saiu para entrega` for delivery, `Finalizar` otherwise.
- Delayed means 25 minutes or more; attention means 15–24 minutes.
- Do not add backend/state libraries.
- Keep delete as a secondary corrective action.

---

### Task 1: Order workflow helpers and regression tests

**Files:**
- Create: `src/utils/orderWorkflow.js`
- Create: `src/utils/orderWorkflow.test.js`
- Modify: `package.json`
- Modify: `.github/workflows/validate.yml`

**Interfaces:**
- Produces: `normalizeOrder(order, now)`, `isOrderFinished(order)`, `getElapsedMinutes(order, now)`, `getOrderUrgency(order, now)`, `getFinalActionLabel(order)`, `isFinishedToday(order, now)`.

- [ ] **Step 1: Add Node test script and tests first**

Tests must assert:

```js
assert.equal(getOrderUrgency({ createdAt: iso20MinutesAgo }, now), 'attention')
assert.equal(getOrderUrgency({ createdAt: iso30MinutesAgo }, now), 'delayed')
assert.equal(getFinalActionLabel({ type: 'Entrega' }), 'Saiu para entrega')
assert.equal(getFinalActionLabel({ type: 'Retirada' }), 'Finalizar')
assert.equal(normalizeOrder({ id: 1, status: 'Pendente' }, now).status, 'Em preparo')
assert.equal(isOrderFinished({ finishedAt: now.toISOString() }), true)
```

- [ ] **Step 2: Run CI and verify the tests fail because the helper module is missing**

Expected: GitHub Actions `npm test` step fails before implementation.

- [ ] **Step 3: Implement the pure helpers**

`normalizeOrder` keeps existing order fields, supplies `createdAt` when absent, maps old active statuses (`Pendente`, `Em preparo`, `Pronto`) to `Em preparo`, and treats old final statuses (`Entregue`, `Finalizado`, `Despachado`) as finished.

- [ ] **Step 4: Verify test, lint, and build pass in CI**

Expected: `npm test`, `npm run lint`, and `npm run build` all pass.

### Task 2: Simplify order creation and finalization behavior

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes workflow helpers from Task 1.
- Produces handler `handleFinalizeOrder(orderId)` and derived active/finalized order collections passed to the page.

- [ ] **Step 1: Normalize orders when loading localStorage**

Use `normalizeOrder` on each stored/initial order so legacy data remains compatible.

- [ ] **Step 2: Remove status from the new-order form state and modal**

New order objects must include:

```js
status: 'Em preparo',
createdAt: new Date().toISOString(),
finishedAt: null,
```

- [ ] **Step 3: Add finalization handler**

`handleFinalizeOrder(orderId)` updates only the matching order with:

```js
status: 'Finalizado',
finishedAt: new Date().toISOString(),
```

- [ ] **Step 4: Pass finalization behavior to `Orders`**

Search remains in `App.jsx`; the page receives the filtered collection and callback.

### Task 3: Replace status table with operational queue

**Files:**
- Modify: `src/pages/Orders.jsx`
- Modify: `src/components/StatusBadge.jsx`

**Interfaces:**
- Consumes helper functions and `onFinalizeOrder(orderId)`.

- [ ] **Step 1: Derive active and finished groups**

Active orders are `!isOrderFinished(order)`, sorted oldest first. Finished orders are shown newest first.

- [ ] **Step 2: Render operational summary**

Show three cards/counters: `Em preparo`, `Atrasados`, `Finalizados hoje`.

- [ ] **Step 3: Render active order cards**

Each active card shows order/client/product/type/quantity/total, elapsed minutes, urgency indicator, one primary final-action button, and a secondary delete icon.

- [ ] **Step 4: Render compact finished history**

Finished orders no longer compete visually with active work.

- [ ] **Step 5: Update status badge support**

Ensure `Em preparo` and `Finalizado` have clear semantic styling.

### Task 4: Operational styling and responsive validation

**Files:**
- Modify: `src/App.css`

**Interfaces:**
- Styles the markup introduced by Task 3.

- [ ] **Step 1: Add queue layout and urgency styles**

Normal uses neutral surface, attention uses restrained amber treatment, delayed uses restrained red treatment.

- [ ] **Step 2: Make final action visually dominant**

The finalization button is the obvious workflow action while delete stays secondary.

- [ ] **Step 3: Make the queue responsive**

At narrow widths, order information stacks without page-level horizontal scrolling and the primary action becomes full-width where useful.

- [ ] **Step 4: Verify final CI**

Expected: tests, lint, and build all pass on `master`.

- [ ] **Step 5: Review main workflow manually from code paths**

Verify create order -> active queue -> finalize -> history; delivery label differs from pickup/local; legacy orders still normalize.
