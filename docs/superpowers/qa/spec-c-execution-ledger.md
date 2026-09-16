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
| C1 | Runtime central, generic HTTP/auth, architecture gate | IN PROGRESS — Tasks 1–5 GREEN | `feature/spec-c1-runtime` / PR #45 | `docs/superpowers/plans/2026-09-15-frontend-modularization-c1-runtime-plan.md` |
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
- Task 5 final executable SHA before documentation: `8212a8ee61c9f1eca2c3fe5fc74bc84c412d6166`
- Last fully green validation before this ledger update: Validate application #1175, run `35054633792`
- Production deployed from C1: **NO**
- Staging homologation for C1: **NOT STARTED**

The approved Spec C documentation was not yet merged to `master` when C1 began, so PR #45 also contains the approved design/rollout/C1 plan documents. Do not recreate or re-brainstorm them.

## Task status

| Task | Status | Evidence / next action |
|---|---|---|
| Task 1 — generic HTTP + session infrastructure | DONE | RED #1153 / GREEN #1154 |
| Task 2 — permanent architecture gate | DONE | Final GREEN #1158 |
| Task 3 — online/offline runtime | DONE + INTEGRATED | Hook GREEN #1160; wired into `App.jsx` during Task 5 integration |
| Task 4 — feedback runtime | DONE + INTEGRATED | Hook GREEN #1162; wired into `App.jsx` during Task 5 integration |
| Task 5 — operational data runtime | DONE + FULL GREEN | RED #1163; isolated runtime GREEN #1166; App integration stabilized; full GREEN #1175 |
| Task 6 — session lifecycle runtime | NOT STARTED | Next active task; start with approved RED tests |
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

Final Task 2 commit:

- `a6f56c57fec66773eb77f8c4cc9bae2ce0293f3a`

Final validation:

- Validate application #1158 — fully green

---

## Task 3 — completed and integrated

Implemented:

- `src/app/runtime/network/useOnlineStatus.js`
- `src/app/runtime/network/useOnlineStatus.test.js`

Evidence:

- RED: Validate #1159
- GREEN: Validate #1160
- `App.jsx` now consumes `useOnlineStatus()`; App-owned `online` / `offline` browser listeners were removed during Task 5 integration.
- Full integrated validation: #1175 — GREEN.

---

## Task 4 — completed and integrated

Implemented:

- `src/app/runtime/feedback/useFeedbackRuntime.js`
- `src/app/runtime/feedback/useFeedbackRuntime.test.js`

Locked behavior:

- toast dismiss: `2600 ms`
- success dismiss: `1800 ms`
- default success copy: `Ação salva com sucesso`

Evidence:

- RED: Validate #1161
- GREEN: Validate #1162
- `App.jsx` now delegates toast/success state and timers to `useFeedbackRuntime()` while preserving visible portal markup and UX.
- Full integrated validation: #1175 — GREEN.

---

## Task 5 — completed and integrated

Implemented:

- `src/app/runtime/data/useOperationalDataRuntime.js`
- `src/app/runtime/data/useOperationalDataRuntime.test.js`
- `App.jsx` integration of `useOperationalDataRuntime`, `useOnlineStatus` and `useFeedbackRuntime`

The runtime now owns:

- official collections: clients / products / orders / tables / tableTabs / movements / financeSettings;
- `bootstrapState` and `bootstrapEffectiveConfig`;
- collection sync guard;
- bootstrap and orders-only in-flight protection;
- official revision/table snapshots;
- bootstrap application and silent refresh;
- `applyOfficialEffects`;
- 5-second global synchronization;
- 2-second Cozinha order synchronization;
- focus/visibility refresh subscription mechanics;
- operational data reset.

### TDD / integration evidence

- RED contract commit: `ef3bd4921368c0dce0f648d1fe19d45fc5354809`
- RED validation: #1163 / run `35050387434` — expected module-not-found failure
- initial runtime implementation: `de3ccdda2ee93beba49a0295c385753ad9263efc`
- isolated runtime validation: #1166 / run `35051086481` — fully GREEN
- compatibility ledger commit: `6316e667cfe5b9fde5c63ecad7a43022afb323ea`
- runtime semantics refinement: `2d96b6fd0e067c145c4747b2314bab22b9062aa4`
- App integration: `bef8d2f1d850a9c8f82a9b94fcec077a3426debe`
- integration validation #1169: RED in `Test`
- root cause: structural regression tests still asserted that synchronization/feedback internals lived literally inside `App.jsx`; runtime tests themselves were green
- first regression-contract migration round: `ca31e325eeeec9d9f621e51145b590a0f9cd3329`, `8dd467a78be3a33fe959c335105e1a2708396006`, `663ea4ab7eebad498a09002fe500537623296121`, `cb2c9f034cf74d0998f341e4faf7785444872895`
- validation #1173 / run `35054295234`: only two stale structural tests remained red (`printingManagerRegression.test.js` and `successFeedbackRegression.test.js`)
- final structural-contract migration: `2eb2d223b348d809b1b9171656e6bc994c2d4018`, `8212a8ee61c9f1eca2c3fe5fc74bc84c412d6166`
- final validation #1175 / run `35054633792`: **FULL GREEN** — Test, architecture, lint, build, production/staging Worker bundles, local D1 migrations and Spec B D1 clean-install/upgrade all passed

The regression-test migration changed test ownership assertions only; it did not reintroduce App-owned runtime mechanics or change production behavior.

### Approved temporary bridges still active

- payment receipt bridge → remove in C6;
- table/comanda selection bridge → remove in C5;
- `updateCollection` escape hatch → reduce during C4-C8 and remove no later than C10.

They remain tracked in `docs/superpowers/qa/spec-c-compatibility-facades.md`.

---

## Active resume point — Task 6

Next task is **Task 6 — session lifecycle runtime**.

Create:

- `src/app/runtime/session/useSessionRuntime.js`
- `src/app/runtime/session/useSessionRuntime.test.js`

Move session check/login/logout/expiry lifecycle while preserving exactly:

- auth states: `checking | anonymous | authenticated`
- expiry copy: `Sua sessão expirou. Entre novamente.`
- invalid PIN copy: `PIN inválido. Confira e tente novamente.`

Do not begin Task 7 until Task 6 has its own RED → GREEN evidence and integrated gates.

---

## Task 7 — App runtime boundary contract

Create:

- `src/app/runtime/runtimeExtractionContract.test.js`

The contract must prove App no longer owns C1 runtime implementation while still retaining explicitly deferred domain/workflow handlers.

## Task 8 — final C1 validation and homologation

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
6. verify the current branch HEAD and latest validation against this ledger;
7. if GitHub has advanced beyond this ledger, update this ledger first;
8. continue Task 6 with the approved TDD and gate discipline.

The repository is the source of truth for Spec C continuity, not any individual chat.
