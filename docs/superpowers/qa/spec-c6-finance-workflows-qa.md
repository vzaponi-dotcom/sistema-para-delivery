# Spec C6 — Finance + Cross-Domain Payment Workflows QA

**Date:** 2026-09-19  
**Slice:** C6 — Finance + cross-domain payment workflows  
**Branch:** `feature/spec-c6-finance-workflows`  
**PR:** #50 (draft)  
**Base/master SHA:** `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`  
**Final executable / homologated SHA:** `ebf9439d85115c422b3df8175b3d24429a77aed9`  
**Production deployment:** **NO**

## Gate summary

C6 staging homologation completed with **23 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**. The merge gate requires **0 FAIL**, which is satisfied. The single BLOCKED item is explicitly documented and is not treated as PASS.

The repository was operated through GitHub for this execution; no local worktree PASS is claimed. Diff audit confirms no `worker/` or `migrations/` changes, no production Printing/QZ ownership move, and no Customer/Catalog implementation.

During manual QA, item 16 exposed a pre-existing missing UI entry point for the already-implemented opening-balance dialog. The fix followed strict RED → GREEN: RED `71b6a1de2c043b7f089a1566767eea362c2f0687` required a visible **Saldo inicial** action; GREEN `ebf9439d85115c422b3df8175b3d24429a77aed9` restored only that entry point. The exact corrected SHA passed Validate #1389 and was redeployed to staging in #184 before QA resumed.

## Automated evidence

### Final executable Validate application

- Workflow: **Validate application**
- Run: **#1389 / 35442758266**
- SHA: `ebf9439d85115c422b3df8175b3d24429a77aed9`
- Result: **SUCCESS**
- Tests: **1,770 total / 1,769 pass / 0 fail / 1 skipped**
- Frontend architecture boundaries: **PASS**
- Lint: **PASS**
- Build: **PASS**
- Production Worker dry-run: **PASS**
- Staging Worker dry-run: **PASS**
- Local D1 migrations: **PASS**
- Spec B D1 clean-install/upgrade gate: **PASS**

These are runner results. They are not represented as locally executed commands.

### Final Deploy staging

- Workflow: **Deploy staging**
- Run: **#184 / 35443025995**
- Event: `workflow_dispatch`
- SHA: `ebf9439d85115c422b3df8175b3d24429a77aed9`
- Result: **SUCCESS**
- Tests: **1,770 total / 1,769 pass / 0 fail / 1 skipped**
- Architecture/lint/build/local D1/staging Worker dry-run: **PASS**
- Remote staging migration list: **no migrations to apply**
- Remote staging migration apply: **no migrations to apply**
- Staging deployment: **SUCCESS**
- Cloudflare version ID: `ae3eb17c-90d9-4550-b523-c4a364ade0fe`
- Readiness: **attempt 1/6**
- Real staging login smoke: **HTTP 200**
- Staging URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`

For continuity, the earlier pre-fix staging checkpoint was Validate #1386 / run `35417003680` and Deploy staging #183 / run `35417329071` on `caa7b9a7bf39f2c56526cf4b44b3e90ac1798711`. It was superseded by the corrected exact SHA above before item 16 was retested.

## Manual staging matrix

| # | Case | Result | Evidence |
|---:|---|---|---|
| 1 | Payment from Cozinha | PASS | Pending standalone order paid successfully from Cozinha; modal/workflow completed and official paid state was reflected. |
| 2 | Payment from Histórico | PASS | Finalized unpaid standalone order paid from Histórico without losing navigation context. |
| 3 | Payment from A Receber | PASS | Pending receivable paid from A Receber and removed from pending state with financial effects reflected. |
| 4 | Cancel payment modal preserves context | PASS | Closing the payment modal without confirming left the order pending and preserved the originating context. |
| 5 | Rapid/double confirmation does not duplicate | PASS | Rapid repeated confirmation produced one payment and one financial entry only. |
| 6 | Offline disables payment | PASS | Offline state blocked payment confirmation; no false success or payment write occurred. |
| 7 | Effective default payment method | PASS | New payment flow selected the configured effective default method correctly. |
| 8 | Deactivated method during open flow requires review | PASS | Method deactivated in another tab was treated as historical/inactive and required review rather than silent confirmation. |
| 9 | Table-tab/comanda payment | PASS | Full comanda payment was accepted once and official paid/close effects were reflected. No success toast was observed; that toast is conditional in the pre-existing settlement logic and is not a Task 11 acceptance requirement. |
| 10 | Paid comanda closes and table becomes free | PASS | Paid comanda stayed closed after reload and its table stayed free with no pending balance. |
| 11 | New comanda reoccupying same table is not cleared by old payment | PASS | A new comanda on the same table remained occupied/current after old-payment reconciliation and reload. |
| 12 | Payment sync pending/error/retry | PASS | Forced reconciliation failure exposed retry; explicit retry synchronized without issuing a second payment POST. |
| 13 | Create manual movement | PASS | Manual movement created once, affected totals correctly, and persisted after reload. |
| 14 | Edit manual movement | PASS | Manual movement edits replaced the original values without duplication and persisted. |
| 15 | Delete manual movement | PASS | Manual movement deletion updated totals and remained deleted after reload. |
| 16 | Opening balance | PASS | Initial manual attempt found no UI entry point; RED `71b6a1de...` / GREEN `ebf9439d...` restored **Saldo inicial**. Corrected staging #184 then opened the dialog, saved successfully, recalculated balance and persisted after reload. |
| 17 | Receivables filters + forecast | PASS | Filters/search/ordering and forecast buckets behaved consistently for pending receivables. |
| 18 | Payment promise add/change/remove | PASS | Promised date could be added, changed, removed and persisted with timing/forecast behavior updating correctly. |
| 19 | Pending refund visibility | PASS | Paid-then-cancelled order appeared once under pending refunds with correct identifying/value data and action. |
| 20 | Register full refund | PASS | Full refund registered once, left pending-refund list, created the financial exit and persisted after reload. |
| 21 | Settings payment methods | PASS | Payment-method configuration change persisted and was reflected by new payment flows. |
| 22 | Settings finance categories | PASS | Finance-category configuration persisted and was reflected in new manual movement choices while historical data remained legible. |
| 23 | Read-only/capability behavior if staging has a suitable restricted identity | BLOCKED | Staging has no restricted/read-only capability identity/session available for end-to-end manual verification. This is not promoted to PASS; automated capability coverage remains green. |
| 24 | Browser console has no new C6-attributable runtime errors | PASS | Console was cleared and representative C6 navigation/modal flows plus reload produced no new C6-attributable runtime errors. |

## Compatibility state

- Operational payment-receipt bridge: **REMOVED IN C6** and architecture-enforced.
- Operational table-commit bridge: **REMOVED IN C5** and remains architecture-enforced.
- C6 legacy API exports and legacy finance/payment utility owners: **REMOVED**.
- Finance → Orders/Table Service imports: architecture-rejected.
- Cross-domain payment/refund workflow ownership under domains: architecture-rejected.
- Finance/payment workflow Printing/QZ internals: architecture-rejected.
- Generic/auth `src/api/client.js` reexports: remain tracked for **C10**.
- `updateCollection` runtime escape hatch: remains for **C7/C8** cleanup and final **C10** enforcement.
- Production deployment: **NO**.

## Merge gate

- Manual staging failures: **0**
- Manual staging blocked: **1**, with explicit reason above.
- Manual staging pending: **0**
- Corrected homologated executable SHA: `ebf9439d85115c422b3df8175b3d24429a77aed9`
- Corrected executable Validate: **#1389 / 35442758266 — SUCCESS**
- Corrected Deploy staging: **#184 / 35443025995 — SUCCESS**
- Production touched: **NO**
- C7: **NOT STARTED**
- Merge authorization: **GRANTED by the user on 2026-09-19**

This QA/ledger documentation commit changes the Git SHA by definition. The exact docs-only HEAD created after this file must itself receive a successful **Validate application** before merge. That exact final validation is reported in the PR/merge handoff without creating an infinite self-referential documentation loop.

Do not merge C6 until that exact current branch HEAD has a successful Validate and the user explicitly authorizes the merge.
