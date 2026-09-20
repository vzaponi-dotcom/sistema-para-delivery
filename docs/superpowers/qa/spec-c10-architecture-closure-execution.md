# Spec C10 — Architecture Closure Execution

**Branch:** `feature/spec-c10-architecture-closure`  
**Base/master:** `2b5060c8293fec6756b286627212b740b3147e53`  
**Status:** **PLAN APPROVED / TASK 1 COMPLETE / TASK 2 NOT STARTED**  
**Production:** NO DEPLOY

## C9 handoff

- C9 PR #53 merged to master at `2b5060c8293fec6756b286627212b740b3147e53`.
- Post-merge Validate #1513 / run `35514989203`: SUCCESS.
- Suite: **1,911 tests / 1,910 pass / 0 fail / 1 skipped**.
- C9 functional QA: **24 PASS / 0 FAIL / 1 BLOCKED / 12 DEFERRED-PRODUCTION / 0 PENDING**.
- Physical P1–P20: **20 DEFERRED-PRODUCTION**.
- Production remains blocked until the final post-C10 staging candidate passes the deferred C9 release gate.

## Initial C10 dependency audit

Remaining production ownership debts:
- `src/api/client.js` and `src/api/effectiveConfigClient.js`;
- `src/pages/Dashboard.jsx` and `src/utils/dashboardAnalytics.js`;
- generic production ownership still split across `src/components/`, `src/hooks/` and `src/utils/`;
- `src/hooks/useMediaQuery.js` is a frontend-shared hook candidate;
- `src/utils/formFormatting.js` is a pure multi-domain helper and is currently imported by Catalog `domain/`;
- `src/utils/dataSync.js` is runtime-owned;
- login/theme/connection presentation in `src/components/` is app-shell-owned;
- payment/printing/Dashboard-only presentation modules in `src/components/` have clear domain/surface owners;
- `src/utils/bodyScrollLock.js` had zero production consumers in the initial audit and must be reconfirmed before deletion;
- Dashboard provider dependency inside `AppShell`;
- App direct `localStorage/sessionStorage` access;
- six clearly-owned root CSS files;
- empty `legacy-import-allowlist.json`;
- architecture checker lacks final generic legacy-root, frontend-shared, generic domain browser/fetch purity and domain-cycle rules.

Already clean:
- six domain roots established;
- no production `src/printing/*`;
- QZ isolated under infrastructure;
- cross-domain internal allowlist empty;
- direct QZ allowlist empty;
- repository-level semantic `shared/` modules have real Worker consumers and remain cross-runtime by design.

## Task 1 — frozen dependency map

**Approved plan:** user approval recorded on 2026-09-20.  
**Task 1 branch-start HEAD:** `31138854ebb2949b4ab06c68387d66c055b7ad75`.  
**Base/master:** `2b5060c8293fec6756b286627212b740b3147e53` (C9 merge).  
**Post-C9 master Validate:** #1513 / run `35514989203` — SUCCESS.  
**Latest pre-Task-1 docs Validate:** #1516 / run `35516273036` — SUCCESS on `66c477ce4aee9907a4a3f3139dbaf009084c9c68`.  
**Production:** NO DEPLOY.

### A. Legacy production roots

`src/api/`
- production: `client.js`, `effectiveConfigClient.js`;
- tests/contracts remain beside them.
- live production consumers:
  - `useOperationalDataRuntime.js` imports `getBootstrap`;
  - `useEffectiveBusinessConfig.js` imports `getEffectiveConfig`;
  - auth runtime already imports `infrastructure/auth/sessionApi.js` directly.
- Task 2 removes both production owners.

`src/pages/`
- only production owner: `Dashboard.jsx`;
- remaining files are tests.
- Task 3 moves Dashboard to an app surface.

`src/printing/`
- production owners: **none**;
- directory contains tests only.
- C9 closure is intact.

`src/components/` production owners:
- generic/shared candidates: `BottomSheet.jsx`, `Button.jsx`, `ConfirmationDialog.jsx`, `Icon.jsx`, `Modal.jsx`, `PageHeader.jsx`, `StatCard.jsx`, `StatusBadge.jsx`, `SystemSelect.jsx`, `scrollLock.js`, `DashboardBarChart.jsx`, `DashboardPeriodSelector.jsx`;
- app-shell/theme owners: `BrandLogo.jsx`, `ConnectionBanner.jsx`, `LoginScreen.jsx`, `ThemeProvider.jsx`, `themeContext.js`;
- Dashboard-only: `DashboardLineChart.jsx`, `DashboardPaymentMix.jsx`, `DashboardPeriodProvider.jsx`, `dashboardPeriodContext.js`;
- Orders-owned candidate: `PaymentBadge.jsx` + `payment.css`;
- Printing-owned candidates: `OrderTicketPreview.jsx`, `PrintStatusBadge.jsx`, `TableTabTicketPreview.jsx`.
- Task 3 removes Dashboard provider/context; Tasks 4–5 close the remaining production owners.

`src/hooks/`
- only production owner: `useMediaQuery.js`;
- Task 4 moves it to `src/shared/hooks`.

`src/utils/` production owners:
- `dashboardAnalytics.js` → Dashboard surface (Task 3);
- `dataSync.js` → app runtime data (Task 5);
- `formFormatting.js` → frontend shared utils (Task 4);
- `theme.js` → app shell/theme (Task 5);
- `bodyScrollLock.js` → zero production consumer in the initial search; must be reconfirmed before Task 5 deletion.
- `mobileNavigation.test.js` is test-only.

### B. App boundary and browser access

`src/App.jsx` currently:
- imports all six domains only through their public `index.js`;
- imports Dashboard from legacy `src/pages/Dashboard`;
- imports generic Button/Modal from legacy `src/components`;
- imports root CSS `new-order.css`, `client-duplicate.css`, `product-form.css`, `finance-mobile.css`;
- reads `window.localStorage` with key `kitchen-sound-enabled`;
- writes the same key and emits the current failure copy on storage error;
- passes `window.sessionStorage` into `SettingsPolicyBoundary`;
- uses `window.requestAnimationFrame` + `document.querySelector('.app-content')` for focus restoration after discard cancellation. This is app UI composition and is not a Task 6 storage debt.

### C. Domain public-entry consumers

**Orders public entry** — external production consumers:
- `App.jsx`;
- `src/utils/dashboardAnalytics.js` (moves in Task 3);
- Settings policy registry;
- `ReceivablesSurface.jsx`;
- order/table-tab payment workflows and reconciliation;
- operational data runtime;
- Dashboard legacy page.
Internal peer-domain edges into Orders: none found.

**Table Service public entry** — external production consumers:
- `App.jsx`;
- Orders `NewOrderCustomerStep.jsx` consumes `LocalTableSelector`.
Table Service has no Orders import.

**Finance public entry** — external production consumers:
- `App.jsx`;
- Settings registry and Settings surface;
- `ReceivablesSurface.jsx`;
- payment/refund workflows;
- Orders checkout/cancellation UI uses Finance payment-method contracts.
Finance has no Orders/Table Service import.

**Customers public entry** — external production consumers:
- `App.jsx`;
- Orders `NewOrder.jsx` consumes customer duplicate/UI contracts.

**Catalog public entry** — external production consumers:
- `App.jsx`;
- Orders `orderCart.js`, `OrderCart.jsx`, `OrderProductCatalog.jsx`.
Catalog has no Orders/Finance/Table Service/Printing dependency.

**Printing public entry** — external production consumers:
- `App.jsx`;
- navigation query context;
- Settings policy registry;
- Settings surface.
Printing application additionally depends on QZ infrastructure, never through a peer-domain internal path.

### D. Domain-to-domain graph

Current production peer-domain public-entry edges:
- Orders → Catalog;
- Orders → Customers;
- Orders → Finance;
- Orders → Table Service.

No reverse edge from Catalog, Customers, Finance or Table Service to Orders was found. Printing has no peer-domain edge. Therefore the frozen post-C9 domain graph is acyclic and is the baseline for Task 9 cycle enforcement.

### E. Infrastructure map

`src/infrastructure/api/httpClient.js` is the generic HTTP primitive consumed by:
- legacy `src/api/client.js` (Task 2 debt);
- app payment/refund workflow APIs;
- Orders, Finance, Catalog, Customers, Table Service and Printing infrastructure adapters.

`src/infrastructure/auth/sessionApi.js`
- consumed directly by `useSessionRuntime.js`;
- legacy `src/api/client.js` only reexports it.

`src/infrastructure/qz/`
- production owner files: `qzLocalPreferences.js`, `qzPrintAttemptController.js`, `qzStatusMonitor.js`, `qzTransport.js`;
- production consumers are Printing application `usePrintingManager.js` and `printJobRunner.js`;
- production `qz-tray` ownership remains confined to this infrastructure.

`src/infrastructure/storage/`
- does not yet exist; Task 6 creates the two small adapters.

### F. Frontend shared vs repository-level shared

Frontend `src/shared/` does not yet exist. Task 4 establishes:
- `src/shared/ui`;
- `src/shared/hooks`;
- `src/shared/utils`.

Repository-level `shared/` remains cross-runtime. Confirmed Worker production consumers include:
- `businessPolicies.js` — operational/settings policy repositories;
- `clientIdentity.js` — repositories;
- `finance.js` — validation/payment/finance/order flows;
- `orderCustomerIdentity.js` — order checkout;
- `orderDisplayNumber.js` — repositories/cancellation;
- `orderPrintDocument.js` — print document repository/repositories;
- `orderTiming.js` — repositories/cancellation;
- `printContextPolicy.js` — repositories/printing repository;
- `printQueue.js` and `printQueueActions.js` — printing repository;
- `productCatalog.js` — validation/repositories;
- `settingsAccess.js` — settings access;
- `settingsCatalogs.js` — cancellation/finance-category repositories;
- `tableTabPrintDocument.js` — Worker index.
No C10 move is approved for these cross-runtime contracts.

### G. Targeted root CSS baseline

Clearly-owned C10 CSS moves:
- `dashboard.css` → Dashboard surface;
- `new-order.css` → Orders UI;
- `client-duplicate.css` → Customers UI;
- `product-form.css` → Catalog UI;
- `finance-mobile.css` → Finance UI;
- `print-queue.css` → Printing UI.

Other global/shell/settings/mobile/theme CSS remains out of C10 relocation unless a mechanical dependency proves otherwise.

### H. Task 1 conclusion

The post-C9 tree matches the approved C10 design:
- one final API facade family remains;
- Dashboard is the only production legacy page;
- `src/printing` is test-only;
- the generic frontend roots are classifiable without inventing new domains;
- the peer-domain graph is currently acyclic;
- QZ isolation is intact;
- repository-level shared code has real Worker consumers;
- no production deploy occurred.

## Task 1 validation

- Task 1 evidence commit: `264399e14ad82833c93143bd262c0018bd17376e`.
- Validate #1519 / run `35517045330`: **SUCCESS** on that exact SHA.
- Test suite: **1,911 tests / 1,910 pass / 0 fail / 1 skipped**.
- Frontend architecture boundaries: **OK**.
- lint: **0 errors** (existing warnings only).
- build: **PASS**.
- production Worker dry-run: **PASS**.
- staging Worker dry-run: **PASS**.
- local D1: **PASS**.
- Spec B D1 clean install/upgrade: **PASS**.
- Production deploy: **NO**.

Task 1 is **COMPLETE**. No production code changed.

## Next action

**Task 2 — Remove the final legacy API facade — is NOT STARTED.**
