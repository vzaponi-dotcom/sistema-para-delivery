# Gestão Delivery — Kitchen TV / KDS Implementation Plan

Date: 2026-09-22  
Approved spec: `docs/superpowers/specs/2026-09-22-kitchen-tv-display-design.md`  
Design branch: `feature/kitchen-tv-display-v2-design`  
Design base: `master@7d5a9d2507968dd96dae81f5f1d61431a6e42292`  
Status: **APPROVED FOR IMPLEMENTATION — implementation not started**

## 1. Goal

Implement the approved Kitchen TV/KDS as a lightweight, read-only, paired TV surface that:

- opens on `/cozinha-tv` without normal PIN login after one-time pairing;
- loads a dedicated frontend chunk instead of the administrative application;
- reads only a minimal active-order payload;
- shares current Orders timing/queue/arrival rules;
- reproduces the approved 32" 3×2 dark layout with customer name as the dominant identifier;
- never exposes administrative/financial/contact/printing data;
- is homologated in staging before merge;
- never deploys production without a separate explicit authorization.

## 2. Execution gate and branch protocol

### 2.1 Do not implement on the design branch

The design branch contains only spec/plan documentation.

When implementation is authorized:

1. fetch `origin/master`;
2. record the exact current master SHA;
3. compare it to the design base;
4. create a fresh branch such as `feature/kitchen-tv-display-v2` from the **current** `origin/master`;
5. bring the approved spec/plan into that branch as documentation-only commits;
6. if master advanced, reconcile only the documentation against the new base before product code starts;
7. do not reset/rewrite unrelated worktrees;
8. never develop directly on `master`.

### 2.2 Baseline gates before Task 1

Run on the implementation branch before product changes:

```bash
npm test
npm run test:architecture
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Record:

- exact base SHA;
- test count;
- architecture result;
- lint/build result;
- both Worker dry-runs;
- local D1 migration result.

If baseline is red, stop and investigate before Kitchen TV changes.

## 3. Global implementation constraints

1. Strict RED → GREEN for behavior changes.
2. Preserve normal Cozinha semantics.
3. Preserve current Orders ownership under `src/domains/orders`.
4. Kitchen TV imports Orders through `src/domains/orders/index.js`, never deep imports.
5. No React Router solely for this feature.
6. No WebSocket/SSE in v1.
7. No action buttons on TV.
8. No QZ/jsPDF/Printing manager imports in TV code.
9. No `/api/bootstrap` from TV.
10. No second timing policy.
11. No public anonymous order endpoint.
12. No normal admin session reuse for TV auth.
13. Pairing token travels via URL fragment, never query string.
14. Plaintext pairing/session secrets are never stored.
15. TV state uses explicit allowlist projection.
16. `last_seen_at` writes are throttled to at most once per 5 minutes.
17. Do not redesign the existing administrative Cozinha.
18. Do not modify physical printing behavior.
19. No production migration/deploy in implementation tasks.
20. Product SHA and docs-only closure SHA are tracked separately at final QA.

## 4. Task map

| Task | Purpose | Main outcome |
|---|---|---|
| 1 | Lock visual reference + Orders public contract | approved asset + shared pure exports |
| 2 | Persist Kitchen TV access | migration 0028 or next free number + repository |
| 3 | Build restricted TV token/cookie auth | one-time pairing + revocable session primitives |
| 4 | Build minimal active-order read model | safe payload + current operation timing |
| 5 | Add public TV API + admin TV API | pair/state/settings/access/revoke routes |
| 6 | Add Configurações → TV da Cozinha | admin management surface |
| 7 | Split frontend entry | TV route never statically loads App |
| 8 | Implement live TV runtime | pairing bootstrap, polling, offline, audio, fullscreen |
| 9 | Implement approved 32" KDS board | exact 3×2 visual contract |
| 10 | Harden security/architecture/performance | boundaries + build/network assertions |
| 11 | Full staging homologation | migration + deploy + manual KDS QA |
| 12 | Close PR for merge handoff | docs/QA closure only, no production |

---

# Task 1 — Lock the approved reference and expose the narrow Orders contract

## Purpose

Freeze the visual target and make Kitchen TV consume Orders through the current public boundary rather than deep-importing domain internals.

## Files

Create:

- `docs/superpowers/references/kitchen-tv-32-approved-reference.jpg`
- `src/kitchen-display/kitchenDisplayContract.test.js`

Modify:

- `src/domains/orders/index.js`
- optionally existing Orders public contract tests

## Steps

### RED 1 — asset/reference contract

Add a structural test or documentation check that requires the approved reference file to exist at:

`docs/superpowers/references/kitchen-tv-32-approved-reference.jpg`

The file must be the approved 2026-09-22 mockup with customer name dominant and number secondary.

### GREEN 1

Version the approved mockup asset.

Do not regenerate or reinterpret it during implementation.

### RED 2 — Orders public exports

Require Kitchen TV to obtain queue/arrival logic only through the Orders public entry.

Required public exports:

- `buildKitchenQueueModel`;
- `detectOperationalArrivals`.

Existing exports such as item-display helpers remain unchanged.

The RED must fail because these helpers are currently internal.

### GREEN 2

Export the existing pure functions from `src/domains/orders/index.js`.

Do **not** duplicate them under Kitchen TV.

### Regression

Run:

```bash
node --test   src/domains/orders/domain/kitchenQueue.test.js   src/domains/orders/domain/orderRealtime.test.js   src/domains/orders/ordersPublicContract.test.js   src/kitchen-display/kitchenDisplayContract.test.js
npm run test:architecture
```

### Commit target

`feat: expose kitchen display order contract`

---

# Task 2 — Add the monodispositivo Kitchen TV access schema and repository

## Purpose

Persist exactly one Kitchen TV access record per business, with hashed secrets and throttled activity updates.

## Migration

Current master ends at migration 0027.

Use:

`migrations/0028_kitchen_tv_access.sql`

**only if 0028 is still free when execution starts**. If master gained a migration, use the next free number and update all references.

## Files

Create:

- migration file;
- `worker/kitchenTvRepository.js`;
- `worker/kitchenTvRepository.test.js`;
- migration regression test if repository convention warrants a dedicated file.

Reuse:

- `worker/test-support/settingsDb.js`.

## Schema contract

Logical fields:

- `business_id` primary key / FK;
- `pairing_token_hash` nullable;
- `pairing_expires_at` nullable;
- `session_token_hash` nullable;
- `session_issued_at` nullable;
- `paired_at` nullable;
- `last_seen_at` nullable;
- `revoked_at` nullable;
- `created_at`;
- `updated_at`.

Add uniqueness protection for non-null token hashes.

## RED

Tests must require:

1. clean install succeeds;
2. existing database upgrades;
3. one row maximum per business;
4. generation stores a hash, never plaintext;
5. new access invalidates previous pairing/session;
6. valid pairing can be atomically consumed once;
7. used token cannot be consumed again;
8. revoked session cannot be loaded as active;
9. session hash lookup is business-isolated;
10. activity touch under 5 minutes performs no write;
11. touch at/after 5 minutes updates `last_seen_at`;
12. foreign key check stays clean.

## GREEN repository interfaces

Plan around focused functions such as:

- `loadKitchenTvAccess(db, businessId)`;
- `issueKitchenTvPairing(db, businessId, pairingHash, expiresAt, now)`;
- `consumeKitchenTvPairing(db, pairingHash, sessionHash, now)`;
- `loadKitchenTvSessionByHash(db, sessionHash)`;
- `touchKitchenTvSession(db, businessId, now, minIntervalMs)`;
- `revokeKitchenTvAccess(db, businessId, now)`.

Exact names can vary, but producer/consumer names must remain consistent after the plan is approved.

## Validation

```bash
node --test worker/kitchenTvRepository.test.js
npm run d1:migrate:local
```

### Commit target

`feat: persist kitchen tv access`

---

# Task 3 — Implement TV token, hashing, cookie and pairing-session primitives

## Purpose

Create auth primitives completely separate from admin PIN/session auth.

## Files

Create:

- `worker/kitchenTvAuth.js`;
- `worker/kitchenTvAuth.test.js`.

Do not modify admin auth semantics in `worker/auth.js` except narrowly shared helpers if a review proves extraction is safer than duplication.

## Contract

### Tokens

Use `crypto.getRandomValues` / Web Crypto.

Recommended:

- 32 random bytes;
- base64url plaintext token;
- SHA-256 hex persisted.

### Pairing token

- 30-minute validity;
- one-time;
- stored hash only.

### TV session cookie

Dedicated cookie name, e.g. `kitchen_tv_session`.

Required attributes:

- `HttpOnly`;
- `Secure`;
- `SameSite=Strict`;
- `Path=/`;
- long `Max-Age`.

Continuous use must refresh cookie lifetime **without creating a D1 write every poll**. Couple cookie renewal to the throttled `last_seen_at` touch decision.

### RED

Cover:

1. token uses secure random source;
2. output is URL-safe;
3. hash is deterministic and not equal plaintext;
4. TV cookie does not use admin cookie name;
5. cookie has required security attributes;
6. clear-cookie expires only TV cookie;
7. cookie parsing cannot read admin cookie as TV session;
8. pairing expiry helper uses 30 minutes;
9. admin auth functions remain behaviorally unchanged.

### GREEN

Implement narrow helpers.

## Validation

```bash
node --test worker/kitchenTvAuth.test.js worker/auth.test.js
```

### Commit target

`feat: add restricted kitchen tv authentication`

---

# Task 4 — Add the minimal active Kitchen TV read model

## Purpose

Return only active kitchen-safe data. Do not call `listOrders`, because it reads the complete historical/financial order shape.

## Files

Create:

- `worker/kitchenTvReadRepository.js`;
- `worker/kitchenTvReadRepository.test.js`.

Reuse:

- active order tables;
- `worker/operationSettingsRepository.js::loadOperations`;
- shared policy validators as needed.

## Query contract

Use dedicated SQL.

Orders query must only select active/non-terminal orders for the current business.

Defensive condition should exclude:

- `Finalizado`;
- `Cancelado`;
- rows with terminal timestamps where relevant.

Items query should join active orders and select only:

- order_id;
- quantity;
- name_snapshot;
- note;
- stable item order.

Do not select:

- phone/address;
- client profile id unless strictly required;
- prices;
- payment rows;
- movements;
- refund;
- print jobs.

## State contract

Repository returns enough to build:

```js
{
  timing: {
    scheduledPrepLeadMinutes,
    scheduledLateGraceMinutes,
    immediateLateAfterMinutes,
    immediateVeryLateAfterMinutes,
  },
  orders: [
    {
      id,
      orderNumber,
      client,
      type,
      status,
      orderDate,
      createdAt,
      scheduledFor,
      items: [{ quantity, name, note }]
    }
  ]
}
```

`serverNow` is added by the HTTP layer.

## RED

Use a realistic nonempty fixture.

Assert allowed fields are present.

Assert serialized payload source/result does **not** contain:

- phone;
- address;
- subtotal;
- total;
- delivery fee;
- adjustment;
- payment;
- movement;
- refund;
- printer/print job;
- QZ.

Assert historical finalized/cancelled orders do not appear.

Assert future scheduled active orders do appear.

Assert current operation timing comes from `loadOperations`, not fixed legacy constants.

## GREEN

Implement explicit allowlist mapper + active-only SQL.

## Validation

```bash
node --test worker/kitchenTvReadRepository.test.js worker/orderReadRepository.test.js worker/operationSettingsRepository.test.js
```

### Commit target

`feat: add minimal kitchen tv read model`

---

# Task 5 — Add Kitchen TV HTTP boundaries

## Purpose

Expose four narrowly scoped behaviors:

Admin authenticated:

- `GET /api/kitchen-tv/settings`;
- `POST /api/kitchen-tv/access`;
- `POST /api/kitchen-tv/revoke`.

TV/public:

- `POST /api/kitchen-tv/pair`;
- `GET /api/kitchen-tv/state`.

## Files

Create:

- `worker/kitchenTvApi.js`;
- `worker/kitchenTvApi.test.js`;
- `worker/kitchenTvSecurityRegression.test.js`.

Modify:

- `worker/index.js`.

## Router rule

In `handleRequest`:

1. normal auth routes stay first;
2. Kitchen TV **public pair/state routes** are dispatched explicitly;
3. all other `/api/*` continue to `authenticatedApi`.

Admin Kitchen TV routes are dispatched inside authenticated context with `businessId` and grants.

Do not let TV cookie reach `authenticatedApi` as an authenticated session.

## Admin access rules

`GET settings` requires:

`orders.settings.view`.

Mutations require:

`orders.settings.manage`.

Reuse `requireCapability`.

Mutations also require `assertSameOriginMutation`.

## Pair endpoint

`POST /api/kitchen-tv/pair`

Body:

```json
{ "token": "<fragment-secret>" }
```

Rules:

- same-origin mutation required;
- hash token;
- atomically consume valid/unexpired pairing;
- generate independent TV session token;
- set TV cookie;
- response does not include orders/bootstrap;
- all invalid/expired/used tokens return the same generic public failure.

## State endpoint

`GET /api/kitchen-tv/state`

Rules:

- authenticate only TV cookie;
- load restricted state;
- call minimal read model;
- include `serverNow`;
- throttle `last_seen_at`;
- renew cookie lifetime when throttled touch occurs;
- never write order data;
- 401/403 revocation is definitive.

## RED security matrix

Required HTTP tests:

1. admin manage creates access;
2. admin view-only cannot create;
3. anonymous cannot call admin TV settings;
4. pair valid succeeds;
5. pair invalid fails generic;
6. pair expired fails generic;
7. used pair token fails generic;
8. paired TV reads state;
9. TV cookie cannot read `/api/bootstrap`;
10. TV cookie cannot read `/api/orders`;
11. TV cookie cannot read printing APIs;
12. TV cookie cannot read settings APIs;
13. admin cookie alone cannot substitute for TV cookie on state;
14. revoke makes next state 401/403;
15. regenerated access invalidates previous TV session;
16. different business cannot use another TV session;
17. state does not expose forbidden fields;
18. no activity write on every 2-second request.

## Validation

```bash
node --test   worker/kitchenTvApi.test.js   worker/kitchenTvSecurityRegression.test.js   worker/auth.test.js   worker/settingsApi.test.js
```

### Commit target

`feat: add kitchen tv api boundaries`

---

# Task 6 — Add Configurações → TV da Cozinha

## Purpose

Give authenticated administrators the one required management surface without mixing it into policy-editing state.

Kitchen TV access is not a versioned business policy draft. It is a direct operational credential lifecycle.

## Files

Create:

- `src/app/surfaces/settings/KitchenTvSettings.jsx`;
- `src/app/surfaces/settings/KitchenTvSettings.test.js`;
- `src/app/surfaces/settings/kitchenTvSettingsApi.js`;
- `src/app/surfaces/settings/kitchenTvSettingsApi.test.js`;
- optional focused CSS file.

Modify:

- `src/app/surfaces/settings/SettingsHome.jsx`;
- `src/app/surfaces/settings/SettingsHome.test.js`;
- `src/app/surfaces/settings/SettingsSurface.jsx`;
- `src/app/navigation/registry.js`;
- navigation tests;
- `src/App.jsx` implemented destination/render predicate.

## Destination

Add:

`settings-kitchen-tv`

Area:

`settings`

Label:

`TV da Cozinha`

Capability:

`orders.settings.view`

Add it to:

- settings destination ids;
- settings home;
- relevant mobile/internal settings section lists;
- implemented destinations.

Do not add it as a new sidebar top-level item.

## Home card

Title:

`TV da Cozinha`

Description:

`Conecte uma TV para acompanhar os pedidos em tempo real.`

## UI states

### Not configured

- explanation;
- `Gerar acesso da TV`.

### Pairing available

- one-time link;
- `Copiar link`;
- expires info;
- warning that link is one-time;
- `Gerar novo acesso`.

Generated link must be:

`/cozinha-tv#token=...`

Never query string.

### Paired

- `TV da cozinha ativa`;
- paired date;
- last access;
- `Gerar novo acesso`;
- `Revogar acesso`.

Revocation uses confirmation.

## Read-only capability behavior

With only `orders.settings.view`:

- page is visible;
- state is visible;
- generate/revoke controls are absent/disabled with accessible explanation.

With `orders.settings.manage`:

- actions enabled.

## RED

Cover all UI states, capability combinations, one-time link, copy behavior, confirmation, API errors and keyboard/focus behavior.

## GREEN

Implement using existing PageHeader, Button, Modal/ConfirmationDialog and settings visual tokens.

Do not attach it to `usePolicyEditing`.

## Validation

```bash
node --test   src/app/surfaces/settings/KitchenTvSettings.test.js   src/app/surfaces/settings/kitchenTvSettingsApi.test.js   src/app/surfaces/settings/SettingsHome.test.js   src/app/surfaces/settings/SettingsSurface.test.js   src/navigationLayout.test.js
```

### Commit target

`feat: manage kitchen tv access from settings`

---

# Task 7 — Split the frontend entry before loading the admin app

## Purpose

Make `/cozinha-tv` genuinely lightweight.

Current `src/main.jsx` statically imports:

- App;
- ThemeProvider;
- global admin CSS.

That must change.

## Files

Create:

- `src/admin/AdminBootstrap.jsx` or equivalent;
- `src/kitchen-display/KitchenDisplayRoot.jsx`;
- `src/kitchen-display/kitchen-display.css`;
- `src/kitchen-display/kitchenDisplayEntry.test.js`.

Modify:

- `src/main.jsx`;
- possibly move admin-only CSS imports into Admin bootstrap.

## RED

The test must prove:

- `main.jsx` no longer contains static `import App from './App.jsx'`;
- pathname `/cozinha-tv` dynamically imports Kitchen Display root;
- non-TV paths dynamically import admin bootstrap;
- TV root source does not import ThemeProvider/admin App;
- TV source does not import qz-tray/jsPDF/printing manager;
- TV root can render without admin session bootstrap.

## GREEN

Main should be a tiny route selector.

Conceptually:

```js
const isKitchenDisplay = window.location.pathname === '/cozinha-tv'
const module = isKitchenDisplay
  ? await import('./kitchen-display/KitchenDisplayRoot.jsx')
  : await import('./admin/AdminBootstrap.jsx')
module.mount(...)
```

Keep StrictMode if desired.

Kitchen TV imports only its own fixed CSS + minimal shared CSS needed for Inter/base reset.

Admin appearance must stay unchanged.

## Build proof

Run build and inspect manifest/chunks.

Kitchen TV must not eagerly depend on the admin chunk.

## Validation

```bash
node --test src/kitchen-display/kitchenDisplayEntry.test.js
npm run build
npm run test:architecture
```

### Commit target

`feat: split kitchen tv frontend entry`

---

# Task 8 — Implement Kitchen TV bootstrap, pairing, polling, offline, audio and fullscreen

## Purpose

Make the TV survive normal daily use without loading admin runtime.

## Files

Create:

- `src/kitchen-display/kitchenDisplayApi.js`;
- `src/kitchen-display/kitchenDisplayApi.test.js`;
- `src/kitchen-display/kitchenDisplaySession.js`;
- `src/kitchen-display/kitchenDisplaySession.test.js`;
- `src/kitchen-display/KitchenDisplayApp.jsx`;
- `src/kitchen-display/KitchenDisplayApp.test.js`;
- `src/kitchen-display/kitchenDisplayAudio.js`;
- `src/kitchen-display/kitchenDisplayAudio.test.js`.

## API client

Functions:

- pair token;
- read state.

No bootstrap.

Use same-origin credentials.

## Startup rules

### Fragment present

If `location.hash` contains `token`:

1. extract it;
2. POST pair;
3. immediately remove fragment with `history.replaceState`;
4. read state.

The token must never be put in LocalStorage/sessionStorage.

### No fragment

Read state directly via TV cookie.

## App phases

- loading;
- start-required;
- live;
- unauthorized;
- pairing-error.

## Start interaction

Button:

`Iniciar painel da cozinha`

Click:

1. unlock/resume audio;
2. attempt fullscreen;
3. enter live even if fullscreen fails.

## Live timers

- local `now`: 1 second;
- state polling: 2 seconds while document visible;
- immediate refresh on online;
- immediate refresh on focus;
- immediate refresh on visible transition.

When hidden, suspend frequent polling.

## Arrival detection

Use `detectOperationalArrivals` from Orders public entry.

Initial previous ids = undefined so existing orders do not alert.

Arrival:

- play same short operational sound behavior;
- add highlight set;
- remove after exactly 2600 ms.

## Transient errors

On network/5xx:

- preserve last successful state;
- mark stale;
- remember `lastUpdatedAt`;
- retry.

On definitive 401/403:

- clear state orders immediately;
- switch unauthorized;
- stop showing stale orders.

## Audio fallback

If autoplay remains blocked after restart, show discreet action:

`Ativar alertas sonoros`

Panel remains functional without sound.

## RED/GREEN validation

```bash
node --test   src/kitchen-display/kitchenDisplayApi.test.js   src/kitchen-display/kitchenDisplaySession.test.js   src/kitchen-display/kitchenDisplayAudio.test.js   src/kitchen-display/KitchenDisplayApp.test.js   src/domains/orders/domain/orderRealtime.test.js
```

### Commit target

`feat: run live kitchen tv session`

---

# Task 9 — Implement the approved 32" 3×2 KDS visual board

## Purpose

Reproduce the approved mockup as the normative visual target.

## Files

Create:

- `src/kitchen-display/kitchenDisplayPresentation.js`;
- `src/kitchen-display/kitchenDisplayPresentation.test.js`;
- `src/kitchen-display/KitchenDisplayBoard.jsx`;
- `src/kitchen-display/KitchenDisplayBoard.test.js`;
- `src/kitchen-display/KitchenDisplayCard.jsx`;
- `src/kitchen-display/KitchenDisplayCard.test.js`.

Modify:

- `src/kitchen-display/kitchen-display.css`;
- `src/shared/ui/Icon.jsx` only if `chef-hat` / `delivery-bike` are needed to match reference.

## Presentation selector

Input:

- orders from state;
- timing;
- now;
- highlighted ids.

First call:

`buildKitchenQueueModel(orders, now, '', timing)`.

Then compute TV-only presentation.

## Near-limit rule

Constant:

`KITCHEN_TV_NEAR_LIMIT_MINUTES = 5`.

Near-limit only when:

- phase preparing;
- timing state on-time;
- `lateAt - now <= 5 minutes`;
- not highlighted new arrival.

It changes presentation only.

## 6-slot allocation

Required algorithm:

1. take up to 5 preparing entries by existing queue order;
2. if any scheduled exists, reserve one slot for the nearest scheduled;
3. if fewer than 5 preparing, fill free slots with additional scheduled entries;
4. if no scheduled exists, sixth slot may be preparing;
5. max 6 visible;
6. compute total overflow count.

Tests must cover every combination, including 0/1/many scheduled and 0–8 preparing.

## Card state precedence

1. highlighted arrival → `new`;
2. late/very-late → `late`;
3. near limit → `near-limit`;
4. preparing → `preparing`;
5. scheduled → `scheduled`.

## Header

Must render:

- chef-hat icon;
- `Cozinha`;
- separator;
- `Boas refeições. Mais histórias.`;
- Em preparo count;
- Atrasados count;
- Agendados count;
- HH:mm;
- pt-BR date.

## Card hierarchy

Status row:

- colored dot;
- uppercase status;
- small order number at right.

Main line:

- customer name dominant;
- timer or scheduled time at right.

Then:

- order-type pill;
- items;
- observation area.

## Timer

Preparing:

- MM:SS under 1 hour;
- H:MM:SS from 1 hour.

Scheduled:

- clock icon + desired HH:mm.

Use operational start from queue entry.

Do not use a network call for timer.

## Item/observation limits

Items:

- max 4 visual lines;
- remaining → `+ N itens`.

Observations:

- max 2 visual lines;
- remaining → `+ N observações`.

Card height must remain stable.

## Typography

Use Inter.

Implement responsive `clamp()` values so:

- 1920×1080 matches reference;
- 1280×720 remains legible;
- no page scroll.

## Colors

Use local KDS tokens from approved spec.

Every color state also has text label; never depend only on color.

## Empty state

Header remains.

Body:

`Nenhum pedido aguardando preparo.`

## RED visual/source contracts

Tests require:

- 3 columns × 2 rows;
- max 6 cards;
- name appears before/order number hierarchy;
- no action labels Finalizar/Cancelar/Imprimir/Novo pedido;
- exact status labels;
- exact header copy;
- overflow indicator;
- fixed dark KDS tokens;
- 720p media contract;
- no theme dependency.

## GREEN

Build board/card/CSS.

## Validation

```bash
node --test   src/kitchen-display/kitchenDisplayPresentation.test.js   src/kitchen-display/KitchenDisplayBoard.test.js   src/kitchen-display/KitchenDisplayCard.test.js   src/kitchen-display/KitchenDisplayApp.test.js
npm run lint
npm run build
```

### Commit target

`feat: render approved kitchen tv board`

---

# Task 10 — Harden architecture, security and performance boundaries

## Purpose

Turn “lightweight/read-only/restricted” into enforced contracts rather than assumptions.

## Files

Create:

- `src/kitchen-display/kitchenDisplayBoundary.test.js`;
- `worker/kitchenTvSecurityRegression.test.js` if not already complete;
- build artifact/manifest regression test if practical.

Modify:

- `scripts/architecture/check-import-boundaries.mjs`;
- architecture checker tests.

## Architecture rules

Enforce production Kitchen TV code:

1. no deep imports into Orders;
2. no Printing domain/UI imports;
3. no qz-tray;
4. no jsPDF;
5. no admin Settings UI imports;
6. no Table Service/Finance/Customers/Catalog UI imports;
7. no `App.jsx` import;
8. no direct `/api/bootstrap` string;
9. domain-pure rules still stay browser-free.

## Worker rules

Security regression repeats real HTTP flow:

- pair;
- state succeeds;
- admin endpoints fail with TV cookie;
- revoke;
- state fails and payload cleared by frontend test.

## Build/performance proof

After `npm run build`:

- inspect manifest/output;
- confirm Kitchen TV entry/chunk exists;
- confirm it does not statically include admin root/QZ/jsPDF chunks;
- record generated TV JS/CSS gzip sizes.

Do not set an arbitrary byte hard limit before measuring baseline.

Instead record size and flag unexpected dependencies. If chunk is obviously bloated, investigate before staging.

## Network contract

Automated/source tests require only:

- `/api/kitchen-tv/pair`;
- `/api/kitchen-tv/state`

from TV API module.

No other business API.

## Full focused regression

```bash
node --test   src/kitchen-display/*.test.js   src/domains/orders/domain/kitchenQueue.test.js   src/domains/orders/domain/orderRealtime.test.js   src/domains/orders/application/useOrderArrivals.test.js   src/app/surfaces/settings/KitchenTvSettings.test.js   worker/kitchenTv*.test.js   worker/auth.test.js   worker/settingsApi.test.js   src/printing/printingManagerRegression.test.js
npm run test:architecture
npm run lint
npm run build
```

### Commit target

`test: harden kitchen tv boundaries`

---

# Task 11 — Full gates and staging homologation

## Purpose

Validate the executable candidate and migration in staging only.

## 11.1 Final executable candidate

Before deploy:

```bash
git status --short
git fetch origin
git diff --check <base>...HEAD
npm test
npm run test:architecture
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

All green.

Push candidate and require GitHub Validate success on exact SHA.

## 11.2 Staging migration/deploy

Use existing controlled staging workflow/process.

Only staging:

- list migration;
- apply Kitchen TV migration;
- deploy candidate;
- verify normal staging login remains HTTP 200.

Do **not** run production migration/deploy.

## 11.3 Manual admin QA

1. Settings home shows TV da Cozinha when allowed.
2. View-only capability sees state but cannot mutate.
3. Manage generates access.
4. Link uses `#token=`, not query.
5. Copy link works.
6. Link displays expiry/use-once warning.
7. First TV pairs successfully.
8. Second browser cannot reuse link.
9. Admin shows paired state/last seen.
10. Revoke confirmation works.
11. New access invalidates old TV.

## 11.4 Manual TV functional QA

1. TV opens without admin PIN after pairing.
2. URL fragment disappears after successful pair.
3. Refresh stays paired.
4. No `/api/bootstrap` in Network.
5. No admin/QZ/jsPDF chunks in initial TV network.
6. Immediate order appears within polling cadence.
7. Scheduled order appears as scheduled.
8. Scheduled crossing prep window becomes operational using existing timing.
9. Finalized order disappears next refresh.
10. Cancelled order disappears.
11. Arrival highlights for ~2.6 s and alerts once.
12. Initial existing queue does not all alert.
13. Offline keeps stale snapshot with warning.
14. Reconnect refreshes immediately.
15. Revocation clears queue and shows unauthorized screen.

## 11.5 Visual QA — 1920×1080

Compare side by side to approved reference:

- 3×2 grid;
- 6 cards;
- customer name dominant;
- number small;
- chef icon/header;
- tagline;
- counters;
- clock;
- date;
- status colors/labels;
- pills;
- items;
- observations;
- spacing/borders;
- no scroll.

## 11.6 Visual QA — 1280×720

Repeat with:

- long customer name;
- long product;
- 4 item lines;
- item overflow;
- multiple observations;
- no observation;
- 6 cards;
- overflow indicator.

Must remain readable and scroll-free.

## 11.7 Real 32" TV QA

Preferred gate if hardware is available:

- 1920×1080 output;
- browser fullscreen/kiosk;
- check legibility from normal kitchen working distance;
- verify color/status distinction;
- verify clock/date visibility;
- verify no browser chrome obstruction.

If physical 32" TV is unavailable, mark this item **DEFERRED-HARDWARE**, not PASS, while browser viewport QA can still pass.

## 11.8 Staging result

Record:

- executable SHA;
- Validate run;
- Deploy staging run;
- D1 migration filename;
- Worker Version ID;
- TV bundle/chunk sizes;
- manual QA matrix;
- physical-TV status.

Only after manual approval move to Task 12.

---

# Task 12 — Documentation closure and merge handoff

## Purpose

Close evidence without changing executable product behavior.

## Files

Create/update:

- `docs/superpowers/qa/kitchen-tv-display-qa.md`;
- relevant execution ledger if project practice still uses it;
- PR body.

## Required final record

- approved spec;
- approved plan;
- executable SHA;
- docs closure SHA;
- migration number;
- automated test results;
- architecture/lint/build;
- production/staging Worker dry-runs;
- staging deployment;
- admin QA;
- TV functional QA;
- 1080p visual QA;
- 720p visual QA;
- physical 32" QA or truthful deferred status;
- unresolved review threads count;
- PR mergeability.

## Merge gate

No merge until explicit user authorization.

## Production gate

Even after merge:

1. wait for master Validate;
2. user explicitly authorizes production;
3. run controlled production deploy;
4. verify D1 migration;
5. smoke TV pairing/state;
6. verify normal admin login and Cozinha were not regressed.

This plan does not authorize production.

---

# 5. Detailed acceptance-to-task traceability

| Spec area | Primary task |
|---|---|
| separate lightweight bundle | T7, T10 |
| no normal login | T3, T5, T8 |
| pairing fragment + one-time | T3, T5, T8 |
| revocation | T2, T5, T6, T8 |
| admin capabilities | T5, T6 |
| minimal payload | T4, T5 |
| current business timing | T4, T9 |
| shared queue rules | T1, T9 |
| arrival 2600 ms | T1, T8, T9 |
| near-limit 5 min visual only | T9 |
| 3×2 / 6 cards | T9 |
| 5 preparing + 1 scheduled allocation | T9 |
| customer name dominant | T9 |
| order number secondary | T9 |
| header clock/date/counters | T9 |
| item/notes overflow | T9 |
| fixed dark/Inter/icons | T9 |
| offline stale snapshot | T8 |
| unauthorized clears snapshot | T8 |
| no QZ/jsPDF/admin bootstrap | T7, T10 |
| 1080p/720p homologation | T11 |
| 32" physical validation | T11 |
| release evidence | T12 |

# 6. Plan self-review

## 6.1 Current-architecture check

The plan was written against current master where:

- Orders lives under `src/domains/orders`;
- `kitchenQueue.js` and `orderRealtime.js` are pure Orders owners;
- normal App still owns the interactive Cozinha composition;
- settings surfaces live under `src/app/surfaces/settings`;
- settings capability checks use server-resolved grants;
- order reads are currently complete via `worker/orderReadRepository.js`;
- admin auth is cookie-based under `worker/auth.js`;
- `src/main.jsx` still statically imports App and therefore needs the planned split;
- latest migration is 0027 at design time.

## 6.2 Historical Kitchen TV plan differences

The abandoned 2026-09-09 branch is not an implementation base.

This plan intentionally changes:

- old 4+3 layout → approved 3×2 / max 6;
- old split 75/25 → single 3-column grid;
- order number prominent → customer name prominent;
- query token → URL fragment token;
- pre-Spec-C paths → current modular paths;
- fixed legacy timing assumptions → current operation settings;
- prior printing-era assumptions → current centralized printing remains untouched.

## 6.3 Security review

The plan does not:

- expose a public state endpoint without credential;
- reuse admin auth;
- persist plaintext tokens;
- expose sensitive order fields;
- permit TV writes;
- leave stale orders visible after revocation.

## 6.4 Performance review

The plan does not:

- load admin bootstrap;
- load App before route selection;
- fetch lifetime order history;
- poll every second;
- write last-seen every poll;
- import printing/QZ/PDF stack;
- add animation or icon libraries.

## 6.5 Product decisions remaining

No blocking product decision remains before implementation.

The only non-code item to carry into execution is the approved visual asset itself, which Task 1 must version in the repository.

# 7. Approval gate

This plan is ready for product review.

Approval of this plan authorizes starting Task 1 on a fresh implementation branch after re-checking the current master.

It does **not** authorize:

- merging to master;
- production migration;
- production deploy.


## 8. Implementation handoff note — 2026-09-22

Product approved this plan.

Execution protocol requested for Codex:

- work only on `feature/kitchen-tv-display-v2`;
- first fetch and prove local HEAD matches remote branch;
- read the approved spec, this plan and relevant QA/release documents before editing product code;
- execute Tasks 1–12 strictly in order;
- within each task, run only focused tests relevant to that task plus architecture checks when the task changes boundaries;
- do not run the full repository suite between tasks;
- do not push intermediate RED/GREEN commits;
- keep all task commits local until Task 12 closure;
- after all Tasks 1–12 are complete, run the full local repository gates exactly once as the final integration gate;
- only after the full local gate is green, push the complete branch once;
- then wait for GitHub CI on the pushed head;
- do not deploy staging;
- do not merge;
- do not deploy production;
- browser/TV homologation is performed manually by the product owner after CI is green.

The approved visual reference asset is part of the implementation handoff. If it is already versioned on the implementation branch before Codex begins, treat that docs-only precondition as satisfied and do not manufacture an artificial failing test solely to prove the file was absent. Behavioral/product changes still follow RED → GREEN.
