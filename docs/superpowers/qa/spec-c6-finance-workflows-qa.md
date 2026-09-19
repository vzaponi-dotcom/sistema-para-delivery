# Spec C6 — Finance + Cross-Domain Payment Workflows QA

**Date:** 2026-09-19  
**Slice:** C6 — Finance + cross-domain payment workflows  
**Branch:** `feature/spec-c6-finance-workflows`  
**PR:** #50 (draft)  
**Base/master SHA:** `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`  
**Executable / staging SHA:** `caa7b9a7bf39f2c56526cf4b44b3e90ac1798711`  
**Production deployment:** **NO**

## Gate summary

C6 automated gates and staging deployment are complete. Manual homologation is **IN PROGRESS** with **0 PASS / 0 FAIL / 0 BLOCKED / 24 PENDING**.

The repository was operated through GitHub for this execution; no local worktree PASS is claimed. Diff audit confirms no `worker/` or `migrations/` changes, no production Printing/QZ ownership move, and no Customer/Catalog implementation.

## Automated evidence

### Validate application

- Workflow: **Validate application**
- Run: **#1386 / 35417003680**
- SHA: `caa7b9a7bf39f2c56526cf4b44b3e90ac1798711`
- Result: **SUCCESS**
- Tests: **1,770 total / 1,769 pass / 0 fail / 1 skipped**
- Frontend architecture boundaries: **PASS**
- Lint: **PASS**
- Build: **PASS**
- Production Worker dry-run: **PASS**
- Staging Worker dry-run: **PASS**
- Local D1 migrations: **PASS**
- Spec B D1 clean-install/upgrade gate: **PASS**

### Deploy staging

- Workflow: **Deploy staging**
- Run: **#183 / 35417329071**
- Event: `workflow_dispatch`
- SHA: `caa7b9a7bf39f2c56526cf4b44b3e90ac1798711`
- Result: **SUCCESS**
- Architecture/lint/build/local D1/staging Worker dry-run: **PASS**
- Remote staging migration list: **no migrations to apply**
- Remote staging migration apply: **no migrations to apply**
- Deployment: **SUCCESS**
- Cloudflare version ID: `fba987a7-f008-4574-847c-35de914d87e3`
- Readiness: **attempt 1/6**
- Real staging login smoke: **HTTP 200**
- Staging URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`

## Manual staging matrix

| # | Case | Result | Evidence |
|---:|---|---|---|
| 1 | Payment from Cozinha | PENDING | — |
| 2 | Payment from Histórico | PENDING | — |
| 3 | Payment from A Receber | PENDING | — |
| 4 | Cancel payment modal preserves context | PENDING | — |
| 5 | Rapid/double confirmation does not duplicate | PENDING | — |
| 6 | Offline disables payment | PENDING | — |
| 7 | Effective default payment method | PENDING | — |
| 8 | Deactivated method during open flow requires review | PENDING | — |
| 9 | Table-tab/comanda payment | PENDING | — |
| 10 | Paid comanda closes and table becomes free | PENDING | — |
| 11 | New comanda reoccupying same table is not cleared by old payment | PENDING | — |
| 12 | Payment sync pending/error/retry | PENDING | — |
| 13 | Create manual movement | PENDING | — |
| 14 | Edit manual movement | PENDING | — |
| 15 | Delete manual movement | PENDING | — |
| 16 | Opening balance | PENDING | — |
| 17 | Receivables filters + forecast | PENDING | — |
| 18 | Payment promise add/change/remove | PENDING | — |
| 19 | Pending refund visibility | PENDING | — |
| 20 | Register full refund | PENDING | — |
| 21 | Settings payment methods | PENDING | — |
| 22 | Settings finance categories | PENDING | — |
| 23 | Read-only/capability behavior if staging has a suitable restricted identity | PENDING | — |
| 24 | Browser console has no new C6-attributable runtime errors | PENDING | — |

## Architecture / compatibility evidence

- Operational payment-receipt bridge: **REMOVED IN C6** and architecture-enforced.
- Operational table-commit bridge: **REMOVED IN C5** and remains absent.
- C6 legacy API exports and legacy finance/payment utility owners: **REMOVED**.
- Finance → Orders/Table Service imports: architecture-rejected.
- Cross-domain payment/refund workflow ownership under domains: architecture-rejected.
- Finance/payment workflow Printing/QZ internals: architecture-rejected.
- Production deployment: **NO**.

## Merge gate

- Manual staging failures: **pending**
- Manual staging blocked: **pending**
- Merge authorization: **NOT YET GRANTED**
- C7: **NOT STARTED**
- Production touched: **NO**

Do not merge C6 until the manual matrix closes with **0 FAIL**, the final QA/docs HEAD passes Validate, and the user explicitly authorizes the merge.
