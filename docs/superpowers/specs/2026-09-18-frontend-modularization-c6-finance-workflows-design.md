# Spec C6 — Finance and cross-domain payment workflows

**Data:** 2026-09-18  
**Status:** design consolidado; aguardando revisão escrita do usuário  
**Branch:** `feature/spec-c6-finance-workflows`  
**Base:** `master` em `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`  
**Base validation:** Validate application #1342 / run `35401628448` — SUCCESS  
**Produção:** não tocar nesta slice sem autorização separada

## 1. Objetivo

A C6 estabelece o domínio `finance` e remove do `App.jsx` a coordenação financeira e os workflows de pagamento/estorno que atravessam domínios.

A slice deve:

- criar um boundary explícito em `src/domains/finance/`;
- mover para Finance o ownership de Financeiro, A Receber, movimentos, saldo, projeções, categorias financeiras e catálogo/projeção de formas de pagamento;
- extrair pagamentos transversais para `src/app/workflows/payments/`;
- extrair o workflow de estorno somente onde a operação cruza Orders e Finance;
- remover o último bridge legado de pagamento do operational data runtime;
- migrar APIs financeiras e de pagamento para owners coerentes;
- reduzir `App.jsx` a composição e wiring, sem alterar UX, comportamento de negócio, sincronização ou contratos do Worker.

A C6 é uma refatoração arquitetural. Ela não introduz uma nova experiência financeira e não altera regras aprovadas anteriormente.

## 2. Resultado esperado

Ao final da C6:

1. `domains/finance` é o owner de regras, projeções, UI e APIs exclusivamente financeiras;
2. pagamentos de pedido e comanda são workflows de aplicação separados, não regras do App, Orders, Finance ou Table Service isoladamente;
3. estorno que cruza ciclo de pedido e efeito financeiro tem um workflow explícito;
4. o operational data runtime continua owner das coleções oficiais e do polling, mas não conhece "payment owners", tentativas ou reconciliação de pagamento;
5. `App.jsx` não contém refs/handlers de tentativa de pagamento, sincronização de pagamento de comanda, CRUD de movimento, saldo inicial, promessa de pagamento ou estorno;
6. os endpoints migrados deixam de ser exportados pelo `src/api/client.js`;
7. Finance não importa internals de Orders ou Table Service;
8. o bridge `operational data runtime payment-receipt bridge` é removido e architecture-enforced;
9. todos os comportamentos existentes permanecem observacionalmente equivalentes.

## 3. Base técnica validada

A base da C6 é o merge da C5:

`e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`

O merge foi produzido pelo PR #49 e validado em `master` pelo Validate application #1342 / run `35401628448`, com sucesso em:

- testes;
- architecture gate;
- lint;
- build;
- production Worker dry-run;
- staging Worker dry-run;
- local D1;
- Spec B D1 clean install/upgrade.

Nenhum deploy de produção ocorreu.

## 4. Restrições globais

A C6 deve preservar as regras da Spec C:

- não implementar diretamente em `master`;
- usar `feature/spec-c6-finance-workflows`;
- TDD RED → GREEN para boundaries comportamentais;
- backend/Worker permanece estável salvo mudança mínima indispensável para preservar contrato existente;
- não criar novo store oficial por domínio;
- backend/bootstrap continua fonte oficial;
- polling atual permanece;
- não introduzir Redux, Zustand, React Router, WebSocket/SSE ou microserviços;
- não redesenhar Financeiro, A Receber, diálogos ou navegação;
- não alterar regras de pagamento integral, estorno integral ou promessa de pagamento;
- produção só com autorização explícita separada.

## 5. Ownership do domínio Finance

`domains/finance` reúne o contexto financeiro existente:

- Financeiro / fluxo de caixa;
- A Receber;
- movimentos manuais;
- saldo inicial;
- cálculo de saldo;
- entradas e saídas;
- projeções e resumo de recebíveis;
- categorias financeiras;
- catálogo/projeção de formas de pagamento;
- apresentação financeira de recebimentos;
- regras financeiras puras relacionadas a estorno.

Pagamento não vira um domínio separado.

Operações de pagamento que modificam mais de um domínio pertencem à camada de workflows da aplicação.

## 6. Estrutura alvo

Estrutura conceitual:

```text
src/
  domains/
    finance/
      domain/
      application/
      infrastructure/
      ui/
      index.js

  app/
    workflows/
      payments/
        order-payment/
        table-tab-payment/
        paymentApi.js
      refunds/
        refundApi.js
        ...

    surfaces/
      ... composição cruzada quando Finance precisar apresentar UI de Orders

  app/runtime/data/
    useOperationalDataRuntime.js
```

A estrutura exata de arquivos será refinada no plano de implementação a partir do import graph real, mas os boundaries desta spec são normativos.

## 7. Regra anti-ciclo

C6 não pode criar um ciclo entre Finance e Orders.

Hoje A Receber consome helpers/UI de Orders, enquanto formas de pagamento pertencem conceitualmente a Finance e são consumidas por fluxos de Orders.

Logo:

- `domains/finance/**` não deve importar internals de `domains/orders/**`;
- `domains/finance/**` não deve importar internals de `domains/table-service/**`;
- composição que precise de contratos dos dois domínios fica em `app/**`;
- contratos públicos podem ser injetados por props/adapters quando necessário;
- helpers verdadeiramente genéricos podem permanecer/migrar para `shared`, mas somente quando forem de fato cross-domain.

Não mover lógica order-specific para `shared` apenas para esconder um ciclo.

## 8. Operational data runtime

O runtime continua responsável por:

- bootstrap;
- polling;
- coleções oficiais;
- sync guards;
- official revision;
- merge de efeitos oficiais;
- reset por sessão;
- proteção de reads concorrentes.

Ele não é responsável por semântica de pagamento.

### 8.1 Bridge atual a remover

Na base atual, `useOperationalDataRuntime` recebe `legacyBridges` e usa:

- `capturePaymentOwners`;
- `settlePaymentOwners`.

O App fornece esses callbacks através de `operationalLegacyBridges`.

Esse é o último bridge legado de pagamento criado durante C1.

A C6 deve removê-lo integralmente.

### 8.2 Estado final do runtime

Depois da C6:

- `useOperationalDataRuntime` não recebe `legacyBridges` para pagamentos;
- refresh/bootstrap não captura owners de pagamento;
- refresh/bootstrap não chama settlement específico de pagamento;
- o runtime continua publicando coleções oficiais;
- os workflows observam/consultam as coleções oficiais necessárias para sua própria reconciliação.

O runtime pode expor contratos genéricos já existentes como `getSyncGuard`, `getOfficialRevision`, `getOfficialTables`, `applyOfficialEffects` e refresh. Não deve surgir um novo callback específico de pagamento com outro nome.

## 9. Workflow de pagamento de pedido

O pagamento de pedido comum cruza:

- Orders — status/registro do pedido;
- Finance — movimento de entrada.

A coordenação fica em `app/workflows/payments/order-payment`.

### 9.1 Responsabilidades

O workflow deve possuir:

- owner da tentativa;
- prevenção de double-submit;
- request key da tentativa;
- método selecionado;
- proteção de sessão/guard;
- chamada de API;
- aplicação dos efeitos oficiais;
- tratamento de 409;
- tratamento de resultado incerto/rede/5xx;
- decisão de fechar ou preservar o diálogo;
- feedback equivalente ao atual.

### 9.2 Garantias obrigatórias

Preservar exatamente:

- um clique duplo envia somente um POST;
- resposta válida continua aplicando efeitos após navegação;
- resposta da tentativa A não fecha/altera o diálogo da tentativa B;
- resposta da sessão antiga não altera a nova sessão;
- 409 faz refresh oficial sem repetir POST;
- erro de rede/resultado incerto faz refresh oficial sem marcar Pago por otimismo;
- pagamento operacional continua respeitando `canReceiveStandaloneOrder`;
- A Receber continua podendo abrir o mesmo fluxo central sem usar a elegibilidade operacional de Cozinha/Histórico;
- offline continua bloqueando escrita;
- método default vem da configuração efetiva atual;
- método que se torna inativo durante um diálogo aberto exige revisão antes de confirmar.

### 9.3 UI

O modal de pagamento standalone não deve continuar inline em `App.jsx`.

Ele deve ser owned pela camada de workflow/aplicação, preservando:

- mesmo conteúdo;
- mesmo SystemSelect;
- mesmos textos;
- mesmo fechamento/cancelamento;
- mesmos estados disabled/submitting;
- mesma preservação de filtros/página ao cancelar.

## 10. Workflow de pagamento de comanda

Pagamento de comanda cruza:

- Table Service — comanda/mesa/seleção;
- Orders — pedidos pertencentes à comanda;
- Finance — movimentos de entrada.

A coordenação fica em `app/workflows/payments/table-tab-payment`.

### 10.1 C5 permanece válida

C5 já definiu que:

- Table Service não possui workflow financeiro;
- `Comandas` emite intents;
- `TableServiceExternalActions` possui a composição visual externa para pagamento/preview/print;
- printing permanece C9.

C6 não reverte essas decisões.

`TableServiceExternalActions` pode consumir o workflow de pagamento da C6, mas Table Service não passa a importar Finance.

### 10.2 Owner aceito

Uma obrigação financeira aceita precisa sobreviver ao fechamento do diálogo e à troca de seleção.

O workflow deve manter um owner por pagamento aceito contendo somente a identidade necessária para reconciliar o resultado, como:

- session/sync guard;
- `selectionGeneration`;
- `tableId`;
- `tableTabId`;
- método;
- conjunto de pedidos/movimentos esperados retornados pela mutação;
- status de sincronização.

Não depender da seleção visual corrente para preservar a obrigação aceita.

### 10.3 Reconciliação

A reconciliação precisa verificar contra estado oficial:

- a comanda paga está fechada;
- todos os pedidos retornados pelo pagamento aparecem como pagos;
- todos os movimentos retornados existem;
- a mesa ficou livre ou já foi ocupada por uma nova comanda;
- a comanda antiga não continua como `openTableTab`.

O workflow observa o estado oficial recebido do runtime e decide quando o owner está liquidado.

O runtime não chama settlement.

### 10.4 Races preservadas

Preservar o comportamento atual:

- uma primeira leitura pode já estar em voo antes do pagamento;
- se ela não prova o estado pós-pagamento, o workflow faz nova leitura oficial;
- nenhum POST é repetido automaticamente;
- owner aceito fica explicitamente em `syncing` enquanto a autoridade ainda não foi observada;
- falha de reconciliação vira `error`;
- retry faz somente leitura/reconciliação, não novo pagamento;
- enquanto houver obrigação aceita não liquidada, outro pagamento de comanda permanece bloqueado;
- seleção trocada não recebe sucesso visual de uma comanda anterior;
- se a mesa já foi reocupada por outra comanda, a seleção nova não é limpa.

### 10.5 Estado de UI

`paymentSync` e retry deixam de ser derivados de refs no App e passam a vir do workflow.

A UI de Comandas deve continuar recebendo informação equivalente:

```text
{ status, tableId, tabId }
```

ou contrato semanticamente equivalente.

## 11. Payment API adapter

Os endpoints:

- `POST /api/orders/:id/payment`;
- `POST /api/table-tabs/:id/payment`;

são endpoints de operações transversais.

Eles deixam de ser exports de `src/api/client.js` e passam para um adapter do workflow de pagamentos, usando `infrastructure/api/httpClient.js`.

O adapter não possui estado React nem lógica de UI.

## 12. Finance API adapter

`domains/finance/infrastructure/financeApi.js` passa a possuir:

- create movement;
- update movement;
- delete movement;
- save finance settings/opening balance.

Endpoints existentes permanecem:

- `POST /api/movements`;
- `PATCH /api/movements/:id`;
- `DELETE /api/movements/:id`;
- `PUT /api/finance-settings`.

Não alterar payloads nem respostas do Worker.

Esses exports deixam de existir em `src/api/client.js` após migração dos consumidores.

## 13. Payment promise

`promisedPaymentDate` pertence ao pedido, não ao domínio Finance.

A tela A Receber é apenas a superfície que edita esse dado.

Logo, `updateOrderPaymentPromise` não deve migrar para `financeApi`.

A C6 deve retirar o export legado de `src/api/client.js` e colocá-lo em um owner de Orders coerente com C4, ou injetar um contrato público de Orders na composição de A Receber.

Preservar:

- mesma rota `PATCH /api/orders/:id/payment-promise`;
- mesma validação backend;
- somente o pedido oficial retornado é aplicado;
- sem movimento financeiro;
- sem alteração operacional indevida;
- capability `finance.payment_promises`/capability equivalente já existente permanece como hoje;
- offline bloqueia escrita.

## 14. Estorno

Cancelamento e estorno possuem ownership dividido:

- lifecycle/cancelamento do pedido continua em Orders;
- consequência financeira do estorno pertence a Finance;
- coordenação que cruza ambos fica em `app/workflows/refunds`.

### 14.1 API

A rota existente `POST /api/orders/:id/refund` é uma operação transversal porque retorna efeitos de pedido e movimento.

O client dessa operação deixa `src/api/client.js` e passa a ser owned pelo workflow de refund.

### 14.2 Garantias

Preservar:

- estorno integral;
- sem estorno parcial;
- método de estorno obrigatório;
- método original persistido pode aparecer mesmo se hoje inativo;
- método histórico inativo não pode ser reenviado silenciosamente sem revisão;
- segundo estorno é rejeitado pelo backend;
- retorno oficial contém order + movement;
- aplicar ambos os efeitos oficiais;
- Financeiro reduz `Recebido hoje` pelo estorno do dia;
- pagamentos e movimentos originais permanecem auditáveis;
- pedido cancelado pago sem estorno continua aparecendo como estorno pendente;
- capability e offline continuam bloqueando a escrita.

## 15. Finance application commands

CRUD exclusivamente financeiro sai do App.

Um controller/hook de Finance deve coordenar:

- abrir/criar movimento;
- editar somente movimento manual;
- excluir movimento manual;
- salvar movimento;
- abrir saldo inicial;
- salvar saldo inicial;
- request keys;
- aplicação de efeito oficial;
- feedback/erro.

A camada application recebe dependências injetadas quando necessário:

- API financeira;
- `applyOfficialEffects`;
- writes blocked/capabilities;
- feedback callbacks.

Não criar store paralelo de movimentos ou settings.

## 16. Finance domain rules

Regras puras hoje espalhadas em `src/utils` devem ser realocadas ou divididas de acordo com ownership.

Finance deve possuir, no mínimo, conceitos equivalentes a:

- `calculateCurrentBalance`;
- filtros/períodos/resumos financeiros;
- `calculateReceivedToday`;
- projeções de recebíveis;
- timing de recebíveis;
- ordenação de recebíveis;
- seleção/projeção das opções de forma de pagamento;
- seleção/projeção das categorias financeiras.

Não mover automaticamente um arquivo inteiro se ele mistura ownership.

Por exemplo, `paymentWorkflow.js` contém regras de pedido e Finance. A implementação deve separar as funções por responsabilidade em vez de apenas mudar o arquivo de pasta.

## 17. Formas de pagamento

A Spec C define Finance como owner do catálogo/política de formas de pagamento.

A C6 deve estabelecer um contrato público de leitura/projeção para consumidores como:

- App composition;
- New Order;
- pagamentos;
- estornos;
- movimentos financeiros.

As garantias da Spec B/C3 permanecem:

- catálogo nativo;
- ativo/inativo;
- padrão;
- ordenação;
- stable code;
- effective config;
- ausência de config não inventa fallback Pix;
- uma seleção já aberta não muda automaticamente porque o default mudou;
- uma seleção que ficou inativa exige revisão.

A edição versionada continua usando o engine genérico de Settings.

## 18. Categorias financeiras

Finance passa a ser o owner do conteúdo e projeções de categorias financeiras.

Preservar:

- categorias nativas;
- tipo entrada/saída;
- active/inactive;
- ordenação;
- metadata de sistema/uso;
- restrições de rename/delete;
- revisão e save explícito da Spec B.

O engine genérico de policy editing permanece na camada app.

Domain-specific editor/model/policy adapter pode migrar para Finance; o shell genérico não migra.

## 19. UI Financeiro

A tela `Finance` migra para ownership de `domains/finance/ui`.

Preservar visual e comportamento:

- PageHeader;
- cards Entradas/Saídas/Saldo;
- lista de movimentações;
- tags de entrada/saída;
- indicação de pagamento recebido;
- indicação de estorno;
- edição/exclusão somente para `source === 'manual'`;
- estados vazios;
- capacidades;
- offline disabled;
- seção de estornos pendentes;
- mesmos diálogos e confirmações.

Não redesenhar a tela.

## 20. UI A Receber

A tela `Receivables` migra para ownership de `domains/finance/ui`.

Preservar:

- Pendentes/Quitados;
- Hoje/Próximos/Em atraso;
- forecast;
- busca;
- ordenação;
- query state;
- detalhe responsivo;
- quick payment;
- promessa de pagamento;
- exclusão de orders de comanda das listas padrão;
- cálculo temporal usando `promisedPaymentDate ?? orderDate`;
- atualização da data de negócio;
- mesmas regras mobile/desktop.

### 20.1 Dependências de Orders

A Receber hoje usa helpers e `OrderDetail` de Orders.

Após C6, `domains/finance` não deve importar Orders para resolver isso.

A composição cross-domain deve:

- injetar projections/helpers necessários; e/ou
- emitir intent `onViewOrder` para uma app surface renderizar a UI pública de Orders.

A implementação deve preservar a mesma experiência, sem duplicar OrderDetail dentro de Finance.

## 21. Movimentos e saldo inicial

`MovementDialog` e `OpeningBalanceDialog` passam para ownership de Finance se o import graph confirmar uso financeiro exclusivo.

Preservar:

- inputs;
- máscara/parse BRL;
- revisão antes de salvar;
- categorias;
- método financeiro;
- método histórico inativo;
- create/update;
- saldo inicial negativo permitido quando já permitido pelo backend;
- data de abertura;
- atualização imediata pelos efeitos oficiais.

Não alterar Worker ou migrations.

## 22. Componentes financeiros candidatos a migração

A implementação deve auditar e migrar componentes cujo ownership é exclusivamente Finance, incluindo, quando confirmado pelo import graph:

- `Finance.jsx`;
- `Receivables.jsx`;
- `MovementDialog.jsx`;
- `OpeningBalanceDialog.jsx`;
- `PaymentPromiseDialog.jsx`;
- `ReceivableDetail.jsx`;
- `ReceivablesForecastDialog.jsx`;
- `ReceivablesQuickPaymentDialog.jsx`.

`RegisterRefundDialog` pertence ao refund workflow se permanecer parte de uma operação transversal.

`TableTabPaymentDialog` pertence à composição/workflow de pagamento de comanda, não a Finance domain nem Table Service domain.

Não mover componente apenas por conter a palavra "payment"; ownership é semântico.

## 23. Finance settings dentro da superfície Settings

A superfície Settings continua application-owned.

C6 distribui ownership de conteúdo:

- Payment Settings → contrato/domain Finance;
- Finance Category Settings → contrato/domain Finance;
- generic settings editor/conflict/pending/reconcile → permanece app;
- Operation/Cancellation continuam Orders;
- Printing continua C9.

A migração não pode regressar:

- save explícito;
- revision otimista;
- conflict review;
- unknown-result reconciliation;
- pending recovery;
- abandonment guards;
- feedback "Não há alterações para salvar".

## 24. App.jsx após C6

O App pode continuar:

- consumindo coleções oficiais do runtime;
- derivando capabilities;
- compondo superfícies;
- conectando public contracts;
- passando feedback/navigation/runtime adapters.

O App não deve continuar possuindo:

- `paymentDialogRef`;
- `paymentAttemptRef`;
- `paymentSequenceRef`;
- `tableTabPaymentRef`;
- `paymentSyncRef`;
- `tableTabSync`;
- `operationalLegacyBridges` de pagamento;
- `publishPaymentSync`;
- `settleAcceptedPayment`;
- `reconcileTableTabPayment`;
- `handleRegisterTableTabPayment`;
- `handleRegisterPayment`;
- estado do modal standalone de pagamento;
- CRUD de movimentos;
- saldo inicial handlers;
- payment promise handler;
- refund handler.

A composição não deve virar outro mega-controller em um único arquivo `FinanceSurface.jsx`.

## 25. API legacy client debt removida na C6

Ao final da slice, `src/api/client.js` não deve exportar:

- `registerPayment`;
- `registerTableTabPayment`;
- `refundOrder`;
- `createMovement`;
- `updateMovement`;
- `deleteMovement`;
- `saveFinanceSettings`;
- `updateOrderPaymentPromise`.

Cada função deve ter um novo owner coerente antes da remoção.

Generic/auth reexports continuam governados pelo ledger e não são escopo desta slice.

Printing endpoints permanecem C9.

## 26. Efeitos oficiais e consistência

Toda mutação continua aplicando apenas resposta oficial.

C6 não introduz optimistic writes de pagamento/finance.

Regras:

- pedido pago só vira Pago após resposta oficial ou refresh oficial;
- movimento só aparece após efeito oficial;
- refund aplica order + movement oficiais;
- saldo inicial aplica `financeSettings` oficial;
- payment promise aplica order oficial;
- payment de comanda usa resposta oficial e reconciliação posterior quando necessário;
- nenhum workflow edita arrays oficiais diretamente.

## 27. Erros e resultado incerto

A C6 preserva a política atual.

### 27.1 401

Encerrar/expirar sessão pelo mecanismo atual.

### 27.2 409

Para pagamentos:

- não repetir POST;
- fazer leitura oficial;
- aceitar estado oficial.

Para comandos financeiros comuns, preservar tratamento atual do endpoint; não inventar retry automático sem evidência.

### 27.3 Rede/5xx em pagamento

- tratar como resultado potencialmente incerto;
- fazer leitura oficial;
- não marcar sucesso por otimismo;
- permitir retry somente se autoridade não comprovar o pagamento;
- retry do usuário é nova ação consciente.

### 27.4 Resposta velha

Todo workflow assíncrono crítico deve estar preso ao owner/guard da tentativa.

Resposta de sessão/target anterior não pode modificar UI do target atual.

## 28. Capabilities

Não alterar o modelo de autorização nesta slice.

Preservar as capabilities atuais usadas por:

- visualizar Finance;
- gerenciar movimentos;
- visualizar A Receber;
- receber pagamentos;
- gerenciar promessas;
- estornar;
- visualizar/editar payment settings;
- visualizar/editar finance categories.

C6 apenas move ownership do frontend.

Issue #44 continua fora de escopo.

## 29. Offline

Todas as escritas financeiras/pagamentos continuam bloqueadas quando offline.

Não adicionar fila offline.

Leituras já carregadas continuam visíveis conforme comportamento atual.

## 30. Worker, D1 e backend

C6 não requer mudança funcional de Worker, migrations ou schema.

Os endpoints existentes já retornam os efeitos necessários.

Qualquer necessidade inesperada de mudar Worker deve interromper a implementação daquela task e ser justificada contra esta spec antes de prosseguir.

Não criar migrations apenas para suportar a modularização frontend.

## 31. Architecture enforcement

A C6 deve ampliar o architecture checker para tornar a extração permanente.

O gate final deve rejeitar, no mínimo:

1. import externo direto de internals de `domains/finance`;
2. Finance → Orders internals;
3. Finance → Table Service internals;
4. recriação dos owners legacy de UI efetivamente migrados;
5. reintrodução dos exports C6 em `src/api/client.js`;
6. reintrodução do payment-receipt bridge no operational runtime;
7. payment workflow colocado dentro de Orders, Finance ou Table Service;
8. QZ/printing ownership migrado indevidamente para Finance/payments.

O public entry de Finance deve exportar somente contratos realmente consumidos externamente.

## 32. Compatibilidade e bridges

Estado esperado do compatibility ledger após C6:

| Bridge/facade | Estado |
|---|---|
| generic/auth `src/api/client.js` reexports | permanece até C10 |
| operational payment-receipt bridge | REMOVED IN C6 |
| operational table-commit bridge | já removido em C5 |
| `updateCollection` escape hatch | permanece para Customers/Catalog até C8/C10 |

C6 não cria um replacement bridge temporário para pagamento.

## 33. Estratégia de TDD

A implementação deve ser dividida em boundaries pequenos.

Para cada alteração comportamental/arquitetural:

1. escrever teste RED que prove o boundary ausente;
2. executar e confirmar falha pelo motivo pretendido;
3. implementar o mínimo;
4. executar focused GREEN;
5. executar architecture/lint proporcional;
6. commit normal;
7. usar Validate application no SHA relevante conforme o plano.

Characterization tests existentes devem ser preservados e relocados quando o owner físico mudar.

Não aceitar RED causado por parser/configuração do teste.

## 34. Cobertura mínima obrigatória

A C6 só pode ser considerada pronta se houver cobertura para:

### Order payment

- double-submit;
- navigation while pending;
- target A vs target B;
- stale old session;
- 409;
- network/unknown result;
- current effective default;
- inactive selected method;
- offline;
- A Receber entry point.

### Table-tab payment

- owner por selection generation;
- stale selection;
- accepted payment survives dialog close;
- pre-payment read race;
- second authoritative read;
- sync error/retry;
- no second payment while accepted owner pending;
- table freed;
- table reoccupied by new tab;
- old owner does not clear new selection;
- logout/session reset.

### Finance

- movement create/update/delete;
- source manual restriction;
- opening balance;
- current balance;
- received today;
- finance history filters;
- finance category/payment method projections;
- immediate official effect application.

### Receivables

- pending/paid split;
- promises;
- timing;
- forecast;
- table-tab order exclusion;
- quick payment;
- view-order cross-domain composition.

### Refund

- pending refund;
- method required;
- inactive historical method review;
- official order + movement;
- double-refund remains backend rejected/covered;
- received-today net effect.

## 35. Testes de regressão existentes a preservar

Os seguintes grupos são evidência crítica e devem continuar verdes ou ser movidos com semântica equivalente:

- `operationalPayment.test.js`;
- `financeRealtimeRegression.test.js`;
- `AppReceivablesPromise.test.js`;
- `financeClientContract.test.js` até a migração do contract;
- `businessPaymentOptions.test.js`;
- `settingsSaveAndFinanceOrderRegression.test.js`;
- `TableTabPaymentDialog.test.js`;
- `RegisterRefundDialog.test.js`;
- `utils/finance.test.js`;
- `utils/receivables.test.js`;
- Worker finance/payment/refund regressions relevantes.

Path-based tests devem ser atualizados somente depois que o novo owner existir.

## 36. Ordem conceitual de implementação

O plano detalhado deve considerar uma sequência semelhante:

1. criar boundary/public contracts Finance com regras puras;
2. mover/proteger payment method + finance category ownership;
3. criar Finance API e application commands;
4. migrar Finance UI;
5. migrar Receivables UI e quebrar dependência Finance → Orders via app composition;
6. extrair order payment workflow;
7. extrair table-tab payment workflow e remover runtime payment bridge;
8. extrair refund workflow;
9. migrar payment promise API para owner de Orders;
10. remover legacy API exports/owners;
11. tighten architecture gates;
12. full gates + staging + homologação.

A ordem exata é responsabilidade do plano e pode variar para manter RED/GREEN limpo, desde que os invariantes desta spec sejam respeitados.

## 37. Staging e homologação

Antes do merge:

- focused tests;
- `npm test`;
- `npm run test:architecture`;
- `npm run lint`;
- `npm run build`;
- production Worker dry-run;
- staging Worker dry-run;
- `npm run d1:migrate:local`;
- Spec B D1 gate;
- diff audit;
- Validate application no HEAD exato;
- Deploy staging manual no SHA validado;
- homologação manual proporcional.

Produção não faz parte deste gate.

## 38. Matriz manual mínima esperada

O plano deve converter esta lista em casos PASS/FAIL/BLOCKED com evidência:

1. pagamento de pedido na Cozinha;
2. pagamento de pedido no Histórico;
3. pagamento em A Receber;
4. cancelar modal preserva contexto;
5. double-click não duplica pagamento;
6. offline bloqueia pagamento;
7. método default efetivo;
8. método inativado exige revisão;
9. pagamento de comanda;
10. comanda fecha/mesa libera;
11. nova comanda na mesma mesa não é afetada pela anterior;
12. sync pending/error/retry de comanda;
13. movimento manual create;
14. movement edit;
15. movement delete;
16. saldo inicial;
17. A Receber filtros/forecast;
18. promessa de pagamento;
19. estorno pendente;
20. registrar estorno;
21. Settings → Formas de pagamento;
22. Settings → Categorias financeiras;
23. capability/read-only, se staging oferecer identidade adequada;
24. console sem novos erros de runtime.

BLOCKED permanece BLOCKED; não converter para PASS por teste automatizado.

## 39. Fora de escopo

- redesign visual;
- pagamentos parciais;
- parcelamento;
- múltiplos métodos em um pagamento;
- gateway Pix/cartão;
- refund automático externo;
- nova tabela de contas a receber;
- nova tabela de refunds;
- auditoria por funcionário;
- novo modelo de capabilities;
- mudança em polling;
- WebSocket/SSE;
- React Router;
- Customers C7;
- Catalog C8;
- Printing/QZ C9;
- remoção final de generic/auth facades C10;
- produção.

## 40. Critérios de aceite

C6 estará pronta quando:

- Finance e A Receber tiverem owner sob `domains/finance`;
- regras puras financeiras não estiverem espalhadas em legacy utils sem motivo;
- payment methods/finance categories tiverem ownership Finance preservando Settings C3;
- pagamentos comuns forem coordenados por workflow de app;
- pagamento de comanda for coordenado por workflow de app;
- estorno transversal tiver owner explícito;
- App não possuir payment owners/reconcile refs/handlers financeiros listados nesta spec;
- operational runtime não conhecer payment owners;
- payment-receipt bridge estiver removido e architecture-enforced;
- legacy C6 API exports estiverem ausentes de `src/api/client.js`;
- Finance não importar Orders/Table Service internals;
- nenhuma nova store oficial tiver sido criada;
- UX e regras existentes estiverem preservadas;
- automated gates estiverem verdes;
- staging estiver homologado com 0 FAIL;
- produção permanecer intocada até autorização separada.

## 41. Handoff para o plano

Depois da aprovação desta spec escrita:

1. atualizar os ledgers de Spec C para C5 merged / C6 design approved;
2. usar `superpowers:writing-plans`;
3. criar o plano detalhado da C6 a partir do HEAD real da branch;
4. decompor em tasks pequenas com RED/GREEN explícito;
5. somente após aprovação do plano iniciar implementação.

Até a aprovação escrita desta spec, não iniciar código funcional da C6.
