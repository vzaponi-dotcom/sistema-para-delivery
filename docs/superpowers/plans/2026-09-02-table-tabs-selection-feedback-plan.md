# Comandas por Mesa e Feedback Visual de Seleção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma comanda persistente por mesa, cobrar todos os pedidos pendentes dessa comanda em uma única ação e tornar inequívoco o estado visual selecionado no formulário de produtos.

**Architecture:** Adicionar uma entidade `table_tabs` no D1 e um vínculo opcional `orders.table_tab_id`; o Worker resolve ou cria a comanda autoritativamente a partir do identificador da mesa, e o bootstrap expõe `tableTabs` junto dos pedidos. `A Receber` passa a agrupar pedidos de mesa pelo `tableTabId` e usa um endpoint dedicado para pagamento consolidado, preservando um pagamento e uma movimentação por pedido. O hotfix visual reutiliza o estado lógico e `aria-pressed` já existentes no `ProductForm`, acrescentando contraste forte e check visível sem alterar regras do catálogo.

**Tech Stack:** React, JavaScript ES modules, Node test runner (`node --test`), Cloudflare Workers, D1/SQLite, Wrangler 4.128.0, Vite, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-02-table-tabs-selection-feedback-design.md`

## Global Constraints

- Uma mesa pode ter no máximo uma comanda `open` por empresa.
- O frontend nunca envia um `tableTabId` autoritativo no checkout; o Worker resolve a comanda usando empresa autenticada + identificador canônico da mesa.
- Canonização de mesa: `trim()`, letras em maiúsculas, preservar zeros à esquerda; `04` e `4` são mesas distintas.
- Pedidos históricos de mesa sem `table_tab_id` continuam independentes; não fazer backfill por texto.
- Entrega, Retirada, Nome e Cliente cadastrado preservam o comportamento atual.
- O pagamento da comanda quita todos os pedidos ainda pendentes em uma única ação de UI, mas mantém um registro de `payments` e uma movimentação `order-payment` por pedido.
- Pedidos já pagos não recebem pagamento duplicado; comanda fechada não pode gerar nova cobrança.
- Remover o último pedido de uma comanda deve encerrar a comanda vazia.
- Não implementar pagamento parcial, divisão de conta, transferência de mesa, merge/split de comandas, mapa de mesas ou duas comandas simultâneas para a mesma mesa.
- Categoria, Apresentação, Tamanho e Unidade no `ProductForm` devem manter `aria-pressed` e ganhar fundo, borda e check claramente visíveis em desktop/mobile e temas claro/escuro.
- Nenhuma nova dependência é necessária.

---

### Task 1: Migration e modelo mínimo de comanda

**Files:**
- Create: `migrations/0007_table_tabs.sql`
- Modify: `worker/repositories.js`
- Create: `worker/tableTabsMigration.test.js`
- Modify: `worker/orderIdentityRepositoryMapping.test.js`

**Interfaces:**
- Produces: `mapTableTabRow(row) -> { id, tableIdentifier, status, openedAt, closedAt }`
- Produces: `order.tableTabId: string | null` em `mapOrderRow`.
- Produces: tabela `table_tabs` e coluna `orders.table_tab_id`.

- [ ] **Step 1: Write the failing migration and mapper tests**

Crie `worker/tableTabsMigration.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql = fs.readFileSync(new URL('../migrations/0007_table_tabs.sql', import.meta.url), 'utf8')

test('table tabs migration is additive and enforces one open tab per table', () => {
  assert.match(sql, /CREATE TABLE table_tabs/i)
  assert.match(sql, /table_identifier TEXT NOT NULL/i)
  assert.match(sql, /status TEXT NOT NULL/i)
  assert.match(sql, /ALTER TABLE orders ADD COLUMN table_tab_id TEXT/i)
  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*business_id[\s\S]*table_identifier[\s\S]*WHERE status = 'open'/i)
  assert.doesNotMatch(sql, /UPDATE orders[\s\S]*client_name_snapshot/i)
})
```

Amplie `worker/orderIdentityRepositoryMapping.test.js` para exigir:

```js
assert.equal(mapped.tableTabId, 'tab-1')
```

usando uma row com `table_tab_id: 'tab-1'`, e acrescente um teste de `mapTableTabRow`:

```js
assert.deepEqual(mapTableTabRow({
  id: 'tab-1',
  table_identifier: '04',
  status: 'open',
  opened_at: '2026-09-02T18:00:00.000Z',
  closed_at: null,
}), {
  id: 'tab-1',
  tableIdentifier: '04',
  status: 'open',
  openedAt: '2026-09-02T18:00:00.000Z',
  closedAt: null,
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test worker/tableTabsMigration.test.js worker/orderIdentityRepositoryMapping.test.js
```

Expected: FAIL porque `0007_table_tabs.sql`, `mapTableTabRow` e `tableTabId` ainda não existem.

- [ ] **Step 3: Add the additive D1 migration**

Crie `migrations/0007_table_tabs.sql` com:

```sql
CREATE TABLE table_tabs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_identifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_table_tabs_one_open_per_table
  ON table_tabs (business_id, table_identifier)
  WHERE status = 'open';

CREATE INDEX idx_table_tabs_business_status
  ON table_tabs (business_id, status, opened_at);

ALTER TABLE orders ADD COLUMN table_tab_id TEXT REFERENCES table_tabs(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_table_tab_id ON orders (business_id, table_tab_id);
```

- [ ] **Step 4: Map the new fields in `worker/repositories.js`**

Adicione:

```js
export const mapTableTabRow = (row) => ({
  id: row.id,
  tableIdentifier: row.table_identifier,
  status: row.status,
  openedAt: row.opened_at,
  closedAt: row.closed_at ?? null,
})
```

Em `mapOrderRow`, adicione:

```js
tableTabId: row.table_tab_id ?? null,
```

E inclua `o.table_tab_id` em `orderSelect`.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
node --test worker/tableTabsMigration.test.js worker/orderIdentityRepositoryMapping.test.js
```

Expected: PASS.

Commit:

```bash
git add migrations/0007_table_tabs.sql worker/repositories.js worker/tableTabsMigration.test.js worker/orderIdentityRepositoryMapping.test.js
git commit -m "feat: add persistent table tabs"
```

---

### Task 2: Bootstrap explícito de comandas e resolução segura no checkout

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/multiItemCheckoutRepository.test.js`
- Modify: `worker/repositories.test.js`

**Interfaces:**
- Consumes: `mapTableTabRow`, `orders.table_tab_id`, `table_tabs`.
- Produces: `normalizeTableIdentifier(value) -> string`.
- Produces: `getOrCreateOpenTableTab(db, businessId, tableIdentifier, now) -> mapped table tab`.
- Produces: `loadBootstrap(...).tableTabs` com todas as comandas da empresa necessárias à UI.
- Produces: pedidos de mesa novos com `tableTabId` persistido.

- [ ] **Step 1: Write RED tests for canonical reuse and bootstrap**

Em `worker/multiItemCheckoutRepository.test.js`, adicione cenários que criem dois pedidos locais de mesa com `value: 'a-01'` e `value: 'A-01'` e verifiquem que ambos recebem o mesmo `tableTabId`.

A asserção central deve ser:

```js
assert.equal(first.tableTabId, second.tableTabId)
assert.equal(db.tableTabs.filter((tab) => tab.status === 'open').length, 1)
assert.equal(db.tableTabs[0].table_identifier, 'A-01')
```

Adicione também um caso para garantir que `'04'` e `'4'` resultam em comandas diferentes.

Em `worker/repositories.test.js`, estenda o bootstrap esperado:

```js
assert.deepEqual(result.tableTabs, [{
  id: 'tab-1',
  tableIdentifier: '04',
  status: 'open',
  openedAt: '2026-09-02T18:00:00.000Z',
  closedAt: null,
}])
```

- [ ] **Step 2: Run the focused repository tests and verify RED**

Run:

```bash
node --test worker/multiItemCheckoutRepository.test.js worker/repositories.test.js
```

Expected: FAIL porque checkout ainda não cria/reutiliza `table_tabs` e bootstrap não retorna `tableTabs`.

- [ ] **Step 3: Implement identifier normalization and get-or-create**

Em `worker/repositories.js`:

```js
export const normalizeTableIdentifier = (value) => String(value ?? '').trim().toUpperCase()

export const getOrCreateOpenTableTab = async (db, businessId, rawIdentifier, now = new Date()) => {
  const tableIdentifier = normalizeTableIdentifier(rawIdentifier)
  let row = await db.prepare(`SELECT id, table_identifier, status, opened_at, closed_at
    FROM table_tabs WHERE business_id = ? AND table_identifier = ? AND status = 'open' LIMIT 1`)
    .bind(businessId, tableIdentifier).first()
  if (row) return mapTableTabRow(row)

  const id = crypto.randomUUID()
  const timestamp = now.toISOString()
  await db.prepare(`INSERT OR IGNORE INTO table_tabs
    (id, business_id, table_identifier, status, opened_at, closed_at, created_at, updated_at)
    VALUES (?, ?, ?, 'open', ?, NULL, ?, ?)`)
    .bind(id, businessId, tableIdentifier, timestamp, timestamp, timestamp).run()

  row = await db.prepare(`SELECT id, table_identifier, status, opened_at, closed_at
    FROM table_tabs WHERE business_id = ? AND table_identifier = ? AND status = 'open' LIMIT 1`)
    .bind(businessId, tableIdentifier).first()
  if (!row) throw repositoryError(500, 'TABLE_TAB_CREATE_FAILED', 'Não foi possível abrir a comanda da mesa.')
  return mapTableTabRow(row)
}
```

- [ ] **Step 4: Wire table-tab resolution into `createOrder`**

No ramo `customerIdentity.type === 'table'`:

```js
const tableTab = await getOrCreateOpenTableTab(db, businessId, customerIdentity.value, now)
clientSnapshot = `Mesa ${tableTab.tableIdentifier}`
tableTabId = tableTab.id
```

Inicialize antes dos ramos:

```js
let tableTabId = null
```

Inclua `table_tab_id` no `INSERT INTO orders` e o valor `tableTabId` no `.bind(...)` correspondente. Pedidos não-table devem persistir `NULL`.

- [ ] **Step 5: Add explicit `tableTabs` bootstrap collection**

Em `loadBootstrap` carregue:

```js
const tableTabsResult = await db.prepare(`SELECT id, table_identifier, status, opened_at, closed_at
  FROM table_tabs WHERE business_id = ? ORDER BY opened_at DESC`).bind(businessId).all()
```

E retorne:

```js
tableTabs: rows(tableTabsResult).map(mapTableTabRow),
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
node --test worker/multiItemCheckoutRepository.test.js worker/repositories.test.js worker/orderCustomerIdentityCheckout.test.js
```

Expected: PASS.

Commit:

```bash
git add worker/repositories.js worker/multiItemCheckoutRepository.test.js worker/repositories.test.js
git commit -m "feat: attach table orders to active tabs"
```

---

### Task 3: Pagamento consolidado e encerramento de comanda

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/index.js`
- Create: `worker/tableTabPayment.test.js`
- Modify: `worker/index.test.js`

**Interfaces:**
- Produces: `registerTableTabPayment(db, businessId, tableTabId, method, now) -> { tableTab, orders, movements }`.
- Produces: `closeTableTabIfSettled(db, businessId, tableTabId, now) -> table tab | null`.
- Produces: `POST /api/table-tabs/:id/payment` com body `{ method }`.

- [ ] **Step 1: Write RED repository tests for full-tab payment**

Crie `worker/tableTabPayment.test.js` com FakeDb equivalente ao padrão de `multiItemCheckoutRepository.test.js`, contendo uma comanda aberta com três pedidos, um deles já pago.

O teste principal deve verificar:

```js
const result = await registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', 'Pix', now)
assert.equal(result.orders.length, 2)
assert.equal(result.movements.length, 2)
assert.equal(result.tableTab.status, 'closed')
assert.equal(db.payments.length, 3) // 1 anterior + 2 novos
assert.equal(db.movements.filter((item) => item.source === 'order-payment').length, 3)
```

Adicione também:

```js
await assert.rejects(
  () => registerTableTabPayment(db, 'other-business', 'tab-1', 'Pix', now),
  (error) => error.code === 'TABLE_TAB_NOT_FOUND',
)
```

E retentativa em comanda fechada:

```js
await assert.rejects(
  () => registerTableTabPayment(db, 'amor-e-sabor', 'tab-closed', 'Pix', now),
  (error) => error.code === 'TABLE_TAB_ALREADY_CLOSED',
)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test worker/tableTabPayment.test.js
```

Expected: FAIL porque `registerTableTabPayment` não existe.

- [ ] **Step 3: Implement one atomic repository operation**

Em `worker/repositories.js`, implemente `registerTableTabPayment` seguindo este contrato:

```js
export const registerTableTabPayment = async (db, businessId, tableTabId, method, now = new Date()) => {
  const tabRow = await db.prepare(`SELECT id, table_identifier, status, opened_at, closed_at
    FROM table_tabs WHERE id = ? AND business_id = ? LIMIT 1`).bind(tableTabId, businessId).first()
  if (!tabRow) throw repositoryError(404, 'TABLE_TAB_NOT_FOUND', 'Comanda não encontrada.')
  if (tabRow.status !== 'open') throw repositoryError(409, 'TABLE_TAB_ALREADY_CLOSED', 'Esta comanda já foi encerrada.')

  const pendingResult = await db.prepare(`SELECT o.id, o.client_name_snapshot, o.total_cents
    FROM orders o LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id
    WHERE o.business_id = ? AND o.table_tab_id = ? AND p.id IS NULL
    ORDER BY o.created_at ASC`).bind(businessId, tableTabId).all()
  const pending = rows(pendingResult)
  if (!pending.length) {
    const timestamp = now.toISOString()
    await db.prepare(`UPDATE table_tabs SET status = 'closed', closed_at = ?, updated_at = ?
      WHERE id = ? AND business_id = ? AND status = 'open'`).bind(timestamp, timestamp, tableTabId, businessId).run()
    return { tableTab: mapTableTabRow({ ...tabRow, status: 'closed', closed_at: timestamp }), orders: [], movements: [] }
  }

  const paidAt = now.toISOString()
  const movementDate = businessDate(now)
  const statements = []
  const movementRows = []
  for (const order of pending) {
    const paymentId = crypto.randomUUID()
    const movementId = crypto.randomUUID()
    const description = `Pagamento pedido #${String(order.id).slice(-4)} · ${order.client_name_snapshot}`
    statements.push(db.prepare(`INSERT INTO payments (id, business_id, order_id, amount_cents, method, paid_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(paymentId, businessId, order.id, order.total_cents, method, paidAt, paidAt))
    statements.push(db.prepare(`INSERT INTO movements (id, business_id, type, category, description, value_cents, source, order_id, payment_id, movement_date, created_at)
      VALUES (?, ?, 'entrada', 'Vendas', ?, ?, 'order-payment', ?, ?, ?, ?)`)
      .bind(movementId, businessId, description, order.total_cents, order.id, paymentId, movementDate, paidAt))
    movementRows.push({ id: movementId, type: 'entrada', category: 'Vendas', description, value_cents: order.total_cents, source: 'order-payment', order_id: order.id, payment_id: paymentId, movement_date: movementDate, created_at: paidAt })
  }
  statements.push(db.prepare(`UPDATE table_tabs SET status = 'closed', closed_at = ?, updated_at = ?
    WHERE id = ? AND business_id = ? AND status = 'open'`).bind(paidAt, paidAt, tableTabId, businessId))
  await db.batch(statements)

  return {
    tableTab: mapTableTabRow({ ...tabRow, status: 'closed', closed_at: paidAt }),
    orders: await Promise.all(pending.map((order) => loadOrderById(db, businessId, order.id))),
    movements: movementRows.map(mapMovementRow),
  }
}
```

- [ ] **Step 4: Close tabs after legacy single-order payment**

Adicione:

```js
export const closeTableTabIfSettled = async (db, businessId, tableTabId, now = new Date()) => {
  if (!tableTabId) return null
  const pending = await db.prepare(`SELECT COUNT(*) AS count
    FROM orders o LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id
    WHERE o.business_id = ? AND o.table_tab_id = ? AND p.id IS NULL`).bind(businessId, tableTabId).first()
  if (Number(pending?.count || 0) > 0) return null
  const timestamp = now.toISOString()
  await db.prepare(`UPDATE table_tabs SET status = 'closed', closed_at = COALESCE(closed_at, ?), updated_at = ?
    WHERE id = ? AND business_id = ? AND status = 'open'`).bind(timestamp, timestamp, tableTabId, businessId).run()
  const row = await db.prepare(`SELECT id, table_identifier, status, opened_at, closed_at FROM table_tabs
    WHERE id = ? AND business_id = ? LIMIT 1`).bind(tableTabId, businessId).first()
  return row ? mapTableTabRow(row) : null
}
```

Faça `registerOrderPayment` carregar também `o.table_tab_id` e, após o batch, chame:

```js
await closeTableTabIfSettled(db, businessId, orderRow.table_tab_id, now)
```

- [ ] **Step 5: Add authenticated route**

Em `worker/index.js`, importe `registerTableTabPayment` e adicione antes do fallback 404:

```js
const tableTabPaymentMatch = url.pathname.match(/^\/api\/table-tabs\/([^/]+)\/payment$/)
if (tableTabPaymentMatch && request.method === 'POST') {
  assertSameOriginMutation(request)
  const { method } = await readJson(request)
  const result = await registerTableTabPayment(
    env.DB,
    session.businessId,
    decodeURIComponent(tableTabPaymentMatch[1]),
    validatePaymentMethod(method),
  )
  return json(result, { status: 201 })
}
```

- [ ] **Step 6: Add route tests and run GREEN**

Em `worker/index.test.js`, adicione um caso autenticado para `POST /api/table-tabs/tab-1/payment`, validando `Origin`, `method` e escopo de empresa, além de 404 para comanda de outra empresa.

Run:

```bash
node --test worker/tableTabPayment.test.js worker/index.test.js worker/orderRepositories.test.js
```

Expected: PASS.

Commit:

```bash
git add worker/repositories.js worker/index.js worker/tableTabPayment.test.js worker/index.test.js
git commit -m "feat: pay and close table tabs"
```

---

### Task 4: Encerrar comanda vazia ao remover o último pedido

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/orderRepositories.test.js`

**Interfaces:**
- Consumes: `closeTableTabIfSettled`.
- Produces: `deleteOrder` encerra a comanda se a exclusão deixar zero pedidos pendentes associados.

- [ ] **Step 1: Write RED delete test**

Em `worker/orderRepositories.test.js`, crie cenário com uma comanda aberta contendo um único pedido e verifique após `deleteOrder`:

```js
assert.equal(deleted, true)
assert.equal(db.tableTabs.find((tab) => tab.id === 'tab-1').status, 'closed')
```

E um segundo cenário com dois pedidos:

```js
assert.equal(db.tableTabs.find((tab) => tab.id === 'tab-1').status, 'open')
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test worker/orderRepositories.test.js
```

Expected: FAIL porque `deleteOrder` não considera `table_tab_id`.

- [ ] **Step 3: Preserve table-tab id and close only when settled**

Troque a leitura inicial de `deleteOrder` por:

```js
const existing = await db.prepare('SELECT id, table_tab_id FROM orders WHERE id = ? AND business_id = ? LIMIT 1')
  .bind(id, businessId).first()
```

Após o batch de exclusão:

```js
await closeTableTabIfSettled(db, businessId, existing.table_tab_id)
```

- [ ] **Step 4: Run GREEN and commit**

Run:

```bash
node --test worker/orderRepositories.test.js worker/tableTabPayment.test.js
```

Expected: PASS.

Commit:

```bash
git add worker/repositories.js worker/orderRepositories.test.js
git commit -m "fix: close empty table tabs"
```

---

### Task 5: Cliente API e estado `tableTabs` no App

**Files:**
- Modify: `src/api/client.js`
- Modify: `src/api/client.test.js`
- Modify: `src/App.jsx`
- Create: `src/tableTabsAppWiring.test.js`

**Interfaces:**
- Produces: `registerTableTabPayment(id, method)` em `src/api/client.js`.
- Produces: estado React `tableTabs` vindo de `bootstrap.tableTabs`.
- Produces: `NewOrder` recebe `tableTabs`; `Receivables` recebe `tableTabs` e callback `onRegisterTableTabPayment`.

- [ ] **Step 1: Write RED API and wiring tests**

Em `src/api/client.test.js`, importe `registerTableTabPayment` e acrescente:

```js
await registerTableTabPayment('tab 1', 'Pix')
assert.deepEqual(calls.at(-1).slice(0, 2), [
  '/api/table-tabs/tab%201/payment',
  expectPostEquivalent,
])
```

Use o padrão atual do arquivo para validar `method === 'POST'` e body:

```js
assert.deepEqual(JSON.parse(calls.at(-1)[1].body), { method: 'Pix' })
```

Crie `src/tableTabsAppWiring.test.js` com leitura estática do `App.jsx` e verifique:

```js
assert.match(source, /const \[tableTabs, setTableTabs\] = useState\(\[\]\)/)
assert.match(source, /setTableTabs\(Array\.isArray\(data\?\.tableTabs\) \? data\.tableTabs : \[\]\)/)
assert.match(source, /<NewOrder[\s\S]*tableTabs=\{tableTabs\}/)
assert.match(source, /<Receivables[\s\S]*tableTabs=\{tableTabs\}/)
assert.match(source, /onRegisterTableTabPayment=/)
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test src/api/client.test.js src/tableTabsAppWiring.test.js
```

Expected: FAIL porque helper/estado/props ainda não existem.

- [ ] **Step 3: Add API helper**

Em `src/api/client.js`:

```js
export const registerTableTabPayment = (id, method) => apiRequest(
  `/api/table-tabs/${encodeURIComponent(id)}/payment`,
  withJson('POST', { method }),
)
```

- [ ] **Step 4: Add `tableTabs` state and bootstrap wiring**

Em `App.jsx`:

```js
const [tableTabs, setTableTabs] = useState([])
```

Em `clearBusinessData`:

```js
setTableTabs([])
```

Em `applyBootstrap`:

```js
setTableTabs(Array.isArray(data?.tableTabs) ? data.tableTabs : [])
```

Passe `tableTabs={tableTabs}` para `NewOrder` e `Receivables`.

- [ ] **Step 5: Add App handler for consolidated payment**

Importe o helper como `registerTableTabPaymentApi` e implemente:

```js
const handleRegisterTableTabPayment = async (tableTabId, method) => {
  if (writesBlocked) return false
  setRequestKey(`table-tab:payment:${tableTabId}`)
  try {
    const result = await registerTableTabPaymentApi(tableTabId, method)
    setOrders((current) => current.map((item) => result.orders.find((order) => order.id === item.id) ?? item))
    setMovements((current) => {
      const existingIds = new Set(current.map((item) => item.id))
      return [...result.movements.filter((item) => !existingIds.has(item.id)), ...current]
    })
    setTableTabs((current) => current.map((tab) => tab.id === result.tableTab.id ? result.tableTab : tab))
    showSuccessMessage(`Pagamento da Mesa ${result.tableTab.tableIdentifier} recebido via ${method}`)
    return true
  } catch (error) {
    showApiError(error)
    return false
  } finally {
    setRequestKey(null)
  }
}
```

Passe:

```jsx
<Receivables
  orders={orders}
  tableTabs={tableTabs}
  currency={currency}
  onRegisterPayment={openPaymentModal}
  onRegisterTableTabPayment={handleRegisterTableTabPayment}
/>
```

- [ ] **Step 6: Run GREEN and commit**

Run:

```bash
node --test src/api/client.test.js src/tableTabsAppWiring.test.js
```

Expected: PASS.

Commit:

```bash
git add src/api/client.js src/api/client.test.js src/App.jsx src/tableTabsAppWiring.test.js
git commit -m "feat: wire table tabs into app state"
```

---

### Task 6: Agrupamento e cobrança de comanda em A Receber

**Files:**
- Modify: `src/utils/receivables.js`
- Modify: `src/utils/receivables.test.js`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/receivables.css`
- Create: `src/tableTabReceivablesUi.test.js`

**Interfaces:**
- Consumes: `order.tableTabId`, `tableTabs`, `onRegisterTableTabPayment(tableTabId, method)`.
- Produces: grupos de mesa com `kind: 'table_tab'`, `tableTabId` e label `Mesa XX`.
- Produces: modal de pagamento no nível da comanda.

- [ ] **Step 1: Replace the old table-isolated expectation with RED tab grouping tests**

Em `src/utils/receivables.test.js`, mantenha guest names independentes e substitua a parte de mesa por:

```js
test('table orders group only when they share the same table tab id', () => {
  const groups = groupPendingOrders([
    order('o1', { clientId: null, client: 'Mesa 04', customerIdentityType: 'table', tableTabId: 'tab-1', total: 20 }),
    order('o2', { clientId: null, client: 'Mesa 04', customerIdentityType: 'table', tableTabId: 'tab-1', total: 30 }),
    order('o3', { clientId: null, client: 'Mesa 04', customerIdentityType: 'table', tableTabId: null, total: 10 }),
  ])
  assert.equal(groups.length, 2)
  const tab = groups.find((group) => group.tableTabId === 'tab-1')
  assert.equal(tab.kind, 'table_tab')
  assert.equal(tab.orders.length, 2)
  assert.equal(tab.total, 50)
})
```

Mantenha teste separado garantindo que dois `guest_name` iguais geram dois grupos.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test src/utils/receivables.test.js
```

Expected: FAIL porque `groupPendingOrders` ainda usa `order:${id}` para toda mesa.

- [ ] **Step 3: Implement group key and metadata**

Em `src/utils/receivables.js`:

```js
const isTableTabOrder = (order) => order?.customerIdentityType === 'table' && Boolean(order?.tableTabId)

const groupKey = (order) => {
  if (isRegisteredClientOrder(order)) return `client:${order.clientId}`
  if (isTableTabOrder(order)) return `table-tab:${order.tableTabId}`
  return `order:${order?.id}`
}
```

Ao criar o grupo:

```js
kind: isTableTabOrder(order) ? 'table_tab' : isRegisteredClientOrder(order) ? 'registered_client' : 'order',
tableTabId: isTableTabOrder(order) ? order.tableTabId : null,
```

- [ ] **Step 4: Write RED UI test for one tab-level payment action**

Crie `src/tableTabReceivablesUi.test.js` lendo `Receivables.jsx` e verifique:

```js
assert.match(source, /Registrar pagamento da comanda/)
assert.match(source, /group\.kind === 'table_tab'/)
assert.match(source, /onRegisterTableTabPayment/)
assert.match(source, /todos os pedidos pendentes/i)
```

E certifique que no ramo de `table_tab` não há botão individual por pedido.

- [ ] **Step 5: Implement the tab-level payment modal**

Em `Receivables.jsx`, adicione estado:

```js
const [tableTabPaymentGroup, setTableTabPaymentGroup] = useState(null)
const [tableTabPaymentMethod, setTableTabPaymentMethod] = useState('Pix')
```

Aceite props:

```js
function Receivables({ orders, tableTabs = [], currency, onRegisterPayment, onRegisterTableTabPayment })
```

No card de cada grupo:

```jsx
{group.kind === 'table_tab' && (
  <Button
    onClick={() => setTableTabPaymentGroup(group)}
    disabled={writeDisabled}
  >
    Registrar pagamento da comanda
  </Button>
)}
```

Nos pedidos internos, mostre `Ver detalhes` sempre, mas renderize `Registrar pagamento` individual somente quando:

```js
group.kind !== 'table_tab'
```

O modal deve mostrar label, quantidade e total, `SystemSelect` com as mesmas opções de forma de pagamento do App ou uma constante compartilhada extraída para `src/utils/paymentMethods.js` se necessário para evitar duplicação.

Ao confirmar:

```js
const success = await onRegisterTableTabPayment(tableTabPaymentGroup.tableTabId, tableTabPaymentMethod)
if (success) setTableTabPaymentGroup(null)
```

- [ ] **Step 6: Add responsive styling and run GREEN**

Em `src/receivables.css`, mantenha a lista interna legível e o botão de cobrança da comanda no header/footer do card, não repetido por pedido.

Run:

```bash
node --test src/utils/receivables.test.js src/tableTabReceivablesUi.test.js
```

Expected: PASS.

Commit:

```bash
git add src/utils/receivables.js src/utils/receivables.test.js src/pages/Receivables.jsx src/receivables.css src/tableTabReceivablesUi.test.js
git commit -m "feat: collect table tabs in receivables"
```

---

### Task 7: Contexto de comanda aberta no Novo Pedido

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/new-order.css`
- Create: `src/tableTabNewOrderUi.test.js`

**Interfaces:**
- Consumes: `tableTabs` bootstrap collection.
- Produces: mensagem informativa `Mesa XX · comanda aberta` quando a mesa digitada já possui uma comanda `open`.
- Não produz nem envia `tableTabId` no payload.

- [ ] **Step 1: Write RED UI contract**

Crie `src/tableTabNewOrderUi.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')

test('new order shows active table tab context without sending a tab id', () => {
  assert.match(source, /tableTabs/)
  assert.match(source, /comanda aberta/)
  assert.doesNotMatch(source, /customerIdentity:[\s\S]*tableTabId/)
})
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test src/tableTabNewOrderUi.test.js
```

Expected: FAIL porque `NewOrder` ainda não recebe `tableTabs`.

- [ ] **Step 3: Resolve current open tab client-side only for feedback**

Altere assinatura:

```js
function NewOrder({ clients, products, tableTabs = [], currency, disabled, onCancel, onCreateClient, onSubmit })
```

Calcule:

```js
const normalizedLocalTable = localIdentityType === 'table' ? localIdentityValue.trim().toUpperCase() : ''
const openTableTab = normalizedLocalTable
  ? tableTabs.find((tab) => tab.status === 'open' && tab.tableIdentifier === normalizedLocalTable) ?? null
  : null
const openTableTabOrderCount = openTableTab
  ? 0 // não usar este valor; receber contagem abaixo via prop derivada ou remover contagem da copy
  : 0
```

Para manter YAGNI e não cruzar `orders` na página, use copy sem contagem nesta rodada:

```jsx
{openTableTab && (
  <div className="new-order-table-tab-hint" role="status">
    Mesa {openTableTab.tableIdentifier} · comanda aberta. Este pedido será adicionado automaticamente.
  </div>
)}
```

Importante: não adicionar `tableTabId` em `draft`, `buildOrderPayload` ou `customerIdentity`.

- [ ] **Step 4: Style and run GREEN**

Em `src/new-order.css`, use superfície informativa discreta com tokens de tema e sem competir com erros.

Run:

```bash
node --test src/tableTabNewOrderUi.test.js src/newOrderLocalIdentityUi.test.js src/orderPayloadIdentity.test.js
```

Expected: PASS.

Commit:

```bash
git add src/pages/NewOrder.jsx src/new-order.css src/tableTabNewOrderUi.test.js
git commit -m "feat: show active table tab context"
```

---

### Task 8: Feedback visual forte de seleção no ProductForm

**Files:**
- Modify: `src/components/ProductForm.jsx`
- Modify: `src/product-form.css`
- Create: `src/productSelectionFeedback.test.js`

**Interfaces:**
- Consumes: classes `.selected` e `aria-pressed` existentes.
- Produces: check visual em Categoria, Apresentação, Tamanho e Unidade sem alterar os valores enviados.

- [ ] **Step 1: Write RED visual contract test**

Crie `src/productSelectionFeedback.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const form = fs.readFileSync(new URL('./components/ProductForm.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('./product-form.css', import.meta.url), 'utf8')

test('selected product controls have non-color feedback and strong visual contrast', () => {
  assert.match(form, /product-selection-check/)
  assert.match(form, /aria-hidden="true"/)
  assert.match(css, /\.product-selection-check/)
  assert.match(css, /\.product-category-option\.selected[\s\S]*box-shadow/)
  assert.match(css, /\.product-presentation-option\.selected[\s\S]*box-shadow/)
  assert.match(css, /\.product-size-option\.selected[\s\S]*box-shadow/)
  assert.match(css, /\.product-unit-option\.selected[\s\S]*box-shadow/)
})
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test src/productSelectionFeedback.test.js
```

Expected: FAIL porque não existe check e o estado visual ainda depende basicamente de cor/borda.

- [ ] **Step 3: Add a reusable check indicator inside selected buttons**

No `ProductForm`, em cada um dos quatro grupos, adicione ao conteúdo do botão:

```jsx
{selected && (
  <span className="product-selection-check" aria-hidden="true">
    <Icon name="check" size={13} />
  </span>
)}
```

Para os grupos que hoje usam expressão inline, crie `const selected = ...` dentro do `.map(...)` antes do `return`, preservando exatamente os `onClick`, valores e `aria-pressed` atuais.

Se `Icon` ainda não possuir `check`, adicione somente esse glyph em `src/components/Icon.jsx` e cubra no teste existente de ícones.

- [ ] **Step 4: Strengthen selected styles**

Em `src/product-form.css`, deixe os botões `position: relative` e adicione um estado selecionado com preenchimento forte, borda e contorno. Use somente tokens existentes do tema; exemplo de estrutura:

```css
.product-category-option,
.product-presentation-option,
.product-size-option,
.product-unit-option {
  position: relative;
}

.product-category-option.selected,
.product-presentation-option.selected,
.product-size-option.selected,
.product-unit-option.selected {
  border-width: 2px;
  border-color: var(--brand-primary);
  background: var(--brand-primary);
  color: var(--text-on-brand);
  box-shadow: 0 0 0 2px var(--brand-soft);
  font-weight: 700;
}

.product-selection-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: auto;
  border-radius: 999px;
  background: currentColor;
}

.product-selection-check svg {
  color: var(--surface-primary);
}
```

Antes de usar `--text-on-brand` ou `--surface-primary`, confirme em `src/App.css`/tokens existentes; se algum não existir, reutilize um token já definido em vez de criar cor hard-coded.

- [ ] **Step 5: Run GREEN and commit**

Run:

```bash
node --test src/productSelectionFeedback.test.js src/productCatalogUi.test.js
npm run lint
```

Expected: PASS, 0 lint errors.

Commit:

```bash
git add src/components/ProductForm.jsx src/components/Icon.jsx src/product-form.css src/productSelectionFeedback.test.js
git commit -m "fix: make product selections unmistakable"
```

---

### Task 9: Regressão integrada, migrations e entrega

**Files:**
- Modify: `src/catalogLocalOrdersIntegration.test.js` somente se o contrato integrado precisar incluir `tableTabId/tableTabs`.
- No production code should be added in this task unless a regression discovered by the checks requires a focused fix with its own failing test.

**Interfaces:**
- Verifica todos os contratos produzidos nas Tasks 1–8.

- [ ] **Step 1: Add one integrated guard for the full table-tab flow**

Em `src/catalogLocalOrdersIntegration.test.js`, acrescente verificações estáticas que garantam simultaneamente:

```js
assert.match(repositories, /table_tab_id/)
assert.match(repositories, /getOrCreateOpenTableTab/)
assert.match(receivables, /table_tab/)
assert.match(app, /tableTabs/)
assert.match(newOrder, /comanda aberta/)
```

- [ ] **Step 2: Run the complete test suite**

Run:

```bash
npm test
```

Expected: todos os testes PASS.

- [ ] **Step 3: Run lint and production build**

Run:

```bash
npm run lint
npm run build
```

Expected: 0 lint errors; Vite build succeeds.

- [ ] **Step 4: Validate Worker bundle**

Run:

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: Worker bundle succeeds and binds `amor-e-sabor-delivery`.

- [ ] **Step 5: Validate migrations locally from a clean D1 state**

Run the repository's existing local migration command/path used by CI, then confirm `0007_table_tabs.sql` applies after `0006_order_customer_identity.sql` without destructive changes.

Expected: all migrations apply successfully and the partial unique index is created.

- [ ] **Step 6: Manual acceptance pass**

Execute no app local/preview:

```text
1. Novo Pedido > Consumo no local > Mesa > 04 cria o primeiro pedido.
2. Novo pedido para Mesa 04 mostra “comanda aberta” e entra na mesma comanda.
3. A Receber mostra uma única Mesa 04 com 2 pedidos e total somado.
4. Não existe botão individual de pagamento dentro dessa comanda.
5. “Registrar pagamento da comanda” com Pix quita os 2 pedidos e remove o saldo de A Receber.
6. Novo pedido para Mesa 04 depois do pagamento cria uma nova comanda.
7. Pedido legado de Mesa 04 sem tableTabId permanece isolado.
8. Nome avulso repetido continua isolado.
9. Cliente cadastrado continua agrupado por clientId.
10. Excluir o único pedido de uma comanda fecha a comanda vazia.
11. Categoria, Apresentação, Tamanho e Unidade mostram fundo forte + borda + check quando selecionados em desktop e mobile.
```

- [ ] **Step 7: Commit any final test-only guard**

```bash
git add src/catalogLocalOrdersIntegration.test.js
git commit -m "test: guard table tab integration"
```

- [ ] **Step 8: Final branch review before integration**

Run:

```bash
git diff master...HEAD --stat
git diff master...HEAD -- . ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*'
```

Expected: changes limited to migration, Worker checkout/payment/bootstrap, App/API wiring, Receivables/NewOrder, selection feedback and their tests.

- [ ] **Step 9: Integration and production deployment only after approval/checkpoint**

After final verification, fast-forward/merge the feature branch into `master` using the project workflow. Then run `.github/workflows/deploy-production.yml`, which must execute tests, lint, build, Worker dry-run, show/apply D1 migration `0007_table_tabs.sql`, verify the auth row and deploy the Worker.

Expected: production workflow succeeds before declaring the round complete.
