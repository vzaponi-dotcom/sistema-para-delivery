# C8 — Catalog execution record

## Approval and scope — 2026-09-19

The user explicitly approved the C8 design and the implementation plan. Approval is not pending. This round authorizes the documentary preparation and **Task 1 only**. Tasks 2–10, merge, staging and production are not authorized in this round.

- Design: `docs/superpowers/specs/2026-09-19-frontend-modularization-c8-catalog-design.md`.
- Approved plan: `docs/superpowers/plans/2026-09-19-frontend-modularization-c8-catalog-plan.md` at `20abf94359e0e2883fc3b870c69688f8eeabc12c`.
- Work branch: `feature/spec-c8-catalog`.
- Technical base / unchanged master: `a7a8285ee125d90058c739f52daba6c170921adb`.
- C7: PR #51 MERGED / COMPLETE; post-merge Validate #1429 / run `35459175985` SUCCESS.
- C8 draft PR: #52, already present and reused; no duplicate PR created.
- C8 documentary baseline: Validate #1430 / run `35461113886` SUCCESS, associated with branch head `20abf94359e0e2883fc3b870c69688f8eeabc12c`.

## Environment

A fresh local clone was attempted outside the user's workspace and failed because `github.com` could not be resolved. No old user worktree was modified. Repository operations use the connected GitHub API, with normal commits and non-forced fast-forward ref updates only. Application verification uses the repository's existing Validate workflow. No local application test execution is claimed.

## Current state

- Approval: RECORDED.
- Canonical spec/plan/rollout/ledger status reconciliation: **COMPLETE** at `e91a65b0ad76007b69424ee4cd8e1ed5dfe58b43`.
- Task 1: **COMPLETE / GREEN** at `bdd73ada270c705e8c739ea785a56b8f5afa7cab`; Validate #1436 / run `35462681394` SUCCESS.
- Tasks 2–10: NOT STARTED.
- Merge/deploy: NONE.

This file supplements, and does not replace, the canonical Spec C execution and compatibility ledgers. Their stale pre-merge/pre-approval wording must be reconciled; historical evidence must be preserved.

## Task 1 contract

Move only the Catalog public boundary, frontend metadata and existing Products/ProductForm UI, plus their consumers and proportional tests. App retains product CRUD/editor orchestration until later tasks. `shared/productCatalog.js` retains the Worker-used category/validation/formatting contract. Orders UI and `orderCart.js` consume the Catalog public entry without changing behavior. No API/runtime/Worker/schema/CSS/workflow/allowlist changes are part of Task 1.

## Pre-flight interfaces

- Task 1 supplies Catalog metadata/public UI to later tasks; temporary `Products` and `ProductForm` exports have real App consumers and are removed in Task 5.
- Task 2 supplies commands and `deletedProductId`; Task 1 must not implement them.
- Task 4 supplies editor contracts; Task 5 absorbs composition. Task 1 preserves existing App state and ProductForm price initialization.
- Task 6 removes `updateCollection`; it remains present throughout Task 1.
- Task 7 enforces final architecture; no allowlist expansion in Task 1.


## Task 1 RED evidence and ruling

- RED SHA: `11e84f3badf1ffcca0fd71bb2ccd46588017e88b`.
- Validate #1432 / run `35461496338`: **FAIL as intended** at Test.
- Suite: **1,818 tests / 1,810 pass / 7 fail / 1 skipped**.
- Intended failures: missing `domains/catalog/index.js`, missing `catalogPresentation.js`, legacy Products/ProductForm paths still present, frontend-only metadata still exported by shared, App/Orders not yet consuming the Catalog entry, and production shared bypasses still present.
- Inventory found the planned App/ProductForm/Products/orderCart/OrderProductCatalog consumers plus `src/domains/orders/ui/components/OrderCart.jsx`.
- **Ruling:** export `CATEGORY_ICON_NAMES` from the Catalog public entry for the real OrderCart consumer. The map remains owned by Catalog; Orders must not duplicate it or deep-import Catalog/shared internals. Cost if wrong: one additional visual metadata export becomes part of the C8 public contract.
- No parser/harness failure caused the authoritative RED. The Catalog harness characterization itself passed.


## Task 1 GREEN evidence

- Production move: `f8090972de496effa31cc391c3e71f9956021a03` — Catalog metadata/UI owners created, shared narrowed and production consumers migrated.
- Validate #1434 on that candidate found **5 stale characterization paths/assertions only**; no production failure was identified.
- Test-only alignment: `c868ba99f0f3afdd28237528fb925f9ce99eb5f9`. Validate #1435 made the entire `npm test` step green, then correctly rejected `catalogOrdersIntegration.test.js` because a Catalog-located test deep-imported Orders internals.
- Ownership-only alignment: `bdd73ada270c705e8c739ea785a56b8f5afa7cab` moved that characterization under Orders and changed only its local import.
- Validate #1436 / run `35462681394`: **SUCCESS**.
- Final suite: **1,818 tests / 1,817 pass / 0 fail / 1 skipped**.
- Architecture: PASS; lint: PASS; build: PASS; Worker production dry-run: PASS; Worker staging dry-run: PASS; local D1: PASS; Spec B D1 clean install/upgrade: PASS.
- No Worker, schema, migration, CSS, workflow or allowlist behavior was changed by Task 1.
- Task 2 remains **NOT STARTED / NOT AUTHORIZED**. Staging, merge and production remain **NONE**.
