# Spec C2 — Navigation and App Composition — QA Record

## Execution identity

- Slice: **C2 — Navigation and App Composition**
- Branch: `feature/spec-c2-navigation-composition`
- Base SHA: `f5d8b7267cdbf91a7d254a3c1546464d4d9b0210`
- Pull request: #46 — `Spec C2: modularizar navegação e composição do frontend`
- Homologated executable SHA: `882fa7bb3a7bfd3abc3a6ba6a9c58e407da201b8`
- Validate application: #1213 / run `35139754603` — **SUCCESS**
- Deploy staging: #178 / run `35141467373` — `workflow_dispatch` — **SUCCESS**
- Staging URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`
- Manual homologation: 2026-09-16, approximately 16:54 BRT
- Production deploy: **NO**
- Merge: **NO**

## Gate evidence before manual QA

The executable SHA above passed the complete validation workflow, including:

- tests;
- frontend architecture gate;
- lint;
- build;
- production Worker dry-run;
- staging Worker dry-run;
- local D1 migrations;
- Spec B D1 clean-install/upgrade gate.

The manual staging deploy ran on the exact executable SHA via `workflow_dispatch` and passed migrations, deploy, staging readiness and real login verification.

## Manual staging matrix

| # | Scenario | Result | Evidence / limitation |
|---|---|---|---|
| 1 | Login and home | **PASS** | Login worked; initial destination observed as Cozinha/Pedidos. |
| 2 | Desktop Sidebar | **PASS** | Links, active highlight and SPA navigation worked without full-page reload. |
| 3 | Area fallback with reduced capability | **BLOCKED** | Staging had no reduced-capability profile that could safely reproduce the scenario. Automated complementary evidence exists in `src/app/navigation/resolution.test.js`, including `Financeiro sem dashboard abre A receber` and stable area fallbacks. |
| 4 | Direct mobile navigation | **PASS** | Pedidos, Comandas and Financeiro worked in mobile viewport. |
| 5 | Mobile `Mais` menu | **PASS** | BottomSheet opened; Clientes and Mesas were reached; close behavior and logout remained available. |
| 6 | Internal area navigation | **PASS** | Cozinha/Histórico, Financeiro tabs and available Settings sections navigated correctly. |
| 7 | Query/filter continuity and new-session reset | **PASS** | Search value `QA C2` persisted across pages and reset after logout/login. |
| 8 | New Order return origin | **PASS** | Cancelling returned correctly to Pedidos and to Comandas depending on origin. |
| 9 | Dirty New Order discard guard | **PASS** | Confirmation appeared; cancelling preserved the draft; confirming discard returned to the requested origin. |
| 10 | Checkout pending blocks navigation | **BLOCKED** | Could not safely hold `order:create` pending in staging. Automated complementary evidence exists in `src/navigationContext.test.js`, test `checkout bloqueia e pedido sujo exige confirmação antes de navegar`. |
| 11 | Settings dirty / saving / unconfirmed | **DIRTY PASS / SAVING-UNCONFIRMED BLOCKED** | Dirty discard guard worked manually. `saving`/`unconfirmed` states were not safely reproducible in staging. Automated complementary evidence exists in `src/settingsDraftNavigation.test.js`, test `saving or unconfirmed settings commitments can navigate without discard or another write decision`. |
| 12 | Focus and page transition | **PASS** | `page-transition` was observed and focus moved to `DIV.app-content`. |
| 13 | Cozinha dedicated polling vs global sync | **BLOCKED** | Homologation interface did not expose Network/DevTools. Automated complementary evidence exists in `src/app/runtime/data/useOperationalDataRuntime.test.js` for 5000 ms global and 2000 ms orders intervals and subscription cleanup, plus `src/app/navigation/navigationExtractionContract.test.js` proving `activeTab === 'orders'` remains the operational activation signal. |
| 14 | `app:navigate` compatibility | **BLOCKED** | A real browser console was unavailable. Automated complementary evidence exists in `src/app/navigation/NavigationContext.test.js` for the single listener/dispatch contract and `src/navigationContext.test.js` for dispatch in the real App tree navigating to Clientes. |
| 15 | Visual regression desktop/mobile, light/dark | **PASS** | Desktop/mobile and light/dark were checked with no evident C2-attributable regression. |

## Matrix summary

- Fully **PASS**: 10 items.
- Fully **BLOCKED**: 4 items — 3, 10, 13 and 14.
- Partial result: item 11 — DIRTY **PASS**, SAVING/UNCONFIRMED **BLOCKED**.
- **FAIL**: 0 items.

This record intentionally does **not** convert manual `BLOCKED` scenarios into `PASS`. Automated tests are complementary evidence only and document the preserved contract where the staging homologation tool could not safely reproduce or observe the scenario.

## Automated complementary evidence

- Area fallbacks: `src/app/navigation/resolution.test.js`.
- Checkout navigation block: `src/navigationContext.test.js`.
- Settings saving/unconfirmed navigation behavior: `src/settingsDraftNavigation.test.js`.
- Polling intervals/subscription cleanup: `src/app/runtime/data/useOperationalDataRuntime.test.js`.
- Polling activation ownership preserved in App: `src/app/navigation/navigationExtractionContract.test.js`.
- Single `app:navigate` listener and event bridge contract: `src/app/navigation/NavigationContext.test.js`.
- `app:navigate` through the real App tree: `src/navigationContext.test.js`.

## Staging hygiene

- No QA data was intentionally left persisted.
- Temporary New Order test content was discarded.
- Theme was restored to **Automático**.
- Temporary Settings change `50 → 51` was discarded without saving.
- No staging redeploy occurred after homologation.
- Production remained untouched.

## Merge gate

C2 is homologated with **0 manual FAIL** and remains pending explicit merge authorization. PR #46 remains draft at this record point. C3 remains blocked until C2 is explicitly merged and the resulting `master` is validated.