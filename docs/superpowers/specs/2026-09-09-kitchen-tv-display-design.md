# Kitchen TV Display — Design Specification

Date: 2026-09-09
Repository: `vzaponi-dotcom/sistema-para-delivery`
Base: `feature/centralized-qz-print-queue`
Design branch: `feature/kitchen-tv-display-design`

## 1. Summary

Add a lightweight, read-only Kitchen TV mode to Gestão Delivery so one wall-mounted TV can continuously display the current kitchen queue without using the normal administrative login.

The TV is not a second kitchen workflow. It is a second presentation of the same operational rules already used by the existing Cozinha screen.

First-version scope:

- one TV per business;
- read-only;
- no normal PIN/login on the TV;
- one-time pairing link generated from Configurações;
- persistent restricted TV session after pairing;
- dedicated lightweight TV frontend surface;
- dedicated minimal TV API;
- fixed dark theme;
- polling, not WebSocket;
- no pagination;
- no multi-device management.

Guiding rule:

> Share the operational logic, not the operational interface.

## 2. Goals

1. Show the kitchen queue on a large screen readable from several meters away.
2. Reuse the exact current Cozinha rules for `Em preparo`, `Agendados`, timing, ordering, lateness, and operational arrivals.
3. Make customer name the dominant identifier; order number remains secondary.
4. Let the TV operate without the administrative PIN after a one-time pairing.
5. Keep the TV payload and frontend bundle very small for modest TV/TV-box hardware.
6. Prevent the TV session from reading or writing administrative data.
7. Let revocation stop the TV on its next refresh.

## 3. Non-goals

Do not add in v1:

- multiple TVs or device lists;
- device names;
- per-device permissions/themes;
- configurable refresh intervals;
- TV-specific preparation timing rules;
- WebSocket/SSE;
- device analytics/log history;
- direct finalize/cancel/print/edit/create actions on TV;
- address, phone, pricing, payment, finance, refund, or printing data;
- a `Novo` status/column;
- automatic pagination/carousel;
- a separate repository/deployment.

## 4. Existing rules to preserve

### 4.1 Interactive Cozinha remains separate

`src/pages/Orders.jsx` is the interactive kitchen screen and includes actions such as finalize, cancel, detail, printing, history, and new order.

The TV must not reuse this whole component with `tvMode` conditionals. It gets its own UI.

### 4.2 Queue classification remains shared

`src/utils/kitchenQueue.js` currently builds the kitchen queue model and classifies active orders into `preparing` and `scheduled`, with the current ordering and late-state logic.

Both Cozinha and TV must use the same source of truth.

### 4.3 Scheduled timing remains unchanged

`shared/orderTiming.js` currently defines `SCHEDULED_PREP_LEAD_MINUTES = 50` and the operational-start logic.

Example:

- scheduled for 12:00;
- stays in `Agendados` before 11:10;
- enters `Em preparo` at 11:10;
- TV does not introduce another lead time.

### 4.4 Operational-arrival detection remains unchanged

`src/utils/orderRealtime.js` already defines when an order newly enters the operational set.

The TV reuses that definition for:

- immediate orders created for now;
- scheduled orders crossing into their preparation window;
- avoiding false alerts for all active orders after reload.

## 5. Architecture

### 5.1 One project and deploy, separate frontend surface

Conceptually:

```text
/            -> administrative App
/cozinha-tv  -> KitchenTvApp
```

The TV app is a dedicated surface inside the current project/deploy.

The entry layer should choose the requested app before loading the heavy administrative tree, using dynamic import/code splitting. No React Router is required solely for this feature.

Conceptual entry:

```text
pathname === '/cozinha-tv'
  -> import KitchenTvApp
else
  -> import App
```

### 5.2 Share rules, not UI

```text
                 shared kitchen rules
                 /                  \
       normal Cozinha            Kitchen TV
       interactive               read-only
```

A small shared operational selector/model may be extracted if needed, but existing semantics must not change.

## 6. Performance and lightweight requirements

Performance on low-powered TV hardware is a first-class requirement.

### 6.1 No administrative bootstrap

The TV must never call `/api/bootstrap`.

It must not download/query clients, products, finance, tables management, print jobs, dashboard data, or order history.

### 6.2 Dedicated code-split bundle

`/cozinha-tv` must not load the full administrative app before rendering.

Avoid downloading modules for:

- Dashboard;
- Clientes;
- Produtos;
- A Receber;
- Financeiro;
- Mesas;
- order creation;
- interactive order actions/details;
- printing/QZ;
- admin Sidebar/MobileNavigation;
- theme picker/light-theme controls;
- unrelated forms/modals.

TV mode may import small pure utilities for queue/timing/realtime behavior.

### 6.3 Minimal active-only API response

The TV endpoint must query only current active kitchen-relevant orders and their required items.

Years of historical orders must not increase TV payload size if the active queue is unchanged.

### 6.4 Lightweight rendering

Use standard React + CSS only. Do not add video, canvas, large decorative imagery, or an animation library just for TV. Temporary arrival emphasis should be simple CSS.

## 7. Access and pairing

### 7.1 No normal login

The TV does not use `/api/auth/login` and does not use the restaurant PIN.

It receives a separate restricted TV credential/session.

### 7.2 One TV access record in v1

There is only one Kitchen TV access for the business. Configurações therefore manages a single state, not a list of devices.

### 7.3 Generate access

Authenticated admin flow:

```text
Configurações
  -> TV da Cozinha
  -> Gerar acesso da TV
```

The server generates a cryptographically random pairing secret.

Rules:

- plaintext secret is returned only at generation time;
- only its cryptographic hash is persisted;
- UI shows `Copiar link`;
- secret is not recoverable later from the database.

Conceptual URL:

```text
https://<host>/cozinha-tv?token=<pairing-secret>
```

### 7.4 One-time pairing

On first opening a valid pairing URL:

1. TV frontend sends the pairing secret to a dedicated pairing endpoint;
2. server validates the hash;
3. server creates a distinct opaque TV session secret;
4. only the session hash is stored;
5. server sets a dedicated secure HttpOnly TV cookie;
6. frontend removes the pairing secret from the visible URL and stays on `/cozinha-tv`;
7. server clears/invalidates the pairing secret immediately after successful pairing.

Therefore the same pairing link cannot be used to pair another browser after the first successful pairing.

### 7.5 Persistent until revocation

The TV must not stop working because of a short admin-style session expiry.

Provide effective persistence with:

- a long-lived TV cookie;
- lifetime refresh during valid TV use where appropriate;
- server-side validity until explicit revoke/regenerate.

Browser/device cookie clearing still requires a new pairing link.

### 7.6 Revocation and regeneration

`Revogar acesso` invalidates the current TV session server-side.

At the next TV refresh:

- state API rejects access;
- TV clears displayed order data;
- TV shows an unauthorized message;
- stale order data is not left visible as current.

`Gerar novo acesso` invalidates any previous pairing/session credentials and creates a fresh one-time link.

## 8. Storage

Add one numbered migration for a monodispositivo table, e.g. `kitchen_tv_access`, with at most one row per `business_id`.

Required logical fields:

- `business_id`;
- `pairing_token_hash` nullable;
- `session_token_hash` nullable;
- `created_at`;
- `paired_at` nullable;
- `last_seen_at` nullable;
- `revoked_at` nullable.

`updated_at` may be included if consistent with repository conventions.

No plaintext pairing/session secret may be persisted.

After successful pairing, `pairing_token_hash` must no longer authorize another pairing.

## 9. API boundaries

### 9.1 Admin trust model remains unchanged

The TV session must never satisfy normal admin authentication and cannot become equivalent to `getAuthenticatedSession()`.

Normal administrative routes keep their existing authorization model.

### 9.2 Authenticated admin endpoints

Conceptual responsibilities:

```text
GET  /api/kitchen-tv/settings
POST /api/kitchen-tv/access
POST /api/kitchen-tv/revoke
```

- settings: non-secret configured/paired/last-seen state;
- access: generate/regenerate one-time pairing access;
- revoke: invalidate current access.

Mutations use existing same-origin protections.

### 9.3 Pairing endpoint

A dedicated public pairing action accepts a high-entropy secret and establishes the restricted TV session only if valid.

It does not return business bootstrap data.

### 9.4 State endpoint

Conceptually:

```text
GET /api/kitchen-tv/state
```

It authenticates only the TV session cookie, is read-only, and returns only the Kitchen TV contract.

## 10. TV data contract

The TV must not receive the normal full order representation.

### 10.1 Allowed

Only data needed for display/shared rules:

- stable order id/reference;
- customer display name;
- order type: current system values such as `Entrega`, `Retirada`, `Local`;
- table/local display label only when needed for a local order;
- created timestamp;
- scheduled timestamp when applicable;
- minimal status fields required for active-state behavior;
- item name snapshot;
- item quantity;
- item kitchen note/observation;
- order-level kitchen observation only if such an operational field exists.

Derived elapsed time should be computed from timestamps using shared timing utilities where practical.

### 10.2 Forbidden

Do not return:

- phone;
- address;
- client profile;
- prices/totals;
- delivery fee;
- adjustment/discount data;
- payment data;
- receivables;
- refunds;
- finance movements;
- product catalog;
- unrelated table-management data;
- print jobs;
- QZ data;
- completed historical orders.

Prefer an explicit whitelisted query/mapper rather than loading a full order and stripping sensitive fields afterward.

## 11. Refresh and operational behavior

### 11.1 Polling

Use periodic polling, approximately the same ~2-second cadence as the current Cozinha, provided the endpoint remains active-only and small.

Do not add WebSocket/SSE in v1.

### 11.2 Same queue behavior

On refresh:

- finalized/cancelled/non-active orders leave the board;
- the next ordered item fills any newly available visible slot;
- new active orders appear;
- scheduled orders cross from `Agendados` to `Em preparo` through the existing shared timing rule.

### 11.3 No `Novos` status

There is no separate `Novos` queue.

A newly operational order is still `Em preparo` and receives only temporary presentation feedback:

- sound alert;
- temporary highlight;
- optional temporary `Acabou de entrar` badge.

This applies equally to a new immediate order and a scheduled order reaching operational start.

Initial load seeds known operational ids without alerting every already-active order.

## 12. TV visual design

### 12.1 Fixed dark layout

TV mode has a fixed dark high-contrast theme independent of the normal system theme.

Approved widescreen structure:

- ~70–75% width: `Em preparo`;
- ~25–30% width: `Agendados`.

### 12.2 Header

Keep the approved header concept:

- `Cozinha TV` / Gestão Delivery identity on the left;
- large current time centered;
- date under time;
- right side: `Modo acompanhamento` and `Apenas visualização`.

### 12.3 `Em preparo` card hierarchy

1. customer name — largest/boldest;
2. operational elapsed time;
3. type badge (`Entrega`, `Retirada`, `Local` as applicable);
4. items and quantities;
5. kitchen observations;
6. order number — small secondary reference.

### 12.4 `Agendados` hierarchy

1. scheduled time;
2. customer name;
3. concise item summary;
4. order number as secondary reference.

Use existing scheduled ordering (nearest first).

### 12.5 Visible capacity and no pagination

Initial presentation target:

- up to 4 visible `Em preparo` cards;
- up to 3 visible `Agendados` cards.

No automatic page rotation.

If more orders exist than visible slots, keep the highest-priority entries according to existing queue ordering and show:

`+ N pedidos aguardando espaço`

When a visible order leaves, the next queue entry fills its slot automatically.

## 13. First-run interaction, audio, fullscreen

After successful pairing, show one lightweight action:

`Iniciar painel da cozinha`

That single click should:

1. attempt to unlock/init the browser audio context;
2. request fullscreen where supported;
3. enter the live panel.

Fullscreen failure must not block the panel.

If audio later becomes blocked after browser/device restart, show a discreet action such as:

`Toque uma vez para ativar os alertas sonoros.`

## 14. Failure states

### 14.1 Temporary network/server failure

For a temporary connectivity or non-auth server failure:

- keep the last successful queue visible;
- clearly mark it stale, e.g. `Sem conexão — aguardando reconexão`;
- do not present the stale update timestamp as current;
- retry automatically;
- refresh immediately when connectivity returns.

### 14.2 Unauthorized/revoked

For a definitive TV auth/revocation failure:

- clear all order data;
- do not keep stale queue visible;
- show `Este painel não está mais autorizado. Gere um novo acesso nas Configurações.` or equivalent.

### 14.3 Invalid/used pairing link

Show a generic configuration failure and instruct the administrator to generate a new Kitchen TV access. Do not expose sensitive validation details.

## 15. Configurações UI

Add `Configurações` to the administrative navigation. The only section required by this feature is `TV da Cozinha`.

Keep it monodispositivo and minimal.

### Not configured

- brief explanation;
- `Gerar acesso da TV`.

### Access generated / awaiting first pairing

- one-time link;
- `Copiar link`;
- warning that it is shown only now;
- option to generate a new link if needed.

### Paired/active

- `TV da cozinha ativa`;
- friendly `Último acesso` from `last_seen_at`;
- `Gerar novo acesso`;
- `Revogar acesso`.

No TV name field and no device list.

Revocation requires confirmation because it stops the live panel.

## 16. Security requirements

1. Generate pairing/session secrets with cryptographically secure randomness.
2. Persist only hashes.
3. Consume/invalidate the pairing secret after one successful pairing.
4. Remove the pairing secret from the visible URL after pairing.
5. Use a dedicated TV cookie, separate from the admin cookie.
6. TV cookie is `HttpOnly`, `Secure`, and restrictive `SameSite`.
7. TV auth cannot satisfy admin auth.
8. TV state is read-only.
9. Admin TV mutations remain admin-authenticated and same-origin protected.
10. Revocation is enforced server-side.
11. TV state explicitly whitelists fields and never exposes phone/address/payment/finance/printing data.

## 17. Testing strategy

Implementation must use strict TDD: RED before relevant behavior changes.

### 17.1 Backend/auth

Required tests:

1. authenticated admin can generate pairing access;
2. plaintext pairing secret is not stored;
3. valid secret pairs successfully;
4. invalid secret fails;
5. successful pairing consumes the one-time pairing secret;
6. the same pairing link cannot pair a second browser;
7. session secret is stored only as a hash;
8. paired TV can read TV state;
9. revoked TV is rejected;
10. regenerating access invalidates previous session/link;
11. TV session cannot access admin APIs;
12. normal admin auth remains unchanged.

### 17.2 Data contract

Tests prove TV response:

- includes customer display name, needed type/timestamps, items/quantities/notes;
- excludes phone/address;
- excludes prices/fees/adjustments;
- excludes payment/refund/finance;
- excludes printing;
- excludes finalized/cancelled/historical orders;
- is based on active queue, not lifetime history.

### 17.3 Shared operational rules

Preserve/extend tests proving:

- immediate active order is preparing;
- future scheduled order is scheduled;
- scheduled order enters preparing at the existing 50-minute boundary;
- preparing/scheduled ordering remains current behavior;
- late state remains consistent;
- initial load does not false-alert all active orders;
- immediate new order triggers operational arrival;
- scheduled order crossing operational start triggers arrival.

### 17.4 Frontend TV

Tests cover:

- `/cozinha-tv` selects the TV app without bootstrapping admin app;
- TV never calls `/api/bootstrap`;
- renders `Em preparo` and `Agendados` from shared rules;
- customer name is primary and order number secondary;
- shows at most 4 preparing and 3 scheduled cards;
- overflow count is correct;
- next order fills a slot after one leaves;
- arrival receives temporary highlight;
- no `Novos` column/status;
- unauthorized clears orders;
- transient offline/error preserves stale queue with warning;
- start click attempts audio + fullscreen without requiring fullscreen;
- fixed dark theme does not depend on admin theme.

Existing Cozinha/timing/realtime regression tests must remain green.

## 18. Acceptance criteria

The feature is accepted when:

1. Admin can generate a one-time Kitchen TV link from `Configurações > TV da Cozinha`.
2. TV opens without normal PIN.
3. Successful pairing creates a restricted TV session, consumes the link, and removes the secret from the visible URL.
4. TV remains effectively persistent until revoke/regenerate or browser data clearing.
5. TV session cannot access admin APIs.
6. TV state contains only minimal kitchen-safe active data.
7. TV does not call admin bootstrap or load the full admin app tree.
8. TV classification matches normal Cozinha exactly.
9. Scheduled orders use the existing 50-minute preparation rule.
10. New operational arrivals get approved sound + temporary visual highlight without a new status.
11. Board contains `Em preparo` + `Agendados`, with customer name dominant.
12. Up to 4 preparing and 3 scheduled cards are visible.
13. No pagination; overflow uses `+ N pedidos aguardando espaço` or equivalent.
14. When an order leaves operation through the normal app, it disappears on the next TV refresh and the next queued order fills the slot.
15. TV uses fixed dark high-contrast theme.
16. One start interaction attempts audio unlock + fullscreen.
17. Temporary connectivity failures keep the last state visibly marked stale.
18. Revocation clears the queue on the next refresh and blocks further reads.
19. All new TDD and relevant existing regression tests pass.

## 19. Implementation principles

- strict TDD;
- preserve existing kitchen semantics;
- no speculative multi-TV abstraction;
- active-only minimal TV payload;
- dedicated lightweight bundle;
- explicit server authorization boundaries;
- prefer focused new modules rather than growing `App.jsx`, `Orders.jsx`, or `worker/index.js`;
- no production deploy until feature/staging homologation is complete.

Likely implementation areas:

- entry/lazy app selection around `src/main.jsx`;
- focused `src/tv/` components/CSS;
- new administrative Configurações page/section;
- small API client additions;
- dedicated worker TV auth/repository/API modules;
- one new D1 migration;
- integration dispatch in `worker/index.js`;
- backend, contract, shared-rule, TV UI, and regression tests.

## 20. Deferred evolution

If a second TV is ever needed, evolve the single access record into a device table then. Do not build that abstraction now.

If polling later proves insufficient, consider push transport then. Do not add WebSocket complexity now.

## 21. Final decision

Kitchen TV is a dedicated lightweight read-only surface inside the existing project/deploy. It pairs through a one-time admin-generated secret, uses a restricted persistent session until explicit revocation, receives only active kitchen-safe data, and reuses the exact operational rules already used by Cozinha.

It is a large-screen view of the existing operation, not a second kitchen system.
