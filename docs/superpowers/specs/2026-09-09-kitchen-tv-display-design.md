# Kitchen TV Display — Design Specification

Date: 2026-09-09
Repository: `vzaponi-dotcom/sistema-para-delivery`
Base branch used for this design: `feature/centralized-qz-print-queue`
Design branch: `feature/kitchen-tv-display-design`

## 1. Summary

Add a lightweight, read-only Kitchen TV mode to Gestão Delivery so a wall-mounted TV can continuously display the current kitchen queue without requiring a normal administrative login.

The TV must not introduce a second operational workflow. It is a second presentation of the same kitchen rules already used by the existing `Orders` / Cozinha screen.

The first version is deliberately small:

- one kitchen TV per business;
- read-only display;
- no administrative login on the TV;
- one generated pairing link;
- a persistent TV session after pairing;
- a dedicated lightweight frontend entry;
- a dedicated minimal read-only API;
- fixed dark theme;
- no pagination;
- no WebSocket requirement;
- no multi-device management.

The guiding rule is:

> Share the operational logic, not the operational interface.

The normal Cozinha screen remains the place where users finalize, cancel, inspect, print, or otherwise operate on orders. The TV only observes.

## 2. Problem

The existing Cozinha screen already represents the restaurant's operational queue well, but it is designed for an interactive computer/mobile interface. The kitchen also needs a large passive display that can remain visible from several meters away.

Using the existing full application directly on a TV would have several drawbacks:

- it loads administrative screens and data the TV does not need;
- it exposes interactive controls that should not exist on a passive wall display;
- it requires a normal login session;
- it is not optimized for large-screen readability;
- loading the full administrative bundle may be unnecessarily heavy for a Smart TV or low-powered TV box.

The TV experience therefore needs to be a dedicated read-only surface while continuing to use the same operational definitions already implemented in the application.

## 3. Goals

### 3.1 Product goals

1. Allow a kitchen TV to open the kitchen panel without entering the normal system PIN.
2. Display only the information required to prepare orders.
3. Keep the TV synchronized with the same operational queue as the current Cozinha screen.
4. Prioritize the customer name visually over the order number.
5. Keep immediate orders and operationally released scheduled orders in the same `Em preparo` flow already used today.
6. Keep future scheduled orders visible in a secondary `Agendados` area.
7. Highlight and sound an alert when an order enters the operational queue.
8. Keep cards stable on screen: no automatic pagination or carousel.
9. Replace a card naturally when the corresponding order leaves the active queue.
10. Remain usable on modest TV hardware.

### 3.2 Technical goals

1. Do not load the administrative bootstrap in TV mode.
2. Do not send historical orders or unrelated business data to the TV.
3. Do not expose administrative APIs through the TV session.
4. Store pairing/session secrets only as hashes server-side.
5. Reuse existing kitchen timing/classification rules rather than reimplementing them.
6. Keep the first implementation simple enough to evolve later if multiple TVs are ever required.

## 4. Non-goals

The first version does not include:

- multiple TV/device management;
- per-TV names;
- per-TV permissions;
- per-TV themes;
- configurable refresh interval;
- configurable preparation lead time specifically for TV;
- online/offline monitoring dashboard for devices;
- device access logs/history;
- analytics or TV usage metrics;
- WebSocket, Server-Sent Events, or push infrastructure;
- direct TV actions such as finalize, cancel, print, edit, or create order;
- address/phone/payment/financial data on the TV;
- a separate deployment or separate repository;
- a new kitchen status named `Novo`;
- automatic pagination or rotating pages.

If more than one TV is required later, the storage and settings model can be expanded at that time.

## 5. Existing architecture to preserve

### 5.1 Current Cozinha UI

The existing `src/pages/Orders.jsx` renders the interactive Cozinha experience. It includes operational controls such as:

- finalize order;
- cancel order;
- open order detail;
- printing configuration;
- history navigation;
- create new order;
- kitchen sound toggle.

The TV must not reuse this whole component with conditional action hiding. Doing so would couple a passive display to a large interactive surface and create a growing set of `tvMode` conditions.

### 5.2 Current queue classification

`src/utils/kitchenQueue.js` already produces the kitchen queue model. It classifies active orders into:

- `preparing`;
- `scheduled`.

It also applies the current ordering rules and late-state calculation.

This logic must remain the source of truth for both the normal Cozinha interface and the TV.

### 5.3 Current scheduled-order timing

`shared/orderTiming.js` defines the operational timing behavior, including:

- `SCHEDULED_PREP_LEAD_MINUTES = 50`;
- `getOperationalStartAt(order)`;
- `isScheduledWaiting(order, now)`;
- operational elapsed time.

The TV must not introduce its own preparation lead time.

Example:

- order scheduled for 12:00;
- operational start is 11:10;
- before 11:10 it remains in `Agendados`;
- at/after 11:10 it belongs to `Em preparo`.

### 5.4 Current operational-arrival detection

`src/utils/orderRealtime.js` already distinguishes orders that have entered the operational queue from scheduled orders still waiting.

The TV should reuse the same definition of an operational arrival so that:

- a newly created immediate order can trigger an alert;
- a scheduled order crossing into its operational preparation window can trigger an alert;
- reloading the TV does not incorrectly treat every already-active order as newly arrived.

## 6. Chosen architecture

### 6.1 One project and one deployment

The feature remains inside the existing Gestão Delivery project and Cloudflare deployment.

Conceptually:

```text
/
  -> administrative App

/cozinha-tv
  -> lightweight KitchenTvApp
```

No second repository and no second deploy are required.

### 6.2 Separate frontend surface

The TV receives its own application component, tentatively `KitchenTvApp`.

The normal administrative `App` is not rendered on `/cozinha-tv`.

The entry layer should determine the requested mode before loading the heavy application tree and dynamically import the correct app surface.

Conceptual bootstrap:

```text
pathname === /cozinha-tv
  -> import KitchenTvApp
else
  -> import App
```

The implementation does not need to add React Router solely for this feature.

### 6.3 Shared rules, separate UI

The normal Cozinha and the TV must share the kitchen queue/timing rules while rendering separate components.

```text
                    shared kitchen rules
                    /                  \
       interactive Cozinha         Kitchen TV
       actions + details            read-only
```

If extracting a smaller shared operational selector/model is useful, the implementation may do so, but it must preserve the existing behavior and tests.

## 7. TV access model

### 7.1 No normal administrative login

The TV does not use `/api/auth/login` and does not require the restaurant PIN.

It receives a dedicated, restricted access flow.

### 7.2 One TV access per business in v1

The first version supports one Kitchen TV access record for `amor-e-sabor`.

The administrative settings UI therefore does not manage a list of devices.

Its states are conceptually:

- not configured;
- configured/active;
- revoked or ready to generate a new access.

### 7.3 Generate pairing access

Inside the authenticated administrative application:

```text
Configurações
  -> TV da Cozinha
  -> Gerar acesso da TV
```

The server generates a cryptographically random pairing token.

Requirements:

- the plaintext pairing token is returned only at generation time;
- only a cryptographic hash is stored in D1;
- the UI provides a `Copiar link` action;
- the plaintext token is not recoverable later from the database.

Conceptual URL:

```text
https://<host>/cozinha-tv?token=<pairing-secret>
```

### 7.4 Pairing on the TV

On first opening a valid pairing URL:

1. the TV frontend submits/uses the pairing secret to a dedicated TV pairing endpoint;
2. the server validates its hash against the current TV access record;
3. the server creates/rotates a distinct opaque TV session secret;
4. only the TV session hash is stored server-side;
5. the TV receives a dedicated secure HttpOnly cookie;
6. the frontend removes the pairing token from the visible URL and remains at `/cozinha-tv`.

The original pairing token is not required for normal subsequent TV refreshes.

### 7.5 Persistent until revocation

The product requirement is that the kitchen TV should not stop working because of a short automatic session expiry.

Browser cookie policies can prevent a literal permanent cookie, so the implementation should provide effective persistence by:

- using a long-lived TV cookie;
- refreshing its lifetime during valid TV state requests when appropriate;
- keeping the server-side TV access valid until it is explicitly revoked/regenerated.

There is no short seven-day administrative-session-style expiry requirement for TV mode.

If a browser/device clears its cookies, the TV must be paired again using a newly generated access link.

### 7.6 Revocation

`Revogar acesso` must invalidate the existing TV session on the server.

On the TV's next state refresh:

- the server rejects the TV session;
- the client immediately removes order data from the UI;
- the TV shows a neutral unauthorized state;
- no stale queue remains visible as if it were current.

Message example:

`Este painel não está mais autorizado. Gere um novo acesso nas Configurações.`

### 7.7 Regeneration

`Gerar novo acesso` invalidates any previous pairing/session credentials and produces a fresh one-time pairing URL.

This is intentionally simpler than attempting to persist recoverable plaintext access tokens.

## 8. Storage design

Create one new migration for a single Kitchen TV access record per business.

A simple table may be named `kitchen_tv_access`.

Required logical fields:

- `business_id` — primary business identifier / one record per business;
- `pairing_token_hash` — nullable hash of the current pairing secret;
- `session_token_hash` — nullable hash of the active paired TV session secret;
- `created_at` — when TV access was first generated;
- `paired_at` — when a TV successfully paired;
- `last_seen_at` — last successful state refresh;
- `revoked_at` — set when access is explicitly revoked.

Implementation may add `updated_at` if consistent with repository conventions.

No plaintext token/session secret may be persisted.

The schema must enforce at most one row per `business_id` in this version.

## 9. API boundaries

### 9.1 Existing administrative API remains unchanged in trust model

Normal `/api/...` routes continue to require the existing authenticated administrative session unless they are explicitly part of the new TV access surface.

The TV session must not satisfy `getAuthenticatedSession()` or otherwise become equivalent to an admin session.

### 9.2 Administrative TV settings endpoints

Authenticated administrative routes are required for configuration.

Conceptual routes:

```text
GET  /api/kitchen-tv/settings
POST /api/kitchen-tv/access
POST /api/kitchen-tv/revoke
```

Exact naming may be refined in the implementation plan, but responsibilities are fixed:

- settings: return non-secret status such as configured/paired/lastSeen/revoked;
- access: generate or regenerate a one-time pairing link/secret;
- revoke: invalidate the pairing/session.

All mutations must use existing same-origin mutation protections.

### 9.3 Public pairing endpoint

A dedicated route accepts the pairing secret and, if valid, establishes the TV session.

It must not return business bootstrap data.

It must be rate-limited or otherwise protected against practical brute-force abuse if the current infrastructure makes that straightforward. The primary protection is a high-entropy random secret, not a human PIN.

### 9.4 TV state endpoint

The paired TV uses one dedicated read-only endpoint, conceptually:

```text
GET /api/kitchen-tv/state
```

This endpoint authenticates only the TV session cookie and returns only the kitchen display state.

It does not accept writes.

The TV session cannot call administrative read/write routes.

## 10. Minimal TV data contract

The TV must not receive the full normal order representation.

The dedicated query/mapper should return only fields required by the display and shared operational rules.

### 10.1 Allowed order data

Per relevant active order, the TV may receive:

- stable order id/reference;
- customer display name;
- order type (`Entrega`, `Retirada`, or local/table equivalent needed by kitchen);
- created timestamp;
- scheduled timestamp when applicable;
- status fields strictly required to determine active/finished behavior;
- item list containing:
  - item name snapshot;
  - quantity;
  - kitchen-relevant item note/observation;
- order-level kitchen observation if such a field exists in the order model and is used operationally.

Derived presentation values such as elapsed minutes should preferably be computed client-side from timestamps and the shared timing utilities, keeping server/client behavior coherent.

### 10.2 Forbidden TV data

The TV endpoint must not expose:

- customer phone;
- customer address;
- customer database profile;
- prices;
- subtotal;
- delivery fee;
- discounts/accrual adjustments;
- payment method;
- paid amount;
- receivables data;
- refund data;
- finance movements;
- product catalog;
- table management data beyond a display label strictly required for a local/table order;
- print jobs;
- QZ configuration/certificates;
- historical completed orders.

### 10.3 Active-only query

The TV query must be proportional to the current operational queue, not the lifetime order history.

It should query only active orders relevant to the kitchen display and their required items.

A restaurant with years of historical orders should not cause a larger TV payload than a restaurant with the same current active queue on day one.

## 11. Refresh and realtime behavior

### 11.1 Polling, not WebSocket

The first version uses periodic polling.

The current Cozinha already refreshes orders at approximately two-second intervals, which is operationally sufficient.

The TV may use the same approximate cadence (`~2s`) provided the endpoint remains small and active-only.

No WebSocket/SSE infrastructure is required.

### 11.2 State transitions

On each successful refresh:

- removed/finalized/cancelled orders leave the displayed queue;
- newly relevant orders appear;
- the next order naturally fills an available card slot;
- scheduled orders crossing the existing operational-start boundary move from `Agendados` to `Em preparo` through the same shared rule.

### 11.3 Operational arrival alert

An alert occurs when an order newly enters the operational set according to the existing arrival logic.

This includes:

- an immediate order created for now;
- a scheduled order reaching its existing operational start time.

The TV must not create a separate `Novo` status or column.

A newly operational order receives:

- the existing-style sound alert;
- a temporary visual emphasis;
- a temporary label such as `Acabou de entrar`.

After the temporary emphasis ends, the card remains a normal `Em preparo` card.

Initial page load must seed the known operational set without sounding for every already-active order.

## 12. Performance requirements

Performance on low-powered TV hardware is a first-class requirement.

### 12.1 Dedicated lightweight bundle

`/cozinha-tv` must not load the complete administrative application tree before rendering the TV.

Use code splitting/dynamic imports so the TV avoids downloading modules for:

- Dashboard;
- Clientes;
- Produtos;
- A Receber;
- Financeiro;
- Mesas;
- order creation;
- administrative order detail/actions;
- printing/QZ;
- administrative shell/sidebar/mobile navigation;
- light-theme controls;
- unrelated modal/form libraries used only by the admin app.

The TV can still share small pure utilities required for order timing and classification.

### 12.2 No administrative bootstrap

The TV must never call `/api/bootstrap`.

It calls only the pairing/session endpoints and the minimal TV state endpoint.

### 12.3 Payload proportional to active queue

The server response includes only active operational/scheduled orders needed by the display.

No history is transferred.

### 12.4 Lightweight rendering

The TV UI should use standard React + CSS and avoid unnecessary heavy rendering dependencies.

Do not add:

- video backgrounds;
- canvas rendering;
- animation libraries solely for this screen;
- large decorative images;
- continuous expensive effects.

Allowed effects should be simple CSS transitions/glows for recent arrivals.

### 12.5 Theme

TV mode has a fixed dark theme optimized for high contrast and distance viewing.

It does not initialize or expose the normal theme picker for this route unless a shared low-cost base style is technically required.

## 13. TV visual design

### 13.1 Overall layout

The approved layout is a widescreen hybrid board:

- approximately 70–75% of width: `Em preparo`;
- approximately 25–30% of width: `Agendados`.

The exact CSS proportions may adapt to target 16:9 dimensions while preserving this hierarchy.

### 13.2 Header

Use the previously approved header form:

- `Cozinha TV` / Gestão Delivery identity on the left;
- large current time centered;
- date below the time;
- right-side status text such as:
  - `Modo acompanhamento`;
  - `Apenas visualização`.

The header must remain visually secondary to the order cards.

### 13.3 `Em preparo` cards

The primary visual element is the customer name.

Required hierarchy:

1. customer name — largest/boldest;
2. elapsed operational time;
3. order type badge;
4. items and quantities;
5. kitchen notes/observations;
6. order number — small, secondary reference.

The order number must not dominate the card.

### 13.4 `Agendados`

The scheduled area prioritizes:

1. scheduled time;
2. customer name;
3. concise item summary;
4. order number as secondary reference.

Scheduled entries are ordered using the existing kitchen scheduled ordering rule (nearest first).

### 13.5 Visible card capacity

Initial target:

- up to 4 visible `Em preparo` cards;
- up to 3 visible `Agendados` cards.

This is a presentation cap, not an operational cap.

### 13.6 No pagination

There is no automatic page rotation.

If more orders exist than visible slots, keep the currently highest-priority orders according to the existing queue ordering and show a simple overflow indicator, e.g.:

`+ 3 pedidos aguardando espaço`

When a visible order leaves the active queue, the next ordered entry fills the newly available slot automatically.

The purpose is to keep the display stable while kitchen staff are reading it.

## 14. First-run interaction, sound, and fullscreen

Browsers commonly block audio/fullscreen before user interaction.

After pairing, the TV shows a lightweight start state with one action:

`Iniciar painel da cozinha`

That click should:

1. attempt to initialize/unlock the audio context;
2. request browser fullscreen where supported;
3. enter the live panel.

If fullscreen is denied/unavailable, the panel still operates normally.

If audio later becomes blocked (for example after device/browser restart), show a discreet actionable message such as:

`Toque uma vez para ativar os alertas sonoros.`

The panel remains otherwise functional.

## 15. Offline and failure states

### 15.1 Temporary network failure

If a previously paired/loaded TV temporarily loses network connectivity:

- keep the most recent queue visible so the screen does not go blank immediately;
- clearly mark it stale with `Sem conexão — aguardando reconexão` or equivalent;
- do not represent the stale timestamp as current;
- retry automatically at the normal polling cadence/backoff appropriate to the existing client style.

When the connection returns, refresh state automatically.

### 15.2 Temporary API/server error

For transient non-auth server failures:

- preserve the last successful state;
- show that updates are interrupted;
- retry automatically.

### 15.3 Revoked or invalid TV session

Authentication/revocation failure is different from temporary connectivity failure.

On a definitive unauthorized/revoked response:

- clear all displayed order data;
- stop showing the stale queue;
- show the unauthorized state.

### 15.4 Invalid pairing link

An invalid or obsolete pairing token must not reveal whether unrelated secrets exist.

Show a generic configuration error and instruct the administrator to generate a new Kitchen TV access from Configurações.

## 16. Administrative Configurações UI

### 16.1 New Configurações area

Add `Configurações` to the existing administrative navigation.

The first section required by this feature is `TV da Cozinha`.

The architecture may allow future settings sections, but this feature must not build speculative settings functionality.

### 16.2 TV section states

Keep the UI monodispositivo and minimal.

#### Not configured

Show:

- explanatory text;
- `Gerar acesso da TV`.

#### Access generated / awaiting pairing

Show:

- one-time pairing link;
- `Copiar link`;
- warning that the secret is only shown now;
- option to generate a new access if needed.

#### Paired/active

Show:

- `TV da cozinha ativa`;
- friendly `Último acesso` derived from `last_seen_at`;
- `Gerar novo acesso`;
- `Revogar acesso`.

No device name field is required.

No list/table of devices is required.

### 16.3 Revocation confirmation

Revocation is destructive to the current TV session, so require confirmation.

Suggested meaning:

`O painel deixará de exibir os pedidos na próxima atualização. Para usar a TV novamente será necessário gerar um novo acesso.`

## 17. Security requirements

1. TV pairing secrets must be generated with cryptographically secure randomness.
2. Pairing secrets and TV session secrets must be persisted only as hashes.
3. The pairing token must be removed from the visible URL after successful pairing.
4. The TV session uses a dedicated cookie name, separate from the administrative session cookie.
5. The TV cookie must be `HttpOnly`, `Secure`, and use a restrictive `SameSite` policy consistent with same-site access.
6. TV authentication must not satisfy admin authentication.
7. TV endpoints are read-only except the dedicated pairing/session establishment action.
8. Administrative TV configuration mutations remain admin-authenticated and same-origin protected.
9. Revocation invalidates the current session server-side; client-side UI state alone is not security.
10. The TV state serializer/query must explicitly whitelist fields rather than returning the full order object and deleting fields afterward where practical.
11. No phone, address, payment, financial, printing, or unrelated business data may be returned by the TV state endpoint.

## 18. Testing strategy

Implementation must use strict TDD for behavior changes.

### 18.1 Backend/auth tests

Required cases:

1. authenticated admin can generate a Kitchen TV pairing secret;
2. generated secret is not stored plaintext;
3. valid pairing secret establishes a TV session;
4. invalid pairing secret does not establish a session;
5. obsolete/regenerated pairing secret no longer works;
6. TV session secret is stored only as a hash;
7. paired TV can read TV state;
8. revoked TV session is rejected;
9. regenerating access invalidates prior TV session;
10. TV session cannot access authenticated administrative endpoints;
11. normal admin session behavior remains unchanged.

### 18.2 Data-contract tests

Required cases:

1. TV response includes customer display name;
2. TV response includes required items/quantities/notes;
3. TV response includes scheduling/type/timing fields needed by shared rules;
4. TV response excludes phone;
5. TV response excludes address;
6. TV response excludes prices/totals/fees/adjustments;
7. TV response excludes payment/refund/finance fields;
8. TV response excludes printing fields;
9. finalized/cancelled/non-active historical orders are not returned;
10. query/result size depends on active queue, not full order history.

### 18.3 Shared operational-rule tests

Preserve and, where needed, extend tests proving:

1. immediate active order is `preparing`;
2. future scheduled order before operational start is `scheduled`;
3. scheduled order becomes `preparing` at the same existing 50-minute operational boundary;
4. ordering of preparing entries remains the existing kitchen ordering;
5. ordering of scheduled entries remains nearest-first;
6. late state remains consistent with normal Cozinha;
7. operational arrival detection does not alert all orders on initial load;
8. a newly created immediate order is detected as a new operational arrival;
9. a scheduled order crossing into operational time is detected as a new operational arrival.

### 18.4 Frontend TV tests

Required cases:

1. `/cozinha-tv` selects the TV app without bootstrapping the normal admin app;
2. TV app never calls `/api/bootstrap`;
3. TV renders `Em preparo` and `Agendados` from shared queue rules;
4. customer name has primary semantic/visual role and order number is secondary;
5. maximum visible cards are 4 preparing and 3 scheduled;
6. overflow count displays when entries exceed visible slots;
7. removing a visible order causes the next ordered entry to occupy the available slot;
8. new operational arrival receives temporary highlight;
9. there is no `Novos` column/status;
10. unauthorized/revoked response clears order content;
11. transient offline/error state preserves last successful queue with stale warning;
12. start interaction attempts audio unlock and fullscreen without making fullscreen mandatory;
13. fixed TV dark theme does not depend on administrative theme selection.

### 18.5 Regression tests

Existing Cozinha/order timing/order realtime tests must remain green.

The implementation must not change the normal operational workflow merely to satisfy TV rendering.

## 19. Acceptance criteria

The feature is accepted when all of the following are true:

1. An administrator can open `Configurações > TV da Cozinha` and generate a one-time Kitchen TV access link.
2. Opening that link on a TV does not require the normal administrative PIN.
3. Successful pairing removes the secret from the visible URL and establishes a dedicated TV session.
4. The TV can subsequently open `/cozinha-tv` and remain effectively persistent until access is revoked or browser state is cleared.
5. The TV session cannot access administrative APIs.
6. The TV state response contains only minimal kitchen data and no phone/address/financial/payment/printing data.
7. `/cozinha-tv` does not load the full administrative application/bootstrap.
8. The TV shows the same current operational classification as the normal Cozinha screen.
9. Scheduled orders use the existing 50-minute preparation lead behavior with no TV-specific rule.
10. New operational arrivals receive the approved sound + temporary visual highlight.
11. The main board shows `Em preparo`; the side area shows `Agendados`; there is no `Novos` status.
12. Customer name is the dominant identifier on cards; order number is secondary.
13. Up to 4 preparing and 3 scheduled cards are visible at once.
14. There is no pagination; overflow is shown as `+ N pedidos aguardando espaço` or equivalent.
15. Finalizing/removing an order through the normal app causes it to disappear from the TV on the next refresh and the next queue entry fills the slot.
16. The TV uses a fixed dark, high-contrast theme.
17. The TV starts with a single interaction capable of unlocking sound and requesting fullscreen.
18. Temporary network/server failures keep the last queue visible with an explicit stale/offline warning.
19. Revocation clears the queue and blocks further state reads on the next refresh.
20. All new TDD coverage and existing relevant regression tests pass.

## 20. Implementation principles

The implementation plan must follow these principles:

- TDD: RED before relevant behavior changes;
- preserve existing kitchen semantics;
- no speculative multi-TV abstractions;
- minimize TV bundle and API payload;
- explicit server-side authorization boundaries;
- prefer small, focused modules over adding more responsibilities to `App.jsx`, `Orders.jsx`, or `worker/index.js`;
- reuse pure shared timing/queue logic where appropriate;
- no production deploy until feature/staging homologation is complete.

## 21. Expected implementation areas

Exact files will be finalized in the implementation plan, but likely areas include:

### Frontend

- `src/main.jsx` or a small entry/router helper for lazy app selection;
- new `src/tv/` or similarly focused directory;
- new `KitchenTvApp` / board/card components;
- dedicated TV CSS;
- new administrative `Configurações` page/section;
- small API client additions for TV settings/pairing/state;
- shared queue/realtime utility extraction only if needed to avoid duplication.

### Worker/backend

- dedicated Kitchen TV auth/session helper rather than expanding admin auth semantics;
- dedicated Kitchen TV repository/query with whitelisted fields;
- dedicated Kitchen TV API handler to avoid overloading `worker/index.js` further;
- small integration points in `worker/index.js` for route dispatch.

### Database

- one new numbered migration for `kitchen_tv_access`.

### Tests

- worker auth/access tests;
- TV read-contract tests;
- frontend route/bundle behavior tests where practical;
- TV UI queue tests;
- shared timing/realtime regressions.

## 22. Future evolution intentionally deferred

If the restaurant later needs multiple displays, the monodispositivo record can evolve into a `kitchen_tv_devices` table with one row per device. The UI can then add names, independent revocation, and per-device last-seen status.

This future possibility must not increase v1 complexity now.

Likewise, polling can later be replaced by a push transport if operational evidence demonstrates a need. The v1 architecture must not add WebSocket complexity preemptively.

## 23. Final design decision

Implement Kitchen TV as a dedicated, lightweight, read-only application surface inside the existing project and deployment. Pair it through a one-time admin-generated secret, persist a restricted TV session until explicit revocation, return only active kitchen-safe data, and reuse the exact operational timing/classification rules already used by Cozinha.

The feature succeeds by being a faithful large-screen view of the existing operation, not by becoming a second kitchen system.
