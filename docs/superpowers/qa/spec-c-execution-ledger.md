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

## Program status — 2026-09-16

| Slice | Scope | Status | Branch / PR | Detailed plan |
|---|---|---|---|---|
| C1 | Runtime central, generic HTTP/auth, architecture gate | **RELEASED — COMPLETE** | `feature/spec-c1-runtime` / PR #45 merged | `docs/superpowers/plans/2026-09-15-frontend-modularization-c1-runtime-plan.md` |
| C2 | Navigation and App composition | **PLANNED — implementation not started** | `feature/spec-c2-navigation-composition` / no PR yet | `docs/superpowers/plans/2026-09-16-frontend-modularization-c2-navigation-composition-plan.md` |
| C3 | Settings surface + generic policy editing engine | BLOCKED by C2 | — | Write after C2 merge |
| C4 | Orders | NOT STARTED | — | Write after C3 merge |
| C5 | Table Service | NOT STARTED | — | Write after C4 merge |
| C6 | Finance + cross-domain payment workflows | NOT STARTED | — | Write after C5 merge |
| C7 | Customers | NOT STARTED | — | Write after C6 merge |
| C8 | Catalog | NOT STARTED | — | Write after C7 merge |
| C9 | Printing domain + QZ separation | NOT STARTED | — | Write after C8 merge |
| C10 | Architectural closure / facade removal / shared-CSS cleanup / final gates | NOT STARTED | — | Write after C9 merge |

The normative slice contracts remain in the rollout plan. This ledger records execution state only.

---

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

# C2 — Navigation and App Composition — ACTIVE PLANNING HANDOFF

## Git state

- Base/master SHA: `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`
- Branch: `feature/spec-c2-navigation-composition`
- PR: not opened yet
- Functional implementation: **not started**
- Production changes from C2: **none**

## Approved design

- File: `docs/superpowers/specs/2026-09-16-frontend-modularization-c2-navigation-composition-design.md`
- Design commit: `9f905423c6fbfb83a737374d50cfc4cddce1ac9e`
- Human approval: **YES**

Approved direction: balanced extraction. C2 creates explicit `app/navigation` and `app/shell` ownership, a thin `AppRoot`, a single navigation registry, a navigation-only context, and a dedicated `app:navigate` bridge without moving C3-C9 domain/workflow responsibilities.

## Detailed executable plan

- File: `docs/superpowers/plans/2026-09-16-frontend-modularization-c2-navigation-composition-plan.md`
- Initial plan commit: `bee5c58b613f2f087335a9a9ccb96c5a211fad76`
- Hardened plan commit: `51b9b382488762e98b6fdfb46a37f24ae121b19a`
- Plan status: written and self-reviewed; no functional task executed yet.

The plan has seven reviewable tasks:

1. navigation registry + pure resolution;
2. controller/query ownership + Settings navigation guard;
3. scoped `NavigationContext` + `app:navigate` bridge;
4. shell/menu/AreaNavigation ownership moves;
5. thin `AppRoot` extraction;
6. final provider integration + legacy-path removal + extraction contract;
7. full gates, draft PR, manual staging, 15-item manual QA and merge-decision handoff.

## C2 mandatory invariants

C2 must preserve:

- destination IDs, capabilities and area fallback order;
- desktop menu, mobile menu and `Mais`;
- internal navigation for Pedidos, Financeiro and Configurações;
- Novo Pedido origin/return semantics and Comandas context;
- checkout block and dirty-order discard guard;
- Settings dirty-resource guard without a new saving/unconfirmed navigation block;
- query continuity during the same session and stale-callback invalidation after reset;
- focus on `.app-content` and current mobile page-transition direction;
- current `app:navigate` compatibility behavior;
- global ~5 s sync and Cozinha ~2 s dedicated `orders` polling;
- light/dark and desktop/mobile visuals.

C2 must not introduce React Router, URL/history semantics, a new state library, domain extraction, Worker/D1/API changes, dependency updates, or broad staging triggers.

## C2 execution gate

Do not start functional code until the user chooses the execution mode after reviewing the detailed plan.

At execution start:

1. use `superpowers:using-git-worktrees` and create/use an isolated worktree for `feature/spec-c2-navigation-composition`;
2. verify branch HEAD/base and clean state;
3. run baseline tests/lint/architecture/build/local D1 as defined in the plan;
4. execute strict RED → GREEN task by task;
5. review after every task and commit small;
6. do not start C3;
7. do not merge or deploy production without the later explicit gates.

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

Before changing code for C2:

1. read the Spec C design;
2. read the rollout plan;
3. read this ledger;
4. read the C2 design and detailed plan;
5. read the compatibility ledger;
6. inspect the actual GitHub branch/PR/CI state;
7. confirm base `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210` and branch `feature/spec-c2-navigation-composition`;
8. confirm no functional implementation already exists unexpectedly;
9. choose/confirm the approved execution mode;
10. execute C2 only, then stop at its merge decision gate.

The repository is the source of truth for Spec C continuity, not any individual chat.