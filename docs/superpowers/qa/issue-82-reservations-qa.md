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
| Migration clean install | PENDING | — |
| Migration upgrade | PENDING | — |
| Reservation overlap concurrency | PENDING | — |
| Checkout | PENDING | — |
| Printing | PENDING | — |
| Arrival conversion | PENDING | — |
| Edit reservation | PENDING | — |
| Cancel / no-show | PENDING | — |
| Kitchen queue | PENDING | — |
| Kitchen TV | PENDING | — |
| Receivables | PENDING | — |
| Reporting | PENDING | — |
| Architecture | PENDING | — |
| Full test suite | PENDING | — |
| Lint | PENDING | — |
| Build | PENDING | — |

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
