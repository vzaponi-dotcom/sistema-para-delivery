# Finance Cash Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir o Financeiro para um fluxo de caixa realizado confiável, com categorias manuais seguras, data e meio estruturados, edição/exclusão de lançamentos manuais, saldo inicial, visão por período, filtros e sincronização automática sem permitir alterações em movimentos gerados por pedidos.

**Architecture:** O D1 continua sendo a fonte de verdade. O Worker passa a modelar movimentos financeiros e configuração de abertura com regras de domínio explícitas; `App.jsx` continua proprietário das coleções autenticadas e aplica imediatamente os objetos oficiais retornados pelas escritas. Vocabulário financeiro estável fica em `shared/finance.js`, cálculos/filtros leves ficam em `src/utils/finance.js`, e a UI do Financeiro é dividida em diálogos/filtros focados para evitar expandir novamente `App.jsx`.

**Tech Stack:** React 19.2.x, Vite 8.2.x, Node test runner (`node --test`), Cloudflare Worker, D1/SQLite, Wrangler 4.128.0, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-03-finance-cash-flow-design.md`

## Global Constraints

- TDD estrito para toda mudança de comportamento: escrever teste RED, executar e confirmar a falha esperada, implementar o mínimo, executar GREEN e só então refatorar.
- O Financeiro representa **fluxo de caixa realizado**; contas a pagar/receber futuras, fechamento diário, conciliação bancária, múltiplos saldos e DRE permanecem fora de escopo.
- Novos movimentos manuais usam códigos internos estáveis; `Vendas`/`Estornos` são automáticos e nunca aparecem como opção manual.
- Movimentos `order-payment` e `order-refund` não podem ser editados nem excluídos, inclusive por chamada direta à API.
- Novo movimento manual exige tipo, categoria compatível, descrição, valor maior que zero, data não futura e forma/meio válida.
- `movement_date` é a data financeira; `created_at` continua sendo o instante real de registro.
- Formas/meios válidos: `Dinheiro`, `Pix`, `Cartão de débito`, `Cartão de crédito`, `Transferência`, `Outro`.
- Período padrão é Hoje; atalhos são Hoje, 7 dias, 30 dias e Personalizado, sempre inclusivos e baseados em `America/Sao_Paulo`.
- Filtro principal altera Entradas, Saídas, Resultado e histórico; filtros secundários alteram somente a lista; Saldo atual não muda com filtros.
- Saldo atual = saldo inicial + entradas desde a abertura - saídas desde a abertura; movimentos da própria `opening_date` entram no cálculo.
- Saldo inicial pode ser positivo, zero ou negativo e não é uma entrada operacional.
- Exclusão de movimento manual é lógica por `deleted_at`; movimentos excluídos não aparecem no bootstrap nem em cálculos ativos.
- Dados legados são preservados; categorias antigas continuam legíveis e estornos antigos sem meio estruturado permanecem `Não informado`.
- Vendas automáticas antigas podem obter meio do pagamento relacionado; estornos antigos não inferem o meio a partir do pagamento original.
- Escritas bem-sucedidas atualizam o dispositivo autor imediatamente a partir da resposta oficial e marcam a coleção afetada como mutada.
- Outros dispositivos convergem pela sincronização global já existente, sem F5; respostas antigas não podem sobrescrever uma escrita mais nova.
- Estornos pendentes não são escondidos por período ou filtros do histórico.
- Ações financeiras significativas usam revisão/confirmação e o feedback centralizado de sucesso já existente.
- Preserve operação mobile entre 320 e 480 px; os quatro indicadores financeiros usam grade 2 × 2 no mobile e filtros permanecem operáveis.
- Migração remota e deploy de produção permanecem manuais. **Nunca** execute `d1:migrate:remote`, migração D1 remota ou deploy de produção sem autorização explícita do usuário.
- Verificação final obrigatória: `npm test`, `npm run lint`, `npm run build` e `npx --yes wrangler@4.128.0 deploy --dry-run`.

---

## File Structure

**Create**
- `shared/finance.js` — códigos/rótulos de categorias, métodos de pagamento, normalização legada e data financeira em `America/Sao_Paulo`.
- `shared/finance.test.js` — contrato de categorias, normalização legada, meios e fronteiras de data.
- `migrations/0009_finance_cash_flow.sql` — colunas financeiras aditivas e tabela singleton `finance_settings`.
- `worker/financeMigration.test.js` — regressão estrutural da migração 0009.
- `worker/financeRepository.js` — mapeamento/persistência de movimentos manuais e configuração financeira.
- `worker/financeRepository.test.js` — CRUD manual, proteção de movimentos automáticos, soft delete e upsert de abertura.
- `worker/financeValidation.js` — validação de payloads financeiros antes da persistência.
- `worker/financeValidation.test.js` — categorias/tipos, data futura, meio e saldo inicial assinado.
- `src/utils/finance.js` — períodos inclusivos, resumo, saldo atual e filtros do histórico.
- `src/utils/finance.test.js` — cálculos e filtros puros, inclusive categorias legadas.
- `src/components/MovementDialog.jsx` — criação/edição manual com formulário e etapa de revisão.
- `src/components/MovementDialog.test.js` — contrato do formulário, categoria dependente, BRL, data e revisão.
- `src/components/OpeningBalanceDialog.jsx` — configurar/editar saldo inicial com revisão forte.
- `src/components/OpeningBalanceDialog.test.js` — valor assinado, data e comparação antes/depois.
- `src/components/FinancePeriodSelector.jsx` — Hoje/7/30/Personalizado.
- `src/components/FinanceHistoryFilters.jsx` — busca e filtros secundários, com apresentação mobile compacta.
- `src/pages/Finance.test.js` — comportamento estrutural da nova tela e ações manuais/automáticas.
- `src/financeRealtimeRegression.test.js` — ownership/sincronização imediata de movimentos e `financeSettings`.

**Modify**
- `worker/validation.js` — reutilizar meios compartilhados e adicionar conversão monetária assinada para saldo inicial.
- `worker/repositories.js` — bootstrap ativo, `financeSettings`, movimentos automáticos com meio/updated_at e mapeamento financeiro compartilhado.
- `worker/orderCancellation.js` — persistir o meio efetivo em novos estornos e usar o novo mapper financeiro.
- `worker/orderWriteEffects.js` — carregar `paymentMethod`/metadados do movimento e respeitar registros ativos.
- `worker/index.js` — rotas POST/PATCH/DELETE de movimentos e PUT de configuração financeira.
- `worker/index.test.js` — bootstrap incluindo `financeSettings` e contrato HTTP financeiro.
- `worker/orderRepositories.test.js` — novos campos nas vendas automáticas e compatibilidade dos inserts.
- `worker/orderCancellation.test.js` / `worker/orderCancellationHttp.test.js` — meio efetivo de estorno e proteção de regressão.
- `src/utils/formFormatting.js` / `src/utils/formFormatting.test.js` — máscara/parser BRL assinados sem mudar o comportamento monetário não negativo existente.
- `src/api/client.js` / `src/api/client.test.js` — PATCH/DELETE de movimento e PUT de `finance-settings`.
- `src/App.jsx` — estado `financeSettings`, efeitos oficiais, handlers de escrita e remoção do formulário financeiro inline antigo.
- `src/pages/Finance.jsx` — nova composição do fluxo de caixa, diálogos, cards, período, filtros, ações e detalhe do pedido automático.
- `src/pages/FinanceMoreMobile.test.js` — substituir expectativa do input numérico antigo e cobrir grid/filtros mobile.
- `src/finance-mobile.css` — layout dos cards, filtros, linhas e ações entre 320–480 px.
- `src/App.css` — somente estilos financeiros desktop que já pertencem ao sistema visual global.

---

### Task 1: Definir o vocabulário financeiro compartilhado

**Files:**
- Create: `shared/finance.js`
- Create: `shared/finance.test.js`
- Modify: `worker/validation.js`

**Interfaces:**
- Produces: `FINANCE_TIME_ZONE`, `PAYMENT_METHODS`, `MANUAL_MOVEMENT_CATEGORIES`, `getManualMovementCategoryOptions(type)`, `isManualMovementCategory(type, category)`, `normalizeMovementCategory(movement)`, `getMovementCategoryLabel(movement)`, `getBusinessDate(date)`.
- Consumers later: Worker validation/repository, MovementDialog, Finance filters and `src/utils/finance.js`.

- [ ] **Step 1: Escrever testes RED para categorias, legados e fuso**

Crie `shared/finance.test.js` cobrindo pelo menos:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PAYMENT_METHODS,
  getBusinessDate,
  getManualMovementCategoryOptions,
  getMovementCategoryLabel,
  isManualMovementCategory,
  normalizeMovementCategory,
} from './finance.js'

test('manual categories are distinct by movement type', () => {
  assert.deepEqual(getManualMovementCategoryOptions('entrada').map((item) => item.value), ['contribution', 'other_income'])
  assert.equal(isManualMovementCategory('entrada', 'sales'), false)
  assert.equal(isManualMovementCategory('saida', 'packaging'), true)
  assert.equal(isManualMovementCategory('saida', 'contribution'), false)
})

test('legacy categories normalize without rewriting the stored row', () => {
  assert.equal(normalizeMovementCategory({ type: 'entrada', category: 'Vendas', source: 'order-payment' }), 'sales')
  assert.equal(normalizeMovementCategory({ type: 'saida', category: 'Estornos', source: 'order-refund' }), 'refunds')
  assert.equal(normalizeMovementCategory({ type: 'saida', category: 'Insumos', source: 'manual' }), 'supplies')
  assert.equal(normalizeMovementCategory({ type: 'entrada', category: 'Outros', source: 'manual' }), 'other_income')
  assert.equal(getMovementCategoryLabel({ type: 'saida', category: 'packaging', source: 'manual' }), 'Embalagens')
})

test('finance business date uses America/Sao_Paulo', () => {
  assert.equal(getBusinessDate(new Date('2026-09-04T01:30:00.000Z')), '2026-09-03')
})

test('payment methods match the operational payment vocabulary', () => {
  assert.deepEqual(PAYMENT_METHODS, ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro'])
})
```

- [ ] **Step 2: Executar RED**

```bash
node --test shared/finance.test.js
```

Expected: FAIL porque `shared/finance.js` ainda não existe.

- [ ] **Step 3: Implementar o domínio compartilhado mínimo**

Use códigos estáveis e normalize apenas para leitura/filtro:

```js
export const FINANCE_TIME_ZONE = 'America/Sao_Paulo'
export const PAYMENT_METHODS = ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']

export const MANUAL_MOVEMENT_CATEGORIES = {
  entrada: [
    { value: 'contribution', label: 'Aporte' },
    { value: 'other_income', label: 'Outros recebimentos' },
  ],
  saida: [
    { value: 'supplies', label: 'Insumos' },
    { value: 'packaging', label: 'Embalagens' },
    { value: 'delivery_costs', label: 'Delivery / Frete' },
    { value: 'gas', label: 'Gás' },
    { value: 'water', label: 'Água' },
    { value: 'electricity', label: 'Energia' },
    { value: 'rent', label: 'Aluguel' },
    { value: 'maintenance', label: 'Manutenção' },
    { value: 'fees', label: 'Taxas' },
    { value: 'owner_draw', label: 'Retirada' },
    { value: 'other_expense', label: 'Outros' },
  ],
}
```

`normalizeMovementCategory()` deve considerar `source`, `type` e o valor legado; `getMovementCategoryLabel()` usa o código normalizado sem alterar `movement.category`.

Troque o `Set` local de `worker/validation.js` por `new Set(PAYMENT_METHODS)` importado de `../shared/finance.js`.

- [ ] **Step 4: Executar GREEN e regressão de validação**

```bash
node --test shared/finance.test.js worker/*.test.js
```

Expected: PASS; validação de pagamentos existente continua verde.

- [ ] **Step 5: Commit**

```bash
git add shared/finance.js shared/finance.test.js worker/validation.js
git commit -m "feat: define shared finance domain"
```

---

### Task 2: Evoluir o schema e preservar metadados de movimentos automáticos

**Files:**
- Create: `migrations/0009_finance_cash_flow.sql`
- Create: `worker/financeMigration.test.js`
- Create: `worker/financeRepository.js`
- Create: `worker/financeRepository.test.js` (mapper/bootstrap subset first)
- Modify: `worker/repositories.js`
- Modify: `worker/orderCancellation.js`
- Modify: `worker/orderWriteEffects.js`
- Modify: `worker/orderRepositories.test.js`
- Modify: `worker/orderCancellation.test.js`

**Interfaces:**
- Produces: `mapMovementRow(row)`, `mapFinanceSettingsRow(row)`, `loadFinanceSettings(db, businessId)` from `worker/financeRepository.js`.
- Movement DTO gains `paymentMethod`, `updatedAt`; active rows keep the existing `id/type/category/description/value/source/orderId/paymentId/movementDate/date/createdAt` fields.
- Bootstrap gains `financeSettings: null | { openingBalance, openingDate, createdAt, updatedAt }`.

- [ ] **Step 1: Escrever RED para a migração aditiva**

Em `worker/financeMigration.test.js` leia a SQL e exija:

```js
assert.match(sql, /ALTER TABLE movements ADD COLUMN payment_method TEXT/i)
assert.match(sql, /ALTER TABLE movements ADD COLUMN updated_at TEXT/i)
assert.match(sql, /ALTER TABLE movements ADD COLUMN deleted_at TEXT/i)
assert.match(sql, /UPDATE movements SET updated_at = created_at WHERE updated_at IS NULL/i)
assert.match(sql, /CREATE TABLE finance_settings/i)
assert.match(sql, /opening_balance_cents INTEGER NOT NULL/i)
assert.match(sql, /opening_date TEXT NOT NULL/i)
```

- [ ] **Step 2: Escrever RED para mapeamento/automáticos**

Em `worker/financeRepository.test.js`:

```js
assert.deepEqual(mapMovementRow({
  id: 'm1', type: 'entrada', category: 'Vendas', description: 'Pedido', value_cents: 3250,
  source: 'order-payment', order_id: 'o1', payment_id: 'p1', payment_method: 'Pix',
  movement_date: '2026-09-03', created_at: 'created', updated_at: 'updated',
}), {
  id: 'm1', type: 'entrada', category: 'Vendas', description: 'Pedido', value: 32.5,
  source: 'order-payment', orderId: 'o1', paymentId: 'p1', paymentMethod: 'Pix',
  movementDate: '2026-09-03', date: '2026-09-03', createdAt: 'created', updatedAt: 'updated',
})
```

Estenda `worker/orderRepositories.test.js` para provar que novos `order-payment` gravam `payment_method` igual ao método do pagamento e `updated_at = created_at`. Estenda o teste de estorno para provar que `order-refund` grava o **refundMethod** escolhido, não o método original.

- [ ] **Step 3: Executar RED**

```bash
node --test worker/financeMigration.test.js worker/financeRepository.test.js worker/orderRepositories.test.js worker/orderCancellation.test.js
```

Expected: FAIL pelas colunas/mapper/metadados ainda inexistentes.

- [ ] **Step 4: Criar `0009_finance_cash_flow.sql`**

A migração deve ser somente aditiva:

```sql
ALTER TABLE movements ADD COLUMN payment_method TEXT;
ALTER TABLE movements ADD COLUMN updated_at TEXT;
ALTER TABLE movements ADD COLUMN deleted_at TEXT;
UPDATE movements SET updated_at = created_at WHERE updated_at IS NULL;

CREATE TABLE finance_settings (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  opening_balance_cents INTEGER NOT NULL,
  opening_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX movements_business_date_active_idx
  ON movements (business_id, movement_date DESC)
  WHERE deleted_at IS NULL;
```

Não atualize categorias legadas e não invente `payment_method` para estornos antigos.

- [ ] **Step 5: Criar mapper/config repository e atualizar leituras**

Em `worker/financeRepository.js`:

```js
import { centsToMoney } from './validation.js'

export const mapMovementRow = (row) => ({
  id: row.id,
  type: row.type,
  category: row.category,
  description: row.description,
  value: centsToMoney(row.value_cents),
  source: row.source || 'manual',
  orderId: row.order_id ?? null,
  paymentId: row.payment_id ?? null,
  paymentMethod: row.payment_method ?? null,
  movementDate: row.movement_date,
  date: row.movement_date,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
})

export const mapFinanceSettingsRow = (row) => row ? ({
  openingBalance: centsToMoney(row.opening_balance_cents),
  openingDate: row.opening_date,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
}) : null
```

`loadBootstrap()` deve selecionar somente `m.deleted_at IS NULL`, trazer `payment_method/updated_at` e retornar `financeSettings`. Para vendas automáticas antigas, a query pode usar `COALESCE(m.payment_method, p.method)` somente quando `m.source = 'order-payment'`; para `order-refund`, preserve `m.payment_method` nulo.

Atualize `orderWriteEffects.js` com a mesma regra e `deleted_at IS NULL`.

- [ ] **Step 6: Persistir meio/updated_at em todos os inserts automáticos**

Atualize os três caminhos de criação de `order-payment` em `worker/repositories.js` e o insert de `order-refund` em `worker/orderCancellation.js`:

```sql
INSERT INTO movements (
  id, business_id, type, category, description, value_cents,
  source, order_id, payment_id, payment_method,
  movement_date, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

Venda: `payment_method = method/input.paymentMethod`. Estorno: `payment_method = refundMethod`. `updated_at = created_at`.

Troque imports de `mapMovementRow` em `repositories.js`, `orderCancellation.js` e `orderWriteEffects.js` para `./financeRepository.js`.

- [ ] **Step 7: Executar GREEN**

```bash
node --test worker/financeMigration.test.js worker/financeRepository.test.js worker/orderRepositories.test.js worker/orderCancellation.test.js worker/orderCancellationHttp.test.js
```

Expected: PASS.

- [ ] **Step 8: Validar migração local, nunca remota**

```bash
npm run d1:migrate:local
```

Expected: migração 0009 aplicada com sucesso ao D1 local. **Não** executar `npm run d1:migrate:remote`.

- [ ] **Step 9: Commit**

```bash
git add migrations/0009_finance_cash_flow.sql worker/financeMigration.test.js worker/financeRepository.js worker/financeRepository.test.js worker/repositories.js worker/orderCancellation.js worker/orderWriteEffects.js worker/orderRepositories.test.js worker/orderCancellation.test.js
git commit -m "feat: persist finance cash flow metadata"
```

---

### Task 3: Implementar cálculos de período, resumo, saldo e filtros como domínio puro do frontend

**Files:**
- Create: `src/utils/finance.js`
- Create: `src/utils/finance.test.js`

**Interfaces:**
- Produces: `getFinancePeriodRange(period, today)`, `filterMovementsByPeriod(movements, range)`, `summarizeFinancePeriod(movements, range)`, `calculateCurrentBalance(movements, financeSettings)`, `filterFinanceHistory(movements, filters)`, `hasFinanceSecondaryFilters(filters)`.
- Period values: `'today' | '7d' | '30d' | 'custom'`; custom carries `{ startDate, endDate }`.

- [ ] **Step 1: Escrever RED para ranges inclusivos**

```js
test('today, 7d and 30d ranges are inclusive', () => {
  assert.deepEqual(getFinancePeriodRange({ key: 'today' }, '2026-09-03'), { startDate: '2026-09-03', endDate: '2026-09-03' })
  assert.deepEqual(getFinancePeriodRange({ key: '7d' }, '2026-09-03'), { startDate: '2026-08-28', endDate: '2026-09-03' })
  assert.deepEqual(getFinancePeriodRange({ key: '30d' }, '2026-09-03'), { startDate: '2026-08-05', endDate: '2026-09-03' })
  assert.deepEqual(getFinancePeriodRange({ key: 'custom', startDate: '2026-08-10', endDate: '2026-08-12' }, '2026-09-03'), { startDate: '2026-08-10', endDate: '2026-08-12' })
})
```

- [ ] **Step 2: Escrever RED para resumo e saldo atual**

```js
const movements = [
  { id: 'before', type: 'entrada', value: 100, movementDate: '2026-08-31' },
  { id: 'open', type: 'entrada', value: 50, movementDate: '2026-09-01' },
  { id: 'exit', type: 'saida', value: 20, movementDate: '2026-09-02' },
]

assert.deepEqual(summarizeFinancePeriod(movements, { startDate: '2026-09-01', endDate: '2026-09-03' }), {
  entries: 50, exits: 20, result: 30,
})
assert.equal(calculateCurrentBalance(movements, { openingBalance: 200, openingDate: '2026-09-01' }), 230)
assert.equal(calculateCurrentBalance(movements, null), null)
```

- [ ] **Step 3: Escrever RED para filtros secundários sem alterar resumo**

Cubra busca, tipo, categoria normalizada e forma/meio:

```js
const filtered = filterFinanceHistory(movements, {
  search: 'embalagem', type: 'saida', category: 'packaging', paymentMethod: 'Pix',
})
assert.deepEqual(filtered.map((item) => item.id), ['m-packaging'])
```

Inclua uma linha legada `category: 'Insumos'` e prove que o filtro `supplies` a encontra via `normalizeMovementCategory()`.

- [ ] **Step 4: Executar RED**

```bash
node --test src/utils/finance.test.js
```

Expected: FAIL porque o utilitário não existe.

- [ ] **Step 5: Implementar funções puras**

Use comparação lexical em datas ISO `YYYY-MM-DD` e aritmética UTC somente para deslocar dias, sem converter `movementDate` em timestamp local:

```js
const inRange = (date, range) => date >= range.startDate && date <= range.endDate

export const summarizeFinancePeriod = (movements, range) => {
  const active = filterMovementsByPeriod(movements, range)
  const entries = active.filter((m) => m.type === 'entrada').reduce((sum, m) => sum + Number(m.value || 0), 0)
  const exits = active.filter((m) => m.type === 'saida').reduce((sum, m) => sum + Number(m.value || 0), 0)
  return { entries, exits, result: entries - exits }
}
```

`calculateCurrentBalance()` retorna `null` sem configuração de abertura.

- [ ] **Step 6: Executar GREEN**

```bash
node --test src/utils/finance.test.js shared/finance.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/finance.js src/utils/finance.test.js
git commit -m "feat: add finance period and balance domain"
```

---

### Task 4: Criar formulários revisáveis para movimento e saldo inicial

**Files:**
- Modify: `src/utils/formFormatting.js`
- Modify: `src/utils/formFormatting.test.js`
- Create: `src/components/MovementDialog.jsx`
- Create: `src/components/MovementDialog.test.js`
- Create: `src/components/OpeningBalanceDialog.jsx`
- Create: `src/components/OpeningBalanceDialog.test.js`

**Interfaces:**
- `MovementDialog({ open, movement, today, disabled, onClose, onSubmit })`; `onSubmit(payload)` recebe `{ type, category, description, value, movementDate, paymentMethod }`.
- `OpeningBalanceDialog({ open, settings, today, currentBalance, disabled, onClose, onSubmit })`; `onSubmit(payload)` recebe `{ openingBalance, openingDate }`.
- Produces formatting helpers: `formatSignedBRLCurrencyInput`, `formatSignedBRLCurrencyValue`, `parseSignedBRLCurrencyInput`.

- [ ] **Step 1: RED para dinheiro assinado sem regressão do dinheiro comum**

Em `src/utils/formFormatting.test.js`:

```js
assert.equal(formatSignedBRLCurrencyValue(-100), '-R$ 100,00')
assert.equal(formatSignedBRLCurrencyInput('-1234'), '-R$ 12,34')
assert.equal(parseSignedBRLCurrencyInput('-R$ 12,34'), -12.34)
assert.equal(formatBRLCurrencyValue(-100), 'R$ 0,00') // comportamento existente não muda
```

- [ ] **Step 2: RED para `MovementDialog`**

Use o padrão de regressão por fonte já usado no projeto e, onde possível, importe funções puras auxiliares do componente. Exija:

```js
assert.match(source, /getManualMovementCategoryOptions/)
assert.match(source, /formatBRLCurrencyInput/)
assert.match(source, /parseBRLCurrencyInput/)
assert.match(source, /paymentMethod/)
assert.match(source, /movementDate/)
assert.match(source, /Revisar movimento|Revisar alterações/)
assert.match(source, /ConfirmationDialog/)
```

Também cubra por função pura exportada ou helper separado que trocar `entrada -> saida` limpa categoria incompatível.

Novo movimento começa com `type: 'entrada'`, `category: ''`, `paymentMethod: ''`, data = `today`, valor `R$ 0,00`; não presumir Pix/categoria silenciosamente.

- [ ] **Step 3: RED para `OpeningBalanceDialog`**

Exija valor assinado, data, revisão forte, estado de edição e cópia sobre recálculo:

```js
assert.match(source, /formatSignedBRLCurrencyInput/)
assert.match(source, /openingDate/)
assert.match(source, /saldo atual|recalcula/i)
assert.match(source, /ConfirmationDialog/)
```

- [ ] **Step 4: Executar RED**

```bash
node --test src/utils/formFormatting.test.js src/components/MovementDialog.test.js src/components/OpeningBalanceDialog.test.js
```

Expected: FAIL pelos helpers/componentes ausentes.

- [ ] **Step 5: Implementar os helpers assinados**

Não altere os três helpers BRL não negativos existentes. Adicione variantes específicas para abertura:

```js
export const parseSignedBRLCurrencyInput = (value) => {
  const text = String(value ?? '').trim()
  const negative = text.startsWith('-')
  const number = parseBRLCurrencyInput(text.replace(/^-/, ''))
  return negative ? -number : number
}
```

A formatação assinada preserva o sinal e usa o mesmo padrão `R$ 0,00`.

- [ ] **Step 6: Implementar `MovementDialog` com duas etapas**

Formulário -> review -> `onSubmit`:

```js
const payload = {
  type: draft.type,
  category: draft.category,
  description: draft.description.trim(),
  value: parseBRLCurrencyInput(draft.value),
  movementDate: draft.movementDate,
  paymentMethod: draft.paymentMethod,
}
```

Desabilite “Revisar” sem categoria, descrição, valor > 0, data ou meio. `input type="date"` recebe `max={today}`. Ao editar, pré-preencha os dados persistidos e mude os textos para `Editar movimento` / `Revisar alterações`.

- [ ] **Step 7: Implementar `OpeningBalanceDialog`**

Primeira configuração começa em `R$ 0,00` e `today`; edição usa valores atuais. A review mostra valor/data atuais quando existem, novos valores e, quando `currentBalance` estiver disponível, informa que o saldo será recalculado.

- [ ] **Step 8: Executar GREEN**

```bash
node --test src/utils/formFormatting.test.js src/components/MovementDialog.test.js src/components/OpeningBalanceDialog.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/utils/formFormatting.js src/utils/formFormatting.test.js src/components/MovementDialog.jsx src/components/MovementDialog.test.js src/components/OpeningBalanceDialog.jsx src/components/OpeningBalanceDialog.test.js
git commit -m "feat: add reviewed finance forms"
```

---

### Task 5: Implementar o contrato de escrita financeira ponta a ponta

**Files:**
- Create: `worker/financeValidation.js`
- Create: `worker/financeValidation.test.js`
- Modify: `worker/financeRepository.js`
- Modify: `worker/financeRepository.test.js`
- Modify: `worker/validation.js`
- Modify: `worker/index.js`
- Modify: `worker/index.test.js`
- Modify: `src/api/client.js`
- Modify: `src/api/client.test.js`
- Modify: `src/App.jsx`
- Modify: `src/pages/Finance.jsx`
- Create: `src/financeRealtimeRegression.test.js`

**Interfaces:**
- Worker validation: `parseManualMovementInput(body, now)`, `parseFinanceSettingsInput(body, now)`.
- Worker repository: `createManualMovement`, `updateManualMovement`, `softDeleteManualMovement`, `upsertFinanceSettings`.
- HTTP: `POST /api/movements`, `PATCH /api/movements/:id`, `DELETE /api/movements/:id`, `PUT /api/finance-settings`.
- Client: `createMovement(movement)`, `updateMovement(id, movement)`, `deleteMovement(id)`, `saveFinanceSettings(settings)`.
- Delete response: `{ deletedMovementId: id }` only after `deleted_at` is persisted.
- Settings response: `{ financeSettings }`.

- [ ] **Step 1: RED para validação financeira**

Em `worker/financeValidation.test.js` prove:

```js
const now = new Date('2026-09-03T20:00:00.000Z')
assert.deepEqual(parseManualMovementInput({
  type: 'saida', category: 'packaging', description: ' Caixas ', value: 25.5,
  movementDate: '2026-09-02', paymentMethod: 'Pix',
}, now), {
  type: 'saida', category: 'packaging', description: 'Caixas', valueCents: 2550,
  movementDate: '2026-09-02', paymentMethod: 'Pix',
})
```

Rejeite `sales`, categoria de tipo contrário, valor `0`, valor negativo, data `2026-09-04`, data inválida e meio inválido. Para settings:

```js
assert.deepEqual(parseFinanceSettingsInput({ openingBalance: -125.5, openingDate: '2026-09-01' }, now), {
  openingBalanceCents: -12550,
  openingDate: '2026-09-01',
})
```

- [ ] **Step 2: RED para repository CRUD/proteção**

Use FakeDb focado em `worker/financeRepository.test.js` e prove:

```js
const created = await createManualMovement(db, businessId, input, now)
assert.equal(created.source, 'manual')
assert.equal(created.paymentMethod, 'Pix')
assert.equal(created.movementDate, '2026-09-02')

const updated = await updateManualMovement(db, businessId, created.id, { ...input, valueCents: 3000 }, later)
assert.equal(updated.value, 30)

const deletedId = await softDeleteManualMovement(db, businessId, created.id, later)
assert.equal(deletedId, created.id)
assert.ok(db.movements.get(created.id).deleted_at)
```

Para `order-payment` e `order-refund`, PATCH/DELETE devem lançar erro `409` com código `MOVEMENT_MANAGED_BY_SYSTEM`. Movimento inexistente/excluído retorna `null` para a camada HTTP converter em 404.

- [ ] **Step 3: RED para rotas e cliente**

Estenda `worker/index.test.js` com autenticação e Origin válidos para confirmar status/payloads das quatro rotas. Estenda `src/api/client.test.js` para exigir métodos/URLs exatos:

```js
PATCH /api/movements/:id
DELETE /api/movements/:id
PUT /api/finance-settings
```

- [ ] **Step 4: RED para ownership/sync do App**

Crie `src/financeRealtimeRegression.test.js` lendo `App.jsx` e exigindo:

```js
assert.match(app, /const DATA_COLLECTIONS = \[[^\]]*'financeSettings'/s)
assert.match(app, /setFinanceSettings/)
assert.match(app, /deletedMovementId/)
assert.match(app, /removeById\(current, deletedMovementId\)/)
assert.match(app, /markMutation\([^)]*'movements'/s)
assert.match(app, /markMutation\([^)]*'financeSettings'/s)
assert.match(app, /data\?\.financeSettings \?\? null/)
```

Também exija que o formulário inline antigo `showMovementModal/newMovement/movementReview` desapareça de `App.jsx` e que `Finance` receba callbacks de escrita.

- [ ] **Step 5: Executar RED**

```bash
node --test worker/financeValidation.test.js worker/financeRepository.test.js worker/index.test.js src/api/client.test.js src/financeRealtimeRegression.test.js
```

Expected: FAIL pelos contratos ainda ausentes.

- [ ] **Step 6: Implementar validação server-side**

Adicione em `worker/validation.js` um conversor assinado sem mudar `moneyToCents()`:

```js
export const signedMoneyToCents = (value, field = 'value') => {
  const number = Number(value)
  if (!Number.isFinite(number)) throw validationError(field, 'Informe um valor válido.')
  return Math.round((number + Math.sign(number) * Number.EPSILON) * 100)
}
```

`parseManualMovementInput()` usa `validateMovementType`, `isManualMovementCategory`, `requireNonEmpty`, `moneyToCents`, `validateIsoDate`, `validatePaymentMethod` e `getBusinessDate(now)`. Valor deve ser `> 0`; data deve ser `<= getBusinessDate(now)`.

- [ ] **Step 7: Implementar repository com proteção de origem**

O lookup deve sempre ser business-scoped e ativo:

```sql
SELECT id, type, category, description, value_cents, source, order_id, payment_id,
       payment_method, movement_date, created_at, updated_at
FROM movements
WHERE id = ? AND business_id = ? AND deleted_at IS NULL
LIMIT 1
```

Antes de UPDATE/soft DELETE:

```js
if (row.source !== 'manual') {
  throw repositoryError(409, 'MOVEMENT_MANAGED_BY_SYSTEM', 'Movimentos gerados por pedidos não podem ser alterados pelo Financeiro.')
}
```

UPDATE deve alterar somente os campos manuais e `updated_at`; nunca `source/order_id/payment_id/created_at`.

`upsertFinanceSettings()` preserva `created_at` no conflito:

```sql
INSERT INTO finance_settings (business_id, opening_balance_cents, opening_date, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(business_id) DO UPDATE SET
  opening_balance_cents = excluded.opening_balance_cents,
  opening_date = excluded.opening_date,
  updated_at = excluded.updated_at
```

- [ ] **Step 8: Implementar rotas HTTP**

Em `worker/index.js`, substitua o `movementInput` inline por `parseManualMovementInput` e adicione:

```js
const movementMatch = url.pathname.match(/^\/api\/movements\/([^/]+)$/)
// PATCH -> { movement }
// DELETE -> { deletedMovementId }
// PUT /api/finance-settings -> { financeSettings }
```

Todas as mutações chamam `assertSameOriginMutation()` e usam `session.businessId`.

- [ ] **Step 9: Implementar cliente e ownership do App**

Em `src/api/client.js`:

```js
export const updateMovement = (id, movement) => apiRequest(`/api/movements/${encodeURIComponent(id)}`, withJson('PATCH', movement))
export const deleteMovement = (id) => apiRequest(`/api/movements/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const saveFinanceSettings = (settings) => apiRequest('/api/finance-settings', withJson('PUT', settings))
```

Em `App.jsx`:

- adicione `financeSettings` ao estado e `DATA_COLLECTIONS`;
- limpe-o no logout;
- aplique `data.financeSettings ?? null` no bootstrap quando o guard permitir;
- estenda `applyOfficialEffects()` para `financeSettings` e `deletedMovementId`;
- crie handlers create/update/delete/settings com `requestKey`, `showApiError`, `showSuccessMessage` e objetos oficiais;
- remova o formulário/review financeiro inline antigo de `App.jsx`;
- passe `financeSettings`, `onCreateMovement`, `onUpdateMovement`, `onDeleteMovement`, `onSaveFinanceSettings` e `actionKey` para `Finance`.

Exemplo do efeito de delete:

```js
if (deletedMovementId) {
  changed.push('movements')
  setMovements((current) => removeById(current, deletedMovementId))
}
```

- [ ] **Step 10: Integrar `MovementDialog` minimamente na página Finance**

Para não deixar o POST quebrado entre tarefas, `Finance.jsx` deve abrir `MovementDialog` pelo botão `Novo movimento` e chamar `onCreateMovement`/`onUpdateMovement`. A reorganização completa da tela virá nas Tasks 6–7.

- [ ] **Step 11: Executar GREEN focado**

```bash
node --test worker/financeValidation.test.js worker/financeRepository.test.js worker/index.test.js src/api/client.test.js src/financeRealtimeRegression.test.js src/components/MovementDialog.test.js
```

Expected: PASS.

- [ ] **Step 12: Rodar regressões de Worker/App relacionadas**

```bash
node --test worker/orderRepositories.test.js worker/orderCancellation.test.js worker/orderCancellationHttp.test.js src/utils/dataSync.test.js src/successFeedbackRegression.test.js
```

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add worker/financeValidation.js worker/financeValidation.test.js worker/financeRepository.js worker/financeRepository.test.js worker/validation.js worker/index.js worker/index.test.js src/api/client.js src/api/client.test.js src/App.jsx src/pages/Finance.jsx src/financeRealtimeRegression.test.js
git commit -m "feat: add authoritative finance write flows"
```

---

### Task 6: Adicionar edição/exclusão manual e configuração de abertura na UI

**Files:**
- Modify: `src/pages/Finance.jsx`
- Modify: `src/pages/Finance.test.js` (create if absent from Task 7 setup; create now if needed)
- Modify: `src/components/MovementDialog.jsx`
- Modify: `src/components/MovementDialog.test.js`
- Modify: `src/components/OpeningBalanceDialog.jsx`
- Modify: `src/components/OpeningBalanceDialog.test.js`

**Interfaces:**
- `Finance` owns only transient UI state (`editingMovement`, `deletingMovement`, dialogs); App owns persisted collections.
- Manual row actions are shown only for `movement.source === 'manual'`.
- Automatic row action is `Ver pedido` only when a related order is available; no edit/delete UI.

- [ ] **Step 1: RED para ações manuais/automáticas**

Crie/estenda `src/pages/Finance.test.js` e exija:

```js
assert.match(source, /movement\.source === 'manual'/)
assert.match(source, />Editar</)
assert.match(source, />Excluir</)
assert.match(source, /ConfirmationDialog/)
assert.match(source, /onDeleteMovement/)
assert.match(source, /OpeningBalanceDialog/)
assert.doesNotMatch(source, /source === 'order-payment'[\s\S]{0,250}>Editar</)
```

A confirmação de exclusão deve mostrar descrição, data e valor.

- [ ] **Step 2: RED para confirmação de abertura/alteração**

Exija que `Finance` passe `financeSettings` e saldo atual ao `OpeningBalanceDialog`, e que o componente use texto distinto para primeira configuração e alteração.

- [ ] **Step 3: Executar RED**

```bash
node --test src/pages/Finance.test.js src/components/MovementDialog.test.js src/components/OpeningBalanceDialog.test.js
```

Expected: FAIL pelas ações/configuração ainda incompletas.

- [ ] **Step 4: Implementar menu/ações de movimento manual**

Um movimento manual abre `MovementDialog movement={movement}` para edição. Excluir abre `ConfirmationDialog` destrutivo com:

```jsx
<>
  <strong>{deletingMovement.description}</strong>
  <span>{currency(deletingMovement.value)} · {deletingMovement.movementDate}</span>
</>
```

Só após confirmar chame `onDeleteMovement(id)`. Feche o estado somente se a operação não retornar `false`/erro.

- [ ] **Step 5: Integrar `OpeningBalanceDialog`**

Disponibilize uma ação provisória/semântica `Configurar saldo inicial` ou `Editar saldo inicial` na área financeira; a Task 7 a posicionará definitivamente no card Saldo atual. `onSubmit` chama `onSaveFinanceSettings(payload)` e fecha após sucesso.

- [ ] **Step 6: Garantir feedback centralizado e bloqueio offline/request**

Use `actionKey`/`navigator.onLine` para impedir dupla submissão. Não crie novos toasts de sucesso locais; App já chama `showSuccessMessage()` para criação, edição, exclusão e settings.

- [ ] **Step 7: Executar GREEN**

```bash
node --test src/pages/Finance.test.js src/components/MovementDialog.test.js src/components/OpeningBalanceDialog.test.js src/successFeedbackRegression.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Finance.jsx src/pages/Finance.test.js src/components/MovementDialog.jsx src/components/MovementDialog.test.js src/components/OpeningBalanceDialog.jsx src/components/OpeningBalanceDialog.test.js
git commit -m "feat: add finance correction and opening flows"
```

---

### Task 7: Reorganizar a tela com período, quatro indicadores, filtros e histórico enriquecido

**Files:**
- Create: `src/components/FinancePeriodSelector.jsx`
- Create: `src/components/FinanceHistoryFilters.jsx`
- Modify: `src/pages/Finance.jsx`
- Modify: `src/pages/Finance.test.js`
- Modify: `src/App.css`
- Modify: `src/finance-mobile.css`

**Interfaces:**
- `FinancePeriodSelector({ value, today, onChange })` emite `{ key: 'today'|'7d'|'30d'|'custom', startDate?, endDate? }`.
- `FinanceHistoryFilters({ value, categoryOptions, onChange })` emite `{ search, type, category, paymentMethod }`.
- `Finance` deriva `periodRange`, `periodMovements`, `summary`, `currentBalance`, `filteredMovements`; não mantém totais financeiros em `App.jsx`.

- [ ] **Step 1: RED para período padrão e quatro cards**

Em `src/pages/Finance.test.js` exija:

```js
assert.match(source, /useState\([^)]*key:\s*'today'/s)
assert.match(source, /FinancePeriodSelector/)
assert.match(source, /label="Entradas"/)
assert.match(source, /label="Saídas"/)
assert.match(source, /label="Resultado"/)
assert.match(source, /label="Saldo atual"/)
assert.doesNotMatch(source, /label="Saldo"/)
```

Saldo atual sem settings deve renderizar `Configure o saldo inicial` e ação de configuração, não `R$ 0,00` enganoso.

- [ ] **Step 2: RED para filtros independentes dos cards**

Exija duas coleções derivadas distintas:

```js
assert.match(source, /summarizeFinancePeriod/)
assert.match(source, /filterFinanceHistory/)
assert.match(source, /periodMovements/)
assert.match(source, /filteredMovements/)
```

O `summary` deve usar movimentos do período antes dos filtros secundários.

- [ ] **Step 3: RED para estornos pendentes e detalhe de pedido automático**

```js
assert.match(source, /pendingRefundOrders\.map/)
assert.match(source, /OrderDetail/)
assert.match(source, /movement\.orderId/)
assert.match(source, /Ver pedido/)
```

Estornos pendentes continuam consumindo `pendingRefundOrders` bruto e não `periodMovements`.

- [ ] **Step 4: Executar RED**

```bash
node --test src/pages/Finance.test.js src/utils/finance.test.js
```

Expected: FAIL pelo layout/controles ainda antigos.

- [ ] **Step 5: Implementar `FinancePeriodSelector`**

Desktop: quatro opções compactas. `Personalizado` mostra dois `input type="date"` com `max={today}`; normalize para manter `startDate <= endDate` antes de emitir período válido. Hoje/7/30 não precisam armazenar datas derivadas no estado.

- [ ] **Step 6: Implementar `FinanceHistoryFilters`**

Filtros:

```js
const EMPTY_FILTERS = { search: '', type: '', category: '', paymentMethod: '' }
```

Tipo usa Todos/Entrada/Saída; categoria oferece códigos normalizados presentes nos movimentos do período + categorias conhecidas; forma/meio inclui `Não informado` como valor de filtro especial `__missing__` para dados legados.

- [ ] **Step 7: Recalcular a tela a partir dos utilitários**

Em `Finance.jsx`:

```js
const today = getBusinessDate()
const [period, setPeriod] = useState({ key: 'today' })
const periodRange = getFinancePeriodRange(period, today)
const periodMovements = filterMovementsByPeriod(movements, periodRange)
const summary = summarizeFinancePeriod(movements, periodRange)
const currentBalance = calculateCurrentBalance(movements, financeSettings)
const filteredMovements = filterFinanceHistory(periodMovements, filters)
```

Cards:
- Entradas = `summary.entries`;
- Saídas = `summary.exits`;
- Resultado = `summary.result`;
- Saldo atual = `currentBalance`, ou estado de configuração quando `null`.

Remova `financialTotals` de `App.jsx` e a prop `totals` de `Finance`.

- [ ] **Step 8: Enriquecer linhas do histórico**

Use `getMovementCategoryLabel(movement)`; meio ausente mostra `Não informado`; data usa `movement.movementDate`. Tags de origem permanecem claras. Para movimento automático com `orderId`, encontre o pedido em `orders` e abra o `OrderDetail` existente sem criar um segundo modelo de detalhe.

Quando filtros secundários estiverem ativos, o contador pode mostrar `X de Y registros no período`; sem filtros, `Y registro(s)`.

- [ ] **Step 9: Posicionar abertura no card Saldo atual**

Sem configuração: CTA `Configurar`. Com configuração: helper `Desde DD/MM/AAAA` e ação discreta `Editar saldo inicial`. O período selecionado não altera esse valor.

- [ ] **Step 10: Executar GREEN funcional**

```bash
node --test src/pages/Finance.test.js src/utils/finance.test.js src/components/MovementDialog.test.js src/components/OpeningBalanceDialog.test.js
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/components/FinancePeriodSelector.jsx src/components/FinanceHistoryFilters.jsx src/pages/Finance.jsx src/pages/Finance.test.js src/App.jsx src/App.css src/finance-mobile.css
git commit -m "feat: redesign finance cash flow view"
```

---

### Task 8: Fechar responsividade, reconciliação remota e compatibilidade legada

**Files:**
- Modify: `src/pages/FinanceMoreMobile.test.js`
- Modify: `src/finance-mobile.css`
- Modify: `src/pages/Finance.test.js`
- Modify: `src/financeRealtimeRegression.test.js`
- Modify: `worker/index.test.js`
- Modify: `worker/financeRepository.test.js`
- Modify: `worker/orderWriteEffects.js` only if a RED reveals a missing compatibility field

**Interfaces:**
- Nenhuma interface nova; esta tarefa fecha os critérios de aceite com regressões de integração/fonte.

- [ ] **Step 1: Atualizar o teste mobile antigo para o novo formulário**

Remova a expectativa obsoleta de `<input type="number" min="0" step="0.01">` e exija o contrato final:

```js
assert.match(movementDialog, /type="text"/)
assert.match(movementDialog, /inputMode="decimal"/)
assert.match(movementDialog, /movementDate/)
assert.match(movementDialog, /paymentMethod/)
```

- [ ] **Step 2: RED para grid 2 × 2 e filtros utilizáveis entre 320–480 px**

Em `FinanceMoreMobile.test.js` exija CSS com:

```js
assert.match(financeCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.finance-stats-grid[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s)
assert.match(financeCss, /\.finance-filter-trigger[^}]*min-height:\s*44px/s)
```

Se `FinanceHistoryFilters` usar o `BottomSheet` existente no mobile, exija seu uso e preserve `safe-area-inset-bottom` já coberto pelo projeto.

- [ ] **Step 3: RED para reconciliação de delete/settings em outro dispositivo**

Em `src/financeRealtimeRegression.test.js`, prove por fonte que:

- `applyBootstrapCollections()` substitui `movements` pela lista oficial, inclusive quando a lista fica menor/vazia;
- `financeSettings` participa do mesmo guard de leitura;
- delete local marca `movements` antes de remover;
- settings local marca `financeSettings` antes de atualizar;
- o refresh global de ~5 s continua ativo e não foi substituído por polling financeiro paralelo.

- [ ] **Step 4: RED para bootstrap legado**

Em Worker tests use um movimento `order-payment` legado com `payment_method = null` e pagamento relacionado `Pix`: resposta deve trazer `Pix`. Use `order-refund` legado com `payment_method = null`: resposta deve trazer `null`/`Não informado` no cliente, nunca o método original do pagamento.

Também prove que um movimento com `deleted_at` preenchido não entra no bootstrap.

- [ ] **Step 5: Executar RED**

```bash
node --test src/pages/FinanceMoreMobile.test.js src/financeRealtimeRegression.test.js worker/index.test.js worker/financeRepository.test.js
```

Expected: pelo menos uma falha até os detalhes finais de CSS/reconciliação/legado estarem implementados.

- [ ] **Step 6: Implementar apenas os ajustes apontados pelos REDs**

No mobile, mantenha:

```css
@media (max-width: 640px) {
  .finance-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

Filtros detalhados devem ficar em sheet/modal compacto quando necessário; não transforme cada filtro em uma linha permanente que empurre o histórico para baixo.

Garanta que bootstrap aplica `setMovements([])` quando a resposta oficial vier vazia; não use condições do tipo `nextMovements.length` para reconciliação autoritativa de leitura.

- [ ] **Step 7: Executar GREEN focado**

```bash
node --test src/pages/FinanceMoreMobile.test.js src/pages/Finance.test.js src/financeRealtimeRegression.test.js worker/index.test.js worker/financeRepository.test.js
```

Expected: PASS.

- [ ] **Step 8: Rodar toda a suíte**

```bash
npm test
```

Expected: todos os testes passam.

- [ ] **Step 9: Lint**

```bash
npm run lint
```

Expected: 0 erros. Avisos existentes só são aceitáveis se não forem novos e forem documentados na revisão da tarefa.

- [ ] **Step 10: Build**

```bash
npm run build
```

Expected: build Vite concluído.

- [ ] **Step 11: Worker dry-run**

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: Worker empacota com binding D1 válido sem publicar nada.

- [ ] **Step 12: Confirmar que nenhuma operação remota ocorreu**

Não executar:

```bash
npm run d1:migrate:remote
npm run deploy
npx --yes wrangler@4.128.0 deploy
```

Produção só pode ser alterada em uma etapa posterior, após autorização explícita do usuário.

- [ ] **Step 13: Commit**

```bash
git add src/pages/FinanceMoreMobile.test.js src/finance-mobile.css src/pages/Finance.test.js src/financeRealtimeRegression.test.js worker/index.test.js worker/financeRepository.test.js worker/orderWriteEffects.js
git commit -m "test: lock finance cash flow regressions"
```

---

## Execution Order and Review Gates

Execute Tasks 1–8 em ordem. Cada Task deve usar seu próprio ciclo RED → GREEN → review → commit. Não acumule múltiplas Tasks em um único commit antes da revisão.

Depois de cada Task:

```bash
git status --short
git diff --check HEAD^ HEAD
```

O reviewer deve conferir especificamente:

1. comportamento da Task versus a spec;
2. isolamento das unidades novas — evitar devolver regras para `App.jsx`;
3. ausência de escrita/edição de movimentos automáticos;
4. nenhuma regressão de atualização imediata/sync;
5. nenhum acesso D1 remoto/deploy de produção.

Ao final da Task 8, registre o SHA final e os resultados de `npm test`, lint, build e dry-run. Só então a implementação está pronta para uma eventual autorização separada de deploy.