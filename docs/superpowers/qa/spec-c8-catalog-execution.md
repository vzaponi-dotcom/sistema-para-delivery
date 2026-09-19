# C8 — Catalog execution record

## Approval and scope — 2026-09-19

The user explicitly approved the C8 design and implementation plan. Subsequent explicit authorizations covered Task 2, Tasks 3–4 in sequence, Task 5, Task 6, Tasks 7–8, and Task 9. **Tasks 1–9 are complete; Task 9 is staging-homologated.** Merge and production remain unauthorized/not executed.

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
- Task 2: **COMPLETE / GREEN** at `8f7cfca4c0a4b03477955d1b3b0646b9ad35b165`; Validate #1440 / run `35463540113` SUCCESS.
- Task 3: **COMPLETE / GREEN** at `01c10746aa1bf24c406b634d8b53efd5a69aff6f`; Validate #1447 / run `35464678996` SUCCESS.
- Task 4: **COMPLETE / GREEN** at `f85a6aa8623f2cf79fdf0a9a8115d69bc5226309`; Validate #1450 / run `35466359982` SUCCESS.
- Task 5: **COMPLETE / GREEN** at `ca26a0f48527a0e8f5371655bec0cc6c59b3a951`; Validate #1453 / run `35467142766` SUCCESS.
- Task 6: **COMPLETE / GREEN** at `91b60e61064a660ca942ef61d3b2b968ffc654da`; Validate #1456 / run `35468442271` SUCCESS.
- Task 7: **COMPLETE / GREEN** at `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`; Validate #1460 / run `35469241957` SUCCESS after authoritative RED #1458.
- Task 8: **COMPLETE / GREEN AUDIT** on candidate `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`.
- Task 9: **COMPLETE / STAGING HOMOLOGATED** on SHA `8a43d10e02821aca2a839394e3bd6d1daf15fdc8`; Deploy staging #186 / run `35469861985` SUCCESS; manual QA **34 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**.
- Task 10: NOT STARTED.
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


## Tasks 2–5 consolidated evidence

The user intentionally deferred canonical documentation updates during Tasks 2–4 and requested consolidation at Task 5. The following evidence is recorded now without rewriting historical commits.

### Task 2 — Catalog API, commands and official deletion effect

- RED: `cd2ed96624b29793d289e5d3405fecb5f8c1d704`; Validate #1438 / run `35463215995` — expected command/API/`deletedProductId` failures.
- Production GREEN candidate: `61a46701e666b6bfc3acc3b8c3352c106471d66f`.
- Final characterization alignment: `8f7cfca4c0a4b03477955d1b3b0646b9ad35b165`.
- Validate #1440 / run `35463540113`: **SUCCESS**, 1,828 tests / 1,827 pass / 0 fail / 1 skipped.
- `catalogApi` and `useCatalogCommands` own create/update/delete; legacy product APIs are absent from `src/api/client.js`; delete applies `{ deletedProductId }`.
- Product caller of `updateCollection` is removed, but the runtime method itself remains for Task 6.

### Task 3 — Administrative projection and interaction regression protection

- Early characterization commits exposed test-harness assumptions around navigator/timers; those were corrected before accepting the authoritative RED.
- Authoritative RED: `6cf21d7a6930f8ba22063ed76fc2c497b6d5f4fd`; Validate #1445 / run `35464412859` — exactly one intended missing-`catalogList.js` failure.
- Production projection: `bb174bdd0eb30fcca2b246ee150575712901ce03`; final alignment: `01c10746aa1bf24c406b634d8b53efd5a69aff6f`.
- Validate #1447 / run `35464678996`: **SUCCESS**, 1,836 tests / 1,835 pass / 0 fail / 1 skipped.
- Search/filter/grouping preserves pt-BR lowercasing, no accent folding, price `String(price)` matching, legacy `Outros` fallback and original official order. Delete/bulk/long-press behavior is characterized without UX change.

### Task 4 — Draft/editor/dialog ownership

- RED: `33155835d2105681ee3bd9a826295ff920a04eb2`; Validate #1448 / run `35464932138` — four intended missing draft/editor/dialog/public-boundary failures.
- Production GREEN candidate: `f31d4cda695c613c6d1e8bfd7f796be1d5b239be`; final ownership-characterization alignment: `f85a6aa8623f2cf79fdf0a9a8115d69bc5226309`.
- Validate #1450 / run `35466359982`: **SUCCESS**, 1,848 tests / 1,847 pass / 0 fail / 1 skipped.
- Catalog owns `productDraft`, `useProductEditor`, and `ProductEditorDialog`. The internal new-product seed remains 32 while ProductForm preserves the observed one-time `R$ 0,00` display for a new item; edit price is preserved. Legacy size/category fallbacks remain equivalent.

### Task 5 — Stable CatalogWorkspace and final public boundary

- RED: `26da9d33c316edd1d6a825960bea2fcbe93dc9ac`; Validate #1451 / run `35466813331` — five intended workspace/public-entry/App-composition failures.
- Production GREEN: `27e8312630736f1ff467cb39c4a7587f4672445e`.
- Validate #1452 identified only stale ownership characterizations plus two defects in new test assumptions (custom Button text nesting and unsupported accent-folding expectation); production was not changed for those.
- Final test alignment: `ca26a0f48527a0e8f5371655bec0cc6c59b3a951`.
- Validate #1453 / run `35467142766`: **SUCCESS**, 1,852 tests / 1,851 pass / 0 fail / 1 skipped; architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 all green.
- `CatalogWorkspace` stays mounted within the authenticated App tree. `visible` controls only Products list rendering, preserving editor draft/modal across normal navigation while resetting list-local selection/accordion state; authenticated-tree unmount resets the editor.
- App now owns only Catalog composition inputs: official `products[]`, query state/callbacks, capability, writesBlocked, official effects/request key and global feedback callbacks.
- Temporary Catalog public exports are removed. Final public entry: `CatalogWorkspace`, `CATEGORY_ICON_NAMES`, `PRODUCT_CATEGORIES`, `categoryForUi`, `formatProductPresentation`.
- Task 6 is next and owns physical removal of the generic runtime `updateCollection` escape hatch.


## Task 6 — physical removal of updateCollection

- RED: `6e743157df04a584086e693dd284f6fb23cf0be6`; Validate #1455 / run `35468303745` — expected single runtime-contract failure because `updateCollection` still existed.
- RED totals: **1,853 tests / 1,851 pass / 1 fail / 1 skipped**.
- GREEN: `91b60e61064a660ca942ef61d3b2b968ffc654da`; Validate #1456 / run `35468442271` — **SUCCESS**, **1,853 tests / 1,852 pass / 0 fail / 1 skipped**.
- Full gates green: architecture, lint, frontend build, production Worker dry-run, staging Worker dry-run, local D1 migrations and Spec B D1 clean-install/upgrade.
- The generic runtime `updateCollection` block, returned property and `useMemo` dependency were removed. No alternative generic mutation setter was introduced.
- Existing official effects remain the mutation contract, including `deletedClientId`, `deletedProductId`, product/client upserts, Finance effects and payment/table receipts.
- C8 Task 7 is responsible for permanent architecture enforcement against reintroduction; Task 6 itself does not change the allowlist or checker.


## Task 7 — permanent Catalog architecture enforcement

- RED: `c242e48dbcae61f72fe5eb5a6ecfccb68a76c474`; Validate #1458 / run `35469069713` — **FAIL as intended** at Test.
- RED totals: **1,860 tests / 1,853 pass / 6 fail / 1 skipped**. The six failures were the expected absent C8 guards: deep imports/cross-domain restrictions, legacy owners/API, App/runtime ownership, shared bypass/metadata and Catalog-domain browser access. The positive fixture passed.
- Enforcement commit: `faff34de29eb12a882177d9b7700bbbb9cd1f51c`.
- Corrective normal commit: `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`, fixing the shared-catalog guard scope after review; no history rewrite/force push.
- Validate #1460 / run `35469241957`: **SUCCESS**, **1,860 tests / 1,859 pass / 0 fail / 1 skipped**. Architecture/lint/build/production Worker dry-run/staging Worker dry-run/local D1/Spec B D1 all passed.
- Permanent rules now reject: external Catalog deep imports; Catalog imports from Orders/Finance/Table Service/Printing/QZ; legacy Products/ProductForm owners; legacy product CRUD API exports including aliases; product editor/command ownership returning to App; production `updateCollection`; direct frontend `shared/productCatalog.js` bypasses; frontend metadata returning to shared; browser/fetch usage in Catalog domain.
- Positive paths remain allowed: Orders → Catalog public entry, Catalog internal imports, Catalog → shared cross-runtime product contract.
- `scripts/architecture/legacy-import-allowlist.json` was not changed.

## Task 8 — full gate and candidate audit

- Candidate: `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`.
- Validate #1460 / run `35469241957` SUCCESS with **1,860 / 1,859 / 0 / 1**.
- Full workflow gates: tests PASS; architecture PASS; lint PASS; build PASS; Wrangler 4.128.0 production dry-run PASS; Wrangler 4.128.0 staging dry-run PASS; local D1 migrations PASS; Spec B D1 clean-install/upgrade PASS with 25 migrations.
- Diff audit against base `a7a8285ee125d90058c739f52daba6c170921adb`: no Worker, migrations, workflows, `package.json`, lockfile, `src/product-form.css`, `src/product-selection.css` or `src/components/Modal.jsx` changes. Orders changes are only public-entry import rewrites plus proportional tests; cart and checkout logic are unchanged.
- Shared removes frontend-only Catalog metadata while keeping the cross-runtime category/validation/formatting contract. Legacy product CRUD remains absent from `src/api/client.js`; runtime `updateCollection` remains absent.
- The PR event #1460 checked out merge-ref `8ef861e5facb7326b27dcdab120a0e10ffa59cad`. GitHub commit metadata confirms its tree `b2a2376a65270f50f891c06196b9acb7a3637134` is identical to the feature HEAD tree. We therefore record equivalent tested contents without falsely claiming a branch `workflow_dispatch` run.

## Task 9 — staging and proportional QA

- Status: **IN PROGRESS / BLOCKED BEFORE DEPLOY**.
- Required deployment target remains `feature/spec-c8-catalog` through the existing `.github/workflows/deploy-staging.yml` workflow.
- The workflow only auto-runs on `feature/spec-b-settings-policies`; C8 requires `workflow_dispatch`.
- The connected GitHub toolset can read workflow runs/jobs/logs but does not expose workflow dispatch. The isolated execution shell has no `gh`, `GH_TOKEN`, `GITHUB_TOKEN`, `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` credentials.
- We did **not** alter workflow triggers, secrets or deployment code to bypass the intended control.
- No staging deployment has occurred for C8 yet. Therefore no manual case is marked PASS by inference. The QA matrix is created at `docs/superpowers/qa/spec-c8-catalog-qa.md` with all cases PENDING until a real staging run exists.
- Production remains untouched; PR #52 remains draft/open; no merge.


## Task 9 closure — staging deployed and manual QA complete

- The user manually dispatched `.github/workflows/deploy-staging.yml` on `feature/spec-c8-catalog` after the tooling blocker was documented.
- Deploy staging #186 / run `35469861985`: **SUCCESS** with `head_sha=8a43d10e02821aca2a839394e3bd6d1daf15fdc8`.
- The workflow reran tests, architecture, lint, build, local D1 and staging Worker dry-run successfully before deploying.
- Remote staging D1 showed no pending migrations during both listing/application steps. Staging PIN configuration succeeded.
- Staging deployment succeeded at `https://sistema-para-delivery-staging.vzaponi.workers.dev`; Cloudflare Current Version ID: `28e2622f-c904-4959-8433-33c9691661f3`.
- Readiness succeeded on attempt 1/6; actual staging login smoke returned HTTP 200.
- Manual QA execution: cases 1–29 and 31–35 were explicitly reported **PASS** by the user. Case 30 (restricted/read-only capability) is **BLOCKED** because staging has no suitable capability-restricted identity. Final matrix: **34 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**.
- The blocked capability case is accepted as a fixture limitation, not converted to PASS. No FAIL/PENDING remains.
- No code correction was needed, so no re-stage cycle was required.
- Staged/homologated SHA remains `8a43d10e02821aca2a839394e3bd6d1daf15fdc8`. The following documentation closure commit is intentionally later and must not replace the homologated executable SHA in evidence.
- Production remains untouched; PR #52 remains draft/open; no merge.


## Task 10 — pre-merge closure

- Input state: Tasks 1–9 complete; staging homologated at `8a43d10e02821aca2a839394e3bd6d1daf15fdc8`; QA **34 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**.
- Last application-code change remains `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`. No code correction occurred during or after homologation.
- Documentation-only closure commit before this final pre-merge update: `fa7a14fd46df5133cce5073dd5bdf3c3242776a7`; Validate #1462 / run `35471370382` SUCCESS with **1,860 / 1,859 / 0 / 1** and all workflow gates green.
- Git comparison from staged SHA to that docs closure contains documentation files only. PR #52 has no unresolved review threads or submitted reviews.
- Compatibility audit: C8 has no surviving temporary facade; legacy product owners/API exports and runtime `updateCollection` are removed and architecture-enforced; Catalog public entry is minimal and deliberate.
- Merge gate protocol: create this final documentation-only HEAD, run full Validate on that exact HEAD, re-check PR SHA/state/draft, then request separate explicit user merge authorization. Task approval is not merge approval.
- No production deploy and no automatic C9 start.
