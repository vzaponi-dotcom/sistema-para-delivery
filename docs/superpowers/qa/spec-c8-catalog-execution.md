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
- Canonical spec/plan/rollout/ledger status reconciliation: IN PROGRESS, not yet claimed complete.
- Task 1: NOT STARTED.
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
