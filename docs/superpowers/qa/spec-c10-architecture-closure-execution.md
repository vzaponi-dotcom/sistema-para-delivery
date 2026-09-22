# Spec C10 — Architecture Closure Execution

**Branch:** `feature/spec-c10-architecture-closure`  
**Base/master:** `2b5060c8293fec6756b286627212b740b3147e53`  
**Status:** **TASKS 1–12 COMPLETE / GREEN; MERGE AWAITING EXPLICIT AUTHORIZATION**
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

## Task 2 — final legacy API facade removal

### RED

- RED SHA: `a3618a4a92d3152dfb3486dfab94374a21ee974a`.
- Validate #1521 / run `35517483314`: **FAIL as intended**.
- Suite: **1,915 tests / 1,910 pass / 4 fail / 1 skipped**.
- Intended failures:
  - missing `src/infrastructure/api/bootstrapApi.js`;
  - missing `src/infrastructure/api/effectiveConfigApi.js`;
  - runtime/effective-config still importing legacy owners;
  - `src/api/client.js` and `src/api/effectiveConfigClient.js` still physically present.

### GREEN

- GREEN SHA: `9dc095ad235ddcf10074058e42b5a49d76323dab`.
- Validate #1522 / run `35517751802`: **SUCCESS**.
- Suite: **1,913 tests / 1,912 pass / 0 fail / 1 skipped**.
- Frontend architecture boundaries: **OK**.
- lint: **0 errors**.
- build: **PASS**.
- production Worker dry-run: **PASS**.
- staging Worker dry-run: **PASS**.
- local D1: **PASS**.
- Spec B D1 clean install/upgrade: **PASS**.

### Result

- `bootstrapApi.js` owns `/api/bootstrap` and preserves `knownEffectiveConfigVersion` encoding.
- `effectiveConfigApi.js` owns `/api/settings/effective` and preserves `knownVersion` encoding.
- Both use `infrastructure/api/httpClient.js`, preserving HTTP status/code/message semantics.
- `useOperationalDataRuntime` consumes the bootstrap infrastructure owner directly.
- `useEffectiveBusinessConfig` consumes the effective-config infrastructure owner directly.
- session/auth consumers use `infrastructure/auth/sessionApi.js` directly.
- Legacy `src/api/client.js`, its compatibility-only `deleteOrder`, and `src/api/effectiveConfigClient.js` are physically removed.
- Equivalent auth/order/bootstrap/effective-config coverage exists under final owners; obsolete facade tests were removed.
- No production deploy occurred.

Task 2 is **COMPLETE / GREEN**.

## Task 3 — Dashboard app surface

### RED
- SHA: `bf22c259b625c53390c26b6c002b232fdc106aa7`.
- Validate #1525 / run `35519040678`: **FAIL as intended**.
- Suite: **1,915 tests / 1,912 pass / 2 fail / 1 skipped**.

### GREEN
- First implementation: `48fcd7c748bfd7d132fd257a38cf4b3c3701f301`; #1526 found one stale test path only.
- Final GREEN: `93e1b007460593f298a251261f61b01db897c8e2`.
- Validate #1527 / run `35519448927`: **SUCCESS**, **1,915 tests / 1,914 pass / 0 fail / 1 skipped**.
- All architecture/lint/build/Worker/D1 gates: **PASS**.

### Result
- Dashboard owner: `src/app/surfaces/dashboard/DashboardSurface.jsx`.
- Dashboard analytics + line/payment charts are co-located with the surface.
- `src/pages/Dashboard.jsx`, `src/utils/dashboardAnalytics.js`, DashboardPeriodProvider/context and Dashboard-only component owners are removed.
- period/privacy continue in query context; AppShell has no Dashboard-specific provider.
- Dashboard totals moved out of App and are projected inside the surface from official orders/movements.
- Task 3: **COMPLETE / GREEN**.

## Task 4 — frontend shared ownership

### RED
- SHA: `19e9b181ad7e20606055cbcbfac4cc73bf76830a`.
- Validate #1528 / run `35519614298`: **FAIL as intended**.
- Suite: **1,918 tests / 1,914 pass / 3 fail / 1 skipped**.
- Intended failures required shared UI, shared hook/util owners and no domain import from frontend shared.

### GREEN
- Ownership move candidate: `da28f9b635632169b75c1ee0145f8d2fd7b004a6`; #1529 exposed remaining old paths.
- Production/test path alignment: `01f66ab8081b52a66d7cb04bbe93762d09de4dbf`; #1530 left two stale source assertions.
- Final assertion alignment: `0afe78933848e5fa12f291ea8ed9698ca9c63d97`.
- Validate #1531 / run `35524322503`: **SUCCESS**, **1,918 tests / 1,917 pass / 0 fail / 1 skipped**.
- Frontend architecture boundaries: **OK**.
- lint: **0 errors**.
- build: **PASS**.
- production Worker dry-run: **PASS**.
- staging Worker dry-run: **PASS**.
- local D1: **PASS**.
- Spec B D1 clean install/upgrade: **PASS**.

### Result
- `src/shared/ui`: BottomSheet, Button, ConfirmationDialog, Icon, Modal, PageHeader, StatCard, StatusBadge, SystemSelect, scrollLock, DashboardBarChart, DashboardPeriodSelector.
- `src/shared/hooks/useMediaQuery.js`.
- `src/shared/utils/formFormatting.js`.
- Production consumers use final shared paths.
- Old owners under `src/components`, `src/hooks` and `src/utils/formFormatting.js` are physically absent.
- No domain import exists from `src/shared/**`.
- No compatibility facade was introduced.

## Task 8 - Migration scaffolding and compatibility-facade closure

- RED `6c8b8b760f3e75edb2c91b5d62fd26572efb3c4c`; Validate run `35532503944` - **FAIL as intended**: 54 focused architecture tests, 53 pass / 1 fail. The only new failure proved that `scripts/architecture/legacy-import-allowlist.json` still existed; it was not a parser, syntax, fixture or path failure.
- GREEN `28b5ac578e9d778342254066ae6b7b5a0bc22a3c`; Validate run `35532635340` - **SUCCESS**, **1,928 tests / 1,927 pass / 0 fail / 1 skipped**.
- `legacy-import-allowlist.json` is deleted. The checker no longer reads an allowlist and direct QZ plus cross-domain-internal migration exceptions cannot be reintroduced through that mechanism.
- Explicit C10 guards reject the return of `src/api/client.js`, `src/api/effectiveConfigClient.js`, the historical payment-receipt bridge, and `updateCollection`; existing C3-C9 guards remain active.
- Architecture, lint, build, production Worker dry-run, staging Worker dry-run, local D1, and Spec B D1 clean-install/upgrade all passed in the authoritative Validate. No replacement allowlist exists.
- Active temporary compatibility facade inventory: **0**. Physical C9 QA remains `DEFERRED-PRODUCTION`, not a compatibility facade or architectural debt.
- C10 Tasks 1-8 are **COMPLETE / GREEN**. Task 9 is **NOT STARTED**. No staging deploy, production deploy or merge occurred.
- Task 4: **COMPLETE / GREEN**.

## Tasks 9–10 — final architecture enforcement and audit

### Task 9

- RED `aeabd3b`; the final generic C10 guards were intentionally absent.
- GREEN `e35b606`; architecture enforcement rejects legacy roots, App legacy-root imports, shared→domain imports, domain React/infrastructure/UI/QZ/browser/fetch impurity, production deep domain imports, QZ escapes and public-entry cycles. Positive fixtures preserve allowed public-entry, shared and QZ-infrastructure edges.
- Migration allowlists and compatibility facades remain **0**.

### Task 10

- RED: `src/c10FinalArchitectureAudit.test.js` failed on the expected 40 surplus Orders exports and six surplus Customers exports.
- GREEN: Orders and Customers public entries now expose only real external production contracts; internal tests import their owner module directly.
- The checker explicitly excludes `*.test.*` from production deep-import findings while retaining the same production guard.
- Final audit: `docs/superpowers/qa/spec-c10-final-architecture-audit.md`.
- Local gates: full suite, architecture unit suite, `test:architecture`, lint, build, local D1 and Spec B D1 gate passed.
- Worker dry-runs: production and staging both passed with `--dry-run`; no deployment, remote migration, merge or production action occurred.

**Tasks 1–10 are COMPLETE / GREEN. Task 11 is NOT STARTED.**

## Task 11 — final Spec C verification and executable candidate

### Initial checkpoint

- Local and remote branch HEAD before Task 11: `6b0512efda1bc3e20c28770c23e91c7a4301204f`.
- Branch: `feature/spec-c10-architecture-closure`; development did not use `master`.
- PR #54: **OPEN / DRAFT**, base `master` at `2b5060c8293fec6756b286627212b740b3147e53`.
- Initial Validate application #1549 / run `35539502743`: **SUCCESS** on exact HEAD `6b0512ef...`.
- Tasks 1–10 were reconfirmed complete; no staging/production deployment or remote migration had occurred.

### Audit result

- Parent Spec C §28: **17 PASS / 1 PENDING TASK 12 / 0 FAIL**.
- Criterion 15 is explicitly **PENDING TASK 12 / release gate not executed yet**. It is not PASS and is not mislabeled `DEFERRED-PRODUCTION`.
- C9 functional rows #12, #14–21, #24, #30 and #31 plus physical P1–P20 remain **DEFERRED-PRODUCTION** and block production.
- Restricted-capability staging case #35 remains BLOCKED for lack of a suitable identity; automated capability coverage is green but no manual PASS is inferred.
- Issues #43 and #44 remain open; Kitchen TV, Spec D and professional-printer evolution remain deliberately deferred.
- Final audit: `docs/superpowers/qa/spec-c10-final-architecture-audit.md`.

### Diff audit against post-C9 base

- Worker/migrations/schema/workflows/packages: no diff.
- API: only bootstrap/effective-config ownership moved from the deleted facade to focused infrastructure adapters; route, method, query and HTTP error semantics remain equivalent. Other HTTP adapters are unchanged.
- Polling: global 5s, Kitchen/orders 2s, printing 2s/5s/15s and Print Queue 10s remain unchanged.
- Storage keys and fallbacks: unchanged; `kitchen-sound-enabled` moved behind the storage adapter.
- Capabilities: access/navigation/session contracts unchanged.
- QZ/printing core: zero diff in QZ infrastructure and Printing application/domain/infrastructure; copy/retry/recovery/primary-station semantics unchanged. No physical inference was made.
- CSS: all nine relocated CSS blobs are byte-identical to the base.
- UTF-8/copy: no mojibake-like line introduced by the C10 diff; historical test-name mojibake predates C10.

### Local candidate gates

- `npm test`: **PASS**, 1,933 tests / 1,933 pass / 0 fail / 0 skipped.
- focused final audit: **69/69 PASS**.
- `npm run lint`: **PASS**, exit 0, no errors; existing warnings only.
- `npm run test:architecture`: **PASS**, `Frontend architecture boundaries: OK`.
- `npm run build`: **PASS**, 499 modules transformed.
- production Wrangler 4.128.0 `deploy --dry-run`: **PASS / NO DEPLOY**.
- staging Wrangler 4.128.0 `deploy --dry-run --env staging`: **PASS / NO DEPLOY**.
- `npm run d1:migrate:local`: npm/npx wrapper was blocked before Wrangler by sandbox registry/cache access. The already-cached exact Wrangler 4.128.0 executed the same local migration target directly: **PASS / No migrations to apply**. Candidate GitHub Validate remains authoritative for the exact npm-script gate.
- `node scripts/infra/spec-b-d1-gate.mjs`: **PASS**, local D1 Worker, 25 migrations and every reported check true.

### Executable candidate

- Candidate: `060468703f39c716d997025ab0ed99063cdd2fae`.
- Validate application #1550 / run `35541850517`: **SUCCESS** on that exact SHA.
- Official test summary: **1,933 tests / 1,932 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, production/staging Worker dry-runs, local D1 and Spec B D1 all passed in the authoritative workflow.
- The audit found no implementation defect, so no focused RED → GREEN fix was required. This closure update is documentation-only and does not replace the executable candidate selected for Task 12.

## Task 12 — final staging homologation and merge handoff

- Immutable executable candidate: `060468703f39c716d997025ab0ed99063cdd2fae`.
- Deploy staging #190 / run ID `35544795652`: **SUCCESS** on exact `head_sha` `060468703f39c716d997025ab0ed99063cdd2fae`.
- Automated gates: **1,933 tests / 1,932 pass / 0 fail / 1 skipped**; architecture, lint, build, local D1 and staging dry-run **PASS**.
- Remote staging migrations: none pending; migration application reported `No migrations to apply`.
- Worker version: `f0f8c6a0-5e55-4894-9250-29d4b76aeae8`.
- Readiness: **PASS** on attempt 1/6. Login smoke: **HTTP 200**.
- Temporary ref `staging/spec-c10-final-candidate` was removed after evidence capture.
- Manual C10 homologation: blocks A–D **5 PASS** each and block E **3 PASS**, total **23 PASS / 0 FAIL / 0 BLOCKED / 0 PENDING**. Restricted-capability case 23 is **PASS**.
- Spec C §28 criterion 15: **PASS**. Final audit: **18 PASS / 0 FAIL / 0 PENDING**.
- Active compatibility facade inventory: **0**. Migration allowlists: **0**.
- Tasks 1–12: **COMPLETE / GREEN**.
- C9 functional rows #12, #14–21, #24, #30 and #31 and physical P1–P20 remain **DEFERRED-PRODUCTION**. They are not C10 failures and do not block the architecture merge handoff, but remain a hard production blocker until real physical execution on the final release candidate.
- Production: **NO DEPLOY**. Merge: **NOT EXECUTED**.

## Next action

Keep PR #54 **OPEN** and stop for explicit user merge authorization. Do not merge and do not deploy production.

## Final production gate update — 2026-09-21

The production blocker recorded during C10 closure has been satisfied.

User manual physical Printing QA on official staging #198 / run `35671044737`, executable SHA `720fc0a4af160a819ff4b01b77264ff0244eeaf7`:

- C9 hardware-dependent functional rows: **12 PASS / 0 FAIL**;
- C9 P1–P20: **20 PASS / 0 FAIL**;
- remaining deferred production cases: **0**.

No defect was found and no implementation correction was required.

**Spec C production hardware gate: PASS / CLEARED.**

