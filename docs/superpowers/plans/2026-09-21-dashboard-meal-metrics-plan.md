# Gestão Delivery — Issue #21 Dashboard meal metrics — Implementation Plan

Status: **draft auto-reviewed; aguardando aprovação do usuário**

Issue: #21 — Top 10 produtos e refeições vendidas no Dashboard  
Spec aprovada: `docs/superpowers/specs/2026-09-21-dashboard-meal-metrics-design.md`  
Implementation branch: `feature/issue-21-dashboard-meal-metrics`  
Master baseline: `619c8086e930ee7086876d24b8c9bd46324d99b1`  
Baseline pós-merge: Validate application #1689 / run `35667917770` — **SUCCESS**  
Produção: **proibida sem autorização separada**

---

## 1. Goal

Entregar duas mudanças coesas e pequenas no Dashboard:

1. trocar o ranking **Top 5 produtos** por **Top 10 produtos**;
2. adicionar **Refeições vendidas** aos indicadores de `Visão do período`.

A métrica de refeições deve:

- somar unidades, não pedidos;
- usar a categoria snapshot do item;
- reconhecer apenas `Refeições` e o snapshot legado `Marmita`;
- reutilizar os períodos existentes;
- reutilizar a exclusão oficial de pedidos cancelados;
- incluir Entrega, Retirada e Local/comanda;
- não depender do cadastro atual de produtos.

---

## 2. Constraints

- Não desenvolver na `master`.
- Não fazer deploy de produção.
- Não criar migration.
- Não alterar Worker.
- Não alterar schema ou formulário de produtos.
- Não criar endpoint novo.
- Não alterar pagamentos, split payments, Finance, comandas ou impressão.
- Não importar internals de Orders a partir do Dashboard.
- Não mover analytics para `App.jsx`.
- Não alterar o contrato de `calculatePeriodMetrics`.
- Não inferir refeição por nome do produto.
- Não normalizar categoria por acento/caixa/grafia.
- Categorias válidas para a nova métrica são exatamente:
  - `Refeições`;
  - `Marmita` como compatibilidade histórica.
- Implementação sempre em TDD: RED comprovado antes do GREEN.
- Merge somente após homologação e autorização explícita.

---

## 3. Baseline técnico confirmado

### Dashboard analytics

Arquivo:

`src/app/surfaces/dashboard/dashboardAnalytics.js`

Estado atual:

- `safeQuantity` já existe;
- `getTopProducts` usa `filterOrdersByPeriod`;
- `getTopProducts` percorre `getOrderItems(order)`;
- soma `item.quantity`;
- default atual é `limit = 5`;
- `getPaymentMix` já é movement-based após split payments.

### Dashboard UI

Arquivo:

`src/app/surfaces/dashboard/DashboardSurface.jsx`

Estado atual:

- `Visão do período` possui 3 cards;
- usa `stats-grid stats-grid-three dashboard-period-stats`;
- Top Produtos exibe `Top 5 produtos`;
- aria-label atual também referencia Top 5;
- analytics é calculado em um único `useMemo`.

### Layout

`src/App.css` já define:

- `.stats-grid` = 4 colunas em desktop;
- <= 1080px = 2 colunas;
- <= 640px = 2 colunas;
- nenhum scroll horizontal necessário.

Portanto a implementação preferida para os quatro cards é reutilizar `.stats-grid` e remover `stats-grid-three` apenas da grade de período.

Não modificar a grade de três cards do topo.

### Ícone

`src/shared/ui/Icon.jsx` já possui `meal`.

Não alterar o registry de ícones.

### Testes ativos relevantes

- `src/utils/dashboardAnalytics.test.js`
- `src/pages/DashboardAnalytics.test.js`
- `src/dashboardResponsive.test.js`

Há assertions atuais explicitamente fixadas em Top 5.

---

# Task 1 — Establish implementation checkpoint and draft PR

## Purpose

Congelar o estado documental aprovado antes de código e garantir rastreabilidade remota.

## Steps

1. Confirmar que a branch remota é:
   `feature/issue-21-dashboard-meal-metrics`.
2. Confirmar que a base continua descendendo de:
   `619c8086e930ee7086876d24b8c9bd46324d99b1`.
3. Confirmar Spec aprovada e este plano no HEAD.
4. Rodar localmente, sem alterar código:

```bash
node --test src/utils/dashboardAnalytics.test.js src/pages/DashboardAnalytics.test.js src/dashboardResponsive.test.js
npm run test:architecture
npm run lint
npm run build
```

5. Registrar o resultado como baseline.
6. Após aprovação deste plano, abrir PR **DRAFT** para `master`, relacionando Issue #21.
7. Não executar staging ainda.

## Expected result

Baseline funcional verde e PR DRAFT disponível antes do primeiro RED de código.

---

# Task 2 — RED: Top 10 and meal-unit analytics contracts

## Files

Modify:

- `src/utils/dashboardAnalytics.test.js`

Do not modify production code in this task.

## RED A — Top 10

Atualizar o teste atual:

`top products aggregate repeated product identities, sum quantities, sort, and limit to five`

para fixar o novo contrato.

A fixture deve possuir **pelo menos 11 produtos distintos**, para provar que:

- o default retorna exatamente 10 quando há 11+ candidatos;
- os 10 são escolhidos depois da ordenação;
- o 11º é removido;
- soma de identidade repetida continua correta;
- desempate por label continua intacto.

Manter também um assertion com limite explícito, por exemplo:

```js
assert.equal(getTopProducts(orders, '7d', now, 3).length, 3)
```

para preservar o parâmetro `limit`.

## RED B — Refeições vendidas

Importar o contrato ainda inexistente:

```js
getMealsSold
```

Adicionar teste cobrindo em uma única matriz legível:

- `Refeições`, qty 3 => conta 3;
- `Marmita`, qty 2 => conta 2;
- `Bebidas`, qty 4 => conta 0;
- `Refeicoes`, qty 7 => conta 0;
- pedido Local => conta;
- pedido Retirada => conta;
- pedido Entrega => conta;
- pedido cancelado => zero;
- pedido fora da janela => zero;
- múltiplas linhas somam quantidades.

Resultado esperado deve provar o total exato.

## RED command

```bash
node --test src/utils/dashboardAnalytics.test.js
```

## Expected RED

Falhas exclusivamente porque:

- Top Produtos ainda limita em 5;
- `getMealsSold` ainda não existe.

Qualquer falha de parser/import acidental deve ser corrigida no próprio RED antes de seguir.

## Commit

Commit RED isolado, por exemplo:

`test: define dashboard meal metrics contracts`

Push e guardar SHA + evidência do run remoto se a PR já estiver aberta.

---

# Task 3 — GREEN: pure analytics implementation

## Files

Modify:

- `src/app/surfaces/dashboard/dashboardAnalytics.js`

## Implementation

### 3.1 Top 10

Alterar somente:

```js
limit = 5
```

para:

```js
limit = 10
```

Não alterar:

- chave de agrupamento;
- labels;
- ordenação;
- fallback histórico;
- soma de quantidade.

### 3.2 Meal categories

Adicionar constante privada:

```js
const MEAL_CATEGORIES = new Set(['Refeições', 'Marmita'])
```

Não exportar.

### 3.3 `getMealsSold`

Adicionar export público do módulo Dashboard:

```js
export const getMealsSold = (orders, period = '30d', now = new Date()) => {
  let total = 0
  for (const order of filterOrdersByPeriod(orders, period, now)) {
    for (const item of getOrderItems(order)) {
      if (!MEAL_CATEGORIES.has(item?.category)) continue
      total += safeQuantity(item.quantity)
    }
  }
  return total
}
```

A implementação pode ser equivalentemente pequena, mas deve manter:

- `filterOrdersByPeriod`;
- `getOrderItems`;
- `safeQuantity`;
- comparação exata do Set.

Não importar Catalog.

## Focused GREEN

```bash
node --test src/utils/dashboardAnalytics.test.js
```

Esperado: todos os testes desse arquivo verdes.

## Regression focused

```bash
node --test src/utils/dashboardAnalytics.test.js src/pages/DashboardAnalytics.test.js
```

O segundo arquivo pode continuar vermelho somente por ainda esperar Top 5 / ausência da UI de refeições. Não mascarar esse RED.

## Commit

`feat: add dashboard meal unit analytics`

Push e registrar SHA/evidência.

---

# Task 4 — RED: Dashboard UI contract

## Files

Modify:

- `src/pages/DashboardAnalytics.test.js`
- se necessário, `src/dashboardResponsive.test.js`

Do not modify `DashboardSurface.jsx` in this task.

## Required RED assertions

### Commercial summary

No teste de resumo do Dashboard, incluir:

`Refeições vendidas`

entre os labels obrigatórios.

### Visualization title

Substituir:

`Top 5 produtos`

por:

`Top 10 produtos`.

Fixar também o aria-label:

`Top 10 produtos por quantidade vendida`.

### Analytics wiring

Importar `getMealsSold` no teste quando útil e provar que cancelados não contam também nessa métrica.

A fixture comercial deve incluir categorias explícitas:

- item válido `Refeições`;
- item cancelado `Refeições`.

### Privacy

Fixar que o valor de refeições **não** passa por `displayMoney`.

É aceitável provar por source contract:

- `value={mealsSold}`;
- não existir `displayMoney(mealsSold)`.

### Grid

Fixar que `dashboard-period-stats` usa a grade de quatro cards sem `stats-grid-three`.

Pode ser assertion de source simples e localizada. Não alterar `src/App.css` apenas para satisfazer o teste, pois a classe genérica já possui o comportamento desejado.

## RED command

```bash
node --test src/pages/DashboardAnalytics.test.js src/dashboardResponsive.test.js
```

## Expected RED

Falhas apenas por UI ainda não implementada:

- Refeições vendidas ausente;
- Top 10 ausente;
- mealsSold não wired;
- grade ainda marcada como three.

## Commit

`test: define dashboard meal metric UI`

Push e registrar SHA/evidência.

---

# Task 5 — GREEN: Dashboard UI and responsive composition

## Files

Modify:

- `src/app/surfaces/dashboard/DashboardSurface.jsx`

Only modify:

- `src/app/surfaces/dashboard/dashboard.css`
- `src/App.css`

if a focused test or real visual defect proves the need.

Do not change CSS speculatively.

## Implementation

### 5.1 Import

Adicionar:

`getMealsSold`

ao import de analytics.

### 5.2 Analytics memo

Adicionar:

```js
mealsSold: getMealsSold(orders, period, now),
```

ao mesmo `useMemo`.

Desestruturar:

```js
const { metrics, daily, topProducts, mealsSold, paymentMix } = analytics
```

Não criar novo state/effect.

### 5.3 Period cards

Trocar somente a classe da grade de período:

```text
stats-grid stats-grid-three dashboard-period-stats
```

por:

```text
stats-grid dashboard-period-stats
```

Manter a grade superior de indicadores principais como `stats-grid-three`.

Adicionar quarto card:

```jsx
<StatCard
  label="Refeições vendidas"
  value={mealsSold}
  helper="Unidades da categoria Refeições"
  icon="meal"
/>
```

O helper pode receber microajuste de texto se necessário para clareza, sem alterar semântica.

Não usar `displayMoney`.

### 5.4 Ranking

Alterar:

- heading para `Top 10 produtos`;
- aria-label para `Top 10 produtos por quantidade vendida`.

Não alterar `DashboardBarChart`.

## Focused GREEN

```bash
node --test src/utils/dashboardAnalytics.test.js src/pages/DashboardAnalytics.test.js src/dashboardResponsive.test.js
```

## Architecture regression

```bash
npm run test:architecture
npm run lint
npm run build
```

## Commit

`feat: show meal units and top ten products`

Push e registrar SHA/evidência.

---

# Task 6 — Focused behavioral regression

## Purpose

Provar que a pequena mudança não alterou analytics adjacentes.

## Tests

Rodar:

```bash
node --test \
  src/utils/dashboardAnalytics.test.js \
  src/pages/DashboardAnalytics.test.js \
  src/dashboardResponsive.test.js
```

Depois buscar referências ativas inesperadas:

```bash
git grep -n "Top 5 produtos" -- src
git grep -n "getTopProducts" -- src
git grep -n "getMealsSold" -- src
```

Expected:

- nenhuma referência ativa de UI/teste atual a Top 5;
- `getTopProducts` sem consumers inesperados quebrados;
- `getMealsSold` restrito à superfície/testes do Dashboard.

Não reescrever documentação histórica antiga que descrevia corretamente versões anteriores.

## No-change audit

Confirmar diff vazio em:

- `worker/`;
- `migrations/`;
- `src/domains/catalog/`;
- `src/domains/finance/`;
- `src/domains/table-service/`;
- impressão/QZ.

Se houver mudança nessas áreas, parar e justificar antes de continuar.

---

# Task 7 — Full remote validation

## Preconditions

- Tasks 2–6 verdes;
- branch pushed;
- PR permanece DRAFT;
- produção intocada.

## Required gate

Executar/aguardar `Validate application` completo no SHA exato.

O workflow deve comprovar:

- 8/8 test shards SUCCESS;
- frontend architecture PASS;
- lint PASS;
- build PASS;
- production Worker dry-run PASS;
- staging Worker dry-run PASS;
- local D1 migrations PASS;
- Spec B D1 clean install/upgrade PASS.

Nenhuma falha pode ser tratada como irrelevante sem investigação.

Se houver falha:

1. identificar se é regressão da feature, flaky conhecido ou infraestrutura;
2. corrigir somente a causa real;
3. obter novo Validate GREEN no SHA final exato.

## Documentation

Atualizar o body da PR com:

- Spec;
- plan;
- RED/GREEN SHAs;
- focused gates;
- full Validate;
- confirmação de no migration/no Worker changes.

---

# Task 8 — Official staging

## Preconditions

- full Validate GREEN;
- nenhum blocker aberto.

## Deploy

Usar o workflow oficial de staging já existente.

Não criar workflow temporário se o workflow padrão puder executar o deploy.

Registrar:

- run number / run ID;
- SHA exato;
- build;
- staging Worker dry-run;
- D1/migrations status;
- deploy status;
- Worker version;
- readiness;
- login smoke.

Produção continua proibida.

---

# Task 9 — Guided manual QA

Executar em staging.

## Block A — Metrics

1. Abrir Dashboard.
2. Confirmar card `Refeições vendidas`.
3. Hoje: conferir valor com pedidos conhecidos.
4. 7 dias: conferir atualização.
5. 30 dias: conferir atualização.
6. Ocultar valores monetários: refeições continua visível.

## Block B — Counting

7. Pedido com 1 Refeição => +1.
8. Pedido com quantidade >1 => soma unidades.
9. Pedido misto Refeição + Bebida => só refeições contam.
10. Pedido Local/comanda => conta.
11. Se houver snapshot legado `Marmita` alcançável em staging, confirmar compatibilidade; se não houver, marcar como coberto automaticamente.
12. Cancelado => não conta, se cenário seguro estiver disponível; senão usar evidência automática.

## Block C — Top 10

13. Heading = Top 10 produtos.
14. Se houver >5 produtos vendidos no período, confirmar que aparecem posições além da quinta.
15. Confirmar ordem por quantidade.
16. Confirmar labels/quantidades legíveis.

## Block D — Responsive

17. Desktop: quatro cards sem overflow.
18. Mobile: dois cards por linha conforme grade existente.
19. Top 10 sem scroll horizontal interno.
20. Tema claro/escuro sem regressão relevante.

Registrar PASS / FAIL / BLOCKED por cenário.

---

# Task 10 — Closure

## Final gates

Antes de pedir merge:

1. QA manual fechado sem FAIL.
2. Full Validate GREEN no SHA final exato.
3. Se houver commit apenas de QA/docs após o último GREEN, obter novo Validate no HEAD final quando o workflow/branch rules exigirem; não usar evidência de SHA diferente como final.
4. PR mergeable.
5. Review threads = 0 unresolved.
6. Produção não deployada.
7. Issue #21 e PR refletem o comportamento final.

## Final report

Informar:

- final application SHA;
- final documentation SHA, se diferente;
- Validate run;
- testes/pass/fail/skipped;
- architecture/lint/build;
- Worker dry-runs;
- D1 gates;
- staging deploy/run/version;
- manual QA;
- PR state/mergeability;
- NO PRODUCTION DEPLOY;
- MERGE NOT EXECUTED.

Parar e aguardar autorização explícita do usuário para merge.

---

## Auto-review do plano

### Scope check

O plano entrega integralmente a Spec e não adiciona:

- backend;
- migration;
- catálogo novo;
- classificação manual;
- novo filtro;
- novo gráfico.

### TDD check

Existem REDs separados para:

- analytics;
- UI/wiring.

Cada RED possui falha esperada específica antes do GREEN correspondente.

### Architecture check

Dashboard continua consumindo contratos públicos de Orders. Nenhuma dependência de Catalog/Finance internals é adicionada.

### Data-history check

`Refeições` é o valor oficial atual; `Marmita` é aceito somente porque há evidência concreta de snapshots legados no repositório. `Refeicoes` e outras variações não são aceitas silenciosamente.

### Responsive check

A solução reutiliza a grade já existente de quatro colunas/duas colunas e o ícone `meal`; não há justificativa inicial para CSS ou icon changes.

### CI check

O plano considera o workflow atual shardado em 8 testes e exige o gate completo após a feature.

### Placeholder check

Não há TBD/TODO nem decisão funcional pendente.

### Result

Nenhum blocker encontrado. Plano pronto para aprovação do usuário antes de qualquer implementação de código.
