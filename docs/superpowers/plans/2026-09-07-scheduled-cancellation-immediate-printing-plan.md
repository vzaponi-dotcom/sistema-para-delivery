# Scheduled Cancellation and Immediate Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make newly-created scheduled orders eligible for automatic printing immediately while keeping them operationally scheduled until the existing 50-minute window, and allow those waiting scheduled orders to be cancelled from their detail view without introducing order editing.

**Architecture:** Keep printing eligibility and kitchen timing as separate concerns. New automatic print jobs will use `created_at` as `available_at`, while `scheduled_for` and `operational_start_at` continue to drive kitchen grouping, sound and lateness. Cancellation continues through the existing order-cancellation domain flow; the frontend only removes the condition that hides cancellation from scheduled-order details, while backend regression tests lock the existing pending-job deletion and cancelled-order claim protections.

**Tech Stack:** React 19, Vite, Node.js test runner (`node:test`), Cloudflare Workers, D1/SQLite-compatible repositories, GitHub Actions, Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-07-scheduled-cancellation-immediate-printing-design.md`

## Global Constraints

- Work only on `feature/scheduled-cancel-immediate-printing`; do not work directly on `master`.
- No production deploy during implementation. Staging and physical homologation are required before any production proposal.
- No Windows/QZ code in this release; preserve the Android/RawBT production path.
- No order-editing endpoint, button, wizard mode or financial edit workflow.
- Do not add a database migration or backfill existing `print_jobs.available_at` values.
- Only automatic jobs created after this code is running get immediate availability.
- Preserve the 50-minute operational window for kitchen phase, sound, timers and lateness.
- Preserve two-copy behavior: first copy automatic, second copy explicit on the same job.
- Cancellation must not create a cancellation print job or ticket.
- `hotfix/rawbt-test-print-selected-copy` / PR #10 remains a separate release concern. Do not duplicate that hotfix inside these feature commits. Before staging this feature, if PR #10 has been merged to `master`, incorporate the latest `master` into this branch and rerun the complete gate.

---

## File Structure

No new runtime modules are required. The implementation should stay inside the existing responsibilities:

- `worker/repositories.js` — checkout persistence and construction of new automatic print jobs.
- `worker/orderAutomaticPrintJob.test.js` — checkout-level contract for automatic print-job creation and availability.
- `src/pages/Orders.jsx` — kitchen-page wiring for details and cancellation actions.
- `src/pages/OrdersScheduled.test.js` — source-level UI contract for scheduled-order actions.
- `worker/orderCancellation.test.js` — cancellation effects on pending/printed automatic jobs.
- `worker/orderPrintingRepository.test.js` — claim protection for cancelled automatic jobs, including a pending second copy.
- Existing timing tests (`shared/orderTiming.test.js`, `src/utils/kitchenQueue.test.js`, `src/hooks/useKitchenClock.test.js`) remain the source of truth for the 50-minute operational behavior and are run as regression gates; they should not require production changes.

---

### Task 1: Make new scheduled automatic jobs immediately available

**Files:**
- Modify: `worker/orderAutomaticPrintJob.test.js`
- Modify: `worker/repositories.js` in `createOrder(...)`, where `prepareAutomaticPrintJobStatement(...)` receives `availableAt`

**Interfaces:**
- Consumes: `createOrder(db, businessId, input, now)` and `prepareAutomaticPrintJobStatement(db, businessId, input)`.
- Produces: for every newly-created current order that qualifies for automatic printing, `print_jobs.created_at === print_jobs.available_at === createdAt`, including when `scheduled_for` is in the future.
- Preserves: `orders.scheduled_for` and all existing operational timing helpers; this task does not change kitchen phase logic.

- [ ] **Step 1: Add a failing scheduled-order availability test**

Append a checkout-level test in `worker/orderAutomaticPrintJob.test.js` using the existing `seed()` and `input()` helpers:

```js
test('new scheduled order is printable immediately while keeping its scheduled time', async () => {
  const db = seed()
  const now = new Date('2026-09-03T12:00:00.000Z')
  const scheduledFor = '2026-09-03T16:00:00.000Z'

  const order = await createOrder(db, 'amor-e-sabor', input({
    idempotencyKey: 'scheduled-immediate-print',
    scheduledFor,
  }), now)

  const jobs = db.all(`SELECT created_at, available_at FROM print_jobs WHERE order_id = '${order.id}'`)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].created_at, now.toISOString())
  assert.equal(jobs[0].available_at, now.toISOString())
  assert.equal(order.scheduledFor, scheduledFor)
})
```

Keep the existing tests for current orders, idempotency, disabled automatic printing, no primary station and backdated orders unchanged.

- [ ] **Step 2: Run only the checkout printing contract and verify RED**

Run:

```bash
node --test worker/orderAutomaticPrintJob.test.js
```

Expected: the new scheduled-order test fails because current production code stores `available_at` at the operational start instead of `created_at`; all pre-existing tests remain green.

- [ ] **Step 3: Implement the minimal availability change**

In `worker/repositories.js`, change only the automatic print-job construction inside `createOrder(...)`.

Current behavior:

```js
statements.push(prepareAutomaticPrintJobStatement(db, businessId, {
  orderId,
  copies: primaryPrintStation.defaultCopies,
  document: printDocument,
  createdAt,
  availableAt: getOperationalStartAt({ createdAt, scheduledFor })?.toISOString() || createdAt,
}))
```

Target behavior:

```js
statements.push(prepareAutomaticPrintJobStatement(db, businessId, {
  orderId,
  copies: primaryPrintStation.defaultCopies,
  document: printDocument,
  createdAt,
  availableAt: createdAt,
}))
```

If `getOperationalStartAt` is no longer referenced anywhere else in `worker/repositories.js`, remove only that now-unused import:

```js
import { getOperationalStartAt } from '../shared/orderTiming.js'
```

Do not change `shared/orderTiming.js`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test worker/orderAutomaticPrintJob.test.js
```

Expected: all tests in the file pass, including:

- current order creates one automatic job;
- scheduled order gets `available_at = created_at`;
- same idempotency key still creates one job;
- auto-print disabled or no primary station creates no job;
- backdated order creates no automatic job.

- [ ] **Step 5: Run timing regressions to prove printing did not move the kitchen window**

Run:

```bash
node --test shared/orderTiming.test.js src/utils/kitchenQueue.test.js src/hooks/useKitchenClock.test.js
```

Expected: PASS with no production changes in timing files.

- [ ] **Step 6: Commit Task 1**

```bash
git add worker/repositories.js worker/orderAutomaticPrintJob.test.js
git commit -m "feat: print new scheduled orders immediately"
```

---

### Task 2: Allow cancellation from scheduled-order details

**Files:**
- Modify: `src/pages/OrdersScheduled.test.js`
- Modify: `src/pages/Orders.jsx`

**Interfaces:**
- Consumes: existing `setCancelOrder`, `CancelOrderDialog`, `onCancelOrder`, and `OrderDetail` prop `onRequestCancel`.
- Produces: scheduled orders waiting outside the operational window expose `Cancelar` on the card and `Cancelar pedido` through `OrderDetail`.
- Preserves: no `Editar pedido` action and no new mutation API.

- [ ] **Step 1: Add a failing details-action contract**

Add this test to `src/pages/OrdersScheduled.test.js`:

```js
test('scheduled order details keep cancellation available and do not introduce editing', async () => {
  const source = await read('./Orders.jsx')

  assert.match(source, /<OrderDetail[\s\S]*onRequestCancel=\{\(\) =>/)
  assert.doesNotMatch(source, /isScheduledWaiting\(detailOrder, now\)\s*\?\s*undefined/)
  assert.doesNotMatch(source, /Editar pedido/)
  assert.doesNotMatch(source, /onEditOrder/)
})
```

Also preserve the existing test that the scheduled `KitchenTicket` block has `onCancel={setCancelOrder}`.

- [ ] **Step 2: Run the focused UI test and verify RED**

Run:

```bash
node --test src/pages/OrdersScheduled.test.js
```

Expected: the new test fails because `Orders.jsx` currently sets `onRequestCancel={undefined}` while `isScheduledWaiting(detailOrder, now)` is true.

- [ ] **Step 3: Remove only the scheduled-details cancellation suppression**

In `src/pages/Orders.jsx`, replace:

```jsx
{detailOrder && <OrderDetail
  order={detailOrder}
  currency={currency}
  printing={printing}
  printJob={detailPrintJob}
  onClose={() => setDetailOrder(null)}
  onRequestCancel={isScheduledWaiting(detailOrder, now)
    ? undefined
    : () => { setDetailOrder(null); setCancelOrder(detailOrder) }}
/>}
```

with the same detail wiring but an unconditional existing cancellation action:

```jsx
{detailOrder && <OrderDetail
  order={detailOrder}
  currency={currency}
  printing={printing}
  printJob={detailPrintJob}
  onClose={() => setDetailOrder(null)}
  onRequestCancel={() => { setDetailOrder(null); setCancelOrder(detailOrder) }}
/>}
```

Then remove this import if it is no longer used in the file:

```js
import { isScheduledWaiting } from '../../shared/orderTiming.js'
```

Do not change `OrderDetail.jsx` or `CancelOrderDialog.jsx` unless the focused test exposes a pre-existing contract mismatch.

- [ ] **Step 4: Run focused scheduled UI tests and verify GREEN**

Run:

```bash
node --test src/pages/OrdersScheduled.test.js src/components/KitchenTicket.test.js src/components/CancelOrderDialog.test.js
```

Expected: PASS. Card cancellation remains present, detail cancellation is no longer hidden, and no edit action exists.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/pages/Orders.jsx src/pages/OrdersScheduled.test.js
git commit -m "fix: allow cancelling waiting scheduled orders"
```

---

### Task 3: Lock cancellation behavior for immediate print jobs

**Files:**
- Modify: `worker/orderCancellation.test.js`
- Production file reviewed but not expected to change: `worker/orderCancellation.js`

**Interfaces:**
- Consumes: `cancelOrder(db, businessId, orderId, input, now)`.
- Produces: regression proof that cancelling an active scheduled order removes only a still-pending automatic job, preserves already-printed history and creates no cancellation print job.
- Preserves: existing paid-order refund behavior.

This is a characterization/regression task. The inspected production implementation already performs the required delete:

```sql
DELETE FROM print_jobs
WHERE business_id = ?
  AND order_id = ?
  AND trigger = 'automatic'
  AND status = 'pending'
```

Therefore the new tests are expected to be GREEN immediately. Do not manufacture a production change just to create a RED state.

- [ ] **Step 1: Strengthen the existing pending/printed cancellation test**

Extend `cancellation removes only pending automatic print job` so it models the two-copy state explicitly:

```js
db.printJobs = [
  { business_id: 'biz', order_id: 'o1', trigger: 'automatic', status: 'pending', copies_printed: 0 },
  { business_id: 'biz', order_id: 'o1', trigger: 'manual', status: 'pending', copies_printed: 0 },
  { business_id: 'biz', order_id: 'o1', trigger: 'automatic', status: 'printed', copies_printed: 1 },
]
```

After `cancelOrder(...)`, assert that:

```js
assert.deepEqual(db.printJobs.map(({ trigger, status, copies_printed }) => ({ trigger, status, copies_printed })), [
  { trigger: 'manual', status: 'pending', copies_printed: 0 },
  { trigger: 'automatic', status: 'printed', copies_printed: 1 },
])
```

This proves a printed `1/2` automatic job remains only as technical history rather than being replaced by a cancellation ticket.

- [ ] **Step 2: Add an explicit no-cancellation-ticket assertion**

In the same test, capture the count after cancellation and assert no new print job was appended:

```js
assert.equal(db.printJobs.length, 2)
assert.equal(db.printJobs.some((job) => job.type === 'cancellation' || job.trigger === 'cancellation'), false)
```

- [ ] **Step 3: Run the cancellation domain test**

Run:

```bash
node --test worker/orderCancellation.test.js
```

Expected: GREEN on current implementation. If this test fails, stop and use `superpowers:systematic-debugging`; a failure means the inspected cancellation behavior does not match the approved design and this plan must be corrected before production code is changed.

- [ ] **Step 4: Confirm no production diff was created by this task**

Run:

```bash
git diff -- worker/orderCancellation.js
```

Expected: empty output.

- [ ] **Step 5: Commit Task 3**

```bash
git add worker/orderCancellation.test.js
git commit -m "test: lock scheduled cancellation print behavior"
```

---

### Task 4: Prevent any second-copy claim after cancellation

**Files:**
- Modify: `worker/orderPrintingRepository.test.js`
- Production file reviewed but not expected to change: `worker/orderPrintingRepository.js`

**Interfaces:**
- Consumes: `claimPrintJob(...)`, `claimNextAutomaticPrintJob(...)`, `markPrintJobPrinted(...)`, `loadPrintJob(...)`.
- Produces: regression proof that an automatic job already at `printed`, `copiesPrinted = 1`, `copiesRequested = 2` cannot be reclaimed after its order becomes `Cancelado`.
- Preserves: normal explicit second-copy claim for non-cancelled orders.

The inspected repository already protects automatic claims with:

```sql
trigger <> 'automatic'
OR EXISTS (
  SELECT 1 FROM orders
  WHERE orders.id = print_jobs.order_id
    AND orders.business_id = print_jobs.business_id
    AND orders.status <> 'Cancelado'
)
```

This task should therefore be test-only unless the focused regression demonstrates otherwise.

- [ ] **Step 1: Add a cancelled-second-copy regression test**

Append to `worker/orderPrintingRepository.test.js` using the existing `makeDb()`, `addStation()`, `addAutomaticJob()` helpers:

```js
test('cancelled automatic order cannot claim its pending second copy', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)
  await addAutomaticJob(db, { id: 'cancelled-second-copy' })

  await claimPrintJob(db, businessA, 'cancelled-second-copy', 'station-a', baseNow)
  const firstCopy = await markPrintJobPrinted(
    db,
    businessA,
    'cancelled-second-copy',
    'station-a',
    1,
    baseNow,
  )
  assert.equal(firstCopy.copiesPrinted, 1)

  db.exec(`UPDATE orders SET status = 'Cancelado' WHERE id = 'o1' AND business_id = '${businessA}'`)

  assert.equal(await claimNextAutomaticPrintJob(db, businessA, 'station-a', baseNow), null)
  await assert.rejects(
    () => claimPrintJob(db, businessA, 'cancelled-second-copy', 'station-a', baseNow),
    (error) => error.code === 'PRINT_JOB_NOT_PENDING',
  )

  const preserved = await loadPrintJob(db, businessA, 'cancelled-second-copy')
  assert.equal(preserved.status, 'printed')
  assert.equal(preserved.copiesPrinted, 1)
})
```

- [ ] **Step 2: Run the focused repository test**

Run:

```bash
node --test worker/orderPrintingRepository.test.js
```

Expected: GREEN on current implementation, including the existing non-cancelled two-copy tests.

- [ ] **Step 3: Confirm production repository remained unchanged**

Run:

```bash
git diff -- worker/orderPrintingRepository.js
```

Expected: empty output. If the new test fails, diagnose before changing production code because claim protection is already part of the current security boundary.

- [ ] **Step 4: Commit Task 4**

```bash
git add worker/orderPrintingRepository.test.js
git commit -m "test: block second copy after cancellation"
```

---

### Task 5: Full regression gate and release preparation

**Files:**
- Review: `.github/workflows/validate.yml`
- Review/update PR #11 description if implementation details differ from the design
- No production code should be introduced in this task.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: a green feature branch ready for staging, not production.

- [ ] **Step 1: Verify branch contains no order-editing or Windows/QZ additions**

Run:

```bash
git diff origin/master...HEAD -- src worker shared package.json package-lock.json
```

Review the diff and confirm:

- no `updateOrder` full-edit endpoint;
- no `Editar pedido` UI;
- no QZ dependency or QZ transport changes;
- no migration file;
- only the approved printing availability and cancellation UI production changes plus regression tests.

- [ ] **Step 2: Handle the independent RawBT test-print hotfix before staging**

Check PR #10 / `master` status.

If PR #10 is still unmerged, do not cherry-pick or duplicate it into this feature. Keep this feature branch scoped and postpone combined staging until the desired baseline is decided.

If PR #10 has already been merged to `master`, incorporate the latest `master` into this feature branch before staging:

```bash
git fetch origin
git merge --no-ff origin/master
```

Resolve only genuine merge conflicts; do not use `reset`, `restore`, `clean` or `stash` as shortcuts.

- [ ] **Step 3: Run the complete local validation gate**

Run exactly the same commands as `.github/workflows/validate.yml`:

```bash
npm ci
npm test
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
```

Expected: every command exits 0.

- [ ] **Step 4: Review the final diff against the spec**

Verify all of these are true:

```text
new scheduled automatic job: available_at = created_at
existing stored jobs: untouched
scheduled kitchen phase: still driven by operational timing
scheduled card: Cancelar remains
scheduled details: Cancelar pedido is available
order editing: absent
pending automatic job: removed on cancellation
printed automatic job: preserved as history
cancelled automatic job: cannot claim second copy
cancellation print ticket: absent
RawBT transport/bitmap: unchanged
QZ: absent
migration: absent
```

- [ ] **Step 5: Ensure PR #11 is still draft and CI is green**

Push the task commits, then verify the `Validate application` workflow covers:

```text
npm test
npm run lint
npm run build
production Worker dry-run
staging Worker dry-run
local D1 migrations
```

Do not mark the PR ready for merge yet.

- [ ] **Step 6: Deploy only the feature branch to staging**

Use the existing `Deploy staging` workflow with:

```text
branch: feature/scheduled-cancel-immediate-printing
```

Do not run `Deploy production`.

- [ ] **Step 7: Execute physical staging homologation**

On the Android/RawBT primary station:

1. Confirm automatic printing is enabled and the MPT-II is ready.
2. Create a scheduled order sufficiently far beyond the 50-minute operational window.
3. Confirm the order stays under **Agendados**.
4. Confirm first-copy printing starts immediately after creation.
5. Confirm the ticket shows the correct scheduled time, money and Portuguese text.
6. If configured for two copies, confirm the global cut modal appears and the second copy remains explicit.
7. Create another far-future scheduled order and cancel it from the scheduled card before claim if timing permits; confirm it does not print later.
8. Create another far-future scheduled order, open details and confirm **Cancelar pedido** is available.
9. Cancel an order whose first ticket was already printed; confirm it leaves active kitchen operation and no cancellation ticket is printed.
10. If that order was at `1/2`, confirm attempting the second copy after cancellation is blocked by the refreshed state and no automatic second print occurs.
11. Confirm a scheduled order does not move to **Em preparo** merely because it printed; it moves only at the existing operational window.
12. Smoke-test a normal **Agora** order and confirm immediate RawBT printing still works.

- [ ] **Step 8: Stop for explicit user approval**

After staging homologation, report the exact commit SHA, CI run and physical results. Do not merge PR #11 and do not deploy production until the user explicitly approves production.

---

## Self-Review Record

### Spec coverage

- Immediate printing for newly-created scheduled orders: Task 1.
- Existing scheduled jobs remain unchanged/no backfill: Task 1 changes only checkout insertion; Global Constraints and Task 5 explicitly forbid migration/backfill.
- 50-minute kitchen timing remains unchanged: Task 1 timing regression gate and Task 5 physical check.
- Cancellation from scheduled card and details: Task 2.
- No editing: Global Constraints, Task 2 test, Task 5 diff review.
- No cancellation ticket: Task 3.
- Pending automatic job removed: Task 3.
- Printed history retained: Task 3.
- Cancelled order cannot print second copy: Task 4.
- Two-copy workflow preserved: Tasks 3–4 and staging checklist.
- Android/RawBT preserved and Windows/QZ excluded: Global Constraints and Task 5.
- No migration: Global Constraints and Task 5.
- Staging-first and explicit production approval: Task 5.

### Placeholder scan

No `TBD`, `TODO`, “implement later”, unspecified validation, or undefined production interface is used. Test-only characterization tasks explicitly state that no artificial production change should be made when current behavior already satisfies the approved design.

### Type/name consistency

The plan uses the existing names inspected in the repository: `createOrder`, `prepareAutomaticPrintJobStatement`, `cancelOrder`, `claimPrintJob`, `claimNextAutomaticPrintJob`, `markPrintJobPrinted`, `loadPrintJob`, `setCancelOrder`, `onRequestCancel`, `scheduledFor`, `createdAt`, `availableAt`, `copiesPrinted`, and `copiesRequested`.
