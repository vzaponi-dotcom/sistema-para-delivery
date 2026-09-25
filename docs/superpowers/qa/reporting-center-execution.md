# Centro de Relatórios — Execution Ledger

Issue: #34  
Branch: `feature/issue-34-reporting-center`  
PR: #72 (draft)  
Spec: `docs/superpowers/specs/2026-09-25-reporting-center-design.md`  
Plan: `docs/superpowers/plans/2026-09-25-reporting-center-plan.md`  
Production: NO DEPLOY

## Preparation

- Approved documentary HEAD: `737b9a5f288cad568a8994bb413db165120ee802`.
- Master baseline: `6445098aef8332890b854f6eb8524b5f9c053b8f`.
- Draft PR #72 created from the approved documentary branch.
- Baseline Validate #2056 / run `36147998594` failed in an unrelated date-sensitive fixture:
  `business profile receipt lookup requires manage while invalid receipt resources remain rejected`.
- Root cause: the fixture persisted a receipt at fixed `2026-09-24T03:50:00.000Z`; the production 24-hour receipt TTL correctly considered it expired when CI ran on 2026-09-25.
- Baseline-only correction: `1d77305e1e8d6f126129d1ad5515187c3a0ec0ea` — the test now creates that receipt at the current test execution time; production code is unchanged.
- Validate #2057 / run `36148492907`: SUCCESS on the corrected baseline.

## Task 1 — Reporting boundary, capabilities, navigation and URL state

Status: **COMPLETE / GREEN**

### RED

Commit: `6eee82bb2d79f574d17df0ae41bfa0352ddadef3`  
Message: `test: define reporting navigation boundary`

Validate #2058 / run `36149045311`: intended failure.

The RED proved the missing contracts:

- `reports.view` / `reports.export` absent;
- `reports` destination and `/relatorios` absent;
- Finance area/desktop navigation missing Reporting;
- Router resolved `/relatorios` as unknown;
- Reporting query module absent;
- Reporting URL hook absent;
- App did not compose Reporting.

No parser/harness failure was used as the TDD signal.

### GREEN

Primary implementation commit: `e9056a126796619f32e5097fe43945ec74ed401c`  
Message: `feat: add reporting navigation shell`

The first full run exposed one implementation import-path error only:
`../../../shared/finance.js` resolved to `src/shared` instead of repository-level `shared`.

Correction commit: `a0dd7347a17294889437a283171a16a5a9a2c2b0`  
Message: `fix: correct reporting shared finance import`

Validate #2060 / run `36149650569`: **SUCCESS**

Test totals:
- 2,364 tests
- 2,363 pass
- 0 fail
- 1 skipped

Required gates:
- frontend architecture: PASS
- lint: PASS
- build: PASS
- production Worker dry-run: PASS
- staging Worker dry-run: PASS
- local D1 migrations: PASS
- Spec B D1 clean-install/upgrade: PASS
- operation-profile D1 clean-install/upgrade: PASS

### Delivered contracts

- canonical capabilities `reports.view` and `reports.export`;
- destination `reports` at `/relatorios`;
- Finance order: Visão geral -> Relatórios -> A receber -> Movimentações;
- no new mobile bottom-nav destination;
- React Router direct route/F5 support through canonical registry;
- `src/domains/reporting` public boundary;
- Reporting URL query normalization/serialization;
- population-changing filters reset detail page to 1;
- App composes `ReportingWorkspace` without passing orders, movements, products or clients;
- shell contains AreaNavigation, PageHeader, internal report tabs and a non-metric placeholder;
- no Reporting backend/API yet;
- no D1/schema change;
- no staging deploy;
- no production action.

### Task 1 acceptance

- [x] `/relatorios` exists.
- [x] Financeiro shows Relatórios.
- [x] Mobile bottom bar is unchanged.
- [x] No business KPI is calculated yet.
- [x] App does not pass operational collections to Reporting.
- [x] Worker/D1 behavior unchanged.

## Baseline stabilization before Task 2

- RED: `operationProfileR2Regression.test.js` failed despite the required staging branch already existing in the YAML.
- Cause: parsing/assertion was sensitive to CRLF.
- Fix: test-only CRLF-to-LF normalization; no production code or staging workflow behavior changed.
- Commit: `c2d129dd` — `test: make staging workflow regression CRLF-safe`.
- Focused GREEN: operation-profile plus production-safety regression tests, 11/11.

## Task 2–12 local commits

- Task 2 `e7de3c51`; Task 3 `f247aeb0`; Task 4 `c8b0cde2`; Task 5 `83311f55`.
- Task 6 `147aea19`; Task 7 `1afc8674`; Task 8 `78f10287`; Task 9 `4579055a`.
- Task 10 `3ddf2024`; Task 11 `2867b37e`; Task 12 `3896c532`.

## Task 13 — Candidate verification

- First full-suite run: 2,386 pass / 1 fail (`systemSelectMigration`); root cause was a native select in ReportingFilters.
- Correction uses the existing `SystemSelect`; focused regression plus build: GREEN.
- Serial full-suite rerun: 2,387/2,387 pass, 0 fail (the serial mode avoids the Vite harness port race).
- Frontend architecture, lint (pre-existing warnings only) and build: PASS.
- Production and staging Worker dry-runs: PASS; no deployment occurred.
- Local D1 migrations and Spec B D1 gate: PASS.
- No staging QA, remote CI or push has occurred.
