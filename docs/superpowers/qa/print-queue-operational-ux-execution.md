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
| 4 — Contextual Settings | **COMPLETE / GREEN** | `2a802691b476e931e5ccbbff4576c593fd53867c` | `dd9742c780f191ab1cbd1757ec964ba66b736433` | Queue-only shows business status; QZ keeps local physical controls; same resolver/view reused |
| 5 — Regression hardening | **COMPLETE / GREEN** | n/a — existing behavior already implemented | `309fe9134d4dee499835782ef5e60afcfc974e90` | Test-only hardening commit; no production code changes required |
| 6 — Closure + staging QA | **ACTIVE / BLOCKED ON STAGING DISPATCH + MANUAL QA** | — | — | Candidate branch prepared at exact Task 5 SHA |

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



## Task 4 evidence

### RED

- Commit: `2a802691b476e931e5ccbbff4576c593fd53867c`
- Validate #1567 / run `35552641571`: **EXPECTED FAILURE**
- Suite: **1,964 tests / 1,960 pass / 3 fail / 1 skipped**.
- The three failing tests proved the intended missing behavior:
  - queue-only Settings still rendered the old local-printer framing instead of **Impressão do negócio**;
  - QZ Settings still rendered the old title instead of **Impressão nesta estação**;
  - Settings did not yet consume `derivePrintOperationalStatus` + `buildPrintOperationalView`.

### GREEN implementation

- Main implementation commit: `369e4d30c8a2ddd3f3486a68bdfb5fb36c9926d2`.
- Validate #1568 / run `35552801112`: all new Task 4 tests passed, but the full suite found one existing QZ UI contract expecting the text **QZ Tray** to remain explicit on Windows.
- That was treated as a real compatibility expectation, not removed from the test. The QZ card description was refined to keep the QZ Tray context visible.
- Final Task 4 SHA: `dd9742c780f191ab1cbd1757ec964ba66b736433`.
- Validate #1569 / run `35552937534`: **SUCCESS**.
- Suite: **1,964 tests / 1,963 pass / 0 fail / 1 skipped**.
- Architecture: **SUCCESS**
- Lint: **SUCCESS**
- Build: **SUCCESS**
- Worker production dry-run: **SUCCESS**
- Worker staging dry-run: **SUCCESS**
- Local D1 migrations: **SUCCESS**
- Spec B D1 clean install/upgrade: **SUCCESS**

Verified:

- queue-only devices render **Impressão do negócio**;
- queue-only devices reuse the primary-station operational status already used by Print Queue;
- healthy remote primary renders **Impressão disponível** and identifies the responsible station;
- queue-only devices no longer present local printer configuration, Testar impressão or Trocar impressora;
- queue-only copy explicitly states that the station follows the central queue and does not perform physical printing;
- QZ/Windows renders **Impressão nesta estação**;
- QZ/Windows keeps configured printer identity, **Testar impressão**, **Trocar impressora**, printer discovery/save flow and explicit QZ Tray context;
- policy and station save boundaries remain independent;
- no change was made to `printingSettingsAdapter.js`, manager APIs, QZ transport, Worker, D1 or printing execution state machines;
- Settings and Queue now share one operational state tree and one semantic view mapping.



## Task 5 evidence

- Hardening commit: `309fe9134d4dee499835782ef5e60afcfc974e90`
- This task required **tests only**; no production code change was necessary because Tasks 1–4 already satisfied the edge-state contract.
- Validate #1571 / run `35553485328`: **SUCCESS**
- Suite: **1,970 tests / 1,969 pass / 0 fail / 1 skipped**.
- Architecture: **SUCCESS**
- Lint: **SUCCESS**
- Build: **SUCCESS**
- Worker production dry-run: **SUCCESS**
- Worker staging dry-run: **SUCCESS**
- Local D1 migrations: **SUCCESS**
- Spec B D1 clean install/upgrade: **SUCCESS**

Hardening coverage explicitly confirms:

- no-primary vs offline distinction;
- missing/stale readiness remains `verifying`;
- QZ unavailable, printer unavailable and printer attention remain distinct;
- local startup does not flash a false unconfigured state;
- secondary station health cannot degrade a healthy primary;
- backlog affects urgency/helper without changing the canonical operational code;
- recovery controls remain wired;
- offline mutation guard remains present;
- execute/discard capability guards remain present;
- `Impresso` and `Descartado` history filters remain present;
- settings shortcut remains an accessible real button;
- operational state always has textual meaning, not color-only semantics;
- Queue and contextual Settings do not leak literal `undefined` / `null` copy.

## Task 6 pre-staging checkpoint

- Exact runtime/test candidate SHA: `309fe9134d4dee499835782ef5e60afcfc974e90`.
- Candidate branch: `staging/print-queue-operational-ux` → exact SHA above.
- Feature branch was 0 commits behind master before staging preparation.
- Changed-file review confirms **no Worker/backend/D1/migration/workflow production-behavior changes**.
- No compatibility facade or migration allowlist introduced.
- Pre-staging Validate #1571 is fully GREEN.
- Production deploy: **NOT EXECUTED**.
- Production migrations: **NOT EXECUTED**.
- Staging deploy #191 / run `35553828854`: **SUCCESS** on exact runtime SHA `309fe9134d4dee499835782ef5e60afcfc974e90`.
- Staging Worker Version ID: `ae6f6646-015b-415c-a3e9-e450a2a39f84`.
- Staging D1 migrations: **NO MIGRATIONS TO APPLY**.
- Staging readiness: **READY on attempt 1/6**.
- Staging login smoke check: **HTTP 200**.
- Staging suite during deploy: **1,970 tests / 1,969 pass / 0 fail / 1 skipped**.
- Manual staging QA: **PENDING USER HOMOLOGATION**.
- C9 physical functional rows + P1–P20 remain `DEFERRED-PRODUCTION` and are not satisfied by this slice.


## Guardrails

- No Worker/backend/D1/migration changes.
- No QZ transport or physical executor changes.
- No heartbeat cadence changes.
- No recovery/second-copy state-machine changes.
- No production deploy.
- No merge without explicit user authorization.
- C9/P1–P20 remains a final production hard gate.


## Task 6 staging deployment evidence

- Workflow: **Deploy staging #191**
- Run: `35553828854`
- Branch: `staging/print-queue-operational-ux`
- Runtime SHA: `309fe9134d4dee499835782ef5e60afcfc974e90`
- Result: **SUCCESS**
- Tests: **1,970 / 1,969 pass / 0 fail / 1 skipped**
- Architecture: **SUCCESS**
- Lint: **SUCCESS**
- Build: **SUCCESS**
- Local D1: **SUCCESS**
- Staging Worker dry-run: **SUCCESS**
- Remote staging migrations: **none pending**
- Deploy: **SUCCESS**
- Worker Version ID: `ae6f6646-015b-415c-a3e9-e450a2a39f84`
- Readiness check: **attempt 1/6**
- Staging login: **HTTP 200**
- Production deploy/migrations: **NOT EXECUTED**

Manual QA remains the only open part of Task 6 before final documentary closure + final Validate.



## Manual staging QA — round 1 findings

Validated against Deploy staging #191 / runtime SHA `309fe9134d4dee499835782ef5e60afcfc974e90`.

### PASS

- Mobile/responsive header uses compact settings gear.
- Legacy `Cozinha PC / PC Victor / Offline / QZ desconectado / Fila indisponível` block is gone from Queue.
- Search, filters and jobs remain usable without horizontal overflow.
- Settings gear routes to the existing Printing Settings page.
- Summary visual hierarchy and attention emphasis are present.

### Findings requiring correction

1. **Status flicker on Windows primary** — FAIL
   - UI alternated briefly between `QZ Tray desconectado na estação principal` and `Verificando impressão`.
   - Reproduced in both Queue and Printing Settings because both correctly share the same operational state.
   - Root cause: the 5-second background state sync exposed transient `printerState = connecting` on every failed QZ reconnect attempt.
   - Fix: restore the saved local printer identity before QZ reconnect and do not expose `connecting` during recurring retries for a configured printer. A real successful reconnect may enter verifying while resolving readiness.

2. **Aguardando 2ª via missing explicit zero** — FAIL
   - Backend summary contract returns `awaitingSecondCopy`.
   - Queue UI canonical summary uses `waitingSecondCopy`.
   - Directly assigning the server summary left the UI counter undefined.
   - Fix: normalize the server summary at the UI boundary and explicitly map `awaitingSecondCopy -> waitingSecondCopy`.

3. **Queue-only Settings check was performed on Windows, not Android** — NOT A FAILURE
   - Screenshot showed `Plataforma: Windows` and `Principal`.
   - For Windows, **Impressão nesta estação**, Testar impressão and Trocar impressora are the expected behavior.
   - The **Impressão do negócio** / no physical controls acceptance row remains pending on a real Android / queue-only station.

### TDD correction evidence

- RED: `483e780ab7fd08505705c176c94476ffb65a3519`
- Validate #1574 / run `35554880250`: **EXPECTED FAILURE**
- Suite: **1,973 tests / 1,969 pass / 3 fail / 1 skipped**
- Failing regressions:
  - configured disconnected QZ retry was not stable;
  - server `awaitingSecondCopy` did not render explicit 0;
  - `normalizePrintQueueSummary` contract did not exist.

- GREEN: `ff2bf230c6cabdf5fa59c2a265cd1ccd9a3fb41e`
- Validate #1575 / run `35555014653`: **SUCCESS**
- Suite: **1,973 tests / 1,972 pass / 0 fail / 1 skipped**
- Architecture, lint, build, Worker production/staging dry-runs, local D1 and Spec B D1: **SUCCESS**.

### Re-deploy candidate

- `staging/print-queue-operational-ux` advanced to exact GREEN SHA `ff2bf230c6cabdf5fa59c2a265cd1ccd9a3fb41e`.
- Staging re-deploy: **PENDING workflow_dispatch**.
- Production: **NOT TOUCHED**.



## Staging re-deploy after QA fixes

- Deploy staging **#192** / run `35555410207`: **SUCCESS**
- Branch: `staging/print-queue-operational-ux`
- Runtime SHA: `ff2bf230c6cabdf5fa59c2a265cd1ccd9a3fb41e`
- Suite during deploy: **1,973 tests / 1,972 pass / 0 fail / 1 skipped**
- Remote staging migrations: **none pending**
- Worker Version ID: `5c729caa-b2fd-4971-9f3a-f0994f9ce9c2`
- Readiness: **attempt 1/6**
- Staging login smoke: **HTTP 200**
- Re-QA pending for:
  - stable QZ-disconnected message across repeated 5-second state polls;
  - explicit `0` in Aguardando 2ª via;
  - real Android / queue-only contextual Settings behavior.

