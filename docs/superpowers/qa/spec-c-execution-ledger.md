# Spec C — Execution Ledger

This is the canonical execution handoff for Spec C. Chat history is not the source of truth.

Before changing code in a new session, read:

1. `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`
2. `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
3. this ledger
4. the detailed plan for the active slice
5. `docs/superpowers/qa/spec-c-compatibility-facades.md`
6. the actual branch/PR/CI state on GitHub

If this ledger and GitHub disagree, inspect GitHub first and reconcile the ledger before implementation.

## Program status — 2026-09-17

| Slice | Scope | Status | Branch / PR | Detailed plan |
|---|---|---|---|---|
| C1 | Runtime central, generic HTTP/auth, architecture gate | **RELEASED — COMPLETE** | `feature/spec-c1-runtime` / PR #45 merged | `docs/superpowers/plans/2026-09-15-frontend-modularization-c1-runtime-plan.md` |
| C2 | Navigation and App composition | **MERGED — COMPLETE** | `feature/spec-c2-navigation-composition` / PR #46 merged | `docs/superpowers/plans/2026-09-16-frontend-modularization-c2-navigation-composition-plan.md` |
| C3 | Settings surface + generic policy editing engine | **MERGED — COMPLETE** | `feature/spec-c3-settings-surface` / PR #47 merged | `docs/superpowers/plans/2026-09-16-frontend-modularization-c3-settings-surface-plan.md` |
| C4 | Orders | **AUTOMATED GATES GREEN — STAGING PENDING** | `feature/spec-c4-orders` / PR #48 draft | `docs/superpowers/plans/2026-09-17-frontend-modularization-c4-orders-plan.md` |
| C5 | Table Service | NOT STARTED | — | Write after C4 merge |
| C6 | Finance + cross-domain payment workflows | NOT STARTED | — | Write after C5 merge |
| C7 | Customers | NOT STARTED | — | Write after C6 merge |
| C8 | Catalog | NOT STARTED | — | Write after C7 merge |
| C9 | Printing domain + QZ separation | NOT STARTED | — | Write after C8 merge |
| C10 | Architectural closure / facade removal / shared-CSS cleanup / final gates | NOT STARTED | — | Write after C9 merge |

The normative slice contracts remain in the rollout plan. This ledger records execution state only.

# C1 — Runtime Centralization — CLOSED

## Final Git / CI / release state

- Branch: `feature/spec-c1-runtime`
- PR: #45 — `Spec C1: centralizar runtime do frontend`
- Base SHA: `af8266549603fc2d392880c812bc1c0d608a6dbc`
- Homologated executable staging SHA: `b6e8de4bf3c64652dff7352e4ff744017cff10e5`
- Final branch HEAD before merge: `753a0d232279a1d8d59b7c2fe14f0c1675d1874d`
- Merge/master SHA: `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`
- Validate on homologated executable SHA: #1201 / run `35104869996` — **PASS**
- Manual Deploy staging on homologated executable SHA: #177 / run `35105946795` — **PASS**, `workflow_dispatch`
- Manual staging matrix: **15/15 PASS**
- QA record: `docs/superpowers/qa/spec-c1-runtime-qa.md`
- Final branch/docs validation before merge: #1204 / run `35111336425` — **PASS**
- Post-merge Validate on `master`: #1205 / run `35114139465` — **PASS**
- Production Deploy: #49 / run `35114517283` — **PASS**, `workflow_dispatch`, exact master SHA `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`
- Production smoke: **PASS**, confirmed manually by the user after release.

C1 is fully closed. It does not block C2.

## C1 delivered boundaries

C1 extracted and integrated:

- `src/app/runtime/network/useOnlineStatus.js`;
- `src/app/runtime/feedback/useFeedbackRuntime.js`;
- `src/app/runtime/data/useOperationalDataRuntime.js`;
- `src/app/runtime/session/useSessionRuntime.js`;
- generic HTTP under `src/infrastructure/api/`;
- auth/session API under `src/infrastructure/auth/`;
- permanent frontend architecture gate under `scripts/architecture/`.

Preserved contracts include:

- auth states `checking | anonymous | authenticated`;
- expiry copy `Sua sessão expirou. Entre novamente.`;
- invalid PIN copy `PIN inválido. Confira e tente novamente.`;
- global synchronization around 5 seconds;
- dedicated Cozinha `orders` synchronization around 2 seconds;
- reconnect/focus/visibility refresh behavior;
- official backend-state ownership and sync guards;
- logout/expiry cleanup semantics;
- current visual and business behavior.

The accidental automatic C1 staging trigger was removed during C1. Spec C continues to use manual `workflow_dispatch` unless an exact-branch trigger is separately approved.

Temporary bridges/facades inherited from C1 remain governed by `docs/superpowers/qa/spec-c-compatibility-facades.md` and their assigned later slices.

---

# C2 — Navigation and App Composition — CLOSED

## Final Git / CI state

- Base SHA: `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`
- Branch: `feature/spec-c2-navigation-composition`
- PR: #46 — merged
- Homologated executable SHA: `882fa7bb3a7bfd3abc3a6ba6a9c58e407da201b8`
- Final docs-only branch HEAD: `03154a883a6e96fdbfb75b58ec672ff591c80a4b`
- Merge/master SHA: `de24b2ceb807440d4c339200b44ae2ed6583b27a`
- Validate executable: #1213 / run `35139754603` — PASS
- Manual Deploy staging: #178 / run `35141467373` — PASS
- Final docs Validate: #1214 / run `35145796111` — PASS
- Post-merge master Validate: #1215 — PASS
- Manual staging QA: 0 FAIL; exact PASS/BLOCKED evidence remains in `docs/superpowers/qa/spec-c2-navigation-composition-qa.md`.
- Production changes from C2: none.

C2 is closed and no longer blocks later slices.

---

# C3 — Settings Surface and Versioned Policy Editing — CLOSED

## Final Git / CI state

- Base SHA: `de24b2ceb807440d4c339200b44ae2ed6583b27a`
- Branch: `feature/spec-c3-settings-surface`
- PR: #47 — merged
- Homologated executable SHA: `17673b66774a1b532fc22972603407dcbb932bad`
- Final branch/docs HEAD: `bc6c38eb0b81c91820108dee7a228d930832bdc9`
- Merge/master SHA: `737beeac2150aabeb39024af823f2f60fee25108`
- Manual Deploy staging: #179 / run `35176387507` — PASS
- Manual staging QA: **14 PASS / 0 FAIL / 9 BLOCKED**
- Final branch Validate: #1219 / run `35232989249` — PASS
- QA record: `docs/superpowers/qa/spec-c3-settings-surface-qa.md`
- C3 compatibility facades surviving merge: none
- Production changes from C3: none.

C3 established `src/app/surfaces/settings/` and `src/app/policy-editing/`, then merged cleanly. Its merged `master` SHA is the approved C4 base.

---

# C4 — Orders — ACTIVE / MANUAL QA CLOSED — FINAL VALIDATE PENDING

## Current Git / PR / CI state

- Base/master SHA: `737beeac2150aabeb39024af823f2f60fee25108`
- Branch: `feature/spec-c4-orders`
- PR: #48 — **draft**, open, not merged
- Last code-changing SHA: `4ec5527203f038915d45f4949f6d5b23b0eda7f0`
- Staging-homologated SHA: `f630c6a96a40384032ed607031bdc935d4ac20a7`
- Item 7 fix Validate: #1273 / run `35301870107` — **PASS** (1,689 tests / 0 failures plus full gate set)
- Staging deployment: #181 / run `35303388467` — **SUCCESS** on `f630c6a96a40384032ed607031bdc935d4ac20a7`
- Manual homologation: **19 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**
- Item 6 BLOCKED reason: safe out-of-window scheduled-queue reproduction was not possible at the homologation time under the same-day scheduling rule; observed in-window transition behavior was correct.
- Changes since staged SHA: documentation-only.
- Master reconciliation: `master` remains the approved base `737beeac2150aabeb39024af823f2f60fee25108`
- Final docs-head Validate: **PENDING**
- Production deploy: **NO**
- Task 11: **IN PROGRESS — FINAL VALIDATE PENDING**
- C5: **NOT STARTED**

## Completed task checkpoint

| Task | Boundary | Status |
|---|---|---|
| 1 | Orders public boundary + core pure rules | GREEN |
| 2 | Kitchen operations, clock, arrivals/highlight/sound lifecycle | GREEN |
| 3 | Orders lifecycle HTTP read port / runtime integration | GREEN |
| 4 | Operations + cancellation policy ownership | GREEN |
| 5 | Pure New Order draft lifecycle controller | GREEN |
| 6 | `useNewOrderDraft` + draft internals removed from App | GREEN |
| 7 | Finalize/cancel orchestration + legacy lifecycle exports retired | GREEN |
| 8 | Novo Pedido UI + creation-only components moved into Orders | GREEN |
| 9 | Cozinha + Histórico UI move | GREEN |
| 10 | Enforce final C4 boundary / legacy-owner removal | GREEN |
| 11 | Full QA, staging, homologation and merge gate | IN PROGRESS — FINAL VALIDATE PENDING |

## Current C4 ownership state

- `src/domains/orders/domain/` owns the extracted pure order rules.
- `src/domains/orders/application/` owns arrival lifecycle, New Order draft lifecycle and order lifecycle commands.
- `src/domains/orders/infrastructure/` owns order lifecycle API and the Orders-owned Settings policies.
- Novo Pedido, Cozinha and Histórico UI plus their order-only components are physically under `src/domains/orders/ui/`.
- `src/domains/orders/index.js` is the public boundary for non-Orders consumers. Task 9 also exposes `OrderDetail` publicly for the existing Receivables integration without restoring the removed legacy path.
- The Task 8 public route uses `src/domains/orders/ui/NewOrderRoute.js` so the public entry remains compatible with pure Node `node --test`; `NewOrderRoute.jsx` remains an internal UI reexport and `NewOrder.jsx` remains the actual wizard surface.
- All legacy Task 8 and Task 9 Orders-owned paths under `src/pages` / `src/components` are physically absent.
- The pure operational-history projection now lives at `src/domains/orders/domain/orderHistoryAnalysis.js`, avoiding a UI → dashboard util → Orders public-index cycle.
- Generic `LocalTableSelector`, `ClientDuplicateModal`, primitives, `PaymentBadge` and `OrderTicketPreview` remain outside Orders by design.
- The permanent architecture gate now rejects external deep imports into Orders, reintroduced C4 legacy owner files, and migrated Orders lifecycle exports in `src/api/client.js`.

## Resume gate

Do **not** begin C5. Do **not** merge C4 yet. Manual QA is closed with 0 FAIL; only the final docs-head Validate remains before the merge authorization gate.

Before merge authorization:
1. confirm the current branch HEAD and PR #48;
2. confirm the final branch-head Validate succeeds;
3. re-check that `master` still equals or has been safely reconciled from the approved C4 base;
4. preserve the homologated staging evidence #181 / run `35303388467`;
5. keep the documented item 6 BLOCKED honest; do not convert it to PASS without direct observation;
6. production remains prohibited;
7. C5 remains prohibited until C4 closes and merges.

---

# Cross-slice rules

These remain mandatory for C2-C10:

- each slice starts from the merged `master` produced by the previous approved slice;
- behavior and visual preservation are strict unless a separate approved spec changes them;
- TDD RED → GREEN for behavioral extraction/change;
- focused tests during development and full gates before homologation/merge;
- no direct functional implementation on `master`;
- manual staging before merge/release decisions;
- production only with explicit authorization after merge and validation of the new `master`;
- domains must not import internals of other domains;
- compatibility facades/bridges are temporary, tracked and removed by their target slice;
- C10 cannot close with unexplained temporary facades, prohibited imports, cycles or architecture violations.

# New-session resume protocol

The active slice is C4, Task 11 in progress at the staging gate. GitHub state wins over this file if the branch advanced after this documentation commit.

1. Read the Spec C design and rollout plan.
2. Read this ledger.
3. Read `docs/superpowers/specs/2026-09-17-frontend-modularization-c4-orders-design.md`.
4. Read `docs/superpowers/plans/2026-09-17-frontend-modularization-c4-orders-plan.md`.
5. Read `docs/superpowers/qa/spec-c-compatibility-facades.md`.
6. Inspect PR #48 and the remote HEAD of `feature/spec-c4-orders`.
7. Treat `e7f05b6d6d8364c0482a7fe03949c001816e8e85` as the Task 11 pre-QA executable identity; Validate #1262 / run `35297928408` passed.
8. Task 11 is IN PROGRESS — pre-staging QA recorded; staging/manual homologation remain pending.
9. C5 is NOT STARTED and must not begin before C4 closes and merges.
10. Do not merge C4 or deploy production without explicit user authorization.

The repository and current GitHub state are the source of truth for Spec C continuity, not any individual chat.
