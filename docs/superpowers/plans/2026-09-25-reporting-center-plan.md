# Gestão Delivery — Centro de Relatórios — Implementation Plan

> Execution mode: executar task por task, sempre RED → GREEN, com evidência por SHA exato. Nenhuma implementação começa antes da aprovação explícita deste plano.

**Status:** APPROVED — plano aprovado pelo usuário em 2026-09-25; execução autorizada task por task, sem produção  
**Feature:** Issue #34 — Centro de Relatórios operacionais, vendas e produtos  
**Spec aprovada:** `docs/superpowers/specs/2026-09-25-reporting-center-design.md`  
**Branch documental:** `docs/issue-34-reporting-center-v2`  
**Implementation branch planejada:** `feature/issue-34-reporting-center`  
**Master baseline confirmado:** `6445098aef8332890b854f6eb8524b5f9c053b8f`  
**Spec checkpoint aprovado:** `9864cf9d385f40f000bfe951d6306c32d5aaa998`  
**Migrations atuais confirmadas:** até `0029_kitchen_tv_pairing_requests.sql`  
**Produção:** proibida durante a implementação/homologação sem autorização separada

---

## 1. Goal

Entregar um Centro de Relatórios gerencial e analítico que:

- calcula métricas oficiais no backend;
- usa D1 como fonte de verdade;
- respeita `business_id` derivado da sessão;
- separa venda, recebimento e saldo a receber;
- preserva a semântica histórica de timing;
- suporta pagamentos divididos corretamente;
- usa snapshots históricos de produtos;
- oferece Visão Geral, Operação, Vendas, Produtos e Detalhado;
- permite drill-down;
- exporta CSV, XLSX e PDF a partir do mesmo modelo oficial;
- entrega experiência desktop completa;
- entrega mobile resumido;
- mantém A Receber como único fluxo operacional de baixa;
- não transforma o Dashboard/browser em motor analítico.

---

## 2. Approved product decisions

Estas decisões são fixas para este plano.

### 2.1 Reporting é leitura

Reporting pode consultar, agregar, comparar, filtrar e explicar dados.

Reporting não pode:

- registrar pagamento;
- alterar promessa de pagamento;
- efetuar baixa;
- cancelar pedido;
- alterar operação;
- editar catálogo;
- escrever estado analítico próprio.

### 2.2 A Receber continua sendo o fluxo de ação

O card/indicador em Reporting chama-se:

`A receber do período`

Ele representa saldo pendente dos pedidos do recorte selecionado.

Pode haver:

- drill-down;
- valor pendente;
- quantidade;
- vencido/em dia;
- promessa futura quando aplicável;
- link `Gerenciar em A receber`.

Não pode haver `Registrar pagamento` dentro de Reporting.

### 2.3 Desktop completo; mobile resumido

Desktop contém toda a experiência analítica.

Mobile contém:

- período;
- filtros essenciais;
- KPIs;
- comparações;
- gráficos simples;
- rankings;
- drill-down compacto quando útil.

Mobile não recebe uma tabela desktop comprimida nem seleção avançada de colunas.

### 2.4 Timing existente é canônico

Não criar `preparation_started_at`.

Usar:

- `getOperationalStartAt`;
- `getScheduledLateAt`;
- `getOrderLateAt`;
- `getOperationalDurationMinutes`;
- `selectOrderTimingPolicy`;
- `timing_policy_snapshot_json`.

### 2.5 Produto não absorve taxa de entrega

Receita de produto reconcilia com:

`total_cents - delivery_fee_cents`

A entrega permanece uma dimensão financeira separada.

### 2.6 Pagamento dividido usa allocations

Mix por forma de pagamento usa:

- `payment_receipts`;
- `payment_allocations`.

Nunca usar string concatenada de `payments.method` como fonte analítica oficial.

---

## 3. Current baseline confirmed

Na master `6445098...`:

- React Router administrativo já está implantado;
- `src/app/navigation/registry.js` contém Financeiro = Dashboard / A Receber / Movimentações;
- `reports` ainda não existe;
- `shared/settingsAccess.js` ainda não possui `reports.view` / `reports.export`;
- `App.jsx` possui `IMPLEMENTED_DESTINATIONS` sem Reporting;
- Dashboard vive em `src/app/surfaces/dashboard`;
- Dashboard ainda calcula analytics client-side;
- o runtime global possui coleções operacionais, mas Reporting não deve usá-las como fonte;
- Orders possui public boundary em `src/domains/orders/index.js`;
- Finance possui public boundary em `src/domains/finance/index.js`;
- Catalog possui public boundary em `src/domains/catalog/index.js`;
- migrations 0026/0027 já normalizaram split payments;
- migrations 0028/0029 pertencem à Kitchen TV;
- `shared/orderTiming.js` já é a fonte canônica de timing;
- `FINANCE_TIME_ZONE` já é `America/Sao_Paulo`;
- `jspdf` já existe em dependencies;
- biblioteca XLSX ainda não existe;
- `exceljs` é a escolha planejada para XLSX, com import dinâmico e gate de bundle/licença antes do commit de dependência;
- o architecture checker já bloqueia deep imports entre domínios;
- não existe backend Reporting.

---

## 4. Global constraints

- Não desenvolver na master.
- Criar a feature branch somente após aprovação deste plano.
- A feature branch deve nascer do HEAD documental aprovado, que por sua vez deriva da master baseline.
- Se master avançar antes da execução, investigar o drift antes de qualquer código.
- Um único draft PR para a feature.
- Não criar PR duplicada.
- Não fazer deploy de produção.
- Não usar bootstrap/coleções do runtime para calcular métricas de Reporting.
- Não fazer App calcular KPI.
- Não colocar SQL em React/UI.
- Não fazer frontend recalcular venda, ticket, deadline, payment mix ou receita de produto.
- Não aceitar `business_id` da URL/body.
- Não aceitar capability da URL/body.
- Todo SQL deve ser business-scoped.
- Toda paginação detalhada é server-side.
- Toda ordenação detalhada usa allowlist server-side.
- Nenhum filtro desconhecido é silenciosamente aplicado.
- Nenhum filtro conhecido semanticamente inaplicável altera uma métrica sem contrato explícito.
- Ausência de dados não vira zero por conveniência.
- Comparação sem denominador não vira percentual inventado.
- Não criar nova “meta de preparo”.
- Não criar `preparation_started_at`.
- Não duplicar Finance/A Receber dentro de Reporting.
- Não alterar QZ/Printing.
- Não alterar comportamento de Cozinha.
- Não alterar split-payment writers.
- Não alterar contratos de comanda.
- Não introduzir materialized view preventivamente.
- Não criar índices sem evidência de query plan.
- Não permitir export silenciosamente truncado.
- Manter identidade Mesiva v1.0 e tokens existentes.
- Nenhuma imagem/mockup é fonte de regra de negócio.
- Textos/valores ilustrativos dos mockups não são fixtures oficiais.

---

## 5. Target frontend structure

Criar:

`src/domains/reporting/`

Estrutura alvo:

`index.js`  
`domain/reportingQuery.js`  
`domain/reportingPresentation.js`  
`infrastructure/reportingApi.js`  
`application/useReportingData.js`  
`application/useReportingSearchParams.js`  
`ui/ReportingWorkspace.jsx`  
`ui/ReportingFilters.jsx`  
`ui/ReportingTabs.jsx`  
`ui/ReportingMetricCard.jsx`  
`ui/ReportingState.jsx`  
`ui/reporting.css`  
`ui/views/OverviewReport.jsx`  
`ui/views/OperationReport.jsx`  
`ui/views/SalesReport.jsx`  
`ui/views/ProductsReport.jsx`  
`ui/views/DetailReport.jsx`  
`ui/detail/ReportingOrderDrawer.jsx`  
`ui/mobile/ReportingMobileSummary.jsx`  
`export/csvExport.js`  
`export/xlsxExport.js`  
`export/pdfExport.js`

Reutilizar componentes shared quando servirem sem criar acoplamento indevido:

- StatCard;
- PageHeader;
- Icon;
- gráficos shared já existentes quando o contrato visual for adequado;
- Modal/BottomSheet existentes;
- controles acessíveis existentes.

Não mover componentes Dashboard-only para Reporting apenas para evitar pequenas duplicações de apresentação. Se uma visualização realmente for genérica, extrair para `src/shared/ui` em uma task com teste de ownership.

---

## 6. Target backend structure

Criar:

`worker/reporting/query.js`  
`worker/reporting/query.test.js`  
`worker/reporting/repository.js`  
`worker/reporting/repository.test.js`  
`worker/reporting/service.js`  
`worker/reporting/service.test.js`  
`worker/reporting/productRevenue.js`  
`worker/reporting/productRevenue.test.js`  
`worker/reporting/exportModel.js`  
`worker/reporting/exportModel.test.js`  
`worker/reporting/api.js`  
`worker/reporting/api.test.js`

`worker/index.js` apenas:

1. autentica;
2. resolve contexto/capabilities;
3. delega para `handleReportingApi`;
4. mantém rotas existentes intactas.

---

## 7. Query contract

### 7.1 Base params

Contrato inicial:

- `view` = overview | operation | sales | products | detail;
- `from` = YYYY-MM-DD;
- `to` = YYYY-MM-DD;
- `type` = Entrega | Retirada | Local;
- `schedule` = immediate | scheduled;
- `status`;
- `paymentMethod`;
- `category`;
- `product`;
- `customer`;
- `orderHourFrom`;
- `orderHourTo`;
- `operationalDeadline` = on-time | late;
- `search`;
- `sort`;
- `page`;
- `pageSize`.

### 7.2 Defaults

Sem query explícita:

- view = overview;
- from = primeiro dia do mês atual em America/Sao_Paulo;
- to = data atual de negócio;
- page = 1;
- pageSize = 25 no detail desktop;
- demais filtros = ausentes.

### 7.3 Limits

- custom range máximo = 366 dias;
- pageSize allowlist inicial = 25, 50, 100;
- export detail máximo = 10.000 linhas;
- search normalizado e limitado;
- sort somente allowlist;
- hora 00–23;
- from <= to.

### 7.4 URL ownership

Reporting usa search params reais do Router.

Não adicionar o estado analítico de Reporting ao `queryContext.js` legado de páginas.

A URL é a fonte de verdade do filtro de Reporting.

---

## 8. API target

Authenticated read endpoints:

- `GET /api/reporting/overview`;
- `GET /api/reporting/operation`;
- `GET /api/reporting/sales`;
- `GET /api/reporting/products`;
- `GET /api/reporting/orders`;
- `GET /api/reporting/orders/:id` para drawer read-only, se o contrato detalhado provar necessidade;
- `POST /api/reporting/export-model`.

Capabilities:

- `reports.view` para endpoints de leitura;
- `reports.export` para export model.

`POST /export-model` não é mutação de negócio. Ainda assim, seguir o mesmo padrão de autenticação/origin apropriado ao Worker.

---

## 9. Metric contracts to lock with tests

### 9.1 Overview

- Vendas registradas;
- Pedidos;
- Ticket médio;
- Recebido no período;
- A receber do período;
- Taxa de cancelamento;
- Estornos;
- Dentro do prazo operacional.

### 9.2 Operation

- quantidade operacional elegível;
- média;
- mediana;
- P90;
- mais rápido;
- mais lento;
- por modalidade;
- por hora operacional;
- por dia da semana;
- imediato/agendado;
- dentro do prazo;
- fora do prazo;
- atraso médio;
- pontualidade agendada;
- faixas de duração;
- qualidade/cobertura histórica.

### 9.3 Sales

- vendas;
- pedidos;
- ticket;
- mercadoria líquida;
- taxas de entrega em valor;
- ajustes/descontos/acréscimos;
- recebido;
- a receber do período;
- cancelamentos;
- estornos;
- payment mix;
- séries temporais.

Observação: no produto final, evitar o label ambíguo `Taxa de entrega 96,4%` visto no mockup. Quando o dado for financeiro, usar rótulo monetário como `Taxas de entrega` / `Receita de entrega` conforme copy final.

### 9.4 Products

- unidades;
- Refeições vendidas;
- ranking;
- Top 10;
- receita líquida de mercadoria;
- categoria;
- apresentação/tamanho;
- participação;
- comparação;
- crescimento/queda;
- drill-down.

Métricas secundárias dos mockups só entram se derivarem do mesmo contrato sem introduzir semântica nova.

---

# Execution preparation — somente após aprovação deste plano

- [ ] Re-fetch master.
- [ ] Confirmar master em `6445098...` ou investigar todo drift.
- [ ] Confirmar branch documental em HEAD contendo spec + plan aprovados.
- [ ] Criar `feature/issue-34-reporting-center` a partir do HEAD documental aprovado.
- [ ] Criar um draft PR para master.
- [ ] Registrar PR number e HEAD.
- [ ] Rodar/observar Validate baseline antes do primeiro RED.
- [ ] Baseline deve estar verde; falha preexistente precisa ser investigada.
- [ ] Criar `docs/superpowers/qa/reporting-center-execution.md`.
- [ ] Criar `docs/superpowers/qa/reporting-center-qa.md` somente com estados reais.
- [ ] Não fazer staging na preparação.
- [ ] Não fazer produção.

---

# Task 1 — Reporting boundary, capabilities, navigation and URL state

**Purpose:** criar a superfície navegável sem ainda inventar métricas.

## Files

Create:

- `src/domains/reporting/index.js`
- `src/domains/reporting/domain/reportingQuery.js`
- `src/domains/reporting/domain/reportingQuery.test.js`
- `src/domains/reporting/application/useReportingSearchParams.js`
- `src/domains/reporting/application/useReportingSearchParams.test.js`
- `src/domains/reporting/ui/ReportingWorkspace.jsx`
- `src/domains/reporting/ui/ReportingTabs.jsx`
- `src/domains/reporting/ui/reporting.css`

Modify:

- `shared/settingsAccess.js`
- capability tests
- `src/app/navigation/registry.js`
- `src/app/navigation/registry.test.js`
- route/navigation tests affected by destination lists
- `src/App.jsx`
- App ownership/render tests as needed
- architecture checker/tests

## RED

Write focused tests proving:

1. `reports.view` and `reports.export` exist in the canonical capability catalog;
2. `reports` is a destination at `/relatorios` under area Financeiro;
3. desktop Financeiro order is Visão geral -> Relatórios -> A receber -> Movimentações;
4. no new mobile bottom-bar entry is introduced;
5. Finance area fallback still behaves under reduced capabilities;
6. Router direct-open `/relatorios` resolves correctly;
7. F5 route resolution keeps `reports`;
8. unknown `view` normalizes to overview;
9. date/query serialization is deterministic;
10. patching one Reporting filter preserves the others;
11. page resets to 1 when a population-changing filter changes;
12. Report UI exists but does not receive orders/movements/products props from App.

Expected RED: missing capability/destination/domain.

Commit tests only:

`test: define reporting navigation boundary`

Push and record intended failure.

## GREEN

Implement minimum:

- capability catalog;
- nav registry;
- App destination;
- Reporting public boundary;
- URL query normalization/serialization;
- shell with title, tabs and filter placeholder;
- no API/data yet.

Do not add backend route in Task 1.

Run:

`node --test <focused navigation/reporting tests>`  
`npm run test:architecture`  
`npm test`  
`npm run lint`  
`npm run build`

Commit:

`feat: add reporting navigation shell`

Stop if full Validate is not green.

## Acceptance

- `/relatorios` exists.
- Financeiro shows Relatórios.
- Mobile bottom bar unchanged.
- No business metric exists yet.
- App does not pass operational collections to Reporting.
- No Worker/D1 change.

---

# Task 2 — Server query validation, authorization and read-only API foundation

**Purpose:** criar uma fronteira HTTP segura e business-scoped antes das métricas.

## Files

Create:

- `worker/reporting/query.js`
- `worker/reporting/query.test.js`
- `worker/reporting/repository.js`
- `worker/reporting/repository.test.js`
- `worker/reporting/service.js`
- `worker/reporting/api.js`
- `worker/reporting/api.test.js`
- `src/domains/reporting/infrastructure/reportingApi.js`
- `src/domains/reporting/infrastructure/reportingApi.test.js`
- `src/domains/reporting/application/useReportingData.js`
- `src/domains/reporting/application/useReportingData.test.js`

Modify:

- `worker/index.js`
- Worker route tests
- architecture checker/tests if needed

## RED

### Query validation

Cover:

- default month;
- valid custom range;
- invalid date;
- from > to;
- >366 days;
- type/schedule/deadline enums;
- invalid hour;
- invalid page;
- invalid page size;
- sort not allowlisted;
- oversized search;
- unknown params do not gain authority;
- timezone boundary around midnight America/Sao_Paulo.

### Authorization

Prove:

- authenticated + `reports.view` can read;
- authenticated without capability gets 403;
- export requires `reports.export`;
- unauthenticated remains 401 at global boundary;
- query/body `business_id=outro` never changes repository scope;
- query/body fake capabilities are ignored.

### Repository base

Use SQLite-real fixture:

- business A and business B;
- repository called for A never returns B;
- no unscoped SELECT for report rows.

### Frontend API/controller

Prove:

- correct encoded query string;
- AbortSignal forwarded;
- stale request A cannot replace request B;
- 401 surfaces through the established unauthorized path;
- retry uses current normalized query.

Commit RED:

`test: define reporting server query contract`

## GREEN

Implement:

- parse/normalize server query;
- handleReportingApi dispatcher;
- empty typed responses for metric endpoints;
- read-only repository foundation;
- frontend reportingApi;
- generation/AbortController protection.

No real KPI yet.

Run focused Worker + frontend tests, then full gates.

Commit:

`feat: establish reporting api foundation`

## Acceptance

- API boundary exists and is authorized.
- No metric fake values.
- Business isolation proved by SQLite.
- Stale responses rejected.
- No migration.

---

# Task 3 — Overview metrics and desktop overview UI

**Purpose:** primeira fatia vertical completa com verdade oficial.

## Files

Modify/Create:

- `worker/reporting/repository.js`
- `worker/reporting/repository.test.js`
- `worker/reporting/service.js`
- `worker/reporting/service.test.js`
- `worker/reporting/api.test.js`
- `src/domains/reporting/ui/ReportingFilters.jsx`
- `src/domains/reporting/ui/ReportingMetricCard.jsx`
- `src/domains/reporting/ui/ReportingState.jsx`
- `src/domains/reporting/ui/views/OverviewReport.jsx`
- reporting UI tests
- `src/domains/reporting/ui/reporting.css`

## RED — backend

Build realistic fixtures for:

- valid finalized;
- valid active;
- cancelled;
- paid same day;
- paid later;
- split payment;
- unpaid standalone;
- open comanda;
- refund;
- scheduled;
- backdated;
- another business.

Prove:

1. vendas = non-cancelled order total by `order_date`;
2. active non-cancelled order participates in commercial sales;
3. cancelled excluded from sales;
4. orders count matches same commercial population;
5. ticket = sales/orders;
6. zero population does not divide invalidly;
7. received uses receipt once, not allocations sum twice;
8. split receipt still has one received total;
9. A receber do período includes official standalone pending balances;
10. open comanda does not enter A receber;
11. cancellation rate denominator includes cancelled + noncancelled population for the period;
12. refund uses official movement date/source;
13. comparison period uses same filter semantics;
14. comparison unavailable with missing denominator;
15. business isolation.

## RED — frontend

Prove:

- filter bar defaults to current month;
- Overview tab active;
- KPI labels exact;
- `A receber do período` exact;
- comparison direction has text/icon, not color-only;
- loading skeleton;
- empty;
- partial block error;
- unavailable comparison;
- no `Registrar pagamento` string/action;
- `Gerenciar em A receber` may exist only as navigation, not mutation.

## GREEN

Implement overview repository/service/API + desktop layout.

Avoid generated “insight prose” that interprets business quality. Simple factual summaries are allowed, e.g. `Vendas +12,5% vs período anterior`.

Commit:

`feat: implement reporting overview`

## Acceptance

- Overview is end-to-end official.
- A Receber ownership preserved.
- Split receipt counted once.
- No Dashboard refactor yet.

---

# Task 4 — Operational analytics

**Purpose:** consolidar tempo e prazo com a regra histórica já existente.

## Files

Modify:

- `worker/reporting/repository.js`
- `worker/reporting/service.js`
- tests

Create:

- `src/domains/reporting/ui/views/OperationReport.jsx`
- operation UI tests

Reuse:

- `shared/orderTiming.js`

## RED

Fixtures must include:

- immediate completed;
- scheduled completed;
- active;
- cancelled;
- backdated;
- terminal with timing snapshot;
- terminal legacy without snapshot;
- malformed/impossible duration case;
- historical Entregue/Despachado when supported;
- multiple modalities;
- multiple hours/days;
- another business.

Prove:

1. backdated excluded from operational timing;
2. cancelled excluded from duration population;
3. operational start = canonical helper;
4. terminal snapshot beats current policy;
5. no snapshot uses explicit legacy fallback;
6. median correct odd/even sample;
7. P90 contract is deterministic and documented in test;
8. fastest/slowest correct;
9. within deadline uses `finishedAt <= getOrderLateAt(...)`;
10. minutes late measured from same lateAt;
11. scheduled punctuality uses scheduled lateAt;
12. hour bucket uses operational start local time;
13. weekday uses business timezone;
14. mean by modality;
15. duration bands;
16. quality = eligible/measured/legacy/invalid.

Frontend prove:

- Operação tab;
- mean/median/P90;
- within/outside deadline;
- scheduled punctuality;
- hourly/day/modalality views;
- data coverage warning when needed;
- no fake zero for unavailable;
- accessible chart summaries.

## GREEN

Service may aggregate in Worker memory after repository returns only required business-scoped rows for the bounded range.

Do not move this computation to the browser.

Commit:

`feat: add operational reporting analytics`

## Acceptance

- No `preparation_started_at`.
- No new timing policy.
- Historical semantics preserved.

---

# Task 5 — Sales, payment allocations and receivables analysis

**Purpose:** consolidar vendas/caixa sem duplicar A Receber.

## Files

Modify:

- reporting repository/service/api + tests

Create:

- `src/domains/reporting/ui/views/SalesReport.jsx`
- sales UI tests

## RED

Fixtures:

- paid single method;
- paid split method;
- receipt covering comanda/payment associations;
- payment later than order date;
- unpaid;
- promised date;
- overdue;
- future promise;
- cancelled;
- refund;
- delivery fee;
- adjustment discount;
- adjustment surcharge;
- open comanda.

Prove:

1. sales keyed by order_date;
2. receipts keyed by paid_at business day;
3. one split receipt increases received only by receipt total;
4. payment mix sums allocations exactly;
5. cash+pix example produces exact parts;
6. payment mix does not use legacy concatenated method;
7. merchandise revenue excludes delivery fee;
8. delivery fees aggregate separately in R$;
9. discounts/surcharges use authoritative order fields;
10. A receber do período uses selected order population;
11. open table-tab/comanda not exposed as standalone receivable;
12. pending count reconciles with pending amount;
13. overdue/in-day/future promise buckets follow official dates;
14. refund series uses movement_date;
15. same filters produce consistent sales series/summary.

Frontend prove:

- tabs and cards;
- sales vs received distinction;
- payment mix;
- A receber do período decomposition;
- drill-down trigger;
- `Gerenciar em A receber` calls navigation only;
- no payment dialog/import;
- no payments.receive requirement for viewing Reporting;
- export hidden/disabled without reports.export.

## GREEN

Implement and ensure Reporting domain does not import Finance UI internals.

Navigation to A Receber uses public app navigation, not direct Finance mutation/workflow imports.

Commit:

`feat: add sales and receivables reporting`

## Acceptance

- A Receber remains the only action surface.
- Reporting remains read-only.
- Split payments accurate.

---

# Task 6 — Product analytics and deterministic merchandise allocation

**Purpose:** reconciliar itens históricos sem contaminar produto com entrega.

## Files

Create:

- `worker/reporting/productRevenue.js`
- `worker/reporting/productRevenue.test.js`
- `src/domains/reporting/ui/views/ProductsReport.jsx`
- product reporting UI tests

Modify:

- repository/service/api + tests

## RED — allocation

Prove in integer cents:

1. no adjustment;
2. fixed discount;
3. percent discount as persisted effective totals;
4. surcharge;
5. delivery fee excluded;
6. multiple lines;
7. quantity > 1;
8. rounding remainder;
9. deterministic tie breaker;
10. allocated sum = merchandise revenue exactly;
11. zero/invalid base never invents value;
12. cancelled order excluded.

## RED — product identity

Prove:

- product_id groups historical same product;
- renamed snapshot does not split known product id;
- missing product_id uses deterministic snapshot fallback;
- two unknown products are not silently merged by vague text;
- category_snapshot used;
- size_snapshot used;
- current catalog edit does not rewrite history;
- Refeições + legacy Marmita both count;
- other category does not count as Refeição.

## RED — product view

Prove:

- units;
- Top 10;
- full ranking;
- merchandise revenue;
- category;
- size/presentation;
- share;
- previous period;
- growth/decline;
- product drill-down query.

## GREEN

Implement allocation as pure Worker module.

No float authority for cent distribution.

Commit:

`feat: add product reporting analytics`

## Acceptance

- Product totals reconcile to merchandise revenue.
- Delivery fee remains outside products.
- Snapshot history preserved.

---

# Task 7 — Detail endpoint, server pagination and drill-down

**Purpose:** tornar todo agregado investigável.

## Files

Create/Modify:

- detail repository/service/API tests
- `src/domains/reporting/ui/views/DetailReport.jsx`
- `src/domains/reporting/ui/detail/ReportingOrderDrawer.jsx`
- detail UI tests

Potential endpoint:

`GET /api/reporting/orders/:id`

Only add it if list row payload is insufficient for the approved drawer. It remains read-only.

## RED — backend

Prove:

- total count independent from page;
- page 1/2 stable;
- deterministic tie-break by id/order number;
- page size allowlist;
- sort allowlist;
- search;
- status;
- modality;
- payment method;
- product/category;
- customer;
- deadline;
- hour;
- cross-business id cannot load detail;
- selected row detail only from same business;
- split-payment presentation;
- active/cancelled/pending states;
- no open-comanda standalone receivable lie.

## RED — drill-down parity

For each:

- cancel KPI -> detail count equals KPI population;
- late KPI -> detail count equals late count;
- product -> detail contains exactly orders composing product;
- payment method -> detail corresponds to allocation-based association;
- receivable -> detail amount/count reconciles.

## RED — frontend

Desktop:

- search;
- filters;
- chips;
- clear;
- columns;
- sort;
- pagination;
- page size;
- loading/error/empty;
- selected row drawer;
- details are read-only.

Prove absence of:

- Registrar pagamento;
- Cancelar pedido;
- printing mutation unless explicitly approved later.

For this V1 drawer, do not add print/payment action from the mockup.

`Gerenciar em A receber` may navigate when row represents receivable.

## GREEN

Implement server pagination and URL-linked drill-down.

Commit:

`feat: add reporting detail drilldown`

## Acceptance

- Detail explains aggregates.
- No local filtering over a downloaded history.
- Read-only drawer.

---

# Task 8 — Canonical export model and CSV

**Purpose:** exportar exatamente o mesmo recorte sem duplicar regra.

## Files

Create/Modify:

- `worker/reporting/exportModel.js`
- `worker/reporting/exportModel.test.js`
- reporting API export tests
- `src/domains/reporting/export/csvExport.js`
- CSV tests
- export UI/menu tests

## RED

Prove:

1. reports.export required;
2. same normalized query;
3. same metric values as corresponding endpoint;
4. detail row count matches filtered population;
5. column selection respected;
6. 10.000 rows accepted;
7. >10.000 fails explicit functional error;
8. no silent truncation;
9. UTF-8/PT-BR headers;
10. currency/date values round-trip as expected;
11. filters recorded in metadata;
12. unavailable metric remains unavailable;
13. cross-business isolation.

## GREEN

Implement canonical export model in backend.

CSV serializer consumes export model only.

Do not let CSV call Dashboard helpers.

Commit:

`feat: add reporting csv export`

## Acceptance

- CSV parity proved.
- Export limit explicit.
- No new dependency.

---

# Task 9 — XLSX and PDF exports

**Purpose:** completar formatos executivos sem afetar o core.

## Dependency decision

XLSX planned library:

`exceljs`

Execution gate before adding:

- verify current package version;
- verify license in installed package;
- inspect dependency tree;
- measure Vite build impact;
- use dynamic import;
- abort dependency addition if bundle/runtime impact is unacceptable and return to plan review.

PDF:

reuse existing `jspdf` with dynamic import where practical.

## Files

Create:

- `src/domains/reporting/export/xlsxExport.js`
- `src/domains/reporting/export/xlsxExport.test.js`
- `src/domains/reporting/export/pdfExport.js`
- `src/domains/reporting/export/pdfExport.test.js`

Modify:

- `package.json` / lockfile only for approved XLSX dependency
- export UI tests

## RED — XLSX

Require:

- workbook opens;
- Resumo sheet;
- Dados sheet;
- PT-BR human labels;
- numeric currency cells;
- date cells/format;
- selected filters;
- split payment text generated from model;
- no hidden extra rows;
- row count parity.

## RED — PDF

Require semantic model tests for:

- title/operation;
- period;
- filters;
- generatedAt;
- main KPIs;
- comparison;
- quality warning;
- summary charts/tables represented from official model;
- no hundreds of detail lines;
- no recalculation.

Avoid screenshot-based PDF regression as the sole correctness proof.

## GREEN

Implement dynamic-loaded exporters.

Run build and compare output size.

Record dependency/bundle evidence in execution ledger.

Commit:

`feat: add reporting xlsx and pdf exports`

## Acceptance

- all three export formats use same model;
- dependency decision evidenced;
- no metric divergence.

---

# Task 10 — Mobile summary experience

**Purpose:** entregar valor mobile sem replicar a estação desktop.

## Files

Create/Modify:

- `src/domains/reporting/ui/mobile/ReportingMobileSummary.jsx`
- mobile tests
- `reporting.css`
- responsive/accessibility tests

## RED

At 320px and representative mobile width, prove:

- no structural horizontal overflow;
- period control usable;
- filter button opens sheet/modal;
- active filters visible;
- overview KPIs readable;
- comparison readable;
- one simple sales trend accessible;
- Top products readable;
- operation/sales summary readable;
- detail drill-down uses cards/list where supported;
- no desktop table compressed;
- no column selector;
- dense desktop-only feature displays clear guidance;
- A Receber action navigates out;
- no payment mutation appears;
- touch targets preserve project standard.

## GREEN

Implement mobile-specific composition using same API data.

Do not create separate metric queries/formulas.

Commit:

`feat: add compact mobile reporting experience`

## Acceptance

- mobile is useful, not a shrunken desktop;
- same truth source;
- 320px safe.

---

# Task 11 — Performance, query plans, indexes and architecture hardening

**Purpose:** medir antes de otimizar e impedir regressão de ownership.

## Files

Create:

- reporting performance/query-plan tests or scripts under existing infra conventions
- architecture fixtures/tests

Potential migration only if proved necessary:

`migrations/0030_reporting_indexes.sql`

Use `0030` only if it remains the next free number at execution time. If master gains a migration, use the next free number.

## RED / audit

Use representative SQLite fixture volume.

For critical queries record `EXPLAIN QUERY PLAN`:

- overview sales;
- receipt aggregation;
- payment allocation mix;
- product ranking;
- detail pagination/count.

Measure:

- no full cross-business scan;
- indexed access where justified;
- detail does not N+1;
- export bounded.

Architecture RED fixtures must prove checker rejects:

- outside deep import into Reporting internals;
- Reporting deep import into Orders/Finance/Catalog internals;
- Reporting frontend import of Worker;
- App passing official collections to Reporting;
- Reporting UI calculating metric formulas directly;
- domain cycles.

## GREEN

Only after evidence, add the minimal D1 index migration.

Do not add materialized tables.

Run:

`npm run d1:migrate:local`  
`node scripts/infra/spec-b-d1-gate.mjs`  
`npm run test:architecture`  
`npm test`  
`npm run lint`  
`npm run build`

Commit:

`perf: harden reporting queries and boundaries`

If no index is needed, commit only architecture/performance evidence/tests; do not create empty migration.

## Acceptance

- measured query plan documented;
- no speculative schema;
- boundaries permanent.

---

# Task 12 — Visual polish, theme, accessibility and state matrix

**Purpose:** alinhar o produto aos mockups aprovados sem copiar elementos fictícios.

## Files

Modify reporting UI/CSS/tests only, plus shared UI extraction if justified.

## Required visual contract

Desktop should follow approved direction:

- finance area nav;
- report header;
- filters;
- internal tabs;
- KPI grids;
- charts;
- product ranking;
- detailed desktop table;
- export menu.

Do not copy fictitious mockup items such as:

- Marketing;
- Estoque;
- Cardápio rename;
- fake store selector;
- fake user;
- fake realtime badge;
- invented metrics.

## RED

Automated/static/accessibility tests for:

- light/dark tokens;
- focus visible;
- keyboard tabs;
- labels;
- not color-only trends;
- skeleton structure;
- empty;
- unavailable;
- partial error;
- export error;
- long PT-BR labels;
- monetary width;
- reduced viewport;
- no hard-coded brand colors when semantic token exists.

## GREEN

Apply Mesiva v1.0 through existing tokens/components.

No parallel design system.

Commit:

`style: polish reporting center experience`

## Acceptance

- desktop matches approved design direction;
- mobile matches approved summary direction;
- both themes;
- accessible states.

---

# Task 13 — Final candidate, staging and manual homologation

**Purpose:** fechar a feature candidate sem merge automático.

## Documentation

Create/update:

- `docs/superpowers/qa/reporting-center-execution.md`
- `docs/superpowers/qa/reporting-center-qa.md`
- Issue #34 body/status
- PR body

## Automated final gates

Run on exact feature HEAD:

- focused Reporting suites;
- `npm test`;
- `npm run test:architecture`;
- `npm run lint`;
- `npm run build`;
- Worker production dry-run;
- Worker staging dry-run;
- `npm run d1:migrate:local`;
- Spec B D1 gate;
- clean diff audit.

Verify no unrelated changes to:

- QZ;
- print queue;
- Kitchen TV;
- payment mutation;
- comanda mutation.

## Staging

Deploy only after automated candidate green.

Record exact staging SHA/run.

## Manual QA matrix

### Navigation

1. Desktop Financeiro -> Relatórios.
2. Direct `/relatorios`.
3. F5.
4. Back/Forward.
5. reduced capability behavior.
6. denied user.

### Filters

7. default current month.
8. today.
9. 7 days.
10. 30 days.
11. prior month.
12. custom.
13. modality.
14. schedule.
15. category/product.
16. payment method.
17. URL sharing/reopen.

### Overview

18. sales.
19. orders.
20. ticket.
21. received.
22. A receber do período.
23. cancellation.
24. refunds.
25. deadline compliance.
26. comparison.

### Operation

27. mean.
28. median.
29. P90.
30. modality.
31. hour.
32. weekday.
33. deadline.
34. scheduled.
35. legacy/quality state.

### Sales

36. sales vs receipt distinction.
37. split payment mix.
38. delivery fees R$.
39. adjustments.
40. pending decomposition.
41. Gerenciar em A receber navigates correctly.
42. no payment action inside Reporting.

### Products

43. Top 10.
44. Refeições.
45. category.
46. size/presentation.
47. product revenue.
48. product drill-down.

### Detail

49. pagination.
50. sort.
51. columns.
52. search.
53. filter chips.
54. clear.
55. drawer read-only.
56. drill-down parity.

### Exports

57. CSV.
58. XLSX.
59. PDF.
60. filters match.
61. over-limit behavior.

### Responsive/theme

62. desktop light.
63. desktop dark.
64. mobile summary light.
65. mobile summary dark.
66. 320px.
67. mobile no compressed table.

### Regression

68. A Receber still receives payment normally.
69. split payment still works normally.
70. open comanda remains outside A Receber.
71. Dashboard unchanged functionally unless an explicitly approved follow-up changed it.
72. Cozinha unaffected.
73. Printing unaffected.

Every row must end PASS / FAIL / BLOCKED with evidence.

## Stop condition

After final QA:

- update docs to actual state;
- set PR ready only if appropriate;
- do not merge until explicit authorization;
- do not deploy production.

Commit final docs only after evidence:

`docs: record reporting center homologation`

---

## 14. Dashboard migration is explicitly deferred

This plan does not require migrating the current Dashboard to Reporting in Tasks 1–13.

After Reporting is homologated, create a separate follow-up decision:

- compare Dashboard metrics against Reporting;
- if parity proven, migrate Dashboard incrementally to a Reporting summary endpoint;
- remove client-side duplicated formulas only after no legitimate consumer remains.

Do not enlarge Issue #34 implementation risk by coupling that migration to the first delivery.

---

## 15. Commit / PR discipline

For each task:

1. focused RED;
2. commit/push RED when it proves a real missing behavior;
3. observe exact-SHA CI where practical;
4. minimal GREEN;
5. related regressions;
6. commit/push GREEN;
7. full Validate;
8. update execution evidence only with actual results.

Do not manufacture RED by breaking a test harness/parser.

Do not rewrite history/force push to hide a bad RED.

Do not claim a run validates a SHA unless it really does.

---

## 16. Auto-review performed on this plan

The plan was reviewed against the approved spec and current master architecture.

### Findings resolved before approval request

- Reporting does not consume bootstrap collections.
- Reporting remains read-only.
- A Receber remains the payment surface.
- `A receber do período` is explicitly scoped.
- open comanda is protected from receivable misclassification.
- no `preparation_started_at` appears as implementation work.
- timing uses shared canonical rules.
- split-payment analysis uses receipts/allocations.
- product revenue excludes delivery fee.
- deterministic cents allocation has its own task/tests.
- detail pagination is server-side.
- URL is the Reporting query source of truth.
- mobile is intentionally reduced.
- no new bottom-nav item is introduced.
- CSV/XLSX/PDF use one export model.
- XLSX dependency addition has an explicit execution gate and dynamic import.
- indexes are evidence-driven.
- migration number is conditional on the next free slot.
- mockup-only fictitious menu/user/store/realtime elements are explicitly forbidden.
- Dashboard migration is deferred.
- staging is late in the sequence.
- merge and production both remain separately authorized.

### Remaining approval gate

No application code should be changed until the user explicitly approves this plan.

---

## 17. Definition of complete

Issue #34 is implementation-complete only when:

- Tasks 1–13 are complete;
- all automated gates are green;
- staging is on exact documented SHA;
- QA rows 1–73 are PASS or an explicitly accepted non-production blocker;
- metrics reconcile across summary/detail/export;
- A Receber ownership is preserved;
- desktop/mobile contract is homologated;
- PR has no unresolved review thread;
- user explicitly authorizes merge.

Production is a later, separate action.
