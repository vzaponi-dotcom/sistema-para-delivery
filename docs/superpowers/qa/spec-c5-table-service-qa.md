# Spec C5 — Table Service QA

**Date:** 2026-09-18
**Slice:** C5 — Table Service
**Branch:** `feature/spec-c5-table-service`
**PR:** #49 (draft)
**Base/master SHA:** `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`
**Final executable / homologated SHA:** `f0db4d8bc8c17196cd7070e4766363f9d66a8f7b`
**Production deployment:** **NO**

## Gate summary

C5 staging homologation completed with **22 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**. The merge gate requires **0 FAIL**, which is satisfied. The single BLOCKED item is explicitly documented and is not treated as PASS.

The repository was operated from GitHub in this session; no local worktree PASS is claimed. Remote branch/master comparison showed master unchanged at the approved C5 base, the branch fully committed, no `worker/` or `migrations/` changes, and no core `src/printing/` implementation changes. A GitHub compare patch audit found six pre-existing Markdown trailing-space hard breaks in the C5 spec header; this QA documentation commit removes those whitespace-only issues so the final diff check can be clean.

## Automated evidence

### Validate application

- Workflow: **Validate application**
- Run: **#1339 / 35392353832**
- SHA: `f0db4d8bc8c17196cd7070e4766363f9d66a8f7b`
- Result: **SUCCESS**
- Tests: **1,724 total / 1,723 pass / 0 fail / 1 skipped**
- Frontend architecture boundaries: **PASS**
- Lint: **PASS**
- Build: **PASS**
- Production Worker dry-run: **PASS**
- Staging Worker dry-run: **PASS**
- Local D1 migrations: **PASS**
- Spec B D1 clean-install/upgrade gate: **PASS**

These are runner results. They are not represented as locally executed commands.

### Deploy staging

- Workflow: **Deploy staging**
- Run: **#182 / 35393748126**
- Event: `workflow_dispatch`
- SHA: `f0db4d8bc8c17196cd7070e4766363f9d66a8f7b`
- Result: **SUCCESS**
- Tests: **1,724 total / 1,723 pass / 0 fail / 1 skipped**
- Architecture/lint/build/local D1/staging Worker dry-run: **PASS**
- Remote staging migration list: **no migrations to apply**
- Remote staging migration apply: **no migrations to apply**
- Staging deployment: **SUCCESS**
- Readiness: **attempt 1/6**
- Real staging login smoke: **HTTP 200**
- Staging URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`

## Manual staging matrix

| # | Case | Result | Evidence |
|---:|---|---|---|
| 1 | Tables — create | PASS | Created QA table; it appeared immediately active/free and persisted in the list. |
| 2 | Tables — rename | PASS | Renamed QA table successfully; updated name reflected immediately. |
| 3 | Tables — activate/deactivate | PASS | Deactivation confirmation and subsequent reactivation both behaved correctly. |
| 4 | Tables — reorder | PASS | Table moved and the new order persisted after reload. |
| 5 | Occupied table — “Ver comanda” opens exact current comanda | PASS | Navigation opened the exact occupied table/comanda selected. |
| 6 | Comandas — open occupied table | PASS | Selecting another occupied table opened its correct current detail, not the previous one. |
| 7 | Free table — begin New Order | PASS | New Order opened with the selected free table context and no old comanda context. |
| 8 | Comanda — Add order | PASS | Add-order flow opened New Order preserving the current authoritative comanda/table identity. |
| 9 | New Order — cancel/complete returns to same authoritative comanda | PASS | Both cancel and successful completion returned to the same comanda; completed order refreshed its detail. |
| 10 | Transfer comanda | PASS | Source became free, destination became occupied, and comanda contents/value were preserved. |
| 11 | Selection follows transfer with same `tableTabId` | PASS | Selection followed the destination and did not resurrect at the source after navigation. |
| 12 | Transfer conflict / stale identity | PASS | Two-tab stale confirmation was rejected; comanda remained only at the destination chosen by the current action. |
| 13 | Closing a comanda clears selection | PASS | Closing freed the table and the closed comanda did not remain selected or reappear after reload. |
| 14 | Reusing same table does not resurrect previous comanda | PASS | New comanda on reused table showed only new identity/data; old comanda did not return. |
| 15 | Full comanda payment | PASS | Integral payment completed and remained reflected after reload. |
| 16 | Payment synchronization/retry behavior | PASS | Request blocking forced a payment request failure while online; retry became available and succeeded after unblocking without duplication. Offline mode separately showed write blocking by disabling payment submission. |
| 17 | View ticket | PASS | Preview opened for the current comanda with matching table/items/values and closed back to the same selection. |
| 18 | Print comanda | PASS | UI confirmed queue submission and the print job was verified in the actual queue. Physical output was not observed because no printer was available. |
| 19 | Capability/read-only behavior | BLOCKED | Staging exposes only the full-capability PIN session; no real restricted/read-only identity exists for end-to-end manual verification. Automated capability tests remain green. |
| 20 | Desktop light/dark | PASS | Tables and Comandas remained legible and operational in both themes. |
| 21 | Mobile/narrow light/dark | PASS | No material layout/contrast/accessibility regression observed in narrow mode in either theme. |
| 22 | Mobile detail focus/back/list-scroll | PASS | Detail focus/back behavior preserved list context/scroll across repeated selections. |
| 23 | Browser console has no new C5-attributable runtime error | PASS | Console was cleared and Tables/Comandas/detail/ticket navigation produced no new runtime errors. |

## Compatibility state

- Operational data runtime table-commit bridge: **REMOVED IN C5** and architecture-enforced.
- Operational data runtime payment-receipt bridge: **still active**, scheduled for C6.
- Generic/auth `src/api/client.js` reexports: still tracked for C10 at latest.
- `updateCollection` runtime escape hatch: still tracked for later Customers/Catalog cleanup and C10 enforcement.
- Table-tab payment API ownership remains C6.
- Table-tab printing API/queue/QZ ownership remains C9.

## Merge gate

- Manual staging failures: **0**
- Manual staging blocked: **1**, with explicit reason above.
- Master drift before staging/QA: **none**; master remained `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`.
- Production touched: **NO**
- Merge authorization: **NOT YET GRANTED**
- QA/ledger documentation commit: `61bc0461677fd643e7cf07920a81518a6272bbd8`
- Final docs-only Validate on that QA/ledger commit: **#1340 / run `35400039611` — SUCCESS**
- Tests on final QA/ledger Validate: **1,724 total / 1,723 pass / 0 fail / 1 skipped**
- Architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 on #1340: **PASS**
- Final diff audit at QA/ledger commit: **0 trailing-whitespace issues; 0 `worker/` or `migrations/` changes; 0 core `src/printing/` changes**
- Master drift after QA docs: **none**
- Merge authorization: **NOT YET GRANTED**

This document is now closed as QA evidence. The status-only closure commit that marks Task 11 complete changes the Git SHA by definition; therefore that exact new HEAD must itself receive a successful Validate before merge. That final exact-HEAD result is the merge gate and is reported in the PR/merge handoff without another self-referential documentation commit.

Do not merge C5 until that exact current branch HEAD has a successful Validate and the user explicitly authorizes the merge.
