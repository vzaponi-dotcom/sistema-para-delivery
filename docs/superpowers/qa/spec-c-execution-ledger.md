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
| C5 | Table Service | **MERGED — COMPLETE** | `feature/spec-c5-table-service` / PR #49 merged at `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3` | `docs/superpowers/plans/2026-09-18-frontend-modularization-c5-table-service-plan.md` |
| C6 | Finance + cross-domain payment workflows | **DESIGN APPROVED — PLAN IN PROGRESS** | `feature/spec-c6-finance-workflows` / base `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3` | `docs/superpowers/specs/2026-09-18-frontend-modularization-c6-finance-workflows-design.md` |
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

# C5 — Table Service — IMPLEMENTATION IN PROGRESS

## Current state

- Base/master SHA: `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`
- Branch: `feature/spec-c5-table-service`
- Design: `docs/superpowers/specs/2026-09-18-frontend-modularization-c5-table-service-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-18-frontend-modularization-c5-table-service-plan.md`
- Implementation: **Tasks 1–10 COMPLETE / GREEN; Task 11 NOT STARTED**
- PR: #49 — draft
- Production deploy: **NO**
- C6: **NOT STARTED**

## Execution checkpoint — after Task 2

The written C5 specification and detailed implementation plan were explicitly approved by the user on 2026-09-18. Execution is staying in this chat; no Work Mode or Codex handoff is being used.

- Task 1 RED: `9d247b31e2ff15589eddc84d4da8b3cf96ee91aa`; Validate #1293 / run `35377843427` failed with the four expected missing Table Service modules.
- Task 1 GREEN: `e8f490808900d56c2c23d6683ed5365da4921b80`; Validate #1294 / run `35378133967` — SUCCESS (1,698 tests / 1,697 pass / 0 fail / 1 skipped).
- Task 2 authoritative RED: `de43919b3395eab52b1518b099b79b4225cb69aa`; Validate #1296 / run `35378772513` failed with the three intended failures: selection controller absent, runtime table-commit bridge still called, App selection refs still present.
- Task 2 first GREEN candidate: `ec6e8c3a12ace35745e9fa4bb70345f13235df45`; Validate #1297 / run `35379280195` exposed one payment-visual ownership ordering regression.
- Root-cause fix: `1eb0f4b51283ad2f6274720a6eaafa63156fbe00` validates current payment ownership against the official receipt table snapshot without restoring a runtime → Table Service bridge.
- Task 2 final GREEN: Validate #1298 / run `35379605815` — SUCCESS (1,702 tests / 1,701 pass / 0 fail / 1 skipped), architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green.
- The runtime `onTablesCommitted` call and App-owned `comandaSelectionRef` / `comandaIdentityRef` are removed in code. The compatibility ledger remains unchanged until the planned C5 architecture/closure evidence.
- No staging deploy and no production deploy have occurred.

Task 3 RED commit `8f460f139845e2288abe1d454d5d83c89643fb7b` was confirmed by Validate #1300 / run `35380071895` for the intended missing-controller reason. Task 3 GREEN commit `4fcfff12a3357dfbeb1587142b643a0db55702bf` passed Validate #1306 / run `35380450226` with **1,712 tests / 1,711 pass / 0 fail / 1 skipped**.

Task 4 RED commit `78d246915eed7847b3db9719e5c2e02137d996c7` was confirmed by Validate #1308 / run `35380889353` for the intended missing-`tableServiceApi.js` boundary. Task 4 GREEN commit `7ef5fc7a68292e17372bb15a9d23131c38ecfd48` passed Validate #1309 / run `35381219700` with **1,711 tests / 1,710 pass / 0 fail / 1 skipped**; architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all passed.

Task 5 RED commit `ec27b99d4528d9e0ae4af2eed5d369f04658eeaa` was confirmed by Validate #1311 for the intended missing-`useTableServiceCommands.js` boundary. GREEN candidate `aab6ca4ccb0461510a65bbb3a079808174229d4d` made all new command tests pass but Validate #1312 found one stale source-contract in `tablesNavigation.test.js`. Test-only commit `44f9b9e0f4410ae909873811fff70b2c5b80f083` aligned that characterization with the new owner; Validate #1313 / run `35382601189` passed with **1,716 tests / 1,715 pass / 0 fail / 1 skipped** and all remaining gates green. App no longer owns the table mutation handlers, and the five C5 API exports are absent from `src/api/client.js`.

Task 6 RED commit `567bc2c6f93e6769ca920e448af90a0037c57a8e` was confirmed by Validate #1315 for the intended missing public UI exports. The UI was moved in normal fast-forward commits `6afafaec1f370d78466576107f8d6123a658488e`, `10e42fee40333a69814b15d6743671fbd6135094` and `2c7fe92039e3694d676d64dc6681df79a97efc5f`. Validate #1318 then identified only stale tests reading the removed paths. Test-only commits `66007fcf2f30fece36800faf393f78125dd65dde` and `3c9fce53a594de182b7dd34948926a83cf464baa` realigned those characterizations. Validate #1320 / run `35384747211` passed with **1,716 tests / 1,715 pass / 0 fail / 1 skipped** and all remaining gates green. `Tables` and `LocalTableSelector` now have one Table Service UI owner and external consumers use the public index.

Task 7 RED commit `b785f500b677c518f1baea1f8e662468504877e6` was confirmed by Validate #1322 for the intended missing-`Comandas` public export. The new Table Service UI owners/public surface landed in `c315a0d20fda5344a4336807f44e547d8115f529`, App/integration consumers moved in `6770d3d83089194ecafe14bf5559f0be1127ef78`, and legacy owners were deleted in `d30252ec536ef9bb5945b8b98b0a03b73963316e`. An audit then found two internal imports plus moved-test loads still targeting the removed paths; `d040bf730c786af4aea815c1bcdbfb306f4e0b1e` corrected those path-only defects. Validate #1326 / run `35386530872` passed with **1,716 tests / 1,715 pass / 0 fail / 1 skipped** and architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green. `Comandas` is public through the Table Service entry; `ComandaDetail` and `TableTransferDialog` remain internal.

Task 8 RED commit `c8ed819478fc981ffd5463d976282f48f9c4b0f5` was confirmed by Validate #1328 / run `35387492807` for the intended missing app-surface file. GREEN candidate `88c3974f349aebface02ccd18f4954b069aceeea` introduced `TableServiceExternalActions`, converted `Comandas` to identity/generation intents, and made App payment capture the submitted owner. Validate #1329 found only two stale ownership characterizations; `17f72918fba548186ea8c04ad88c1293c58a987f` aligned the free-table intent and toast composition tests, leaving one string replacement that had not applied. `23963386b140c2bea90eaa80c0dc60874fcf025a` corrected that final test. Validate #1331 / run `35388385418` passed with **1,717 tests / 1,716 pass / 0 fail / 1 skipped** and architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green. Audit confirms zero payment/printing workflow tokens in Table Service production code; accepted financial reconciliation remains intentionally outside the domain.

Task 9 RED commit `1756611e7603991927b45b576637880d06f117a2` was confirmed by Validate #1334 / run `35389482528`: the new route contract failed because the dead bootstrap table-tab helper was still exported. GREEN commit `8a69d6d6b1643ae865bbf976225bbe46e237fd89` removed the helper/export, stopped App from passing `tableTabs` to `NewOrderRoute`, and updated stale/relogin integration characterizations to prove the prop remains absent while `expectedTableTabId` preserves occupied-comanda identity. Validate #1335 / run `35389776835` passed with **1,717 tests / 1,716 pass / 0 fail / 1 skipped** and architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green. Runtime `tableTabs` remains intact for payment reconciliation, and Orders still depends on Table Service only through its public index.

Task 10 RED commit `b24def5f6cbe29f2e7b0ae8b9d305980a0c44dde` was confirmed by Validate #1337 with five intended failures: missing `table-service-deep-import`, missing `table-service-orders-import`, missing legacy-owner rejection, missing C5 legacy-API rejection, and extra public exports. GREEN commit `bf871adb3c21de2cd3c6143214d12a5e825c1bda` added all permanent checker rules, `tableServiceExtractionContract.test.js`, and trimmed the public entry to `Comandas`, `LocalTableSelector`, `Tables`, `resolveOpenComanda`, `useComandaSelection` and `useTableServiceCommands`. Validate #1338 / run `35391943036` passed with **1,724 tests / 1,723 pass / 0 fail / 1 skipped** and architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green. Physical/API/import audits also passed; the runtime table-commit bridge is formally removed in C5.

Task 11 pre-staging gate used executable SHA `f0db4d8bc8c17196cd7070e4766363f9d66a8f7b`. Validate #1339 / run `35392353832` passed with **1,724 tests / 1,723 pass / 0 fail / 1 skipped**, architecture/lint/build, production+staging Worker dry-runs, local D1 and Spec B D1 all green. Manual Deploy staging #182 / run `35393748126` deployed that exact SHA, reported no pending remote staging migrations, completed staging migration application, and passed the real login smoke with HTTP 200. Manual QA then closed at **22 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**. Item 19 (capability/read-only) is BLOCKED because staging has no real restricted-capability identity; it is not promoted to manual PASS. C5 is homologated and awaits final docs-only validation plus explicit merge authorization. Production remains untouched.

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

The active slice is C6 after C5 merged successfully. GitHub state wins over this file if the branch advances after this documentation commit.

1. Read the Spec C design and rollout plan.
2. Read this execution ledger.
3. Read `docs/superpowers/specs/2026-09-18-frontend-modularization-c6-finance-workflows-design.md`; it is explicitly approved.
4. Read `docs/superpowers/qa/spec-c-compatibility-facades.md`.
5. Inspect `master` and `feature/spec-c6-finance-workflows` on GitHub.
6. Treat `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3` as the approved C6 base unless GitHub proves the branch was intentionally reconciled later.
7. C5 merged by PR #49; final branch Validate #1341 and post-merge Validate #1342 are green.
8. The next artifact is the detailed C6 implementation plan. Functional C6 implementation must not start before that plan is written and explicitly approved.
9. Do not deploy production without separate explicit user authorization.

The repository and current GitHub state are the source of truth for Spec C continuity, not any individual chat.
