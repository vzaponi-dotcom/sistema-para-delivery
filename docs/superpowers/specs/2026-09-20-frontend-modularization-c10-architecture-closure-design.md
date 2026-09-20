# Spec C10 — Architectural Closure and Cleanup

**Project:** Gestão Delivery / Amor & Sabor  
**Repository:** `vzaponi-dotcom/sistema-para-delivery`  
**Date:** 2026-09-20  
**Base:** post-C9 `master` at `2b5060c8293fec6756b286627212b740b3147e53`  
**Branch:** `feature/spec-c10-architecture-closure`  
**Status:** **DRAFT FOR REVIEW — implementation not started**

## 1. Purpose

C10 is the final architectural slice of Spec C. It does not introduce a new business feature or redesign. Its job is to remove the last migration scaffolding, place the remaining clearly-owned frontend pieces under their final owners, tighten architecture gates to the final target, and prove that Spec C's 18 final success criteria are satisfied.

C10 must preserve all functional behavior established through C1–C9. The only release-policy exception already approved is the C9 physical QZ round: it may remain `DEFERRED-PRODUCTION` through C10 merge, but it remains a hard blocker for any production deployment.

## 2. Post-C9 facts

C9 merged through PR #53 at `2b5060c8293fec6756b286627212b740b3147e53`. Post-merge Validate #1513 / run `35514989203` passed with **1,911 tests / 1,910 pass / 0 fail / 1 skipped** and all remaining gates green.

The current architecture already has:
- six explicit domain roots under `src/domains/`: orders, table-service, finance, customers, catalog and printing;
- QZ production ownership isolated under `src/infrastructure/qz/`;
- empty migration allowlists for direct QZ imports and cross-domain internals;
- no production files remaining under `src/printing/`;
- domain public entries already enforced for external consumers;
- cross-domain payment/refund workflows outside domains.

C10 therefore closes residual structure; it does not re-extract the six domains.

## 3. Remaining debts found on the post-C9 master

### 3.1 Legacy API facade

`src/api/client.js` still:
- reexports `apiRequest`, `withJson`, `getSession`, `login`, `logout`;
- owns `getBootstrap`;
- exposes a compatibility-only `deleteOrder` that throws.

The only live production bootstrap consumer is `src/app/runtime/data/useOperationalDataRuntime.js`.

`src/api/effectiveConfigClient.js` still depends on `src/api/client.js` for `apiRequest` and is consumed by `src/app/useEffectiveBusinessConfig.js`.

This is the final compatibility-ledger row and must disappear in C10.

### 3.2 Dashboard is still a legacy page/util owner

`src/pages/Dashboard.jsx` is the last production file under `src/pages/`. It is a composition surface by Spec C, not a domain.

`src/utils/dashboardAnalytics.js` contains Dashboard-owned projections while importing the public Orders contract.

`AppShell` still owns `DashboardPeriodProvider`, creating a dashboard-specific dependency in the global shell.

C10 will make Dashboard an explicit app surface and remove this shell dependency without changing Dashboard UX.

### 3.3 App still owns a Dashboard business projection

`App.jsx` calculates Dashboard totals using Orders and Finance rules before passing a `totals` object to Dashboard. That projection belongs to the Dashboard surface.

C10 will move only the Dashboard projection to the Dashboard surface. Cross-domain orchestration that genuinely belongs at app composition level remains app-owned.

### 3.4 Browser storage is still accessed directly by App

`App.jsx` directly reads/writes the kitchen sound preference via `localStorage` and passes `window.sessionStorage` into the settings policy boundary.

C10 will isolate these environmental details behind small infrastructure/storage helpers. It will not introduce a generic storage framework.

The focus-restoration call using `requestAnimationFrame/document.querySelector` is UI-composition behavior and is not treated as a domain rule.

### 3.5 CSS ownership is partially legacy

The following root CSS files have clear owners and can be moved mechanically while preserving contents and import order:
- `src/dashboard.css` → Dashboard surface;
- `src/new-order.css` → Orders UI;
- `src/client-duplicate.css` → Customers UI;
- `src/product-form.css` → Catalog UI;
- `src/finance-mobile.css` → Finance UI;
- `src/print-queue.css` → Printing UI.

C10 will not move every global stylesheet. Files such as `App.css`, `central-data.css`, theme/shell/navigation/settings foundations remain in place when moving them adds cascade risk without closing a real ownership debt.

### 3.6 Migration allowlist is empty but still present

`scripts/architecture/legacy-import-allowlist.json` contains only empty arrays. C10 should delete it and keep the checker safe with an implicit empty allowlist.

### 3.7 Final architecture gates are still slice-shaped

The checker contains strong C3–C9 rules but final closure still needs generic rules that outlive those migrations:
- no production modules under legacy roots `src/api/`, `src/pages/`, `src/printing/`;
- no App import from those legacy roots;
- external domain consumers use public entries;
- no relevant domain dependency cycle;
- no direct QZ production import outside approved infrastructure.

The historical slice-specific checks may remain if useful, but the final target cannot rely only on migration-era token lists.

## 4. Shared-code ruling

The repository-level `shared/` directory contains semantic modules, but the post-C9 audit confirms each domain-looking shared module is also consumed by the Worker, including business policies, finance helpers, order identity/timing/print documents, print queue/state, catalog normalization and table-tab print documents.

Spec C explicitly allows modules truly shared with the Worker to remain outside `src` to avoid backend refactoring. C10 will therefore **audit and document** these modules rather than move them into frontend domains.

C10 must not modify Worker ownership merely to make the frontend tree visually cleaner.

## 5. Final target after C10

The relevant frontend target is:

```text
src/
  app/
    runtime/
    navigation/
    policy-editing/
    shell/
    surfaces/
      dashboard/
      finance/
      settings/
      table-service/
    workflows/
  domains/
    orders/
    table-service/
    finance/
    customers/
    catalog/
    printing/
  infrastructure/
    api/
    auth/
    qz/
    storage/
  components/
  utils/
```

Legacy production roots `src/api/`, `src/pages/` and `src/printing/` may contain historical test files only during migration, but C10 acceptance should leave no production owner there.

## 6. API and infrastructure decision

Create:
- `src/infrastructure/api/bootstrapApi.js`;
- `src/infrastructure/api/effectiveConfigApi.js`;
- focused tests beside those adapters.

`bootstrapApi.js` owns only the administrative bootstrap HTTP request.  
`effectiveConfigApi.js` owns only the effective-settings HTTP request.

Both use `src/infrastructure/api/httpClient.js`.

Then remove:
- `src/api/client.js`;
- `src/api/effectiveConfigClient.js`;
- compatibility-only `deleteOrder`;
- obsolete tests that characterize the old facade.

Authentication continues under `src/infrastructure/auth/sessionApi.js`.

## 7. Dashboard surface decision

Create `src/app/surfaces/dashboard/` as an application surface, not a domain.

Move:
- `src/pages/Dashboard.jsx` → `src/app/surfaces/dashboard/DashboardSurface.jsx`;
- `src/utils/dashboardAnalytics.js` → `src/app/surfaces/dashboard/dashboardAnalytics.js`;
- Dashboard-specific tests beside the surface.

The surface receives official `orders` and `movements` and composes public Orders/Finance contracts to calculate:
- today's sales;
- received today;
- receivables;
- period metrics;
- daily series;
- top products;
- payment mix.

App no longer calculates those Dashboard totals.

Remove the Dashboard period provider/context from `AppShell`. The Dashboard surface consumes `queryState.period` directly and calls `onQueryChange`, preserving the same query state and UX.

Shared chart primitives that are also used outside Dashboard remain shared components.

## 8. Storage decision

Create small adapters under `src/infrastructure/storage/` for:
- kitchen sound preference read/write;
- current session-storage access used by the policy editor.

No new state store, provider or storage abstraction layer is introduced.

Storage keys and failure fallbacks remain exactly the same.

## 9. CSS decision

CSS moves are mechanical:
- contents must remain byte-equivalent unless an import path requires no-content change;
- load order must be preserved where App currently owns ordering;
- light/dark and responsive behavior must remain unchanged;
- dedicated source-contract tests prove old paths disappear and new owner paths are imported.

No CSS redesign is authorized.

## 10. Architecture checker decision

C10 adds final, generic enforcement:

1. **Legacy production root gate**
   - reject non-test source under `src/api/`, `src/pages/`, `src/printing/`.

2. **App legacy-root import gate**
   - reject App imports into those legacy roots.

3. **Domain-cycle gate**
   - build a domain-to-domain graph from imports;
   - a domain dependency through another domain's public `index.js` is allowed only if the resulting domain graph remains acyclic;
   - test fixtures prove a public-entry cycle is rejected.

4. **Migration allowlist removal**
   - delete `legacy-import-allowlist.json`;
   - absent file means empty allowlist.

5. Preserve all existing deep-import, domain purity and QZ rules.

## 11. App final-ruling

C10 does not attempt to make `App.jsx` tiny for its own sake.

App may still own:
- high-level session/navigation composition;
- capability projection;
- cross-domain workflow wiring;
- top-level success/error routing;
- selected table/comanda orchestration where it bridges surfaces;
- composition callbacks.

App must not own:
- CRUD implementation;
- domain API endpoints;
- domain rule implementations;
- Dashboard calculations;
- browser storage details;
- Printing QZ internals;
- legacy page/API owners.

## 12. Final Spec C audit

C10 must explicitly audit all 18 final success criteria in the parent Spec C design.

The audit must classify each criterion as:
- PASS with concrete file/gate evidence;
- DEFERRED-PRODUCTION only when the criterion is specifically release-hardware dependent;
- FAIL if an architectural debt survives.

The C9 physical matrix is separate from architecture completion. It remains mandatory before production.

## 13. Testing and QA

Every code-changing task follows RED → GREEN.

Full slice gates:
- `npm test`;
- `npm run lint`;
- `npm run test:architecture`;
- `npm run build`;
- production and staging Worker dry-runs;
- local D1;
- Spec B D1 install/upgrade.

C10 staging manual QA is a final application smoke across navigation, Dashboard, Orders, Table Service, Finance, Customers, Catalog, Settings and Print Queue.

Physical QZ output is not required to merge C10 under the approved deferred-production policy, but production remains blocked until the full deferred C9 matrix passes on the final post-C10 staging release candidate.

## 14. Out of scope

C10 does not:
- deploy production;
- redesign screens;
- change business rules;
- change polling;
- change Worker routes/schema/migrations;
- introduce React Router;
- implement Spec D;
- implement users/profiles;
- replace QZ;
- perform broad CSS modernization.

## 15. Completion condition

C10 is complete only when:
- the final compatibility facade ledger has no temporary row;
- legacy production roots are closed;
- the empty migration allowlist is removed;
- Dashboard is an application surface;
- browser storage details are isolated;
- targeted CSS ownership cleanup is complete without visual regression;
- final architecture rules and cycle checks pass;
- the 18 Spec C criteria are audited;
- final staging is homologated;
- exact-head Validate is green;
- merge receives explicit user authorization;
- post-merge master Validate is green.

At that point **Spec C architecture is complete**. Production readiness still requires the deferred C9 physical release gate.
