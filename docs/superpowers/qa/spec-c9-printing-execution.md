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

- Documentary preparation baseline commit: `010e9ef8f46c0a46eb82dfa5c85c79d5c4bc16f1`.
- Draft PR: #53 — `Spec C9: Printing and QZ separation`.
- Validate #1465 / run `35473924686` — **SUCCESS** on exact head SHA `010e9ef8f46c0a46eb82dfa5c85c79d5c4bc16f1`.
- Baseline suite: **1,860 tests / 1,859 pass / 0 fail / 1 skipped**; architecture, lint, build, production Worker dry-run, staging Worker dry-run, local D1 and Spec B D1 all green.
- This evidence commit is documentation-only and must itself receive exact-head Validate before Task 1.
- Task 1: **NOT STARTED**.
- Staging: **NOT STARTED**.
- Physical QA: **NOT STARTED**.
- Merge: **NOT AUTHORIZED**.
- Production: **NO DEPLOY**.


## Task 1 ruling — renderer browser boundary

- **Ruling:** the literal plan placement of the existing renderer files under `domains/printing/domain/rendering` conflicted with the approved spec's domain-purity rule because the legacy ESC/POS renderer supplied a default canvas through `globalThis.document` and the PDF module also owned DOM download behavior.
- **Decision:** keep only pure rendering logic under `domain/rendering`; retain thin temporary browser adapters at the legacy ESC/POS and PDF paths until their real consumers migrate in Task 4/Task 8.
- **Why:** domain purity is binding architecture; moving browser globals into the domain merely to satisfy the planned path would be a folder-only refactor.
- **Cost if wrong:** two small legacy browser adapters survive temporarily, but are ledgered with exact removal tasks and preserve current physical/PDF behavior.
- Corrected purity RED: Validate #1473 / run `35475160919` failed on the real `globalThis.document` renderer dependency; stale ownership source-tests were separately aligned.


## Task 1 — Printing domain rules and rendering ownership

**Status:** COMPLETE / GREEN

### RED

- Commit: `f174e57fc45809b053aba6ce86298ac61990e27c`.
- Validate #1467 / run `35474709352` — **FAIL as intended**.
- Suite: **1,865 tests / 1,860 pass / 4 fail / 1 skipped**.
- The four failures were the new C9 ownership contract proving that `printingEligibility.js`, `printRecovery.js`, `stationPolicy.js`/renderer owner and domain source did not yet exist. The copy-policy characterization passed in the same run.

### Corrective RED / ruling

- The initial ownership move exposed a real spec/plan conflict: legacy renderer defaults pulled `globalThis.document` into `domains/printing/domain/**`.
- Corrected purity RED: `4a064b9ee3d6f001cbca762ebe1ec31f7fc0a300`; Validate #1473 / run `35475160919` failed on the real `globalThis.document` dependency, plus stale ownership source-tests that were then aligned.
- Ruling already recorded above: pure renderer code stays under Printing domain; browser canvas/PDF download defaults remain thin, temporary legacy adapters with exact removal tasks.

### GREEN

- Final Task 1 code SHA: `42a0a1f9e1062ee8230dbd92e4c8f79cb5891fca`.
- Validate #1475 / run `35475383919` — **SUCCESS** on exact head SHA.
- Suite: **1,866 tests / 1,865 pass / 0 fail / 1 skipped**.
- `Frontend architecture boundaries: OK`.
- lint ✅
- build ✅
- production Worker dry-run ✅
- staging Worker dry-run ✅
- local D1 ✅
- Spec B D1 ✅

### Result

- Printing now owns pure transport/eligibility, recovery, second-copy, station-policy and rendering contracts under `src/domains/printing/domain/**`.
- `App.jsx` and manager consumers use the new Printing public boundary for the extracted pure rules.
- The current copy policy remains unchanged: Local without table/tab → `orderDefaultCopies`; table-linked order / `table-tab` → `tableTabDefaultCopies`; both remain 1/2-copy settings.
- No Printing API was moved in Task 1; that remains Task 2.
- No QZ transport adapter was introduced in Task 1; that remains Task 3.
- Temporary browser adapters for ESC/POS canvas and PDF download are ledgered and scheduled for removal during the later C9 migration.
- Task 2 is **NOT STARTED**.


## Tasks 2–5 checkpoint — 2026-09-19

### Task 2 — Printing HTTP ownership

**Status:** COMPLETE / GREEN

- RED: `7f6a6ee2774d5cac721598325fab103a33005a2b`; Validate #1477 / run `35476189280` — expected failure, **1,868 tests / 1,865 pass / 2 fail / 1 skipped**. The two intended failures proved `printingApi.js` was absent and Printing exports still existed in `src/api/client.js`.
- GREEN: `6329ea548d63e77e059b968d1eba04fedb472662`; Validate #1478 / run `35476339868` — **SUCCESS**, **1,860 tests / 1,859 pass / 0 fail / 1 skipped**; all remaining gates green.
- Result: `src/domains/printing/infrastructure/printingApi.js` owns the full Printing HTTP contract; manager and PrintQueue consume it; Printing-specific exports are absent from `src/api/client.js`.
- Endpoint paths, methods, URLSearchParams ordering, heartbeat payloads, reprint payload `{ copies }`, table-tab print routes, QZ certificate/sign routes and same-origin behavior are preserved.
- Six legacy API test files were replaced only after equivalent coverage existed under the new owner.

### Task 3 — QZ infrastructure

**Status:** COMPLETE / GREEN

- RED: `13524d0142ff1b0c981d6285e019d71b8e557b88`; Validate #1479 / run `35476455924` — expected failure, **1,861 tests / 1,859 pass / 1 fail / 1 skipped**, with the single missing `src/infrastructure/qz/qzTransport.js` owner.
- GREEN candidate: `c79cb04cefa070f7f6d8c26e6c3b7286b8795e58`; Validate #1480 found one stale `localPrintStation.test.js` import after QZ preference ownership moved.
- Final GREEN: `4674f78ad707d1fa2473cd7f0cbf0c17b857c7eb`; Validate #1481 / run `35476714703` — **SUCCESS**, **1,862 tests / 1,861 pass / 0 fail / 1 skipped**; all remaining gates green.
- Result: QZ transport, status monitor, attempt controller and printer-local preferences live under `src/infrastructure/qz/`.
- Unknown physical outcome, no silent resend, status classification, readiness single-flight/stale invalidation, RAW/Base64 bytes and certificate/sign callbacks remain covered.
- The architecture allowlist entry was intentionally not removed yet; Task 9 owns permanent enforcement.

### Task 4 — manager application ownership and QZ adapter injection

**Status:** COMPLETE / GREEN

- RED: `fcefaa8e24bf7af18b7539b7b250c0a73c3a0042`; Validate #1482 / run `35478031958` — expected failure, **1,866 tests / 1,861 pass / 4 fail / 1 skipped**, proving the application manager, physical-operation, platform and local-preference owners were absent.
- Production extraction: `d32c99242f5d2dc6319ad6ce0f50289b1ba29a4b` moved the manager/runner, introduced `createQzTransport` injection and removed the production manager's direct `qz-tray` dependency.
- Validate #1483 exposed stale ownership/source characterizations; `707ae66edf08e5fc93ec0b28d942275db03974dc` aligned them, and #1484 identified the remaining QZ-adapter/manager source assumptions.
- Final test alignment: `17db6f5c8424d0921a8d03539ce242650612c22e`.
- Final GREEN: Validate #1485 / run `35478529333` — **SUCCESS**, **1,869 tests / 1,868 pass / 0 fail / 1 skipped**; all remaining gates green.
- Result: `usePrintingManager`, `printJobRunner`, physical-operation locking, platform detection and Printing local preferences now have domain/application ownership.
- Poll cadences remain exactly 2s / 5s / 15s. The existing stale-generation printer-selection regression remains covered.
- `rememberOriginOrder(orderId)` exists on the manager; the App migration to that command remains intentionally scheduled in Task 7 together with overlay ownership.
- Small legacy reexport facades remain temporarily for consumers/tests scheduled in Tasks 6–8; they are tracked in the compatibility ledger.

### Task 5 — PrintQueue UI ownership

**Status:** COMPLETE / GREEN

- RED: `8ab81d7ac8fcf8b9aac915bba53f922678e35aff`; Validate #1486 / run `35478729026` — expected failure, **1,870 tests / 1,868 pass / 1 fail / 1 skipped**, proving `PrintQueue` had not yet moved behind the Printing public boundary.
- Initial move: `9a1e6f236415d94158ce880c841a71f5fd73ba2d`; Validate #1487 failed because a static `.jsx` reexport made Node-only tests load JSX through `domains/printing/index.js`.
- Root cause: the public entry is shared by Vite runtime and plain `node --test`; direct JSX exports are not Node-safe.
- Fix: `154d934bb1ecaf25f203cdbad727106cb91317fd` added `ui/printingSurfaces.js` using the established `import.meta.glob(..., { eager: true })` surface pattern already used by Catalog/Orders/Finance/Table Service.
- Final GREEN: Validate #1488 / run `35480148771` — **SUCCESS**, **1,870 tests / 1,869 pass / 0 fail / 1 skipped**; architecture, lint, build, both Worker dry-runs, local D1 and Spec B D1 all green.
- Result: `PrintQueue.jsx`, details, filters, query and summary now live under `src/domains/printing/ui/`; legacy `src/pages/PrintQueue.jsx` and `src/pages/printQueue*.js` paths are removed.
- App consumes `PrintQueue` through `src/domains/printing/index.js`.
- `src/print-queue.css` intentionally stays at its existing global path, preserving cascade.
- `DEFAULT_PRINT_QUEUE_QUERY` is a real external Printing contract consumed by `app/navigation/queryContext.js`; it is therefore exported through the public entry instead of being deep-imported or duplicated.

## Current C9 checkpoint after Task 5

- Tasks 1–5: **COMPLETE / GREEN**.
- Task 6: **NOT STARTED**.
- Last code-changing SHA: `154d934bb1ecaf25f203cdbad727106cb91317fd`.
- Latest executable validation: Validate #1488 / run `35480148771` — **SUCCESS**, **1,870 tests / 1,869 pass / 0 fail / 1 skipped**, all workflow gates green.
- No staging deploy has occurred for C9.
- No merge authorization has been requested or granted.
- Production remains untouched.
