# Issue #82 — Execution Ledger

**Feature:** Agendamento multi-dia e reservas de mesa  
**Branch:** `feature/issue-82-multiday-reservations`  
**PR:** #83  
**Base master:** `da81fb2be7a754f9296a54d9e44e82372341e20d`  
**Spec approval:** `254b9db8162159663905a93865bd44b05fec7577`  
**Plan approval:** `773e1e0f9ec0b5f8b9475ad2cb27208a34388b2b`  
**Production:** BLOCKED

## Preparation

- Master re-fetched on 2026-09-29.
- Master equals planned baseline `da81fb2...`; compare is identical.
- Migrations confirmed through `0033_kitchen_tv_modality_filter.sql`; planned new migration remains `0034_table_reservations.sql`.
- Master Validate application #2512 / run `36570608768` is SUCCESS on the exact baseline SHA.
- Draft PR #83 created from the approved documentation HEAD.
- No application code changed yet.
- No staging deploy.
- No production deploy by this feature.

## Task status

| Task | Status | Evidence |
|---|---|---|
| Preparation | COMPLETE / GREEN | PR #83; branch baseline Validate #2515 / run `36579735603` SUCCESS on `161cb5bce66bc66663e8c916d1521ea4f17d6e1a` |
| 1 — Migration / invariants | COMPLETE / GREEN | RED `94a6684abce6e30d740ff7bd932835a1bbe2c07d` → Validate #2517 / run `36580535314` failed only on 4 intended reservation-migration tests. GREEN `ed7f5b7de4955dd457b482fb48a83c03a310872e` → Validate #2518 / run `36580925658` SUCCESS; 0034 clean/upgrade + overlap guards passed; architecture/lint/build/Worker dry-runs/D1 gates green. |
| 2 — 90-day scheduling domain | COMPLETE / GREEN | RED `3936aae5020c6458a29dc272df26a559f8f121ab` → Validate #2523 / run `36582671155` failed on the intended 90-day/Local scheduling behaviors. GREEN `93f13367a071bd190dd963ae6ab68e8d5e48d45c` → Validate #2525 / run `36582977746` SUCCESS; all test shards and full validation green. |
| 3 — Reservation read model | COMPLETE / GREEN | RED `900fef8a8956adf6a8750cd5430f336101b17d47` → Validate #2529 / run `36583884743` failed on the intended repository/order/table reservation projections. GREEN `1123243c6588b6d405c793fe3a3212f571c8669d` → Validate #2533 / run `36584823314` SUCCESS; reservation repository, order context and nextReservation table projection green. |
| 4 — Table guards | NOT STARTED | — |
| 5 — Local reservation checkout | NOT STARTED | — |
| 6 — Printing matrix | NOT STARTED | — |
| 7 — Reservation read API | NOT STARTED | — |
| 8 — Cancel / no-show | NOT STARTED | — |
| 9 — Arrival conversion | NOT STARTED | — |
| 10 — Reservation editing backend | NOT STARTED | — |
| 11 — Frontend reservation boundary | NOT STARTED | — |
| 12 — New Order reservation mode | NOT STARTED | — |
| 13 — Edit reservation wizard | NOT STARTED | — |
| 14 — Comandas desktop/mobile | NOT STARTED | — |
| 15 — Orders / future schedules | NOT STARTED | — |
| 16 — Kitchen TV / realtime | NOT STARTED | — |
| 17 — Finance / receivables | NOT STARTED | — |
| 18 — Reporting | NOT STARTED | — |
| 19 — Full gates | NOT STARTED | — |
| 20 — Staging | NOT STARTED | — |
| 21 — Manual QA | NOT STARTED | — |
| 22 — Technical closure | NOT STARTED | — |

## Stop rules

- Do not start a GREEN without an intended behavioral RED.
- Do not count parser/import/fixture failures as behavioral RED.
- Do not merge with FAIL/BLOCKED technical gates.
- Do not deploy production without separate explicit authorization.


## Task 1 evidence

### RED

- Commit: `94a6684abce6e30d740ff7bd932835a1bbe2c07d`
- Validate: #2517 / run `36580535314`
- Result: FAILURE as intended.
- Failing tests: exactly 4 new `0034` reservation persistence tests.
- Failure reason: `table_reservations` schema/guards did not exist yet.
- Existing shards remained green.

### GREEN

- Commit: `ed7f5b7de4955dd457b482fb48a83c03a310872e`
- Validate: #2518 / run `36580925658`
- Result: SUCCESS.
- New migration: `0034_table_reservations.sql`.
- Focused shard: 452/452 pass, including all 4 new tests.
- Architecture: PASS.
- Lint: PASS.
- Build: PASS.
- Production Worker dry-run: PASS.
- Staging Worker dry-run: PASS.
- Local D1 migration gate: PASS.
- Spec B D1 clean install/upgrade: PASS.
- Operation profile D1 clean install/upgrade: PASS.
- Staging deploy: NOT EXECUTED.
- Production deploy: NOT EXECUTED.


## Task 2 evidence

### RED

- Scaffold: `806b3c23fc802f928547afa7c4ab73015a73aa7d` kept imports executable without implementing behavior.
- Final RED commit: `3936aae5020c6458a29dc272df26a559f8f121ab`.
- Validate: #2523 / run `36582671155`.
- Result: FAILURE as intended.
- Shared timing failures proved:
  - Delivery/Retirada/Local did not yet support the 90-day policy;
  - stable past/mismatch/out-of-range reasons were absent;
  - São Paulo calendar-day boundary behavior was absent.
- Checkout failures proved:
  - Local scheduling was still rejected;
  - 90-day future scheduling still used the legacy same-day rejection.
- No parser/import failure was counted as RED.

### GREEN

- Shared timing implementation: `0df84f3845765d2b05d92bbee4df0e3bf6016cbb`.
- Checkout integration: `93f13367a071bd190dd963ae6ab68e8d5e48d45c`.
- Validate: #2525 / run `36582977746`.
- Result: SUCCESS.
- `SCHEDULE_MAX_DAYS = 90`.
- `validateOrderSchedule` now uses America/Sao_Paulo calendar days and returns normalized ISO timestamps.
- Delivery, Retirada and Local are schedule-eligible.
- Past, date mismatch, invalid timestamp and day-91 cases are rejected.
- Legacy `isFutureSameDaySchedule` remains compatible by delegating to the new policy with a zero-day horizon.
- Architecture/lint/build/Worker dry-runs/D1 gates: PASS.
- Staging deploy: NOT EXECUTED.
- Production deploy: NOT EXECUTED.

## Task 3 evidence

### RED

- Repository test commit: `e7ed9342c35d02219ad6bdaa61a9bbb05bbd4db5`.
- Order read contract commit: `4ab73ac93cbd9169ed46bfe9d78ca0307f1daed8`.
- Final RED commit: `900fef8a8956adf6a8750cd5430f336101b17d47`.
- Validate #2527 / run `36583695335` proved the stub repository returned null/empty projections.
- Validate #2529 / run `36583884743` additionally proved:
  - Orders did not expose reservation context;
  - tables did not expose `nextReservation`.
- Failures were behavioral and expected.

### GREEN

- Reservation read repository: `a080f7c1ec86f238eaf966dd992a0db5f520a6cb`.
- Table projection: `48924fddb30cbe35edad4ebcf50ca9f1b962f3eb`.
- Order SQL/context: `2d9515a96cb04b4124b7fe420d51b4f7a1f3dd72` + `ad4e3175a149994859a5839b246dcc0fad5c1093`.
- Fixture/contract alignments: `df119ea489aec485f557b7ca4addd6eb5d260006`, `a07406b43668b9d5cb09ff5ad14155a8a09ee49e`, `1123243c6588b6d405c793fe3a3212f571c8669d`.
- Validate: #2533 / run `36584823314`.
- Result: SUCCESS.
- New repository supports:
  - load by reservation ID;
  - load by order ID;
  - business-scoped filtered list;
  - earliest active reservation per table;
  - item count / total / optional client projection.
- Order read model now exposes reservation id/status/table/revision and uses reservation table name when no table-tab exists.
- `listTables` / `loadTableById` expose only `nextReservation`; occupancy remains derived only from open table-tabs.
- Bootstrap therefore gains only the compact table projection, not a 90-day reservation collection.
- Architecture/lint/build/Worker dry-runs/D1 gates: PASS.
- Staging deploy: NOT EXECUTED.
- Production deploy: NOT EXECUTED.

Stopped before Task 4.
