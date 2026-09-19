# C9 Printing Execution Record

**Slice:** Spec C9 — Printing and QZ separation  
**Branch:** `feature/spec-c9-printing`  
**Base:** `91fb5581cea1616f438c13dfac28cfb38345fa59`  
**Spec:** `docs/superpowers/specs/2026-09-19-frontend-modularization-c9-printing-design.md` — APPROVED  
**Plan:** `docs/superpowers/plans/2026-09-19-frontend-modularization-c9-printing-plan.md` — APPROVED FOR EXECUTION  
**Execution method:** Native/inline  
**Production:** do not deploy without separate explicit authorization

## Preparation

- C8 real GitHub state reconciled before C9 code: PR #52 merged/closed at `91fb5581cea1616f438c13dfac28cfb38345fa59`; post-merge Validate #1464 / run `35471894412` SUCCESS on that exact SHA.
- C9 branch was created from that exact master SHA.
- Before this preparation commit, branch HEAD `af7d32b821ac5d475bbd00981fedf673f3a5e49f` was ahead of base only by the approved C9 spec and plan; no product/Worker/migration/workflow code had changed.
- Task 1 remains **NOT STARTED** until the documentary baseline receives repository validation.

## Pre-flight interface review

- Task 2 printingApi → Tasks 4/5 manager/queue: function names and endpoint signatures are carried unchanged from the existing `src/api/client.js`.
- Task 3 createQzTransport → Task 4 manager: concrete interface is fixed in the approved plan; no transport registry/classes.
- Task 4 usePrintingManager → Tasks 5/6/7 UI/Settings/overlays: existing operational surface is preserved and only `rememberOriginOrder(orderId)` is added to remove Printing storage ownership from App.
- Task 4 `rememberOriginOrder` → Task 7 App extraction: App records a created order through the Printing public contract, not localStorage.
- Tasks 5–7 UI/policies → Task 8 final public entry: final export list is explicit in the plan.
- Task 8 final paths → Task 9 architecture enforcement: checker rules target only paths/interfaces already established earlier.
- Tasks 10–12 consume a fully migrated candidate and introduce no new runtime interfaces.

## Rulings carried from the approved plan

1. Printing policy adapters are public Printing contracts because the Settings policy registry is a real external consumer.
2. `printingSettingsAdapter.js` stays in Settings as a thin composition bridge; the generic policy-editing engine does not move.
3. Origin-order storage belongs to Printing local preferences; only printer-name storage belongs to QZ local preferences.
4. `src/printing/printing.css` moves with Printing Settings ownership; `src/print-queue.css` stays global in C9 to avoid unrelated cascade risk.

## Active migration debt at start

- `src/printing/**` mixed domain/application/QZ/browser ownership.
- PrintQueue legacy owner under `src/pages/`.
- Printing Settings legacy owners under `src/components/`.
- Printing APIs in `src/api/client.js`.
- App second-copy/recovery/QZ coordination.
- `qzDirectImports` allowlist exception for `src/printing/usePrintingManager.js`.

## Copy-policy invariant

The current policy is authoritative:

- Local without table/tab → `orderDefaultCopies`;
- table-linked order or `table-tab` → `tableTabDefaultCopies`;
- each setting supports 1 or 2 copies;
- explicit valid copies override the default where the current flow supports it;
- test print stays one copy;
- existing jobs retain `copies_requested` after policy changes.

## Validation

- Documentary preparation baseline: **PENDING** until the first PR Validate run completes.
- Task 1: **NOT STARTED**.
- Staging: **NOT STARTED**.
- Physical QA: **NOT STARTED**.
- Merge: **NOT AUTHORIZED**.
- Production: **NO DEPLOY**.
