# Redesign de A Receber e Previsão de Recebimentos

**Data:** 2026-09-06  
**Status:** proposta consolidada para aprovação  
**Branch:** `feature/receivables-forecast-redesign`  
**Base:** `master` em `63293039f885f31c4f9f1717e3226eedc897882b`

## 1. Objetivo

Transformar a tela **A receber** de uma coleção de cards pesados em uma ferramenta operacional de cobrança e previsão financeira, com leitura rápida no celular e alta produtividade no desktop.

A nova experiência deve responder, sem exigir cálculos manuais, a quatro perguntas:

1. quanto ainda precisa entrar hoje;
2. quanto está realmente atrasado;
3. quanto está previsto para datas futuras e em qual dia;
4. quais valores já foram quitados.

A mudança também introduz a **data prometida de pagamento**, opcional, para os poucos casos em que um cliente informa que pagará depois. Essa data não substitui nem altera a data original do pedido.

## 2. Contexto e regras do negócio aprovadas

### 2.1 Não existe vencimento padrão

O negócio não trabalha com prazo padrão de pagamento, vencimento em X dias ou calendário fixo de cobrança.

A expectativa normal é:

> **o pedido deve ser pago no mesmo dia em que foi feito.**

Logo, quando não houver uma promessa explícita do cliente, a referência financeira é a própria `orderDate` do pedido.

### 2.2 Data prometida é exceção, não regra

Alguns clientes dizem algo como “pago sexta”, “pago no fim da semana” ou indicam uma data específica. Nesses casos o operador poderá registrar uma **Data prometida de pagamento**.

Exemplo:

- pedido feito em 06/09;
- ainda não pago;
- cliente promete pagamento em 11/09;
- até 10/09 o item é futuro/próximo;
- em 11/09 aparece como **Hoje**;
- a partir de 12/09, se não tiver sido pago, aparece como **Em atraso**.

### 2.3 A data do pedido é imutável para essa finalidade

Registrar ou alterar uma promessa de pagamento não pode modificar:

- `orderDate`;
- `createdAt`;
- andamento operacional/cozinha;
- total do pedido;
- histórico do pedido.

A promessa é apenas uma referência adicional de cobrança/previsão.

### 2.4 Sem pagamentos parciais

A experiência terá somente os estados financeiros principais:

- **Pendente**;
- **Quitado**.

Não haverá aba `Parciais`, saldo parcial, valor pago parcialmente ou edição de saldo. O pagamento continua sendo integral, como já funciona atualmente.

## 3. Decisão de arquitetura

### 3.1 Fonte de verdade

O **pedido continua sendo a fonte de verdade do recebível**. Não será criada uma nova tabela de “contas a receber”.

A solução recomendada é adicionar ao pedido um campo opcional:

```text
promised_payment_date TEXT NULL
```

A migration será aditiva, prevista como `0012`, preservando todos os pedidos existentes.

Pedidos antigos terão `promised_payment_date = NULL` e continuarão válidos; nesses casos a data de referência será `order_date`.

### 3.2 Por que não criar uma tabela separada

Uma tabela própria de recebíveis criaria duplicação de estado entre pedido, pagamento e cobrança. Hoje já existe relação 1:1 entre pedido e pagamento final, e o sistema não suporta pagamentos parciais.

Manter a promessa no pedido oferece:

- migração simples e reversível em nível de aplicação;
- nenhuma duplicação de valor/status;
- integração natural com o bootstrap atual;
- menor risco de inconsistência com pagamentos e cancelamentos;
- menor quantidade de joins e endpoints novos.

### 3.3 Histórico de alterações da promessa

A primeira versão **não criará histórico de renegociações**. Será persistida apenas a promessa atual.

A data original do pedido já preserva a referência histórica essencial. Caso futuramente seja necessário medir quantas vezes um cliente adiou um pagamento, isso deverá ser implementado como uma trilha de eventos separada, sem bloquear esta entrega.

## 4. Modelo de status temporal

O status financeiro existente (`Pago`/`Pendente`) permanece separado do status temporal de cobrança.

Para um pedido pendente e não cancelado:

```text
dataEsperada = promisedPaymentDate ?? orderDate
```

Comparando `dataEsperada` com a data local de negócio usada atualmente pelo sistema:

| Condição | Status temporal |
|---|---|
| dataEsperada < hoje | `overdue` / Em atraso |
| dataEsperada = hoje | `today` / Hoje |
| dataEsperada > hoje | `upcoming` / Próximos |
| pedido pago | `paid` / Quitado |
| pedido cancelado | excluído de A receber |

O atraso será calculado por dias de calendário:

```text
diasAtrasado = hoje - dataEsperada
```

Exemplos de texto:

- `Pagamento esperado hoje`;
- `Prometido para 11/09`;
- `Amanhã`;
- `Em 3 dias`;
- `Atrasado há 1 dia`;
- `Atrasado há 4 dias`.

O status temporal **não será salvo no banco**. Ele é derivado em tempo real, evitando jobs de virada de dia e estados obsoletos.

A interface deve atualizar a classificação ao mudar o dia, mesmo se permanecer aberta. A implementação deverá disparar uma atualização leve na virada da data local; não deve depender de uma escrita no banco para transformar um item em atrasado.

### 4.1 Pedidos agendados

Nesta versão, `scheduledFor` **não altera automaticamente a expectativa financeira**. A regra aprovada continua sendo `promisedPaymentDate ?? orderDate`.

Se futuramente o negócio decidir que pedidos agendados só devem ser cobrados no dia da entrega/retirada, isso será uma regra separada e explícita.

## 5. Estrutura visual da nova tela

A direção visual aprovada é baseada no terceiro mockup: painel financeiro compacto no topo, controles simples e uma lista tipo ledger, sem grandes cards por cliente.

### 5.1 Cabeçalho

Conteúdo:

- eyebrow `Financeiro` ou identificação visual equivalente do sistema;
- título `A receber`;
- descrição curta: `Acompanhe o que entra hoje, os próximos recebimentos e os atrasos.`;
- botão de ícone de gráfico no canto direito, com `aria-label="Previsão de recebimentos"`.

### 5.2 Resumo operacional

Três blocos compactos e clicáveis:

#### Receber hoje

- ícone: calendário/recebimento;
- valor total de todos os pendentes cuja data esperada é hoje;
- quantidade de pedidos/recebíveis;
- tom visual positivo/verde discreto.

#### Próximos

- ícone: calendário + relógio;
- valor total de todos os pendentes com data esperada futura;
- quantidade;
- tom informativo/azulado ou neutro.

#### Em atraso

- ícone: alerta;
- valor total de todos os pendentes cuja data esperada já passou;
- quantidade;
- tom danger/vermelho.

Os três blocos devem particionar o universo de pendentes. A soma dos seus valores representa o saldo pendente total.

Ao tocar/clicar em um bloco, a tela deverá:

1. selecionar `Pendentes`;
2. aplicar o filtro correspondente;
3. levar o foco visual à lista.

### 5.3 Abas principais

Somente:

- **Pendentes**;
- **Quitados**.

Não existe `Parciais`.

Cada aba pode mostrar uma contagem discreta.

### 5.4 Filtros de pendentes

Na aba Pendentes:

- `Todos`;
- `Hoje`;
- `Próximos`;
- `Em atraso`.

Esses filtros devem ser botões/chips com ícones e estado selecionado acessível (`aria-pressed` ou semântica equivalente).

Na aba Quitados, os filtros temporais de pendência ficam ocultos, pois não têm significado operacional.

### 5.5 Busca

A busca existente será preservada.

Deve localizar por pelo menos:

- nome/identificação do cliente;
- número do pedido;
- produto/resumo do pedido;
- tipo do pedido.

A busca poderá também considerar texto derivado de data prometida/status, desde que isso não complique a implementação.

No desktop o campo fica permanentemente visível. No mobile pode permanecer compacto, mas não deverá ser removido da funcionalidade.

## 6. Lista de pendentes

### 6.1 Lista plana em vez de cards por cliente

A lista principal deixa de agrupar visualmente clientes em grandes cards. Cada recebível padrão será uma linha compacta.

Isso é necessário porque pedidos diferentes do mesmo cliente podem possuir promessas de pagamento diferentes.

A repetição do nome do cliente em duas linhas é preferível a esconder datas distintas dentro de um card agregado.

### 6.2 Anatomia de cada linha

Cada linha deve conter:

- avatar por iniciais ou ícone coerente com a identificação;
- nome/identificação do cliente;
- número do pedido;
- valor integral pendente;
- contexto de data;
- status temporal com texto e ícone;
- chevron/indicação de abertura de detalhes.

Exemplos de contexto:

```text
Pedido feito hoje • Pagamento esperado hoje
Pedido feito 06/09 • Prometido para 11/09
Pedido feito 05/09 • Atrasado há 2 dias
```

A cor nunca deve ser a única indicação de status.

### 6.3 Ordenação

Para Pendentes, o padrão será **Mais urgente**:

1. atrasados, com os mais antigos primeiro;
2. itens de hoje;
3. futuros, com a data mais próxima primeiro;
4. empate por criação mais antiga.

O usuário poderá escolher, no mínimo:

- Mais urgente;
- Mais recente;
- Maior valor.

Para Quitados, o padrão será **Mais recente**, com base em `paidAt`.

## 7. Quitados

A aba Quitados usa a mesma linguagem visual compacta, porém sem ações de cobrança.

Cada linha deve mostrar:

- cliente/identificação;
- pedido;
- valor pago;
- data do pagamento;
- forma de pagamento quando disponível;
- status `Quitado`.

A promessa de pagamento pode continuar disponível no detalhe para contexto histórico, mas não pode mais ser editada depois da quitação.

## 8. Detalhe do recebível

O mesmo conteúdo será usado em mobile e desktop, com apresentação responsiva diferente.

### 8.1 Conteúdo

Para pedido padrão:

- cliente;
- pedido #XXXX;
- valor;
- status temporal;
- data do pedido;
- `Data prometida de pagamento` ou `Não definida`;
- explicação curta:

> A data prometida é opcional. Sem ela, o pagamento é esperado para o mesmo dia do pedido.

Ações, quando o pedido está pendente:

- **Registrar recebimento**;
- **Definir data prometida** ou **Alterar data prometida**;
- **Ver pedido**.

Se já houver promessa, a edição também permitirá **Remover data prometida**.

Pedido quitado: somente ações de consulta; sem registrar pagamento e sem editar promessa.

### 8.2 Mobile: bottom sheet

Em telas estreitas, tocar na linha abre um **bottom sheet**.

Requisitos:

- renderização via portal fora de containers que usem `transform`, evitando problemas de posicionamento fixo;
- `role="dialog"`/semântica equivalente;
- foco gerenciado corretamente;
- botão de fechar explícito;
- rolagem interna se o conteúdo exceder a altura;
- respeitar `safe-area-inset-bottom` e a navegação inferior;
- alvos de toque de pelo menos 44 px.

### 8.3 Desktop: painel lateral

Em viewport largo, selecionar uma linha abre/atualiza um painel lateral direito sticky.

Estrutura:

- lista permanece à esquerda;
- detalhe fica à direita;
- linha selecionada recebe realce discreto;
- não há modal primário para navegar entre vários recebíveis;
- ações são as mesmas do bottom sheet.

Breakpoint recomendado para o split view: aproximadamente 900–960 px, ajustado durante implementação para encaixar na estrutura atual do AppShell.

## 9. Definir ou alterar data prometida

A ação abre um formulário pequeno e focado.

Campos:

- `Data prometida de pagamento` — formato de data de calendário;
- nenhuma hora;
- nenhuma parcela;
- nenhum valor.

Regras de validação:

- `NULL` significa sem promessa;
- nova data deve ser uma data ISO válida `YYYY-MM-DD`;
- ao definir/alterar, a data deve ser hoje ou futura;
- não é permitido definir manualmente uma promessa já no passado;
- pedido pago não pode receber/alterar promessa;
- pedido cancelado não pode receber/alterar promessa.

Ao remover uma promessa de um pedido antigo, a referência volta imediatamente para `orderDate`. Se isso fizer o pedido ficar atrasado, o formulário deve avisar antes de salvar, por exemplo:

> Sem a data prometida, este pedido será classificado como atrasado.

Remover a promessa não apaga nem altera o pedido.

## 10. API e persistência

### 10.1 Migration 0012

Proposta:

```sql
ALTER TABLE orders ADD COLUMN promised_payment_date TEXT;
CREATE INDEX orders_business_promised_payment_idx
  ON orders (business_id, promised_payment_date);
```

A coluna é nullable e não exige backfill.

### 10.2 Leitura

`promised_payment_date` deverá fazer parte de todas as leituras oficiais de pedido usadas por:

- bootstrap;
- `GET /api/orders`;
- respostas de mutações de pedido.

Mapeamento de domínio:

```js
promisedPaymentDate: row.promised_payment_date ?? null
```

### 10.3 Endpoint de escrita

Novo endpoint recomendado:

```http
PATCH /api/orders/:id/payment-promise
Content-Type: application/json
```

Payload para definir/alterar:

```json
{
  "promisedPaymentDate": "2026-09-11"
}
```

Payload para remover:

```json
{
  "promisedPaymentDate": null
}
```

Resposta:

```json
{
  "order": { "...": "pedido oficial atualizado" }
}
```

A mutação deve:

- validar sessão e `business_id` como os demais endpoints;
- bloquear pedidos inexistentes, cancelados ou pagos;
- validar formato e regra de data;
- alterar somente `promised_payment_date`;
- não criar pagamento;
- não criar movimento financeiro;
- não alterar status operacional;
- retornar o pedido atualizado pelo mapper oficial.

Códigos de erro recomendados:

- `INVALID_PROMISED_PAYMENT_DATE` — data inválida;
- `PROMISED_PAYMENT_DATE_IN_PAST` — data anterior a hoje;
- `ORDER_ALREADY_PAID` — pedido já quitado;
- `ORDER_CANCELLED` — pedido cancelado.

## 11. Pagamento e integração com Financeiro

A forma de pagamento atual continua sendo a única responsável por quitar o pedido.

Ao registrar recebimento:

1. o pagamento integral é criado;
2. o pedido passa a `Pago`;
3. o movimento automático de entrada continua sendo criado no Financeiro;
4. o item sai de Pendentes e aparece em Quitados;
5. `promisedPaymentDate`, se existir, pode permanecer armazenada como contexto histórico.

A promessa de pagamento **nunca** gera entrada no caixa. Previsão e caixa realizado devem permanecer conceitos separados.

O fluxo existente de seleção de forma de pagamento (`Pix`, `Dinheiro`, cartões, transferência etc.) será reutilizado. Não deverá existir uma segunda implementação da lógica de pagamento dentro de A receber.

## 12. Ação rápida Registrar recebimento

A direção visual permite uma ação rápida, especialmente no mobile.

### Mobile

- FAB acima da navegação inferior;
- visível somente quando nenhum detalhe/modal estiver aberto;
- rótulo/tooltip acessível `Registrar recebimento`.

### Desktop

- ação equivalente no cabeçalho/toolbar, sem necessidade de FAB flutuante.

Fluxo:

1. abrir seletor pesquisável de pendências;
2. escolher pedido;
3. chamar o fluxo existente de pagamento integral;
4. selecionar forma de pagamento;
5. confirmar.

Nesta primeira versão, o seletor rápido pode priorizar pedidos comuns. Pagamentos agregados de comanda permanecem disponíveis na linha/painel da própria comanda.

## 13. Comandas/mesas — não regressão

A tela atual permite quitar todos os pedidos pendentes de uma comanda de uma vez. Esse comportamento deve ser preservado.

Para comandas abertas:

- manter uma linha agregada por comanda/mesa;
- mostrar quantidade de pedidos e total;
- manter `Registrar pagamento da comanda`;
- pagamento continua quitando todos os pedidos pendentes juntos;
- **não expor edição de data prometida para comandas nesta versão**.

Para classificação temporal da linha agregada, usar a data de pedido mais recente dentre os pedidos pendentes da comanda como referência operacional. Isso evita classificar a comanda como atrasada por uma linha antiga enquanto ela ainda recebe novos pedidos no dia atual.

Essa regra de agregação é específica da representação da comanda e não altera as datas individuais dos pedidos.

## 14. Ícone de gráfico: Previsão de recebimentos

O botão de gráfico abre uma visão analítica leve chamada **Previsão de recebimentos**.

Não será criado um novo módulo Financeiro nem adicionada biblioteca de gráficos nesta entrega.

Conteúdo mínimo:

- total/count de Em atraso;
- total/count de Hoje;
- próximos 7 dias, agrupados por data, com valor e quantidade;
- agregado `Depois` para valores com data esperada posterior à janela de 7 dias;
- `Recebido hoje` como métrica de realizado, claramente separado da previsão.

Representação recomendada:

- barras horizontais simples construídas com CSS;
- valor e quantidade sempre visíveis em texto;
- cada dia pode ser clicável para fechar o resumo e filtrar a lista para aquela data.

Isso entrega a previsibilidade desejada, por exemplo:

```text
Hoje       R$ 180,00
Seg 07/09  R$ 95,00
Ter 08/09  R$ 0,00
Qua 09/09  R$ 240,00
...
```

No mobile, a previsão abre em painel/modal de altura ampla; no desktop pode usar dialog grande ou drawer lateral.

## 15. Cálculos e utilitários de domínio

A lógica temporal deve ficar fora do componente visual, em funções puras testáveis.

Responsabilidades recomendadas:

- obter data esperada efetiva;
- classificar `today/upcoming/overdue/paid`;
- calcular dias de atraso;
- ordenar por urgência;
- calcular os três resumos;
- agrupar previsão diária.

Exemplo conceitual:

```js
getExpectedPaymentDate(order)
getReceivableTiming(order, today)
getDaysOverdue(order, today)
calculateReceivableSummary(orders, today)
buildReceivablesForecast(orders, today, 7)
```

Componentes React não devem reimplementar comparação de datas.

## 16. Sincronização, concorrência e offline

A alteração deve seguir o modelo atual do app:

- mutação confirmada pelo servidor;
- resposta oficial aplicada à coleção `orders`;
- bootstrap periódico continua reconciliando alterações de outros dispositivos;
- sem update otimista que possa deixar a previsão incorreta.

Offline:

- lista, filtros e previsão continuam legíveis a partir do estado disponível;
- Registrar recebimento e alterar promessa ficam desabilitados;
- usar o mesmo padrão visual de indisponibilidade já existente no app.

Se outro dispositivo alterar a promessa, a próxima sincronização deve atualizar os resumos, status e ordenação automaticamente.

## 17. Acessibilidade e UX

Requisitos:

- touch targets mínimos de 44 px no mobile;
- estado de filtro não indicado somente por cor;
- status com texto + ícone;
- contraste compatível com o tema atual e meta WCAG AA;
- foco visível em teclado;
- linhas interativas com semântica de botão/link adequada, não `div` clicável sem teclado;
- bottom sheet com foco controlado;
- valores monetários nunca truncados silenciosamente;
- datas em formato legível pt-BR na UI e ISO no transporte/persistência;
- respeitar `prefers-reduced-motion` para transições do sheet/painel.

## 18. Estados vazios

### Pendentes vazio

```text
Tudo recebido por aqui
Quando houver um pedido pendente, ele aparecerá automaticamente nesta tela.
```

### Filtro sem resultados

```text
Nenhum recebimento neste filtro
Tente outro período ou ajuste a busca.
```

### Quitados vazio

```text
Nenhum recebimento registrado ainda
Os pedidos pagos aparecerão aqui.
```

### Previsão sem futuros

Mostrar hoje/atrasados normalmente e mensagem discreta:

```text
Nenhum recebimento futuro programado.
```

## 19. Estratégia responsiva

### Até aproximadamente 900–960 px

- layout de coluna única;
- resumos compactos, permitindo scroll horizontal apenas se necessário em telas muito estreitas;
- filtros com rolagem horizontal sem quebrar em múltiplas linhas confusas;
- lista ledger;
- detalhe em bottom sheet;
- FAB de pagamento acima da bottom nav;
- padding final suficiente para nenhum item ficar coberto.

### Desktop largo

- resumos em linha;
- busca, filtros e ordenação com melhor uso horizontal;
- área principal em duas colunas quando houver item selecionado;
- lista flexível à esquerda;
- painel de detalhes sticky à direita;
- ação Registrar recebimento no cabeçalho/toolbar.

O conteúdo e as regras são idênticos; muda somente a composição.

## 20. Escopo de implementação

### Incluído

- redesign responsivo completo de A receber;
- Pendentes/ Quitados;
- filtros de timing;
- lista compacta;
- painel de detalhes mobile/desktop;
- data prometida persistida;
- endpoint para definir/alterar/remover promessa;
- cálculo de atraso;
- previsão por dia;
- resumo via ícone de gráfico;
- ação rápida de recebimento;
- preservação de pagamento de comanda;
- integração atual com Financeiro;
- migration aditiva;
- testes de domínio, API e UI.

### Fora de escopo

- pagamento parcial;
- juros, multa ou correção monetária;
- notificações automáticas ao cliente;
- envio de cobrança por WhatsApp;
- histórico de renegociações;
- prazo padrão por cliente;
- data de vencimento padrão global;
- alteração automática da promessa baseada em `scheduledFor`;
- nova biblioteca de gráficos;
- novo módulo financeiro separado;
- paginação/backend dedicado para histórico de quitados nesta primeira versão;
- edição da promessa durante a criação do pedido.

## 21. Estratégia de TDD e testes

A implementação deverá seguir TDD estrito: teste RED antes de cada mudança relevante.

### 21.1 Domínio

Cobrir no mínimo:

- pedido de hoje sem promessa => Hoje;
- pedido antigo sem promessa => Em atraso;
- pedido antigo com promessa futura => Próximos;
- promessa hoje => Hoje;
- promessa passada naturalmente pelo decorrer dos dias => Em atraso;
- cálculo de `diasAtrasado`;
- pago => Quitado, fora dos pendentes;
- cancelado => excluído;
- summaries somam corretamente;
- previsão agrupa por data e mantém valores exatos;
- ordenação por urgência.

### 21.2 Migration

Teste de contrato para `0012` verificando:

- coluna nullable;
- ausência de backfill destrutivo;
- índice esperado.

### 21.3 Repository/mappers

Cobrir:

- leitura da coluna no bootstrap;
- leitura no endpoint de orders;
- mapper retorna `promisedPaymentDate`;
- pedido sem coluna preenchida retorna `null`.

### 21.4 Endpoint

Cobrir:

- definir promessa;
- alterar promessa;
- remover promessa;
- rejeitar formato inválido;
- rejeitar data passada;
- rejeitar pedido pago;
- rejeitar pedido cancelado;
- garantir isolamento por business;
- garantir que a mutação não cria `payment` nem `movement`.

### 21.5 UI

Cobrir contratos para:

- apenas Pendentes e Quitados;
- cards-resumo Receber hoje/Próximos/Em atraso;
- chips Todos/Hoje/Próximos/Em atraso;
- lista sem grandes `.receivable-client-card` para pedidos comuns;
- status com texto;
- bottom sheet mobile via portal;
- painel lateral desktop;
- definir/alterar/remover promessa;
- touch targets;
- busca preservada;
- ação do gráfico;
- ação rápida de pagamento.

### 21.6 Regressões obrigatórias

- pagamento integral comum continua criando movimento automático;
- pagamento da comanda continua quitando o grupo;
- cancelamento e estorno não mudam;
- pedidos já pagos continuam mapeados como pagos;
- Financeiro não contabiliza promessa como entrada;
- sync existente continua atualizando orders.

## 22. Migração e rollout

1. desenvolver em branch de feature isolada;
2. executar testes, lint, build e dry-runs;
3. aplicar `0012` no D1 de staging;
4. publicar em staging;
5. homologar regras de data com cenários reais;
6. homologar mobile e desktop;
7. somente após aprovação explícita, mergear para `master`;
8. aplicar migration em produção pelo workflow controlado;
9. validar login, listagem, promessa, pagamento e Financeiro.

A migration é aditiva. Em rollback de aplicação, a coluna pode permanecer no banco sem impacto; uma versão antiga simplesmente a ignora. Não deve haver migration destrutiva de rollback.

## 23. Critérios de aceite

A funcionalidade estará pronta para produção quando todos os itens abaixo forem verdadeiros:

- um pedido não pago sem promessa é esperado na própria `orderDate`;
- no dia seguinte, sem pagamento, ele aparece automaticamente como atrasado;
- uma promessa futura impede que o item seja considerado atrasado antes da data prometida;
- depois da promessa passar, o atraso é calculado contra a data prometida;
- o usuário consegue definir, alterar e remover a promessa;
- a data original do pedido nunca é modificada;
- pagamentos continuam integrais;
- não existe UI/estado de pagamento parcial;
- top summary mostra valores corretos de Hoje, Próximos e Em atraso;
- a previsão mostra exatamente quanto é esperado em cada um dos próximos 7 dias;
- Pendentes e Quitados funcionam e são pesquisáveis;
- mobile usa bottom sheet e não perde ações ao rolar;
- desktop usa painel lateral sem tirar contexto da lista;
- Registrar recebimento continua alimentando o Financeiro somente no pagamento real;
- comandas continuam podendo ser quitadas integralmente;
- offline não permite mutações;
- testes, lint, build, bundle e migrations passam;
- staging é homologado antes de qualquer produção.

## 24. Decisões finais consolidadas

- **Sem vencimento padrão.**
- **Sem pagamento parcial.**
- **Sem nova tabela de contas a receber.**
- **Data prometida é opcional e fica no pedido.**
- **Sem promessa: `orderDate` é a data esperada.**
- **Com promessa: a promessa controla Hoje/Próximos/Atraso.**
- **Status temporal é calculado, não persistido.**
- **Pagamento real continua sendo a única entrada no caixa.**
- **Mobile: bottom sheet. Desktop: painel lateral.**
- **A tela principal usa lista compacta, não cards grandes por cliente.**
- **O gráfico é uma previsão leve por dia, não um novo módulo financeiro.**
