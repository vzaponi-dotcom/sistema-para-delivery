# Spec C — Execution Ledger

This is the canonical execution handoff for Spec C. Chat history is not the source of truth.

Before changing code in a new session, read:

1. `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`
2. `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
3. this ledger
4. the detailed plan for the active slice
5. `docs/superpowers/qa/spec-c-compatibility-facades.md`
6. the actual branch/PR/CI state on GitHub

If this ledger and GitHub disagree, inspect the branch and update this ledger before continuing.

## Program status

| Slice | Scope | Status | Branch / PR | Detailed plan |
|---|---|---|---|---|
| C1 | Runtime central, generic HTTP/auth, architecture gate | IN PROGRESS | `feature/spec-c1-runtime` / PR #45 | `docs/superpowers/plans/2026-09-15-frontend-modularization-c1-runtime-plan.md` |
| C2 | Navigation and App composition | NOT STARTED | — | Write after C1 merge from the real new `master` |
| C3 | Settings surface + generic policy editing engine | NOT STARTED | — | Write after C2 merge |
| C4 | Orders | NOT STARTED | — | Write after C3 merge |
| C5 | Table Service | NOT STARTED | — | Write after C4 merge |
| C6 | Finance + cross-domain payment workflows | NOT STARTED | — | Write after C5 merge |
| C7 | Customers | NOT STARTED | — | Write after C6 merge |
| C8 | Catalog | NOT STARTED | — | Write after C7 merge |
| C9 | Printing domain + QZ separation | NOT STARTED | — | Write after C8 merge |
| C10 | Architectural closure / facade removal / shared-CSS cleanup / final gates | NOT STARTED | — | Write after C9 merge |

Do **not** freeze detailed C2-C10 plans in advance. Each detailed plan must use the actual post-merge tree produced by the preceding slice.

---

# C1 — Runtime Centralization

## Git / PR state

- Branch: `feature/spec-c1-runtime`
- PR: #45 — `Spec C1: centralizar runtime do frontend`
- PR state: draft, open, not merged
- Base: `master`
- C1 base SHA: `af8266549603fc2d392880c812bc1c0d608a6dbc`
- Last fully green executable SHA: `894e4b3273eb98232bb826a153a650c2dcefa567`
- Last fully green validation: Validate application #1162
- Task 5 RED commit: `ef3bd4921368c0dce0f648d1fe19d45fc5354809`
- Task 5 RED validation: Validate application #1163 — expected failure
- Production deployed from C1: **NO**
- Staging homologation for C1: **NOT STARTED**

The approved Spec C documentation was not yet merged to `master` when C1 began, so PR #45 also contains the approved design/rollout/C1 plan documents. Do not recreate or re-brainstorm them.

## Task status

| Task | Status | Evidence / next action |
|---|---|---|
| Task 1 — generic HTTP + session infrastructure | DONE | RED #1153 / GREEN #1154 |
| Task 2 — permanent architecture gate | DONE | Final GREEN #1158 |
| Task 3 — online/offline runtime | PARTIAL | Hook/test green (#1160); still wire into `App.jsx` |
| Task 4 — feedback runtime | PARTIAL | Hook/test green (#1162); still wire into `App.jsx` |
| Task 5 — operational data runtime | RED CONFIRMED | Contract tests committed; implementation module still absent; implement GREEN next |
| Task 6 — session lifecycle runtime | NOT STARTED | Start only after Task 5 GREEN/integration |
| Task 7 — App extraction contract + cleanup | NOT STARTED | Start after Task 6 |
| Task 8 — full gates + staging + manual QA | NOT STARTED | No production deploy |

---

## Task 1 — completed

Created:

- `src/infrastructure/api/httpClient.js`
- `src/infrastructure/api/httpClient.test.js`
- `src/infrastructure/auth/sessionApi.js`
- `src/infrastructure/auth/sessionApi.test.js`

`src/api/client.js` remains a temporary compatibility facade for generic/auth exports while later Spec C slices migrate consumers.

Compatibility tracking:

- `docs/superpowers/qa/spec-c-compatibility-facades.md`

Evidence:

- RED: Validate application #1153
- GREEN: Validate application #1154
- tests, lint, build, Worker dry-runs, local D1 and Spec B D1 gate passed

---

## Task 2 — completed

Created:

- `scripts/architecture/check-import-boundaries.mjs`
- `scripts/architecture/check-import-boundaries.test.mjs`
- `scripts/architecture/legacy-import-allowlist.json`

Added:

- `npm run test:architecture`

Integrated into:

- `.github/workflows/validate.yml`
- `.github/workflows/deploy-staging.yml`

Protected rules include:

- pure domain layer cannot import React / React DOM / QZ / infrastructure;
- `shared` cannot import `domains`;
- cross-domain consumers must use the target domain public `index.js`;
- direct production `qz-tray` imports are restricted to `src/infrastructure/qz/**` or an exact temporary allowlist entry.

Current production QZ allowlist contains exactly:

- `src/printing/usePrintingManager.js`

`src/printing/usePrintingManager.test.js` also imports QZ, but that is a test dependency. A RED test was added and the checker was corrected so the `qz-direct` production rule ignores test/spec files without expanding the production allowlist.

Final Task 2 commit:

- `a6f56c57fec66773eb77f8c4cc9bae2ce0293f3a`

Final validation:

- Validate application #1158 — fully green

---

## Task 3 — runtime module implemented, App integration pending

Implemented and green:

- `src/app/runtime/network/useOnlineStatus.js`
- `src/app/runtime/network/useOnlineStatus.test.js`

Commit:

- `f181261179a6ab1b846f8fdef839c1797a35ab64`

Evidence:

- RED: Validate #1159
- GREEN: Validate #1160

Still pending in `App.jsx`:

- replace App-owned `isOnline` state with `useOnlineStatus()`;
- remove inline `online` / `offline` browser listeners;
- preserve all existing write-blocking behavior exactly.

---

## Task 4 — runtime module implemented, App integration pending

Implemented and green:

- `src/app/runtime/feedback/useFeedbackRuntime.js`
- `src/app/runtime/feedback/useFeedbackRuntime.test.js`

Locked behavior:

- toast dismiss: `2600 ms`
- success dismiss: `1800 ms`
- default success copy: `Ação salva com sucesso`

Evidence:

- RED: Validate #1161
- GREEN: Validate #1162

Still pending in `App.jsx`:

- replace App-owned toast/success state and timer implementation with `useFeedbackRuntime()`;
- keep visible portal markup and UX unchanged.

---

## Task 5 — exact resume point

A RED test commit **does exist** and is now part of the branch:

- commit: `ef3bd4921368c0dce0f648d1fe19d45fc5354809`
- message: `test: define operational data runtime contract`
- file added: `src/app/runtime/data/useOperationalDataRuntime.test.js`
- Validate application #1163: failed in the test step as expected
- `src/app/runtime/data/useOperationalDataRuntime.js` does not exist yet

Therefore the next action is **not** to rewrite the RED tests from scratch. First inspect them against the approved C1 plan, confirm the failure is still the expected missing implementation, then implement the GREEN runtime.

The RED test imports and expects:

- `GLOBAL_SYNC_INTERVAL_MS`
- `ORDER_SYNC_INTERVAL_MS`
- `createRefreshSubscription`
- `useOperationalDataRuntime`

from:

- `src/app/runtime/data/useOperationalDataRuntime.js`

### Task 5 runtime scope

Extract, without semantic simplification:

- official collections: clients / products / orders / tables / tableTabs / movements / financeSettings;
- `bootstrapState`;
- `bootstrapEffectiveConfig`;
- collection sync guard;
- bootstrap in-flight protection;
- orders-only in-flight protection;
- official revision tracking;
- official table snapshot;
- bootstrap application;
- `applyOfficialEffects`;
- global bootstrap refresh;
- orders-only refresh;
- operational data reset;
- polling/subscription mechanics.

Locked timing invariants:

- global sync: `5000 ms`
- Cozinha-only order sync: `2000 ms`

Do not alter those values in C1.

The RED contract must continue covering at minimum:

1. immediate polling run;
2. interval run;
3. hidden-document suppression;
4. visible transition refresh;
5. focus refresh;
6. unsubscribe cleanup;
7. bootstrap populates all official collections;
8. stale bootstrap cannot overwrite a newer mutation;
9. payment owner snapshot is captured at read start and that same snapshot is settled;
10. table commit bridge updates official table snapshot;
11. orders-only refresh does not alter unrelated collections;
12. reset clears operational data, replaces the sync guard, and resets official revision.

### Approved temporary bridges

- payment receipt bridge → remove in C6;
- table/comanda selection bridge → remove in C5;
- `updateCollection` escape hatch → reduce during C4-C8 and remove no later than C10.

Every bridge introduced in Task 5 must be recorded in:

- `docs/superpowers/qa/spec-c-compatibility-facades.md`

in the same implementation round.

---

## App.jsx integration constraint

`src/App.jsx` is large (~89 KB) and GitHub Contents API updates replace the entire file. Tasks 3 and 4 were deliberately proven in isolation before integration.

During Task 5 App integration, integrate these runtime contracts together in one carefully reviewed App change where practical:

- `useOnlineStatus()`
- `useFeedbackRuntime()`
- `useOperationalDataRuntime()`

Preserve everything outside C1 in behavior and presentation.

Do not migrate/redesign in C1:

- payment workflows;
- comanda workflows;
- customer/product/order/table/finance domain CRUD handlers;
- printing workflows;
- navigation architecture beyond preservation needs;
- CSS/layout/copy;
- React Router;
- Redux/Zustand;
- WebSocket/SSE;
- Worker/backend architecture.

---

## After Task 5

### Task 6 — session lifecycle runtime

Create:

- `src/app/runtime/session/useSessionRuntime.js`
- `src/app/runtime/session/useSessionRuntime.test.js`

Move session check/login/logout/expiry lifecycle while preserving exactly:

- auth states: `checking | anonymous | authenticated`
- expiry copy: `Sua sessão expirou. Entre novamente.`
- invalid PIN copy: `PIN inválido. Confira e tente novamente.`

### Task 7 — App runtime boundary contract

Create:

- `src/app/runtime/runtimeExtractionContract.test.js`

The contract must prove App no longer owns C1 runtime implementation while still retaining explicitly deferred domain/workflow handlers.

### Task 8 — final C1 validation and homologation

Run:

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
```

Then:

1. review the actual C1 diff against the base/master;
2. require Validate application success;
3. manually run Deploy staging for `feature/spec-c1-runtime`;
4. require staging workflow success;
5. execute the approved 15-item manual C1 matrix;
6. create `docs/superpowers/qa/spec-c1-runtime-qa.md` only from real evidence;
7. keep production untouched until separately authorized.

---

# Cross-slice rules

These remain mandatory for C1-C10:

- one architectural Spec C, multiple independently homologable slices;
- every new slice starts from the merged `master` produced by the previous slice;
- strict behavior **and** visual preservation unless a separate approved spec changes behavior;
- TDD RED → GREEN for behavioral extraction/change;
- focused tests during development, full gates before homologation/merge;
- no direct implementation work on `master`;
- staging before merge/release decisions;
- production only with explicit authorization;
- domains do not import internals of other domains;
- compatibility facades/bridges are temporary, tracked and removed by their target slice;
- C10 cannot close with unexplained temporary facades, prohibited imports, cycles or architecture violations.

# New-session resume protocol

Before changing code:

1. read the Spec C design;
2. read the rollout plan;
3. read this ledger;
4. read the detailed plan for the active slice;
5. inspect PR #45 / branch `feature/spec-c1-runtime` and current CI;
6. verify the branch still contains the Task 5 RED commit and no newer implementation commit;
7. if GitHub has advanced beyond this ledger, update this ledger first;
8. continue the active task with the existing TDD and gate discipline.

The repository is the source of truth for Spec C continuity, not any individual chat.
