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
| Printing | PENDING | — |
| Arrival conversion | PENDING | — |
| Edit reservation | PENDING | — |
| Cancel / no-show | PENDING | — |
| Kitchen queue | PENDING | — |
| Kitchen TV | PENDING | — |
| Receivables | PENDING | — |
| Reporting | PENDING | — |
| Architecture | PASS (current HEAD through Task 5) | Validate #2545 / run `36587697649` |
| Full test suite | PASS (current HEAD through Task 5) | All 8 test shards green in Validate #2545 / run `36587697649` |
| Lint | PASS (current HEAD through Task 5) | Validate #2545 / run `36587697649` |
| Build | PASS (current HEAD through Task 5) | Validate #2545 / run `36587697649` |

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
