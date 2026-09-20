# Spec C10 — Architectural Closure and Cleanup

**Project:** Gestão Delivery / Amor & Sabor  
**Repository:** `vzaponi-dotcom/sistema-para-delivery`  
**Date:** 2026-09-20  
**Base:** post-C9 `master` at `2b5060c8293fec6756b286627212b740b3147e53`  
**Branch:** `feature/spec-c10-architecture-closure`  
**Status:** **APPROVED — design approved explicitly by the user on 2026-09-20; implementation not started**

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

### 3.3 Frontend shared ownership is still split across generic legacy roots

The final target in the parent Spec C includes frontend-only `shared/ui`, `shared/hooks` and `shared/utils`, but post-C9 production code still uses `src/components/`, `src/hooks/` and `src/utils/` as generic roots.

The post-C9 consumer audit shows three different cases that must not be conflated:

- genuinely multi-owner UI primitives such as `Button`, `Modal`, `ConfirmationDialog`, `PageHeader`, `SystemSelect`, `StatCard`, `BottomSheet` and `Icon`;
- app/domain-owned modules that merely survived in the generic root, such as login/theme shell pieces, Dashboard-only charts, payment/printing presentation components and runtime `dataSync`;
- genuinely generic pure helpers such as `useMediaQuery` and `formFormatting`.

One important final-boundary leak is already concrete: `src/domains/catalog/domain/productDraft.js` imports `src/utils/formFormatting.js`. The helper is pure and multi-domain, so its final owner is frontend shared utilities rather than Catalog or the legacy `src/utils` root.

`src/utils/bodyScrollLock.js` has no production consumer on the post-C9 base while `src/components/scrollLock.js` is the active overlay lock implementation. If the Task 1 dependency audit still confirms zero production consumers, the dead duplicate must be deleted rather than migrated.

C10 must classify these modules by real consumers and responsibility. It must not bulk-move files merely to empty directories, but it also must not declare generic legacy roots permanent when a clear final owner exists.

### 3.4 App still owns a Dashboard business projection

`App.jsx` calculates Dashboard totals using Orders and Finance rules before passing a `totals` object to Dashboard. That projection belongs to the Dashboard surface.

C10 will move only the Dashboard projection to the Dashboard surface. Cross-domain orchestration that genuinely belongs at app composition level remains app-owned.

### 3.5 Browser storage is still accessed directly by App

`App.jsx` directly reads/writes the kitchen sound preference via `localStorage` and passes `window.sessionStorage` into the settings policy boundary.

C10 will isolate these environmental details behind small infrastructure/storage helpers. It will not introduce a generic storage framework.

The focus-restoration call using `requestAnimationFrame/document.querySelector` is UI-composition behavior and is not treated as a domain rule.

### 3.6 CSS ownership is partially legacy

The following root CSS files have clear owners and can be moved mechanically while preserving contents and import order:
- `src/dashboard.css` → Dashboard surface;
- `src/new-order.css` → Orders UI;
- `src/client-duplicate.css` → Customers UI;
- `src/product-form.css` → Catalog UI;
- `src/finance-mobile.css` → Finance UI;
- `src/print-queue.css` → Printing UI.

C10 will not move every global stylesheet. Files such as `App.css`, `central-data.css`, theme/shell/navigation/settings foundations remain in place when moving them adds cascade risk without closing a real ownership debt.

### 3.7 Migration allowlist is empty but still present

`scripts/architecture/legacy-import-allowlist.json` contains only empty arrays. C10 should delete it and keep the checker safe with an implicit empty allowlist.

### 3.8 Final architecture gates are still slice-shaped

The checker contains strong C3–C9 rules but final closure still needs generic rules that outlive those migrations:
- no production modules under legacy roots `src/api/`, `src/pages/`, `src/printing/`, `src/components/`, `src/hooks/` or `src/utils/` after their C10 owners are established;
- no App import from those legacy roots;
- frontend `src/shared/**` cannot import domains;
- every `src/domains/*/domain/**` layer is generically free of React, QZ, infrastructure/UI, browser globals and direct `fetch`;
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
      theme/
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
  shared/
    ui/
    hooks/
    utils/
```

The repository-level `shared/` directory outside `src/` remains the separate cross-runtime contract area used by frontend and Worker.

By C10 acceptance there should be no production JS/JSX/MJS owner under `src/api/`, `src/pages/`, `src/printing/`, `src/components/`, `src/hooks/` or `src/utils/`. Test-only historical paths do not themselves create runtime ownership, but tests should be moved with their owners when that improves clarity. No permanent production exception is approved by this design.

Root/global CSS is different: a stylesheet may remain at `src/` when its cascade is intentionally application-global or moving it adds regression risk without improving ownership.

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

## 8. Frontend shared and residual-owner decision

C10 establishes the frontend-only `src/shared/` area deliberately. It is distinct from the repository-level `shared/` cross-runtime contracts.

### 8.1 `src/shared/ui`

Move genuinely reusable, multi-owner presentation primitives here, preserving component behavior and accessibility contracts. The audited candidates are:

- `BottomSheet`;
- `Button`;
- `ConfirmationDialog`;
- `Icon`;
- `Modal`;
- `PageHeader`;
- `StatCard`;
- `StatusBadge`;
- `SystemSelect`;
- the active overlay `scrollLock`;
- `DashboardBarChart` and `DashboardPeriodSelector`, because each has real Dashboard and Orders/operational-analysis consumers.

No global `src/shared/index.js` mega-barrel is required. Consumers may import the specific shared module.

### 8.2 `src/shared/hooks`

Move `useMediaQuery` here. It is browser/UI infrastructure reused independently of Table Service semantics.

### 8.3 `src/shared/utils`

Move pure `formFormatting` here. It has real Customers, Orders, Finance and Catalog consumers and is safe for domain-layer use because it contains formatting/parsing only and no React, browser globals or infrastructure.

### 8.4 App-owned residuals

Move residual app-specific modules out of the generic component/util roots:

- `BrandLogo`, `ConnectionBanner` and `LoginScreen` → app shell;
- `ThemeProvider`, `themeContext` and `utils/theme.js` → app shell/theme;
- `utils/dataSync.js` → `app/runtime/data`.

These are not frontend-shared merely because they were historically in generic folders.

### 8.5 Surface/domain-owned residuals

Move modules with a clear owner:

- Dashboard-only `DashboardLineChart` and `DashboardPaymentMix` → Dashboard surface;
- `PaymentBadge` and its styling → Orders UI;
- `OrderTicketPreview`, `TableTabTicketPreview` and `PrintStatusBadge` → Printing UI.

If Orders or an app surface still consumes a Printing-owned presentation component after the move, that component becomes a **deliberate minimal export** from `src/domains/printing/index.js`; it must not be exposed by a compatibility reexport. The final public-contract audit must prove each such export has a real external consumer.

### 8.6 Dead duplicate

`src/utils/bodyScrollLock.js` is deleted only after the implementation-plan baseline reconfirms no production consumer. C10 must not preserve dead code solely to avoid deletion.

### 8.7 Shared boundary rule

Frontend `src/shared/**` may depend on React where appropriate for UI/hooks, but it must not import any domain. Pure shared utils must remain free of app/domain/infrastructure ownership.

## 9. Storage decision

Create small adapters under `src/infrastructure/storage/` for:
- kitchen sound preference read/write;
- current session-storage access used by the policy editor.

No new state store, provider or storage abstraction layer is introduced.

Storage keys and failure fallbacks remain exactly the same.

## 10. CSS decision

CSS moves are mechanical:
- contents must remain byte-equivalent unless an import path requires no-content change;
- load order must be preserved where App currently owns ordering;
- light/dark and responsive behavior must remain unchanged;
- dedicated source-contract tests prove old paths disappear and new owner paths are imported.

No CSS redesign is authorized.

## 11. Architecture checker decision

C10 adds final, generic enforcement that describes the finished architecture rather than a migration phase:

1. **Legacy production root gate**
   - reject non-test JS/JSX/MJS source under `src/api/`, `src/pages/`, `src/printing/`, `src/components/`, `src/hooks/` and `src/utils/`.

2. **App legacy-root import gate**
   - reject App imports into those legacy production roots.

3. **Frontend shared boundary**
   - `src/shared/**` cannot import `src/domains/**`.

4. **Generic domain purity**
   - every `src/domains/*/domain/**` module is rejected if it imports React, QZ, infrastructure or UI;
   - browser globals such as `window`, `document`, `localStorage`, `sessionStorage`, `navigator` and direct `fetch` are rejected generically, not only for Catalog/Printing.

5. **External domain contract**
   - non-domain and peer-domain consumers may enter a domain only through its public `index.js`, subject to explicit stricter one-way rules already established by prior slices.

6. **Domain-cycle gate**
   - build a domain-to-domain graph from production imports;
   - a dependency through another domain's public `index.js` is allowed only if the resulting domain graph remains acyclic;
   - test fixtures prove a public-entry cycle is rejected.

7. **QZ confinement**
   - production `qz-tray` imports remain restricted to `src/infrastructure/qz/**`.

8. **Migration allowlist removal**
   - delete `legacy-import-allowlist.json`;
   - no replacement migration allowlist is created;
   - permanent exceptions, if ever needed in the future, require an explicit architecture contract rather than silently reopening the migration mechanism.

Historical C3–C9 checks may remain as regression guards when they still add value, but C10 acceptance must pass the generic rules above.

## 12. App final-ruling

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

## 13. Final Spec C audit

C10 must explicitly audit all 18 final success criteria in the parent Spec C design.

The audit must classify each criterion as:
- PASS with concrete file/gate evidence;
- DEFERRED-PRODUCTION only when the criterion is specifically release-hardware dependent;
- FAIL if an architectural debt survives.

The C9 physical matrix is separate from architecture completion. It remains mandatory before production.

## 14. Testing and QA

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

## 15. Out of scope

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

## 16. Completion condition

C10 is complete only when:
- the final compatibility facade ledger has no temporary row;
- legacy production roots `src/api`, `src/pages`, `src/printing`, `src/components`, `src/hooks` and `src/utils` contain no production JS/JSX/MJS owner;
- frontend `src/shared/ui`, `src/shared/hooks` and `src/shared/utils` exist with only genuinely shared owners;
- app/domain-specific residuals from the old generic roots have moved to their real owners;
- the empty migration allowlist is removed;
- Dashboard is an application surface;
- browser storage details are isolated;
- targeted CSS ownership cleanup is complete without visual regression;
- generic domain-purity, public-entry, QZ and cycle rules pass;
- the six domain public contracts are audited and contain only real consumers;
- the 18 Spec C criteria are audited;
- final staging is homologated;
- exact-head Validate is green;
- merge receives explicit user authorization;
- post-merge master Validate is green.

At that point **Spec C architecture is complete**. Production readiness still requires the deferred C9 physical release gate.
