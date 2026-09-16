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
| C2 | Navigation and App composition | **HOMOLOGATED — MERGE GATE** | `feature/spec-c2-navigation-composition` / PR #46 draft | `docs/superpowers/plans/2026-09-16-frontend-modularization-c2-navigation-composition-plan.md` |
| C3 | Settings surface + generic policy editing engine | **BLOCKED by C2 merge** | — | Write after C2 merge |
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

# C2 — Navigation and App Composition — HOMOLOGATED / MERGE GATE

## Git / PR / CI state

- Base/master SHA: `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`
- Branch: `feature/spec-c2-navigation-composition`
- PR: #46 — `Spec C2: modularizar navegação e composição do frontend` — **draft**
- Homologated executable SHA: `882fa7bb3a7bfd3abc3a6ba6a9c58e407da201b8`
- Validate application: #1213 / run `35139754603` — **PASS**
- Manual Deploy staging: #178 / run `35141467373` — **PASS**, `workflow_dispatch`, exact executable SHA
- Staging URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`
- Manual homologation: 2026-09-16 ~16:54 BRT — **0 FAIL**
- Manual matrix summary: **10 fully PASS, 4 fully BLOCKED, 1 partial PASS/BLOCKED, 0 FAIL**
- QA record: `docs/superpowers/qa/spec-c2-navigation-composition-qa.md`
- Production changes from C2: **none**
- Merge: **pending explicit user authorization**
- C3: **blocked until C2 merge and validation of resulting master**

The manually blocked scenarios remain explicitly blocked; automated tests are recorded only as complementary evidence in the QA record and do not convert manual BLOCKED results into PASS.

## C2 delivered boundaries

C2 implemented and staged:

- single declarative navigation registry and pure resolution/fallback logic under `src/app/navigation/`;
- navigation controller/query ownership and Settings navigation guard under `src/app/navigation/`;
- scoped `NavigationContext` and dedicated `app:navigate` event bridge;
- `AppShell`, `Sidebar` and `MobileNavigation` under `src/app/shell/`;
- `AreaNavigation` under `src/app/navigation/`;
- thin `AppRoot` for auth/bootstrap/offline/global feedback composition;
- direct imports from the new navigation owners;
- removal of the old navigation/query/controller compatibility facades and legacy shell/menu paths;
- final extraction contract protecting the C2 boundary.

C2 preserved the approved invariants for destination IDs, capability fallbacks, mobile `Mais`, internal area navigation, New Order return context, dirty-order and Settings guards, focus/page transition, same-session query continuity, stale-session callback invalidation, `app:navigate`, global sync and dedicated Cozinha polling signals, and desktop/mobile light/dark visuals.

No Worker, D1 schema, API contract, dependency, CSS redesign or React Router change was introduced by C2.

## C2 homologation evidence

- Functional CI on `882fa7bb3a7bfd3abc3a6ba6a9c58e407da201b8`: tests, architecture, lint, build, production/staging Worker dry-runs, local D1 and Spec B D1 gate all passed.
- Staging deploy #178 used `workflow_dispatch`, exact executable SHA and passed migrations, deploy and real staging login verification.
- Manual matrix had no FAIL. Items 3, 10, 13 and 14 were BLOCKED by staging/tooling observability constraints; item 11 was DIRTY PASS with saving/unconfirmed BLOCKED. Exact evidence and complementary automated coverage are in the QA record.
- No persistent QA data was left behind; temporary Settings/theme changes were restored/discarded.
- Production remained untouched.

## C2 merge gate

Do not start C3 and do not merge automatically.

Before merge in a new session:

1. read `docs/superpowers/qa/spec-c2-navigation-composition-qa.md`;
2. inspect PR #46 and its current head SHA;
3. verify the latest branch validation is green;
4. verify no functional commit was added after the homologated executable SHA except documented docs-only reconciliation;
5. obtain explicit user authorization for the merge;
6. merge PR #46 only after that authorization;
7. validate the resulting `master` before planning C3;
8. production still requires separate explicit authorization.

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

C2 is at the merge gate. Before any further implementation:

1. read the Spec C design;
2. read the rollout plan;
3. read this ledger;
4. read the C2 design, detailed plan and QA record;
5. read the compatibility ledger;
6. inspect PR #46, current branch head and latest CI on GitHub;
7. confirm the homologated executable SHA `882fa7bb3a7bfd3abc3a6ba6a9c58e407da201b8` and any later docs-only commit;
8. do not start C3 before explicit approval and merge of C2;
9. if merge is authorized, merge PR #46 and validate the resulting `master`;
10. production remains a separate explicit authorization gate.

The repository is the source of truth for Spec C continuity, not any individual chat.