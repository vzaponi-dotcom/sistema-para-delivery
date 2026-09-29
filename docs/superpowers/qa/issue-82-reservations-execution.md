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
| Preparation | IN PROGRESS | Feature branch + PR created; branch Validate baseline pending |
| 1 — Migration / invariants | NOT STARTED | — |
| 2 — 90-day scheduling domain | NOT STARTED | — |
| 3 — Reservation read model | NOT STARTED | — |
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
