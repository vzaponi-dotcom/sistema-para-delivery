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

## Program status — 2026-09-18

| Slice | Scope | Status | Branch / PR | Detailed plan |
|---|---|---|---|---|
| C1 | Runtime central, generic HTTP/auth, architecture gate | **RELEASED — COMPLETE** | `feature/spec-c1-runtime` / PR #45 merged | `docs/superpowers/plans/2026-09-15-frontend-modularization-c1-runtime-plan.md` |
| C2 | Navigation and App composition | **MERGED — COMPLETE** | `feature/spec-c2-navigation-composition` / PR #46 merged | `docs/superpowers/plans/2026-09-16-frontend-modularization-c2-navigation-composition-plan.md` |
| C3 | Settings surface + generic policy editing engine | **MERGED — COMPLETE** | `feature/spec-c3-settings-surface` / PR #47 merged | `docs/superpowers/plans/2026-09-16-frontend-modularization-c3-settings-surface-plan.md` |
| C4 | Orders | **MERGED — COMPLETE** | `feature/spec-c4-orders` / PR #48 merged | `docs/superpowers/plans/2026-09-17-frontend-modularization-c4-orders-plan.md` |
| C5 | Table Service | **PLAN WRITTEN — AWAITING USER PLAN REVIEW** | `feature/spec-c5-table-service` | `docs/superpowers/plans/2026-09-18-frontend-modularization-c5-table-service-plan.md` |
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

# C4 — Orders — CLOSED

## Final Git / CI state

- Base SHA: `737beeac2150aabeb39024af823f2f60fee25108`
- Branch: `feature/spec-c4-orders`
- PR: #48 — merged
- Last code-changing SHA: `4ec5527203f038915d45f4949f6d5b23b0eda7f0`
- Staging-homologated SHA: `f630c6a96a40384032ed607031bdc935d4ac20a7`
- Staging deployment: #181 / run `35303388467` — SUCCESS
- Manual QA: **19 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**
- Final branch HEAD: `64eff8dadf3e67784477fbd848289c0fc2f9f43c`
- Final branch Validate: #1290 / run `35357003475` — SUCCESS
- Merge/master SHA: `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`
- Post-merge Validate: #1291 / run `35357630853` — SUCCESS (1,689 tests / 1,688 pass / 0 fail / 1 skipped)
- Production changes from C4: none.
- C4 surviving Orders compatibility facade: none.
- QA record: `docs/superpowers/qa/spec-c4-orders-qa.md`

C4 established `src/domains/orders/` as the Orders owner and is the approved C5 base.

---

# C5 — Table Service — PLAN WRITTEN / AWAITING USER PLAN REVIEW

## Current state

- Base/master SHA: `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`
- Branch: `feature/spec-c5-table-service`
- Design: `docs/superpowers/specs/2026-09-18-frontend-modularization-c5-table-service-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-18-frontend-modularization-c5-table-service-plan.md`
- Implementation: **NOT STARTED**
- PR: not opened as part of design drafting
- Production deploy: **NO**
- C6: **NOT STARTED**

## Plan gate

The written C5 specification was explicitly approved by the user on 2026-09-18. The detailed implementation plan has now been written with strict RED → GREEN task boundaries and is awaiting explicit user approval. Do not begin C5 implementation until that plan approval is given.

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

The active slice is C5 at the written implementation-plan review gate. GitHub state wins over this file if the branch advances after this documentation commit.

1. Read the Spec C design and rollout plan.
2. Read this execution ledger.
3. Read `docs/superpowers/specs/2026-09-18-frontend-modularization-c5-table-service-design.md`.
4. Read `docs/superpowers/qa/spec-c-compatibility-facades.md`.
5. Inspect `master` and `feature/spec-c5-table-service` on GitHub.
6. Treat `a0b4f5dac865ae54ad9bec7086139b280ffda5f4` as the approved C5 base unless GitHub proves the branch was intentionally reconciled later.
7. Read `docs/superpowers/plans/2026-09-18-frontend-modularization-c5-table-service-plan.md` and obtain explicit user approval of that plan before implementation.
8. Do not implement C5, begin C6, merge, or deploy production before the corresponding gates.

The repository and current GitHub state are the source of truth for Spec C continuity, not any individual chat.
