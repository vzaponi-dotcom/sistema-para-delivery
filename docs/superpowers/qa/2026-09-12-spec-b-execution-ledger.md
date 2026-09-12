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
- [x] T02 — migrations and compatible seeds (implemented; independent review pending).
- [ ] T03 — atomic operations repository (authorized, not started here).
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

Status: implemented in the commit containing this entry, with subject `feat: persist typed business settings with compatible seeds`; independent review pending.

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
- Independent review: pending controller review of the T02 commit.
- T03 is the next authorized task after review; no T03 repository, transaction module or D1 probe was implemented here. The helper is a SQLite test adapter, not proof of all D1 runtime transaction semantics; that probe remains T03 work.
- T04 remains unauthorized. No endpoint, UI, operational consumer, push, merge or deployment changed in T02.
- Known repository concern remains the unrelated full-suite failure recorded under T01; T02 did not rerun the full frontend suite because the change is limited to migration/test infrastructure.
