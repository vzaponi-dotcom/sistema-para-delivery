# Catálogo, pedidos locais e refinamentos operacionais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a rodada aprovada de persistência do período do Dashboard, cancelamento do cadastro rápido, catálogo de produtos estruturado, identificação flexível para consumo no local e simplificação de A receber sem regressões nos fluxos existentes.

**Architecture:** Manter `App` como coordenador de sessão e operações remotas, mas extrair regras reutilizáveis de catálogo e identidade de pedido para módulos puros em `shared/`, consumidos por frontend e Worker. As mudanças de schema serão aditivas em duas migrations D1 separadas; o Worker continua sendo a fonte de verdade para preços, snapshots e validação final de checkout. Componentes novos (`ProductForm`) e helpers de agrupamento evitam aumentar ainda mais `App.jsx` e mantêm cada regra testável de forma isolada.

**Tech Stack:** React 19, Vite 8, JavaScript ESM, Node `node:test`, oxlint, Cloudflare Workers, D1/SQLite, Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-02-catalog-local-orders-ux-design.md`

## Global Constraints

- Nenhuma exclusão de produto, cliente, pedido, item, pagamento ou movimento existente durante as migrações.
- Migrações D1 devem ser aditivas e executadas apenas pelo mecanismo normal de migrations.
- Frontend e Worker devem tolerar registros legados durante a transição.
- Snapshots históricos continuam sendo fonte de exibição para pedidos antigos.
- Preço oficial de produto continua em centavos no servidor; apresentação nunca participa de cálculo de preço.
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

**Novos módulos de domínio**
- `shared/productCatalog.js` — categorias fixas, fallback de categoria legada, sugestão de apresentação, normalização/validação e formatação de apresentação.
- `shared/productCatalog.test.js` — contrato puro do catálogo.
- `shared/orderCustomerIdentity.js` — tipos de identidade, regex/limites e normalização comum frontend/Worker.
- `shared/orderCustomerIdentity.test.js` — contrato puro de identidade.
- `src/components/ProductForm.jsx` — formulário visual de criação/edição de produto.
- `src/product-form.css` — layout responsivo e estados visuais do formulário.
- `src/utils/receivables.js` — agrupamento de pendências sem misturar identidades avulsas.
- `src/utils/receivables.test.js` — regras de agrupamento.
- `migrations/0005_product_presentation.sql` — campos estruturados e migração segura do catálogo legado.
- `migrations/0006_order_customer_identity.sql` — discriminador de identidade dos pedidos.

**Arquivos principais modificados**
- `src/App.jsx` — período de Dashboard em nível de sessão, payload/estado de produto e wiring dos componentes.
- `src/pages/Dashboard.jsx` — período controlado por props.
- `src/pages/NewOrder.jsx` — tipo antes da identidade, Nome/Mesa/Cliente e Cancelar no cadastro rápido.
- `src/pages/Products.jsx` — filtro de categoria e listagem com metadados estruturados.
- `src/pages/Receivables.jsx` — três cards, linguagem neutra e agrupamento por identidade.
- `src/components/Icon.jsx` — ícones semânticos das categorias.
- `src/components/OrderProductCatalog.jsx` — apresentação consistente no catálogo de venda, se hoje renderizar `size` diretamente.
- `src/utils/orderCart.js` — payload explícito `customerIdentity` e snapshot textual de apresentação no carrinho.
- `worker/validation.js` — validação de categoria/apresentação quando necessário para a rota de produto.
- `worker/index.js` — `productInput` estruturado.
- `worker/orderCheckout.js` — validação da identidade no checkout.
- `worker/repositories.js` — mapeamento/persistência dos novos campos e snapshot oficial.

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
- Produces: `closeQuickClient()` em `NewOrder`, que limpa apenas estado do formulário rápido e duplicidade.

- [ ] **Step 1: Write failing source-contract tests for session-owned Dashboard period**

```js
// src/dashboardPeriodPersistence.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const dashboard = fs.readFileSync(new URL('./pages/Dashboard.jsx', import.meta.url), 'utf8')

test('dashboard period is owned by App and passed as a controlled value', () => {
  assert.match(app, /useState\('30d'\)/)
  assert.match(app, /<Dashboard[\s\S]*period=\{dashboardPeriod\}[\s\S]*onPeriodChange=\{setDashboardPeriod\}/)
  assert.doesNotMatch(dashboard, /const \[period, setPeriod\] = useState/)
  assert.match(dashboard, /DashboardPeriodSelector value=\{period\} onChange=\{onPeriodChange\}/)
})

test('ending the session restores the default 30 day period', () => {
  assert.match(app, /setDashboardPeriod\('30d'\)/)
})
```

- [ ] **Step 2: Run the Dashboard test and verify RED**

Run: `node --test src/dashboardPeriodPersistence.test.js`  
Expected: FAIL because `Dashboard` still owns `period` locally.

- [ ] **Step 3: Make Dashboard controlled and reset only with session/business clearing**

```jsx
// src/App.jsx
const [dashboardPeriod, setDashboardPeriod] = useState('30d')

const clearBusinessData = () => {
  // existing clears...
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
  // keep analytics using `period`
  return <DashboardPeriodSelector value={period} onChange={onPeriodChange} />
}
```

- [ ] **Step 4: Write failing quick-client cancel contract**

```js
// src/quickClientCancel.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')

test('quick client form exposes an explicit cancel action that clears its own state', () => {
  assert.match(source, /const closeQuickClient = \(\) =>/)
  assert.match(source, /setQuickClient\(\{ open: false, name: '', phone: '' \}\)/)
  assert.match(source, /setQuickClientError\(''\)/)
  assert.match(source, /setDuplicateClient\(null\)/)
  assert.match(source, />Cancelar<\/Button>/)
})
```

- [ ] **Step 5: Run quick-client test and verify RED**

Run: `node --test src/quickClientCancel.test.js`  
Expected: FAIL because the explicit cancel button/function does not exist.

- [ ] **Step 6: Implement minimal quick-client cancel behavior without touching checkout state**

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

Do not call setters for `items`, `type`, `orderDate`, `deliveryFee` or `adjustment` from `closeQuickClient`.

- [ ] **Step 7: Run focused and existing Dashboard/NewOrder tests**

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
- Produces: `PRODUCT_CATEGORIES`, `PRODUCT_CATEGORY_OPTIONS`, `PRESENTATION_TYPES`.
- Produces: `categoryForUi(category)`, `suggestPresentationType(category)`, `validateProductPresentation(input)`, `formatProductPresentation(product)`, `deriveLegacySize(presentation)`.
- `validateProductPresentation` returns `{ ok: true, value }` or `{ ok: false, field, message }`; `value` contains `presentationType`, `presentationValue`, `presentationUnit`, `size`.

- [ ] **Step 1: Write failing pure catalog tests**

```js
// shared/productCatalog.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  categoryForUi,
  deriveLegacySize,
  formatProductPresentation,
  suggestPresentationType,
  validateProductPresentation,
} from './productCatalog.js'

test('legacy categories fall back safely and approved categories keep their value', () => {
  assert.equal(categoryForUi('Bebidas'), 'Bebidas')
  assert.equal(categoryForUi('Categoria antiga'), 'Outros')
  assert.equal(suggestPresentationType('Bebidas'), 'volume')
  assert.equal(suggestPresentationType('Refeições'), 'size')
})

test('volume and weight normalize decimal comma to canonical decimal point', () => {
  assert.deepEqual(validateProductPresentation({ presentationType: 'volume', presentationValue: '1,5', presentationUnit: 'L' }), {
    ok: true,
    value: { presentationType: 'volume', presentationValue: '1.5', presentationUnit: 'L', size: '1,5 L' },
  })
  assert.equal(formatProductPresentation({ presentationType: 'weight', presentationValue: '0.5', presentationUnit: 'kg' }), '0,5 kg')
})

test('size other enforces a non-empty maximum 24 character value', () => {
  assert.equal(validateProductPresentation({ presentationType: 'size', presentationValue: 'Família', presentationUnit: '' }).ok, true)
  assert.equal(validateProductPresentation({ presentationType: 'size', presentationValue: 'x'.repeat(25), presentationUnit: '' }).ok, false)
})

test('unit derives legacy Un and invalid zero volume fails', () => {
  const unit = validateProductPresentation({ presentationType: 'unit', presentationValue: '', presentationUnit: '' })
  assert.equal(unit.value.size, 'Un')
  assert.equal(deriveLegacySize(unit.value), 'Un')
  assert.equal(validateProductPresentation({ presentationType: 'volume', presentationValue: '0', presentationUnit: 'ml' }).ok, false)
})
```

- [ ] **Step 2: Run catalog tests and verify RED**

Run: `node --test shared/productCatalog.test.js`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement the shared catalog contract**

```js
// shared/productCatalog.js
export const PRODUCT_CATEGORIES = [
  'Refeições', 'Lanches', 'Combos', 'Porções', 'Bebidas',
  'Sobremesas', 'Adicionais', 'Molhos', 'Outros',
]

export const PRODUCT_CATEGORY_OPTIONS = PRODUCT_CATEGORIES.map((value) => ({ value, label: value }))
export const PRESENTATION_TYPES = ['unit', 'size', 'volume', 'weight']
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
  const presentationType = PRESENTATION_TYPES.includes(input.presentationType) ? input.presentationType : ''
  if (!presentationType) return { ok: false, field: 'presentationType', message: 'Selecione uma apresentação válida.' }
  if (presentationType === 'unit') return { ok: true, value: { presentationType, presentationValue: '', presentationUnit: '', size: 'Un' } }

  if (presentationType === 'size') {
    const presentationValue = String(input.presentationValue ?? '').trim()
    if (!presentationValue || presentationValue.length > 24) return { ok: false, field: 'presentationValue', message: 'Informe um tamanho com até 24 caracteres.' }
    const value = { presentationType, presentationValue, presentationUnit: '', size: presentationValue }
    return { ok: true, value }
  }

  const normalized = String(input.presentationValue ?? '').trim().replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized) || Number(normalized) <= 0) return { ok: false, field: 'presentationValue', message: 'Informe um valor maior que zero.' }
  const allowedUnits = presentationType === 'volume' ? ['ml', 'L'] : ['g', 'kg']
  if (!allowedUnits.includes(input.presentationUnit)) return { ok: false, field: 'presentationUnit', message: 'Selecione uma unidade válida.' }
  const value = { presentationType, presentationValue: String(Number(normalized)), presentationUnit: input.presentationUnit }
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

- [ ] **Step 4: Write the migration and a static safety test**

```sql
-- migrations/0005_product_presentation.sql
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

```js
// worker/productPresentationMigration.test.js
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

- [ ] **Step 5: Run focused tests**

Run: `node --test shared/productCatalog.test.js worker/productPresentationMigration.test.js`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/productCatalog.js shared/productCatalog.test.js migrations/0005_product_presentation.sql worker/productPresentationMigration.test.js
git commit -m "feat: define structured product presentations"
```

---

### Task 3: Persistir apresentação estruturada no Worker/API

**Files:**
- Modify: `worker/validation.js`
- Modify: `worker/index.js`
- Modify: `worker/repositories.js`
- Modify: `worker/repositories.test.js`
- Modify: `worker/index.test.js`

**Interfaces:**
- Consumes: `PRODUCT_CATEGORIES` and `validateProductPresentation()` from `shared/productCatalog.js`.
- Produces API product shape `{ id, category, size, name, price, presentationType, presentationValue, presentationUnit }`.

- [ ] **Step 1: Add failing repository mapping/write tests**

```js
// add to worker/repositories.test.js
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

Also extend existing create/update product DB expectations so INSERT/UPDATE include `presentation_type`, `presentation_value`, `presentation_unit`, while `size` remains populated from the normalized presentation.

- [ ] **Step 2: Run repository tests and verify RED**

Run: `node --test worker/repositories.test.js`  
Expected: FAIL because product queries/mappers do not know the structured fields.

- [ ] **Step 3: Add product input validation at the route boundary**

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

- [ ] **Step 4: Update repository SELECT/INSERT/UPDATE mapping**

```js
export const mapProductRow = (row) => ({
  id: row.id,
  category: row.category,
  size: row.size || '',
  name: row.name,
  price: centsToMoney(row.price_cents),
  presentationType: row.presentation_type || (row.size ? 'size' : 'unit'),
  presentationValue: row.presentation_value || (row.size && !['Un', 'Unidade'].includes(row.size) ? row.size : ''),
  presentationUnit: row.presentation_unit || '',
})
```

Update every product SELECT to include the three new columns. Create/update statements must write `input.presentationType`, `input.presentationValue`, `input.presentationUnit`, and `input.size` in one operation.

- [ ] **Step 5: Add route-level rejection test for malformed presentation**

```js
// add to worker/index.test.js using the existing authenticated request helpers
test('product route rejects invalid volume before repository write', async () => {
  const response = await requestAuthenticated('/api/products', {
    method: 'POST',
    body: { name: 'Suco', category: 'Bebidas', price: 8, presentationType: 'volume', presentationValue: '0', presentationUnit: 'ml' },
  })
  assert.equal(response.status, 400)
})
```

Use the existing helper names in `worker/index.test.js`; do not introduce a second request harness.

- [ ] **Step 6: Run worker tests**

Run: `node --test worker/repositories.test.js worker/index.test.js shared/productCatalog.test.js`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/validation.js worker/index.js worker/repositories.js worker/repositories.test.js worker/index.test.js
git commit -m "feat: persist structured product presentation"
```

---

### Task 4: Reformular formulário, listagem e filtro de Produtos

**Files:**
- Create: `src/components/ProductForm.jsx`
- Create: `src/product-form.css`
- Create: `src/productCatalogUi.test.js`
- Modify: `src/App.jsx`
- Modify: `src/pages/Products.jsx`
- Modify: `src/components/Icon.jsx`
- Modify: `src/components/OrderProductCatalog.jsx`
- Modify: `src/utils/orderCart.js`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: shared catalog helpers from Task 2.
- Produces: `ProductForm({ value, onChange, onSubmit, onCancel, disabled, editing })`.
- App sends `{ category, name, price, presentationType, presentationValue, presentationUnit }` to product API helpers.

- [ ] **Step 1: Write failing UI contract test**

```js
// src/productCatalogUi.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const form = fs.readFileSync(new URL('./components/ProductForm.jsx', import.meta.url), 'utf8')
const products = fs.readFileSync(new URL('./pages/Products.jsx', import.meta.url), 'utf8')

test('product form exposes category grid, presentation controls, preview and cancel', () => {
  assert.match(form, /PRODUCT_CATEGORIES/)
  assert.match(form, /presentationType/)
  assert.match(form, /formatProductPresentation/)
  assert.match(form, /Salvar produto|Salvar alterações/)
  assert.match(form, />Cancelar</)
})

test('product list has a category filter and semantic category icon', () => {
  assert.match(products, /Todos/)
  assert.match(products, /categoryFilter/)
  assert.match(products, /categoryForUi/)
  assert.match(products, /formatProductPresentation/)
})
```

- [ ] **Step 2: Run UI test and verify RED**

Run: `node --test src/productCatalogUi.test.js`  
Expected: FAIL because `ProductForm.jsx` does not exist.

- [ ] **Step 3: Implement controlled ProductForm with local validation feedback**

Core state transitions must follow this pattern:

```jsx
const setCategory = (category) => onChange({
  ...value,
  category,
  presentationType: suggestPresentationType(category),
  presentationValue: suggestPresentationType(category) === 'size' ? 'P' : '',
  presentationUnit: suggestPresentationType(category) === 'volume' ? 'ml' : '',
})

const validation = validateProductPresentation(value)
const preview = validation.ok
  ? `${value.name || 'Produto'} · ${categoryForUi(value.category)} · ${formatProductPresentation(validation.value)}`
  : `${value.name || 'Produto'} · ${categoryForUi(value.category)}`
```

Category options must render text plus `Icon`, with `aria-pressed` or radio semantics. Presentation options are `Unidade`, `Tamanho`, `Volume`, `Peso`. Tamanho exposes `P/M/G/Outro`; custom text is capped at 24 characters. Volume/Peso show a decimal input plus the correct unit selector.

- [ ] **Step 4: Extend local icons without a dependency**

Add semantic icon names to `src/components/Icon.jsx`: `meal`, `snack`, `combo`, `portion`, `drink`, `dessert`, `sauce`, reusing existing `plus` for Adicionais and `package` for Outros. Keep the existing SVG API (`name`, `size`) unchanged.

- [ ] **Step 5: Replace the product modal body in App and send structured payload**

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

When editing a legacy unknown category, initialize `category` with `categoryForUi(product.category)`, so saving unchanged converts it explicitly to `Outros` as defined by the spec.

- [ ] **Step 6: Add category filter in Products and combine it with search**

`Products` owns `categoryFilter` initialized to `'Todos'`. Filter rules:

```js
const visibleProducts = products.filter((product) => {
  const matchesCategory = categoryFilter === 'Todos' || categoryForUi(product.category) === categoryFilter
  const haystack = [
    product.name,
    categoryForUi(product.category),
    formatProductPresentation(product),
    String(product.price),
  ].join(' ').toLocaleLowerCase('pt-BR')
  return matchesCategory && (!normalizedSearch || haystack.includes(normalizedSearch))
})
```

Use `SystemSelect` for the filter so desktop/mobile behavior follows the existing anchored-dropdown/bottom-sheet pattern.

- [ ] **Step 7: Make cart/catalog display consume the same presentation formatter**

In `addCartItem`, snapshot the friendly presentation into compatibility `size`:

```js
size: formatProductPresentation(product) === 'Unidade' ? 'Un' : formatProductPresentation(product),
```

Where `OrderProductCatalog` renders `product.size`, replace direct formatting with `formatProductPresentation(product)`.

- [ ] **Step 8: Add responsive CSS and run focused tests**

`src/product-form.css` must include: category grid, two-column mobile grid, pressed/selected state, presentation segmented control, inline validation, preview surface, and touch targets >= existing system controls. Import it once from `App.jsx` or the component according to the existing CSS convention.

Run: `node --test src/productCatalogUi.test.js shared/productCatalog.test.js src/systemSelectMigration.test.js`  
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/ProductForm.jsx src/product-form.css src/productCatalogUi.test.js src/App.jsx src/pages/Products.jsx src/components/Icon.jsx src/components/OrderProductCatalog.jsx src/utils/orderCart.js src/App.css
git commit -m "feat: redesign product catalog management"
```

---

### Task 5: Definir identidade de cliente do pedido e migration D1

**Files:**
- Create: `shared/orderCustomerIdentity.js`
- Create: `shared/orderCustomerIdentity.test.js`
- Create: `migrations/0006_order_customer_identity.sql`
- Create: `worker/orderCustomerIdentityMigration.test.js`

**Interfaces:**
- Produces: `CUSTOMER_IDENTITY_TYPES`, `TABLE_ID_PATTERN`, `validateCustomerIdentity(orderType, identity)`.
- `validateCustomerIdentity` returns `{ ok: true, value }` or `{ ok: false, field, message }`.

- [ ] **Step 1: Write failing shared identity tests**

```js
// shared/orderCustomerIdentity.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCustomerIdentity } from './orderCustomerIdentity.js'

test('delivery and pickup require a registered client', () => {
  assert.equal(validateCustomerIdentity('Entrega', { type: 'guest_name', value: 'Ana' }).ok, false)
  assert.equal(validateCustomerIdentity('Retirada', { type: 'table', value: '04' }).ok, false)
  assert.equal(validateCustomerIdentity('Entrega', { type: 'registered_client', clientId: 'c1' }).ok, true)
})

test('local accepts registered client, guest name and safe table identifiers', () => {
  assert.deepEqual(validateCustomerIdentity('Local', { type: 'guest_name', value: '  João  ' }).value, { type: 'guest_name', value: 'João' })
  assert.equal(validateCustomerIdentity('Local', { type: 'table', value: 'A-2' }).ok, true)
  assert.equal(validateCustomerIdentity('Local', { type: 'table', value: 'Mesa 2' }).ok, false)
  assert.equal(validateCustomerIdentity('Local', { type: 'guest_name', value: 'x'.repeat(81) }).ok, false)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test shared/orderCustomerIdentity.test.js`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement one shared validation source for frontend and Worker**

```js
// shared/orderCustomerIdentity.js
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
  if (type === 'guest_name') return value && value.length <= 80
    ? { ok: true, value: { type, value } }
    : { ok: false, field: 'customerIdentity.value', message: 'Informe um nome com até 80 caracteres.' }
  return value.length <= 12 && TABLE_ID_PATTERN.test(value)
    ? { ok: true, value: { type, value } }
    : { ok: false, field: 'customerIdentity.value', message: 'Informe uma mesa com até 12 caracteres alfanuméricos.' }
}
```

- [ ] **Step 4: Add additive order identity migration and safety test**

```sql
-- migrations/0006_order_customer_identity.sql
ALTER TABLE orders ADD COLUMN customer_identity_type TEXT NOT NULL DEFAULT 'registered_client';
UPDATE orders SET customer_identity_type = 'guest_name' WHERE client_id IS NULL;
```

```js
// worker/orderCustomerIdentityMigration.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql = fs.readFileSync(new URL('../migrations/0006_order_customer_identity.sql', import.meta.url), 'utf8')

test('order identity migration preserves rows and classifies null-client legacy orders', () => {
  assert.match(sql, /ADD COLUMN customer_identity_type/)
  assert.match(sql, /WHERE client_id IS NULL/)
  assert.doesNotMatch(sql, /DELETE FROM orders|DROP TABLE orders/i)
})
```

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test shared/orderCustomerIdentity.test.js worker/orderCustomerIdentityMigration.test.js`  
Expected: PASS.

```bash
git add shared/orderCustomerIdentity.js shared/orderCustomerIdentity.test.js migrations/0006_order_customer_identity.sql worker/orderCustomerIdentityMigration.test.js
git commit -m "feat: define local order customer identity"
```

---

### Task 6: Validar e persistir Nome/Mesa/Cliente no checkout do Worker

**Files:**
- Modify: `worker/orderCheckout.js`
- Modify: `worker/orderCheckout.test.js`
- Modify: `worker/repositories.js`
- Modify: `worker/orderRepositories.test.js`
- Modify: `worker/multiItemCheckoutRepository.test.js`

**Interfaces:**
- Consumes: `validateCustomerIdentity(orderType, customerIdentity)` from Task 5.
- `validateCheckoutInput()` produces `customerIdentity` instead of top-level `clientId` as the authoritative checkout identity.
- `mapOrderRow()` produces `customerIdentityType` while keeping `client` and `clientId` compatibility fields.

- [ ] **Step 1: Add failing checkout validation tests**

```js
// add to worker/orderCheckout.test.js
test('local checkout accepts guest name and table while delivery rejects them', () => {
  const guest = validateCheckoutInput(validBody({
    type: 'Local',
    customerIdentity: { type: 'guest_name', value: 'João' },
  }), 'key-guest')
  assert.deepEqual(guest.customerIdentity, { type: 'guest_name', value: 'João' })

  assert.throws(() => validateCheckoutInput(validBody({
    type: 'Entrega',
    customerIdentity: { type: 'table', value: '04' },
  }), 'key-delivery'))
})
```

Update the local `validBody` fixture to use `customerIdentity: { type: 'registered_client', clientId: 'client-1' }` instead of relying only on `clientId`.

- [ ] **Step 2: Run checkout tests and verify RED**

Run: `node --test worker/orderCheckout.test.js`  
Expected: FAIL because checkout still requires top-level `clientId`.

- [ ] **Step 3: Validate identity before item/database work**

```js
// worker/orderCheckout.js
const type = validateOrderType(body.type)
const identityResult = validateCustomerIdentity(type, body.customerIdentity)
if (!identityResult.ok) throw checkoutError(identityResult.field, identityResult.message)
const customerIdentity = identityResult.value
```

Return `customerIdentity` from `validateCheckoutInput` and remove the unconditional `requireNonEmpty(body.clientId)` path. Keep compatibility only in `legacyCheckoutInput` inside repositories for older internal tests/callers.

- [ ] **Step 4: Add failing repository tests for snapshots and null client_id**

Test three cases in `worker/orderRepositories.test.js`:

```js
assert.equal(localGuest.clientId, null)
assert.equal(localGuest.client, 'João')
assert.equal(localGuest.customerIdentityType, 'guest_name')

assert.equal(localTable.client, 'Mesa A-2')
assert.equal(localTable.customerIdentityType, 'table')

assert.equal(registered.clientId, 'client-1')
assert.equal(registered.customerIdentityType, 'registered_client')
```

Also assert that two calls with the same idempotency key still return one order for a local guest checkout.

- [ ] **Step 5: Resolve identity server-side and write the discriminador**

Inside `createOrder`:

```js
let client = null
let clientId = null
let clientSnapshot = ''
const identity = input.customerIdentity

if (identity.type === 'registered_client') {
  client = await db.prepare('SELECT id, name FROM clients WHERE id = ? AND business_id = ? LIMIT 1')
    .bind(identity.clientId, businessId).first()
  if (!client) throw repositoryError(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.')
  clientId = client.id
  clientSnapshot = client.name
} else if (identity.type === 'guest_name') {
  clientSnapshot = identity.value
} else {
  clientSnapshot = `Mesa ${identity.value}`
}
```

Insert `customer_identity_type` in `orders`. Payment movement descriptions must use `clientSnapshot`, not `client.name`, so guest/table paid orders work. Extend `orderSelect` and `mapOrderRow`:

```js
customerIdentityType: row.customer_identity_type || (row.client_id ? 'registered_client' : 'guest_name'),
```

- [ ] **Step 6: Snapshot structured product presentation in order_items**

When pricing each item, SELECT structured presentation fields. Compute the friendly compatibility string with `formatProductPresentation(mapProductRow(product))` and persist that into `size_snapshot`; do not trust cart/frontend presentation data.

- [ ] **Step 7: Run Worker checkout/repository regression**

Run: `node --test worker/orderCheckout.test.js worker/orderRepositories.test.js worker/multiItemCheckoutRepository.test.js worker/repositories.test.js`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add worker/orderCheckout.js worker/orderCheckout.test.js worker/repositories.js worker/orderRepositories.test.js worker/multiItemCheckoutRepository.test.js
git commit -m "feat: support local order identities in checkout"
```

---

### Task 7: Implementar UX de identificação no Consumo no local

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/utils/orderCart.js`
- Modify: `src/orderCart.test.js`
- Create: `src/localOrderIdentityUi.test.js`
- Modify: `src/new-order.css`

**Interfaces:**
- Consumes: `validateCustomerIdentity()` from Task 5.
- `buildOrderPayload(draft, paymentMethod)` sends `customerIdentity` exactly as specified.

- [ ] **Step 1: Add failing payload tests**

```js
// add to src/orderCart.test.js
test('order payload sends explicit local customer identity', () => {
  const payload = buildOrderPayload({
    type: 'Local', orderDate: '2026-09-02',
    customerIdentity: { type: 'table', value: 'A-2' },
    items: [{ productId: 'p1', quantity: 1, note: '' }],
    deliveryFee: 0,
    adjustment: { type: 'none', mode: 'fixed', value: 0, reason: '' },
  })
  assert.deepEqual(payload.customerIdentity, { type: 'table', value: 'A-2' })
  assert.equal('clientId' in payload, false)
})
```

- [ ] **Step 2: Run payload test and verify RED**

Run: `node --test src/orderCart.test.js`  
Expected: FAIL because payload still sends `clientId`.

- [ ] **Step 3: Update payload builder**

```js
const payload = {
  customerIdentity: draft.customerIdentity,
  type: draft.type,
  orderDate: draft.orderDate,
  // existing items, deliveryFee, adjustment
}
```

Keep all existing normalization of items, notes, fee and adjustment unchanged.

- [ ] **Step 4: Write failing NewOrder source contract**

```js
// src/localOrderIdentityUi.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')

test('local orders expose Nome Mesa and Cliente cadastrado after order type', () => {
  assert.match(source, /guest_name/)
  assert.match(source, /table/)
  assert.match(source, /registered_client/)
  assert.match(source, /Nome/)
  assert.match(source, /Mesa/)
  assert.match(source, /Cliente cadastrado/)
})
```

- [ ] **Step 5: Implement type-first identity state**

Use separate local fields:

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

`changeType('Local')` sets mode default `guest_name`. `changeType('Entrega'|'Retirada')` sets mode `registered_client`. Changing identity mode clears only `guestName`, `tableId` or client selection belonging to the mode being left; it must not mutate cart or finance state.

- [ ] **Step 6: Reorder the form and render accessible identity controls**

Render `Tipo do pedido` before identity. For Local, show a three-way pressed/radio control. `guest_name` renders text input maxLength 80; `table` renders text input maxLength 12 and helpful example; `registered_client` renders the existing client combobox and `+ Novo cliente` flow.

Do not render quick-client creation for guest/table modes.

- [ ] **Step 7: Run focused frontend tests**

Run: `node --test src/orderCart.test.js src/localOrderIdentityUi.test.js src/quickClientCancel.test.js shared/orderCustomerIdentity.test.js`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/NewOrder.jsx src/utils/orderCart.js src/orderCart.test.js src/localOrderIdentityUi.test.js src/new-order.css
git commit -m "feat: identify local orders by name or table"
```

---

### Task 8: Corrigir agrupamento e simplificar A receber

**Files:**
- Create: `src/utils/receivables.js`
- Create: `src/utils/receivables.test.js`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/receivables.css`

**Interfaces:**
- Produces: `groupPendingOrders(orders)` returning `[{ key, label, orders, total }]`.
- Registered clients group by `clientId`; guest/table orders group by order id.

- [ ] **Step 1: Write failing pure grouping tests**

```js
// src/utils/receivables.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { groupPendingOrders } from './receivables.js'

test('registered client debts group together but guest and table debts stay independent', () => {
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

- [ ] **Step 2: Run and verify RED**

Run: `node --test src/utils/receivables.test.js`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement grouping helper**

```js
// src/utils/receivables.js
import { getPendingAmount, isOrderPaid } from './paymentWorkflow.js'

export const groupPendingOrders = (orders = []) => {
  const grouped = new Map()
  orders.filter((order) => !isOrderPaid(order)).forEach((order) => {
    const registered = order.customerIdentityType === 'registered_client' && order.clientId
    const key = registered ? `client:${order.clientId}` : `order:${order.id}`
    const current = grouped.get(key) || { key, label: order.client, orders: [], total: 0 }
    current.orders.push(order)
    current.total += getPendingAmount(order)
    grouped.set(key, current)
  })
  return [...grouped.values()].sort((a, b) => b.total - a.total)
}
```

For legacy rows missing `customerIdentityType`, treat a non-null `clientId` as registered. If `clientId` is unexpectedly absent on a legacy row, group by order id rather than snapshot text.

- [ ] **Step 4: Refactor Receivables to use the helper and three cards**

Remove `debtorCount` and the `Clientes devendo` StatCard. Keep:

```jsx
<StatCard label="A receber" ... />
<StatCard label="Pedidos pendentes" ... />
<StatCard label="Recebido hoje" ... />
```

Rename heading to `Pendências em aberto`, toolbar count to `{groups.length} pendência(s)/grupo(s)` with natural copy, and search placeholder to `Buscar identificação, pedido ou produto`.

- [ ] **Step 5: Make filtering happen before grouping without changing independence rules**

Keep the existing search over `order.client`, products, type, date and id, then pass the filtered pending orders to `groupPendingOrders`. Do not group by `order.client` string directly anywhere in `Receivables.jsx`.

- [ ] **Step 6: Adjust the three-card grid and run tests**

Update `receivables.css` only if the existing grid does not naturally produce three balanced columns on desktop; retain mobile stacking behavior.

Run: `node --test src/utils/receivables.test.js` and `node --test`  
Expected: focused test PASS; full suite PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/receivables.js src/utils/receivables.test.js src/pages/Receivables.jsx src/receivables.css
git commit -m "refactor: clarify receivables by order identity"
```

---

### Task 9: Integrated regression guard and production-readiness verification

**Files:**
- Create: `src/catalogLocalOrdersIntegration.test.js`
- Modify only if failures reveal a real regression: files touched in Tasks 1–8.

**Interfaces:**
- No new runtime interface; this task locks the approved cross-feature behavior before merge/deploy.

- [ ] **Step 1: Add a compact source-level integration guard**

```js
// src/catalogLocalOrdersIntegration.test.js
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

- [ ] **Step 2: Run the entire test suite**

Run: `npm test`  
Expected: all tests PASS, zero failed/cancelled.

- [ ] **Step 3: Run lint**

Run: `npm run lint`  
Expected: `0 warnings and 0 errors`.

- [ ] **Step 4: Run production build**

Run: `npm run build`  
Expected: Vite build completes successfully.

- [ ] **Step 5: Validate Worker bundle and D1 migration discovery**

Run: `npx --yes wrangler@4.128.0 deploy --dry-run`  
Expected: dry-run exits successfully and shows `env.DB (amor-e-sabor-delivery)`.

Run locally against the development D1 first: `npx --yes wrangler@4.128.0 d1 migrations apply amor-e-sabor-delivery --local`  
Expected: migrations `0005_product_presentation.sql` and `0006_order_customer_identity.sql` apply without destructive errors. Do not apply remote migrations from a feature branch.

- [ ] **Step 6: Commit the integration guard**

```bash
git add src/catalogLocalOrdersIntegration.test.js
git commit -m "test: guard catalog and local order round"
```

- [ ] **Step 7: Review the final branch diff against the spec**

Run: `git diff master...HEAD --stat` and `git diff master...HEAD -- migrations shared src worker`  
Expected: only files required by this plan/spec; no unrelated refactors, dependency additions or workflow changes.

- [ ] **Step 8: Push and require green feature-branch CI before integration**

Push `feature/catalog-local-orders-round`. Verify `Validate application` succeeds for the final SHA before fast-forward/merge to `master`.

After `master` CI is green, use the existing manual `Deploy production` workflow. That workflow must show pending D1 migrations, apply them, verify the auth row, deploy the Worker, and then perform whatever production-login verification is available from configured secrets. Do not claim production completion until the Deploy step and the overall job both conclude `success`.
