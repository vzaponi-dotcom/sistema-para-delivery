# Issue #21 — Dashboard meal metrics: implementation evidence

Branch: `feature/issue-21-dashboard-meal-metrics`  
Baseline: `619c8086e930ee7086876d24b8c9bd46324d99b1`  
Implementation checkpoint: `03d6fb9135f4e12496e56308a0a256056d4c6b9e`

## Local RED/GREEN

| Phase | Commit | Evidence |
| --- | --- | --- |
| Analytics RED | `cbbd232` | `node --test src/utils/dashboardAnalytics.test.js`: 6 pass, 2 fail; Top Produtos returned 5 instead of 10 and `getMealsSold` was absent. |
| Analytics GREEN | `c3285ea` | Same focused command: 8 pass, 0 fail. |
| UI RED | `75853e0` | `node --test src/pages/DashboardAnalytics.test.js src/dashboardResponsive.test.js`: 11 pass, 3 fail, all for missing UI text/wiring. |
| UI GREEN | `9487f43` | `node --test src/utils/dashboardAnalytics.test.js src/pages/DashboardAnalytics.test.js src/dashboardResponsive.test.js`: 22 pass, 0 fail. |

## Local gates

- `npm.cmd test`: 2027 pass, 0 fail, 0 skipped (1990 top-level tests, 1 suite).
- `npm.cmd run test:architecture`: `Frontend architecture boundaries: OK`.
- `npm.cmd run lint`: exit 0; existing warnings outside the Issue #21 files.
- `npm.cmd run build`: exit 0; 507 modules transformed. Vite reported a chunk size warning.
- `npm.cmd run d1:migrate:local`: exit 0; local migrations `0026` and `0027` applied.
- `node scripts/infra/spec-b-d1-gate.mjs`: exit 0; all checks true, Wrangler `4.128.0`, local D1, 27 migrations.

The first local D1 attempt could not fetch Wrangler from npm inside the restricted sandbox (`EACCES`). The same command succeeded with access to the configured npm cache and registry.

## Changed application files

- `src/app/surfaces/dashboard/dashboardAnalytics.js`
- `src/app/surfaces/dashboard/DashboardSurface.jsx`
- `src/utils/dashboardAnalytics.test.js`
- `src/pages/DashboardAnalytics.test.js`

No files changed in `worker/`, `migrations/`, Catalog, Finance, Table Service, printing, or QZ. No production deployment or merge was performed during local implementation.

## Remote CI

- Validate application #1690 / run `35670838677`: **SUCCESS** on exact executable SHA `720fc0a4af160a819ff4b01b77264ff0244eeaf7`.
- 8/8 test shards: SUCCESS.
- 2027 tests / 2026 pass / 0 fail / 1 skipped.
- Frontend architecture: PASS.
- Lint: PASS.
- Build: PASS.
- Production Worker dry-run: PASS.
- Staging Worker dry-run: PASS.
- Local D1: PASS.
- Spec B D1 clean install/upgrade: PASS.

## Official staging

- Deploy staging #198 / run `35671044737`: **SUCCESS** on executable SHA `720fc0a4af160a819ff4b01b77264ff0244eeaf7`.
- Build: PASS.
- Staging Worker dry-run: PASS.
- No pending remote migration.
- Deploy: PASS.
- Worker version: `13c4d27c-b488-4655-9626-38906b739a12`.
- Readiness: PASS on attempt 1/6.
- Login smoke: HTTP 200.
- Production untouched.

## Guided manual QA closure

Guided staging homologation was completed by the user on 2026-09-21.

Result: **21 MANUAL PASS / 0 FAIL / 0 BLOCKED + 1 AUTOMATED PASS**.

| # | Scenario | Result |
| --- | --- | --- |
| 1 | Dashboard opens without visual regression | PASS |
| 2 | Refeições vendidas card is visible | PASS |
| 3 | Today updates the counter | PASS |
| 4 | 7 days updates the counter | PASS |
| 5 | 30 days updates the counter | PASS |
| 6 | One Refeições item contributes one unit | PASS |
| 7 | Quantity greater than one contributes all units | PASS |
| 8 | Mixed Refeição + Bebida counts only meals | PASS |
| 9 | Local/table-tab order counts | PASS |
| 10 | Bebidas/Adicionais do not increase meal count | PASS |
| 11 | Legacy `Marmita` snapshot counts | PASS — automated coverage; no artificial legacy data created for manual QA |
| 12 | Cancelled order does not participate | PASS |
| 13 | Hiding monetary values keeps meal count visible | PASS |
| 14 | Heading shows Top 10 produtos | PASS |
| 15 | Positions beyond fifth are displayed when data exists | PASS |
| 16 | Ranking remains sorted by quantity | PASS |
| 17 | Quantities and labels remain legible | PASS |
| 18 | Desktop displays four period cards correctly | PASS |
| 19 | Mobile cards have no horizontal overflow | PASS |
| 20 | Top 10 has no internal horizontal scrolling | PASS |
| 21 | Light theme has no regression | PASS |
| 22 | Dark theme has no regression | PASS |

### Manual test notes

- A controlled mixed order with two units of one `Refeições` product, one unit of another `Refeições` product, and two beverages increased the meal counter by exactly three; beverages did not contribute.
- The same order remained included in 7-day and 30-day periods.
- A Local/table-tab order with two meal units increased the metric by exactly two.
- Cancelling the controlled meal order removed its three meal units and adjusted Top 10 accordingly.
- More than five product positions were visible in the real staging dataset and ordering remained quantity-descending.
- Mobile and desktop layouts, light/dark themes, period selector, privacy control, labels and quantities were all manually accepted.

## Current closure state

- Application executable remains the staging-homologated SHA `720fc0a4af160a819ff4b01b77264ff0244eeaf7`.
- No application correction was required during manual QA.
- Issue #21 remains open until merge.
- PR #57 remains OPEN / DRAFT until final merge authorization.
- **NO PRODUCTION DEPLOY.**
- **MERGE NOT EXECUTED.**

## Production release confirmation — 2026-09-21

Issue #21 was included in the approved production release.

- PR #57 merge commit: `a7a0a0dd01ddc965a5175da9229212059968744a`;
- final production master after release-doc closure: `5540a9c11b17d028ff9e3126237e056949bae5e1`;
- Deploy production #50 / run `35673385098`: **SUCCESS**;
- production Worker version: `2e608341-b77a-472a-a432-978de02750e3`;
- production login smoke: **HTTP 200**.

Issue #21 is **CLOSED / COMPLETED** and the feature is now live in production.

