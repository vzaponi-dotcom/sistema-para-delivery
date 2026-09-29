# Issue #82 — Staging QA

**Feature:** Agendamento multi-dia e reservas de mesa  
**PR:** #83  
**Status:** NOT STARTED  
**Staging SHA:** —  
**Production:** BLOCKED

No scenario is marked PASS until it is actually executed against the implementation.

## Automated / integration

| Area | Status | Evidence |
|---|---|---|
| Migration clean install | PASS | Task 1 test + Validate #2518 / run `36580925658` |
| Migration upgrade | PASS | Exact pre-0034 upgrade preserves existing order/table-tab history; Validate #2518 |
| Reservation overlap concurrency | PARTIAL | SQLite write-boundary overlap triggers PASS for insert/update and half-open intervals; true multi-request race remains for later integration tasks. |
| Checkout | PASS (through Task 5 scope) | Validate #2545 / run `36587697649`: Local reservation persists atomically without opening a comanda; overlap rollback/idempotency/HTTP effects pass. Printing timing remains Task 6. |
| Printing | PASS (automated Task 6 scope) | Validate #2564 / run `36593459366`: availability matrix, copy context, canonical scheduled docs, ESC/POS/PDF and manual document reconstruction PASS. Physical printer checks remain PENDING for staging. |
| Arrival conversion | PASS (automated Task 9 scope) | Validate #2579 / run `36597090286`: atomic conversion, guards, status preservation, retry idempotency and HTTP effects PASS. |
| Edit reservation | PASS (automated Task 10 scope) | Validate #2585 / run `36599062787`: edit cutoff, repricing, atomic replacement, conflict/revision rollback, print-job update/preservation and capabilities PASS. |
| Cancel / no-show | PASS (automated Task 8 scope) | Validate #2575 / run `36596600847`: existing order cancel coupling, reservation cancel/no-show, revision guards and auth/origin PASS. |
| Kitchen queue | PENDING | — |
| Kitchen TV | PENDING | — |
| Receivables | PENDING | — |
| Reporting | PENDING | — |
| Architecture | PASS (current code HEAD through Task 12) | Validate #2612 / run `36610498170` |
| Full test suite | PASS (current code HEAD through Task 12) | All 8 test shards + full validate green in Validate #2612 / run `36610498170` |
| Lint | PASS (current code HEAD through Task 12) | Validate #2612 / run `36610498170` |
| Build | PASS (current code HEAD through Task 12) | Validate #2612 / run `36610498170` |

## Manual staging blocks

| Block | Status | Notes |
|---|---|---|
| A — Entrega/Retirada multi-dia | PENDING | — |
| B — Reserva Local | PENDING | — |
| C — Editar reserva | PENDING | — |
| D — Impressão | PENDING | Physical checks may remain BLOCKED-PHYSICAL until printer is available |
| E — Chegada/comanda | PENDING | — |
| F — Cancelamento/no-show | PENDING | — |
| G — Financeiro/Relatórios | PENDING | — |
| H — UX desktop/mobile/themes | PENDING | — |
| I — Kitchen TV | PENDING | TV real required where applicable |

## Release gates

- [ ] Final SHA validated.
- [ ] Staging deploy successful.
- [ ] Required manual QA complete.
- [ ] Physical printing/TV blockers resolved or explicitly held before production.
- [ ] No unresolved review threads.
- [ ] Merge explicitly authorized.
- [ ] Production explicitly authorized separately.


## Automated checkpoints after Task 3

- 90-day schedule policy: PASS.
- Local schedule eligibility at validation boundary: PASS.
- São Paulo calendar-day horizon: PASS.
- Reservation repository business scope: PASS.
- Reservation list filters: PASS.
- Next reservation per table: PASS.
- Order reservation context read model: PASS.
- Table occupancy remains independent from reservation projection: PASS.
- No full reservation collection added to bootstrap: PASS by implementation contract; complete API/bootstrap coverage continues in Task 7.


## Automated checkpoints after Task 5

- Active reservation blocks table rename: PASS.
- Active reservation blocks table deactivation: PASS.
- Table reordering with reservation: PASS.
- Terminal reservation does not block table management: PASS.
- Local scheduled checkout opens no table-tab: PASS.
- Local scheduled checkout keeps occupancy unchanged: PASS.
- Reservation on currently occupied table remains independent from current tab: PASS.
- Reservation duration snapshot 120 minutes: PASS.
- Overlap conflict rollback across order/items/job/reservation: PASS.
- Reservation checkout idempotency: PASS.
- Scheduled Local + expectedTableTabId rejected: PASS.
- POST /api/orders returns reservation + updated nextReservation projection: PASS.
- Task 4 final workflow required one infrastructure-only rerun due local Wrangler port collision; rerun passed without code change.


## Automated checkpoints after Task 6

- Immediate automatic print availability: PASS.
- Same-day scheduled Entrega/Retirada stays immediately available: PASS.
- Other-day Entrega/Retirada waits for operationalStartAt: PASS.
- Same-day/future Local reservation waits for operationalStartAt: PASS.
- Reservation without table-tab uses table-context copy policy: PASS.
- Scheduled/reservation semantic metadata in canonical document: PASS.
- ESC/POS prints AGENDADO/RESERVA and requested service time: PASS.
- PDF prints AGENDADO/RESERVA and requested service time: PASS.
- Manual/reprint official document rebuild preserves schedule/reservation identity: PASS.
- Manual print lifecycle does not advance future automatic availableAt: PASS by existing printing regressions.
- Physical MPT-II/QZ verification: PENDING / staging physical QA.


## Automated checkpoints after Task 9

- Reservation list API business scope and filters: PASS.
- Reservation detail returns official order + automatic print metadata: PASS.
- Read access via existing Orders/Comandas capabilities: PASS.
- Bootstrap contains no 90-day reservation collection: PASS.
- Existing order cancellation closes active reservation atomically: PASS.
- Reservation cancel endpoint: PASS.
- Reservation no-show endpoint with official cancellation policy: PASS.
- Stale reservation revision blocks terminal mutation without partial effects: PASS.
- Pending automatic print removal on cancellation remains atomic: PASS.
- Confirm arrival opens one comanda and links the reserved order: PASS.
- Confirm arrival preserves Em preparo/Finalizado order status: PASS.
- Too-early arrival blocked: PASS.
- Occupied table arrival blocked: PASS.
- Cancelled order arrival blocked: PASS.
- Arrival retry resolves to the same converted comanda: PASS.
- nextReservation recalculates after conversion: PASS.
- Manual staging verification for Comandas UI and real multi-device interaction: PENDING (frontend tasks not implemented yet).


## Automated checkpoints after Task 12

- Reservation backend edit only before operationalStartAt: PASS.
- Reservation expectedRevision optimistic concurrency: PASS.
- Edit table/date/time/client/items/notes/adjustments: PASS.
- Repricing uses current active product catalog: PASS.
- Conflict/product/policy races roll back without partial edits: PASS.
- Pending automatic print job keeps identity/copies and updates document/availableAt: PASS.
- Discarded automatic job is not revived: PASS.
- Missing automatic job is not backfilled: PASS.
- Manual-print-history flag reaches the reservation edit workflow: PASS.
- Frontend reservation detail ignores stale/retired reads: PASS.
- Frontend reservation commands enforce existing capabilities/writesBlocked: PASS.
- Frontend 409 handling refreshes official reservation state once: PASS.
- Table Service reservation public boundary passes architecture contract: PASS.
- 90-day max date helper uses Sao Paulo business calendar: PASS.
- Entrega/Retirada multiday scheduling in current New Order wizard: PASS.
- Local Agora/Reservar schedule state: PASS.
- Local future reservation can select an occupied-now table without joining its open comanda: PASS.
- Existing-comanda Add order flow does not expose Reservar: PASS.
- Local reservation payload omits expectedTableTabId: PASS.
- Review exposes full reservation/scheduled date and time: PASS.
- Desktop/mobile staging visual verification remains PENDING; Task 14 owns the final Comandas reservation UI.
- Kitchen TV auth test fixture was stabilized after its hard-coded session timestamp crossed the real seven-day auth lifetime; no production TV code changed.


## Automated checkpoints after Task 13

- Explicit create/edit-reservation draft mode: PASS.
- Official reservation snapshot → shared New Order wizard initialization: PASS.
- Reservation edit uses PUT boundary, never POST /api/orders: PASS.
- Reservation order id/number preserved by official backend response: PASS.
- Cancel/discard edit does not invoke reservation cancellation: PASS by draft/navigation ownership.
- Existing dirty-navigation guard remains active for edit mode: PASS.
- Stale edit revision refreshes official reservation context and keeps editor open: PASS.
- Policy-change edit retains existing review/feedback flow: PASS.
- Manual print history is available before edit save: PASS.
- Manual-print warning requires explicit “Salvar mesmo assim” before mutation: PASS.
- Edit mode does not expose immediate payment: PASS.
- Shared wizard remains the single creation/edit composition: PASS.
- Create-order idempotency/effect reconciliation regressions: PASS.
- Final Task 13 code Validate #2628 / run `36614217317`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Manual staging UX for the edit flow: PENDING until Task 14 provides the reservation-detail entry point.


## Automated checkpoints after Task 14

- Comandas subtitle mentions mesas, comandas e reservas: PASS.
- Free table without reservation remains Livre/current behavior: PASS.
- Free table + nextReservation renders textual Reservada state: PASS.
- Occupied table + nextReservation keeps Ocupada primary and reservation secondary: PASS.
- Current comanda and reservation are distinct interactive targets: PASS.
- Reservation detail loads official API state: PASS.
- Reservation detail exposes mesa/client/date/time/status/items/total: PASS.
- Edit action requires create capability and pre-operational window: PASS.
- Confirm arrival blocked before scheduled business day: PASS.
- Confirm arrival uses authoritative conversion and App selects returned comanda: PASS.
- Cancel/no-show require orders.cancel: PASS.
- Cancel/no-show use configured reason/revision inputs: PASS.
- No independent “Abrir comanda” bypass exists: PASS.
- Mobile reservation list/detail/back scroll and focus restoration: PASS.
- Reserved state is text + semantic info tokens, not color-only: PASS.
- Existing Comanda payment/transfer/printing regressions: PASS.
- Theme-safe styling uses existing semantic tokens: PASS.
- Final Task 14 code Validate #2644 / run `36617341007`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Manual desktop/mobile/light/dark staging verification: PENDING until staging task.

## Automated checkpoints after Task 15

- Tomorrow/future-day schedule excluded from today's operational `scheduled` queue: PASS.
- Future waiting schedules excluded from current Kitchen counts: PASS.
- Future waiting schedules excluded from current late count: PASS.
- Same-day scheduled order remains in Agendados: PASS.
- Cross-midnight operational window enters Em preparo at `operational_start_at`: PASS.
- Local reservation follows the same operational/future split: PASS.
- Dedicated `Próximos dias` projection orders by `scheduledFor ASC`: PASS.
- `Próximos dias` shows full service date and time: PASS.
- Future order detail reuses the existing official OrderDetail flow: PASS.
- Future cancellation reuses the existing cancellation flow: PASS.
- Active Local reservation exposes Editar reserva through official reservation detail: PASS.
- Entrega/Retirada future schedules do not expose generic editing: PASS.
- Future-list search does not alter current Kitchen counters: PASS.
- Kitchen Display public queue return shape remains unchanged: PASS.
- Existing Comandas reservation-edit composition remains unchanged: PASS.
- Future-list styling uses current semantic/theme tokens without redesign: PASS.
- Final Task 15 Validate #2655 / run `36623885764`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Kitchen TV/sound/realtime end-to-end characterization remains Task 16.
- Manual staging verification remains PENDING until the staging task.

## Automated checkpoints after Task 16

- Future operational-date schedule absent from Kitchen TV cards: PASS.
- Distant Local reservation absent from Kitchen TV: PASS.
- Future operational-date schedules excluded from TV counters: PASS.
- Same-day waiting schedule may remain visible as Agendado: PASS / preserved rule.
- Transition at operationalStartAt promotes order to preparing priority: PASS.
- Arrival sound occurs once on the operational transition: PASS.
- Repeated polls do not replay the same arrival sound: PASS.
- Opening TV after transition does not replay historical sound: PASS.
- Local reservation renders as Local when operational: PASS.
- Existing Entrega/Retirada/Mesa TV modality filters preserved: PASS.
- TV exposes no future agenda / Próximos dias surface: PASS.
- TV rendering clock now follows authoritative serverNow snapshots: PASS.
- Local clock advances between polls without reverting to device wall-clock time: PASS.
- Existing paging/overflow/layout characterizations remain green: PASS.
- Final Task 16 Validate #2661 / run `36625864310`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Manual physical TV/staging verification remains PENDING until the staging/homologation tasks.

## Automated checkpoints after Task 17

- Active Local reservation with tableReservationId and null tableTabId excluded from pending receivables: PASS.
- Reservation excluded before receivable summary aggregation: PASS.
- Reservation excluded before receivables forecast aggregation: PASS.
- Reservation excluded before client/order grouping: PASS.
- Reservation identity blocks standalone payment even with malformed non-table fields: PASS.
- Converted reservation/table-tab stays outside A Receber: PASS.
- Cancelled reservation excluded: PASS.
- No-show reservation excluded: PASS.
- Legacy table-shaped order without reservation identity preserves previous behavior: PASS.
- Future unpaid Entrega remains upcoming by future orderDate: PASS.
- Future unpaid Retirada remains upcoming by future orderDate: PASS.
- Future paid-at-checkout Entrega does not remain pending: PASS.
- Forecast uses future orderDate when no payment promise overrides it: PASS.
- Existing Finance/Orders dependency boundary remains unchanged: PASS.
- Final Task 17 Validate #2667 / run `36627016287`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Manual staging finance verification remains PENDING until the staging/homologation tasks.

## Automated checkpoints after Task 18

- Future scheduled order selected/reported by future order_date rather than early created_at: PASS.
- Early payment remains on actual paid_at financial business date: PASS.
- Sales series uses order_date; received series uses paid_at: PASS.
- Local reservation remains modality Local in operation reporting: PASS.
- Local reservation remains schedule classification scheduled: PASS.
- Reservation operational duration starts at operationalStartAt, not advance-created timestamp: PASS.
- Cancelled/no-show mirror order excluded from operation analytics: PASS.
- Cancelled/no-show mirror order excluded from commercial sales population: PASS.
- Active reservation excluded from Overview/Sales receivable metrics: PASS.
- Active reservation excluded from Detail A receber filter: PASS.
- Reservation detail pending amount is zero: PASS.
- Client pending aggregate excludes reservation orders: PASS.
- Ordinary future unpaid Entrega/Retirada receivable semantics preserved: PASS.
- Type + scheduled reporting filters reconcile on future Local orders: PASS.
- Reporting repository projects authoritative reservation identity without a global reservation collection: PASS.
- Final Task 18 Validate #2677 / run `36629169321`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Manual staging reporting reconciliation remains PENDING until staging/homologation.
