# A Receber — agrupamento por cliente e recebimento atômico de múltiplos pedidos

**Data:** 2026-09-26  
**Status:** PROPOSTA PARA APROVAÇÃO  
**Base inspecionada:** master em 0273e1f7c52eb38da9e93e4abbb580de924bf36d  
**Branch documental:** docs/receivables-client-batching  
**Plano de implementação:** ainda não escrito — só deve ser criado após aprovação explícita desta Spec  
**Produção:** nenhuma alteração autorizada por este documento  
**Referência funcional anterior:** docs/superpowers/specs/2026-09-06-receivables-forecast-redesign-design.md  
**Referência financeira anterior:** docs/superpowers/specs/2026-09-21-split-payments-design.md

## 1. Objetivo

Evoluir a tela **Financeiro → A receber** para reduzir o trabalho operacional de baixa quando um mesmo cliente possui vários pedidos pendentes.

A experiência atual apresenta um ledger plano de pedidos. Isso preserva clareza por pedido, mas faz o operador localizar e quitar individualmente vários recebíveis do mesmo cliente.

A nova experiência deve permitir:

1. visualizar pendências agrupadas por cliente cadastrado;
2. expandir um cliente e enxergar cada pedido pendente;
3. selecionar um ou vários pedidos desse mesmo cliente;
4. registrar um único recebimento para os pedidos selecionados;
5. usar a composição de pagamento já existente, com uma ou várias formas;
6. manter pagamento parcial impossível;
7. preservar o modo atual de lista de pedidos como alternativa;
8. manter comandas fora deste fluxo;
9. funcionar com produtividade equivalente em desktop e mobile.

A regra central é:

> **A Receber organiza e seleciona os pedidos; o workflow oficial de pagamentos continua sendo o único dono da composição, validação e efetivação financeira.**

## 2. Contexto observado na master atual

Esta Spec foi escrita após inspeção da implementação atual.

### 2.1 A Receber hoje é um ledger plano

A superfície atual está em:

- src/domains/finance/ui/Receivables.jsx
- src/domains/finance/ui/ReceivableDetail.jsx
- src/domains/finance/ui/ReceivablesQuickPaymentDialog.jsx

O contrato vigente possui:

- abas Pendentes e Quitados;
- resumos Receber hoje, Próximos e Em atraso;
- filtros Todos, Hoje, Próximos e Em atraso;
- busca;
- ordenação Mais urgente, Mais recente e Maior valor;
- lista plana de pedidos;
- painel lateral no desktop;
- bottom sheet no mobile;
- previsão de recebimentos;
- promessa de pagamento;
- ação rápida Registrar recebimento.

Existe teste explícito em ReceivablesRedesign.test.js garantindo que o modo atual é plano e não usa cards agrupados por cliente.

### 2.2 A ação rápida atual escolhe um único pedido

ReceivablesQuickPaymentDialog.jsx funciona apenas como seletor de pedido.

Fluxo atual:

1. o operador clica em Registrar recebimento;
2. busca e seleciona um pedido pendente;
3. A Receber delega o orderId ao workflow oficial;
4. abre o modal oficial de pagamento;
5. o pagamento integral é confirmado.

A tela de A Receber não possui um writer financeiro próprio e essa separação deve ser preservada.

### 2.3 Pagamento com múltiplas formas já existe

O fluxo oficial utiliza:

- src/app/workflows/payments/order/OrderPaymentDialog.jsx
- src/app/workflows/payments/PaymentCompositionEditor.jsx
- src/app/workflows/payments/paymentComposition.js
- src/app/workflows/payments/paymentApi.js
- src/app/workflows/payments/order/useOrderPaymentWorkflow.js

O PaymentCompositionEditor já suporta:

- uma forma de pagamento;
- duas ou mais formas;
- valor por forma;
- preenchimento automático do restante;
- remoção de forma;
- bloqueio de método duplicado;
- revisão de método desativado;
- cálculo de total informado;
- cálculo de restante;
- detecção de excesso;
- acessibilidade e responsividade.

Não deve ser criada uma segunda UI simplificada de Dinheiro/Pix/Cartão dentro de A Receber.

### 2.4 Pagamento parcial já é proibido

No frontend, summarizePaymentComposition só considera a composição válida quando:

- existe total oficial positivo;
- todos os valores são positivos;
- todos os métodos são válidos;
- não existem métodos duplicados;
- nenhuma forma exige revisão;
- soma informada === total oficial.

No backend, worker/paymentValidation.js repete a regra:

- allocations devem existir;
- amountCents deve ser inteiro seguro e maior que zero;
- método não pode duplicar;
- assertPaymentAllocationTotal exige soma exata ao total oficial.

Portanto esta feature **não cria pagamento parcial** e não altera essa regra.

### 2.5 O modelo financeiro já suporta um receipt ligado a vários pedidos

A feature de split payments introduziu:

- payment_receipts — representa o ato de recebimento;
- payment_allocations — representa a composição por forma;
- payments — relaciona pedidos ao receipt;
- movements — representa entradas/saídas financeiras.

registerTableTabPayment já cria:

- um receipt;
- várias allocations;
- um payment para cada pedido pendente da comanda;
- movimentos por allocation;
- fechamento atômico da operação.

Esse é o precedente técnico para o novo recebimento de múltiplos pedidos avulsos.

### 2.6 Já existe helper de agrupamento por cliente

src/domains/finance/domain/receivables.js já contém groupPendingOrders.

O helper atual já estabelece regras importantes:

- cliente cadastrado agrupa por clientId;
- nomes iguais sem clientId não são agrupados;
- comandas agrupam apenas por tableTabId;
- pedidos pagos/cancelados não entram;
- total do grupo soma os saldos pendentes.

A nova UI deve reutilizar ou evoluir essa regra, não criar agrupamento textual por nome.

## 3. Relação com o redesign anterior de A Receber

Esta Spec **não substitui integralmente** o design de 2026-09-06.

Continuam vigentes:

- promessa de pagamento;
- data esperada derivada de promisedPaymentDate ou orderDate;
- estados Hoje / Próximos / Em atraso;
- Pendentes / Quitados;
- previsão de recebimentos;
- pagamento integral;
- bottom sheet mobile;
- painel lateral desktop;
- regras offline;
- regras de capability;
- comandas fora do recebível avulso;
- data prometida opcional.

Esta Spec substitui a decisão anterior de manter obrigatoriamente uma lista plana como experiência principal de Pendentes.

Novo contrato:

> **Pendentes passa a oferecer Por cliente como visão principal e Lista de pedidos como visão alternativa.**

## 4. Resultados esperados

Ao concluir a V1, um usuário com permissão de recebimento deve conseguir:

- abrir A Receber e enxergar rapidamente quais clientes concentram pendências;
- ver quantidade de pedidos e valor total por cliente;
- identificar urgência sem abrir cada pedido;
- expandir um cliente;
- selecionar alguns ou todos os pedidos elegíveis daquele cliente;
- ver o total exato da seleção;
- abrir o mesmo editor oficial de composição de pagamento usado hoje;
- dividir o pagamento em múltiplas formas quando necessário;
- confirmar somente quando a soma das formas fechar exatamente o total selecionado;
- quitar todos os pedidos selecionados de forma atômica;
- manter outros pedidos do cliente pendentes;
- continuar usando a Lista de pedidos antiga;
- executar a mesma operação no celular sem perder contexto.

## 5. Não objetivos

Ficam fora desta V1:

- pagamento parcial de pedido;
- saldo parcial;
- parcela financeira de pedido;
- juros, multa ou correção;
- seleção de pedidos de clientes diferentes em um mesmo recebimento;
- agrupamento por simples igualdade de nome;
- agrupamento de convidados sem identidade persistida;
- pagamento de comanda por esta tela;
- alteração do fluxo de pagamento de comanda;
- distribuição artificial de uma forma de pagamento para cada pedido;
- edição manual de receipt após confirmação;
- estorno dividido;
- conciliação bancária;
- cobrança automática por WhatsApp;
- nova tabela de contas a receber;
- nova implementação de editor de formas de pagamento;
- mudança funcional em Reporting;
- mudança funcional em impressão/QZ.

## 6. Terminologia oficial

### 6.1 Grupo de cliente

Conjunto de pedidos pendentes avulsos que:

- pertencem ao mesmo business;
- possuem customerIdentityType = registered_client;
- possuem o mesmo clientId;
- não estão cancelados;
- não estão pagos;
- não são recebíveis de uma comanda aberta.

### 6.2 Pedido elegível

Pedido que pode participar do recebimento conjunto:

- existe;
- pertence ao business autenticado;
- está pendente;
- não está cancelado;
- não pertence a uma comanda;
- possui o clientId do grupo;
- possui total oficial positivo.

### 6.3 Recebimento conjunto de cliente

Uma única ação financeira que quita integralmente dois ou mais pedidos selecionados do mesmo cliente cadastrado.

O recebimento conjunto produz:

- 1 payment_receipt;
- N payments, um para cada pedido;
- M payment_allocations, uma por forma;
- M movements de entrada, uma por allocation.

Não produz N × M movements.

## 7. Arquitetura de informação

### 7.1 Abas principais

Continuam:

- Pendentes;
- Quitados.

### 7.2 Modo de visualização em Pendentes

Adicionar:

- **Por cliente** — padrão;
- **Lista de pedidos** — comportamento atual preservado.

O seletor aparece somente em Pendentes.

Quitados permanece plano nesta V1.

### 7.3 Estado de query

Adicionar ao query context de receivables um campo conceitual:

~~~text
displayMode: 'client' | 'orders'
~~~

Padrão:

~~~text
client
~~~

O restante do query state atual é preservado:

- search;
- activeView;
- timingFilter;
- sortMode;
- exactDateFilter;
- selectedEntryKey.

A implementação deve preservar continuidade entre navegação interna, resize e retorno à tela.

## 8. Regras de agrupamento

### 8.1 Cliente cadastrado

Pedidos com o mesmo clientId formam um único grupo.

A identidade é clientId, nunca client/name.

### 8.2 Convidado / nome livre

Pedidos sem clientId permanecem individualizados.

Dois pedidos chamados João não podem ser agrupados automaticamente apenas porque o texto coincide.

Na visão Por cliente, um pedido avulso sem identidade persistida pode ser exibido como um item individual com indicação discreta:

- Cliente avulso;
- ou equivalente visual aprovado.

Esse item não ganha seleção multi-pedido com outros nomes iguais.

### 8.3 Comandas

Pedidos com customerIdentityType = table e tableTabId permanecem excluídos de A Receber como recebíveis avulsos.

O fluxo oficial de comanda continua no Table Service.

### 8.4 Cliente removido posteriormente

Se um pedido histórico não possuir mais clientId válido, ele não deve ser agrupado por nome.

Ele cai na regra de item individual.

## 9. Aplicação de filtros sobre grupos

Filtros continuam operando sobre **pedidos**, não sobre o card inteiro do cliente.

### 9.1 Todos

Inclui todos os pedidos pendentes elegíveis.

O grupo mostra:

- quantidade total de pedidos elegíveis;
- valor total pendente;
- status agregado de maior urgência.

### 9.2 Hoje

Inclui apenas pedidos cujo timing atual seja today.

O grupo e seu total refletem apenas os pedidos do filtro.

### 9.3 Próximos

Inclui apenas upcoming.

### 9.4 Em atraso

Inclui apenas overdue.

### 9.5 Data exata pela previsão

Inclui apenas pedidos cuja expectedDate corresponda à data escolhida.

### 9.6 Regra de segurança

Um filtro nunca pode esconder a semântica do total exibido.

Se a tela está em Em atraso e Fernanda possui:

- R$ 49 atrasado;
- R$ 61 futuro;

o card mostrado no filtro Em atraso deve representar **R$ 49**, não R$ 110.

O painel pode mostrar contexto adicional de saldo geral do cliente, desde que seja rotulado separadamente e não seja usado silenciosamente como valor de seleção.

## 10. Busca

No modo Por cliente, a busca deve encontrar pelo menos:

- nome do cliente;
- telefone;
- número do pedido;
- produto/resumo de item;
- modalidade/tipo quando já fizer parte do texto oficial.

Regras:

- se a busca corresponde ao nome/telefone do cliente, o grupo permanece visível;
- se corresponde a um pedido/produto, o grupo correspondente permanece visível;
- o filtro temporal continua sendo respeitado;
- a busca não pode agrupar clientes diferentes.

Placeholder recomendado:

~~~text
Buscar cliente, telefone ou pedido
~~~

No modo Lista de pedidos, o placeholder atual pode ser preservado.

## 11. Ordenação no modo Por cliente

### 11.1 Mais urgente

Ordenar grupos pela maior urgência presente no recorte visível:

1. grupo com pedido atrasado;
2. grupo com pedido de hoje;
3. grupo apenas futuro.

Empates:

1. expectedDate mais antiga;
2. pedido/criação mais antiga;
3. nome do cliente como desempate estável.

### 11.2 Mais recente

Usar a criação mais recente entre os pedidos visíveis do grupo.

### 11.3 Maior valor

Usar o total do grupo no recorte atual.

## 12. Anatomia do card/grupo de cliente

Cada grupo deve mostrar sem expansão:

- avatar/iniciais;
- nome do cliente;
- telefone quando disponível e houver espaço;
- quantidade de pedidos no recorte;
- total pendente no recorte;
- status resumido de urgência;
- indicação expandir/abrir.

Exemplos:

~~~text
Fernanda Albuquerque
3 pedidos · R$ 206,00
Atrasado há 5 dias
~~~

ou:

~~~text
Maria
1 pedido · R$ 36,00
Vence hoje
~~~

A cor não pode ser a única indicação de urgência.

## 13. Seleção e expansão

### 13.1 Um cliente ativo por vez

A seleção de múltiplos pedidos fica sempre escopada ao cliente atualmente expandido/selecionado.

A UI não deve permitir checkboxes ativos simultaneamente em clientes diferentes.

Isso elimina a necessidade de resolver mistura de clientes no backend por comportamento visual.

### 13.2 Expansão

Ao expandir o grupo, mostrar cada pedido elegível no recorte atual com:

- checkbox;
- número do pedido;
- data;
- resumo dos itens;
- valor integral;
- timing;
- ação de detalhe quando necessário.

### 13.3 Selecionar todos

Seleciona todos os pedidos visíveis e elegíveis daquele cliente **dentro do recorte/filtro atual**.

Não seleciona pedidos ocultos por outro filtro.

### 13.4 Seleção parcial do cliente

É permitido selecionar apenas alguns pedidos.

Exemplo:

Fernanda possui:

- #143 = R$ 49;
- #156 = R$ 20;
- #181 = R$ 60.

Selecionar #143 + #156 cria total oficial esperado de R$ 69.

#181 permanece pendente após a operação.

### 13.5 Nenhuma seleção

A CTA de recebimento conjunto fica desabilitada.

### 13.6 Um único pedido selecionado

Se apenas um pedido estiver selecionado, a operação pode reutilizar o workflow de pagamento de pedido já existente.

A UX pode manter o mesmo botão Receber selecionado(s), mas a implementação deve preferir o caminho mais simples e comprovado para N=1.

### 13.7 Dois ou mais pedidos selecionados

Usar o novo workflow de pagamento conjunto.

## 14. Desktop

### 14.1 Estrutura

Desktop largo:

- cabeçalho e resumos atuais;
- Pendentes/Quitados;
- filtros;
- seletor Por cliente / Lista de pedidos;
- busca e ordenação;
- grupos à esquerda;
- painel de cliente à direita.

### 14.2 Painel direito

Ao selecionar um grupo cadastrado, mostrar:

- nome;
- telefone;
- ação Ver cliente quando a navegação permitir;
- total no recorte atual;
- quantidade de pedidos no recorte;
- pior urgência;
- lista de pedidos elegíveis;
- seleção;
- total selecionado;
- CTA Receber selecionados.

O painel não deve embutir uma segunda implementação de formas de pagamento.

### 14.3 Receber tudo

Pode existir uma ação explícita Selecionar todos ou Receber todos os pedidos do recorte.

Não deve existir pagamento implícito de pedidos não selecionados.

## 15. Mobile

### 15.1 Estrutura

No celular:

- resumos compactos;
- Pendentes/Quitados;
- filtros horizontais;
- seletor Por cliente / Lista de pedidos;
- busca;
- grupos compactos.

### 15.2 Cliente expandido inline

Ao expandir:

- manter o cabeçalho do cliente;
- mostrar pedidos com checkbox;
- permitir rolagem normal da página;
- evitar modal apenas para selecionar.

### 15.3 Barra fixa de seleção

Com pelo menos um pedido selecionado, exibir barra fixa acima da bottom navigation:

~~~text
2 pedidos selecionados
R$ 69,00
Receber
~~~

Requisitos:

- respeitar safe area;
- não cobrir o último item;
- touch target >= 44/48 px;
- desaparecer quando a seleção for limpa;
- desaparecer quando outro overlay estiver aberto.

### 15.4 Modal de pagamento

Ao tocar Receber, abrir o mesmo contrato visual do pagamento oficial adaptado ao total conjunto.

Não criar um editor móvel paralelo.

## 16. Reutilização obrigatória do PaymentCompositionEditor

O recebimento conjunto deve reutilizar PaymentCompositionEditor.

O modal/wrapper novo pode se chamar conceitualmente:

~~~text
ClientOrdersPaymentDialog
~~~

ou nome equivalente definido no plano.

O conteúdo superior deve contextualizar:

- cliente;
- quantidade de pedidos;
- números dos pedidos selecionados;
- total oficial.

Exemplo:

~~~text
Registrar pagamento

Fernanda Albuquerque
2 pedidos selecionados
#143 · R$ 49,00
#156 · R$ 20,00

Total a receber
R$ 69,00
~~~

Abaixo disso vem o PaymentCompositionEditor atual.

## 17. Regras de composição preservadas

Para recebimento conjunto:

- uma forma continua válida;
- múltiplas formas continuam válidas;
- primeira forma começa com o total;
- adicionar forma calcula restante;
- método duplicado é inválido;
- método desativado exige revisão;
- valores <= 0 são inválidos;
- soma abaixo do total é inválida;
- soma acima do total é inválida;
- confirmação só é possível com soma exata;
- pagamento parcial continua impossível.

## 18. Novo contrato de API

A V1 precisa de uma mutação atômica para vários pedidos do mesmo cliente.

Endpoint recomendado:

~~~http
POST /api/clients/:clientId/receivables/payment
Content-Type: application/json
~~~

Payload:

~~~json
{
  "orderIds": ["order-143", "order-156"],
  "allocations": [
    { "methodCode": "cash", "amountCents": 3000 },
    { "methodCode": "pix", "amountCents": 3900 }
  ]
}
~~~

Resposta conceitual:

~~~json
{
  "receipt": {},
  "allocations": [],
  "payments": [],
  "orders": [],
  "movements": []
}
~~~

O nome final da rota pode ser ajustado no plano se houver motivo arquitetural, mas a semântica não pode mudar.

## 19. Validação autoritativa do backend

O frontend nunca envia o total como fonte de verdade.

O backend recebe clientId + orderIds + allocations e recalcula tudo.

Antes do commit, deve provar:

1. clientId é válido para a operação;
2. orderIds é array não vazio;
3. ids não se repetem;
4. todos os pedidos existem;
5. todos pertencem ao business autenticado;
6. todos possuem o mesmo clientId da rota;
7. todos são pedidos avulsos elegíveis;
8. nenhum está cancelado;
9. nenhum já está pago;
10. nenhum pertence a tableTab;
11. cada total_cents é positivo;
12. soma oficial cabe em inteiro seguro;
13. allocations são válidas;
14. soma das allocations é exatamente a soma oficial;
15. todas as formas continuam ativas no momento do commit.

Qualquer divergência aborta a operação inteira.

## 20. Persistência do recebimento conjunto

Para N pedidos e M formas:

### 20.1 Receipt

Criar exatamente 1 payment_receipt:

- business_id = contexto autenticado;
- table_tab_id = NULL;
- total_cents = soma autoritativa dos pedidos;
- paid_at = timestamp da operação.

### 20.2 Allocations

Criar M payment_allocations ligadas ao receipt.

### 20.3 Payments

Criar N payments:

- um por order_id;
- todos apontando para o mesmo receipt_id;
- amount_cents = total integral oficial de cada pedido;
- method = NULL para receipt estruturado;
- mesmo paid_at.

### 20.4 Movements

Criar M movements de entrada:

- source = order-payment;
- receipt_id = receipt;
- payment_allocation_id = allocation;
- value_cents = valor da allocation;
- payment_method = label da allocation;
- order_id = NULL;
- payment_id = NULL.

Não atribuir arbitrariamente uma allocation a um pedido específico.

Descrição recomendada:

~~~text
Recebimento cliente · Fernanda Albuquerque · 2 pedidos
~~~

ou equivalente consistente com Finance.

## 21. Por que não executar N pagamentos individuais

A UI não deve implementar recebimento conjunto chamando POST /api/orders/:id/payment repetidamente.

Exemplo proibido:

1. pagar #143;
2. depois pagar #156.

Se a segunda chamada falhar, a intenção única do operador teria sido aplicada parcialmente.

A operação de múltiplos pedidos deve ser **atômica**.

## 22. Atomicidade

O commit de recebimento conjunto deve incluir na mesma unidade:

- assertions de policy;
- guards de estado dos pedidos;
- receipt;
- allocations;
- payments;
- movements;
- first_used_at das formas;
- cleanup de assertions.

Falha em qualquer etapa:

> zero receipt, zero allocation, zero payment e zero movement novo.

## 23. Concorrência

Cenários que devem retornar conflito e não aplicar pagamento parcial:

- outro dispositivo pagou um dos pedidos;
- outro dispositivo cancelou um dos pedidos;
- pedido foi associado a estado incompatível;
- cliente mudou de contexto de forma que a identidade não corresponda;
- forma de pagamento foi desativada;
- total oficial mudou por uma mutação autorizada antes do commit.

Erro recomendado:

~~~text
CLIENT_RECEIVABLES_PAYMENT_CONFLICT
~~~

Mensagem:

~~~text
Os pedidos selecionados foram alterados. Atualize os dados e tente novamente.
~~~

O código final pode ser refinado no plano.

## 24. Idempotência prática e double submit

Preservar o comportamento atual dos workflows:

- botão desabilitado durante submitting;
- owner/tentativa identifica a operação corrente;
- duplo clique gera um único POST;
- 409 atualiza os dados;
- 5xx/network não dispara POST automático de retry;
- refresh/reconciliação determina a verdade oficial;
- se o servidor confirmou e a resposta foi perdida, o refresh mostra os pedidos pagos;
- tentativa posterior sobre pedidos já quitados retorna conflito em vez de duplicar.

Não é obrigatório introduzir idempotency key nova nesta V1 se os invariantes atuais + unique payments + owner workflow forem suficientes, mas o plano deve reavaliar esse risco.

## 25. Novo workflow frontend

Ownership permanece em:

~~~text
src/app/workflows/payments
~~~

Criar conceitualmente:

~~~text
client-orders/
  useClientOrdersPaymentWorkflow.js
  ClientOrdersPaymentDialog.jsx
~~~

Responsabilidades:

- abrir com clientId + orderIds;
- derivar snapshot atual dos pedidos oficiais;
- calcular total de apresentação;
- criar composição inicial com método padrão;
- manter allocations;
- bloquear stale selection;
- submeter uma vez;
- chamar paymentApi;
- aplicar efeitos oficiais;
- fechar somente a própria tentativa;
- tratar 409/network/5xx;
- emitir mensagem de sucesso.

Finance UI apenas inicia o workflow e apresenta seleção.

## 26. API frontend

paymentApi deve ganhar método conceitual:

~~~text
registerClientOrdersPayment(clientId, orderIds, allocations)
~~~

Payload não inclui:

- businessId;
- total;
- labels de método;
- valor total calculado pelo navegador.

## 27. Aplicação de efeitos oficiais

Após sucesso, o Worker retorna todos os pedidos atualizados e movimentos.

O runtime/aplicação deve:

- substituir/aplicar os pedidos oficiais retornados;
- aplicar movements oficiais;
- não criar estado Pago otimista;
- não criar receipt store paralelo sem necessidade.

Depois da aplicação:

- pedidos quitados desaparecem de Pendentes;
- pedidos não selecionados permanecem;
- grupo é recalculado;
- se nenhum pedido do cliente restar no recorte, o grupo desaparece;
- Quitados passa a refletir os pedidos pagos após sync/read model.

## 28. Composição compartilhada no read model

Todos os payments do lote apontam para o mesmo receipt.

Portanto cada pedido pago pode expor:

- paymentReceiptId igual;
- paymentAllocations do receipt;
- paymentMethod null quando houver múltiplas allocations.

Isso é correto.

Não inventar:

~~~text
Pedido #143 = Dinheiro
Pedido #156 = Pix
~~~

quando o receipt foi misto.

A verdade é:

~~~text
#143 e #156 foram quitados no mesmo recebimento,
cuja composição foi Dinheiro + Pix.
~~~

## 29. Financeiro / Movimentações

O modelo atual de Finance deve continuar:

- movimentos por allocation;
- agrupamento visual por receipt onde aplicável;
- receipt total mostrado uma vez;
- breakdown das formas;
- total financeiro calculado a partir dos movimentos reais sem duplicidade.

O novo receipt de cliente não deve aparecer como N vendas independentes apenas porque contém N payments.

Regressão obrigatória:

- um receipt R$ 69 em Dinheiro R$ 30 + Pix R$ 39;
- Finance mostra total R$ 69 uma vez;
- breakdown mostra 30/39;
- entradas brutas continuam somando 69.

## 30. Reporting

Reporting já usa:

- payment_receipts para recebido;
- payment_allocations para mix;
- payments para vínculo de pedido.

O novo receipt deve ser compatível sem regra especial.

Regressões obrigatórias:

- Recebido aumenta uma vez pelo receipt total;
- mix aumenta pelos valores das allocations;
- dois pedidos pagos deixam de compor A receber;
- nenhum KPI multiplica receipt por quantidade de pedidos.

Não redesenhar Reporting nesta feature.

## 31. Estorno

A regra atual de estorno continua integral por pedido.

Quando um pedido pertence a receipt compartilhado:

- mostrar composição do receipt como contexto;
- não afirmar que uma allocation pertence individualmente ao pedido;
- se o receipt for misto, exigir escolha explícita de uma forma ativa para o estorno, como já ocorre para pagamento misto;
- estorno continua no valor integral do payment do pedido.

Estorno dividido permanece fora do escopo.

## 32. Promessa de pagamento

PromisedPaymentDate continua pertencendo ao pedido.

No agrupamento:

- timing de cada pedido continua individual;
- alterar promessa afeta somente o pedido escolhido;
- grupo é recalculado após a alteração;
- um mesmo cliente pode possuir pedidos em atraso, hoje e futuros simultaneamente.

O agrupamento nunca transforma promessa individual em promessa do cliente inteiro.

## 33. Resumos superiores

Receber hoje, Próximos e Em atraso preservam semântica atual baseada em pedidos.

As quantidades continuam sendo quantidades de recebíveis/pedidos, não quantidade de clientes.

O modo Por cliente é somente uma nova apresentação e operação de seleção.

Uma métrica secundária de concentração por clientes pode ser adicionada como polish se for simples, mas não é critério de aceite funcional da V1.

## 34. Lista de pedidos

O modo Lista de pedidos deve preservar o comportamento atual o máximo possível:

- ledger plano;
- detalhe lateral;
- bottom sheet;
- busca;
- filtros;
- ordenação;
- quick payment por pedido;
- promessa;
- previsão.

Isso fornece fallback operacional e reduz risco de rollout.

## 35. Quitados

Quitados permanece plano nesta V1.

Razões:

- principal dor está na baixa de pendências;
- agrupamento histórico criaria novas decisões sobre receipts compartilhados e período;
- não é necessário para realizar a operação.

Quitados deve continuar exibindo composição de pagamento já suportada pelo read model.

## 36. Capability e offline

Preservar capabilities existentes.

Onde canReceivePayments é falso:

- seleção pode ser visível para leitura;
- CTAs de receber ficam ausentes/desabilitados conforme padrão atual;
- nenhuma mutação é chamada.

Offline:

- grupos, filtros e detalhe podem continuar legíveis;
- seleção pode ser mantida localmente se não causar confusão;
- confirmação de recebimento fica desabilitada;
- não enfileirar pagamento para envio posterior;
- não aplicar estado Pago otimista.

## 37. Limite de lote

A operação deve possuir limite defensivo de quantidade de orderIds.

Alvo inicial recomendado para a V1:

~~~text
100 pedidos por recebimento
~~~

O plano pode reduzir esse valor se testes de D1/batch indicarem necessidade.

Acima do limite:

- UI não permite Selecionar todos além do limite sem aviso;
- backend rejeita payload.

A regra existe para manter tempo de transação e número de statements controlados.

## 38. Acessibilidade

Requisitos obrigatórios:

- cards/grupos acessíveis por teclado;
- expansão com aria-expanded;
- checkboxes com labels incluindo pedido e valor;
- Selecionar todos com nome acessível;
- estado selecionado não depende só de cor;
- timing possui texto;
- foco visível;
- modal de pagamento preserva focus trap do Modal atual;
- mobile touch target >= 44 px;
- barra fixa respeita safe area;
- nenhum valor monetário é truncado;
- reduced motion respeitado;
- erros da composição usam role/semântica já existente.

## 39. Temas e responsividade

Homologar:

- desktop claro;
- desktop escuro;
- mobile claro;
- mobile escuro.

A feature não cria nova paleta.

Usar tokens Mesiva atuais.

Breakpoints devem seguir a infraestrutura existente de A Receber e mobile foundation em vez de criar um sistema paralelo.

## 40. Estados vazios e mensagens

### Sem pendências

~~~text
Tudo recebido por aqui
Quando houver um pedido pendente, ele aparecerá automaticamente nesta tela.
~~~

### Filtro sem grupos

~~~text
Nenhum recebimento neste filtro
Tente outro período ou ajuste a busca.
~~~

### Busca sem resultado

~~~text
Nenhum cliente ou pedido encontrado
Revise a busca ou os filtros.
~~~

### Cliente sem pedidos após sync

Fechar seleção/painel e remover o grupo automaticamente.

### Conflito durante pagamento

~~~text
Os pedidos selecionados foram alterados.
Atualize os dados e tente novamente.
~~~

## 41. Mensagem de sucesso

Após recebimento conjunto:

~~~text
Recebimento registrado
2 pedidos de Fernanda Albuquerque foram quitados.
~~~

Se a composição tiver uma forma, a notificação global pode manter padrão equivalente a:

~~~text
Pagamento recebido via Pix
~~~

Para várias formas:

~~~text
Pagamento recebido em 2 formas
~~~

Evitar mensagem que atribua método específico a cada pedido.

## 42. Sem migration esperada

Com a master inspecionada, o schema atual já suporta:

- receipt compartilhado;
- allocations;
- vários payments apontando para o mesmo receipt;
- movimentos por allocation.

Portanto **não é esperada migration de schema** para a função principal.

O plano deve confirmar isso com testes reais e query plan.

Só adicionar índice/migration se houver evidência de necessidade; não criar coluna ou tabela apenas por conveniência.

## 43. Boundaries arquiteturais

### app/workflows/payments

Owner de:

- tentativa de recebimento conjunto;
- composição;
- modal de confirmação;
- owner/double submit;
- API cross-domain;
- reconciliação.

### domains/finance

Owner de:

- A Receber;
- agrupamento/projeção de recebíveis;
- filtros;
- detalhe financeiro;
- apresentação de seleção.

Finance não deve escrever payment diretamente.

### domains/orders

Owner de:

- regras de elegibilidade do pedido;
- status pago/cancelado;
- read model do pedido;
- identidade pública do pedido.

### domains/customers

Owner do cadastro do cliente.

A Receber pode consumir clientId/nome/telefone públicos; não absorve edição de cliente.

### worker/paymentRepository.js

Owner preferencial do writer financeiro.

Pode ser refatorado em helpers internos para compartilhar lógica entre:

- pedido avulso;
- comanda;
- lote de cliente.

Não duplicar dezenas de statements sem necessidade se uma extração pequena tornar invariantes mais claros.

### worker/index.js

Somente dispatch/autorização básica e delegação.

## 44. Estratégia de reutilização no backend

O plano deve avaliar extração de helpers de paymentRepository para:

- validar methods/policy;
- criar receipt;
- criar allocations;
- marcar first_used_at;
- criar movements por allocation;
- construir payload de resposta.

registerOrderPayment, registerTableTabPayment e o novo registerClientOrdersPayment devem continuar com semânticas próprias de seleção de pedidos.

Não criar uma abstração genérica opaca que esconda regras de comanda/cliente.

## 45. Testes obrigatórios — domínio de A Receber

Cobrir no mínimo:

1. dois pedidos do mesmo clientId formam um grupo;
2. nomes iguais com clientIds diferentes não agrupam;
3. nomes iguais sem clientId não agrupam;
4. cancelados não agrupam;
5. pagos não agrupam;
6. table-tab não aparece;
7. Todos soma todos os pedidos elegíveis;
8. Em atraso agrega apenas overdue;
9. Hoje agrega apenas today;
10. Próximos agrega apenas upcoming;
11. data exata agrega somente aquela expectedDate;
12. total do grupo respeita filtro;
13. pior timing do grupo é determinístico;
14. ordenação por urgência;
15. ordenação por valor;
16. busca por cliente;
17. busca por telefone;
18. busca por pedido/produto.

## 46. Testes obrigatórios — frontend

Cobrir no mínimo:

1. Por cliente é padrão em Pendentes;
2. Lista de pedidos preserva ledger atual;
3. Quitados não mostra seletor de agrupamento;
4. grupo renderiza nome/quantidade/total/timing;
5. expandir/fechar;
6. aria-expanded;
7. selecionar um pedido;
8. selecionar vários do mesmo cliente;
9. Selecionar todos respeita filtro;
10. seleção não atravessa cliente;
11. total selecionado recalcula;
12. barra fixa mobile;
13. painel desktop;
14. N=1 reutiliza caminho oficial permitido;
15. N>1 abre ClientOrdersPaymentDialog;
16. ClientOrdersPaymentDialog usa PaymentCompositionEditor;
17. método padrão + total;
18. adicionar segunda forma;
19. soma abaixo bloqueia;
20. soma acima bloqueia;
21. método duplicado bloqueia;
22. método inativo exige revisão;
23. offline bloqueia submit;
24. sem capability bloqueia submit;
25. double click = um POST;
26. 409 atualiza e mantém verdade oficial;
27. network/5xx não faz POST automático;
28. sucesso remove somente pedidos pagos;
29. pedido não selecionado continua pendente;
30. light/dark/mobile/desktop sem overflow.

## 47. Testes obrigatórios — backend

Cobrir no mínimo:

1. dois pedidos do mesmo cliente + Pix;
2. dois pedidos + Dinheiro/Pix;
3. três formas;
4. um único receipt;
5. N payments;
6. M allocations;
7. M movements;
8. soma receipt = soma payments = soma allocations = soma movements;
9. movement sem order_id/payment_id individual inventado;
10. pedido de outro cliente rejeita tudo;
11. clientId errado rejeita tudo;
12. pedido pago rejeita tudo;
13. pedido cancelado rejeita tudo;
14. table-tab rejeita tudo;
15. pedido inexistente rejeita tudo;
16. orderIds duplicados rejeitam;
17. soma abaixo rejeita;
18. soma acima rejeita;
19. método duplicado rejeita;
20. método inativo rejeita;
21. policy muda no commit => rollback total;
22. pedido é pago concorrente => rollback total;
23. falha intermediária => rollback total;
24. business isolation;
25. limite de lote;
26. first_used_at correto;
27. read model dos N pedidos aponta para mesmo receipt;
28. composição mista retorna paymentMethod null;
29. Finance reconcilia;
30. Reporting reconcilia.

## 48. Regressões obrigatórias

- pagamento simples de pedido continua funcionando;
- split payment de pedido continua funcionando;
- pagamento de comanda continua funcionando;
- Salvar e receber continua funcionando;
- quick payment na Lista de pedidos continua funcionando;
- promessa de pagamento continua funcionando;
- forecast continua funcionando;
- Finance continua agrupando receipt visualmente;
- Dashboard/Reporting não duplica receita;
- estorno simples continua;
- estorno de receipt misto continua exigindo escolha explícita;
- impressão automática não muda;
- fila de impressão não muda;
- nenhum import de QZ novo fora da infraestrutura autorizada.

## 49. Homologação manual em staging

Registrar PASS / FAIL / BLOCKED.

### Agrupamento

1. cliente com um pedido;
2. cliente com três pedidos;
3. dois clientes com mesmo nome, ids diferentes;
4. dois convidados com mesmo nome permanecem separados;
5. cliente com overdue + today + upcoming;
6. filtros alteram total do grupo;
7. busca por nome;
8. busca por telefone;
9. busca por pedido;
10. Lista de pedidos preservada.

### Seleção

11. selecionar um;
12. selecionar dois;
13. selecionar todos;
14. desmarcar;
15. trocar cliente sem seleção cruzada;
16. mobile sticky bar;
17. desktop side panel.

### Pagamento

18. dois pedidos 100% Pix;
19. dois pedidos 100% Dinheiro;
20. dois pedidos Dinheiro + Pix;
21. três formas;
22. soma abaixo bloqueia;
23. soma acima bloqueia;
24. método duplicado bloqueia;
25. método desativado durante modal exige revisão;
26. double click não duplica;
27. offline bloqueia;
28. conflito de outro dispositivo.

### Pós-pagamento

29. somente selecionados somem de Pendentes;
30. não selecionado permanece;
31. Finance mostra um receipt;
32. breakdown por forma correto;
33. Reporting recebido não duplica;
34. mix por forma correto;
35. Quitados mostra composição;
36. refund posterior continua coerente.

### Visual

37. desktop escuro;
38. desktop claro;
39. mobile escuro;
40. mobile claro;
41. teclado/foco;
42. sem erro novo no console.

## 50. Rollout

Sequência recomendada depois de Spec e plano aprovados:

1. criar branch de feature a partir da master validada;
2. TDD de domínio de agrupamento;
3. TDD do backend atômico;
4. TDD do workflow frontend;
5. UI desktop;
6. UI mobile;
7. regressões Finance/Reporting/refund;
8. full gates;
9. staging;
10. homologação guiada;
11. correções;
12. merge somente após autorização explícita;
13. produção somente após autorização explícita separada.

## 51. Critérios de aceite

A feature estará pronta quando:

- [ ] Por cliente é o modo padrão de Pendentes;
- [ ] Lista de pedidos atual continua disponível;
- [ ] agrupamento usa clientId;
- [ ] convidados iguais não são agrupados por nome;
- [ ] comandas continuam fora;
- [ ] filtros agregam apenas pedidos do recorte;
- [ ] grupo mostra total e quantidade corretos;
- [ ] usuário consegue expandir cliente;
- [ ] usuário consegue selecionar subset de pedidos;
- [ ] não é possível misturar clientes no mesmo recebimento;
- [ ] um pedido selecionado continua pagável;
- [ ] múltiplos pedidos abrem o editor oficial de composição;
- [ ] múltiplas formas continuam suportadas;
- [ ] pagamento parcial continua impossível;
- [ ] backend recalcula o total oficial;
- [ ] um único receipt representa a ação;
- [ ] cada pedido recebe exatamente um payment integral;
- [ ] allocations pertencem ao receipt;
- [ ] movements pertencem às allocations;
- [ ] nenhuma allocation é atribuída artificialmente a um pedido;
- [ ] operação é atômica;
- [ ] conflito não deixa pagamento parcial;
- [ ] Finance mostra o receipt uma vez;
- [ ] Reporting conta recebido uma vez;
- [ ] mix por forma reconcilia;
- [ ] pedidos não selecionados permanecem pendentes;
- [ ] promise/forecast não regressam;
- [ ] mobile e desktop estão homologados;
- [ ] light/dark estão homologados;
- [ ] testes/architecture/lint/build/D1 gates passam;
- [ ] produção não ocorre sem autorização explícita.

## 52. Decisões finais consolidadas

- **Agrupamento seguro usa clientId.**
- **Por cliente vira a visão principal de Pendentes.**
- **Lista de pedidos atual permanece disponível.**
- **Quitados permanece plano na V1.**
- **Convidados sem clientId não são agrupados por nome.**
- **Comandas permanecem fora de A Receber avulso.**
- **Seleção múltipla é limitada a um cliente por vez.**
- **Selecionar todos respeita o filtro atual.**
- **O PaymentCompositionEditor existente é obrigatório.**
- **Uma ou várias formas de pagamento continuam suportadas.**
- **Pagamento parcial continua proibido.**
- **Múltiplos pedidos são quitados em uma única operação atômica.**
- **Um receipt pode quitar vários pedidos avulsos do mesmo cliente.**
- **As allocations pertencem ao receipt, não a pedidos individuais.**
- **Movimentos são criados uma vez por allocation, não por pedido.**
- **Finance e Reporting devem reconciliar pelo receipt.**
- **Nenhuma migration estrutural é esperada na direção atual.**
- **Sem estado financeiro otimista.**
- **Sem retry automático de POST após resultado incerto.**
- **Sem mudança funcional de Printing/QZ.**

## 53. Autorrevisão

Esta Spec foi revisada contra a master 0273e1f7c52eb38da9e93e4abbb580de924bf36d.

### 53.1 Risco: duplicar a UI de pagamento

Tratado: o novo fluxo deve reutilizar PaymentCompositionEditor.

### 53.2 Risco: reintroduzir pagamento parcial

Tratado: frontend e backend continuam exigindo soma exata ao total oficial.

### 53.3 Risco: pagar pedidos em sequência e parar no meio

Tratado: N>1 exige endpoint e transação atômica.

### 53.4 Risco: agrupar pessoas só pelo nome

Tratado: agrupamento usa clientId; guest_name permanece individual.

### 53.5 Risco: misturar clientes em um receipt

Tratado: seleção visual é escopada a um grupo e backend valida o mesmo clientId.

### 53.6 Risco: atribuir Pix/Dinheiro a pedidos arbitrariamente

Tratado: allocations pertencem ao receipt; payments só representam quitação integral de cada pedido.

### 53.7 Risco: duplicar receita no Finance

Tratado: M movements por M allocations e agrupamento visual por receipt.

### 53.8 Risco: duplicar recebido no Reporting

Tratado: payment_receipts continua a fonte de recebido.

### 53.9 Risco: quebrar comanda

Tratado: table-tab é rejeitado pelo novo writer e continua no workflow próprio.

### 53.10 Risco: perder comportamento atual de A Receber

Tratado: Lista de pedidos permanece como modo alternativo e os recursos de promise/forecast são preservados.

### 53.11 Risco: criar estado otimista incorreto

Tratado: aplicar somente resposta oficial e sync.

### 53.12 Risco: extrapolar schema sem necessidade

Tratado: schema atual já suporta receipt compartilhado; migration só entra se plano provar necessidade.

## 54. Gate para o próximo passo

Depois da aprovação explícita desta Spec:

1. escrever plano TDD detalhado;
2. mapear tasks e dependências;
3. autorrevisar o plano contra esta Spec;
4. criar branch de implementação separada;
5. não implementar antes da aprovação do plano;
6. não trabalhar diretamente em master;
7. não fazer deploy de produção.
