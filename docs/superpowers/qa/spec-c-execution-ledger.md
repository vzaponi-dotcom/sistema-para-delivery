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
| C1 | Runtime central, generic HTTP/auth, architecture gate | HOMOLOGATED — Tasks 1–8 COMPLETE; awaiting explicit merge approval | `feature/spec-c1-runtime` / PR #45 | `docs/superpowers/plans/2026-09-15-frontend-modularization-c1-runtime-plan.md` |
| C2 | Navigation and App composition | NOT STARTED | — | Write only after C1 merge from the real new `master` |
| C3 | Settings surface + generic policy editing engine | NOT STARTED | — | Write after C2 merge |
| C4 | Orders | NOT STARTED | — | Write after C3 merge |
| C5 | Table Service | NOT STARTED | — | Write after C4 merge |
| C6 | Finance + cross-domain payment workflows | NOT STARTED | — | Write after C5 merge |
| C7 | Customers | NOT STARTED | — | Write after C6 merge |
| C8 | Catalog | NOT STARTED | — | Write after C7 merge |
| C9 | Printing domain + QZ separation | NOT STARTED | — | Write after C8 merge |
| C10 | Architectural closure / facade removal / shared-CSS cleanup / final gates | NOT STARTED | — | Write after C9 merge |

Do **not** start C2 before C1 is explicitly approved and merged to `master`. Do **not** freeze detailed C2-C10 plans in advance.

---

# C1 — Runtime Centralization

## Git / PR state

- Branch: `feature/spec-c1-runtime`
- PR: #45 — `Spec C1: centralizar runtime do frontend`
- PR state at homologation: draft, open, not merged
- Base: `master`
- C1 base SHA: `af8266549603fc2d392880c812bc1c0d608a6dbc`
- Homologated final HEAD: `b6e8de4bf3c64652dff7352e4ff744017cff10e5`
- Validate application #1201 / run `35104869996`: **GREEN** on the homologated HEAD
- Deploy staging #177 / run `35105946795`: **GREEN**, event `workflow_dispatch`, on the exact homologated HEAD
- Staging URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`
- Manual 15-item C1 homologation: **15/15 PASS** on 2026-09-16
- QA evidence: `docs/superpowers/qa/spec-c1-runtime-qa.md`
- Production deployed from C1: **NO**

### Rollout-trigger reconciliation — 2026-09-16

Commit `87644cba4e9b3255b92bdcff851cc7a84c17ce8e` temporarily added `feature/spec-c1-runtime` to the automatic `push` trigger of `.github/workflows/deploy-staging.yml`. That contradicted the approved Spec C rollout, which requires manual `workflow_dispatch` for Spec C unless a separate exact-branch trigger is explicitly approved.

This was corrected on the C1 branch by commit `d8b105e55fa42da476c6b2e79f73ce584a815a5c` (`fix: restore manual c1 staging dispatch`). The existing Spec B automatic branch trigger remains intact; Spec C again uses manual dispatch only.

The final manual staging deploy was then run against `b6e8de4bf3c64652dff7352e4ff744017cff10e5` and passed as Deploy staging #177 / run `35105946795`.

## Task status

| Task | Status | Evidence / next action |
|---|---|---|
| Task 1 — generic HTTP + session infrastructure | DONE | RED #1153 / GREEN #1154 |
| Task 2 — permanent architecture gate | DONE | Final GREEN #1158 |
| Task 3 — online/offline runtime | DONE + INTEGRATED | Hook GREEN #1160; integrated in `App.jsx` |
| Task 4 — feedback runtime | DONE + INTEGRATED | Hook GREEN #1162; integrated in `App.jsx` |
| Task 5 — operational data runtime | DONE + FULL GREEN | RED #1163; isolated GREEN #1166; integrated FULL GREEN #1175 |
| Task 6 — session lifecycle runtime | DONE + INTEGRATED | session runtime/tests present; auth copies and cleanup/reset ordering locked by tests |
| Task 7 — App extraction contract + cleanup | DONE + FULL GREEN | `runtimeExtractionContract.test.js`; runtime boundary completed; Validate #1201 green on homologated final HEAD |
| Task 8 — full gates + staging + manual QA | DONE + HOMOLOGATED | exact-HEAD Validate #1201 + staging #177; approved manual matrix 15/15 PASS; QA record created |

---

## Tasks 1–5 — completed baseline

Task 1 created generic HTTP/auth infrastructure while retaining `src/api/client.js` as a temporary compatibility facade.

Task 2 created the permanent architecture gate under `scripts/architecture/`, including the legacy import allowlist and `npm run test:architecture`, integrated into validation/staging workflows.

Task 3 extracted `src/app/runtime/network/useOnlineStatus.js`.

Task 4 extracted `src/app/runtime/feedback/useFeedbackRuntime.js`, preserving toast dismiss `2600 ms`, success dismiss `1800 ms`, and default success copy `Ação salva com sucesso`.

Task 5 extracted `src/app/runtime/data/useOperationalDataRuntime.js` and integrated the network/feedback/data runtimes into `App.jsx`, preserving:

- official collections and backend-source-of-truth semantics;
- bootstrap state/effective config handoff;
- sync guards and official revision/table snapshots;
- 5-second global synchronization;
- 2-second Cozinha order synchronization;
- focus/visibility refresh mechanics;
- operational data reset.

Task 5 final executable SHA before later session extraction: `8212a8ee61c9f1eca2c3fe5fc74bc84c412d6166`, Validate #1175 / run `35054633792` — **FULL GREEN**.

Approved temporary bridges remain tracked in `docs/superpowers/qa/spec-c-compatibility-facades.md`.

---

## Task 6 — completed and integrated

Implemented and integrated:

- `src/app/runtime/session/useSessionRuntime.js`
- `src/app/runtime/session/useSessionRuntime.test.js`

The extracted runtime preserves exactly:

- auth states: `checking | anonymous | authenticated`;
- expiry copy: `Sua sessão expirou. Entre novamente.`;
- invalid PIN copy: `PIN inválido. Confira e tente novamente.`;
- login/logout/session-check lifecycle ordering;
- successful-login operational reset/cleanup scope;
- session-expiry synchronization cleanup scope.

Relevant execution history includes the RED contract (`117ba1e5`), initial runtime implementation (`34031db8`), App integration/extraction (`886c8b1f`), and subsequent regression hardening through `f2633c8a`.

No new compatibility facade or cross-slice bridge was required by the session extraction.

---

## Task 7 — completed

Implemented:

- `src/app/runtime/runtimeExtractionContract.test.js`

The contract protects the C1 boundary by preventing extracted runtime concerns from drifting back into `App.jsx` while allowing explicitly deferred domain/workflow handlers to remain until their scheduled Spec C slices.

Runtime-boundary completion commit:

- `9bb7b043` — `refactor: complete c1 runtime boundary`

The homologated application state passed Validate application #1201 on SHA `b6e8de4bf3c64652dff7352e4ff744017cff10e5`.

---

## Task 8 — completed and homologated

Evidence on the exact homologated SHA `b6e8de4bf3c64652dff7352e4ff744017cff10e5`:

- full Validate application: **PASS** (#1201 / run `35104869996`);
- manual `Deploy staging`: **PASS** (#177 / run `35105946795`, event `workflow_dispatch`);
- staging workflow passed tests, architecture, lint, build, D1 checks/migrations, deploy and real login smoke test;
- approved 15-item manual staging matrix: **15/15 PASS**;
- detailed manual evidence recorded in `docs/superpowers/qa/spec-c1-runtime-qa.md`;
- production remained untouched.

One specifically observed synchronization check used DevTools Network: the dedicated `orders` polling appeared about every 2 seconds while Cozinha was active, stopped after leaving Cozinha, and other expected global/background requests continued.

C1 is therefore at the **merge decision gate**, not at a new implementation task. PR #45 must remain unmerged until explicit approval.

QA/documentation commits made after the homologated SHA are allowed without another staging deploy only when the diff is documentation-only. Before merge, prove that post-homologation changes are docs-only and require normal PR validation on the current branch HEAD.

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
5. read the compatibility ledger;
6. inspect PR #45 / branch `feature/spec-c1-runtime` and current CI;
7. verify the current branch HEAD and latest validation against this ledger;
8. while C1 remains unmerged, do not start C2;
9. verify any post-homologation commits are docs-only and CI-green;
10. merge C1 only after explicit human approval;
11. after merge, write the C2 detailed plan from the real new `master` before implementation.

The repository is the source of truth for Spec C continuity, not any individual chat.
