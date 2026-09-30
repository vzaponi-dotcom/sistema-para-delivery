# Gestão Delivery — Agendamento multi-dia e reservas de mesa — Implementation Plan

> **Execution mode:** executar task por task, sempre RED → GREEN, com evidência por SHA exato. Nenhuma implementação começa antes da aprovação explícita deste plano.

**Status:** APPROVED FOR EXECUTION — aprovado pelo usuário em 2026-09-29; execução autorizada task por task, sem produção
**Feature:** Issue #82 — Agendamento multi-dia e reservas de mesa
**Spec aprovada:** `docs/superpowers/specs/2026-09-29-multiday-scheduling-table-reservations-design.md`
**Branch documental:** `docs/issue-82-multiday-reservations`
**Implementation branch planejada:** `feature/issue-82-multiday-reservations`
**Master baseline confirmado:** `da81fb2be7a754f9296a54d9e44e82372341e20d`
**Spec checkpoint aprovado:** `254b9db8162159663905a93865bd44b05fec7577`
**Migrations atuais confirmadas:** até `0033_kitchen_tv_modality_filter.sql`
**Nova migration planejada:** `0034_table_reservations.sql`
**Produção:** proibida durante implementação/homologação sem autorização separada

---

## 1. Goal

Entregar a Issue #82 preservando a arquitetura atual:

- Entrega e Retirada podem ser agendadas para até 90 dias;
- Local pode ser criado como Reserva;
- reserva não abre comanda antes da chegada;
- reserva não ocupa mesa antes da chegada;
- conflitos de reserva são protegidos no backend;
- reserva Local pode ser editada antes da janela operacional;
- pedidos futuros não poluem cozinha/TV;
- impressão respeita a matriz aprovada;
- confirmar chegada converte atomicamente a reserva em comanda;
- cancelamento/no-show preservam o fluxo oficial de cancelamento;
- Comandas continua visualmente igual, apenas passa a mostrar reservas;
- mobile preserva header, cards e bottom nav atuais;
- Financeiro e Relatórios continuam coerentes;
- staging e QA vêm antes de merge;
- produção permanece separada.

---

## 2. Decisões fixas da spec

Estas decisões não devem ser reabertas durante implementação sem nova aprovação:

1. reserva é entidade `table_reservations`;
2. `orders.status` não recebe status `Reservada`;
3. reserva Local V1 exige pelo menos um item;
4. janela de conflito = 120 minutos persistidos por reserva;
5. `table_tab_id = NULL` enquanto reserva estiver `reserved`;
6. edição Local é permitida somente antes de `operational_start_at`;
7. Entrega/Retirada futuras não recebem edição completa nesta V1;
8. mesmo-dia Entrega/Retirada preserva impressão automática imediata;
9. outro-dia Entrega/Retirada espera a janela para autoimpressão;
10. Local reservado espera a janela para autoimpressão;
11. impressão manual antecipada continua disponível;
12. uma mesa pode estar Ocupada agora e ter reserva futura;
13. Comandas mostra somente a próxima reserva da mesa;
14. lista ampla fica em Pedidos / Próximos dias;
15. bootstrap não carrega 90 dias completos de reservas;
16. no-show é ação humana, não cron;
17. no-show usa motivo oficial de cancelamento;
18. não criar capability nova;
19. não fazer redesign geral do app.

---

## 3. Global constraints

- Nunca implementar na `master`.
- Re-fetch da master antes de criar a feature branch.
- Se a master avançar, investigar drift antes de alterar código.
- Revalidar que a próxima migration continua sendo `0034`.
- Um único draft PR para a feature.
- TDD obrigatório: teste comportamental primeiro, falha esperada comprovada, mínimo GREEN.
- Não contar erro de parser/import/fixture como RED válido.
- Commits pequenos por task.
- Não usar fallback de produção para schema ausente.
- Não aceitar `business_id` vindo do browser.
- Toda mutação deve ser business-scoped.
- Toda regra crítica precisa de validação backend.
- Não duplicar timing fora de `shared/orderTiming.js`.
- Não duplicar print context fora dos contratos atuais.
- Não alterar lifecycle de comanda além do necessário para conversão da reserva.
- Não introduzir segundo runtime de sync.
- Não carregar lista de reservas futuras no bootstrap global.
- Não criar nova biblioteca de UI.
- Não substituir a navegação atual.
- Não alterar identidade visual global.
- Não fazer deploy de produção.
- Não fazer merge sem autorização explícita.

---

# Execution preparation — somente após aprovação deste plano

- [ ] Re-fetch `master`.
- [ ] Confirmar HEAD `da81fb2...` ou investigar todos os commits novos.
- [ ] Revalidar migrations até `0033`; se houver `0034`, renumerar antes do primeiro RED.
- [ ] Confirmar branch documental no SHA contendo spec aprovada + plano aprovado.
- [ ] Criar `feature/issue-82-multiday-reservations` a partir do HEAD documental aprovado.
- [ ] Criar um único draft PR para `master`.
- [ ] Registrar PR number, base SHA e head SHA.
- [ ] Rodar baseline:
  - `npm test`;
  - `npm run test:architecture`;
  - `npm run lint`;
  - `npm run build`;
  - `npm run d1:migrate:local`;
  - Worker production dry-run;
  - Worker staging dry-run.
- [ ] Se baseline não estiver verde, investigar antes do primeiro RED.
- [ ] Criar `docs/superpowers/qa/issue-82-reservations-execution.md`.
- [ ] Criar `docs/superpowers/qa/issue-82-reservations-qa.md` apenas com estados reais.
- [ ] Não publicar staging na preparação.

---

# Task 1 — Migration e invariantes de `table_reservations`

**Purpose:** criar a entidade durável de reserva e proteção de overlap no banco.

## Files

**Create**
- `migrations/0034_table_reservations.sql`
- `worker/tableReservationsMigration.test.js`

## RED

Criar testes que exijam:

- tabela `table_reservations`;
- FKs/relacionamentos com business, order, table e converted table tab;
- `business_id + order_id` único;
- status allowlist: reserved / converted / cancelled / no_show;
- `duration_minutes > 0`;
- `scheduled_for < ends_at`;
- índices definidos na spec;
- trigger de overlap em INSERT de `reserved`;
- trigger de overlap em UPDATE que mova horário/mesa/status para `reserved`;
- borda `20:00–22:00` + `22:00–00:00` permitida;
- `21:59` bloqueada;
- reserva cancelled/no_show/converted não participa do conflito;
- clean install e upgrade preservam dados existentes.

**Run**
`node --test worker/tableReservationsMigration.test.js`

**Expected RED:** tabela/trigger ainda inexistentes.

## GREEN

Implementar somente schema, índices e triggers.

Erro de trigger deve usar token estável identificável, por exemplo:

`TABLE_RESERVATION_CONFLICT`

Não criar código de runtime ainda.

## Verify

- teste focado;
- `npm run d1:migrate:local`;
- `git diff --check`.

## Commit

`feat: add table reservation persistence`

---

# Task 2 — Domínio compartilhado de agendamento até 90 dias

**Purpose:** substituir a regra “mesmo dia” por um contrato único e testável.

## Files

**Modify**
- `shared/orderTiming.js`
- `shared/orderTiming.test.js`
- `worker/orderCheckout.js`
- `worker/orderCheckout.test.js` ou suíte equivalente existente

## RED

Cobrir:

- Entrega agendada hoje;
- Retirada agendada amanhã;
- 90º dia aceito;
- 91º dia rejeitado;
- passado rejeitado;
- `orderDate` diferente da data operacional de `scheduledFor` rejeitado;
- Local com schedule passa a ser elegível;
- Local Agora continua válido;
- backdated + scheduled rejeitado;
- cálculo em `America/Sao_Paulo` por dia de calendário, não 90×24h bruto;
- `businessDateTimeToIso` continua correto;
- timing operacional continua usando a mesma fórmula atual.

Introduzir helper compartilhado com contrato equivalente a:

`validateOrderSchedule({ type, orderDate, scheduledFor, now, maxDays })`

ou nome equivalente claro.

## GREEN

- remover dependência funcional de `isFutureSameDaySchedule`;
- manter compat export somente se ainda houver consumidor temporário durante a task e removê-lo até o final da feature;
- `validateCheckoutInput` aceita schedule futuro dentro da faixa;
- Local agendado deixa de falhar por modalidade.

Ainda não criar reserva/comanda aqui.

## Verify

`node --test shared/orderTiming.test.js worker/orderCheckout.test.js`

## Commit

`feat: allow multiday order scheduling`

---

# Task 3 — Read model e repositório de reservas

**Purpose:** criar ownership backend isolado para leitura/projeção de reservas antes das mutações complexas.

## Files

**Create**
- `worker/tableReservationRepository.js`
- `worker/tableReservationRepository.test.js`

**Modify**
- `worker/orderReadSql.js`
- `worker/repositories.js` apenas no mapeamento/read model necessário
- `worker/orderReadRepository.test.js`
- `worker/tableRepository.js`
- `worker/tableRepository.test.js`

## RED

Exigir helpers que:

- mapeiam `table_reservations`;
- carregam por id business-scoped;
- carregam por order id;
- listam por status/from/to/tableId;
- retornam próxima reserva `reserved` por mesa;
- retornam itemCount/totalCents/clientName sem carregar todas as reservas no bootstrap;
- expõem no Order read model:
  - `tableReservationId`;
  - `tableReservationStatus`;
  - `reservationTableId`;
  - `reservationTableName`;
  - `reservationRevision`;
- Order Local reservado mantém `tableTabId = null`;
- `listTables` expõe `nextReservation` sem mudar `occupancy`.

## GREEN

Implementar SQL business-scoped e projections.

`occupancy` continua estritamente:
- occupied se comanda open;
- free caso contrário.

`nextReservation` é campo paralelo.

## Verify

`node --test worker/tableReservationRepository.test.js worker/tableRepository.test.js worker/orderReadRepository.test.js`

## Commit

`feat: expose table reservation read models`

---

# Task 4 — Guards de mesa com reserva ativa

**Purpose:** impedir rename/desativação que invalidaria snapshot/documento da reserva.

## Files

**Modify**
- `worker/tableRepository.js`
- `worker/tableRepository.test.js`
- `src/domains/table-service/ui/Tables.jsx`
- `src/domains/table-service/ui/Tables.test.js` ou teste existente equivalente

## RED

Backend:

- rename de mesa com reserva `reserved` → 409;
- deactivate de mesa com reserva `reserved` → 409;
- reordenação continua permitida;
- converted/cancelled/no_show não bloqueiam;
- mesa ocupada continua obedecendo regras existentes.

Frontend:

- bloqueio é explicado, não silencioso;
- estado atual Livre/Ocupada permanece;
- próxima reserva pode ser apresentada como informação secundária se a tela já tiver espaço, sem redesign.

## GREEN

Adicionar erro estável:

`TABLE_HAS_ACTIVE_RESERVATION`

Sem alterar os contratos atuais de transferência.

## Verify

testes focados + architecture.

## Commit

`feat: protect tables with active reservations`

---

# Task 5 — Checkout de Reserva Local sem abrir comanda

**Purpose:** integrar Local + scheduled ao createOrder de forma atômica.

## Files

**Modify**
- `worker/repositories.js`
- `worker/orderRepositories.test.js`
- `worker/multiItemCheckoutRepository.test.js`
- `worker/businessPolicyIntegration.test.js`
- `worker/index.js`
- testes HTTP de order checkout existentes

**May create if extraction is needed**
- `worker/orderReservationCreation.js`
- `worker/orderReservationCreation.test.js`

## RED

Provar:

- Local Agora em mesa livre ainda abre comanda;
- Local Agora em mesa ocupada ainda reutiliza comanda;
- Local scheduled:
  - valida mesa ativa;
  - não lê/reutiliza comanda como destino;
  - não cria `table_tabs`;
  - persiste order com `table_tab_id = NULL`;
  - persiste `table_reservations` em `reserved`;
  - persiste duration 120 e ends_at;
  - mantém customer identity `table`;
  - cliente opcional permanece opcional;
  - paymentAllocations continuam proibidas;
  - resposta retorna `reservation`;
  - resposta retorna `tables` atualizadas com `nextReservation`;
- conflito de reservation aborta tudo:
  - zero order parcial;
  - zero item parcial;
  - zero job parcial;
- idempotency-key repetida retorna a mesma order/reservation;
- expectedTableTabId + Local scheduled é rejeitado.

## GREEN

No caminho Local scheduled:

- validar a mesa;
- não criar `pendingTableTab`;
- criar order + items + reservation no mesmo `db.batch`;
- preservar guards de policy;
- traduzir trigger para `409 TABLE_RESERVATION_CONFLICT`.

Não implementar edição ainda.

## Verify

Testes focados do Worker e HTTP.

## Commit

`feat: create local table reservations at checkout`

---

# Task 6 — Matriz de impressão para multi-dia e reservas

**Purpose:** implementar exatamente a matriz aprovada, sem regressão do mesmo-dia atual.

## Files

**Modify**
- `worker/repositories.js`
- `worker/orderAutomaticPrintJob.test.js`
- `worker/printContextPolicy.test.js`
- `shared/orderPrintDocument.js`
- `shared/orderPrintDocument.test.js` se existente
- `worker/orderPrintingRepository.js` somente se necessário ao manual/edit posterior

## RED

Casos:

1. Agora → `available_at = created_at`;
2. Entrega/Retirada agendada hoje → `created_at`;
3. Entrega/Retirada outro dia → `operational_start_at`;
4. Local reserva, inclusive hoje → `operational_start_at`;
5. copies_requested continua usando contexto atual:
   - reserva Local usa default de mesa;
6. impressão automática desligada não cria job;
7. nenhum job antigo é alterado por migration;
8. documento de reserva mostra:
   - RESERVA/AGENDADO;
   - mesa;
   - data;
   - horário;
   - cliente opcional;
9. manual print continua possível sem alterar auto job.

## GREEN

Centralizar uma função clara de resolução de `availableAt`, sem espalhar conditionals.

Não mexer no runner, segunda via ou QZ além do necessário para o documento.

## Verify

`node --test worker/orderAutomaticPrintJob.test.js worker/printContextPolicy.test.js shared/orderPrintDocument.test.js`
(adaptar ao nome real da suíte existente)

## Commit

`feat: schedule printing for future reservations`

---

# Task 7 — API/read de reservas + bootstrap leve

**Purpose:** criar endpoints próprios e impedir bootstrap inflado.

## Files

**Create**
- `worker/tableReservationApi.js`
- `worker/tableReservationApi.test.js`

**Modify**
- `worker/index.js`
- `worker/repositories.js` bootstrap somente se necessário
- `worker/index.test.js`
- `worker/tableRepository.js`

## RED

Exigir:

- `GET /api/table-reservations?status=&from=&to=&tableId=`;
- `GET /api/table-reservations/:id`;
- 404 cross-business;
- filtros validados;
- detalhe contém order + reservation + print metadata necessária;
- bootstrap não contém coleção `tableReservations`;
- bootstrap tables contém apenas `nextReservation`;
- payload permanece compatível sem reservas.

## GREEN

`worker/index.js` delega para `handleTableReservationApi`, como Reporting/Printing.

Não colocar SQL de reserva diretamente no index.

## Verify

HTTP tests + bootstrap regression.

## Commit

`feat: add table reservation read api`

---

# Task 8 — Cancelamento acoplado e no-show

**Purpose:** garantir que pedido e reserva nunca divergem.

## Files

**Modify**
- `worker/orderCancellation.js`
- `worker/orderCancellation.test.js`
- `worker/tableReservationRepository.js`
- `worker/tableReservationApi.js`
- `worker/tableReservationApi.test.js`
- `worker/index.js`

## RED

Cancelar pedido associado a reservation `reserved`:

- order → Cancelado;
- reservation → cancelled;
- `cancelled_at` preenchido;
- job automatic pending removido;
- trigger de conflito deixa de considerar a reserva;
- tudo no mesmo compromisso.

Cancelar por endpoint da reserva:

- usa política oficial;
- expected revision validada;
- produz o mesmo efeito.

No-show:

- exige payload de cancel reason/revision;
- order → Cancelado;
- reservation → no_show;
- `no_show_at`;
- não abre comanda;
- não cria ticket novo;
- não pode ser chamado em converted/cancelled/no_show.

Race:

- duas ações concorrentes resultam em um estado terminal, nunca dupla transição.

## GREEN

Extrair somente a parte necessária para que `cancelOrder` possa receber uma disposição interna da reservation, sem duplicar a política de cancelamento.

## Verify

cancel/refund regressions incluídas.

## Commit

`feat: synchronize reservation cancellation lifecycle`

---

# Task 9 — Confirmar chegada e converter em comanda

**Purpose:** realizar a conversão autoritativa, atômica e idempotente.

## Files

**Create**
- `worker/tableReservationArrival.js`
- `worker/tableReservationArrival.test.js`

**Modify**
- `worker/tableReservationApi.js`
- `worker/tableReservationApi.test.js`
- `worker/tableRepository.js` apenas reaproveitamento de numeração/guards
- `worker/index.js`

## RED

Cobrir:

- reservation reserved + data atual → sucesso;
- antes do dia agendado → `TABLE_RESERVATION_CONFIRM_TOO_EARLY`;
- mesa inexistente/inativa → falha;
- mesa com comanda open → `TABLE_OCCUPIED`;
- reservation revision stale → `TABLE_RESERVATION_CHANGED`;
- cria exatamente um table_tab;
- vincula `orders.table_tab_id`;
- reservation → converted;
- `converted_table_tab_id`/converted_at;
- order Em preparo continua Em preparo;
- order Finalizado continua Finalizado;
- order Cancelado não converte;
- retry com mesma mutation/idempotency key retorna mesma comanda;
- retry/double-click não reserva segundo tab_number;
- tabela listada volta ocupada;
- nextReservation recalculada para a próxima.

## GREEN

Usar guards + unique constraint + batch.

Lacuna eventual no contador de comanda em corrida é aceitável; número nunca é reutilizado.

## Verify

arrival tests + table lifecycle regressions.

## Commit

`feat: convert table reservation on arrival`

---

# Task 10 — Edição backend da reserva

**Purpose:** editar snapshot antes da janela com optimistic concurrency e repricing.

## Files

**Create**
- `worker/tableReservationUpdate.js`
- `worker/tableReservationUpdate.test.js`

**Modify**
- `worker/tableReservationApi.js`
- `worker/tableReservationApi.test.js`
- `worker/tableReservationRepository.js`
- `worker/orderPrintingRepository.js` se necessário
- `shared/orderPrintDocument.js`

## RED

Exigir:

- só `reserved`;
- `now < operational_start_at`;
- expectedRevision obrigatório;
- mudar cliente opcional;
- mudar mesa;
- mudar data/horário;
- mudar itens;
- mudar notas;
- mudar ajustes conforme permissão/policy;
- repricing pelo catálogo vigente;
- produto inativo falha sem parcial;
- conflito de mesa/horário falha sem parcial;
- revision stale falha sem parcial;
- revision incrementa uma vez;
- order id e order_number permanecem;
- `order_date` acompanha a nova data;
- `scheduled_for` acompanha;
- reservation `scheduled_for/ends_at/table_id/snapshot` acompanha;
- items são substituídos atomicamente;
- total recalculado;
- job automático pending:
  - mantém id;
  - mantém copies_requested;
  - atualiza document;
  - atualiza available_at;
- job discarded não renasce;
- ausência de auto job não cria backfill;
- manual print anterior aparece como metadata/flag para UX;
- edição após janela → `TABLE_RESERVATION_NOT_EDITABLE`.

## GREEN

Implementar endpoint `PUT /api/table-reservations/:id`.

Não criar histórico completo de versões.

## Verify

update tests + print regression + policy race.

## Commit

`feat: edit pending table reservations`

---

# Task 11 — Frontend infrastructure e application boundary de reservas

**Purpose:** criar contratos de frontend sem colocar fluxo inteiro no App.

## Files

**Create**
- `src/domains/table-service/domain/tableReservation.js`
- `src/domains/table-service/domain/tableReservation.test.js`
- `src/domains/table-service/infrastructure/tableReservationApi.js`
- `src/domains/table-service/infrastructure/tableReservationApi.test.js`
- `src/domains/table-service/application/useTableReservationDetail.js`
- `src/domains/table-service/application/useTableReservationDetail.test.js`
- `src/domains/table-service/application/useTableReservationCommands.js`
- `src/domains/table-service/application/useTableReservationCommands.test.js`

**Modify**
- `src/domains/table-service/index.js`
- architecture tests/checker only if a permanent boundary rule is required

## RED

Provar:

- API paths/methods/payloads;
- detail owner ignores stale responses;
- command guards capabilities/writesBlocked;
- edit/arrival/cancel/no-show apply official responses;
- 409 refreshes official state where necessário;
- public entry é deliberado;
- Table Service não deep-importa Orders;
- Orders continua consumindo Table Service somente pelo public index.

## GREEN

Manter coordenação cross-domain no App/surface composition, não dentro do domain.

## Verify

focused tests + `npm run test:architecture`.

## Commit

`feat: add table reservation frontend boundary`

---

# Task 12 — Novo Pedido: multi-dia e modo Reservar

**Purpose:** habilitar criação no wizard atual sem criar uma tela paralela.

## Files

**Modify**
- `src/domains/orders/ui/NewOrder.jsx`
- `src/domains/orders/ui/components/NewOrderCustomerStep.jsx`
- `src/domains/orders/ui/components/NewOrderReviewStep.jsx`
- `src/domains/orders/domain/newOrderStepFlow.js`
- `src/domains/orders/domain/newOrderStepFlow.test.js`
- `src/domains/orders/domain/orderCart.js`
- `src/domains/orders/domain/orderCart.test.js`
- `src/domains/table-service/ui/LocalTableSelector.jsx`
- `src/domains/orders/ui/new-order.css`
- testes de NewOrder existentes

## RED

Criação:

- date max = hoje + 90;
- schedule mode continua Agora/Agendado para Entrega/Retirada;
- Local mostra Agora/Reservar;
- Local Reservar mantém mesa obrigatória;
- mesa ocupada pode ser selecionada para reserva futura;
- no modo Reservar, hint de “será adicionada à comanda aberta” não aparece;
- expectedTableTabId esconde/desabilita Reservar;
- schedule futuro válido permite avançar;
- 91º dia bloqueia;
- review mostra data + hora completa;
- payload Local reservado contém scheduledFor e não expectedTableTabId;
- payload Agora permanece idêntico ao atual;
- draft dirty/unload guard inclui data/schedule.

## GREEN

Reutilizar componentes atuais e tokens.

Sem redesign.

## Verify

NewOrder focused tests, desktop/mobile render characterization, architecture.

## Commit

`feat: add reservation mode to new order`

---

# Task 13 — Reutilizar wizard para Editar reserva

**Purpose:** editar reserva usando a mesma composição de Novo Pedido.

## Files

**Modify**
- `src/domains/orders/ui/NewOrder.jsx`
- `src/domains/orders/ui/NewOrderRoute.js`
- `src/domains/orders/application/useNewOrderDraft.js` somente se o controller precisar de modo
- `src/domains/orders/application/newOrderDraft.js`
- testes correspondentes
- `src/App.jsx` para composição/navigation apenas
- `src/domains/table-service/index.js` se necessário ao intent público

## RED

- abrir edit recebe snapshot oficial;
- fields vêm preenchidos;
- mode edit não POSTa /api/orders;
- Save chama reservation PUT com expectedRevision;
- orderId/number não mudam;
- Cancelar edição descarta draft, não cancela reservation;
- navigation guard funciona;
- stale revision mostra feedback e recarrega;
- manual print warning aparece antes do save quando flag presente;
- edit unavailable depois da janela;
- policy change continua tratada.

## GREEN

Introduzir um contrato de modo explícito em vez de conditionals espalhados:

~~~text
mode: 'create' | 'edit-reservation'
reservationContext: { id, orderId, expectedRevision, ... }
~~~

## Verify

draft/navigation tests + NewOrder tests.

## Commit

`feat: reuse order wizard for reservation editing`

---

# Task 14 — Comandas desktop/mobile com próxima reserva e detalhe

**Purpose:** incorporar reservas ao layout atual aprovado.

## Files

**Create**
- `src/domains/table-service/ui/TableReservationDetail.jsx`
- `src/domains/table-service/ui/TableReservationDetail.test.js`
- `src/domains/table-service/ui/ConfirmReservationArrivalDialog.jsx` se a composição exigir
- testes correspondentes

**Modify**
- `src/domains/table-service/ui/Comandas.jsx`
- `src/domains/table-service/ui/Comandas.test.js`
- `src/comandas.css`
- `src/comandas-table-list-polish.css`
- `src/App.jsx`
- `src/app/surfaces/table-service/TableServiceExternalActions.jsx` somente se necessário para intents cross-domain

## RED

Desktop/mobile:

- subtitle “mesas, comandas e reservas”;
- free sem reservation continua igual;
- free + nextReservation mostra Reservada;
- occupied sem reservation continua igual;
- occupied + nextReservation mantém Ocupada primário e mostra próxima reserva secundária;
- tocar comanda continua abrindo comanda;
- tocar reserva abre reserva;
- detalhe mostra mesa/cliente/data/hora/status/itens/total;
- Editar só antes da janela + capability;
- Confirmar chegada só quando permitido;
- Cancelar/no-show só com `orders.cancel`;
- não existe “Abrir comanda” que bypassa arrival;
- mobile preserva:
  - lista;
  - detalhe separado;
  - scroll restore;
  - focus restore;
  - bottom nav atual;
- Reservada não depende só da cor.

## GREEN

Usar badge azul/ciano apenas como estado semântico adicional; não recolorir a aplicação inteira.

## Verify

Comandas tests + mobile focus/layout characterizations + themes.

## Commit

`feat: show reservations in comandas`

---

# Task 15 — Pedidos / Cozinha / Próximos dias

**Purpose:** impedir poluição operacional e ainda dar acesso aos agendados futuros.

## Files

**Modify**
- `src/domains/orders/domain/kitchenQueue.js`
- `src/domains/orders/domain/kitchenQueue.test.js`
- `src/domains/orders/ui/Orders.jsx`
- testes de Orders
- possivelmente um novo componente:
  - `src/domains/orders/ui/components/FutureScheduledOrders.jsx`
  - teste correspondente
- CSS operacional apenas quando necessário

## RED

Queue model:

- agendado de amanhã não entra em `scheduled` operacional hoje;
- não entra nos counts;
- não entra late;
- agendado do dia ainda aparece;
- janela que cruza meia-noite entra em preparing quando operational_start_at chega;
- Local reservation segue igual.

UI:

- seção `Próximos dias` ordena por scheduledFor;
- mostra data + hora;
- cancelamento funciona;
- reserva Local elegível mostra Editar;
- Entrega/Retirada continuam sem Editar;
- search não contamina counters atuais;
- detail continua funcionando.

## GREEN

Separar explicitamente:
- operational today queue;
- future schedule list.

Não criar página de calendário.

## Verify

queue + Orders tests.

## Commit

`feat: separate future schedules from kitchen queue`

---

# Task 16 — Kitchen TV e arrivals/realtime regressions

**Purpose:** provar que 90 dias de pedidos não afetam TV/som antes da janela.

## Files

**Modify somente se os testes provarem necessidade**
- `src/kitchen-display/KitchenDisplayApp.jsx`
- testes da KitchenDisplay
- `src/domains/orders/application/useOrderArrivals.js`
- `src/domains/orders/domain/orderRealtime.js`
- testes correspondentes

A fonte principal continua `buildKitchenQueueModel`.

## RED / characterization

- pedido de amanhã não aparece na TV;
- reserva de 30 dias não aparece;
- counters não incluem futuros;
- quando entra na janela, aparece pela prioridade normal;
- som ocorre uma vez;
- abrir TV depois da transição não toca histórico;
- filtros Entrega/Retirada/Mesa continuam;
- reservation Local aparece como Local quando operacional;
- TV não ganha uma “agenda futura”.

## GREEN

Fazer o mínimo necessário.

## Verify

Kitchen TV domain + display tests.

## Commit

`fix: keep future schedules out of kitchen tv`

Se tudo já passar com Task 15, esta task pode ser **test-only**.

---

# Task 17 — Financeiro / A Receber

**Purpose:** impedir Local reservado sem table_tab de virar recebível avulso.

## Files

**Modify**
- `src/domains/finance/domain/receivables.js`
- `src/domains/finance/domain/receivables.test.js`
- testes de payment eligibility em Orders se necessário

## RED

- Local reserved com tableReservationId + tableTabId null não entra A Receber;
- não oferece pagamento standalone;
- converted + tableTabId continua excluído como comanda;
- cancelled/no_show excluídos;
- Entrega/Retirada futura unpaid continua upcoming;
- paga no cadastro não fica pending;
- forecast usa orderDate futura.

## GREEN

Criar predicado explícito de reservation order.

Não inferir somente por `type === 'Local'`.

## Verify

finance + order payment eligibility tests.

## Commit

`fix: keep pending reservations out of receivables`

---

# Task 18 — Relatórios e semântica temporal

**Purpose:** proteger analytics já implantados.

## Files

**Prefer regression-only**
- `worker/reporting/operationAnalytics.test.js`
- `worker/reporting/service.test.js`
- `worker/reporting/repository.test.js`
- frontend Reporting tests se necessário

**Modify production only if RED real proves gap.**

## RED / characterization

- pedido futuro conta em order_date futura;
- created_at antecipado não move a venda para o dia do cadastro;
- Local reserved classifica `scheduled`;
- type continua Local;
- operational duration usa operationalStartAt;
- cancelled/no_show não entra onde cancelados são excluídos;
- payment recebido antecipadamente usa data financeira real;
- filtros continuam reconciliando.

## GREEN

Mínimo necessário.

## Commit

`test: cover future schedules in reporting`
ou `fix: preserve reporting semantics for reservations` se houver alteração real.

---

# Task 19 — Arquitetura, contratos e regressões transversais

**Purpose:** fechar a implementação antes de staging.

## Required checks

- nenhuma deep import nova entre Orders e Table Service;
- App só compõe intents/workflows;
- reservation HTTP ownership está no domínio correto;
- Worker index delega;
- nenhum SQL em React;
- nenhum `TABLE_RESERVATION_*` tratado por string solta fora do boundary;
- sem nova capability;
- sem collection global `tableReservations`;
- sem fallback de schema;
- migration número correto;
- nenhum redesign acidental;
- nenhuma alteração de produção.

## Focused regression matrix

Rodar pelo menos:

- checkout;
- table management;
- table tab lifecycle;
- cancellation/refund;
- printing;
- split payments;
- NewOrder;
- Comandas;
- Kitchen queue;
- Kitchen TV;
- Receivables;
- Reporting;
- architecture.

## Full gates

- `npm test`
- `npm run test:architecture`
- `npm run lint`
- `npm run build`
- `npm run d1:migrate:local`
- Worker production dry-run
- Worker staging dry-run
- clean D1 install
- D1 upgrade path from pre-0034 fixture
- `git diff --check`

## Documentation

Atualizar:

- `docs/superpowers/qa/issue-82-reservations-execution.md`;
- `docs/superpowers/qa/issue-82-reservations-qa.md`;
- issue #82;
- PR body.

## Commit

`docs: prepare issue 82 reservation qa`

Parar antes de staging se qualquer gate estiver vermelho.

---

# Task 20 — Deploy staging

**Purpose:** publicar somente depois de todos os gates locais/CI verdes.

## Steps

- [ ] confirmar HEAD exato;
- [ ] aguardar Validate verde no SHA;
- [ ] aplicar migration de staging pelo workflow normal;
- [ ] deploy staging;
- [ ] confirmar login;
- [ ] confirmar deep links/assets;
- [ ] registrar run IDs e SHA;
- [ ] nenhuma produção.

Se migration/deploy falhar, parar e corrigir na task proprietária com RED correspondente.

---

# Task 21 — Homologação manual em staging

Executar QA guiado em blocos.

## Bloco A — Entrega/Retirada multi-dia

1. Agendar Entrega para hoje.
2. Agendar Retirada para hoje.
3. Agendar Entrega para amanhã.
4. Agendar Retirada no 90º dia.
5. Tentar 91º dia.
6. Tentar horário passado.
7. Confirmar pedido futuro em Próximos dias.
8. Confirmar que não aparece na cozinha/TV antes da janela.
9. Confirmar que aparece ao entrar na janela.

## Bloco B — Reserva Local

10. Reserva em mesa livre.
11. Reserva em mesa ocupada agora.
12. Confirmar que nenhuma comanda nova abre.
13. Confirmar occupancy inalterado.
14. Criar segunda reserva não conflitante.
15. Reproduzir conflito.
16. Confirmar card Reservada em Comandas.
17. Confirmar occupied + próxima reserva simultaneamente.

## Bloco C — Editar

18. Trocar item.
19. Trocar quantidade.
20. Trocar cliente.
21. Trocar mesa.
22. Trocar horário.
23. Forçar conflito.
24. Simular stale revision em duas sessões.
25. Confirmar bloqueio após janela.

## Bloco D — Impressão

26. Mesmo-dia Entrega/Retirada preserva impressão imediata.
27. Outro-dia fica pending indisponível até janela.
28. Local reservado fica pending até janela.
29. Impressão manual antecipada.
30. Edição após manual mostra aviso.
31. Edição atualiza auto job pending sem duplicar.
32. Cancelamento remove pending.
33. Duas vias preservadas.

Se não houver impressora física disponível:
- registrar casos físicos como BLOCKED-PHYSICAL;
- não fingir PASS;
- manter hard gate físico antes de produção se a mudança tocar comportamento real da estação.

## Bloco E — Chegada/comanda

34. Confirmar chegada.
35. Confirmar mesa Ocupada.
36. Confirmar comanda única.
37. Confirmar itens preservados.
38. Confirmar pedido Finalizado antes da chegada.
39. Double-click/retry.
40. Mesa ocupada no momento da chegada bloqueia.
41. Editar reserva para outra mesa e confirmar.

## Bloco F — Cancel/no-show

42. Cancelar reserva pelo detalhe.
43. Cancelar pelo pedido.
44. No-show com motivo.
45. Confirmar intervalo liberado.
46. Confirmar nenhuma comanda.

## Bloco G — Financeiro/Relatórios

47. Reserva não aparece A Receber.
48. Após conversão, pagamento ocorre pela comanda.
49. Entrega futura aparece upcoming.
50. Pedido futuro pago reconcilia financeiro.
51. Reporting data/filtros.
52. Timing operacional não conta antecedência.

## Bloco H — UX

53. desktop escuro;
54. desktop claro;
55. mobile lista;
56. mobile detalhe;
57. mobile edição;
58. mobile confirmar chegada;
59. F5;
60. deep link;
61. duas sessões;
62. teclado/foco;
63. touch targets;
64. sem overflow.

## Bloco I — TV

65. futuro ausente;
66. entrada na janela;
67. modalidade Mesa;
68. contadores;
69. prioridade;
70. overflow/layout atual preservado.

Atualizar QA em cada bloco, sem marcar PASS por inferência.

---

# Task 22 — Fechamento técnico

Somente depois de QA suficiente:

- [ ] consolidar PASS/FAIL/BLOCKED;
- [ ] corrigir FAILs na task proprietária;
- [ ] revalidar SHA final;
- [ ] rodar full gates no SHA final;
- [ ] atualizar issue #82;
- [ ] atualizar PR;
- [ ] confirmar unresolved review threads = 0;
- [ ] confirmar mergeability;
- [ ] confirmar migration clean/upgrade;
- [ ] confirmar staging no SHA final;
- [ ] confirmar produção NÃO deployada.

**STOP:** aguardar autorização explícita para merge.

Depois do merge:
- rodar Validate pós-merge;
- produção continua bloqueada até autorização separada e conclusão dos bloqueios físicos aplicáveis.

---

## 4. Suggested implementation ownership

### Shared

- schedule horizon/date semantics: `shared/orderTiming.js`;
- print document semantics: shared print document atual;
- não criar “reservation global utils” genérico sem necessidade.

### Worker

- `tableReservationRepository.js`: SQL/read projections;
- `tableReservationApi.js`: roteamento/HTTP;
- `tableReservationArrival.js`: conversão;
- `tableReservationUpdate.js`: edição;
- `orderCancellation.js`: acoplamento terminal;
- `repositories.js`: checkout somente onde já é owner da criação do pedido;
- `tableRepository.js`: nextReservation + guards de mesa.

### Frontend Orders

- schedule/create/edit wizard;
- future list / kitchen queue separation;
- order detail/cancel paths.

### Frontend Table Service

- reservation read/detail/commands;
- Comandas integration;
- visual de Reservada;
- intents de chegada/edição/cancelamento.

### App

Somente composição cross-domain:
- abrir wizard em create/edit;
- aplicar official effects;
- navigation;
- feedback;
- capabilities já existentes.

---

## 5. Auto-review do plano

A auto-revisão verificou os seguintes riscos:

### 5.1 Não abrir comanda no checkout de reserva

Task 5 força RED específico para zero `table_tabs` no cadastro.

### 5.2 Não depender só de SELECT para conflito

Task 1 exige trigger de overlap e Task 5 prova rollback total.

### 5.3 Não poluir bootstrap

Task 7 exige somente `nextReservation`.

### 5.4 Não quebrar impressão do mesmo dia

Task 6 fixa explicitamente o comportamento atual de Entrega/Retirada hoje.

### 5.5 Não duplicar job ao editar

Task 10 exige preservação do mesmo automatic pending job/copies.

### 5.6 Não transformar Comandas em calendário

Task 14 mostra apenas próxima reserva; Task 15 centraliza lista futura em Pedidos.

### 5.7 Não permitir pagamento avulso de Local reservado

Task 17 cobre o caso que hoje escaparia por `table_tab_id = NULL`.

### 5.8 Não criar corrida de duas comandas na chegada

Task 9 exige idempotência + unique guard.

### 5.9 Não reescrever frontend modularizado

Tasks 11–14 preservam public boundaries e mantêm App como composição.

### 5.10 Não marcar QA físico como PASS por automação

Task 21 mantém BLOCKED-PHYSICAL quando aplicável.

### 5.11 Migration pode colidir se master avançar

Execution preparation exige revalidar a numeração antes do RED.

### 5.12 Edição e policy races

Task 10 exige revision otimista e revalidação de catálogo/policies.

Não foram identificados bloqueios de planejamento restantes.

---

## 6. Approval gate

Este plano está pronto para revisão.

**Nenhum código de produção deve ser alterado até aprovação explícita deste plano.**

Após aprovação, iniciar somente a Execution preparation e depois a Task 1.
