# Centro de Relatórios — Design

Data: 2026-09-09  
Status: design aprovado em brainstorming; implementação bloqueada por dependências descritas nesta spec.

## 1. Objetivo

Criar um **Centro de Relatórios** dedicado a análise operacional e gerencial do Gestão Delivery, usando os dados oficiais já persistidos no D1 e adicionando a instrumentação mínima necessária para métricas operacionais confiáveis daqui para frente.

A V1 deve permitir que o usuário:

- acompanhe indicadores operacionais, de vendas e de produtos;
- aplique filtros avançados sobre o histórico;
- compare automaticamente o período analisado com o período anterior equivalente;
- investigue a origem de qualquer indicador relevante por drill-down;
- use uma área de análise detalhada para explorar pedidos e seus dados associados;
- exporte os mesmos recortes em CSV, Excel e PDF;
- diferencie corretamente venda, recebimento e valor a receber;
- diferencie tempo total do pedido de tempo de preparo oficial/instrumentado;
- mantenha consistência entre dashboard, drill-down, análise detalhada e exportações.

O Centro de Relatórios deve nascer com arquitetura preparada para receber futuramente módulos adicionais, como Clientes e Financeiro avançado, sem exigir reescrita da base de Reporting.

## 2. Classificação e escopo

Esta é uma mudança **arquitetural**, pois introduz um novo subsistema de Reporting com regras próprias de domínio, contratos de API, consultas agregadas, instrumentação operacional e novas superfícies de interface.

A V1 inclui:

1. Visão Geral;
2. Operação;
3. Vendas;
4. Produtos;
5. Análise detalhada;
6. filtros globais e contextuais;
7. comparação automática de períodos;
8. drill-down;
9. exportação CSV;
10. exportação Excel (`.xlsx`);
11. exportação PDF executivo;
12. persistência do início oficial de preparo;
13. metas operacionais configuráveis.

Fora da V1:

- previsão de vendas;
- margem/lucro por produto;
- estoque;
- curva ABC avançada;
- relatórios avançados de clientes;
- BI customizável com construtor livre de métricas;
- tabelas analíticas materializadas/pré-agregadas como arquitetura inicial.

## 3. Dependências e ordem de implementação

A implementação do Centro de Relatórios deve ocorrer **depois** das features que ainda alteram a semântica das fontes oficiais de dados.

### 3.1 Dependências obrigatórias/recomendadas

#### Fila centralizada de impressão / QZ

A feature em andamento da fila centralizada de impressão deve ser finalizada e estabilizada antes do início da implementação de Reporting.

Motivo: embora impressão não altere diretamente as métricas de negócio, a feature modifica arquivos compartilhados, Worker, repositories, API, navegação e migrations, criando alto risco de conflito técnico se Reporting for desenvolvido simultaneamente.

#### Issue #28 — Priorizar pedidos mais atrasados na fila da Cozinha

Deve ser concluída antes das métricas operacionais finais.

O conceito oficial de prazo (`lateAt` / `deadlineAt`) deve ser a fonte canônica para análises de **atraso operacional em relação ao prazo**, prioridade e desvio de deadline.

Esse conceito é diferente da **meta de duração de preparo** configurável definida nesta spec. Reporting deve preservar ambos sem misturá-los.

#### Issue #30 — Permitir pagamento dividido em múltiplas formas na baixa

Deve ser concluída antes dos relatórios de pagamento/recebimento.

Reporting deve consumir a estrutura final de alocações de pagamento para calcular corretamente:

- recebido por forma de pagamento;
- participação por forma;
- filtros por forma de pagamento;
- totais sem duplicidade.

#### Issue #15 — Tela própria de Comandas separada de A Receber

Recomenda-se concluir antes de Reporting para estabilizar o fluxo de pedidos locais, comandas e fechamento/recebimento.

### 3.2 Issues não bloqueantes

#### Issue #31 — Reformular cards da Cozinha no desktop

É uma melhoria predominantemente visual e não bloqueia Reporting.

### 3.3 Issue absorvida

#### Issue #21 — Contador de marmitas vendidas

O escopo desta issue é absorvido pelo módulo **Produtos** do Centro de Relatórios.

Não deve existir uma segunda lógica paralela de contagem. A quantidade de marmitas vendidas deve usar a mesma fonte oficial de itens, filtros, cancelamentos e agregações de Reporting.

### 3.4 Regra de partida

A implementação de Reporting deve partir da versão mais recente da branch de integração depois da conclusão das features que alteram semântica de pedidos, pagamentos, comandas e métricas operacionais.

## 4. Arquitetura recomendada

O D1 continua sendo a fonte oficial de dados. Não será criado um banco analítico separado na V1.

Fluxo conceitual:

`D1 -> Reporting Repository -> Reporting Service -> API de Reporting -> UI / Exportações`

### 4.1 Reporting Repository

Responsável por:

- SQL e consultas agregadas;
- joins necessários;
- paginação server-side;
- filtros por `business_id`;
- consultas de detalhe;
- consultas de rankings;
- índices necessários para performance.

### 4.2 Reporting Service

Responsável pelas definições oficiais de métricas e regras de domínio:

- vendas válidas;
- cancelamentos e estornos;
- ticket médio;
- recebido e a receber;
- tempos operacionais;
- metas;
- comparação de períodos;
- disponibilidade/qualidade das métricas;
- composição dos contratos de resposta.

### 4.3 API de Reporting

Deve oferecer contratos próprios para, no mínimo:

- Visão Geral;
- Operação;
- Vendas;
- Produtos;
- Análise detalhada;
- opções/valores de filtros quando necessário;
- exportações.

O frontend não deve baixar todo o histórico para calcular métricas localmente.

### 4.4 Regra arquitetural central

**O frontend nunca define ou recalcula métricas oficiais.**

Dashboard, drill-down, análise detalhada e exportações devem depender da mesma camada de Reporting.

## 5. Modelo temporal oficial

### 5.1 Data operacional

A **data operacional do pedido** é a referência principal para relatórios de vendas, volume e produtos.

Isso garante que pedidos retroativos pertençam ao dia em que a venda realmente ocorreu, e não ao dia em que foram digitados no sistema.

### 5.2 Dimensões temporais distintas

Devem permanecer separadas:

- data operacional do pedido;
- `created_at` — momento de registro no sistema;
- `scheduled_for` — horário agendado/prometido;
- `preparation_started_at` — início oficial de preparo segundo a regra vigente no momento do pedido;
- `finished_at` — conclusão;
- `cancelled_at`, quando aplicável;
- `late_at` / `deadline_at`, conforme a semântica final consolidada pela Issue #28.

Não misturar essas referências em uma única noção genérica de “data”.

## 6. Instrumentação operacional

Hoje a fila da cozinha calcula dinamicamente a fase `preparing` com base no início operacional. Para preservar histórico confiável, Reporting requer persistir o momento oficial em que o pedido entra em preparo segundo a regra operacional vigente.

### 6.1 Timestamp canônico

Adicionar e usar o campo:

`preparation_started_at`

Ele representa o **início oficial do preparo segundo o fluxo do sistema**, e não uma comprovação física de que alguém iniciou manualmente o preparo naquele segundo.

### 6.2 Persistência determinística

O valor deve ser definido de forma determinística, sem depender de um navegador, tela da cozinha ou estação estar aberta no instante da transição.

Para pedido imediato:

`preparation_started_at = created_at`

Para pedido agendado:

`preparation_started_at = max(created_at, scheduled_for - antecedência_operacional_vigente)`

A regra atual usa 50 minutos de antecedência, mas o timestamp persistido deve congelar o valor oficial aplicado àquele pedido.

Se um pedido agendado for remarcado **antes** do início oficial de preparo, o timestamp pode ser recalculado segundo a nova programação. Depois que o início oficial já tiver sido alcançado, mudanças posteriores não devem reescrever retroativamente o histórico operacional já ocorrido.

Pedidos retroativos sem evidência temporal confiável podem manter `preparation_started_at` ausente.

### 6.3 Por que persistir

Persistir esse valor evita que uma mudança futura, por exemplo de 50 para 40 minutos de antecedência, altere retroativamente os relatórios antigos.

### 6.4 Métricas temporais derivadas

- **Tempo de preparo** = `finished_at - preparation_started_at`;
- **Tempo total do pedido** = `finished_at - created_at`;
- **Tempo até entrar em preparo** = `preparation_started_at - created_at`.

`Tempo até entrar em preparo` é uma métrica diagnóstica. Para pedidos agendados, ela inclui espera planejada até a janela operacional e **não deve ser interpretada como atraso da cozinha** nem usada para medir cumprimento de meta.

### 6.5 Histórico antigo

Pedidos antigos sem `preparation_started_at`:

- podem participar de vendas, produtos, volume e tempo total quando os dados forem confiáveis;
- não devem receber um tempo de preparo inventado;
- devem resultar em `sem dados suficientes` para métricas que dependam do timestamp ausente.

## 7. Metas operacionais

O sistema deve permitir configurar:

- meta geral;
- meta Entrega;
- meta Retirada;
- meta Local.

Quando uma meta específica não estiver configurada, usar a meta geral como fallback.

As metas são metas de **duração do preparo**, e não substituem o prazo/deadline operacional da Issue #28.

Elas alimentam:

- percentual dentro da meta de preparo;
- percentual acima da meta de preparo;
- excesso médio sobre a meta;
- quantidade de pedidos acima da meta;
- evolução do cumprimento;
- comparação por tipo e faixa de horário.

## 8. Definições oficiais das métricas

### 8.1 Pedidos no período

Todos os pedidos persistidos cuja data operacional pertence ao intervalo filtrado, incluindo cancelados para fins de volume/taxa de cancelamento quando o filtro não os excluir explicitamente.

### 8.2 Vendas realizadas

Soma dos pedidos válidos/finalizados do período, excluindo cancelamentos e efeitos financeiros que não pertencem à venda líquida oficial.

### 8.3 Valor recebido

Soma dos pagamentos efetivamente registrados no intervalo de `paid_at`, respeitando os demais filtros semanticamente compatíveis.

Na UI, rotular explicitamente como **Recebido no período** para não induzir o usuário a interpretar esse valor como vendas do período operacional.

### 8.4 A receber

Saldo ainda não quitado dos pedidos válidos cuja data operacional pertence ao recorte analisado.

### 8.5 Ticket médio

`vendas realizadas / quantidade de pedidos válidos considerados nas vendas`

### 8.6 Taxa de cancelamento

`pedidos cancelados no recorte / todos os pedidos do mesmo recorte operacional`

O recorte usa data operacional e os mesmos filtros de tipo/agendamento/cliente aplicáveis. O status não deve ser aplicado ao denominador de forma que torne a taxa tautológica.

### 8.7 Valor cancelado/estornado

Total financeiro associado aos cancelamentos/estornos conforme as regras oficiais do sistema.

### 8.8 Tempo de preparo

`finished_at - preparation_started_at`

Somente quando ambos os timestamps forem confiáveis e `finished_at >= preparation_started_at`.

### 8.9 Tempo total do pedido

`finished_at - created_at`

Essa métrica pode existir para histórico anterior à nova instrumentação, desde que os timestamps sejam confiáveis.

### 8.10 Tempo até entrar em preparo

`preparation_started_at - created_at`

É informativo/diagnóstico. Para agendados, inclui espera planejada e não mede atraso operacional.

### 8.11 Cumprimento da meta de preparo

Percentual de pedidos elegíveis cujo `tempo de preparo <= meta aplicável ao tipo`.

### 8.12 Excesso médio sobre a meta de preparo

Média de `tempo de preparo - meta aplicável` apenas entre pedidos que ultrapassaram a meta.

Não rotular essa métrica apenas como “atraso médio”, para evitar confusão com atraso em relação ao `late_at` / `deadline_at` operacional.

### 8.13 Atraso operacional

Usar a referência canônica final definida pela Issue #28 (`late_at` / `deadline_at`).

Reporting pode expor, separadamente:

- quantidade de pedidos operacionalmente atrasados;
- minutos de atraso operacional;
- atraso operacional médio;
- distribuição por faixa de atraso.

Essas métricas não substituem as métricas de meta de preparo.

### 8.14 Pontualidade de pedidos agendados

Para pedidos agendados, manter métricas específicas:

- **início oficial de preparo em relação à janela operacional prevista**;
- **conclusão em relação a `scheduled_for`**;
- **atraso de conclusão** segundo o prazo/grace oficial vigente.

### 8.15 Horário de pico

Faixa horária com maior volume de pedidos. Reporting também pode expor separadamente uma visão de maior carga operacional, sem confundir volume com duração.

### 8.16 Produto mais vendido

Ranking principal por **quantidade de unidades**.

Receita por produto é métrica separada.

### 8.17 Receita líquida por produto

Para reconciliar Produtos com as vendas realizadas, o Reporting Service deve atribuir descontos/acréscimos de nível de pedido proporcionalmente aos itens segundo sua participação no subtotal antes do ajuste.

O rateio deve ser determinístico em centavos, com tratamento explícito de arredondamento para garantir que a soma das receitas líquidas atribuídas aos itens seja exatamente igual ao total líquido do pedido.

Não aplicar rateio a pedidos cancelados que estejam excluídos das vendas realizadas.

### 8.18 Participação do produto

`receita líquida atribuída ao produto / receita líquida total de produtos no mesmo recorte`

### 8.19 Comparação de período

Sempre contra o período imediatamente anterior de mesma duração e com os mesmos filtros semânticos.

Exemplos:

- hoje x ontem;
- últimos 7 dias x 7 dias anteriores;
- este mês x período imediatamente anterior equivalente em duração;
- personalizado de 10 dias x 10 dias imediatamente anteriores.

Quando não houver base comparável suficiente, não exibir percentual inventado.

## 9. Cancelamentos e estornos

Dashboard principal deve mostrar números líquidos, sem contaminar vendas com pedidos cancelados/estornados.

Ao mesmo tempo, cancelamentos são parte da operação e devem aparecer em indicadores próprios:

- pedidos cancelados;
- taxa de cancelamento;
- valor cancelado/estornado.

A Análise detalhada deve permitir incluir/excluir cancelados pelos filtros.

## 10. Vendas x recebimentos

Reporting deve manter três conceitos distintos:

- **Vendas realizadas** — valor dos pedidos válidos segundo a data operacional;
- **Recebido no período** — pagamentos segundo `paid_at`;
- **A receber** — saldo ainda pendente dos pedidos do recorte operacional.

Nunca usar “faturamento” de forma ambígua para misturar venda e caixa recebido.

## 11. Estrutura funcional da V1

### 11.1 Visão Geral

KPIs principais:

- vendas realizadas;
- pedidos;
- ticket médio;
- tempo médio de preparo;
- percentual dentro da meta de preparo;
- taxa de cancelamento.

Indicadores complementares quando fizer sentido:

- recebido no período;
- a receber;
- comparação com período anterior.

Gráficos/blocos:

- evolução de vendas e pedidos;
- distribuição Entrega / Retirada / Local;
- situação operacional dentro/acima da meta de preparo;
- produtos em destaque.

### 11.2 Operação

KPIs:

- pedidos no período;
- tempo médio de preparo;
- tempo total do pedido;
- percentual dentro da meta de preparo;
- pedidos acima da meta de preparo;
- excesso médio sobre a meta;
- atraso operacional;
- pico operacional.

Análises:

- volume por horário;
- volume por dia da semana;
- tempo de preparo ao longo do período;
- cumprimento da meta de preparo;
- atraso operacional por deadline;
- Entrega x Retirada x Local;
- imediato x agendado;
- pontualidade de agendados;
- cancelamentos operacionais;
- pedidos que exigem atenção.

### 11.3 Vendas

KPIs:

- vendas realizadas;
- quantidade de pedidos;
- ticket médio;
- recebido no período;
- a receber;
- cancelado/estornado.

Análises:

- evolução temporal;
- vendas por tipo de pedido;
- vendas por faixa de horário;
- formas de pagamento;
- descontos;
- acréscimos;
- comparação com período anterior.

### 11.4 Produtos

KPIs:

- unidades vendidas;
- produtos diferentes vendidos;
- categoria líder;
- produto líder.

Análises:

- ranking por quantidade;
- receita líquida por produto;
- receita líquida por categoria;
- desempenho por tamanho/apresentação;
- participação percentual;
- crescimento/queda contra período anterior;
- drill-down para pedidos que contêm o item.

A contagem de marmitas da Issue #21 deve ser implementada aqui usando classificação oficial, nunca busca textual por nome do produto.

### 11.5 Análise detalhada

Deve oferecer exploração tabular de pedidos com colunas configuráveis, incluindo quando disponíveis:

- pedido;
- data operacional;
- cliente;
- tipo;
- status;
- itens;
- total;
- pagamento;
- criação;
- início oficial do preparo;
- finalização;
- tempo até entrar em preparo;
- tempo de preparo;
- tempo total;
- meta de preparo aplicável;
- excesso sobre meta;
- deadline/lateAt operacional;
- atraso operacional.

Funcionalidades:

- paginação server-side;
- ordenação;
- filtros;
- seleção de colunas;
- abertura do detalhe do pedido;
- exportação do recorte atual.

No mobile, não reproduzir uma tabela desktop comprimida. Cada resultado deve virar um registro compacto expansível.

## 12. Filtros

### 12.1 Período

Atalhos:

- Hoje;
- Ontem;
- Últimos 7 dias;
- Últimos 30 dias;
- Esta semana;
- Este mês;
- Mês anterior;
- Este ano;
- Personalizado.

Padrão ao entrar em Relatórios: **Este mês**.

### 12.2 Horário

Data é o filtro padrão. Deve existir opção explícita de **filtrar também por horário** para limitar hora inicial/final.

### 12.3 Filtros globais

- período;
- horário opcional;
- tipo de pedido;
- status;
- imediato/agendado;
- forma de pagamento;
- produto;
- categoria;
- cliente.

Quando um filtro não for semanticamente aplicável a uma métrica específica, o contrato de Reporting deve deixar essa regra explícita em vez de produzir resultados silenciosamente incoerentes.

### 12.4 Filtros contextuais

Operação:

- dentro/acima da meta de preparo;
- faixas de tempo;
- atraso operacional;
- situação de agendamento.

Produtos:

- produto;
- categoria;
- tamanho/apresentação.

Vendas:

- faixa de valor;
- forma de pagamento;
- tipo de pedido.

### 12.5 Persistência de filtros

Os filtros devem permanecer ativos ao navegar entre Visão Geral, Operação, Vendas e Produtos.

Na V1, preservar o estado durante a sessão. Não é necessário persistir permanentemente todos os filtros entre dias.

## 13. Drill-down e investigação

Indicadores e gráficos relevantes devem ser investigáveis.

Exemplos:

- clicar em “17 pedidos acima da meta” abre os 17 pedidos;
- clicar em “Entrega” aplica o filtro de tipo;
- clicar em “12h–13h” aplica a faixa horária;
- clicar em “Marmita G” abre o detalhamento daquele produto.

A interface deve manter visíveis os filtros ativos e oferecer ação clara para removê-los/limpá-los.

## 14. Layout e navegação

### 14.1 Cabeçalho

- título `Relatórios`;
- período atual;
- ação `Exportar`;
- acesso a filtros no mobile.

### 14.2 Navegação interna

Abas internas de Relatórios:

- Visão Geral;
- Operação;
- Vendas;
- Produtos;
- Análise detalhada.

Não criar cinco destinos independentes no menu principal.

### 14.3 Desktop

Filtros globais ficam visíveis abaixo do cabeçalho, com filtros menos frequentes agrupados em `Mais filtros` quando necessário.

### 14.4 Mobile

Usar resumo do período/filtros ativos e abrir filtros em painel dedicado.

Cards ficam em sequência, gráficos adaptam largura e a análise detalhada vira registros compactos.

## 15. Semântica visual de comparação

Variação positiva/negativa deve refletir **melhoria ou piora da métrica**, não apenas crescimento matemático.

Exemplos:

- vendas subindo pode ser positivo;
- cancelamentos caindo é positivo;
- tempo de preparo subindo é negativo.

Não depender apenas de cor. Exibir texto/ícone/sinal acessível.

## 16. Exportações

Todas as exportações devem usar a mesma camada de Reporting e os mesmos filtros ativos da tela.

### 16.1 CSV

Dados detalhados do recorte atual em formato universal.

### 16.2 Excel (`.xlsx`)

Arquivo com:

- aba de resumo;
- aba de dados detalhados;
- datas formatadas;
- moeda em Real brasileiro;
- colunas legíveis.

### 16.3 PDF

Relatório executivo, voltado a leitura, impressão e compartilhamento.

Deve incluir:

- período;
- filtros aplicados;
- data/hora de geração;
- KPIs principais;
- comparação de período;
- gráficos relevantes.

Não precisa despejar centenas de linhas detalhadas; detalhamento extenso pertence ao Excel/CSV.

### 16.4 Consistência

Se a tela mostra um recorte `Este mês + Entrega + Pix`, a exportação deve representar exatamente o mesmo conjunto lógico para todas as métricas às quais esses filtros são aplicáveis.

Métricas sem base suficiente devem continuar aparecendo como `sem dados suficientes`, nunca `0` por conveniência.

## 17. Performance e paginação

- agregações devem ser feitas server-side;
- análise detalhada deve usar paginação real;
- consultas devem sempre restringir `business_id`;
- filtros devem ser validados no servidor;
- criar índices D1 quando a implementação demonstrar necessidade;
- evitar carregar histórico inteiro no navegador;
- permitir evolução futura para cache ou pré-agregações sem mudar os contratos da UI.

A V1 não precisa criar tabelas analíticas/materializadas preventivamente.

## 18. Estados de interface

### 18.1 Carregando

Usar skeletons preservando a estrutura da página para evitar layout shift excessivo.

### 18.2 Sem resultados

Mensagem clara indicando que não existem dados para os filtros atuais e ação para limpar/revisar filtros.

### 18.3 Sem dados históricos suficientes

Mostrar explicitamente `Sem dados suficientes` para métricas não instrumentadas no período.

Nunca converter ausência de informação em zero.

### 18.4 Comparação indisponível

Mostrar o valor atual sem percentual de comparação inventado.

### 18.5 Erro parcial

Falha de um módulo/bloco não deve derrubar toda a página quando os demais dados puderem ser exibidos.

### 18.6 Erro de exportação

Preservar filtros e estado atual e informar claramente que a exportação não foi gerada.

## 19. Acessibilidade e responsividade

- gráficos não podem depender apenas de cor;
- valores e tendências críticas devem existir também em texto;
- controles devem ser navegáveis e legíveis;
- validar tema claro e escuro;
- validar desktop, tablet e larguras mobile usuais;
- não sacrificar touch targets no mobile;
- evitar overflow horizontal como solução padrão.

## 20. Testes e confiabilidade

Reporting é uma camada crítica e deve ser implementada com TDD estrito.

Cobertura mínima esperada:

- regras oficiais das métricas;
- período e timezone;
- pedidos retroativos;
- agendados;
- cancelamentos e estornos;
- pagamentos divididos após Issue #30;
- metas gerais e por tipo;
- prazo/deadline operacional após Issue #28;
- histórico antigo sem `preparation_started_at`;
- comparação de período;
- rateio determinístico de descontos/acréscimos por produto;
- paginação e filtros;
- isolamento por `business_id`;
- consistência entre dashboard, drill-down e exportações;
- estados de erro/sem dados no frontend;
- responsividade relevante.

Regra de regressão:

**A mesma métrica deve representar o mesmo conjunto de dados no Dashboard, drill-down, Análise detalhada e exportação.**

## 21. Critérios de aceite macro

- [ ] Existe um destino principal `Relatórios` na navegação.
- [ ] Visão Geral, Operação, Vendas, Produtos e Análise detalhada compartilham os mesmos filtros globais.
- [ ] Período padrão é `Este mês`.
- [ ] Comparação automática usa o período anterior equivalente quando possível.
- [ ] Vendas realizadas, recebido no período e a receber são conceitos separados.
- [ ] Cancelamentos não contaminam vendas líquidas e continuam analisáveis.
- [ ] Tempo de preparo usa `preparation_started_at` persistido de forma determinística.
- [ ] Histórico sem instrumentação não recebe valores estimados apresentados como reais.
- [ ] Metas de preparo podem ser gerais e específicas por tipo, com fallback.
- [ ] Atraso operacional por deadline e excesso sobre meta de preparo são métricas distintas.
- [ ] Pedidos agendados têm métricas próprias de pontualidade.
- [ ] Receita líquida por produto reconcilia com os totais líquidos dos pedidos por rateio determinístico.
- [ ] Gráficos e KPIs suportam drill-down quando aplicável.
- [ ] Análise detalhada usa paginação server-side.
- [ ] CSV, Excel e PDF refletem os mesmos filtros e métricas da tela.
- [ ] Mobile usa experiência própria para filtros e detalhe, sem comprimir a tabela desktop.
- [ ] Estados de carregamento, erro, vazio e dados insuficientes são explícitos.
- [ ] Tema claro/escuro e acessibilidade são validados.
- [ ] Issue #21 não gera uma lógica paralela de contagem de marmitas.
- [ ] Implementação só começa sobre a base integrada após as dependências de semântica estarem concluídas.

## 22. Evolução futura

A arquitetura deve permitir adicionar posteriormente:

- módulo Clientes;
- Financeiro avançado;
- relatórios salvos;
- filtros favoritos;
- envio/agendamento de relatórios;
- pré-agregações/materializações se o volume justificar;
- novos negócios no mesmo modelo multi-business.

Essas evoluções não fazem parte da V1 e não devem aumentar a complexidade inicial sem necessidade.
