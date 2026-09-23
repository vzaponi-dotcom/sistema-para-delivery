# Gestão Delivery — React Router Navigation Implementation Plan

Date: 2026-09-23  
Approved spec: `docs/superpowers/specs/2026-09-23-react-router-navigation-design.md`  
Issue: #43  
Design branch: `docs/react-router-navigation-design`  
Design base: `master@12f32d05401c59d9a3360d050df596a7c0803909`  
Status: **SELF-REVIEWED — READY FOR IMPLEMENTATION APPROVAL — product code not started**

## 1. Goal

Migrate the administrative frontend from local `activeTab` navigation state to URL-backed React Router navigation without changing product behavior, backend contracts, D1 schema or the dedicated Kitchen TV entry point.

The implementation must be incremental and keep the administrative runtime mounted while destinations change.

Primary outcomes:

- canonical URLs for every current administrative destination;
- Back/Forward support;
- refresh/deep-link support;
- capability-aware route correction;
- New Order and Settings guards for clicks and browser history;
- preserved Comanda/New Order identity flow;
- preserved query/session behavior;
- preserved mobile motion, focus and scroll behavior;
- preserved `/cozinha-tv` bundle boundary.

## 2. Implementation branch protocol

Do not implement on `docs/react-router-navigation-design`.

When implementation is authorized:

1. fetch current `origin/master`;
2. record exact master SHA;
3. compare it with design base `12f32d05401c59d9a3360d050df596a7c0803909`;
4. inspect any intervening navigation/App/entry-point changes;
5. create fresh branch:
   - `feature/react-router-navigation`;
6. bring the approved spec and this plan onto the implementation branch as documentation;
7. never develop directly on `master`;
8. no production deploy in implementation tasks.

If master materially changes `src/app/navigation`, `src/App.jsx`, `src/admin/AdminBootstrap.jsx`, `src/main.jsx`, `AppShell`, session runtime, Settings policy navigation or New Order draft ownership before Task 1 starts, reconcile the plan before product code.

## 3. Baseline gates before Task 1

Run on the fresh implementation branch before product changes:

```bash
npm test
npm run test:architecture
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
```

Record:

- exact base SHA;
- test totals/pass/fail/skip;
- architecture result;
- lint result;
- build result;
- production Worker dry-run;
- staging Worker dry-run;
- local D1 gate;
- Spec B D1 gate.

Baseline failures must be investigated before React Router changes.

## 4. Global implementation constraints

1. Strict RED -> GREEN for behavior changes.
2. Preserve current destination IDs.
3. Preserve current capability semantics.
4. Preserve current visual navigation.
5. URLs are owned only by `src/app/navigation`.
6. Domains/workflows navigate by destination ID, not raw path strings.
7. `App` runtime remains mounted across route transitions.
8. Do not move business data into Router loaders/actions.
9. Do not introduce SSR or Framework Mode.
10. Do not migrate existing filters/searches into URL params.
11. Do not persist New Order draft data across reload.
12. Do not encode Comanda identity in URL in this slice.
13. Do not redesign Settings, Finance, Orders, Comandas or shell.
14. Do not change Worker/API/database unless a proven Router requirement appears.
15. `/cozinha-tv` must remain outside the administrative Router.
16. No route-level lazy loading required in this slice.
17. No production deploy without separate authorization.
18. Keep commits small enough that each GREEN has a clear behavioral proof.

## 5. Planned task map

| Task | Purpose | Main outcome |
|---|---|---|
| 1 | Add Router dependency + canonical route contract | one URL source of truth |
| 2 | Add persistent Router foundation + test harness | App mounts under Data Router without changing behavior |
| 3 | Make URL the navigation source of truth | `activeTab` becomes route-derived |
| 4 | Add auth/deep-link/capability route correction | safe root, refresh and deep links |
| 5 | Unify navigation guards with browser history | Back/Forward respects New Order + Settings |
| 6 | Close workflow/mobile/session regressions | current flows remain equivalent |
| 7 | Harden architecture, entry-point and bundle boundaries | Kitchen TV/admin isolation remains explicit |
| 8 | Full staging homologation + closure | exact-SHA evidence and merge handoff |

---

# Task 1 — Add React Router and lock the canonical route contract

## Purpose

Introduce the dependency and make `app/navigation` the only owner of administrative URL mapping before any runtime navigation changes.

## Files

Modify:

- `package.json`;
- `package-lock.json`;
- `src/app/navigation/registry.js`;
- `src/app/navigation/registry.test.js`.

Create:

- `src/app/navigation/routes.js`;
- `src/app/navigation/routes.test.js`.

Do not modify `App.jsx` in this task.

## Precondition

Verify the stable React Router release selected at implementation time is compatible with:

- Node 22 CI;
- React `^19.2.8`;
- React DOM `^19.2.8`;
- Vite `^8.2.2`.

The approved design expects React Router 8.4.x at design time. If the current stable line changed, use the compatible stable release and record the resolved version.

## RED 1 — canonical paths absent

Write tests requiring every implemented administrative destination to have the approved canonical path:

- `orders -> /pedidos`;
- `history -> /pedidos/historico`;
- `new-order -> /pedidos/novo`;
- `comandas -> /comandas`;
- `print-queue -> /fila-de-impressao`;
- `dashboard -> /financeiro`;
- `receivables -> /financeiro/a-receber`;
- `finance -> /financeiro/movimentacoes`;
- `clients -> /clientes`;
- `products -> /produtos`;
- `tables -> /mesas`;
- Settings paths from the approved spec.

Assert:

1. all paths begin with `/`;
2. paths are unique;
3. every routable destination has exactly one canonical path;
4. `/cozinha-tv` is not present;
5. existing destination order/areas/capabilities remain unchanged.

Expected RED: path contract does not exist.

## GREEN 1

Add `path` metadata to the existing destination registry or derive it in one adjacent navigation-owned mapping.

Prefer one authoritative structure rather than a second unrelated constant.

## RED 2 — pure route helpers absent

Require pure helpers:

- `pathForDestination(id)`;
- `destinationForPath(pathname)`;
- `routeDefinitionsForImplemented(implemented)` or equivalent.

Assertions:

- known path -> correct ID;
- ID -> canonical path;
- round-trip is stable;
- unknown pathname -> null/unknown representation;
- trailing slash canonicalization is explicit and deterministic;
- query string/hash are not part of pathname matching;
- Kitchen TV path is never mapped to admin destination.

## GREEN 2

Implement the pure route contract in `routes.js`.

Keep React imports out of pure route mapping when possible.

## Dependency install

Install React Router using npm so both manifest and lockfile are authoritative.

Do not hand-edit the lockfile.

## Focused validation

```bash
node --test src/app/navigation/registry.test.js src/app/navigation/routes.test.js src/app/navigation/resolution.test.js
npm run test:architecture
npm run lint
```

## Commit target

`feat: define administrative route contract`

---

# Task 2 — Add the persistent Data Router boundary and Router-aware test harness

## Purpose

Put the administrative application under a Data Router without yet changing the user-facing navigation semantics.

The complete App/runtime must remain mounted while child destinations change.

## Files

Create, names may be adjusted during implementation:

- `src/app/navigation/adminRouter.jsx`;
- `src/app/navigation/adminRouter.test.js`;
- `src/app/navigation/routeMatch.js`;
- `src/app/navigation/routeMatch.test.js`.

Modify:

- `src/admin/AdminBootstrap.jsx`;
- `src/test-support/renderWorkspace.js`;
- App integration tests that mount `App` directly.

Potentially modify:

- `src/App.jsx` only enough to consume a route-derived destination contract; do not remove the old controller state yet if Task 3 owns that cutover.

## Router shape

Use a Data Router with a persistent root route.

Conceptual structure:

```text
RouterProvider
└── persistent Admin/App route
    ├── /pedidos                  handle destination=orders
    ├── /pedidos/historico        handle destination=history
    ├── /pedidos/novo             handle destination=new-order
    ├── /comandas                 handle destination=comandas
    ├── ...
    └── *                         handle unknown
```

The child route does not need to own the product surface yet.

Use route metadata/handle or an equivalent explicit mechanism to derive the matched destination ID.

Do not create 20 duplicated JSX page wrappers.

## RED 1 — route match contract

Tests require that a memory router can resolve representative paths to semantic destination IDs without rendering different App roots.

Cover at least:

- `/pedidos`;
- `/pedidos/historico`;
- `/comandas`;
- `/financeiro/a-receber`;
- `/configuracoes/impressao`;
- unknown path.

## GREEN 1

Create the route tree from Task 1's canonical route contract.

Expose a narrow hook/helper such as:

- `useMatchedDestination()`.

## RED 2 — persistent root

Add a lifecycle probe proving navigation among child routes does not unmount/remount the administrative root.

This is a hard regression contract.

## GREEN 2

Mount the Router in `AdminBootstrap.jsx`.

Keep:

- `StrictMode`;
- `ThemeProvider`;
- current CSS imports;
- current theme initialization.

## RED 3 — test harness support

Existing App integration tests must have one standard Router-aware mounting path.

Add a helper such as:

- `renderAdminApp(...)`;
- `renderWithAdminRouter(...)`.

It should use `createMemoryRouter` and allow:

- initial path;
- optional initial entries/history;
- access to router navigation/history for tests;
- current pathname assertions.

## GREEN 3

Migrate direct App render tests to the shared helper rather than hand-constructing routers per test.

Do not weaken existing test assertions.

## Focused validation

Run all tests that directly mount App plus:

```bash
node --test   src/app/navigation/adminRouter.test.js   src/app/navigation/routeMatch.test.js   src/test-support/renderWorkspace.test.js   src/AppNewOrderGuard.test.js   src/navigationContext.test.js   src/navigationContinuity.test.js   src/comandasAppWiring.test.js   src/comandasTransferNavigation.test.js   src/tablesAppWiring.test.js   src/settingsSurfaceIntegration.test.js   src/settingsNavigation.test.js   src/specBSettingsIntegration.test.js   src/actionCapabilities.test.js   src/operationalPayment.test.js   src/operationalHistoryAnalysis.test.js
```

## Commit target

`feat: mount admin app under data router`

---

# Task 3 — Make the matched URL the navigation source of truth

## Purpose

Remove independent local `activeTab` ownership and drive the existing shell/surfaces from the matched route.

This is the core cutover.

## Files

Modify:

- `src/app/navigation/useNavigationController.js`;
- `src/app/navigation/NavigationContext.jsx`;
- `src/app/navigation/useNavigationEventBridge.js` if required;
- `src/app/navigation/resolution.js`;
- `src/App.jsx`;
- navigation tests;
- shell/navigation tests as needed.

Potentially create:

- `src/app/navigation/useRouteNavigation.js` if separating Router concerns from pure decision logic materially improves testability.

## RED 1 — no independent active state

Add a structural/behavioral test requiring:

- `activeTab` comes from matched route;
- `useNavigationController` no longer initializes destination with `useState(resolveHome(...))`;
- navigating changes pathname;
- derived `activeTab` follows pathname.

The public context may still expose the field name `activeTab` for compatibility.

Expected RED: current controller owns `useState`.

## GREEN 1

Replace local destination state with Router location/match.

Keep local UI state only where appropriate:

- More panel open/closed;
- pending guard confirmation metadata.

## RED 2 — semantic navigation writes canonical URL

Require:

- `requestNavigation('clients')` -> `/clientes`;
- area navigation resolves semantic destination first then canonical path;
- `app:navigate` with `clients` produces same navigation;
- raw path strings are not required by consumers.

## GREEN 2

Use Router navigation internally.

Keep domain/workflow-facing APIs semantic.

## RED 3 — shell behavior

Verify destination changes caused by Router still trigger:

- mobile direction;
- scroll-to-top;
- focus restoration;
- semantic page transition key.

## GREEN 3

Preserve `AppShell` dependency on derived destination ID, not raw pathname.

## App surface rendering

Keep the existing surface composition in `App.jsx` for this task.

It is acceptable for `App.jsx` to continue conditionally rendering by the route-derived `activeTab`.

Do not move surfaces into route modules yet.

Preserve intentional always-mounted behavior such as `CatalogWorkspace visible={...}`.

## Focused validation

```bash
node --test   src/app/navigation/NavigationContext.test.js   src/app/navigation/AreaNavigation.test.js   src/app/navigation/resolution.test.js   src/navigationContext.test.js   src/navigationContinuity.test.js   src/app/shell/AppShell.test.js   src/mobileNavigation.test.js   src/comandasNavigation.test.js
npm run test:architecture
```

## Commit target

`feat: drive admin navigation from URL`

---

# Task 4 — Add root, deep-link, auth and capability route correction

## Purpose

Make direct URLs safe and predictable before adding history blockers.

## Files

Create or modify:

- route gate/navigation resolution hook under `src/app/navigation/`;
- `src/App.jsx`;
- session/navigation integration tests;
- capability integration tests.

Potential file:

- `src/app/navigation/useRouteGate.js`;
- `src/app/navigation/useRouteGate.test.js`.

## Important phase model

Route validation must distinguish:

1. auth/session still unresolved;
2. unauthenticated fresh deep link;
3. authenticated but bootstrap/capabilities not authoritative yet;
4. authenticated + capability context authoritative.

Do not redirect a valid requested deep link merely because auth is not ready yet.

## RED 1 — root home

Test:

- initial `/`;
- authenticated Orders-capable user -> replace `/pedidos`;
- Finance-only user -> current `resolveHome` Finance fallback;
- no duplicate browser entry.

## GREEN 1

Resolve root after authoritative session/capability context is ready.

## RED 2 — allowed external deep link

Initial URL:

- `/financeiro/a-receber`.

Before login:

- keep requested pathname.

After successful auth/bootstrap with capability:

- remain on `/financeiro/a-receber`;
- render Receivables.

## GREEN 2

Preserve initial route intent through authentication.

## RED 3 — denied/unknown/unavailable route

Cover:

- known denied URL;
- unknown URL;
- known route missing from implemented set.

Expected:

- never render forbidden surface;
- replace with safe resolved home/fallback;
- use existing feedback semantics;
- no history loop.

## GREEN 3

Implement route correction with replace semantics.

## RED 4 — area root fallback

Examples:

- `/pedidos` + history-only capability -> replace `/pedidos/historico`;
- `/financeiro` + only movements -> replace `/financeiro/movimentacoes`;
- `/configuracoes` + only local preference -> stay/canonicalize to the approved first allowed Settings destination.

Keep current `resolveArea` ordering authoritative.

## GREEN 4

Use existing area resolution rather than a second capability algorithm.

## RED 5 — logout/expiry reset

From a non-home deep route:

- logout/expiry clears application state;
- navigation is replaced to `/`;
- a later login resolves normal home;
- old route is not resurrected.

## GREEN 5

Make `resetNavigation` a Router-aware reset that bypasses ordinary guards because session teardown owns the reset.

## Focused validation

```bash
node --test   src/app/navigation/useRouteGate.test.js   src/navigationContext.test.js   src/actionCapabilities.test.js   src/settingsSessionRecovery.test.js   src/app/runtime/session/*.test.js
```

Use exact existing session-test filenames present at implementation time.

## Commit target

`feat: support safe admin deep links`

---

# Task 5 — Unify New Order and Settings guards with Back/Forward

## Purpose

Make browser history obey the same safety rules as UI navigation.

This is the most delicate task and must remain isolated from unrelated cleanup.

## Files

Modify:

- Router-aware navigation hook/controller;
- `src/app/navigation/draftExitGuard.js` only if pure contract needs generalization;
- `src/App.jsx` modal wiring if pending contract changes;
- New Order unload protection owner;
- Settings integration only through existing generic bridge.

Create focused tests such as:

- `src/app/navigation/routerBlocker.test.js`;
- `src/app/navigation/newOrderUnloadGuard.test.js`.

Do not move Settings policy ownership into navigation.

## Guard precedence

Preserve:

1. unknown/denied/unavailable -> reject/correct;
2. checkout pending -> block;
3. dirty New Order leaving New Order -> confirm;
4. dirty Settings resource leaving protected resource -> confirm;
5. otherwise navigate.

## RED 1 — browser Back on dirty New Order

History example:

`/pedidos -> /pedidos/novo`

Make draft dirty, then Back.

Expected:

- URL/destination remains New Order while blocked;
- existing discard modal opens;
- Cancel stays;
- Confirm discards exactly once and returns to intended history destination.

## GREEN 1

Integrate `useBlocker` with the existing modal state.

## RED 2 — Forward + duplicate intent

After a cancelled/blocked Back scenario, verify Forward or another navigation cannot overwrite an already pending intent.

Only one pending blocked transition is authoritative.

## GREEN 2

Keep a single blocker/pending navigation owner.

## RED 3 — Settings same-resource vs leave-resource

Using browser Back/Forward:

- Settings Operations -> Modalities in same resource with dirty draft: no prompt;
- Settings -> Clients while dirty: prompt;
- Cancel leaves URL untouched;
- Confirm discards exactly once.

## GREEN 3

Resolve current and next destination IDs before calling `shouldConfirmDraftExit`.

## RED 4 — revalidation on confirm

While modal is open:

- revoke capability to target;
- confirm discard.

Expected:

- target is not entered;
- draft is not discarded just to enter a now-denied route;
- blocked transition is reset/corrected safely;
- feedback shown.

Preserve the existing high-value regression from `settingsDraftNavigation.test.js`.

## GREEN 4

Re-resolve destination and current draft at decision time.

Never trust stale modal payload alone.

## RED 5 — checkout pending

From `/pedidos/novo` with checkout pending:

- click navigation;
- browser Back.

Expected:

- both are blocked;
- no discard modal is required for checkout state;
- existing feedback semantics remain;
- location does not move.

## GREEN 5

Use the same pure decision policy for UI/history transitions.

## RED 6 — `completeNavigation` after successful submit

A committed order may still transiently report dirty state during callback order.

Require:

- successful New Order commit navigates to stored return destination;
- no discard modal;
- no second discard;
- Comanda return remains correct.

## GREEN 6

Provide a narrow trusted completion/bypass path only for already-committed workflow completion.

Do not create a general public bypass.

## RED 7 — hard reload/close New Order

Add `beforeunload` coverage:

- pristine New Order: no added unload protection;
- dirty New Order: unload protected;
- checkout pending: unload protected;
- leaving New Order removes its listener when no longer needed.

Settings' existing `beforeunload` tests stay green.

## GREEN 7

Add a narrow browser-boundary hook.

Do not persist draft data.

## Focused validation

```bash
node --test   src/app/navigation/routerBlocker.test.js   src/app/navigation/newOrderUnloadGuard.test.js   src/app/navigation/draftExitGuard.test.js   src/AppNewOrderGuard.test.js   src/settingsDraftNavigation.test.js   src/app/policy-editing/PolicyEditingProvider.test.js   src/comandasTransferNavigation.test.js
```

## Commit target

`feat: guard routed navigation history`

---

# Task 6 — Close workflow, mobile, query and runtime regressions

## Purpose

Prove the Router did not change operational behavior outside navigation mechanics.

This task is primarily regression proof and narrowly-scoped fixes.

## Files

Modify only where regressions are proven.

Expected tests include:

- `src/navigationContinuity.test.js`;
- `src/navigationContext.test.js`;
- `src/mobileNavigation.test.js`;
- `src/mobileNoSwipeNavigation.test.js`;
- `src/mobilePageMotion.test.js`;
- `src/comandasNavigation.test.js`;
- `src/comandasTransferNavigation.test.js`;
- `src/tablesNavigation.test.js`;
- `src/AppNewOrderGuard.test.js`;
- `src/settingsNavigation.test.js`;
- `src/settingsDraftNavigation.test.js`;
- `src/app/shell/AppShell.test.js`;
- Printing/Print Queue navigation tests.

## RED/GREEN checkpoints

### A — Query continuity

Orders/Clients/Products/Receivables current in-memory query state persists across internal navigation exactly as today.

Reload may reset query state; URL query migration is out of scope.

### B — Orders live runtime

`ordersSyncEnabled`, Kitchen clock and order-arrival behavior still depend on semantic active destination `orders`, now route-derived.

No extra polling when another route is active.

### C — Comanda identity

Preserve:

- selecting Comanda;
- entering New Order from Comanda;
- transfer identity;
- cancel/success return destination;
- payment flow.

### D — Print Queue -> Settings

`onOpenPrintingSettings` navigates to `/configuracoes/impressao` through semantic ID.

No QZ ownership moves.

### E — Mobile

Preserve:

- bottom navigation ordering;
- More sheet;
- More current-state behavior;
- mobile page direction;
- no swipe navigation regression;
- closing More before destination transition.

### F — Focus/scroll

Every semantic destination change:

- scrolls to top;
- focuses app content;
- does not steal focus during polling/visibility refresh.

### G — effect continuity

Repeat multiple route cycles and assert no accumulating:

- event listeners;
- timers;
- Settings saves;
- payment submits;
- print submits.

Use the existing A9 navigation continuity regression as a primary proof.

## Validation

Run the navigation/mobile/comanda/settings/printing integration cluster, then:

```bash
npm test -- --test-shard=1/8
```

The exact shard is not authoritative; use focused tests first, full suite in Task 8.

## Commit target

`test: close routed navigation regressions`

If product fixes are required, use a product commit followed by the regression commit rather than hiding both under a test-only label.

---

# Task 7 — Harden architecture, Kitchen TV and build/deep-link boundaries

## Purpose

Prevent the Router migration from pulling the administrative app into Kitchen TV or introducing server routing hacks.

## Files

Modify:

- `scripts/architecture/check-import-boundaries.mjs`;
- architecture tests;
- entry-point regression tests;
- optional build-output regression test if repository conventions allow deterministic assertion.

Potentially create:

- `src/admin/adminRoutingBoundary.test.js`;
- `src/kitchen-display/kitchenDisplayRoutingBoundary.test.js`.

No Worker production route changes are expected.

## RED 1 — admin/TV Router boundary

Require:

- `src/kitchen-display/**` cannot import administrative Router files;
- Kitchen TV cannot import `App.jsx`;
- admin Router cannot import `KitchenDisplayRoot`;
- `src/main.jsx` still selects Kitchen TV before AdminBootstrap import.

## GREEN 1

Extend architecture checker only as narrowly needed.

Do not create broad false-positive regexes against React Router internals.

## RED 2 — Kitchen TV bundle regression

Build and inspect output/import graph enough to prove:

- `/cozinha-tv` entry remains dynamically separate;
- admin Router addition does not make Kitchen TV statically depend on App/admin code.

Do not impose arbitrary bundle-size thresholds unless there is a stable baseline.

## GREEN 2

Fix imports only if needed.

## RED 3 — SPA fallback contract

Add a configuration regression asserting:

- Cloudflare assets keep `not_found_handling: "single-page-application"`;
- `run_worker_first` remains limited to API behavior as currently configured;
- no catch-all frontend route was added to Worker.

## GREEN 3

Likely documentation/test-only if configuration already satisfies contract.

## Build validation

```bash
npm run test:architecture
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

## Commit target

`test: enforce routed entry boundaries`

---

# Task 8 — Full validation, staging homologation and closure

## Purpose

Produce the release candidate, validate exact SHA, deploy only staging, perform manual navigation QA and prepare merge handoff.

No production deploy.

## Step 1 — Full local/repository gates

Run:

```bash
npm test
npm run test:architecture
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
```

Expected:

- zero new skipped tests unless explicitly justified;
- no D1 migration added;
- no Worker route behavior change required;
- no architecture regressions.

## Step 2 — exact-SHA remote Validate

Push candidate SHA and run the normal Validate workflow.

Record:

- candidate SHA;
- Validate run number/id;
- all 8 test shards;
- architecture/lint/build;
- Worker dry-runs;
- D1 gates.

Do not call the candidate GREEN until the exact SHA is green remotely.

## Step 3 — staging deploy

Deploy that exact candidate to staging through the established staging workflow.

Record:

- deploy run;
- Worker version ID;
- staging URL health;
- no pending migrations expected.

## Step 4 — automated/direct deep-link smoke

Verify staging direct loads, not only client-side clicks:

- `/pedidos`;
- `/pedidos/historico`;
- `/comandas`;
- `/financeiro/a-receber`;
- `/configuracoes/impressao`;
- `/cozinha-tv`.

Each admin deep link must return the SPA and resolve after auth.

Kitchen TV must remain its own entry behavior.

## Step 5 — manual desktop QA

Minimum sequence:

1. login from `/`;
2. Pedidos -> Histórico -> Comandas -> Financeiro -> Clientes -> Settings;
3. browser Back repeatedly;
4. browser Forward repeatedly;
5. F5 on Pedidos;
6. F5 on Financeiro/A Receber;
7. F5 on Settings/Impressão;
8. F5 on Comandas;
9. direct deep link before login if session can be cleared safely;
10. dirty New Order + sidebar click -> cancel;
11. dirty New Order + sidebar click -> discard;
12. dirty New Order + browser Back -> cancel;
13. dirty New Order + browser Back -> discard;
14. New Order hard refresh -> native warning;
15. Settings dirty + same-resource subnavigation -> no prompt;
16. Settings dirty + leave Settings resource -> prompt;
17. Print Queue -> Printing Settings;
18. logout from a non-home route -> login returns normal home;
19. no visual/layout regressions.

## Step 6 — manual mobile QA

At representative mobile viewport:

1. bottom navigation destinations;
2. Comandas;
3. Finance;
4. More -> Clients;
5. More -> Products;
6. More -> Settings;
7. Back/Forward;
8. scroll resets to top;
9. focus behavior remains usable;
10. dirty New Order guard;
11. dirty Settings guard;
12. More sheet closes after navigation;
13. no horizontal overflow/navigation regression.

## Step 7 — permissions QA

Using test fixture/harness or safe restricted session:

- allowed deep link works;
- denied deep link does not flash forbidden surface;
- history-only capability from `/pedidos` falls back to `/pedidos/historico`;
- Finance area uses current allowed fallback;
- capability revoked while confirmation is open cannot enter target.

## Step 8 — Kitchen TV QA

Regression only:

- `/cozinha-tv` loads;
- pairing screen/runtime works;
- existing paired session behavior remains;
- administrative Router does not appear in TV UI;
- no admin session reuse introduced.

Physical-TV re-homologation is only required if build/runtime evidence shows the TV entry changed materially. Otherwise staging browser + automated boundary proof is sufficient for this navigation-only slice.

## Step 9 — docs/QA closure

Create:

- `docs/superpowers/qa/react-router-navigation-qa.md`.

Record:

- base SHA;
- product candidate SHA;
- final docs SHA;
- task RED/GREEN evidence;
- Validate;
- staging deploy;
- manual QA matrix;
- known limitations;
- production status.

Update the issue/PR description with the same evidence.

## Step 10 — PR state

Prepare PR:

- base: `master`;
- head: `feature/react-router-navigation`;
- keep unmerged until explicit authorization.

Release communication:

- no visual tour;
- concise release/history note only if the product release system requires it;
- user-facing wording focuses on URLs, refresh and Back/Forward, not the library name.

## Merge gate

Before requesting merge authorization:

- Tasks 1–8 complete;
- exact candidate Validate green;
- staging homologated;
- 0 blocking/high/medium review findings;
- no unresolved review threads;
- no production deploy executed.

## Commit target

`docs: close React Router navigation QA`

---

## 6. Expected commit/checkpoint sequence

A clean implementation will approximately produce:

1. `feat: define administrative route contract`
2. `feat: mount admin app under data router`
3. `feat: drive admin navigation from URL`
4. `feat: support safe admin deep links`
5. `feat: guard routed navigation history`
6. focused regression/fix commits as needed
7. `test: enforce routed entry boundaries`
8. `docs: close React Router navigation QA`

TDD RED commits may precede each GREEN where the repository's established execution pattern calls for explicit RED evidence.

Do not squash away required RED/GREEN evidence before review unless explicitly authorized.

## 7. Risk register

### Risk A — duplicated navigation state

Failure mode:

- URL says one destination;
- local state says another.

Mitigation:

- Task 3 removes independent destination state;
- route-derived destination is canonical.

### Risk B — App/runtime remount

Failure mode:

- polling, printing, drafts or selection reset on each route.

Mitigation:

- persistent root route;
- lifecycle regression test in Task 2.

### Risk C — Back bypasses discard guard

Failure mode:

- dirty New Order/Settings is lost with browser Back.

Mitigation:

- `useBlocker`;
- dedicated history tests;
- custom modal preserved.

### Risk D — deep link redirected before auth resolves

Failure mode:

- user requests valid route but is sent home during session bootstrap.

Mitigation:

- explicit unresolved/authenticated phases in Task 4.

### Risk E — stale capability at confirm

Failure mode:

- blocked route becomes unauthorized while modal open.

Mitigation:

- re-resolve destination/capability/draft on confirm.

### Risk F — New Order committed but guard fires

Failure mode:

- successful save opens discard dialog because dirty state clears later.

Mitigation:

- narrow trusted `completeNavigation` completion path.

### Risk G — test suite becomes Router-fragile

Failure mode:

- every component test needs custom router setup.

Mitigation:

- shared Router-aware harness in Task 2.

### Risk H — Kitchen TV bundle contamination

Failure mode:

- adding Router to admin pulls it into Kitchen TV entry.

Mitigation:

- keep `src/main.jsx` dynamic split;
- architecture/build regressions in Task 7.

### Risk I — route refactor accidentally becomes page refactor

Failure mode:

- moving all surfaces into route modules widens lifecycle risk.

Mitigation:

- explicitly defer route-owned surface decomposition/lazy loading.

## 8. Definition of done

The implementation is complete only when all of the following are true:

- React Router is the administrative navigation source of truth;
- `activeTab` is route-derived rather than independently stored;
- all approved canonical URLs work;
- root, deep links, refresh, Back and Forward work;
- capabilities are enforced on direct URLs;
- New Order/Settings safety guards work for UI and history navigation;
- New Order warns on risky hard unload;
- Comanda return identity remains correct;
- session/logout behavior remains safe;
- mobile navigation behavior is preserved;
- query context behavior is preserved;
- polling/printing/runtime lifecycle remains stable;
- Kitchen TV remains isolated;
- full test/architecture/lint/build/dry-run/D1 gates are green;
- staging is homologated;
- production is untouched until separately authorized.
