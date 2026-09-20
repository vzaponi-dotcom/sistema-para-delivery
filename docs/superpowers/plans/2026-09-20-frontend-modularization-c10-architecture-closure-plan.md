# Spec C10 — Architectural Closure and Cleanup Implementation Plan

> Execute task-by-task with strict RED→GREEN. Do not deploy production.

**Status:** **PRELIMINARY DRAFT — DESIGN UPDATED; REALIGN AFTER DESIGN APPROVAL — NOT STARTED**  
**Base:** post-C9 `master` `2b5060c8293fec6756b286627212b740b3147e53`  
**Branch:** `feature/spec-c10-architecture-closure`  
**Design:** `docs/superpowers/specs/2026-09-20-frontend-modularization-c10-architecture-closure-design.md`

> **Planning note — 2026-09-20:** the design was tightened after this first task draft to close `src/components/`, `src/hooks/`, `src/utils/` and establish `src/shared/{ui,hooks,utils}` by real ownership. This task list is therefore **non-executable preliminary material** until it is realigned after explicit design approval.

## Global constraints

- Never implement on `master`.
- Preserve all business behavior, API routes/payloads, polling, storage keys, capabilities, copy policy and synchronization semantics.
- No Worker/migration/schema change unless a proven blocker is separately approved.
- No production deploy.
- C9 hardware QA remains `DEFERRED-PRODUCTION`; C10 must not mark it PASS.
- Any behavior-changing QA fix requires RED→GREEN, Validate, staging redeploy and affected retest.
- C10 implementation must not begin until this plan is explicitly approved.

---

## Task 1 — Baseline, dependency map and C9→C10 handoff

**Files**
- Create/update `docs/superpowers/qa/spec-c10-architecture-closure-execution.md`
- Update `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
- Update `docs/superpowers/qa/spec-c-execution-ledger.md`

### RED / evidence
No behavior RED. This is an evidence checkpoint.

Record:
- base/master `2b5060c8293fec6756b286627212b740b3147e53`;
- post-C9 Validate #1513 / run `35514989203`;
- current branch HEAD;
- no production deploy;
- C9 deferred physical gate still active.

Refresh the dependency map:
- App imports;
- all production consumers of `src/api/*`;
- production files under `src/pages`, `src/api`, `src/printing`;
- App direct browser/storage accesses;
- domain-to-domain import graph;
- clearly-owned root CSS;
- root `shared/` Worker consumers.

### GREEN
Commit the evidence-only baseline and require full Validate on exact branch HEAD.

**Exit:** baseline green, no code changed.

---

## Task 2 — Remove the legacy API facade

**Create**
- `src/infrastructure/api/bootstrapApi.js`
- `src/infrastructure/api/bootstrapApi.test.js`
- `src/infrastructure/api/effectiveConfigApi.js`
- `src/infrastructure/api/effectiveConfigApi.test.js`

**Modify**
- `src/app/runtime/data/useOperationalDataRuntime.js`
- `src/app/useEffectiveBusinessConfig.js`
- source-contract tests that import the old facade
- architecture checker tests

**Delete**
- `src/api/client.js`
- `src/api/effectiveConfigClient.js`
- obsolete old-owner tests, after equivalent coverage exists

### RED
Add tests asserting:
- runtime bootstrap comes from `infrastructure/api/bootstrapApi.js`;
- effective config comes from `infrastructure/api/effectiveConfigApi.js`;
- neither adapter imports `src/api/client.js`;
- old production files are absent;
- auth still comes from `infrastructure/auth/sessionApi.js`;
- `deleteOrder` compatibility export is absent.

Expected RED: old files/imports still exist.

### GREEN
Move request code without changing:
- `/api/bootstrap`;
- `knownEffectiveConfigVersion`;
- `/api/settings/effective`;
- `knownVersion`;
- HTTP error semantics.

Run focused API/runtime tests, then full Validate.

**Exit:** no production code depends on `src/api/client.js`; compatibility-ledger row can be closed.

---

## Task 3 — Establish the Dashboard application surface and remove App-owned Dashboard rules

**Create/move**
- `src/app/surfaces/dashboard/DashboardSurface.jsx`
- `src/app/surfaces/dashboard/dashboardAnalytics.js`
- focused surface/tests

**Modify**
- `src/App.jsx`
- `src/app/shell/AppShell.jsx`
- Dashboard tests
- query/source-contract tests

**Delete**
- `src/pages/Dashboard.jsx`
- `src/utils/dashboardAnalytics.js`
- `src/components/DashboardPeriodProvider.jsx`
- `src/components/dashboardPeriodContext.js` if no consumer remains

### RED
Add ownership tests asserting:
- no production `src/pages/Dashboard.jsx`;
- no `src/utils/dashboardAnalytics.js`;
- AppShell has no Dashboard-specific provider;
- App has no Dashboard `totals` projection;
- DashboardSurface consumes `queryState.period` and public domain contracts.

Expected RED: all old ownership is still present.

### GREEN
Move the Dashboard page/analytics and calculate Dashboard totals inside the surface.

Preserve:
- period values `today/7d/30d`;
- privacy eye behavior;
- labels;
- charts;
- cancelled-order exclusion;
- payment mix;
- date/local-time semantics.

Keep shared chart primitives in `src/components` when they have non-Dashboard consumers.

Run Dashboard tests + navigation/shell tests + full Validate.

**Exit:** `src/pages/` contains no production page.

---

## Task 4 — Isolate App browser-storage details

**Create**
- `src/infrastructure/storage/kitchenSoundPreference.js`
- `src/infrastructure/storage/kitchenSoundPreference.test.js`
- `src/infrastructure/storage/sessionStorage.js`
- focused tests

**Modify**
- `src/App.jsx`
- settings policy boundary composition tests

### RED
Require:
- App source contains no `localStorage` or `sessionStorage`;
- kitchen sound storage key remains exactly `kitchen-sound-enabled`;
- read fallback remains enabled on storage failure;
- write failure still yields the same user-facing feedback;
- settings policy pending storage receives the same browser session storage instance through the adapter.

### GREEN
Move only environmental access. Do not move policy semantics or sound behavior.

The existing focus restoration using DOM/requestAnimationFrame remains app-shell UI composition unless a focused test proves moving it is necessary.

Run focused storage/settings/sound tests + full Validate.

**Exit:** App no longer owns persistent browser-storage mechanics.

---

## Task 5 — Perform targeted CSS ownership relocation

**Move byte-equivalently**
- `src/dashboard.css` → `src/app/surfaces/dashboard/dashboard.css`
- `src/new-order.css` → `src/domains/orders/ui/new-order.css`
- `src/client-duplicate.css` → `src/domains/customers/ui/client-duplicate.css`
- `src/product-form.css` → `src/domains/catalog/ui/product-form.css`
- `src/finance-mobile.css` → `src/domains/finance/ui/finance-mobile.css`
- `src/print-queue.css` → `src/domains/printing/ui/print-queue.css`

**Modify**
- imports only;
- path-sensitive CSS/source tests.

### RED
Add a relocation contract that:
- requires new paths;
- rejects old root paths;
- requires the same import ordering for the files still imported from App;
- asserts no CSS contents are intentionally changed.

### GREEN
Move files mechanically and update imports.

Do not relocate unrelated root CSS.

Run mobile/light-dark source regressions, build, then full Validate.

**Exit:** clearly-owned C10 CSS debt closed with no redesign.

---

## Task 6 — Remove migration scaffolding and close the facade ledger

**Modify**
- architecture checker loader/tests
- `docs/superpowers/qa/spec-c-compatibility-facades.md`

**Delete**
- `scripts/architecture/legacy-import-allowlist.json`

### RED
Add tests asserting:
- the allowlist file is absent;
- missing allowlist behaves as an empty object;
- no temporary facade row remains in the compatibility ledger;
- old API compatibility exports cannot be reintroduced.

### GREEN
Delete the empty allowlist and mark the final `src/api/client.js` compatibility row REMOVED IN C10.

Do not delete historical ledger evidence; the active temporary table must contain zero unresolved rows.

Run architecture tests + full Validate.

**Exit:** migration compatibility debt = zero.

---

## Task 7 — Add final generic architecture gates and domain-cycle detection

**Modify**
- `scripts/architecture/check-import-boundaries.mjs`
- `scripts/architecture/check-import-boundaries.test.mjs`

### RED
Add negative fixtures for:
1. production `src/api/foo.js`;
2. production `src/pages/Foo.jsx`;
3. production `src/printing/foo.js`;
4. App import from a legacy production root;
5. domain A → domain B public entry + domain B → domain A public entry cycle;
6. direct external deep import into any domain;
7. QZ import outside `src/infrastructure/qz/`.

Expected RED: at least the generic legacy-root and cycle fixtures are not rejected yet.

### GREEN
Implement generic checks without weakening C3–C9 enforcement.

Cycle detection should operate on the **domain dependency graph**, not on arbitrary React component imports, and should produce a stable, readable violation.

Run architecture unit tests + `npm run test:architecture` + full Validate.

**Exit:** final architecture is enforced independently of migration-era allowlists.

---

## Task 8 — Final public-contract, shared-code and App audit

**Files**
- Create `docs/superpowers/qa/spec-c10-final-architecture-audit.md`
- focused source-contract test if needed

### Evidence audit
Record:
- public exports of all six domain `index.js` files and real external consumers;
- no external deep imports;
- no production legacy roots;
- App imports only public domain contracts and app/infrastructure composition modules;
- no CRUD/API endpoint implementation in App;
- Dashboard projection removed from App;
- root `shared/` semantic modules retained only because each has Worker consumers;
- no Worker/backend refactor introduced.

For root `shared/`, explicitly list the Worker-consumed families:
business policies, client identity, finance, order identity/display/timing/print, print context/queue/actions/station health, product catalog, settings access/catalogs, and table-tab print document.

### GREEN
If audit finds a real owner leak, write a focused RED before fixing it. Do not perform speculative moves.

Run full gate.

**Exit:** final dependency map is local/predictable and documented.

---

## Task 9 — Verify all 18 Spec C success criteria and run the exact-head gate

**Create/update**
- `docs/superpowers/qa/spec-c10-final-architecture-audit.md`
- `docs/superpowers/qa/spec-c10-architecture-closure-execution.md`
- rollout/ledger

### Audit
For each criterion 1–18 in the parent Spec C design, record:
- PASS + concrete evidence;
- FAIL if unresolved;
- `DEFERRED-PRODUCTION` only for the previously-approved physical release gate where relevant.

No criterion may be silently skipped.

### Full gate
Run:
- focused tests;
- `npm test`;
- `npm run lint`;
- `npm run test:architecture`;
- `npm run build`;
- production Worker dry-run;
- staging Worker dry-run;
- local D1;
- Spec B D1 install/upgrade.

Review diff against base `2b5060c8293fec6756b286627212b740b3147e53`.

**Exit:** executable C10 candidate GREEN.

---

## Task 10 — Final staging homologation and Spec C closure

**Create**
- `docs/superpowers/qa/spec-c10-architecture-closure-qa.md`

### Step 1 — Deploy exact C10 candidate to staging
Record exact SHA, run ID, migrations, Worker version, readiness and login HTTP.

### Step 2 — Manual final smoke matrix

Minimum matrix:
1. login/bootstrap/logout;
2. desktop navigation;
3. mobile navigation;
4. Dashboard period/privacy/charts/totals;
5. New Order + Kitchen;
6. History/cancellation;
7. Tables + Comandas;
8. Finance + A Receber;
9. Customers;
10. Catalog;
11. Settings policy save/reload;
12. Printing Settings;
13. Print Queue operational filters/history filters;
14. offline/online recovery smoke;
15. light mode;
16. dark mode;
17. mobile/responsive/UTF-8;
18. restricted capability case — BLOCKED allowed only if no suitable identity.

Physical QZ P1–P20 remain `DEFERRED-PRODUCTION` under the approved policy and are **not** converted to PASS by this matrix.

### Step 3 — Documentation closure
Update:
- execution ledger;
- rollout;
- compatibility ledger;
- final architecture audit;
- PR body.

### Step 4 — Final docs Validate
Require exact-head SUCCESS and mergeable PR with no unresolved review thread.

### Step 5 — Explicit merge authorization
Do not merge until user explicitly authorizes.

After merge:
- confirm `master` exact SHA;
- run/confirm post-merge Validate;
- mark **Spec C architecture COMPLETE**.

### Step 6 — Production gate handoff
Do **not** deploy production.

Record a hard release blocker:
- final post-C10 staging release candidate;
- C9 deferred functional rows #12/#14–21/#24/#30/#31;
- physical P1–P20;
- all must PASS before production authorization.

---

## Expected C10 code-diff boundaries

Expected production changes:
- frontend only;
- infrastructure API/storage adapters;
- Dashboard surface ownership;
- targeted CSS file moves;
- architecture checker.

Not expected:
- `worker/`;
- `migrations/`;
- D1 schema;
- API routes/payloads;
- polling constants;
- QZ execution semantics;
- business-rule changes.

## Approval gate

This plan is preliminary and not yet aligned to the latest design. **Task 1 implementation does not start until the user explicitly approves the C10 design and then the realigned implementation plan.**
