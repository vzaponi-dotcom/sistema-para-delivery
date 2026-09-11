# Print Operational Safety + Issue #36 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Windows/QZ print station fail closed on real physical printer state, count a copy only after a correlated QZ/Winspool `JOB COMPLETE`, recover offline backlog one physical copy at a time, and turn the Print Queue into the operational/paginated panel defined by Issue #36.

**Architecture:** Keep the centralized print queue and single primary Windows/QZ executor. Add durable physical-attempt records and an explicit `awaiting_confirmation` job state so submission risk and spooler confirmation are never conflated. QZ `PRINTER` events drive physical readiness, QZ `JOB` events drive attempt completion, and persisted station recovery state gates the automatic consumer. The Print Queue stops treating a large in-memory jobs array as history and reads backend-paginated operational/recent views plus backend summary counts.

**Tech Stack:** React 19, JavaScript/ES modules, Node `node:test`, Cloudflare Worker, Cloudflare D1/SQLite, QZ Tray 2.2.6, Vite, oxlint, Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-09-print-operational-safety-issue-36-design.md`

**Issue:** GitHub #36 — “Transformar fila de impressão em painel operacional com paginação e ordenação”.

## Global constraints

- Work only in a fresh isolated implementation worktree/branch based on `feature/print-operational-safety-issue-36`; never implement directly on `master`.
- Strict TDD for every behavior change: focused failing test first, minimum implementation, focused green test, then refactor.
- Do not deploy production from the feature branch. Staging is the only deploy target before human acceptance.
- Do not read/write production D1 during implementation verification.
- Windows/QZ primary station is the only physical executor; mobile/other browsers remain queue-only requesters.
- `qz.print()` resolving is not completion. `copies_printed` changes only after a correlated `JOB COMPLETE` or explicit human resolution of an uncertain attempt.
- Persist the submission-risk point **before** invoking `qz.print()`. After that point, automatic retry and bulk discard are forbidden.
- Only physical health `ready` may start a copy. `verifying`/unknown/offline/attention all fail closed.
- Recovery states are exactly `normal`, `pending`, `active`, `deferred`.
- Automatic retention is exactly 30 days and removes only `printed` and `discarded`; never automatically purge `failed`, `requires_attention`, `pending`, `processing`, `awaiting_confirmation`, or `awaiting_second_copy`.
- Operational UI page size is at most 10; completed-recent block is at most 10 and is not historical navigation.
- Preserve Mesa/local automatic 1-copy rule, current second-copy decision semantics, reprint-as-new-job behavior, ticket renderer and central business copy setting.

## Execution preflight

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

Expected: clean worktree and green baseline. Any pre-existing red baseline is diagnosed before feature edits.

---

## Task 1 — Extend D1 for physical confirmation and recovery

**Files**
- Create: `migrations/0019_print_operational_confirmation.sql`
- Modify: `worker/orderPrintingMigration.test.js`

**Contract:** add `awaiting_confirmation`, physical/recovery station metadata and `print_job_attempts` without losing 0018 data.

- [ ] **1.1 RED:** extend migration tests to require 0019 and prove a database valid through 0018 migrates without losing existing jobs.

Required assertions include:

```js
assert.match(sql0019, /awaiting_confirmation/)
assert.match(sql0019, /CREATE TABLE print_job_attempts/)
assert.match(sql0019, /spool_job_name TEXT NOT NULL UNIQUE/)
assert.match(sql0019, /submission_started_at TEXT/)
assert.match(sql0019, /recovery_state TEXT NOT NULL DEFAULT 'normal'/)
assert.match(sql0019, /physical_status_text TEXT/)
```

- [ ] **1.2 Confirm RED:** `node --test worker/orderPrintingMigration.test.js`

- [ ] **1.3 GREEN:** create migration 0019 using the existing SQLite table-rebuild pattern for `print_jobs.status`. Preserve every existing 0018 column. Add to `print_stations`:

```sql
physical_state TEXT NOT NULL DEFAULT 'verifying'
  CHECK (physical_state IN ('ready','verifying','printer_offline','printer_attention','qz_unavailable','printer_not_found','unconfigured','unsupported')),
physical_status_text TEXT,
physical_status_code INTEGER,
physical_status_at TEXT,
last_offline_at TEXT,
recovery_state TEXT NOT NULL DEFAULT 'normal'
  CHECK (recovery_state IN ('normal','pending','active','deferred'))
```

Create `print_job_attempts` with one row per physical copy attempt:

```sql
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

New `print_jobs.status` CHECK:

```sql
CHECK (status IN ('pending','processing','awaiting_confirmation','awaiting_second_copy','printed','failed','requires_attention','discarded'))
```

Recreate all current indexes; active-status index includes `awaiting_confirmation` and `awaiting_second_copy`.

- [ ] **1.4 Verify GREEN:**

```bash
node --test worker/orderPrintingMigration.test.js
npm run d1:migrate:local
```

- [ ] **1.5 Commit:** `feat: add durable print attempt state`

---

## Task 2 — Define shared queue and physical-health semantics

**Files**
- Modify: `shared/printQueue.js`
- Modify: `shared/printQueue.test.js`
- Modify: `shared/printQueueActions.js`
- Modify: `shared/printQueueActions.test.js`
- Create: `shared/printStationHealth.js`
- Create: `shared/printStationHealth.test.js`

- [ ] **2.1 RED:** specify `awaiting_confirmation -> waiting_confirmation`, label `Aguardando confirmação`, valid transitions, and unknown-outcome actions.

```js
assert.equal(resolvePrintQueueState('awaiting_confirmation'), 'waiting_confirmation')
assert.equal(getPrintQueueLabel('awaiting_confirmation'), 'Aguardando confirmação')
assert.equal(canTransitionPrintQueueState('processing', 'awaiting_confirmation'), true)
assert.equal(canTransitionPrintQueueState('awaiting_confirmation', 'printed'), true)
assert.deepEqual(getPrintJobActions({
  status: 'requires_attention',
  type: 'order',
  lastError: { code: 'PRINT_OUTCOME_UNKNOWN' },
}), [
  { key: 'confirmPrinted', label: 'A via foi impressa' },
  { key: 'confirmNotPrinted', label: 'Não foi impressa — reenviar' },
])
```

Health tests require `OK` + QZ + queue => ready; `OFFLINE`, paper/error/intervention, unknown, or verifying => not ready.

- [ ] **2.2 Confirm RED:**

```bash
node --test shared/printQueue.test.js shared/printQueueActions.test.js shared/printStationHealth.test.js
```

- [ ] **2.3 GREEN:** add `WAITING_CONFIRMATION`, alias `awaiting_confirmation`, label and transitions:

```text
PRINTING -> WAITING_CONFIRMATION
WAITING_CONFIRMATION -> WAITING_SECOND_COPY | PRINTED | ATTENTION
```

- [ ] **2.4 GREEN:** implement one normalized health source. `normalizePrinterHealth()` only returns `{ state:'ready', ready:true }` when QZ is connected, configured queue is found, and physical status is `OK`. Known blocking Winspool/QZ statuses map to `printer_offline` or `printer_attention`; unknown informational state maps to `verifying`.

- [ ] **2.5 GREEN:** canonicalize `PRINT_OUTCOME_UNKNOWN`; for this reason, expose only `confirmPrinted` / `confirmNotPrinted`, never generic retry/discard.

- [ ] **2.6 Verify GREEN:** same focused command.
- [ ] **2.7 Commit:** `feat: define physical print confirmation states`

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
createPrintJobAttempt(db, businessId, { jobId, stationId, copyNumber }, now)
markPrintAttemptSubmitting(db, businessId, attemptId, stationId, now)
recordPrintAttemptEvent(db, businessId, attemptId, stationId, event, now)
markPrintAttemptUnknown(db, businessId, attemptId, stationId, reason, now)
resolveUnknownPrintAttempt(db, businessId, jobId, attemptId, resolution, actorLabel, now)
listPrintJobAttempts(db, businessId, jobId)
```

- [ ] **3.1 RED:** first attempt gets number 1 and exact name `GESTAO-DELIVERY:<jobId>:COPY:<n>:ATTEMPT:<n>`. `markPrintAttemptSubmitting` sets `submission_started_at` and parent job `awaiting_confirmation`, while `copiesPrinted` remains zero.

- [ ] **3.2 RED:** `SPOOLING` and `PRINTING` do not increment; first correlated `COMPLETE` increments exactly once; duplicate `COMPLETE` is idempotent.

- [ ] **3.3 RED:** observation loss after submission becomes attempt `unknown` + job `requires_attention`/`PRINT_OUTCOME_UNKNOWN`. `manual_printed` increments exactly once; `manual_not_printed` records explicit resolution and returns the job to `pending`, so the next physical attempt becomes attempt 2.

- [ ] **3.4 RED:** stale `processing` may become unknown attention; `awaiting_confirmation` must never age back to retryable `pending`. If it becomes unresolved because station observation disappeared, only canonical `PRINT_OUTCOME_UNKNOWN` is allowed.

- [ ] **3.5 Confirm RED:**

```bash
node --test worker/printAttemptRepository.test.js worker/orderPrintingRepository.test.js worker/orderPrintingAttention.test.js
```

- [ ] **3.6 GREEN:** keep attempt-specific SQL in `worker/printAttemptRepository.js`. Allocate `attempt_number = MAX(...)+1` scoped to `(job_id, copy_number)`. Validate job, station, business and expected copy number before creation.

- [ ] **3.7 GREEN:** normalize job events. `SPOOLING`/`SCHEDULED`/`SENT` = accepted/submitted evidence; `PRINTING`/`RETAINED` = in progress; `COMPLETE` = success. `DELETED`/`CANCELED`/`ABORTED`/error/offline/paper/intervention without prior COMPLETE must not authorize automatic retry; resolve conservatively to attention/unknown.

- [ ] **3.8 GREEN:** completion transactionally checks attempt is not already complete, then increments by one and derives:

```js
const nextCopies = Math.min(job.copiesRequested, job.copiesPrinted + 1)
const nextStatus = nextCopies >= job.copiesRequested ? 'printed' : 'awaiting_second_copy'
```

Preserve snapshot and second-copy audit fields.

- [ ] **3.9 Verify GREEN:** same focused command.
- [ ] **3.10 Commit:** `feat: persist qz print attempts and completion`

---

## Task 4 — Persist real printer health and backlog-recovery gates

**Files**
- Modify: `worker/orderPrintingRepository.js`
- Modify: `worker/orderPrintingStationHealth.test.js`
- Modify: `worker/orderPrintingCentralClaim.js`
- Modify: `worker/orderPrintingCentralClaim.test.js`
- Create: `worker/orderPrintingRecovery.test.js`

**Interfaces**

```js
heartbeatPrintStation(db, businessId, stationId, health, now)
setPrintRecoveryState(db, businessId, stationId, state, now)
claimNextRecoveryPrintJob(db, businessId, stationId, now)
discardPendingPrintJobs(db, businessId, actorLabel, now)
```

- [ ] **4.1 RED:** QZ + queue present with `physicalState:'printer_offline'` is not ready. Ready requires fresh heartbeat, primary Windows, QZ and physical ready.

- [ ] **4.2 RED:** true offline/stale -> ready transition with safe pending backlog sets `recoveryState='pending'`; recurring heartbeat while already fresh/ready does not create a recovery cycle.

- [ ] **4.3 RED:** normal `claimNextPrintJob()` returns no job for `pending|active|deferred` recovery state. `claimNextRecoveryPrintJob()` may claim exactly one eligible job only in `active`.

- [ ] **4.4 RED:** bulk discard touches only `status='pending'`, `copies_printed=0`, and no attempt with non-null `submission_started_at`; never discard `awaiting_confirmation`, second copy, attention, or potentially submitted work.

- [ ] **4.5 Confirm RED:**

```bash
node --test worker/orderPrintingStationHealth.test.js worker/orderPrintingCentralClaim.test.js worker/orderPrintingRecovery.test.js
```

- [ ] **4.6 GREEN:** persist physical fields and derive recovery transition using previous station health before heartbeat write. A stale prior heartbeat counts as previously unavailable.

- [ ] **4.7 GREEN:** gate normal claim on recovery state normal; recovery claim uses same priority/order/business/order-safety rules but requires active and one explicit call.

- [ ] **4.8 GREEN:** valid state transitions:

```text
normal -> pending
pending -> active | deferred | normal
active -> active | deferred | normal
deferred -> active | normal
```

Only an explicitly controlled recovery cycle returns to normal when no safe backlog remains.

- [ ] **4.9 Verify GREEN:** same focused command.
- [ ] **4.10 Commit:** `feat: gate printing on physical recovery state`

---

## Task 5 — Backend pagination, sorting, summary and 30-day retention

**Files**
- Modify: `worker/orderPrintingRepository.js`
- Create: `worker/orderPrintingQueueList.test.js`
- Create: `worker/orderPrintingRetention.test.js`

**Interface**

```js
listPrintJobs(db, businessId, options) -> { jobs, pageInfo }
getPrintQueueSummary(db, businessId, now) -> summary
purgeExpiredTerminalPrintJobs(db, businessId, now) -> number
```

UI options:

```js
{
  scope: 'operational' | 'recent', page: 1, pageSize: 10,
  sortBy: 'orderNumber' | 'jobId' | 'status' | 'trigger' | 'createdAt',
  sortDir: 'asc' | 'desc', status: '', trigger: '', search: '', now,
}
```

Keep an `orderId` lookup path for OrderDetail/History compatibility; do not force UI pagination onto executor-internal reads.

- [ ] **5.1 RED:** operational scope contains only `pending`, `processing`, `awaiting_confirmation`, `awaiting_second_copy`, `failed`, `requires_attention`, defaults `createdAt DESC`, max 10/page and exact page metadata.

- [ ] **5.2 RED:** stable sorting for numeric `orders.order_number`, lexical job id, status/trigger and real timestamp. Page 1+2 have no duplicate/omitted rows. Invalid sort input falls back safely.

- [ ] **5.3 RED:** backend search/filter runs before pagination and matches order number, customer and table identity; status and trigger filters are server-side.

- [ ] **5.4 RED:** `scope='recent'` returns only `printed|discarded`, newest first, at most 10 and no navigable archive pages.

- [ ] **5.5 RED:** 31-day-old `printed` and `discarded` are purged; equally old `failed`, `requires_attention`, `pending`, `processing`, `awaiting_confirmation`, `awaiting_second_copy` remain.

- [ ] **5.6 Confirm RED:** `node --test worker/orderPrintingQueueList.test.js worker/orderPrintingRetention.test.js`

- [ ] **5.7 GREEN:** use whitelist SQL mapping only:

```js
const PRINT_JOB_SORT_SQL = Object.freeze({
  orderNumber: 'orders.order_number',
  jobId: 'print_jobs.id',
  status: 'print_jobs.status',
  trigger: 'print_jobs.trigger',
  createdAt: 'print_jobs.created_at',
})
```

Clamp page size to 10 and add stable `created_at,id` tiebreakers.

- [ ] **5.8 GREEN:** summary is independent of current page:

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

`attention` combines `failed` + `requires_attention` for operator-facing count.

- [ ] **5.9 GREEN:** opportunistic 30-day cleanup runs from operational listing/summary request, at most once per request; no scheduler required for this delivery.

- [ ] **5.10 Verify GREEN:** include repository regressions.
- [ ] **5.11 Commit:** `feat: make print queue an operational data view`

---

## Task 6 — Expose backend contracts and client helpers

**Files**
- Modify: `worker/orderPrintingApi.js`
- Modify: `worker/orderPrintingHttp.test.js`
- Modify: `src/api/client.js`
- Modify: `src/api/printingClient.test.js`

**Routes**

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

- [ ] **6.1 RED:** HTTP tests for every route: same-origin mutations, business/station scoping, exact fields, page-size clamp, sort fallback. Attempt-event endpoint must reject events whose `jobName` does not equal the stored attempt `spool_job_name`, and reject mismatched station/business.

- [ ] **6.2 RED:** client helpers:

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

- [ ] **6.3 Confirm RED:** `node --test worker/orderPrintingHttp.test.js src/api/printingClient.test.js`

- [ ] **6.4 GREEN:** wire repository functions. `GET /jobs` returns `{jobs,pageInfo}`, summary returns `{summary}`. Keep legacy `/complete` temporarily for compatibility, but the QZ physical executor built below must no longer use it as a transport-success signal.

- [ ] **6.5 GREEN:** heartbeat accepts only approved health fields and server-validates readiness: `printerReady=true` is invalid/effectively false unless `physicalState==='ready'`.

- [ ] **6.6 GREEN:** client uses `URLSearchParams`, omits empty filters and preserves `credentials:'same-origin'`.

- [ ] **6.7 Verify GREEN:** same focused command.
- [ ] **6.8 Commit:** `feat: expose print safety and operational queue api`

---

## Task 7 — Listen to real QZ PRINTER/JOB events and set unique job names

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

QZ 2.2.6 surface already physically verified:

```js
qzApi.printers.setPrinterCallbacks(callback)
await qzApi.printers.startListening(printerName)
await qzApi.printers.getStatus()
await qzApi.printers.stopListening()
qzApi.configs.create(selectedPrinter, { jobName })
```

- [ ] **7.1 RED:** table-driven physical PRINTER event classification: `OK -> ready`; `OFFLINE -> printer_offline`; paper/error/intervention -> `printer_attention`; unknown/info -> verifying/not ready.

- [ ] **7.2 RED:** prove exact custom `jobName` reaches `qz.configs.create`.

- [ ] **7.3 RED:** monitor installs callback before listening, fetches current status, ignores unrelated printer/jobs, and resolves a waiter only for matching `JOB COMPLETE`. `stop()`/connection loss rejects unresolved waiters with `QZ_OBSERVATION_LOST`.

- [ ] **7.4 Confirm RED:** `node --test src/printing/qzTrayTransport.test.js src/printing/qzStatusMonitor.test.js`

- [ ] **7.5 GREEN:** normalize QZ event fields (`printerName`, `eventType`, `statusText`, `statusCode`, `severity`, `jobId`, `jobName`) and route only current configured printer / Gestão Delivery job names.

- [ ] **7.6 GREEN:** `deriveQzOperationalState` includes physical state and only sets operational ready for shared health `ready`.

- [ ] **7.7 Verify GREEN:** same focused command.
- [ ] **7.8 Commit:** `feat: monitor physical qz printer and job status`

---

## Task 8 — Replace `qz.print()` success with durable spooler confirmation

**Files**
- Create: `src/printing/qzPrintAttemptController.js`
- Create: `src/printing/qzPrintAttemptController.test.js`
- Modify: `src/printing/printJobRunner.js`
- Modify: `src/printing/printJobRunner.test.js`
- Modify: `src/printing/centralizedPrintExecutor.test.js`
- Modify: `src/printing/usePrintingManager.js`
- Modify: `src/printing/usePrintingManager.test.js`
- Modify: `src/printing/printingHeartbeat.test.js`

**Controller**

```js
executeQzPrintAttempt({
  job, stationId, renderer, createAttempt, markSubmitting,
  sendBytes, awaitOutcome, markUnknown,
}) -> { status: 'confirmed' | 'unknown' | 'failed', job?, attempt?, error? }
```

- [ ] **8.1 RED:** assert exact sequence:

```text
render
-> createAttempt
-> markSubmitting (submission risk persisted)
-> register outcome promise
-> qz.print
-> await outcome promise
-> correlated COMPLETE persisted
-> refresh/finish
```

The intended non-blocking registration pattern is explicit:

```js
const outcomePromise = awaitOutcome(attempt.spoolJobName) // register waiter; do not await yet
await sendBytes(bytes, { jobName: attempt.spoolJobName })
const outcome = await outcomePromise
```

This prevents a fast SPOOLING/COMPLETE event from being missed without deadlocking before `qz.print()`.

- [ ] **8.2 RED:** fake `sendBytes` resolves immediately but execution remains unsettled until correlated COMPLETE. Physical path never calls `completePrintJob` merely because transport resolved.

- [ ] **8.3 RED:** any exception after `markSubmitting` that cannot positively prove the spooler did not accept the copy becomes `markUnknown`; never route to generic retry/failure that could requeue it automatically.

- [ ] **8.4 RED:** normal automatic consumer additionally requires `physicalReady===true` and `recoveryState==='normal'`; queue-found alone is insufficient.

- [ ] **8.5 RED:** heartbeat payload derives `printerReady` only from `printerHealth.state==='ready'` and includes normalized physical fields.

- [ ] **8.6 Confirm RED:**

```bash
node --test src/printing/qzPrintAttemptController.test.js src/printing/printJobRunner.test.js src/printing/centralizedPrintExecutor.test.js src/printing/usePrintingManager.test.js src/printing/printingHeartbeat.test.js
```

- [ ] **8.7 GREEN:** keep copy selection/rendering in `printJobRunner`; remove its assumption that transport resolution authorizes completion. QZ attempt controller owns submission/confirmation.

- [ ] **8.8 GREEN:** integrate monitor lifecycle:

```text
ensure QZ -> resolve configured queue -> verifying -> start listener -> get current status -> ready only after physical OK
```

On websocket close: fail local observation waiters, invalidate readiness, set `qz_unavailable`; submitted attempts are never resent automatically.

- [ ] **8.9 GREEN:** tracked JOB events are persisted through API. COMPLETE only finishes the client execution after server persistence succeeds.

- [ ] **8.10 GREEN:** preserve second-copy behavior: first confirmed copy -> `awaiting_second_copy`; explicit second-copy action runs the same durable controller for exactly one copy.

- [ ] **8.11 Verify GREEN:** same focused command.
- [ ] **8.12 Commit:** `feat: confirm qz copies from spooler job events`

---

## Task 9 — Controlled offline-backlog recovery

**Files**
- Create: `src/printing/printRecoveryFlow.js`
- Create: `src/printing/printRecoveryFlow.test.js`
- Modify: `src/printing/usePrintingManager.js`
- Modify: `src/printing/usePrintingManager.test.js`
- Modify: `src/App.jsx`
- Create: `src/printRecoveryUi.test.js`

**Manager API**

```js
startRecovery()
deferRecovery()
resumeRecovery()
printNextRecovery()
discardRecoveryBacklog()
confirmUnknownPrinted(job, attempt)
confirmUnknownNotPrinted(job, attempt)
```

State:

```js
recoveryState
recoveryPendingCount
recoveryPromptEligible
```

- [ ] **9.1 RED:** `pending + ready + safeBacklog>0` makes one recovery prompt eligible. `deferred` does not reopen on refresh/poll. A later genuine offline->ready cycle may create a new pending state.

- [ ] **9.2 RED:** `Imprimir agora` sets active and runs exactly one recovery claim/copy. After COMPLETE it stops. `Imprimir próxima` runs exactly one more. `Parar por agora` sets deferred.

- [ ] **9.3 RED:** while recovery state is not normal, timer-driven normal consumer makes zero normal claims even when new jobs arrive.

- [ ] **9.4 RED:** two-copy job still requires explicit second-copy decision; second copy never auto-fires during recovery.

- [ ] **9.5 RED:** app strings/actions:

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

- [ ] **9.6 Confirm RED:** `node --test src/printing/printRecoveryFlow.test.js src/printing/usePrintingManager.test.js src/printRecoveryUi.test.js`

- [ ] **9.7 GREEN:** put eligibility/transitions in pure helper; React effects only orchestrate persisted state.

- [ ] **9.8 GREEN:** bulk discard calls safe backend action and refreshes exact counts; it never touches potentially submitted/second-copy work.

- [ ] **9.9 GREEN:** integrate existing modal/dialog components. `Descartar todas` has explicit destructive confirmation with exact count. No actionable recovery modal while physical printer is offline.

- [ ] **9.10 Verify GREEN:** same focused command.
- [ ] **9.11 Commit:** `feat: recover offline print backlog one copy at a time`

---

## Task 10 — Show one operational health model in Settings

**Files**
- Modify: `src/components/PrintingSettings.jsx`
- Modify: `src/components/PrintingSettings.test.js`
- Modify: `src/printing/printing.css`

- [ ] **10.1 RED:** require approved primary labels:

```text
Pronta para imprimir
Verificando impressora…
Impressora desligada ou desconectada
Atenção necessária na impressora
QZ Tray indisponível
Impressora não encontrada
Impressora não configurada
```

Reject old implication that “Fila encontrada” means ready.

- [ ] **10.2 RED:** show `Há 4 trabalhos aguardando impressão` and `1 via enviada à impressora aguardando confirmação` with singular/plural handling.

- [ ] **10.3 RED:** physical test/send controls disabled unless shared printer health is `ready`; queue-only clients still have no physical controls.

- [ ] **10.4 Confirm RED:** `node --test src/components/PrintingSettings.test.js`

- [ ] **10.5 GREEN:** use `printing.printerHealth` as the primary operational source; keep QZ/queue diagnostics secondary and descriptive.

- [ ] **10.6 GREEN:** semantic CSS tokens only; preserve light/dark, focus-visible and mobile layout.

- [ ] **10.7 Verify GREEN:** same focused command.
- [ ] **10.8 Commit:** `feat: show real printer health in settings`

---

## Task 11 — Transform Print Queue into Issue #36 operational panel

**Files**
- Create: `src/pages/printQueueQuery.js`
- Create: `src/pages/printQueueQuery.test.js`
- Modify: `src/pages/PrintQueue.jsx`
- Modify: `src/pages/PrintQueue.test.js`
- Modify: `src/pages/printQueueSummary.js`
- Modify: `src/pages/printQueueDetails.js`
- Modify: `src/print-queue.css`
- Modify: `src/components/PrintStatusBadge.jsx`
- Create: `src/components/PrintStatusBadge.test.js`

**Query state**

```js
{
  page: 1, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc',
  status: '', trigger: '', search: '',
}
```

- [ ] **11.1 RED:** default newest-first; same header toggles direction; new sort column resets predictably; any filter/search/sort change resets page 1; page size remains 10.

- [ ] **11.2 RED:** component renders only rows returned by backend page and uses backend `pageInfo`; no client pagination over `printing.jobs`.

- [ ] **11.3 RED:** sortable desktop headers Pedido, Job, Status, Origem, Data/Hora with visible indicator and correct `aria-sort`. Pedido sorts by numeric order number; date by real `createdAt`.

- [ ] **11.4 RED:** a tabela principal contém jobs ativos por padrão e consulta jobs terminais pelos filtros **Impresso** e **Descartado**; não existe painel separado de impressões recentes.

- [ ] **11.5 RED:** summary displays `Aguardando impressão`, `Aguardando confirmação`, `Aguardando 2ª via`, `Requer atenção`. `awaiting_confirmation` badge/detail is `Aguardando confirmação`.

- [ ] **11.6 RED:** after the new COMPLETE semantics, `printed` badge text must be **`Impresso`**, replacing the old “Enviado para impressão” wording.

- [ ] **11.7 RED:** `PRINT_OUTCOME_UNKNOWN` detail shows:

```text
Não foi possível confirmar esta impressão
Esta via pode ter sido impressa antes de a conexão ser interrompida.
A via foi impressa
Não foi impressa — reenviar
```

Reenviar opens a second warning explicitly mentioning duplicate risk before `confirmUnknownNotPrinted`.

- [ ] **11.8 RED:** offline/backlog banner: `Impressora indisponível · X trabalhos aguardando impressão`; deferred/active recovery exposes persistent resume/next action without refresh-spam.

- [ ] **11.9 RED:** pagination hidden for one page and shown only for >1; mobile cards show same backend page and preserve identity/status/origin/copies/time.

- [ ] **11.10 Confirm RED:**

```bash
node --test src/pages/printQueueQuery.test.js src/pages/PrintQueue.test.js src/components/PrintStatusBadge.test.js
```

- [ ] **11.11 GREEN:** leitura paginada principal e resumo independente:

```js
getPrintJobs(query)
getPrintQueueSummary()
```

Refresh after actions and on existing page-open polling cadence; use a generation/ref guard against stale responses.

- [ ] **11.12 GREEN:** preserve ticket, force-print, second-copy and reprint detail actions. Jobs terminais permanecem pesquisáveis apenas durante a retenção segura de 30 dias.

- [ ] **11.13 GREEN:** responsive desktop table / <=640px cards; active/attention remains visually strong; existing design tokens only.

- [ ] **11.14 Verify GREEN:** same focused command.
- [ ] **11.15 Commit:** `feat: turn print queue into operational panel`

---

## Task 12 — Preserve History as the source for old-order reprints after retention

**Files**
- Modify: `src/components/OrderDetail.jsx`
- Modify: `src/pages/OrderHistory.test.js`
- Create: `src/components/OrderDetailPrinting.test.js`
- Modify: `src/pages/OrderHistory.jsx` only if the regression proves a real integration gap; otherwise leave it untouched.

**Important retention consequence:** after 30 days the original terminal print job may no longer exist. Historical reprint must therefore be able to start from the retained order itself.

- [ ] **12.1 RED:** finalized historical order opened from History with `printJob=null` must still present **`Reimprimir`** (not “Imprimir pedido”) and call `printing.printOrder(order.id, copies)` to create a fresh manual job from the order. It must not require `parent_job_id` when the old job has been purged.

- [ ] **12.2 RED:** when the old print job still exists, preserve the existing `printing.requestReprint(printJob, copies)` path so the new job keeps `parent_job_id` audit linkage.

- [ ] **12.3 RED:** both historical paths continue allowing 1 or 2 copies, including Mesa/consumo local. The automatic 1-copy Mesa rule does not constrain an explicit manual reprint.

- [ ] **12.4 RED:** retain the existing History integration assertion that terminal orders open `OrderDetail` with the current `latestJobByOrderId` when one exists, while absence of that job does not disable reprint.

- [ ] **12.5 Confirm RED:**

```bash
node --test src/pages/OrderHistory.test.js src/components/OrderDetailPrinting.test.js
```

- [ ] **12.6 GREEN:** make the minimum `OrderDetail.jsx` change: distinguish an initial print for an active/no-history order from a historical reprint for a terminal order. For terminal order without retained job, label/action is Reimprimir and uses `printOrder`; with retained job, use current `requestReprint` confirmation flow.

- [ ] **12.7 Verify GREEN:** same focused command.
- [ ] **12.8 Commit:** `feat: preserve order-based historical reprints`

---

## Task 13 — Rewrite operational docs and physical acceptance checklist

**Files**
- Modify: `docs/operations/windows-qz-tray-printing.md`
- Modify: `docs/order-printing-mtp5-acceptance.md`
- Modify: `docs/release-and-migration-runbook.md` only if migration-0019 impact needs a concrete addition beyond the existing generic forward-migration rules.

- [ ] **13.1** Document observed truth:

```text
PRINTER OK -> may start copy
PRINTER OFFLINE -> do not claim/send new copy
JOB COMPLETE -> count copy
SPOOLING without COMPLETE -> may print later; never auto-resend
```

Explain awaiting confirmation, one-copy-at-a-time recovery, deferred recovery, manual unknown resolution and that Winspool COMPLETE is the strongest available operational confirmation, not an independent paper sensor.

- [ ] **13.2** Acceptance checklist must cover: printer off before new job; OFFLINE->OK backlog prompt once; one copy per recovery click; retained SPOOLING job printing once after reconnect; observation loss no auto-retry; both manual unknown resolutions; 10/page stable sort; recent max 10; 30-day safe cleanup; desktop + mobile.

- [ ] **13.3** Verify no active doc still states queue discovery proves readiness or qz.print resolution means final success:

```bash
grep -R "Pronta para enviar\|envio aceito.*QZ/Windows" docs/operations docs/order-printing-mtp5-acceptance.md
```

Expected: no misleading active instruction remains.

- [ ] **13.4 Commit:** `docs: document confirmed qz print recovery flow`

---

## Task 14 — Full verification, PR and staging handoff

- [ ] **14.1 Complete local gate:**

```bash
npm test
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

- [ ] **14.2 Focused safety regression gate:**

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
  src/components/PrintingSettings.test.js \
  src/components/OrderDetailPrinting.test.js
```

- [ ] **14.3 Diff safety review:**

```bash
git diff origin/feature/print-operational-safety-issue-36...HEAD --stat
git status --short
git log --oneline --decorate -15
```

No production credentials/DB commands; no RawBT/Web Serial reintroduction; no automatic generic retry after submission risk.

- [ ] **14.4** Open/update a Draft PR against `master` only after green validation. PR body identifies Issue #36, migration 0019, PRINTER/JOB gating, `JOB COMPLETE`, unknown-outcome policy, one-copy recovery, 30-day retention, and staging acceptance required.

- [ ] **14.5 Human checkpoint:** only after explicit approval, run **Deploy staging** for the implementation branch. It may migrate only `amor-e-sabor-delivery-staging` and deploy only `sistema-para-delivery-staging`.

- [ ] **14.6 Physical staging acceptance on kitchen Windows/MPT-II:** execute revised checklist, record one normal JOB lifecycle and one offline/reconnect lifecycle, then verify desktop/mobile pagination and sorting.

- [ ] **14.7 STOP before production.** Do not merge/release production until explicit user approval of staging results.

---

## Implementation order rationale

Safety state and persistence land before QZ behavior; backend attempt persistence lands before the browser depends on JOB callbacks; physical readiness/recovery gates land before changing the automatic executor; Issue #36 pagination is server-first so the UI never sorts only a partial page. UI/docs follow only once the contracts are testable.

The invariant that overrides convenience is:

```text
No evidence before qz.print -> safe to remain/retry as pending
submission risk persisted -> never automatic retry/discard
correlated JOB COMPLETE -> exactly one copy counted
lost confirmation after submission -> human decision required
```
