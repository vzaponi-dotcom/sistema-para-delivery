# Spec B execution ledger — business settings and policies

## Provenance and authorization

- Application base: `8d2f897154526037606e9fee60f4b9a606089e8a` (`origin/master` at preparation).
- Approved documentation / implementation initial HEAD: `c4c020fa209d1bb2cb850bd59654af5dfca60134`.
- Worktree: `C:/Projetos/sistema-para-delivery-spec-b-settings-policies`.
- Branch: `feature/spec-b-settings-policies`.
- Round 1 authorization is limited to T01, T02 and T03.
- T04 is not authorized and remains the next unauthorized task.
- Commits and push are authorized only on `feature/spec-b-settings-policies`; no push was performed in T01 or its correction round.
- Merge, staging/production deploy and remote migrations remain unauthorized.

## Preparation baseline

The controller prepared the isolated worktree and recorded the following real baseline before T01:

| Gate | Result |
|---|---|
| `npm ci` | Exit 0; 50 packages installed; 0 vulnerabilities. |
| `npm run lint` | Exit 0 with pre-existing warnings. |
| `npm run build` | Exit 0 with pre-existing chunk/plugin timing warnings. |
| `npm test` | Hundreds of tests passed, but the process stopped producing output and was interrupted after several minutes; this is not accepted as T01 RED. |

## T01 — typed contracts, defaults and characterization

Status: implemented in the commit containing this ledger, with subject `feat: define typed business policy contracts`.

### Characterization before new contracts

Command:

```text
node --test shared/orderTiming.test.js src/utils/orderWorkflow.test.js worker/validation.test.js shared/orderCustomerIdentity.test.js worker/orderCustomerIdentityCheckout.test.js worker/orderAutomaticPrintJob.test.js
```

Result: exit 0; 54/54 passed. This pins exact immediate 30/40-minute boundaries, scheduled exact/15-minute behavior, monetary rounding, Local table identity and existing one/two-copy behavior.

### RED

Initial discovery run exited 1 because the two new modules did not exist. Minimal export-only stubs were then added so the accepted behavioral RED was not a module-resolution failure.

Command:

```text
node --test shared/businessPolicies.test.js shared/settingsCatalogs.test.js
```

Accepted RED result: exit 1; 0/10 passed. Assertions failed for empty defaults, missing range/key/default validation, absent historical payment mapping, empty native catalogs, missing label normalization and missing catalog invariants.

### GREEN

Command:

```text
node --test shared/businessPolicies.test.js shared/settingsCatalogs.test.js
```

Result: exit 0; 10/10 passed. A later fresh run after boundary additions also exited 0 with 10/10 passed.

### Verification and regression evidence

| Gate | Result |
|---|---|
| `npm.cmd run lint` | Exit 0; only warnings already present outside T01 paths. |
| `npm.cmd run build` | Exit 0; 369 modules transformed; existing large-chunk warning. The first sandboxed attempt hit `EPERM` in `node_modules/.vite-temp`; the authorized local rerun passed. |
| Full `npm.cmd test` outside sandbox | Completed in 57.3 s; 1,199/1,200 passed. One pre-existing failure remained: `src/pages/FinanceMoreMobile.test.js`, test “more menu keeps only approved direct destinations and touch-friendly actions”. Both that test and `src/components/MobileNavigation.jsx` have no diff from `origin/master`. The previously recorded hang did not reproduce. |
| Focused contracts + characterization rerun | Exit 0; 64/64 passed. |
| `git diff --check` / staged diff review | Exit 0 with no whitespace errors; staged patch reviewed and limited to the six explicit T01 paths. |

### Review and blockers

- Self-review: contracts and tests checked against the T01 brief and canonical shapes 3.1; no operational consumer, endpoint, migration or UI file changed.
- Independent review: completed after fix round 1; see the final T01 re-review verdict below.
- Blocker for T01: none.
- Known repository concern: one unrelated pre-existing full-suite assertion failure described above.

## Task progression

- [x] T01 — typed contracts, defaults and characterization.
- [x] T02 — migrations and compatible seeds (completed; review clean).
- [x] T03 — atomic operations repository (completed; review clean).
- [ ] T04 — payment policy repository (not authorized; do not start).

## T01 correction — Fix round 1

Base commit: `a681e0a3ad195f52593668e3b956a1e70ff2ad56` (`feat: define typed business policy contracts`). The correction is the commit containing this ledger, with subject `fix: preserve settings catalog invariants`.

Scope was limited to review findings in the shared catalog contract and this authorization record. No migration, endpoint, UI, operational consumer or later task was changed.

### RED

Command:

```text
node --test shared/settingsCatalogs.test.js
```

Result before the correction: exit 1; 4/10 passed and 6/10 failed. The failures proved that native cancellation items lacked immutable `requiresNote` metadata, trusted `existing` usage/tombstone metadata did not preserve custom identities for either catalog kind, and the automatic finance IDs `sales`/`refunds` were not reserved.

Each added assertion detects a concrete weakening: removal/change of native `requiresNote`, acceptance of forged editable metadata, rename or omission after use, tombstone ID/name recreation, or reuse of either automatic identity.

### GREEN and regression evidence

| Gate | Result |
|---|---|
| `node --test shared/settingsCatalogs.test.js` | Exit 0; 10/10 passed. |
| Contracts plus selected characterizations | Exit 0; 69/69 passed. |
| `npm.cmd run lint` | Exit 0; only the pre-existing warnings outside T01 paths. |
| `git diff --check` | Exit 0; no whitespace errors. |
| Staged diff review | Exactly the ledger, catalog contract and catalog test; `git diff --cached --check` exited 0. |

### Review state

- Self-review: source, tests, ledger and final staged patch reviewed against all four findings; no out-of-scope path is staged.
- Initial independent review: three Important findings, covering native `requiresNote`, custom-item permanence from trusted `existing` metadata, and reservation of automatic finance IDs.
- Fix round 1: committed as `a18e5650f9155c18f8b169720feb4819215cf642` (`fix: preserve settings catalog invariants`).
- Independent re-review: all three Important findings addressed; no new Critical or Important findings.
- Deferred Minor: the mutable `Set` returned by `settingsGrants` remains intentionally deferred to the final review and was not expanded into this correction.
- T01 status: completed, review clean for Critical/Important severity.
- T02/T03 were not started; T04 remains unauthorized.

### Next authorized task at T01 closure

- T02 is the next authorized task and has not been started.
- T04 remains unauthorized.
- No push was performed as part of this bookkeeping closure.

## T02 — migrations and compatible seeds

Status: completed, review clean. Implementation commit: `966724e4da4378eeb3c494b3bd46bf1368168be2` (`feat: persist typed business settings with compatible seeds`).

Base: `cdd81df31c4257140a11a048ffdfb296e55322fb`. Read all historical migrations 0001–0023 before writing the tests. Migration 0024 was free and no historical migration was changed.

### Implementation and preservation

- Added `migrations/0024_business_settings_policies.sql`: typed operation/payment settings, native modalities/methods, cancellation/finance catalog headers and items, print topology, receipts and SQL assertion guards.
- Added only the requested print-policy, station-revision and nullable order-snapshot columns. `print_jobs` and `print_job_attempts` were not rebuilt or altered.
- Seeded every existing business at revision 1 using the T01 defaults and native catalogs. Existing `business_print_settings.default_copies = 1` and all existing header timestamps remain unchanged; missing headers fall back to 2, while the new table-tab count defaults to 1.
- Inferred earliest first use from payments, cancellation references and movements, including soft-deleted movements and legacy finance/payment values. Native/used identities and first-use evidence have SQL guards. Existing operational references are never rewritten, and historical timing snapshots stay null.
- Deferred composite FKs enforce an active default within the same business while allowing an aggregate to change its default and active entries in either order inside one transaction. Print topology references a station of the same business and is seeded from the real primary station.
- Added `worker/test-support/settingsDb.js`: `createSettingsDb({ beforeSpecB }) -> { db, sqlite, close }`, executing real migration files with the callback between legacy and B; its D1 subset uses bound real SQLite statements and atomic batches, including `RETURNING` and rollback on a failed deferred FK commit.

### RED / GREEN

Command: `node --test worker/settingsMigration.test.js`.

- Initial RED: exit 1, 0/6 passed. Tests executed 0001–0023 with a temporary inline harness and failed on explicit assertions for missing B tables/seeds and missing migration 0024. No missing import or SQL-text regex was used as behavioral evidence. The schema and reusable helper had not been added yet.
- Initial GREEN: exit 0, 6/6 passed after adding 0024.
- Additional RED: exit 1, 6/8 passed; the new catalog-identity test observed a missing rejection and the helper test reported `missing D1 adapter`.
- Final GREEN: exit 0, 8/8 passed after identity guards and extraction of the harness into the reusable helper. A duplicated trigger declaration introduced while patching was found by the test run and removed before this final GREEN.

The upgrade fixture contains three businesses, cancelled/finalized orders, item prices, payments, soft-deleted and active movements, closed table tabs, parent/retry/table-tab jobs, second-copy timestamps, attempts and recovery affinity. Tests compare every pre-B column in all populated historical tables and compare the full stored schema/index records for jobs and attempts. They also exercise bounds, enum failures, cross-business FKs, permanent usage, native identity, valid aggregate replacement, receipt identity, assertion rollback and rollback after the full migration has executed. `PRAGMA foreign_key_check` is empty in empty, upgrade and rollback scenarios.

### Gates

| Gate | Result |
|---|---|
| Focused migration tests | Exit 0; 8/8 passed. |
| Contracts and selected migration/printing/history regressions | Exit 0; 62/62 passed. Exact command below. |
| `npm.cmd run lint` | Exit 0; pre-existing warnings outside T02 paths. |
| `npm.cmd run d1:migrate:local` | Exit 0 using Wrangler 4.128.0; all 24 migrations applied to `.wrangler/state/v3/d1`, explicitly reported `Resource location: local`. |
| Post-migration D1 local query | Exit 0; `PRAGMA foreign_key_check` returned `[]`; latest migration is `0024_business_settings_policies.sql`; print defaults are 2/1 with revision 1. |
| `git diff --check` | Exit 0; no whitespace errors. |

Regression command:

```text
node --test worker/settingsMigration.test.js shared/businessPolicies.test.js shared/settingsCatalogs.test.js worker/orderPrintingMigration.test.js worker/orderCancellationMigration.test.js worker/financeMigration.test.js worker/orderSchedulingMigration.test.js worker/tableTabLifecycleMigration.test.js worker/orderPrintingRecovery.test.js worker/orderAutomaticPrintJob.test.js worker/orderWriteEffects.test.js
```

The first sandboxed npm migration attempt stalled before Wrangler started and was interrupted. An offline retry exited 1 with `ENOTCACHED` and inability to write npm logs. The same authorized local command then succeeded outside the sandbox. This was an execution-environment limitation, not a migration failure; no remote database command was issued.

### Review and next task

- Self-review: checked the full new SQL, helper and tests against the brief, inspected legacy consumers for compatibility, and limited staged paths to the three T02 files plus this ledger.
- Independent review: spec compliant and quality approved; zero Critical, Important or Minor findings.
- The review's `Cannot verify from diff` items concerning RED/GREEN chronology and the local D1 gate were resolved by the controller reading `task-2-report.md` and the actual execution outputs. No verification item remains open for T02.
- T02 is completed with review clean. T03 is the next authorized task and has not started; no T03 repository, transaction module or D1 probe was implemented here. The helper is a SQLite test adapter, not proof of all D1 runtime transaction semantics; that probe remains T03 work.
- T04 remains unauthorized. No endpoint, UI, operational consumer, push, merge or deployment changed in T02.
- Known repository concern remains the unrelated full-suite failure recorded under T01; T02 did not rerun the full frontend suite because the change is limited to migration/test infrastructure.

## T03 — atomic operations, revision and receipts

Status: completed; self-review and independent re-review clean. Implementation commit: `8747f5ae90b66069abdae691eb52e805d52b1cfd` (`feat: save operations atomically with revisions and receipts`). Base: `e32cfa26658189a03ff2c5c1a0fabac78e091acc`.

### Implementation

- Added `loadOperations/saveOperations`, canonical SHA-256 payload hashing, scoped receipt reading and SQL assertion helpers. Client data is fully parsed before preparing SQL. Trusted business context is a separate argument; authorization remains the future HTTP caller's responsibility.
- A single mutation batch contains a revision assertion that inserts even when false, state assertion, typed header/child diff, receipt, assertion cleanup and final aggregate SELECT. The unpublished 0024 insert trigger now classifies revision/unused/policy/invalid failures. Three migration-test expectations were updated to these new SQL errors; no historical migration or operational schema was changed.
- Legitimate absence reads defaults/revision 0. First save materializes the header and three default native children atomically at revision 1. Existing-resource no-ops retain revision and resource timestamps while recording a receipt.
- Replay and receipt-PK races reconcile by reads, never by resubmitting the mutation batch. Identical replay returns the historical committed revision/data; two nullable receipt metadata columns preserve original resource timestamps, including no-op timestamps. No value snapshot/audit log was introduced.
- Receipt validity ends at exactly 24 hours; an expired ID requires review (`SETTINGS_REVISION_CONFLICT`, `reason: receipt_expired`). Expired identity rows are retained so reuse of a no-op mutation cannot silently execute after expiry. Missing receipts mean unconfirmed, not proof of rollback.
- The separate local probe imports the real repository, uses the D1 binding and controls race arrival only; it does not replace D1 or add routes to the application Worker. The runner creates a temporary config/database, strips inherited credentials, uses local migrations and loopback, and stops/removes its own temporary state in `finally`.

### RED / GREEN chronology

1. Initial focused RED: `node --test worker/settingsTransactions.test.js worker/operationSettingsRepository.test.js` exited 1, 0/11 passed. Minimal export-only stubs made each failure behavioral: two accepted writers, missing rollback rejection, absent replay/no-op/absence results, absent schema/contract rejection, absent canonical hash/assertion/receipt behavior.
2. Initial GREEN with migration regression: 19/19 passed. All eleven focused behaviors plus eight migration tests were green.
3. Additional RED: repository tests 9/11 passed. A duplicate commit between receipt lookup and resource read incorrectly conflicted; missing typed columns in a schema with no header incorrectly returned defaults. GREEN after scoped receipt reread and explicit schema-column projections: 22/22 including migration tests.
4. Additional RED: repository tests 11/12 passed; a receipt hid a dropped assertion table on replay. GREEN after validating schema/current-state health before returning the historical receipt result.
5. Final focused plus migration: 25/25 passed. Additional real-SQL acceptance checks for lost/delayed transport responses, late receipt rollback and concurrent differing-payload reuse also passed; these extend already demonstrated behaviors without adding new production branches.

### Final verification

| Gate | Result |
|---|---|
| `node --test worker/settingsTransactions.test.js worker/operationSettingsRepository.test.js worker/settingsMigration.test.js` | Exit 0; 25/25 (17 focused + 8 migration regression). |
| Contracts, focused tests and selected historical migration/printing/write regressions | Exit 0; 79/79; exact command in the task report. |
| `npm.cmd run lint` | Exit 0; no warnings in T03 paths; pre-existing warnings elsewhere only. |
| `node scripts/infra/spec-b-d1-gate.mjs` | Exit 0; real local D1/Worker, Wrangler 4.128.0, 24 local migrations, all nine scenario groups true. Final execution repeated after the replay fix and runner lint cleanup. |
| `git diff --check` | Exit 0; no whitespace errors. |

The real D1 gate confirms: initial revision-0 race; ordinary revision race with one winner and no losing child/receipt changes; full rollback on second-child failure and after receipt insertion; historical replay/reuse rejection; no-op plus simultaneous receipt-PK collision; the 24-hour boundary; unknown-before-commit and lost-after-commit recovery; partial-state rejection; missing-schema rejection. Assertions are empty and `PRAGMA foreign_key_check` is empty before intentional schema damage.

Gate startup troubleshooting was recorded, not accepted as behavior RED: the sandbox initially blocked esbuild from reading the worktree; the authorized local rerun required execution outside that sandbox. The first runtime startup then rejected compatibility date 2026-09-12 because the pinned workerd supports through 2026-09-07. The probe config now uses 2026-09-07; both subsequent real D1 runs passed. No remote resource, credential, application endpoint or existing database was used.

### R1 checkpoint / review

- T01: completed; review clean for Critical/Important, known `settingsGrants` mutable-Set Minor deferred.
- T02: completed; prior review clean; T03's limited 0024/expected-error changes passed all migration regressions and were included in the clean T03 re-review.
- T03: completed; independent spec/quality re-review clean after fix round 1. R1 still awaits broad final review, final gates and push.
- T04: next task, **not authorized**. No T04 code, API endpoint, consumer, effective config, UI, print-job rebuild, push, merge, deployment or remote migration was started.
- Full `npm test` remains the controller's final R1 gate. This task did not change or attempt to fix the pre-existing `FinanceMoreMobile.test.js` failure.
- Full local report: `.superpowers/sdd/2026-09-12-business-settings-policies-plan/task-3-report.md` (execution artifact, intentionally not staged).

## T03 correction — Fix round 1

Base: `8747f5ae90b66069abdae691eb52e805d52b1cfd`. Both Important review findings have been corrected and independently re-reviewed. Correction commit: `b1b92be68a85a9c9455fad0e0f67d16041d17bd1` (`fix: validate settings schema and supervise local probe processes`).

- The aggregate health query now explicitly references all three assertion columns (`tx_id`, `check_key`, `valid`). Four new real-SQL cases cover renamed `check_key`/`valid` on load/replay; the same cases execute in the real D1 probe. No migration changed in this correction.
- The gate now uses one idempotent process manager for migrations and dev. SIGINT/SIGTERM abort pending waits and enter the same cleanup path; final JSON is emitted only after cleanup. Windows commands launch suspended inside a native Job Object before they can spawn children; no breakaway is enabled. The supervisor persists after main-process exit, supports cooperative stdin closure, uses `TerminateJobObject` after the deadline, and confirms ActiveProcesses=0 plus stream/process closure. POSIX owns a process group, waits after graceful shutdown/SIGTERM, escalates to SIGKILL and waits again. Unconfirmed termination fails the gate.
- Native job control is confined to `scripts/infra/spec-b-windows-job.ps1`; no npm dependency, application Worker route, deployment configuration or global policy was added. Only trees created by the manager are terminated.

### RED / GREEN and verification

| Evidence | Result |
|---|---|
| Schema RED: `node --test worker/operationSettingsRepository.test.js` | Exit 1; 14/18 passed, four new missing-column load/replay cases failed with missing expected 503. |
| Schema GREEN | All 18 repository tests passed after the single projection change. |
| Process RED | Five initial missing-cleanup/interrupt behaviors failed; the Windows orphan fixture was corrected to survive its parent, then its focused RED failed because the descendant survived cleanup. No fixture-precondition failure was counted as accepted RED. |
| `node --test scripts/infra/spec-b-processes.test.js` | Exit 0; 6/6 real-process tests: exited main/live descendant, cooperative exit, deadline/force fallback, idempotent cleanup of two trees, SIGINT and SIGTERM. |
| Focused T03 + migration + process and infra regressions | Exit 0; 43/43. |
| Extended selected regressions | Exit 0; 97/97. Exact command is in the appended task report. |
| `node scripts/infra/spec-b-d1-gate.mjs` | Exit 0 twice after process supervision; final run includes renamed assertion columns on D1. All nine scenario groups true, all 24 migrations local. |
| `node scripts/infra/spec-b-d1-interruption-check.mjs SIGTERM` and `... SIGINT` | Both exit 0; each verifies the real gate returned failure for that signal and its temporary state was already absent at the instant of JSON publication. |
| `npm.cmd run lint` / `git diff --check` | Both exit 0; no warnings in correction paths, only pre-existing warnings elsewhere; no whitespace errors. |

Self-review covers the complete manager/native helper, signal paths, process ownership, termination deadlines, all touched repository/probe paths and explicit stage list. Native Windows behavior was executed; POSIX logic is implemented but not runtime-verified on this Windows machine. The signal checks invoke the installed Node signal handlers with `process.emit`, because Windows `kill(SIGTERM)` is forceful and cannot deliver a catchable POSIX signal. The first one-line interruption-check attempt failed in PowerShell argument quoting before any work; a dedicated checked-in integration-check script removed that ambiguity.

T01/T02 statuses and the deferred T01 Minor remain unchanged. T03 is completed with review clean. T04 remains unauthorized. No push, merge, deploy, remote migration or full-suite success is claimed.

### Final T03 review closure

- Initial review: two Important findings — incomplete assertion-schema validation and incomplete process-tree cleanup/signal handling in the local D1 runner.
- Fix round 1: `b1b92be68a85a9c9455fad0e0f67d16041d17bd1` addressed both findings; RED/GREEN and real D1/process evidence are recorded above.
- Independent re-review: all findings addressed; no new Critical or Important findings. T03 is completed and review clean.
- Non-blocking verification limitation: POSIX runtime behavior was not executed on this Windows machine. Native Windows behavior and the real local D1 gate were executed; this limitation does not block T03 closure.
- The T01 `settingsGrants` mutable-Set Minor remains deferred to the final broad review; this bookkeeping change does not resolve or expand it.
- R1 awaits broad final review, final gates and push by the controller. No push occurred during this closure. T04 remains the next task and is **not authorized**.

## Final R1 review and pre-publication gates

Review range: application base `8d2f897` through HEAD `44c2c9f`. The controller completed the broad final review with verdict **Ready for R1 review publication: Yes**. There are zero Critical or Important findings. The `settingsGrants` mutable `Set` singleton Minor is accepted as deferred; POSIX process supervision was reviewed in code, but its runtime was not executed on this Windows machine.

T01–T03 implementation is complete and reviewed. The aggregate `npm test` gate is **not fully green**: its sole failure is a pre-existing regression outside this patch. The following results were supplied by the controller for HEAD `44c2c9f`; they do not claim that all gates passed.

| Gate at `44c2c9f` | Result |
|---|---|
| `npm test` | Exit 1; 1,239/1,240 passed; the only failure is the pre-existing `FinanceMoreMobile.test.js` assertion. |
| `node --test src/pages/FinanceMoreMobile.test.js` | Exit 1; 5/6 passed; failure at line 52 in the `print-queue` regexp assertion. |
| `git diff --exit-code origin/master -- src/pages/FinanceMoreMobile.test.js src/components/MobileNavigation.jsx` | Exit 0; both files are identical to the application base, confirming that the failing assertion and its navigation source are outside the R1 patch. |
| `npm run lint` | Exit 0; pre-existing warnings outside R1 only. |
| `npm run build` | Exit 0; 369 modules transformed; existing chunk warning. |
| `npm run d1:migrate:local` | Exit 0; no migrations to apply; resource location explicitly local. |
| `node scripts/infra/spec-b-d1-gate.mjs` | Exit 0; all nine checks true; 24 local migrations. |
| `git diff --check` | Exit 0; no whitespace errors. |

Publication of `feature/spec-b-settings-policies` for review is authorized despite the documented pre-existing aggregate-test failure. The next step after this documentation commit is for the controller to repeat the gates on the final documentation HEAD and, if the results remain stable, push only that feature branch. No push is performed by this bookkeeping task. T04 remains **not authorized and not started**; merge, deploy and remote migrations remain unauthorized.

## R1 punctual closure — `FinanceMoreMobile` EOL portability

Base: published HEAD `018b2201ed63fad396e2e5fa8d6cd84deaf696ef` on `feature/spec-b-settings-policies`. The worktree was clean and tracking the remote branch before this correction. Scope is limited to the source-reading assertion in `src/pages/FinanceMoreMobile.test.js` and this ledger; T01–T03 were not redone and T04 remains unauthorized.

### Root cause and correction

- `git ls-files --eol -- src/components/MobileNavigation.jsx src/pages/FinanceMoreMobile.test.js` reported `i/lf w/crlf` for both files. The checked-out `MobileNavigation.jsx` contained 34 CRLF sequences and zero lone LF sequences.
- The original extraction expression `/const moreEntries = \[(.*?)\]\n/s` did not match the checked-out component because `]` was followed by `\r\n`; the portable form with `\r?\n` matched the same bytes.
- Initial focused RED: `node --test src/pages/FinanceMoreMobile.test.js` exited 1; 5/6 passed. The approved-destinations test failed at the `print-queue` assertion because extraction returned an empty string.
- Regression RED before the fix: 5/7 passed. Both the real CRLF component and the explicit CRLF fixture failed for the same empty-extraction reason; the LF fixture reached the destination assertions.
- Minimal fix: the test-local extractor now accepts `\r?\n`. The existing destination allow-list, settings-area, forbidden-destination and touch/accessibility assertions remain active. A regression fixture proves valid LF and CRLF lists pass and removal of `print-queue` still throws the expected assertion.
- `src/components/MobileNavigation.jsx` was not changed. No repository-wide normalization or Git configuration was changed.

### Verification

| Gate | Result |
|---|---|
| `node --test src/pages/FinanceMoreMobile.test.js` | Exit 0; 7/7 passed, including LF, CRLF and missing-`print-queue` coverage. |
| First complete `npm test` after the minimal fix | Exit 0 outside the write-restricted sandbox; 1,241/1,241 passed. |
| Final fresh `npm test` | Exit 1; 1,240/1,241 passed. The only failure was the unchanged `scripts/infra/spec-b-processes.test.js` case `cooperative shutdown is awaited and does not require force` (`forceAttempted` was `true` rather than `false`). The corrected `FinanceMoreMobile` tests passed. The aggregate suite is therefore **not declared approved**. |
| `node --test scripts/infra/spec-b-processes.test.js` after the aggregate failure | Exit 0; 6/6 passed, confirming the observed infrastructure failure is intermittent; no out-of-scope correction was made. |
| `npm run lint` | Exit 0; existing warnings remain outside the changed test, with no warning in `FinanceMoreMobile.test.js`. |
| `npm run build` | Exit 0; Vite transformed 369 modules; existing chunk-size warning only. |
| `npm run d1:migrate:local` | Exit 0; Wrangler 4.128.0, resource explicitly local, no migrations to apply. |
| `node scripts/infra/spec-b-d1-gate.mjs` | Exit 0; all nine checks true; 24 local migrations. |
| `git diff --check` | Exit 0 after the ledger update; no whitespace errors. |

The first sandboxed full-suite run and sandboxed build were invalidated by `EPERM` writes to `node_modules/.vite-temp`; both commands were rerun outside that restriction. The first sandboxed local migration attempt stalled before Wrangler output and was interrupted after 60 seconds; the authorized `--local` rerun completed. Two later aggregate-suite attempts were interrupted after pre-existing Vite tests stopped producing output for several minutes; process inspection isolated the waits outside `FinanceMoreMobile`, and no repository code was changed for them.

This closure performs no T04 work, UI implementation, application navigation change, merge, deploy or remote migration. The worktree is preserved for review.

## TEST-INFRA-01 — open: intermittent cooperative-shutdown assertion

Status: **OPEN / cause unconfirmed**. Resume in the test stability/organization workstream **before merge or release**. This item is not resolved, dismissed, or demonstrated harmless. Publication of the diagnostic instrumentation is for review only; the aggregate suite remains **not approved**.

The observed failure is `assert.equal(result.forced, false)` in the case `cooperative shutdown is awaited and does not require force`. The preceding assertion confirmed that the fixture process was dead after `stop()` returned. The earlier shorthand `forceAttempted` in this ledger refers to the actual `result.forced` field; that field indicates the manager took the escalation branch, not proof that the supervisor executed a native force call. The last completed aggregate run remains 1,240/1,241 passed with this failure.

### Instrumentation checkpoint

Base: published commit `e2c91dd04c44979189b3cea1db190201745264e5`, branch `feature/spec-b-settings-policies`. The completed instrumentation round performed exactly one idle capture, one controlled-load capture, and one execution of the existing six supervision tests. No reproduction was repeated for this publication.

| Prior execution | Recorded result |
|---|---|
| `node scripts/infra/spec-b-process-capture.mjs idle` | Exit 0; cooperative child exited 0; no force request or execution. Manager stop-to-close: 32.872 ms. Supervisor stdin-close-to-exit-observation: 15.642 ms. |
| `node scripts/infra/spec-b-process-capture.mjs load` | Exit 0; four owned CPU threads, each bounded to 3 seconds; all terminated with exit 0 and were awaited. Cooperative child exited 0; no force request or execution. Manager stop-to-close: 50.564 ms. Supervisor stdin-close-to-exit-observation: 15.349 ms. |
| `node scripts/infra/spec-b-process-capture.mjs regression` | Exit 0; runs the existing six supervision tests with instrumentation enabled. 6/6 passed, zero failures/skips/cancellations; TAP duration 4,916.8522 ms. All seven supervised-tree traces were complete. |

The noncooperative/descendant cases recorded six manager force requests and six successful `TerminateJobObject` calls, with active processes observed immediately before each call. The orphan case had root exit code 0 but one active descendant, so root exit alone did not establish an empty tree. Neither cooperative capture reproduced the intermittency. These results do not establish whether the original failure was actual forced termination, delayed confirmation, or a request the supervisor never executed.

Occurrence/observation events in the supervisor and receipt events in the manager use separate monotonic clocks and explicit execution/tree/process identities. Durations above use only timestamps from the same clock origin. Native pre-force state queries and the termination call are adjacent observations, not an atomic snapshot.

Possible measurement interference remains unmeasured: events are buffered, but the supervisor's single final sidecar write occurs before its process closes and can add latency to `close`. Instrumentation overhead has not been isolated. No behavioral correction or timeout increase is justified by this checkpoint, and no claim of harmlessness is made.

### Diff review and publication checks

- Reviewed all four instrumentation/support files. Diagnostics default to `null`; test opt-in requires the diagnostic environment variables. Default manager deadlines remain 300/5000 ms and test deadlines remain 120/3000 ms. Shutdown order, escalation policy, `result.forced`, all 12 existing assertion lines, and Windows `drained && closed` / native ActiveProcesses=0 confirmation are preserved. Existing protocol frames and test stdout are unchanged.
- Only the four local test-infrastructure files plus this ledger belong in the publication commit. No application, dependency, migration, workflow, T01–T03 implementation or LF/CRLF correction changes are included.
- Compared SHA-256 hashes of all four files with the local capture checkpoint: all matched. No code changed during this publication step, so the prior capture/test evidence remains applicable and was not rerun.
- Static checks: `node --check` passed for the three JavaScript files; PowerShell AST parsing reported zero errors; installed Oxlint passed on the three JavaScript files with no diagnostics. `git diff --check` passed after the ledger update. The exact five-file staging scope is checked immediately before the isolated commit.
- Workflow review: staging push deployment is limited to `feature/centralized-qz-print-queue`; production deployment is manual and master-only. The two TDD push workflows target their own unrelated branches. `validate.yml` targets master pushes, pull requests to master, or manual execution and contains no real deployment. Publishing `feature/spec-b-settings-policies` does not trigger a deploy workflow. No workflow definition was changed or manually dispatched.
- Complete raw logs and the detailed checkpoint remain local under the ignored `logs/spec-b-process-diagnostic/` directory. They are excluded from staging/publication; this ledger contains only the reviewed summary.

Next action for TEST-INFRA-01 is a separately authorized stability investigation before merge/release, using the preserved evidence to distinguish process liveness from confirmation delivery and to measure instrumentation interference. The current diagnostic round is closed; the issue remains open. No full-suite rerun, build, migration, D1 gate, behavioral fix or test reorganization is part of this publication. T04 remains **not authorized** until the next handoff. No merge, deployment or remote migration is authorized by this review publication.

## T04 — native payment methods without free CRUD

Authorization was limited to T04 on published base `b25d59e986b56afe555ec402f9c013bb6cd7e7cf`. Functional commit: `8d980f58188d2b4a0f25855cfa7a791d8c1cf19e` (`feat: manage native payment method policy`). No T01–T03 work was redone, no process diagnostic was resumed, and no T05, endpoint, UI or operational policy enforcement was started.

### Delivered behavior

- Added typed `loadPaymentMethods` / `savePaymentMethods` for the six native codes. Only activation, complete unique ordering and active default are accepted; omission, creation, rename metadata, duplicate order and an inactive default fail validation before mutation SQL.
- A default can be replaced while the former default is disabled in the same atomic batch. The payment header, changed children, revision, assertion cleanup, receipt and final read use the T03 transaction protocol. Concurrent same-revision writes have one winner; no-op and replay retain receipt semantics; payment and operation revisions are independent.
- Loads fail closed for incomplete/corrupt typed state and expose server-owned native restrictions and first-use status under `meta.items`. Legitimate absence in a valid schema reads revision 0 and initializes all six native rows atomically on save.
- `shared/finance.js` keeps the existing `PAYMENT_METHODS` export and legacy UI order, but obtains its labels from the canonical payment mapping. Saving settings does not update historical `payments.method` or `movements.payment_method`; the test preserves `Dinheiro`, `Pix`, `debito`, `credito`, `Transferência` and `Outro` byte-for-byte.

### Proportional TDD and verification

| Evidence | Result |
|---|---|
| RED — `node --test worker/paymentSettingsRepository.test.js` before production file creation | Exit 1 with `ERR_MODULE_NOT_FOUND` for `worker/paymentSettingsRepository.js`, demonstrating the authorized repository did not exist. |
| First implementation run | 7/10 passed. The three failures exposed test-fixture defects (noncanonical expected array order, obsolete historical INSERT columns and a corruption setup blocked by the existing identity guard); these were corrected without weakening product assertions. |
| Final focused run after the last test refinement | Exit 0; 10/10 passed, zero failures/skips/cancellations. |
| `node --test shared/businessPolicies.test.js shared/finance.test.js worker/settingsTransactions.test.js worker/operationSettingsRepository.test.js worker/settingsMigration.test.js` | Exit 0; 38/38 directly related regressions passed. |
| Installed Oxlint on `shared/finance.js`, `worker/paymentSettingsRepository.js` and its test; `node --check` on the same files | Exit 0; no diagnostics. |
| `npm.cmd run build` | Initial sandbox attempt was invalid (`EPERM` creating Vite's `.vite-temp` file). The single authorized rerun outside that write restriction exited 0; Vite completed the production build with only its existing large-chunk warning. |
| `git diff --check` | Exit 0 before the functional commit; repeated after this ledger update before publication. |

An independent read-only review of the complete T04 diff found no Critical, Important or Minor issues and judged it ready for this task checkpoint. Its non-blocking suggestion was payment-specific duplication of expired-receipt and transport-failure cases; those protocol behaviors remain directly covered in the shared T03 transaction/operation regression set and were not used to expand T04.

The full `npm test` suite, migrations and the D1 gate were deliberately not run in this task. Therefore the aggregate suite remains **not approved**. `TEST-INFRA-01` remains **OPEN / cause unconfirmed** and must be resumed in the test-stability workstream before merge or release; this T04 result neither resolves nor dismisses it. T05 remains **not authorized**. No merge, deployment, release or remote migration is authorized by this checkpoint.

## T05 — cancellation reasons and first-use race

Authorization was limited to T05 on clean published base `c69e048881402738af648a74d4e93379a7ab2bbd`; `git ls-remote` confirmed the same SHA on `origin/feature/spec-b-settings-policies` before changes. Functional commit: `ebdb090844ed92b5b2ab045763eaa4db027466f7` (`feat: manage cancellation reasons preserving first use`). Review-fix commit: `b4dab34f2d7eb00595a8dfc63a141a3d0732f86b` (`fix: preserve cancellation catalog atomicity`). No T01–T04 work was redone, no T06/API/UI work was started, and no dependency, migration or workflow was changed.

### Delivered behavior

- Added typed `loadCancellationReasons` / `saveCancellationReasons` with the T03 revision, atomic batch, no-op, replay and receipt protocol. Loads fail closed on incomplete/corrupt typed state and return server-owned `isSystem`, `requiresNote`, `usedEver`, `canRename` and `canDelete` metadata.
- Preserved the five native IDs and labels. Native identities cannot be renamed or deleted; `other` remains active and requires a non-empty cancellation description of at most 240 characters.
- Custom reasons support creation, activation/deactivation, contiguous ordering and normalized unique names up to 80 characters. Rename/delete is limited to never-used custom identities. Multiple guarded edits share one aggregate `unused` assertion; collision-safe temporary name keys allow swaps and reuse of a name released by deletion without exposing an intermediate state.
- Added `prepareCancellationUse(db,businessId,reasonId,expectedRevision,txId,at)`, which returns the revision/activity guard and permanent first-use update without executing early. `orderCancellation` commits those statements with the order transition, pending automatic-print deletion and optional existing refund movement. A concurrent order-state change aborts before first-use marking.
- Delete/rename versus first cancellation has one valid winner. If use wins, admin mutation returns `SETTINGS_ITEM_USED`; if deletion wins, cancellation returns `POLICY_CHANGED`. In neither order is there a lost reference or partial write. Cross-business, absent and inactive reasons are rejected from the authenticated business scope.
- Confirmed receipts are reconciled before current usage restrictions, including a commit occurring between the first receipt read and current-catalog load. The same mutation/payload remains replayable after later custom creation and use; a different payload keeps the existing mutation-reuse rejection.
- Existing cancellation eligibility, order history fields, deferred/immediate refund behavior and automatic-print cleanup remain in place. No new automatic refund was introduced.

### TDD and verification

| Evidence | Result |
|---|---|
| Behavioral RED after creating only the minimal module interface | Exit 1; 0/14 passed. Assertions failed on missing catalog behavior and the existing cancellation path failed the new 240-character rule; this was not an `ERR_MODULE_NOT_FOUND` preparation failure. |
| First implementation run | Exit 1; 4/14 passed. Failures separated product behavior from fixture-shape defects (`requiresNote` belongs to metadata), a cross-business LEFT JOIN expectation and `node:sqlite` null-prototype comparison. |
| Focused GREEN after fixture corrections and minimal implementation | Exit 0; 14/14 passed. |
| Direct related regressions before updating legacy doubles | Exit 1; 26/33 passed. The seven failures were confined to old fake DBs returning null for the newly required seeded-policy read. |
| Direct related regressions after aligning doubles with the real seeded catalog | Exit 0; 33/33 passed. Existing order/refund/printing assertions were retained. |
| Additional transactional RED | Exit 1; 13/15 passed. Out-of-range ordering could reach SQL and a concurrent already-cancelled order could mark another reason as used. |
| Additional transactional GREEN | Exit 0; 15/15 passed after pre-SQL contiguous-order validation and an order-state assertion before first-use marking. |
| Independent initial review | Three Important findings reproduced: duplicate `unused` assertion keys for multiple edits, transient unique-name collisions during valid swaps/delete-and-reuse, and receipt replay rejected after later first use. No Critical findings. |
| Review regression RED | Exit 1; 8/11 repository tests passed; all three reproduced review cases failed for the expected reasons. |
| Review-fix GREEN | Exit 0; 11/11 repository tests passed after aggregate guarding, collision-safe staging and receipt-first reconciliation. A further focused RED reproduced the receipt-confirmation window between first read and load; the second reconciliation made it GREEN. |
| Final authorized selection | Exit 0; 51/51 passed across `worker/cancellationSettingsRepository.test.js`, `worker/cancellationPolicyUsage.test.js`, `shared/settingsCatalogs.test.js`, `worker/settingsTransactions.test.js`, `worker/orderCancellation.test.js`, `worker/orderCancellationHttp.test.js` and `worker/settingsMigration.test.js`. Zero failures/skips/cancellations. |
| Targeted installed Oxlint, `node --check` on all six implementation/test files, and `git diff --check` | Exit 0; no diagnostics or whitespace errors. The Git EOL notices describe the existing Windows checkout policy and are not lint/whitespace failures. |

### Review closure and limits

The independent read-only re-review of `c69e048..b4dab34` confirmed all three Important findings resolved and found no new Critical, Important or Minor issues. Its own four-file selection passed 30/30; additional real-SQL probes confirmed rollback after temporary name staging and rejection before edits when either swapped identity becomes used. Verdict: ready for the T05 checkpoint.

Workflow triggers were checked before publication: staging deploy watches only `feature/centralized-qz-print-queue`; production deploy is manual; push validation watches only `master`; the two TDD workflows watch unrelated branches. A normal push of `feature/spec-b-settings-policies` does not trigger deployment.

Per the task authorization, `npm test`, build, migrations, the D1 gate, remote migrations, merge, deploy and release were not run. The aggregate suite remains **not approved**. `TEST-INFRA-01` remains **OPEN / cause unconfirmed** and still blocks merge/release; T05 neither resumes nor resolves that investigation. T06 is **not authorized and not started**.

## T06 — manual finance categories and historical references

Authorization was limited to T06 on clean published base `d6e011ae9295455c88cf1d07537341c06c89f038`; `git ls-remote` confirmed the same SHA on `origin/feature/spec-b-settings-policies` before changes. Functional commit: `9f387e1` (`feat: manage manual finance categories without rewriting history`). No T01–T05 work was redone, no T07/API/UI/audit work was started, and no dependency, migration, workflow or monetary/opening-balance rule changed.

### Delivered behavior

- Added typed `loadFinanceCategories` / `saveFinanceCategories` for the complete per-business manual Entrada/Saída catalog. Activation/deactivation and contiguous per-type ordering are supported; normalized names are unique within a type, while the same label may exist in different types. Loads fail closed on corrupt/incomplete typed state.
- Preserved all 13 native manual IDs, labels and types. Native identities cannot be renamed, deleted or moved between types; automatic `sales`/`refunds` (Vendas/Estornos) remain outside the editable/manual catalog. Custom IDs have immutable types and can be renamed/deleted only before first use.
- Reused the T03 atomic revision/no-op/replay/receipt protocol. Multi-item edits share one `unused` guard, temporary name keys permit valid swaps without transient uniqueness failures, and confirmed receipts are reconciled before later usage restrictions.
- Added `prepareFinanceCategoryUse(db,businessId,categoryId,expectedRevision,txId,at)`. Manual movement creation and changed-category updates batch the policy assertion, permanent `first_used_at`, movement write and assertion cleanup together. A failed movement write or concurrent policy change leaves neither first-use metadata nor a partial movement.
- Update reads the existing movement by authenticated business scope. Keeping its original category is allowed while inactive and retains the stored legacy bytes; changing the reference requires an active category of the matching type. First use remains permanent after category changes and soft deletion.
- A manual type may have zero active categories, which blocks new manual movements of that type with `POLICY_CHANGED`; automatic Vendas/Estornos history is untouched. `getMovementCategoryLabel` now accepts a complete historical ID-to-label map, including inactive custom categories.
- Replaced the old always-success finance CRUD double with the existing real SQLite/D1-subset fixture, retaining its CRUD, system-movement and opening-balance assertions while exercising the actual catalog and transaction SQL.

### TDD and verification

| Evidence | Result |
|---|---|
| Preparation discovery | The first focused run exited 1 with `ERR_MODULE_NOT_FOUND`; this was recorded only as preparation, not accepted as behavioral RED. |
| Catalog behavioral RED | With an export-only interface, `node --test worker/financeCategoryRepository.test.js` exited 1; 0/5 passed. Failures covered the empty catalog, missing lifecycle/validation, absent revision race and absent rollback behavior. |
| Catalog GREEN | Initial implementation reached 4/5; the remaining failure was an invalid mojibake test fixture for case/whitespace normalization. Correcting that fixture without weakening the assertion produced 5/5. Review-hardening cases for transient name swaps, legitimate revision-0 initialization and receipt replay after later first use also passed. |
| Usage behavioral RED | Focused catalog+usage run exited 1; 6/12 passed. The existing movement code did not mark first use, reject inactive selections, preserve inactive originals or guard revision/delete races. |
| Usage GREEN | The first transactional implementation reached 10/12; both remaining failures were fixture-only (`node:sqlite` null prototype and a missing foreign-key parent). After correcting those fixtures, 12/12 passed. |
| Shared/validation RED | `node --test worker/financeValidation.test.js shared/finance.test.js` exited 1; 6/8 passed because custom IDs and the historical label map were not yet supported. |
| Final focused selection | Exit 0; 14/14 passed across `worker/financeCategoryRepository.test.js` and `worker/financeCategoryUsage.test.js`, with zero failures/skips/cancellations. |
| Required related regressions | Exit 0; 21/21 passed across `worker/financeRepositoryCrud.test.js`, `worker/financeValidation.test.js`, `shared/finance.test.js` and `shared/settingsCatalogs.test.js`. The first run exposed the obsolete fake DB and exited 1 at 20/21; the test was moved to the real fixture, preserving assertions. |
| Additional related regressions | Exit 0; 12/12 passed across `worker/financeRoutesRegression.test.js`, `worker/settingsTransactions.test.js` and `worker/settingsMigration.test.js`. |
| Static gates | `node --check` passed on all nine implementation/test files; installed Oxlint reported no diagnostics; mojibake scan found no match; `git diff --check` passed. |
| Build | The sandboxed attempt failed only with `EPERM` writing `node_modules/.vite-temp`. The authorized rerun outside that restriction exited 0; Vite transformed 370 modules with only the existing large-chunk warning. A final fresh rerun after the text correction also exited 0. |

### Review closure and limits

Direct spec/diff review checked the T06 files against section 6.3, the plan contract and the T05 lessons. It found and corrected one textual mojibake regression before commit; the final targeted scan is clean. No Critical, Important or Minor issue remains from the direct review. Subagent review was not used because this session explicitly disallows delegation unless requested by the user.

Workflow triggers were rechecked before publication: staging deploy watches only `feature/centralized-qz-print-queue`; production deploy is manual; validate push watches only `master`; both TDD workflows watch unrelated branches. A normal push of `feature/spec-b-settings-policies` does not trigger deployment.

Per the T06 authorization, the full `npm test` suite, migrations and the D1 gate were deliberately not run. Therefore the aggregate suite remains **not approved**. `TEST-INFRA-01` remains **OPEN / cause unconfirmed** and continues to block merge/release; T06 neither resumes nor resolves it. T07 is **not authorized and not started**. No merge, deployment, release or remote migration is authorized by this checkpoint.

## T07 — print-copy policy, station administration and primary topology

Authorization was limited to T07 on clean published base `c13cc41f3760c1a27defa59cf4cbcb22b8bb575e`; `git ls-remote` confirmed the same SHA on `origin/feature/spec-b-settings-policies` before changes. Functional commit: `757ee70` (`feat: separate print policy station configuration and topology`). No T01–T06 work was redone, no T08/API settings framework/UI/job-policy adaptation was started, and no dependency, migration, workflow, print job, attempt, snapshot, recovery or physical-printing behavior changed.

### Delivered behavior

- Added `loadPrintingPolicy` / `savePrintingPolicy`, `loadStationConfiguration` / `saveStationConfiguration` and `loadStationPrimary` / `saveStationPrimary` using the T03 optimistic-revision, atomic-batch and mutation-receipt protocol. Receipt identities are distinct: `printingPolicy`, `stationConfiguration:<stationId>` and `stationPrimary`; station payload hashes also include `scopeId`.
- `business_print_settings` remains the only authority for business copy policy. Both context values accept only integer 1 or 2; the existing order override, including 1, is retained; the table/comanda value remains independent; and station `default_copies` is neither read as a policy fallback nor changed by policy/configuration saves.
- Station administration edits only name, platform and automatic-printing state. Effective changes advance `config_revision`; no-ops retain it. Heartbeat and physical-health writes do not change that revision, and the administrative UPDATE excludes all health fields so it cannot restore stale readiness over a newer heartbeat.
- Bootstrap registration is insert-only. Repeating it returns the persisted station and cannot overwrite administrative values with client defaults. The legacy station copy field is retained only for compatibility.
- Primary election uses `business_print_topology_settings.revision`. Clearing the old flag, setting the new flag, updating the topology header and writing the receipt occur in one batch. Same-revision concurrent elections have one winner; loads fail closed if the pointer and flags diverge.
- Existing printing endpoints now expose the canonical resources while preserving `defaultCopies` as the GET-only alias. `GET /api/printing/stations` retains `stations` and adds the `stationPrimary` resource so a later client can obtain the topology revision. Administrative PUT/POST calls require `expectedRevision` and `mutationId`; legacy administrative writes return `SETTINGS_CLIENT_UPDATE_REQUIRED`. Session `businessId` remains authoritative, same-origin mutation protection remains in place, and extra client-supplied business/capability fields are rejected.
- Transitional contract: the existing frontend is intentionally not adapted in T07. Bootstrap may register an absent station with the exact legacy registration shape, but an existing station cannot be administratively overwritten through that shape. T21 remains responsible for sending canonical revisioned policy/station/election writes.

### TDD and verification

| Evidence | Result |
|---|---|
| Preparation discovery | The first focused run exited 1 with `ERR_MODULE_NOT_FOUND` for `worker/printSettingsRepository.js`; recorded only as preparation, not as behavioral RED. |
| Behavioral RED | With an export-only interface, the focused command exited 1; 0/11 passed. Failures were `SETTINGS_NOT_IMPLEMENTED` across policy, station revision/heartbeat, topology race/rollback, bootstrap and HTTP contracts. |
| Initial GREEN | The first implementation run reached 8/11. The three failures were fixture-only: `node:sqlite` null-prototype comparison, heartbeat setup without the required primary station, and an isolation case using a nonexistent business. Correcting those fixtures without weakening assertions produced 11/11. |
| Related regression RED/GREEN | The first 82-test selection exposed 13 failures confined to the pre-T02 HTTP fixture and old unrevisioned expectations. The fixture was aligned with the already-published 0024 schema and operational elections were given revisions/IDs; the same selection then passed 82/82. |
| Boundary review RED/GREEN | Direct review found that bootstrap/election handlers ignored extra client fields. A focused RED exited 1 at 5/6; strict key validation made it 6/6. A second focused RED proved topology revision was absent from the station GET; adding the read resource made the combined endpoint selection pass 22/22. |
| Final focused + related selection | `node --test worker/settingsTransactions.test.js worker/settingsMigration.test.js worker/orderPrintingRepository.test.js worker/orderPrintingHttp.test.js worker/orderPrintingStationHealth.test.js worker/orderPrintingQzStationEligibility.test.js worker/orderPrintingRecovery.test.js worker/printSettingsRepository.test.js worker/stationSettingsRevision.test.js` exited 0; 82/82 passed, zero failures/skips/cancellations. |
| Static gates | `node --check` passed on all six changed JavaScript files; installed Oxlint reported no diagnostics on the same files; `git diff --check` passed. Git emitted only the checkout's existing LF-to-CRLF notices. |

The selected regressions cover the shared transaction/receipt protocol, real migration/schema behavior, authenticated and same-origin printing endpoints, registration/bootstrap, station-primary eligibility, heartbeat/physical health, centralized job lifecycle and recovery. They were chosen because T07 changes those persistence and API boundaries; the operational consumers themselves were not changed.

### Review, publication and limits

Direct spec/diff review was used; no subagent or independent reviewer was used because this session disallows delegation unless explicitly requested. The review found and corrected the two demonstrable HTTP-boundary gaps recorded above. Final review found no remaining Critical, Important or Minor issue in the T07 diff.

Workflow triggers were rechecked before publication: staging deployment watches only `feature/centralized-qz-print-queue`; production deployment is manual; validation push watches `master`; the two TDD workflows watch unrelated branches. A normal push of `feature/spec-b-settings-policies` does not trigger deployment.

Per the T07 authorization, the full `npm test` suite, frontend build, migrations and D1 gate were deliberately not run. No schema guarantee introduced by T07 required a new D1 runtime scenario because all SQL uses the existing 0024 schema and the real SQLite/D1-subset transactional fixture. Therefore the aggregate suite remains **not approved**. `TEST-INFRA-01` remains **OPEN / cause unconfirmed** and continues to block merge/release; T07 neither resumes nor resolves it. T08 is **not authorized and not started**. No merge, staging/production deployment, release or remote migration is authorized by this checkpoint.
