# Plano de implementação — A Receber por cliente + recebimento atômico de múltiplos pedidos

**Data:** 2026-09-26  
**Spec aprovada:** docs/superpowers/specs/2026-09-26-receivables-client-batching-design.md  
**Base de implementação:** master em 0273e1f7c52eb38da9e93e4abbb580de924bf36d  
**Branch documental:** docs/receivables-client-batching  
**Branch de implementação proposta:** feature/receivables-client-batching  
**Status:** PROPOSTA PARA APROVAÇÃO  
**Produção:** proibida neste plano até autorização explícita posterior  
**Staging:** permitido somente depois das tasks funcionais e gates automatizados previstos abaixo

## 1. Objetivo do plano

Implementar a Spec aprovada de forma incremental, testável e reversível, preservando os contratos já estabilizados de:

- A Receber;
- promessa de pagamento;
- previsão;
- pagamento simples;
- split payments;
- comanda;
- Financeiro;
- Reporting;
- refund;
- sync;
- Printing/QZ.

O desenvolvimento deve seguir TDD estrito:

> **RED observável → implementação mínima GREEN → regressões → commit da task.**

Não trabalhar em master.

## 2. Invariantes obrigatórios

Estas regras valem para todas as tasks.

### 2.1 Pagamento

- pagamento parcial continua impossível;
- frontend e backend exigem soma exata das allocations;
- PaymentCompositionEditor continua sendo o editor oficial;
- uma ou várias formas continuam suportadas;
- nenhuma forma é atribuída artificialmente a um pedido quando vários pedidos compartilham o receipt.

### 2.2 Lote de cliente

- lote aceita apenas pedidos do mesmo clientId;
- novo endpoint é usado para **2 ou mais pedidos**;
- 1 pedido continua pelo registerOrderPayment já existente;
- máximo V1: 100 orderIds;
- convidado sem clientId nunca entra no writer de lote;
- table-tab nunca entra no writer de lote.

### 2.3 Atomicidade

É proibido implementar o lote chamando POST /api/orders/:id/payment N vezes.

Para N pedidos e M formas, a mutação correta é:

- 1 receipt;
- N payments;
- M allocations;
- M movements;
- tudo em uma única transação/batch autoritativo.

### 2.4 Frontend

- A Receber não escreve financeiro diretamente;
- Finance não importa internals de Orders;
- workflow cross-domain permanece em src/app/workflows/payments;
- estado Pago nunca é aplicado otimisticamente;
- resposta oficial + sync continuam sendo autoridade.

### 2.5 Compatibilidade

- Lista de pedidos permanece funcional;
- Quitados permanece plano;
- quick payment atual continua;
- promise/forecast continuam;
- comanda continua no fluxo próprio;
- Printing/QZ não muda.

### 2.6 Schema

Não criar migration por padrão.

O schema atual já permite vários payments com o mesmo receipt_id.

Se uma necessidade estrutural real for encontrada durante a implementação:

1. parar a task;
2. registrar a evidência;
3. revisar Spec e plano;
4. só então criar migration.

Não introduzir schema silenciosamente.

## 3. Decisões de implementação consolidadas

### 3.1 Nomes canônicos

Backend writer:

~~~text
registerClientOrdersPayment
~~~

Frontend API:

~~~text
paymentApi.registerClientOrdersPayment(clientId, orderIds, allocations)
~~~

Workflow:

~~~text
src/app/workflows/payments/client-orders/
  useClientOrdersPaymentWorkflow.js
  ClientOrdersPaymentDialog.jsx
~~~

Helper de agrupamento Finance:

~~~text
groupReceivableEntriesByClient
~~~

Novo query state:

~~~text
displayMode: 'client' | 'orders'
~~~

### 3.2 Endpoint

~~~http
POST /api/clients/:clientId/receivables/payment
~~~

Payload:

~~~json
{
  "orderIds": ["o1", "o2"],
  "allocations": [
    { "methodCode": "cash", "amountCents": 3000 },
    { "methodCode": "pix", "amountCents": 3900 }
  ]
}
~~~

### 3.3 Writer para N=1

O endpoint novo deve rejeitar lote com menos de 2 pedidos.

Motivo:

- mantém uma única semântica para pedido individual;
- reutiliza registerOrderPayment;
- reduz superfície duplicada;
- deixa claro que o novo writer existe apenas para atomicidade multi-pedido.

A UI pode apresentar a mesma CTA Receber selecionados. A decisão de rota é interna:

~~~text
1 selecionado  -> onRegisterPayment(orderId)
2..100         -> onRegisterClientOrdersPayment({ clientId, orderIds })
~~~

### 3.4 Seleção

Seleção é estado efêmero da superfície, não parte da URL.

O query context persiste apenas displayMode e filtros.

A seleção deve ser limpa quando:

- muda o cliente ativo;
- muda Pendentes -> Quitados;
- muda client -> orders;
- um pedido selecionado deixa de existir no recorte após sync;
- pagamento é aceito;
- sessão é resetada.

## 4. Sequência das tasks

1. Domínio de agrupamento + query state.
2. Writer backend multi-pedido — RED completo.
3. Writer backend + HTTP + architecture — GREEN.
4. API frontend + workflow + dialog de pagamento.
5. Controller de seleção e wiring App/Surface.
6. UI desktop Por cliente.
7. UI mobile Por cliente.
8. Compatibilidade Lista de pedidos, promise, forecast e navegação Cliente.
9. Finance / Reporting / read model / refund regressions.
10. Concorrência, acessibilidade, offline e limites.
11. Full gates, PR, staging e homologação guiada.
12. Fechamento documental pós-homologação.

---

# Task 1 — Domínio de agrupamento e query state

## Objetivo

Criar a projeção pura que transforma recebíveis já filtrados em grupos por cliente, sem ainda alterar o writer financeiro ou a UI final.

## Arquivos

Modificar:

- src/domains/finance/domain/receivables.js
- src/domains/finance/domain/receivables.test.js
- src/app/navigation/queryContext.js
- src/app/navigation/queryContext.test.js
- src/domains/finance/index.js, somente se o helper precisar ser público fora do domínio
- src/domains/finance/ui/ReceivablesRedesign.test.js

## Contrato proposto

~~~js
groupReceivableEntriesByClient(entries)
sortReceivableGroups(groups, sortMode)
~~~

Cada grupo deve expor conceitualmente:

~~~js
{
  key: 'client:c1',
  kind: 'client',
  clientId: 'c1',
  label: 'Maria',
  phone: '(11) ...',
  entries: [...],
  orders: [...],
  count: 3,
  total: 206,
  timing: { status: 'overdue', daysOverdue: 5 },
  earliestExpectedDate: '2026-09-21',
  oldestCreatedAt: '...',
  newestCreatedAt: '...'
}
~~~

Pedido sem clientId:

~~~js
{
  key: 'order:o7',
  kind: 'single',
  clientId: null,
  entries: [entry],
  count: 1
}
~~~

## Step 1 — RED de domínio

Adicionar testes para:

1. mesmo clientId agrupa;
2. mesmo nome + clientId diferente não agrupa;
3. guest_name igual não agrupa;
4. total soma somente as entries recebidas;
5. timing agregado usa a maior urgência;
6. overdue mais antigo define daysOverdue/expectedDate agregado;
7. phone é preservado do snapshot;
8. sort urgency;
9. sort recent;
10. sort value-desc.

Comando:

~~~bash
node --test src/domains/finance/domain/receivables.test.js
~~~

Esperado: FAIL por helper inexistente/contratos ainda ausentes.

## Step 2 — Implementar helper mínimo GREEN

Reutilizar timingRank existente.

Regra:

- o helper recebe entries já filtradas;
- não refaz timing;
- não lê browser API;
- não importa Orders;
- não agrupa table-tab porque buildPendingReceivableEntries já exclui;
- client group somente se:
  - order.clientId truthy;
  - customerIdentityType === registered_client.

## Step 3 — RED do query context

Adicionar ao teste:

~~~js
assert.equal(createQueryContext().receivables.displayMode, 'client')
~~~

e provar que patchQueryContext aceita somente:

~~~text
client
orders
~~~

A normalização final pode ficar na superfície, mas valores arbitrários não podem se tornar default implícito.

## Step 4 — Implementar query state

Adicionar:

~~~js
displayMode: 'client'
~~~

em receivables.

Adicionar displayMode a QUERY_FIELDS.

## Step 5 — Atualizar contrato visual antigo

O teste atual:

~~~text
standard receivables render a flat ledger instead of client cards
~~~

deve ser substituído por contrato que aceite:

- Por cliente como padrão de Pendentes;
- Lista de pedidos preservada.

Neste momento o teste pode permanecer RED até a Task 6 se for explicitamente separado.

Não alterar UI completa nesta task apenas para satisfazer esse teste; criar contratos focados sem mascarar RED futuro.

## Step 6 — GREEN da task

~~~bash
node --test   src/domains/finance/domain/receivables.test.js   src/app/navigation/queryContext.test.js
~~~

Esperado: PASS.

## Step 7 — Commit

~~~bash
git add src/domains/finance/domain/receivables.js   src/domains/finance/domain/receivables.test.js   src/app/navigation/queryContext.js   src/app/navigation/queryContext.test.js   src/domains/finance/index.js
git commit -m "feat: add client receivable grouping domain"
~~~

---

# Task 2 — Writer backend multi-pedido: RED completo

## Objetivo

Definir o comportamento financeiro autoritativo antes de escrever registerClientOrdersPayment.

## Arquivos

Criar:

- worker/clientReceivablesPayment.test.js

Modificar se necessário para harness:

- worker/test-support/operationalDb.js — somente se o fixture realmente exigir suporte adicional

Não implementar writer ainda.

## Fixture mínimo

Cliente cadastrado c1 com:

- o1 = R$ 49, pendente;
- o2 = R$ 20, pendente;
- o3 = R$ 60, pendente.

Outro cliente c2:

- o4 = R$ 35.

Criar também casos:

- cancelled;
- paid;
- table order;
- guest_name.

## Step 1 — RED happy path simples

Teste:

~~~js
registerClientOrdersPayment(db, BUSINESS, 'c1', ['o1', 'o2'], [
  { methodCode: 'pix', amountCents: 6900 },
])
~~~

Esperar:

- receipt total 6900;
- 2 payments;
- 1 allocation;
- 1 movement;
- o1/o2 Pago;
- o3 continua Pendente;
- mesmo receiptId nos 2 payments.

## Step 2 — RED split payment

Com:

- cash 3000;
- pix 3900.

Esperar:

- 1 receipt;
- 2 payments;
- 2 allocations;
- 2 movements;
- soma de todos = 6900;
- payment.method NULL;
- movement.order_id NULL;
- movement.payment_id NULL;
- payment_allocation_id diferente por movimento.

## Step 3 — RED de rejeições

Cobrir:

- 0 ids;
- 1 id;
- >100 ids;
- ids repetidos;
- pedido inexistente;
- pedido de outro clientId;
- pedido guest;
- pedido table-tab;
- pedido cancelado;
- pedido pago;
- valor total zero/inválido;
- allocations abaixo;
- allocations acima;
- método duplicado;
- método desconhecido/inativo.

## Step 4 — RED de atomicidade

Injetar falha durante batch e provar:

~~~text
payment_receipts = 0
payment_allocations = 0
payments novos = 0
movements novos = 0
~~~

## Step 5 — RED de policy race

Desativar uma forma entre leitura e commit.

Esperar:

~~~text
409 POLICY_CHANGED
zero efeitos
~~~

## Step 6 — RED de state race

Simular o1 pago ou cancelado imediatamente antes do commit.

Esperar conflito de lote e rollback total.

## Step 7 — Executar RED

~~~bash
node --test worker/clientReceivablesPayment.test.js
~~~

Esperado: FAIL por registerClientOrdersPayment inexistente.

## Step 8 — Commit RED

O projeto aceita commits RED rastreáveis nas tasks comportamentais.

~~~bash
git add worker/clientReceivablesPayment.test.js
git commit -m "test: define client receivables payment contract"
~~~

---

# Task 3 — Writer backend + HTTP + architecture: GREEN

## Objetivo

Implementar o comando atômico, rota HTTP e ownership arquitetural.

## Arquivos

Modificar:

- worker/paymentRepository.js
- worker/paymentValidation.js
- worker/index.js
- src/app/workflows/payments/paymentApi.js
- src/app/workflows/payments/paymentApi.test.js
- scripts/architecture/check-import-boundaries.mjs
- scripts/architecture/check-import-boundaries.test.mjs

Criar:

- worker/clientReceivablesPaymentHttp.test.js, se o harness de worker/index.test.js não oferecer um teste focado suficientemente isolado

## Step 1 — Validar orderIds

Adicionar helper conceitual:

~~~js
validateReceivableOrderIds(rawOrderIds, { min: 2, max: 100 })
~~~

Regras:

- array;
- strings não vazias;
- 2..100;
- sem duplicidade.

Não aceitar clientId ou businessId do body.

## Step 2 — Implementar leitura autoritativa

registerClientOrdersPayment:

~~~js
export async function registerClientOrdersPayment(
  db,
  businessId,
  clientId,
  rawOrderIds,
  rawAllocations,
  now = new Date(),
)
~~~

Leitura deve retornar para todos os ids:

- id;
- client_id;
- customer_identity_type;
- table_tab_id;
- status;
- total_cents;
- payment_id.

Rejeitar se a quantidade retornada não for exatamente N.

## Step 3 — Calcular total oficial

~~~js
authoritativeTotalCents = selected.reduce(...)
~~~

Com overflow seguro.

Nenhum total vem do frontend.

## Step 4 — Validar composição e policy

Reutilizar:

- assertPaymentAllocationTotal;
- readPaymentMethodExpectations;
- preparePolicyGuards.

## Step 5 — Guard de estado dentro do batch

Criar assertion de estado que prove no momento transacional:

- todos os ids ainda existem;
- business correto;
- mesmo clientId;
- registered_client;
- table_tab_id IS NULL;
- status <> Cancelado;
- nenhum payment existente;
- COUNT = N;
- SUM(total_cents) = authoritativeTotalCents.

Não confiar apenas na leitura anterior.

## Step 6 — Persistência

Criar:

- 1 receipt;
- M allocations;
- N payments;
- M movements.

Descrição:

~~~text
Recebimento cliente · {nome} · {N} pedidos
~~~

Payments:

~~~text
receipt_id = receipt
amount_cents = total oficial do pedido
method = NULL
~~~

Movements:

~~~text
order_id = NULL
payment_id = NULL
receipt_id = receipt
payment_allocation_id = allocation
~~~

## Step 7 — Error classification

Conflitos de estado/UNIQUE devem virar:

~~~text
409 CLIENT_RECEIVABLES_PAYMENT_CONFLICT
Os pedidos selecionados foram alterados. Atualize os dados e tente novamente.
~~~

POLICY_CHANGED mantém o contrato existente.

## Step 8 — Resposta

Retornar:

~~~js
{
  receipt,
  allocations,
  payments,
  orders,
  movements
}
~~~

orders devem vir de loadOrderById após commit.

## Step 9 — Rota HTTP

Em worker/index.js:

~~~text
POST /api/clients/:clientId/receivables/payment
~~~

- assertSameOriginMutation;
- readJson;
- validate orderIds;
- validate allocations;
- delegate writer;
- status 201.

## Step 10 — Frontend API contract

Adicionar:

~~~js
registerClientOrdersPayment: (clientId, orderIds, allocations) =>
  request(
    `/api/clients/${encodeURIComponent(clientId)}/receivables/payment`,
    json('POST', { orderIds, allocations }),
  )
~~~

## Step 11 — Architecture gate

O checker atual reconhece apenas:

- registerOrderPayment;
- registerTableTabPayment.

Atualizar o owner set para também reconhecer registerClientOrdersPayment como writer permitido exclusivamente em worker/paymentRepository.js.

Adicionar teste provando que:

- paymentRepository pode exportar os três writers;
- outro Worker file não pode virar owner paralelo.

## Step 12 — GREEN focado

~~~bash
node --test   worker/clientReceivablesPayment.test.js   worker/clientReceivablesPaymentHttp.test.js   src/app/workflows/payments/paymentApi.test.js   scripts/architecture/check-import-boundaries.test.mjs
~~~

Se o HTTP test for incorporado a worker/index.test.js, usar esse arquivo no comando.

Esperado: PASS.

## Step 13 — Architecture real

~~~bash
npm run test:architecture
~~~

Esperado:

~~~text
Frontend architecture boundaries: OK
~~~

## Step 14 — Commit

~~~bash
git add worker/paymentRepository.js   worker/paymentValidation.js   worker/index.js   worker/clientReceivablesPayment.test.js   worker/clientReceivablesPaymentHttp.test.js   src/app/workflows/payments/paymentApi.js   src/app/workflows/payments/paymentApi.test.js   scripts/architecture/check-import-boundaries.mjs   scripts/architecture/check-import-boundaries.test.mjs
git commit -m "feat: add atomic client receivables payment"
~~~

Omitir arquivo HTTP dedicado se o teste tiver sido colocado no harness existente.

---

# Task 4 — Workflow frontend + dialog reutilizando PaymentCompositionEditor

## Objetivo

Criar o owner frontend do pagamento multi-pedido sem colocar lógica financeira em Finance UI.

## Arquivos

Criar:

- src/app/workflows/payments/client-orders/useClientOrdersPaymentWorkflow.js
- src/app/workflows/payments/client-orders/useClientOrdersPaymentWorkflow.test.js
- src/app/workflows/payments/client-orders/ClientOrdersPaymentDialog.jsx
- src/app/workflows/payments/client-orders/ClientOrdersPaymentDialog.test.js

Modificar:

- src/App.jsx

## Interfaces

Hook:

~~~js
useClientOrdersPaymentWorkflow({
  orders,
  canReceivePayments,
  writesBlocked,
  paymentOptions,
  defaultPaymentMethod,
  getSyncGuard,
  applyOfficialEffects,
  refreshOfficialData,
  setRequestKey,
  onSuccess,
  onError,
})
~~~

Método:

~~~js
open({ clientId, orderIds })
~~~

Dialog:

~~~js
<ClientOrdersPaymentDialog dialog={clientOrdersPayment.dialog} currency={currency} />
~~~

## Step 1 — RED do workflow

Cobrir:

1. abre somente para 2..100 ids;
2. ids devem ser únicos;
3. todos devem existir no snapshot oficial;
4. todos possuem mesmo clientId;
5. nenhum Pago;
6. nenhum Cancelado;
7. nenhum tableTab;
8. totalCents soma pedidos;
9. composição inicial usa método padrão + total;
10. submit chama API uma vez;
11. double submit bloqueia;
12. sucesso aplica orders + movements oficiais;
13. 409 faz refresh;
14. 5xx/network faz refresh, não rePOST automático;
15. stale guard ignora resposta;
16. tentativa A não fecha tentativa B;
17. close limpa requestKey.

Comando RED:

~~~bash
node --test src/app/workflows/payments/client-orders/useClientOrdersPaymentWorkflow.test.js
~~~

## Step 2 — Implementar o hook

Reutilizar padrões de useOrderPaymentWorkflow:

- sequenceRef;
- dialogOwnerRef;
- allocations;
- getSyncGuard;
- requestKey;
- submitting;
- createInitialPaymentComposition;
- summarizePaymentComposition;
- toPaymentAllocations.

Request key:

~~~text
client-orders:payment:{clientId}:{token}
~~~

## Step 3 — Mensagem de sucesso

Para 2 pedidos:

~~~text
Recebimento registrado: 2 pedidos de Fernanda Albuquerque quitados
~~~

Não mencionar um método por pedido.

## Step 4 — RED do dialog

Exigir:

- Modal title Registrar pagamento;
- cliente;
- contagem de pedidos;
- números/valores resumidos;
- total;
- PaymentCompositionEditor;
- Confirmar recebimento;
- Cancelar;
- disabled segue writesBlocked/submitting/composition.valid.

## Step 5 — Implementar dialog

Não copiar campos de método.

Compor diretamente:

~~~jsx
<PaymentCompositionEditor
  totalCents={dialog.totalCents}
  allocations={dialog.allocations}
  onChange={dialog.setAllocations}
  paymentOptions={dialog.paymentOptions}
  disabled={...}
/>
~~~

## Step 6 — App owner

Instanciar o hook próximo de useOrderPaymentWorkflow.

Renderizar o dialog no AppShell, próximo do OrderPaymentDialog.

No reset de sessão/sync:

~~~js
orderPayment.close()
clientOrdersPayment.close()
~~~

## Step 7 — GREEN

~~~bash
node --test   src/app/workflows/payments/client-orders/useClientOrdersPaymentWorkflow.test.js   src/app/workflows/payments/client-orders/ClientOrdersPaymentDialog.test.js   src/app/workflows/payments/PaymentCompositionEditor.test.js   src/app/workflows/payments/order/useOrderPaymentWorkflow.test.js
~~~

Esperado: PASS.

## Step 8 — Commit

~~~bash
git add src/app/workflows/payments/client-orders   src/App.jsx
git commit -m "feat: add client orders payment workflow"
~~~

---

# Task 5 — Controller de seleção + wiring ReceivablesSurface

## Objetivo

Adicionar seleção efêmera e callbacks sem ainda finalizar o polish visual.

## Arquivos

Criar:

- src/domains/finance/application/useReceivableClientSelection.js
- src/domains/finance/application/useReceivableClientSelection.test.js

Modificar:

- src/app/surfaces/finance/ReceivablesSurface.jsx
- src/app/surfaces/finance/ReceivablesSurface.test.js
- src/domains/finance/ui/Receivables.jsx
- src/App.jsx

## Step 1 — RED do controller

Casos:

- seleção começa vazia;
- activate group;
- toggle order;
- select all visíveis;
- deselect all;
- não aceita id fora do grupo ativo;
- trocar grupo limpa seleção anterior;
- reconcile remove ids que saíram do recorte;
- clear após sucesso;
- guest/single permite apenas o próprio id.

## Step 2 — Implementar hook

Estado conceitual:

~~~js
{
  activeGroupKey,
  selectedOrderIds
}
~~~

Não persistir em query string.

## Step 3 — Wiring Surface

ReceivablesSurface recebe:

~~~js
onRegisterClientOrdersPayment
onOpenClient
~~~

e repassa para Finance UI.

Finance não importa Customers.

## Step 4 — Wiring App

Para activeTab receivables:

- onRegisterPayment continua orderPayment.open;
- onRegisterClientOrdersPayment aponta para clientOrdersPayment.open;
- onOpenClient só existe se canViewClients.

Navegação:

~~~js
(client) => {
  patchQuery('clients', { search: client?.name || '' })
  requestNavigation('clients')
}
~~~

## Step 5 — Regra N=1 / N>1

Dentro de Receivables:

~~~text
selected.length === 1
  -> onRegisterPayment(id)

selected.length >= 2
  -> onRegisterClientOrdersPayment({ clientId, orderIds })
~~~

Não chamar writer multi para N=1.

## Step 6 — GREEN

~~~bash
node --test   src/domains/finance/application/useReceivableClientSelection.test.js   src/app/surfaces/finance/ReceivablesSurface.test.js
~~~

## Step 7 — Commit

~~~bash
git add src/domains/finance/application/useReceivableClientSelection.js   src/domains/finance/application/useReceivableClientSelection.test.js   src/app/surfaces/finance/ReceivablesSurface.jsx   src/app/surfaces/finance/ReceivablesSurface.test.js   src/domains/finance/ui/Receivables.jsx   src/App.jsx
git commit -m "feat: wire receivable client selection"
~~~

---

# Task 6 — UI desktop Por cliente

## Objetivo

Implementar o mockup aprovado no desktop com grupos compactos e painel direito.

## Arquivos

Criar preferencialmente:

- src/domains/finance/ui/ReceivableClientGroup.jsx
- src/domains/finance/ui/ReceivableClientPanel.jsx

Modificar:

- src/domains/finance/ui/Receivables.jsx
- src/domains/finance/ui/ReceivablesRedesign.test.js
- src/receivables.css

## Step 1 — RED de UI desktop

Contratos:

- Pendentes mostra Por cliente / Lista de pedidos;
- Por cliente pressed por padrão;
- Quitados não mostra esse toggle;
- grupo contém nome, quantidade, total e timing;
- telefone quando disponível;
- aria-expanded;
- painel mostra lista de pedidos;
- checkboxes possuem labels;
- Selecionar todos;
- valor selecionado;
- Receber selecionados;
- Ver cliente somente com callback;
- List mode ainda existe.

## Step 2 — Construir dados na ordem correta

Em Receivables:

1. pendingEntries;
2. aplicar busca/timing/exactDate;
3. para orders mode: sortReceivableEntries;
4. para client mode:
   - groupReceivableEntriesByClient(filteredEntries);
   - sortReceivableGroups.

Isso garante que total do grupo respeita o filtro atual.

## Step 3 — Busca por telefone

Adicionar clientPhone ao entrySearchText.

Não mudar a semântica da busca de Lista de pedidos além de ampliar o texto pesquisável.

## Step 4 — Toggle de modo

~~~text
Por cliente
Lista de pedidos
~~~

Trocar modo deve:

- limpar selectedEntryKey incompatível;
- limpar seleção multi;
- preservar search/timing/sort.

## Step 5 — Grupo desktop

Card/row compacto:

- avatar;
- cliente;
- telefone;
- count;
- total;
- timing;
- chevron.

Não criar cards excessivamente altos.

## Step 6 — Painel lateral

Ao selecionar client group:

- usar a coluna direita já existente;
- mostrar client summary;
- pedidos;
- checkboxes;
- total selecionado;
- CTA.

Para single/guest:

- mostrar somente o pedido;
- CTA usa pagamento individual.

## Step 7 — CSS desktop

Manter split workspace atual.

Requisitos:

- painel sticky;
- scroll interno se necessário;
- valor nowrap;
- lista esquerda permanece rolável;
- nenhuma largura fixa que quebre 1024/1280/1440.

## Step 8 — GREEN desktop

~~~bash
node --test   src/domains/finance/ui/ReceivablesRedesign.test.js   src/app/surfaces/finance/ReceivablesSurface.test.js   src/domains/finance/domain/receivables.test.js
~~~

## Step 9 — Commit

~~~bash
git add src/domains/finance/ui/ReceivableClientGroup.jsx   src/domains/finance/ui/ReceivableClientPanel.jsx   src/domains/finance/ui/Receivables.jsx   src/domains/finance/ui/ReceivablesRedesign.test.js   src/receivables.css
git commit -m "feat: group desktop receivables by client"
~~~

---

# Task 7 — UI mobile Por cliente

## Objetivo

Implementar expansão inline + sticky selection bar no celular.

## Arquivos

Modificar:

- src/domains/finance/ui/ReceivableClientGroup.jsx
- src/domains/finance/ui/Receivables.jsx
- src/domains/finance/ui/ReceivablesMobile.test.js
- src/receivables.css

## Step 1 — RED mobile

Exigir:

- group card touch >= 44 px;
- expansão inline;
- pedidos com checkbox;
- sem usar modal só para seleção;
- sticky bar acima de bottom nav;
- safe-area;
- bar mostra count + total;
- CTA Receber;
- bar some sem seleção;
- bar some com payment overlay;
- último item recebe espaço inferior suficiente.

## Step 2 — Layout até 820px

No modo client:

- painel lateral desktop oculto;
- conteúdo expandido renderizado dentro do card/grupo;
- filtro horizontal preservado;
- toggle de modo com scroll/fit seguro.

## Step 3 — Sticky bar

Usar variáveis já existentes:

~~~css
bottom: calc(
  var(--mobile-bottom-nav-height)
  + var(--mobile-safe-bottom)
  + var(--mobile-floating-gap)
);
~~~

z-index:

~~~text
var(--layer-floating-action)
~~~

## Step 4 — Interação

Ao expandir outro cliente:

- limpar seleção anterior;
- abrir novo grupo.

Ao clicar Receber:

- N=1 -> dialog oficial de pedido;
- N>1 -> dialog multi-pedido.

## Step 5 — Bottom spacing

Adicionar padding local somente enquanto sticky bar estiver ativa se necessário.

Não aumentar globalmente o AppShell.

## Step 6 — GREEN mobile

~~~bash
node --test   src/domains/finance/ui/ReceivablesMobile.test.js   src/domains/finance/ui/ReceivablesRedesign.test.js
~~~

## Step 7 — Commit

~~~bash
git add src/domains/finance/ui/ReceivableClientGroup.jsx   src/domains/finance/ui/Receivables.jsx   src/domains/finance/ui/ReceivablesMobile.test.js   src/receivables.css
git commit -m "feat: add mobile client receivables flow"
~~~

---

# Task 8 — Preservar Lista de pedidos, promise, forecast e quick payment

## Objetivo

Provar que o redesign não elimina nenhuma capacidade já existente.

## Arquivos

Modificar somente conforme RED real:

- src/domains/finance/ui/Receivables.jsx
- src/domains/finance/ui/ReceivableDetail.jsx
- src/domains/finance/ui/ReceivablesQuickPaymentDialog.jsx
- src/domains/finance/ui/ReceivablesForecastDialog.jsx
- src/domains/finance/ui/ReceivablesRedesign.test.js
- src/domains/finance/ui/ReceivablesMobile.test.js
- src/app/surfaces/finance/ReceivablesSurface.test.js

## Step 1 — RED de compatibilidade

Cobrir:

1. displayMode orders renderiza o ledger atual;
2. quick payment desktop continua visível no modo orders;
3. FAB quick payment continua no mobile orders;
4. quick payment continua selecionando um pedido e delegando;
5. detalhe de pedido continua;
6. promise define/altera/remove;
7. forecast abre;
8. clicar data da previsão filtra;
9. summary cards continuam aplicando timingFilter;
10. Quitados continua plano;
11. pago misto continua exibindo composição;
12. table-tab continua ausente.

## Step 2 — Regra de quick payment

No modo client:

- ocultar a ação global Registrar recebimento se ela competir com a seleção por cliente.

No modo orders:

- manter exatamente a ação atual.

Isso evita duas UX concorrentes para o mesmo fluxo.

## Step 3 — Ver cliente

Se onOpenClient existir e group.clientId existir:

~~~text
Ver cliente
~~~

Caso contrário a ação não aparece.

## Step 4 — GREEN

~~~bash
node --test   src/domains/finance/ui/ReceivablesRedesign.test.js   src/domains/finance/ui/ReceivablesMobile.test.js   src/app/surfaces/finance/ReceivablesSurface.test.js   src/domains/finance/domain/receivables.test.js
~~~

## Step 5 — Commit

~~~bash
git add src/domains/finance/ui   src/app/surfaces/finance/ReceivablesSurface.test.js   src/receivables.css
git commit -m "fix: preserve receivables legacy workflows"
~~~

Adicionar apenas arquivos realmente modificados.

---

# Task 9 — Finance, Reporting, read model e refund

## Objetivo

Provar que o novo receipt compartilhado é interpretado corretamente pelos consumidores existentes.

## Arquivos

Modificar/adicionar testes principalmente:

- src/domains/finance/domain/movementPresentation.test.js
- worker/orderPaymentReadModel.test.js, se existir; senão criar teste focado apropriado
- worker/clientReceivablesPayment.test.js
- worker/reporting/* testes existentes adequados
- src/app/workflows/refunds/RegisterRefundDialog.test.js
- worker/orderCancellation*.test.js conforme contrato já existente

Evitar mudar produção se os contratos já estiverem corretos.

## Step 1 — Finance presentation

Fixture:

Receipt R$ 69:

- Dinheiro R$ 30;
- Pix R$ 39;
- 2 payments ligados ao mesmo receipt.

Provar que movements do mesmo receipt viram:

- uma linha visível;
- total R$ 69;
- breakdown 30/39.

## Step 2 — Order read model

Carregar os dois pedidos após pagamento.

Provar:

- paymentStatus Pago;
- paymentReceiptId igual;
- paymentAllocations iguais;
- paidAmount individual preserva o valor do próprio pedido;
- paymentMethod null em receipt misto;
- paymentMethod simples continua label para uma allocation.

## Step 3 — Reporting

Criar fixture D1 / repository/service que represente:

- dois pedidos;
- um receipt compartilhado;
- duas allocations.

Provar:

- receivedCents = receipt total uma vez;
- payment mix = allocations;
- receivableCount/amount deixam de contar ambos;
- nenhum total é multiplicado por 2.

Usar os testes existentes de reporting/repository/service onde houver fixture SQLite. Não adicionar exceção especial no código só para esta feature.

## Step 4 — Refund

Para um dos pedidos do receipt misto:

- UI mostra composição do receipt;
- não inventa forma original única;
- operador precisa escolher forma ativa;
- refund é integral do paidAmount daquele pedido;
- receipt original não é alterado.

## Step 5 — GREEN

Comando focado deve incluir ao menos:

~~~bash
node --test   src/domains/finance/domain/movementPresentation.test.js   worker/clientReceivablesPayment.test.js   src/app/workflows/refunds/RegisterRefundDialog.test.js
~~~

Adicionar os arquivos reais de Reporting/refund backend descobertos durante execução.

## Step 6 — Commit

~~~bash
git add <somente testes/ajustes realmente necessários>
git commit -m "test: cover shared client payment receipt consumers"
~~~

Se tudo já passar apenas com testes novos, o commit pode ser predominantemente de regressão.

---

# Task 10 — Concorrência, offline, capability, acessibilidade e limite

## Objetivo

Fechar riscos operacionais antes do full gate.

## Arquivos

Modificar:

- worker/clientReceivablesPayment.test.js
- src/app/workflows/payments/client-orders/useClientOrdersPaymentWorkflow.test.js
- src/domains/finance/ui/ReceivablesMobile.test.js
- src/domains/finance/ui/ReceivablesRedesign.test.js
- src/receivables.css
- src/app/workflows/payments/client-orders/* somente se um RED exigir correção

## Step 1 — Concorrência

Cobrir:

- um pedido pago por outro dispositivo;
- um pedido cancelado;
- policy mudou;
- network failure;
- 5xx;
- stale response;
- double click.

Nenhum caso pode produzir segundo POST automático.

## Step 2 — Limite 100

Backend:

- 100 válido;
- 101 rejeitado.

Frontend:

- select all não ultrapassa limite;
- se um grupo tiver >100 entries visíveis, selecionar todos seleciona no máximo 100 e mostra feedback claro, ou desabilita a ação com texto explicativo.

Escolher uma única UX no código e testar.

Recomendação: selecionar os primeiros 100 segundo a ordenação atual e mostrar:

~~~text
Limite de 100 pedidos por recebimento.
~~~

## Step 3 — Offline/capability

Sem payments.receive:

- não submete;
- CTA não fica acionável;
- leitura permanece.

Offline:

- filtros/grupos continuam;
- payment submit bloqueado;
- sem fila offline.

## Step 4 — Acessibilidade

Cobrir:

- aria-expanded nos grupos;
- checkbox label inclui pedido e valor;
- Selecionar todos possui nome;
- timing tem texto;
- focus-visible;
- mobile target >=44 px;
- sticky bar não depende só de cor;
- reduced motion;
- sem overflow horizontal.

## Step 5 — GREEN

~~~bash
node --test   worker/clientReceivablesPayment.test.js   src/app/workflows/payments/client-orders/useClientOrdersPaymentWorkflow.test.js   src/domains/finance/ui/ReceivablesRedesign.test.js   src/domains/finance/ui/ReceivablesMobile.test.js
~~~

## Step 6 — Commit

~~~bash
git add worker/clientReceivablesPayment.test.js   src/app/workflows/payments/client-orders   src/domains/finance/ui/ReceivablesRedesign.test.js   src/domains/finance/ui/ReceivablesMobile.test.js   src/receivables.css
git commit -m "fix: harden client receivables batching"
~~~

---

# Task 11 — Full validation, PR, staging e homologação

## Objetivo

Produzir candidato exato de staging sem produção.

## Step 1 — Suite completa

~~~bash
npm test
~~~

Esperado:

- 0 fail;
- skips somente se já existentes e justificados.

## Step 2 — Architecture

~~~bash
npm run test:architecture
~~~

Esperado:

~~~text
Frontend architecture boundaries: OK
~~~

## Step 3 — Lint

~~~bash
npm run lint
~~~

Esperado: exit 0.

## Step 4 — Build

~~~bash
npm run build
~~~

Esperado: exit 0.

## Step 5 — D1 local

Mesmo sem migration nova:

~~~bash
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
node scripts/infra/operation-profile-d1-gate.mjs
~~~

Esperado: PASS.

Objetivo aqui é provar que a feature não depende de schema escondido.

## Step 6 — Worker dry-runs

~~~bash
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
~~~

Esperado: PASS.

## Step 7 — Revisão de schema

Executar busca/diff e confirmar:

~~~text
nenhum arquivo novo em migrations/
~~~

Se houver migration, parar: Spec/plano precisam ter sido revisados antes.

## Step 8 — Criar PR draft

Branch:

~~~text
feature/receivables-client-batching
~~~

Título:

~~~text
feat: group receivables by client
~~~

Body mínimo:

~~~markdown
## Summary
- group pending receivables by registered client
- allow selection of multiple orders from one client
- settle selected orders atomically in one receipt
- reuse the existing split-payment composition editor
- preserve flat order list, promises, forecast and table-tab flows

## Validation
- npm test
- npm run test:architecture
- npm run lint
- npm run build
- local D1 gates
- production/staging Worker dry-runs

## Rollout
Staging only. No production deploy.
~~~

## Step 9 — Validate exact SHA

A PR para master deve disparar Validate application.

Não publicar staging se o exact HEAD estiver vermelho.

## Step 10 — Staging

O workflow Deploy staging já suporta workflow_dispatch.

Usar workflow_dispatch no ref:

~~~text
feature/receivables-client-batching
~~~

Não é necessário editar o workflow apenas para adicionar a branch ao trigger automático.

Staging deve executar:

- full tests;
- architecture;
- lint;
- build;
- local D1;
- staging Worker dry-run;
- staging migrations;
- deploy;
- login smoke;
- deep-link smoke.

## Step 11 — QA guiado

Registrar em:

~~~text
docs/superpowers/qa/receivables-client-batching-qa.md
~~~

### Grupo

1. cliente 1 pedido;
2. cliente 3 pedidos;
3. ids diferentes mesmo nome;
4. guest names iguais separados;
5. overdue + today + upcoming;
6. Todos;
7. Hoje;
8. Próximos;
9. Em atraso;
10. forecast exact date;
11. busca nome;
12. busca telefone;
13. busca pedido/produto;
14. sort urgency;
15. sort recent;
16. sort value.

### Seleção

17. um pedido;
18. dois;
19. subset de três;
20. selecionar todos;
21. desmarcar;
22. trocar cliente;
23. list mode;
24. voltar para client mode.

### Pagamento

25. N=1 via Pix;
26. N=2 Pix;
27. N=2 Dinheiro;
28. N=2 Dinheiro + Pix;
29. três formas;
30. soma abaixo;
31. soma acima;
32. duplicada;
33. método desativado;
34. double click;
35. offline;
36. conflito por outro dispositivo.

### Pós-pagamento

37. somente selecionados pagos;
38. terceiro permanece pendente;
39. Finance 1 receipt;
40. Finance breakdown;
41. Reporting Received;
42. Reporting mix;
43. Quitados;
44. refund de um pedido do receipt.

### Compatibilidade

45. promise;
46. forecast;
47. quick payment no modo orders;
48. comanda;
49. checkout pago;
50. impressão/fila sem regressão.

### Visual

51. desktop dark;
52. desktop light;
53. mobile dark;
54. mobile light;
55. teclado/foco;
56. console.

## Step 12 — Stop gate

Depois de staging homologado:

- não mergear;
- não produzir;
- atualizar PR/QA;
- reportar ao usuário;
- esperar autorização explícita de merge.

## Step 13 — Commit de QA/documentação

Somente depois da homologação:

~~~bash
git add docs/superpowers/qa/receivables-client-batching-qa.md
git commit -m "docs: close receivables client batching qa"
~~~

---

# Task 12 — Fechamento documental pós-homologação

## Objetivo

Garantir que o merge tenha evidência exata e nenhuma pendência escondida.

## Arquivos

Modificar:

- docs/superpowers/qa/receivables-client-batching-qa.md
- plano, somente para marcar execução se o projeto mantiver checkboxes no documento
- outros ledgers somente se o processo ativo do repositório exigir

## Step 1 — Registrar SHA homologado

Documentar:

- branch HEAD;
- Validate run;
- staging run;
- Worker version;
- migrations: nenhuma nova;
- PASS/FAIL/BLOCKED manual.

## Step 2 — Autorrevisão contra a Spec

Confirmar um a um os critérios da seção 51 da Spec.

## Step 3 — Verificar PR

- open;
- mergeable;
- 0 unresolved review threads;
- base master atual;
- head exato homologado.

## Step 4 — Final exact-SHA Validate

Se o commit documental alterar apenas docs e o CI rodar no PR, registrar o run final.

Se staging precisar corresponder ao SHA documental por política do projeto, somente republicar se o processo vigente exigir; não inventar equivalência.

## Step 5 — Parar antes do merge

Entregar ao usuário:

- PR;
- HEAD;
- Validate;
- staging;
- QA;
- known blocked;
- produção = NO DEPLOY;
- merge = NOT EXECUTED.

Esperar autorização explícita.

---

## 5. Matriz de ownership

| Responsabilidade | Owner |
| --- | --- |
| Agrupamento/ordenação de recebíveis | domains/finance |
| Seleção visual por cliente | domains/finance/application |
| UI A Receber | domains/finance/ui |
| Composição de pagamento | app/workflows/payments |
| Tentativa/double submit multi-pedido | app/workflows/payments/client-orders |
| API browser de pagamento | app/workflows/payments/paymentApi |
| Writer financeiro | worker/paymentRepository.js |
| Validação allocations/order ids | worker/paymentValidation.js |
| HTTP dispatch | worker/index.js |
| Read model pago | worker/orderPaymentReadModel.js |
| Finance movement presentation | domains/finance/domain |
| Reporting | worker/reporting, somente regressão |
| Refund | app/workflows/refunds + worker/orderCancellation, somente compatibilidade |
| Cliente cadastrado | domains/customers |
| Printing/QZ | domains/printing/infrastructure, fora do escopo |

## 6. Matriz RED → GREEN por task

| Task | RED principal | GREEN principal |
| --- | --- | --- |
| 1 | agrupamento/query inexistentes | domínio + query |
| 2 | writer inexistente | RED persistido |
| 3 | writer/API ausentes | backend atômico |
| 4 | workflow/dialog ausentes | client-orders payment |
| 5 | seleção/wiring ausentes | controller + callbacks |
| 6 | client UI desktop ausente | split view agrupado |
| 7 | mobile inline/sticky ausente | UX mobile |
| 8 | regressões legacy | compatibilidade preservada |
| 9 | consumers receipt compartilhado | Finance/Reporting/refund provados |
| 10 | races/a11y/offline | hardening |
| 11 | full gates | staging homologável |
| 12 | evidência incompleta | fechamento antes do merge |

## 7. Autorrevisão do plano contra a Spec

### Agrupamento

- clientId, não nome: Task 1/6.
- guest separado: Task 1/6.
- table-tab excluído: Tasks 1/2/3.
- totals por filtro: Task 1/6.
- search phone/order/product: Task 6.
- sort modes: Task 1/6.

### Pagamento

- N=1 usa fluxo atual: Tasks 3/5.
- N>1 atômico: Tasks 2/3.
- multi-forma preservada: Task 4.
- parcial impossível: global + Tasks 2/4.
- 1 receipt/N payments/M allocations/M movements: Tasks 2/3.
- não distribuir forma por pedido: Tasks 2/3/9.

### Frontend

- Por cliente default: Tasks 1/6.
- Lista de pedidos fallback: Task 8.
- desktop panel: Task 6.
- mobile inline + sticky: Task 7.
- client navigation: Task 8.
- selection same client: Task 5.

### Compatibilidade

- promise: Task 8.
- forecast: Task 8.
- quick payment: Task 8.
- Finance: Task 9.
- Reporting: Task 9.
- refund: Task 9.
- comanda: Tasks 2/8/11.
- Printing: Tasks 11/QA.

### Segurança operacional

- backend total oficial: Task 3.
- policy guard: Tasks 2/3.
- state guard: Tasks 2/3.
- no optimistic Paid: Task 4.
- no auto-rePOST: Task 4/10.
- offline: Task 10.
- capability: Task 10.
- batch limit: Task 10.
- no hidden migration: Task 11.

## 8. Placeholder scan

Este plano não contém:

- TBD;
- TODO;
- decisão de negócio em aberto;
- pagamento parcial opcional;
- migration presumida;
- fluxo alternativo de pagamento.

Decisões técnicas menores de naming/CSS podem ser ajustadas durante execução desde que não alterem os contratos da Spec.

## 9. Gate para implementação

Após aprovação explícita deste plano:

1. criar feature/receivables-client-batching a partir da master exata ou, se master tiver avançado, revalidar diff antes de iniciar;
2. não desenvolver na master;
3. executar Task 1 primeiro;
4. seguir a ordem das tasks;
5. cada task comportamental registra RED/GREEN;
6. staging só depois do full gate;
7. merge somente após homologação e autorização explícita;
8. produção somente após autorização explícita posterior ao merge.
