# Nova venda em fluxo por etapas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar a tela Nova venda em um wizard interno de exatamente três etapas — Cliente, Produtos e Finalizar — preservando integralmente o rascunho, o contrato de checkout e as regras atuais de pedidos.

**Architecture:** `NewOrder` continua dono único do rascunho e passa a controlar `currentStep`, validações de acesso e dirty state. Componentes focados renderizam cada etapa sem duplicar estado; `App` continua dono de `activeTab` e recebe apenas o sinal de rascunho sujo para proteger saídas globais. Nenhuma etapa intermediária persiste dados; `POST /api/orders` continua sendo chamado somente na etapa Finalizar.

**Tech Stack:** React 19.2.8, React DOM 19.2.8, Vite 8.2.2, Node.js 22 `node:test`, CSS existente do projeto, Cloudflare Worker/D1 sem mudança de contrato, Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-04-new-order-step-flow-design.md`

## Global Constraints

- Trabalhar somente na branch `feature/new-order-step-flow`; não alterar `master` diretamente.
- O fluxo oficial continua `feature/fix branch -> validação -> Deploy staging -> homologação humana -> merge em master -> Deploy production explícito`.
- `staging` é ambiente, não branch: Worker `sistema-para-delivery-staging` + D1 `amor-e-sabor-delivery-staging`.
- D1 continua sendo a fonte oficial dos dados persistidos; o navegador não ganha persistência permanente de rascunho.
- O Worker continua autoridade de preço e total; o frontend calcula apenas prévia.
- `POST /api/orders` e a chave de idempotência não mudam.
- Nenhuma migration D1 é criada nesta rodada.
- O fluxo tem exatamente três etapas principais: `Cliente`, `Produtos`, `Finalizar`.
- A regra atual de cliente inicialmente selecionado deve ser preservada.
- `Entrega` e `Retirada` continuam exigindo cliente cadastrado; `Local` continua aceitando Nome, Mesa ou Cliente cadastrado.
- Ao trocar de `Entrega` para `Retirada` ou `Local`, a taxa é zerada; o carrinho nunca é apagado automaticamente.
- Valores fixos continuam formatados em Real brasileiro; percentual continua numérico.
- Mobile deve permanecer utilizável entre 320 e 480 px, sem conteúdo horizontal obrigatório.
- Não adicionar dependência de terceiros para este fluxo.
- Não implementar `beforeunload`, persistência em `localStorage` ou recuperação de rascunho após reload nesta rodada.
- Nenhuma alteração de produção antes da homologação no ambiente de staging.

---

### Task 1: Criar a política pura do fluxo, acesso às etapas e dirty state

**Files:**
- Create: `src/utils/newOrderStepFlow.js`
- Create: `src/utils/newOrderStepFlow.test.js`

**Interfaces:**
- Produces: `NEW_ORDER_STEPS`
- Produces: `getOrderItemCount(items: Array): number`
- Produces: `getOrderItemsSubtotal(items: Array): number`
- Produces: `getNewOrderStepAccess({ identityValid, orderDate, itemCount }): { customer: true, products: boolean, review: boolean }`
- Produces: `canNavigateToNewOrderStep(step, access): boolean`
- Produces: `createNewOrderDirtySnapshot(draft): string`
- Produces: `isNewOrderDraftDirty(draft, initialSnapshot): boolean`
- Produces: `shouldConfirmNewOrderExit({ activeTab, targetTab, draftDirty }): boolean`

- [ ] **Step 1: Write the failing unit tests for step access and cart summary values**

Create `src/utils/newOrderStepFlow.test.js` with these initial tests:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NEW_ORDER_STEPS,
  canNavigateToNewOrderStep,
  getNewOrderStepAccess,
  getOrderItemCount,
  getOrderItemsSubtotal,
} from './newOrderStepFlow.js'

test('step access requires valid customer data before products and at least one item before review', () => {
  const invalidCustomer = getNewOrderStepAccess({ identityValid: false, orderDate: '2026-09-04', itemCount: 2 })
  assert.deepEqual(invalidCustomer, { customer: true, products: false, review: false })

  const emptyCart = getNewOrderStepAccess({ identityValid: true, orderDate: '2026-09-04', itemCount: 0 })
  assert.deepEqual(emptyCart, { customer: true, products: true, review: false })

  const ready = getNewOrderStepAccess({ identityValid: true, orderDate: '2026-09-04', itemCount: 3 })
  assert.deepEqual(ready, { customer: true, products: true, review: true })
  assert.equal(canNavigateToNewOrderStep(NEW_ORDER_STEPS.REVIEW, ready), true)
  assert.equal(canNavigateToNewOrderStep(NEW_ORDER_STEPS.REVIEW, emptyCart), false)
})

test('product summary uses quantity and product subtotal only', () => {
  const items = [
    { productId: 1, quantity: 2, unitPrice: 20 },
    { productId: 2, quantity: 1, unitPrice: 15.5 },
  ]

  assert.equal(getOrderItemCount(items), 3)
  assert.equal(getOrderItemsSubtotal(items), 55.5)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test src/utils/newOrderStepFlow.test.js
```

Expected: FAIL because `src/utils/newOrderStepFlow.js` does not exist.

- [ ] **Step 3: Implement the minimal step/access helpers**

Create `src/utils/newOrderStepFlow.js` with:

```js
export const NEW_ORDER_STEPS = Object.freeze({
  CUSTOMER: 'customer',
  PRODUCTS: 'products',
  REVIEW: 'review',
})

export const getOrderItemCount = (items = []) => items.reduce(
  (sum, item) => sum + Number(item.quantity || 0),
  0,
)

export const getOrderItemsSubtotal = (items = []) => items.reduce(
  (sum, item) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 0)),
  0,
)

export const getNewOrderStepAccess = ({ identityValid, orderDate, itemCount }) => {
  const customerReady = Boolean(identityValid && orderDate)
  return {
    customer: true,
    products: customerReady,
    review: Boolean(customerReady && Number(itemCount || 0) > 0),
  }
}

export const canNavigateToNewOrderStep = (step, access) => Boolean(access?.[step])
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test src/utils/newOrderStepFlow.test.js
```

Expected: PASS for the access and subtotal tests.

- [ ] **Step 5: Add failing dirty-state and global-exit policy tests**

Append to `src/utils/newOrderStepFlow.test.js`:

```js
import {
  createNewOrderDirtySnapshot,
  isNewOrderDraftDirty,
  shouldConfirmNewOrderExit,
} from './newOrderStepFlow.js'

const pristineDraft = () => ({
  clientId: 'client-1',
  type: 'Entrega',
  localIdentityType: 'guest_name',
  localIdentityValue: '',
  orderDate: '2026-09-04',
  items: [],
  deliveryFee: 'R$ 0,00',
  adjustment: { type: 'none', mode: 'fixed', value: 'R$ 0,00', reason: '' },
  quickClient: { open: false, name: '', phone: '' },
})

test('dirty state ignores technical defaults but detects meaningful draft changes', () => {
  const initial = pristineDraft()
  const snapshot = createNewOrderDirtySnapshot(initial)

  assert.equal(isNewOrderDraftDirty(initial, snapshot), false)
  assert.equal(isNewOrderDraftDirty({ ...initial, quickClient: { open: true, name: '', phone: '' } }, snapshot), false)
  assert.equal(isNewOrderDraftDirty({ ...initial, clientId: 'client-2' }, snapshot), true)
  assert.equal(isNewOrderDraftDirty({ ...initial, items: [{ productId: 10, quantity: 1, note: '' }] }, snapshot), true)
  assert.equal(isNewOrderDraftDirty({ ...initial, deliveryFee: 'R$ 5,00' }, snapshot), true)
})

test('global exit confirmation only applies when leaving a dirty new order', () => {
  assert.equal(shouldConfirmNewOrderExit({ activeTab: 'new-order', targetTab: 'orders', draftDirty: true }), true)
  assert.equal(shouldConfirmNewOrderExit({ activeTab: 'new-order', targetTab: 'new-order', draftDirty: true }), false)
  assert.equal(shouldConfirmNewOrderExit({ activeTab: 'new-order', targetTab: 'orders', draftDirty: false }), false)
  assert.equal(shouldConfirmNewOrderExit({ activeTab: 'orders', targetTab: 'clients', draftDirty: true }), false)
})
```

Keep a single import block in the final test file; do not leave duplicate imports.

- [ ] **Step 6: Run the focused test and verify RED for the new exports**

Run:

```bash
node --test src/utils/newOrderStepFlow.test.js
```

Expected: FAIL because the dirty-state and exit-policy exports do not exist yet.

- [ ] **Step 7: Implement normalized dirty-state and exit policy**

Add to `src/utils/newOrderStepFlow.js`:

```js
const normalizeText = (value) => String(value ?? '').trim()

export const createNewOrderDirtySnapshot = (draft = {}) => JSON.stringify({
  clientId: String(draft.clientId ?? ''),
  type: String(draft.type ?? ''),
  localIdentityType: String(draft.localIdentityType ?? ''),
  localIdentityValue: normalizeText(draft.localIdentityValue),
  orderDate: String(draft.orderDate ?? ''),
  items: (draft.items ?? []).map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity || 0),
    note: normalizeText(item.note),
  })),
  deliveryFee: String(draft.deliveryFee ?? ''),
  adjustment: {
    type: String(draft.adjustment?.type ?? 'none'),
    mode: String(draft.adjustment?.mode ?? 'fixed'),
    value: String(draft.adjustment?.value ?? ''),
    reason: normalizeText(draft.adjustment?.reason),
  },
  quickClient: {
    name: normalizeText(draft.quickClient?.name),
    phone: normalizeText(draft.quickClient?.phone),
  },
})

export const isNewOrderDraftDirty = (draft, initialSnapshot) => (
  createNewOrderDirtySnapshot(draft) !== initialSnapshot
)

export const shouldConfirmNewOrderExit = ({ activeTab, targetTab, draftDirty }) => (
  activeTab === 'new-order' && targetTab !== 'new-order' && Boolean(draftDirty)
)
```

The `quickClient.open` flag is intentionally excluded: merely opening the quick form without typing does not make the draft dirty.

- [ ] **Step 8: Run focused and full utility tests**

Run:

```bash
node --test src/utils/newOrderStepFlow.test.js
npm test
```

Expected: both PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/utils/newOrderStepFlow.js src/utils/newOrderStepFlow.test.js
git commit -m "feat: add new order step flow policy"
```

---

### Task 2: Adicionar o indicador acessível de três etapas

**Files:**
- Create: `src/components/NewOrderStepIndicator.jsx`
- Create: `src/pages/NewOrderWizard.test.js`
- Modify: `src/new-order.css`

**Interfaces:**
- Consumes: `NEW_ORDER_STEPS` from `src/utils/newOrderStepFlow.js`
- Produces: `NewOrderStepIndicator({ currentStep, access, onNavigate })`
- `access` shape is `{ customer: boolean, products: boolean, review: boolean }`

- [ ] **Step 1: Write the failing structural test for the indicator**

Create `src/pages/NewOrderWizard.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('new order exposes an accessible three-step indicator', async () => {
  const indicator = await read('../components/NewOrderStepIndicator.jsx')

  assert.match(indicator, /Etapas da nova venda/)
  assert.match(indicator, /Cliente/)
  assert.match(indicator, /Produtos/)
  assert.match(indicator, /Finalizar/)
  assert.match(indicator, /aria-current/)
  assert.match(indicator, /disabled=\{!accessible\}/)
  assert.match(indicator, /onNavigate\(step\.id\)/)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node --test src/pages/NewOrderWizard.test.js
```

Expected: FAIL because `NewOrderStepIndicator.jsx` does not exist.

- [ ] **Step 3: Implement the indicator**

Create `src/components/NewOrderStepIndicator.jsx`:

```jsx
import { NEW_ORDER_STEPS } from '../utils/newOrderStepFlow.js'

const STEPS = [
  { id: NEW_ORDER_STEPS.CUSTOMER, number: 1, label: 'Cliente' },
  { id: NEW_ORDER_STEPS.PRODUCTS, number: 2, label: 'Produtos' },
  { id: NEW_ORDER_STEPS.REVIEW, number: 3, label: 'Finalizar' },
]

function NewOrderStepIndicator({ currentStep, access, onNavigate }) {
  return (
    <nav className="new-order-step-indicator" aria-label="Etapas da nova venda">
      {STEPS.map((step, index) => {
        const active = currentStep === step.id
        const accessible = Boolean(access?.[step.id])
        const completed = !active && accessible && STEPS.findIndex((item) => item.id === currentStep) > index
        return (
          <button
            key={step.id}
            type="button"
            className={active ? 'new-order-step-tab active' : (completed ? 'new-order-step-tab completed' : 'new-order-step-tab')}
            aria-current={active ? 'step' : undefined}
            disabled={!accessible}
            onClick={() => onNavigate(step.id)}
          >
            <span className="new-order-step-number" aria-hidden="true">{completed ? '✓' : step.number}</span>
            <span>{step.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default NewOrderStepIndicator
```

- [ ] **Step 4: Add minimal indicator CSS**

Append to `src/new-order.css`:

```css
.new-order-step-indicator {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}

.new-order-step-tab {
  min-height: var(--mobile-touch-target);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--muted);
  font: inherit;
  font-weight: 750;
}

.new-order-step-tab.active,
.new-order-step-tab.completed {
  border-color: var(--primary-border);
  color: var(--primary);
}

.new-order-step-tab.active {
  background: var(--primary-soft);
}

.new-order-step-tab:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.new-order-step-number {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-soft);
  font-size: .76rem;
}
```

- [ ] **Step 5: Run focused tests and lint**

```bash
node --test src/pages/NewOrderWizard.test.js
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/components/NewOrderStepIndicator.jsx src/pages/NewOrderWizard.test.js src/new-order.css
git commit -m "feat: add new order step indicator"
```

---

### Task 3: Extrair e ligar a Etapa 1 — Cliente e atendimento

**Files:**
- Create: `src/components/NewOrderCustomerStep.jsx`
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/pages/NewOrderWizard.test.js`
- Modify: `src/new-order.css`

**Interfaces:**
- Consumes: `NEW_ORDER_STEPS`, `getNewOrderStepAccess`, `getOrderItemCount`, `canNavigateToNewOrderStep`
- Produces: `NewOrderCustomerStep(props)` as a controlled UI component; it does not own cart, checkout, or API state.
- `NewOrder` remains owner of `clientId`, `clientSearch`, `type`, `localIdentityType`, `localIdentityValue`, `orderDate`, `quickClient`, duplicate handling and async quick-client creation.

- [ ] **Step 1: Add failing tests for step-1 composition and validation wiring**

Append to `src/pages/NewOrderWizard.test.js`:

```js
test('new order starts on customer step and keeps catalog and checkout out of that step component', async () => {
  const page = await read('./NewOrder.jsx')
  const customerStep = await read('../components/NewOrderCustomerStep.jsx')

  assert.match(page, /useState\(NEW_ORDER_STEPS\.CUSTOMER\)/)
  assert.match(page, /getNewOrderStepAccess/)
  assert.match(page, /NewOrderCustomerStep/)
  assert.match(customerStep, /Tipo do pedido/)
  assert.match(customerStep, /Data do pedido/)
  assert.match(customerStep, /\+ Novo cliente/)
  assert.match(customerStep, /Continuar/)
  assert.doesNotMatch(customerStep, /OrderProductCatalog/)
  assert.doesNotMatch(customerStep, /OrderCart/)
  assert.doesNotMatch(customerStep, /OrderCheckoutSummary/)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node --test src/pages/NewOrderWizard.test.js
```

Expected: FAIL because `NewOrderCustomerStep.jsx` does not exist and `NewOrder` has no step state.

- [ ] **Step 3: Move the existing customer/operation markup into a controlled component**

Create `src/components/NewOrderCustomerStep.jsx` with this public signature:

```jsx
function NewOrderCustomerStep({
  clients,
  filteredClients,
  clientId,
  clientSearch,
  clientPickerOpen,
  type,
  orderDate,
  localIdentityType,
  localIdentityValue,
  openTableTab,
  quickClient,
  quickClientError,
  disabled,
  canContinue,
  onTypeChange,
  onOrderDateChange,
  onLocalIdentityTypeChange,
  onLocalIdentityValueChange,
  onClientSearchChange,
  onClientFocus,
  onClientBlur,
  onClientSelect,
  onQuickClientToggle,
  onQuickClientChange,
  onQuickClientSubmit,
  onQuickClientCancel,
  onCancel,
  onContinue,
}) {
  // Render only the existing customer/type/date/quick-client UI and the Cancelar venda / Continuar actions.
}
```

Move the existing markup without changing these established behaviors:

```text
Entrega/Retirada -> cliente cadastrado
Local -> Nome | Mesa | Cliente cadastrado
Mesa com comanda aberta -> hint existente
+ Novo cliente -> nome + telefone + duplicidade existente
Data -> max de hoje, como atualmente
```

The component must call callbacks only; it must not import `createOrderApi`, `buildOrderPayload`, `OrderCart`, `OrderCheckoutSummary` or `OrderProductCatalog`.

- [ ] **Step 4: Add wizard state and dynamic access to `NewOrder`**

At the top of `NewOrder`, keep every existing draft state and add:

```jsx
const [currentStep, setCurrentStep] = useState(NEW_ORDER_STEPS.CUSTOMER)
```

After `identityValidation` and `items` are available, compute:

```jsx
const itemCount = getOrderItemCount(items)
const stepAccess = getNewOrderStepAccess({
  identityValid: identityValidation.ok,
  orderDate,
  itemCount,
})

const navigateStep = (targetStep) => {
  if (canNavigateToNewOrderStep(targetStep, stepAccess)) setCurrentStep(targetStep)
}
```

Render `NewOrderStepIndicator` immediately below `PageHeader` and render `NewOrderCustomerStep` only when:

```jsx
currentStep === NEW_ORDER_STEPS.CUSTOMER
```

`onContinue` must call:

```jsx
() => navigateStep(NEW_ORDER_STEPS.PRODUCTS)
```

and `canContinue` must be:

```jsx
stepAccess.products
```

- [ ] **Step 5: Preserve duplicate-client modal ownership in `NewOrder`**

Keep `ClientDuplicateModal` in `NewOrder`, after the conditional step content, with the same callbacks already used today:

```jsx
<ClientDuplicateModal
  client={duplicateClient}
  onCancel={() => setDuplicateClient(null)}
  onUseExisting={handleUseExistingDuplicate}
  onConfirm={handleConfirmDuplicate}
  disabled={disabled}
  cancelLabel="Cancelar"
  useExistingLabel="Usar cliente existente"
  confirmLabel="Cadastrar mesmo assim"
/>
```

This avoids moving async duplicate resolution into the visual step component.

- [ ] **Step 6: Run focused regression tests**

```bash
node --test src/pages/NewOrderWizard.test.js
node --test src/pages/NewOrder.test.js
node --test src/pages/NewOrderMobile.test.js
```

Expected: PASS. Existing searchable-client, phone-mask, local identity and money assertions remain valid.

- [ ] **Step 7: Run lint and commit Task 3**

```bash
npm run lint
git add src/components/NewOrderCustomerStep.jsx src/pages/NewOrder.jsx src/pages/NewOrderWizard.test.js src/new-order.css
git commit -m "feat: add customer step to new order flow"
```

---

### Task 4: Implementar a Etapa 2 — Produtos com resumo adaptativo do carrinho

**Files:**
- Create: `src/components/NewOrderCartSummary.jsx`
- Create: `src/components/NewOrderProductsStep.jsx`
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/pages/NewOrderWizard.test.js`
- Modify: `src/pages/NewOrderMobile.test.js`
- Modify: `src/new-order.css`

**Interfaces:**
- Consumes: `getOrderItemCount(items)`, `getOrderItemsSubtotal(items)`
- Produces: `NewOrderCartSummary({ items, itemCount, subtotal, currency, disabled, onReview })`
- Produces: `NewOrderProductsStep({ products, items, currency, disabled, customerSummary, itemCount, subtotal, onAdd, onBack, onReview })`
- `OrderProductCatalog` remains unchanged and continues owning only search/category UI state.

- [ ] **Step 1: Add failing tests for product-only step and subtotal-only summary**

Append to `src/pages/NewOrderWizard.test.js`:

```js
test('products step focuses on catalog and exposes a subtotal-only cart summary', async () => {
  const productsStep = await read('../components/NewOrderProductsStep.jsx')
  const cartSummary = await read('../components/NewOrderCartSummary.jsx')

  assert.match(productsStep, /OrderProductCatalog/)
  assert.match(productsStep, /NewOrderCartSummary/)
  assert.match(productsStep, /new-order-mobile-cart-action/)
  assert.match(productsStep, /Voltar/)
  assert.doesNotMatch(productsStep, /OrderCheckoutSummary/)
  assert.doesNotMatch(productsStep, /Taxa de entrega/)
  assert.doesNotMatch(productsStep, /Ajuste do pedido/)
  assert.match(cartSummary, /currency\(subtotal\)/)
  assert.match(cartSummary, /Revisar pedido/)
})
```

Append to `src/pages/NewOrderMobile.test.js`:

```js
test('products step keeps a mobile cart action above the bottom navigation safe area', async () => {
  const css = await read('../new-order.css')

  assert.match(css, /\.new-order-mobile-cart-action/)
  assert.match(css, /env\(safe-area-inset-bottom\)/)
  assert.match(css, /@media\s*\(max-width:\s*820px\)/)
})
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js
```

Expected: FAIL because the two new components and their CSS do not exist.

- [ ] **Step 3: Create the desktop compact cart summary**

Create `src/components/NewOrderCartSummary.jsx`:

```jsx
import Button from './Button'

function NewOrderCartSummary({ items, itemCount, subtotal, currency, disabled, onReview }) {
  return (
    <aside className="surface-card new-order-cart-summary" aria-label="Resumo do carrinho">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Seu pedido</span>
          <h2>Resumo</h2>
        </div>
        <span className="toolbar-count">{itemCount} item(ns)</span>
      </div>

      <div className="new-order-cart-summary-lines">
        {items.map((item) => (
          <div key={item.lineId} className="new-order-cart-summary-line">
            <span>{item.quantity}× {item.name}</span>
            <strong>{currency(Number(item.unitPrice || 0) * Number(item.quantity || 0))}</strong>
          </div>
        ))}
        {!items.length && <span className="new-order-cart-summary-empty">Nenhum produto adicionado.</span>}
      </div>

      <div className="new-order-cart-summary-total">
        <span>Subtotal dos produtos</span>
        <strong>{currency(subtotal)}</strong>
      </div>

      <Button type="button" onClick={onReview} disabled={disabled || !itemCount}>Revisar pedido</Button>
    </aside>
  )
}

export default NewOrderCartSummary
```

No summary, do not pass `deliveryFee`, `adjustment` or `preview.total`.

- [ ] **Step 4: Create the products step**

Create `src/components/NewOrderProductsStep.jsx`:

```jsx
import Button from './Button'
import NewOrderCartSummary from './NewOrderCartSummary'
import OrderProductCatalog from './OrderProductCatalog'

function NewOrderProductsStep({
  products,
  items,
  currency,
  disabled,
  customerSummary,
  itemCount,
  subtotal,
  onAdd,
  onBack,
  onReview,
}) {
  return (
    <section className="new-order-step new-order-products-step">
      <div className="new-order-step-context" role="status">{customerSummary}</div>
      <div className="new-order-products-layout">
        <OrderProductCatalog
          products={products}
          items={items}
          currency={currency}
          disabled={disabled}
          onAdd={onAdd}
        />
        <NewOrderCartSummary
          items={items}
          itemCount={itemCount}
          subtotal={subtotal}
          currency={currency}
          disabled={disabled}
          onReview={onReview}
        />
      </div>
      <div className="new-order-products-navigation">
        <Button type="button" variant="secondary" onClick={onBack} disabled={disabled}>← Voltar</Button>
      </div>
      <button
        type="button"
        className="new-order-mobile-cart-action"
        onClick={onReview}
        disabled={disabled || !itemCount}
      >
        <span>{itemCount} item(ns) · {currency(subtotal)}</span>
        <strong>Ver carrinho →</strong>
      </button>
    </section>
  )
}

export default NewOrderProductsStep
```

- [ ] **Step 5: Wire the product step to the single `items` state in `NewOrder`**

Compute:

```jsx
const itemCount = getOrderItemCount(items)
const itemsSubtotal = getOrderItemsSubtotal(items)
```

Derive a context label in `NewOrder` from the currently valid identity:

```jsx
const selectedClient = clients.find((client) => client.id === clientId) ?? null
const customerSummary = type === 'Local'
  ? (localIdentityType === 'registered_client'
      ? `${selectedClient?.name || 'Cliente'} · Consumo no local`
      : localIdentityType === 'table'
        ? `Mesa ${localIdentityValue.trim().toUpperCase()} · Consumo no local`
        : `${localIdentityValue.trim() || 'Consumo local'} · Consumo no local`)
  : `${selectedClient?.name || 'Cliente'} · ${type}`
```

Render `NewOrderProductsStep` only when:

```jsx
currentStep === NEW_ORDER_STEPS.PRODUCTS
```

Use the existing add rule unchanged:

```jsx
onAdd={(product) => setItems((current) => addCartItem(current, product, ''))}
```

Use transitions:

```jsx
onBack={() => setCurrentStep(NEW_ORDER_STEPS.CUSTOMER)}
onReview={() => navigateStep(NEW_ORDER_STEPS.REVIEW)}
```

- [ ] **Step 6: Add adaptive desktop/mobile CSS**

Add to `src/new-order.css`:

```css
.new-order-step-context {
  margin-bottom: 14px;
  color: var(--muted);
  font-weight: 750;
}

.new-order-products-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(280px, .7fr);
  gap: 20px;
  align-items: start;
}

.new-order-cart-summary {
  position: sticky;
  top: 20px;
  display: grid;
  gap: 14px;
  padding: 20px;
}

.new-order-cart-summary-lines {
  display: grid;
  gap: 8px;
}

.new-order-cart-summary-line,
.new-order-cart-summary-total {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.new-order-cart-summary-total {
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.new-order-products-navigation {
  margin-top: 16px;
}

.new-order-mobile-cart-action {
  display: none;
}

@media (max-width: 820px) {
  .new-order-products-layout {
    grid-template-columns: 1fr;
  }

  .new-order-cart-summary {
    display: none;
  }

  .new-order-products-step {
    padding-bottom: calc(92px + env(safe-area-inset-bottom));
  }

  .new-order-mobile-cart-action {
    position: fixed;
    right: 12px;
    bottom: calc(70px + env(safe-area-inset-bottom));
    left: 12px;
    z-index: calc(var(--layer-mobile-nav) - 1);
    min-height: 54px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 16px;
    border: 0;
    border-radius: 14px;
    background: var(--primary);
    color: #fff;
    font: inherit;
  }

  .new-order-mobile-cart-action:disabled {
    opacity: .55;
  }
}
```

The `70px` offset is deliberately above the fixed `.mobile-bottom-nav`, whose item height is approximately 52px plus padding/safe-area.

- [ ] **Step 7: Run focused regressions and verify GREEN**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js src/pages/NewOrder.test.js
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```bash
git add src/components/NewOrderCartSummary.jsx src/components/NewOrderProductsStep.jsx src/pages/NewOrder.jsx src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js src/new-order.css
git commit -m "feat: add products step cart summary"
```

---

### Task 5: Implementar a Etapa 3 — Revisão e checkout sem alterar o contrato

**Files:**
- Create: `src/components/NewOrderReviewStep.jsx`
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/pages/NewOrderWizard.test.js`
- Modify: `src/pages/NewOrder.test.js`
- Modify: `src/new-order.css`

**Interfaces:**
- Produces: `NewOrderReviewStep({ customerSummary, itemCount, cartProps, checkoutProps, disabled, onBack })`
- Consumes existing `OrderCart` and `OrderCheckoutSummary` without moving checkout/API ownership out of `NewOrder`.
- Existing `save(paymentMethod)` in `NewOrder` continues calling `buildOrderPayload(numericDraft, paymentMethod)` and `onSubmit`.

- [ ] **Step 1: Add failing tests for review-only cart/financial UI**

Append to `src/pages/NewOrderWizard.test.js`:

```js
test('review step owns the full cart and financial checkout composition', async () => {
  const reviewStep = await read('../components/NewOrderReviewStep.jsx')
  const productsStep = await read('../components/NewOrderProductsStep.jsx')

  assert.match(reviewStep, /OrderCart/)
  assert.match(reviewStep, /OrderCheckoutSummary/)
  assert.match(reviewStep, /Voltar aos produtos/)
  assert.match(reviewStep, /customerSummary/)
  assert.match(reviewStep, /itemCount/)
  assert.doesNotMatch(productsStep, /OrderCart/)
  assert.doesNotMatch(productsStep, /OrderCheckoutSummary/)
})
```

Add to `src/pages/NewOrder.test.js`:

```js
test('wizard keeps checkout payload unchanged and does not persist intermediate steps', () => {
  const page = source('./NewOrder.jsx')

  assert.match(page, /buildOrderPayload\(numericDraft, paymentMethod\)/)
  assert.match(page, /await onSubmit\(buildOrderPayload\(numericDraft, paymentMethod\)\)/)
  assert.doesNotMatch(page, /onSubmit\([^)]*currentStep/)
  assert.doesNotMatch(page, /step:\s*currentStep/)
})
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrder.test.js
```

Expected: FAIL because `NewOrderReviewStep.jsx` does not exist.

- [ ] **Step 3: Create the review composition component**

Create `src/components/NewOrderReviewStep.jsx`:

```jsx
import Button from './Button'
import OrderCart from './OrderCart'
import OrderCheckoutSummary from './OrderCheckoutSummary'

function NewOrderReviewStep({
  customerSummary,
  itemCount,
  cartProps,
  checkoutProps,
  disabled,
  onBack,
}) {
  return (
    <section className="new-order-step new-order-review-step">
      <div className="new-order-review-context">
        <div><span>Cliente</span><strong>{customerSummary}</strong></div>
        <div><span>Pedido</span><strong>{itemCount} item(ns)</strong></div>
      </div>
      <div className="new-order-review-layout">
        <div className="new-order-review-cart">
          <OrderCart {...cartProps} />
          <Button type="button" variant="secondary" onClick={onBack} disabled={disabled}>← Voltar aos produtos</Button>
        </div>
        <OrderCheckoutSummary {...checkoutProps} />
      </div>
    </section>
  )
}

export default NewOrderReviewStep
```

- [ ] **Step 4: Wire the existing cart and checkout callbacks from `NewOrder`**

Render the component only for:

```jsx
currentStep === NEW_ORDER_STEPS.REVIEW
```

Pass the existing cart logic unchanged through `cartProps`:

```jsx
cartProps={{
  items,
  currency,
  disabled,
  onUpdate: (lineId, patch) => setItems((current) => updateCartItem(current, lineId, patch)),
  onNoteChange: (lineId, note) => setItems((current) => editCartItemNote(current, lineId, note)),
  onNoteCommit: (lineId) => setItems((current) => commitCartItemNote(current, lineId)),
  onRemove: (lineId) => setItems((current) => removeCartItem(current, lineId)),
}}
```

Pass the existing financial logic unchanged through `checkoutProps`:

```jsx
checkoutProps={{
  draft,
  preview,
  currency,
  disabled,
  canSubmit,
  onDeliveryFeeChange: setDeliveryFee,
  onAdjustmentChange: handleAdjustmentChange,
  onSavePending: () => save(),
  onSavePaid: (method) => save(method),
}}
```

Use:

```jsx
onBack={() => setCurrentStep(NEW_ORDER_STEPS.PRODUCTS)}
```

Do not reset `deliveryFee`, `adjustment`, `items`, `clientId` or identity fields on step transitions.

- [ ] **Step 5: Keep failure behavior on review step**

Retain `save` with no step change on error:

```jsx
const save = async (paymentMethod) => {
  if (disabled || !canSubmit) return
  setCheckoutError('')
  const success = await onSubmit(buildOrderPayload(numericDraft, paymentMethod))
  if (!success) setCheckoutError('Não foi possível salvar a venda. Seus dados continuam aqui para tentar novamente.')
}
```

Render `checkoutError` above the active step so a failed checkout remains visible while `currentStep` stays `review`.

- [ ] **Step 6: Add review layout CSS**

Append:

```css
.new-order-review-context {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.new-order-review-context > div {
  display: grid;
  gap: 4px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-soft);
}

.new-order-review-context span {
  color: var(--muted);
  font-size: .76rem;
  font-weight: 750;
}

.new-order-review-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, .65fr);
  gap: 20px;
  align-items: start;
}

.new-order-review-cart {
  display: grid;
  gap: 12px;
}
```

- [ ] **Step 7: Run focused and checkout regression tests**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrder.test.js
npm test
npm run lint
```

Expected: PASS. Existing checkout, BRL formatting, cart observation and catalog behavior remain green.

- [ ] **Step 8: Commit Task 5**

```bash
git add src/components/NewOrderReviewStep.jsx src/pages/NewOrder.jsx src/pages/NewOrderWizard.test.js src/pages/NewOrder.test.js src/new-order.css
git commit -m "feat: add new order review step"
```

---

### Task 6: Proteger rascunho ao cancelar ou navegar pelo AppShell

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/App.jsx`
- Create: `src/AppNewOrderGuard.test.js`
- Modify: `src/utils/newOrderStepFlow.test.js`

**Interfaces:**
- `NewOrder` gains optional prop: `onDraftDirtyChange(dirty: boolean)`
- `App` gains local state: `newOrderDirty: boolean`, `pendingNavigationTab: string | null`
- `AppShell` still receives `onNavigate(targetTab)`; `App` passes a guarded callback instead of raw `setActiveTab`.
- Consumes `createNewOrderDirtySnapshot`, `isNewOrderDraftDirty`, `shouldConfirmNewOrderExit`.

- [ ] **Step 1: Write failing integration/source tests for the guard**

Create `src/AppNewOrderGuard.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('app guards global navigation away from a dirty new order', () => {
  const app = source('./App.jsx')

  assert.match(app, /newOrderDirty/)
  assert.match(app, /pendingNavigationTab/)
  assert.match(app, /shouldConfirmNewOrderExit/)
  assert.match(app, /onNavigate=\{requestNavigation\}/)
  assert.match(app, /onDraftDirtyChange=\{setNewOrderDirty\}/)
  assert.match(app, /Descartar venda em andamento\?/)
  assert.match(app, /Continuar na venda/)
  assert.match(app, /Descartar venda/)
})

test('new order reports dirty state without moving the cart to App', () => {
  const page = source('./pages/NewOrder.jsx')
  const app = source('./App.jsx')

  assert.match(page, /createNewOrderDirtySnapshot/)
  assert.match(page, /isNewOrderDraftDirty/)
  assert.match(page, /onDraftDirtyChange/)
  assert.doesNotMatch(app, /const \[items, setItems\] = useState/)
})
```

- [ ] **Step 2: Run the guard test and verify RED**

```bash
node --test src/AppNewOrderGuard.test.js
```

Expected: FAIL because dirty reporting and guarded navigation do not exist.

- [ ] **Step 3: Capture a normalized initial draft snapshot in `NewOrder`**

Add the prop:

```jsx
function NewOrder({
  clients,
  products,
  tableTabs = [],
  currency,
  disabled,
  onCancel,
  onCreateClient,
  onSubmit,
  onDraftDirtyChange,
}) {
```

After initializing the existing states, create one baseline per mounted order flow:

```jsx
const initialDraftSnapshotRef = useRef(null)

if (initialDraftSnapshotRef.current === null) {
  initialDraftSnapshotRef.current = createNewOrderDirtySnapshot({
    clientId,
    type,
    localIdentityType,
    localIdentityValue,
    orderDate,
    items,
    deliveryFee,
    adjustment,
    quickClient,
  })
}
```

Compute current dirty state from the same fields:

```jsx
const draftDirty = isNewOrderDraftDirty({
  clientId,
  type,
  localIdentityType,
  localIdentityValue,
  orderDate,
  items,
  deliveryFee,
  adjustment,
  quickClient,
}, initialDraftSnapshotRef.current)
```

Report changes and clear the parent flag on unmount:

```jsx
useEffect(() => {
  onDraftDirtyChange?.(draftDirty)
}, [draftDirty, onDraftDirtyChange])

useEffect(() => () => {
  onDraftDirtyChange?.(false)
}, [onDraftDirtyChange])
```

Do not include `clientSearch` separately; changing the search already clears/changes `clientId`, which is the meaningful order identity state.

- [ ] **Step 4: Add guarded navigation state and functions to `App`**

Add:

```jsx
const [newOrderDirty, setNewOrderDirty] = useState(false)
const [pendingNavigationTab, setPendingNavigationTab] = useState(null)
```

Import `shouldConfirmNewOrderExit` and add:

```jsx
const completeNavigation = (targetTab) => {
  if (activeTab === 'new-order' && targetTab !== 'new-order') {
    setCheckoutKey(null)
    setNewOrderDirty(false)
  }
  setActiveTab(targetTab)
}

const requestNavigation = (targetTab) => {
  if (activeTab === 'new-order' && requestKey === 'order:create') return
  if (shouldConfirmNewOrderExit({ activeTab, targetTab, draftDirty: newOrderDirty })) {
    setPendingNavigationTab(targetTab)
    return
  }
  completeNavigation(targetTab)
}

const cancelDiscardNewOrder = () => setPendingNavigationTab(null)

const confirmDiscardNewOrder = () => {
  const targetTab = pendingNavigationTab
  setPendingNavigationTab(null)
  if (targetTab) completeNavigation(targetTab)
}
```

- [ ] **Step 5: Route AppShell and the Cancelar venda action through the guard**

Change:

```jsx
<AppShell activeTab={activeTab} onNavigate={requestNavigation} onLogout={handleLogout} logoutDisabled={writesBlocked}>
```

Change the `NewOrder` render to:

```jsx
<NewOrder
  clients={clients}
  products={products}
  tableTabs={tableTabs}
  currency={currency}
  disabled={writesBlocked}
  onCancel={() => requestNavigation('orders')}
  onCreateClient={handleQuickCreateClient}
  onSubmit={handleOrderCheckout}
  onDraftDirtyChange={setNewOrderDirty}
/>
```

`handleOrderCheckout` remains allowed to navigate directly after successful persistence because success has already committed the order and clears `checkoutKey`; the unmount cleanup clears `newOrderDirty`.

- [ ] **Step 6: Render the discard confirmation using the existing `Modal` pattern**

Inside `AppShell` children, add:

```jsx
{pendingNavigationTab && (
  <Modal title="Descartar venda em andamento?" onClose={cancelDiscardNewOrder}>
    <div className="form-stack">
      <p>As informações preenchidas e os produtos adicionados serão descartados.</p>
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={cancelDiscardNewOrder}>Continuar na venda</Button>
        <Button type="button" onClick={confirmDiscardNewOrder}>Descartar venda</Button>
      </div>
    </div>
  </Modal>
)}
```

Do not use `window.confirm`; reuse the visual/modal system already present in `App`.

- [ ] **Step 7: Run guard and full new-order tests**

```bash
node --test src/AppNewOrderGuard.test.js src/utils/newOrderStepFlow.test.js src/pages/NewOrderWizard.test.js src/pages/NewOrder.test.js
npm test
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```bash
git add src/pages/NewOrder.jsx src/App.jsx src/AppNewOrderGuard.test.js src/utils/newOrderStepFlow.test.js
git commit -m "feat: protect new order draft navigation"
```

---

### Task 7: Fechar navegação reversível, foco, responsividade e regressões de estado

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/components/NewOrderStepIndicator.jsx`
- Modify: `src/pages/NewOrderWizard.test.js`
- Modify: `src/pages/NewOrderMobile.test.js`
- Modify: `src/new-order.css`

**Interfaces:**
- `NewOrder` remains the only owner of `items`, `deliveryFee`, `adjustment`, client/identity fields and `currentStep`.
- Step changes only mutate `currentStep`.
- Step indicator calls the same guarded `navigateStep` used by explicit navigation buttons.

- [ ] **Step 1: Add failing source tests for reversible navigation and focus**

Append to `src/pages/NewOrderWizard.test.js`:

```js
test('step navigation is reversible without resetting draft state and focuses the active step', async () => {
  const page = await read('./NewOrder.jsx')

  assert.match(page, /const navigateStep = \(targetStep\) =>/)
  assert.match(page, /canNavigateToNewOrderStep\(targetStep, stepAccess\)/)
  assert.match(page, /stepContentRef/)
  assert.match(page, /focus/)
  assert.match(page, /tabIndex="-1"/)
  assert.doesNotMatch(page, /setItems\(\[\]\)[\s\S]{0,120}setCurrentStep/)
  assert.doesNotMatch(page, /setAdjustment\(emptyAdjustment\(\)\)[\s\S]{0,120}setCurrentStep/)
})
```

Append to `src/pages/NewOrderMobile.test.js`:

```js
test('wizard steps collapse safely on narrow screens', async () => {
  const css = await read('../new-order.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-step-indicator/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-review-layout\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-review-context\s*\{[^}]*grid-template-columns:\s*1fr/s)
})
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js
```

Expected: FAIL until focus management and final narrow-screen rules exist.

- [ ] **Step 3: Add predictable focus after step changes**

In `NewOrder`, add:

```jsx
const stepContentRef = useRef(null)

useEffect(() => {
  stepContentRef.current?.focus()
}, [currentStep])
```

Wrap the active step content once:

```jsx
<div ref={stepContentRef} className="new-order-step-content" tabIndex="-1">
  {currentStep === NEW_ORDER_STEPS.CUSTOMER && customerStep}
  {currentStep === NEW_ORDER_STEPS.PRODUCTS && productsStep}
  {currentStep === NEW_ORDER_STEPS.REVIEW && reviewStep}
</div>
```

Use actual JSX variables or inline conditional components in the final implementation; there must be only one focus target for the active step.

Add:

```css
.new-order-step-content:focus {
  outline: none;
}
```

- [ ] **Step 4: Ensure the indicator cannot bypass dynamic validation**

Wire:

```jsx
<NewOrderStepIndicator
  currentStep={currentStep}
  access={stepAccess}
  onNavigate={navigateStep}
/>
```

Do not call `setCurrentStep` directly from `NewOrderStepIndicator`; all indicator navigation passes through `navigateStep` and `canNavigateToNewOrderStep`.

- [ ] **Step 5: Add final 320–480px rules**

In the existing `@media (max-width: 640px)` block, add:

```css
.new-order-step-indicator {
  gap: 6px;
}

.new-order-step-tab {
  min-width: 0;
  gap: 5px;
  padding: 6px;
  font-size: .76rem;
}

.new-order-step-number {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
}

.new-order-review-layout,
.new-order-review-context {
  grid-template-columns: 1fr;
}

.new-order-review-layout {
  gap: 16px;
}
```

Keep the existing cart and checkout mobile touch-target rules intact.

- [ ] **Step 6: Run all new-order/mobile regressions**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js src/pages/NewOrder.test.js src/AppNewOrderGuard.test.js src/utils/newOrderStepFlow.test.js
npm test
npm run lint
npm run build
```

Expected: all PASS.

- [ ] **Step 7: Commit Task 7**

```bash
git add src/pages/NewOrder.jsx src/components/NewOrderStepIndicator.jsx src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js src/new-order.css
git commit -m "fix: polish new order step navigation"
```

---

### Task 8: Executar gates completos e publicar somente no ambiente de staging

**Files:**
- Verify only: application, tests, Worker dry-runs and existing migrations.
- No production files or production deployment are modified by this task.

**Interfaces:**
- Consumes the completed feature branch.
- Produces a validated staging candidate for human homologation.

- [ ] **Step 1: Confirm branch and diff scope before validation**

Run:

```bash
git branch --show-current
git status --short
git diff master...HEAD --stat
```

Expected:

```text
feature/new-order-step-flow
```

`git status --short` must be empty. Diff scope must be limited to the new-order wizard, its focused helpers/tests/CSS, `App` navigation guard, spec and plan.

- [ ] **Step 2: Run the project test gate**

```bash
npm test
```

Expected: PASS with zero failing tests.

- [ ] **Step 3: Run lint and production build**

```bash
npm run lint
npm run build
```

Expected: both PASS.

- [ ] **Step 4: Verify migration integrity without creating a new migration**

```bash
npm run d1:migrate:local
```

Expected: existing migrations apply/verify successfully; no new migration file is required by this feature.

- [ ] **Step 5: Run Worker dry-runs for default and staging environments**

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Expected: both bundle validations PASS without deployment.

- [ ] **Step 6: Review the branch diff before any staging publish**

Run:

```bash
git diff master...HEAD -- src/pages/NewOrder.jsx src/App.jsx src/components src/utils src/new-order.css
```

Review specifically that:

```text
- no API payload gained currentStep/step fields
- no D1 schema or migration changed
- no product/cart state moved into App
- no production deploy workflow changed
- the stage-2 summary receives subtotal only
- exit protection uses the existing Modal pattern
```

- [ ] **Step 7: Publish through the official `Deploy staging` GitHub Actions workflow**

Use `.github/workflows/deploy-staging.yml` on `feature/new-order-step-flow`. The workflow itself executes:

```text
npm ci
npm test
npm run lint
npm run build
npm run d1:migrate:local
wrangler deploy --dry-run --env staging
staging migration check/application
staging PIN configuration
npm run deploy:staging
staging login smoke test
```

Do not run `deploy:production` and do not dispatch `.github/workflows/deploy-production.yml`.

- [ ] **Step 8: Perform human staging acceptance for the wizard**

On `https://sistema-para-delivery-staging.vzaponi.workers.dev`, verify all of these concrete scenarios:

```text
1. Nova venda opens on Cliente.
2. Cliente invalid cannot advance.
3. Entrega with valid registered client advances to Produtos.
4. Local works with Nome, Mesa and Cliente cadastrado.
5. Existing open table tab hint remains visible for Mesa.
6. Produtos shows no delivery fee, adjustment or payment controls.
7. Mobile shows fixed item-count + product-subtotal action above bottom navigation.
8. Desktop shows compact side summary with product subtotal only.
9. Empty cart cannot reach Finalizar.
10. Adding an item enables Finalizar.
11. Finalizar shows full cart, fee, adjustment, total and both save actions.
12. Finalizar -> Produtos -> Cliente preserves items, fee and adjustment.
13. Entrega -> Retirada/Local keeps items and zeroes delivery fee.
14. Local -> Entrega/Retirada blocks forward navigation until a valid registered client exists.
15. Clicking an earlier completed step works; future inaccessible steps stay blocked.
16. Dirty Cancelar venda opens discard confirmation.
17. Dirty sidebar/mobile navigation opens the same discard confirmation.
18. Canceling discard keeps the complete draft.
19. Confirming discard leaves Nova venda and clears the unmounted draft.
20. Failed checkout remains on Finalizar with the draft intact.
21. Successful pending checkout creates the same pending order behavior as before.
22. Successful paid checkout still asks one payment method and keeps operational semantics unchanged.
```

- [ ] **Step 9: Stop at staging homologation gate**

After staging acceptance, report the exact commit SHA and staging result. Do not merge to `master` and do not deploy production until the human explicitly approves the staging result.
