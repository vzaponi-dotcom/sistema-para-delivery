# Central de Controle da Cozinha — Implementation Plan

**Data:** 2026-09-28  
**Spec aprovada:** docs/superpowers/specs/2026-09-28-kitchen-tv-control-center-design.md  
**Branch:** feature/kitchen-tv-control-center  
**Base:** master@18f37ff68bcad478f9d34800c4378044424cb769  
**PR:** #81  
**Status:** **SELF-REVIEWED — READY FOR IMPLEMENTATION**  
**Produção:** proibida durante as tasks; staging e merge são gates separados.

## 1. Goal

Implementar uma central mobile-first para controlar a Kitchen TV sem transformar a sessão da TV em superfície administrativa.

Resultados:

- TV paginada pelo mesmo solver best-fit já homologado;
- Anterior/Início/Próxima no celular;
- telemetria da página realmente renderizada;
- grade compacta de pedidos em preparo;
- **Retirar da TV** e **Voltar para a TV** sem alterar lifecycle oficial;
- nova capacidade orders.kitchen.control;
- nova chegada força página 1;
- TV permanece passiva/read-only para negócio;
- 10 cards compactos como alvo de densidade em viewport mobile representativo;
- claro/escuro administrativo + tema próprio da TV preservados.

## 2. Protocol before product code

Antes da Task 1 funcional:

1. confirmar branch feature/kitchen-tv-control-center;
2. confirmar base ancestral 18f37ff68bcad478f9d34800c4378044424cb769;
3. confirmar PR #81 única e Draft;
4. confirmar spec no HEAD da branch;
5. rodar baseline remoto/local disponível;
6. não alterar master diretamente;
7. não fazer deploy de produção.

Se master avançar antes da Task 1, revisar apenas mudanças que afetem:

- Kitchen TV;
- Orders lifecycle;
- capability catalog;
- navigation registry;
- migrations 0032+;
- Settings → TV da Cozinha.

## 3. Baseline gates

Executar no primeiro SHA de implementação:

~~~bash
npm test
npm run test:architecture
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
~~~

Registrar:

- SHA;
- totais de testes;
- architecture;
- lint;
- build;
- dry-runs;
- D1 local;
- Spec B gate.

Baseline não verde bloqueia a implementação até a causa ser entendida.

## 4. Global constraints

1. Strict RED → GREEN para comportamento.
2. Retirar da TV nunca chama updateOrderStatus.
3. Não gravar orders.status nem finished_at nessa ação.
4. Não tocar em preço, pagamento, impressão ou histórico.
5. TV session não ganha capacidade administrativa.
6. Única escrita da TV: telemetria do próprio painel.
7. Sem WebSocket na V1.
8. Sem segundo polling completo de Orders no frontend administrativo.
9. Best-fit continua com ownership em src/kitchen-display.
10. Worker não duplica packing/layout.
11. Sem regra de quantidade fixa de pedidos para escolher página.
12. Paginação deve ter guard de progresso zero.
13. Comandos offline não são enfileirados.
14. UI administrativa segue os tokens existentes e o Guia Mesiva v1.0.
15. Mockup compacto é referência de densidade/hierarquia, não literal de efeitos.
16. Sem biblioteca de UI paralela.
17. Não mergear sem TV real + celular real em staging.
18. Não publicar produção sem autorização posterior.

## 5. Task map

| Task | Purpose | Main outcome |
|---|---|---|
| 1 | Lock capability + navigation contracts | rota e autorização sem UI ainda |
| 2 | Add D1 control state | controle/ocultação persistentes e limpos |
| 3 | Repository + admin/public APIs | comandos seguros e telemetria restrita |
| 4 | Filter TV-only hidden orders | pedido some só da TV |
| 5 | Build deterministic TV pages | paginação pelo solver atual |
| 6 | Apply remote page control in TV runtime | TV responde a revision/page |
| 7 | Add telemetry + arrival reset | celular sabe o que TV realmente mostra |
| 8 | Build compact mobile control surface | grid denso + ações |
| 9 | Wire navigation + Settings shortcut | fluxo operacional completo |
| 10 | Concurrency/offline/security hardening | sem stale commands / privilege leaks |
| 11 | Full gates + staging QA | release candidate e handoff |

---

# Task 1 — RED/GREEN: capability and route contracts

## Purpose

Criar o contrato de acesso e navegação antes de dados/API.

## Files

Modify:

- shared/settingsAccess.js;
- src/app/navigation/registry.js;
- src/App.jsx;
- navigation/capability tests.

Potential tests:

- src/actionCapabilities.test.js;
- src/app/navigation/registry.test.js;
- src/app/navigation/resolution.test.js;
- src/navigationLayout.test.js.

## RED

Exigir:

- orders.kitchen.control é capacidade conhecida;
- legacy authenticated set recebe a capacidade;
- destino:
  - id kitchen-tv-control;
  - path /pedidos/controle-da-tv;
  - area orders;
  - label Controle da TV;
  - capability de leitura orders.view;
- entra em AREA_DESTINATION_IDS.orders;
- entra no conjunto de destinos implementados;
- não vira item novo da bottom nav principal;
- aparece no AreaNavigation de Pedidos;
- usuário com orders.view sem orders.kitchen.control pode abrir read-only;
- ação de controle exige orders.kitchen.control.

Expected RED: capacidade/destino ausentes.

## GREEN

Adicionar apenas contrato de capability/route.

Não renderizar superfície real ainda; placeholder mínimo só se necessário para manter rota implementada.

## Focused validation

~~~bash
node --test src/actionCapabilities.test.js src/app/navigation/registry.test.js src/app/navigation/resolution.test.js src/navigationLayout.test.js
npm run test:architecture
~~~

## Commit target

feat: define Kitchen TV control access contract

---

# Task 2 — D1: display control + hidden orders

## Purpose

Persistir controle remoto e estado TV-only sem tocar em Orders lifecycle.

## Files

Create:

- migrations/0032_kitchen_tv_control.sql;
- worker/kitchenTvControlMigration.test.js.

Potentially modify D1 gate fixtures if migrations are enumerated explicitly.

## Schema

### kitchen_tv_display_control

Campos:

- business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE;
- revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
- requested_page INTEGER NOT NULL DEFAULT 1 CHECK (requested_page >= 1);
- updated_at TEXT NOT NULL;
- reported_revision INTEGER;
- reported_page INTEGER CHECK (reported_page IS NULL OR reported_page >= 1);
- reported_page_count INTEGER CHECK (reported_page_count IS NULL OR reported_page_count >= 1);
- reported_viewport_width INTEGER;
- reported_viewport_height INTEGER;
- reported_visible_order_ids_json TEXT;
- reported_at TEXT.

### kitchen_tv_hidden_orders

- business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE;
- order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE;
- hidden_at TEXT NOT NULL;
- PK (business_id, order_id);
- index por business_id.

## Terminal cleanup

Migration deve criar trigger SQL removendo o hidden row quando order:

- recebe finished_at;
- recebe cancelled_at;
- ou status terminal conhecido.

Não alterar semantics da mutação oficial.

## RED

Testar em SQLite real:

1. clean install cria duas tabelas;
2. constraints rejeitam page/revision inválidos;
3. duas empresas são isoladas;
4. mesmo order não duplica hidden state;
5. finalização remove hidden;
6. cancelamento remove hidden;
7. pedido de outra empresa não satisfaz business-scope;
8. upgrade de 0031 → 0032 preserva dados atuais.

## GREEN

Implementar migration.

## Validation

~~~bash
node --test worker/kitchenTvControlMigration.test.js
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
~~~

## Commit target

feat: persist Kitchen TV control state

---

# Task 3 — Repository and API boundaries

## Purpose

Implementar controle administrativo e telemetria TV com autenticações separadas.

## Files

Create:

- worker/kitchenTvControlRepository.js;
- worker/kitchenTvControlRepository.test.js.

Modify:

- worker/kitchenTvApi.js;
- worker/kitchenTvApi.test.js;
- worker/kitchenTvSecurityRegression.test.js;
- possibly worker/index.test.js.

## Repository interfaces

Proposed:

~~~js
loadKitchenTvControl(db, businessId)
setKitchenTvRequestedPage(db, businessId, page, now)
hideKitchenTvOrder(db, businessId, orderId, now)
restoreKitchenTvOrder(db, businessId, orderId)
listKitchenTvHiddenOrderIds(db, businessId)
reportKitchenTvDisplay(db, businessId, payload, now)
~~~

Mutations must be idempotent.

hideKitchenTvOrder validates:

- order exists;
- same business;
- active;
- status Em preparo;
- not finished/cancelled.

## Admin endpoints

- GET /api/kitchen-tv/control
- PATCH /api/kitchen-tv/control/page
- PUT /api/kitchen-tv/control/orders/:id/hidden
- DELETE /api/kitchen-tv/control/orders/:id/hidden

Read:

- requires orders.view.

Write:

- requires orders.kitchen.control;
- same-origin guard;
- business scope.

## TV endpoint

- POST /api/kitchen-tv/report

Requires valid Kitchen TV session only.

It may write:

- applied revision;
- page;
- pageCount;
- viewport;
- visible IDs.

It may not accept:

- requestedPage;
- hidden order IDs;
- order mutation.

## RED

Cover:

- admin viewer reads control;
- viewer without control cannot mutate;
- controller can set page;
- page < 1 rejected;
- hide same-business preparing works;
- hide scheduled/terminal rejected;
- hide other-business rejected;
- repeated hide = success/idempotent;
- repeated restore = success/idempotent;
- TV session may report;
- TV session may not hit admin control mutations;
- admin session cannot spoof TV report if endpoint requires TV session;
- visible IDs payload bounded/validated;
- arbitrary order data absent.

## GREEN

Implementar repository + routes.

## Commit target

feat: add Kitchen TV control API

---

# Task 4 — Hide orders only from Kitchen TV reads

## Purpose

Provar separação entre “retirar da TV” e pedido oficial.

## Files

Modify:

- worker/kitchenTvReadRepository.js;
- worker/kitchenTvReadRepository.test.js;
- security/contract tests if needed.

## RED

Fixture:

- p1/p2 ambos Em preparo;
- p1 hidden;
- admin order read ainda retorna p1/p2;
- Kitchen TV state retorna só p2;
- item rows de p1 não vazam;
- restore retorna p1 no state;
- hidden terminal state é limpo/ignorado;
- scheduled unaffected unless officially preparing.

Também provar que state retorna:

~~~js
control: { revision, requestedPage }
~~~

No payload TV não retornar telemetria administrativa desnecessária.

## GREEN

Adicionar anti-join/NOT EXISTS no read TV e anexar controle mínimo.

Não alterar listOrders administrativo.

## Regression

- orders.status unchanged;
- finished_at unchanged;
- payment unchanged;
- printing unchanged.

## Commit target

feat: filter TV-only hidden orders

---

# Task 5 — Deterministic multipage best-fit

## Purpose

Paginar usando o solver real sem hardcode de quantidade.

## Files

Modify:

- src/kitchen-display/kitchenDisplayPresentation.js;
- src/kitchen-display/kitchenDisplayPresentation.test.js;
- src/kitchen-display/kitchenDisplayContentLayout.test.js only if required.

## New interface

~~~js
buildKitchenDisplayPages(
  orders,
  timing,
  now,
  highlightedIds,
  viewport
) -> {
  pages,
  totalVisible,
  unrenderableOrderIds
}
~~~

Cada page deve conter profile/cards/overflow necessários ao board.

buildKitchenDisplayPresentation permanece compatível como página 1 por compatibilidade.

## Algorithm

Loop:

1. construir apresentação dos restantes;
2. capturar IDs efetivamente exibidos;
3. remover somente esses IDs;
4. repetir;
5. se a iteração exibir zero IDs:
   - parar;
   - colocar restantes em unrenderableOrderIds;
   - nunca loop infinito.

Prioridade/safe-backfill/full-height da PR #79 continuam intactos.

## RED

Cobrir:

- 1 página;
- 2 páginas;
- 3 páginas;
- mix grande/pequenos;
- oversized + pequenos;
- scheduled só depois dos preparing elegíveis;
- ordem estável;
- nenhum ID duplicado entre páginas;
- união das páginas = todos os renderizáveis;
- pedido extremo impossível não causa loop;
- buildKitchenDisplayPresentation regressão permanece igual na página 1.

## GREEN

Implementar builder puro.

## Commit target

feat: paginate Kitchen TV best-fit pages

---

# Task 6 — TV runtime remote page control

## Purpose

Fazer a TV reagir ao controle sem transformar requestedPage em estado persistente local perigoso.

## Files

Modify:

- src/kitchen-display/KitchenDisplayApp.jsx;
- src/kitchen-display/KitchenDisplayApp.test.js;
- src/kitchen-display/KitchenDisplayBoard.jsx;
- board tests.

Potential helper:

- src/kitchen-display/kitchenDisplayPaging.js;
- focused tests.

## Runtime state

TV owns:

- currentPage;
- baselineRevision;
- appliedRevision.

Bootstrap/reload:

- currentPage = 1;
- appliedRevision = state.control.revision;
- old requested page is not replayed.

Polling:

- if control.revision > appliedRevision:
  - clamp requestedPage to pageCount;
  - apply;
  - update appliedRevision.

Page disappearance:

- clamp current page.

## RED

Cover:

- reload always page1;
- old revision ignored;
- newer revision page2 applied;
- page > count clamps;
- pageCount shrinks;
- no TV button UI introduced;
- board receives selected page cards only.

## GREEN

Implement runtime.

## Commit target

feat: remotely control Kitchen TV page

---

# Task 7 — Arrival reset + telemetry

## Purpose

Garantir que página secundária nunca esconda nova chegada e tornar celular observável.

## Files

Modify:

- src/kitchen-display/kitchenDisplayApi.js;
- src/kitchen-display/kitchenDisplayApi.test.js;
- src/kitchen-display/KitchenDisplayApp.jsx;
- app tests.

## Telemetry behavior

Report only when relevant state changes, with optional slow heartbeat.

Payload:

~~~js
{
  appliedRevision,
  currentPage,
  pageCount,
  viewportWidth,
  viewportHeight,
  visibleOrderIds
}
~~~

Deduplicate identical report fingerprints.

## Arrival rule

When detectOperationalArrivals returns new IDs:

- existing audio/highlight behavior stays;
- currentPage = 1;
- do not decrement/rewrite server revision;
- old command with same revision is not reapplied.

## RED

Cover:

- arrival on page2 -> page1;
- audio once remains;
- highlight remains;
- no stale page2 replay;
- telemetry follows actual page1;
- resize changes telemetry;
- identical polling snapshot does not POST every 2 s;
- telemetry failure does not break order polling/render.

## GREEN

Implement report API call + runtime dedup.

## Commit target

feat: report and reset Kitchen TV paging

---

# Task 8 — Compact mobile control surface

## Purpose

Implementar o mockup compacto aprovado usando componentes/tokens existentes.

## Files

Create:

- src/app/surfaces/kitchen-tv-control/KitchenTvControlSurface.jsx;
- src/app/surfaces/kitchen-tv-control/KitchenTvControlSurface.test.js;
- src/app/surfaces/kitchen-tv-control/kitchenTvControlApi.js;
- src/app/surfaces/kitchen-tv-control/kitchenTvControlApi.test.js;
- src/app/surfaces/kitchen-tv-control/kitchenTvControl.css.

Potential helper:

- kitchenTvControlPresentation.js + tests.

Modify:

- src/App.jsx.

## Data ownership

Use existing App data:

- orders;
- kitchenNow;
- currentTiming.

Use buildKitchenQueueModel.

Control API only fetches:

- pairing/control;
- telemetry;
- hidden IDs.

Do not GET another full order list.

## Layout contract

Dark-mode reference approved:

- compact title/status;
- compact horizontal paging bar;
- four small summary tiles;
- two-column order grid;
- target ~10 cards visible on representative mobile viewport;
- card whole clickable;
- number + short client + operational status + TV visibility only.

Actual implementation:

- follows current admin theme;
- supports light/dark;
- semantic tokens, not hardcoded mockup neon;
- text+icon+color;
- 4px spacing rhythm;
- primary touch target ~44px.

## Visibility presentation

- hidden -> Retirado;
- fresh telemetry visible ID -> Na TV;
- fresh telemetry not visible -> Fora;
- stale/no telemetry -> TV sem sinal.

## RED

Component tests:

- 10-card fixture renders 10 compact cards;
- no item names/financial data in grid;
- statuses textual;
- visibility semantics;
- read-only user sees but cannot mutate;
- stale telemetry disables controls;
- loading/error/offline states;
- theme-neutral class/token usage;
- mobile grid two-column CSS contract.

## GREEN

Implement surface.

## Visual validation

Representative CSS viewport:

- 390×844 target;
- 360×800 lower-bound check;
- desktop width check, without stretching cards absurdly.

## Commit target

feat: add compact Kitchen TV control surface

---

# Task 9 — Order action sheet + navigation/Settings integration

## Purpose

Fechar UX operacional aprovada.

## Files

Modify:

- control surface;
- src/app/navigation/registry.js;
- src/App.jsx;
- src/app/surfaces/settings/KitchenTvSettings.jsx;
- related tests.

Potential reusable UI:

- existing sheet/dialog component if available;
- otherwise local accessible bottom sheet using existing primitives.

## Order sheet

Tap card opens:

- order number;
- client;
- Retirar da TV or Voltar para a TV;
- Ver na Cozinha;
- explanatory copy.

Do not call mutation on card tap alone.

## Optimistic behavior

On hide/restore:

1. mark pending;
2. execute server request;
3. reconcile hidden IDs;
4. feedback;
5. optional Undo invokes inverse mutation.

Failure restores authoritative state and announces error.

## “Ver na Cozinha”

Navigate to orders.

V1 does not require automatically opening the exact OrderDetail after navigation; if a stable existing selection contract is available without expanding scope, it may be used. Otherwise navigate to Cozinha only and document limitation.

## Settings shortcut

When TV paired:

- Abrir controle da TV.

When not paired:

- no operational shortcut or disabled with explanation.

## RED

Cover:

- action sheet opens;
- no mutation on initial tap;
- hide;
- restore;
- undo;
- error rollback;
- capability blocks mutation;
- Settings shortcut;
- route/deep link;
- AreaNavigation order:
  - Cozinha;
  - Histórico;
  - Controle da TV.

## Commit target

feat: wire Kitchen TV control actions

---

# Task 10 — Concurrency, offline and security hardening

## Purpose

Provar que o recurso não cria condição perigosa em operação.

## Files

Tests across:

- worker control repository/API;
- control surface;
- TV runtime;
- architecture/security.

## RED/GREEN cases

### A — two controllers

- client A page2 -> revision N;
- client B page3 -> revision N+1;
- TV applies latest;
- telemetry confirms page3.

### B — idempotent hide/restore

- two hides -> one row;
- two restores -> zero row;
- no 500.

### C — telemetry stale

Define freshness threshold in one shared admin presentation constant/helper.

When stale:

- page controls disabled;
- order control disabled;
- no queued command.

### D — TV revoked

- admin control state reflects unpaired;
- TV report rejected;
- TV state rejected;
- hidden action blocked while no paired TV.

### E — official terminal transition

- hidden order finalized via official Orders path;
- trigger removes hidden row;
- order history normal;
- no extra TV-only history artifact.

### F — permission separation

- orders.kitchen.control without orders.finalize can hide/restore/page-control;
- cannot finalize;
- orders.finalize without kitchen-control cannot hide/page-control;
- settings.manage still separate.

### G — payload/security

TV state/report still excludes:

- phone;
- address;
- payment;
- total;
- PIN/admin session;
- settings mutations.

### H — architecture

- admin control surface cannot import Worker internals;
- Kitchen TV cannot import admin surface;
- TV bundle still isolated from App.

## Commit target

test: harden Kitchen TV control boundaries

---

# Task 11 — Full gates, staging QA and closure

## Step 1 — full gates

~~~bash
npm test
npm run test:architecture
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
~~~

Migration 0032 requires explicit D1 clean-install/upgrade proof.

## Step 2 — exact-SHA Validate

Record:

- product candidate SHA;
- Validate number/run id;
- 8 shards;
- architecture;
- lint;
- build;
- Worker dry-runs;
- D1 gates.

No docs successor can replace candidate evidence.

## Step 3 — staging deploy

Deploy exact product candidate.

Production remains untouched.

## Step 4 — mobile QA

Real phone preferred.

Checklist:

1. direct route /pedidos/controle-da-tv;
2. compact header;
3. 10-card fixture density;
4. 390×844;
5. 360×800;
6. scroll with >10;
7. light theme;
8. dark theme;
9. TV connected;
10. telemetry stale;
11. read-only;
12. controls enabled;
13. card tap opens actions;
14. hide;
15. restore;
16. Undo;
17. Ver na Cozinha;
18. Settings shortcut;
19. offline phone;
20. F5/deep link.

## Step 5 — TV + phone paired QA

Use real TV and real phone together.

1. 1 TV page -> buttons disabled appropriately;
2. enough orders for 2 pages;
3. Próxima -> TV page2 within polling cycle;
4. Anterior;
5. Início;
6. page indicator on TV;
7. telemetry phone matches TV;
8. arrival while page2 -> TV page1 + alert;
9. old page2 command does not replay;
10. hide visible order -> disappears only from TV;
11. hidden remains in Pedidos → Cozinha;
12. restore -> returns according to solver;
13. hide changes pageCount if applicable;
14. clamp current page after shrink;
15. finalize hidden order officially -> hidden state removed;
16. cancel hidden order -> hidden state removed;
17. large/small best-fit regression from PR #79;
18. scheduled priority regression;
19. fullscreen;
20. offline/reconnect.

## Step 6 — concurrency QA

Open control in two admin sessions:

- alternate page commands;
- hide same order;
- restore same order;
- verify no corrupt state.

## Step 7 — privacy/security smoke

Network panel:

- controller order grid obtains orders from existing admin runtime;
- control endpoint does not expose extra private data;
- TV state remains minimal;
- TV session cannot call admin mutations.

## Step 8 — QA doc

Create:

docs/superpowers/qa/kitchen-tv-control-center-qa.md

Record:

- base;
- spec SHA;
- plan SHA;
- migration SHA;
- RED/GREEN evidence;
- product candidate;
- Validate;
- staging;
- mobile QA;
- TV QA;
- concurrency;
- known limitations;
- production NO DEPLOY.

## Step 9 — PR closure

Before asking merge:

- all tasks complete;
- exact product SHA green;
- staging homologated;
- 0 unresolved review threads;
- no blocking/high/medium findings;
- PR body updated;
- production untouched.

Stop and request explicit merge authorization.

## Commit target

docs: close Kitchen TV control center QA

---

## 6. Expected checkpoint sequence

Approximate production commits:

1. feat: define Kitchen TV control access contract
2. feat: persist Kitchen TV control state
3. feat: add Kitchen TV control API
4. feat: filter TV-only hidden orders
5. feat: paginate Kitchen TV best-fit pages
6. feat: remotely control Kitchen TV page
7. feat: report and reset Kitchen TV paging
8. feat: add compact Kitchen TV control surface
9. feat: wire Kitchen TV control actions
10. test: harden Kitchen TV control boundaries
11. docs: close Kitchen TV control center QA

RED commits may precede cada GREEN.

Do not squash required TDD evidence before review unless explicitly authorized.

## 7. Risk register

### Risk A — “Retirar” accidentally finalizes

Mitigation:

- separate endpoint/table/capability;
- no reuse of updateOrderStatus;
- regression checks status/finished_at.

### Risk B — stale page command returns after arrival

Mitigation:

- revision gating;
- baseline revision on reload;
- no offline queued commands.

### Risk C — pagination infinite loop

Mitigation:

- progress-zero guard;
- explicit unrenderable IDs.

### Risk D — mobile duplicates Orders polling

Mitigation:

- reuse App collection;
- control endpoint carries only control state.

### Risk E — TV session gains privilege

Mitigation:

- separate public/admin handlers;
- report-only TV POST;
- security regression.

### Risk F — visibility badge lies

Mitigation:

- telemetry is authoritative;
- stale becomes TV sem sinal.

### Risk G — hidden rows accumulate

Mitigation:

- terminal cleanup trigger;
- FK cascade.

### Risk H — dense UI harms usability

Mitigation:

- only essential fields;
- card as whole target;
- 44px comfort target;
- 390×844 + 360×800 QA;
- no content-by-color only.

### Risk I — mockup becomes parallel theme

Mitigation:

- existing components/tokens;
- Mesiva v1.0;
- mockup defines hierarchy/density only.

### Risk J — multiple controllers fight

Mitigation:

- revision last-write-wins;
- telemetry confirmation;
- idempotent order visibility.

## 8. Definition of done

Complete only when:

- orders.kitchen.control exists and is separated from finalize/settings;
- D1 0032 passes clean-install/upgrade;
- admin control endpoints are scoped/idempotent;
- TV report endpoint is session-restricted;
- hidden order stays officially active;
- terminal transition cleans hidden state;
- multipage solver is deterministic and clipping-safe;
- TV applies only new revisions;
- arrival page reset works;
- telemetry reflects actual render;
- compact control surface matches approved density;
- 10-card target is homologated on representative phone;
- light/dark admin themes work;
- real TV + real phone pass;
- concurrency passes;
- full gates green;
- staging homologated;
- merge waits explicit authorization;
- production waits separate authorization.
