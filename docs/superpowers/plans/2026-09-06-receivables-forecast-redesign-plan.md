# Receivables Forecast Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar `A receber` como uma central operacional de cobrança e previsão, com data prometida opcional, classificação Hoje/Próximos/Em atraso, histórico de quitados, previsão diária, detalhe responsivo e reutilização integral do fluxo de pagamento existente.

**Architecture:** O pedido continua sendo a fonte de verdade do recebível. Uma migration aditiva acrescenta `orders.promised_payment_date`; o backend expõe uma mutação pequena e business-scoped que altera somente esse campo e retorna o pedido pelo mapper oficial. A classificação temporal, resumo, ordenação, agregação de comandas e previsão ficam em funções puras no frontend; `Receivables.jsx` coordena estado de UI, enquanto detalhe, edição de promessa, previsão e seleção rápida de pagamento ficam em componentes focados. Pagamento, movimentos financeiros, cancelamento, estorno e sync permanecem nas arquiteturas já existentes.

**Tech Stack:** React 19, React DOM portals, CSS responsivo nativo, Node.js `node:test`, Cloudflare Workers, Cloudflare D1/SQLite, Wrangler `4.128.0`, Vite 8, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-06-receivables-forecast-redesign-design.md` — aprovada em 2026-09-06.

## Global Constraints

- Trabalhar somente em `feature/receivables-forecast-redesign`, baseada em `master` no SHA `63293039f885f31c4f9f1717e3226eedc897882b`.
- Não trabalhar diretamente na `master` e não fazer deploy em produção durante a execução deste plano.
- Seguir TDD estrito: todo comportamento relevante começa com teste RED observado antes da implementação GREEN.
- Não introduzir pagamentos parciais, juros, multas, prazo padrão por cliente, vencimento global ou histórico de renegociações.
- Sem promessa explícita, a data esperada é exatamente `orderDate`; `scheduledFor` não altera essa regra nesta entrega.
- `promisedPaymentDate` é opcional, não altera `orderDate`, `createdAt`, status operacional, itens, total ou histórico do pedido.
- Promessa de pagamento nunca cria `payments`, `movements` nem receita no Financeiro.
- Pagamento comum e pagamento de comanda continuam usando os fluxos atuais e continuam criando movimentos automáticos somente quando o dinheiro é efetivamente recebido.
- Pedidos cancelados ficam fora de `A receber`; pedidos pagos aparecem em `Quitados` e não permitem editar promessa.
- Comandas abertas permanecem agregadas e não expõem edição de promessa nesta versão.
- A classificação temporal é derivada; não adicionar coluna de status `today/upcoming/overdue` nem job de virada do dia.
- Usar `America/Sao_Paulo` por meio de `getBusinessDate()` como referência de data de negócio.
- Não adicionar biblioteca de gráficos. A previsão usa HTML/CSS e valores textuais.
- Mobile: touch targets mínimos de 44 px, safe area e bottom nav respeitadas, detalhe em `BottomSheet` existente via portal.
- Desktop largo: lista + painel lateral sticky; conteúdo de domínio idêntico ao mobile.
- Usar resposta oficial do servidor e `applyOfficialEffects({ order })`; não fazer update otimista de promessa.
- Offline mantém leitura, busca, filtros e previsão; bloqueia registrar recebimento e alterar promessa.
- Staging e homologação são obrigatórios antes de qualquer merge para `master`.

---

## File Structure

### Domain/UI data

- Modify: `src/utils/receivables.js` — fonte única da lógica temporal, resumo, forecast, entradas de cobrança e ordenação.
- Create: `src/utils/receivables.test.js` — testes unitários puros de datas, resumo, forecast, comandas e ordenação.

### Persistence/backend

- Create: `migrations/0012_receivables_payment_promise.sql` — coluna nullable + índice.
- Create: `worker/paymentPromiseMigration.test.js` — contrato da migration.
- Modify: `worker/orderReadSql.js` — incluir `promised_payment_date` no select oficial de pedidos.
- Modify: `worker/repositories.js` — mapper oficial, select do bootstrap, export controlado de `loadOrderById`.
- Modify: `worker/orderIdentityRepositoryMapping.test.js` — contrato de mapping `promisedPaymentDate`.
- Create: `worker/orderPaymentPromise.js` — validação e mutação isolada da promessa.
- Create: `worker/orderPaymentPromise.test.js` — regras de data, business scope e ausência de efeitos financeiros.
- Modify: `worker/index.js` — nova rota `PATCH /api/orders/:id/payment-promise`.
- Modify: `worker/index.test.js` — teste HTTP autenticado da rota e erros.

### Client/app sync

- Modify: `src/api/client.js` — wrapper `updateOrderPaymentPromise`.
- Modify: `src/App.jsx` — handler de mutação, aplicação do pedido oficial e passagem de `disabled/onUpdatePaymentPromise` para `Receivables`.
- Create: `src/AppReceivablesPromise.test.js` — contrato de integração frontend/API/sync sem otimista.

### Receivables UI

- Rewrite/Modify: `src/pages/Receivables.jsx` — tabs, busca, filtros, sorting, ledger, seleção, responsive orchestration e estados vazios.
- Create: `src/pages/ReceivablesRedesign.test.js` — contrato da nova estrutura sem grandes cards de cliente.
- Modify: `src/pages/ReceivablesDetails.test.js` — detalhe responsivo e ações permitidas.
- Modify: `src/pages/ReceivablesMobile.test.js` — touch targets, bottom sheet, FAB e responsividade.
- Create: `src/pages/ReceivablesForecast.test.js` — forecast, gráfico e filtro por data.
- Create: `src/components/ReceivableDetail.jsx` — conteúdo único do detalhe para sheet e painel desktop.
- Create: `src/components/PaymentPromiseDialog.jsx` — definir/alterar/remover promessa.
- Create: `src/components/ReceivablesForecastDialog.jsx` — previsão textual + barras CSS.
- Create: `src/components/ReceivablesQuickPaymentDialog.jsx` — seletor pesquisável de pedido comum pendente.
- Modify: `src/components/Icon.jsx` — adicionar ícone `chart` usado pelo botão de previsão.
- Modify: `src/receivables.css` — ledger, summaries, tabs, detail split, dialogs, forecast e FAB.

### Existing components intentionally reused without redesign

- Reuse unchanged unless a failing regression proves necessity: `src/components/BottomSheet.jsx`, `src/bottom-sheet.css`, `src/components/Modal.jsx`, `src/components/OrderDetail.jsx`, `src/components/SystemSelect.jsx`.
- Preserve existing global payment modal in `src/App.jsx`; não criar uma segunda implementação de forma de pagamento.

---

### Task 1: Build the receivables temporal domain

**Files:**
- Modify: `src/utils/receivables.js`
- Create: `src/utils/receivables.test.js`

**Interfaces:**
- Consumes: `isOrderCancelled(order)`, `isOrderPaid(order)`, `getPendingAmount(order)`.
- Produces:
  - `getPendingReceivableOrders(orders = []) -> Order[]`
  - `getPaidReceivableOrders(orders = []) -> Order[]`
  - `getExpectedPaymentDate(order) -> YYYY-MM-DD | null`
  - `getReceivableTiming(order, today) -> { status, expectedDate, daysOverdue }`
  - `getDaysOverdue(order, today) -> number`
  - `calculateReceivableSummary(orders, today) -> { today, upcoming, overdue }`
  - `buildReceivablesForecast(orders, today, horizonDays = 7) -> { overdue, today, days, later }`
  - `buildPendingReceivableEntries(orders, tableTabs, today) -> ReceivableEntry[]`
  - `sortReceivableEntries(entries, sortMode) -> ReceivableEntry[]`

- [ ] **Step 1: Write failing unit tests for timing, summary, forecast and table-tab aggregation**

Create `src/utils/receivables.test.js` with concrete cases:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPendingReceivableEntries,
  buildReceivablesForecast,
  calculateReceivableSummary,
  getDaysOverdue,
  getExpectedPaymentDate,
  getPaidReceivableOrders,
  getReceivableTiming,
  sortReceivableEntries,
} from './receivables.js'

const pending = (overrides = {}) => ({
  id: 'o1',
  client: 'Maria',
  orderDate: '2026-09-06',
  createdAt: '2026-09-06T12:00:00.000Z',
  status: 'Finalizado',
  paymentStatus: 'Pendente',
  total: 50,
  customerIdentityType: 'registered_client',
  items: [],
  ...overrides,
})

test('same-day order without promise is today and old order without promise is overdue', () => {
  assert.deepEqual(getReceivableTiming(pending(), '2026-09-06'), {
    status: 'today', expectedDate: '2026-09-06', daysOverdue: 0,
  })
  const old = pending({ id: 'old', orderDate: '2026-09-03' })
  assert.equal(getExpectedPaymentDate(old), '2026-09-03')
  assert.equal(getReceivableTiming(old, '2026-09-06').status, 'overdue')
  assert.equal(getDaysOverdue(old, '2026-09-06'), 3)
})

test('promise overrides order date until the promised date passes', () => {
  const order = pending({ orderDate: '2026-09-01', promisedPaymentDate: '2026-09-11' })
  assert.equal(getReceivableTiming(order, '2026-09-06').status, 'upcoming')
  assert.equal(getReceivableTiming(order, '2026-09-11').status, 'today')
  assert.equal(getReceivableTiming(order, '2026-09-12').status, 'overdue')
})

test('paid and cancelled orders do not contaminate pending timing totals', () => {
  const paid = pending({ id: 'paid', paymentStatus: 'Pago', paidAt: '2026-09-06T14:00:00.000Z' })
  const cancelled = pending({ id: 'cancelled', status: 'Cancelado' })
  assert.equal(getReceivableTiming(paid, '2026-09-06').status, 'paid')
  assert.equal(getReceivableTiming(cancelled, '2026-09-06').status, 'excluded')
  assert.deepEqual(getPaidReceivableOrders([paid, cancelled]), [paid])
})

test('summary partitions all pending money between overdue today and upcoming', () => {
  const result = calculateReceivableSummary([
    pending({ id: 'late', orderDate: '2026-09-03', total: 40 }),
    pending({ id: 'today', total: 50 }),
    pending({ id: 'future', orderDate: '2026-09-01', promisedPaymentDate: '2026-09-08', total: 60 }),
  ], '2026-09-06')
  assert.deepEqual(result, {
    today: { amount: 50, count: 1 },
    upcoming: { amount: 60, count: 1 },
    overdue: { amount: 40, count: 1 },
  })
})

test('forecast creates seven future calendar buckets and a later aggregate', () => {
  const result = buildReceivablesForecast([
    pending({ id: 'late', orderDate: '2026-09-05', total: 20 }),
    pending({ id: 'today', total: 30 }),
    pending({ id: 'tomorrow', promisedPaymentDate: '2026-09-07', total: 40 }),
    pending({ id: 'day7', promisedPaymentDate: '2026-09-13', total: 50 }),
    pending({ id: 'later', promisedPaymentDate: '2026-09-20', total: 60 }),
  ], '2026-09-06', 7)
  assert.deepEqual(result.overdue, { amount: 20, count: 1 })
  assert.deepEqual(result.today, { amount: 30, count: 1 })
  assert.equal(result.days.length, 7)
  assert.deepEqual(result.days[0], { date: '2026-09-07', amount: 40, count: 1 })
  assert.deepEqual(result.days[6], { date: '2026-09-13', amount: 50, count: 1 })
  assert.deepEqual(result.later, { amount: 60, count: 1 })
})

test('table tab stays aggregated and uses its newest pending order date for timing', () => {
  const entries = buildPendingReceivableEntries([
    pending({ id: 't1', client: 'Mesa 04', customerIdentityType: 'table', tableTabId: 'tab-4', orderDate: '2026-09-04', total: 30 }),
    pending({ id: 't2', client: 'Mesa 04', customerIdentityType: 'table', tableTabId: 'tab-4', orderDate: '2026-09-06', total: 40 }),
  ], [{ id: 'tab-4', tableIdentifier: '04', status: 'open' }], '2026-09-06')
  assert.equal(entries.length, 1)
  assert.equal(entries[0].kind, 'table_tab')
  assert.equal(entries[0].label, 'Mesa 04')
  assert.equal(entries[0].total, 70)
  assert.equal(entries[0].expectedDate, '2026-09-06')
  assert.equal(entries[0].timing.status, 'today')
})

test('urgency sort puts older overdue first then today then nearest upcoming', () => {
  const entries = buildPendingReceivableEntries([
    pending({ id: 'future', promisedPaymentDate: '2026-09-08' }),
    pending({ id: 'today' }),
    pending({ id: 'late-new', orderDate: '2026-09-05' }),
    pending({ id: 'late-old', orderDate: '2026-09-02' }),
  ], [], '2026-09-06')
  assert.deepEqual(sortReceivableEntries(entries, 'urgency').map((entry) => entry.order.id), [
    'late-old', 'late-new', 'today', 'future',
  ])
})
```

- [ ] **Step 2: Run the domain test and observe RED**

Run:

```bash
node --test src/utils/receivables.test.js
```

Expected: FAIL because the new exports and timing/forecast behavior do not exist yet.

- [ ] **Step 3: Implement the pure date and receivable functions**

Replace the old client-grouping-oriented implementation in `src/utils/receivables.js` with the existing cancellation/payment imports plus these concrete primitives:

```js
import { isOrderCancelled } from './orderLifecycle.js'
import { getPendingAmount, isOrderPaid } from './paymentWorkflow.js'

const DAY_MS = 86_400_000
const timingRank = { overdue: 0, today: 1, upcoming: 2 }

const isoDayNumber = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return null
  const [, rawYear, rawMonth, rawDay] = match
  const year = Number(rawYear); const month = Number(rawMonth); const day = Number(rawDay)
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null
  return timestamp / DAY_MS
}

const isoFromDayNumber = (dayNumber) => new Date(dayNumber * DAY_MS).toISOString().slice(0, 10)

export const getExpectedPaymentDate = (order) => order?.promisedPaymentDate || order?.orderDate || null

export const getReceivableTiming = (order, today) => {
  const expectedDate = getExpectedPaymentDate(order)
  if (isOrderCancelled(order)) return { status: 'excluded', expectedDate, daysOverdue: 0 }
  if (isOrderPaid(order)) return { status: 'paid', expectedDate, daysOverdue: 0 }
  const expectedDay = isoDayNumber(expectedDate)
  const todayDay = isoDayNumber(today)
  if (expectedDay == null || todayDay == null) return { status: 'today', expectedDate, daysOverdue: 0 }
  if (expectedDay < todayDay) return { status: 'overdue', expectedDate, daysOverdue: todayDay - expectedDay }
  if (expectedDay > todayDay) return { status: 'upcoming', expectedDate, daysOverdue: 0 }
  return { status: 'today', expectedDate, daysOverdue: 0 }
}

export const getDaysOverdue = (order, today) => getReceivableTiming(order, today).daysOverdue

export const getPendingReceivableOrders = (orders = []) => (Array.isArray(orders) ? orders : [])
  .filter((order) => !isOrderCancelled(order) && !isOrderPaid(order))

export const getPaidReceivableOrders = (orders = []) => (Array.isArray(orders) ? orders : [])
  .filter((order) => !isOrderCancelled(order) && isOrderPaid(order))

export const calculateReceivableSummary = (orders, today) => {
  const summary = {
    today: { amount: 0, count: 0 },
    upcoming: { amount: 0, count: 0 },
    overdue: { amount: 0, count: 0 },
  }
  for (const order of getPendingReceivableOrders(orders)) {
    const { status } = getReceivableTiming(order, today)
    const bucket = summary[status]
    if (!bucket) continue
    bucket.amount += getPendingAmount(order)
    bucket.count += 1
  }
  return summary
}

export const buildReceivablesForecast = (orders, today, horizonDays = 7) => {
  const todayDay = isoDayNumber(today)
  const days = Array.from({ length: horizonDays }, (_, index) => ({
    date: isoFromDayNumber(todayDay + index + 1), amount: 0, count: 0,
  }))
  const result = {
    overdue: { amount: 0, count: 0 },
    today: { amount: 0, count: 0 },
    days,
    later: { amount: 0, count: 0 },
  }
  for (const order of getPendingReceivableOrders(orders)) {
    const timing = getReceivableTiming(order, today)
    const amount = getPendingAmount(order)
    if (timing.status === 'overdue' || timing.status === 'today') {
      result[timing.status].amount += amount
      result[timing.status].count += 1
      continue
    }
    const delta = isoDayNumber(timing.expectedDate) - todayDay
    const bucket = delta >= 1 && delta <= horizonDays ? result.days[delta - 1] : result.later
    bucket.amount += amount
    bucket.count += 1
  }
  return result
}
```

Then add `buildPendingReceivableEntries` and `sortReceivableEntries` using these exact entry fields:

```js
// Order entry:
{
  key: `order:${order.id}`,
  kind: 'order',
  order,
  orders: [order],
  label: order.client || 'Pedido sem identificação',
  total: getPendingAmount(order),
  expectedDate: getExpectedPaymentDate(order),
  timing: getReceivableTiming(order, today),
  createdAt: order.createdAt || '',
}

// Table-tab entry:
{
  key: `table-tab:${tableTabId}`,
  kind: 'table_tab',
  tableTabId,
  orders: tableOrders,
  label: `Mesa ${tableIdentifier}`,
  total: tableOrders.reduce((sum, order) => sum + getPendingAmount(order), 0),
  expectedDate: newestOrder.orderDate,
  timing: getReceivableTiming({ ...newestOrder, promisedPaymentDate: null }, today),
  createdAt: tableOrders.map((order) => order.createdAt || '').sort()[0] || '',
}
```

`sortReceivableEntries(entries, 'urgency')` must compare `timingRank`, then `expectedDate`, then `createdAt`; `'recent'` sorts `createdAt` descending; `'value-desc'` sorts `total` descending.

Before removing the old `groupPendingOrders` export, run:

```bash
grep -R "groupPendingOrders" src worker shared -n
```

Expected before the page rewrite: only its definition and `src/pages/Receivables.jsx`. Do not remove it in this task if another consumer exists; preserve a compatibility export until that consumer is migrated.

- [ ] **Step 4: Run the domain test GREEN**

```bash
node --test src/utils/receivables.test.js
```

Expected: PASS for all timing, summary, forecast, table-tab and sorting cases.

- [ ] **Step 5: Run nearby payment/cancellation tests**

```bash
node --test src/utils/paymentWorkflow.test.js src/utils/orderLifecycle.test.js
```

If either path does not exist, run `node --test src/utils/*.test.js` instead. Expected: PASS; no payment/cancellation regression.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/utils/receivables.js src/utils/receivables.test.js
git commit -m "feat: add receivables timing domain"
```

---

### Task 2: Persist and map `promisedPaymentDate`

**Files:**
- Create: `migrations/0012_receivables_payment_promise.sql`
- Create: `worker/paymentPromiseMigration.test.js`
- Modify: `worker/orderReadSql.js`
- Modify: `worker/repositories.js`
- Modify: `worker/orderIdentityRepositoryMapping.test.js`

**Interfaces:**
- Consumes: existing `orders` table, `ORDER_SELECT`, `mapOrderRow`.
- Produces: official `Order.promisedPaymentDate: string | null` on bootstrap, `GET /api/orders`, payment/cancel/status responses that reload an order.

- [ ] **Step 1: Write RED migration and mapper tests**

Create `worker/paymentPromiseMigration.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../migrations/0012_receivables_payment_promise.sql', import.meta.url)

test('payment promise migration is additive nullable and indexed without backfill', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /ALTER TABLE orders ADD COLUMN promised_payment_date TEXT/i)
  assert.match(sql, /CREATE INDEX orders_business_promised_payment_idx\s+ON orders \(business_id, promised_payment_date\)/i)
  assert.doesNotMatch(sql, /UPDATE orders/i)
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN/i)
})
```

Append to `worker/orderIdentityRepositoryMapping.test.js`:

```js
test('order row maps promised payment date and keeps missing promise as null', () => {
  assert.equal(mapOrderRow({ ...baseRow, promised_payment_date: '2026-09-11' }, []).promisedPaymentDate, '2026-09-11')
  assert.equal(mapOrderRow({ ...baseRow, promised_payment_date: null }, []).promisedPaymentDate, null)
})

test('all official order selects include promised_payment_date', () => {
  const readSql = readFileSync(new URL('./orderReadSql.js', import.meta.url), 'utf8')
  assert.match(readSql, /o\.promised_payment_date/)
  assert.match(source, /o\.promised_payment_date/)
})
```

- [ ] **Step 2: Run tests and observe RED**

```bash
node --test worker/paymentPromiseMigration.test.js worker/orderIdentityRepositoryMapping.test.js
```

Expected: FAIL because migration `0012` and mapper/select support do not exist.

- [ ] **Step 3: Add the additive D1 migration**

Create `migrations/0012_receivables_payment_promise.sql` exactly as:

```sql
PRAGMA foreign_keys = ON;

ALTER TABLE orders ADD COLUMN promised_payment_date TEXT;

CREATE INDEX orders_business_promised_payment_idx
  ON orders (business_id, promised_payment_date);
```

Do not backfill historical rows.

- [ ] **Step 4: Add the field to official order reads and mapper**

In `worker/orderReadSql.js`, insert `o.promised_payment_date` beside scheduling/date fields:

```js
o.customer_identity_type, o.table_tab_id, o.type, o.order_date, o.status,
o.scheduled_for, o.promised_payment_date, o.is_backdated,
```

In the private `orderSelect` string in `worker/repositories.js`, add the same database field.

In `mapOrderRow`, add exactly:

```js
promisedPaymentDate: row.promised_payment_date ?? null,
```

immediately after `scheduledFor` or `orderDate`, preserving all existing payment/cancellation mapping.

- [ ] **Step 5: Run persistence/mapping tests GREEN**

```bash
node --test worker/paymentPromiseMigration.test.js worker/orderIdentityRepositoryMapping.test.js worker/orderReadRepository.test.js
```

Expected: PASS.

- [ ] **Step 6: Apply all migrations locally to prove D1 compatibility**

```bash
npm run d1:migrate:local
```

Expected: migration `0012_receivables_payment_promise.sql` applies successfully; no destructive migration output.

- [ ] **Step 7: Commit Task 2**

```bash
git add migrations/0012_receivables_payment_promise.sql worker/paymentPromiseMigration.test.js worker/orderReadSql.js worker/repositories.js worker/orderIdentityRepositoryMapping.test.js
git commit -m "feat: persist payment promise date"
```

---

### Task 3: Add the server-side payment-promise mutation

**Files:**
- Create: `worker/orderPaymentPromise.js`
- Create: `worker/orderPaymentPromise.test.js`
- Modify: `worker/repositories.js` — export `loadOrderById` without changing behavior.

**Interfaces:**
- Consumes: `getBusinessDate(now)`, official `loadOrderById(db, businessId, id)`.
- Produces:
  - `parsePromisedPaymentDate(value, today) -> string | null`
  - `updateOrderPaymentPromise(db, businessId, orderId, promisedPaymentDate, now) -> Order`
- Errors:
  - `ORDER_NOT_FOUND` 404
  - `INVALID_PROMISED_PAYMENT_DATE` 400
  - `PROMISED_PAYMENT_DATE_IN_PAST` 400
  - `ORDER_ALREADY_PAID` 409
  - `ORDER_CANCELLED` 409

- [ ] **Step 1: Write RED tests for validation, isolation and no side effects**

Create `worker/orderPaymentPromise.test.js` with a focused fake D1 adapter. The key tests must be:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePromisedPaymentDate, updateOrderPaymentPromise } from './orderPaymentPromise.js'

const orderRow = (overrides = {}) => ({
  id: 'o1', business_id: 'amor-e-sabor', client_id: 'c1', client_name_snapshot: 'Maria',
  customer_identity_type: 'registered_client', table_tab_id: null, type: 'Entrega',
  order_date: '2026-09-06', status: 'Finalizado', scheduled_for: null,
  promised_payment_date: null, is_backdated: 0, subtotal_cents: 5000,
  delivery_fee_cents: 0, adjustment_type: 'none', adjustment_mode: 'fixed',
  adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '',
  total_cents: 5000, created_at: '2026-09-06T12:00:00.000Z', finished_at: null,
  cancelled_at: null, payment_id: null, payment_method: null, paid_at: null,
  paid_amount_cents: null, refund_movement_id: null, refund_created_at: null,
  ...overrides,
})

test('promise parser accepts null/current/future and rejects malformed or past dates', () => {
  assert.equal(parsePromisedPaymentDate(null, '2026-09-06'), null)
  assert.equal(parsePromisedPaymentDate('2026-09-06', '2026-09-06'), '2026-09-06')
  assert.equal(parsePromisedPaymentDate('2026-09-11', '2026-09-06'), '2026-09-11')
  assert.throws(() => parsePromisedPaymentDate('2026-02-31', '2026-09-06'), (error) => error.code === 'INVALID_PROMISED_PAYMENT_DATE')
  assert.throws(() => parsePromisedPaymentDate('2026-09-05', '2026-09-06'), (error) => error.code === 'PROMISED_PAYMENT_DATE_IN_PAST')
})

test('mutation updates only promised_payment_date and returns official mapped order', async () => {
  const db = new PromiseDb(orderRow())
  const order = await updateOrderPaymentPromise(db, 'amor-e-sabor', 'o1', '2026-09-11', new Date('2026-09-06T15:00:00.000Z'))
  assert.equal(order.promisedPaymentDate, '2026-09-11')
  assert.equal(db.row.order_date, '2026-09-06')
  assert.equal(db.row.status, 'Finalizado')
  assert.equal(db.writes.some((sql) => /INSERT INTO payments|INSERT INTO movements/i.test(sql)), false)
})

test('paid cancelled and cross-business orders cannot be changed', async () => {
  await assert.rejects(() => updateOrderPaymentPromise(new PromiseDb(orderRow({ payment_id: 'pay-1' })), 'amor-e-sabor', 'o1', '2026-09-11'), (error) => error.code === 'ORDER_ALREADY_PAID')
  await assert.rejects(() => updateOrderPaymentPromise(new PromiseDb(orderRow({ status: 'Cancelado' })), 'amor-e-sabor', 'o1', '2026-09-11'), (error) => error.code === 'ORDER_CANCELLED')
  await assert.rejects(() => updateOrderPaymentPromise(new PromiseDb(orderRow()), 'other-business', 'o1', '2026-09-11'), (error) => error.code === 'ORDER_NOT_FOUND')
})
```

Implement `PromiseDb` in the same test file so that:

- `first()` returns the row only when both `id` and `business_id` match;
- `all()` returns `{ results: [] }` for `order_items`;
- `run()` recognizes only `UPDATE orders SET promised_payment_date = ? WHERE id = ? AND business_id = ?`;
- every `run()` SQL string is pushed to `writes`.

- [ ] **Step 2: Run the mutation test and observe RED**

```bash
node --test worker/orderPaymentPromise.test.js
```

Expected: FAIL because `orderPaymentPromise.js` and exported loader do not exist.

- [ ] **Step 3: Export the existing official order loader**

In `worker/repositories.js`, change only the declaration:

```js
export const loadOrderById = async (db, businessId, id) => {
```

Do not duplicate its select/mapping logic in the new module.

- [ ] **Step 4: Implement validation and mutation in a focused module**

Create `worker/orderPaymentPromise.js`:

```js
import { getBusinessDate } from '../shared/finance.js'
import { loadOrderById } from './repositories.js'

const repositoryError = (status, code, message) => Object.assign(new Error(message), { status, code })
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const isValidCalendarDate = (value) => {
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const [, rawYear, rawMonth, rawDay] = match
  const year = Number(rawYear); const month = Number(rawMonth); const day = Number(rawDay)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export const parsePromisedPaymentDate = (value, today) => {
  if (value == null || value === '') return null
  const normalized = String(value).trim()
  if (!isValidCalendarDate(normalized)) {
    throw repositoryError(400, 'INVALID_PROMISED_PAYMENT_DATE', 'Data prometida inválida.')
  }
  if (normalized < today) {
    throw repositoryError(400, 'PROMISED_PAYMENT_DATE_IN_PAST', 'A data prometida não pode estar no passado.')
  }
  return normalized
}

export const updateOrderPaymentPromise = async (db, businessId, orderId, rawDate, now = new Date()) => {
  const order = await loadOrderById(db, businessId, orderId)
  if (!order) throw repositoryError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
  if (order.status === 'Cancelado') throw repositoryError(409, 'ORDER_CANCELLED', 'Pedido cancelado não pode receber uma promessa de pagamento.')
  if (order.paymentStatus === 'Pago') throw repositoryError(409, 'ORDER_ALREADY_PAID', 'Pedido quitado não pode alterar a data prometida.')

  const promisedPaymentDate = parsePromisedPaymentDate(rawDate, getBusinessDate(now))
  await db.prepare(`UPDATE orders SET promised_payment_date = ? WHERE id = ? AND business_id = ?`)
    .bind(promisedPaymentDate, orderId, businessId)
    .run()
  return loadOrderById(db, businessId, orderId)
}
```

- [ ] **Step 5: Run mutation tests GREEN**

```bash
node --test worker/orderPaymentPromise.test.js worker/orderRepositories.test.js
```

Expected: PASS. Existing payment tests must still prove one payment creates one movement.

- [ ] **Step 6: Commit Task 3**

```bash
git add worker/orderPaymentPromise.js worker/orderPaymentPromise.test.js worker/repositories.js
git commit -m "feat: add payment promise mutation"
```

---

### Task 4: Expose the API and wire official sync into `App`

**Files:**
- Modify: `worker/index.js`
- Modify: `worker/index.test.js`
- Modify: `src/api/client.js`
- Modify: `src/App.jsx`
- Create: `src/AppReceivablesPromise.test.js`

**Interfaces:**
- HTTP: `PATCH /api/orders/:id/payment-promise` body `{ promisedPaymentDate: string | null }` -> `{ order }`.
- Client: `updateOrderPaymentPromise(id, promisedPaymentDate) -> Promise<{ order }>`.
- App -> page: `onUpdatePaymentPromise(orderId, promisedPaymentDate) -> Promise<boolean>`.
- App -> page: `disabled={writesBlocked}`.

- [ ] **Step 1: Add RED HTTP and App contract tests**

Extend `worker/index.test.js` FakeDb with an `orders` map and the minimum SQL handlers needed by `loadOrderById` and `UPDATE orders SET promised_payment_date`. Add this HTTP test using a date that will remain future regardless of the test execution year:

```js
test('authenticated payment-promise route updates only the order promise', async () => {
  const env = await makeEnv()
  env.DB.orders.set('o1', {
    id: 'o1', business_id: 'amor-e-sabor', client_id: 'c1', client_name_snapshot: 'Maria',
    customer_identity_type: 'registered_client', table_tab_id: null, type: 'Entrega',
    order_date: '2026-09-06', status: 'Finalizado', scheduled_for: null,
    promised_payment_date: null, is_backdated: 0, subtotal_cents: 5000,
    delivery_fee_cents: 0, adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0,
    adjustment_amount_cents: 0, adjustment_reason: '', total_cents: 5000,
    created_at: '2026-09-06T12:00:00.000Z', finished_at: null, cancelled_at: null,
  })
  const loginResponse = await login(env)
  const cookiePair = loginResponse.headers.get('set-cookie').split(';')[0]
  const response = await handleRequest(new Request('https://delivery.example/api/orders/o1/payment-promise', {
    method: 'PATCH',
    headers: mutationHeaders({ cookie: cookiePair }),
    body: JSON.stringify({ promisedPaymentDate: '2099-12-31' }),
  }), env)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).order.promisedPaymentDate, '2099-12-31')
})
```

Also add one past/invalid request assertion and one outside-business 404 assertion.

Create `src/AppReceivablesPromise.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('app sends payment promise through API and applies the official returned order', async () => {
  const app = await read('./App.jsx')
  const api = await read('./api/client.js')
  assert.match(api, /export const updateOrderPaymentPromise = \(id, promisedPaymentDate\)/)
  assert.match(api, /\/payment-promise/)
  assert.match(app, /updateOrderPaymentPromise as updateOrderPaymentPromiseApi/)
  assert.match(app, /await updateOrderPaymentPromiseApi\(orderId, promisedPaymentDate\)/)
  assert.match(app, /applyOfficialEffects\(\{ order \}\)/)
  assert.match(app, /onUpdatePaymentPromise=\{handleUpdatePaymentPromise\}/)
  assert.match(app, /activeTab === 'receivables'[\s\S]*disabled=\{writesBlocked\}/)
})
```

- [ ] **Step 2: Run RED tests**

```bash
node --test worker/index.test.js src/AppReceivablesPromise.test.js
```

Expected: FAIL because route/client/App integration is absent.

- [ ] **Step 3: Add the Worker route**

In `worker/index.js`, import `updateOrderPaymentPromise` from `./orderPaymentPromise.js` and add before generic order fallthrough:

```js
const paymentPromiseMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/payment-promise$/)
if (paymentPromiseMatch && request.method === 'PATCH') {
  assertSameOriginMutation(request)
  const { promisedPaymentDate } = await readJson(request)
  const order = await updateOrderPaymentPromise(
    env.DB,
    session.businessId,
    decodeURIComponent(paymentPromiseMatch[1]),
    promisedPaymentDate,
  )
  return json({ order })
}
```

Do not create payment/movement/table-tab effects in this route.

- [ ] **Step 4: Add the browser API wrapper**

In `src/api/client.js` add:

```js
export const updateOrderPaymentPromise = (id, promisedPaymentDate) => apiRequest(
  `/api/orders/${encodeURIComponent(id)}/payment-promise`,
  withJson('PATCH', { promisedPaymentDate }),
)
```

- [ ] **Step 5: Add the App mutation handler with official reconciliation**

Import with alias:

```js
updateOrderPaymentPromise as updateOrderPaymentPromiseApi,
```

Add:

```js
const handleUpdatePaymentPromise = async (orderId, promisedPaymentDate) => {
  if (writesBlocked) return false
  setRequestKey(`payment-promise:${orderId}`)
  try {
    const { order } = await updateOrderPaymentPromiseApi(orderId, promisedPaymentDate)
    applyOfficialEffects({ order })
    showSuccessMessage(promisedPaymentDate ? 'Data prometida atualizada' : 'Data prometida removida')
    return true
  } catch (error) {
    showApiError(error)
    return false
  } finally {
    setRequestKey(null)
  }
}
```

Pass to the page:

```jsx
<Receivables
  orders={orders}
  movements={movements}
  tableTabs={tableTabs}
  currency={currency}
  disabled={writesBlocked}
  onRegisterPayment={openPaymentModal}
  onRegisterTableTabPayment={handleRegisterTableTabPayment}
  onUpdatePaymentPromise={handleUpdatePaymentPromise}
/>
```

- [ ] **Step 6: Run route/App tests GREEN**

```bash
node --test worker/index.test.js worker/orderPaymentPromise.test.js src/AppReceivablesPromise.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add worker/index.js worker/index.test.js src/api/client.js src/App.jsx src/AppReceivablesPromise.test.js
git commit -m "feat: expose payment promise API"
```

---

### Task 5: Replace client cards with the operational receivables ledger

**Files:**
- Modify: `src/pages/Receivables.jsx`
- Create: `src/pages/ReceivablesRedesign.test.js`
- Modify: `src/receivables.css`

**Interfaces:**
- Consumes Task 1 domain exports, `getOrderItemsSearchText`, `getOrderItemsSummary`, `getBusinessDate`, `calculateReceivedToday`.
- Receives props: `orders`, `movements`, `tableTabs`, `currency`, `disabled`, `onRegisterPayment`, `onRegisterTableTabPayment`, `onUpdatePaymentPromise`.
- Produces page state: `activeView`, `timingFilter`, `sortMode`, `exactDateFilter`, `selectedEntryKey`.

- [ ] **Step 1: Write RED structural contracts for tabs, summary, filters and ledger**

Create `src/pages/ReceivablesRedesign.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('receivables has only pending and paid primary tabs', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, />Pendentes</)
  assert.match(page, />Quitados</)
  assert.doesNotMatch(page, /Parciais/)
})

test('receivables exposes today upcoming overdue summaries and pending filters', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, /Receber hoje/)
  assert.match(page, /Próximos/)
  assert.match(page, /Em atraso/)
  assert.match(page, /Todos/)
  assert.match(page, /aria-pressed/)
  assert.match(page, /calculateReceivableSummary/)
})

test('standard receivables render a flat ledger instead of client cards', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, /receivables-ledger/)
  assert.match(page, /receivable-ledger-row/)
  assert.doesNotMatch(page, /receivable-client-card/)
  assert.doesNotMatch(page, /groupPendingOrders/)
})

test('receivables keeps search and exposes urgency recent and value sorting', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, /Buscar identificação, pedido ou produto/)
  assert.match(page, /Mais urgente/)
  assert.match(page, /Mais recente/)
  assert.match(page, /Maior valor/)
})

test('business date is refreshed while the page remains open', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, /getBusinessDate/)
  assert.match(page, /setInterval/)
})
```

- [ ] **Step 2: Run page contract RED**

```bash
node --test src/pages/ReceivablesRedesign.test.js
```

Expected: FAIL because the current page still uses grouped client cards.

- [ ] **Step 3: Introduce the new page state and business-date tick**

In `Receivables.jsx`, use these constants/state names:

```js
const PRIMARY_VIEWS = ['pending', 'paid']
const TIMING_FILTERS = ['all', 'today', 'upcoming', 'overdue']
const SORT_OPTIONS = [
  { value: 'urgency', label: 'Mais urgente' },
  { value: 'recent', label: 'Mais recente' },
  { value: 'value-desc', label: 'Maior valor' },
]

const [activeView, setActiveView] = useState('pending')
const [timingFilter, setTimingFilter] = useState('all')
const [sortMode, setSortMode] = useState('urgency')
const [exactDateFilter, setExactDateFilter] = useState(null)
const [selectedEntryKey, setSelectedEntryKey] = useState(null)
const [today, setToday] = useState(() => getBusinessDate())

useEffect(() => {
  const timer = window.setInterval(() => {
    const next = getBusinessDate()
    setToday((current) => current === next ? current : next)
  }, 60_000)
  return () => window.clearInterval(timer)
}, [])
```

This interval only recalculates a string; it does not write to the server.

- [ ] **Step 4: Derive summary, pending entries, paid entries, filtering and sorting**

Use `useMemo` with these rules:

```js
const summary = useMemo(() => calculateReceivableSummary(orders, today), [orders, today])
const pendingEntries = useMemo(() => buildPendingReceivableEntries(orders, tableTabs, today), [orders, tableTabs, today])
const paidOrders = useMemo(() => getPaidReceivableOrders(orders), [orders])
```

For pending search, concatenate every order inside an entry:

```js
const entrySearchText = (entry) => entry.orders.map((order) => [
  order.client,
  String(order.id),
  order.type,
  order.orderDate,
  getOrderItemsSearchText(order),
].join(' ')).join(' ').toLowerCase()
```

Pending filters:

```js
entry.timing.status === timingFilter
entry.expectedDate === exactDateFilter
```

Use `sortReceivableEntries` after search/filter.

Paid list stays flat per order and sorts by `paidAt` descending by default; it does not show timing chips.

- [ ] **Step 5: Render compact summary buttons, primary tabs, filters, search, sorting and ledger rows**

Use accessible buttons rather than clickable `div`s. Required classes/copy:

```jsx
<button type="button" className="receivables-summary-card" onClick={() => applyTimingFilter('today')}>
  <span>Receber hoje</span>
  <strong>{currency(summary.today.amount)}</strong>
  <small>{summary.today.count} pedido(s)</small>
</button>
```

Create equivalent `Próximos` and `Em atraso` buttons.

Primary tabs must use buttons with `aria-pressed={activeView === 'pending'}` / `paid`.

Pending timing chips must use `aria-pressed={timingFilter === filter}` and clear `exactDateFilter` when manually selected.

Each standard ledger item must be keyboard-operable:

```jsx
<button
  type="button"
  className="receivable-ledger-row"
  aria-pressed={selectedEntryKey === entry.key}
  onClick={() => setSelectedEntryKey(entry.key)}
>
  <span className="receivable-ledger-avatar">{entry.label.charAt(0).toUpperCase()}</span>
  <span className="receivable-ledger-main">
    <strong>{entry.label}</strong>
    <span>Pedido #{orderNumber(entry.order.id)} · {getOrderItemsSummary(entry.order)}</span>
    <span className={`receivable-timing receivable-timing-${entry.timing.status}`}>{timingLabel(entry, today)}</span>
  </span>
  <strong className="receivable-ledger-amount">{currency(entry.total)}</strong>
  <Icon name="details" size={18} />
</button>
```

Table-tab entries use the same ledger language but label the count: `{entry.orders.length} pedido(s) nesta comanda`.

Paid rows show `Quitado`, `paidAt`, `paymentMethod` and amount; no payment/promise action in the row itself.

- [ ] **Step 6: Add correct empty states**

Render the exact spec copy:

- pending all empty: `Tudo recebido por aqui` / `Quando houver um pedido pendente, ele aparecerá automaticamente nesta tela.`
- filter/search empty: `Nenhum recebimento neste filtro` / `Tente outro período ou ajuste a busca.`
- paid empty: `Nenhum recebimento registrado ainda` / `Os pedidos pagos aparecerão aqui.`

- [ ] **Step 7: Add base ledger CSS**

In `src/receivables.css`, remove obsolete `.receivable-client-card` dependencies from normal order rendering and introduce:

```css
.receivables-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.receivables-summary-card { min-width: 0; min-height: 86px; text-align: left; }
.receivables-primary-tabs { display: flex; gap: 8px; }
.receivables-filter-strip { display: flex; gap: 8px; overflow-x: auto; }
.receivables-ledger { display: grid; border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
.receivable-ledger-row { width: 100%; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 12px; min-height: 68px; padding: 12px 14px; border: 0; border-bottom: 1px solid var(--border); background: var(--surface); color: var(--text); text-align: left; }
.receivable-ledger-row:last-child { border-bottom: 0; }
.receivable-ledger-main { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.receivable-ledger-amount { white-space: nowrap; }
```

Use existing theme variables for tones; every timing state must also display text/icon, never color alone.

- [ ] **Step 8: Run page tests GREEN plus existing receivables tests**

```bash
node --test src/pages/ReceivablesRedesign.test.js src/pages/ReceivablesMobile.test.js src/pages/ReceivablesDetails.test.js
```

Expected: the new redesign contract passes. If old detail/mobile assertions intentionally reference removed client-card markup, update them only in Tasks 6/9 where their replacement behavior is introduced; do not weaken unrelated assertions.

- [ ] **Step 9: Commit Task 5**

```bash
git add src/pages/Receivables.jsx src/pages/ReceivablesRedesign.test.js src/receivables.css
git commit -m "feat: redesign receivables as ledger"
```

---

### Task 6: Add responsive detail and promise editing

**Files:**
- Create: `src/components/ReceivableDetail.jsx`
- Create: `src/components/PaymentPromiseDialog.jsx`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/pages/ReceivablesDetails.test.js`
- Modify: `src/pages/ReceivablesMobile.test.js`
- Modify: `src/receivables.css`

**Interfaces:**
- `ReceivableDetail({ entry, currency, today, disabled, onRegisterPayment, onRegisterTableTabPayment, onEditPromise, onViewOrder })`.
- `PaymentPromiseDialog({ open, order, today, disabled, onClose, onSave })` where `onSave(orderId, dateOrNull) -> Promise<boolean>`.
- Page stores only `selectedEntryKey`; selected entry is always re-derived from current synced data to avoid stale state.

- [ ] **Step 1: Replace old detail test with RED responsive detail contracts**

Rewrite `src/pages/ReceivablesDetails.test.js` to assert:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('receivables reuses one detail component in bottom sheet and desktop panel', () => {
  const page = source('./Receivables.jsx')
  assert.match(page, /import BottomSheet/)
  assert.match(page, /import ReceivableDetail/)
  assert.match(page, /<BottomSheet[\s\S]*<ReceivableDetail/)
  assert.match(page, /receivables-detail-panel[\s\S]*<ReceivableDetail/)
})

test('order detail exposes payment promise and view-order actions only where allowed', () => {
  const detail = source('../components/ReceivableDetail.jsx')
  assert.match(detail, /Registrar recebimento/)
  assert.match(detail, /Definir data prometida|Alterar data prometida/)
  assert.match(detail, /Ver pedido/)
  assert.match(detail, /entry\.kind === 'table_tab'/)
  assert.match(detail, /Registrar pagamento da comanda/)
})

test('payment promise dialog supports save and removal with overdue warning', () => {
  const dialog = source('../components/PaymentPromiseDialog.jsx')
  assert.match(dialog, /Data prometida de pagamento/)
  assert.match(dialog, /min=\{today\}/)
  assert.match(dialog, /Remover data prometida/)
  assert.match(dialog, /Sem a data prometida, este pedido será classificado como atrasado/)
})
```

Update `ReceivablesMobile.test.js` to require portal-backed `BottomSheet` reuse rather than a custom fixed sheet.

- [ ] **Step 2: Run detail/mobile RED**

```bash
node --test src/pages/ReceivablesDetails.test.js src/pages/ReceivablesMobile.test.js
```

Expected: FAIL because the new components/panel do not exist.

- [ ] **Step 3: Implement `ReceivableDetail.jsx`**

For `entry.kind === 'order'`, display:

```text
cliente
Pedido #XXXX
valor
status temporal
Data do pedido
Data prometida de pagamento | Não definida
```

Always include the explanatory copy:

```text
A data prometida é opcional. Sem ela, o pagamento é esperado para o mesmo dia do pedido.
```

For a pending standard order, buttons are exactly:

```jsx
<Button onClick={() => onRegisterPayment(order.id)} disabled={disabled}>Registrar recebimento</Button>
<Button variant="secondary" onClick={() => onEditPromise(order)} disabled={disabled}>
  {order.promisedPaymentDate ? 'Alterar data prometida' : 'Definir data prometida'}
</Button>
<Button variant="secondary" onClick={() => onViewOrder(order)}>Ver pedido</Button>
```

For paid orders, render only `Ver pedido`; show `Quitado`, `paidAt` and `paymentMethod`, and do not render payment/promise actions.

For `entry.kind === 'table_tab'`, render table label, count, total and:

```jsx
<Button onClick={() => onRegisterTableTabPayment(entry)} disabled={disabled}>
  Registrar pagamento da comanda
</Button>
```

Do not render any promise action for table tabs.

- [ ] **Step 4: Implement `PaymentPromiseDialog.jsx`**

Use existing `Modal`. Keep local `date` state synchronized with `order?.promisedPaymentDate || ''` when opened.

Form field:

```jsx
<label className="form-field">
  <span>Data prometida de pagamento</span>
  <input type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} disabled={disabled} />
</label>
```

Save:

```js
const save = async () => {
  if (!order || disabled || !date) return
  if (await onSave(order.id, date)) onClose()
}
```

Remove, shown only when `order.promisedPaymentDate` exists:

```js
const remove = async () => {
  if (!order || disabled) return
  if (await onSave(order.id, null)) onClose()
}
```

If `order.promisedPaymentDate` exists and `order.orderDate < today`, show the exact warning before the remove button:

```text
Sem a data prometida, este pedido será classificado como atrasado.
```

- [ ] **Step 5: Orchestrate mobile sheet, desktop panel and existing OrderDetail**

In `Receivables.jsx`, derive `selectedEntry` from current visible/all entries by `selectedEntryKey` instead of storing an object.

Track viewport with:

```js
const [wideDetail, setWideDetail] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 960px)').matches)
useEffect(() => {
  const media = window.matchMedia('(min-width: 960px)')
  const update = () => setWideDetail(media.matches)
  update(); media.addEventListener('change', update)
  return () => media.removeEventListener('change', update)
}, [])
```

Mobile:

```jsx
<BottomSheet open={Boolean(selectedEntry) && !wideDetail} title="Detalhes do recebimento" onClose={() => setSelectedEntryKey(null)}>
  {selectedEntry && <ReceivableDetail {...detailProps} />}
</BottomSheet>
```

Desktop:

```jsx
{wideDetail && selectedEntry && (
  <aside className="receivables-detail-panel" aria-label="Detalhes do recebimento">
    <ReceivableDetail {...detailProps} />
  </aside>
)}
```

Keep `OrderDetail` as the deeper order-inspection modal via separate `orderDetail` state.

- [ ] **Step 6: Add detail/promise responsive CSS**

Use:

```css
.receivables-workspace { display: grid; gap: 16px; }
.receivables-detail-panel { display: none; }
.receivable-detail { display: grid; gap: 14px; }
.receivable-detail-actions { display: grid; gap: 8px; }

@media (min-width: 960px) {
  .receivables-workspace.has-detail { grid-template-columns: minmax(0, 1fr) minmax(300px, 360px); align-items: start; }
  .receivables-detail-panel { display: block; position: sticky; top: 18px; }
}
```

The mobile sheet itself remains the existing portal/focus-managed `BottomSheet`; do not clone its focus trap.

- [ ] **Step 7: Run detail tests GREEN**

```bash
node --test src/pages/ReceivablesDetails.test.js src/pages/ReceivablesMobile.test.js src/AppReceivablesPromise.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```bash
git add src/components/ReceivableDetail.jsx src/components/PaymentPromiseDialog.jsx src/pages/Receivables.jsx src/pages/ReceivablesDetails.test.js src/pages/ReceivablesMobile.test.js src/receivables.css
git commit -m "feat: add receivable detail and promise editing"
```

---

### Task 7: Add the 7-day receivables forecast

**Files:**
- Create: `src/components/ReceivablesForecastDialog.jsx`
- Create: `src/pages/ReceivablesForecast.test.js`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/components/Icon.jsx`
- Modify: `src/receivables.css`

**Interfaces:**
- Consumes: `buildReceivablesForecast(orders, today, 7)`, `calculateReceivedToday(movements, today)`.
- `ReceivablesForecastDialog({ open, forecast, receivedToday, currency, onClose, onSelectDate })`.
- `onSelectDate(date)` applies an exact expected-date filter to Pendentes and closes the forecast.

- [ ] **Step 1: Write the RED forecast UI contract**

Create `src/pages/ReceivablesForecast.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('receivables exposes an accessible forecast action backed by seven-day domain forecast', async () => {
  const page = await read('./Receivables.jsx')
  assert.match(page, /aria-label="Previsão de recebimentos"/)
  assert.match(page, /buildReceivablesForecast\(orders, today, 7\)/)
  assert.match(page, /calculateReceivedToday\(movements, today\)/)
})

test('forecast dialog renders overdue today seven days later and received-today as separate text metrics', async () => {
  const dialog = await read('../components/ReceivablesForecastDialog.jsx')
  assert.match(dialog, /Em atraso/)
  assert.match(dialog, /Hoje/)
  assert.match(dialog, /Depois/)
  assert.match(dialog, /Recebido hoje/)
  assert.match(dialog, /forecast\.days\.map/)
  assert.match(dialog, /onSelectDate\(day\.date\)/)
})
```

- [ ] **Step 2: Run forecast RED**

```bash
node --test src/pages/ReceivablesForecast.test.js src/utils/receivables.test.js
```

Expected: UI test FAIL; domain forecast stays GREEN.

- [ ] **Step 3: Add a `chart` icon to the shared icon set**

In `src/components/Icon.jsx` add:

```jsx
chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
```

Use `Icon name="chart"` for the forecast action.

- [ ] **Step 4: Implement `ReceivablesForecastDialog.jsx` with text-first CSS bars**

Use existing `Modal`; compute maximum bucket amount to normalize widths, but always render amount/count as text. Required row shape:

```jsx
<button type="button" className="receivables-forecast-row" onClick={() => onSelectDate(day.date)}>
  <span>{formatForecastDate(day.date)}</span>
  <span className="receivables-forecast-bar-track" aria-hidden="true">
    <span className="receivables-forecast-bar" style={{ width: `${barPercent(day.amount)}%` }} />
  </span>
  <strong>{currency(day.amount)}</strong>
  <small>{day.count} pedido(s)</small>
</button>
```

Render non-clickable summary rows for `Em atraso`, `Hoje`, `Depois`, and a distinct realized metric `Recebido hoje`.

When all seven future buckets and `later` are zero, show:

```text
Nenhum recebimento futuro programado.
```

- [ ] **Step 5: Wire forecast state and exact-date filtering into the page**

In `Receivables.jsx`:

```js
const [forecastOpen, setForecastOpen] = useState(false)
const forecast = useMemo(() => buildReceivablesForecast(orders, today, 7), [orders, today])
const receivedToday = useMemo(() => calculateReceivedToday(movements, today), [movements, today])

const selectForecastDate = (date) => {
  setActiveView('pending')
  setTimingFilter(date === today ? 'today' : 'upcoming')
  setExactDateFilter(date)
  setForecastOpen(false)
}
```

Header action:

```jsx
<button type="button" className="icon-button icon-button-neutral" aria-label="Previsão de recebimentos" onClick={() => setForecastOpen(true)}>
  <Icon name="chart" size={20} />
</button>
```

- [ ] **Step 6: Add forecast CSS without a chart dependency**

```css
.receivables-forecast-list { display: grid; gap: 8px; }
.receivables-forecast-row { width: 100%; display: grid; grid-template-columns: minmax(78px, auto) minmax(70px, 1fr) auto; gap: 10px; align-items: center; min-height: 48px; }
.receivables-forecast-bar-track { height: 8px; overflow: hidden; border-radius: 999px; background: var(--surface-muted); }
.receivables-forecast-bar { display: block; min-width: 2px; height: 100%; border-radius: inherit; background: var(--primary); }
```

Do not hide zero values; `R$ 0,00` remains visible.

- [ ] **Step 7: Run forecast tests GREEN**

```bash
node --test src/pages/ReceivablesForecast.test.js src/utils/receivables.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit Task 7**

```bash
git add src/components/ReceivablesForecastDialog.jsx src/pages/ReceivablesForecast.test.js src/pages/Receivables.jsx src/components/Icon.jsx src/receivables.css
git commit -m "feat: add receivables forecast"
```

---

### Task 8: Add quick payment entry while preserving the single payment architecture

**Files:**
- Create: `src/components/ReceivablesQuickPaymentDialog.jsx`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/pages/ReceivablesRedesign.test.js`
- Modify: `src/pages/ReceivablesMobile.test.js`
- Modify: `src/receivables.css`

**Interfaces:**
- `ReceivablesQuickPaymentDialog({ open, entries, currency, onClose, onSelect })`.
- `entries` contains only `kind === 'order'` pending entries.
- `onSelect(orderId)` must call the existing `onRegisterPayment(orderId)` callback; it must never select payment method or call `/payment` directly.
- Table tabs continue through `onRegisterTableTabPayment(entry)` in `ReceivableDetail`.

- [ ] **Step 1: Add RED quick-payment and table-tab regression contracts**

Append to `ReceivablesRedesign.test.js`:

```js
test('quick payment delegates to the existing App payment flow and excludes table tabs', async () => {
  const page = await read('./Receivables.jsx')
  const quick = await read('../components/ReceivablesQuickPaymentDialog.jsx')
  const app = await read('../App.jsx')
  assert.match(page, /Registrar recebimento/)
  assert.match(page, /entry\.kind === 'order'/)
  assert.match(quick, /onSelect\(entry\.order\.id\)/)
  assert.match(app, /<Modal title="Registrar pagamento"[\s\S]*<SystemSelect/)
  assert.doesNotMatch(quick, /registerPaymentApi|\/payment/)
})

test('table tabs keep aggregate payment and never expose promise editing', async () => {
  const detail = await read('../components/ReceivableDetail.jsx')
  assert.match(detail, /Registrar pagamento da comanda/)
  assert.match(detail, /entry\.kind === 'table_tab'/)
})
```

Append to `ReceivablesMobile.test.js` a contract requiring the FAB bottom offset to use existing mobile variables.

- [ ] **Step 2: Run quick-payment RED**

```bash
node --test src/pages/ReceivablesRedesign.test.js src/pages/ReceivablesMobile.test.js worker/tableTabPayment.test.js
```

Expected: UI tests FAIL for missing quick dialog/FAB; table-tab backend test remains GREEN.

- [ ] **Step 3: Implement the searchable quick selector**

`ReceivablesQuickPaymentDialog.jsx` uses existing `Modal`, a local search string and only standard entries. Each result button shows client, order number and amount. Selection is exactly:

```js
const choose = (entry) => {
  onSelect(entry.order.id)
  onClose()
}
```

No payment method field exists in this component.

Empty result copy:

```text
Nenhum pedido pendente encontrado.
```

- [ ] **Step 4: Add desktop action and mobile FAB**

In `Receivables.jsx`:

```js
const [quickPaymentOpen, setQuickPaymentOpen] = useState(false)
const quickPaymentEntries = pendingEntries.filter((entry) => entry.kind === 'order')
const overlayOpen = Boolean(selectedEntry && !wideDetail) || forecastOpen || quickPaymentOpen || Boolean(promiseOrder) || Boolean(orderDetail)
```

Desktop header/toolbar button:

```jsx
<Button onClick={() => setQuickPaymentOpen(true)} disabled={writeDisabled}>Registrar recebimento</Button>
```

Mobile FAB, rendered only when `!overlayOpen`:

```jsx
<button type="button" className="receivables-payment-fab" onClick={() => setQuickPaymentOpen(true)} disabled={writeDisabled} aria-label="Registrar recebimento">
  <Icon name="plus" size={20} />
  <span>Registrar recebimento</span>
</button>
```

Pass `onSelect={onRegisterPayment}` to the quick dialog. The existing App modal then requests `Pix/Dinheiro/...` and registers the actual payment.

- [ ] **Step 5: Position the mobile FAB above bottom navigation and safe area**

Use existing mobile foundation variables:

```css
@media (max-width: 820px) {
  .receivables-payment-fab {
    position: fixed;
    right: var(--mobile-page-inline);
    bottom: calc(var(--mobile-bottom-nav-height) + var(--mobile-safe-bottom) + var(--mobile-floating-gap));
    z-index: var(--layer-floating-action);
    min-height: 48px;
  }
}

@media (min-width: 821px) {
  .receivables-payment-fab { display: none; }
}
```

Do not cover the last ledger row; existing `.app-content` already includes `--mobile-content-bottom-space`, and add page-local extra padding only if visual verification proves the FAB still overlaps content.

- [ ] **Step 6: Run quick payment/table-tab tests GREEN**

```bash
node --test src/pages/ReceivablesRedesign.test.js src/pages/ReceivablesMobile.test.js worker/tableTabPayment.test.js src/AppReceivablesPromise.test.js
```

Expected: PASS. The only place that selects payment method remains the existing App payment modal and current table-tab modal.

- [ ] **Step 7: Commit Task 8**

```bash
git add src/components/ReceivablesQuickPaymentDialog.jsx src/pages/Receivables.jsx src/pages/ReceivablesRedesign.test.js src/pages/ReceivablesMobile.test.js src/receivables.css
git commit -m "feat: add quick receivable payment action"
```

---

### Task 9: Harden responsive UX, accessibility and empty/error states

**Files:**
- Modify: `src/receivables.css`
- Modify: `src/pages/ReceivablesMobile.test.js`
- Modify: `src/pages/ReceivablesRedesign.test.js`
- Modify only if tests require: `src/components/ReceivableDetail.jsx`, `src/components/PaymentPromiseDialog.jsx`, `src/components/ReceivablesForecastDialog.jsx`, `src/components/ReceivablesQuickPaymentDialog.jsx`

**Interfaces:**
- No new business interfaces. This task locks responsive/accessibility behavior around Tasks 5–8.

- [ ] **Step 1: Add RED contracts for mobile touch, horizontal filters, desktop sticky panel, money wrapping and reduced motion**

Add assertions to `ReceivablesMobile.test.js` for:

```js
assert.match(css, /\.receivable-ledger-row\s*\{[^}]*min-height:\s*(?:44px|[4-9]\dpx)/s)
assert.match(css, /\.receivables-filter-strip\s*\{[^}]*overflow-x:\s*auto/s)
assert.match(css, /@media\s*\(min-width:\s*960px\)[\s\S]*\.receivables-detail-panel\s*\{[^}]*position:\s*sticky/s)
assert.match(css, /\.receivable-ledger-amount\s*\{[^}]*white-space:\s*nowrap/s)
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/s)
assert.match(css, /\.receivables-payment-fab\s*\{[^}]*bottom:\s*calc\(var\(--mobile-bottom-nav-height\)/s)
```

Add source assertions that interactive filters use `aria-pressed`, forecast action has `aria-label`, and no `.receivable-ledger-row` is a raw clickable `div`.

- [ ] **Step 2: Run UX hardening RED**

```bash
node --test src/pages/ReceivablesMobile.test.js src/pages/ReceivablesRedesign.test.js
```

Expected: FAIL only for missing hardening rules.

- [ ] **Step 3: Complete responsive CSS**

Mobile requirements:

```css
@media (max-width: 820px) {
  .receivables-summary-grid { grid-template-columns: repeat(3, minmax(148px, 1fr)); overflow-x: auto; padding-bottom: 4px; }
  .receivables-filter-strip { margin-inline: -2px; padding: 2px; overflow-x: auto; scrollbar-width: none; }
  .receivable-ledger-row { grid-template-columns: auto minmax(0, 1fr) auto; min-height: 72px; }
  .receivable-ledger-row > svg { display: none; }
  .receivable-ledger-amount { grid-column: 3; overflow-wrap: normal; }
}
```

Desktop requirements:

```css
@media (min-width: 960px) {
  .receivables-controls { display: grid; grid-template-columns: minmax(260px, 1fr) auto auto; align-items: center; gap: 12px; }
  .receivables-detail-panel { max-height: calc(100dvh - 36px); overflow-y: auto; }
}
```

Focus and motion:

```css
.receivable-ledger-row:focus-visible,
.receivables-summary-card:focus-visible,
.receivables-filter-strip button:focus-visible,
.receivables-payment-fab:focus-visible,
.receivables-forecast-row:focus-visible {
  outline: 3px solid var(--primary-soft);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .receivable-ledger-row,
  .receivables-summary-card,
  .receivables-payment-fab,
  .receivables-forecast-bar { transition: none !important; }
}
```

Use theme variables and verify danger/primary text contrast against current WCAG-AA palette; do not encode status by color alone.

- [ ] **Step 4: Verify offline disables all writes but not reads**

The page-level write flag must be:

```js
const writeDisabled = disabled || (typeof navigator !== 'undefined' && !navigator.onLine)
```

Use it for:

- `Registrar recebimento` desktop/FAB/detail;
- `Definir/Alterar/Remover data prometida`;
- `Registrar pagamento da comanda`.

Do not use it to disable tabs, filters, search, sorting, row details or forecast.

- [ ] **Step 5: Run all receivables UI tests GREEN**

```bash
node --test src/pages/ReceivablesRedesign.test.js src/pages/ReceivablesDetails.test.js src/pages/ReceivablesMobile.test.js src/pages/ReceivablesForecast.test.js src/utils/receivables.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 9**

```bash
git add src/receivables.css src/pages/ReceivablesMobile.test.js src/pages/ReceivablesRedesign.test.js src/components/ReceivableDetail.jsx src/components/PaymentPromiseDialog.jsx src/components/ReceivablesForecastDialog.jsx src/components/ReceivablesQuickPaymentDialog.jsx
git commit -m "fix: harden receivables responsive ux"
```

If none of the four component files changed in Step 3/4, omit them from `git add` rather than making no-op edits.

---

### Task 10: Run regressions, validate D1/Worker builds, deploy staging and prepare homologation

**Files:**
- No application code should be added in this task unless a fresh RED regression test proves a defect.
- Update plan checkboxes/ledger only if the execution workflow uses tracking files.

**Interfaces:**
- Consumes the completed feature branch.
- Produces a staging build ready for explicit user homologation; no production deployment.

- [ ] **Step 1: Run the complete test suite**

```bash
npm test
```

Expected: all tests PASS, including existing payment, cancellation, refund, table-tab, scheduling, printing, finance and sync suites.

Pay special attention to these mandatory regressions:

```bash
node --test worker/orderRepositories.test.js worker/tableTabPayment.test.js worker/orderCancellation.test.js worker/orderCancellationHttp.test.js worker/financeRepositoryCrud.test.js src/AppReceivablesPromise.test.js src/pages/Receivables*.test.js
```

Expected: PASS.

- [ ] **Step 2: Run lint and build**

```bash
npm run lint
npm run build
```

Expected: both exit 0.

- [ ] **Step 3: Recreate local D1 migration state from the branch**

```bash
npm run d1:migrate:local
```

Expected: all migrations through `0012_receivables_payment_promise.sql` are applied; rerunning reports no pending destructive action.

- [ ] **Step 4: Validate both Worker bundles without deployment**

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --env staging --dry-run
```

Expected: both dry-runs succeed.

- [ ] **Step 5: Create/update a draft PR targeting `master`**

Title:

```text
feat: redesign receivables with payment forecast
```

PR body must include:

```markdown
## Summary
- redesign A receber as a compact pending/paid ledger
- add optional promised payment date and timing classification
- add 7-day receivables forecast and quick payment entry
- preserve table-tab payment and Financeiro realization rules

## Verification
- npm test
- npm run lint
- npm run build
- npm run d1:migrate:local
- wrangler production/staging dry-run

## Rollout
Staging only. Do not merge to master until explicit homologation approval.
```

Keep the PR draft while staging is under review.

- [ ] **Step 6: Deploy the feature branch to staging through the existing `Deploy staging` workflow**

Trigger `.github/workflows/deploy-staging.yml` using `workflow_dispatch` with ref:

```text
feature/receivables-forecast-redesign
```

The workflow must apply staging migrations, deploy, and verify staging login. Do not alter `.github/workflows/deploy-production.yml` and do not deploy `master`.

- [ ] **Step 7: Perform the staging homologation checklist**

Validate at minimum:

1. pedido criado hoje sem promessa -> `Receber hoje`;
2. pedido antigo sem promessa -> `Em atraso` with correct calendar-day count;
3. old pending order + future promise -> `Próximos` and appears on the correct forecast day;
4. promise equal to today -> `Hoje`;
5. removing a promise from an old order warns and immediately reclassifies after the official response;
6. paid order leaves Pendentes, appears in Quitados and creates exactly one Financeiro entry;
7. promise creation/change/removal creates no Financeiro movement;
8. cancelled order never appears in pending/paid receivables;
9. open table tab stays aggregated, uses the newest pending order date for timing and still pays all pending table orders together;
10. table tab exposes no promise edit;
11. mobile opens detail in portal-backed bottom sheet, keeps 44 px touch targets and FAB above bottom nav;
12. desktop opens sticky right detail while the ledger remains usable;
13. graph view shows overdue, today, seven future calendar days, later and received-today separately;
14. clicking a forecast day closes forecast and filters ledger to that date;
15. search finds client, order id, product and type;
16. offline mode keeps list/forecast readable while payment/promise actions are disabled;
17. another device changing a promise is reflected by the existing bootstrap sync without an optimistic stale state.

- [ ] **Step 8: Stop before production**

Report staging URL, branch HEAD, PR number, migration `0012` status and the full verification result to the user. Wait for explicit production/merge approval. Do not merge the PR or run production migration/deploy in this plan without a new user approval.

---

## Self-Review Against the Approved Spec

### Spec coverage

- Same-day default / no standard due date: Task 1.
- Optional promise overrides `orderDate` only for financial expectation: Tasks 1–4.
- Original order dates/status/totals stay untouched: Tasks 2–4 tests.
- No partial payments: Global Constraints + existing payment flow preserved in Tasks 4/8/10.
- Dynamic Today/Upcoming/Overdue and midnight refresh: Tasks 1/5.
- `scheduledFor` intentionally ignored for receivable timing: Global Constraints + Task 1 expected-date function.
- Three operational summaries: Task 5.
- Pending/Paid only: Task 5.
- Timing filters/search/sorts: Task 5.
- Flat standard-order ledger: Task 5.
- Paid history: Task 5/6.
- Mobile bottom sheet / desktop sticky detail: Task 6.
- Define/change/remove promise and removal warning: Task 6.
- Nullable migration, official reads, endpoint: Tasks 2–4.
- Promise does not create payment/movement: Tasks 3/10.
- Existing payment modal reused: Tasks 4/8.
- Quick payment FAB/desktop action: Task 8.
- Table tabs aggregate and use newest order date; no promise edit: Tasks 1/6/8.
- Seven-day forecast + later + received today: Tasks 1/7.
- Pure domain logic outside React: Task 1.
- Official sync/no optimistic update/offline: Tasks 4/9/10.
- Accessibility, touch, safe area, reduced motion: Tasks 6/8/9.
- Empty states: Task 5/7.
- Staging-only rollout and explicit production gate: Task 10.

### Placeholder scan

The plan contains no `TBD`, no `TODO`, no unspecified error handling step, and no generic “write tests for this” instruction. Every task states exact files, interfaces, RED command, implementation shape, GREEN command and commit.

### Type/name consistency

- Database: `promised_payment_date`.
- Domain/API/UI: `promisedPaymentDate`.
- Backend mutation: `updateOrderPaymentPromise`.
- Browser API alias: `updateOrderPaymentPromiseApi`.
- App callback: `handleUpdatePaymentPromise` -> page prop `onUpdatePaymentPromise`.
- Timing statuses: `overdue`, `today`, `upcoming`, `paid`, `excluded`.
- Sort modes: `urgency`, `recent`, `value-desc`.
- Forecast shape: `{ overdue, today, days, later }`.
- Table-tab entry kind: `table_tab`; standard entry kind: `order`.
