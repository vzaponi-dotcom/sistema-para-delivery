# Spec B execution ledger — business settings and policies

## 2026-09-14 - Operation conflict review blocker

Correction limited to the conflict/review flow of `Settings > Operation`. Other Spec B screens and the three-way merge/controller rules were not changed.

- Root cause: the shared review component serialized complete `current` and `draft` objects through `JSON.stringify`, exposed internal paths as labels, and had no component-specific width or overflow containment.
- Operation presentation: the modal branches only for `review.resource === 'operations'`. It renders only actual conflicts using the six labels from the Operation screen, formats timing values with `min`, joins active modalities with commas, and shows two clear radio cards for `Atual no negocio` and `Seu ajuste`. No raw object summary is rendered for Operation.
- Focus and responsive layout: one conflicting field produces one review card and moves initial focus to its first choice. The operation modal has a bounded 760 px desktop width, zero-min-width grid tracks, explicit horizontal containment, wrapping values, and one-column choices at 640 px.
- Preservation: `resolveSettingsConflict`, controller reconciliation, explicit apply behavior, no destructive default, draft retention, single-submit guard, and the requirement to save again after applying review remain unchanged.
- RED/GREEN: the new focused contracts initially passed 4/7, reproducing raw JSON, missing labels/focus metadata, and absent responsive containment. The final focused run passed 7/7.
- Proportional integration: conflict merge/state/controller, Operation, and Spec B integration tests passed 59/59.
- Browser QA: Chromium rendered the real modal at 1440x900, 390x844, and 320x740. All three widths matched the viewport without horizontal overflow; the single-field case contained one card, had no internal key/JSON text, focused the current-value choice, and applied the selected local value while preserving the candidate.
- Final verification: the expanded proportional selection passed 75/75 with no failures, skips, or cancellations. Lint exited 0 with pre-existing warnings, build passed with 391 modules and the known large-chunk warning, and `git diff --check` passed.

No migration, deployment, production action, master merge, release, or other screen was started.

## 2026-09-14 - Operation save confirmation and Cancel return

Functional correction limited to `Settings > Operation`, with no visual change and no work on other Settings screens.

- Save: `Settings` awaits the settings controller result and invokes the central system confirmation only when `save('operations')` returns `true`, after API confirmation. The popup says `Configuracoes de operacao salvas com sucesso` with the proper Portuguese accents in the UI. Failure, conflict, or an uncertain result cannot show false success.
- Cancel: the `Cancelar` button now uses an explicit navigation-controller intent. It discards the current draft once and immediately returns to `settings-home`; if discard is rejected, navigation does not occur. The global guard still protects ordinary exits with pending edits.
- RED/GREEN: the first focused run ended 21/25 and confirmed the missing integrations; one test literal was normalized to Unicode escapes before GREEN. After implementation, the focused selection passed 25/25.
- Proportional regression: `node --test --test-concurrency=1 src/pages/OperationSettings.test.js src/components/SettingsPrimitives.test.js src/settingsNavigation.test.js src/settingsDraftNavigation.test.js src/specBSettingsIntegration.test.js src/settingsResponsive.test.js src/successFeedbackRegression.test.js` passed 48/48 with no failures, skips, or cancellations.
- Gates: `npm.cmd run lint` exited 0 with pre-existing warnings outside this diff; `npm.cmd run build` passed with 391 modules and the known chunk-size warning; `git diff --check` passed.

No migration, deployment, production action, master merge, or other screen was started.

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

## T08 — internal checkpoint: scoped administration and effective configuration

T08 started from clean, synchronized `a33839d3f9905120c676e2d93df4bc738bf4ea28`; `git ls-remote` confirmed the same SHA on `origin/feature/spec-b-settings-policies`. Functional commit: `26d6a04` (`feat: expose scoped settings APIs and effective configuration`). T01–T07 were not redone and T09 did not start before this checkpoint.

### Delivered behavior

- Added one shared capability catalog, explicit Worker-side grant resolution with a fail-closed trusted-resolver path, domain-specific view/manage checks and a legacy-wide grant only when no resolver is installed for an authenticated session.
- Added typed administrative settings routes, scoped receipt lookup, same-origin mutation enforcement and strict rejection of browser-supplied authority fields. Every repository call receives `businessId` only from the authenticated context.
- Added the minimal effective operational projection for operations, payments, cancellations, finance and printing. Inactive/admin metadata/receipts are excluded; revision vectors and capability identity produce deterministic versions.
- Reads bracket the resource projections with consistent batched revision reads and retry once on change, so a new version is not paired with stale data. Legitimate revision-zero resources retain defensive defaults.
- Bootstrap preserves all legacy datasets and adds `effectiveBusinessConfig`; session status exposes the server-derived capability set and non-authenticating `settingsContextId`. Printing policy/station administration now uses the same resolved context.

### TDD, verification and review

| Evidence | Result |
|---|---|
| Preparation | First focused run exited 1 with `ERR_MODULE_NOT_FOUND`; recorded only as preparation. |
| Behavioral RED | Export-only interfaces produced 0/7 passing with `SETTINGS_NOT_IMPLEMENTED`, proving the missing behaviors. Later REDs reproduced bootstrap projection omission, print-administration bypass, trusted-resolver fail-open and revision-zero 503. |
| Focused GREEN | `node --test worker/settingsApi.test.js worker/effectiveBusinessConfig.test.js` passed 11/11 after review fixes. |
| Final T08 selection | `node --test worker/settingsApi.test.js worker/effectiveBusinessConfig.test.js worker/index.test.js worker/auth.test.js src/app/navigation.test.js worker/orderPrintingHttp.test.js worker/stationSettingsRevision.test.js` passed 66/66, zero failures/skips/cancellations. `orderPrintingHttp` and `stationSettingsRevision` were included because T08 changed the printing authorization context. |
| Static gates | Installed Oxlint, `node --check` on every changed JavaScript file and `git diff --check` exited 0. |
| Independent review | Initial review found three Important issues (resolver fail-open, revision-zero bootstrap failure and stale station integration test) plus one Minor mojibake issue. Dedicated RED/GREEN fixed all four; independent rereview reported no remaining Critical, Important or Minor findings. |

`TEST-INFRA-01` remains **OPEN / cause unconfirmed**, the aggregate suite remains unapproved, and merge/release remain blocked. No full `npm test`, build, migration, D1 gate, deploy, merge or release was performed by the implementing session at this checkpoint. T09 is authorized next; T10 remains **not authorized**.

## T09 — operational policy enforcement

T09 started only after the T08 internal checkpoint passed and was committed. Functional commit: `8449d3f` (`feat: enforce current business policies at operational commit`). No T10 timing/snapshot work, later printing work, settings frontend, broad modularization, user/profile model or full audit was started.

### Delivered behavior

- Added server-read payment-method and order-modality expectations plus same-batch revision/activity assertions. Inactive selections now block new paid checkout, standalone order payment, whole-tab payment, refund and manual movement without trusting client projection state.
- New order creation validates every modality, including `Local` table orders. Accepted idempotency keys are resolved before current policy checks, so replay remains stable after later deactivation while a genuinely new order is rejected.
- A newly required table tab is now inserted in the same atomic batch as its order, items, optional payment/movement and automatic print job. Structural table races remain `TABLE_TAB_CHANGED`; policy races remain `POLICY_CHANGED`. Sequence gaps remain preferable to identity reuse.
- Cancellation reason and finance-category first-use protocols from T05/T06 remain in their original batches. Immediate/deferred refunds now additionally require an active chosen payment method through commit; no silent method substitution occurs.
- A historical manual movement may retain its exact inactive method/category references. A changed reference requires active policy, and a state assertion including the original payment method prevents a stale edit from restoring an inactive method after a concurrent update; that conflict returns `409 MOVEMENT_CHANGED`.

### TDD, verification and final review

| Evidence | Result |
|---|---|
| Preparation | Initial focused discovery exited 1 with `ERR_MODULE_NOT_FOUND`; recorded only as preparation. |
| Behavioral RED | Export-only `operationalPolicyGuards` produced 0/6 passing with `POLICY_NOT_IMPLEMENTED`. Later deterministic REDs demonstrated inactive policies, checkout policy race, orphan table-tab creation (`1 !== 0`), table `Local` bypass, stale historical-method restoration and wrong conflict classification. |
| Focused GREEN | Final `node --test worker/operationalPolicyGuards.test.js worker/businessPolicyIntegration.test.js` passed 14/14. |
| Required T09 regressions | `node --test worker/orderRepositories.test.js worker/tableTabPayment.test.js worker/orderCancellation.test.js worker/financeRepositoryCrud.test.js` passed 22/22 after directly related fake DBs were taught to return the new server policy reads. |
| Additional T05/T06 integrity selection | Cancellation/finance usage and settings repository tests passed 35/35, covering first-use rollback, policy races and delete/rename races because T09 composes those guards with payment policy assertions. |
| Final joint T08+T09 selection | The explicit 17-file affected selection passed 133/133, zero failures/skips/cancellations. It included T08 auth/index/navigation/printing gates, T09 focused/required regressions and the T05/T06 integrity selection; this was not the aggregate `npm test` suite. |
| Static gates | Targeted installed Oxlint, `node --check` on all changed T09 JavaScript and `git diff --check` exited 0. |
| Independent review | The first pass found two Important integrity gaps: table orders bypassed the `Local` modality and a stale historical movement edit could restore an inactive method. Rereview found an Important policy-conflict misclassification and a Minor generic-500 conflict. Each received a deterministic RED/GREEN correction. Final rereview reported no remaining Critical, Important or Minor findings. |

The real SQLite/D1-subset fixture demonstrated atomic rollback for every T09 race, including the entire order/table-tab/item/payment/job batch, so no additional D1-local probe was required. Workflow triggers were rechecked: staging deploy watches only `feature/centralized-qz-print-queue`; production deploy is manual; validate push watches only `master`; TDD workflows watch unrelated branches. A normal push of this branch does not trigger deployment.

Per authorization, full `npm test`, build, migrations, the legacy D1 gate, remote migrations, staging, production, merge and release were not run. `TEST-INFRA-01` remains **OPEN / cause unconfirmed**, the aggregate suite remains unapproved, and merge/release remain blocked. T10 remains **not authorized and was not started**.

## T09 follow-up — table-tab close result association

Starting from clean, synchronized `389e187a824752e23031c4f3cd06def6266a03d8`, the published-head review found that `registerTableTabPayment` appended `clearSettingsAssertions` after the table-tab close UPDATE but still inspected `batchResults.at(-1)`. A zero-change close followed by one assertion cleanup therefore inspected the cleanup result and missed `TABLE_TAB_PAYMENT_CONFLICT`.

- Behavioral RED: a deterministic real-SQLite test read an open empty tab, closed it immediately before the batch, then let the close UPDATE affect zero rows and assertion cleanup affect one. The affected test exited 1 with `Missing expected rejection.`
- GREEN: functional commit `78fa9a3` (`fix: associate table tab close result with its statement`) retains an explicit reference to the close statement and obtains its corresponding ordered batch result through that reference. The `meta.changes` check, policy guard, atomic batch and assertion cleanup remain intact.
- Directly affected paths: the concurrency regression now returns `409 TABLE_TAB_PAYMENT_CONFLICT`; the normal real-database path still closes the tab and both paths leave zero `settings_tx_assertions` rows.
- Proportional final selection: `node --test worker/tableTabPayment.test.js worker/businessPolicyIntegration.test.js worker/operationalPolicyGuards.test.js` passed 18/18, zero failures/skips/cancellations. Targeted Oxlint, `node --check` for both changed JavaScript files and `git diff --check` exited 0.
- Independent read-only review reported no Critical, Important or Minor findings. No additional dependency was affected and the 133-test selection was not repeated.

The full `npm test`, build, migrations and D1 gate were not run. No merge, deploy, release or remote migration was performed. `TEST-INFRA-01` remains **OPEN / cause unconfirmed** and continues to block merge/release. T10 remains **not authorized and was not started**.

## T10 — active timing and terminal snapshot

Authorization was limited to T10 on clean, synchronized base `12d2aae91c936ad195e6d3def0f0502cdf7589b8`; `git ls-remote` confirmed the same SHA on `origin/feature/spec-b-settings-policies` before changes. Functional commit: `a1bbaee0df7253920ad6317606ed4729b5bb866f` (`feat: apply live timing policies without rewriting history`). No T11 work, dependency, migration, workflow, settings UI, print-policy adaptation or broad modularization was started.

### Delivered behavior

- Centralized exact validation, serialization, parsing and selection of the four-field timing policy. Active orders accept the current operations policy; terminal orders use their validated snapshot, while terminal/backdated legacy rows without a snapshot retain the 50/15/30/40 legacy behavior. A malformed non-null snapshot is distinguished from absence and fails closed.
- Existing optional call signatures remain compatible. Scheduled preparation/grace, immediate late/very-late states, queue ordering/classification, kitchen timing copy and dashboard operational durations can consume the effective timing policy without changing strict `>` boundaries or floor rounding.
- Finalization loads the current operations policy on the server and commits status, `finished_at` and the complete timing snapshot in one guarded batch. Policy/state races cannot leave partial history; repeated finalization preserves the first timestamp and snapshot.
- Cancellation snapshots only an active `Em preparo` order. A legacy `Finalizado` order is not backfilled, and a snapshot written by concurrent finalization is preserved. Timing revision, cancellation reason, state, print cleanup and optional refund effects share the atomic commit.
- Cancellation validates any existing snapshot before loading policy or creating effects. Malformed snapshots on active or finalized orders return `ORDER_TIMING_SNAPSHOT_INVALID` without changing order history, first-use state, pending printing or refund state. Policy conflicts use a neutral operational-settings message.
- All official order read paths expose `timingPolicySnapshot`. The T09 table-tab close-result association remains unchanged.

### TDD, verification and review

| Evidence | Result |
|---|---|
| Baseline affected selection before implementation | Exit 0; 88/88 passed. |
| Shared behavioral RED | `node --test shared/businessTiming.test.js` exited 1; 0/5 passed because policy selection and current-limit behavior were absent. After implementation, one expectation was corrected to retain required floor rounding; the shared file then passed 5/5. |
| Worker behavioral RED | `node --test shared/businessTiming.test.js worker/orderTimingSnapshot.test.js` exited 1; 6/12 passed. The six failures demonstrated missing persistence/read/concurrency behavior. The first worker GREEN passed 12/12. |
| Review-hardening RED/GREEN | Independent review identified one Important fail-closed issue and one Minor misleading conflict message. Three deterministic assertions failed before the fix: both malformed-snapshot cancellations had already committed and the timing-race message named cancellation reasons. After pre-mutation validation and a neutral message, `worker/orderTimingSnapshot.test.js` passed 12/12. |
| Final affected selection | Exit 0; 120/120 passed across shared timing, workflow, queue, ticket, analytics, kitchen clocks, order snapshot/finalization, cancellation HTTP/domain/repository, official read mapping and T09 business-policy integration. Zero failures/skips/cancellations. |
| Static gates | Installed Oxlint and `node --check` passed on all 13 changed JavaScript/test files. `git diff --check` passed; Git emitted only the checkout's existing LF-to-CRLF notices. |
| Build | The sandboxed attempt failed only with `EPERM` writing Vite's `node_modules/.vite-temp`. The authorized rerun outside that restriction exited 0; Vite transformed 371 modules and completed the production build with only the existing large-chunk warning. |

The independent read-only rereview confirmed both findings resolved and reported no remaining issue in that scope; its focused snapshot test also passed 12/12. Direct diff review found no additional T10 contract deviation.

The legacy `worker/tableTabLifecycle.test.js` was not included in the final affected selection because its fixture still lacks the already-published T09 `business_*` schema; correcting that unrelated obsolete fixture is outside T10. The aggregate `npm test` suite was deliberately not run, so this checkpoint does not approve it. Migrations, the D1 gate, remote migrations, merge, deploy and release were not run.

Workflow triggers were rechecked: staging deployment watches only `feature/centralized-qz-print-queue`; production deployment is manual; validation push watches `master`; TDD workflows watch unrelated branches. A normal push of `feature/spec-b-settings-policies` does not trigger deployment.

`TEST-INFRA-01` remains **OPEN / cause unconfirmed** and continues to block merge/release. T10 neither resumes nor resolves that investigation. T11 is **not authorized and not started**.

## T10 follow-up — deferred refund snapshot validation

Starting from clean, synchronized `02e6571e9e95b9770716e09d8b6e35a42289b430`, the review follow-up confirmed one narrowly scoped post-commit validation gap in `registerOrderRefund`. The function read the raw order context, committed the refund batch and only then called `mapContext`, where T10 snapshot validation could reject the response. Functional fix commit: `cf64ad12a21ab7d1aec2fbe79cfa700fe4562ee2` (`fix: validate timing snapshot before deferred refund`).

- Real-SQLite behavioral RED: `node --test worker/orderTimingSnapshot.test.js` exited 1 at 14/16 passed. Both malformed JSON and a valid JSON object with an invalid timing shape returned `ORDER_TIMING_SNAPSHOT_INVALID`, but the post-rejection query found one persisted `order-refund` movement (`1 !== 0`). The test also captures the order and payment rows so response rejection alone cannot satisfy it.
- Minimal correction: `registerOrderRefund` reuses `parseOrderTimingPolicySnapshot(existing.timing_policy_snapshot_json)` after the existing eligibility and duplicate-refund checks and before payment-policy lookup, guard preparation or refund INSERT. `mapContext` validation remains in place; invalid snapshots receive no defaults or backfill.
- Focused GREEN: the same file passed 16/16. Both invalid representations now leave zero refund movements, and order, payment and original snapshot bytes remain unchanged. A complete four-field snapshot permits the refund; an absent legacy snapshot also permits it and remains `NULL`.
- Proportional final selection: `node --test worker/orderTimingSnapshot.test.js worker/orderCancellation.test.js worker/orderCancellationHttp.test.js worker/businessPolicyIntegration.test.js` passed 38/38, with zero failures/skips/cancellations. No complementary consumer was added because the diff changes only the repository function already exercised by the requested domain, HTTP and payment-policy integration paths.
- Targeted installed Oxlint, `node --check` on both changed JavaScript/test files and `git diff --check` exited 0. Git emitted only the checkout's existing LF-to-CRLF notices.
- Direct review of the two-file diff confirmed that eligibility, duplicate prevention, active payment-method policy and guards, refund values/history, response contracts and error codes are preserved. The review was direct, not delegated or independent, and found no remaining issue in this follow-up scope.

Origin, branch scope and workflow triggers were reconfirmed before publication. A normal push of `feature/spec-b-settings-policies` does not trigger deployment. Per authorization, the 120-test T10 selection was not repeated, and aggregate `npm test`, build, migrations and the D1 gate were not run. No merge, force-push, deploy, release or remote migration is part of this follow-up.

`TEST-INFRA-01` remains **OPEN / cause unconfirmed** and continues to block merge/release. T11 and T12 remain **not authorized and not started**.

## T11 — migration de vias por contexto

T11 iniciou na worktree isolada limpa, em `331855b5df74c02edf998238c3d20e6264126328`; `git ls-remote` confirmou o mesmo SHA em `origin/feature/spec-b-settings-policies`. A numeração real termina em `0024`, portanto `0025_print_context_copies.sql` não colide.

Antes da implementação, o schema final aplicado foi inspecionado por `sqlite_schema`, `table_info`, `foreign_key_list` e `index_list`. A reconstrução preservará linhas completas e todos os vínculos por cópias temporárias sem FKs de `print_jobs`, `print_job_attempts` e da afinidade `print_stations.recovery_job_id`; jobs serão restaurados com colunas explícitas, `parent_job_id` será religado somente após todos os jobs existirem, tentativas e recovery serão restaurados em seguida, e os índices finais serão recriados sem depender de `PRAGMA foreign_keys=OFF` ou de `defer_foreign_keys` para impedir ações de FK. O gate D1 local aplicará 0001–0024, inserirá somente fixtures sintéticas, aplicará 0025 pelo caminho real de migrations e comparará linhas/referências/constraints; também cobrirá instalação limpa completa.

### Checkpoint concluído da T11

- Baseline proporcional anterior: `node --test worker/settingsMigration.test.js worker/orderPrintingMigration.test.js worker/printAttemptRepository.test.js worker/orderPrintingRecovery.test.js` passou 37/37. A pendência nominal `worker/tableTabLifecycle.test.js` foi conferida e esse caminho não existe neste HEAD; o teste real próximo, `worker/tableTabLifecycleRepository.test.js`, será incluído na seleção afetada da T12 e sua fixture só será ajustada se a execução demonstrar necessidade.
- RED comportamental: `node --test worker/printContextMigration.test.js` confirmou que 0001–0024 rejeitava table-tab manual com duas vias e terminou 2/4, com as duas falhas esperadas na aceitação pós-migration/instalação limpa. Ausência de módulo não foi usada como RED.
- GREEN focado: o mesmo comando passou 4/4. As fixtures cobrem todos os oito status válidos de job, os sete status de tentativa, snapshots/documentos, parent, identificação do spooler, cópias, decisões/timestamps de segunda via, disponibilidade, erros/atenção, recovery, configuração e topologia de estações. Linhas completas e objetos do schema são comparados antes/depois; identidades inválidas continuam rejeitadas.
- Gate D1 local obrigatório: a primeira tentativa sandboxed foi bloqueada por acesso ao diretório temporário. A repetição autorizada executou `node scripts/infra/spec-b-d1-gate.mjs` fora apenas dessa restrição e retornou `ok:true`, runtime `D1 local Worker`, Wrangler `4.128.0`, migrations `25`, `legacyRejectsTwoCopies:true`, `rowsPreserved:true`, `referencesPreserved:true`, `cleanInstall:true`; os nove checks D1 anteriores também permaneceram verdadeiros. O cenário aplica 0001–0024, insere somente fixtures sintéticas, aplica 0025 pelo comando real `d1 migrations apply` e compara as linhas completas antes/depois; outra persistência descartável aplica a sequência limpa completa. Nenhum banco remoto, credencial ou endpoint do Worker da aplicação foi usado.
- Regressão encontrada no fechamento: a expectativa histórica de `worker/settingsMigration.test.js` comparava `sqlite_master.rootpage` e o SQL antigo byte a byte. Ela foi atualizada pontualmente para ignorar apenas alocação/formatação e o CHECK deliberadamente alterado, continuar comparando os demais objetos e exigir explicitamente table-tab `copies_requested IN (1, 2)`.
- Seleção final T11: `node --test worker/printContextMigration.test.js worker/settingsMigration.test.js worker/orderPrintingMigration.test.js worker/printAttemptRepository.test.js worker/orderPrintingRecovery.test.js` passou 41/41. `node --check` passou nos quatro JavaScript alterados; Oxlint direcionado e `git diff --cached --check` saíram 0.
- Revisão direta do schema, migration, probe e diff — não independente e sem subagente, pois esta sessão não autoriza delegação — não encontrou item Critical, Important ou Minor restante no escopo T11. Commit funcional: `f40662a` (`feat: allow two-copy table-tab jobs preserving print history`).

O `npm test` agregado e build não foram executados na T11; o handoff os reserva ao fechamento da T12. Homologação física continua pendente e nenhuma impressão real foi disparada. `TEST-INFRA-01` permanece **OPEN / cause unconfirmed** e bloqueia merge/release. T12 está autorizada a seguir somente após este checkpoint; T13 permanece não autorizada.

## T12 — vias por contexto e segunda via de comanda

T12 iniciou somente após o checkpoint e os commits da T11, sobre `e5628d2`. O escopo ficou limitado ao resolvedor de vias, consumidores de criação de jobs, segunda via/recovery já existentes, testes afetados e ao guia para homologação física posterior. `src/printing/printRecoveryFlow.js` e `src/pages/PrintQueue.jsx` foram caracterizados, mas não precisaram de alteração: o recovery já conserva a afinidade do job até decisão terminal e as ações/identidade de segunda via na fila já eram neutras ao tipo. Nenhum trabalho de T13 foi iniciado.

- RED comportamental: após o scaffold mínimo do novo módulo, `node --test shared/printContextPolicy.test.js worker/printContextPolicy.test.js src/printing/tableTabSecondCopy.test.js` falhou pelo código explícito `PRINT_CONTEXT_POLICY_NOT_IMPLEMENTED`; o runner/prompt também não possuía o contrato de comanda. Erros iniciais de fixture foram corrigidos antes de contar o GREEN e ausência de módulo não foi tratada como evidência suficiente.
- O resolvedor `resolvePrintCopies` valida a policy canônica, mantém teste sempre em uma via, aceita somente escolha explícita numérica 1/2 e distingue comanda por `jobType`, `customerIdentityType === 'table'` ou vínculo durável `tableTabId`. O texto legado `Local` sozinho não participa da decisão.
- Criação automática e criação manual sem escolha leem a policy revisionada do negócio e gravam `copies_requested` no mesmo compromisso protegido por assertion. Corridas de revisão retornam `409 POLICY_CHANGED` e deixam zero pedido/job parcial. Escolha explícita válida dispensa reconsulta de default; retry, continuação e jobs já enfileirados preservam seu snapshot de cópias.
- O executor agora fornece `copyNumber/totalCopies` também ao documento `table-tab`; o prompt global aceita comanda sem `orderId` fictício e mostra `Comanda #N`. O popup de origem continua exclusivo a pedidos. `requestSecondCopy` aceita table-tab e preserva o mesmo job/documento; fechamento posterior da comanda não troca a identidade. Reprint de pedido continua criando novo job manual com `parentJobId` e sem reescrever o original.
- Fixtures antigas diretamente afetadas foram atualizadas apenas com o schema mínimo das policies revisionadas. Nenhum fallback de produção para schema ausente foi criado. O teste nominal `worker/tableTabLifecycle.test.js` continua inexistente; o caminho real `worker/tableTabLifecycleRepository.test.js` foi executado e passou 8/8 após sua fixture receber as dependências já obrigatórias de T09/T10/T12.
- GREEN focado final: `node --test shared/printContextPolicy.test.js worker/printContextPolicy.test.js src/printing/tableTabSecondCopy.test.js` passou 12/12, sem falhas/skips/cancelamentos.
- Regressão completa focada: a seleção de arquivos cujo nome contém `printing`, `print` ou `comandas` passou com reporter dot e exit 0; o subconjunto complementar de arquivos `tabletab` passou 60/60 e exit 0. As primeiras tentativas sandboxed dos testes React falharam somente com o `EPERM` já conhecido ao criar `node_modules/.vite-temp`; a repetição autorizada fora dessa restrição passou. O `npm test` agregado não foi executado.
- Build: `npm.cmd run build` passou fora da restrição de escrita do sandbox (371 módulos; exit 0), com apenas o aviso não bloqueante já conhecido de chunk maior que 500 kB.
- Estática: Oxlint direcionado a todos os JavaScript/JSX alterados saiu 0, mantendo somente warnings preexistentes de hooks/set-state em `App.jsx`/`usePrintingManager.js`; `node --check` passou em todos os `.js` alterados e `git diff --check` saiu 0.
- Revisão direta — sem subagente por restrição desta sessão — conferiu fronteiras de policy, SQL/bindings, fail-closed, snapshots, afinidade, UI e diff; não encontrou item Critical, Important ou Minor restante. Commit funcional: `05edb2a` (`feat: apply print copies by context including table-tab recovery`).
- O guia `docs/superpowers/qa/2026-09-12-spec-b-physical-printing-guide.md` foi criado com status explícito PENDENTE, matriz para avulso/mesa/comanda 1–2 vias, teste, retry, resultado desconhecido, reprint, mudança de policy, fechamento/transferência, recovery e solicitação remota. Nenhuma impressão real, staging, deploy ou migration remota foi executada.

Checkpoint R3 concluído localmente. `TEST-INFRA-01` permanece **OPEN / cause unconfirmed**, o agregado continua não aprovado e merge/release seguem bloqueados. T13 permanece **não autorizada e não iniciada**.

## T12-COMPAT-01 — contrato de vias da comanda no runner/renderer

O ajuste autorizado iniciou na worktree isolada limpa e sincronizada em `f068f30d133699f3421cd7c207a984409b6dbd13`. `origin` e `git ls-remote` confirmaram o repositório e a branch autorizados no mesmo SHA. A incompatibilidade ficou limitada ao ramo sem `qzAttempt`: `printJobRunner` enviava `copyNumber/totalCopies` para `table-tab`, embora o renderer real aceite a pré-conta como uma via por execução. O caminho QZ já enviava somente `{ copies: 1 }`; isso não demonstrava falha de hardware, perda de dados ou impressão Windows homologada.

- RED comportamental: `node --test src/printing/tableTabSecondCopy.test.js src/printing/escpos58mm.test.js src/printing/printJobRunner.test.js src/printing/qzPrintAttemptController.test.js` terminou 28/31. As três falhas esperadas foram comanda 1/1, 1/2 e 2/2 no runner alternativo usando o renderer real; todas retornaram `failed` antes do transporte. Os três cenários QZ reais passaram, confirmando uma chamada de transporte e o número de tentativa correspondente.
- Correção mínima: apenas documentos `order` recebem seleção explícita de via no renderer; `table-tab` e `test` continuam com `{ copies: 1 }`. `copiesPrinted + 1` continua determinando conclusão/tentativa, sem transporte novo, lote, layout adicional, reenvio ou relaxamento indiscriminado do renderer.
- GREEN e regressões: o mesmo comando passou 31/31, zero falhas/skips/cancelamentos. Os testes reais cobrem comanda 1/1, 1/2 e 2/2 nos dois caminhos, uma chamada física por execução, contador correto e preservação dos contratos de pedido/teste e valores inválidos do renderer.
- Estática: `node --check` passou nos três JavaScript alterados; Oxlint direcionado e `git diff --check` saíram 0. A revisão direta do patch confirmou impacto limitado e nenhum item Critical, Important ou Minor restante. A revisão não foi independente e não usou subagente, pois esta sessão não autoriza delegação.
- Commit funcional: `64765fcd903103ca16686316a20aa4d04d6ae1e3` (`fix: align table tab copy rendering contracts`).

Nenhum `npm test` agregado, build, migration, gate D1, impressão física, deploy ou migration remota foi executado neste checkpoint. `TEST-INFRA-01` permanece **OPEN / cause unconfirmed**, o agregado continua não aprovado e a homologação física segue pendente. T13 está autorizada a iniciar após este checkpoint; T15 permanece não autorizada.

## T13 — cliente e sincronização da configuração efetiva

T13 iniciou somente após o commit e o checkpoint documental T12-COMPAT-01. Foram criados o cliente tipado de settings e o cache/hook de configuração efetiva; `App.jsx`, o cliente HTTP e o bootstrap Worker receberam somente a integração necessária ao ciclo global existente.

- RED comportamental: após interfaces mínimas export-only, `node --test src/api/settingsClient.test.js src/app/effectiveBusinessConfig.test.js` terminou 0/6 com `SETTINGS_CLIENT_NOT_IMPLEMENTED`, ownership recusando resposta válida e cache ausente. Um RED adicional em `worker/index.test.js` terminou 14/15 porque o bootstrap ainda não devolvia `effectiveConfigVersion` nem omitia a projeção completa para versão conhecida.
- Cliente: `getSettings`, `putSettings`, `getSettingsReceipt` e `getEffectiveConfig` mapeiam os quatro recursos gerais e os endpoints reais de impressão. Os envelopes `settings`, `station`, `primary` e recursos gerais são normalizados sem confundir `stationConfiguration:<scopeId>` com `stationPrimary`; combinações inválidas de recurso/escopo falham antes do transporte.
- Sincronização: a projeção inicial vem do bootstrap. O mesmo ciclo global de intervalo/foco/reconexão envia a versão opaca conhecida; se igual, o Worker retorna somente `effectiveConfigVersion` junto das coleções, sem reenviar a projeção completa. Se diferente, o bootstrap inclui uma projeção completa. Não foi criado timer, polling por página ou segundo conjunto oficial das coleções.
- Cache: a identidade combina negócio, geração da sessão, `settingsContextId` e capabilities ordenadas. Request IDs descartam respostas fora de ordem; versões opacas são comparadas somente por igualdade; revisões numéricas por domínio impedem regressão. Logout/expiração/troca de contexto limpa o cache e invalida callbacks tardios. Erros não criam defaults confirmados e nenhum token vai para storage.
- GREEN e regressões finais: `node --test src/api/settingsClient.test.js src/app/effectiveBusinessConfig.test.js src/realtimeSyncRegression.test.js src/financeRealtimeRegression.test.js src/orderStateOwnershipRegression.test.js src/api/client.test.js worker/index.test.js` passou 35/35, sem falhas/skips/cancelamentos.
- Estática/revisão: `node --check` passou nos módulos JavaScript alterados; Oxlint direcionado não reportou diagnóstico nos arquivos novos/T13 e `git diff --check` saiu 0. A revisão direta conferiu rotas, envelopes, ownership, revisões, ciclo global e invalidadores; nenhum Critical ou Important permaneceu. Não houve revisão independente/subagente nesta sessão.
- Commit funcional: `6e3678dbfe0c470306f923c42cddfd990a991ec2` (`feat: synchronize effective business configuration centrally`).

O build fica reservado ao fechamento acumulado após T14, conforme o handoff. `npm test` agregado, migrations e gate D1 não foram executados. `TEST-INFRA-01` permanece **OPEN / cause unconfirmed**, o agregado segue não aprovado e a homologação física continua pendente. T14 está autorizada a iniciar após este checkpoint; T15 permanece não autorizada.

## T14 — estado de edição e gravação recuperável

T14 iniciou somente após os commits funcional e documental de T13. Foram criados o reducer de estado completo, o ponteiro mínimo de recuperação em `sessionStorage` e o controlador compartilhado de settings, integrados ao ownership central do `App.jsx`. Não foi criada UI de domínio, comparação visual de conflito ou qualquer parte de T15.

- RED comportamental: com interfaces export-only, `node --test src/app/settingsState.test.js src/app/settingsPendingStorage.test.js src/app/useBusinessSettingsController.test.js` terminou 1/14, com 13 falhas esperadas. Durante o GREEN, o teste de logout capturou e corrigiu uma corrida antes do início do PUT; uma revisão adicional registrou em RED que uma confirmação não podia apagar edições feitas após o envio.
- Estado: `confirmed`, `base`, `draft` e `submitted` permanecem separados. A intenção submetida é imutável; edições posteriores sobrevivem à confirmação e continuam dirty contra a nova base. Conflito 409 preserva os insumos para T15 sem implementar comparação ou resolução visual.
- Gravação: cada tentativa usa uma única `mutationId`, `expectedRevision` e hash SHA-256 canônico. Resultado desconhecido bloqueia novo PUT e reconcilia somente por receipt GET seguido do recurso atual; nunca repete a escrita. Resposta confirmada aceita revisão igual ou posterior ao receipt, sem regressão.
- Recuperação: `sessionStorage` conserva apenas recurso/escopo, mutation ID, hash, instante e `settingsContextId`, sem payload, token ou dados reais. O limite é exatamente 24 horas; ao expirar, o controlador exige leitura explícita do estado atual e não reenvia. Falha de storage não produz falsa confirmação de persistência.
- Ownership: recursos com escopos distintos são independentes; negócio, geração da sessão, `settingsContextId` e capabilities definem o contexto. Logout/expiração/troca de contexto limpam ponteiros do contexto anterior e invalidam respostas tardias, inclusive a janela assíncrona de cálculo do hash.
- Compatibilidade/regressões: o fixture antigo de segunda via em `actionCapabilities.test.js` passou a declarar `type: 'order'`, conforme o contrato já publicado em T12. Os testes focados passaram 15/15 e as regressões reais de navegação, capabilities e controlador de impressão passaram 40/40 com concorrência de arquivos 1 para evitar colisão entre globals dos harnesses Vite.
- Fechamento acumulado: a seleção afetada de T12-COMPAT, T13 e T14 passou 121/121, zero falhas/skips/cancelamentos. `npm run build` passou, transformando 376 módulos; permaneceu somente o aviso não bloqueante de chunk principal acima de 500 kB.
- Estática/revisão: `node --check` passou em todos os JavaScript aplicáveis, `git diff --check` saiu 0 e Oxlint direcionado não reportou erro. Os sete warnings emitidos pertencem a efeitos já existentes em `App.jsx`; nenhum surgiu nos módulos/testes novos. A revisão direta do diff encontrou zero Critical, Important ou Minor remanescente. Não houve revisão independente/subagente nesta sessão.
- Commit funcional: `d0d908f8316c3e49b3da56a9b378ae102f489b74` (`feat: coordinate business settings edits safely`).

O `npm test` agregado, migrations, gate D1, impressão física, deploy e migration remota não foram executados. A suíte agregada permanece **não aprovada**, `TEST-INFRA-01` permanece **OPEN / cause unconfirmed** e a homologação física continua pendente. T15 permanece **não autorizada e não iniciada**. Este é o ponto de parada obrigatório após T14.

## Fechamento corretivo F1–F4 após T14

O fechamento iniciou na worktree isolada limpa, em `54a57521f51f6fc90ba964e562e06b0891aebd07`, com `origin/feature/spec-b-settings-policies` confirmado no mesmo SHA. O escopo ficou restrito aos quatro achados do handoff corretivo e a uma regressão de revisão encontrada no fechamento. T13/T14 não foram refeitas e T15 não foi iniciada.

### F1 — reserva síncrona e snapshot imutável da gravação

- RED: os testes demonstraram duas gravações imediatas da mesma chave produzindo dois PUTs e uma edição durante o hash substituindo indevidamente o payload submetido; a rodada terminou 7/10. Um digest injetado também verificou a liberação da reserva em erro de preparação.
- GREEN: a reserva por chave passa a existir antes do primeiro `await`; revisão esperada e dados são capturados uma única vez para hash, `saveStarted` e PUT. Erro, reset e mudança de contexto liberam a reserva. Reducer e controlador passaram 14/14.
- Commit: `64f1863fb21745510def01b65329a9cc5eeccd42` (`fix: reserve settings save intent before hashing`).

### F2 — refresh não destrutivo e revisão monotônica

- RED: cinco cenários reproduziram perda/regressão durante refresh após edição, durante saving, com storage bloqueado, após confirmação mais nova e após conflito/resultado desconhecido; a rodada terminou 10/15.
- GREEN: reads e writes receberam ownership separado; refresh estabelecido deixou de publicar loading/falha destrutivos e `loaded` preserva `base`, `draft`, `submitted` e status quando existe intenção local. Revisões inferiores são ignoradas. A seleção focada passou 23/23.
- Commit: `316aaacaa0af8820e2d2a004fc2385a94c5c8763` (`fix: preserve settings intent across refreshes`).
- Revisão adicional: receipt confirmado em revisão 2 ainda podia regredir uma confirmação 3 recebida por refresh. O RED terminou 17/18; a reconciliação agora exige revisão não inferior ao receipt nem ao confirmado corrente, e o GREEN conjunto passou 26/26. Commit: `db03b601d1d2a51c950cbfc1fe75a210cfaa2e1d` (`fix: prevent settings reconciliation revision regression`).

### F3 — contexto de settings estabelecido pelo servidor

- RED: cliente e integração terminaram 5/8 porque o login encerrava no POST e não obtinha `settingsContextId`/capabilities do endpoint real de sessão.
- GREEN: após o POST de login, o cliente consulta a sessão e valida identidade, contexto e capabilities; `App.jsx` deixou de inventar identidade `legacy:*`. A integração cobre resposta perdida, reload na mesma sessão sem segundo PUT e isolamento após logout/nova sessão. Cliente+integração passaram 8/8, a seleção com Worker 23/23 e navegação 5/5.
- Commit: `2c0eb29aeb77ebd7044e111f7287dd2bb3811d87` (`fix: establish trusted settings context after login`).

### F4 — expiração em memória e 401 na leitura obrigatória

- RED: a tentativa desconhecida apenas em memória não expirava no limite exato de 24 horas e um 401 durante a leitura corrente pós-expiração não encerrava o contexto; a rodada terminou 15/17.
- GREEN: a reconciliação calcula TTL para ponteiro persistido e tentativa em memória, no limite exato, sem receipt ou reenvio. O 401 da leitura obrigatória executa o encerramento seguro da sessão. A seleção focada passou 25/25.
- Commit: `9985fde1e04de51b6196513ffb75e17016e5bffd` (`fix: expire in-memory settings attempts consistently`).

### Verificação proporcional e revisão final

- Seleção final: `node --test --test-concurrency=1 --test-reporter=dot src/app/settingsState.test.js src/app/settingsPendingStorage.test.js src/app/useBusinessSettingsController.test.js src/api/client.test.js src/api/settingsClient.test.js src/app/effectiveBusinessConfig.test.js src/settingsSessionRecovery.test.js src/navigationContext.test.js src/settingsNavigation.test.js worker/index.test.js` passou 73/73 (exit 0).
- Build final: `npm.cmd run build` passou (376 módulos; exit 0), mantendo apenas o aviso conhecido de chunk acima de 500 kB.
- Estática: `node --check` passou; Oxlint direcionado saiu 0 com os mesmos sete warnings preexistentes de hooks/set-state em `App.jsx`; `git diff --check 54a57521f51f6fc90ba964e562e06b0891aebd07..HEAD` saiu 0.
- A revisão direta identificou e fechou a regressão suplementar de F2 acima; depois dela, não encontrou item Critical, Important ou Minor restante no escopo. Não houve revisão independente/subagente nesta sessão.

O conjunto agregado de 121 testes não foi repetido e `npm test` não foi executado. Migrations, gate D1, impressão física, deploy, migration remota, merge e release não foram executados. A suíte agregada permanece **não aprovada**, `TEST-INFRA-01` permanece **OPEN / cause unconfirmed** e a homologação física continua pendente. T15 permanece **não autorizada e não iniciada**.

## T15 — conflito em três estados e descarte de rascunhos

T15 iniciou sob autorização exclusiva na worktree isolada limpa, em `2d2524286f7290361f7e33345f5d2c434eb6178a`. Antes das alterações, `origin`, branch local e `git ls-remote` confirmaram `https://github.com/vzaponi-dotcom/sistema-para-delivery.git`, `feature/spec-b-settings-policies` e o mesmo SHA. O escopo ficou restrito ao merge/revisão de conflitos, proteção de navegação e testes diretamente relacionados; T16 não foi iniciada.

- RED comportamental: depois de criar interfaces mínimas executáveis, o comando focado exigido terminou 0/16 porque o merge ainda recusava todos os cenários e a navegação não reconhecia rascunhos de settings. Um primeiro GREEN parcial revelou que dados remotos iguais à base ocultavam uma mudança de metadados de primeiro uso; a ordem de comparação foi corrigida para sempre avaliar permissões de listas por ID.
- Merge em três estados: alterações apenas remotas, apenas locais e iguais são combinadas sem colisão; mudanças divergentes permanecem sem escolha destrutiva padrão. Listas são comparadas por ID estável, reordenação é uma decisão da lista inteira e delete versus edit exige resolução. A revisão direta acrescentou uma regressão para exclusão local + adição remota, evitando falso conflito de ordem.
- Proteções: metadados atuais de item nativo/primeiro uso removem escolhas de renomeação ou exclusão agora ilegais, explicam a mudança do estado do negócio e preservam a referência histórica. A revisão aceita atualiza a base para a revisão corrente e reaplica o candidate somente via `edit`; nenhum PUT ocorre até um novo clique explícito em salvar, que gera nova mutation ID.
- UI e ciclo de vida: o modal mostra “Atual no negócio”, “Seu ajuste” e “Escolha para salvar”, exige seleção explícita em colisões, bloqueia duplo clique e reutiliza Escape, trap/restauração de foco do `Modal`. Logout/reset invalida revisões abertas e callbacks tardios.
- Navegação: sair de editor dirty abre Continuar editando/Descartar alterações, fecha Mais antes da decisão, aceita uma intenção por vez e revalida o destino e o rascunho antes do descarte. Subáreas do mesmo agregado preservam o draft. Saving/unconfirmed permitem navegação sem nova escrita; o guard anterior de Novo Pedido foi preservado. `beforeunload` existe somente para dirty/saving/unconfirmed e não promete texto customizado.
- GREEN focado: `node --test src/app/settingsConflict.test.js src/components/SettingsConflictReview.test.js src/settingsDraftNavigation.test.js` passou 16/16. Após a revisão direta, núcleo + controlador passaram 37/37.
- Regressões: a seleção de `useBusinessSettingsController`, `navigationContinuity`, `navigationContext`, `confirmationFlowRegression`, `AppNewOrderGuard`, `app/navigation`, `settingsNavigation` e `actionCapabilities` passou 77/77. A seleção final conjunta e proporcional passou 62/62, sem falhas/skips/cancelamentos. Os testes do controlador preservaram explicitamente as correções F1–F4.
- Gates: `node --check` passou nos módulos JavaScript alterados; Oxlint direcionado saiu 0, mantendo somente os mesmos sete warnings preexistentes em trechos não alterados de `App.jsx`; `git diff --check` saiu 0. `npm.cmd run build` passou com 378 módulos e apenas o aviso conhecido de chunk acima de 500 kB.
- Revisão direta — sem subagente por restrição desta sessão — conferiu merge, perda silenciosa, ausência de gravação por conflito/navegação, proteção após mudança remota, F1–F4 e acessibilidade básica. Nenhum item Critical, Important ou Minor permaneceu. Commit funcional: `669b914c336e22859e5ec1dc4a52338b1160a992` (`feat: review settings conflicts and protect unsaved navigation`).

O `npm test` agregado, os conjuntos automáticos de 73/121, migrations, gate D1, impressão física, QZ, supervisor, deploy, migration remota, merge e release não foram executados. A suíte agregada permanece **não aprovada**, `TEST-INFRA-01` permanece **OPEN / cause unconfirmed** e a homologação física continua pendente. T16 permanece **não autorizada e não iniciada**. Este é o ponto de parada obrigatório após T15.

## Follow-up corretivo T15 — ordem ao restaurar item em delete-edit

O follow-up iniciou em worktree temporária isolada e detached exatamente na base remota `11d0e96520d57919eb360f632441f244aedbc91e`, porque o checkout local principal já continha commits posteriores ainda não publicados. O escopo ficou limitado à resolução de conflitos de item, seus testes comportamentais e este ledger; nenhum arquivo ou commit de T16+ integra esta correção.

- RED comportamental: `node --test src/app/settingsConflict.test.js` terminou 7/9. Em `base=[A,B,C]`, `draft=[A,B editado,C]` e `current=[A,C]`, o conflito `delete-edit` existia e a escolha `current` mantinha B removido, mas a escolha `draft` produzia `[A,C,B editado]`; a variação com move+edit também anexava B ao fim em vez de respeitar `[B editado,C,A]`.
- Correção mínima: quando a escolha restaura um item ausente, a resolução insere uma única cópia e aplica à lista candidata a ordem inteira da lista do lado escolhido. A mesma rotina atende a resolução explícita de conflitos de ordem, sem usar o índice da base como regra geral. Substituição de item já presente, remoção, add-add e first-use permanecem em seus ramos existentes.
- GREEN focado: o mesmo comando passou 9/9. Os testes verificam ambos os sentidos de `delete-edit`, restauração e remoção, ordem normal e ordem draft movida, conteúdo editado, ausência de duplicação implícita e `sortOrder` normalizado conforme a ordem final.
- Seleção final solicitada: `node --test src/app/settingsConflict.test.js src/components/SettingsConflictReview.test.js src/settingsDraftNavigation.test.js src/app/useBusinessSettingsController.test.js` passou 39/39, sem falhas, skips ou cancelamentos. Permaneceram somente os avisos já emitidos pelo harness React sobre `react-test-renderer` deprecado.
- Gates: `node --check` passou nos dois JavaScript alterados; Oxlint direcionado a esses arquivos saiu 0 sem diagnósticos; `git diff --check` saiu 0, com apenas os avisos de checkout LF/CRLF do ambiente Windows.
- Revisão direta conferiu restauração, ordem, `sortOrder`, os dois lados de delete-edit, reorder, add-add e proteção first-use. O commit funcional é o commit contendo este ledger, com subject `fix: preserve chosen order when restoring settings items`.

Os conjuntos antigos de 62/77/73/121 testes, `npm test` agregado, build, migrations, gate D1, impressão física, QZ, supervisor, deploy, migration remota, merge e release não foram executados. T16 não foi iniciada neste follow-up. Parada obrigatória após a publicação desta correção T15.

## T16 — Home de Configurações e componentes visuais compartilhados

T16 iniciou em worktree temporária limpa e detached exatamente na base remota aprovada `ba6dd49b37a94c50ea11c97c854cb12947af9d75`. O checkout local posterior foi preservado sem rebase/reset: `42abe4f`, `bf035e5`, `1b4df71` e `2355f53` eram referências estritas de T16; `036b9f2` e `3f541a7` eram T17; `a59c21c` era um corretivo misto dependente de T17. Nenhum desses commits foi cherry-picked ou entrou em bloco na ancestry desta publicação.

- RED: após os testes e interfaces mínimas executáveis, `node --test src/pages/SettingsHome.test.js src/components/SettingsPrimitives.test.js` terminou 0/13 por ausência dos comportamentos de cards, capabilities, estados acessíveis, ações, modal, lista responsiva e tokens. Um segundo RED de revisão terminou 12/14 porque os cards ainda usavam descrição genérica e o shell não anunciava rascunho pendente. A prova isolada de área ativa também falhou ao retirar `settings-home` do conjunto da Sidebar (`aria-current` ausente), antes da restauração do código correto. A revisão independente produziu RED 7/11 para recuperação dos estados do controlador, tipo financeiro, validação persistente e descrição acessível; a checagem final de foco inválido produziu RED isolado 0/1.
- Home: o contrato reutilizável contém os sete acessos aprovados com ícone, título, descrição específica e card inteiro acionável. A renderização exige simultaneamente capability e destino implementado; a integração desta T16 marca somente Home, Impressão e Preferências deste dispositivo, portanto T17–T20 permanecem registradas mas indisponíveis e não aparecem como placeholders. `preferences.local` continua oferecendo somente o dispositivo quando é a única concessão.
- Primitivos: `SettingsEditorShell` cobre loading/ready, dirty, saving, unconfirmed, conflict, error e read-only com texto, `aria-live`/status e alertas; suas ações respeitam os estados reais do controlador, incluindo retry após falha conclusiva, reconsulta de resultado desconhecido e entrada explícita na revisão de conflito. Salvar/descartar exigem clique explícito e o footer reserva espaço com safe area sem posição que cubra navegação ou teclado. `SettingsItemList` usa linhas/cartões e ações nativas sem tabela comprimida, associando a razão de bloqueio ao controle. `SettingsItemDialog` aceita somente os kinds contratuais cancellation/finance, usa `SystemSelect` para Entrada/Saída, mantém o diálogo aberto em validação, associa e anuncia o erro, devolve foco ao primeiro campo inválido, reaproveita Modal/Button e altera apenas o draft via `onAdd`, sem PUT ou save próprio.
- Navegação: `settings-home` é o fallback da área; os destinos futuros foram registrados sem serem marcados como implementados; `settings-printing` e `settings-device` continuam válidos. Sidebar e Mais continuam com uma única área Configurações, agora ativa para todos os destinos registrados. O fluxo de draft/descartar/beforeunload e Novo Pedido não foi alterado.
- Identidade visual: CSS usa exclusivamente os tokens reais de superfície, texto, borda, raio, sombra e vermelho primário; não introduz azul nem paleta inline. A grade responsiva reduz até uma coluna em 640 px, a lista empilha ações no mobile e os testes reais do `workspaceHarness` verificam mobile, tema claro/escuro, teclado, Escape e restauração de foco.
- GREEN focado final: o comando T16 passou 20/20. A seleção proporcional conjunta com `navigationLayout`, `settingsNavigation` e `app/navigation` passou 55/55, sem falhas, skips ou cancelamentos; permaneceram somente avisos do harness sobre `react-test-renderer` deprecado.
- Gates: `node --check` passou nos quatro JavaScript aplicáveis; Oxlint direcionado a todos os JavaScript/JSX alterados saiu 0, repetindo somente os sete warnings preexistentes em trechos não alterados de `App.jsx`; `git diff --check` saiu 0 com apenas avisos LF/CRLF do checkout Windows. `npm.cmd run build` passou com 380 módulos e sem erro.
- Revisões direta e independente conferiram contrato visual, claro/escuro, mobile, teclado, capabilities, ausência de placeholders, ausência de autosave e preservação de T15/F1–F4. A revisão independente encontrou e motivou as correções de matriz de ações do shell, seleção estruturada de tipo financeiro, permanência/associação de erros, razão acessível de ação desabilitada e foco no primeiro campo inválido; todos esses achados receberam regressões comportamentais antes do GREEN. Na reavaliação read-only final, sua seleção proporcional passou 94/94 e o veredito foi Ready, com zero Critical, Important ou Minor remanescente e nenhum código T17. O commit funcional é o commit contendo este ledger, com subject `feat: build responsive settings home and editor primitives`.

O `npm test` agregado, os conjuntos antigos 39/62/77/73/121, migrations, gate D1, impressão física, QZ, `TEST-INFRA-01`, deploy, migration remota, merge e release não foram executados. T17 não foi iniciada nem publicada nesta execução. Parada obrigatória após T16.

## T17 — Tela de Operação e acesso de Modalidades

T17 iniciou em worktree temporária isolada, limpa e detached exatamente na base remota aprovada `96c06818cb20709a1f68ae5c936135e2dc61ce47`. Os commits locais antigos de T17 foram consultados somente como referência: nenhum deles foi cherry-picked e nenhum commit ou componente de T18 entrou na ancestry ou no diff desta execução.

- RED/GREEN: o primeiro RED comportamental real, antes da criação de `OperationSettings.jsx`, terminou 0/1 porque os dois destinos ainda caíam na tela de Impressão. A caracterização completa terminou 0/9; o primeiro GREEN passou 9/9. Uma mutação isolada que apontou Modalidades para um segundo recurso fez a regressão de draft compartilhado falhar 0/1 e, restaurado o wiring único, o foco passou 10/10. A revisão independente motivou novo RED 0/2 para reapresentação de conflito e contagem de pendências; após a correção e a cobertura mobile renderizada, o foco final passou 11/11.
- Recurso único: `settings-operations` e `settings-modalities` renderizam a mesma `OperationSettings` e usam exclusivamente `businessSettings.resources.operations`, `load('operations')`, `edit('operations')`, `save('operations')`, `discard('operations')`, `reconcile('operations')` e `reviewConflict('operations')`. Alternar as entradas mantém base, draft, revision, conflito e intenção de gravação; nenhuma segunda fonte oficial foi criada.
- Tempos: os quatro campos preservam as faixas 0–240, 0–120, 1–180 e 1–240, exigem inteiros e validam `immediateVeryLateAfterMinutes > immediateLateAfterMinutes`. Cada campo usa input numérico com `inputMode="numeric"`, unidade `min`, limites nativos, erro associado e foco no primeiro inválido. `onChange` somente altera o draft; salvar permanece uma ação explícita. O texto aprovado esclarece que mudar a antecipação pode mover pedidos agendados entre espera/operação, mas não altera o horário de impressão já definido.
- Modalidades: somente Entrega, Retirada e Local aparecem, na ordem fixa, sem criar, renomear, excluir ou reordenar. A UI impede desativar o padrão e a última modalidade ativa. Trocar o padrão mantém a anterior ativa; sua desativação posterior é opcional e explícita, sem substituição silenciosa.
- Estados e acessibilidade: `SettingsEditorShell` cobre loading, ready/dirty, saving, unconfirmed, conflict, error e read-only; estados bloqueados também bloqueiam os campos. A entrada Modalidades foca e rola seu bloco quando os dados aparecem, sem roubar foco em edições seguintes. Erros no outro bloco continuam renderizados, com contagem singular/plural e atalho acessível. O retry manual de conflito encaminha a revisão retornada ao modal pertencente ao `App`.
- Layout/compatibilidade: Tempos usam duas colunas no desktop e uma no mobile; modalidades viram linhas empilhadas sem largura/paleta inline, usando somente tokens existentes de tema. Testes renderizados cobrem viewport mobile, texto longo, labels completos e ação de footer. A rota de Impressão foi exercitada separadamente e permaneceu fora da tela/recurso `operations`; nenhum comportamento de impressão foi alterado.
- Regressões: `node --test src/pages/OperationSettings.test.js src/pages/SettingsHome.test.js src/components/SettingsPrimitives.test.js src/settingsNavigation.test.js src/navigationLayout.test.js src/app/useBusinessSettingsController.test.js` passou 75/75, sem falhas, skips ou cancelamentos. Permaneceram apenas os avisos conhecidos do harness sobre `react-test-renderer` deprecado.
- Gates: `node --check` passou no JavaScript alterado; Oxlint direcionado saiu 0, mantendo somente os sete warnings preexistentes em trechos não alterados de `App.jsx`; `git diff --check` saiu 0 com apenas avisos LF/CRLF do checkout Windows. `npm.cmd run build` passou com 382 módulos e somente o aviso conhecido de chunk acima de 500 kB.
- Revisão: a primeira revisão independente encontrou um Important no retry de conflito, além da ausência do ledger, e dois Minor de contagem/mobile. Os três pontos de código/teste foram corrigidos e a reavaliação read-only terminou Ready, com zero Critical, Important ou Minor remanescente e nenhum T18.
- Commit funcional: o commit contendo este ledger usa o subject `feat: implement operation and modality settings layouts`.

O `npm test` agregado e os conjuntos antigos 55/94/39/62/77/73/121 não foram executados. Migrations, gate D1, impressão física, QZ, supervisor, deploy, migration remota, merge e release não foram executados. A suíte agregada permanece **não aprovada**, `TEST-INFRA-01` permanece **OPEN / cause unconfirmed** e a homologação física continua pendente. T18 não foi iniciada. Parada obrigatória após a publicação da T17.

## T18 — Tela de Pagamentos e consumidores operacionais

T18 iniciou em worktree temporária isolada e detached exatamente em `1a282eb3796be34d55b594ff710ab9079948f168`, depois de confirmar o mesmo SHA em `origin/feature/spec-b-settings-policies`. A worktree local divergente não foi reutilizada e nenhum commit antigo foi incorporado. O escopo ficou restrito à tela de pagamentos, à projeção efetiva e aos consumidores operacionais que realmente escolhem ou exibem formas de pagamento; T19 não foi iniciada.

- Tela: `PaymentSettings` usa o shell e a lista responsiva de T16, expõe somente os seis métodos nativos, permite ativar/desativar, definir padrão e reordenar por ação ou Alt+seta. Não há criar, renomear, excluir ou autosave. A UI impede draft sem método ativo ou com padrão inativo, mantém estados do controlador/read-only e usa linhas compactas no desktop e cartões empilhados no mobile.
- Fonte operacional: `paymentOptionsFromEffective(config)` projeta somente métodos ativos, na ordem efetiva, como `{ value, label, code }`, usando valor em português e código estável. A lista canônica compartilhada é apenas compatibilidade para harness sem configuração; quando existe configuração efetiva, ela é autoritativa para novas escolhas.
- Sem substituição silenciosa: o padrão efetivo é aplicado somente ao abrir uma nova seleção. Uma seleção já aberta não muda quando padrão/ativos mudam. Se ficar inativa, permanece visível com aviso e confirmação bloqueada até revisão explícita. Não existe fallback silencioso para Pix. Movimento novo começa vazio; cancelamento pago sem método persistido exige escolha explícita.
- Histórico: estorno, cancelamento e edição de movimento preservam o método persistido mesmo que hoje esteja inativo. Os consumidores de Pedidos, Histórico, Financeiro, Novo Pedido e Comandas recebem a mesma projeção efetiva, sem segunda lista divergente.
- RED/GREEN: os testes comportamentais começaram 1/10 e falharam pela ausência da projeção/tela/integrações. A suíte focada final `node --test src/pages/PaymentSettings.test.js src/businessPaymentOptions.test.js` passou 18/18 e alcançou pagamentos reais no `App`, com default efetivo, ausência de fallback enquanto a configuração está indisponível, preservação de seleção aberta/inativa, checkout, comanda, estorno, cancelamento, movimento sem fallback e bloqueio dos controles nos estados do controlador.
- Regressão operacional: os cenários alcançáveis de reconciliação, proteção contra duplicidade, ownership A/B, 409, resultado incerto, A Receber e Comandas passaram 34/34. Na seleção de 103 testes, um teste legado de cancelamento inicialmente expôs a remoção intencional do fallback Pix; sua fixture passou a selecionar Pix explicitamente e o cenário voltou a passar, sem alterar produção para acomodá-lo.
- As fixtures operacionais antigas passaram a declarar explicitamente a projeção efetiva dos seis métodos. Isso preserva o alcance real dos POSTs sem reintroduzir fallback em produção; com a configuração efetiva indisponível, o `App` mantém opções/padrão vazios e bloqueia a confirmação.
- Gates finais: a seleção focada passou 18/18; `node --check` passou nos JavaScript aplicáveis; Oxlint direcionado saiu 0, mantendo apenas warnings preexistentes de hooks/set-state/ref nos arquivos antigos; `git diff --check` saiu 0. `npm.cmd run build` passou com 384 módulos e somente o aviso conhecido de chunk acima de 500 kB.
- Revisão independente: a primeira passagem encontrou três itens Important — fallback Pix durante indisponibilidade da configuração, envio de estorno com método inativo e ausência de revalidação de movimento após mudança remota. Todos receberam correção e regressão comportamental. A reavaliação terminou Ready, sem Critical ou Important; os dois ajustes Minor posteriores corrigiram o texto contextual do método original e a contagem final do ledger.

### TEST-INFRA-02 — reset/relogin harness

Esta ocorrência é separada de `TEST-INFRA-01` e permanece **OPEN / causa não confirmada**. Na baseline limpa `1a282eb3796be34d55b594ff710ab9079948f168`, a seleção acordada de 103 testes terminou 94/103, inclusive com reprodução isolada/sequencial 0/9. Depois da T18, a mesma seleção foi executada uma vez e terminou novamente 94/103: exatamente os mesmos nove nomes, cenários e fases de sessão, sem falha nova e sem entrada na lógica de pagamento modificada.

1. `payment reconciliation ignores old bootstrap success after business reset`
2. `payment reconciliation ignores old bootstrap error after business reset`
3. `old-session payment success cannot mutate or unlock a newer session payment`
4. `old-session payment error cannot mutate or unlock a newer session payment`
5. `old detail success cannot reach a relogged business using the same table identifiers`
6. `old detail error cannot reach a relogged business using the same table identifiers`
7. `a deferred old checkout cannot mutate or leave an ownerless wizard after reset and relogin`
8. `a deferred stale checkout rejection cannot clear or report over a newer relogged checkout`
9. `resposta de pagamento da sessão antiga não altera nem desbloqueia o alvo da nova sessão`

Nos casos 1–6 e 8, a assinatura é `No instances found with props: {"aria-label":"Menu principal"}` no helper de navegação após reset/relogin (`comandasAppWiring.test.js`). No caso 7, a assertion `relogin returns to the authenticated kitchen landing` recebe `actual: 0`, ainda antes do fluxo posterior. No caso 9, `openKitchenDetail` encontra `undefined` e lança `TypeError: Cannot read properties of undefined (reading 'props')` (`operationalPayment.test.js:80`, chamada do teste na linha 208). A única diferença de linhas no arquivo de Comandas é o deslocamento de uma linha causado pela escolha explícita adicionada ao teste legado; erro, stack principal, cenário e fase permanecem iguais à baseline.

T18 está aprovada apenas como checkpoint isolado pelos testes focados e regressões operacionais que alcançam o fluxo real. Estes nove testes continuam bloqueando aprovação agregada, merge e release. O problema de sessão não foi corrigido dentro da T18. Nenhum `npm test` agregado, migration, gate D1, impressão física, QZ, supervisor, deploy, migration remota, merge, release ou force-push foi executado. T19 permanece **não autorizada e não iniciada**; parada obrigatória após a publicação da T18.

## T19 — Tela de Motivos de cancelamento e seleção efetiva

T19 iniciou em worktree temporária isolada e limpa exatamente na base remota aprovada `189ea144af8c760640245c2fc250f65c7fc99ebb`. O checkout local divergente não foi reutilizado, nenhum commit antigo foi incorporado e T20/T21 não entraram neste checkpoint.

- Tela administrativa: `CancellationSettings` reutiliza o controlador central, shell, lista e modal. Os cinco motivos nativos permanecem identificados e protegidos; `Outro` permanece ativo e exige nota. Personalizados recebem um único `crypto.randomUUID()` no draft, podem ser renomeados/excluídos somente conforme `canRename`/`canDelete`, e itens usados mantêm apenas ativação/desativação. Todas as ações alteram somente o draft; somente `Salvar alterações` persiste.
- Estados e apresentação: origem, ativo/inativo, `requiresNote`, primeiro uso, novo e alteração pendente ficam visíveis em linhas compactas responsivas. Read-only remove ações de edição; loading, saving, resultado incerto e conflito reutilizam os bloqueios e recuperação de T14–T16. Não existe tabela horizontal no mobile.
- Escolha operacional: `cancellationOptionsFromEffective` projeta apenas motivos ativos da configuração efetiva e sua revisão. `CancelOrderDialog` não mantém catálogo fixo nem inventa fallback; sem configuração confirmada, o cancelamento fica bloqueado. `requiresNote` vem da projeção, com limite cliente/Worker de 240 caracteres, e a revisão acompanha o POST para o guard transacional existente.
- Histórico: leituras de pedido resolvem `cancelReasonLabel` no Worker pelo ID persistido, inclusive para item hoje inativo, sem expor o catálogo administrativo ao cliente. Histórico e detalhe preferem esse rótulo e preservam nota/identidade; alterações administrativas não reescrevem pedidos antigos.
- First-use: a meta do Worker governa as ações. Se o primeiro uso ocorrer com draft aberto, a revisão de conflito T15 mantém a intenção de rename/delete visível e aceita somente o valor corrente quando a ação se tornou protegida, sem conversão silenciosa.
- RED/GREEN: a primeira execução comportamental obrigatória terminou 1/13, com falhas reais na lista fixa, fallback, `requiresNote`, histórico e tela ausente. Após a implementação e coberturas adicionais RED→GREEN do detalhe histórico e dos defaults confirmados em revisão zero, `node --test src/pages/CancellationSettings.test.js src/cancellationSettingsIntegration.test.js` passou 16/16.
- Regressões diretamente afetadas: a seleção de componentes, settings, pedidos/histórico, API e repositórios passou 85/85. O primeiro uso operacional de defaults legítimos em revisão zero agora materializa os cinco nativos e marca o motivo usado no mesmo batch atômico do cancelamento. Oxlint direcionado saiu 0 com quatro warnings de hooks preexistentes em `App.jsx`; `node --check` passou nos JavaScript aplicáveis e `git diff --check` saiu 0.
- Revisão independente: a primeira passagem encontrou dois itens Important — bloqueio incoerente dos defaults confirmados em revisão zero e ausência de uma prova comportamental da exclusão pré-primeiro-uso. Ambos receberam RED, correção e regressão; a exclusão confirmada remove somente o UUID correto do draft e não salva automaticamente. A reavaliação read-only terminou `Ready`, sem Critical ou Important remanescente.

O build e a seleção acordada de 103 testes foram deliberadamente reservados para o fechamento conjunto T19+T20. `npm test` agregado, migrations, gate D1, impressão física, QZ, staging, produção, merge e release não foram executados. `TEST-INFRA-01` e `TEST-INFRA-02` permanecem **OPEN / causa não confirmada** e não foram alterados nesta tarefa.

## T20 — Tela de Categorias financeiras e formulário de movimento

T20 começou somente depois do checkpoint T19 verde e revisado, na mesma worktree isolada cuja ancestry parte exatamente de `189ea144af8c760640245c2fc250f65c7fc99ebb`. O escopo terminou nesta tarefa; nenhum código T21 foi iniciado.

- Tela administrativa: `FinanceCategorySettings` usa exclusivamente `businessSettings.resources.financeCategories`, o shell, a lista e `SettingsItemDialog kind="finance"`. Entradas e saídas manuais aparecem em dois grupos visuais, mas compartilham um único draft, revisão e save. Criar exige nome/tipo e gera um UUID estável; tipo existente é imutável; ativar, desativar, reordenar, renomear e excluir alteram somente o draft, sem autosave. Nomes duplicados são comparados dentro do tipo, como no Worker. Saldo inicial não foi movido para esta tela.
- Autoridade e proteção: categorias nativas e personalizadas usadas não recebem rename/delete; meta ausente em item já confirmado falha fechada. Categorias automáticas Vendas/Estornos permanecem fora do catálogo administrativo e das escolhas manuais. Read-only remove ações; mobile usa linhas/cartões sem tabela horizontal e os estilos usam tokens existentes de tema.
- Consumo efetivo: `financeCategoryOptionsFromEffective` projeta somente as categorias ativas fornecidas pelo servidor, separadas por tipo, sem catálogo local de fallback. `MovementDialog` bloqueia apenas o tipo sem opção ativa, envia a revisão efetiva inclusive em revisão zero, preserva formulário/seleção e revalida a categoria ao confirmar. A validação de `paymentMethod` da T18 permanece independente.
- Histórico e edição: o Worker resolve `categoryLabel` por negócio sem consultar apenas ativos; a tela financeira mostra esse rótulo. Movimentos manuais agora expõem edição e exclusão confirmada, enquanto movimentos automáticos não recebem essas ações. Categoria persistida inativa continua visível e pode ser mantida sem nova validação; troca exige categoria ativa. Valores legados portugueses são comparados normalizados, mas continuam persistidos sem reescrita silenciosa. Editar, trocar ou soft-delete não desfaz `first_used_at`.
- Concorrência/primeiro uso: seleção e primeira utilização continuam no mesmo batch do movimento e usam assertions de revisão/atividade. Defaults legítimos em revisão zero materializam o cabeçalho e os 13 nativos atomicamente com o primeiro movimento. Corridas de revisão e delete/first-use não deixam movimento parcial nem referência perdida. A revisão T15 preserva a intenção de rename que se tornou ilegal para explicação explícita.
- RED/GREEN: o RED obrigatório inicial terminou 0/10 com falhas comportamentais reais além dos módulos ainda ausentes. O foco final obrigatório `node --test src/pages/FinanceCategorySettings.test.js src/financeCategorySettingsIntegration.test.js` passou 15/15. Quatro regressões adicionais motivadas pela revisão independente falharam antes das correções — parser HTTP em revisão zero, retenção de categoria legada, ações de edição/exclusão inalcançáveis e duplicidade entre tipos — e depois passaram no conjunto focado. A seleção proporcional conjunta T19+T20, incluindo controlador/conflito, settings, cancelamento, pagamento/estorno, finanças, API e repositórios, passou 193/193; uma seleção complementar de wiring/contratos passou 31/31.
- Baseline de 103: a única execução integral terminou 93/103. Os nove casos já registrados em `TEST-INFRA-02` mantiveram os mesmos nomes, fases reset/relogin e assinaturas principais, sem alcançar lógica T19/T20. A décima falha foi investigada antes de qualquer publicação: `a newer cancellation rejects three financial collections without free tables completing payment sync` ainda fornecia somente configuração efetiva de pagamentos apesar de atravessar cancelamento T19. O fixture recebeu explicitamente o motivo ativo `duplicate_order` e `revisions.cancellationReasons = 1`, sem mudança em produção nem fallback; o caso antes adicional passou isoladamente 1/1. Para respeitar a ordem de executar a seleção acordada uma única vez, os 103 não foram repetidos. Assim, após a correção, o conjunto de pendências conhecido volta a ser exatamente os nove casos de `TEST-INFRA-02`, mas a suíte agregada continua não aprovada.
- Gates finais: `node --check` passou em todos os JavaScript alterados; Oxlint direcionado saiu 0 com apenas quatro warnings preexistentes de hooks em `App.jsx`; `git diff --check` saiu 0, além dos avisos LF/CRLF do checkout Windows. `npm.cmd run build` passou uma única vez com 389 módulos e apenas o aviso conhecido de chunk acima de 500 kB.
- Revisão: a revisão direta não deixou achado aberto. A primeira revisão independente encontrou quatro itens Important — parser rev. 0, retenção legada, caminho real de edição e escopo da duplicidade — todos corrigidos com regressões. Duas reavaliações read-only terminaram `Ready`, sem Critical ou Important; a segunda confirmou também que a correção do fixture da baseline é legítima e não reintroduz fallback.

`TEST-INFRA-01` permanece **OPEN / causa não confirmada**. `TEST-INFRA-02` permanece **OPEN / causa não confirmada**. `npm test` agregado, migrations, gate D1, impressão física, QZ, staging, produção, migration remota, merge, release e PR para master não foram executados. Parada obrigatória após o push dos dois commits T19/T20; T21 não foi iniciada.

## T21 — Tela de Impressão, preferências locais e consumidores operacionais

T21 iniciou sob autorização exclusiva em worktree isolada e branch local `codex/t21-settings-printing`, exatamente na base aprovada `5a2e24fe13376a0aaf6e52d7dc7aad1aadfd3f4d`. O escopo ficou limitado à tela de impressão, preferências locais de tema/som e integração da configuração operacional efetiva nos consumidores; nenhum código T22 foi iniciado.

- Ownership e persistência: `usePrintingSettingsController` tornou-se um adaptador fino e sem estado remoto próprio sobre o controlador T14. `printingPolicy`, `stationConfiguration:<id>` e `stationPrimary` mantêm drafts, revisões, confirmação, conflito e salvamentos independentes. A impressora local continua no armazenamento/QZ do dispositivo. Alterar ou testar a impressora não grava política; tornar a estação principal exige confirmação e save explícitos; salvar a estação não promove a estação implicitamente.
- Tela de impressão: os três blocos de responsabilidade são explícitos — política do negócio, estação real e impressão local/QZ. Política de pedidos e comandas aceita somente uma ou duas vias e afeta apenas jobs novos; jobs já criados e retries preservam o snapshot. Teste físico continua sempre com uma via. Estação existente não é regravada no bootstrap, e health, heartbeat, recovery e execução permanecem no manager montado, fora do ciclo de vida da tela.
- Preferências do dispositivo: somente Claro, Escuro e Automático, além do som, são aplicados e persistidos localmente de forma imediata. Falha de `localStorage` conserva o valor seguro, exibe erro e não produz feedback de sucesso nem chamada à API de settings.
- Consumidores operacionais: novos pedidos usam somente modalidades ativas e o padrão corrente apenas na abertura. Mudanças posteriores preservam modalidade ainda válida; modalidade invalidada mantém cliente, carrinho e demais campos, permanece visível e bloqueia confirmação até revisão explícita. Contexto de comanda preserva `Local` para revisão quando ela está desativada, sem conversão silenciosa. `POLICY_CHANGED` conserva o wizard e reconsulta a configuração efetiva. Pedidos ativos/cozinha usam os tempos correntes; histórico e terminais continuam usando o snapshot T10.
- RED/GREEN: o RED válido nos três arquivos exigidos terminou 2/13, com 11 falhas comportamentais reais. O foco final `node --test src/settingsPrintingPolicy.test.js src/settingsDevicePersistence.test.js src/businessOperationsUi.test.js` passou 20/20, sem falhas, skips ou cancelamentos.
- Regressão proporcional: a primeira seleção final expôs uma alteração indevida na assinatura do callback de checkout, terminando 306/307. O segundo argumento de metadados foi removido — o guard `POLICY_CHANGED` já é transacional no Worker — e a regressão específica passou junto do foco 34/34. A repetição integral da seleção proporcional passou 307/307 (exit 0).
- Gates: `node --check` passou nos dez JavaScript aplicáveis; Oxlint direcionado saiu 0, mantendo somente os warnings conhecidos de hooks/ref nos arquivos antigos; `git diff --check` saiu 0, além dos avisos LF/CRLF do checkout Windows. `npm.cmd run build` passou com 390 módulos e apenas o aviso conhecido de chunk acima de 500 kB.
- Revisão: a revisão direta conferiu separação de ownership e saves, ausência de PUT por ações locais/QZ, snapshot de fila/retry, confirmação da estação principal, persistência local sem falso sucesso, preservação integral do draft operacional, fluxo de revisão para `Local`, tempos correntes versus snapshot T10, capabilities e ciclo de vida do manager. A revisão independente posterior encontrou um item Important: `Testar impressão` estava aninhado no bloco de `printing.station.configure`, impedindo a ação para quem possuía `printing.execute` e consulta da estação. Um RED de matriz de capabilities reproduziu a ausência do botão; a ação física passou a ter gate próprio, enquanto seleção, descoberta e salvamento local continuam exclusivos de configuração. A reavaliação focada terminou sem Critical ou Important remanescente.
- Commit funcional: o commit contendo este ledger usa o subject `feat: implement scoped printing and local preference layouts`.

O `npm test` agregado e a seleção conhecida de 103 testes não foram executados. `TEST-INFRA-01` e `TEST-INFRA-02` permanecem **OPEN / causa não confirmada** e não foram alterados. Migrations, gate D1, impressão física, QZ real, supervisor, deploy, migration remota, merge, release, force-push e PR para master não foram executados. Parada obrigatória após o push normal da T21; T22 permanece **não autorizada e não iniciada**.

## T22 — Revisão integrada de UX, responsividade e regressões

T22 iniciou em novo worktree isolado `.worktrees/t22`, detached e limpo exatamente no HEAD remoto aprovado `7ddd1b65f3a865ccb765eab693d2a021074c2ab5`. O checkout local divergente não foi reutilizado; T23 não foi iniciada.

- Integração funcional: o harness real do manager prova que estação principal, QZ conectado, fila encontrada e impressora pronta alcançam `claimNextPrintJob` com autoimpressão desligada sem iniciar execução quando a claim rejeita o job normal. O polling precisa permanecer disponível para jobs manuais/priorizados; a claim real do Worker prova a filtragem por trigger/autorizações. O App real produziu RED para fallback silencioso de modalidades quando a configuração efetiva estava ausente; disponibilidade oficial passou a ser lista explícita vazia e a nova venda falha fechada, enquanto `NewOrder` isolado conserva o fallback legado quando a prop é omitida.
- RED/GREEN responsivo: nomes de 80 caracteres e badges não possuíam quebra garantida. `overflow-wrap:anywhere` foi aplicado somente aos textos afetados. O harness automatiza contratos estruturais de layout fluido/mobile, rows, safe-area e modal; por não possuir motor de layout, geometria/overflow em 1440, 1024, 768, 390, 360 e 320 px permanece PENDING para navegador real.
- Integração/lifecycle: duas passagens pelo App entre Home, todos os sete destinos de Configurações e Operação mantiveram 13 listeners e reduziram timers de 5 para 4; nenhum polling, heartbeat, listener, timer permanente ou segundo manager foi acumulado.
- Testes T22: `src/specBSettingsIntegration.test.js` e `src/settingsResponsive.test.js` passaram 6/6.
- Regressão proporcional: a seleção de 26 arquivos passou 212/213. A única falha foi `resposta de pagamento da sessão antiga não altera nem desbloqueia o alvo da nova sessão`, com assinatura reset/relogin já documentada em `TEST-INFRA-02`; não alcançou código T22. A matriz `actionCapabilities.test.js` passou separadamente 22/22, incluindo a separação `printing.execute` / `printing.station.configure`.
- Visual/manual: o servidor Vite local iniciou, mas Computer Use retornou zero browsers/apps e Edge indisponível. Nenhuma screenshot foi fabricada. V01–V14 têm evidência automatizada PASS e homologação manual/visual PENDING em `2026-09-12-spec-b-acceptance.md`.

`TEST-INFRA-01` permanece **OPEN / causa não confirmada**. `TEST-INFRA-02` permanece **OPEN / causa não confirmada**. `npm test` agregado, seleção histórica de 103, migrations, gate D1, impressão física/QZ real, staging, produção, migration remota, merge, release, force-push e PR para master não foram executados. T23 permanece não autorizada e não iniciada.

## T23A — correção das 39 falhas por causa raiz, sem gates seguintes

Retomada local em `.worktrees/t23a`, branch `codex/t23a-spec-b-settings-policies`, base `48b5448`, com autorização específica para corrigir as 39 falhas do agregado 1473/1512. O histórico completo do agregado estava truncado, mas a saída filtrada posterior no transcript preservava os 39 registros `not ok`. A seleção inicial dos 14 arquivos reproduziu 39/72 falhas; um registro é o pai de um subteste que falhou, não um defeito adicional.

O [inventário detalhado](2026-09-13-t23a-root-causes.md) contém todos os nomes, a classificação e as evidências: 19 schema/migrations manuais; 14 configuração efetiva/sessão, incluindo doubles de SQL e o pai; cinco expectativas de contrato; um caso de navegação com fixture antigo e contaminação de timers pelo watcher Vite. Nenhum defeito de produção foi confirmado. As alterações funcionais ficaram exclusivamente em testes/helpers; schemas reais até 0025 substituíram fixtures operacionais incompletos, preservando os testes históricos intermediários, transações reais e fail-closed.

- Cache: RED determinístico de diretório compartilhado; GREEN 30/30 com regressão de exclusividade, remoção e preservação do cache vizinho. Commit separado `be978f1` (`test: isolate Vite cache per workspace harness`).
- Grupos focados: schema/migrations 36/36; doubles/contratos/regressões 53/53; UI/ownership/recuperação/harness 18/18. O watcher foi caracterizado por stack de `FSWatcher._throttle`, não confundido com vazamento do App.
- Processos: runner antigo T21 de 21:43 e seu filho foram identificados e encerrados; zero runners antes e depois do agregado. Supervisor da nova execução confirmou árvore drenada e fechamento.
- Único agregado limpo: **1514/1514, zero falhas, cancelamentos, skips e todo; exit 0; resumo final presente; 58.318,2888 ms**. Os dois testes adicionais são cache/watcher. Logs e resumo persistidos em `logs/t23a-root-causes/`; o primeiro lançamento por cmd falhou antes de iniciar npm e foi preservado separadamente.

`git diff --check` passou. Nenhum push, staging, migration remota, produção, merge ou force-push foi feito. Lint/build/dry-runs/D1 e T23B não foram iniciados; aprovação global da T23A, homologação visual/física e release continuam pendentes. O resultado agregado verde deste checkpoint não retroage para validar checkpoints anteriores.

## 2026-09-14 — Rodada visual exclusiva de Configurações > Operação

O mockup fornecido nesta rodada é o contrato de composição, textos e controles. A exceção de cor solicitada usa o vermelho existente do sistema, sem azul. A faixa superior externa não foi acrescentada. Nenhuma outra tela de Configurações foi redesenhada.

- Base de publicação: `cd616ecad3a5a33f45f953b52f06f78bbb8a14ee`, HEAD remoto atual da Spec B. O checkout inicial estava divergente em `a59c21c`; seu ajuste foi preservado no commit local `184ecd7`, e somente a rodada visual foi transportada para `logs/operation-publish`, branch `codex/operation-visual-round`. A resolução conserva integralmente a lógica mais recente do remoto, sem reintroduzir os testes legados removidos ou sobrescrever T18–T23A.
- Visual: breadcrumb de retorno à Home, título/subtítulo exatos, aviso informativo com os dois textos, card de tempos com quatro campos em duas colunas e sufixos `min`, ajudas exatas, card de modalidades com ícones, descrições, switches, badges Ativo/Padrão e menu de três pontos. Rodapé com Cancelar/Salvar alterações. Bordas finas, cantos discretos e superfície clara substituem o painel escuro somente em Operação; o menu lateral existente permanece o do sistema.
- Isolamento: a barra horizontal foi removida somente da rota compartilhada Operação/Modalidades. `SettingsEditorShell` recebeu props opcionais de classe, rótulo de descarte e nota de rodapé, conservando os defaults e estados para os outros consumidores. O CSS novo é condicionado à página/classes de Operação.
- Funcionalidade preservada: mesmo recurso/draft/controller; salvar explícito, descarte, conflitos, reconciliação, readonly, limites numéricos e relação entre os dois atrasos. A versão atual impede desativar o padrão ou a última modalidade ativa e bloqueia edição nos estados loading/saving/unconfirmed/conflict; essas proteções continuam nos switches, inputs e menu. Motivos de desativação permanecem disponíveis por `aria-describedby` e tooltip; Escape fecha o menu e restaura foco.
- Verificação final sobre a base atual: `node --test --test-concurrency=1 src/pages/OperationSettings.test.js src/components/SettingsPrimitives.test.js src/settingsNavigation.test.js src/settingsDraftNavigation.test.js src/specBSettingsIntegration.test.js src/settingsResponsive.test.js` passou **40/40**, zero falhas/skips/cancelamentos. As 44 verificações anteriores sobre o checkout inicial foram substituídas por esta seleção sobre o código efetivamente publicado.
- Gates: `npm.cmd run build` passou com 391 módulos; permaneceu o aviso conhecido de chunk principal acima de 500 kB. `npm.cmd run lint` saiu 0 com avisos preexistentes fora do diff. `git diff --check` passou.
- QA visual: navegador interativo indisponível; Chromium headless renderizou componentes, shell e CSS reais em harness local com dados sintéticos. Capturas de 1440×1000, 900×760, 768×1024, 390×844 e 320×740 foram inspecionadas; sem overflow horizontal, duas colunas no desktop e uma no mobile, superfície branca mesmo sob preferência escura e reserva de espaço para navegação inferior. O teste de navegador verificou troca de padrão, switch, Cancelar, salvamento explícito e Escape, sem erro de runtime. Harness/capturas ficam em `logs/operation-publish/logs/operation-*`, ignorados pelo Git. Não se trata de teste autenticado em produção.
- Revisão independente focal da resolução contra `cd616ec`: nenhum achado concreto de regressão, acessibilidade ou vazamento de CSS. A revisão confirmou a preservação de locked, padrão/última ativa e estados do shell.

Publicação desta rodada limitada a push normal na branch `feature/spec-b-settings-policies`. Não foram executados suíte agregada, migrations, deploy de staging/produção, merge ou release. Nenhuma rodada visual de outra tela foi iniciada.

## 2026-09-14 — Correção de escala, tema e mobile de Operação

Rodada corretiva restrita a `Configurações > Operação`, motivada pela homologação da publicação `ad4fb29`. Nenhuma regra de negócio ou outra tela de Configurações foi alterada.

- RED: três testes de contrato foram acrescentados antes do CSS. `node --test --test-concurrency=1 src/pages/OperationSettings.test.js` terminou **11/14**, com as três falhas esperadas: paleta clara forçada; composição mobile ausente no breakpoint 820 px do shell; escala desktop abaixo dos mínimos definidos. Os outros 11 casos permaneceram verdes.
- GREEN — tema: removidos `color-scheme: light` e os overrides locais de `--bg`, `--surface`, `--surface-soft`, `--surface-strong`, `--text`, `--text-soft`, `--muted` e `--border`. Canvas, cards, alerta, campos, menu, switches e badges agora derivam dos tokens fornecidos pelo ThemeProvider. A composição única responde a light e dark; o vermelho continua vindo de `--primary`.
- GREEN — escala: a área de conteúdo recebeu largura própria de até 1600 px e ocupa toda a área útil em 1440 px. Tipografia base 14 px, título 32 px, títulos de card 18 px, inputs 42 px, linhas 54 px, switch visual 44×26 px dentro de alvo 52×44 px e botões 42 px. Cards, alerta, gaps e paddings foram ampliados com dimensões reais, sem zoom ou transform global.
- GREEN — responsividade: em `max-width: 820px`, tempos passam a uma coluna e modalidades usam grid móvel com áreas explícitas para ícone, texto, badges, switch e menu. Inputs, switch e menu têm alvo mínimo de 44 px; rodapé mantém padding inferior de 102 px para bottom navigation/safe area. Em `max-width: 640px`, margens e tipografia recebem apenas o refinamento para telas estreitas.
- Verificação focada final: `node --test --test-concurrency=1 src/pages/OperationSettings.test.js src/components/SettingsPrimitives.test.js src/settingsNavigation.test.js src/settingsDraftNavigation.test.js src/specBSettingsIntegration.test.js src/settingsResponsive.test.js` passou **43/43**, sem falhas, skips ou cancelamentos. O teste isolado de Operação passou 14/14.
- Oito capturas reais: Chromium headless renderizou componentes/shell/CSS reais com fixture local em **1440×900, 1920×1080, 390×844 e 360×800**, cada tamanho em light e dark. Todas passaram sem overflow horizontal e sem erro de runtime. Em 1440 o conteúdo ocupou 100% da área útil do main; em 1920, 1600 px/95,7%. Desktop confirmou 2 colunas, título 32 px, corpo 14 px, cards 18 px, inputs 42 px, linhas 54 px e botões 42 px. Mobile confirmou 1 coluna, título 30 px, inputs 44 px, linhas 116 px, switch 52×44 px, botões 44 px e padding inferior 102 px. O contraste computado de texto/card foi **15,96:1 light** e **15,05:1 dark**. Troca de padrão, switch, Cancelar e Escape também passaram no navegador. As oito capturas ficam no harness ignorado `logs/operation-*` desta worktree.
- Inspeção visual das oito capturas confirmou a proporção ampliada, alertas/cards/campos em escala de aplicação, modalidades móveis sem compressão da linha desktop, switches com trilho proporcional, badges legíveis, footer acessível e superfícies escuras reais no dark.
- Gates: `npm.cmd run lint` saiu 0, mantendo somente warnings preexistentes fora do diff. `npm.cmd run build` passou com 391 módulos e o aviso conhecido de chunk principal acima de 500 kB. `git diff --check` passou.

Escopo final: `src/operation-settings.css`, os contratos em `src/pages/OperationSettings.test.js` e este ledger. Sem produção, merge em master, migrations ou outras telas.
