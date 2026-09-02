# Catálogo, pedidos locais e refinamentos operacionais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a rodada aprovada de persistência do período do Dashboard, cancelamento do cadastro rápido, catálogo de produtos estruturado, identificação flexível para consumo no local e simplificação de A receber sem regressões nos fluxos existentes.

**Architecture:** `App` continua coordenando sessão e operações remotas, enquanto regras reutilizáveis de catálogo e identidade de pedido passam para módulos puros em `shared/`, consumidos por frontend e Worker. O schema evolui por duas migrations D1 aditivas e separadas; o Worker continua sendo a fonte de verdade para preço, identidade oficial do pedido e snapshots. A UI complexa de produto fica em `ProductForm`, e o agrupamento de A receber fica em helper puro para impedir que nome/mesa avulsos virem “clientes”.

**Tech Stack:** React 19, Vite 8, JavaScript ESM, Node `node:test`, oxlint, Cloudflare Workers, D1/SQLite, Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-02-catalog-local-orders-ux-design.md`

## Global Constraints

- Nenhuma exclusão de produto, cliente, pedido, item, pagamento ou movimento existente durante as migrações.
- Migrações D1 devem ser aditivas e executadas apenas pelo mecanismo normal de migrations.
- Frontend e Worker devem tolerar dados legados durante a transição.
- Snapshots históricos continuam sendo fonte de exibição para pedidos antigos.
- Preço oficial de produto continua em centavos no servidor; apresentação nunca participa do cálculo de preço.
- Produtos continuam usando soft delete.
- Pedidos locais por Nome/Mesa nunca criam registros em `clients`.
- Entrega e Retirada continuam exigindo cliente cadastrado.
- `guest_name` aceita 1–80 caracteres após trim.
- `table` aceita 1–12 caracteres e `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$`.
- Tamanho customizado aceita no máximo 24 caracteres.
- Volume/Peso aceitam decimal positivo com vírgula ou ponto na UI e persistem valor canônico com ponto.
- Não adicionar biblioteca externa de ícones; ampliar o `Icon` local.
- Preservar estados `disabled` ligados a offline ou escrita em andamento.
- Preservar idempotência, pagamento, finalização, busca e histórico atuais.

---

## File Structure

**Create**
- `shared/productCatalog.js` — categorias, fallback legado, sugestão, validação e formatação da apresentação.
- `shared/productCatalog.test.js` — contrato puro do catálogo.
- `shared/orderCustomerIdentity.js` — tipos de identidade, regex e validação compartilhada.
- `shared/orderCustomerIdentity.test.js` — contrato puro de identidade.
- `src/components/ProductForm.jsx` — formulário de criação/edição de produto.
- `src/product-form.css` — layout e estados do formulário.
- `src/utils/receivables.js` — agrupamento correto das pendências.
- `src/utils/receivables.test.js` — agrupamento por cliente real versus pedido avulso.
- `migrations/0005_product_presentation.sql` — apresentação estruturada.
- `migrations/0006_order_customer_identity.sql` — identidade do pedido.
- `worker/productPresentationMigration.test.js`
- `worker/orderCustomerIdentityMigration.test.js`
- `src/dashboardPeriodPersistence.test.js`
- `src/quickClientCancel.test.js`
- `src/productCatalogUi.test.js`
- `src/localOrderIdentityUi.test.js`
- `src/catalogLocalOrdersIntegration.test.js`

**Modify**
- `src/App.jsx`
- `src/pages/Dashboard.jsx`
- `src/pages/NewOrder.jsx`
- `src/pages/Products.jsx`
- `src/pages/Receivables.jsx`
- `src/components/Icon.jsx`
- `src/components/OrderProductCatalog.jsx`
- `src/utils/orderCart.js`
- `src/orderCart.test.js`
- `src/new-order.css`
- `src/receivables.css`
- `worker/validation.js`
- `worker/index.js`
- `worker/index.test.js`
- `worker/orderCheckout.js`
- `worker/orderCheckout.test.js`
- `worker/repositories.js`
- `worker/repositories.test.js`
- `worker/orderRepositories.test.js`
- `worker/orderRoutes.test.js`
- `worker/multiItemCheckoutRepository.test.js`

---

### Task 1: Persistir período do Dashboard e cancelar cadastro rápido

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/pages/NewOrder.jsx`
- Create: `src/dashboardPeriodPersistence.test.js`
- Create: `src/quickClientCancel.test.js`

**Interfaces:**
- Produces: `Dashboard({ period, onPeriodChange, totals, orders, currency, onNewOrder })`.
- Produces: `closeQuickClient()` que limpa apenas o cadastro rápido.

- [ ] **Step 1: Write failing Dashboard ownership test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const dashboard = fs.readFileSync(new URL('./pages/Dashboard.jsx', import.meta.url), 'utf8')

test('dashboard period lives in App and is controlled', () => {
  assert.match(app, /const \[dashboardPeriod, setDashboardPeriod\] = useState\('30d'\)/)
  assert.match(app, /period=\{dashboardPeriod\}/)
  assert.match(app, /onPeriodChange=\{setDashboardPeriod\}/)
  assert.doesNotMatch(dashboard, /const \[period, setPeriod\] = useState/)
  assert.match(dashboard, /DashboardPeriodSelector value=\{period\} onChange=\{onPeriodChange\}/)
})
```

- [ ] **Step 2: Run RED**

Run: `node --test src/dashboardPeriodPersistence.test.js`  
Expected: FAIL porque `Dashboard` ainda possui `period` local.

- [ ] **Step 3: Lift period state into App**

```jsx
// src/App.jsx
const [dashboardPeriod, setDashboardPeriod] = useState('30d')

const clearBusinessData = () => {
  setProducts([])
  setClients([])
  setOrders([])
  setMovements([])
  setCheckoutKey(null)
  setPaymentOrderId(null)
  setShowMovementModal(false)
  setShowClientForm(false)
  setDuplicateClientDialog(null)
  setShowProductForm(false)
  setDashboardPeriod('30d')
}

<Dashboard
  period={dashboardPeriod}
  onPeriodChange={setDashboardPeriod}
  totals={totals}
  orders={orders}
  currency={currency}
  onNewOrder={handleNewOrder}
/>
```

```jsx
// src/pages/Dashboard.jsx
function Dashboard({ period, onPeriodChange, totals, orders, currency, onNewOrder }) {
  const [valuesVisible, setValuesVisible] = useState(true)
  return <DashboardPeriodSelector value={period} onChange={onPeriodChange} />
}
```

Preserve the existing analytics calls and replace only their former local `period` state with the controlled prop.

- [ ] **Step 4: Write failing quick-client cancel test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')

test('quick client has explicit cancel that clears only quick-client state', () => {
  assert.match(source, /const closeQuickClient = \(\) =>/)
  assert.match(source, /setQuickClient\(\{ open: false, name: '', phone: '' \}\)/)
  assert.match(source, /setQuickClientError\(''\)/)
  assert.match(source, /setDuplicateClient\(null\)/)
  assert.match(source, />Cancelar<\/Button>/)
})
```

- [ ] **Step 5: Run RED**

Run: `node --test src/quickClientCancel.test.js`  
Expected: FAIL porque não existe ação explícita de cancelar.

- [ ] **Step 6: Implement quick-client cancel**

```jsx
const closeQuickClient = () => {
  setQuickClient({ open: false, name: '', phone: '' })
  setQuickClientError('')
  setDuplicateClient(null)
}

<div className="form-actions">
  <Button type="button" variant="secondary" onClick={closeQuickClient} disabled={disabled}>Cancelar</Button>
  <Button type="submit" disabled={disabled || !quickClient.name.trim()}>Adicionar cliente</Button>
</div>
```

`closeQuickClient` must not call `setItems`, `setType`, `setOrderDate`, `setDeliveryFee` or `setAdjustment`.

- [ ] **Step 7: Run focused regression**

Run: `node --test src/dashboardPeriodPersistence.test.js src/quickClientCancel.test.js src/dashboardControls.test.js src/mobileUxIntegration.test.js`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/pages/Dashboard.jsx src/pages/NewOrder.jsx src/dashboardPeriodPersistence.test.js src/quickClientCancel.test.js
git commit -m "fix: preserve dashboard period and quick client flow"
```

---

### Task 2: Criar domínio de catálogo e migration de apresentação

**Files:**
- Create: `shared/productCatalog.js`
- Create: `shared/productCatalog.test.js`
- Create: `migrations/0005_product_presentation.sql`
- Create: `worker/productPresentationMigration.test.js`

**Interfaces:**
- Produces: `PRODUCT_CATEGORIES`, `CATEGORY_ICON_NAMES`, `PRODUCT_CATEGORY_OPTIONS`, `suggestPresentationType(category)`, `categoryForUi(category)`, `validateProductPresentation(input)`, `deriveLegacySize(value)`, `formatProductPresentation(product)`.
- `validateProductPresentation` returns `{ ok: true, value }` or `{ ok: false, field, message }`.

- [ ] **Step 1: Write failing pure catalog tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  categoryForUi,
  formatProductPresentation,
  suggestPresentationType,
  validateProductPresentation,
} from './productCatalog.js'

test('categories use approved fallback and default presentation', () => {
  assert.equal(categoryForUi('Bebidas'), 'Bebidas')
  assert.equal(categoryForUi('Categoria antiga'), 'Outros')
  assert.equal(suggestPresentationType('Bebidas'), 'volume')
  assert.equal(suggestPresentationType('Refeições'), 'size')
})

test('volume and weight normalize comma and format pt-BR', () => {
  assert.deepEqual(validateProductPresentation({
    presentationType: 'volume', presentationValue: '1,5', presentationUnit: 'L',
  }), {
    ok: true,
    value: { presentationType: 'volume', presentationValue: '1.5', presentationUnit: 'L', size: '1,5 L' },
  })
  assert.equal(formatProductPresentation({ presentationType: 'weight', presentationValue: '0.5', presentationUnit: 'kg' }), '0,5 kg')
})

test('invalid presentation values are rejected', () => {
  assert.equal(validateProductPresentation({ presentationType: 'volume', presentationValue: '0', presentationUnit: 'ml' }).ok, false)
  assert.equal(validateProductPresentation({ presentationType: 'size', presentationValue: 'x'.repeat(25), presentationUnit: '' }).ok, false)
})
```

- [ ] **Step 2: Run RED**

Run: `node --test shared/productCatalog.test.js`  
Expected: FAIL com módulo ausente.

- [ ] **Step 3: Implement shared catalog helpers**

```js
export const PRODUCT_CATEGORIES = [
  'Refeições', 'Lanches', 'Combos', 'Porções', 'Bebidas',
  'Sobremesas', 'Adicionais', 'Molhos', 'Outros',
]

export const CATEGORY_ICON_NAMES = {
  Refeições: 'meal', Lanches: 'snack', Combos: 'combo', Porções: 'portion',
  Bebidas: 'drink', Sobremesas: 'dessert', Adicionais: 'plus', Molhos: 'sauce', Outros: 'package',
}

export const PRODUCT_CATEGORY_OPTIONS = PRODUCT_CATEGORIES.map((value) => ({ value, label: value }))
const CATEGORY_SET = new Set(PRODUCT_CATEGORIES)
const DEFAULT_PRESENTATION = {
  Refeições: 'size', Lanches: 'size', Combos: 'unit', Porções: 'size',
  Bebidas: 'volume', Sobremesas: 'unit', Adicionais: 'unit', Molhos: 'unit', Outros: 'unit',
}

export const categoryForUi = (category) => CATEGORY_SET.has(category) ? category : 'Outros'
export const suggestPresentationType = (category) => DEFAULT_PRESENTATION[categoryForUi(category)] || 'unit'

const localizedDecimal = (value) => String(Number(value)).replace('.', ',')

export const deriveLegacySize = ({ presentationType, presentationValue, presentationUnit }) => {
  if (presentationType === 'unit') return 'Un'
  if (presentationType === 'size') return presentationValue
  return `${localizedDecimal(presentationValue)} ${presentationUnit}`
}

export const validateProductPresentation = (input = {}) => {
  const type = input.presentationType
  if (!['unit', 'size', 'volume', 'weight'].includes(type)) return { ok: false, field: 'presentationType', message: 'Selecione uma apresentação válida.' }
  if (type === 'unit') return { ok: true, value: { presentationType: 'unit', presentationValue: '', presentationUnit: '', size: 'Un' } }
  if (type === 'size') {
    const presentationValue = String(input.presentationValue ?? '').trim()
    if (!presentationValue || presentationValue.length > 24) return { ok: false, field: 'presentationValue', message: 'Informe um tamanho com até 24 caracteres.' }
    return { ok: true, value: { presentationType: 'size', presentationValue, presentationUnit: '', size: presentationValue } }
  }
  const normalized = String(input.presentationValue ?? '').trim().replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized) || Number(normalized) <= 0) return { ok: false, field: 'presentationValue', message: 'Informe um valor maior que zero.' }
  const allowed = type === 'volume' ? ['ml', 'L'] : ['g', 'kg']
  if (!allowed.includes(input.presentationUnit)) return { ok: false, field: 'presentationUnit', message: 'Selecione uma unidade válida.' }
  const value = { presentationType: type, presentationValue: String(Number(normalized)), presentationUnit: input.presentationUnit }
  return { ok: true, value: { ...value, size: deriveLegacySize(value) } }
}

export const formatProductPresentation = (product = {}) => {
  if (product.presentationType === 'unit') return 'Unidade'
  if (product.presentationType === 'size') return String(product.presentationValue || product.size || '').trim()
  if (['volume', 'weight'].includes(product.presentationType) && product.presentationValue && product.presentationUnit) {
    return `${localizedDecimal(product.presentationValue)} ${product.presentationUnit}`
  }
  return String(product.size || 'Unidade').trim()
}
```

- [ ] **Step 4: Add additive migration**

```sql
ALTER TABLE products ADD COLUMN presentation_type TEXT NOT NULL DEFAULT 'unit';
ALTER TABLE products ADD COLUMN presentation_value TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN presentation_unit TEXT NOT NULL DEFAULT '';

UPDATE products SET category = CASE category
  WHEN 'Marmita' THEN 'Refeições'
  WHEN 'Bebida' THEN 'Bebidas'
  WHEN 'Doce' THEN 'Sobremesas'
  WHEN 'Adicional' THEN 'Adicionais'
  ELSE category
END;

UPDATE products
SET presentation_type = CASE
      WHEN trim(size) = '' OR size IN ('Un', 'Unidade') THEN 'unit'
      ELSE 'size'
    END,
    presentation_value = CASE
      WHEN trim(size) = '' OR size IN ('Un', 'Unidade') THEN ''
      ELSE size
    END,
    presentation_unit = '';
```

- [ ] **Step 5: Add migration safety test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql = fs.readFileSync(new URL('../migrations/0005_product_presentation.sql', import.meta.url), 'utf8')

test('product presentation migration is additive and preserves unknown categories', () => {
  assert.match(sql, /ADD COLUMN presentation_type/)
  assert.match(sql, /ADD COLUMN presentation_value/)
  assert.match(sql, /ADD COLUMN presentation_unit/)
  assert.match(sql, /ELSE category/)
  assert.doesNotMatch(sql, /DELETE FROM products|DROP TABLE products/i)
})
```

- [ ] **Step 6: Run GREEN and commit**

Run: `node --test shared/productCatalog.test.js worker/productPresentationMigration.test.js`  
Expected: PASS.

```bash
git add shared/productCatalog.js shared/productCatalog.test.js migrations/0005_product_presentation.sql worker/productPresentationMigration.test.js
git commit -m "feat: define structured product presentations"
```

---

### Task 3: Persistir apresentação estruturada no Worker/API

**Files:**
- Modify: `worker/validation.js`
- Modify: `worker/index.js`
- Modify: `worker/index.test.js`
- Modify: `worker/repositories.js`
- Modify: `worker/repositories.test.js`

**Interfaces:**
- Consumes: Task 2 catalog helpers.
- Produces product API shape `{ id, category, size, name, price, presentationType, presentationValue, presentationUnit }`.

- [ ] **Step 1: Add failing product mapping test**

```js
import { mapProductRow } from './repositories.js'

test('product row exposes structured presentation and legacy size', () => {
  assert.deepEqual(mapProductRow({
    id: 'p1', category: 'Bebidas', size: '350 ml', name: 'Coca-Cola', price_cents: 600,
    presentation_type: 'volume', presentation_value: '350', presentation_unit: 'ml',
  }), {
    id: 'p1', category: 'Bebidas', size: '350 ml', name: 'Coca-Cola', price: 6,
    presentationType: 'volume', presentationValue: '350', presentationUnit: 'ml',
  })
})
```

- [ ] **Step 2: Run RED**

Run: `node --test worker/repositories.test.js`  
Expected: FAIL porque o mapper não expõe os novos campos.

- [ ] **Step 3: Add route validation helpers**

```js
// worker/validation.js
import { PRODUCT_CATEGORIES, validateProductPresentation } from '../shared/productCatalog.js'

export const validateProductCategory = (value) => {
  if (!PRODUCT_CATEGORIES.includes(value)) throw validationError('category', 'Categoria de produto inválida.')
  return value
}

export const validateStructuredPresentation = (body = {}) => {
  const result = validateProductPresentation({
    presentationType: body.presentationType,
    presentationValue: body.presentationValue,
    presentationUnit: body.presentationUnit,
  })
  if (!result.ok) throw validationError(result.field, result.message)
  return result.value
}
```

```js
// worker/index.js
const productInput = (body) => {
  const presentation = validateStructuredPresentation(body)
  return {
    category: validateProductCategory(body.category),
    name: requireNonEmpty(body.name, 'name'),
    priceCents: moneyToCents(body.price, 'price'),
    ...presentation,
  }
}
```

Import `validateProductCategory` and `validateStructuredPresentation` from `worker/validation.js` in `worker/index.js`.

- [ ] **Step 4: Update product repository SQL and mapping**

Every product SELECT must include `presentation_type`, `presentation_value`, `presentation_unit`.

```js
export const mapProductRow = (row) => ({
  id: row.id,
  category: row.category,
  size: row.size || '',
  name: row.name,
  price: centsToMoney(row.price_cents),
  presentationType: row.presentation_type || (row.size && !['Un', 'Unidade'].includes(row.size) ? 'size' : 'unit'),
  presentationValue: row.presentation_value || (row.size && !['Un', 'Unidade'].includes(row.size) ? row.size : ''),
  presentationUnit: row.presentation_unit || '',
})
```

Create must bind in this order:

```js
[id, businessId, input.category, input.size, input.presentationType, input.presentationValue, input.presentationUnit, input.name, input.priceCents, timestamp, timestamp]
```

Update must bind:

```js
[input.category, input.size, input.presentationType, input.presentationValue, input.presentationUnit, input.name, input.priceCents, now.toISOString(), id, businessId]
```

Adjust `worker/index.test.js` `FakeDb` INSERT/UPDATE destructuring to the same order and store the three structured fields.

- [ ] **Step 5: Add route-level invalid volume test using the existing harness**

```js
test('authenticated product CRUD rejects invalid structured volume', async () => {
  const env = await makeEnv()
  const loginResponse = await login(env)
  const cookiePair = loginResponse.headers.get('set-cookie').split(';')[0]
  const headers = mutationHeaders({ cookie: cookiePair })
  const response = await handleRequest(new Request('https://delivery.example/api/products', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      category: 'Bebidas', name: 'Suco', price: 8,
      presentationType: 'volume', presentationValue: '0', presentationUnit: 'ml',
    }),
  }), env)
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error.code, 'VALIDATION_ERROR')
})
```

Update the existing product CRUD happy path to `category: 'Bebidas'` and structured presentation fields.

- [ ] **Step 6: Run GREEN and commit**

Run: `node --test worker/repositories.test.js worker/index.test.js shared/productCatalog.test.js`  
Expected: PASS.

```bash
git add worker/validation.js worker/index.js worker/index.test.js worker/repositories.js worker/repositories.test.js
git commit -m "feat: persist structured product presentation"
```

---

### Task 4: Reformular formulário, listagem e catálogo de Produtos

**Files:**
- Create: `src/components/ProductForm.jsx`
- Create: `src/product-form.css`
- Create: `src/productCatalogUi.test.js`
- Modify: `src/App.jsx`
- Modify: `src/pages/Products.jsx`
- Modify: `src/components/Icon.jsx`
- Modify: `src/components/OrderProductCatalog.jsx`
- Modify: `src/utils/orderCart.js`

**Interfaces:**
- Consumes: Task 2 catalog helpers.
- Produces: `ProductForm({ value, onChange, onSubmit, onCancel, disabled, editing })`.

- [ ] **Step 1: Write failing UI contract**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const form = fs.readFileSync(new URL('./components/ProductForm.jsx', import.meta.url), 'utf8')
const products = fs.readFileSync(new URL('./pages/Products.jsx', import.meta.url), 'utf8')

test('product form contains category, presentation, preview and cancel', () => {
  assert.match(form, /PRODUCT_CATEGORIES/)
  assert.match(form, /presentationType/)
  assert.match(form, /formatProductPresentation/)
  assert.match(form, /Cancelar/)
})

test('products screen combines category filter and presentation display', () => {
  assert.match(products, /categoryFilter/)
  assert.match(products, /Todos/)
  assert.match(products, /categoryForUi/)
  assert.match(products, /formatProductPresentation/)
})
```

- [ ] **Step 2: Run RED**

Run: `node --test src/productCatalogUi.test.js`  
Expected: FAIL porque `ProductForm.jsx` não existe.

- [ ] **Step 3: Implement controlled ProductForm**

Use this initial transition when category changes:

```jsx
const changeCategory = (category) => {
  const presentationType = suggestPresentationType(category)
  onChange({
    ...value,
    category,
    presentationType,
    presentationValue: presentationType === 'size' ? 'P' : '',
    presentationUnit: presentationType === 'volume' ? 'ml' : '',
  })
}
```

The component must render:
- name + price;
- category grid from `PRODUCT_CATEGORIES` with `Icon` and accessible selected state;
- presentation buttons `Unidade`, `Tamanho`, `Volume`, `Peso`;
- P/M/G/Outro for `size`;
- custom text maxLength 24 when Outro is active;
- positive decimal value + `ml/L` for volume;
- positive decimal value + `g/kg` for weight;
- inline error from `validateProductPresentation(value)`;
- preview from `formatProductPresentation`;
- `Cancelar` plus `Salvar produto` or `Salvar alterações`.

- [ ] **Step 4: Extend Icon locally**

Add icon cases `meal`, `snack`, `combo`, `portion`, `drink`, `dessert`, `sauce`. Reuse `plus` for Adicionais and `package` for Outros. Preserve the existing `Icon({ name, size })` API.

- [ ] **Step 5: Wire App product state and payload**

```js
const emptyProduct = () => ({
  category: 'Refeições',
  presentationType: 'size',
  presentationValue: 'P',
  presentationUnit: '',
  name: '',
  price: formatBRLCurrencyValue(32),
})

const productPayload = () => ({
  category: newProduct.category,
  presentationType: newProduct.presentationType,
  presentationValue: newProduct.presentationValue,
  presentationUnit: newProduct.presentationUnit,
  name: newProduct.name.trim(),
  price: parseBRLCurrencyInput(newProduct.price),
})
```

For edit, initialize `category` with `categoryForUi(product.category)` and copy the structured presentation fields returned by the API. Replace the old product form body in the modal with `ProductForm`.

- [ ] **Step 6: Add category filter to Products**

`Products` owns `const [categoryFilter, setCategoryFilter] = useState('Todos')` and computes:

```js
const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
const visibleProducts = products.filter((product) => {
  const uiCategory = categoryForUi(product.category)
  const categoryMatch = categoryFilter === 'Todos' || uiCategory === categoryFilter
  const searchText = [product.name, uiCategory, formatProductPresentation(product), String(product.price)]
    .join(' ')
    .toLocaleLowerCase('pt-BR')
  return categoryMatch && (!normalizedSearch || searchText.includes(normalizedSearch))
})
```

Use `SystemSelect` with `Todos` + `PRODUCT_CATEGORY_OPTIONS`; render category icon, category, name, formatted presentation and price.

Pass raw `products` from `App` to `Products`; remove the old App-level product filtering so category/search filtering has one source of truth inside the page.

- [ ] **Step 7: Make NewOrder catalog use the same formatter**

Import `formatProductPresentation` in `src/components/OrderProductCatalog.jsx` and `src/utils/orderCart.js`.

```js
const presentation = formatProductPresentation(product)
size: presentation === 'Unidade' ? 'Un' : presentation,
```

The cart still stores a compatibility `size` string; server snapshot remains authoritative at checkout.

- [ ] **Step 8: Add responsive CSS and run GREEN**

`src/product-form.css` must define concrete classes for category grid, selected category, presentation segmented row, detail controls, inline error, preview and actions. At `max-width: 820px`, category grid uses two columns and controls keep the existing touch-target sizing.

Run: `node --test src/productCatalogUi.test.js shared/productCatalog.test.js src/systemSelectMigration.test.js`  
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/ProductForm.jsx src/product-form.css src/productCatalogUi.test.js src/App.jsx src/pages/Products.jsx src/components/Icon.jsx src/components/OrderProductCatalog.jsx src/utils/orderCart.js
git commit -m "feat: redesign product catalog management"
```

---

### Task 5: Definir identidade do pedido e migration D1

**Files:**
- Create: `shared/orderCustomerIdentity.js`
- Create: `shared/orderCustomerIdentity.test.js`
- Create: `migrations/0006_order_customer_identity.sql`
- Create: `worker/orderCustomerIdentityMigration.test.js`

**Interfaces:**
- Produces: `CUSTOMER_IDENTITY_TYPES`, `TABLE_ID_PATTERN`, `validateCustomerIdentity(orderType, identity)`.

- [ ] **Step 1: Write failing identity tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCustomerIdentity } from './orderCustomerIdentity.js'

test('delivery and pickup require registered client', () => {
  assert.equal(validateCustomerIdentity('Entrega', { type: 'guest_name', value: 'Ana' }).ok, false)
  assert.equal(validateCustomerIdentity('Retirada', { type: 'table', value: '04' }).ok, false)
  assert.equal(validateCustomerIdentity('Entrega', { type: 'registered_client', clientId: 'c1' }).ok, true)
})

test('local accepts valid name and table and rejects invalid limits', () => {
  assert.deepEqual(validateCustomerIdentity('Local', { type: 'guest_name', value: '  João  ' }).value, { type: 'guest_name', value: 'João' })
  assert.equal(validateCustomerIdentity('Local', { type: 'table', value: 'A-2' }).ok, true)
  assert.equal(validateCustomerIdentity('Local', { type: 'table', value: 'Mesa 2' }).ok, false)
  assert.equal(validateCustomerIdentity('Local', { type: 'guest_name', value: 'x'.repeat(81) }).ok, false)
})
```

- [ ] **Step 2: Run RED**

Run: `node --test shared/orderCustomerIdentity.test.js`  
Expected: FAIL com módulo ausente.

- [ ] **Step 3: Implement shared validator**

```js
export const CUSTOMER_IDENTITY_TYPES = ['registered_client', 'guest_name', 'table']
export const TABLE_ID_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/

export const validateCustomerIdentity = (orderType, identity = {}) => {
  const type = identity.type
  if (!CUSTOMER_IDENTITY_TYPES.includes(type)) return { ok: false, field: 'customerIdentity.type', message: 'Identificação inválida.' }
  if (orderType !== 'Local' && type !== 'registered_client') return { ok: false, field: 'customerIdentity.type', message: 'Entrega e retirada exigem cliente cadastrado.' }
  if (type === 'registered_client') {
    const clientId = String(identity.clientId ?? '').trim()
    return clientId
      ? { ok: true, value: { type, clientId } }
      : { ok: false, field: 'customerIdentity.clientId', message: 'Selecione um cliente.' }
  }
  const value = String(identity.value ?? '').trim()
  if (type === 'guest_name') {
    return value && value.length <= 80
      ? { ok: true, value: { type, value } }
      : { ok: false, field: 'customerIdentity.value', message: 'Informe um nome com até 80 caracteres.' }
  }
  return value.length >= 1 && value.length <= 12 && TABLE_ID_PATTERN.test(value)
    ? { ok: true, value: { type, value } }
    : { ok: false, field: 'customerIdentity.value', message: 'Informe uma mesa com até 12 caracteres alfanuméricos.' }
}
```

- [ ] **Step 4: Add migration and safety test**

```sql
ALTER TABLE orders ADD COLUMN customer_identity_type TEXT NOT NULL DEFAULT 'registered_client';
UPDATE orders SET customer_identity_type = 'guest_name' WHERE client_id IS NULL;
```

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql = fs.readFileSync(new URL('../migrations/0006_order_customer_identity.sql', import.meta.url), 'utf8')

test('order identity migration is additive', () => {
  assert.match(sql, /ADD COLUMN customer_identity_type/)
  assert.match(sql, /WHERE client_id IS NULL/)
  assert.doesNotMatch(sql, /DELETE FROM orders|DROP TABLE orders/i)
})
```

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test shared/orderCustomerIdentity.test.js worker/orderCustomerIdentityMigration.test.js`  
Expected: PASS.

```bash
git add shared/orderCustomerIdentity.js shared/orderCustomerIdentity.test.js migrations/0006_order_customer_identity.sql worker/orderCustomerIdentityMigration.test.js
git commit -m "feat: define local order customer identity"
```

---

### Task 6: Validar e persistir identidade no checkout do Worker

**Files:**
- Modify: `worker/orderCheckout.js`
- Modify: `worker/orderCheckout.test.js`
- Modify: `worker/repositories.js`
- Modify: `worker/orderRepositories.test.js`
- Modify: `worker/orderRoutes.test.js`
- Modify: `worker/multiItemCheckoutRepository.test.js`

**Interfaces:**
- Consumes: Task 5 `validateCustomerIdentity`.
- Produces: checkout validated input with `customerIdentity`.
- Produces: order API field `customerIdentityType` while preserving `client` and `clientId`.

- [ ] **Step 1: Add failing checkout identity tests**

```js
test('local checkout accepts guest identity while delivery rejects it', () => {
  const guest = validateCheckoutInput({
    ...validCheckoutBody,
    type: 'Local',
    customerIdentity: { type: 'guest_name', value: 'João' },
  }, 'guest-key')
  assert.deepEqual(guest.customerIdentity, { type: 'guest_name', value: 'João' })

  assert.throws(() => validateCheckoutInput({
    ...validCheckoutBody,
    type: 'Entrega',
    customerIdentity: { type: 'table', value: '04' },
  }, 'delivery-key'))
})

test('legacy clientId payload remains temporarily compatible as registered client', () => {
  const input = validateCheckoutInput({ ...validCheckoutBody, clientId: 'c1', customerIdentity: undefined }, 'legacy-key')
  assert.deepEqual(input.customerIdentity, { type: 'registered_client', clientId: 'c1' })
})
```

Use the fixture name already present in `worker/orderCheckout.test.js`; if it is a function rather than an object, call it and apply the same fields.

- [ ] **Step 2: Run RED**

Run: `node --test worker/orderCheckout.test.js`  
Expected: FAIL porque checkout exige top-level `clientId`.

- [ ] **Step 3: Validate explicit identity with backward-compatible fallback**

```js
const type = validateOrderType(body.type)
const rawIdentity = body.customerIdentity ?? { type: 'registered_client', clientId: body.clientId }
const identityResult = validateCustomerIdentity(type, rawIdentity)
if (!identityResult.ok) throw checkoutError(identityResult.field, identityResult.message)
const customerIdentity = identityResult.value
```

Return `customerIdentity` and stop returning top-level `clientId` as the authoritative field. This fallback protects an already-open pre-deploy frontend while new assets move to the explicit contract.

- [ ] **Step 4: Normalize repository callers and resolve identity server-side**

At the start of `createOrder`:

```js
const input = Array.isArray(rawInput.items) && rawInput.items.length ? rawInput : legacyCheckoutInput(rawInput)
const customerIdentity = input.customerIdentity ?? { type: 'registered_client', clientId: input.clientId }
```

Resolve snapshot:

```js
let clientId = null
let clientSnapshot = ''

if (customerIdentity.type === 'registered_client') {
  const client = await db.prepare('SELECT id, name FROM clients WHERE id = ? AND business_id = ? LIMIT 1')
    .bind(customerIdentity.clientId, businessId).first()
  if (!client) throw repositoryError(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.')
  clientId = client.id
  clientSnapshot = client.name
} else if (customerIdentity.type === 'guest_name') {
  clientSnapshot = customerIdentity.value
} else {
  clientSnapshot = `Mesa ${customerIdentity.value}`
}
```

Insert `clientId`, `clientSnapshot` and `customerIdentity.type` into `orders`. Use `clientSnapshot` in automatic payment movement description.

- [ ] **Step 5: Extend selects/mapping and product snapshot**

Add `o.customer_identity_type` to `orderSelect` and return:

```js
customerIdentityType: row.customer_identity_type || (row.client_id ? 'registered_client' : 'guest_name'),
```

When selecting products for checkout, include structured presentation columns, map the product, and compute:

```js
const presentationSnapshot = formatProductPresentation(mapProductRow(product))
```

Persist `presentationSnapshot === 'Unidade' ? 'Un' : presentationSnapshot` into `size_snapshot`. Do not accept a snapshot from the frontend.

- [ ] **Step 6: Update existing checkout route fixtures**

In `worker/orderRoutes.test.js`, `worker/orderRepositories.test.js` and `worker/multiItemCheckoutRepository.test.js`, change normal modern checkout fixtures from `clientId: '...'` to:

```js
customerIdentity: { type: 'registered_client', clientId: '...' }
```

Keep one explicit legacy `clientId` test in `worker/orderCheckout.test.js` from Step 1 to lock transitional compatibility.

- [ ] **Step 7: Add guest/table repository assertions**

```js
assert.equal(localGuest.clientId, null)
assert.equal(localGuest.client, 'João')
assert.equal(localGuest.customerIdentityType, 'guest_name')
assert.equal(localTable.client, 'Mesa A-2')
assert.equal(localTable.customerIdentityType, 'table')
assert.equal(registered.customerIdentityType, 'registered_client')
```

Add an idempotency case where the same local guest checkout key is submitted twice and only one order is created.

- [ ] **Step 8: Run GREEN and commit**

Run: `node --test worker/orderCheckout.test.js worker/orderRoutes.test.js worker/orderRepositories.test.js worker/multiItemCheckoutRepository.test.js worker/repositories.test.js`  
Expected: PASS.

```bash
git add worker/orderCheckout.js worker/orderCheckout.test.js worker/repositories.js worker/orderRepositories.test.js worker/orderRoutes.test.js worker/multiItemCheckoutRepository.test.js
git commit -m "feat: support local order identities in checkout"
```

---

### Task 7: Implementar UX de Consumo no local e corrigir A receber

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/utils/orderCart.js`
- Modify: `src/orderCart.test.js`
- Modify: `src/new-order.css`
- Create: `src/localOrderIdentityUi.test.js`
- Create: `src/utils/receivables.js`
- Create: `src/utils/receivables.test.js`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/receivables.css`

**Interfaces:**
- Consumes: Task 5 `validateCustomerIdentity`.
- Produces: `buildOrderPayload()` with explicit `customerIdentity`.
- Produces: `groupPendingOrders(orders)` returning `{ key, label, orders, total }[]`.

- [ ] **Step 1: Add failing payload test**

```js
test('order payload sends explicit local identity', () => {
  const payload = buildOrderPayload({
    type: 'Local',
    orderDate: '2026-09-02',
    customerIdentity: { type: 'table', value: 'A-2' },
    items: [{ productId: 'p1', quantity: 1, note: '' }],
    deliveryFee: 0,
    adjustment: { type: 'none', mode: 'fixed', value: 0, reason: '' },
  })
  assert.deepEqual(payload.customerIdentity, { type: 'table', value: 'A-2' })
  assert.equal('clientId' in payload, false)
})
```

- [ ] **Step 2: Run RED and update payload**

Run: `node --test src/orderCart.test.js`  
Expected: FAIL.

```js
const payload = {
  customerIdentity: draft.customerIdentity,
  type: draft.type,
  orderDate: draft.orderDate,
  items: (Array.isArray(draft.items) ? draft.items : []).map((item) => ({
    productId: item.productId,
    quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
    note: normalizeItemNote(item.note),
  })),
  deliveryFee: draft.type === 'Entrega' ? toNonNegativeNumber(draft.deliveryFee) : 0,
  adjustment: {
    type: ['discount', 'surcharge'].includes(adjustment.type) ? adjustment.type : 'none',
    mode: adjustment.mode === 'percentage' ? 'percentage' : 'fixed',
    value: toNonNegativeNumber(adjustment.value),
    reason: cleanSpaces(adjustment.reason).slice(0, 200),
  },
}
```

- [ ] **Step 3: Write failing NewOrder source contract**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')

test('local order exposes Nome Mesa and Cliente cadastrado modes', () => {
  assert.match(source, /guest_name/)
  assert.match(source, /table/)
  assert.match(source, /registered_client/)
  assert.match(source, /Cliente cadastrado/)
})
```

- [ ] **Step 4: Implement type-first identity state**

```js
const [customerIdentityType, setCustomerIdentityType] = useState('registered_client')
const [guestName, setGuestName] = useState('')
const [tableId, setTableId] = useState('')

const customerIdentity = type === 'Local'
  ? customerIdentityType === 'registered_client'
    ? { type: 'registered_client', clientId }
    : customerIdentityType === 'guest_name'
      ? { type: 'guest_name', value: guestName }
      : { type: 'table', value: tableId }
  : { type: 'registered_client', clientId }

const identityValidation = validateCustomerIdentity(type, customerIdentity)
const canSubmit = Boolean(identityValidation.ok && orderDate && items.length)
```

`changeType('Local')` sets `customerIdentityType` to `guest_name`; `changeType('Entrega')` and `changeType('Retirada')` set it to `registered_client`. Switching identity mode clears only fields belonging to the mode being left. Cart, order date, fee and adjustment remain unchanged.

Render `Tipo do pedido` before identity. For Local render `Nome | Mesa | Cliente cadastrado`. Name uses maxLength 80; Mesa uses maxLength 12; registered client reuses the existing picker and quick-client flow. Hide quick-client controls in guest/table mode.

- [ ] **Step 5: Write failing receivables grouping test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { groupPendingOrders } from './receivables.js'

test('real client groups while identical guest names remain independent', () => {
  const groups = groupPendingOrders([
    { id: 'o1', clientId: 'c1', client: 'Ana', customerIdentityType: 'registered_client', total: 10, paymentStatus: 'Pendente' },
    { id: 'o2', clientId: 'c1', client: 'Ana', customerIdentityType: 'registered_client', total: 20, paymentStatus: 'Pendente' },
    { id: 'o3', clientId: null, client: 'João', customerIdentityType: 'guest_name', total: 15, paymentStatus: 'Pendente' },
    { id: 'o4', clientId: null, client: 'João', customerIdentityType: 'guest_name', total: 12, paymentStatus: 'Pendente' },
  ])
  assert.equal(groups.length, 3)
  assert.equal(groups.find((group) => group.key === 'client:c1').total, 30)
})
```

- [ ] **Step 6: Implement grouping helper**

```js
import { getPendingAmount, isOrderPaid } from './paymentWorkflow.js'

export const groupPendingOrders = (orders = []) => {
  const grouped = new Map()
  orders.filter((order) => !isOrderPaid(order)).forEach((order) => {
    const registered = (order.customerIdentityType === 'registered_client' || !order.customerIdentityType) && order.clientId
    const key = registered ? `client:${order.clientId}` : `order:${order.id}`
    const current = grouped.get(key) || { key, label: order.client, orders: [], total: 0 }
    current.orders.push(order)
    current.total += getPendingAmount(order)
    grouped.set(key, current)
  })
  return [...grouped.values()].sort((a, b) => b.total - a.total)
}
```

- [ ] **Step 7: Simplify Receivables UI**

Filter pending orders by search first, then call `groupPendingOrders(filteredPendingOrders)`. Remove `debtorCount` and `Clientes devendo`.

Keep exactly:

```jsx
<StatCard label="A receber" value={currency(totalPending)} helper="Saldo pendente" icon="wallet" tone="warning" />
<StatCard label="Pedidos pendentes" value={pendingCount} helper="Ainda não pagos" icon="receipt" />
<StatCard label="Recebido hoje" value={currency(receivedToday)} helper="Pagamentos confirmados" icon="arrow-up" tone="success" />
```

Rename section heading to `Pendências em aberto` and search placeholder to `Buscar identificação, pedido ou produto`. Do not group by `order.client` string in `Receivables.jsx`.

- [ ] **Step 8: Run GREEN and commit**

Run: `node --test src/orderCart.test.js src/localOrderIdentityUi.test.js src/quickClientCancel.test.js shared/orderCustomerIdentity.test.js src/utils/receivables.test.js`  
Expected: PASS.

```bash
git add src/pages/NewOrder.jsx src/utils/orderCart.js src/orderCart.test.js src/new-order.css src/localOrderIdentityUi.test.js src/utils/receivables.js src/utils/receivables.test.js src/pages/Receivables.jsx src/receivables.css
git commit -m "feat: support local service identities and clearer receivables"
```

---

### Task 8: Integração, regressão e prontidão de produção

**Files:**
- Create: `src/catalogLocalOrdersIntegration.test.js`
- Modify only when a failing verification identifies a concrete defect in files from Tasks 1–7.

**Interfaces:**
- No new runtime interface.

- [ ] **Step 1: Add integrated source guard**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const newOrder = fs.readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')
const receivables = fs.readFileSync(new URL('./pages/Receivables.jsx', import.meta.url), 'utf8')

test('approved round stays wired across app surfaces', () => {
  assert.match(app, /ProductForm/)
  assert.match(app, /dashboardPeriod/)
  assert.match(newOrder, /customerIdentity/)
  assert.match(newOrder, /guest_name/)
  assert.match(newOrder, /table/)
  assert.doesNotMatch(receivables, /Clientes devendo/)
  assert.match(receivables, /Pendências em aberto/)
})
```

- [ ] **Step 2: Run full tests**

Run: `npm test`  
Expected: all tests PASS; zero failures.

- [ ] **Step 3: Run lint**

Run: `npm run lint`  
Expected: `0 warnings and 0 errors`.

- [ ] **Step 4: Run production build**

Run: `npm run build`  
Expected: Vite build succeeds.

- [ ] **Step 5: Validate Worker bundle**

Run: `npx --yes wrangler@4.128.0 deploy --dry-run`  
Expected: success and binding `env.DB (amor-e-sabor-delivery)`.

- [ ] **Step 6: Validate migrations locally**

Run: `npx --yes wrangler@4.128.0 d1 migrations apply amor-e-sabor-delivery --local`  
Expected: migrations `0005_product_presentation.sql` and `0006_order_customer_identity.sql` apply without destructive errors. Do not apply remote migrations from the feature branch.

- [ ] **Step 7: Commit integration guard**

```bash
git add src/catalogLocalOrdersIntegration.test.js
git commit -m "test: guard catalog and local order round"
```

- [ ] **Step 8: Review final branch diff**

Run: `git diff master...HEAD --stat`  
Expected: only spec, plan, migrations and implementation/test files required by this round.

Run: `git diff master...HEAD -- migrations shared src worker`  
Expected: no unrelated refactor, dependency addition or workflow semantic change.

- [ ] **Step 9: Require green feature-branch CI**

Push `feature/catalog-local-orders-round` and verify the final SHA in `Validate application`: Test, Lint, Build and Worker dry-run must all conclude `success`.

- [ ] **Step 10: Integrate and deploy only after verification**

Fast-forward/merge the verified feature branch into `master`, wait for `master` validation to conclude `success`, then run the existing manual `Deploy production` workflow. Confirm in the deploy job that D1 migrations are listed/applied before Worker deployment. Do not claim production completion until the `Deploy` step and overall job both conclude `success`.
