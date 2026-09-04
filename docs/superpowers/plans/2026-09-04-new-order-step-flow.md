# Nova venda em fluxo por etapas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar a tela Nova venda em um wizard interno de exatamente três etapas — Cliente, Produtos e Finalizar — preservando integralmente o rascunho, o contrato de checkout e as regras atuais de pedidos.

**Architecture:** `NewOrder` continua dono único do rascunho e passa a controlar `currentStep`, `maxReachedStep`, validações de acesso e dirty state. Componentes focados renderizam cada etapa sem duplicar estado; `App` continua dono de `activeTab` e recebe apenas o sinal de rascunho sujo para proteger saídas globais. Nenhuma etapa intermediária persiste dados; `POST /api/orders` continua sendo chamado somente na etapa Finalizar.

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

## File Map

- `src/utils/newOrderStepFlow.js`: política pura de etapas, ordem de navegação, subtotal/quantidade e dirty state.
- `src/utils/newOrderStepFlow.test.js`: testes unitários das regras puras.
- `src/components/NewOrderStepIndicator.jsx`: indicador acessível Cliente → Produtos → Finalizar.
- `src/components/NewOrderCustomerStep.jsx`: Etapa 1 controlada; cliente, tipo, identidade local, data e cadastro rápido.
- `src/components/NewOrderCartSummary.jsx`: resumo compacto somente de itens/subtotal, sem fechamento financeiro.
- `src/components/NewOrderProductsStep.jsx`: Etapa 2; contexto do atendimento, catálogo, resumo desktop e ação fixa mobile.
- `src/components/NewOrderReviewStep.jsx`: Etapa 3; contexto, `OrderCart` e `OrderCheckoutSummary`.
- `src/pages/NewOrder.jsx`: dono do rascunho, etapa atual/mais distante alcançada, validações, handlers, dirty state e checkout.
- `src/pages/NewOrderWizard.test.js`: testes estruturais do wizard e separação de responsabilidades.
- `src/pages/NewOrderMobile.test.js`: regressões responsivas/mobile.
- `src/App.jsx`: guarda de saída do rascunho sem mover o carrinho para estado global.
- `src/AppNewOrderGuard.test.js`: testes estruturais da integração de navegação/descartar.
- `src/new-order.css`: layout das três etapas, resumo adaptativo, safe area e responsividade.

---

### Task 1: Criar a política pura do fluxo, acesso, histórico de etapas e dirty state

**Files:**
- Create: `src/utils/newOrderStepFlow.js`
- Create: `src/utils/newOrderStepFlow.test.js`

**Interfaces:**
- Produces: `NEW_ORDER_STEPS`
- Produces: `NEW_ORDER_STEP_ORDER`
- Produces: `getOrderItemCount(items: Array): number`
- Produces: `getOrderItemsSubtotal(items: Array): number`
- Produces: `getNewOrderStepAccess({ identityValid, orderDate, itemCount }): { customer: true, products: boolean, review: boolean }`
- Produces: `canNavigateToNewOrderStep({ targetStep, currentStep, maxReachedStep, access }): boolean`
- Produces: `getFurthestReachedStep(currentMaxStep, nextStep): string`
- Produces: `createNewOrderDirtySnapshot(draft): string`
- Produces: `isNewOrderDraftDirty(draft, initialSnapshot): boolean`
- Produces: `shouldConfirmNewOrderExit({ activeTab, targetTab, draftDirty }): boolean`

- [ ] **Step 1: Write RED tests for step access, sequential progression and revisiting reached steps**

Create `src/utils/newOrderStepFlow.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NEW_ORDER_STEPS,
  canNavigateToNewOrderStep,
  createNewOrderDirtySnapshot,
  getFurthestReachedStep,
  getNewOrderStepAccess,
  getOrderItemCount,
  getOrderItemsSubtotal,
  isNewOrderDraftDirty,
  shouldConfirmNewOrderExit,
} from './newOrderStepFlow.js'

test('step access requires valid customer data before products and at least one item before review', () => {
  assert.deepEqual(
    getNewOrderStepAccess({ identityValid: false, orderDate: '2026-09-04', itemCount: 2 }),
    { customer: true, products: false, review: false },
  )
  assert.deepEqual(
    getNewOrderStepAccess({ identityValid: true, orderDate: '2026-09-04', itemCount: 0 }),
    { customer: true, products: true, review: false },
  )
  assert.deepEqual(
    getNewOrderStepAccess({ identityValid: true, orderDate: '2026-09-04', itemCount: 2 }),
    { customer: true, products: true, review: true },
  )
})

test('navigation allows the next step or an already reached step but never skips an unreached step', () => {
  const access = { customer: true, products: true, review: true }

  assert.equal(canNavigateToNewOrderStep({
    targetStep: NEW_ORDER_STEPS.PRODUCTS,
    currentStep: NEW_ORDER_STEPS.CUSTOMER,
    maxReachedStep: NEW_ORDER_STEPS.CUSTOMER,
    access,
  }), true)

  assert.equal(canNavigateToNewOrderStep({
    targetStep: NEW_ORDER_STEPS.REVIEW,
    currentStep: NEW_ORDER_STEPS.CUSTOMER,
    maxReachedStep: NEW_ORDER_STEPS.CUSTOMER,
    access,
  }), false)

  assert.equal(canNavigateToNewOrderStep({
    targetStep: NEW_ORDER_STEPS.REVIEW,
    currentStep: NEW_ORDER_STEPS.CUSTOMER,
    maxReachedStep: NEW_ORDER_STEPS.REVIEW,
    access,
  }), true)
})

test('furthest reached step only moves forward', () => {
  assert.equal(getFurthestReachedStep(NEW_ORDER_STEPS.CUSTOMER, NEW_ORDER_STEPS.PRODUCTS), NEW_ORDER_STEPS.PRODUCTS)
  assert.equal(getFurthestReachedStep(NEW_ORDER_STEPS.REVIEW, NEW_ORDER_STEPS.CUSTOMER), NEW_ORDER_STEPS.REVIEW)
})

test('product summary uses quantity and product subtotal only', () => {
  const items = [
    { productId: 1, quantity: 2, unitPrice: 20 },
    { productId: 2, quantity: 1, unitPrice: 15.5 },
  ]

  assert.equal(getOrderItemCount(items), 3)
  assert.equal(getOrderItemsSubtotal(items), 55.5)
})

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

test('dirty state ignores opening an empty quick form but detects meaningful draft changes', () => {
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

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node --test src/utils/newOrderStepFlow.test.js
```

Expected: FAIL because `src/utils/newOrderStepFlow.js` does not exist.

- [ ] **Step 3: Implement the pure flow helpers**

Create `src/utils/newOrderStepFlow.js`:

```js
export const NEW_ORDER_STEPS = Object.freeze({
  CUSTOMER: 'customer',
  PRODUCTS: 'products',
  REVIEW: 'review',
})

export const NEW_ORDER_STEP_ORDER = Object.freeze([
  NEW_ORDER_STEPS.CUSTOMER,
  NEW_ORDER_STEPS.PRODUCTS,
  NEW_ORDER_STEPS.REVIEW,
])

const stepIndex = (step) => NEW_ORDER_STEP_ORDER.indexOf(step)

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

export const canNavigateToNewOrderStep = ({ targetStep, currentStep, maxReachedStep, access }) => {
  if (!access?.[targetStep]) return false
  const targetIndex = stepIndex(targetStep)
  const currentIndex = stepIndex(currentStep)
  const maxReachedIndex = stepIndex(maxReachedStep)
  if (targetIndex < 0 || currentIndex < 0 || maxReachedIndex < 0) return false
  return targetIndex <= maxReachedIndex || targetIndex === currentIndex + 1
}

export const getFurthestReachedStep = (currentMaxStep, nextStep) => (
  stepIndex(nextStep) > stepIndex(currentMaxStep) ? nextStep : currentMaxStep
)

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

- [ ] **Step 4: Run focused and full tests**

```bash
node --test src/utils/newOrderStepFlow.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

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
- Consumes: `NEW_ORDER_STEPS`, `NEW_ORDER_STEP_ORDER`.
- Produces: `NewOrderStepIndicator({ currentStep, maxReachedStep, access, onNavigate })`.

- [ ] **Step 1: Write RED structural test for the indicator**

Create `src/pages/NewOrderWizard.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('new order exposes an accessible three-step indicator with reached-state awareness', async () => {
  const indicator = await read('../components/NewOrderStepIndicator.jsx')

  assert.match(indicator, /Etapas da nova venda/)
  assert.match(indicator, /Cliente/)
  assert.match(indicator, /Produtos/)
  assert.match(indicator, /Finalizar/)
  assert.match(indicator, /aria-current/)
  assert.match(indicator, /maxReachedStep/)
  assert.match(indicator, /disabled=\{!accessible\}/)
  assert.match(indicator, /onNavigate\(step\.id\)/)
})
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test src/pages/NewOrderWizard.test.js
```

Expected: FAIL because `NewOrderStepIndicator.jsx` does not exist.

- [ ] **Step 3: Implement the indicator**

Create `src/components/NewOrderStepIndicator.jsx`:

```jsx
import { NEW_ORDER_STEPS, NEW_ORDER_STEP_ORDER } from '../utils/newOrderStepFlow.js'

const STEPS = [
  { id: NEW_ORDER_STEPS.CUSTOMER, number: 1, label: 'Cliente' },
  { id: NEW_ORDER_STEPS.PRODUCTS, number: 2, label: 'Produtos' },
  { id: NEW_ORDER_STEPS.REVIEW, number: 3, label: 'Finalizar' },
]

function NewOrderStepIndicator({ currentStep, maxReachedStep, access, onNavigate }) {
  const maxReachedIndex = NEW_ORDER_STEP_ORDER.indexOf(maxReachedStep)

  return (
    <nav className="new-order-step-indicator" aria-label="Etapas da nova venda">
      {STEPS.map((step, index) => {
        const active = currentStep === step.id
        const accessible = Boolean(access?.[step.id])
        const reached = index <= maxReachedIndex
        const completed = reached && !active
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

Accessibility rule: a previously reached step that becomes invalid is still rendered as reached but `disabled`, so validation state wins over history and the user cannot reopen a dependent invalid destination.

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

- [ ] **Step 5: Verify GREEN and commit**

```bash
node --test src/pages/NewOrderWizard.test.js
npm run lint
git add src/components/NewOrderStepIndicator.jsx src/pages/NewOrderWizard.test.js src/new-order.css
git commit -m "feat: add new order step indicator"
```

---

### Task 3: Extrair e ligar a Etapa 1 — Cliente e atendimento

**Files:**
- Create: `src/components/NewOrderCustomerStep.jsx`
- Modify: `src/pages/NewOrder.jsx:1-340`
- Modify: `src/pages/NewOrderWizard.test.js`
- Modify: `src/new-order.css`

**Interfaces:**
- Consumes: `NEW_ORDER_STEPS`, `getNewOrderStepAccess`, `getOrderItemCount`, `canNavigateToNewOrderStep`, `getFurthestReachedStep`.
- Produces: controlled `NewOrderCustomerStep` with no API imports and no cart/checkout state.
- `NewOrder` remains owner of client/identity/date/quick-client state and duplicate resolution.

- [ ] **Step 1: Add RED tests for the first step**

Append to `src/pages/NewOrderWizard.test.js`:

```js
test('new order starts on customer step and customer step contains only attendance data', async () => {
  const page = await read('./NewOrder.jsx')
  const customerStep = await read('../components/NewOrderCustomerStep.jsx')

  assert.match(page, /useState\(NEW_ORDER_STEPS\.CUSTOMER\)/)
  assert.match(page, /maxReachedStep/)
  assert.match(page, /NewOrderCustomerStep/)
  assert.match(customerStep, /Tipo do pedido/)
  assert.match(customerStep, /Data do pedido/)
  assert.match(customerStep, /\+ Novo cliente/)
  assert.match(customerStep, /Continuar/)
  assert.match(customerStep, /aria-pressed/)
  assert.doesNotMatch(customerStep, /OrderProductCatalog/)
  assert.doesNotMatch(customerStep, /OrderCart/)
  assert.doesNotMatch(customerStep, /OrderCheckoutSummary/)
})
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test src/pages/NewOrderWizard.test.js
```

Expected: FAIL because `NewOrderCustomerStep.jsx` and wizard state do not exist.

- [ ] **Step 3: Create the complete controlled customer-step component**

Create `src/components/NewOrderCustomerStep.jsx` with these imports/constants and full rendering behavior:

```jsx
import Button from './Button'

const ORDER_TYPE_OPTIONS = [
  { value: 'Entrega', label: 'Entrega' },
  { value: 'Retirada', label: 'Retirada' },
  { value: 'Local', label: 'Consumo no local' },
]

const LOCAL_IDENTITY_OPTIONS = [
  { value: 'guest_name', label: 'Nome' },
  { value: 'table', label: 'Mesa' },
  { value: 'registered_client', label: 'Cliente cadastrado' },
]

function NewOrderCustomerStep({
  clients,
  filteredClients,
  clientId,
  clientSearch,
  clientPickerOpen,
  type,
  orderDate,
  todayValue,
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
  onContinue,
}) {
  const usesRegisteredClient = type !== 'Local' || localIdentityType === 'registered_client'

  return (
    <section className="surface-card new-order-customer-card new-order-step-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Etapa 1</span>
          <h2>Cliente e atendimento</h2>
        </div>
      </div>

      <div className="form-field">
        <span>Tipo do pedido</span>
        <div className="new-order-type-options" role="group" aria-label="Tipo do pedido">
          {ORDER_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={type === option.value ? 'new-order-type-option selected' : 'new-order-type-option'}
              aria-pressed={type === option.value}
              onClick={() => onTypeChange(option.value)}
              disabled={disabled}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {type === 'Local' && (
        <div className="new-order-local-identity">
          <span className="product-detail-label">Identificar por</span>
          <div className="new-order-local-identity-options" role="group" aria-label="Identificação do consumo no local">
            {LOCAL_IDENTITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={localIdentityType === option.value ? 'new-order-local-identity-option selected' : 'new-order-local-identity-option'}
                aria-pressed={localIdentityType === option.value}
                onClick={() => onLocalIdentityTypeChange(option.value)}
                disabled={disabled}
              >
                {option.label}
              </button>
            ))}
          </div>

          {localIdentityType === 'guest_name' && (
            <label className="form-field">
              <span>Nome</span>
              <input
                type="text"
                maxLength={80}
                placeholder="Ex: João"
                value={localIdentityValue}
                onChange={(event) => onLocalIdentityValueChange(event.target.value)}
                disabled={disabled}
                autoComplete="off"
              />
            </label>
          )}

          {localIdentityType === 'table' && (
            <label className="form-field">
              <span>Mesa</span>
              <input
                type="text"
                maxLength={12}
                placeholder="Ex: 04 ou A-2"
                value={localIdentityValue}
                onChange={(event) => onLocalIdentityValueChange(event.target.value)}
                disabled={disabled}
                autoComplete="off"
              />
              <small>Use letras, números ou hífen.</small>
              {openTableTab && (
                <div className="new-order-table-tab-hint" role="status">
                  Mesa {openTableTab.tableIdentifier} · comanda aberta. Este pedido será adicionado automaticamente.
                </div>
              )}
            </label>
          )}
        </div>
      )}

      {usesRegisteredClient && (
        <>
          <div className="form-field new-order-client-picker" onBlur={onClientBlur}>
            <span>Cliente</span>
            <div className="new-order-client-combobox">
              <input
                type="search"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={clientPickerOpen}
                aria-controls="new-order-client-options"
                placeholder="Digite o nome do cliente"
                value={clientSearch}
                onFocus={onClientFocus}
                onChange={(event) => onClientSearchChange(event.target.value)}
                disabled={disabled || !clients.length}
                autoComplete="off"
              />
              {clientPickerOpen && !disabled && (
                <div id="new-order-client-options" className="new-order-client-options" role="listbox">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      role="option"
                      aria-selected={client.id === clientId}
                      className={client.id === clientId ? 'selected' : ''}
                      onClick={() => onClientSelect(client)}
                    >
                      {client.name}
                    </button>
                  ))}
                  {!filteredClients.length && <span className="new-order-client-empty">Nenhum cliente encontrado</span>}
                </div>
              )}
            </div>
          </div>

          <button type="button" className="new-order-quick-client-toggle" onClick={onQuickClientToggle} disabled={disabled}>
            + Novo cliente
          </button>

          {quickClient.open && (
            <form className="new-order-quick-client" onSubmit={onQuickClientSubmit}>
              {quickClientError && <div className="new-order-error" role="alert">{quickClientError}</div>}
              <label className="form-field">
                <span>Nome</span>
                <input
                  type="text"
                  value={quickClient.name}
                  onChange={(event) => onQuickClientChange({ name: event.target.value })}
                  placeholder="Nome do cliente"
                  autoComplete="off"
                />
              </label>
              <label className="form-field">
                <span>Telefone</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={quickClient.phone}
                  onChange={(event) => onQuickClientChange({ phone: event.target.value })}
                  placeholder="(11) 99999-9999"
                  autoComplete="off"
                />
              </label>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={onQuickClientCancel} disabled={disabled}>Cancelar</Button>
                <Button type="submit" disabled={disabled || !quickClient.name.trim()}>Adicionar cliente</Button>
              </div>
            </form>
          )}
        </>
      )}

      <label className="form-field new-order-date-field">
        <span>Data do pedido</span>
        <input
          type="date"
          value={orderDate}
          max={todayValue}
          onChange={(event) => onOrderDateChange(event.target.value)}
          disabled={disabled}
        />
      </label>

      <div className="new-order-step-actions">
        <Button type="button" onClick={onContinue} disabled={disabled || !canContinue}>Continuar →</Button>
      </div>
    </section>
  )
}

export default NewOrderCustomerStep
```

`NewOrder` must continue applying the existing `formatPhone` mask before updating `quickClient.phone`; pass `onQuickClientChange={(patch) => updateQuickClient(patch.phone !== undefined ? { ...patch, phone: formatPhone(patch.phone) } : patch)}`.

- [ ] **Step 4: Add wizard state and dynamic navigation to `NewOrder`**

Import the helpers/components and add:

```jsx
const [currentStep, setCurrentStep] = useState(NEW_ORDER_STEPS.CUSTOMER)
const [maxReachedStep, setMaxReachedStep] = useState(NEW_ORDER_STEPS.CUSTOMER)

const itemCount = getOrderItemCount(items)
const stepAccess = getNewOrderStepAccess({
  identityValid: identityValidation.ok,
  orderDate,
  itemCount,
})

const navigateStep = (targetStep) => {
  const allowed = canNavigateToNewOrderStep({
    targetStep,
    currentStep,
    maxReachedStep,
    access: stepAccess,
  })
  if (!allowed) return
  setCurrentStep(targetStep)
  setMaxReachedStep((current) => getFurthestReachedStep(current, targetStep))
}
```

Render the indicator directly below `PageHeader`:

```jsx
<NewOrderStepIndicator
  currentStep={currentStep}
  maxReachedStep={maxReachedStep}
  access={stepAccess}
  onNavigate={navigateStep}
/>
```

Render `NewOrderCustomerStep` only when `currentStep === NEW_ORDER_STEPS.CUSTOMER`; wire all existing handlers. `onContinue` is `() => navigateStep(NEW_ORDER_STEPS.PRODUCTS)` and `canContinue={stepAccess.products}`.

Keep the global PageHeader action as `Cancelar venda` throughout all three steps; do not duplicate a second discard button inside the step card.

Update the PageHeader copy to:

```jsx
<PageHeader
  eyebrow="Atendimento"
  title="Nova venda"
  description="Informe o atendimento, escolha os produtos e revise tudo antes de salvar."
  actions={<Button type="button" variant="secondary" onClick={onCancel} disabled={disabled}>Cancelar venda</Button>}
/>
```

- [ ] **Step 5: Preserve duplicate-client ownership in `NewOrder`**

Keep the existing `ClientDuplicateModal` in `NewOrder` after the active step content with the same callbacks and labels. Do not move duplicate resolution or `onCreateClient` into `NewOrderCustomerStep`.

- [ ] **Step 6: Add type-option CSS and verify regression**

Add:

```css
.new-order-step-card {
  max-width: 760px;
}

.new-order-type-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.new-order-type-option {
  min-height: 52px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 750;
}

.new-order-type-option.selected {
  border-color: var(--primary-border);
  background: var(--primary-soft);
  color: var(--primary);
}

.new-order-date-field {
  margin-top: 18px;
}

.new-order-step-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}
```

Run:

```bash
node --test src/pages/NewOrderWizard.test.js
node --test src/pages/NewOrder.test.js
node --test src/pages/NewOrderMobile.test.js
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
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
- Consumes: `getOrderItemCount(items)`, `getOrderItemsSubtotal(items)`.
- Produces: `NewOrderCartSummary({ items, itemCount, subtotal, currency, disabled, onReview })`.
- Produces: `NewOrderProductsStep({ products, items, currency, disabled, customerSummary, itemCount, subtotal, onAdd, onBack, onReview })`.
- `OrderProductCatalog` remains unchanged and continues owning only search/category UI state.

- [ ] **Step 1: Add RED tests for product-only step and subtotal-only summary**

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
  assert.match(cartSummary, /Subtotal dos produtos/)
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

- [ ] **Step 2: Run and verify RED**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js
```

Expected: FAIL because the two new components do not exist.

- [ ] **Step 3: Create the compact desktop summary**

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

Do not add `deliveryFee`, `adjustment`, `preview.total`, payment method or checkout actions to this component.

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
        <OrderProductCatalog products={products} items={items} currency={currency} disabled={disabled} onAdd={onAdd} />
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

- [ ] **Step 5: Wire the products step to the single draft in `NewOrder`**

Compute once:

```jsx
const itemCount = getOrderItemCount(items)
const itemsSubtotal = getOrderItemsSubtotal(items)
const selectedClient = clients.find((client) => client.id === clientId) ?? null
const customerSummary = type === 'Local'
  ? (localIdentityType === 'registered_client'
      ? `${selectedClient?.name || 'Cliente'} · Consumo no local`
      : localIdentityType === 'table'
        ? `Mesa ${localIdentityValue.trim().toUpperCase()} · Consumo no local`
        : `${localIdentityValue.trim() || 'Consumo local'} · Consumo no local`)
  : `${selectedClient?.name || 'Cliente'} · ${type}`
```

Render only for `currentStep === NEW_ORDER_STEPS.PRODUCTS`. Preserve the existing add behavior exactly:

```jsx
onAdd={(product) => setItems((current) => addCartItem(current, product, ''))}
onBack={() => navigateStep(NEW_ORDER_STEPS.CUSTOMER)}
onReview={() => navigateStep(NEW_ORDER_STEPS.REVIEW)}
```

- [ ] **Step 6: Add adaptive desktop/mobile CSS**

Add:

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

- [ ] **Step 7: Verify GREEN and commit**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js src/pages/NewOrder.test.js
npm run lint
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
- Produces: `NewOrderReviewStep({ customerSummary, itemCount, cartProps, checkoutProps, disabled, onBack })`.
- Reuses existing `OrderCart` and `OrderCheckoutSummary`.
- Existing `save(paymentMethod)` in `NewOrder` remains the only bridge to `onSubmit`.

- [ ] **Step 1: Add RED tests for review-only cart and financial UI**

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

Append to `src/pages/NewOrder.test.js`:

```js
test('wizard keeps checkout payload unchanged and never persists intermediate step metadata', () => {
  const page = source('./NewOrder.jsx')

  assert.match(page, /buildOrderPayload\(numericDraft, paymentMethod\)/)
  assert.match(page, /await onSubmit\(buildOrderPayload\(numericDraft, paymentMethod\)\)/)
  assert.doesNotMatch(page, /step:\s*currentStep/)
  assert.doesNotMatch(page, /currentStep:\s*currentStep/)
})
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrder.test.js
```

Expected: FAIL because `NewOrderReviewStep.jsx` does not exist.

- [ ] **Step 3: Create the review composition**

Create `src/components/NewOrderReviewStep.jsx`:

```jsx
import Button from './Button'
import OrderCart from './OrderCart'
import OrderCheckoutSummary from './OrderCheckoutSummary'

function NewOrderReviewStep({ customerSummary, itemCount, cartProps, checkoutProps, disabled, onBack }) {
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

- [ ] **Step 4: Wire existing cart/checkout callbacks from `NewOrder`**

Render only for `currentStep === NEW_ORDER_STEPS.REVIEW` and pass:

```jsx
<NewOrderReviewStep
  customerSummary={customerSummary}
  itemCount={itemCount}
  disabled={disabled}
  onBack={() => navigateStep(NEW_ORDER_STEPS.PRODUCTS)}
  cartProps={{
    items,
    currency,
    disabled,
    onUpdate: (lineId, patch) => setItems((current) => updateCartItem(current, lineId, patch)),
    onNoteChange: (lineId, note) => setItems((current) => editCartItemNote(current, lineId, note)),
    onNoteCommit: (lineId) => setItems((current) => commitCartItemNote(current, lineId)),
    onRemove: (lineId) => setItems((current) => removeCartItem(current, lineId)),
  }}
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
/>
```

Do not reset any draft field on back/forward navigation.

- [ ] **Step 5: Preserve failure behavior on Finalizar**

Keep:

```jsx
const save = async (paymentMethod) => {
  if (disabled || !canSubmit) return
  setCheckoutError('')
  const success = await onSubmit(buildOrderPayload(numericDraft, paymentMethod))
  if (!success) setCheckoutError('Não foi possível salvar a venda. Seus dados continuam aqui para tentar novamente.')
}
```

`checkoutError` remains above the active step; no `setCurrentStep` occurs on failure.

- [ ] **Step 6: Add review CSS**

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

- [ ] **Step 7: Verify GREEN and commit**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrder.test.js
npm test
npm run lint
git add src/components/NewOrderReviewStep.jsx src/pages/NewOrder.jsx src/pages/NewOrderWizard.test.js src/pages/NewOrder.test.js src/new-order.css
git commit -m "feat: add new order review step"
```

---

### Task 6: Proteger rascunho ao cancelar ou navegar pelo AppShell

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/App.jsx:38-80, 300-430`
- Create: `src/AppNewOrderGuard.test.js`

**Interfaces:**
- `NewOrder` gains `onDraftDirtyChange(dirty: boolean)`.
- `App` gains `newOrderDirty: boolean` and `pendingNavigationTab: string | null`.
- `AppShell` still receives a single `onNavigate(targetTab)` callback, now guarded by `App`.

- [ ] **Step 1: Write RED guard integration tests**

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

test('new order reports dirty state without moving cart state to App', () => {
  const page = source('./pages/NewOrder.jsx')
  const app = source('./App.jsx')

  assert.match(page, /createNewOrderDirtySnapshot/)
  assert.match(page, /isNewOrderDraftDirty/)
  assert.match(page, /onDraftDirtyChange/)
  assert.doesNotMatch(app, /const \[items, setItems\] = useState/)
})
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test src/AppNewOrderGuard.test.js
```

Expected: FAIL because dirty reporting and guarded navigation do not exist.

- [ ] **Step 3: Capture one normalized initial draft snapshot in `NewOrder`**

Change the React import to include `useEffect` and `useRef`. Add the optional prop and baseline:

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

useEffect(() => {
  onDraftDirtyChange?.(draftDirty)
}, [draftDirty, onDraftDirtyChange])

useEffect(() => () => {
  onDraftDirtyChange?.(false)
}, [onDraftDirtyChange])
```

Do not include `quickClient.open` in the signature and do not add `items` state to `App`.

- [ ] **Step 4: Add guarded navigation in `App`**

Add states:

```jsx
const [newOrderDirty, setNewOrderDirty] = useState(false)
const [pendingNavigationTab, setPendingNavigationTab] = useState(null)
```

Import `shouldConfirmNewOrderExit`, then add:

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

- [ ] **Step 5: Route global and explicit new-order exits through the guard**

Change AppShell to:

```jsx
<AppShell activeTab={activeTab} onNavigate={requestNavigation} onLogout={handleLogout} logoutDisabled={writesBlocked}>
```

Change NewOrder to:

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

`handleOrderCheckout` keeps its direct successful transition to `orders`; after successful persistence the page unmount cleanup clears the dirty signal.

- [ ] **Step 6: Render discard confirmation with existing Modal**

Inside `AppShell` children:

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

Do not use `window.confirm`.

- [ ] **Step 7: Verify GREEN and commit**

```bash
node --test src/AppNewOrderGuard.test.js src/utils/newOrderStepFlow.test.js src/pages/NewOrderWizard.test.js src/pages/NewOrder.test.js
npm test
npm run lint
git add src/pages/NewOrder.jsx src/App.jsx src/AppNewOrderGuard.test.js
git commit -m "feat: protect new order draft navigation"
```

---

### Task 7: Fechar foco, navegação reversível e responsividade 320–480 px

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/components/NewOrderStepIndicator.jsx`
- Modify: `src/pages/NewOrderWizard.test.js`
- Modify: `src/pages/NewOrderMobile.test.js`
- Modify: `src/new-order.css`

**Interfaces:**
- All step transitions pass through `navigateStep`.
- `maxReachedStep` records history but `stepAccess` dynamically blocks invalid destinations.
- Active-step wrapper is the single predictable focus target.

- [ ] **Step 1: Add RED tests for focus, no-reset navigation and narrow screens**

Append to `src/pages/NewOrderWizard.test.js`:

```js
test('step navigation preserves the single draft and focuses the active step', async () => {
  const page = await read('./NewOrder.jsx')

  assert.match(page, /const navigateStep = \(targetStep\) =>/)
  assert.match(page, /getFurthestReachedStep/)
  assert.match(page, /stepContentRef/)
  assert.match(page, /stepContentRef\.current\?\.focus\(\)/)
  assert.match(page, /tabIndex="-1"/)
  assert.doesNotMatch(page, /setItems\(\[\]\)[\s\S]{0,140}setCurrentStep/)
  assert.doesNotMatch(page, /setAdjustment\(emptyAdjustment\(\)\)[\s\S]{0,140}setCurrentStep/)
})
```

Append to `src/pages/NewOrderMobile.test.js`:

```js
test('wizard collapses review and type choices safely on narrow screens', async () => {
  const css = await read('../new-order.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-step-indicator/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-type-options\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-review-layout\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-review-context\s*\{[^}]*grid-template-columns:\s*1fr/s)
})
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js
```

Expected: FAIL until focus and final mobile rules are implemented.

- [ ] **Step 3: Add one focus target around the active step**

In `NewOrder`:

```jsx
const stepContentRef = useRef(null)

useEffect(() => {
  stepContentRef.current?.focus()
}, [currentStep])
```

Use one wrapper with explicit conditional components:

```jsx
<div ref={stepContentRef} className="new-order-step-content" tabIndex="-1">
  {currentStep === NEW_ORDER_STEPS.CUSTOMER && (
    <NewOrderCustomerStep
      clients={clients}
      filteredClients={filteredClients}
      clientId={clientId}
      clientSearch={clientSearch}
      clientPickerOpen={clientPickerOpen}
      type={type}
      orderDate={orderDate}
      todayValue={toLocalDateValue()}
      localIdentityType={localIdentityType}
      localIdentityValue={localIdentityValue}
      openTableTab={openTableTab}
      quickClient={quickClient}
      quickClientError={quickClientError}
      disabled={disabled}
      canContinue={stepAccess.products}
      onTypeChange={changeType}
      onOrderDateChange={setOrderDate}
      onLocalIdentityTypeChange={changeLocalIdentityType}
      onLocalIdentityValueChange={setLocalIdentityValue}
      onClientSearchChange={handleClientSearchChange}
      onClientFocus={() => setClientPickerOpen(true)}
      onClientBlur={handleClientPickerBlur}
      onClientSelect={selectClient}
      onQuickClientToggle={toggleQuickClient}
      onQuickClientChange={(patch) => updateQuickClient(patch.phone !== undefined ? { ...patch, phone: formatPhone(patch.phone) } : patch)}
      onQuickClientSubmit={handleQuickClientSubmit}
      onQuickClientCancel={closeQuickClient}
      onContinue={() => navigateStep(NEW_ORDER_STEPS.PRODUCTS)}
    />
  )}

  {currentStep === NEW_ORDER_STEPS.PRODUCTS && (
    <NewOrderProductsStep
      products={products}
      items={items}
      currency={currency}
      disabled={disabled}
      customerSummary={customerSummary}
      itemCount={itemCount}
      subtotal={itemsSubtotal}
      onAdd={(product) => setItems((current) => addCartItem(current, product, ''))}
      onBack={() => navigateStep(NEW_ORDER_STEPS.CUSTOMER)}
      onReview={() => navigateStep(NEW_ORDER_STEPS.REVIEW)}
    />
  )}

  {currentStep === NEW_ORDER_STEPS.REVIEW && (
    <NewOrderReviewStep
      customerSummary={customerSummary}
      itemCount={itemCount}
      disabled={disabled}
      onBack={() => navigateStep(NEW_ORDER_STEPS.PRODUCTS)}
      cartProps={{
        items,
        currency,
        disabled,
        onUpdate: (lineId, patch) => setItems((current) => updateCartItem(current, lineId, patch)),
        onNoteChange: (lineId, note) => setItems((current) => editCartItemNote(current, lineId, note)),
        onNoteCommit: (lineId) => setItems((current) => commitCartItemNote(current, lineId)),
        onRemove: (lineId) => setItems((current) => removeCartItem(current, lineId)),
      }}
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
    />
  )}
</div>
```

Add:

```css
.new-order-step-content:focus {
  outline: none;
}
```

- [ ] **Step 4: Add final narrow-screen rules**

Inside the existing `@media (max-width: 640px)` block:

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

.new-order-type-options,
.new-order-review-layout,
.new-order-review-context {
  grid-template-columns: 1fr;
}

.new-order-review-layout {
  gap: 16px;
}
```

Keep current touch targets for add, quantity, observation and checkout buttons intact.

- [ ] **Step 5: Verify all wizard regressions and commit**

```bash
node --test src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js src/pages/NewOrder.test.js src/AppNewOrderGuard.test.js src/utils/newOrderStepFlow.test.js
npm test
npm run lint
npm run build
git add src/pages/NewOrder.jsx src/components/NewOrderStepIndicator.jsx src/pages/NewOrderWizard.test.js src/pages/NewOrderMobile.test.js src/new-order.css
git commit -m "fix: polish new order step navigation"
```

Expected: all PASS.

---

### Task 8: Executar gates completos e publicar somente no ambiente de staging

**Files:**
- Verify only: application, tests, Worker dry-runs and existing migrations.
- No production deployment or production schema change is part of this task.

**Interfaces:**
- Consumes the completed `feature/new-order-step-flow` branch.
- Produces a validated staging candidate for human homologation.

- [ ] **Step 1: Confirm branch and clean diff scope**

```bash
git branch --show-current
git status --short
git diff master...HEAD --stat
```

Expected branch:

```text
feature/new-order-step-flow
```

`git status --short` must be empty. Diff must be limited to the wizard, focused helpers/tests/CSS, `App` navigation guard, spec and plan.

- [ ] **Step 2: Run the normal project gate**

```bash
npm test
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Expected: every command exits successfully. No new migration file is created.

- [ ] **Step 3: Review the final diff for architectural invariants**

```bash
git diff master...HEAD -- src/pages/NewOrder.jsx src/App.jsx src/components src/utils src/new-order.css
```

Confirm all six invariants:

```text
1. API payload has no currentStep/step field.
2. D1 schema/migrations are unchanged.
3. App has no cart/items duplicate state.
4. Product-stage summary receives product subtotal only.
5. Dirty exit confirmation uses the existing Modal system.
6. No production workflow or production deploy command was changed.
```

- [ ] **Step 4: Publish through the official `Deploy staging` workflow**

Dispatch `.github/workflows/deploy-staging.yml` on `feature/new-order-step-flow`. The existing workflow runs:

```text
npm ci
npm test
npm run lint
npm run build
npm run d1:migrate:local
wrangler deploy --dry-run --env staging
staging migration list/application
staging PIN configuration
npm run deploy:staging
staging login smoke test
```

Do not dispatch `.github/workflows/deploy-production.yml` and do not run `npm run deploy:production`.

- [ ] **Step 5: Perform human staging acceptance**

On `https://sistema-para-delivery-staging.vzaponi.workers.dev`, verify:

```text
1. Nova venda opens on Cliente.
2. Invalid customer/identity cannot advance.
3. Entrega and Retirada require a registered client.
4. Local works with Nome, Mesa and Cliente cadastrado.
5. Existing open-table hint remains visible.
6. Products contains catalog only; no fee/adjustment/payment controls.
7. Mobile shows fixed item-count + product-subtotal action above bottom navigation.
8. Desktop shows compact side summary with product subtotal only.
9. Empty cart cannot reach Finalizar.
10. Adding an item enables Finalizar.
11. A future unreached step cannot be skipped.
12. A previously reached step can be revisited while its validation remains valid.
13. Invalidating Cliente disables Products/Finalizar without deleting the draft.
14. Emptying the cart disables Finalizar without deleting customer/adjustment state.
15. Finalizar shows full cart, delivery fee when applicable, adjustment, total and both save actions.
16. Finalizar -> Produtos -> Cliente preserves items, fee and adjustment.
17. Entrega -> Retirada/Local keeps items and zeroes delivery fee.
18. Local -> Entrega/Retirada blocks forward navigation until a valid registered client exists.
19. Dirty Cancelar venda opens discard confirmation.
20. Dirty sidebar/mobile navigation opens the same discard confirmation.
21. Canceling discard keeps the complete draft.
22. Confirming discard leaves Nova venda and clears the unmounted draft.
23. Failed checkout remains on Finalizar with the draft intact.
24. Successful pending checkout preserves existing pending-payment behavior.
25. Successful paid checkout still asks one payment method and preserves operational semantics.
```

- [ ] **Step 6: Stop at the staging homologation gate**

Report the exact feature commit SHA, staging workflow result and acceptance result. Do not merge to `master` and do not deploy production until the human explicitly approves the staging result.
