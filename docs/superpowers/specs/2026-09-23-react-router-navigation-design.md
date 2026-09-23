# Gestão Delivery — React Router Navigation Design

Date: 2026-09-23  
Issue: #43 — Modernizar navegação do frontend com React Router após a Spec C  
Base audited: `master@12f32d05401c59d9a3360d050df596a7c0803909`  
Design branch: `docs/react-router-navigation-design`  
Status: **DRAFT FOR REVIEW — no product implementation yet**

## 1. Goal

Replace the administrative frontend's in-memory `activeTab` navigation source of truth with URL-based React Router navigation while preserving the already-homologated visual and business behavior.

The migration must deliver:

- real URLs for administrative destinations;
- browser Back/Forward support;
- direct deep links;
- refresh that preserves the current destination when that destination is valid;
- capability-aware route resolution;
- the existing New Order and Settings unsaved-change protections;
- the existing mobile/desktop navigation behavior;
- a route architecture ready for future Reporting routes and optional route-level lazy loading;
- zero coupling between the administrative router and the dedicated Kitchen TV entry point.

This is a navigation refactor, not a product redesign.

## 2. Current architecture confirmed on the audited base

Spec C already created the correct migration boundary under `src/app/navigation/`.

Current ownership:

- `registry.js` owns destination IDs, areas, labels and capability requirements;
- `resolution.js` owns capability/availability resolution, home/area fallback and mobile direction;
- `useNavigationController.js` owns `activeTab`, navigation intent, New Order guard and Settings draft guard;
- `NavigationContext.jsx` exposes navigation to shell/surfaces;
- `useNavigationEventBridge.js` preserves the legacy `app:navigate` event contract;
- `AppShell.jsx` reacts to destination changes for mobile direction, scroll-to-top and focus restoration;
- `PolicyEditingProvider.jsx` already owns Settings `beforeunload` protection;
- `App.jsx` still conditionally renders surfaces from `activeTab`;
- `src/main.jsx` already splits `/cozinha-tv` from the administrative application before either bundle is imported;
- Cloudflare assets already use `not_found_handling: "single-page-application"`, so direct administrative deep links can receive the SPA shell without a Worker routing change.

Therefore this migration must replace navigation state, not reopen domain ownership.

## 3. React Router mode and dependency

Use the current stable React Router line available at implementation time. At design time, the current stable release is React Router 8.4.x.

Use:

- package: `react-router`;
- Data Mode;
- `createBrowserRouter`;
- `RouterProvider` from `react-router/dom`;
- `useBlocker` for in-SPA navigation blocking;
- `createMemoryRouter` for focused router tests where useful.

Do **not** introduce React Router Framework Mode, SSR, route actions, route data loaders or a React Router-specific server runtime in this slice.

Reason for Data Mode: the official `useBlocker` contract is available for Data/Framework routers and lets us preserve the existing custom discard modal for Back/Forward as well as application-initiated navigations.

Do not use `unstable_usePrompt`; the application already has an accessible custom confirmation modal and must not depend on browser `window.confirm` behavior.

## 4. Architectural rule

The canonical navigation source becomes:

`browser URL -> route match -> destination ID -> existing application contracts`

It must no longer be:

`local React activeTab state -> destination ID`.

Destination IDs remain stable internal contracts. Domains and workflows continue navigating by semantic destination ID rather than importing URL strings directly.

URLs belong to `app/navigation`.

## 5. Canonical route map

The first Router version uses the following canonical paths:

| Destination ID | Canonical path |
| --- | --- |
| `orders` | `/pedidos` |
| `history` | `/pedidos/historico` |
| `new-order` | `/pedidos/novo` |
| `comandas` | `/comandas` |
| `print-queue` | `/fila-de-impressao` |
| `dashboard` | `/financeiro` |
| `receivables` | `/financeiro/a-receber` |
| `finance` | `/financeiro/movimentacoes` |
| `clients` | `/clientes` |
| `products` | `/produtos` |
| `tables` | `/mesas` |
| `settings-home` | `/configuracoes` |
| `settings-operations` | `/configuracoes/operacao` |
| `settings-modalities` | `/configuracoes/modalidades` |
| `settings-payments` | `/configuracoes/pagamentos` |
| `settings-cancellations` | `/configuracoes/cancelamentos` |
| `settings-finance-categories` | `/configuracoes/categorias-financeiras` |
| `settings-kitchen-tv` | `/configuracoes/tv-da-cozinha` |
| `settings-printing` | `/configuracoes/impressao` |
| `settings-device` | `/configuracoes/dispositivo` |

The public Kitchen TV path remains exactly:

- `/cozinha-tv`

and is **not** an administrative destination.

## 6. Registry is the URL source of truth

Extend the existing navigation registry instead of creating an unrelated second route map.

Each routable destination owns its canonical `path` in `registry.js`.

Navigation code must expose pure helpers such as:

- `pathForDestination(id)`;
- `destinationForPath(pathname)`;
- route definitions derived from the destination registry.

No domain or surface may hard-code its own copy of administrative route paths.

The current destination IDs, area assignments, labels and capability contracts remain unchanged.

## 7. Router composition without remounting the application runtime

The router must sit at the administrative bootstrap boundary.

Target shape:

`AdminBootstrap -> RouterProvider -> persistent administrative App/runtime -> matched destination`

The migration must **not** remount the complete `App` on every route transition.

This is important because the App currently owns runtime objects and workflows whose lifecycle must remain stable across navigation, including:

- session runtime;
- operational polling/data runtime;
- printing manager;
- effective config;
- payment/refund workflows;
- New Order draft owner;
- Comanda selection owner;
- query context;
- arrival detection.

The initial Router migration may continue rendering the existing surfaces from a route-derived destination ID inside the persistent App. Broadly moving each surface into independent route modules is not required for this slice.

This deliberately keeps the refactor medium-sized and protects current mount semantics, including `CatalogWorkspace`, which is intentionally kept mounted and toggled by `visible` today.

## 8. Root path and home resolution

`/` is not a product screen.

After authentication/capability context is available:

- resolve the same capability-aware home used today;
- replace `/` with that destination's canonical path;
- do not add a useless extra browser-history entry.

Examples:

- user with Orders access -> `/pedidos`;
- no Orders but Finance access -> first allowed Finance destination;
- otherwise use the existing `resolveHome` order.

The existing `resolveHome` semantics remain authoritative.

## 9. Area entry behavior

Desktop/mobile area entries continue using `resolveArea`.

Examples:

- clicking the Pedidos area resolves the first allowed destination among `orders` and `history`;
- clicking Finance resolves the first allowed destination among `dashboard`, `receivables`, and `finance`;
- clicking Settings resolves the first allowed Settings destination.

If `/pedidos` itself is opened by a user who cannot access `orders` but can access `history`, the route gate redirects with `replace` to `/pedidos/historico`.

Equivalent behavior applies to `/financeiro` and `/configuracoes` area roots where the canonical root destination is unavailable but another destination in the area is allowed.

## 10. Authentication, deep links and capabilities

### 10.1 External deep link before login

If a user opens a valid administrative deep link while unauthenticated:

1. preserve the requested URL while login is shown;
2. do not resolve it against legacy fallback capabilities before real session context is ready;
3. after successful authentication/bootstrap, revalidate the matched destination;
4. if allowed, remain on that route;
5. if denied/unavailable, replace it with the capability-aware home and show the existing navigation feedback.

### 10.2 Session expiration/logout during use

Preserve current reset semantics.

When an established session expires or the user logs out:

- clear application state as today;
- clear pending navigation/discard state;
- reset route intent to the administrative root `/` with replace semantics;
- after a future successful login, resolve the normal home rather than resurrecting an old route from the expired session.

This is intentionally different from a fresh external deep link before login.

### 10.3 Capability changes

A matched destination is never trusted solely because its URL exists.

When capabilities or implementation availability change:

- revalidate the current matched destination;
- if it becomes denied/unavailable, replace it with the resolved home/area fallback;
- never render a forbidden destination for one transient frame after capability state is authoritative.

## 11. Unknown and unavailable URLs

For an unknown administrative pathname:

- never show a blank shell;
- after auth context is ready, replace with the capability-aware home;
- surface the existing `Destino desconhecido.` feedback when appropriate.

For a known but unimplemented route:

- use the existing unavailable semantics;
- replace with a safe allowed destination.

Do not add a public 404 product screen in this slice.

## 12. Unified navigation guard model

All in-SPA navigation must converge on one guard policy, regardless of origin:

- sidebar click;
- mobile navigation;
- Settings subnavigation;
- `app:navigate` event bridge;
- application workflow navigation;
- browser Back;
- browser Forward;
- imperative router navigation.

The gate still distinguishes:

1. invalid/denied/unavailable destination;
2. checkout pending;
3. dirty New Order leaving `new-order`;
4. dirty Settings policy leaving its protected resource;
5. normal navigation.

Only one blocked navigation intent may be pending at a time.

A second navigation attempt while a confirmation is open must not silently replace the first pending destination.

## 13. `useBlocker` integration

Use `useBlocker` to capture URL transitions that bypass `requestNavigation`, especially browser Back/Forward.

When the blocker captures a transition:

- resolve the next pathname back to a destination ID;
- run the same pure navigation decision contracts;
- for New Order/Settings discard, show the existing custom modal;
- Cancel calls the blocker's reset behavior and stays at the current URL;
- Confirm revalidates destination, capability, checkout state and the current draft before proceeding;
- only then discard and proceed.

Never call `proceed()` blindly from stale modal state.

If the pending destination becomes denied while the modal is open, cancel/reset that blocked transition and resolve a safe destination instead.

## 14. Hard reload, close-tab and external navigation

`useBlocker` does not protect hard reloads or leaving the SPA.

Keep Settings' existing `beforeunload` semantics and add a narrow New Order browser-abandonment guard.

The administrative app should warn before hard unload when any of these are true:

- New Order draft is dirty;
- New Order checkout is pending;
- Settings policy layer reports unload risk (dirty, saving or unconfirmed).

Use the native `beforeunload` mechanism only. No custom browser text is promised.

If the user confirms a reload, in-memory draft state may be lost; draft persistence across reload remains outside scope.

## 15. New Order route semantics

Internal entry to `/pedidos/novo` keeps the existing `useNewOrderDraft` owner and context:

- normal Orders entry returns to `orders`;
- Comanda entry retains table/tab identity and returns to `comandas`;
- successful submission navigates to the stored return destination;
- Cancel uses the stored return destination;
- checkout pending remains navigation-blocking.

Direct/deep-link entry to `/pedidos/novo` is allowed only with `orders.create`.

If no in-memory draft context exists, entering the route creates/uses a pristine generic New Order context with:

- no table identity;
- return destination `orders`.

Refreshing `/pedidos/novo` therefore preserves the destination but does **not** restore the pre-refresh draft or Comanda context. If the draft was dirty, the new hard-unload guard warns first.

No draft data is encoded in the URL.

## 16. Settings draft semantics

Preserve all existing Settings rules:

- changing between destinations belonging to the same policy resource does not prompt;
- leaving a dirty resource does prompt;
- saving/unconfirmed internal-navigation semantics remain as currently defined;
- the existing discard implementation remains owned by policy editing;
- Settings still owns its resource model;
- Router only coordinates navigation intent.

No policy state moves into React Router.

## 17. Browser history semantics

### Push

Normal user navigation to another destination creates a browser history entry.

### Replace

Use replace for:

- `/` -> resolved home;
- denied/unavailable/unknown route correction;
- session reset to `/`;
- canonicalization/fallback that is not a user-selected new destination.

### Back/Forward

Back/Forward must:

- move between previously visited destinations;
- update active shell state;
- honor guards;
- preserve the browser's intended history position after confirm/cancel.

No duplicate entries should be created by merely revalidating the current destination.

## 18. Existing query/filter state

The existing `useQueryContext` remains session-memory state in this slice.

Do **not** migrate current search/filter state into URL query parameters as part of the Router refactor.

This avoids mixing navigation infrastructure with a product-level URL-state redesign.

Future modules such as Reporting may define their own URL-search-param contract separately.

## 19. Shell, focus, scroll and mobile motion

Preserve current AppShell behavior when the matched destination ID changes:

- scroll to page top;
- focus `.app-content` with `preventScroll`;
- compute mobile direction using `getMobilePageDirection`;
- preserve page transition keying by semantic destination ID.

Do not key these behaviors directly from raw pathname strings.

This keeps aliases/canonicalization from creating false visual transitions.

## 20. Navigation UI

Existing navigation components keep using semantic IDs/areas.

They should not become a distributed collection of raw `<a href>` path strings.

The Router-aware navigation contract maps IDs to paths centrally.

Using React Router `Link`/`NavLink` internally is permitted where it preserves:

- current button styling;
- current capability resolution;
- guard behavior;
- current mobile More behavior.

The migration must not change the approved navigation visual design.

## 21. Legacy `app:navigate` bridge

Keep `useNavigationEventBridge` during this slice.

An `app:navigate` event carrying a destination ID must route through the same Router-aware `requestNavigation` contract.

Do not introduce URL strings into event payloads.

Removal of this event bridge requires a separate proof that no producer remains.

## 22. Kitchen TV boundary

The Kitchen TV remains a separate frontend entry selected in `src/main.jsx`.

Requirements:

- `/cozinha-tv` never mounts the administrative Router;
- administrative route code must not import `KitchenDisplayRoot`;
- Kitchen TV code must not import the administrative Router/App;
- Kitchen TV fragment-token pairing behavior remains unchanged;
- no React Router dependency is required by the Kitchen TV bundle solely because the admin app uses it.

A build/architecture regression test must preserve this boundary.

## 23. Cloudflare/Worker behavior

No Worker API routing change is expected.

Current assets configuration already uses SPA fallback:

- `not_found_handling: "single-page-application"`;
- Worker-first only for `/api/*`.

Implementation must add a regression check proving direct GETs for representative admin deep links resolve the frontend shell in staging.

Do not add catch-all application routes inside `worker/index.js` merely for React Router.

## 24. Lazy loading and bundle size

Route-level lazy loading is **not required** for this migration's acceptance.

Reason:

- the primary objective is navigation correctness;
- moving surface ownership or mount lifecycle at the same time would widen the refactor;
- the current Kitchen TV already has the most important separate entry-point split.

However, the route registry/configuration must be compatible with future `route.lazy` or equivalent route-based code splitting.

A later performance slice may move heavy administrative surfaces into lazy route modules after bundle measurements justify it.

## 25. Out of scope

This migration does not:

- redesign any page;
- change business rules;
- change D1 schema/migrations;
- change API contracts;
- create Reporting;
- create users/roles;
- move existing filters into URL query params;
- persist New Order drafts across reload;
- encode Comanda selection in the URL;
- add SSR;
- convert data fetching to route loaders/actions;
- convert the project to React Router Framework Mode;
- split the monolith into services;
- require route-level lazy loading in the first release.

The Gestão Delivery remains a modular monolith.

## 26. Test strategy

Strict RED -> GREEN for behavior changes.

Minimum focused coverage:

### Pure route contracts

- every implemented destination has one canonical path;
- paths are unique;
- path <-> destination mapping is reversible;
- Kitchen TV is absent from admin registry;
- area/home capability fallback remains unchanged.

### Initial/deep-link resolution

- root resolves to home with replace;
- allowed deep link survives login/bootstrap;
- denied deep link falls back safely;
- unknown path falls back safely;
- refresh retains allowed destination.

### History

- navigation pushes history;
- Back/Forward changes destination;
- no duplicate history entries from canonical revalidation;
- mobile direction derives from destination IDs.

### Guards

- dirty New Order blocks UI navigation;
- dirty New Order blocks Back/Forward;
- checkout pending blocks UI navigation and Back/Forward;
- Settings dirty draft blocks only when leaving its protected resource;
- cancel leaves location unchanged;
- confirm revalidates then proceeds;
- second intent cannot overwrite first pending intent;
- capability revoked while modal is open cannot proceed to denied route.

### Hard unload

- clean app has no New Order unload warning;
- dirty New Order installs unload protection;
- checkout pending installs unload protection;
- Settings existing unload coverage remains green.

### Workflows

- New Order success returns to correct semantic destination;
- Comanda -> New Order -> cancel/success behavior remains intact;
- Print Queue -> Printing Settings navigation remains intact;
- session expiration resets navigation;
- logout resets navigation;
- `app:navigate` still works.

### Entry boundaries

- `/cozinha-tv` still loads only Kitchen TV entry;
- admin deep links load AdminBootstrap;
- architecture checker preserves TV/admin import boundary.

## 27. Full regression gates

Before staging:

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

No database migration is expected.

## 28. Manual staging homologation

Minimum manual matrix:

### Desktop

- direct open of every top-level area;
- representative subroutes;
- F5 on Orders, Finance, Settings and Comandas;
- browser Back/Forward across 4+ destinations;
- dirty New Order + sidebar click;
- dirty New Order + browser Back;
- Settings dirty draft + same-resource move;
- Settings dirty draft + leave resource;
- Print Queue -> Printing Settings;
- logout and login;
- session-expiry behavior if reproducible.

### Mobile

- direct bottom-nav destinations;
- More panel destinations;
- Back/Forward;
- scroll reset and focus behavior;
- New Order guard;
- Settings guard.

### Permissions

With restricted capability fixtures/test harness:

- allowed deep link;
- denied deep link;
- area root falling back to first allowed destination;
- current route becoming denied.

### Kitchen TV

- `/cozinha-tv` pairing/runtime regression;
- admin route does not affect TV bundle or session.

## 29. Rollout and safety

Implementation must occur on a fresh feature branch from the then-current `master`, not on this design branch.

Protocol:

1. record exact implementation base SHA;
2. reconcile this spec if master advanced materially;
3. create implementation branch;
4. execute TDD tasks;
5. run exact-SHA Validate;
6. deploy/homologate staging;
7. update QA handoff;
8. merge only after explicit authorization;
9. no production deploy without separate explicit authorization.

## 30. Acceptance criteria

The migration is complete when:

- the admin frontend uses React Router as the navigation source of truth;
- `activeTab` is no longer independently stored navigation state;
- every current administrative destination has the approved canonical URL;
- Back/Forward behaves predictably;
- refresh preserves valid destinations;
- external deep links are auth/capability safe;
- root/unknown/denied/unavailable routes resolve safely;
- New Order and Settings guards cover clicks and browser history;
- New Order hard reload has native unload protection while risky;
- Comanda/New Order return behavior is unchanged;
- session expiration/logout semantics are preserved;
- mobile navigation, motion, scroll and focus behavior are preserved;
- current query/filter state behavior is unchanged;
- Kitchen TV remains a separate entry/bundle;
- no Worker/backend/database behavior changed unnecessarily;
- staging is fully homologated before merge.

## 31. Design decisions intentionally deferred

After this migration, future specs may independently decide:

- route-level lazy loading/code splitting;
- URL search params for Reporting filters;
- order detail routes such as `/pedidos/:id`;
- Comanda-specific route params;
- route-scoped data loaders/actions;
- saved/shareable report URLs.

Those evolutions must build on this URL navigation boundary rather than reintroducing local tab routing.
