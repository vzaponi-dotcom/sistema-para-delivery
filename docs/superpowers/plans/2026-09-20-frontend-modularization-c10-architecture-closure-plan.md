
# Spec C10 — Architectural Closure and Cleanup Implementation Plan

> Execute task-by-task with strict RED → GREEN for every code-changing boundary. Do not deploy production.

**Status:** **APPROVED — TASKS 1–4 COMPLETE / TASK 5 NOT STARTED**  
**Base:** post-C9 `master` `2b5060c8293fec6756b286627212b740b3147e53`  
**Branch:** `feature/spec-c10-architecture-closure`  
**Draft PR:** #54  
**Design:** `docs/superpowers/specs/2026-09-20-frontend-modularization-c10-architecture-closure-design.md` — **APPROVED 2026-09-20**  
**Pre-plan docs HEAD:** `66c477ce4aee9907a4a3f3139dbaf009084c9c68`; Validate #1516 / run `35516273036` — **SUCCESS**  
**Production:** **NO DEPLOY**

## Goal

Close Spec C against the real post-C9 tree: remove the final compatibility facade and migration scaffolding, establish the frontend-only shared layer, move residual generic owners to their true app/domain/surface owners, finish Dashboard and storage boundaries, perform only justified CSS relocation, replace migration-era architecture allowances with permanent generic gates, audit public contracts and all 18 parent-Spec criteria, then homologate the final C10 staging candidate.

C10 is architectural closure. It must not change business behavior, API contracts, polling, capabilities, visual design, Worker behavior or the approved C9 deferred-production release policy.

## Global constraints

- Never implement on `master`; use only `feature/spec-c10-architecture-closure`.
- Preserve API route/method/query/body/error semantics, polling, storage keys, capabilities and synchronization.
- No Worker/migration/schema change without a separately approved blocker ruling.
- No React Router, state-library migration, Spec D, users/profiles or new print transport.
- No redesign or opportunistic polish.
- Do not keep compatibility reexports merely to make a commit green.
- C9 hardware remains `DEFERRED-PRODUCTION` and is never inferred PASS.
- Every behavior defect found during implementation/QA gets focused RED → GREEN.
- Implementation plan approved explicitly by the user on 2026-09-20. Tasks 1–4 are complete and green; Task 5 is not started.

---

## Task 1 — Freeze the C10 baseline and dependency map

**Nature:** evidence/documentation only.

**Update**
- `docs/superpowers/qa/spec-c10-architecture-closure-execution.md`
- `docs/superpowers/qa/spec-c-execution-ledger.md`
- rollout
- PR #54 body

Record exact base, branch HEAD, C9 merge/post-merge Validate, #1516, no production deploy and the C9 deferred physical gate.

Refresh the production dependency map for:
- App imports and direct browser APIs;
- production files under `src/api`, `src/pages`, `src/printing`, `src/components`, `src/hooks` and `src/utils`;
- all six domain public entries and external production consumers;
- domain-to-domain public-entry edges;
- infrastructure dependencies;
- frontend `src/shared` and repository-level `shared`;
- App storage access;
- clearly-owned root CSS;
- Worker consumers of repository-level `shared`;
- zero-consumer candidates, especially `src/utils/bodyScrollLock.js`.

**Gate:** docs-only Validate on exact Task 1 HEAD.

**Exit:** current dependency map recorded; no production code changed.

---

## Task 2 — Remove the final legacy API facade

**Create**
- `src/infrastructure/api/bootstrapApi.js` + test
- `src/infrastructure/api/effectiveConfigApi.js` + test

**Modify**
- `src/app/runtime/data/useOperationalDataRuntime.js` + tests
- `src/app/useEffectiveBusinessConfig.js` + tests
- `src/settingsSessionRecovery.test.js`
- path/source-contract tests

**Delete after equivalent coverage**
- `src/api/client.js` + obsolete facade tests
- `src/api/effectiveConfigClient.js` + tests

### RED

Prove:
- bootstrap comes from `infrastructure/api/bootstrapApi.js`;
- effective config comes from `infrastructure/api/effectiveConfigApi.js`;
- both use `httpClient.js`;
- auth remains in `infrastructure/auth/sessionApi.js`;
- `deleteOrder` compatibility export is absent;
- old production API facade paths are absent.

RED must fail because the new owners are missing and/or old owners still exist.

### GREEN

Move only HTTP ownership. Preserve exactly:
- `/api/bootstrap` + `knownEffectiveConfigVersion`;
- `/api/settings/effective` + `knownVersion`;
- auth routes;
- HTTP status/code/message semantics.

Focused tests include httpClient, sessionApi, both new adapters, operational runtime, effective config and settings session recovery. Then full Validate.

**Exit:** no production dependency on `src/api/**`.

**Task 2 evidence — COMPLETE / GREEN**
- RED: `a3618a4a92d3152dfb3486dfab94374a21ee974a`; Validate #1521 / run `35517483314` — **FAIL as intended**, **1,915 tests / 1,910 pass / 4 fail / 1 skipped**. Failures were exactly the missing `bootstrapApi.js`, missing `effectiveConfigApi.js`, legacy runtime/effective-config imports and still-present legacy facade files.
- GREEN: `9dc095ad235ddcf10074058e42b5a49d76323dab`; Validate #1522 / run `35517751802` — **SUCCESS**, **1,913 tests / 1,912 pass / 0 fail / 1 skipped**.
- architecture ✅; lint 0 errors ✅; build ✅; production Worker dry-run ✅; staging Worker dry-run ✅; local D1 ✅; Spec B D1 clean-install/upgrade ✅.
- `src/api/client.js` and `src/api/effectiveConfigClient.js` are physically absent; bootstrap/effective-config ownership is under `src/infrastructure/api/`; auth remains under `src/infrastructure/auth/sessionApi.js`.
- No Worker, migration, schema or production deployment change occurred.

---

## Task 3 — Establish Dashboard as an app surface

**Move/create**
- `src/app/surfaces/dashboard/DashboardSurface.jsx`
- `dashboardAnalytics.js`
- Dashboard-only `DashboardLineChart.jsx`
- Dashboard-only `DashboardPaymentMix.jsx`
- focused tests

**Modify**
- `src/App.jsx`
- `src/app/shell/AppShell.jsx`
- Dashboard/query/navigation regressions

**Delete**
- `src/pages/Dashboard.jsx`
- `src/utils/dashboardAnalytics.js`
- `src/components/DashboardPeriodProvider.jsx`
- `src/components/dashboardPeriodContext.js`

### RED

Require:
- no production Dashboard under `src/pages`;
- no Dashboard analytics under `src/utils`;
- AppShell has no Dashboard-specific provider;
- App no longer computes/passes Dashboard `totals`;
- DashboardSurface consumes official orders/movements and existing query state;
- calculations use public Orders/Finance contracts.

### GREEN

Preserve period values/initial period, privacy eye, labels, charts, cancelled-order exclusion, totals, top products, payment mix and local-date semantics.

Keep `DashboardBarChart` and `DashboardPeriodSelector` generic because Operational History also consumes them; Task 4 moves them to shared.

Run Dashboard + shell/navigation regressions, then full Validate.

**Exit:** `src/pages` has no production owner.

**Task 3 evidence — COMPLETE / GREEN**
- RED: `bf22c259b625c53390c26b6c002b232fdc106aa7`; Validate #1525 / run `35519040678` — **FAIL as intended**, **1,915 tests / 1,912 pass / 2 fail / 1 skipped**. The new Dashboard surface owner was absent and the legacy page/provider ownership still existed.
- GREEN candidate: `48fcd7c748bfd7d132fd257a38cf4b3c3701f301`; Validate #1526 found one stale chart-path characterization after the owner move.
- Final GREEN: `93e1b007460593f298a251261f61b01db897c8e2`; Validate #1527 / run `35519448927` — **SUCCESS**, **1,915 tests / 1,914 pass / 0 fail / 1 skipped**.
- architecture ✅; lint 0 errors ✅; build ✅; production Worker dry-run ✅; staging Worker dry-run ✅; local D1 ✅; Spec B D1 clean-install/upgrade ✅.
- Dashboard production ownership is now `src/app/surfaces/dashboard/`; AppShell no longer carries a Dashboard-specific provider; App no longer computes Dashboard totals; Dashboard consumes official `orders`, `movements` and query state through public domain contracts.
- No staging or production deploy occurred.

---

## Task 4 — Establish frontend `src/shared/{ui,hooks,utils}`

**Create**
- `src/shared/ui`
- `src/shared/hooks`
- `src/shared/utils`

### Move to shared UI

- BottomSheet
- Button
- ConfirmationDialog
- Icon
- Modal
- PageHeader
- StatCard
- StatusBadge
- SystemSelect
- active `scrollLock.js`
- DashboardBarChart
- DashboardPeriodSelector

### Move to shared hooks

- `src/hooks/useMediaQuery.js`

### Move to shared utils

- `src/utils/formFormatting.js` + focused tests

Update all app/domain/surface/workflow consumers. Do **not** create a mega shared barrel.

### RED

A shared-ownership contract must require new owner paths, reject old production paths, prove `formFormatting` remains pure, prove `src/shared/**` imports no domain, prove Catalog domain no longer imports `src/utils/formFormatting.js` and prove `src/hooks` no longer owns `useMediaQuery`.

### GREEN

Path-only ownership move; preserve props, DOM/accessibility, focus/scroll-lock behavior, SystemSelect, analytics chart behavior, formatting/parsing and media-query SSR behavior.

Run shared/component, Table Service responsive, Orders analysis, Settings, Finance and Catalog regressions; then full Validate.

**Exit:** reusable frontend primitives live in `src/shared`; `src/hooks` has no production owner.

**Task 4 evidence — COMPLETE / GREEN**
- RED: `19e9b181ad7e20606055cbcbfac4cc73bf76830a`; Validate #1528 / run `35519614298` — **FAIL as intended**, **1,918 tests / 1,914 pass / 3 fail / 1 skipped**. The failures required `src/shared/ui`, `src/shared/hooks`, `src/shared/utils` and the no-domain-import shared boundary.
- GREEN candidate: `da28f9b635632169b75c1ee0145f8d2fd7b004a6`; Validate #1529 exposed legacy test paths plus a few remaining production references to moved primitives.
- Path-alignment fix: `01f66ab8081b52a66d7cb04bbe93762d09de4dbf`; Validate #1530 reduced the suite to two stale source-contract assertions.
- Final GREEN: `0afe78933848e5fa12f291ea8ed9698ca9c63d97`; Validate #1531 / run `35524322503` — **SUCCESS**, **1,918 tests / 1,917 pass / 0 fail / 1 skipped**.
- architecture ✅; lint 0 errors ✅; build ✅; production Worker dry-run ✅; staging Worker dry-run ✅; local D1 ✅; Spec B D1 clean-install/upgrade ✅.
- Shared UI now owns BottomSheet, Button, ConfirmationDialog, Icon, Modal, PageHeader, StatCard, StatusBadge, SystemSelect, scrollLock, DashboardBarChart and DashboardPeriodSelector.
- Shared hooks now owns `useMediaQuery`; shared utils owns pure `formFormatting`.
- Production consumers were re-pointed to final owners with no compatibility facade or mega shared barrel.
- `src/shared/**` remains domain-independent and the moved formatting utility remains free of React/browser/fetch ownership.
- No staging or production deploy occurred.

---

## Task 5 — Close residual `src/components` / `src/utils` ownership

### App shell

Move BrandLogo, ConnectionBanner and LoginScreen into `src/app/shell`.

### App theme

Move ThemeProvider, themeContext and `src/utils/theme.js` into `src/app/shell/theme`; update `main.jsx` and Device Preferences.

### Runtime

Move `src/utils/dataSync.js` + test into `src/app/runtime/data`.

### Orders

Move PaymentBadge + `payment.css` into Orders UI.

### Printing

Move OrderTicketPreview, PrintStatusBadge and TableTabTicketPreview (+ focused tests) into Printing UI.

Export from `domains/printing/index.js` **only** the presentation contracts that still have real external consumers:
- OrderTicketPreview if Orders consumes it;
- PrintStatusBadge if Orders consumes it;
- TableTabTicketPreview if Table Service app composition consumes it.

### Dead-code ruling

Reconfirm `src/utils/bodyScrollLock.js` has zero production consumers. If zero, delete it; otherwise assign a real owner before moving.

### RED

Require:
- no production JS/JSX/MJS in `src/components`;
- no production JS/JSX/MJS in `src/utils`;
- declared app/domain owners exist;
- external consumers use Printing public entry, not deep UI imports;
- dead duplicate absent if still unused.

### GREEN

Move without behavior change. Preserve theme behavior, overlay behavior, Orders badges/previews, table-tab preview and printing queue/status semantics.

Run shell/theme, overlays, Orders, Table Service, Printing and runtime-data regressions; then full Validate.

**Exit:** `src/components` and `src/utils` contain no production owner.

---

## Task 6 — Isolate App browser storage

**Create**
- `src/infrastructure/storage/kitchenSoundPreference.js` + test
- `src/infrastructure/storage/sessionStorage.js` + test

**Modify**
- `src/App.jsx`
- settings policy-boundary tests
- kitchen sound behavior/source tests

### RED

Prove:
- App contains no `localStorage` or `sessionStorage` token;
- key remains `kitchen-sound-enabled`;
- failed/missing read defaults sound enabled;
- failed write preserves exact feedback text;
- enabling still previews sound;
- `preferences.local` capability still gates persistence;
- policy editing receives the same browser session storage through the adapter;
- SSR/test environment is safe.

### GREEN

Move only environmental access. Do not create a storage framework.

App focus restoration via document/requestAnimationFrame remains app UI composition.

Run settings/device/session/kitchen regressions + full Validate.

**Exit:** App owns no persistent browser-storage mechanics.

---

## Task 7 — Relocate only clearly-owned CSS

**Move byte-equivalently**
- `src/dashboard.css` → Dashboard surface
- `src/new-order.css` → Orders UI
- `src/client-duplicate.css` → Customers UI
- `src/product-form.css` → Catalog UI
- `src/finance-mobile.css` → Finance UI
- `src/print-queue.css` → Printing UI

Owner modules import the moved CSS. App must not deep-import domain CSS.

### RED

Require new paths, reject old paths, prove content hashes/bytes match the C10 base, prove owner imports exist and prove no unrelated global CSS moved.

### GREEN

Mechanical moves only. No selector/declaration changes. Inspect built CSS ordering; if cascade changes, restore equivalent ordering through owner imports rather than redesigning styles.

Run mobile/responsive/light-dark and affected surface regressions + build + full Validate.

**Exit:** targeted CSS ownership closed without visual drift.

---

## Task 8 — Remove migration scaffolding and close the facade ledger

**Delete**
- `scripts/architecture/legacy-import-allowlist.json`

**Modify**
- checker + tests
- compatibility ledger
- C10 execution ledger

### RED

Prove:
- checker works with no allowlist file;
- no QZ/cross-domain migration allowance is needed;
- `src/api/client.js` cannot return;
- removed bridges/`updateCollection` remain protected;
- active compatibility inventory is zero after Task 2.

### GREEN

Delete the empty allowlist and do not replace it.

Compatibility ledger preserves history but marks final generic/auth/bootstrap API facade **REMOVED IN C10**; unresolved temporary facades = **0**.

Run architecture tests, `npm run test:architecture` and full Validate.

**Exit:** migration compatibility scaffolding = zero.

---

## Task 9 — Add final generic architecture enforcement

**Modify**
- `scripts/architecture/check-import-boundaries.mjs`
- its tests

### RED fixtures

Reject:
1. production source under `src/api`;
2. `src/pages`;
3. `src/printing`;
4. `src/components`;
5. `src/hooks`;
6. `src/utils`;
7. App importing a legacy root;
8. frontend `src/shared` importing a domain;
9. any domain layer importing React;
10. any domain layer importing infrastructure;
11. any domain layer importing UI;
12. any domain layer importing QZ;
13. any domain layer using browser globals/direct fetch;
14. external deep import into any domain;
15. production QZ import outside `src/infrastructure/qz`;
16. public-entry domain cycle A → B → A.

Positive fixtures prove App → domain public entry, allowed one-way domain public-entry use, shared UI/hooks → React, pure shared utils and QZ infrastructure → qz-tray remain valid.

### GREEN

Implement generic legacy-root, shared-boundary, domain-purity/browser/fetch, external public-entry, cycle-detection and QZ rules. Preserve stricter C3–C9 rules where they still add value.

Cycle detection uses production domain-to-domain edges and emits stable readable violations.

Run architecture unit tests + `npm run test:architecture` + full Validate.

**Exit:** final architecture is enforced without migration allowances.

---

## Task 10 — Audit/minimize public contracts and shared code

**Create**
- `docs/superpowers/qa/spec-c10-final-architecture-audit.md`

For each domain index (Orders, Table Service, Finance, Customers, Catalog, Printing):
- list public exports;
- list external **production** consumers;
- classify real public vs internal/test-only;
- remove unused public exports only after a focused RED.

Audit frontend `src/shared`:
- real multi-owner consumers;
- no domain imports;
- no business rule moved to shared merely for reuse.

Audit repository-level `shared` and reconfirm Worker/frontend consumers for business policies, identities, finance/date, order display/timing/print, print context/queue/actions/health, product catalog, settings contracts and table-tab print document. Do not move real cross-runtime modules.

Audit App: no CRUD implementation, endpoint implementation, Dashboard calculation, persistent storage mechanics, QZ/recovery internals, legacy-root production import or deep domain import.

Run focused source-contract/architecture tests + full Validate.

**Exit:** public API is deliberate; final dependency map is documented.

---

## Task 11 — Verify all 18 Spec C criteria and produce executable candidate

**Update**
- final architecture audit
- C10 execution
- Spec C ledger
- rollout

For every criterion in parent Spec C `28, record PASS with evidence, FAIL if unresolved, and `DEFERRED-PRODUCTION` only where the approved C9 hardware gate is specifically relevant.

Run/record:
~~~bash
npm test
npm run lint
npm run test:architecture
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
~~~

GitHub Validate is authoritative.

Diff-audit against `2b5060c8293fec6756b286627212b740b3147e53` for Worker/migrations, API drift, polling, storage keys, capabilities, QZ/copy semantics, CSS content, packages, UTF-8 and functional copy.

**Exit:** exact executable C10 candidate GREEN; architecture audit has no FAIL.

---

## Task 12 — Final staging homologation and merge handoff

**Create**
- `docs/superpowers/qa/spec-c10-architecture-closure-qa.md`

### Deploy

Manual staging deploy on exact executable SHA. Record run ID, migration status, Worker version, readiness and login smoke. Docs-only successor commits never replace the staged SHA in evidence.

### Manual C10 smoke matrix

At minimum:
1. login/bootstrap/logout;
2. desktop navigation;
3. mobile navigation;
4. Dashboard period/privacy/charts/totals;
5. New Order;
6. Kitchen lifecycle/sound;
7. History/cancellation/refund entry;
8. Tables;
9. Comandas + preview/payment/print-entry UI;
10. Finance/movements;
11. A Receber;
12. Customers;
13. Catalog;
14. Settings operations/modalities;
15. Settings payments/finance categories;
16. Settings printing;
17. Settings device/theme/sound;
18. Print Queue non-physical search/filter/sort/pagination/detail/actions;
19. offline → online smoke;
20. light theme;
21. dark theme;
22. representative mobile/responsive/UTF-8;
23. restricted capability case — BLOCKED allowed only if no suitable staging identity exists.

No C10 row remains PENDING at merge handoff.

### C9 pre-production gate

Do not convert deferred C9 hardware rows to PASS. Before production, on the final post-C10 staging release candidate, C9 functional rows #12/#14–21/#24/#30/#31 and physical P1–P20 must all PASS.

A hardware defect reopens implementation: RED → GREEN → full Validate → staging redeploy → affected rerun.

### Closure

Update QA, execution, audit, ledger, rollout, compatibility ledger and PR body. Run final docs Validate. Require mergeable PR/no unresolved review thread/no production deploy.

**Stop for explicit user merge authorization.** Do not merge automatically.

After authorization only: merge PR #54, confirm exact master SHA and post-merge Validate, then mark **C10 MERGED / COMPLETE** and **Spec C architecture COMPLETE**.

Production remains separately blocked until the deferred C9 release matrix passes.

---

## Expected code-diff boundaries

Expected: frontend architecture only; API/storage adapters; Dashboard surface; frontend shared layer; app-shell/theme/runtime ownership; Orders/Printing presentation ownership; targeted CSS paths; architecture checker.

Not expected: Worker functional changes, migrations, D1 schema, API contract changes, polling/capability changes, QZ behavior changes, business-rule changes or new dependencies.

## Approval gate

## Task 8 closure update - 2026-09-20

- Task 8 is **COMPLETE / GREEN**: RED `6c8b8b760f3e75edb2c91b5d62fd26572efb3c4c` / Validate run `35532503944` failed as intended because the legacy migration allowlist still existed; GREEN `28b5ac578e9d778342254066ae6b7b5a0bc22a3c` / Validate run `35532635340` passed **1,928 tests / 1,927 pass / 0 fail / 1 skipped** and every Validate gate.
- Task 8 deleted `scripts/architecture/legacy-import-allowlist.json`, removed checker support for QZ/cross-domain migration allowances, retained historical removal guards, and closed the compatibility inventory at **0**. No replacement allowlist, deploy, merge, Worker, migration, D1, API, polling, capability or business-rule change was introduced.
- Task 9 is **NOT STARTED**.

This implementation plan was **APPROVED explicitly by the user on 2026-09-20**.

Tasks 1–4 are complete and green. Task 5 is not started.

## Final implementation status — 2026-09-20

- Tasks 1–4 remain **COMPLETE / GREEN** as recorded above.
- Task 5 is **COMPLETE / GREEN**: RED `adae7ba752601b136ffaa8900101ff7456af9be9` / Validate run `35529236782` failed as intended; final GREEN `062bc537e7e62734a956abfd9dec5225a2038e7b` / run `35529844889` passed with **1,920 tests / 1,919 pass / 0 fail / 1 skipped** and all gates green.
- Task 6 is **COMPLETE / GREEN**: RED `e06379a25954d600471a82d819f9cf984849f53b` / run `35530065644` failed as intended; final GREEN `8eaae2680054e2e605866aba3cc05dcb6469ddfd` / run `35530541977` passed with **1,926 tests / 1,925 pass / 0 fail / 1 skipped** and all gates green.
- Task 7 is **COMPLETE / GREEN**: RED `85da4cc8beab137b56631cae49e1c30896f24311` / run `35530720316` failed as intended; final GREEN `72a2dead649fc4f3a33c3bc7d7cba02b13b50993` / run `35531294891` passed with **1,927 tests / 1,926 pass / 0 fail / 1 skipped** and all gates green.
- Task 8 is **NOT STARTED**. No allowlist deletion, deploy, merge, or post-merge work was performed.
## Tasks 9–10 closure — 2026-09-20

- Task 9 is **COMPLETE / GREEN**. RED `aeabd3b` required the permanent final architecture gates; GREEN `e35b606` added generic legacy-root, App, frontend-shared, domain-purity/browser/fetch, public-entry, QZ and cycle protection. All migration allowlists and compatibility facades remain **0**.
- Task 10 is **COMPLETE / GREEN**. Its focused audit RED identified 40 surplus Orders exports and six surplus Customers exports. GREEN limits each public entry to real production consumers, keeps unit tests at their owner modules, and adds a test-file exemption to the production-only deep-import checker.
- The final audit is `docs/superpowers/qa/spec-c10-final-architecture-audit.md`. Full suite, architecture, lint, build, local D1 and Spec B D1 passed; production and staging Worker dry-runs passed using `--dry-run` only.
- No staging deploy, production deploy, remote migration, merge or production action occurred. **Task 11 is NOT STARTED.**
