# Print Queue Operational UX — Execution Record

**Spec:** `docs/superpowers/specs/2026-09-20-print-queue-operational-ux-design.md`  
**Plan:** `docs/superpowers/plans/2026-09-20-print-queue-operational-ux-plan.md`  
**Branch:** `feature/print-queue-operational-ux`  
**PR:** #55 — DRAFT / OPEN  
**Base master:** `341881482389e872e6039b42395dbaee92fc81b2`  
**Production:** NO DEPLOY  
**C9 physical gate:** functional physical rows + P1–P20 = `DEFERRED-PRODUCTION`

## Preparation

- Spec approved commit: `007838e8eb5df70b55128621ec93a1c4d1180332`
- Plan self-review commit: `c97fd94cb39c6ce6af59591c66a774757bc74ece`
- Plan approval commit: `0f2e89b0964abab6e809792bf1ea1b369b6da0b4`
- Documentary execution baseline SHA: `380e3d35ec4a139bfb17d6b4f97271e9192aacff`
- Master confirmed unchanged at `341881482389e872e6039b42395dbaee92fc81b2`.
- Feature branch confirmed 0 commits behind master before implementation.
- Pre-implementation diff contained documentation only.
- Draft PR #55 created against master.
- Baseline Validate #1555 / run `35550047560`: **SUCCESS** on `380e3d35ec4a139bfb17d6b4f97271e9192aacff`.
- Baseline suite: **1,933 tests / 1,932 pass / 0 fail / 1 skipped**.
- Baseline architecture, lint, build, Worker production dry-run, Worker staging dry-run, local D1 and Spec B D1: **SUCCESS**.
- Staging: NOT DEPLOYED.
- Production: NOT DEPLOYED.

## Task ledger

| Task | State | RED | GREEN | Notes |
|---|---|---|---|---|
| 1 — Pure operational status | **COMPLETE / GREEN** | `1f79b2e8051942af82c3e925150faf0a49f208f7` | `475b81fe90316559fd97c90de381ce989df73197` | Pure domain resolver only; no UI/manager/backend/QZ changes |
| 2 — Queue semantic integration | **COMPLETE / GREEN** | `13a1d4e7069332fac16f90bffa7b19aa694f6b2f` | `872701a573fa421e5ae2db43143fa0ca820d8ff1` | Shared operational view + primary-station Queue semantics; no executor changes |
| 3 — Mobile visual hierarchy | **COMPLETE / GREEN** | `ec19a82b54310c3137a5b125b540595ccddc3fed` | `2d48030d1a9bce748766873dced5afb797281e5a` | Compact mobile header, operational tones, summary hierarchy; C10 CSS snapshot intentionally advanced |
| 4 — Contextual Settings | PENDING | — | — | |
| 5 — Regression hardening | PENDING | — | — | |
| 6 — Closure + staging QA | PENDING | — | — | |

## Task 1 evidence

### RED

- Commit: `1f79b2e8051942af82c3e925150faf0a49f208f7`
- Validate #1556 / run `35550242736`: **EXPECTED FAILURE**
- Failure was limited to the new contract test because `src/domains/printing/domain/printOperationalStatus.js` did not yet exist.
- Exact failure: `ERR_MODULE_NOT_FOUND` importing `./printOperationalStatus.js`.
- Suite: **1,934 tests / 1,932 pass / 1 fail / 1 skipped**.
- This RED proves absence of the new operational-status contract; it is not a parser/test-harness failure.

### GREEN

- Commit: `475b81fe90316559fd97c90de381ce989df73197`
- Validate #1557 / run `35550396218`: **SUCCESS**
- Suite: **1,950 tests / 1,949 pass / 0 fail / 1 skipped**.
- All 17 new operational-status tests passed.
- Architecture: **SUCCESS**
- Lint: **SUCCESS**
- Build: **SUCCESS**
- Worker production dry-run: **SUCCESS**
- Worker staging dry-run: **SUCCESS**
- Local D1 migrations: **SUCCESS**
- Spec B D1 clean install/upgrade: **SUCCESS**

The new pure resolver proves:

- a queue-only Android viewer uses the healthy Windows primary instead of its own absent QZ state;
- a secondary local station is never promoted to primary;
- a local primary is a valid fallback when the station collection is temporarily incomplete;
- explicit primary offline, QZ unavailable and printer unavailable states remain distinguishable;
- missing health/readiness maps to `verifying`, not false offline;
- an offline secondary does not degrade a healthy primary;
- local Windows startup/connecting remains `verifying`;
- explicit QZ disconnect maps to `qz_unavailable`;
- `printer_unconfigured` is emitted only after QZ is positively connected;
- queue missing and physical offline/attention map to printer unavailable;
- physical ready maps to ready.

No production UI was modified in Task 1.


## Task 2 evidence

### RED

- Final RED commit: `13a1d4e7069332fac16f90bffa7b19aa694f6b2f`
- Validate #1560 / run `35551070729`: **EXPECTED FAILURE**
- Suite: **1,954 tests / 1,949 pass / 4 fail / 1 skipped**.
- Failures proved the intended missing behavior:
  - Queue source still used local-station health instead of the shared operational projection;
  - Android queue-only still rendered the local Offline/QZ state;
  - remote-primary offline backlog copy was absent;
  - `printOperationalView.js` did not exist yet.
- The earlier view-contract-only RED was `df710dc8258335b15172cd3a4f772290d558bb2a`, Validate #1559 / run `35551068439`.

### GREEN

- Final integration SHA: `872701a573fa421e5ae2db43143fa0ca820d8ff1`
- Validate #1562 / run `35551168648`: **SUCCESS**
- Suite: **1,960 tests / 1,959 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, Worker production/staging dry-runs, local D1 and Spec B D1: **SUCCESS**.
- Verified:
  - Queue derives status from the primary station;
  - Android local QZ absence no longer declares the business offline;
  - operational copy is centralized in `printOperationalView.js`;
  - `Cozinha PC` hardcoded was removed from Queue;
  - the old local `getPrintStationSummary` projection was removed rather than retained as a facade;
  - the old `!physicalReady && summary.pending > 0` banner was removed;
  - remote primary offline + backlog now explains the actual operational impact;
  - recovery, job actions, filters and history semantics remained unchanged.

## Task 3 evidence

### RED

- Commit: `ec19a82b54310c3137a5b125b540595ccddc3fed`
- Validate #1563 / run `35551349276`: **EXPECTED FAILURE**
- Suite: **1,961 tests / 1,959 pass / 1 fail / 1 skipped**.
- The unique failing test required the new queue-scoped mobile hierarchy:
  - compact settings affordance;
  - semantic operational-card tones;
  - zero/value/attention summary states;
  - number-first summary hierarchy;
  - 2×2 mobile grid;
  - removal of obsolete station/offline CSS.

### GREEN implementation and C10 snapshot alignment

- UI/CSS implementation commit: `7ce4504ac2b713b87d519cf79f29f61bc5bfc4b3`.
- Validate #1564 / run `35551455133`: Task 3 behavior test **passed**, but the full suite found one expected post-C10 maintenance blocker:
  - `c10CssOwnership.test.js` still pinned the pre-improvement byte hash for `print-queue.css`.
  - Suite at that checkpoint: **1,961 tests / 1,959 pass / 1 fail / 1 skipped**.
- The CSS ownership test was not bypassed. Its approved byte snapshot was advanced only for the intentionally changed Printing-owned stylesheet, and the test description was clarified.
- Final Task 3 SHA: `2d48030d1a9bce748766873dced5afb797281e5a`.
- Validate #1565 / run `35551573542`: **SUCCESS**.
- Suite: **1,961 tests / 1,960 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, Worker production/staging dry-runs, local D1 and Spec B D1: **SUCCESS**.
- Verified:
  - mobile header is queue-scoped grid with a 40px settings button;
  - global `PageHeader` behavior was not changed;
  - operational card supports success/warning/danger/neutral semantic tokens;
  - summary numbers are visually first;
  - zero counters are neutralized;
  - positive attention is emphasized;
  - mobile summary remains 2×2;
  - obsolete station/offline CSS is gone;
  - jobs table/cards, filters, detail modal and recovery CSS remain intact.


## Guardrails

- No Worker/backend/D1/migration changes.
- No QZ transport or physical executor changes.
- No heartbeat cadence changes.
- No recovery/second-copy state-machine changes.
- No production deploy.
- No merge without explicit user authorization.
- C9/P1–P20 remains a final production hard gate.
