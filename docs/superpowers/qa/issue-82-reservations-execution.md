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
| 4 — Table guards | COMPLETE / GREEN | RED `c7aca6a0d8c528a91b5e11caae72ab7585ef5690` → Validate #2537 / run `36586270135` failed on the intended backend/UI reservation restrictions. GREEN `738a6049cdb7b1d875236217ef78517369e0f64e` → Validate #2539 / run `36586505823` SUCCESS on rerun attempt 2; attempt 1 had only an unrelated local Wrangler port collision in the Spec B D1 gate. |
| 5 — Local reservation checkout | COMPLETE / GREEN | RED `9f6f2770e6e380faa16159f9e0934061d7849ae9` → Validate #2542 / run `36587171200` failed exactly on 5 intended reservation-checkout behaviors. GREEN `e7aab7c8d125de30904a6048ffd8f4384e48c202` → Validate #2545 / run `36587697649` SUCCESS; all shards, architecture/lint/build, Worker dry-runs and D1 gates green. |
| 6 — Printing matrix | COMPLETE / GREEN | RED progression `0a3c227940d52d52c9a66607b625f420bd09d312` → `1818e17da7ac28d709366cfd9762b42f1ed545ba`; Validate #2551 / run `36592153363` and #2554 / run `36592558646` failed on intended availability/document behaviors. GREEN `4e0138ea27f1a617178b39de675d5fbef59df50b` → Validate #2564 / run `36593459366` SUCCESS; all 8 shards and full validation green. |
| 7 — Reservation read API | COMPLETE / GREEN | RED `b765f96dc320d45614d9276a28d5a9231b8704f2` → Validate #2568 / run `36595571884` failed on 3 intended read/filter/detail behaviors. GREEN `ddfe5311a8c0dded685e40fbc9f128d12bf9c5af` → Validate #2570 / run `36595908826` SUCCESS. |
| 8 — Cancel / no-show | COMPLETE / GREEN | RED `57345c069834e3dbf610df8aa5c54a19792693ce` → Validate #2571 / run `36596107150` failed on 5 intended lifecycle behaviors. GREEN `d5b2246d7cd16ae04cdbd26635b7c3768e318f82` → Validate #2575 / run `36596600847` SUCCESS. |
| 9 — Arrival conversion | COMPLETE / GREEN | RED `c3232731d1d85432ac188bdeae6cf56c152a03d4` → Validate #2577 / run `36596811849` failed on 4 intended conversion/API behaviors. GREEN `94f2cb88435483794b25752a2b2a7db148408897` → Validate #2579 / run `36597090286` SUCCESS. |
| 10 — Reservation editing backend | COMPLETE / GREEN | RED `85730d19e7520b6b3029d496088a934cab5a11bc` → Validate #2583 / run `36598668914` failed on 5 intended edit/API behaviors. GREEN `d6ea8f1e59642d5da6380af62be3759033100d68` → Validate #2585 / run `36599062787` SUCCESS. |
| 11 — Frontend reservation boundary | COMPLETE / GREEN | RED `969a3c26b0debd3f2855b2e2e5654c39d9d900ac` → Validate #2591 / run `36599673011` failed on intended command/public-boundary behaviors. Implemented through `1b2ccdc5aa73b2836fc5d34503e9f2a881adfaf8` + ownership fix `fcf3a76018c7337cfe96f6cb5d08304aba1596f3`; integrated GREEN proven by Validate #2612 / run `36610498170` SUCCESS. |
| 12 — New Order reservation mode | COMPLETE / GREEN | RED `0cd3cd102dd931683384a236f2c3347d5967eb24` → Validate #2601 / run `36600441146` failed on the intended multiday/Local-reservation wizard contracts. GREEN implementation through `a0d6cd2aced3e08b7d4184e233a48a0be032714b`, characterization alignment `ad2c640274e966dcc2fa454b60ea11b80c5cd8fc`; Validate #2612 / run `36610498170` SUCCESS on `1cdb4c8cc14600b99ac4c57d9cbab9901d229433`. |
| 13 — Edit reservation wizard | COMPLETE / GREEN | Valid behavioral RED `931c2b6d4c6d6978669c2375d024ca07c59c82a2` → Validate #2619 / run `36613288332` failed on the intended edit-context/dispatch/wizard behaviors. GREEN `e7ab79229a87cedb957d075bfa96017d962503d0` → Validate #2628 / run `36614217317` SUCCESS; all 8 shards and full validation green. |
| 14 — Comandas desktop/mobile | COMPLETE / GREEN | Behavioral RED `13c31af47f305a57f44ea12b7e1e88cfd1706b06` → Validate #2633 / run `36616275615` failed on the intended reservation list/detail/mobile behaviors. GREEN `884961305d20f31c6d59c903d4c07f88187233dc` → Validate #2644 / run `36617341007` SUCCESS; all 8 shards and full validation green. |
| 15 — Orders / future schedules | NOT STARTED | — |
| 16 — Kitchen TV / realtime | NOT STARTED | — |
| 17 — Finance / receivables | NOT STARTED | — |
| 18 — Reporting | NOT STARTED | — |
| 19 — Full gates | NOT STARTED | — |
| 20 — Staging | COMPLETE / GREEN | Deploy staging run 36633062484 SUCCESS no SHA 2712f64aa70aa891c7d7a6d41a9262f7a5a78c08; migrations, deploy, login e deep links verdes. |
| 21 — Manual QA | PARTIAL / FAIL | 70 casos registrados no QA: 39 PASS, 3 FAIL, 28 BLOCKED; gate aberto. |
| 22 — Technical closure | BLOCKED | Aguarda correção dos FAILs, revalidação, casos bloqueados e autorização separada. |

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


## Task 4 evidence

### RED

- Backend test commit: `e4eb7e492adffa42fd055251860181f3afc93844`.
- UI contract test commit: `c7aca6a0d8c528a91b5e11caae72ab7585ef5690`.
- Validate: #2537 / run `36586270135`.
- Result: FAILURE as intended.
- Behavioral failures proved:
  - active reservation did not yet block rename/deactivation;
  - Tables UI did not yet explain or disable those actions.
- Reordering and terminal-reservation behavior were already characterized separately.

### GREEN

- Backend guard commit: `c0f234809b7601accf70f225176eee3940c54594`.
- UI commit: `738a6049cdb7b1d875236217ef78517369e0f64e`.
- Validate: #2539 / run `36586505823`.
- Attempt 1:
  - all test shards, architecture, lint, build, Worker bundles and local migration application passed;
  - Spec B D1 probe failed only because Wrangler could not bind local port `127.0.0.1:39001`.
- Failed jobs were rerun without code change.
- Attempt 2: SUCCESS.
- Active `reserved` reservation now blocks:
  - rename;
  - deactivation.
- Stable error: `TABLE_HAS_ACTIVE_RESERVATION`.
- Message directs operator to move/cancel the reservation.
- Reordering remains allowed.
- `cancelled` and `no_show` reservations do not block table management.
- Tables UI preserves Livre/Ocupada and adds an explicit `Reserva ativa` restriction.
- Staging deploy: NOT EXECUTED.
- Production deploy: NOT EXECUTED.

## Task 5 evidence

### RED

- Validation RED: `190221f81e108390b6b7cc9a8ea1acbac65c22eb`.
- Repository RED: `a37eaaf91b23dc64b3f4a9b53564a0e1113085f1`.
- Final HTTP RED: `9f6f2770e6e380faa16159f9e0934061d7849ae9`.
- Validate: #2542 / run `36587171200`.
- Result: FAILURE as intended.
- Exactly 5 new behaviors failed:
  - Local reservation still rejected future `orderDate` at repository boundary;
  - occupied-now table still could not create the intended independent future reservation;
  - overlap/idempotent reservation checkout contract was absent;
  - scheduled table checkout still accepted `expectedTableTabId`;
  - HTTP checkout did not return a reservation/table projection.

### GREEN

- Checkout validation: `ecdf4940848258ea943cd985097d2f97d7c3c8f3`.
- Atomic repository implementation: `ec7d4a64a2a7913ca05547a2cc47ff7f16e41a69`.
- HTTP official effects: `e7aab7c8d125de30904a6048ffd8f4384e48c202`.
- Validate: #2545 / run `36587697649`.
- Result: SUCCESS.
- Local + `scheduledFor` now:
  - validates active table;
  - never opens/reuses a table-tab;
  - persists order with `table_tab_id = NULL`;
  - persists one `table_reservations` row in the same batch;
  - snapshots table name;
  - persists 120-minute conflict duration and `ends_at`;
  - allows optional same-business client;
  - remains in customer identity context `table`;
  - returns reservation + updated table projection from POST /api/orders.
- A table occupied now can receive a future reservation without joining its current comanda.
- `expectedTableTabId` is rejected for scheduled Local checkout.
- Reservation overlap translates to `409 TABLE_RESERVATION_CONFLICT`.
- Overlap failure rolls back order/items/automatic print job/reservation together.
- Idempotent replay returns the same order/reservation and does not duplicate jobs or reservations.
- Scheduled future `orderDate` is now allowed when a valid `scheduledFor` is present; future immediate order dates remain rejected.
- Automatic printing timing/document semantics are intentionally unchanged here and remain owned by Task 6.
- Staging deploy: NOT EXECUTED.
- Production deploy: NOT EXECUTED.


## Task 6 evidence

### RED

- Availability matrix tests: `0a3c227940d52d52c9a66607b625f420bd09d312`.
- Canonical scheduled document tests: `f90d75617b14ae23cdceb8256c738b1da3c214b6`.
- ESC/POS + PDF schedule semantics: `e8b650c26a5242f3bd441d91d61661b975fc32e8` / `55ad358bf80ac382bf9aca345da3c2d8755d1855`.
- Manual official-document rebuild test: `1818e17da7ac28d709366cfd9762b42f1ed545ba`.
- Validate #2551 / run `36592153363`: FAILURE as intended, proving:
  - next-day Entrega/Retirada automatic jobs were still available immediately;
  - Local reservation automatic jobs were still available immediately;
  - canonical documents had no scheduled timestamp/semantic label;
  - ESC/POS/PDF did not expose requested service time.
- Validate #2554 / run `36592558646` extended the RED to the manual/reprint document reconstruction path.
- Failures were behavioral; later fixture-only failures were aligned without changing the approved semantics.

### GREEN

Production implementation:
- `6d4b4d68feac06a4e7152aa937600745aa1458b4` — shared automatic availability resolver.
- `4c3d065d6dfb3a9dbda887db167cc377edfc6901` — canonical scheduled print metadata.
- `db0313f5d87133b18a34895a71926fc399ff1b6c` — thermal ticket rendering.
- `0a3178ad56d9882272bbb3543297781c8011d4dd` — PDF rendering.
- `247f1990ddcc1f241249088142bbd02dae46354f` — official manual/reprint document reconstruction.
- `def165e100283c8c1a7a038fd8d4c7573b802aa6` — checkout print matrix integration.

Fixture/contract alignments:
- `84e44dc015cf4ef6f73c535928ee562c4e6a46b4`;
- `9412cb64d81f1f5eb3bb4be3b30c5c47d8931fe4`;
- `67b4419594f1d7e3c4ae69a6d5520d5b64aabc57`;
- `4e0138ea27f1a617178b39de675d5fbef59df50b`.

Validate #2564 / run `36593459366`: SUCCESS.

Approved matrix now proven:
1. immediate order → `available_at = created_at`;
2. same-day Entrega/Retirada scheduled → immediate automatic availability preserved;
3. another-day Entrega/Retirada → `available_at = operational_start_at`;
4. Local reservation, including same-day → `available_at = operational_start_at`;
5. Local reservation without a table-tab still snapshots the table-context copy default;
6. canonical order document stores `scheduledFor` + `AGENDADO`/`RESERVA`;
7. ESC/POS and PDF explicitly print the requested service date/time;
8. manual preview/reprint rebuilds the current official scheduled/reservation document;
9. a future automatic job remains separate from manual printing and is not made claimable early;
10. centralized queue semantics remain intact: station readiness/automatic execution does not gate durable job creation.

Additional guarantees:
- current business timing policy supplies operational-start calculation and remains guarded by the existing policy revision assertion;
- no migration rewrites historical `print_jobs.available_at`;
- no changes to QZ physical execution, second-copy lifecycle or station ownership were introduced in this task.
- Physical printer verification remains for staging QA and is not marked PASS here.
- Staging deploy: NOT EXECUTED.
- Production deploy: NOT EXECUTED.


## Task 7 evidence

### RED
- Scaffold: `ee3f138a4eacf41a26380b8f3b871ed4bf254eda`.
- Behavioral RED: `b765f96dc320d45614d9276a28d5a9231b8704f2`.
- Validate #2568 / run `36595571884`: FAILURE as intended.
- Exactly 3 new API behaviors failed while the existing bootstrap projection test remained green:
  - list/filter/capability response absent;
  - invalid filter validation absent;
  - detail order/print metadata response absent.

### GREEN
- API implementation: `bacb1e19bdbd46276d45a2f2e56e73b594015509`.
- Worker delegation: `ddfe5311a8c0dded685e40fbc9f128d12bf9c5af`.
- Validate #2570 / run `36595908826`: SUCCESS.
- Delivered:
  - business-scoped `GET /api/table-reservations` with status/from/to/table filters;
  - strict filter validation;
  - read access through existing `orders.view` or `comandas.view`;
  - `GET /api/table-reservations/:id` with official reservation, canonical order and automatic print metadata;
  - cross-business reservation IDs resolve as 404;
  - bootstrap remains lightweight: no full `tableReservations` collection, only per-table `nextReservation`.
- Staging/production: NOT EXECUTED.

## Task 8 evidence

### RED
- Commit: `57345c069834e3dbf610df8aa5c54a19792693ce`.
- Validate #2571 / run `36596107150`: FAILURE as intended.
- Five lifecycle failures proved:
  - order cancellation did not close an active reservation;
  - reservation cancel endpoint was absent;
  - no-show endpoint was absent;
  - stale/terminal reservation revision protection was absent;
  - mutation capability/origin rules were absent.

### GREEN
- Atomic cancellation integration: `47aa45c0d37e694732f53e62d71dcd1f43bc5a73`.
- Reservation terminal API: `37fdfbd3dbf1c7ecdcedc34ccd3eca19a170034f`.
- Deterministic test clock + row normalization: `981fb036c20a88f3e68cd13e40cc2adedb828c46` / `d5b2246d7cd16ae04cdbd26635b7c3768e318f82`.
- Validate #2575 / run `36596600847`: SUCCESS.
- Delivered:
  - cancelling a reserved order from the existing Orders surface atomically marks reservation `cancelled`;
  - `POST .../:id/cancel` and `POST .../:id/no-show` reuse the official cancellation reason/policy flow;
  - no-show records `no_show` without opening a comanda;
  - pending automatic print job is removed by the existing cancellation transaction;
  - reservation revision/status guard participates in the same batch as order cancellation;
  - stale revision returns `TABLE_RESERVATION_CHANGED`;
  - terminal reservation returns `TABLE_RESERVATION_ALREADY_CLOSED`;
  - mutation requires existing `orders.cancel` capability and same-origin protection.
- Staging/production: NOT EXECUTED.

## Task 9 evidence

### RED
- Scaffold: `03ba8196397e22d741e8b89bc680ef86506c66da`.
- Behavioral RED: `c3232731d1d85432ac188bdeae6cf56c152a03d4`.
- Validate #2577 / run `36596811849`: FAILURE as intended.
- Four new behaviors failed:
  - no atomic reservation → comanda conversion;
  - no Finalizado/retry preservation;
  - no early/stale/cancelled/occupied guards;
  - no confirm-arrival HTTP workflow.

### GREEN
- Atomic conversion repository/workflow: `ebfab1e1e3c06db8759c0841ad118a09445b00e5`.
- HTTP route/effects: `94f2cb88435483794b25752a2b2a7db148408897`.
- Validate #2579 / run `36597090286`: SUCCESS.
- Delivered:
  - `POST /api/table-reservations/:id/confirm-arrival`;
  - requires `orders.create`, same origin, expected reservation revision and mutation ID;
  - rejects confirmation before the scheduled business day;
  - rejects inactive/occupied mesa and cancelled order;
  - opens exactly one numbered table-tab in the conversion commitment;
  - links `orders.table_tab_id`;
  - converts reservation with `converted_table_tab_id`, timestamp and revision increment;
  - preserves order status (`Em preparo` or `Finalizado`);
  - retry after a committed conversion resolves to the same comanda instead of creating another;
  - response returns official reservation/order/tableTab and recalculated tables/nextReservation.
- Number gaps remain acceptable if a failed race already reserved a counter number; numbers are never reused.
- Staging/production: NOT EXECUTED.


## Task 10 evidence

### RED

- Scaffold: `db21b540c765c81bd6131da17a0fb9c525b6d9f6`.
- Behavioral RED: `85730d19e7520b6b3029d496088a934cab5a11bc`.
- Validate #2583 / run `36598668914`: FAILURE as intended.
- Five edit behaviors proved absent:
  - atomic repricing/snapshot replacement;
  - rollback on inactive product/conflict/stale revision;
  - edit cutoff after operational start / terminal lifecycle;
  - discarded/missing automatic job preservation;
  - PUT capability/adjustment authorization path.

### GREEN

- Backend edit workflow: `d7f29cc8a6268562c643ccb1bf530382ef6f6357`.
- HTTP endpoint and checkout validation reuse: `d6ea8f1e59642d5da6380af62be3759033100d68`.
- Validate #2585 / run `36599062787`: SUCCESS.
- Delivered:
  - `PUT /api/table-reservations/:id`;
  - only active `reserved` reservations before `operational_start_at` are editable;
  - expected revision required and optimistic concurrency enforced;
  - client, mesa, date/time, items, notes and approved adjustment can change;
  - products are revalidated/repriced from the current catalog;
  - order id/number remain stable;
  - order_date/scheduled_for, reservation interval/table snapshot and items change atomically;
  - pending automatic job keeps its id/copies while document/available_at are updated;
  - discarded job is never revived and missing automatic job is never backfilled;
  - manual print history is exposed to the UI workflow;
  - table conflict/product/policy/revision races fail without partial state;
  - adjustment edit requires existing `orders.discount` capability.
- Staging/production: NOT EXECUTED.

## Task 11 evidence

### RED

- Boundary scaffolds:
  - `21e89a898062616c20d00c75a3909a4a98aa6be1`;
  - `1d02045aaa04051d8b1f4093cd777e70e3679189`;
  - `cdb3e36f4754b45ebd8559acc5202be2d21c75ba`;
  - `b548c8a256d24ed16e4abeaca77aaf1e73bed8cc`.
- Behavioral tests:
  - `0f223a1ec2bf134246e7086cee5f54e5583c88a8`;
  - `6bf717406c671e0c6687f755067b2dbfadf50301`;
  - `dc976d29e945864929dd19d2e1c6828ea447a683`;
  - `969a3c26b0debd3f2855b2e2e5654c39d9d900ac`.
- Validate #2591 / run `36599673011`: FAILURE as intended, proving command ownership/conflict refresh behavior and public contract were not yet implemented.

### GREEN

- Domain helpers: `6e5deafa1b1c42887e9569b57fa590ebb69e1a47` + identity refinement `fcf3a76018c7337cfe96f6cb5d08304aba1596f3`.
- Dedicated API: `0a9cf822a8e2758fdd0f97485b6bc27ad63bedb3`.
- Detail owner: `5b5f268055f9c77ec08213e4d5b2fb201d2b5065`.
- Commands owner: `a602fef772cb25edd45937670d1306578c4b41d4`.
- Deliberate public contract: `b9f650c53c2748e1263ab5c7ff26364161d3b0f9` + `1b2ccdc5aa73b2836fc5d34503e9f2a881adfaf8`.
- Integrated Validate #2612 / run `36610498170`: SUCCESS.
- Delivered:
  - dedicated frontend API paths for list/detail/edit/arrival/cancel/no-show;
  - reservation detail owner ignores late responses from retired selections;
  - commands guard writesBlocked and existing create/cancel/discount capabilities before network;
  - official mutation responses are applied directly;
  - 409 conflict refreshes official reservation state once and does not retry mutation;
  - Table Service exposes a deliberate public reservation boundary;
  - reservation application/domain code does not deep-import Orders.
- Staging/production: NOT EXECUTED.

## Task 12 evidence

### RED

- Schedule input-limit scaffold/tests: `ac17c196acdbd6f4850a487846ef94dc99cfcb65` + `3bb74953c628d81690587fb45d8cb5f9c88afbba`.
- Schedule-state scaffold/tests: `4749fb9de35809d8c3229b5279e4a778d144ccfe` + `8fecbf7bf98d065f173645d74987f6f51af5e1d1`.
- Payload/UI RED: `db2bd9ad50ab4539cf90e151c734f9264e8db92e` + `0cd3cd102dd931683384a236f2c3347d5967eb24`.
- Validate #2601 / run `36600441146`: FAILURE as intended.
- RED proved:
  - no 90-day date-input helper;
  - no Local Reservar schedule state;
  - Local reservation payload still carried open table-tab identity;
  - wizard did not expose Reservar/multiday controls;
  - occupied-table reservation hint behavior/full-date review were absent.

### GREEN

- 90-day date max: `930a71f3482807cfeca8e2cd4c37332697da194d`.
- Shared wizard schedule state: `c6b11e2f4c001e60b070f472675ffa549f42374f`.
- Reservation payload detaches expected open tab: `12938d88cbdd4ba32e58354e3cc7435eb46c8fb4`.
- Customer-step controls: `d5ea7545e343b8401069c06c9fed46694d043bc8`.
- Occupied-table reservation UX: `96f5319ecfdb59aaa4a6859ec1a4f9e841f864d4`.
- Review full date/time: `e21bb14f13d04c45b6ac6f1811d39e5da01303b6`.
- Wizard integration: `a0d6cd2aced3e08b7d4184e233a48a0be032714b`.
- Non-behavioral characterization alignment: `ad2c640274e966dcc2fa454b60ea11b80c5cd8fc`.
- Validate #2612 / run `36610498170`: SUCCESS.
- Delivered:
  - date field accepts today through the 90th business-calendar day;
  - Entrega/Retirada keep Agora/Agendado semantics;
  - future date forces scheduled mode (Agora is not valid);
  - Local exposes Agora/Reservar;
  - Local Reservar keeps mesa required and can select an occupied-now mesa for a future reservation;
  - selected occupied table no longer says the order will join the current comanda while in reservation mode;
  - `expectedTableTabId` prevents reservation mode for “Adicionar pedido” on an existing comanda;
  - Local reservation checkout payload sends `scheduledFor` and omits open-tab identity;
  - review shows full service date/time and labels Local as Reserva;
  - existing dirty-draft tracking already includes orderDate/scheduleMode/scheduledTime and remains active.
- CI note: the first final run exposed a pre-existing time-dependent Kitchen TV security fixture whose fixed admin-session date had crossed the seven-day auth lifetime. Test-only commit `1cdb4c8cc14600b99ac4c57d9cbab9901d229433` replaced those stale fixed session timestamps with current session creation; all feature shards and full validation then passed. No Kitchen TV production behavior changed.
- Staging deploy: NOT EXECUTED.
- Production deploy: NOT EXECUTED.


## Task 13 evidence

### RED

The first test commit `212182950621c7f945d3b8650d61b34465e8f6b1` initially failed at module-load time because the planned edit-context export did not yet exist. That parser/import-style failure was **not counted as the behavioral RED**.

A minimal executable scaffold was then added at `931c2b6d4c6d6978669c2375d024ca07c59c82a2`.

Validate #2619 / run `36613288332`: FAILURE as intended on behavioral contracts:

- official reservation detail was not converted into a reusable New Order edit snapshot;
- draft controller did not preserve explicit `mode = 'edit-reservation'` or reservation revision context;
- edit submission still followed create-order behavior instead of reservation PUT;
- stale-revision refresh/reopen behavior was absent;
- policy-change edit behavior was absent;
- shared New Order UI had no edit initialization/title/manual-print warning.

### GREEN

Implementation:

- `637d01ca64222d45e37df931c0bdd5d5355d8fb1` — explicit create/edit draft model, official snapshot conversion and stale-context replacement;
- `f38495ede1ade1cb7cda4e4e6c3d41f714a139b2` — edit-aware `useNewOrderDraft` dispatch, stale refresh and policy behavior;
- `fddfe6576c33d9a134c8e1c59d7251f855c69b1a` — reservation detail exposes manual-print history;
- `67449eea7f378df2840bebeadd2748e771c7053e` — New Order wizard edit initialization, labels and manual-print confirmation;
- `44ebbcf2b1cd6d3d812a76553eaf0632cc2308c8` — App composition sends explicit mode/context/snapshot and uses reservation PUT boundary;
- `1fcfc6c0adfbde578f66b1fabc1fbb8fa48db62c` — manual-print-history fixture coverage;
- `4dc5632760864e90029375f2b78b7a49fc14e34e`, `e9b6674bcc169c08ab41e6186f14bd3e3152d723`, `e7ab79229a87cedb957d075bfa96017d962503d0` — characterization alignments for preserved create/default behavior.

Validate #2628 / run `36614217317`: SUCCESS.

Delivered:

- one shared wizard contract with explicit `mode: 'create' | 'edit-reservation'`;
- edit context owns reservation id, original order id/number, expected revision and manual-print-history flag;
- official reservation/order snapshot pre-fills mesa, optional client, date/time, items, notes, prices and adjustment;
- edit submission calls `PUT /api/table-reservations/:id`; create mode continues to call `POST /api/orders`;
- existing order id/number come only from the official backend result and are never recreated by the editor;
- Cancelar edição only exits/discards the draft through the existing navigation dirty guard; it does not cancel the reservation;
- stale `409` reloads the official reservation snapshot/revision, keeps the editor open and surfaces the error;
- `POLICY_CHANGED` keeps the editor open and reuses the existing policy-review feedback path;
- manual print history is loaded before editing and requires an explicit “Salvar mesmo assim” confirmation before the PUT;
- edit mode never exposes immediate payment;
- NewOrder route remains the same generic component boundary; no parallel reservation editor was created;
- create-order navigation/idempotency and authoritative local effects remain preserved.

Staging deploy: NOT EXECUTED.
Production deploy: NOT EXECUTED.

Stopped before Task 14.


## Task 14 evidence

### RED

- Reservation-detail scaffold: `2c787dd7bc7f8d2b02b8da2386662c4c8166db3f`.
- Detail behavior tests: `282b5ebd1e24c006dc8ec3c65c03fb0fcf3897f7`.
- Comandas list/mobile reservation tests: `13c31af47f305a57f44ea12b7e1e88cfd1706b06`.
- Validate #2633 / run `36616275615`: FAILURE as intended.
- Behavioral RED proved:
  - the existing Comandas subtitle/list knew only Livre/Ocupada;
  - free + reservation did not expose Reservada;
  - occupied + future reservation had no separate reservation target;
  - reservation detail/actions were absent;
  - mobile reservation list/detail flow did not exist.

Additional composition RED:
- `7cc3a31132ab4c66fabd80d4b466be1ebcd3b6ce` required official reservation command results to reach App composition;
- `cdd6722fc048537815b230ab2588ba31beb5075a` required App to wire edit/arrival/cancel/no-show into Comandas and select the authoritative converted comanda.

### GREEN

Implementation:
- `fd0f325fd7e37924d91d1f35e9a2991357fcc507` — reservation detail, actions and explicit arrival/cancel/no-show confirmation;
- `6addd0faeda9aadd99fde4bc314e85b51453195a` — Comandas reservation list/detail integration;
- `51035a861d52d5bcb50273e2db7eeef3f858f17c` — reservation visual state using existing semantic tokens;
- `7882054a522eb7394beed795bd0a38918fbb55b2` — shared SystemSelect compliance in reservation closure flow;
- `847e606f6f15bf404ae02e330e90597c33d88b4a` — reservation command result observer;
- `d4570f539f10df835e248d668e4776a4f7b687fb` — App composition for edit/arrival/cancel/no-show and authoritative post-arrival comanda selection.

Test/characterization alignments:
- `4b951d0c9650404101edaf167d5a3acfc171041d`;
- `f7165e073d92e2df71eee1c411364a33bed8f527`;
- `884961305d20f31c6d59c903d4c07f88187233dc`.

Validate #2644 / run `36617341007`: SUCCESS.

Delivered:
- subtitle now states “mesas, comandas e reservas”;
- free table without reservation remains Livre and keeps the current quick-order behavior;
- free table with `nextReservation` shows explicit `Reservada`, client/time/item summary and opens reservation detail;
- occupied table remains primarily `Ocupada`/current comanda while a future reservation appears as a separate secondary target;
- tapping current comanda still opens the existing comanda detail;
- tapping a reservation opens official reservation detail from `GET /api/table-reservations/:id`;
- detail shows mesa, optional client, full service date/time, Reservada state, items and total previsto;
- Editar reserva is available only before `operational_start_at` and only with order-create capability;
- Confirmar chegada is available only from the reservation business day onward and always uses the authoritative conversion endpoint;
- successful arrival applies official effects and selects the exact newly-opened comanda returned by the backend;
- Cancelar reserva and Não compareceu are exposed only with `orders.cancel`, use configured cancellation reasons/revision and never bypass the lifecycle API;
- there is no standalone “Abrir comanda” action;
- mobile preserves the current list/detail split, back action, scroll restoration and focus restoration for reservation selection;
- Reservada is textual/semantic and uses `--info` / `--info-soft`, not color alone and not a global redesign;
- existing Livre/Ocupada behavior and comanda detail/payment/transfer/printing flows remain unchanged.

Staging deploy: NOT EXECUTED.
Production deploy: NOT EXECUTED.

Stopped before Task 15.

## Task 15 evidence

### RED

- Behavioral test commit: `7dc06fd5c23a3617ed3291a92d7307bbade64f9d`.
- Validate #2647 / run `36623021879`: FAILURE as intended.
- The three focused failures proved:
  - a schedule for the next operational day still remained in the current Kitchen `allActive/scheduled` population and therefore contaminated today's counters;
  - no dedicated future-schedule projection existed for search/list rendering;
  - Pedidos/Cozinha had no `Próximos dias` surface.

### GREEN

Implementation:
- `95868feaf61344cf1ebd924d0e904749520ea70a` — App composition can load official reservation detail before opening the shared editor from Pedidos;
- `ed5bfa00d95f9a03e0287b4bc73bbeab32ab0ad1` — first operational/future queue separation;
- `c065e31fea70fec833f7420c2051db261427f137` — `Próximos dias` UI with full service date/time, detail/cancel and Local reservation edit;
- `6ba8b0e6860e0b59020a0dbb45e36e4721660668` — minimal theme-safe future-list styling using existing Kitchen tokens;
- `75bbd26270452b484894b5ca63dc9a1fc7b739b4` — preserved the existing Comandas reservation-edit source contract while keeping the new Pedidos entry point;
- `107c4c4cfd8a7d90af663f6a6c4254377b0de59c` — dedicated future-schedule projection so Kitchen TV/public queue shape remains unchanged;
- `56ab44d36c2f785fdddde5f1bda2210d40522a09` — Orders consumes the dedicated future projection without altering current counters;
- `bdae80fb73df0652f63416989bca2a33d31396ac` — characterization alignment for the preserved Kitchen Display public contract.

The first implementation validation exposed two compatibility regressions in source/public contracts rather than product behavior: the Task 14 Comandas wiring characterization expected its existing explicit edit composition, and Kitchen Display expected the exact historical `buildKitchenQueueModel` return shape. Both were preserved by splitting the future list into its own projection instead of widening the TV-facing model.

Validate #2655 / run `36623885764`: SUCCESS.

Delivered:
- schedules still waiting whose service date is after the current operational business date are excluded from Kitchen `allActive`, `scheduled`, late indicators and today's operational counters;
- same-day scheduled orders remain in the existing Agendados queue;
- a cross-midnight preparation window becomes operational as soon as `operational_start_at` is reached, even when the scheduled service date is the next business day;
- Local reservations use the same separation rule as other scheduled orders;
- Pedidos/Cozinha now has a secondary `Próximos dias` list ordered by `scheduledFor ASC`;
- future rows show full date and time in the operational timezone;
- future orders keep the existing official order detail and cancellation flows;
- only active Local reservations expose `Editar reserva`, which loads the official reservation detail and reuses the shared edit wizard;
- Entrega/Retirada future schedules do not expose generic editing;
- search filters the future list independently and never changes today's Kitchen counters;
- the Kitchen Display public queue contract remains unchanged for Task 16 regression ownership;
- no calendar page, new capability, global reservation collection or redesign was introduced.

Staging deploy: NOT EXECUTED.
Production deploy: NOT EXECUTED.

Stopped before Task 16.

## Task 16 evidence

### RED / characterization

- TV presentation characterization: `23cbadecf95c50f41dd05f30a57e962384af0d12`.
- Kitchen Display runtime characterization: `9462ae310ea7c5f9c72a8cc02edf5a11c7abcb4d`.
- Validate #2659 / run `36625456814`: FAILURE on one new runtime scenario as intended.

The RED exposed a real clock-ownership gap in the Kitchen TV:
- arrival detection correctly used authoritative `serverNow`;
- the rendered TV board still used the device/browser wall clock;
- therefore a future order could render too early when the TV clock/date differed from the server snapshot.

The remaining new characterizations already passed:
- distant Entrega/Retirada schedules do not create TV cards/counters;
- a Local reservation 30 days away does not appear;
- Local reservation becomes a normal Local card when operational;
- opening the TV after the transition does not replay historical sound;
- Mesa modality continues to filter display and future agenda rows are not rendered.

### GREEN

Production fix:
- `709b6abf94d4da489d6c95ef90ba8aee588225d8` — Kitchen TV now synchronizes its presentation clock from each authoritative `serverNow` snapshot and advances that clock locally between polls instead of jumping to the device wall clock.

The first GREEN validation (#2660) still failed one assertion in the new characterization. Review showed the assertion was stricter than the approved spec: once the service date becomes the current operational day, a waiting scheduled order may appear as `Agendado` before `operational_start_at`; the sound/operational transition still occurs only when the preparation window starts.

Characterization correction:
- `98aa8581e34393462ff205b5e1d1a399c08f12dd` — preserves same-day scheduled visibility while requiring silence before the preparation window.

Validate #2661 / run `36625864310`: SUCCESS.

Delivered/proved:
- tomorrow/distant schedules remain absent from TV while they are future operational dates;
- future schedules do not affect TV preparing/scheduled/late counters for the current operational day;
- on the scheduled operational day, waiting work may appear as `Agendado` according to the existing same-day rule;
- at `operational_start_at`, the order transitions to preparing priority and produces one arrival alert;
- repeated polls do not replay that alert;
- opening the TV after the transition seeds the current operational set without historical sound;
- Local reservations follow the same timing and appear with modality `Local` when operational;
- existing Entrega/Retirada/Mesa remote modality filters remain intact;
- TV still has no `Próximos dias`/future-agenda surface;
- paging, overflow and existing TV layout contracts remain unchanged;
- rendering and arrival detection now share the same authoritative server clock basis.

Staging deploy: NOT EXECUTED.
Production deploy: NOT EXECUTED.

Stopped before Task 17.

## Task 17 evidence

### RED

- Receivables behavior tests: `451dc0594ed059b5fec29f32d6d222f05398d3ad`.
- Standalone payment guard test: `342fbf023512af9b7db758e9d49fc67d41878a6d`.
- Validate #2665 / run `36626886305`: FAILURE as intended.

The RED proved:
- a Local reservation with `tableReservationId` and no `tableTabId` still entered the pending receivables population;
- the reservation could consequently reach summary/forecast/group projections;
- reservation identity itself did not protect standalone payment eligibility if other table-shaped fields were malformed;
- converted reservation orders were not explicitly excluded at the receivables source boundary.

### GREEN

Production fixes:
- `b44ca18ee84abf72e7adf99d344f3289b4c83bca` — Finance now has an explicit reservation-order predicate based on `tableReservationId`; pending and paid receivable source populations exclude reservation orders before summary/forecast/grouping.
- `5751e8ef52a71d4e38cec969c8e499fd2313d539` — Orders standalone payment eligibility treats reservation identity as a table relationship guard in addition to the existing Local/table-tab/table identity protections.

Validate #2667 / run `36627016287`: SUCCESS.

Delivered/proved:
- active Local reservation with `tableTabId = NULL` never appears in A Receber;
- active reservation never contributes to today/upcoming/overdue summary or forecast totals;
- active reservation never becomes a standalone receivable group;
- standalone payment remains blocked for reservation identity even if another field is inconsistent;
- converted reservation remains outside A Receber/comanda payment stays authoritative;
- cancelled and no-show reservation orders remain excluded;
- legacy table-shaped orders without reservation identity keep their previous behavior, avoiding a broad `type === 'Local'` inference inside Finance;
- future Entrega/Retirada unpaid orders remain receivables and use future `orderDate` as forecast date;
- future Entrega/Retirada paid at checkout do not remain pending;
- no new Finance -> Orders dependency, capability or payment workflow was introduced.

Staging deploy: NOT EXECUTED.
Production deploy: NOT EXECUTED.

Stopped before Task 18.

## Task 18 evidence

### RED / characterization

Reporting timing/date characterizations:
- `b0ef5551b271f75da2208d92c3476a6665e00571` — future Local scheduled operation uses canonical operational timing and cancelled scheduled Local stays out of operation analytics;
- `e9831f2af411a253b0848cea4f42df518a5e490c` — future sale date vs early receipt date plus reservation receivable semantics;
- `909ca15cc5ecb8314d8005f786d9b38cf098f91b` — repository order_date/payment-date/filter characterization;
- `0b10b498741fb1369cbe7b8d0b79650953a21159` — detail `A receber` filter/pending amount reconciliation.

Validate #2672 / run `36628793496`: FAILURE as intended.
Validate #2673 / run `36628971813`: FAILURE as intended after the detail-filter characterization was added.

The RED proved one real reporting gap while the core time semantics were already correct:
- future orders were already selected by `order_date`, not early `created_at`;
- financial receipts were already selected/grouped by real `paid_at`;
- Local scheduled orders already classified as `scheduled` and `Local`;
- operational duration already started at canonical `operational_start_at`;
- cancelled/no-show mirror orders (`status = Cancelado`) were already excluded from commercial/operation populations;
- however reporting receivable metrics/detail still lacked reservation identity, so an active Local reservation with no table tab could be counted/displayed as standalone `A receber`.

### GREEN

Production fixes:
- `bd0b8c7938e7cbc0514f6f379632e6dbf1d504d9` — reporting receivable analytics explicitly exclude orders carrying reservation identity;
- `a33a5201ca395ad727c51257c63da0b27c390b2a` — reporting `receivable=unpaid` filter excludes reservation orders via authoritative reservation relation;
- `f7f3de31889c8b746244343c92b84b1e7954c9e6` — reporting repository projects reservation identity into overview/sales/detail/order-detail reads and client pending calculations;
- `12eb02bbb04e59e6315b2a879482675db414a6c3` — completes reservation context join for client detail rows.

Validate #2677 / run `36629169321`: SUCCESS.

Delivered/proved:
- future scheduled sale belongs to its future `order_date`, even when created days earlier;
- early payment remains on its actual financial `paid_at` business date and does not move the sale to that day;
- Local reservation remains modality `Local` and schedule classification `scheduled`;
- operational duration for a reservation prepared later uses `operational_start_at`, never the advance-created timestamp;
- cancelled/no-show mirror orders remain excluded anywhere cancelled orders are excluded;
- active reservation remains a commercial scheduled order for sales/product semantics but is not a standalone receivable;
- Overview/Sales receivable metrics no longer count active reservation orders;
- Detail `A receber` filter excludes reservation orders;
- detail/client pending amount for reservation orders is zero;
- ordinary future unpaid Entrega/Retirada receivables remain unchanged;
- type/schedule/date filters continue to select the same future order population coherently;
- no new reporting KPI, capability or reservation-specific dashboard was introduced.

Staging deploy: NOT EXECUTED.
Production deploy: NOT EXECUTED.

Stopped before Task 19.

## Task 19 evidence

### Architecture / transverse regression audit

Permanent issue-specific audit:
- `9db0f072192b9a5c270294f521faff05025f66b3` — added `src/issue82ReservationArchitecture.test.js` covering:
  - App consumes Table Service only through its public entry;
  - reservation HTTP ownership remains in Table Service infrastructure;
  - Worker index delegates reservation routes to `handleTableReservationApi`;
  - no reservation capability family was introduced; only existing `orders.create`, `orders.discount` and `orders.cancel` are used;
  - no global/bootstrap `tableReservations` collection exists;
  - no SQL exists in React production files;
  - backend `TABLE_RESERVATION_*` codes do not leak into frontend production source;
  - migration `0034_table_reservations.sql` is the reservation schema owner;
  - reservation runtime code does not probe/alter schema as a fallback.

The existing permanent architecture checker remained green and continues to reject Table Service deep imports and Table Service → Orders imports.

### Full regression/gate closure

Validate #2684 / run `36630884500`: SUCCESS.

The final Task 19 run covered:
- all 8 npm test shards, including checkout, table management, table-tab lifecycle, cancellation/refund, printing, split payments, NewOrder, Comandas, Kitchen queue, Kitchen TV, Receivables, Reporting and the new Issue 82 architecture audit;
- `npm run test:architecture`: PASS;
- lint: PASS;
- build: PASS;
- Worker production dry-run: PASS;
- Worker staging dry-run: PASS;
- local D1 migrations: PASS;
- Spec B D1 clean-install/upgrade gate: PASS;
- operation-profile D1 clean-install/upgrade gate: PASS;
- `worker/tableReservationsMigration.test.js` remains green for the exact pre-0034 → 0034 upgrade and clean install.

### Diff hygiene / scope audit

The PR-wide diff audit initially found Markdown hard-break trailing spaces in the Issue 82 spec/plan/QA documents. They were normalized in documentation-only commits:
- `9f116a5a5463019fc422d00b6a6303297306e0f2`;
- `ca4c62236810f796453c0b7c503feb5ceedaae36`;
- `e0767f7f8d2de67a7549e6199c4a86513a67a2cc`;
- `622eb05884c45cd717032355c1e5040216b14865`.

A fresh PR diff inspection after normalization found:
- added lines with trailing whitespace: 0;
- conflict markers: 0.

Scope review also confirmed:
- no new capability migration/configuration;
- no global design-system or navigation redesign;
- visual changes remain scoped to existing Comandas/Orders surfaces;
- no staging deploy;
- no production deploy.

Task 19: COMPLETE / GREEN.

Staging deploy: NOT EXECUTED.
Production deploy: NOT EXECUTED.

Stopped before Task 20.

## Task 20 preflight — staging deploy

Candidate:
- branch: `feature/issue-82-multiday-reservations`;
- exact HEAD: `830ab96d7a61f688ca783d4b49d0ea19a5ca40d2`;
- final branch Validate #2686 / run `36631321076`: SUCCESS;
- PR #83: OPEN / DRAFT / mergeable.

The official `.github/workflows/deploy-staging.yml` was re-audited before dispatch:
- deploy is manual through `workflow_dispatch` for this branch;
- environment is `staging`;
- full npm test suite, architecture, lint and build run again;
- local D1 migrations and staging Worker dry-run run before deployment;
- remote staging migrations are listed and applied with `npm run d1:migrate:staging`;
- staging PIN is configured only in staging;
- deploy target is the staging Worker;
- automated real login smoke is required;
- SPA deep links/assets are verified for Pedidos, Histórico, Controle da TV, Comandas, A Receber, Movimentações, Relatórios, Configurações and Cozinha TV;
- no production deployment step exists in the staging workflow.

### Dispatch blocker

The currently available GitHub connector can inspect and monitor workflow runs/jobs/logs, but it does not expose a `workflow_dispatch` action. There are also no repository/Cloudflare credentials available in the execution shell that would authorize dispatching the workflow by another approved route.

Per the approved release process, the workflow triggers were **not modified** and no automatic/deployment bypass was introduced.

Task 20 status: **BLOCKED-PENDING-MANUAL-DISPATCH**.

Required manual action:
1. GitHub → Actions → **Deploy staging**;
2. **Run workflow**;
3. select branch `feature/issue-82-multiday-reservations`;
4. run it once.

After the dispatch exists, the run can be monitored from here and Task 20 can continue with SHA verification, migration/deploy evidence, login/deep-link smoke and QA documentation.

Staging deploy: NOT EXECUTED.
Production deploy: NOT EXECUTED.

### Automatic staging trigger enabled

At the user's explicit request, the official staging workflow now includes the exact branch:
`feature/issue-82-multiday-reservations`

Commit:
- `2680e72d7a9404dfa7e38fcd608eb0817499c384` — adds only this exact branch to the existing `Deploy staging` push allowlist.

Scope:
- staging workflow only;
- no broad `feature/**` trigger;
- no production workflow change;
- subsequent pushes on this branch automatically run the existing staging migration/deploy/login/deep-link pipeline.


## Task 20 — confirmação efetiva de staging (2026-09-29)

- PR #83 OPEN / DRAFT, head 2712f64aa70aa891c7d7a6d41a9262f7a5a78c08 durante a homologação; base da PR master da81fb2be7a754f9296a54d9e44e82372341e20d.
- Validate application #2689: SUCCESS no branch antes do deploy.
- [Deploy staging run 36633062484](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36633062484): SUCCESS no mesmo SHA 2712f64aa70aa891c7d7a6d41a9262f7a5a78c08.
- Job 109628189788: Show pending staging migrations, Apply staging migrations, Deploy staging, Verify staging login, Verify staging deep links e Summarize staging URL concluíram SUCCESS.
- Smoke autenticado em Pedidos, Comandas, Mesas, Financeiro, Relatórios e Cozinha TV.
- Nenhum deploy de produção ou merge executado.

## Task 21 — execução manual parcial e gate aberto

- [Matriz QA com 70 casos](issue-82-reservations-qa.md#casos-170): 39 PASS, 3 FAIL, 17 BLOCKED-ENVIRONMENT, 4 BLOCKED-BROWSER-LIMITATION, 7 BLOCKED-PHYSICAL.
- FAILs: feedback/recuperação após conflito (#15), data ausente no card mobile (#55), coluna de data ambígua no detalhe de Relatórios (#51).
- TV emparelhada: #279 futuro não alterou contadores; transição temporal de #278 observada às 19:10; futuro de amanhã não cruzou a janela. Estação de impressão offline.
- Dados temporários #275/#276/#277/#279 cancelados ou no-show; #278 convertida em comanda #50, paga; mesa temporária desativada; #278 entrou em preparo às 19:10, foi finalizado e o job de QA foi descartado após a estação offline exigir atenção.
- Task 22 não iniciada: aguarda correções, revalidação e gates manuais. PR segue draft e produção bloqueada.

### Checkpoint documental e janela operacional

- Commit documental af082b9ab6be6f79bbd7dd17875e2500b72b8482: Validate #2690 / run 36637418878 SUCCESS; Deploy staging run 36637414228 SUCCESS, incluindo migrations, login e deep links.
- Às 19:10 de 29/09/2026, #278 mudou de Agendados para Em preparo na Cozinha e na TV, com contadores coerentes. Finalização oficial retornou a fila de cozinha a 18 pedidos ativos; o job automático de teste foi descartado após ficar Requer atenção na estação offline.
