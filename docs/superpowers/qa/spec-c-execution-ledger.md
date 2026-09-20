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

## Program status — 2026-09-20

| Slice | Scope | Status | Branch / PR | Detailed plan |
|---|---|---|---|---|
| C1 | Runtime central, generic HTTP/auth, architecture gate | **RELEASED — COMPLETE** | `feature/spec-c1-runtime` / PR #45 merged | `docs/superpowers/plans/2026-09-15-frontend-modularization-c1-runtime-plan.md` |
| C2 | Navigation and App composition | **MERGED — COMPLETE** | `feature/spec-c2-navigation-composition` / PR #46 merged | `docs/superpowers/plans/2026-09-16-frontend-modularization-c2-navigation-composition-plan.md` |
| C3 | Settings surface + generic policy editing engine | **MERGED — COMPLETE** | `feature/spec-c3-settings-surface` / PR #47 merged | `docs/superpowers/plans/2026-09-16-frontend-modularization-c3-settings-surface-plan.md` |
| C4 | Orders | **MERGED — COMPLETE** | `feature/spec-c4-orders` / PR #48 merged | `docs/superpowers/plans/2026-09-17-frontend-modularization-c4-orders-plan.md` |
| C5 | Table Service | **MERGED — COMPLETE** | `feature/spec-c5-table-service` / PR #49 merged at `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3` | `docs/superpowers/plans/2026-09-18-frontend-modularization-c5-table-service-plan.md` |
| C6 | Finance + cross-domain payment workflows | **MERGED — COMPLETE** | `feature/spec-c6-finance-workflows` / PR #50 merged at `5b101800fe29d02dd4543e184cca9e06d659a445` | `docs/superpowers/plans/2026-09-18-frontend-modularization-c6-finance-workflows-plan.md` |
| C7 | Customers | **MERGED — COMPLETE** | `feature/spec-c7-customers` / PR #51 merged at `a7a8285ee125d90058c739f52daba6c170921adb` | design: `docs/superpowers/specs/2026-09-19-frontend-modularization-c7-customers-design.md`; plan: `docs/superpowers/plans/2026-09-19-frontend-modularization-c7-customers-plan.md` |
| C8 | Catalog | **MERGED — COMPLETE** | PR #52 merged at `91fb5581cea1616f438c13dfac28cfb38345fa59` | design: `docs/superpowers/specs/2026-09-19-frontend-modularization-c8-catalog-design.md`; plan: `docs/superpowers/plans/2026-09-19-frontend-modularization-c8-catalog-plan.md` |
| C9 | Printing domain + QZ separation | **MERGED — ARCHITECTURE COMPLETE; PHYSICAL RELEASE GATE DEFERRED TO PRE-PRODUCTION** | PR #53 merged at `2b5060c8293fec6756b286627212b740b3147e53` | design: `docs/superpowers/specs/2026-09-19-frontend-modularization-c9-printing-design.md`; plan: `docs/superpowers/plans/2026-09-19-frontend-modularization-c9-printing-plan.md` |
| C10 | Architectural closure / facade removal / shared-CSS cleanup / final gates | **DESIGN APPROVED — IMPLEMENTATION PLAN DRAFTED FOR APPROVAL; IMPLEMENTATION NOT STARTED** | `feature/spec-c10-architecture-closure` | design: `docs/superpowers/specs/2026-09-20-frontend-modularization-c10-architecture-closure-design.md`; plan: `docs/superpowers/plans/2026-09-20-frontend-modularization-c10-architecture-closure-plan.md` |

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

# C5 — Table Service — MERGED / COMPLETE

## Current state

- Base/master SHA: `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`
- Branch: `feature/spec-c5-table-service`
- Design: `docs/superpowers/specs/2026-09-18-frontend-modularization-c5-table-service-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-18-frontend-modularization-c5-table-service-plan.md`
- Implementation: **Tasks 1–11 COMPLETE / HOMOLOGATED / MERGED**
- PR: #49 — merged at `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`
- Final branch Validate: #1341 / run `35400357800` — SUCCESS
- Post-merge Validate: #1342 / run `35401628448` — SUCCESS
- Production deploy: **NO**
- C6: **ACTIVE — Task 1 COMPLETE / GREEN**

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

Task 11 pre-staging gate used executable SHA `f0db4d8bc8c17196cd7070e4766363f9d66a8f7b`. Validate #1339 / run `35392353832` passed with **1,724 tests / 1,723 pass / 0 fail / 1 skipped**, architecture/lint/build, production+staging Worker dry-runs, local D1 and Spec B D1 all green. Manual Deploy staging #182 / run `35393748126` deployed that exact SHA, reported no pending remote staging migrations, completed staging migration application, and passed the real login smoke with HTTP 200. Manual QA then closed at **22 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**. Item 19 (capability/read-only) is BLOCKED because staging has no real restricted-capability identity; it is not promoted to manual PASS. QA/ledger Validate #1340 and final branch Validate #1341 passed; PR #49 then merged to `master` at `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`, and post-merge Validate #1342 passed. C5 is **MERGED / COMPLETE**. Production remained untouched.

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

# C6 — Finance + Cross-Domain Payment Workflows — MERGED / COMPLETE

- Base: post-C5 master `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`.
- Branch: `feature/spec-c6-finance-workflows`; draft PR #50.
- Design and detailed plan: **APPROVED**.
- Task 1 RED: `9476b0b74d7c18305466eb6079314f8b24d8ae00`; Validate #1344 / run `35403401486` failed at Test for the intended missing `domains/finance` modules.
- Task 1 GREEN: `2fa0ce1e27e4992d4eb904cce6a85cbb89ea0eaf`; Validate #1345 / run `35403573350` — **SUCCESS**, **1,729 tests / 1,728 pass / 0 fail / 1 skipped**; architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green.
- Task 1 introduced the Finance public boundary plus payment-method and finance-category pure projections/policy adapters. No legacy facade was removed yet.
- Task 2 RED: `bc52cdb8b60e8c79a6390b51b5b973fbe0ee8ef4`; Validate #1349 / run `35404405552` failed for the intended missing public Settings editors and legacy owner presence.
- Task 2 GREEN candidate: `68ba38df6165171686ab91a27550b410df5ba892`; Validate #1350 exposed only stale path-based tests and the direct `.jsx` public-entry loading problem.
- Task 2 final GREEN: `1f38c21c56af2d2dda7ed292365c9685b5ce6ad5`; Validate #1351 / run `35405016988` — **SUCCESS**, **1,731 tests / 1,730 pass / 0 fail / 1 skipped**; architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green.
- PaymentSettings, FinanceCategorySettings, and paymentSettingsModel now live under `domains/finance/ui/settings`; the app-owned copies and the two app-owned finance policy adapters are absent.
- Task 3 RED: `8bfc9926e6f9718fb461e41f59ce54a351fd2f8d`; Validate #1353 / run `35405851531` failed for the intended missing `cashFlow.js` and `receivables.js` modules.
- Task 3 final GREEN: `54dcbd1ff44f2dc715a469bc60c78c458ac42318`; Validate #1354 / run `35406034390` — **SUCCESS**, **1,745 tests / 1,744 pass / 0 fail / 1 skipped**; architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green.
- Ruling: receivable projections accept Orders financial-state predicates by injection. This avoids a Finance → Orders dependency and avoids duplicating Orders lifecycle rules inside Finance; if wrong, Task 5 composition would need interface rework, but no current behavior is changed.
- Task 4 RED: `f5fe1563d871c3cb5135cb06e86be58e80f57877`; Validate #1356 / run `35407256910` failed for the intended missing `financeApi`, `useFinanceCommands`, and `FinanceWorkspace` ownership.
- Task 4 first GREEN candidate: `9974799a3440ae9bbe59ba0e80d28c9b70b5112e`; Validate #1357 failed only on stale extraction/UI/capability characterizations after the move.
- Task 4 intermediate fix: `2665e82a97207eb118497b8f3e2cf44cda5ccc39`; Validate #1358 reduced the remaining failures to two App-local capability characterizations.
- Task 4 final GREEN: `f76b223245f1a2fcaaf981694d052365e5ca9ffb`; Validate #1359 / run `35408051011` — **SUCCESS**, **1,750 tests / 1,749 pass / 0 fail / 1 skipped**; architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green.
- Finance UI, MovementDialog, OpeningBalanceDialog, Finance API and finance commands now belong to `domains/finance`; App no longer owns movement/opening-balance state or finance CRUD handlers. Refund coordination remains outside Finance and is still scheduled for Task 8.
- Task 5 RED: `d26a537cb8d5487a23aa48430e816feadf49cbfb`; Validate #1361 / run `35409142816` failed for the intended missing `ReceivablesSurface`, `useOrderPaymentPromise`, and `ordersApi.updatePaymentPromise` contracts.
- Task 5 GREEN candidate: `675b66c2746681421b15dfa8bab9383aa7f4d2f6`; Validate #1362 found stale shared-test paths to `src/pages/Receivables.jsx` plus two assertion mismatches after the ownership move.
- Task 5 final GREEN: `895690be64baa8284b0e5b31dda1969f1f9dadb5`; Validate #1363 / run `35409732928` — **SUCCESS**, **1,755 tests / 1,754 pass / 0 fail / 1 skipped**; architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green.
- A Receber and its finance-exclusive dialogs/details now belong to Finance; payment-promise mutation/command belongs to Orders; `ReceivablesSurface` composes the two. Finance has zero Orders imports and App no longer owns `handleUpdatePaymentPromise`.
- Task 6 RED: `6fba4beac9686a0ecf0053b04a76a56aaeb92581`; Validate #1365 / run `35410717018` failed for the intended missing `paymentApi.js` and `useOrderPaymentWorkflow.js` modules.
- Task 6 GREEN candidate: `bab27fc3d33ffede2be2ab96a91ec94441b7c6e9`; the new workflow/API tests were green and Validate #1366 found only four stale modal/SystemSelect source characterizations.
- Task 6 final GREEN: `c2ece77fe403f72f88c42af9fb060fe1352d5fe3`; Validate #1367 / run `35411096051` — **SUCCESS**, **1,762 tests / 1,761 pass / 0 fail / 1 skipped**; architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green.
- Standalone order payment now belongs to `app/workflows/payments/order`; `App.jsx` has no `paymentTarget`, `paymentDialogRef`, `paymentAttemptRef`, `paymentSequenceRef`, `openPaymentModal`, `closePaymentModal` or `handleRegisterPayment`. Order payment API uses the new app workflow adapter. Table-tab payment and the runtime payment-receipt bridge remain untouched for Task 7.
- Task 7 RED: `de0d4532238d446147c3dffde54680ea24fd764d`; Validate #1369 / run `35412249051` failed for the intended missing `tableTabPaymentReconciliation.js` / `useTableTabPaymentWorkflow.js` modules and because runtime payment `legacyBridges` still existed.
- Task 7 GREEN candidate: `fd240fc85c871cd67b2e47952fb90dcbaf7a2db3`; it physically removed the runtime bridge and App-owned table-tab payment owners, moved the dialog, and added owner-based two-read reconciliation. Validate #1370 exposed two revision-race test setup mistakes plus stale path/source characterizations.
- Task 7 test alignment: `3bd62597baabc147d925ba7f0ab42248bb7ea704`; Validate #1371 was externally interrupted twice while `comandasAppWiring.test.js` was running, with no new assertion failure before shutdown.
- Task 7 final GREEN: `c7e2fcbc32c387eb7e52765014d00241102f19b7`; Validate #1372 / run `35413040640` — **SUCCESS**, **1,773 tests / 1,772 pass / 0 fail / 1 skipped**; architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green.
- Runtime audit: `useOperationalDataRuntime.js` has no `legacyBridges`, `capturePaymentOwners` or `settlePaymentOwners`; App has no `tableTabPaymentRef`, `paymentSyncRef`, `tableTabSync`, `publishPaymentSync`, `settleAcceptedPayment`, `reconcileTableTabPayment` or `handleRegisterTableTabPayment`. The new workflow owns accepted obligations, mandatory two-read reconciliation and explicit retry without a second payment POST.
- Task 8 final GREEN: RED `cdbb857918254f6010619b69553d53af22e6577f`; Validate #1374 / run `35414009138` failed at Test with the intended `ERR_MODULE_NOT_FOUND` for `refundApi.js` and `useRefundWorkflow.js`. GREEN `55e674fac1bcb9f275863916739dcd6b3b5d9271` was followed by stale-characterization alignment `8848bcaff0819048fdcb175d02694b80e8d4e2eb`; final Validate #1376 / run `35414468722` **SUCCESS**, **1,775 tests / 1,775 pass / 0 fail / 1 skipped**, all architecture/lint/build/Worker/D1 gates green.
- Task 8 ownership audit: `refundApi.js`, `useRefundWorkflow.js`, and `RegisterRefundDialog.jsx` belong to `src/app/workflows/refunds`; `src/components/RegisterRefundDialog.jsx` is absent; Finance emits only `onRequestRefund`; App has no `handleRegisterRefund`, `refundSubmitting`, or legacy refund API call. Official `{ order, movement }` is applied once, double confirm is blocked, and capability/offline guards remain enforced.
- C6 Tasks 1–8 are **COMPLETE / GREEN** through Task 8 final GREEN `8848bcaff0819048fdcb175d02694b80e8d4e2eb` / Validate #1376 / run `35414468722`.
- Task 9 is **COMPLETE / GREEN**: RED `841566efc06d9b31f937c0f9140dba85823d2839` / Validate #1378 / run `35415173295` failed for the intended legacy API/utility absence assertions; GREEN `279f409c5f2322d273ea3c36b1ad16136c1c9d12` / Validate #1379 / run `35415603078` **SUCCESS**, **1,760 tests / 1,760 pass / 0 fail / 0 skipped**. The eight C6 `src/api/client.js` exports and five legacy `src/utils` owners were removed, consumers migrated to Finance/Orders public contracts, and no Worker/D1 behavior changed.
- Task 10 RED: `54712144e65838b1a61e9151be48ff970f44995d`; Validate #1381 / run `35416212191` failed for the intended missing permanent C6 architecture rules.
- Task 10 GREEN candidate: `2a098d64c63d0e90d05f38e4aa51dc50dbc350f0`; full tests passed, while `test:architecture` correctly found one stale external test deep-importing Finance infrastructure.
- Task 10 final GREEN: `28dbb138a8ebfca6a20ddf68d4a3bf65e77638e9`; Validate #1383 / run `35416528098` — **SUCCESS**, **1,770 tests / 1,769 pass / 0 fail / 1 skipped**; architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green.
- Permanent C6 enforcement now rejects external Finance deep imports, Finance→Orders/Table Service imports, legacy C6 owners/API exports, cross-domain payment/refund workflow ownership under domains, and Finance/payment-workflow printing internals. The Finance public entry was reduced to actual external consumers.
- Task 11 initial pre-staging gate: executable SHA `caa7b9a7bf39f2c56526cf4b44b3e90ac1798711`; Validate #1386 / run `35417003680` — **SUCCESS**, **1,770 tests / 1,769 pass / 0 fail / 1 skipped**; architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 all green.
- Task 11 QA fix: RED `71b6a1de2c043b7f089a1566767eea362c2f0687` required a visible opening-balance entry point; GREEN `ebf9439d85115c422b3df8175b3d24429a77aed9` restored only the `Saldo inicial` action. Validate #1389 / run `35442758266` — **SUCCESS**, **1,770 tests / 1,769 pass / 0 fail / 1 skipped**.
- Task 11 initial staging: Deploy staging #183 / run `35417329071` — **SUCCESS** on `caa7b9a7...`.
- Task 11 corrected staging: Deploy staging #184 / run `35443025995` — **SUCCESS** on exact homologated SHA `ebf9439d85115c422b3df8175b3d24429a77aed9`; no pending remote staging migrations; readiness attempt 1/6; real login smoke HTTP 200; staging URL `https://sistema-para-delivery-staging.vzaponi.workers.dev`.
- Task 11 manual QA: **23 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**. The single BLOCKED item is read-only/capability behavior because staging has no suitable restricted identity/session.
- QA/docs closure commit `7c59972cd88f3b74d8e5f00b05353da5413896b7` passed Validate #1390 / run `35447678112` — **SUCCESS**.
- User merge authorization: **GRANTED 2026-09-19**.
- Final status-only exact-HEAD Validate: #1391 / run `35448041000` — **SUCCESS** on branch HEAD `d59fe0d804ec77de02fd0f34e1342e3189e35339`.
- PR #50 merged to `master` at `5b101800fe29d02dd4543e184cca9e06d659a445`.
- Post-merge `master` Validate: #1392 / run `35448223721` — **SUCCESS**.
- Production deployment: **NO**.

# C7 — Customers — STAGING HOMOLOGATED / TASK 10 MERGE GATE

- Base/master SHA: `5b101800fe29d02dd4543e184cca9e06d659a445` (C6 merge).
- Post-C6 master Validate: #1392 / run `35448223721` — **SUCCESS**.
- Branch: `feature/spec-c7-customers`.
- Dedicated design: `docs/superpowers/specs/2026-09-19-frontend-modularization-c7-customers-design.md`.
- Initial design commit: `e8d6da08495aa94231359291a95cfa3506ce80dc`.
- Formal self-review commit: `12ae8699e7b5f78b1e9a2ba7634ca588f3a9517a`.
- Design approval commit: `ba8ffe3f196332334b8d9d0c6d8a352fe7ae0248`; user approval granted 2026-09-19.
- Design status: **APPROVED**.
- Reconciled detailed plan: `docs/superpowers/plans/2026-09-19-frontend-modularization-c7-customers-plan.md`.
- Plan reconciliation commit: `8fa979de36829dc1158f32faccb74598f8451b83`.
- Formal plan self-review commit: `dd1c033c91629592bf28bc0a135c4c8d2d8dfead`.
- Plan status: **APPROVED FOR EXECUTION**; user approval granted 2026-09-19.
- Draft PR: #51 — `Spec C7: Customers domain extraction`.
- Task 1 RED: `6202678292c36deb7f76f9ed48478458af33c7cd`; Validate #1394 / run `35450264188` failed at Test for the intended missing `domains/customers/index.js` and `domain/clientDuplicates.js` boundaries (`ERR_MODULE_NOT_FOUND`).
- Task 1 GREEN: `7c3a9842be653dec619263b595cd4b54003a3bcc`; Validate #1395 / run `35450437897` — **SUCCESS**, **1,774 tests / 1,773 pass / 0 fail / 1 skipped**; architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 all green.
- Task 1 ownership result: frontend name normalization + duplicate lookup now belong to Customers; App and Orders consume them through the Customers public entry; shared client identity retains the Worker-used phone normalization/formatting primitives.
- Task 2 RED: `d83abfcd8f88ef3e620a9519b77ac52eb184a6c0`; Validate #1398 / run `35450909294` failed for the intended missing Customers API/commands, legacy ownership and missing `deletedClientId` runtime behavior.
- Task 2 GREEN candidate: `048d2c0048f6a54d4a4d2620f2ba655216573907`; Validate #1399 found only one stale source characterization requiring client deletion success feedback inside App.
- Task 2 test alignment: `7431745d6ff817b76126dc7da090b270ccf57268` moved that assertion to the new Customers command owner.
- Task 2 final GREEN: Validate #1400 / run `35451281055` — **SUCCESS**, **1,779 tests / 1,778 pass / 0 fail / 1 skipped**; architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 all green.
- Task 2 ownership result: customer CRUD API/commands belong to Customers; legacy customer API exports are absent; App uses the public command hook and no longer calls `updateCollection('clients', ...)`; runtime applies `deletedClientId` as an official effect with sync-guard protection.
- Task 3 RED: `e2f1e7c07abb935697da5c76c97ee40e56d11456`; Validate #1402 / run `35451679029` failed for the intended missing list projection/public UI/new owner plus legacy ownership still present.
- Task 3 GREEN production candidate: `3865590fea1552d28279c30b84513c770663db66`; Validate #1403 found stale test paths to `src/pages/Clients.jsx` and one over-literal source assertion.
- Task 3 test/path alignment: `f86201b4cb032d7740e9ecc080fbad3e9d40f9d3`; Validate #1404 reduced the remaining failure to one dynamically generated old Clients path.
- Task 3 final alignment: `36cbdbd325a1614fb95b2bb3b80de8f3f51589bc`; Validate #1405 / run `35452215359` — **SUCCESS**, **1,785 tests / 1,784 pass / 0 fail / 1 skipped**; architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 all green.
- Task 3 ownership result: customer list search/sort projection and Clients UI now belong to Customers; App consumes public contracts; legacy `src/pages/Clients.jsx` is absent; CSS location/cascade remain unchanged.
- Task 4 RED: `4dc6cc388c88314f036635ad9f1de49660a9421c`; Validate #1408 / run `35452912084` failed on the intended missing editor/public-modal boundaries.
- Task 4 GREEN candidate `88b9294769e3be1009439c5fe97c58dfa153fc46` exposed a real stale session-cleanup setter regression. Final fix `9ede1b45a1748a48c155162e1db99253083eb819`; Validate #1410 / run `35453407335` — **SUCCESS**, **1,792 tests / 1,791 pass / 0 fail / 1 skipped**.
- Task 4 ownership result: customer editor state/validation and duplicate modal belong to Customers; the modal is public for Orders; App no longer owns the editor/duplicate state.
- Task 5 RED: `09b75fca20173c4ecccdbab0dd04fd7b22336caf`; Validate #1411 / run `35453671174` failed only for missing `CustomersWorkspace` and App-owned list projection.
- Task 5 GREEN: `e483b95dcc69aa9c18f5ff6d15d73f7851c44e0b`; Validate #1412 / run `35453918508` — **SUCCESS**, **1,795 tests / 1,794 pass / 0 fail / 1 skipped**.
- Task 5 ownership result: `CustomersWorkspace` owns list/editor/modal/commands/filter-sort composition; App retains capability/query/runtime injection only; transient customer state resets naturally by unmount.
- Task 6 initial RED `666ea1e3f20af47dd4562454b86cac17d5a94609` exposed one invalid test characterization. Corrected RED `7c940bf2f7687cbe129a7d75d7e64a104c202278`; Validate #1415 / run `35454263216` failed on exactly 3 intended quick-create ownership gaps.
- Task 6 GREEN: `07206c58a967970def07654851a919d0ff2aa99c`; Validate #1416 / run `35454440071` — **SUCCESS**, **1,800 tests / 1,799 pass / 0 fail / 1 skipped**.
- Task 6 ownership result: quick-create mutation contract belongs to Customers; App only composes the public callback into Orders; Orders owns no Customers HTTP/internals.
- Task 7 RED `35205baeccaaced0dd1b759a34f087c2ddb3e61a` was path-aligned at `86c43cc1de46652a684a998473f53bed6c07df58`; authoritative Validate #1418 / run `35456631629` failed on exactly 7 planned architecture protections.
- Task 7 GREEN: `6402496c078ca817572e6e375beec9f4ffbe557a`; Validate #1419 / run `35456801774` — **SUCCESS**, **1,807 tests / 1,806 pass / 0 fail / 1 skipped**; no allowlist expansion.
- Task 7 architecture result: Customers deep imports, Orders↔Customers internals, legacy owners/API exports, App customer ownership, client `updateCollection`, frontend duplicate rules in shared, and domain→infrastructure imports are permanently rejected.
- Task 8 exact-head pre-staging gate and diff audit: `6402496c078ca817572e6e375beec9f4ffbe557a` / Validate #1419 — **SUCCESS**; no Worker/schema/migration/Finance/Table Service functional diff; Orders production diff is limited to Customers public-contract consumption; no CSS redesign/move; no new facade.
- Task 9 homologated SHA: `c01d90c6ea3a286a601f8efea51ec5ee28ff52d3`; Validate #1420 / run `35457535163` and Deploy staging #185 / run `35457821403` — **SUCCESS**.
- Task 9 manual QA: **29 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**; the blocked capability/read-only case has no suitable staging account and is not counted as PASS.
- QA record: `docs/superpowers/qa/spec-c7-customers-qa.md`.
- Functional implementation + staging: **Tasks 1–9 COMPLETE / C7 HOMOLOGATED**.
- Task 10: **QA/docs closure + final exact-head Validate + explicit merge authorization pending**.
- Master drift before closure: **none**; `master` remains `5b101800fe29d02dd4543e184cca9e06d659a445`.
- Approval gate: **satisfied**.
- Production deployment: **NO**.

---

# New-session resume protocol

The active slice is C7 after C6 merged successfully. GitHub state wins over this file if the branch advances after this documentation commit. C7 Tasks 1–9 are complete and staging is homologated at `c01d90c6ea3a286a601f8efea51ec5ee28ff52d3`: Validate #1420 and Deploy staging #185 are green, and manual QA closed at 29 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING. Task 10 is the active merge handoff: require a green Validate on the QA/docs closure HEAD, then request explicit merge authorization. Production remains untouched.

1. Read the Spec C design and rollout plan.
2. Read this execution ledger.
3. Read `docs/superpowers/qa/spec-c-compatibility-facades.md`.
4. Inspect `master` and `feature/spec-c7-customers` on GitHub.
5. Treat `5b101800fe29d02dd4543e184cca9e06d659a445` as the approved C7 base unless GitHub proves an intentional later reconciliation.
6. C6 merged by PR #50; final branch Validate #1391 and post-merge Validate #1392 are green.
7. Read `docs/superpowers/specs/2026-09-19-frontend-modularization-c7-customers-design.md`; it is formally self-reviewed and **APPROVED**, with approval recorded at `ba8ffe3f196332334b8d9d0c6d8a352fe7ae0248`.
8. Read `docs/superpowers/plans/2026-09-19-frontend-modularization-c7-customers-plan.md` and `docs/superpowers/qa/spec-c7-customers-qa.md`; C7 is staging-homologated and Task 10 exact-head merge gate is active. Continue only from this recorded checkpoint.
9. Do not deploy production without separate explicit user authorization.

The repository and current GitHub state are the source of truth for Spec C continuity, not any individual chat.


---

# C7 — Customers — CLOSED / C8 handoff — 2026-09-19

- C7 PR #51 merged to `master` at `a7a8285ee125d90058c739f52daba6c170921adb`.
- Post-merge Validate #1429 / run `35459175985` — **SUCCESS** on the exact merge SHA.
- Production deployment: **NO**.
- C8 branch: `feature/spec-c8-catalog`; draft PR #52.
- C8 design and implementation plan: **APPROVED** explicitly by the user.
- Documentary baseline Validate #1430 / run `35461113886` — **SUCCESS** on plan HEAD `20abf94359e0e2883fc3b870c69688f8eeabc12c`.
- Task 1 RED: `11e84f3badf1ffcca0fd71bb2ccd46588017e88b`; Validate #1432 / run `35461496338` — **FAIL as intended**, **1,818 tests / 1,810 pass / 7 fail / 1 skipped**. Failures are limited to the missing Catalog public/domain boundary, legacy Products/ProductForm owners, frontend metadata still in shared, and unmigrated frontend consumers.
- Inventory additionally found `src/domains/orders/ui/components/OrderCart.jsx` as a legitimate consumer of category icons. **Ruling:** Catalog will expose `CATEGORY_ICON_NAMES` through its public entry because this is a real external frontend consumer; duplicating the map in Orders or allowing a deep/shared bypass would violate the approved ownership direction. Cost if wrong: Catalog's public API includes one visual metadata map until a future narrower UI contract is justified.
- App product CRUD/editor ownership and `updateCollection('products', ...)` deliberately remain through Task 1; they belong to later C8 tasks.
- Tasks 2–10, staging, merge and production are not authorized in the current round.


## C8 Task 1 closure — 2026-09-19

- RED `11e84f3badf1ffcca0fd71bb2ccd46588017e88b`; Validate #1432 / run `35461496338` failed as intended with **1,818 tests / 1,810 pass / 7 fail / 1 skipped**.
- GREEN production candidate `f8090972de496effa31cc391c3e71f9956021a03`; #1434 exposed five stale moved-path/import characterizations only.
- Test alignment `c868ba99f0f3afdd28237528fb925f9ce99eb5f9`; #1435 passed tests and exposed only the characterization file violating the existing Orders deep-import architecture boundary.
- Final test-ownership alignment `bdd73ada270c705e8c739ea785a56b8f5afa7cab`; Validate #1436 / run `35462681394` — **SUCCESS**, **1,818 tests / 1,817 pass / 0 fail / 1 skipped**; architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 all green.
- Catalog now owns frontend category metadata and the Products/ProductForm UI. `shared/productCatalog.js` retains only the cross-runtime product contracts used by frontend/Worker.
- App plus Orders `orderCart.js`, `OrderProductCatalog.jsx` and `OrderCart.jsx` consume Catalog through `domains/catalog/index.js`.
- Legacy `src/pages/Products.jsx` and `src/components/ProductForm.jsx` are removed with no compatibility reexport. No architecture allowlist expansion occurred.
- App product CRUD/editor, legacy product API exports and `updateCollection('products', ...)` remain intentional C8 debt for later tasks.
- Task 2 and beyond: **NOT STARTED / NOT AUTHORIZED IN THIS ROUND**. No staging, merge or production deploy.


---

# C8 — Catalog checkpoint after Task 5 — 2026-09-19

- Branch: `feature/spec-c8-catalog`; draft PR #52; base/master remains `a7a8285ee125d90058c739f52daba6c170921adb`.
- Task 1 final GREEN: `bdd73ada270c705e8c739ea785a56b8f5afa7cab`; Validate #1436 / run `35462681394` — SUCCESS.
- Task 2 RED: `cd2ed96624b29793d289e5d3405fecb5f8c1d704`; Validate #1438 / run `35463215995` — expected failures. Task 2 final GREEN: `8f7cfca4c0a4b03477955d1b3b0646b9ad35b165`; Validate #1440 / run `35463540113` — **SUCCESS**, 1,828 tests / 1,827 pass / 0 fail / 1 skipped.
- Task 3 authoritative RED: `6cf21d7a6930f8ba22063ed76fc2c497b6d5f4fd`; Validate #1445 / run `35464412859` — one intended missing-`catalogList.js` failure. Task 3 final GREEN: `01c10746aa1bf24c406b634d8b53efd5a69aff6f`; Validate #1447 / run `35464678996` — **SUCCESS**, 1,836 tests / 1,835 pass / 0 fail / 1 skipped.
- Task 4 RED: `33155835d2105681ee3bd9a826295ff920a04eb2`; Validate #1448 / run `35464932138` — four intended draft/editor/public-boundary failures. Task 4 final GREEN: `f85a6aa8623f2cf79fdf0a9a8115d69bc5226309`; Validate #1450 / run `35466359982` — **SUCCESS**, 1,848 tests / 1,847 pass / 0 fail / 1 skipped.
- Task 5 RED: `26da9d33c316edd1d6a825960bea2fcbe93dc9ac`; Validate #1451 / run `35466813331` — five intended workspace/composition failures. Task 5 production candidate: `27e8312630736f1ff467cb39c4a7587f4672445e`; final alignment: `ca26a0f48527a0e8f5371655bec0cc6c59b3a951`; Validate #1453 / run `35467142766` — **SUCCESS**, 1,852 tests / 1,851 pass / 0 fail / 1 skipped; architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 all green.
- Catalog now owns frontend metadata, product API/commands, administrative list projection, draft/editor/dialog, Products/ProductForm UI and stable workspace composition.
- App now composes only `CatalogWorkspace` plus query/capability/runtime/feedback injection; temporary public `Products`, `ProductForm`, `ProductEditorDialog`, `useCatalogCommands` and `useProductEditor` exports are removed.
- Final public entry after Task 5 has five real external contracts: `CatalogWorkspace`, `CATEGORY_ICON_NAMES`, `PRODUCT_CATEGORIES`, `categoryForUi`, `formatProductPresentation`.
- Product CRUD exports are absent from `src/api/client.js`; delete uses official `deletedProductId`.
- `updateCollection('products', ...)` has no production caller, but the generic runtime `updateCollection` method remains physically present. **Task 6 owns its removal; Task 7 owns permanent enforcement.**
- Task 6 is NOT STARTED. No staging, merge or production deployment has occurred.


---

# C8 — Task 6 checkpoint — 2026-09-19

- Tasks 1–6: **COMPLETE / GREEN** on `feature/spec-c8-catalog`; draft PR #52 remains open.
- Task 6 RED: `6e743157df04a584086e693dd284f6fb23cf0be6`; Validate #1455 / run `35468303745` — **FAIL as intended**, exactly one new failure requiring removal of the runtime collection escape hatch.
- Task 6 GREEN: `91b60e61064a660ca942ef61d3b2b968ffc654da`; Validate #1456 / run `35468442271` — **SUCCESS**, **1,853 tests / 1,852 pass / 0 fail / 1 skipped**; all remaining workflow gates green.
- `updateCollection` is physically absent from the operational runtime contract. Customers callers were removed in C7 and the product caller was removed in C8 Task 2. No generic replacement setter was added.
- Permanent C8 architecture enforcement is still pending Task 7; do not describe the C8 debt as architecture-enforced until that task passes.
- Task 7–10, staging, merge and production remain not started/not authorized by this checkpoint.


---

# C8 — Tasks 7–8 closure / Task 9 pre-deploy — 2026-09-19

- Branch: `feature/spec-c8-catalog`; PR #52 remains draft/open; base `a7a8285ee125d90058c739f52daba6c170921adb`.
- Task 7 RED: `c242e48dbcae61f72fe5eb5a6ecfccb68a76c474`; Validate #1458 / run `35469069713` — **FAIL as intended**, **1,860 tests / 1,853 pass / 6 fail / 1 skipped**. Failures were confined to the six newly required C8 architecture protections; the positive fixture remained green.
- Task 7 final GREEN: `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`; Validate #1460 / run `35469241957` — **SUCCESS**, **1,860 tests / 1,859 pass / 0 fail / 1 skipped**; architecture, lint, build, both Worker dry-runs, local D1 and Spec B D1 passed.
- Task 7 permanently enforces the Catalog public boundary, forbidden cross-domain dependencies, legacy owner/API absence, App ownership absence, `updateCollection` absence, shared-product frontend routing and pure Catalog domain rules. No architecture allowlist expansion occurred.
- Task 8 candidate/audit: `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`. No Worker/migrations/workflow/dependency/CSS/Modal diff. Orders contains only Catalog public-entry import migration and proportional tests, not cart/checkout behavior changes.
- Validate #1460 is a PR event and checked out synthetic merge ref `8ef861e5facb7326b27dcdab120a0e10ffa59cad`. GitHub reports that merge ref and feature HEAD share the exact tree `b2a2376a65270f50f891c06196b9acb7a3637134`; this evidence is recorded without mislabeling the event as `workflow_dispatch`.
- Task 9: **IN PROGRESS / BLOCKED BEFORE DEPLOY**. A real staging run cannot be dispatched from the currently available GitHub connector, and the isolated shell has neither GitHub nor Cloudflare credentials. The approved `deploy-staging.yml` was not modified to create a bypass. QA file exists with all manual cases PENDING until staging is deployed.
- Production: **NO DEPLOY**. Merge: **NO**.


---

# C8 — Task 9 staging homologation closure — 2026-09-19

- Tasks 1–9: **COMPLETE**; Task 9 is **STAGING HOMOLOGATED**.
- Staged/homologated SHA: `8a43d10e02821aca2a839394e3bd6d1daf15fdc8` (documentation checkpoint on top of last code SHA `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`).
- Validate immediately before staging: #1461 / run `35469623626` — **SUCCESS**, all workflow gates green.
- Deploy staging #186 / run `35469861985` — **SUCCESS** on exact SHA `8a43d10e02821aca2a839394e3bd6d1daf15fdc8`.
- Staging Worker version: `28e2622f-c904-4959-8433-33c9691661f3`; URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`.
- Staging migration steps completed successfully and reported **No migrations to apply**; readiness succeeded at attempt 1/6; login smoke returned **HTTP 200**.
- Manual QA closed at **34 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**.
- Accepted BLOCKED: case 30 restricted/read-only capability — staging has no suitable restricted identity/capability fixture. This is recorded as BLOCKED, not inferred PASS.
- Cases 1–29 and 31–35: **PASS** as explicitly reported by the user. No corrective code change was required.
- Production deploy: **NO**. Merge: **NO**. PR #52 remains draft/open.
- Any later documentation-only commit is not the staged executable; retain `8a43d10e02821aca2a839394e3bd6d1daf15fdc8` as the homologated SHA.


---

# C8 — Task 10 pre-merge closure — 2026-09-19

- C8 Tasks 1–9 are **COMPLETE**; Task 9 is **STAGING HOMOLOGATED**.
- Homologated/staged executable SHA remains `8a43d10e02821aca2a839394e3bd6d1daf15fdc8`; Deploy staging #186 / run `35469861985` SUCCESS; manual QA **34 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**.
- Last code-changing SHA: `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`.
- Post-homologation docs closure `fa7a14fd46df5133cce5073dd5bdf3c3242776a7` passed Validate #1462 / run `35471370382` — SUCCESS, **1,860 tests / 1,859 pass / 0 fail / 1 skipped**, all gates green.
- Compare `8a43d10e...` → `fa7a14fd...`: documentation-only changes; no application/Worker/migration/workflow/dependency code changed after homologation.
- PR #52 review state: draft/open, unmerged, no review threads and no submitted reviews pending.
- Task 10 ruling: authorization to execute Task 10 is **not merge authorization**. Merge requires a separate explicit user authorization after the exact final documentation HEAD passes Validate.
- Production remains untouched. C9 must not start automatically.


---

# C8 — merge closure — 2026-09-19

- PR #52 is **MERGED / CLOSED**.
- Merge/master SHA: `91fb5581cea1616f438c13dfac28cfb38345fa59`.
- Post-merge Validate #1464 / run `35471894412` — **SUCCESS** on exact SHA `91fb5581cea1616f438c13dfac28cfb38345fa59`.
- C8 staging/manual QA remains **34 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**.
- C8 has no surviving temporary compatibility facade; permanent Catalog architecture enforcement remains active.
- Production was **NOT** deployed.

---

# C9 — preparation checkpoint — 2026-09-19

- Branch: `feature/spec-c9-printing`.
- Base/master: `91fb5581cea1616f438c13dfac28cfb38345fa59`.
- Written design: `docs/superpowers/specs/2026-09-19-frontend-modularization-c9-printing-design.md` — **APPROVED**.
- Implementation plan: `docs/superpowers/plans/2026-09-19-frontend-modularization-c9-printing-plan.md` — **APPROVED FOR EXECUTION**; Native/inline execution selected.
- Pre-preparation branch HEAD: `af7d32b821ac5d475bbd00981fedf673f3a5e49f`; compare against base contained only the C9 spec and plan, with no application code changes.
- C9 authority explicitly preserves the current copy policy: Local without table uses `orderDefaultCopies`; table-linked orders and `table-tab` jobs use `tableTabDefaultCopies`; each supports 1 or 2 copies.
- Active C9 debts at start: `src/printing/**` mixed ownership, `src/pages/PrintQueue.jsx`, `src/components/PrintingSettings*.jsx`, Printing-specific exports in `src/api/client.js`, App second-copy/recovery/QZ coordination, and the direct-QZ allowlist exception for `src/printing/usePrintingManager.js`.
- Permanent cross-runtime contracts `shared/printQueue.js`, `shared/printQueueActions.js`, and `shared/printContextPolicy.js` are not compatibility facades and remain shared.
- Task 1: **NOT STARTED** at this checkpoint.
- Staging: **NO**. Merge: **NO**. Production: **NO**.

- C9 documentary baseline `010e9ef8f46c0a46eb82dfa5c85c79d5c4bc16f1` passed Validate #1465 / run `35473924686` — **SUCCESS**, **1,860 tests / 1,859 pass / 0 fail / 1 skipped**; architecture/lint/build/both Worker dry-runs/local D1/Spec B D1 all green.
- Draft PR #53 is open for C9. This run validates the pre-Task-1 documentary baseline; Task 1 remains NOT STARTED until this evidence-only follow-up HEAD receives its own Validate.


---

# C9 — Task 1 closure — 2026-09-19

- Task 1: **COMPLETE / GREEN**.
- RED: `f174e57fc45809b053aba6ce86298ac61990e27c`; Validate #1467 / run `35474709352` — expected failure with **1,865 tests / 1,860 pass / 4 fail / 1 skipped**, proving the new Printing domain owners were absent while the copy-policy characterization remained green.
- Corrective purity RED: `4a064b9ee3d6f001cbca762ebe1ec31f7fc0a300`; Validate #1473 / run `35475160919` exposed the real legacy browser dependency `globalThis.document` in the moved renderer. Ruling: browser defaults stay outside the pure domain in temporary, ledgered adapters.
- Final GREEN: `42a0a1f9e1062ee8230dbd92e4c8f79cb5891fca`; Validate #1475 / run `35475383919` — **SUCCESS**, **1,866 tests / 1,865 pass / 0 fail / 1 skipped**; architecture/lint/build/both Worker dry-runs/local D1/Spec B D1 all green.
- Printing now owns pure eligibility/recovery/second-copy/station-policy/rendering contracts under `src/domains/printing/domain/**`.
- Current copy semantics remain unchanged and explicitly covered: Local without table uses `orderDefaultCopies`; table-linked orders and `table-tab` use `tableTabDefaultCopies`; each supports 1 or 2 copies.
- Task 1 did not move Printing API or QZ infrastructure. Task 2 and beyond remain not started by this checkpoint.
- Staging: NO. Merge: NO. Production: NO.


---

# C9 — Tasks 2–5 checkpoint — 2026-09-19

- Tasks 1–5: **COMPLETE / GREEN**. Task 6: **NOT STARTED**.
- Task 2 RED `7f6a6ee2774d5cac721598325fab103a33005a2b` → Validate #1477 / run `35476189280`, 2 intended failures. GREEN `6329ea548d63e77e059b968d1eba04fedb472662` → Validate #1478 / run `35476339868` SUCCESS, **1,860 / 1,859 / 0 / 1**.
- Task 3 RED `13524d0142ff1b0c981d6285e019d71b8e557b88` → Validate #1479 / run `35476455924`, 1 intended failure. Final GREEN `4674f78ad707d1fa2473cd7f0cbf0c17b857c7eb` → Validate #1481 / run `35476714703` SUCCESS, **1,862 / 1,861 / 0 / 1**.
- Task 4 RED `fcefaa8e24bf7af18b7539b7b250c0a73c3a0042` → Validate #1482 / run `35478031958`, 4 intended failures. Final GREEN `17db6f5c8424d0921a8d03539ce242650612c22e` → Validate #1485 / run `35478529333` SUCCESS, **1,869 / 1,868 / 0 / 1**.
- Task 5 RED `8ab81d7ac8fcf8b9aac915bba53f922678e35aff` → Validate #1486 / run `35478729026`, 1 intended failure. Final GREEN `154d934bb1ecaf25f203cdbad727106cb91317fd` → Validate #1488 / run `35480148771` SUCCESS, **1,870 / 1,869 / 0 / 1**.
- Printing-specific HTTP exports are removed from `src/api/client.js`.
- QZ transport/status/attempt/local-printer preference ownership is under `src/infrastructure/qz/`.
- `usePrintingManager` production ownership is under `src/domains/printing/application/` and uses `createQzTransport`; the application manager does not directly import `qz-tray`.
- PrintQueue and its projections are owned by `src/domains/printing/ui/`; old `src/pages/PrintQueue*` production paths are removed.
- Public UI export uses the established node-safe surface wrapper pattern. `DEFAULT_PRINT_QUEUE_QUERY` is retained as a real public contract because App navigation consumes it.
- No C9 staging, merge or production deploy has occurred.


---

# C9 — Task 6 closure — 2026-09-19

- Documentation reconciliation before Task 6: HEAD `4ab00cc81ad3098fbf33a411f400a4c6fcb15822`; Validate #1490 / run `35482571979` — **SUCCESS**.
- Task 6 RED HEAD: `c95f2509083aad63f47443065d28363cf6c01a80`; Validate #1491 / run `35482680005` — **FAIL as intended**, **1,876 tests / 1,870 pass / 5 fail / 1 skipped**. The five failures were limited to absent Printing policy/UI ownership and the still-legacy Settings imports.
- Task 6 GREEN: `a02b9af0612353e445bf3997095da18bff2e5118`; Validate #1492 / run `35482900556` — **SUCCESS**, **1,876 tests / 1,875 pass / 0 fail / 1 skipped**; architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 all green.
- `printingPolicy`, `stationConfigurationPolicy` and `stationPrimaryPolicy` now belong to `src/domains/printing/infrastructure/printingPolicy.js` and are consumed through the Printing public entry.
- `PrintingSettingsContent.jsx` and its `printing.css` now belong to `src/domains/printing/ui/`; `SettingsSurface` consumes the Printing UI only through `src/domains/printing/index.js`.
- `printingSettingsAdapter.js` deliberately remains in Settings as the approved thin composition bridge. The legacy `src/components/PrintingSettings.jsx` wrapper remains until Task 8.
- Copy-policy behavior is unchanged and covered: `orderDefaultCopies` and `tableTabDefaultCopies` remain independent 1/2-copy settings; existing jobs keep their recorded `copiesRequested` after later policy changes.
- Task 7: **NOT STARTED**. No C9 staging, physical QA, merge or production deploy has occurred.


---

# C9 — Task 7 closure — 2026-09-19

- Task 7 RED: `10bc6f08a0b26eeb03291f1077d209dda1a45bb0`; Validate #1494 / run `35483743546` — **FAIL as intended**, **1,882 tests / 1,875 pass / 6 fail / 1 skipped**. The six failures were exactly the absent Printing overlay/public owner, App-owned prompt/recovery state/storage, missing affinity hook, missing overlay UI and missing App composition point.
- Production candidate: `8636f66a68b9e3471bcf0191a15ab40bed4d1135`; Validate #1495 / run `35483978407` reached the new implementation and failed only on **5 stale ownership characterizations** that still expected second-copy/recovery implementation inside `App.jsx`.
- Corrective/final GREEN: `7a0785ca454ecde0f0f18cce6f1370911c3edc63`; Validate #1496 / run `35484090583` — **SUCCESS**, **1,882 tests / 1,881 pass / 0 fail / 1 skipped**; architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 all green.
- `usePrintingOverlays` now owns second-copy prompt selection, origin prompt, recovery dialog/busy state, dismissed-origin memory, prompt-seen state, paused recovery second-copy affinity and previous recovery state.
- `PrintingOverlays` owns the existing recovery/second-copy dialogs with unchanged functional copy and is exposed through the node-safe Printing public surface.
- App no longer imports or owns second-copy/recovery helpers or browser storage. After order creation it delegates origin ownership through `printing.rememberOriginOrder(order.id)` and renders one `<PrintingOverlays ... />` composition point.
- Deferred recovery affinity remains explicit: when recovery points at a two-copy job awaiting copy 2/2, that same job is selected before any next queued job; pausing prevents immediate re-open until recovery resumes.
- The corrective commit also keeps `onError`/`onSuccess` in refs so unstable App callback identities cannot retrigger the prompt-selection ACK effect while an acknowledgement is in flight.
- Task 8 is **NOT STARTED**. No staging, physical QA, merge or production deploy has occurred.


---

# C9 — Tasks 8–10 closure — 2026-09-19

- **Task 8 COMPLETE / GREEN.** RED `dbd54d10efe2651eadb0716757278fc10fd4a9ba` → Validate #1498 / run `35484636722`, **1,885 / 1,882 / 2 / 1**, proving legacy production owners and temporary public exports still existed.
- Task 8 production candidate `c2e5e061be1e15fe46491e939eef93dfe4651dfe` removed the remaining 10 legacy production owners/facades, left `src/printing/` test-only, removed `src/components/PrintingSettings.jsx`, moved PDF/ESC-POS browser composition behind Printing ownership and reduced the public entry to the eight approved external contracts. Validate #1499 exposed one stale QZ test import only.
- Task 8 final GREEN `b51c89d754739bc0a51e5e8044d7a70fe3efc58f` → Validate #1500 / run `35484888185` — **SUCCESS**, **1,885 / 1,884 / 0 / 1**, all gates green.
- **Task 9 COMPLETE / GREEN.** RED `dd4d111c4ed175132ec0007435cd8a345b1ad26a` → Validate #1501 / run `35485126897`, **1,902 / 1,890 / 11 / 1**; the three positive architecture fixtures passed while the eleven intended permanent-C9 rules were absent.
- Task 9 GREEN `8824ae94f3e4d49a44b51825bd232b8c8dc0b27f` → Validate #1502 / run `35485255788` — **SUCCESS**, **1,902 / 1,901 / 0 / 1**, all gates green. Permanent enforcement now protects Printing public-boundary use, Printing-domain purity, QZ isolation, App overlay ownership, legacy owner/API removal and reverse QZ→Printing dependencies. `qzDirectImports` is now empty.
- **Task 10 COMPLETE / GREEN candidate audit.** Final executable candidate remains `8824ae94f3e4d49a44b51825bd232b8c8dc0b27f`, 46 commits ahead / 0 behind base `91fb5581cea1616f438c13dfac28cfb38345fa59`.
- Task 10 diff audit: no changes under `worker/`, `migrations/`, `.github/workflows/`, `package.json`, `package-lock.json` or `shared/`; polling remains 2s/5s/15s; storage keys remain `delivery-print-station-id`, `delivery-qz-printer-name:<stationId>`, `printing-origin-order-ids`; operational/QZ error-code set is unchanged.
- All **34** migrated Printing API exports have text-equivalent request expressions versus the C8 base. QZ certificate/sign endpoints and payloads are unchanged; QZ security still uses SHA512. `printing.css` and `print-queue.css` are content/hash-identical to the base (the former only moved owner).
- PR Validate #1502 is a `pull_request` event, not workflow_dispatch. The tested synthetic merge ref `78cfaa7660fc339f8f13dc8d4bfc913b79762689` and exact feature HEAD `8824ae94f3e4d49a44b51825bd232b8c8dc0b27f` share tree `c71841307119d258d1b0aa0622be30a8a618950a`, so the validated content is byte-for-byte identical to the feature candidate.
- Task 11 is now **FUNCTIONALLY CLOSED UNDER THE 2026-09-20 REVISED RELEASE POLICY**. Latest code-changing SHA `c90ef83775cf3ca66771c1b6ae0cc27ec4516d71` passed Validate #1511 / run `35512044736` with **1,911 / 1,910 / 0 / 1** and all gates green. Deploy staging run `35512327093` succeeded on that exact SHA; remote staging reported no migrations, Worker version `b88c06e5-2165-428e-8af7-d6ab8271fada`, readiness 1/6 and login HTTP 200.
- Manual functional QA: **24 PASS / 0 FAIL / 1 BLOCKED / 12 DEFERRED-PRODUCTION / 0 PENDING**. #35 is BLOCKED because no restricted-capability identity exists. Deferred rows are #12, #14–21, #24, #30 and #31.
- Physical QZ matrix P1–P20: **0 PASS / 0 FAIL / 20 DEFERRED-PRODUCTION**. The user explicitly approved moving this real-hardware round from the pre-C9-merge gate to a hard **pre-production gate** so C9 can merge and C10 can proceed. No deferred row is represented as PASS.
- Before production, the **final post-C10 release candidate** must be staged and all 12 deferred functional rows plus P1–P20 must PASS. Any defect requires RED→GREEN, full Validate, staging redeploy and affected physical rerun.
- Production remains **NO DEPLOY**. C9 merge still requires final docs Validate and separate explicit user authorization.


# C9 — Merge closure — 2026-09-20

- PR #53 merged to `master` at `2b5060c8293fec6756b286627212b740b3147e53`.
- Post-merge Validate #1513 / run `35514989203` — **SUCCESS**, **1,911 tests / 1,910 pass / 0 fail / 1 skipped**.
- Production was not deployed.
- Deferred pre-production gate remains authoritative: Task 11 hardware-dependent rows plus P1–P20 must pass on the final post-C10 staging release candidate before production.

# C10 — Preparation checkpoint — 2026-09-20

- Branch: `feature/spec-c10-architecture-closure`.
- Base: post-C9 master `2b5060c8293fec6756b286627212b740b3147e53`.
- C10 design is **APPROVED** by the user on 2026-09-20 and includes frontend shared ownership closure (`src/shared/{ui,hooks,utils}`), residual generic-root ownership, generic domain-purity enforcement and cycle detection.
- The implementation plan has been fully realigned to the approved design and is **DRAFT FOR APPROVAL**.
- Implementation: **NOT STARTED** pending explicit approval of the implementation plan.
