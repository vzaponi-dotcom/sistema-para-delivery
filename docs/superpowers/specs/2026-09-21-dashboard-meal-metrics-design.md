# Gestão Delivery — Dashboard: Top 10 produtos e refeições vendidas — Design Spec

Status: **aprovada pelo usuário**

Issue: #21 — Top 10 produtos e refeições vendidas no Dashboard  
Branch: `feature/issue-21-dashboard-meal-metrics`  
Master baseline: `619c8086e930ee7086876d24b8c9bd46324d99b1`  
Produção: **fora de escopo sem autorização separada**

---

## 1. Objetivo

Evoluir o Dashboard com duas melhorias operacionais pequenas e coesas:

1. ampliar o ranking atual de **Top 5 produtos** para **Top 10 produtos**;
2. adicionar o indicador **Refeições vendidas** à seção **Visão do período**.

A nova métrica deve medir volume real de refeições produzidas/vendidas, somando unidades de itens cuja categoria snapshot seja **Refeições**. Para preservar vendas anteriores à padronização atual do catálogo, a categoria snapshot legada **Marmita** também conta.

A implementação deve aproveitar os dados e filtros oficiais já existentes. Não deve criar classificação paralela no catálogo, migration desnecessária, regra por nome de produto ou novo domínio de analytics.

---

## 2. Contexto atual confirmado

No baseline atual:

- o Dashboard vive em `src/app/surfaces/dashboard/`;
- `DashboardSurface.jsx` monta os indicadores e gráficos;
- `dashboardAnalytics.js` concentra os cálculos puros do Dashboard;
- `filterOrdersByPeriod(orders, period, now)`:
  - usa os períodos oficiais `today`, `7d` e `30d`;
  - exclui pedidos com status `Cancelado`;
- `getTopProducts(...)`:
  - percorre `getOrderItems(order)`;
  - agrupa por `productId` quando disponível;
  - usa label normalizado como fallback;
  - soma `item.quantity`;
  - ordena por quantidade decrescente e label como desempate;
  - possui limite default atual de **5**;
- o gráfico de Top Produtos é horizontal e já renderiza uma linha por item;
- a categoria oficial de catálogo inclui `Refeições`;
- `order_items` persiste `category_snapshot`;
- o read model de pedidos já carrega a categoria snapshot junto aos itens;
- pedidos de Entrega, Retirada e Local/comanda compartilham o mesmo modelo oficial de itens;
- cancelamento altera o pedido para `Cancelado`, portanto o filtro oficial do Dashboard já o exclui;
- a Spec C consolidou fronteiras de Orders, Catalog, Finance e Dashboard que devem ser preservadas.

Não há necessidade de nova coluna, tabela ou migration para entregar esta feature.

---

## 3. Princípios da solução

### 3.1 Uma única população de pedidos

Top 10 e Refeições vendidas devem usar a mesma população oficial:

```text
filterOrdersByPeriod(orders, period, now)
```

Consequências:

- Hoje / 7 dias / 30 dias funcionam de modo idêntico entre indicadores;
- pedidos cancelados são excluídos;
- Entrega, Retirada e Local/comanda entram igualmente;
- não é criada uma segunda interpretação de “venda válida” dentro do Dashboard.

### 3.2 Quantidade significa unidade vendida

Nenhuma das duas métricas deve contar “linhas de item” ou “pedidos” quando a intenção é medir unidades.

Exemplo:

```text
Pedido
- Marmita P x3
- Coca x2
```

Para Top Produtos:

```text
Marmita P += 3
Coca += 2
```

Para Refeições vendidas:

```text
Refeições += 3
```

### 3.3 Histórico usa snapshot

A classificação da refeição será determinada pelo valor de categoria presente no item do pedido, derivado de `order_items.category_snapshot`.

A métrica NÃO deve consultar o cadastro atual de produtos para decidir se uma venda histórica foi uma refeição.

Isso garante que:

- edição posterior do produto não reescreve a história;
- produto desativado/excluído continua corretamente representado em pedidos antigos;
- recarregar o bootstrap não altera a interpretação histórica.

### 3.4 Sem classificação extra no catálogo

Ficam explicitamente rejeitadas:

- `isMarmita`;
- `countsAsMeal`;
- checkbox “contabilizar como refeição”;
- nova categoria artificial;
- regra por substring do nome, como `name.includes('marmita')`.

A categoria snapshot já atende à necessidade atual.

---

## 4. Regra oficial de “Refeições vendidas”

### 4.1 Definição

```text
Refeições vendidas =
soma de item.quantity
para cada item de cada pedido válido no período
cuja categoria snapshot seja "Refeições"
ou a categoria histórica legada "Marmita"
```

### 4.2 Categorias reconhecidas

O catálogo atual não aceita categoria como texto livre. A seleção vem da lista oficial e usa exatamente `Refeições`.

Por isso, a regra deve ser simples e explícita:

```js
const MEAL_CATEGORIES = new Set(['Refeições', 'Marmita'])
```

Onde:

- `Refeições` é a categoria oficial atual;
- `Marmita` existe somente como compatibilidade para snapshots históricos anteriores à padronização do catálogo.

Não normalizar acentos, caixa ou espaços e não tentar inferir categorias por nome do produto.

Não devem contar automaticamente:

- `Refeicoes`;
- `refeições`;
- `Pratos`;
- `Lanches`;
- `Combos`;
- qualquer outro valor fora do conjunto explícito.

Se futuramente a taxonomia oficial do catálogo mudar, a regra deve ser revista deliberadamente em vez de aceitar variações silenciosamente.

### 4.3 Quantidade inválida

A métrica deve reutilizar a mesma política segura de quantidade usada no ranking atual, ou um helper compartilhado dentro do módulo de analytics.

O contrato oficial dos itens deve fornecer quantidade positiva. Para robustez do frontend, valores ausentes/ilegíveis não podem gerar `NaN` ou quebrar o Dashboard.

A implementação deve manter comportamento consistente entre Top Produtos e Refeições vendidas.

### 4.4 Modalidade do pedido

A contagem é independente de `order.type`.

Entram igualmente:

- Entrega;
- Retirada;
- Local;
- pedidos pertencentes a comandas.

Não existe multiplicador ou exclusão por modalidade.

### 4.5 Cancelamentos e estornos

Pedido com `status === 'Cancelado'` não participa da população do Dashboard e, portanto, não soma refeições nem produtos.

Não deve ser criada leitura adicional de movements/refunds para essa métrica.

Essa decisão mantém Refeições vendidas alinhada ao Top Produtos e às métricas baseadas em pedidos.

---

## 5. Contrato analítico proposto

### 5.1 Preservar `calculatePeriodMetrics`

O contrato atual:

```js
{
  sales,
  orderCount,
  averageTicket,
}
```

deve permanecer inalterado.

Não há motivo para adicionar `mealUnits` ao objeto e ampliar o impacto em testes/callers.

### 5.2 Nova função pura

Adicionar em `src/app/surfaces/dashboard/dashboardAnalytics.js` uma função com responsabilidade única, por exemplo:

```js
getMealsSold(orders, period = '30d', now = new Date())
```

Contrato:

```text
input:
  orders[]
  period
  now

output:
  integer >= 0
```

Algoritmo conceitual:

```js
let total = 0

for (const order of filterOrdersByPeriod(orders, period, now)) {
  for (const item of getOrderItems(order)) {
    if (isMealCategory(item.category)) {
      total += safeQuantity(item.quantity)
    }
  }
}

return total
```

O nome exato do campo de categoria deve seguir o shape real retornado por `getOrderItems`. Não criar dependência direta de snake_case do banco dentro da UI.

### 5.3 Helper de categoria

O conjunto explícito de categorias reconhecidas pode permanecer privado ao módulo de analytics, a menos que surja outro consumidor real.

Não adicionar função ao contrato público de Catalog apenas para atender esta feature.

Orders/Dashboard podem analisar a categoria já contida no item sem importar internals de Catalog.

---

## 6. Top 10 produtos

### 6.1 Mudança funcional

Alterar o default de:

```js
limit = 5
```

para:

```js
limit = 10
```

em `getTopProducts`.

O agrupamento, ordenação e soma atuais permanecem.

### 6.2 Limite explícito

O helper continua aceitando `limit` para testes ou consumidores específicos.

Regras:

- default: 10;
- resultado: no máximo `limit`;
- limite inválido/não positivo continua produzindo lista vazia conforme o contrato atual;
- não remover o parâmetro apenas porque o Dashboard usa 10.

### 6.3 Identidade do produto

Nenhuma alteração:

- usar `productId` como identidade primária quando disponível;
- fallback atual por label permanece para compatibilidade histórica.

Não reagrupar Top Produtos por categoria.

---

## 7. Dashboard UI

### 7.1 Seção “Visão do período”

A seção passa de três para quatro indicadores:

1. **Vendas no período**
2. **Pedidos no período**
3. **Ticket médio**
4. **Refeições vendidas**

O quarto card:

- valor inteiro;
- helper sugerido: `Unidades da categoria Refeições`;
- ícone deve reutilizar um ícone já existente coerente no sistema; não adicionar biblioteca;
- não é monetário;
- não deve ser mascarado quando o usuário oculta valores financeiros.

### 7.2 Layout desktop

A grade da seção deve acomodar quatro cards sem overflow, corte ou largura artificialmente rígida.

Preferência:

- quatro colunas quando houver largura suficiente;
- quebra responsiva conforme os padrões existentes.

Não alterar os três indicadores fixos do topo:

- Vendas hoje;
- Recebido hoje;
- A receber.

### 7.3 Layout mobile

No mobile:

- os quatro cards devem permanecer legíveis;
- não reduzir tipografia a ponto de prejudicar leitura;
- seguir o comportamento responsivo existente da `stats-grid`;
- não criar scroll horizontal para os cards.

### 7.4 Ranking

Alterar textos:

```text
Top 5 produtos
```

para:

```text
Top 10 produtos
```

E atualizar o `aria-label` correspondente.

O meta atual `Por unidades vendidas` permanece correto.

### 7.5 Altura do ranking

O gráfico horizontal é content-driven e renderiza uma linha por produto.

Com 10 produtos o card ficará naturalmente mais alto. Isso é aceitável.

Não adicionar:

- paginação;
- carrossel;
- “ver mais”;
- scroll interno;

a menos que a implementação demonstre um defeito real de layout.

Em desktop, os cards da mesma linha do CSS Grid não precisam possuir conteúdo visual de mesma altura interna; a prioridade é legibilidade.

---

## 8. Analytics composition no Dashboard

O `useMemo` analítico passa conceitualmente a produzir:

```js
{
  metrics: calculatePeriodMetrics(...),
  daily: buildDailySeries(...),
  topProducts: getTopProducts(...),
  mealsSold: getMealsSold(...),
  paymentMix: getPaymentMix(...),
}
```

Dependências permanecem baseadas em:

- `orders`;
- `movements`;
- `period`;
- `todayValue`.

Não criar estado local duplicado para `mealsSold`.

---

## 9. Compatibilidade e limites de arquitetura

### 9.1 Orders

Reutilizar exclusivamente contratos públicos:

- `filterOrdersByPeriod`;
- `getOrderItems`;
- demais helpers já exportados quando necessários.

Dashboard não deve importar arquivo interno de Orders diretamente.

### 9.2 Catalog

Não alterar:

- schema de produto;
- formulário de produto;
- categorias oficiais;
- presentation types;
- comandos CRUD.

A feature consome o snapshot do item e não precisa consultar Catalog.

### 9.3 Finance

Não alterar:

- movements;
- pagamentos divididos;
- receipts/allocations;
- refunds.

`getPaymentMix` permanece movement-based, conforme a feature recém-mergeada de split payments.

### 9.4 Table Service

Nenhuma regra especial de comanda é necessária.

Pedidos de mesa já possuem itens oficiais; ao entrarem na população do período, suas refeições são somadas como qualquer outro pedido.

### 9.5 Backend e banco

Nenhuma migration prevista.

Não criar endpoint apenas para essa métrica enquanto o Dashboard já possui todos os dados oficiais necessários no bootstrap.

---

## 10. Casos de comportamento obrigatórios

### 10.1 Uma refeição

Pedido válido:

```text
Refeições | Marmita P | qty 1
```

Resultado:

```text
Refeições vendidas = 1
```

### 10.2 Múltiplas unidades

```text
Refeições | Marmita M | qty 3
```

Resultado:

```text
Refeições vendidas = 3
```

### 10.3 Pedido misto

```text
Refeições | Marmita G | qty 2
Bebidas   | Coca      | qty 2
```

Resultado:

```text
Refeições vendidas = 2
```

Top Produtos soma ambos os produtos.

### 10.4 Duas refeições diferentes

```text
Refeições | Marmita P       | qty 2
Refeições | Prato executivo | qty 1
```

Resultado:

```text
Refeições vendidas = 3
```

### 10.5 Consumo local

Pedido Local/comanda:

```text
Refeições | Marmita G | qty 4
```

Resultado:

```text
Refeições vendidas = 4
```

### 10.6 Cancelado

Mesmo pedido com status `Cancelado`.

Resultado:

```text
Refeições vendidas = 0
```

O produto também não aparece no Top 10 daquele pedido.

### 10.7 Categoria histórica legada

```text
category = Marmita
qty = 2
```

Resultado:

```text
Refeições vendidas = 2
```

Esse caso existe somente para preservar snapshots históricos.

### 10.8 Categoria fora do conjunto explícito

```text
category = Refeicoes
name = Marmita Especial
qty = 2
```

Resultado:

```text
Refeições vendidas = 0
```

A feature não corrige grafia nem infere categoria pelo nome.

### 10.9 Histórico após edição de produto

Venda original:

```text
category_snapshot = Refeições
qty = 2
```

Depois o cadastro do produto muda para `Outros`.

Resultado histórico:

```text
Refeições vendidas = 2
```

### 10.10 Ranking com mais de dez produtos

Se houver 12 produtos diferentes no período:

- ordenar todos pela regra atual;
- retornar somente os 10 primeiros;
- não alterar quantidades;
- desempate permanece pelo label.

---

## 11. Testes obrigatórios

### 11.1 Unitários de analytics

Cobrir no mínimo:

- default de Top Produtos retorna até 10;
- parâmetro customizado de limit continua funcionando;
- ordenação e desempate não regressam;
- `getMealsSold` soma `quantity`;
- múltiplas linhas de Refeições são acumuladas;
- itens não-Refeições são ignorados;
- categoria atual `Refeições` é contabilizada;
- categoria snapshot legada `Marmita` é contabilizada;
- variações não oficiais como `Refeicoes` não são inferidas;
- Entrega, Retirada e Local contam;
- pedido cancelado é excluído;
- período exclui datas fora da janela;
- edição do objeto de produto atual não influencia item snapshot.

### 11.2 UI do Dashboard

Cobrir:

- texto `Top 10 produtos`;
- aria-label `Top 10 produtos por quantidade vendida`;
- card `Refeições vendidas`;
- valor do card não usa `displayMoney`;
- seletor de período alimenta a métrica;
- quatro indicadores estão dentro da seção Visão do período.

### 11.3 Regressão

Manter verdes:

- métricas financeiras;
- Top Produtos;
- pedidos por dia;
- formas de pagamento;
- privacy toggle;
- arquitetura frontend;
- lint;
- build.

---

## 12. Homologação manual em staging

Validar pelo menos:

1. Dashboard abre sem regressão visual.
2. Selecionar Hoje e conferir Refeições vendidas.
3. Selecionar 7 dias e conferir mudança.
4. Selecionar 30 dias e conferir mudança.
5. Criar/usar pedido com mais de uma unidade de Refeições e confirmar soma por unidade.
6. Confirmar pedido Local/comanda com Refeições.
7. Confirmar que bebida/adicional não aumenta Refeições vendidas.
8. Confirmar Top 10 com mais de cinco produtos quando houver massa suficiente.
9. Conferir mobile.
10. Conferir desktop.
11. Ocultar valores monetários e confirmar que Refeições vendidas continua visível.
12. Se houver pedido cancelado apropriado para teste, confirmar que ele não participa das métricas.

Não é necessário criar dados destrutivos de produção.

---

## 13. Não objetivos

Esta feature NÃO inclui:

- dashboard configurável;
- filtros customizados de data;
- relatórios exportáveis;
- meta diária de refeições;
- projeção de produção;
- breakdown por tamanho;
- breakdown por Entrega/Retirada/Local;
- nova tela de analytics;
- alteração de preço ou catálogo;
- marcador manual de refeição;
- mudança em pagamentos;
- mudança em impressão;
- mudança em comandas;
- deploy de produção automático.

Essas extensões podem ser avaliadas futuramente sem alterar a definição básica de Refeições vendidas.

---

## 14. Arquivos esperados

Provável superfície de implementação:

```text
src/app/surfaces/dashboard/dashboardAnalytics.js
src/app/surfaces/dashboard/DashboardSurface.jsx
src/app/surfaces/dashboard/dashboard.css
src/utils/dashboardAnalytics.test.js
src/pages/DashboardAnalytics.test.js
```

Outros testes de Dashboard podem precisar de alinhamento textual de `Top 5` para `Top 10`.

Não está prevista alteração em:

```text
worker/
migrations/
src/domains/catalog/
src/domains/finance/
src/domains/table-service/
```

salvo descoberta técnica objetiva documentada antes da mudança.

---

## 15. Estratégia de implementação

A implementação deve seguir TDD.

Sequência conceitual:

1. RED para Top 10.
2. GREEN mínimo para limite 10.
3. RED para Refeições vendidas.
4. GREEN da função pura e compatibilidade explícita `Refeições`/`Marmita`.
5. RED de integração/UI do Dashboard.
6. GREEN visual/responsivo.
7. regressão completa.
8. staging.
9. homologação manual.
10. fechamento e merge somente após autorização explícita.

O plano de implementação detalhado será escrito somente após aprovação desta Spec.

---

## 16. Critérios de aceite finais

A feature estará pronta para merge quando:

- [ ] Issue #21 estiver refletido integralmente.
- [ ] Top Produtos mostrar no máximo 10 itens.
- [ ] Ranking continuar baseado em unidades.
- [ ] Refeições vendidas estiver na Visão do período.
- [ ] A métrica somar unidades da categoria snapshot atual `Refeições`.
- [ ] A compatibilidade histórica com categoria snapshot `Marmita` estiver testada.
- [ ] Nenhuma normalização permissiva de grafia/acentuação tiver sido adicionada.
- [ ] Nenhuma inferência por nome do produto existir.
- [ ] Entrega, Retirada e Local/comanda estiverem cobertos.
- [ ] Cancelados forem excluídos pela regra oficial existente.
- [ ] Hoje / 7 dias / 30 dias funcionarem.
- [ ] Privacy toggle não esconder a quantidade.
- [ ] Desktop e mobile estiverem legíveis.
- [ ] Nenhuma migration desnecessária tiver sido criada.
- [ ] Nenhum contrato de pagamento/Finance tiver sido alterado.
- [ ] Testes focados e suíte completa estiverem verdes.
- [ ] Architecture/lint/build e dry-runs aplicáveis estiverem verdes.
- [ ] Staging estiver homologado.
- [ ] Produção continuar intocada até autorização separada.
- [ ] Merge ocorrer somente após autorização explícita.

---

## 17. Auto-revisão

### Simplicidade

A solução usa somente:

- pedidos já carregados;
- itens já carregados;
- categoria snapshot já persistida;
- filtros de período já existentes.

Não adiciona schema nem novo estado persistido.

### Correção histórica

Usar snapshot é superior a consultar `products.category`, porque evita reclassificar vendas antigas quando o produto é editado.

### Consistência

Top Produtos e Refeições vendidas compartilham:

- `filterOrdersByPeriod`;
- `getOrderItems`;
- política de quantidade.

Isso reduz risco de duas métricas divergirem.

### Arquitetura

A mudança permanece dentro da superfície Dashboard consumindo o contrato público de Orders. Catalog, Finance, Table Service e Worker não precisam ganhar dependência nova.

### Risco principal

O principal risco é transformar compatibilidade histórica em heurística permanente. Por isso a regra aceita somente dois valores explícitos: `Refeições` (atual) e `Marmita` (snapshot legado), sem normalização ou inferência por nome.

### Resultado da auto-revisão

Nenhum blocker de design identificado.

A Spec foi aprovada pelo usuário e está pronta para derivação do plano de implementação.
