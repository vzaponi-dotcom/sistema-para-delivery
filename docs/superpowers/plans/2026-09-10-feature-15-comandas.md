# Feature 15 — Tela Operacional de Comandas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma tela operacional de Comandas, separada de A Receber, que permita abrir pedidos por mesa, consultar e imprimir a pré-conta consolidada e registrar o pagamento integral sem alterar a impressão automática atual dos pedidos.

**Architecture:** A migração `0020` acrescenta numeração estável às `table_tabs`; o backend continua como fonte de verdade e expõe resumo por mesa, detalhe consolidado e documento de impressão. A página `Comandas` usa lista + detalhe no desktop e lista → detalhe no mobile, reaproveitando os fluxos atuais de pedido, pagamento e transporte físico por meio de uma impressão manual que não grava em `print_jobs`.

**Tech Stack:** React 19, JavaScript ESM, Cloudflare Worker, D1/SQLite, Node `node:test`, QZ Tray, RawBT, Web Serial, ESC/POS 58 mm, CSS responsivo.

**Spec:** `docs/superpowers/specs/2026-09-10-feature-15-comandas-design.md`

## Global Constraints

- Trabalhar somente na branch `feature/issue-15-comandas`, baseada em `origin/master` @ `8ddfd95f850d1e0903818409f225378d4d909a04`.
- A migração desta feature usa o prefixo `0020` e não depende das migrações de impressão `0014` a `0019` já aplicadas em staging.
- `table_tabs` é a fonte de verdade para abertura, fechamento, número e mesa atual da comanda.
- O número da comanda é inteiro positivo, crescente e único por empresa; não muda em transferência ou fechamento e nunca é reutilizado.
- A pré-conta é manual, tem uma via, pode ser repetida e nunca fecha ou modifica a comanda.
- `Ver ticket` e `Imprimir comanda` consomem exatamente o mesmo documento consolidado.
- Não alterar o schema de `print_jobs` nem o comportamento automático, quantidade de vias ou segunda via dos pedidos.
- O pagamento continua integral e usa `registerTableTabPayment` como operação financeira oficial.
- Transferência continua na tela `Mesas`; fusão, pagamento parcial e mapa do salão permanecem fora de escopo.
- Cada mudança funcional começa por teste RED e termina com teste GREEN e commit pequeno.

---

## File Structure

### Dados e backend

- `migrations/0020_table_tab_numbers.sql` — adiciona `tab_number`, contador por empresa, backfill e índices.
- `worker/tableTabNumberMigration.test.js` — valida estrutura, backfill e independência das migrações de impressão.
- `worker/tableRepository.js` — reserva números, cria comandas numeradas e devolve resumos oficiais por mesa.
- `worker/tableRepository.test.js` — cobre reserva concorrente, resumo, transferência e numeração.
- `worker/repositories.js` — mapeia `tabNumber`, inclui a nova coluna no bootstrap e preserva o pagamento oficial.
- `worker/repositories.test.js` — fixa o contrato do bootstrap com números de comanda.
- `worker/tableTabDetailRepository.js` — carrega e consolida a comanda aberta dentro do escopo da empresa.
- `worker/tableTabDetailRepository.test.js` — cobre agrupamento, totais, cancelados/pagos e isolamento entre empresas.
- `shared/tableTabPrintDocument.js` — define o documento canônico `table-tab` usado por prévia e impressão.
- `shared/tableTabPrintDocument.test.js` — fixa normalização, campos e invariantes do documento.
- `worker/tableTabRoutes.test.js` — cobre GET de detalhe/documento e respostas atualizadas de pedido/pagamento.
- `worker/index.js` — registra as novas rotas e inclui tabelas oficiais nas mutações relevantes.

### Frontend e navegação

- `src/api/client.js` — expõe `getTableTabDetail(id)` e `getTableTabPrintDocument(id)`.
- `src/api/tableTabClient.test.js` — fixa método e URL dos novos clientes HTTP.
- `src/pages/Comandas.jsx` — workspace responsivo, seleção, carregamento do detalhe e ações.
- `src/pages/Comandas.test.js` — cobre estados, seleção de mesa, ações e acessibilidade por inspeção de fonte.
- `src/components/ComandaDetail.jsx` — apresenta itens consolidados, total e ações da comanda aberta.
- `src/components/ComandaDetail.test.js` — cobre conteúdo e disponibilidade das quatro ações.
- `src/components/TableTabPaymentDialog.jsx` — modal reutilizável do pagamento integral.
- `src/components/TableTabPaymentDialog.test.js` — cobre métodos e confirmação.
- `src/comandas.css` — layout lista + detalhe e adaptação mobile lista → detalhe.
- `src/components/Sidebar.jsx` — adiciona Comandas à navegação desktop.
- `src/components/MobileNavigation.jsx` — torna Comandas um destino direto e move Produtos para Mais.
- `src/components/Icon.jsx` — registra o ícone de comandas.
- `src/comandasNavigation.test.js` — fixa a navegação desktop/mobile.
- `src/App.jsx` — coordena seleção, retorno de Novo Pedido, pagamento, sincronização e impressão.
- `src/comandasAppWiring.test.js` — fixa os contratos entre App, Comandas e Novo Pedido.
- `src/pages/NewOrder.jsx` — aceita contexto inicial de mesa e tipo Local.
- `src/pages/NewOrder.test.js` — cobre preseleção sem marcar o formulário inicialmente como sujo.

### Separação financeira e impressão

- `src/utils/receivables.js` — exclui pedidos vinculados a comandas da projeção principal de A Receber.
- `src/utils/receivables.test.js` — cobre a nova separação sem afetar recebíveis de clientes.
- `src/pages/Receivables.jsx` — remove UI/modal de comandas.
- `src/components/ReceivableDetail.jsx` — remove o ramo de detalhe de comanda.
- `src/tableTabReceivablesUi.test.js` — passa a provar ausência de comandas em A Receber.
- `src/components/TableTabTicketPreview.jsx` — prévia visual do documento consolidado.
- `src/components/TableTabTicketPreview.test.js` — cobre número, mesa, itens, observações e total.
- `src/printing/manualPrintDocument.js` — executa um documento manual em uma via sem tocar em `print_jobs`.
- `src/printing/manualPrintDocument.test.js` — cobre renderização, transporte e propagação de falha.
- `src/printing/escpos58mm.js` — renderiza documentos `table-tab` mantendo `order` e `test` intactos.
- `src/printing/escpos58mm.test.js` — cobre a pré-conta e regressão dos documentos atuais.
- `src/printing/usePrintingManager.js` — expõe prévia e impressão manual da comanda usando o transporte configurado.
- `src/printing/usePrintingManager.test.js` — cobre uma via manual e ausência de criação/claim de `print_jobs`.
- `src/printing/printingManagerRegression.test.js` — preserva impressão automática, vias e segunda via dos pedidos.

---

### Task 1: Migração autocontida para números de comanda

**Files:**
- Create: `migrations/0020_table_tab_numbers.sql`
- Create: `worker/tableTabNumberMigration.test.js`

**Interfaces:**
- Consumes: schema de `businesses` e `table_tabs` produzido até `0013_table_management.sql`.
- Produces: `table_tabs.tab_number`, tabela `table_tab_counters(business_id, last_number, updated_at)` e índice `idx_table_tabs_business_number`.

- [ ] **Step 1: Escrever o teste RED da estrutura e do backfill**

```js
// worker/tableTabNumberMigration.test.js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migrationUrl = new URL('../migrations/0020_table_tab_numbers.sql', import.meta.url)

test('0020 numbers existing tabs deterministically and creates a business counter', () => {
  assert.equal(fs.existsSync(migrationUrl), true)
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.match(sql, /ALTER TABLE table_tabs ADD COLUMN tab_number INTEGER/i)
  assert.match(sql, /row_number\(\) OVER\s*\(PARTITION BY business_id ORDER BY opened_at, created_at, id\)/i)
  assert.match(sql, /CREATE TABLE table_tab_counters/i)
  assert.match(sql, /CREATE UNIQUE INDEX idx_table_tabs_business_number\s+ON table_tabs\s*\(business_id, tab_number\)/i)
  assert.doesNotMatch(sql, /print_jobs|print_stations|business_print_settings/i)
})
```

- [ ] **Step 2: Executar o teste e confirmar a falha esperada**

Run: `node --test worker/tableTabNumberMigration.test.js`
Expected: FAIL porque `migrations/0020_table_tab_numbers.sql` ainda não existe.

- [ ] **Step 3: Criar a migração mínima**

```sql
ALTER TABLE table_tabs ADD COLUMN tab_number INTEGER;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY business_id
      ORDER BY opened_at, created_at, id
    ) AS assigned_number
  FROM table_tabs
)
UPDATE table_tabs
SET tab_number = (
  SELECT ranked.assigned_number
  FROM ranked
  WHERE ranked.id = table_tabs.id
);

CREATE UNIQUE INDEX idx_table_tabs_business_number
ON table_tabs (business_id, tab_number);

CREATE TABLE table_tab_counters (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TEXT NOT NULL
);

INSERT INTO table_tab_counters (business_id, last_number, updated_at)
SELECT
  businesses.id,
  COALESCE(max(table_tabs.tab_number), 0),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM businesses
LEFT JOIN table_tabs ON table_tabs.business_id = businesses.id
GROUP BY businesses.id;
```

- [ ] **Step 4: Acrescentar teste executável para schemas de produção e staging**

No mesmo teste, criar duas bases `DatabaseSync(':memory:')`: ambas contêm `businesses` e `table_tabs`; a segunda também contém tabelas/colunas extras representativas de `0014`–`0019`. Executar o SQL `0020` em ambas e afirmar:

```js
assert.deepEqual(
  database.prepare('SELECT tab_number FROM table_tabs ORDER BY opened_at, id').all().map((row) => row.tab_number),
  [1, 2],
)
assert.equal(database.prepare("SELECT last_number FROM table_tab_counters WHERE business_id = 'biz'").get().last_number, 2)
```

- [ ] **Step 5: Executar o teste GREEN**

Run: `node --test worker/tableTabNumberMigration.test.js`
Expected: PASS nos dois estados de schema.

- [ ] **Step 6: Commit**

```bash
git add migrations/0020_table_tab_numbers.sql worker/tableTabNumberMigration.test.js
git commit -m "feat: add stable table tab numbers"
```

---

### Task 2: Reserva atômica e propagação do número

**Files:**
- Modify: `worker/tableRepository.js`
- Modify: `worker/tableRepository.test.js`
- Modify: `worker/repositories.js`
- Modify: `worker/repositories.test.js`
- Modify: `worker/tableRoutes.test.js`
- Modify: `worker/tableTabPayment.test.js`

**Interfaces:**
- Consumes: `table_tab_counters` e `table_tabs.tab_number` da Task 1.
- Produces: `reserveNextTableTabNumber(db, businessId, now): Promise<number>`; `mapOpenTableTabRow(row).tabNumber`; `mapTableTabRow(row).tabNumber`; `table.openTableTab` com resumo oficial.

- [ ] **Step 1: Atualizar fixtures e escrever testes RED da reserva**

Adicionar `tab_number INTEGER` aos schemas em memória e `table_tab_counters` ao fixture principal. Fixar os comportamentos:

```js
test('new tabs reserve unique increasing business numbers and reuse the open tab', async () => {
  const first = await getOrCreateOpenTableTabByTableId(db, 'biz-a', 'table-1', now)
  const reused = await getOrCreateOpenTableTabByTableId(db, 'biz-a', 'table-1', now)
  const second = await getOrCreateOpenTableTabByTableId(db, 'biz-a', 'table-2', now)
  assert.equal(first.tabNumber, 1)
  assert.equal(reused.tabNumber, 1)
  assert.equal(second.tabNumber, 2)
})

test('transferring a tab preserves its number', async () => {
  const transferred = await transferOpenTableTab(db, 'biz-a', 'source', 'destination', now)
  assert.equal(transferred.tabNumber, 37)
})
```

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `node --test worker/tableRepository.test.js worker/repositories.test.js worker/tableRoutes.test.js worker/tableTabPayment.test.js`
Expected: FAIL por ausência de `tabNumber` e porque o INSERT atual não preenche a nova coluna.

- [ ] **Step 3: Implementar a reserva atômica**

```js
export const reserveNextTableTabNumber = async (db, businessId, now = new Date()) => {
  const timestamp = now.toISOString()
  await db.prepare(`INSERT OR IGNORE INTO table_tab_counters (
    business_id, last_number, updated_at
  ) VALUES (?, 0, ?)`).bind(businessId, timestamp).run()
  const row = await db.prepare(`UPDATE table_tab_counters
    SET last_number = last_number + 1, updated_at = ?
    WHERE business_id = ?
    RETURNING last_number`).bind(timestamp, businessId).first()
  if (!Number.isInteger(Number(row?.last_number))) {
    throw domainError(500, 'TABLE_TAB_NUMBER_FAILED', 'Não foi possível numerar a comanda.')
  }
  return Number(row.last_number)
}
```

Em `getOrCreateOpenTableTabByTableId`, reservar somente depois de confirmar que não há comanda aberta, incluir `tab_number` no `INSERT OR IGNORE` e reler a vencedora. Uma disputa pode consumir um número sem criar outra comanda; a lacuna é aceitável e o número nunca é reutilizado.

- [ ] **Step 4: Propagar `tabNumber` em todos os mapeadores/selects**

```js
export const mapTableTabRow = (row) => ({
  id: row.id,
  tableId: row.table_id ?? null,
  tableIdentifier: row.table_identifier,
  tabNumber: Number(row.tab_number),
  status: row.status,
  openedAt: row.opened_at,
  closedAt: row.closed_at ?? null,
})
```

Atualizar `tableSelect`, `selectOpen`, selects de transferência, bootstrap e expectativas existentes para sempre selecionar `tab_number`.

- [ ] **Step 5: Acrescentar resumo oficial em `listTables`**

O contrato de mesa ocupada deve ser:

```js
{
  id: 'table-1',
  name: 'Mesa 1',
  sortOrder: 1,
  isActive: true,
  occupancy: 'occupied',
  openTableTabId: 'tab-1',
  openTableTab: {
    id: 'tab-1',
    number: 1042,
    openedAt: '2026-09-10T19:34:00.000Z',
    orderCount: 3,
    itemCount: 6,
    totalCents: 8600,
  },
}
```

Calcular `orderCount`, `itemCount` e `totalCents` somente com pedidos pendentes e não cancelados ligados à comanda aberta. Mesa livre devolve `openTableTab: null`.

- [ ] **Step 6: Executar os testes GREEN**

Run: `node --test worker/tableRepository.test.js worker/repositories.test.js worker/tableRoutes.test.js worker/tableTabPayment.test.js`
Expected: PASS, incluindo concorrência, transferência e bootstrap.

- [ ] **Step 7: Commit**

```bash
git add worker/tableRepository.js worker/tableRepository.test.js worker/repositories.js worker/repositories.test.js worker/tableRoutes.test.js worker/tableTabPayment.test.js
git commit -m "feat: number and summarize open table tabs"
```

---

### Task 3: Detalhe consolidado e documento canônico

**Files:**
- Create: `worker/tableTabDetailRepository.js`
- Create: `worker/tableTabDetailRepository.test.js`
- Create: `shared/tableTabPrintDocument.js`
- Create: `shared/tableTabPrintDocument.test.js`

**Interfaces:**
- Consumes: `table_tabs.tab_number`, `tables`, `orders`, `order_items` e `payments`.
- Produces: `loadOpenTableTabDetail(db, businessId, tableTabId)` e `createTableTabPrintDocument(detail, emittedAt)`.

- [ ] **Step 1: Escrever teste RED da chave de agrupamento**

```js
test('detail groups equal items but separates notes presentations and prices', async () => {
  const detail = await loadOpenTableTabDetail(db, 'biz-a', 'tab-1')
  assert.deepEqual(detail.items, [
    { productId: 'burger', name: 'X-Bacon', presentation: '', note: '', unitPriceCents: 2200, quantity: 2, lineTotalCents: 4400 },
    { productId: 'burger', name: 'X-Bacon', presentation: '', note: 'Sem cebola', unitPriceCents: 2200, quantity: 1, lineTotalCents: 2200 },
  ])
  assert.equal(detail.totalCents, 6600)
})
```

Fixar também os filtros com testes explícitos:

```js
assert.equal(await loadOpenTableTabDetail(db, 'biz-a', 'tab-closed'), null)
assert.equal(await loadOpenTableTabDetail(db, 'biz-b', 'tab-1'), null)
assert.equal(detail.items.some((item) => item.productId === 'cancelled-product'), false)
assert.equal(detail.items.some((item) => item.productId === 'paid-product'), false)
```

A projeção cobrada deve coincidir com os pedidos pendentes que `registerTableTabPayment` liquidaria.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `node --test worker/tableTabDetailRepository.test.js`
Expected: FAIL porque o módulo ainda não existe.

- [ ] **Step 3: Implementar consulta e consolidação**

```js
const itemKey = (row) => JSON.stringify([
  row.product_id || '',
  row.name_snapshot || '',
  row.size_snapshot || '',
  Number(row.unit_price_cents) || 0,
  String(row.note || '').trim().replace(/\s+/g, ' '),
  row.price_reason || '',
])

export const loadOpenTableTabDetail = async (db, businessId, tableTabId) => {
  const tab = await db.prepare(`SELECT
      tt.id, tt.tab_number, tt.opened_at,
      t.id AS table_id, t.name AS table_name,
      b.name AS business_name
    FROM table_tabs tt
    JOIN tables t ON t.id = tt.table_id AND t.business_id = tt.business_id
    JOIN businesses b ON b.id = tt.business_id
    WHERE tt.id = ? AND tt.business_id = ? AND tt.status = 'open'
    LIMIT 1`).bind(tableTabId, businessId).first()
  if (!tab) return null

  const ordersResult = await db.prepare(`SELECT o.id, o.total_cents, o.created_at
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id
    WHERE o.business_id = ? AND o.table_tab_id = ?
      AND o.status <> 'Cancelado' AND p.id IS NULL
    ORDER BY o.created_at, o.id`).bind(businessId, tableTabId).all()

  const itemsResult = await db.prepare(`SELECT
      oi.product_id, oi.name_snapshot, oi.size_snapshot, oi.quantity,
      oi.unit_price_cents, oi.price_reason, oi.note, oi.created_at, oi.id
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND o.business_id = oi.business_id
    LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id
    WHERE o.business_id = ? AND o.table_tab_id = ?
      AND o.status <> 'Cancelado' AND p.id IS NULL
    ORDER BY o.created_at, o.id, oi.created_at, oi.id`).bind(businessId, tableTabId).all()

  const grouped = new Map()
  for (const row of rows(itemsResult)) {
    const key = itemKey(row)
    const quantity = Math.max(1, Number(row.quantity) || 1)
    const current = grouped.get(key)
    if (current) {
      current.quantity += quantity
      current.lineTotalCents += Number(row.unit_price_cents) * quantity
    } else {
      grouped.set(key, {
        productId: row.product_id || '',
        name: row.name_snapshot || '',
        presentation: row.size_snapshot || '',
        note: String(row.note || '').trim().replace(/\s+/g, ' '),
        unitPriceCents: Number(row.unit_price_cents) || 0,
        quantity,
        lineTotalCents: (Number(row.unit_price_cents) || 0) * quantity,
      })
    }
  }

  const orders = rows(ordersResult)
  return {
    id: tab.id,
    number: Number(tab.tab_number),
    status: 'open',
    openedAt: tab.opened_at,
    businessName: tab.business_name,
    table: { id: tab.table_id, name: tab.table_name },
    orderCount: orders.length,
    itemCount: [...grouped.values()].reduce((sum, item) => sum + item.quantity, 0),
    totalCents: orders.reduce((sum, order) => sum + Number(order.total_cents || 0), 0),
    items: [...grouped.values()],
  }
}
```

Retornar o contrato:

```js
{
  id, number, status: 'open', openedAt,
  table: { id: tableId, name: tableName },
  orderCount, itemCount, totalCents,
  items: [{ productId, name, presentation, note, unitPriceCents, quantity, lineTotalCents }],
}
```

- [ ] **Step 4: Escrever teste RED do documento canônico**

```js
test('table tab print document is a pending pre-account snapshot', () => {
  const document = createTableTabPrintDocument(detail, '2026-09-10T20:00:00.000Z')
  assert.equal(document.type, 'table-tab')
  assert.equal(document.tableTab.number, 1042)
  assert.equal(document.tableTab.tableName, 'Mesa 1')
  assert.equal(document.financial.totalCents, 8600)
  assert.equal(document.payment.status, 'Pendente')
  assert.equal(document.message, 'PRÉ-CONTA — NÃO É COMPROVANTE DE PAGAMENTO')
})
```

- [ ] **Step 5: Implementar `createTableTabPrintDocument`**

```js
export const TABLE_TAB_PRINT_DOCUMENT_VERSION = 1

export const createTableTabPrintDocument = (detail, emittedAt = new Date().toISOString()) => ({
  version: TABLE_TAB_PRINT_DOCUMENT_VERSION,
  type: 'table-tab',
  business: { name: String(detail.businessName || 'Amor & Sabor') },
  tableTab: {
    id: String(detail.id),
    number: Number(detail.number),
    tableName: String(detail.table?.name || ''),
    openedAt: String(detail.openedAt || ''),
    emittedAt: String(emittedAt),
  },
  items: detail.items.map((item) => ({ ...item })),
  financial: { totalCents: Number(detail.totalCents) || 0 },
  payment: { status: 'Pendente', method: '' },
  message: 'PRÉ-CONTA — NÃO É COMPROVANTE DE PAGAMENTO',
})
```

- [ ] **Step 6: Executar os testes GREEN**

Run: `node --test worker/tableTabDetailRepository.test.js shared/tableTabPrintDocument.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/tableTabDetailRepository.js worker/tableTabDetailRepository.test.js shared/tableTabPrintDocument.js shared/tableTabPrintDocument.test.js
git commit -m "feat: build consolidated table tab details"
```

---

### Task 4: Rotas autenticadas e cliente HTTP

**Files:**
- Create: `worker/tableTabRoutes.test.js`
- Modify: `worker/index.js`
- Create: `src/api/tableTabClient.test.js`
- Modify: `src/api/client.js`

**Interfaces:**
- Consumes: `loadOpenTableTabDetail` e `createTableTabPrintDocument` da Task 3.
- Produces: `GET /api/table-tabs/:id`, `GET /api/table-tabs/:id/print-document`, `getTableTabDetail(id)` e `getTableTabPrintDocument(id)`.

- [ ] **Step 1: Escrever testes HTTP RED**

```js
test('authenticated operator can load one open tab detail and its exact print document', async () => {
  const detailResponse = await request(env, cookie, 'GET', '/api/table-tabs/tab-1')
  assert.equal(detailResponse.status, 200)
  assert.equal((await detailResponse.json()).tableTab.number, 1042)

  const printResponse = await request(env, cookie, 'GET', '/api/table-tabs/tab-1/print-document')
  assert.equal(printResponse.status, 200)
  const document = (await printResponse.json()).document
  assert.equal(document.type, 'table-tab')
  assert.equal(document.tableTab.number, 1042)
})
```

Adicionar casos de segurança e estado:

```js
assert.equal((await request(env, null, 'GET', '/api/table-tabs/tab-1')).status, 401)
assert.equal((await request(env, cookie, 'GET', '/api/table-tabs/tab-closed')).status, 404)
assert.equal((await request(env, cookie, 'GET', '/api/table-tabs/missing')).status, 404)
assert.equal((await request(env, cookie, 'GET', '/api/table-tabs/tab-1', { origin: false })).status, 200)
```

- [ ] **Step 2: Fixar respostas oficiais após pedido e pagamento**

Nos testes de `POST /api/orders` e `POST /api/table-tabs/:id/payment`, afirmar que a resposta inclui `tables` e que a mesa muda respectivamente para `occupied` e `free`.

- [ ] **Step 3: Executar testes e confirmar falha**

Run: `node --test worker/tableTabRoutes.test.js worker/orderRoutes.test.js worker/tableTabPayment.test.js`
Expected: FAIL com 404 nas novas rotas e ausência de `tables` nas mutações.

- [ ] **Step 4: Implementar rotas antes do matcher de pagamento**

```js
const tableTabPrintMatch = url.pathname.match(/^\/api\/table-tabs\/([^/]+)\/print-document$/)
if (tableTabPrintMatch && request.method === 'GET') {
  const detail = await loadOpenTableTabDetail(env.DB, session.businessId, decodeURIComponent(tableTabPrintMatch[1]))
  if (!detail) throw apiError(404, 'TABLE_TAB_NOT_FOUND', 'Comanda aberta não encontrada.')
  return json({ document: createTableTabPrintDocument(detail) })
}

const tableTabDetailMatch = url.pathname.match(/^\/api\/table-tabs\/([^/]+)$/)
if (tableTabDetailMatch && request.method === 'GET') {
  const tableTab = await loadOpenTableTabDetail(env.DB, session.businessId, decodeURIComponent(tableTabDetailMatch[1]))
  if (!tableTab) throw apiError(404, 'TABLE_TAB_NOT_FOUND', 'Comanda aberta não encontrada.')
  return json({ tableTab })
}
```

Após pedido local ou pagamento de comanda, chamar `listTables(env.DB, session.businessId)` e incluir `tables` na resposta.

- [ ] **Step 5: Escrever e implementar clientes HTTP**

```js
export const getTableTabDetail = (id) => apiRequest(`/api/table-tabs/${encodeURIComponent(id)}`)
export const getTableTabPrintDocument = (id) => apiRequest(`/api/table-tabs/${encodeURIComponent(id)}/print-document`)
```

Os testes devem substituir `fetch`, chamar cada helper e afirmar método GET e URL codificada.

- [ ] **Step 6: Executar testes GREEN**

Run: `node --test worker/tableTabRoutes.test.js worker/orderRoutes.test.js src/api/tableTabClient.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/index.js worker/tableTabRoutes.test.js worker/orderRoutes.test.js src/api/client.js src/api/tableTabClient.test.js
git commit -m "feat: expose table tab detail endpoints"
```

---

### Task 5: Remover comandas de A Receber

**Files:**
- Modify: `src/utils/receivables.js`
- Modify: `src/utils/receivables.test.js`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/components/ReceivableDetail.jsx`
- Modify: `src/tableTabReceivablesUi.test.js`
- Modify: `src/App.jsx`
- Modify: `src/tableTabsAppWiring.test.js`

**Interfaces:**
- Consumes: pedidos com `customerIdentityType === 'table'` e `tableTabId`.
- Produces: `buildPendingReceivableEntries(orders, today)` contendo somente recebíveis fora de comandas.

- [ ] **Step 1: Escrever o teste RED da separação financeira**

```js
test('pending receivable entries omit every table-tab order', () => {
  const entries = buildPendingReceivableEntries([
    pendingDeliveryOrder,
    { ...pendingLocalOrder, customerIdentityType: 'table', tableTabId: 'tab-1' },
  ], '2026-09-10')
  assert.deepEqual(entries.map((entry) => entry.order.id), [pendingDeliveryOrder.id])
})
```

- [ ] **Step 2: Executar testes e confirmar a falha**

Run: `node --test src/utils/receivables.test.js src/tableTabReceivablesUi.test.js src/tableTabsAppWiring.test.js`
Expected: FAIL porque comandas ainda são agrupadas e renderizadas em `Receivables`.

- [ ] **Step 3: Simplificar a projeção**

```js
export const buildPendingReceivableEntries = (orders = [], today) => getPendingReceivableOrders(orders)
  .filter((order) => !isTableTabOrder(order))
  .map((order) => ({
    key: `order:${order.id}`,
    kind: 'order',
    order,
    orders: [order],
    label: order.client || 'Pedido sem identificação',
    total: getPendingAmount(order),
    expectedDate: getExpectedPaymentDate(order),
    timing: getReceivableTiming(order, today),
    createdAt: order.createdAt || '',
  }))
```

Atualizar `calculateReceivableSummary` e `buildReceivablesForecast` para a nova assinatura.

- [ ] **Step 4: Remover o ramo e modal de comanda da UI financeira**

Remover de `Receivables` as props/estados `tableTabs`, `onRegisterTableTabPayment`, `tableTabPaymentGroup` e o modal agregado. Remover de `ReceivableDetail` o ramo `entry.kind === 'table_tab'`. Preservar integralmente promessa, detalhe e pagamento de pedidos normais.

- [ ] **Step 5: Atualizar o wiring do App**

```jsx
{activeTab === 'receivables' && (
  <Receivables
    orders={orders}
    movements={movements}
    currency={currency}
    disabled={writesBlocked}
    onRegisterPayment={openPaymentModal}
    onUpdatePaymentPromise={handleUpdatePaymentPromise}
  />
)}
```

Manter `handleRegisterTableTabPayment` no App para uso posterior por `Comandas`.

- [ ] **Step 6: Executar testes GREEN e regressão financeira**

Run: `node --test src/utils/receivables.test.js src/tableTabReceivablesUi.test.js src/pages/ReceivablesDetails.test.js src/pages/ReceivablesMobile.test.js src/pages/ReceivablesForecast.test.js`
Expected: PASS; recebíveis de entrega/retirada continuam visíveis.

- [ ] **Step 7: Commit**

```bash
git add src/utils/receivables.js src/utils/receivables.test.js src/pages/Receivables.jsx src/components/ReceivableDetail.jsx src/tableTabReceivablesUi.test.js src/App.jsx src/tableTabsAppWiring.test.js
git commit -m "feat: separate table tabs from receivables"
```

---

### Task 6: Navegação e workspace responsivo de Comandas

**Files:**
- Create: `src/pages/Comandas.jsx`
- Create: `src/pages/Comandas.test.js`
- Create: `src/comandas.css`
- Create: `src/comandasNavigation.test.js`
- Create: `src/comandasAppWiring.test.js`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/components/MobileNavigation.jsx`
- Modify: `src/components/Icon.jsx`
- Modify: `src/mobileNavigation.test.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `tables[]` com `openTableTab`; `selectedTableId`; `onSelectTable(tableId)`; `onAddOrder(tableId)`.
- Produces: rota interna `activeTab === 'comandas'` e workspace responsivo aprovado.

- [ ] **Step 1: Escrever testes RED de navegação e contrato da página**

```js
test('desktop and mobile navigation expose Comandas as an operational destination', async () => {
  assert.match(sidebar, /\{ id: 'comandas', label: 'Comandas', icon: 'clipboard' \}/)
  assert.match(mobile, /navigate\('comandas'\)/)
  assert.match(mobile, />Comandas</)
})

test('Comandas distinguishes free and occupied active tables without color-only status', () => {
  assert.match(page, /table\.isActive/)
  assert.match(page, /table\.occupancy === 'occupied'/)
  assert.match(page, />Ocupada</)
  assert.match(page, />Livre</)
})
```

- [ ] **Step 2: Executar testes e confirmar a falha**

Run: `node --test src/comandasNavigation.test.js src/pages/Comandas.test.js src/comandasAppWiring.test.js src/mobileNavigation.test.js`
Expected: FAIL porque página e destino ainda não existem.

- [ ] **Step 3: Adicionar navegação com acesso rápido no celular**

No desktop, inserir `Comandas` logo após `Pedidos`. No mobile, usar os quatro destinos diretos `Dashboard`, `Pedidos`, `Comandas`, `Clientes`; mover `Produtos` para `Mais` e incluir `comandas` em `moreActive` somente se ela não estiver direta. Manter a barra em cinco colunas contando `Mais`.

- [ ] **Step 4: Criar o esqueleto funcional da página**

```jsx
function Comandas({ tables = [], selectedTableId, onSelectTable, onAddOrder, currency, disabled }) {
  const activeTables = tables.filter((table) => table.isActive)
  const selectedTable = activeTables.find((table) => table.id === selectedTableId) || null

  const selectTable = (table) => {
    if (table.occupancy === 'free') return onAddOrder?.(table.id)
    onSelectTable?.(table.id)
  }

  return (
    <div className={`comandas-page${selectedTable ? ' has-mobile-detail' : ''}`}>
      <PageHeader title="Comandas" description="Acompanhe mesas e comandas abertas." />
      <div className="comandas-workspace">
        <section className="comandas-list-panel" aria-label="Mesas ativas">
          {activeTables.map((table) => (
            <button key={table.id} type="button" className="comanda-table-button" onClick={() => selectTable(table)}>
              <strong>{table.name}</strong>
              <span>{table.occupancy === 'occupied' ? 'Ocupada' : 'Livre'}</span>
            </button>
          ))}
        </section>
        <aside className="comandas-detail-panel" aria-label="Detalhe da comanda">
          {selectedTable ? <span>{selectedTable.name}</span> : <span>Selecione uma mesa ocupada.</span>}
        </aside>
      </div>
    </div>
  )
}
```

Os cartões ocupados exibem `Comanda {number}`, `itemCount` e `currency(totalCents / 100)`. Os livres exibem `Toque para lançar pedido`.

- [ ] **Step 5: Implementar CSS desktop e mobile**

```css
.comandas-workspace { display:grid; grid-template-columns:minmax(280px, 0.42fr) minmax(0, 0.58fr); gap:16px; }
.comanda-table-button { min-height:72px; width:100%; }
.comanda-status { /* selo textual com contraste nos dois temas */ }

@media (max-width:820px) {
  .comandas-workspace { display:block; }
  .comandas-detail-panel { display:none; }
  .comandas-page.has-mobile-detail .comandas-list-panel { display:none; }
  .comandas-page.has-mobile-detail .comandas-detail-panel { display:block; }
}
```

Preservar rolagem da lista com `ref`/estado ao abrir e voltar do detalhe.

- [ ] **Step 6: Conectar estado controlado no App**

```js
const [selectedComandaTableId, setSelectedComandaTableId] = useState(null)
```

```jsx
{activeTab === 'comandas' && (
  <Comandas
    tables={tables}
    selectedTableId={selectedComandaTableId}
    onSelectTable={setSelectedComandaTableId}
    onAddOrder={(tableId) => handleNewOrder({ tableId, returnTab: 'comandas' })}
    currency={currency}
    disabled={writesBlocked}
  />
)}
```

- [ ] **Step 7: Executar testes GREEN**

Run: `node --test src/comandasNavigation.test.js src/pages/Comandas.test.js src/comandasAppWiring.test.js src/mobileNavigation.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Comandas.jsx src/pages/Comandas.test.js src/comandas.css src/comandasNavigation.test.js src/comandasAppWiring.test.js src/components/Sidebar.jsx src/components/MobileNavigation.jsx src/components/Icon.jsx src/mobileNavigation.test.js src/App.jsx
git commit -m "feat: add responsive comandas workspace"
```

---

### Task 7: Abrir Novo Pedido a partir de uma mesa

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/pages/NewOrder.test.js`
- Modify: `src/App.jsx`
- Modify: `src/comandasAppWiring.test.js`
- Modify: `src/AppNewOrderGuard.test.js`

**Interfaces:**
- Consumes: `initialTableId`, `initialType`, `newOrderReturnTab` e o fluxo atual `onSubmit`.
- Produces: `handleNewOrder({ tableId = '', returnTab = 'orders' })` e retorno à tela de origem após sucesso/cancelamento.

- [ ] **Step 1: Escrever teste RED da preseleção**

```js
test('NewOrder starts as Local with the requested table without dirtying the initial draft', () => {
  assert.match(page, /initialTableId = ''/)
  assert.match(page, /useState\(initialTableId \? 'Local' : initialType\)/)
  assert.match(page, /useState\(initialTableId\)/)
  assert.match(page, /initialDraftSnapshotRef/)
})
```

Adicionar teste do App afirmando que `handleNewOrder({ tableId, returnTab: 'comandas' })` define o contexto antes de navegar.

- [ ] **Step 2: Executar testes e confirmar a falha**

Run: `node --test src/pages/NewOrder.test.js src/comandasAppWiring.test.js src/AppNewOrderGuard.test.js`
Expected: FAIL por ausência das props/contexto.

- [ ] **Step 3: Implementar estado inicial no wizard**

```js
function NewOrder({
  clients,
  products,
  tables = [],
  initialType = 'Entrega',
  initialTableId = '',
  currency,
  disabled,
  onCancel,
  onCreateClient,
  onSubmit,
  onDraftDirtyChange,
}) {
  const [type, setType] = useState(initialTableId ? 'Local' : initialType)
  const [selectedTableId, setSelectedTableId] = useState(initialTableId)
```

Construir o snapshot inicial depois desses valores para que abrir pela mesa não acione a confirmação de descarte sem nenhuma edição.

- [ ] **Step 4: Implementar origem e retorno no App**

```js
const [newOrderContext, setNewOrderContext] = useState({ tableId: '', returnTab: 'orders' })

const handleNewOrder = ({ tableId = '', returnTab = 'orders' } = {}) => {
  if (writesBlocked) return
  setNewOrderContext({ tableId, returnTab })
  if (tableId) setSelectedComandaTableId(tableId)
  setCheckoutKey(crypto.randomUUID())
  completeNavigation('new-order')
}
```

Passar `initialTableId={newOrderContext.tableId}` e, após checkout bem-sucedido, navegar para `newOrderContext.returnTab`. `onCancel` também retorna à origem; ao abandonar definitivamente o wizard, limpar o contexto.

- [ ] **Step 5: Aplicar `tables` oficiais da resposta de criação**

```js
const { order, movement, tableTab, tables: nextTables } = await createOrderApi(payload, key)
applyOfficialEffects({ order, movement, tableTab, tables: nextTables })
```

Após o primeiro pedido, manter a mesa selecionada; ao retornar a `Comandas`, ela já aparece ocupada.

- [ ] **Step 6: Executar testes GREEN**

Run: `node --test src/pages/NewOrder.test.js src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js src/comandasAppWiring.test.js src/AppNewOrderGuard.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/NewOrder.jsx src/pages/NewOrder.test.js src/App.jsx src/comandasAppWiring.test.js src/AppNewOrderGuard.test.js
git commit -m "feat: launch table orders from comandas"
```

---

### Task 8: Detalhe, sincronização e pagamento integral

**Files:**
- Create: `src/components/ComandaDetail.jsx`
- Create: `src/components/ComandaDetail.test.js`
- Create: `src/components/TableTabPaymentDialog.jsx`
- Create: `src/components/TableTabPaymentDialog.test.js`
- Modify: `src/pages/Comandas.jsx`
- Modify: `src/pages/Comandas.test.js`
- Modify: `src/App.jsx`
- Modify: `src/comandasAppWiring.test.js`

**Interfaces:**
- Consumes: `getTableTabDetail(id)`, `registerTableTabPayment(id, method)`, global `tables` refresh every 5 s.
- Produces: detalhe carregável com `onAddOrder`, `onPreview`, `onPrint`, `onPay` e pagamento que atualiza `orders`, `movements`, `tableTab` e `tables`.

- [ ] **Step 1: Escrever testes RED das quatro ações**

```js
test('open comanda detail exposes the approved actions once', () => {
  for (const label of ['Adicionar pedido', 'Ver ticket', 'Imprimir comanda', 'Registrar pagamento']) {
    assert.equal((detail.match(new RegExp(label, 'g')) || []).length, 1)
  }
  assert.match(detail, /detail\.items\.map/)
  assert.match(detail, /currency\(detail\.totalCents \/ 100\)/)
})
```

Adicionar testes para carregando, erro com `Tentar novamente`, detalhe fechado e botão Voltar no mobile.

- [ ] **Step 2: Executar testes e confirmar a falha**

Run: `node --test src/components/ComandaDetail.test.js src/components/TableTabPaymentDialog.test.js src/pages/Comandas.test.js src/comandasAppWiring.test.js`
Expected: FAIL porque componentes e carregamento ainda não existem.

- [ ] **Step 3: Implementar `ComandaDetail`**

```jsx
function ComandaDetail({ detail, currency, disabled, busyAction, onAddOrder, onPreview, onPrint, onPay }) {
  return (
    <section className="comanda-detail" aria-label={`Comanda ${detail.number}`}>
      <header><span>Comanda</span><strong>#{detail.number}</strong><span>{detail.table.name}</span></header>
      <div className="comanda-detail-items">
        {detail.items.map((item) => (
          <div key={`${item.productId}-${item.presentation}-${item.note}-${item.unitPriceCents}`}>
            <strong>{item.quantity}x {item.name}</strong>
            {item.presentation && <span>{item.presentation}</span>}
            {item.note && <span>Obs: {item.note}</span>}
            <strong>{currency(item.lineTotalCents / 100)}</strong>
          </div>
        ))}
      </div>
      <div><span>Total</span><strong>{currency(detail.totalCents / 100)}</strong></div>
      <div className="comanda-detail-actions">
        <Button onClick={onAddOrder} disabled={disabled || busyAction}>Adicionar pedido</Button>
        <Button variant="secondary" onClick={onPreview} disabled={disabled || busyAction}>Ver ticket</Button>
        <Button variant="secondary" onClick={onPrint} disabled={disabled || busyAction}>Imprimir comanda</Button>
        <Button onClick={onPay} disabled={disabled || busyAction}>Registrar pagamento</Button>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Extrair o diálogo de pagamento**

`TableTabPaymentDialog` recebe `{ open, detail, currency, disabled, onClose, onConfirm }`, inicia método `Pix`, usa exatamente as opções atuais e chama `onConfirm(detail.id, method)` uma única vez.

- [ ] **Step 5: Carregar e manter o detalhe sincronizado**

Em `Comandas`, ao selecionar uma mesa ocupada, chamar `getTableTabDetail(openTableTab.id)`. Recarregar quando mudar qualquer um de:

```js
[selectedTable?.openTableTab?.id, selectedTable?.openTableTab?.orderCount, selectedTable?.openTableTab?.totalCents]
```

Cancelar/ignorar respostas antigas no cleanup do efeito. Se o bootstrap indicar mesa livre, fechar o detalhe e retornar à lista mobile.

- [ ] **Step 6: Atualizar App após pagamento**

```js
const result = await registerTableTabPaymentApi(tableTabId, method)
applyOfficialEffects({
  orders: result.orders,
  movements: result.movements,
  tableTab: result.tableTab,
  tables: result.tables,
})
setSelectedComandaTableId(null)
```

Se a API retornar conflito porque outra sessão já fechou a comanda, mostrar a mensagem existente, executar `refreshBootstrapSilently()` e deixar a mesa livre conforme o estado oficial.

- [ ] **Step 7: Executar testes GREEN**

Run: `node --test src/components/ComandaDetail.test.js src/components/TableTabPaymentDialog.test.js src/pages/Comandas.test.js src/comandasAppWiring.test.js worker/tableTabPayment.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/ComandaDetail.jsx src/components/ComandaDetail.test.js src/components/TableTabPaymentDialog.jsx src/components/TableTabPaymentDialog.test.js src/pages/Comandas.jsx src/pages/Comandas.test.js src/App.jsx src/comandasAppWiring.test.js
git commit -m "feat: add comanda detail and payment flow"
```

---

### Task 9: Pré-visualização e impressão manual consolidada

**Files:**
- Create: `src/components/TableTabTicketPreview.jsx`
- Create: `src/components/TableTabTicketPreview.test.js`
- Create: `src/printing/manualPrintDocument.js`
- Create: `src/printing/manualPrintDocument.test.js`
- Modify: `src/printing/escpos58mm.js`
- Modify: `src/printing/escpos58mm.test.js`
- Modify: `src/printing/usePrintingManager.js`
- Modify: `src/printing/usePrintingManager.test.js`
- Modify: `src/printing/printingManagerRegression.test.js`
- Modify: `src/pages/Comandas.jsx`
- Modify: `src/pages/Comandas.test.js`

**Interfaces:**
- Consumes: `getTableTabPrintDocument(id)` e documento `type: 'table-tab'` da Task 4.
- Produces: `runManualPrintDocument({ document, port, renderer, transport })`, `printing.getTableTabPreviewDocument(id)` e `printing.printTableTab(id)`.

- [ ] **Step 1: Escrever teste RED do renderer térmico**

```js
test('renders one consolidated pre-account without order copy labels', () => {
  const bytes = renderEscPos58mm(tableTabDocument, { copies: 1 })
  const text = decodeCp860(bytes)
  assert.match(text, /PRÉ-CONTA/)
  assert.match(text, /COMANDA #1042/)
  assert.match(text, /Mesa 1/)
  assert.match(text, /2x X-Bacon/)
  assert.match(text, /TOTAL R\$ 86,00/)
  assert.match(text, /NÃO É COMPROVANTE DE PAGAMENTO/)
  assert.doesNotMatch(text, /CÓPIA 1\/1|PEDIDO #/)
})
```

- [ ] **Step 2: Executar teste e confirmar a falha**

Run: `node --test src/printing/escpos58mm.test.js`
Expected: FAIL com `Unsupported print document`.

- [ ] **Step 3: Adicionar renderização `table-tab` sem alterar pedidos**

Criar `renderTableTabCopy(document)` no mesmo módulo usando os helpers de alinhamento, quebra, CP860 e dinheiro já testados. Ampliar somente a validação:

```js
if (!document || !['order', 'test', 'table-tab'].includes(document.type)) {
  throw new TypeError('Unsupported print document')
}
```

Para `table-tab`, exigir `copies === 1`, renderizar uma vez e manter o feed final atual. Não alterar `renderOrderCopy` nem `renderTestDocument`.

- [ ] **Step 4: Escrever e implementar executor manual puro**

```js
export const runManualPrintDocument = async ({ document, port, renderer, transport }) => {
  const bytes = renderer(document, { copies: 1 })
  await transport(port, bytes)
  return { status: 'printed', copiesPrinted: 1 }
}
```

O teste deve afirmar uma chamada ao renderer, uma ao transporte, bytes idênticos e rejeição preservada quando o transporte falhar. Não importar clientes de `print_jobs` neste arquivo.

- [ ] **Step 5: Implementar prévia visual fiel**

```jsx
function TableTabTicketPreview({ document }) {
  if (!document || document.type !== 'table-tab') return null
  return (
    <div className="order-ticket-preview" aria-label={`Visualização da comanda ${document.tableTab.number}`}>
      <header className="order-ticket-preview-header">
        <strong>{document.business.name}</strong>
        <h3>PRÉ-CONTA · COMANDA #{document.tableTab.number}</h3>
        <span>{document.tableTab.tableName}</span>
      </header>
      <section className="order-ticket-block">
        {(document.items || []).map((item, index) => (
          <div className="order-ticket-item" key={`${item.name}-${item.note}-${index}`}>
            <span>{item.quantity}x {item.name}{item.note ? ` · Obs: ${item.note}` : ''}</span>
            <strong>{formatPrintMoneyCents(item.lineTotalCents)}</strong>
          </div>
        ))}
      </section>
      <div className="order-ticket-total"><span>TOTAL</span><strong>{formatPrintMoneyCents(document.financial.totalCents)}</strong></div>
      <footer className="order-ticket-message">{document.message}</footer>
    </div>
  )
}
```

Reutilizar as classes visuais do ticket atual e `formatPrintMoneyCents`, sem duplicar CSS desnecessário.

- [ ] **Step 6: Expor ações no gerenciador de impressão**

```js
const executeManualDocument = useCallback(async (document, port) => {
  updateBusyJob(`table-tab:${document.tableTab.id}`)
  try {
    const result = await runManualPrintDocument({
      document,
      port,
      renderer: (value, options) => renderEscPos58mm(value, {
        ...options,
        compatibilityMode: getRendererCompatibilityMode(transportKind),
      }),
      transport: transportKind === 'rawbt'
        ? (_selectedPort, bytes) => dispatchRawBtBytes(bytes)
        : transportKind === 'qz'
          ? (_selectedPort, bytes) => printQzRawBytes(qz, configuredPrinterNameRef.current, bytes)
          : (selectedPort, bytes) => writeSerialBytes(selectedPort, bytes, MTP5_PROFILE.serial),
    })
    if (transportKind === 'qz' || transportKind === 'web-serial') updateTransportReady(true)
    setPrinterState(isRawBt ? 'driver-ready' : 'connected')
    setLastError(null)
    return result
  } catch (error) {
    if (transportKind !== 'rawbt') updateTransportReady(false)
    if (error?.code === 'SERIAL_OPEN_FAILED' || error?.code === 'RAWBT_LAUNCH_FAILED' || QZ_BLOCKING_ERROR_CODES.has(error?.code)) {
      updateBlocked(true)
    }
    reportError(error)
    throw error
  } finally {
    updateBusyJob(null)
  }
}, [isRawBt, reportError, transportKind, updateBlocked, updateBusyJob, updateTransportReady])

const getTableTabPreviewDocument = useCallback(async (tableTabId) => {
  const response = await getTableTabPrintDocument(tableTabId)
  return response.document
}, [])

const printTableTab = useCallback(async (tableTabId) => {
  const station = localStationRef.current
  if (!station?.id) throw printerError('PRINT_STATION_NOT_READY', 'A estação de impressão ainda não está pronta.')
  const port = await getExplicitPort()
  const document = await getTableTabPreviewDocument(tableTabId)
  return executeManualDocument(document, port)
}, [executeManualDocument, getExplicitPort, getTableTabPreviewDocument])
```

`executeManualDocument` deve reutilizar o mesmo renderer, compatibility mode e transporte selecionado de `executeClaimedJob`, controlar `busyJobId` com chave efêmera `table-tab:<id>` e atualizar estado/erro da impressora. Ele não chama `createManualPrintJob`, `claimPrintJob`, `completePrintJob` ou `failPrintJob`.

- [ ] **Step 7: Conectar ações e modal na página**

`Ver ticket` chama `getTableTabPreviewDocument`, guarda o documento e abre `Modal` com `TableTabTicketPreview`. `Imprimir comanda` chama `printTableTab`, mostra `Comanda enviada para impressão` no sucesso e mantém a comanda aberta. Ambos desabilitam ações enquanto ocupados e exibem erro acionável.

- [ ] **Step 8: Executar testes GREEN e regressões de impressão**

Run: `node --test shared/orderPrintDocument.test.js src/components/OrderTicketPreview.test.js src/components/TableTabTicketPreview.test.js src/printing/manualPrintDocument.test.js src/printing/escpos58mm.test.js src/printing/usePrintingManager.test.js src/printing/printingManagerRegression.test.js src/printing/printJobRunner.test.js`
Expected: PASS; testes devem provar explicitamente que imprimir comanda não cria job e imprimir pedido continua criando/claimando job.

- [ ] **Step 9: Commit**

```bash
git add src/components/TableTabTicketPreview.jsx src/components/TableTabTicketPreview.test.js src/printing/manualPrintDocument.js src/printing/manualPrintDocument.test.js src/printing/escpos58mm.js src/printing/escpos58mm.test.js src/printing/usePrintingManager.js src/printing/usePrintingManager.test.js src/printing/printingManagerRegression.test.js src/pages/Comandas.jsx src/pages/Comandas.test.js
git commit -m "feat: preview and print consolidated table tabs"
```

---

### Task 10: Concorrência, estados de erro e sincronização

**Files:**
- Modify: `worker/tableRepository.test.js`
- Modify: `worker/tableTabDetailRepository.test.js`
- Modify: `worker/tableTabRoutes.test.js`
- Modify: `worker/tableTabPayment.test.js`
- Modify: `src/pages/Comandas.jsx`
- Modify: `src/pages/Comandas.test.js`
- Modify: `src/App.jsx`
- Modify: `src/comandasAppWiring.test.js`

**Interfaces:**
- Consumes: todos os contratos das Tasks 1–9.
- Produces: comportamento final seguro em disputas, offline, fechamento e transferência por outra sessão.

- [ ] **Step 1: Escrever testes RED das disputas restantes**

Criar primeiro os testes abaixo:

```js
test('two simultaneous first orders keep one open tab with one visible number', async () => {
  const results = await Promise.all([
    createLocalOrder(db, 'biz', 'table-1', 'key-a'),
    createLocalOrder(db, 'biz', 'table-1', 'key-b'),
  ])
  assert.equal(new Set(results.map((result) => result.tableTabId)).size, 1)
  assert.equal(db.sqlite.prepare("SELECT count(*) AS count FROM table_tabs WHERE status = 'open'").get().count, 1)
})

test('closed detail is dismissed when bootstrap marks the selected table free', () => {
  assert.match(page, /selectedTable\.occupancy === 'free'[\s\S]*onSelectTable\?\.\(null\)/)
})
```

Adicionar asserções específicas para pagamento repetido, fechamento, transferência e resposta antiga:

```js
await assert.rejects(
  () => registerTableTabPayment(db, 'biz', 'tab-closed', 'Pix', now),
  (error) => error.code === 'TABLE_TAB_ALREADY_CLOSED',
)
assert.equal((await transferOpenTableTab(db, 'biz', 'source', 'destination', now)).tabNumber, 1042)
assert.equal(await loadOpenTableTabDetail(db, 'biz', 'tab-closed'), null)
assert.match(page, /detailRequestGenerationRef\.current !== generation/)
```

- [ ] **Step 2: Executar testes e confirmar falhas específicas**

Run: `node --test worker/tableRepository.test.js worker/tableTabDetailRepository.test.js worker/tableTabRoutes.test.js worker/tableTabPayment.test.js src/pages/Comandas.test.js src/comandasAppWiring.test.js`
Expected: pelo menos um FAIL para cada proteção ainda ausente; não aceitar falha de sintaxe como RED válido.

- [ ] **Step 3: Implementar estados e recuperação mínimos**

- manter `detailRequestGenerationRef` e só aplicar a última resposta;
- renderizar `Carregando comanda…`, estado vazio e erro com `Tentar novamente`;
- desabilitar `Adicionar pedido`, `Ver ticket`, `Imprimir comanda` e `Registrar pagamento` quando `disabled`, offline ou com ação em andamento;
- após 404/409, executar refresh silencioso e fechar seleção se a mesa estiver livre;
- após transferência detectada no bootstrap, manter seleção por `table.id` oficial e atualizar nome/número sem trocar `tableTab.id`;
- impedir duplo submit no diálogo de pagamento.

- [ ] **Step 4: Executar testes GREEN**

Run: `node --test worker/tableRepository.test.js worker/tableTabDetailRepository.test.js worker/tableTabRoutes.test.js worker/tableTabPayment.test.js src/pages/Comandas.test.js src/comandasAppWiring.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/tableRepository.test.js worker/tableTabDetailRepository.test.js worker/tableTabRoutes.test.js worker/tableTabPayment.test.js src/pages/Comandas.jsx src/pages/Comandas.test.js src/App.jsx src/comandasAppWiring.test.js
git commit -m "test: harden concurrent comanda operations"
```

---

### Task 11: Verificação integral e preparação para staging

**Files:**
- Modify only if a failing verification reveals an in-scope defect in files already listed above.

**Interfaces:**
- Consumes: implementação completa das Tasks 1–10.
- Produces: evidência reproduzível de que a Feature 15 está pronta para revisão e homologação, sem executar deploy.

- [ ] **Step 1: Executar a suíte completa**

Run: `npm test`
Expected: todos os testes PASS; zero failures, zero cancellations.

- [ ] **Step 2: Executar lint**

Run: `npm run lint`
Expected: exit code 0, sem erros.

- [ ] **Step 3: Executar build de produção**

Run: `npm run build`
Expected: exit code 0 e bundle Vite criado em `dist/`.

- [ ] **Step 4: Reexecutar os testes críticos isolados**

Run:

```bash
node --test worker/tableTabNumberMigration.test.js worker/tableRepository.test.js worker/tableTabDetailRepository.test.js worker/tableTabRoutes.test.js worker/tableTabPayment.test.js src/utils/receivables.test.js src/pages/Comandas.test.js src/printing/escpos58mm.test.js src/printing/usePrintingManager.test.js src/printing/printingManagerRegression.test.js
```

Expected: PASS em numeração, concorrência, separação financeira, UI e regressão de impressão.

- [ ] **Step 5: Auditar isolamento contra a master**

Run: `git diff --check origin/master...HEAD`
Expected: nenhuma saída.

Run: `git diff --name-status origin/master...HEAD`
Expected: somente arquivos da Feature 15, especificação e plano; nenhuma migração `0014`–`0019`, página `PrintQueue` ou alteração de segurança operacional da outra branch.

- [ ] **Step 6: Confirmar histórico e estado limpo**

Run: `git status --short --branch`
Expected: branch `feature/issue-15-comandas` sem arquivos modificados ou não rastreados.

Run: `git log --oneline origin/master..HEAD`
Expected: commits pequenos das Tasks 1–10 mais os commits de documentação.

- [ ] **Step 7: Registrar roteiro de homologação no resumo da revisão**

Entregar ao usuário estes gates antes de qualquer produção:

```text
1. Publicar o commit aprovado da Feature 15 em staging.
2. Aplicar somente a migração 0020 e confirmar compatibilidade com 0014–0019 já presentes.
3. Testar desktop e celular: mesa livre, primeiro pedido, pedido adicional, ticket e pagamento.
4. Com a impressora real: confirmar impressão automática do pedido e uma via da pré-conta.
5. Confirmar acentos, largura, corte e possibilidade de reimprimir sem fechar a comanda.
6. Promover somente após aprovação explícita da homologação.
```

- [ ] **Step 8: Commit de eventual ajuste de verificação**

Se e somente se os passos anteriores exigirem correção em escopo:

```bash
git add -u
git commit -m "fix: resolve feature 15 verification findings"
```

Não fazer deploy, merge ou push como parte desta tarefa sem autorização explícita do usuário.
