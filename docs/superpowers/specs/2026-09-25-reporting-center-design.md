# Centro de Relatórios — Design v2

**Issue:** #34 — Feature: Centro de Relatórios operacionais, vendas e produtos  
**Base inspecionada:** `master` em `6445098aef8332890b854f6eb8524b5f9c053b8f`  
**Branch documental:** `docs/issue-34-reporting-center-v2`  
**Implementation plan:** `docs/superpowers/plans/2026-09-25-reporting-center-plan.md` — auto-revisado; aguardando aprovação do usuário  
**Status:** APPROVED — lógica, arquitetura, direção visual, estratégia mobile e fronteira com A Receber aprovadas em conversa em 2026-09-25  
**Data:** 2026-09-25  
**Referência visual:** Mesiva — Guia oficial de identidade visual e aplicação no produto, v1.0. Superfícies afetadas: Centro de Relatórios, navegação Financeiro e exportações. Estados e temas a verificar: claro/escuro, loading, vazio, erro, dados parciais, filtros ativos, desktop completo e mobile resumido. Exceções aprovadas: o mobile não replica a densidade analítica completa do desktop; ações de recebimento permanecem fora de Reporting.

## 1. Contexto e motivo desta revisão

O Issue #34 foi aberto em 2026-09-09 e já possuía um design inicial em `docs/reporting-center-design`. Essa branch ficou historicamente útil, mas divergiu fortemente da arquitetura atual do produto.

Desde então o sistema passou por mudanças estruturais relevantes:

- a modularização frontend da Spec C foi concluída;
- Orders, Finance, Catalog, Customers, Table Service e Printing possuem ownership e public boundaries definidos;
- o Dashboard tornou-se uma superfície de composição em `src/app/surfaces/dashboard`;
- a navegação administrativa passou a usar React Router;
- pagamentos divididos foram normalizados com `payment_receipts` e `payment_allocations`;
- a política operacional passou a ser configurável e pedidos terminais preservam `timing_policy_snapshot_json`;
- o cálculo canônico de prazo já existe em `shared/orderTiming.js`;
- Top 10 produtos e Refeições vendidas já existem no Dashboard;
- as antigas dependências #15, #21, #28 e #30 foram concluídas.

Portanto, este documento substitui o design de 2026-09-09 como proposta vigente para implementação do Issue #34. O documento antigo permanece histórico e não deve ser usado como base de código.

## 2. Objetivo

Criar um Centro de Relatórios gerencial, responsivo e confiável para análise de:

1. visão geral do negócio;
2. operação;
3. vendas e recebimentos;
4. produtos;
5. dados detalhados e drill-down;
6. exportações.

O Centro de Relatórios deve responder perguntas gerenciais sem transformar o navegador em motor analítico e sem duplicar regras de domínio já existentes.

A regra principal é:

> O backend calcula e agrega a verdade oficial; o frontend consulta, navega, filtra e apresenta.

## 3. Resultados esperados

Ao concluir a V1, um usuário autorizado deve conseguir:

- selecionar um período e filtros;
- entender vendas, volume, ticket médio, recebimentos, pendências, cancelamentos e estornos;
- entender volume e desempenho operacional por tipo, horário e dia;
- acompanhar cumprimento do prazo operacional vigente;
- entender quais produtos/categorias vendem mais e geram mais receita de mercadoria;
- abrir uma visão detalhada dos pedidos que compõem um indicador;
- exportar o recorte atual;
- compartilhar/reabrir a mesma análise por URL;
- usar uma experiência desktop completa e uma experiência mobile resumida de consulta;
- consultar pendências financeiras sem duplicar o fluxo operacional de baixa existente em A Receber;
- confiar que o mesmo filtro produz a mesma regra no backend, exportação e drill-down.

## 4. Não objetivos da V1

Não fazem parte desta primeira versão:

- BI livre ou construtor arbitrário de consultas;
- dashboards customizáveis por usuário;
- relatórios salvos;
- envio agendado por e-mail/WhatsApp;
- forecast de vendas;
- custo de mercadoria, margem, CMV ou estoque;
- folha/pessoas;
- cohort ou análise avançada de clientes;
- materialized views ou tabelas agregadas permanentes por padrão;
- data warehouse externo;
- processamento assíncrono de relatórios;
- replicar a fila operacional da Cozinha;
- editar configurações operacionais pelo Centro de Relatórios;
- criar uma segunda biblioteca visual paralela;
- refazer o Dashboard existente na mesma primeira slice;
- reproduzir no mobile toda a densidade analítica/tabela do desktop;
- registrar pagamento, alterar promessa ou executar baixa financeira dentro de Relatórios.

## 5. Decisões principais desta revisão

### 5.1 Reporting é um bounded context de leitura

Criar `src/domains/reporting` no frontend e um módulo dedicado de reporting no Worker.

Reporting não passa a ser dono de Orders, Finance, Products ou Customers. Ele é dono de:

- contrato de consulta analítica;
- filtros e paginação do relatório;
- semântica das métricas;
- agregações;
- comparação entre períodos;
- drill-down;
- modelo canônico de exportação.

As entidades originais continuam pertencendo aos respectivos domínios.

### 5.2 Não adicionar `preparation_started_at` na V1

O design antigo previa um novo timestamp de início de preparo. Hoje isso seria uma segunda fonte para um conceito que já possui regra canônica.

A V1 deve reutilizar:

- `getOperationalStartAt`;
- `getScheduledLateAt`;
- `getOrderLateAt`;
- `getOperationalDurationMinutes`;
- `selectOrderTimingPolicy`;
- `timing_policy_snapshot_json`.

Para pedidos terminais, o snapshot histórico define a política usada. Pedidos históricos sem snapshot seguem a regra legada já existente. Pedidos retroativos continuam fora das métricas de tempo.

Um novo timestamp só será criado no futuro se uma evidência real mostrar que a derivação atual não consegue representar um caso histórico necessário.

### 5.3 Prazo operacional, não uma segunda “meta” duplicada

A V1 deve medir `dentro do prazo operacional` usando a política vigente/histórica já configurada pelo produto.

Não criar, dentro de Reporting, um segundo recurso de “meta de preparo por modalidade”. Se o produto decidir que precisa de uma meta analítica diferente do prazo operacional, isso deverá ser modelado como uma configuração própria, versionada e historicamente congelável, em uma feature separada.

### 5.4 Pagamentos divididos são fonte oficial

Para recebimentos:

- `payment_receipts` representa o ato de recebimento;
- `payment_allocations` representa a composição por forma de pagamento;
- `payments` relaciona o recebimento aos pedidos;
- `movements` continua sendo a fonte de movimentos financeiros/estornos.

Não inferir mix de pagamento concatenando `payments.method`.

### 5.5 Produtos usam snapshots históricos

Relatórios de produto devem usar `order_items` e seus snapshots:

- `product_id` quando existir;
- `name_snapshot`;
- `category_snapshot`;
- `size_snapshot`;
- `quantity`;
- `unit_price_cents`.

Alterar ou remover um produto do catálogo atual não pode reescrever o relatório histórico.

### 5.6 Entrega não é receita de produto

A receita líquida por produto deve reconciliar com a receita líquida de mercadoria, não com o total do pedido incluindo taxa de entrega.

Por pedido:

- receita de mercadoria = `total_cents - delivery_fee_cents`;
- o ajuste de pedido já está refletido nessa receita de mercadoria;
- essa receita é distribuída proporcionalmente entre as linhas do pedido;
- a taxa de entrega é exibida separadamente em Vendas;
- arredondamento em centavos deve ser determinístico.

### 5.7 Desktop completo; mobile resumido

A experiência completa do Centro de Relatórios é desenhada para desktop/tablet amplo, onde há espaço para filtros, múltiplos KPIs, gráficos comparativos, rankings, tabela detalhada, seleção de colunas e exportações.

No mobile, Reporting continua acessível, mas como uma experiência de consulta resumida:

- período e filtros essenciais;
- KPIs principais;
- comparação com período anterior;
- gráficos simples e legíveis;
- Top produtos e resumos relevantes;
- drill-down em lista/cards compactos quando fizer sentido.

Não reproduzir no telefone uma tabela desktop comprimida nem a seleção avançada de colunas. Recursos analíticos densos podem informar claramente `Disponível na versão desktop` quando não houver uma adaptação mobile que preserve qualidade.

### 5.8 Reporting analisa recebíveis; A Receber executa a baixa

A tela existente `Financeiro -> A receber` continua sendo a superfície operacional oficial para:

- registrar recebimento;
- executar baixa;
- lidar com promessa de pagamento;
- localizar e resolver pendências financeiras.

Reporting pode mostrar saldo, quantidade, envelhecimento e drill-down de recebíveis, mas não oferece ação de pagamento/baixa.

A regra de ownership é:

> Relatórios explica o que está pendente e por quê; A Receber é onde o usuário resolve a pendência.

## 6. Navegação e arquitetura de informação

### 6.1 Destino principal

Adicionar um único destino principal:

- id: `reports`;
- path: `/relatorios`;
- label: `Relatórios`;
- area: `finance`;
- capability: `reports.view`.

No desktop, Relatórios entra no grupo FINANCEIRO, preferencialmente após Visão geral.

A área Financeiro passa a conter:

1. Visão geral;
2. Relatórios;
3. A receber;
4. Movimentações.

No mobile, não criar um quarto botão principal. O acesso continua pelo item Financeiro e pela navegação interna da área, abrindo a versão resumida de consulta. A experiência analítica completa permanece no desktop.

### 6.2 Views internas

O Centro de Relatórios mantém um único destination route. A aba interna fica na query string:

- `/relatorios?view=overview`;
- `/relatorios?view=operation`;
- `/relatorios?view=sales`;
- `/relatorios?view=products`;
- `/relatorios?view=detail`.

Isso evita multiplicar destinos globais e preserva:

- deep link;
- F5;
- Back/Forward;
- bookmark;
- filtros na URL;
- root administrativo persistente.

### 6.3 Estado de consulta

O estado analítico do Centro de Relatórios fica na URL, não em cópia local das coleções oficiais.

Exemplos de parâmetros:

- `from`;
- `to`;
- `type`;
- `schedule`;
- `status`;
- `paymentMethod`;
- `category`;
- `product`;
- `customer`;
- `orderHourFrom`;
- `orderHourTo`;
- `sort`;
- `page`;
- `pageSize`.

Parâmetros inválidos são normalizados/rejeitados pelo backend; o frontend nunca assume que uma query manual na URL é confiável.

## 7. Organização de projeto proposta

### 7.1 Frontend

`src/domains/reporting/`

- `index.js` — public boundary mínima;
- `domain/reportingQuery.js` — normalização/presentação do estado de consulta, sem agregações oficiais;
- `infrastructure/reportingApi.js` — contrato HTTP;
- `application/useReportingQuery.js` — carregamento, abort/stale-result protection, retry por bloco;
- `ui/ReportingWorkspace.jsx` — composição da superfície;
- `ui/ReportingFilters.jsx`;
- `ui/ReportingTabs.jsx`;
- `ui/views/OverviewReport.jsx`;
- `ui/views/OperationReport.jsx`;
- `ui/views/SalesReport.jsx`;
- `ui/views/ProductsReport.jsx`;
- `ui/views/DetailReport.jsx`;
- `ui/components/*` — componentes exclusivos do domínio;
- `export/*` — serializadores de arquivo que recebem modelo oficial, sem recalcular métricas;
- testes próximos ao owner quando adequado.

O App apenas compõe `ReportingWorkspace` e não calcula KPIs do Centro.

### 7.2 Backend / Worker

`worker/reporting/`

- `api.js` — dispatch e envelopes HTTP;
- `query.js` — validação/normalização de filtros;
- `repository.js` — SQL e read models;
- `service.js` — semântica de métricas e comparação;
- `productRevenue.js` — alocação determinística da receita de mercadoria;
- `exportModel.js` — modelo canônico de exportação;
- testes de unidade e SQLite real.

`worker/index.js` apenas autentica/autoriza e delega para o módulo.

### 7.3 Shared

Criar `shared/reportingContract.js` apenas se houver necessidade real de compartilhar:

- ids de views;
- enums de ordenação;
- limites de paginação;
- nomes canônicos de filtros.

Não mover fórmulas de negócio para `shared` apenas para reutilização no frontend.

As regras temporais permanecem em `shared/orderTiming.js` e as regras de data financeira em `shared/finance.js`.

## 8. Fluxo arquitetural

`D1 -> Reporting Repository -> Reporting Service -> Reporting API -> Reporting frontend / Export adapters`

Regras:

1. D1 é a fonte oficial.
2. Repository faz seleção/agregação e retorna read models tipados por contrato.
3. Service aplica semântica que não cabe em SQL sem clareza, como comparação e alocação.
4. API valida autorização, filtros, limites e envelopes.
5. Frontend não recebe coleções inteiras para refazer agregação.
6. Exportação recebe o mesmo modelo/camada de serviço do relatório.
7. Nenhuma consulta aceita `business_id` fornecido pelo navegador.
8. `business_id` sempre vem do contexto autenticado.

## 9. Fontes oficiais de dados

### 9.1 Pedidos

`orders`:

- `business_id`;
- `order_number`;
- `order_date`;
- `type`;
- `status`;
- `scheduled_for`;
- `is_backdated`;
- `subtotal_cents`;
- `delivery_fee_cents`;
- ajustes;
- `total_cents`;
- `created_at`;
- `finished_at`;
- `cancelled_at`;
- `timing_policy_snapshot_json`;
- snapshots de cliente.

### 9.2 Itens

`order_items`:

- identidade do pedido;
- produto;
- snapshots de nome/categoria/tamanho;
- quantidade;
- preço efetivo.

### 9.3 Financeiro

- `payment_receipts`;
- `payment_allocations`;
- `payments`;
- `movements`.

### 9.4 Operação

- `business_operation_settings` para política ativa;
- `timing_policy_snapshot_json` para histórico terminal;
- helpers de `shared/orderTiming.js`.

## 10. Modelo temporal e timezone

Timezone oficial: `America/Sao_Paulo`.

Nenhum agrupamento diário pode usar corte UTC como se fosse data do negócio.

### 10.1 Data base por família de métrica

Métricas comerciais de pedidos e produtos:

- usam `orders.order_date`.

Métricas de recebimento:

- usam a data de negócio derivada de `payment_receipts.paid_at`.

Estornos/saídas de refund:

- usam `movements.movement_date`.

Métricas operacionais históricas:

- população selecionada por `orders.order_date`;
- duração deriva de timestamps operacionais.

Cancelamento:

- taxa de cancelamento usa a população de pedidos cujo `order_date` está no período;
- uma análise futura de “cancelamentos ocorridos no dia” deve ser um indicador separado baseado em `cancelled_at`, não uma troca silenciosa da fórmula.

### 10.2 Período inicial

Ao entrar em Relatórios sem query:

- início = primeiro dia do mês atual;
- fim = data atual do negócio.

Atalhos:

- Hoje;
- 7 dias;
- 30 dias;
- Mês atual;
- Mês anterior;
- Personalizado.

Intervalo é inclusivo em datas de negócio.

### 10.3 Limite V1

Intervalo customizado máximo padrão: 366 dias.

Uma necessidade maior deve ser tratada explicitamente no plano de performance, não liberada por acidente.

## 11. Comparação com período anterior

Cada métrica comparável retorna:

- valor atual;
- valor anterior;
- delta absoluto;
- delta percentual quando o denominador permitir;
- semântica de direção: `higher_better`, `lower_better` ou `neutral`.

Regras de período:

- Hoje compara com ontem;
- 7 dias compara com os 7 dias imediatamente anteriores;
- 30 dias compara com os 30 dias imediatamente anteriores;
- Mês atual compara 1..N com 1..N do mês anterior, com clipping quando necessário;
- Mês anterior compara com o mês imediatamente anterior;
- Personalizado compara com intervalo contíguo anterior de igual número de dias.

Ausência de base anterior deve retornar comparação indisponível, não 0%.

## 12. Filtros

### 12.1 Filtros globais

Aplicáveis quando semanticamente válidos:

- período;
- modalidade: Entrega / Retirada / Local;
- imediato / agendado;
- status;
- categoria;
- produto;
- cliente.

### 12.2 Filtros contextuais

Vendas:

- forma de pagamento.

Operação:

- hora operacional;
- dia da semana;
- dentro/fora do prazo.

Produtos:

- categoria;
- nome/identidade do produto.

Detalhado:

- todos os filtros compatíveis;
- busca textual;
- ordenação;
- paginação.

### 12.3 Matriz de aplicabilidade

Um filtro não pode ser silenciosamente ignorado.

A UI deve:

- exibir somente filtros válidos para a view atual; ou
- marcar claramente quando um filtro global não se aplica a uma métrica.

Exemplo: forma de pagamento não deve alterar “Pedidos criados” sem uma associação financeira explícita.

## 13. Populações oficiais

### 13.1 Pedidos comerciais válidos

Para vendas, ticket, produtos e volume comercial:

- pedido persistido;
- `order_date` no período;
- status diferente de `Cancelado`.

Pedidos em preparo podem compor vendas registradas, preservando a semântica atual do Dashboard. Se forem cancelados depois, deixam de compor a verdade atual do relatório.

`is_backdated` não exclui venda; ele exclui apenas métricas temporais que fingiriam medir operação real.

### 13.2 Pedidos operacionais elegíveis

Para duração e cumprimento histórico:

- pedido não cancelado;
- `is_backdated !== true`;
- status terminal concluído;
- timestamps válidos;
- duração derivável pela política histórica correta.

Estados históricos legados `Entregue` e `Despachado` devem ser tratados como terminais quando ainda existirem no banco.

### 13.3 Recebíveis

“A receber” deve seguir a semântica financeira oficial:

- pedido não cancelado;
- não pago;
- não pertencente a comanda aberta como recebível avulso;
- valor pendente > 0.

Não reintroduzir comandas abertas em A receber apenas porque Reporting consulta D1 diretamente.

O mesmo recorte usado por Reporting deve preservar a regra operacional atual: comanda aberta é atendimento em andamento, não recebível avulso.

## 14. Métricas — Visão Geral

### 14.1 Vendas registradas

Soma de `total_cents` dos pedidos comerciais válidos do período.

### 14.2 Pedidos

Quantidade de pedidos comerciais válidos.

### 14.3 Ticket médio

`vendas / pedidos`.

Sem pedidos: valor indisponível/zero conforme contrato explícito, sem divisão inválida.

### 14.4 Recebido no período

Soma de `payment_receipts.total_cents` cujo `paid_at` cai no período financeiro.

Cada receipt conta uma vez.

### 14.5 A receber do período

Saldo dos recebíveis oficiais associados aos pedidos do recorte operacional selecionado.

O rótulo da UI deve ser **A receber do período** para deixar claro que o valor não representa necessariamente todo o saldo atual da empresa.

Esse indicador é analítico. Ao clicar, o usuário pode abrir o drill-down dos pedidos pendentes do mesmo recorte e navegar por uma ação explícita `Gerenciar em A receber` para a tela operacional existente.

Reporting não registra pagamento e não executa baixa.

### 14.6 Taxa de cancelamento

`pedidos cancelados / todos os pedidos do período antes da exclusão comercial`.

### 14.7 Estornos

Soma de movimentos `source = 'order-refund'` no período financeiro.

### 14.8 Prazo operacional

Percentual de pedidos operacionais elegíveis finalizados dentro de `lateAt`.

Não chamar essa métrica de “meta” enquanto não existir uma meta analítica separada aprovada.

## 15. Métricas — Operação

A view Operação deve incluir:

- pedidos por hora operacional;
- pedidos por dia da semana;
- volume por Entrega / Retirada / Local;
- imediato vs agendado;
- duração operacional média;
- mediana de duração operacional;
- P90 quando a amostra for suficiente;
- mais rápido e mais lento;
- duração média por modalidade;
- pedidos dentro do prazo;
- pedidos fora do prazo;
- percentual dentro do prazo;
- atraso médio dos pedidos atrasados;
- pontualidade dos agendados;
- distribuição em faixas de duração.

### 15.1 Início operacional

Usar `getOperationalStartAt`.

Para agendado, isso preserva a janela de preparo. Para imediato, corresponde ao início canônico já definido pelo produto.

### 15.2 Duração operacional

`finishedAt - operationalStartAt`.

### 15.3 Tempo total

Pode ser exibido separadamente:

`finishedAt - createdAt`.

Para pedidos agendados, esse tempo inclui espera planejada e nunca deve substituir duração operacional.

### 15.4 Dentro do prazo

`finishedAt <= getOrderLateAt(order, historicalPolicy)`.

### 15.5 Pontualidade agendada

População:

- agendado;
- concluído;
- operacionalmente elegível.

Dentro do prazo agendado quando:

`finishedAt <= getScheduledLateAt(order, historicalPolicy)`.

### 15.6 Volume por hora

Usar hora local do `operationalStartAt` para a análise operacional.

Não reutilizar automaticamente `created_at`, pois um pedido agendado pode ter sido criado muito antes de entrar em operação.

## 16. Métricas — Vendas e Financeiro

A view Vendas deve incluir:

- vendas registradas;
- quantidade de pedidos;
- ticket médio;
- receita de mercadoria;
- taxa de entrega;
- ajustes/descontos/acréscimos;
- recebido;
- a receber do período;
- cancelamentos;
- estornos;
- mix por forma de pagamento;
- série temporal de vendas;
- série temporal de pedidos;
- série temporal de recebimentos.

### 16.1 Mix de pagamento

Somar `payment_allocations.amount_cents` por `method_code/method_label`, a partir dos receipts do período.

Pagamentos divididos aparecem em mais de um método com os valores reais de cada allocation.

### 16.2 Venda não é recebimento

Um pedido pode:

- estar vendido e ainda não pago;
- ser pago em data posterior;
- ser pago por mais de um método.

A interface deve deixar a distinção visível.

### 16.3 Estorno não apaga venda original

O relatório financeiro apresenta estorno como evento financeiro próprio. A venda comercial de um pedido cancelado deixa de entrar na população comercial líquida conforme a regra de pedidos válidos, mas o ato financeiro de estorno permanece rastreável em sua data.

### 16.4 Integração com A Receber

Na view Vendas, o bloco de pendências pode decompor `A receber do período` em informações como:

- valor pendente;
- quantidade de pedidos pendentes;
- vencido;
- em dia;
- promessa futura quando houver dados oficiais.

Esses números servem para análise e drill-down. A ação de contexto deve ser `Gerenciar em A receber`, que navega para a superfície financeira oficial sem duplicar modal, workflow, capabilities, offline/retry ou reconciliação de pagamento dentro de Reporting.

## 17. Métricas — Produtos

A view Produtos deve incluir:

- unidades vendidas;
- Top 10 produtos;
- ranking completo;
- Refeições vendidas;
- receita líquida de mercadoria por produto;
- receita por categoria;
- quantidade por categoria;
- apresentação/tamanho quando disponível;
- participação no mix;
- comparação com período anterior;
- drill-down para os pedidos que compõem o produto.

### 17.1 Refeições vendidas

Preservar o contrato já homologado no Dashboard:

- categoria `Refeições`;
- categoria legada `Marmita`.

Somar `quantity`.

### 17.2 Identidade do produto histórico

Agrupar prioritariamente por `product_id`.

Quando `product_id` não existir, usar uma identidade de fallback determinística baseada nos snapshots, sem fundir silenciosamente produtos distintos.

O label apresentado vem do snapshot histórico, com tratamento de múltiplos labels se o mesmo id mudou de nome ao longo do tempo.

### 17.3 Receita líquida por produto

Para cada pedido comercial válido:

1. calcular o bruto de cada linha: `unit_price_cents * quantity`;
2. calcular a receita líquida de mercadoria do pedido: `total_cents - delivery_fee_cents`;
3. distribuir a diferença entre linhas proporcionalmente ao bruto;
4. distribuir centavos residuais por algoritmo determinístico;
5. garantir reconciliação exata por pedido;
6. não atribuir taxa de entrega a produtos.

Pedido com base de linhas inválida/zero deve entrar em estado de qualidade de dados e não gerar alocação fictícia.

## 18. View detalhada e drill-down

A view Detail é a explicação auditável do agregado.

Desktop:

- tabela paginada;
- ordenação server-side;
- seleção de colunas;
- busca;
- filtros;
- ação para abrir detalhes do pedido.

Mobile:

- lista de cards/linhas adaptadas;
- sem tabela horizontal obrigatória;
- mesmas informações essenciais e mesmos filtros.

Colunas candidatas:

- número do pedido;
- data;
- horário;
- cliente;
- modalidade;
- agendado/imediato;
- status;
- total;
- recebido/pendente;
- formas de pagamento;
- itens;
- início operacional;
- duração;
- prazo;
- atraso;
- cancelamento;
- data do recebimento.

### 18.1 Drill-down por indicador

Clicar em um KPI/gráfico/ranking deve navegar para `view=detail` acrescentando filtros necessários à URL.

Exemplos:

- Top produto -> product;
- Cancelados -> status=Cancelado;
- Entrega -> type=Entrega;
- fora do prazo -> operationalDeadline=late;
- Pix -> paymentMethod=pix.

O drill-down usa o mesmo contrato de filtro do backend, não um filtro local sobre dados já carregados.

### 18.2 Drill-down de recebíveis

O KPI `A receber do período` e análises derivadas abrem `view=detail` com o recorte de pendências correspondente.

O detalhe pode oferecer `Gerenciar em A receber` / `Ver em A receber` como navegação para a tela oficial. Não mostrar `Registrar pagamento` dentro de Reporting.

## 19. API proposta

Todos os endpoints são autenticados e escopados ao business do servidor.

### 19.1 Summary

`GET /api/reporting/overview`

Retorna KPIs e comparações.

### 19.2 Operation

`GET /api/reporting/operation`

Retorna KPIs operacionais, buckets por hora/dia/modalidade e cobertura de dados.

### 19.3 Sales

`GET /api/reporting/sales`

Retorna KPIs comerciais/financeiros, séries e payment mix.

### 19.4 Products

`GET /api/reporting/products`

Retorna KPIs, ranking e agregações por categoria/apresentação.

### 19.5 Detail

`GET /api/reporting/orders`

Retorna:

- `items`;
- `page`;
- `pageSize`;
- `total`;
- `totalPages`;
- `sort`;
- `normalizedQuery`.

### 19.6 Export model

`POST /api/reporting/export-model`

Recebe somente filtros/view/colunas validados e retorna um modelo canônico pronto para serialização.

Motivo do POST:

- payload pode ter filtros/colunas compostos;
- não representa mutação de negócio;
- continua sujeito a mesma-origin e autenticação;
- evita URL excessiva em exportações complexas.

Se o plano provar que GET é suficiente e mais simples, pode ajustar sem mudar a semântica.

## 20. Envelope de resposta

Cada endpoint analítico deve expor no mínimo:

- `generatedAt`;
- `timezone`;
- `normalizedQuery`;
- `data`;
- `comparison` quando aplicável;
- `quality`;
- `warnings` somente quando houver informação relevante.

`quality` deve permitir representar:

- amostra elegível;
- amostra usada;
- dados legados;
- dados inválidos/ignorados;
- métrica indisponível.

Frontend não transforma `unavailable` em zero.

## 21. Qualidade e cobertura histórica

Para métricas de tempo, retornar cobertura explícita.

Exemplo conceitual:

- `eligibleCount`;
- `measuredCount`;
- `legacyPolicyCount`;
- `invalidCount`.

`legacyPolicyCount` significa que o pedido terminal não possuía snapshot e foi calculado com `LEGACY_TIMING` conforme regra oficial atual.

Isso é diferente de ausência de dados.

A UI deve informar cobertura baixa quando ela puder alterar a interpretação do indicador.

## 22. Exportações

Formatos V1:

- CSV;
- XLSX;
- PDF.

### 22.1 Fonte de verdade

Exportação não recalcula métricas.

Fluxo:

`filtros -> Reporting Service -> export model -> serializer`.

### 22.2 CSV

Focado na view detalhada.

- UTF-8 com BOM quando necessário para Excel em pt-BR;
- cabeçalhos em português;
- datas legíveis;
- valores monetários sem perder precisão;
- respeita filtros e colunas escolhidas.

### 22.3 XLSX

Mesmo dataset detalhado/canônico do CSV, com tipos de célula adequados.

O projeto não possui hoje biblioteca XLSX. A dependência deve ser escolhida no plano após revisar:

- tamanho do bundle;
- manutenção;
- licença;
- compatibilidade Vite/browser;
- necessidade real de geração no cliente.

Não adicionar dependência nesta fase de design.

### 22.4 PDF

PDF é relatório executivo, não dump da tabela completa.

Deve incluir:

- operação/identidade;
- período;
- filtros relevantes;
- data/hora de geração;
- principais KPIs;
- gráficos/tabelas resumidos;
- indicação de cobertura quando necessária.

O projeto já possui `jspdf`. Preferir reutilização se o plano comprovar que atende layout e volume.

### 22.5 Limite de exportação

V1 deve ter limite explícito de linhas detalhadas. Proposta inicial: 10.000.

Acima do limite:

- não truncar silenciosamente;
- retornar erro funcional;
- orientar o usuário a reduzir o período/filtros.

## 23. Performance e D1

### 23.1 Princípios

- agregação no SQL sempre que apropriado;
- não carregar todos os pedidos do período no browser;
- não usar o bootstrap como fonte do Centro;
- paginação real no backend;
- queries separadas por bloco quando isso melhorar isolamento/retry;
- evitar N+1;
- limites de range e page size.

### 23.2 Índices

Não criar índices por adivinhação.

O plano deve inspecionar `EXPLAIN QUERY PLAN` e só então decidir migrations.

Candidatos a validar:

- `orders (business_id, order_date, status)`;
- `orders (business_id, created_at)`;
- `payment_receipts (business_id, paid_at)` — já existe;
- `payment_allocations (business_id, method_code, created_at)` — já existe;
- `order_items (business_id, order_id)`;
- `movements (business_id, movement_date) WHERE deleted_at IS NULL` — já existe equivalente.

### 23.3 Sem materialização inicialmente

Não criar tabela diária de métricas na primeira versão.

Materialização só entra se medição com volume representativo provar necessidade.

## 24. Concorrência, requests e stale results

Trocar filtros rapidamente não pode aplicar uma resposta antiga por cima da nova.

O controller frontend deve:

- identificar cada query;
- abortar request anterior quando possível;
- rejeitar resposta stale por geração;
- manter último resultado válido enquanto atualiza, quando UX permitir;
- suportar retry por seção;
- não disparar export com filtros diferentes dos visíveis.

## 25. Loading, vazio e erro

Estados mínimos:

- carregamento inicial;
- atualização de filtros;
- bloco carregando;
- bloco com erro;
- página com erro;
- período sem resultados;
- métrica sem amostra;
- comparação indisponível;
- cobertura histórica parcial;
- exportação preparando;
- exportação excede limite.

Erro em um gráfico não precisa apagar KPIs já carregados se endpoints independentes permitirem isolamento.

## 26. Permissões

Adicionar ao catálogo:

- `reports.view`;
- `reports.export`.

`reports.view`:

- acessa o destination;
- consulta endpoints de reporting.

`reports.export`:

- habilita export model/serialização.

Sessões legadas autenticadas continuam recebendo o catálogo amplo conforme regra vigente. Contextos limitados devem respeitar as novas capabilities sem fallback indevido.

Nenhuma capability deve ser aceita do corpo/query do navegador.

## 27. Relação com o Dashboard atual

O Dashboard atual possui cálculos client-side para:

- vendas;
- quantidade;
- ticket médio;
- séries;
- Top 10;
- Refeições vendidas;
- mix de pagamentos.

Não refatorar o Dashboard obrigatoriamente na primeira task do Centro de Relatórios.

Estratégia:

1. Reporting nasce com backend canônico.
2. Testes de paridade cobrem métricas sobrepostas.
3. Centro de Relatórios usa apenas Reporting API.
4. Após homologação das regras, uma slice posterior pode migrar o Dashboard para consumir um summary de Reporting.
5. Só então remover cálculos client-side redundantes, se não houver consumidor legítimo.

Isso reduz o blast radius sem institucionalizar duas verdades no longo prazo.

## 28. Identidade visual Mesiva v1.0

A implementação deve seguir o guia vigente.

Direção:

- superfícies claras + texto marinho no tema claro;
- superfícies escuras + texto claro validado no escuro;
- sidebar, menus, tooltips, modais e estados acompanham o tema;
- formas arredondadas e hierarquia clara;
- densidade útil nas tabelas e filtros;
- espaçamento compatível com tokens existentes/múltiplos de 4 px;
- sem degradês decorativos atrás dos dados;
- português do Brasil;
- valores/números priorizam legibilidade.

Cores de marca não substituem semântica:

- verde-água não significa automaticamente sucesso;
- amarelo não significa automaticamente alerta;
- sucesso, erro, atenção, informação, foco e seleção mantêm tokens próprios;
- não usar branco sobre verde-água/amarelo para texto normal sem contraste validado.

Não introduzir biblioteca visual paralela.

## 29. Responsividade

### Desktop

- filtros em barra/painel compacto;
- KPIs em grid;
- gráficos em grid responsivo;
- detalhado em tabela;
- sticky header/filtros somente se não prejudicar altura útil.

### Mobile — consulta resumida

O mobile não tenta reproduzir toda a estação analítica do desktop.

Priorizar:

- seletor de período;
- filtros essenciais em sheet/modal;
- chips de filtros ativos;
- KPIs principais em 1–2 colunas;
- comparação com período anterior;
- evolução resumida;
- Top produtos;
- resumos de Operação/Vendas;
- drill-down em cards/lista quando necessário;
- links claros para a experiência desktop quando uma função densa não tiver boa adaptação móvel.

Ficam desktop-first na V1:

- tabela analítica completa;
- seleção avançada de colunas;
- grandes combinações de filtros simultâneos;
- visualizações com alta densidade;
- fluxo completo de análise detalhada.

O mobile nunca executa uma ação financeira apenas porque um recebível apareceu em Reporting. Para baixa, navegar para A Receber.

Homologar pelo menos 320 px e um viewport mobile representativo, sem scroll horizontal estrutural.

## 30. Acessibilidade

- títulos/hierarquia semântica;
- controles por teclado;
- foco visível;
- filtros e tabs com labels;
- gráficos com resumo textual/tabela acessível;
- informação não depende somente de cor;
- contraste conforme metas do guia;
- loading anunciado sem spam;
- botões icon-only com nome acessível;
- valores ocultáveis apenas se esse comportamento for deliberadamente reaproveitado do Dashboard.

## 31. TDD obrigatório

### 31.1 Query contract

Cobrir:

- datas válidas/inválidas;
- timezone;
- range > limite;
- enums;
- paginação;
- sort allowlist;
- caracteres especiais;
- query desconhecida;
- defaults.

### 31.2 Repository com SQLite real

Cobrir:

- isolamento por `business_id`;
- cancelados;
- retroativos;
- agendados;
- tipos;
- split payments;
- receipt de comanda;
- estorno;
- itens históricos;
- produto removido/renomeado;
- limites de período;
- paginação;
- contagem total.

### 31.3 Service

Cobrir:

- venda/pedido/ticket;
- comparação;
- ausência de denominador;
- cancel rate;
- prazo operacional;
- policy snapshot histórico;
- fallback legado;
- scheduled punctuality;
- mediana/P90;
- alocação de receita com centavos;
- zero/invalid line base;
- qualidade de dados.

### 31.4 Frontend

Cobrir:

- public boundary;
- API contract;
- URL -> query;
- query -> URL;
- F5;
- Back/Forward;
- troca de view preserva filtros;
- stale response;
- retry;
- partial error;
- drill-down;
- mobile summary/filter experience;
- ausência de tabela desktop comprimida no mobile;
- navegação Reporting -> A Receber sem duplicar baixa;
- capability denied;
- export disabled/allowed.

### 31.5 Architecture

Adicionar regra para impedir:

- deep import em internals de Orders/Finance/Catalog a partir de Reporting frontend;
- Reporting frontend importando Worker;
- Dashboard passando coleções para Reporting para cálculo local;
- métricas oficiais duplicadas em UI.

### 31.6 Export parity

Dado o mesmo filtro:

- total exportado deve reconciliar com o detail endpoint;
- summary do PDF deve usar os mesmos valores do endpoint correspondente;
- sem filtro oculto;
- sem truncamento silencioso.

## 32. Gates de implementação

Cada slice deverá seguir:

1. RED focado;
2. GREEN mínimo;
3. regressões relacionadas;
4. `npm test`;
5. architecture;
6. lint;
7. build;
8. Worker dry-run;
9. D1 local/migrations;
10. staging;
11. homologação manual;
12. merge somente após autorização;
13. produção separada.

Nenhum deploy de produção é autorizado por esta spec.

## 33. Slicing sugerido para o plano

O plano detalhado será escrito somente após aprovação do design.

Ordem sugerida:

1. contrato de reporting + capabilities + rota/nav;
2. query validation + repository base;
3. overview;
4. operation;
5. sales/payments;
6. products + revenue allocation;
7. detail + drill-down;
8. export model + CSV;
9. XLSX/PDF;
10. responsividade/acessibilidade/polish;
11. performance/indexes apenas com evidência;
12. staging/homologação;
13. eventual migração do Dashboard como slice separada.

O plano pode reorganizar tasks para manter TDD menor, desde que preserve as decisões desta spec.

## 34. Critérios de aceite V1

A feature é aceita quando:

1. Relatórios é acessível pelo fluxo de navegação aprovado; desktop recebe a experiência completa e mobile recebe a consulta resumida.
2. F5/Back/Forward preservam destino e query.
3. Filtros ativos são reproduzíveis por URL.
4. Todas as métricas oficiais vêm do backend.
5. Nenhuma métrica mistura `business_id`.
6. Vendas, pedido e ticket reconciliam com fixtures oficiais.
7. Split payment é dividido corretamente no mix.
8. Recebido conta receipt uma vez.
9. `A receber do período` não reintroduz comanda aberta como recebível avulso, oferece drill-down analítico e navega para A Receber para qualquer ação operacional.
10. Cancelados não contam em vendas/produtos.
11. Taxa de cancelamento usa denominador explícito.
12. Estornos usam movimentos oficiais.
13. Operação respeita backdated exclusion.
14. Duração usa o início operacional canônico.
15. Prazo usa política atual/histórica correta.
16. Histórico sem snapshot usa fallback legado explícito.
17. Produtos usam snapshots dos itens.
18. Receita de produto exclui taxa de entrega e reconcilia centavos.
19. Refeições vendidas preserva Refeições + Marmita.
20. Drill-down explica o agregado com o mesmo filtro.
21. Paginação/sort do detalhe são server-side.
22. Exportações reutilizam o modelo oficial.
23. Export acima do limite falha explicitamente.
24. Loading/vazio/erro/parcial são distinguíveis.
25. Claro/escuro funcionam em toda a superfície.
26. 320 px não exige scroll horizontal estrutural e não tenta comprimir a tabela desktop.
27. Arquitetura não introduz deep imports proibidos.
28. Validate fica verde.
29. Staging é homologado.
30. Produção continua separada e exige autorização.
31. Relatórios não possui ação de registrar pagamento/baixa.
32. A tela A Receber existente continua sendo a superfície oficial para resolver pendências financeiras.

## 35. Decisões de produto aprovadas

As decisões abaixo foram aprovadas em conversa em 2026-09-25 e são vinculantes para o plano de implementação.

### A. Relatórios dentro da área Financeiro — APROVADO

Um destination `/relatorios` dentro de `area=finance`, sem criar nova entrada no bottom nav.

### B. Prazo operacional substitui “meta paralela” na V1 — APROVADO

Usar a política operacional já configurada e historicamente versionada; não criar `preparation_started_at` nem uma segunda meta por modalidade nesta feature.

### C. Receita de produto exclui taxa de entrega — APROVADO

Produto reconcilia com mercadoria líquida; taxa de entrega fica separada em Vendas.

### D. Desktop completo + mobile resumido — APROVADO

Desktop recebe a experiência analítica integral. Mobile permanece acessível para consulta de KPIs, tendências, rankings e drill-down simplificado, sem reproduzir tabela/colunas avançadas.

### E. A Receber permanece operacional; Reporting permanece analítico — APROVADO

A tela existente A Receber continua sendo o único fluxo operacional de baixa/recebimento. Reporting expõe `A receber do período`, decomposição e drill-down, com navegação explícita para A Receber quando o usuário precisar agir.

## 36. Precedência documental

Para o Issue #34 após aprovação:

1. esta spec;
2. plano de implementação futuro;
3. contratos arquiteturais vigentes da Spec C;
4. specs atuais de pagamentos, navegação e timing;
5. design histórico de 2026-09-09 apenas como referência de intenção.

Qualquer divergência deve ser resolvida explicitamente antes da implementação.
