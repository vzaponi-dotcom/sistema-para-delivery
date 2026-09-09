# Scheduled Cancellation and Immediate Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **SUPERSEDED (2026-09-08):** Documento histórico substituído pela arquitetura QZ centralizada. Consulte a spec/plano centralizados de 2026-09-08.

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

### Task 1: Make newly-created scheduled jobs available immediately

**Files:**
- Modify: `worker/orderAutomaticPrintJob.test.js`
- Modify: `worker/repositories.js`
- Regression only: `shared/orderTiming.test.js`

**Interfaces:**
- Consumes: `createOrder(db, businessId, rawInput, now)`, `prepareAutomaticPrintJobStatement(db, businessId, input)`.
- Produces: newly-created automatic order jobs with `available_at === created_at` regardless of `scheduled_for`; no change to `getOperationalStartAt` or kitchen timing helpers.

- [x] **Step 1: Write the failing checkout regression for a scheduled order**

Add to `worker/orderAutomaticPrintJob.test.js`:

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

This proves printing eligibility changes without mutating the customer's requested time.

- [x] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test worker/orderAutomaticPrintJob.test.js
```

Expected before implementation: the new scheduled test fails because `available_at` equals the existing operational start (`scheduled_for - 50 minutes`) rather than `created_at`. Existing tests continue to pass.

- [x] **Step 3: Change only new automatic-job availability in checkout**

In `worker/repositories.js`, the existing creation block is equivalent to:

```js
statements.push(prepareAutomaticPrintJobStatement(db, businessId, {
  orderId,
  copies: primaryPrintStation.defaultCopies,
  document: printDocument,
  createdAt,
  availableAt: getOperationalStartAt({ createdAt, scheduledFor })?.toISOString() || createdAt,
}))
```

Change only the availability argument:

```js
statements.push(prepareAutomaticPrintJobStatement(db, businessId, {
  orderId,
  copies: primaryPrintStation.defaultCopies,
  document: printDocument,
  createdAt,
  availableAt: createdAt,
}))
```

If `getOperationalStartAt` becomes unused in `worker/repositories.js`, remove only that unused import. Do not change `shared/orderTiming.js`.

- [x] **Step 4: Run checkout and timing regressions**

Run:

```bash
node --test worker/orderAutomaticPrintJob.test.js shared/orderTiming.test.js src/utils/kitchenQueue.test.js src/hooks/useKitchenClock.test.js
```

Expected: PASS. In particular, existing timing assertions such as a 12:00 scheduled order beginning operational preparation at 11:10 must remain unchanged.

- [x] **Step 5: Commit Task 1**

```bash
git add worker/repositories.js worker/orderAutomaticPrintJob.test.js
git commit -m "feat: print new scheduled orders immediately"
```

---

### Task 2: Allow scheduled-order cancellation from details

**Files:**
- Modify: `src/pages/OrdersScheduled.test.js`
- Modify: `src/pages/Orders.jsx`
- Regression alignment: `src/pages/OrdersMultiItem.test.js`

**Interfaces:**
- Consumes: existing `setCancelOrder(order)`, `CancelOrderDialog`, `OrderDetail` prop `onRequestCancel`.
- Produces: every active order detail, including a scheduled-waiting order, receives an `onRequestCancel` callback; no edit interface is added.

- [x] **Step 1: Write the failing source-level UI contract**

Add to `src/pages/OrdersScheduled.test.js`:

```js
test('scheduled order details keep cancellation available and do not introduce editing', async () => {
  const source = await read('./Orders.jsx')

  assert.match(source, /<OrderDetail[\s\S]*onRequestCancel=\{\(\) =>/)
  assert.doesNotMatch(source, /isScheduledWaiting\(detailOrder, now\)\s*\?\s*undefined/)
  assert.doesNotMatch(source, /Editar pedido/)
  assert.doesNotMatch(source, /onEditOrder/)
})
```

- [x] **Step 2: Run the focused UI test and confirm RED**

Run:

```bash
node --test src/pages/OrdersScheduled.test.js
```

Expected before implementation: FAIL because `Orders.jsx` contains the `isScheduledWaiting(detailOrder, now) ? undefined : ...` guard.

- [x] **Step 3: Remove only the scheduled-waiting cancellation suppression**

In `src/pages/Orders.jsx`, change:

```jsx
onRequestCancel={isScheduledWaiting(detailOrder, now)
  ? undefined
  : () => {
      setDetailOrder(null)
      setCancelOrder(detailOrder)
    }}
```

to the existing cancellation flow without that guard:

```jsx
onRequestCancel={() => {
  setDetailOrder(null)
  setCancelOrder(detailOrder)
}}
```

If `isScheduledWaiting` becomes unused in this file, remove only that import. Do not add `Editar`, `onEditOrder`, or a new form mode.

- [x] **Step 4: Run the kitchen UI regressions**

Run:

```bash
node --test src/pages/OrdersScheduled.test.js src/pages/OrdersMultiItem.test.js src/utils/kitchenQueue.test.js
```

Expected: PASS. The scheduled card still wires `onCancel={setCancelOrder}`, details now expose cancellation, and queue phase behavior is unchanged.

- [x] **Step 5: Commit Task 2**

```bash
git add src/pages/Orders.jsx src/pages/OrdersScheduled.test.js src/pages/OrdersMultiItem.test.js
git commit -m "feat: allow cancelling scheduled orders from details"
```

---

### Task 3: Lock cancellation effects on automatic print jobs

**Files:**
- Modify: `worker/orderCancellation.test.js`
- Production file reviewed, not expected to change: `worker/orderCancellation.js`

**Interfaces:**
- Consumes: `cancelOrder(db, businessId, orderId, input, now)`.
- Produces: regression contract that cancellation removes only `trigger='automatic' AND status='pending'`; printed history survives; no cancellation job is created.

This is a **characterization/regression task**. The current repository implementation already contains the intended delete statement, so the strengthened test is expected to be GREEN immediately. Do not manufacture a production-code change just to create a RED state. If it fails, diagnose the mismatch before changing production behavior.

- [x] **Step 1: Strengthen the existing print-job cancellation test**

In `worker/orderCancellation.test.js`, replace the existing print-job fixture in `cancellation removes only pending automatic print job` with:

```js
db.printJobs = [
  { business_id: 'biz', order_id: 'o1', trigger: 'automatic', status: 'pending', copies_printed: 0 },
  { business_id: 'biz', order_id: 'o1', trigger: 'manual', status: 'pending', copies_printed: 0 },
  { business_id: 'biz', order_id: 'o1', trigger: 'automatic', status: 'printed', copies_printed: 1 },
]
```

After `cancelOrder(...)`, assert:

```js
assert.deepEqual(db.printJobs.map(({ trigger, status, copies_printed }) => ({ trigger, status, copies_printed })), [
  { trigger: 'manual', status: 'pending', copies_printed: 0 },
  { trigger: 'automatic', status: 'printed', copies_printed: 1 },
])
assert.equal(db.printJobs.length, 2)
assert.equal(db.printJobs.some((job) => job.type === 'cancellation' || job.trigger === 'cancellation'), false)
```

- [x] **Step 2: Run the focused cancellation test**

Run:

```bash
node --test worker/orderCancellation.test.js
```

Expected: PASS on the current implementation. If it fails, stop and inspect the actual delete/job creation behavior; do not broaden cancellation behavior without reconciling it with the spec.

- [x] **Step 3: Confirm no production change is needed**

Review `worker/orderCancellation.js`. The intended statement remains:

```sql
DELETE FROM print_jobs
WHERE business_id = ?
  AND order_id = ?
  AND trigger = 'automatic'
  AND status = 'pending'
```

Do not add any `INSERT INTO print_jobs` for cancellation.

- [x] **Step 4: Commit Task 3**

```bash
git add worker/orderCancellation.test.js
git commit -m "test: lock scheduled cancellation print behavior"
```

---

### Task 4: Block a cancelled order from printing a pending second copy

**Files:**
- Modify: `worker/orderPrintingRepository.test.js`
- Production file reviewed, not expected to change: `worker/orderPrintingRepository.js`

**Interfaces:**
- Consumes: `claimPrintJob`, `claimNextAutomaticPrintJob`, `markPrintJobPrinted`, `loadPrintJob`.
- Produces: regression contract that an automatic job preserved at `printed` with `copiesPrinted=1` cannot be claimed again after its order becomes `Cancelado`.

This is also a characterization/regression task. `claimPrintJob` already contains the automatic-order status guard, so the new regression should be GREEN without production changes. If it is not, diagnose first.

- [x] **Step 1: Add the cancelled-second-copy regression**

Append to `worker/orderPrintingRepository.test.js`:

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

- [x] **Step 2: Run the printing repository tests**

Run:

```bash
node --test worker/orderPrintingRepository.test.js
```

Expected: PASS. This proves a refreshed UI cannot reclaim a second copy after cancellation, while the already-printed first copy remains recorded.

- [x] **Step 3: Run cancellation + printing regressions together**

Run:

```bash
node --test worker/orderCancellation.test.js worker/orderPrintingRepository.test.js
```

Expected: PASS with no production changes in either repository.

- [x] **Step 4: Commit Task 4**

```bash
git add worker/orderPrintingRepository.test.js
git commit -m "test: block second copy after cancellation"
```

---

### Task 5: Full verification, staging deploy, and physical homologation

**Files:**
- Review: `.github/workflows/validate.yml`
- Review/update PR #11 description if implementation details differ from the design
- No production code should be introduced in this task.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: a green feature branch ready for staging, not production.

- [x] **Step 1: Verify branch contains no order-editing or Windows/QZ additions**

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

- [x] **Step 2: Handle the independent RawBT test-print hotfix before staging**

Check PR #10 / `master` status.

If PR #10 is still unmerged, do not cherry-pick or duplicate it into this feature. Keep this feature branch scoped and postpone combined staging until the desired baseline is decided.

If PR #10 has already been merged to `master`, incorporate the latest `master` into this feature branch before staging:

```bash
git fetch origin
git merge --no-ff origin/master
```

Resolve only genuine merge conflicts; do not use `reset`, `restore`, `clean` or `stash` as shortcuts.

- [x] **Step 3: Run the complete local validation gate**

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

- [x] **Step 4: Review the final diff against the spec**

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

- [x] **Step 5: Ensure PR #11 is still draft and CI is green**

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

## Implementation checkpoint — 2026-09-07

Tasks 1–4 are implemented on `feature/scheduled-cancel-immediate-printing` and the full validation gate passed on commit `01e0bbe8a2582fc10002ec615197a47f20a0291f` (Validate application run `34130967916`). The current branch head differs from that verified commit only by removal of the temporary verification workflow; runtime and test files are unchanged.

PR #10 (`hotfix/rawbt-test-print-selected-copy`) remains open and unmerged; `master` remains at `69a026172379ea53bfada0b5d19ff251a7b1a605`. Per the approved plan, the hotfix has not been cherry-picked or duplicated into this feature. Staging is intentionally blocked pending the release-baseline decision for PR #10.

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
# **SUPERSEDED (2026-09-08):** Documento histórico substituído pela arquitetura QZ centralizada. Consulte a spec/plano centralizados de 2026-09-08.
