# Print Operational Safety + Issue #36 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Windows/QZ print station fail closed on real physical printer state, count a copy only after a correlated QZ/Winspool `JOB COMPLETE`, recover offline backlog one physical copy at a time, and turn the Print Queue into the operational/paginated panel defined by Issue #36.

**Architecture:** Keep the centralized print queue and single primary Windows/QZ executor. Add durable physical-attempt records and an explicit `awaiting_confirmation` job state so submission risk and spooler confirmation are not conflated. QZ `PRINTER` events drive physical readiness, QZ `JOB` events drive attempt completion, and persisted station recovery state gates the automatic consumer. The Print Queue stops consuming an in-memory history list and reads backend-paginated operational/recent views plus summary counts.

**Tech Stack:** React 19, JavaScript/ES modules, Node `node:test`, Cloudflare Worker, Cloudflare D1/SQLite, QZ Tray 2.2.6, Vite, oxlint, Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-09-print-operational-safety-issue-36-design.md`

**Issue:** GitHub #36 — “Transformar fila de impressão em painel operacional com paginação e ordenação”.

## Global Constraints

- Work only on an isolated implementation worktree/branch based on `feature/print-operational-safety-issue-36`; do not work directly on `master`.
- Use strict TDD for every behavior change: failing focused test first, minimum production change, focused test green, then refactor.
- Do not deploy production from the feature branch. Staging is the only deploy target before human acceptance.
- Do not migrate or query production D1 as part of implementation verification.
- The Windows/QZ station is the only physical executor; Android/tablet/other browsers remain queue-only requesters.
- `qz.print()` resolving is not completion. `copies_printed` changes only after a correlated `JOB COMPLETE` or an explicit human resolution of an uncertain attempt.
- The submission-risk point is persisted before `qz.print()` is called. After that point, automatic retry and bulk discard are forbidden.
- Only physical health `ready` permits starting a new copy. Unknown/verifying state fails closed.
- Recovery states are exactly `normal`, `pending`, `active`, `deferred`.
- Automatic terminal retention is exactly 30 days and only deletes `printed` and `discarded`; active, failed, `awaiting_confirmation`, `awaiting_second_copy`, and `requires_attention` rows are never automatically purged.
- Operational UI page size is at most 10; completed-recent block is at most 10 and does not become an archive.
- Preserve the current one-copy rule for Mesa/consumo local, the existing second-copy decision semantics, reprint-as-new-job semantics, ticket renderer, and central business copy setting.

## Execution Preflight

Before Task 1, create a fresh worktree from the approved branch HEAD and establish a clean baseline:

```bash
git fetch origin
git rev-parse origin/feature/print-operational-safety-issue-36
git worktree add ../sistema-delivery-print-safety -b feature/print-operational-safety-issue-36-impl origin/feature/print-operational-safety-issue-36
cd ../sistema-delivery-print-safety
git status --short
npm test
npm run lint
npm run build
npm run d1:migrate:local
```

Expected baseline: clean worktree; all validation commands green. If baseline is red, investigate the pre-existing failure before changing feature code.

---

## Task 1 — Extend the D1 model for physical confirmation and recovery

**Files**

- Create: `migrations/0019_print_operational_confirmation.sql`
- Modify: `worker/orderPrintingMigration.test.js`

**Interfaces**

- Consumes existing tables `print_jobs`, `print_stations`, `businesses` and migration state through `0018_second_copy_decisions.sql`.
- Produces job status `awaiting_confirmation`, station physical/recovery columns, and `print_job_attempts`.

- [ ] **1.1 RED — add migration expectations before writing migration 0019.** Extend `worker/orderPrintingMigration.test.js` so the test applies migrations through 0019 and asserts the exact schema contract:

```js
assert.match(sql0019, /awaiting_confirmation/)
assert.match(sql0019, /CREATE TABLE print_job_attempts/)
assert.match(sql0019, /spool_job_name TEXT NOT NULL UNIQUE/)
assert.match(sql0019, /submission_started_at TEXT/)
assert.match(sql0019, /recovery_state TEXT NOT NULL DEFAULT 'normal'/)
assert.match(sql0019, /physical_status_text TEXT/)
```

Also add a migration execution test that starts with rows valid under 0018, applies 0019, and proves the old job still exists unchanged while a new row may use `awaiting_confirmation`.

- [ ] **1.2 Run the focused migration test and confirm RED.**

```bash
node --test worker/orderPrintingMigration.test.js
```

Expected failure: migration 0019/schema contract is missing.

- [ ] **1.3 GREEN — create `0019_print_operational_confirmation.sql`.** Use the existing SQLite table-rebuild pattern because `print_jobs.status` is CHECK-constrained. The migration must preserve every 0018 column and add only the approved state. Add station fields and the attempt table with these concrete constraints:

```sql
ALTER TABLE print_stations ADD COLUMN physical_state TEXT NOT NULL DEFAULT 'verifying'
  CHECK (physical_state IN ('ready','verifying','printer_offline','printer_attention','qz_unavailable','printer_not_found','unconfigured','unsupported'));
ALTER TABLE print_stations ADD COLUMN physical_status_text TEXT;
ALTER TABLE print_stations ADD COLUMN physical_status_code INTEGER;
ALTER TABLE print_stations ADD COLUMN physical_status_at TEXT;
ALTER TABLE print_stations ADD COLUMN last_offline_at TEXT;
ALTER TABLE print_stations ADD COLUMN recovery_state TEXT NOT NULL DEFAULT 'normal'
  CHECK (recovery_state IN ('normal','pending','active','deferred'));

CREATE TABLE print_job_attempts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
  copy_number INTEGER NOT NULL CHECK (copy_number IN (1, 2)),
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  station_id TEXT REFERENCES print_stations(id) ON DELETE SET NULL,
  spool_job_name TEXT NOT NULL UNIQUE,
  spool_job_id INTEGER,
  status TEXT NOT NULL CHECK (status IN ('prepared','submitting','spooling','printing','complete','failed','unknown')),
  submission_started_at TEXT,
  submitted_at TEXT,
  last_event_at TEXT,
  completed_at TEXT,
  resolution TEXT CHECK (resolution IS NULL OR resolution IN ('manual_printed','manual_not_printed')),
  resolution_actor_label TEXT,
  resolved_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (job_id, copy_number, attempt_number)
);
```

When rebuilding `print_jobs`, the status CHECK must be:

```sql
CHECK (status IN ('pending','processing','awaiting_confirmation','awaiting_second_copy','printed','failed','requires_attention','discarded'))
```

Recreate current indexes and make the active index include `awaiting_confirmation` and `awaiting_second_copy`.

- [ ] **1.4 Run migration tests GREEN and run local migrations.**

```bash
node --test worker/orderPrintingMigration.test.js
npm run d1:migrate:local
```

Expected: both commands green; existing migration data preserved.

- [ ] **1.5 Commit.**

```bash
git add migrations/0019_print_operational_confirmation.sql worker/orderPrintingMigration.test.js
git commit -m "feat: add durable print attempt state"
```

---

## Task 2 — Define shared queue and printer-health semantics

**Files**

- Modify: `shared/printQueue.js`
- Modify: `shared/printQueue.test.js`
- Modify: `shared/printQueueActions.js`
- Modify: `shared/printQueueActions.test.js`
- Create: `shared/printStationHealth.js`
- Create: `shared/printStationHealth.test.js`

**Interfaces**

- Produces `PRINT_QUEUE_STATES.WAITING_CONFIRMATION` and queue label `Aguardando confirmação`.
- Produces `normalizePrinterHealth(input)` and `isPrinterReady(input)` as the common backend/frontend vocabulary.
- Produces unknown-outcome actions `confirmPrinted` and `confirmNotPrinted` for `PRINT_OUTCOME_UNKNOWN`.

- [ ] **2.1 RED — specify queue transitions and actions.** Add tests such as:

```js
assert.equal(resolvePrintQueueState('awaiting_confirmation'), 'waiting_confirmation')
assert.equal(getPrintQueueLabel('awaiting_confirmation'), 'Aguardando confirmação')
assert.equal(canTransitionPrintQueueState('processing', 'awaiting_confirmation'), true)
assert.equal(canTransitionPrintQueueState('awaiting_confirmation', 'printed'), true)
assert.deepEqual(
  getPrintJobActions({ status: 'requires_attention', lastError: { code: 'PRINT_OUTCOME_UNKNOWN' }, type: 'order' }),
  [
    { key: 'confirmPrinted', label: 'A via foi impressa' },
    { key: 'confirmNotPrinted', label: 'Não foi impressa — reenviar' },
  ],
)
```

Add health tests:

```js
assert.deepEqual(normalizePrinterHealth({ qzConnected: true, queueFound: true, statusText: 'OK' }), {
  state: 'ready', ready: true, statusText: 'OK', statusCode: null,
})
assert.equal(isPrinterReady({ state: 'verifying' }), false)
assert.equal(isPrinterReady({ state: 'printer_offline' }), false)
```

- [ ] **2.2 Run focused tests RED.**

```bash
node --test shared/printQueue.test.js shared/printQueueActions.test.js shared/printStationHealth.test.js
```

- [ ] **2.3 GREEN — extend `shared/printQueue.js`.** Add the explicit state and transition path:

```js
WAITING_CONFIRMATION: 'waiting_confirmation'
```

with alias `awaiting_confirmation`, label `Aguardando confirmação`, `PRINTING -> WAITING_CONFIRMATION`, and `WAITING_CONFIRMATION -> WAITING_SECOND_COPY | PRINTED | ATTENTION`.

- [ ] **2.4 GREEN — centralize physical health.** Implement `normalizePrinterHealth` so readiness is only true when all transport prerequisites are true and `statusText === 'OK'`. Known blocking PRINTER statuses (`OFFLINE`, `ERROR`, `PAPER_JAM`, `PAPER_OUT`, `PAPER_PROBLEM`, `USER_INTERVENTION`, `DOOR_OPEN`, `NOT_AVAILABLE`) normalize to offline/attention. Non-OK informational or unknown states normalize to `verifying`, not ready.

```js
export const isPrinterReady = (health) => health?.state === 'ready' && health?.ready === true
```

- [ ] **2.5 GREEN — make unknown outcome actions explicit.** Add `PRINT_OUTCOME_UNKNOWN` to the uncertain set and return only the two manual-resolution actions for it; do not expose generic retry or discard for a potentially submitted copy.

- [ ] **2.6 Run focused tests GREEN.**

```bash
node --test shared/printQueue.test.js shared/printQueueActions.test.js shared/printStationHealth.test.js
```

- [ ] **2.7 Commit.**

```bash
git add shared/printQueue.js shared/printQueue.test.js shared/printQueueActions.js shared/printQueueActions.test.js shared/printStationHealth.js shared/printStationHealth.test.js
git commit -m "feat: define physical print confirmation states"
```

---

## Task 3 — Persist attempts and make `JOB COMPLETE` idempotent

**Files**

- Create: `worker/printAttemptRepository.js`
- Create: `worker/printAttemptRepository.test.js`
- Modify: `worker/orderPrintingRepository.js`
- Modify: `worker/orderPrintingRepository.test.js`
- Modify: `worker/orderPrintingAttention.test.js`

**Interfaces**

```js
createPrintJobAttempt(db, businessId, { jobId, stationId, copyNumber }, now) -> attempt
markPrintAttemptSubmitting(db, businessId, attemptId, stationId, now) -> { job, attempt }
recordPrintAttemptEvent(db, businessId, attemptId, stationId, event, now) -> { job, attempt }
markPrintAttemptUnknown(db, businessId, attemptId, stationId, reason, now) -> { job, attempt }
resolveUnknownPrintAttempt(db, businessId, jobId, attemptId, resolution, actorLabel, now) -> { job, attempt }
listPrintJobAttempts(db, businessId, jobId) -> attempt[]
```

- [ ] **3.1 RED — create repository tests for the anti-duplicate sequence.** Cover at least:

```js
const attempt = await createPrintJobAttempt(db, businessId, {
  jobId: 'job-1', stationId: 'kitchen', copyNumber: 1,
}, now)
assert.equal(attempt.attemptNumber, 1)
assert.match(attempt.spoolJobName, /^GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1$/)

const submitting = await markPrintAttemptSubmitting(db, businessId, attempt.id, 'kitchen', now)
assert.equal(submitting.job.status, 'awaiting_confirmation')
assert.ok(submitting.attempt.submissionStartedAt)
assert.equal(submitting.job.copiesPrinted, 0)
```

Then submit `SPOOLING`, `PRINTING`, `COMPLETE` and assert only COMPLETE increments exactly once. Re-send the same COMPLETE and assert the count does not increment twice.

- [ ] **3.2 RED — add uncertain-resolution tests.** A submitted attempt becoming unknown must produce `requires_attention` + `PRINT_OUTCOME_UNKNOWN`. `manual_printed` increments once; `manual_not_printed` returns the job to `pending` without altering the old attempt into a successful automatic confirmation, allowing the next attempt number to become 2.

- [ ] **3.3 RED — protect aging semantics.** Update `worker/orderPrintingAttention.test.js` so stale `processing` may still become an unknown attention state, but `awaiting_confirmation` is never moved back to `pending`/retryable. If the owning station heartbeat becomes stale, it may become `requires_attention` with canonical `PRINT_OUTCOME_UNKNOWN` only.

- [ ] **3.4 Run focused tests and confirm RED.**

```bash
node --test worker/printAttemptRepository.test.js worker/orderPrintingRepository.test.js worker/orderPrintingAttention.test.js
```

- [ ] **3.5 GREEN — implement attempt mapping and transactions.** In `worker/printAttemptRepository.js`, keep attempt-specific SQL out of the already-large order-printing repository. Generate the next `attempt_number` with `MAX(attempt_number)+1` scoped to `(job_id, copy_number)`. Generate exact job names with:

```js
const spoolJobName = (jobId, copyNumber, attemptNumber) =>
  `GESTAO-DELIVERY:${jobId}:COPY:${copyNumber}:ATTEMPT:${attemptNumber}`
```

`markPrintAttemptSubmitting` must update the attempt to `submitting` and the job to `awaiting_confirmation` before the caller invokes QZ.

- [ ] **3.6 GREEN — normalize QZ job events.** Map `SPOOLING`/`SCHEDULED`/`SENT` to accepted/submitted evidence, `PRINTING`/`RETAINED` to in-progress, and `COMPLETE` to complete. `DELETED`, `CANCELED`, `ABORTED`, `ERROR`, `OFFLINE`, `PAPEROUT`, `USER_INTERVENTION` without a prior COMPLETE must not authorize an automatic retry; resolve them to an uncertain/attention outcome unless the attempt was already complete.

- [ ] **3.7 GREEN — implement idempotent completion.** Completion must transactionally check `attempt.status <> 'complete'` before updating `copies_printed`, then derive the job state:

```js
const nextCopies = Math.min(job.copiesRequested, job.copiesPrinted + 1)
const nextStatus = nextCopies >= job.copiesRequested ? 'printed' : 'awaiting_second_copy'
```

Preserve existing second-copy timestamps and snapshot.

- [ ] **3.8 Run focused tests GREEN.**

```bash
node --test worker/printAttemptRepository.test.js worker/orderPrintingRepository.test.js worker/orderPrintingAttention.test.js
```

- [ ] **3.9 Commit.**

```bash
git add worker/printAttemptRepository.js worker/printAttemptRepository.test.js worker/orderPrintingRepository.js worker/orderPrintingRepository.test.js worker/orderPrintingAttention.test.js
git commit -m "feat: persist qz print attempts and completion"
```

---

## Task 4 — Persist real printer health and backlog recovery gates

**Files**

- Modify: `worker/orderPrintingRepository.js`
- Modify: `worker/orderPrintingStationHealth.test.js`
- Modify: `worker/orderPrintingCentralClaim.js`
- Modify: `worker/orderPrintingCentralClaim.test.js`
- Create: `worker/orderPrintingRecovery.test.js`

**Interfaces**

```js
heartbeatPrintStation(db, businessId, stationId, health, now) -> station
setPrintRecoveryState(db, businessId, stationId, state, now) -> station
claimNextRecoveryPrintJob(db, businessId, stationId, now) -> job | null
discardPendingPrintJobs(db, businessId, actorLabel, now) -> { discardedCount }
```

Heartbeat input:

```js
{
  qzReady: boolean,
  printerReady: boolean,
  physicalState: string,
  physicalStatusText: string | null,
  physicalStatusCode: number | null,
}
```

- [ ] **4.1 RED — expand health tests.** Prove that a station with QZ + queue present but `physicalState: 'printer_offline'` is not ready. Prove `ready` requires a fresh heartbeat, primary Windows station, qzReady and printerReady.

- [ ] **4.2 RED — specify recovery transition.** When a previously non-operational/stale station becomes physically ready and safe `pending` jobs exist, heartbeat must set `recoveryState='pending'`. A normal refresh while the prior heartbeat was still fresh/ready must not create a recovery cycle.

```js
assert.equal((await heartbeatPrintStation(db, businessId, 'kitchen', readyHealth, afterDowntime)).recoveryState, 'pending')
```

- [ ] **4.3 RED — block automatic claims during recovery.** Update central-claim tests so `claimNextPrintJob()` returns no job while recovery state is `pending`, `active`, or `deferred`. `claimNextRecoveryPrintJob()` may claim exactly one job only when state is `active`.

- [ ] **4.4 RED — make bulk discard safe.** Test that `discardPendingPrintJobs` only discards jobs with `status='pending'`, `copies_printed=0`, and no attempt whose `submission_started_at` is non-null. It must leave second-copy continuations, `awaiting_confirmation`, attention jobs and any potentially submitted row untouched.

- [ ] **4.5 Run focused tests RED.**

```bash
node --test worker/orderPrintingStationHealth.test.js worker/orderPrintingCentralClaim.test.js worker/orderPrintingRecovery.test.js
```

- [ ] **4.6 GREEN — update station mapper/heartbeat.** Persist physical status fields and derive recovery from the previous station health before writing the new heartbeat. Treat a stale previous heartbeat as previously not operational so a PC returning after downtime with backlog enters `pending`.

- [ ] **4.7 GREEN — gate claim paths.** Keep existing priority ordering for the eligible job, but add `recovery_state='normal'` to normal claim eligibility. Recovery claim uses the same business/order safety checks and priority ordering, but requires `recovery_state='active'` and is called only by a user action.

- [ ] **4.8 GREEN — implement recovery state changes and safe bulk discard.** Valid transitions:

```text
normal -> pending
pending -> active | deferred | normal
active -> deferred | normal
active -> active  (idempotent)
deferred -> active | normal
```

`normal` is restored automatically only when no safe backlog remains after an explicitly controlled recovery cycle.

- [ ] **4.9 Run focused tests GREEN.**

```bash
node --test worker/orderPrintingStationHealth.test.js worker/orderPrintingCentralClaim.test.js worker/orderPrintingRecovery.test.js
```

- [ ] **4.10 Commit.**

```bash
git add worker/orderPrintingRepository.js worker/orderPrintingStationHealth.test.js worker/orderPrintingCentralClaim.js worker/orderPrintingCentralClaim.test.js worker/orderPrintingRecovery.test.js
git commit -m "feat: gate printing on physical recovery state"
```

---

## Task 5 — Implement backend operational pagination, sorting, summary and 30-day retention

**Files**

- Modify: `worker/orderPrintingRepository.js`
- Create: `worker/orderPrintingQueueList.test.js`
- Create: `worker/orderPrintingRetention.test.js`

**Interfaces**

```js
listPrintJobs(db, businessId, options) -> { jobs, pageInfo }
getPrintQueueSummary(db, businessId, now) -> summary
purgeExpiredTerminalPrintJobs(db, businessId, now) -> number
```

UI list options:

```js
{
  scope: 'operational' | 'recent',
  page: 1,
  pageSize: 10,
  sortBy: 'orderNumber' | 'jobId' | 'status' | 'trigger' | 'createdAt',
  sortDir: 'asc' | 'desc',
  status: '',
  trigger: '',
  search: '',
  now,
}
```

Keep the existing `orderId` retrieval path for order detail/history compatibility, and keep a separate internal execution read if the manager needs more than one UI page.

- [ ] **5.1 RED — test default operational scope.** Seed more than 10 mixed jobs and assert only operational statuses are returned (`pending`, `processing`, `awaiting_confirmation`, `awaiting_second_copy`, `failed`, `requires_attention`), newest first by default, with exact page metadata.

```js
assert.deepEqual(result.pageInfo, { page: 1, pageSize: 10, totalItems: 13, totalPages: 2 })
assert.ok(new Date(result.jobs[0].createdAt) >= new Date(result.jobs[1].createdAt))
```

- [ ] **5.2 RED — test whitelist sorting and pagination stability.** Cover numeric `orders.order_number`, job id lexical order, status/trigger text order and real timestamp order. Verify page 1 + page 2 have no duplicates/omissions. Invalid `sortBy` falls back to `createdAt`; invalid `sortDir` falls back to `desc` rather than becoming SQL.

- [ ] **5.3 RED — test backend search/filter.** Search must match order number, customer name and table identifier from the snapshot/order data. Status and trigger filters operate before pagination.

- [ ] **5.4 RED — test recent block.** `scope='recent'` returns only `printed`/`discarded`, at most 10 rows, newest first, and does not provide navigable pages into older completed history.

- [ ] **5.5 RED — test 30-day retention.** Seed 31-day-old `printed`, `discarded`, `failed`, `requires_attention`, `pending`, `awaiting_confirmation`, and `awaiting_second_copy`. Only old `printed` and `discarded` rows must be deleted. Their attempt rows may cascade; active/diagnostic rows remain.

- [ ] **5.6 Run focused tests RED.**

```bash
node --test worker/orderPrintingQueueList.test.js worker/orderPrintingRetention.test.js
```

- [ ] **5.7 GREEN — implement safe query construction.** Use a fixed sort map, never interpolate request values directly:

```js
const PRINT_JOB_SORT_SQL = Object.freeze({
  orderNumber: 'orders.order_number',
  jobId: 'print_jobs.id',
  status: 'print_jobs.status',
  trigger: 'print_jobs.trigger',
  createdAt: 'print_jobs.created_at',
})
```

Clamp UI `pageSize` to 10. Use stable secondary ordering (`created_at`, `id`) so pagination is deterministic.

- [ ] **5.8 GREEN — add summary query.** Return counts needed by the UI without deriving them from the current page:

```js
{
  pending,
  awaitingConfirmation,
  awaitingSecondCopy,
  attention,
  completedToday,
  safeBacklog,
}
```

`attention` counts both `failed` and `requires_attention` for operator-facing summary.

- [ ] **5.9 GREEN — add opportunistic terminal cleanup.** `purgeExpiredTerminalPrintJobs` uses server time and the 30-day cutoff. Invoke it from the operational listing/summary path at most once per request; no production scheduler is required for this delivery.

- [ ] **5.10 Run focused tests GREEN.**

```bash
node --test worker/orderPrintingQueueList.test.js worker/orderPrintingRetention.test.js worker/orderPrintingRepository.test.js
```

- [ ] **5.11 Commit.**

```bash
git add worker/orderPrintingRepository.js worker/orderPrintingQueueList.test.js worker/orderPrintingRetention.test.js
git commit -m "feat: make print queue an operational data view"
```

---

## Task 6 — Expose the new backend contracts and client helpers

**Files**

- Modify: `worker/orderPrintingApi.js`
- Modify: `worker/orderPrintingHttp.test.js`
- Modify: `src/api/client.js`
- Modify: `src/api/printingClient.test.js`

**Interfaces / HTTP contracts**

```text
GET  /api/printing/jobs?scope=operational&page=1&pageSize=10&sortBy=createdAt&sortDir=desc&status=&trigger=&search=
GET  /api/printing/jobs/summary
POST /api/printing/jobs/:jobId/attempts
POST /api/printing/attempts/:attemptId/submitting
POST /api/printing/attempts/:attemptId/events
POST /api/printing/jobs/:jobId/resolve-outcome
POST /api/printing/stations/:stationId/recovery
POST /api/printing/jobs/claim-recovery-next
POST /api/printing/jobs/discard-pending
```

Bodies:

```js
// create attempt
{ stationId, copyNumber }
// submitting
{ stationId }
// QZ event
{ stationId, eventType, statusText, statusCode, severity, jobId, jobName }
// resolve unknown
{ attemptId, resolution: 'printed' | 'not_printed', actorLabel }
// recovery
{ state: 'normal' | 'pending' | 'active' | 'deferred' }
```

- [ ] **6.1 RED — add HTTP tests for every route.** Verify same-origin protection on mutations, business scoping, exact validation, page-size clamp, sort fallback, and that no requester can spoof an attempt for another business/station.

- [ ] **6.2 RED — add client-helper tests.** Expected signatures:

```js
getPrintJobs(options)
getPrintQueueSummary()
createPrintAttempt(jobId, stationId, copyNumber)
markPrintAttemptSubmitting(attemptId, stationId)
recordPrintAttemptEvent(attemptId, stationId, event)
resolvePrintOutcome(jobId, attemptId, resolution, actorLabel = 'Sistema')
setPrintStationRecovery(stationId, state)
claimNextRecoveryPrintJob(stationId)
discardPendingPrintJobs(actorLabel = 'Sistema')
```

- [ ] **6.3 Run HTTP/client tests RED.**

```bash
node --test worker/orderPrintingHttp.test.js src/api/printingClient.test.js
```

- [ ] **6.4 GREEN — wire repository functions to the API.** Keep existing generic routes temporarily for compatibility, but the physical manager introduced later must stop using `/complete` as its QZ-success signal.

`GET /api/printing/jobs` returns:

```js
{ jobs, pageInfo }
```

and `GET /api/printing/jobs/summary` returns:

```js
{ summary }
```

- [ ] **6.5 GREEN — extend heartbeat validation.** The station heartbeat accepts only the approved fields and rejects arbitrary extra keys. Physical readiness is still recomputed/validated server-side; never trust `printerReady=true` while `physicalState` is not `ready`.

- [ ] **6.6 GREEN — implement matching client helpers.** Query parameters must use `URLSearchParams`, omit empty filters, and send `credentials: 'same-origin'` through the existing request wrapper.

- [ ] **6.7 Run tests GREEN.**

```bash
node --test worker/orderPrintingHttp.test.js src/api/printingClient.test.js
```

- [ ] **6.8 Commit.**

```bash
git add worker/orderPrintingApi.js worker/orderPrintingHttp.test.js src/api/client.js src/api/printingClient.test.js
git commit -m "feat: expose print safety and operational queue api"
```

---

## Task 7 — Listen to real QZ PRINTER/JOB events and send unique job names

**Files**

- Modify: `src/printing/qzTrayTransport.js`
- Modify: `src/printing/qzTrayTransport.test.js`
- Create: `src/printing/qzStatusMonitor.js`
- Create: `src/printing/qzStatusMonitor.test.js`

**Interfaces**

```js
classifyQzPrinterStatus(event) -> { state, ready, statusText, statusCode }
printQzRawBytes(qzApi, printerName, bytes, { jobName }) -> Promise<void>
createQzStatusMonitor({ qzApi, printerName, onPrinterStatus, onJobStatus }) -> {
  start(), stop(), awaitJobOutcome(jobName), failPending(error)
}
```

QZ 2.2.6 API used by this task is the verified printer-status surface:

```js
qzApi.printers.setPrinterCallbacks(callback)
await qzApi.printers.startListening(printerName)
await qzApi.printers.getStatus()
await qzApi.printers.stopListening()
```

QZ custom job name is configured with:

```js
qzApi.configs.create(selectedPrinter, { jobName })
```

- [ ] **7.1 RED — classify physical PRINTER events.** Add table-driven tests for `OK` => `ready`, `OFFLINE` => `printer_offline`, paper/error/intervention => `printer_attention`, and unrecognized/info states => `verifying`/not ready.

- [ ] **7.2 RED — prove custom jobName reaches QZ config.** Update the transport fake:

```js
await printQzRawBytes(qzApi, 'MPT-II', new Uint8Array([1]), {
  jobName: 'GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1',
})
assert.deepEqual(configCalls[0], ['MPT-II', { jobName: 'GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1' }])
```

- [ ] **7.3 RED — specify monitor lifecycle.** Test that `start()` installs callback before `startListening`, calls `getStatus()` to obtain current state, routes only events for the configured printer, and resolves `awaitJobOutcome(name)` only for the matching `JOB COMPLETE`. `stop()`/connection loss rejects unresolved waiters with `QZ_OBSERVATION_LOST`.

- [ ] **7.4 Run focused tests RED.**

```bash
node --test src/printing/qzTrayTransport.test.js src/printing/qzStatusMonitor.test.js
```

- [ ] **7.5 GREEN — implement QZ monitor.** Normalize event fields from QZ (`printerName`, `eventType`, `statusText`, `statusCode`, `severity`, `jobId`, `jobName`). Ignore unrelated printers/jobs. Register waiters before the caller invokes `qz.print()` so fast SPOOLING/COMPLETE events cannot be missed.

- [ ] **7.6 GREEN — update readiness derivation.** `deriveQzOperationalState` takes the normalized physical state and sets `operationalReady` only for `ready`.

- [ ] **7.7 Run focused tests GREEN.**

```bash
node --test src/printing/qzTrayTransport.test.js src/printing/qzStatusMonitor.test.js
```

- [ ] **7.8 Commit.**

```bash
git add src/printing/qzTrayTransport.js src/printing/qzTrayTransport.test.js src/printing/qzStatusMonitor.js src/printing/qzStatusMonitor.test.js
git commit -m "feat: monitor physical qz printer and job status"
```

---

## Task 8 — Replace `qz.print()` success with durable attempt confirmation

**Files**

- Create: `src/printing/qzPrintAttemptController.js`
- Create: `src/printing/qzPrintAttemptController.test.js`
- Modify: `src/printing/printJobRunner.js`
- Modify: `src/printing/printJobRunner.test.js`
- Modify: `src/printing/centralizedPrintExecutor.test.js`
- Modify: `src/printing/usePrintingManager.js`
- Modify: `src/printing/usePrintingManager.test.js`
- Modify: `src/printing/printingHeartbeat.test.js`

**Interfaces**

```js
executeQzPrintAttempt({
  job,
  stationId,
  renderer,
  createAttempt,
  markSubmitting,
  sendBytes,
  awaitOutcome,
  markUnknown,
}) -> { status: 'confirmed' | 'unknown' | 'failed', job?, attempt?, error? }
```

The manager exposes physical state separately from queue discovery:

```js
printerHealth
recoveryState
qzConnected
printerQueueFound
transportReady // queue/transport configuration only; not physical readiness
```

- [ ] **8.1 RED — write controller sequence test.** Assert the order is exactly:

```text
render -> createAttempt -> markSubmitting -> register/await outcome -> qz.print -> JOB COMPLETE -> refresh
```

and `markSubmitting` occurs before `sendBytes`.

- [ ] **8.2 RED — prove no completion on `qz.print()` resolution.** The fake `sendBytes` resolves immediately, but the returned execution promise must remain unsettled until the monitor emits correlated COMPLETE. `completePrintJob` must not be called by the physical path.

- [ ] **8.3 RED — prove post-risk loss is uncertain.** If `markSubmitting` succeeded and QZ observation is lost before COMPLETE, call `markUnknown` and return `unknown`; do not call generic retry/failure logic that can move the job to pending.

- [ ] **8.4 RED — update automatic-consumer guard.** `canConsumeAutomaticPrintJob` must require:

```js
physicalReady === true && recoveryState === 'normal'
```

in addition to existing auth/online/primary/QZ/busy checks. Queue-found alone must return false.

- [ ] **8.5 RED — update heartbeat tests.** `buildPrintStationHeartbeatHealth` emits `printerReady` from `printerHealth.state === 'ready'`, plus `physicalState`, `physicalStatusText`, and `physicalStatusCode`.

- [ ] **8.6 Run focused tests RED.**

```bash
node --test src/printing/qzPrintAttemptController.test.js src/printing/printJobRunner.test.js src/printing/centralizedPrintExecutor.test.js src/printing/usePrintingManager.test.js src/printing/printingHeartbeat.test.js
```

- [ ] **8.7 GREEN — make the runner render one copy but delegate QZ confirmation.** Keep copy-number selection in `printJobRunner.js`; remove the assumption that transport resolution itself authorizes `completeJob`. The QZ controller owns the attempt lifecycle and receives the one-copy bytes.

- [ ] **8.8 GREEN — integrate QZ monitor in `usePrintingManager`.** On configured primary Windows station:

```text
ensure QZ -> resolve queue -> set verifying -> start status monitor -> request current status -> only then allow ready
```

On QZ websocket close, call `monitor.failPending()`, invalidate readiness and set local state to `qz_unavailable`.

- [ ] **8.9 GREEN — persist every managed JOB event.** For a tracked attempt, the monitor’s `onJobStatus` calls `recordPrintAttemptEvent`. COMPLETE refreshes the server job and lets the execution promise finish. Do not infer completion from local event alone if persistence fails; surface attention/error instead.

- [ ] **8.10 GREEN — preserve second-copy flow.** A first confirmed copy of a two-copy job still becomes `awaiting_second_copy`. The existing human second-copy click executes one physical copy through the same durable attempt controller; it never bypasses physical-ready checks.

- [ ] **8.11 Run focused tests GREEN.**

```bash
node --test src/printing/qzPrintAttemptController.test.js src/printing/printJobRunner.test.js src/printing/centralizedPrintExecutor.test.js src/printing/usePrintingManager.test.js src/printing/printingHeartbeat.test.js
```

- [ ] **8.12 Commit.**

```bash
git add src/printing/qzPrintAttemptController.js src/printing/qzPrintAttemptController.test.js src/printing/printJobRunner.js src/printing/printJobRunner.test.js src/printing/centralizedPrintExecutor.test.js src/printing/usePrintingManager.js src/printing/usePrintingManager.test.js src/printing/printingHeartbeat.test.js
git commit -m "feat: confirm qz copies from spooler job events"
```

---

## Task 9 — Add controlled offline-backlog recovery to the manager and app shell

**Files**

- Create: `src/printing/printRecoveryFlow.js`
- Create: `src/printing/printRecoveryFlow.test.js`
- Modify: `src/printing/usePrintingManager.js`
- Modify: `src/printing/usePrintingManager.test.js`
- Modify: `src/App.jsx`
- Create: `src/printRecoveryUi.test.js`

**Interfaces**

Manager actions:

```js
startRecovery()
deferRecovery()
resumeRecovery()
printNextRecovery()
discardRecoveryBacklog()
confirmUnknownPrinted(job, attempt)
confirmUnknownNotPrinted(job, attempt)
```

Manager state:

```js
recoveryState
recoveryPendingCount
recoveryPromptEligible
```

- [ ] **9.1 RED — specify recovery prompt eligibility.** `pending` + physical `ready` + safe backlog > 0 presents one recovery decision. `deferred` does not reopen on refresh/poll. A fresh future offline->ready cycle may create a new `pending` state server-side.

- [ ] **9.2 RED — specify action semantics.** `Imprimir agora` sets `active` and calls exactly one recovery claim/execution. After correlated COMPLETE it stops. It does not schedule the next claim. `Imprimir próxima` causes the next single claim. `Parar por agora` sets `deferred`.

- [ ] **9.3 RED — verify new live orders cannot interleave.** While `recoveryState !== 'normal'`, the timer-driven normal consumer has zero `claimNextPrintJob` calls even if new pending jobs arrive.

- [ ] **9.4 RED — verify second copy remains human controlled.** A recovery first copy that becomes `awaiting_second_copy` may show the existing second-copy decision, but no second copy is automatically printed. Clicking `Imprimir 2ª via` runs one durable attempt and still leaves the automatic consumer paused until recovery is finished/deferred.

- [ ] **9.5 RED — add app copy/one-shot modal test.** Verify these strings and actions are rendered from persisted state, not from refresh count:

```text
Impressora disponível novamente
Há X trabalhos aguardando impressão.
Como a impressora não possui corte automático, as vias serão impressas uma de cada vez.
Imprimir agora
Agora não
Descartar todas
Via impressa
Separe o papel antes de continuar.
Imprimir próxima
Parar por agora
```

- [ ] **9.6 Run focused tests RED.**

```bash
node --test src/printing/printRecoveryFlow.test.js src/printing/usePrintingManager.test.js src/printRecoveryUi.test.js
```

- [ ] **9.7 GREEN — implement pure recovery helpers.** Put prompt/next-action eligibility in `printRecoveryFlow.js`; keep React effects orchestration-only.

- [ ] **9.8 GREEN — expose recovery actions from manager.** `discardRecoveryBacklog` calls the server bulk-discard action, refreshes counts, and never touches submitted/second-copy work. If no safe backlog remains, set `normal`; otherwise preserve recovery state for remaining unsafe/second-copy decisions.

- [ ] **9.9 GREEN — integrate modals in `App.jsx`.** Use existing `Modal`/`ConfirmationDialog` patterns. `Descartar todas` requires a destructive confirmation showing the exact discardable count. No modal is shown while the printer is physically offline.

- [ ] **9.10 Run focused tests GREEN.**

```bash
node --test src/printing/printRecoveryFlow.test.js src/printing/usePrintingManager.test.js src/printRecoveryUi.test.js
```

- [ ] **9.11 Commit.**

```bash
git add src/printing/printRecoveryFlow.js src/printing/printRecoveryFlow.test.js src/printing/usePrintingManager.js src/printing/usePrintingManager.test.js src/App.jsx src/printRecoveryUi.test.js
git commit -m "feat: recover offline print backlog one copy at a time"
```

---

## Task 10 — Update Settings with one operational printer-health model

**Files**

- Modify: `src/components/PrintingSettings.jsx`
- Modify: `src/components/PrintingSettings.test.js`
- Modify: `src/printing/printing.css`

**Interfaces**

- Consumes `printing.printerHealth`, `printing.recoveryState`, `printing.recoveryPendingCount`, `printing.qzConnected`, `printing.printerQueueFound`.
- Produces only user-facing status; it must not derive a second competing readiness model.

- [ ] **10.1 RED — replace old “Pronta para enviar” expectations.** Tests must require the approved messages:

```text
Pronta para imprimir
Verificando impressora…
Impressora desligada ou desconectada
Atenção necessária na impressora
QZ Tray indisponível
Impressora não encontrada
Impressora não configurada
```

and reject the old implication that “Fila encontrada” means physical readiness.

- [ ] **10.2 RED — add pending/confirmation counts.** When supplied by manager/summary, Settings shows `Há 4 trabalhos aguardando impressão` and `1 via enviada à impressora aguardando confirmação` with correct singular/plural handling.

- [ ] **10.3 RED — test control safety.** `Testar impressão` and physical actions that send paper are disabled unless `printerHealth.state === 'ready'`; queue-only clients still have no physical controls.

- [ ] **10.4 Run focused test RED.**

```bash
node --test src/components/PrintingSettings.test.js
```

- [ ] **10.5 GREEN — render the shared health model.** Keep QZ connection and queue selection diagnostics visible, but make the primary operational label come only from `printerHealth`.

- [ ] **10.6 GREEN — style all new health/recovery messages using existing semantic tokens.** Preserve light/dark support, focus-visible states, mobile layout, and no hard-coded fallback colors.

- [ ] **10.7 Run focused test GREEN.**

```bash
node --test src/components/PrintingSettings.test.js
```

- [ ] **10.8 Commit.**

```bash
git add src/components/PrintingSettings.jsx src/components/PrintingSettings.test.js src/printing/printing.css
git commit -m "feat: show real printer health in settings"
```

---

## Task 11 — Transform Print Queue into the Issue #36 operational panel

**Files**

- Create: `src/pages/printQueueQuery.js`
- Create: `src/pages/printQueueQuery.test.js`
- Modify: `src/pages/PrintQueue.jsx`
- Modify: `src/pages/PrintQueue.test.js`
- Modify: `src/pages/printQueueSummary.js`
- Modify: `src/pages/printQueueDetails.js`
- Modify: `src/print-queue.css`
- Modify: `src/components/PrintStatusBadge.jsx`
- Create or modify: `src/components/PrintStatusBadge.test.js`

**Interfaces**

Pure query state:

```js
createDefaultPrintQueueQuery() -> {
  page: 1, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc', status: '', trigger: '', search: ''
}
applyPrintQueueSort(query, column) -> query
applyPrintQueueFilter(query, patch) -> query // always page 1
```

`PrintQueue` reads backend data with `getPrintJobs()` and `getPrintQueueSummary()`; it no longer paginates/sorts a full `printing.jobs` array locally.

- [ ] **11.1 RED — test query-state semantics.** Default is newest-first; clicking same column toggles direction; clicking a new column starts with the sensible direction; sort/filter/search resets page to 1; page size remains 10.

```js
assert.deepEqual(createDefaultPrintQueueQuery(), {
  page: 1, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc', status: '', trigger: '', search: '',
})
```

- [ ] **11.2 RED — test server-backed rendering.** `PrintQueue.test.js` must mock the API/client boundary and prove it renders only returned page rows and uses `pageInfo.totalPages` for pagination. It must not call `filterPrintQueueJobs` to simulate pagination over a 100-job in-memory list.

- [ ] **11.3 RED — test columns and accessibility.** Desktop sortable headers: Pedido, Job, Status, Origem, Data/Hora. Active header exposes `aria-sort="ascending|descending"` and a visible direction indicator. Pedido uses `orderNumber`; Job uses job identifier; Data/Hora uses `createdAt`.

- [ ] **11.4 RED — test operational/recent separation.** Active/action jobs appear in the main operational section. A separate **Impressões recentes** section displays at most the 10 terminal rows returned by `scope=recent`. Older completed jobs are not reachable by turning the Print Queue into a historical pager.

- [ ] **11.5 RED — test summary and new states.** Summary includes `Aguardando impressão`, `Aguardando confirmação`, `Aguardando 2ª via`, and `Requer atenção`. `awaiting_confirmation` renders `Aguardando confirmação` in badges/details.

- [ ] **11.6 RED — test unknown-outcome UI.** For `PRINT_OUTCOME_UNKNOWN`, details show:

```text
Não foi possível confirmar esta impressão
Esta via pode ter sido impressa antes de a conexão ser interrompida.
A via foi impressa
Não foi impressa — reenviar
```

Choosing reenviar opens a second warning that explicitly mentions risk of duplicidade before calling `confirmUnknownNotPrinted`.

- [ ] **11.7 RED — test recovery banner/actions.** When offline with backlog: `Impressora indisponível · X trabalhos aguardando impressão` + `Ver fila`. When recovery is deferred/active: persistent `Retomar impressões`/next-copy action without refresh-spam.

- [ ] **11.8 RED — test pagination visibility/mobile.** No pagination for one page; Prev/Next or numbered navigation only for >1 page. Mobile cards show the same server page and preserve status, order/client, origin, copies and timestamp.

- [ ] **11.9 Run focused tests RED.**

```bash
node --test src/pages/printQueueQuery.test.js src/pages/PrintQueue.test.js src/components/PrintStatusBadge.test.js
```

- [ ] **11.10 GREEN — implement backend-driven data effects.** Keep independent requests for:

```js
getPrintJobs({ scope: 'operational', ...query })
getPrintJobs({ scope: 'recent', page: 1, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' })
getPrintQueueSummary()
```

Refresh after a queue action and on the existing operational polling cadence while the page is open. Ignore stale responses with a request-generation/ref guard.

- [ ] **11.11 GREEN — preserve detail/ticket/reprint actions.** Existing `Ver ticket`, force-print, second-copy, and reprint dialogs remain, but action availability comes from updated shared state. Do not offer historical search/reprint navigation in this page.

- [ ] **11.12 GREEN — implement responsive styling.** Desktop table with sortable button headers; mobile cards below 640px; recent section visually secondary; active/attention states visually stronger. Use current CSS tokens only.

- [ ] **11.13 Run focused tests GREEN.**

```bash
node --test src/pages/printQueueQuery.test.js src/pages/PrintQueue.test.js src/components/PrintStatusBadge.test.js
```

- [ ] **11.14 Commit.**

```bash
git add src/pages/printQueueQuery.js src/pages/printQueueQuery.test.js src/pages/PrintQueue.jsx src/pages/PrintQueue.test.js src/pages/printQueueSummary.js src/pages/printQueueDetails.js src/print-queue.css src/components/PrintStatusBadge.jsx src/components/PrintStatusBadge.test.js
git commit -m "feat: turn print queue into operational panel"
```

---

## Task 12 — Preserve History as the source for old-order reprints

**Files**

- Modify: `src/pages/OrderHistory.jsx` only if regression exposes missing behavior
- Modify: `src/components/OrderDetail.jsx`
- Create or modify: `src/pages/OrderHistory.test.js`
- Modify: `src/components/OrderDetail.test.js` if present; otherwise create `src/components/OrderDetailPrinting.test.js`
- Modify: `shared/printQueueActions.js` only if required by the tests already defined in Task 2

**Interfaces**

- `OrderHistory` continues locating historical orders.
- `OrderDetail` calls `printing.requestReprint(printJob, copies)`; server creates a new current job.
- No dependency on the old original print-job row being retained beyond the 30-day terminal retention window.

- [ ] **12.1 RED — test historical reprint responsibility.** A finalized order opened from History exposes reprint through OrderDetail even if the Print Queue recent list does not contain an old job. The reprint call creates/refreshes a current job and does not mutate the old job.

- [ ] **12.2 RED — test copy-choice preservation.** Historical manual reprint continues allowing 1 or 2 copies, including Mesa/consumo local.

- [ ] **12.3 Run focused tests RED if a gap exists.**

```bash
node --test src/pages/OrderHistory.test.js src/components/OrderDetailPrinting.test.js
```

- [ ] **12.4 GREEN — make only the minimum History/OrderDetail change necessary.** Do not add historical print-job browsing to Print Queue. If existing behavior already passes the new regression tests, keep production files unchanged and commit only the tests.

- [ ] **12.5 Run focused tests GREEN.**

```bash
node --test src/pages/OrderHistory.test.js src/components/OrderDetailPrinting.test.js
```

- [ ] **12.6 Commit.**

```bash
git add src/pages/OrderHistory.jsx src/pages/OrderHistory.test.js src/components/OrderDetail.jsx src/components/OrderDetailPrinting.test.js shared/printQueueActions.js
git commit -m "test: preserve history-driven print reprints"
```

If unchanged production paths do not exist in the diff, stage only files that actually changed.

---

## Task 13 — Rewrite operational documentation and physical acceptance checklist

**Files**

- Modify: `docs/operations/windows-qz-tray-printing.md`
- Modify: `docs/order-printing-mtp5-acceptance.md`
- Modify: `docs/release-and-migration-runbook.md` only to document migration 0019 impact/forward-only rule if the current generic text is insufficient

**Interfaces**

- Documentation must match the shipped implementation, not the previous “Pronta para enviar / qz.print means printed” semantics.

- [ ] **13.1 Update the Windows/QZ runbook with the observed physical truth.** Document:

```text
PRINTER OK -> may start a copy
PRINTER OFFLINE -> do not claim/send a new copy
JOB COMPLETE -> copy counted
SPOOLING without COMPLETE -> may still print later; never auto-resend
```

Explain `Aguardando confirmação`, recovery `Imprimir próxima`, deferred recovery, unknown-outcome manual resolution, and the fact that QZ/Winspool COMPLETE is the strongest available operational confirmation but not an independent paper sensor.

- [ ] **13.2 Update acceptance checklist with concrete physical cases.** Add PASS/FAIL checks for:

```text
printer OFF before a new job -> copiesPrinted remains 0 and job stays pending
OFFLINE -> OK with backlog -> recovery prompt appears once
recovery -> exactly one physical copy per operator click
submitted SPOOLING job + printer reconnect -> prints once and same attempt reaches COMPLETE
browser/QZ observation loss after submission -> no automatic retry
manual “A via foi impressa” -> one idempotent increment
manual “Não foi impressa — reenviar” -> explicit duplicate-risk warning + new attempt
operational pagination -> 10/page, newest first, stable sorting
recent completed -> max 10, no old-history archive
30-day cleanup -> only printed/discarded terminals removed
```

- [ ] **13.3 Verify no active doc still states that queue discovery proves physical readiness or that qz.print resolution is final completion.**

```bash
grep -R "Pronta para enviar\|envio aceito.*QZ/Windows" docs/operations docs/order-printing-mtp5-acceptance.md
```

Expected: no misleading active instruction remains; historical spec text is not part of this grep scope.

- [ ] **13.4 Commit.**

```bash
git add docs/operations/windows-qz-tray-printing.md docs/order-printing-mtp5-acceptance.md docs/release-and-migration-runbook.md
git commit -m "docs: document confirmed qz print recovery flow"
```

---

## Task 14 — Full verification and staging handoff

**Files**

- No production-code file is introduced by this task.
- Update the implementation ledger/PR description used by the execution session with final SHAs and acceptance evidence.

- [ ] **14.1 Run the complete local validation gate.**

```bash
npm test
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Expected: all green.

- [ ] **14.2 Run focused regression gate once more.**

```bash
node --test \
  worker/orderPrintingMigration.test.js \
  worker/printAttemptRepository.test.js \
  worker/orderPrintingStationHealth.test.js \
  worker/orderPrintingCentralClaim.test.js \
  worker/orderPrintingRecovery.test.js \
  worker/orderPrintingQueueList.test.js \
  worker/orderPrintingRetention.test.js \
  worker/orderPrintingHttp.test.js \
  src/api/printingClient.test.js \
  src/printing/qzTrayTransport.test.js \
  src/printing/qzStatusMonitor.test.js \
  src/printing/qzPrintAttemptController.test.js \
  src/printing/usePrintingManager.test.js \
  src/pages/PrintQueue.test.js \
  src/components/PrintingSettings.test.js
```

- [ ] **14.3 Review the diff for safety boundaries.** Confirm:

```bash
git diff origin/feature/print-operational-safety-issue-36...HEAD --stat
git status --short
git log --oneline --decorate -15
```

There must be no production credential, no direct production DB command, no RawBT/Web Serial reintroduction, and no automatic fallback that calls generic retry after submission risk.

- [ ] **14.4 Open/update a Draft PR against `master` only after all local validation is green.** The PR description must identify Issue #36, migration 0019, physical printer-state gating, `JOB COMPLETE` semantics, unknown-outcome safety, recovery one-copy-at-a-time, 30-day terminal retention, and staging acceptance still required.

- [ ] **14.5 Staging deployment is a human checkpoint.** After explicit approval to deploy staging, run the repository’s **Deploy staging** workflow for this feature branch. It may migrate only `amor-e-sabor-delivery-staging` and deploy only `sistema-para-delivery-staging`.

- [ ] **14.6 Perform physical staging acceptance on the kitchen Windows PC/MPT-II.** Follow the revised checklist and record QZ event evidence for one normal job and one offline/reconnect job. Verify desktop and mobile Print Queue pagination/sorting separately.

- [ ] **14.7 Stop before production.** Do not merge/release production until the user explicitly approves staging results. A successful staging test is not production authorization.

---

## Implementation Order Rationale

The order is deliberately safety-first. Schema and shared state land before API/transport changes; backend attempt persistence lands before any browser starts depending on QZ JOB events; physical health/recovery gates land before automatic execution is changed; Issue #36 pagination is implemented server-first so the UI never ships client-only pagination over partial data. UI and docs come only after the operational contracts are testable.

The highest-risk invariant to protect through all tasks is:

```text
No evidence before qz.print -> safe to remain/retry as pending
submission risk persisted -> never automatic retry/discard
correlated JOB COMPLETE -> exactly one copy counted
lost confirmation after submission -> human decision required
```

This invariant has priority over convenience or throughput.
