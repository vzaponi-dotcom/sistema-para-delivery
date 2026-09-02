# Comandas por Mesa e Feedback Visual de Seleção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma comanda persistente por mesa, cobrar todos os pedidos pendentes dessa comanda em uma única ação e tornar inequívoco o estado visual selecionado no formulário de produtos.

**Architecture:** Adicionar `table_tabs` no D1 e `orders.table_tab_id`; o Worker resolve ou cria a comanda autoritativamente a partir da empresa autenticada e do identificador canônico da mesa. O bootstrap expõe `tableTabs`; `A Receber` agrupa por `tableTabId` e chama um endpoint dedicado de pagamento consolidado, mantendo pagamentos e movimentos individuais por pedido. O ajuste visual reutiliza `.selected`, `aria-pressed` e o ícone `check` já existente.

**Tech Stack:** React, JavaScript ES modules, Node test runner (`node --test`), Cloudflare Workers, D1/SQLite, Wrangler 4.128.0, Vite, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-02-table-tabs-selection-feedback-design.md`

## Global Constraints

- Uma mesa pode ter no máximo uma comanda `open` por empresa.
- O frontend nunca envia `tableTabId` autoritativo no checkout.
- Identificador canônico: `trim().toUpperCase()`; preservar zeros à esquerda, portanto `04 !== 4`.
- Pedidos históricos de mesa sem `table_tab_id` continuam independentes; não fazer backfill por texto.
- Entrega, Retirada, Nome e Cliente cadastrado preservam o comportamento atual.
- O pagamento da comanda quita todos os pedidos ainda pendentes em uma ação de UI, mantendo um `payment` e um movimento `order-payment` por pedido.
- Pedidos já pagos não recebem segundo pagamento; comanda fechada não gera nova cobrança.
- Remover o último pedido deve encerrar a comanda vazia.
- Fora de escopo: pagamento parcial, divisão de conta, transferência de mesa, juntar/separar comandas, mapa de mesas e duas comandas simultâneas na mesma mesa.
- Categoria, Apresentação, Tamanho e Unidade mantêm `aria-pressed` e ganham fundo preenchido, borda/contorno e check visível.
- Nenhuma nova dependência.

---

### Task 1: Schema e mappers de comanda

**Files:**
- Create: `migrations/0007_table_tabs.sql`
- Modify: `worker/repositories.js`
- Create: `worker/tableTabsMigration.test.js`
- Modify: `worker/orderIdentityRepositoryMapping.test.js`

**Interfaces:**
- Produces: `mapTableTabRow(row) -> { id, tableIdentifier, status, openedAt, closedAt }`.
- Produces: `order.tableTabId: string | null`.

- [ ] **Step 1: Write RED tests**

Crie `worker/tableTabsMigration.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql = fs.readFileSync(new URL('../migrations/0007_table_tabs.sql', import.meta.url), 'utf8')

test('table tabs migration is additive and allows only one open tab per table', () => {
  assert.match(sql, /CREATE TABLE table_tabs/i)
  assert.match(sql, /table_identifier TEXT NOT NULL/i)
  assert.match(sql, /ALTER TABLE orders ADD COLUMN table_tab_id TEXT/i)
  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*business_id[\s\S]*table_identifier[\s\S]*WHERE status = 'open'/i)
  assert.doesNotMatch(sql, /UPDATE orders[\s\S]*client_name_snapshot/i)
})
```

Em `worker/orderIdentityRepositoryMapping.test.js`, importe `mapTableTabRow`, passe `table_tab_id: 'tab-1'` para `mapOrderRow` e exija:

```js
assert.equal(mapped.tableTabId, 'tab-1')
assert.deepEqual(mapTableTabRow({
  id: 'tab-1', table_identifier: '04', status: 'open',
  opened_at: '2026-09-02T18:00:00.000Z', closed_at: null,
}), {
  id: 'tab-1', tableIdentifier: '04', status: 'open',
  openedAt: '2026-09-02T18:00:00.000Z', closedAt: null,
})
```

- [ ] **Step 2: Verify RED**

```bash
node --test worker/tableTabsMigration.test.js worker/orderIdentityRepositoryMapping.test.js
```

Expected: FAIL por migration/mapper/campo inexistentes.

- [ ] **Step 3: Add migration**

`migrations/0007_table_tabs.sql`:

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

- [ ] **Step 4: Map rows**

Em `worker/repositories.js`:

```js
export const mapTableTabRow = (row) => ({
  id: row.id,
  tableIdentifier: row.table_identifier,
  status: row.status,
  openedAt: row.opened_at,
  closedAt: row.closed_at ?? null,
})
```

Adicione `o.table_tab_id` ao `orderSelect` e em `mapOrderRow`:

```js
tableTabId: row.table_tab_id ?? null,
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
node --test worker/tableTabsMigration.test.js worker/orderIdentityRepositoryMapping.test.js
git add migrations/0007_table_tabs.sql worker/repositories.js worker/tableTabsMigration.test.js worker/orderIdentityRepositoryMapping.test.js
git commit -m "feat: add persistent table tabs"
```

---

### Task 2: Resolver/reutilizar comanda no checkout e expor no bootstrap

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/multiItemCheckoutRepository.test.js`
- Modify: `worker/repositories.test.js`

**Interfaces:**
- Produces: `normalizeTableIdentifier(value) -> string`.
- Produces: `getOrCreateOpenTableTab(db, businessId, tableIdentifier, now) -> table tab`.
- Produces: `loadBootstrap(...).tableTabs`.

- [ ] **Step 1: Write RED repository tests**

Em `worker/multiItemCheckoutRepository.test.js`, crie dois pedidos `Local/table` usando `a-01` e `A-01` e exija:

```js
assert.equal(first.tableTabId, second.tableTabId)
assert.equal(db.tableTabs.filter((tab) => tab.status === 'open').length, 1)
assert.equal(db.tableTabs[0].table_identifier, 'A-01')
```

Adicione caso independente para `'04'` e `'4'`:

```js
assert.notEqual(order04.tableTabId, order4.tableTabId)
```

Em `worker/repositories.test.js`, faça o bootstrap fake retornar uma row de `table_tabs` e exija:

```js
assert.deepEqual(result.tableTabs, [{
  id: 'tab-1', tableIdentifier: '04', status: 'open',
  openedAt: '2026-09-02T18:00:00.000Z', closedAt: null,
}])
```

- [ ] **Step 2: Verify RED**

```bash
node --test worker/multiItemCheckoutRepository.test.js worker/repositories.test.js
```

Expected: FAIL porque não há criação/reuso nem bootstrap de comandas.

- [ ] **Step 3: Implement canonical get-or-create**

Em `worker/repositories.js`:

```js
export const normalizeTableIdentifier = (value) => String(value ?? '').trim().toUpperCase()

export const getOrCreateOpenTableTab = async (db, businessId, rawIdentifier, now = new Date()) => {
  const tableIdentifier = normalizeTableIdentifier(rawIdentifier)
  const selectOpen = () => db.prepare(`SELECT id, table_identifier, status, opened_at, closed_at
    FROM table_tabs WHERE business_id = ? AND table_identifier = ? AND status = 'open' LIMIT 1`)
    .bind(businessId, tableIdentifier).first()

  let row = await selectOpen()
  if (row) return mapTableTabRow(row)

  const id = crypto.randomUUID()
  const timestamp = now.toISOString()
  await db.prepare(`INSERT OR IGNORE INTO table_tabs
    (id, business_id, table_identifier, status, opened_at, closed_at, created_at, updated_at)
    VALUES (?, ?, ?, 'open', ?, NULL, ?, ?)`)
    .bind(id, businessId, tableIdentifier, timestamp, timestamp, timestamp).run()

  row = await selectOpen()
  if (!row) throw repositoryError(500, 'TABLE_TAB_CREATE_FAILED', 'Não foi possível abrir a comanda da mesa.')
  return mapTableTabRow(row)
}
```

- [ ] **Step 4: Attach new table orders**

Em `createOrder`, inicialize:

```js
let tableTabId = null
```

No ramo `table`:

```js
const tableTab = await getOrCreateOpenTableTab(db, businessId, customerIdentity.value, now)
clientSnapshot = `Mesa ${tableTab.tableIdentifier}`
tableTabId = tableTab.id
```

Inclua `table_tab_id` no `INSERT INTO orders` e `tableTabId` no `.bind(...)`. Os demais tipos gravam `NULL`.

- [ ] **Step 5: Add explicit bootstrap collection**

Em `loadBootstrap`:

```js
const tableTabsResult = await db.prepare(`SELECT id, table_identifier, status, opened_at, closed_at
  FROM table_tabs WHERE business_id = ? ORDER BY opened_at DESC`).bind(businessId).all()
```

Retorne:

```js
tableTabs: rows(tableTabsResult).map(mapTableTabRow),
```

- [ ] **Step 6: Verify GREEN and commit**

```bash
node --test worker/multiItemCheckoutRepository.test.js worker/repositories.test.js worker/orderCustomerIdentityCheckout.test.js
git add worker/repositories.js worker/multiItemCheckoutRepository.test.js worker/repositories.test.js
git commit -m "feat: attach table orders to active tabs"
```

---

### Task 3: Pagamento consolidado de comanda

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/index.js`
- Create: `worker/tableTabPayment.test.js`
- Modify: `worker/index.test.js`

**Interfaces:**
- Produces: `registerTableTabPayment(db, businessId, tableTabId, method, now) -> { tableTab, orders, movements }`.
- Produces: `closeTableTabIfSettled(db, businessId, tableTabId, now) -> table tab | null`.
- Produces: `POST /api/table-tabs/:id/payment` body `{ method }`.

- [ ] **Step 1: Write RED payment tests**

Crie `worker/tableTabPayment.test.js` no padrão dos FakeDb atuais. Cenário principal: comanda aberta com 3 pedidos, 1 já pago. Após:

```js
const result = await registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', 'Pix', now)
```

exija:

```js
assert.equal(result.orders.length, 2)
assert.equal(result.movements.length, 2)
assert.equal(result.tableTab.status, 'closed')
assert.equal(db.payments.length, 3)
assert.equal(db.movements.filter((item) => item.source === 'order-payment').length, 3)
```

Escopo e retentativa:

```js
await assert.rejects(
  () => registerTableTabPayment(db, 'other-business', 'tab-1', 'Pix', now),
  (error) => error.code === 'TABLE_TAB_NOT_FOUND',
)
await assert.rejects(
  () => registerTableTabPayment(db, 'amor-e-sabor', 'tab-closed', 'Pix', now),
  (error) => error.code === 'TABLE_TAB_ALREADY_CLOSED',
)
```

- [ ] **Step 2: Verify RED**

```bash
node --test worker/tableTabPayment.test.js
```

- [ ] **Step 3: Implement atomic multi-order payment**

Em `registerTableTabPayment`:

```js
const tabRow = await db.prepare(`SELECT id, table_identifier, status, opened_at, closed_at
  FROM table_tabs WHERE id = ? AND business_id = ? LIMIT 1`).bind(tableTabId, businessId).first()
if (!tabRow) throw repositoryError(404, 'TABLE_TAB_NOT_FOUND', 'Comanda não encontrada.')
if (tabRow.status !== 'open') throw repositoryError(409, 'TABLE_TAB_ALREADY_CLOSED', 'Esta comanda já foi encerrada.')

const pendingResult = await db.prepare(`SELECT o.id, o.client_name_snapshot, o.total_cents
  FROM orders o LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id
  WHERE o.business_id = ? AND o.table_tab_id = ? AND p.id IS NULL
  ORDER BY o.created_at ASC`).bind(businessId, tableTabId).all()
```

Para cada row pendente, monte dois statements (payment + movement) com os mesmos campos de `registerOrderPayment`; acrescente ao mesmo `db.batch` o fechamento:

```js
db.prepare(`UPDATE table_tabs SET status = 'closed', closed_at = ?, updated_at = ?
  WHERE id = ? AND business_id = ? AND status = 'open'`).bind(paidAt, paidAt, tableTabId, businessId)
```

Após o batch, retorne:

```js
return {
  tableTab: mapTableTabRow({ ...tabRow, status: 'closed', closed_at: paidAt }),
  orders: await Promise.all(pending.map((order) => loadOrderById(db, businessId, order.id))),
  movements: movementRows.map(mapMovementRow),
}
```

Se `pending.length === 0`, feche a comanda sem criar pagamentos/movimentos e retorne arrays vazios.

- [ ] **Step 4: Close tab after legacy single-order payment**

Implemente:

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

Faça `registerOrderPayment` selecionar `o.table_tab_id` e chamar:

```js
await closeTableTabIfSettled(db, businessId, orderRow.table_tab_id, now)
```

- [ ] **Step 5: Add route**

Em `worker/index.js`, importe `registerTableTabPayment` e adicione:

```js
const tableTabPaymentMatch = url.pathname.match(/^\/api\/table-tabs\/([^/]+)\/payment$/)
if (tableTabPaymentMatch && request.method === 'POST') {
  assertSameOriginMutation(request)
  const { method } = await readJson(request)
  const result = await registerTableTabPayment(
    env.DB, session.businessId, decodeURIComponent(tableTabPaymentMatch[1]), validatePaymentMethod(method),
  )
  return json(result, { status: 201 })
}
```

- [ ] **Step 6: Route GREEN and commit**

Adicione em `worker/index.test.js` o POST autenticado, validação de `Origin`, método e escopo.

```bash
node --test worker/tableTabPayment.test.js worker/index.test.js worker/orderRepositories.test.js
git add worker/repositories.js worker/index.js worker/tableTabPayment.test.js worker/index.test.js
git commit -m "feat: pay and close table tabs"
```

---

### Task 4: Fechar comanda vazia ao excluir o último pedido

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/orderRepositories.test.js`

**Interfaces:**
- Consumes: `closeTableTabIfSettled`.

- [ ] **Step 1: Write RED delete tests**

Comanda com um pedido:

```js
assert.equal(await deleteOrder(db, 'amor-e-sabor', 'o1'), true)
assert.equal(db.tableTabs.find((tab) => tab.id === 'tab-1').status, 'closed')
```

Comanda com dois pedidos, removendo só um:

```js
assert.equal(db.tableTabs.find((tab) => tab.id === 'tab-1').status, 'open')
```

- [ ] **Step 2: Verify RED**

```bash
node --test worker/orderRepositories.test.js
```

- [ ] **Step 3: Preserve tab id on delete and close if settled**

Use:

```js
const existing = await db.prepare('SELECT id, table_tab_id FROM orders WHERE id = ? AND business_id = ? LIMIT 1')
  .bind(id, businessId).first()
```

Depois do batch de exclusão:

```js
await closeTableTabIfSettled(db, businessId, existing.table_tab_id)
```

- [ ] **Step 4: Verify GREEN and commit**

```bash
node --test worker/orderRepositories.test.js worker/tableTabPayment.test.js
git add worker/repositories.js worker/orderRepositories.test.js
git commit -m "fix: close empty table tabs"
```

---

### Task 5: API frontend e estado `tableTabs` no App

**Files:**
- Modify: `src/api/client.js`
- Modify: `src/api/client.test.js`
- Modify: `src/App.jsx`
- Create: `src/tableTabsAppWiring.test.js`

**Interfaces:**
- Produces: `registerTableTabPayment(id, method)`.
- Produces: estado React `tableTabs` e props para `NewOrder`/`Receivables`.

- [ ] **Step 1: Write RED API test**

Importe `registerTableTabPayment` em `src/api/client.test.js`. Dentro do `withFetch`, execute:

```js
await registerTableTabPayment('tab 1', 'Pix')
```

Depois:

```js
const [path, options] = calls.at(-1)
assert.equal(path, '/api/table-tabs/tab%201/payment')
assert.equal(options.method, 'POST')
assert.deepEqual(JSON.parse(options.body), { method: 'Pix' })
```

Crie `src/tableTabsAppWiring.test.js` lendo `App.jsx`:

```js
assert.match(source, /const \[tableTabs, setTableTabs\] = useState\(\[\]\)/)
assert.match(source, /setTableTabs\(Array\.isArray\(data\?\.tableTabs\) \? data\.tableTabs : \[\]\)/)
assert.match(source, /<NewOrder[\s\S]*tableTabs=\{tableTabs\}/)
assert.match(source, /<Receivables[\s\S]*tableTabs=\{tableTabs\}/)
assert.match(source, /onRegisterTableTabPayment=/)
```

- [ ] **Step 2: Verify RED**

```bash
node --test src/api/client.test.js src/tableTabsAppWiring.test.js
```

- [ ] **Step 3: Add API helper**

`src/api/client.js`:

```js
export const registerTableTabPayment = (id, method) => apiRequest(
  `/api/table-tabs/${encodeURIComponent(id)}/payment`,
  withJson('POST', { method }),
)
```

- [ ] **Step 4: Wire bootstrap state**

Em `App.jsx`:

```js
const [tableTabs, setTableTabs] = useState([])
```

`clearBusinessData`:

```js
setTableTabs([])
```

`applyBootstrap`:

```js
setTableTabs(Array.isArray(data?.tableTabs) ? data.tableTabs : [])
```

Passe `tableTabs={tableTabs}` para `NewOrder` e `Receivables`.

- [ ] **Step 5: Add consolidated payment handler**

Importe o helper como `registerTableTabPaymentApi` e implemente:

```js
const handleRegisterTableTabPayment = async (tableTabId, method) => {
  if (writesBlocked) return false
  setRequestKey(`table-tab:payment:${tableTabId}`)
  try {
    const result = await registerTableTabPaymentApi(tableTabId, method)
    setOrders((current) => current.map((item) => result.orders.find((order) => order.id === item.id) ?? item))
    setMovements((current) => {
      const ids = new Set(current.map((item) => item.id))
      return [...result.movements.filter((item) => !ids.has(item.id)), ...current]
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

Passe `onRegisterTableTabPayment={handleRegisterTableTabPayment}` para `Receivables`.

- [ ] **Step 6: Verify GREEN and commit**

```bash
node --test src/api/client.test.js src/tableTabsAppWiring.test.js
git add src/api/client.js src/api/client.test.js src/App.jsx src/tableTabsAppWiring.test.js
git commit -m "feat: wire table tabs into app state"
```

---

### Task 6: Agrupar e cobrar comanda em A Receber

**Files:**
- Modify: `src/utils/receivables.js`
- Modify: `src/utils/receivables.test.js`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/receivables.css`
- Create: `src/tableTabReceivablesUi.test.js`

**Interfaces:**
- Produces: grupo `{ kind: 'table_tab', tableTabId, orders, total, label }`.

- [ ] **Step 1: Write RED grouping test**

Em `src/utils/receivables.test.js`:

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

Mantenha teste de nomes avulsos repetidos como grupos independentes.

- [ ] **Step 2: Verify RED**

```bash
node --test src/utils/receivables.test.js
```

- [ ] **Step 3: Implement group semantics**

`src/utils/receivables.js`:

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

- [ ] **Step 4: Write RED UI contract**

Crie `src/tableTabReceivablesUi.test.js`:

```js
assert.match(source, /Registrar pagamento da comanda/)
assert.match(source, /group\.kind === 'table_tab'/)
assert.match(source, /onRegisterTableTabPayment/)
assert.match(source, /todos os pedidos pendentes/i)
```

- [ ] **Step 5: Implement one tab-level payment action**

Assinatura:

```js
function Receivables({ orders, tableTabs = [], currency, onRegisterPayment, onRegisterTableTabPayment })
```

Estados:

```js
const [tableTabPaymentGroup, setTableTabPaymentGroup] = useState(null)
const [tableTabPaymentMethod, setTableTabPaymentMethod] = useState('Pix')
```

No grupo de comanda:

```jsx
{group.kind === 'table_tab' && (
  <Button onClick={() => setTableTabPaymentGroup(group)} disabled={writeDisabled}>
    Registrar pagamento da comanda
  </Button>
)}
```

Nos pedidos internos, mantenha `Ver detalhes`; botão individual só se:

```jsx
{group.kind !== 'table_tab' && (
  <Button onClick={() => onRegisterPayment(order.id)} disabled={writeDisabled}>Registrar pagamento</Button>
)}
```

No modal de comanda, exiba `group.label`, `group.orders.length`, `currency(group.total)`, `SystemSelect` com as opções de pagamento existentes e o texto “Todos os pedidos pendentes desta comanda serão quitados juntos.” Ao confirmar:

```js
const success = await onRegisterTableTabPayment(tableTabPaymentGroup.tableTabId, tableTabPaymentMethod)
if (success) setTableTabPaymentGroup(null)
```

- [ ] **Step 6: Responsive CSS, GREEN and commit**

```bash
node --test src/utils/receivables.test.js src/tableTabReceivablesUi.test.js
git add src/utils/receivables.js src/utils/receivables.test.js src/pages/Receivables.jsx src/receivables.css src/tableTabReceivablesUi.test.js
git commit -m "feat: collect table tabs in receivables"
```

---

### Task 7: Mostrar contexto de comanda aberta no Novo Pedido

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/new-order.css`
- Create: `src/tableTabNewOrderUi.test.js`

**Interfaces:**
- Consumes: `tableTabs`.
- Não envia `tableTabId` no payload.

- [ ] **Step 1: Write RED UI contract**

`src/tableTabNewOrderUi.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')

test('new order shows active table tab context without sending tab id', () => {
  assert.match(source, /tableTabs/)
  assert.match(source, /comanda aberta/)
  assert.doesNotMatch(source, /customerIdentity:[\s\S]*tableTabId/)
})
```

- [ ] **Step 2: Verify RED**

```bash
node --test src/tableTabNewOrderUi.test.js
```

- [ ] **Step 3: Resolve active tab for feedback only**

Assinatura:

```js
function NewOrder({ clients, products, tableTabs = [], currency, disabled, onCancel, onCreateClient, onSubmit })
```

Calcule:

```js
const normalizedLocalTable = localIdentityType === 'table' ? localIdentityValue.trim().toUpperCase() : ''
const openTableTab = normalizedLocalTable
  ? tableTabs.find((tab) => tab.status === 'open' && tab.tableIdentifier === normalizedLocalTable) ?? null
  : null
```

Renderize perto do campo Mesa:

```jsx
{openTableTab && (
  <div className="new-order-table-tab-hint" role="status">
    Mesa {openTableTab.tableIdentifier} · comanda aberta. Este pedido será adicionado automaticamente.
  </div>
)}
```

Não adicionar `tableTabId` ao `draft`, `customerIdentity` ou `buildOrderPayload`.

- [ ] **Step 4: Style, GREEN and commit**

Use `var(--info-soft)`, `var(--info)`, `var(--border)` em `src/new-order.css`.

```bash
node --test src/tableTabNewOrderUi.test.js src/newOrderLocalIdentityUi.test.js src/orderPayloadIdentity.test.js
git add src/pages/NewOrder.jsx src/new-order.css src/tableTabNewOrderUi.test.js
git commit -m "feat: show active table tab context"
```

---

### Task 8: Feedback visual inequívoco no ProductForm

**Files:**
- Modify: `src/components/ProductForm.jsx`
- Modify: `src/product-form.css`
- Create: `src/productSelectionFeedback.test.js`

**Interfaces:**
- Consumes: `.selected`, `aria-pressed`, `Icon name="check"` já existente.

- [ ] **Step 1: Write RED visual contract**

`src/productSelectionFeedback.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const form = fs.readFileSync(new URL('./components/ProductForm.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('./product-form.css', import.meta.url), 'utf8')

test('selected product controls use check plus strong filled state', () => {
  assert.match(form, /product-selection-check/)
  assert.match(form, /name="check"/)
  assert.match(css, /\.product-selection-check/)
  assert.match(css, /\.product-category-option\.selected[\s\S]*box-shadow/)
  assert.match(css, /\.product-presentation-option\.selected[\s\S]*box-shadow/)
  assert.match(css, /\.product-size-option\.selected[\s\S]*box-shadow/)
  assert.match(css, /\.product-unit-option\.selected[\s\S]*box-shadow/)
})
```

- [ ] **Step 2: Verify RED**

```bash
node --test src/productSelectionFeedback.test.js
```

- [ ] **Step 3: Add check to all four selected groups**

Em cada `.map`, calcule `selected` e preserve o `aria-pressed`. Dentro do botão:

```jsx
{selected && (
  <span className="product-selection-check" aria-hidden="true">
    <Icon name="check" size={13} />
  </span>
)}
```

`Icon.jsx` já contém `check`; não modificá-lo.

- [ ] **Step 4: Strengthen selected state using existing theme tokens**

`src/product-form.css`:

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
  border-color: var(--primary);
  background: var(--primary);
  color: #fff;
  box-shadow: 0 0 0 3px var(--primary-soft);
  font-weight: 700;
}

.product-selection-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  margin-left: auto;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  color: #fff;
}
```

Para apresentação/tamanho/unidade, ajuste o layout do botão para `display:flex; align-items:center; justify-content:center; gap:8px;`; o check continua visível sem depender só de cor. Verifique em `@media (max-width: 820px)` que `min-height:48px` continua preservado.

- [ ] **Step 5: GREEN, lint and commit**

```bash
node --test src/productSelectionFeedback.test.js src/productCatalogUi.test.js
npm run lint
git add src/components/ProductForm.jsx src/product-form.css src/productSelectionFeedback.test.js
git commit -m "fix: make product selections unmistakable"
```

---

### Task 9: Regressão integrada, migration e entrega

**Files:**
- Modify: `src/catalogLocalOrdersIntegration.test.js` somente para o guard integrado.

**Interfaces:**
- Verifica os contratos das Tasks 1–8.

- [ ] **Step 1: Add integrated guard**

No teste integrado, leia `worker/repositories.js`, `src/pages/Receivables.jsx`, `src/App.jsx` e `src/pages/NewOrder.jsx` e exija:

```js
assert.match(repositories, /table_tab_id/)
assert.match(repositories, /getOrCreateOpenTableTab/)
assert.match(receivables, /table_tab/)
assert.match(app, /tableTabs/)
assert.match(newOrder, /comanda aberta/)
```

- [ ] **Step 2: Full tests**

```bash
npm test
```

Expected: todos PASS.

- [ ] **Step 3: Lint and build**

```bash
npm run lint
npm run build
```

Expected: 0 erros; build Vite concluído.

- [ ] **Step 4: Worker dry-run**

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: bundle válido com binding D1 `amor-e-sabor-delivery`.

- [ ] **Step 5: Validate D1 migrations locally**

Use o mesmo mecanismo de migrations já usado pelo projeto/CI para aplicar `0001`–`0007` em D1 local limpo. Em seguida rode:

```sql
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'table_tabs';
SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_table_tabs_one_open_per_table';
PRAGMA table_info(orders);
```

Expected: `table_tabs` existe, índice parcial existe e `orders` contém `table_tab_id`.

- [ ] **Step 6: Manual acceptance**

```text
1. Mesa 04 sem comanda cria pedido e abre comanda.
2. Segundo pedido Mesa 04 mostra “comanda aberta” e reutiliza a mesma comanda.
3. A Receber mostra uma única Mesa 04 com 2 pedidos e total somado.
4. Comanda não oferece pagamento individual por pedido.
5. Pagamento da comanda com Pix quita todos os pedidos pendentes.
6. Novo pedido Mesa 04 após quitação cria nova comanda.
7. Mesa legada sem tableTabId fica isolada.
8. Nome repetido fica isolado.
9. Cliente cadastrado continua agrupado por clientId.
10. Excluir o último pedido fecha a comanda vazia.
11. Categoria/Apresentação/Tamanho/Unidade mostram fundo preenchido + contorno + check em desktop e mobile.
```

- [ ] **Step 7: Commit integrated guard**

```bash
git add src/catalogLocalOrdersIntegration.test.js
git commit -m "test: guard table tab integration"
```

- [ ] **Step 8: Final branch review**

```bash
git diff master...HEAD --stat
git diff master...HEAD -- . ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*'
```

Expected: somente migration, checkout/repositórios/rotas, bootstrap/API/App, Receivables/NewOrder, feedback visual e testes relacionados.

- [ ] **Step 9: Integrate and deploy after final checkpoint**

Após a verificação verde, integrar a feature em `master` conforme o workflow do projeto e executar `.github/workflows/deploy-production.yml`. O workflow deve passar testes/lint/build/dry-run, listar/aplicar `0007_table_tabs.sql`, verificar credencial e publicar o Worker antes de declarar a rodada concluída.
