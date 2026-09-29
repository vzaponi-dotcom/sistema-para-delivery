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
