# Multi-item Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-product order form with a dedicated multi-item New Order flow that supports item notes, optional delivery fee, order-level discount/surcharge, quick client creation, and either pending or immediately paid checkout without duplicating sales.

**Architecture:** Keep D1 as the source of truth and evolve the existing `POST /api/orders` contract to accept a cart. The Worker validates the cart, reloads active product prices from D1, calculates totals, and writes order/items plus optional payment/movement in one D1 batch guarded by the existing idempotency key. The React frontend owns only the draft, preview, search/category state, and a stable retry key; operational screens render the normalized `order.items` returned by the server.

**Tech Stack:** React 19.2.8, ReactDOM 19.2.8, Vite 8.2.2, Node 22 built-in test runner, oxlint 1.79.0, Cloudflare Workers, Wrangler 4.128.0, Cloudflare D1.

**Spec:** `docs/superpowers/specs/2026-09-01-multi-item-orders-design.md`

## Global Constraints

- Preserve all existing D1 data; use a new incremental migration and never recreate the production database.
- New order creation uses a dedicated screen, while `Pedidos` remains focused on operation/kitchen.
- The cart must contain at least one item.
- Item notes are optional, trimmed before persistence, and limited to 300 characters.
- Same product + equivalent normalized note merges quantity; a different note remains a separate line.
- Product price is never editable in the sale; the Worker reloads `products.price_cents` and is the authority for all persisted totals.
- Delivery fee is a separate optional amount and only applies to `Entrega`; `Retirada` and `Local` have effective fee zero.
- Order adjustment is `none`, `discount`, or `surcharge`; mode is `fixed` or `percentage`; reason is optional and limited to 200 characters.
- Fixed `adjustment_value` persists in cents. Percentage `adjustment_value` persists in basis points (`10000 = 100.00%`). Percentage accepts 0.00 through 100.00 inclusive with at most two decimals.
- Percentage adjustment applies only to the product subtotal, never to delivery fee. Discount cannot reduce the product subtotal below zero.
- One payment method per order in this phase. No partial/split payments.
- `Salvar e receber` creates payment and finance movement but an active order remains `Em preparo`.
- The same idempotency key represents the complete logical checkout and must be reused after a failed retry of the same draft.
- Active kitchen cards show every item and its note. Finished history may be compact but must open a complete read-only detail.
- Existing historical order/date behavior remains unchanged.
- No address field is added to order checkout.
- Offline writes remain blocked.
- No unit-price editing, post-save order editing, partial cancellation, automatic neighborhood fee, new operational statuses, printing, inventory, structured modifiers, or combos.
- Mandatory validation before production remains `npm test`, `npm run lint`, `npm run build`, and `npx --yes wrangler@4.128.0 deploy --dry-run`.
- Do not run the remote D1 migration or production deploy until the user explicitly asks to publish this phase.

---

## File structure locked by this plan

### Backend / persistence

- Create `migrations/0003_order_checkout.sql` — add `orders.delivery_fee_cents` and `order_items.note` with safe defaults.
- Create `worker/orderCheckout.js` — pure checkout validation/normalization and monetary calculation helpers.
- Create `worker/orderCheckout.test.js` — pure checkout-domain tests.
- Modify `worker/repositories.js` — map new fields and create multi-item/optional-paid checkout atomically.
- Modify `worker/repositories.test.js` — mapper/bootstrap compatibility tests for fee/note/adjustment units.
- Modify `worker/orderRepositories.test.js` — multi-item, paid-checkout, idempotency and rollback repository tests.
- Modify `worker/index.js` — route `POST /api/orders` through checkout validation.
- Modify `worker/orderRoutes.test.js` — route contract validation tests.

### Frontend domain/API

- Create `src/utils/orderCart.js` — cart grouping, quantity/note mutation, preview totals, payload creation, item summary and searchable text.
- Create `src/utils/orderCart.test.js` — cart and presentation helper tests.
- Modify `src/api/client.js` — continue accepting an explicit checkout idempotency key and send the new payload unchanged.
- Modify `src/api/client.test.js` — exact multi-item payload/idempotency test.

### Frontend UI

- Create `src/pages/NewOrder.jsx` — dedicated sale-draft screen and orchestration of focused components.
- Create `src/components/OrderProductCatalog.jsx` — product search/category selection and add-to-cart actions.
- Create `src/components/OrderCart.jsx` — quantities, note editing, consolidation and item removal.
- Create `src/components/OrderCheckoutSummary.jsx` — delivery fee, adjustment preview and the two save paths.
- Create `src/components/OrderDetail.jsx` — read-only complete order details for active/history use.
- Create `src/new-order.css` — desktop two-column and mobile stacked responsive layout.
- Modify `src/App.jsx` — remove the old single-product modal, manage stable checkout key, quick client create callback and new-order navigation.
- Modify `src/pages/Orders.jsx` — render all active items/notes and open order detail from active/history.
- Modify `src/order-operations.css` — multi-line item and detail affordances.
- Modify `src/pages/Dashboard.jsx` — item-based recent-order summary.
- Modify `src/pages/Receivables.jsx` — item-based summary/search.

### Docs / validation

- Modify `README.md` — describe multi-item checkout and production acceptance checks.

---

### Task 1: Build the frontend cart domain with TDD

**Files:**
- Create: `src/utils/orderCart.js`
- Create: `src/utils/orderCart.test.js`

**Interfaces:**
- Consumes: products shaped `{ id, name, category, size, price }` and normalized/legacy orders.
- Produces: `normalizeItemNote(note)`, `addCartItem(items, product, note)`, `updateCartItem(items, lineId, patch)`, `removeCartItem(items, lineId)`, `calculateOrderPreview(draft)`, `buildOrderPayload(draft, paymentMethod)`, `getOrderItems(order)`, `getOrderItemsSummary(order)`, `getOrderItemsSearchText(order)`.

- [ ] **Step 1: Write failing cart grouping and mutation tests**

Create `src/utils/orderCart.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addCartItem, buildOrderPayload, calculateOrderPreview,
  getOrderItems, getOrderItemsSearchText, getOrderItemsSummary,
  removeCartItem, updateCartItem,
} from './orderCart.js'

const marmita = { id: 'p1', name: 'Marmita G', category: 'Marmita', size: 'G', price: 32 }
const coca = { id: 'p2', name: 'Coca-Cola', category: 'Bebida', size: 'Lata', price: 8 }

test('same product and normalized note merge quantity', () => {
  let items = addCartItem([], marmita, ' sem   cebola ')
  items = addCartItem(items, marmita, 'Sem cebola')
  assert.equal(items.length, 1)
  assert.equal(items[0].quantity, 2)
  assert.equal(items[0].note, 'sem cebola')
})

test('different notes stay separate and editing can consolidate them', () => {
  let items = addCartItem([], marmita, 'sem cebola')
  items = addCartItem(items, marmita, 'sem salada')
  items = updateCartItem(items, items[1].lineId, { note: '  SEM CEBOLA ' })
  assert.equal(items.length, 1)
  assert.equal(items[0].quantity, 2)
})

test('quantity never drops below one and remove deletes the line', () => {
  let items = addCartItem([], coca, '')
  items = updateCartItem(items, items[0].lineId, { quantity: 0 })
  assert.equal(items[0].quantity, 1)
  assert.deepEqual(removeCartItem(items, items[0].lineId), [])
})
```

- [ ] **Step 2: Run the cart tests and verify red**

```bash
node --test src/utils/orderCart.test.js
```

Expected: FAIL because `src/utils/orderCart.js` does not exist.

- [ ] **Step 3: Implement grouping and mutation helpers**

Create `src/utils/orderCart.js` with this public behavior:

```js
const cleanSpaces = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')
export const normalizeItemNote = (value) => cleanSpaces(value).slice(0, 300)
const mergeKey = (productId, note) => `${productId}::${normalizeItemNote(note).toLocaleLowerCase('pt-BR')}`

export const addCartItem = (items, product, note = '') => {
  const normalizedNote = normalizeItemNote(note)
  const key = mergeKey(product.id, normalizedNote)
  const existing = items.find((item) => mergeKey(item.productId, item.note) === key)
  if (existing) return items.map((item) => item.lineId === existing.lineId ? { ...item, quantity: item.quantity + 1 } : item)
  return [...items, {
    lineId: crypto.randomUUID(), productId: product.id, name: product.name,
    category: product.category || '', size: product.size || '', unitPrice: Number(product.price) || 0,
    quantity: 1, note: normalizedNote,
  }]
}

export const removeCartItem = (items, lineId) => items.filter((item) => item.lineId !== lineId)
```

Implement `updateCartItem` so quantity is clamped to at least 1 and note editing re-runs consolidation by the same merge key.

- [ ] **Step 4: Add failing calculation/payload/presentation tests, then implement them**

Append:

```js
test('percentage discount excludes delivery fee and payload contains no price', () => {
  const items = [...addCartItem([], marmita, ''), ...addCartItem([], coca, '')]
  const draft = {
    clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items,
    deliveryFee: 8,
    adjustment: { type: 'discount', mode: 'percentage', value: 10, reason: ' fidelidade ' },
  }
  assert.deepEqual(calculateOrderPreview(draft), { subtotal: 40, deliveryFee: 8, adjustmentAmount: 4, total: 44 })
  const payload = buildOrderPayload(draft, 'Pix')
  assert.equal(payload.items[0].unitPrice, undefined)
  assert.equal(payload.paymentMethod, 'Pix')
  assert.equal(payload.adjustment.reason, 'fidelidade')
})

test('summary and search use every item and tolerate legacy fields', () => {
  const order = { items: [{ name: 'Marmita G', quantity: 2 }, { name: 'Coca-Cola', quantity: 1 }] }
  assert.match(getOrderItemsSummary(order), /Coca-Cola/)
  assert.match(getOrderItemsSearchText(order).toLowerCase(), /coca-cola/)
  assert.equal(getOrderItems({ productName: 'Pudim', quantity: 1, size: '' })[0].name, 'Pudim')
})
```

Implement `calculateOrderPreview` with percentage over product subtotal only, fee zero for non-`Entrega`, and discount capped at subtotal. Implement `buildOrderPayload` with only `productId`, `quantity`, `note`, order metadata, fee, adjustment, and optional `paymentMethod`. Implement the three presentation helpers with legacy fallback.

Run:

```bash
node --test src/utils/orderCart.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the frontend cart domain**

```bash
git add src/utils/orderCart.js src/utils/orderCart.test.js
git commit -m "feat: add multi-item order cart domain"
```

---

### Task 2: Add server-side checkout validation and authoritative calculations

**Files:**
- Create: `worker/orderCheckout.js`
- Create: `worker/orderCheckout.test.js`
- Modify: `worker/validation.js`
- Modify: `worker/validation.test.js`

**Interfaces:**
- Consumes: raw request body plus `idempotency-key`; product-priced item rows `{ quantity, priceCents }`.
- Produces: `validateCheckoutInput(body, idempotencyKey)` and `calculateCheckoutTotals(pricedItems, deliveryFeeCents, adjustment)`.

- [ ] **Step 1: Write failing checkout validation/calculation tests**

Create `worker/orderCheckout.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCheckoutTotals, validateCheckoutInput } from './orderCheckout.js'

test('checkout converts fee and percentage to storage units', () => {
  const input = validateCheckoutInput({
    clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01',
    items: [{ productId: 'p1', quantity: 2, note: ' sem   cebola ' }],
    deliveryFee: 8,
    adjustment: { type: 'discount', mode: 'percentage', value: 7.5, reason: ' fidelidade ' },
    paymentMethod: 'Pix',
  }, 'checkout-1')
  assert.equal(input.items[0].note, 'sem cebola')
  assert.equal(input.deliveryFeeCents, 800)
  assert.equal(input.adjustment.storedValue, 750)
  assert.equal(input.adjustment.reason, 'fidelidade')
})

test('checkout rejects empty cart, long note, bad percentage and fee outside Entrega', () => {
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [] }, 'k'))
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1, note: 'x'.repeat(301) }] }, 'k'))
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1 }], adjustment: { type: 'discount', mode: 'percentage', value: 100.01 } }, 'k'))
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Retirada', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1 }], deliveryFee: 5 }, 'k'))
})

test('discount percentage applies to products only and cannot consume fee', () => {
  assert.deepEqual(calculateCheckoutTotals(
    [{ quantity: 2, priceCents: 3200 }, { quantity: 1, priceCents: 800 }], 800,
    { type: 'discount', mode: 'percentage', storedValue: 1000 },
  ), { subtotalCents: 7200, adjustmentAmountCents: 720, totalCents: 7280 })
})
```

- [ ] **Step 2: Run the tests and verify red**

```bash
node --test worker/orderCheckout.test.js
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add bounded text and exact percentage validation**

In `worker/validation.js`, export:

```js
export const optionalTextMax = (value, maxLength, field = 'value') => {
  const text = optionalText(value)
  if (text.length > maxLength) throw validationError(field, `O campo ${field} aceita no máximo ${maxLength} caracteres.`)
  return text
}
```

Add direct tests in `worker/validation.test.js` for exactly `maxLength` accepted and `maxLength + 1` rejected.

In `worker/orderCheckout.js`, convert percentages to basis points only when they have at most two decimals:

```js
const percentageToBasisPoints = (value) => {
  const number = Number(value ?? 0)
  const scaled = Math.round((number + Number.EPSILON) * 100)
  if (!Number.isFinite(number) || number < 0 || number > 100 || Math.abs(number * 100 - scaled) > 1e-7) {
    throw Object.assign(new Error('Percentual inválido.'), { status: 400, code: 'VALIDATION_ERROR', field: 'adjustment.value' })
  }
  return scaled
}
```

`validateCheckoutInput` must require the idempotency key, client id, valid type/date, at least one item, active-shape product ids, integer quantities, notes <= 300, reason <= 200, valid optional payment method, and must merge duplicate payload lines by product + normalized lowercase note. Fixed adjustment `storedValue` is `moneyToCents(value)`; percentage `storedValue` is basis points.

- [ ] **Step 4: Implement integer-cent totals and run focused suites**

Use:

```js
const subtotalCents = pricedItems.reduce((sum, item) => sum + item.quantity * item.priceCents, 0)
const rawAdjustment = adjustment.type === 'none' ? 0
  : adjustment.mode === 'fixed'
    ? adjustment.storedValue
    : Math.round(subtotalCents * adjustment.storedValue / 10000)
const adjustmentAmountCents = adjustment.type === 'discount' ? Math.min(rawAdjustment, subtotalCents) : rawAdjustment
const adjustedItems = adjustment.type === 'discount' ? subtotalCents - adjustmentAmountCents : subtotalCents + adjustmentAmountCents
return { subtotalCents, adjustmentAmountCents, totalCents: adjustedItems + deliveryFeeCents }
```

Run:

```bash
node --test worker/orderCheckout.test.js worker/validation.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit server checkout domain**

```bash
git add worker/orderCheckout.js worker/orderCheckout.test.js worker/validation.js worker/validation.test.js
git commit -m "feat: validate multi-item order checkout"
```

---

### Task 3: Migrate D1 and make checkout persistence multi-item and atomic

**Files:**
- Create: `migrations/0003_order_checkout.sql`
- Modify: `worker/repositories.js`
- Modify: `worker/repositories.test.js`
- Modify: `worker/orderRepositories.test.js`

**Interfaces:**
- Consumes: normalized checkout from Task 2.
- Produces: existing `createOrder(db, businessId, input, now)` accepting `items[]`, `deliveryFeeCents`, normalized `adjustment`, optional `paymentMethod`, and returning the complete normalized order.

- [ ] **Step 1: Write failing mapper tests for fee/note/friendly adjustment units**

Extend `worker/repositories.test.js`:

```js
test('order/item mapping exposes delivery fee, note and friendly percentage', () => {
  const item = mapOrderItemRow({ id: 'i1', product_id: 'p1', name_snapshot: 'Marmita G', category_snapshot: 'Marmita', size_snapshot: 'G', quantity: 1, catalog_price_cents: 3200, unit_price_cents: 3200, price_reason: '', note: 'sem cebola' })
  const order = mapOrderRow({
    id: 'o1', client_name_snapshot: 'Maria', type: 'Entrega', status: 'Em preparo', order_date: '2026-09-01',
    subtotal_cents: 3200, delivery_fee_cents: 800, adjustment_type: 'discount', adjustment_mode: 'percentage',
    adjustment_value: 750, adjustment_amount_cents: 240, adjustment_reason: 'fidelidade', total_cents: 3760,
    created_at: '2026-09-01T20:00:00.000Z', finished_at: null,
  }, [item])
  assert.equal(item.note, 'sem cebola')
  assert.equal(order.deliveryFee, 8)
  assert.equal(order.adjustment.value, 7.5)
})
```

- [ ] **Step 2: Write failing repository tests for multi-item pending/paid checkout and retry**

Add a second product to `OrderDb`, update its SQL fake for new insert columns, then add:

```js
test('createOrder uses server product prices for several items, fee and adjustment', async () => {
  const db = new OrderDb()
  db.products.set('p2', { id: 'p2', business_id: 'amor-e-sabor', category: 'Bebida', size: 'Lata', name: 'Coca', price_cents: 800, active: 1 })
  const order = await createOrder(db, 'amor-e-sabor', {
    clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', idempotencyKey: 'multi-1',
    items: [{ productId: 'p1', quantity: 2, note: 'sem cebola' }, { productId: 'p2', quantity: 1, note: '' }],
    deliveryFeeCents: 800,
    adjustment: { type: 'discount', mode: 'percentage', storedValue: 1000, reason: '' },
    paymentMethod: null,
  }, new Date('2026-09-01T20:00:00.000Z'))
  assert.equal(order.items.length, 2)
  assert.equal(order.subtotal, 72)
  assert.equal(order.deliveryFee, 8)
  assert.equal(order.total, 72.8)
  assert.equal(order.paymentStatus, 'Pendente')
})

test('paid retry creates one order, payment and movement and stays Em preparo', async () => {
  const db = new OrderDb()
  const payload = {
    clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', idempotencyKey: 'paid-1',
    items: [{ productId: 'p1', quantity: 1, note: '' }], deliveryFeeCents: 0,
    adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' }, paymentMethod: 'Pix',
  }
  const first = await createOrder(db, 'amor-e-sabor', payload, new Date('2026-09-01T20:00:00.000Z'))
  const second = await createOrder(db, 'amor-e-sabor', payload, new Date('2026-09-01T20:01:00.000Z'))
  assert.equal(first.id, second.id)
  assert.equal(first.status, 'Em preparo')
  assert.equal(first.paymentStatus, 'Pago')
  assert.equal(db.orders.size, 1)
  assert.equal(db.payments.size, 1)
  assert.equal(db.movements.size, 1)
})
```

Add one forced batch-failure test and assert all four maps remain empty to prove rollback behavior.

Run:

```bash
node --test worker/repositories.test.js worker/orderRepositories.test.js
```

Expected: FAIL on new fields/multi-item behavior.

- [ ] **Step 3: Add the incremental migration**

Create `migrations/0003_order_checkout.sql`:

```sql
ALTER TABLE orders ADD COLUMN delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0);
ALTER TABLE order_items ADD COLUMN note TEXT NOT NULL DEFAULT '';
```

Apply locally:

```bash
npm run d1:migrate:local
```

Expected: `0003_order_checkout.sql` applies without recreating existing tables.

- [ ] **Step 4: Refactor mapping and atomic `createOrder`**

Update every order SELECT with `o.delivery_fee_cents`, every item SELECT with `note`, and map old missing values to zero/empty string. Friendly adjustment value mapping is:

```js
const adjustmentValue = row.adjustment_mode === 'percentage'
  ? Number(row.adjustment_value || 0) / 100
  : centsToMoney(row.adjustment_value)
```

For `createOrder`, load the client inside `businessId`, load each active product inside `businessId`, build priced items from D1 `price_cents`, call `calculateCheckoutTotals`, then create one `db.batch` containing one order statement + all item statements + optional payment + optional one automatic finance movement. For new item rows, `catalog_price_cents === unit_price_cents`, `price_reason = ''`, and persist `note`.

Keep the existing pre-check/collision recovery by `idempotency_key`; a retry returns `loadOrderById` including existing payment state instead of inserting anything.

- [ ] **Step 5: Run repository suites and commit**

```bash
node --test worker/repositories.test.js worker/orderRepositories.test.js
```

Expected: PASS.

```bash
git add migrations/0003_order_checkout.sql worker/repositories.js worker/repositories.test.js worker/orderRepositories.test.js
git commit -m "feat: persist atomic multi-item checkout"
```

---

### Task 4: Evolve the Worker route and frontend API contract

**Files:**
- Modify: `worker/index.js`
- Modify: `worker/orderRoutes.test.js`
- Modify: `src/api/client.js`
- Modify: `src/api/client.test.js`

**Interfaces:**
- Consumes: `validateCheckoutInput` and `createOrder` from prior tasks.
- Produces: `POST /api/orders` with cart payload and explicit stable `idempotency-key`; response remains `{ order }` with HTTP 201.

- [ ] **Step 1: Write failing route tests for the new cart contract**

In `worker/orderRoutes.test.js`, use:

```js
test('order checkout rejects malformed cart fields before DB writes', async () => {
  const { env, cookie } = await loggedIn()
  const base = { clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1, note: '' }] }

  const missingKey = await handleRequest(new Request('https://delivery.example/api/orders', {
    method: 'POST', headers: headers(cookie), body: JSON.stringify(base),
  }), env)
  assert.equal(missingKey.status, 400)

  const longNote = await handleRequest(new Request('https://delivery.example/api/orders', {
    method: 'POST', headers: { ...headers(cookie), 'idempotency-key': 'k1' },
    body: JSON.stringify({ ...base, items: [{ productId: 'p1', quantity: 1, note: 'x'.repeat(301) }] }),
  }), env)
  assert.equal(longNote.status, 400)
})
```

Also assert nonzero fee on `Retirada`, percentage `100.01`, and `paymentMethod: 'Cheque'` return `VALIDATION_ERROR`.

- [ ] **Step 2: Route order creation through checkout validation**

Replace the old single-product parser in `worker/index.js`:

```js
import { validateCheckoutInput } from './orderCheckout.js'

if (url.pathname === '/api/orders' && request.method === 'POST') {
  assertSameOriginMutation(request)
  const input = validateCheckoutInput(await readJson(request), request.headers.get('idempotency-key'))
  const order = await createOrder(env.DB, session.businessId, input)
  return json({ order }, { status: 201 })
}
```

Keep auth, same-origin mutation, status, delete, later-payment and finance routes unchanged.

Run:

```bash
node --test worker/orderRoutes.test.js worker/index.test.js worker/orderCheckout.test.js worker/orderRepositories.test.js
```

Expected: PASS.

- [ ] **Step 3: Characterize exact frontend cart payload and key**

Update `src/api/client.test.js`:

```js
await createOrder({
  clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01',
  items: [{ productId: 'p1', quantity: 2, note: 'sem cebola' }],
  deliveryFee: 8,
  adjustment: { type: 'discount', mode: 'percentage', value: 10, reason: '' },
  paymentMethod: 'Pix',
}, 'checkout-key')

const [orderPath, orderOptions] = calls[0]
assert.equal(orderPath, '/api/orders')
assert.equal(orderOptions.headers['idempotency-key'], 'checkout-key')
assert.deepEqual(JSON.parse(orderOptions.body).items, [{ productId: 'p1', quantity: 2, note: 'sem cebola' }])
```

- [ ] **Step 4: Run frontend API test and make only contract-preserving changes if needed**

```bash
node --test src/api/client.test.js
```

Expected: PASS because the current helper already serializes arbitrary order payloads and accepts an explicit key. If code changes are required, keep the signature exactly:

```js
export const createOrder = (order, idempotencyKey = crypto.randomUUID()) => apiRequest('/api/orders', {
  ...withJson('POST', order),
  headers: { 'idempotency-key': idempotencyKey },
})
```

- [ ] **Step 5: Commit route/API contract**

```bash
git add worker/index.js worker/orderRoutes.test.js src/api/client.js src/api/client.test.js
git commit -m "feat: expose multi-item checkout API"
```

---

### Task 5: Build and integrate the dedicated New Order screen

**Files:**
- Create: `src/pages/NewOrder.jsx`
- Create: `src/components/OrderProductCatalog.jsx`
- Create: `src/components/OrderCart.jsx`
- Create: `src/components/OrderCheckoutSummary.jsx`
- Create: `src/new-order.css`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: Task 1 cart helpers and Task 4 `createOrder` API.
- Produces: complete pending or paid checkout while preserving draft + stable key on failure.

- [ ] **Step 1: Replace old single-order modal state with stable checkout orchestration in App**

Remove `form`, `showOrderModal`, `selectedProduct`, `openOrderModal`, and `handleOrderSubmit`. Add:

```js
const [checkoutKey, setCheckoutKey] = useState(null)

const handleNewOrder = () => {
  if (writesBlocked) return
  setCheckoutKey(crypto.randomUUID())
  setActiveTab('new-order')
}

const handleOrderCheckout = async (payload) => {
  if (writesBlocked) return false
  const key = checkoutKey || crypto.randomUUID()
  if (!checkoutKey) setCheckoutKey(key)
  setRequestKey('order:create')
  try {
    const { order } = await createOrderApi(payload, key)
    setOrders((current) => current.some((item) => item.id === order.id)
      ? current.map((item) => item.id === order.id ? order : item)
      : [order, ...current])
    if (order.paymentStatus === 'Pago') await refreshBootstrap()
    setCheckoutKey(null)
    setActiveTab('orders')
    showSuccessMessage(order.paymentStatus === 'Pago' ? 'Pedido salvo e pagamento recebido' : 'Pedido entrou em preparo')
    return true
  } catch (error) {
    showApiError(error)
    return false
  } finally {
    setRequestKey(null)
  }
}
```

The catch path must not clear `checkoutKey`.

Add:

```js
const handleQuickCreateClient = async ({ name, phone }) => {
  if (writesBlocked || !name.trim()) return null
  setRequestKey('client:create:quick')
  try {
    const { client } = await createClientApi({ name: name.trim(), phone: phone || '', address: '' })
    setClients((current) => [client, ...current])
    return client
  } catch (error) {
    showApiError(error)
    return null
  } finally {
    setRequestKey(null)
  }
}
```

- [ ] **Step 2: Create NewOrder page with client/type/date/draft state**

`src/pages/NewOrder.jsx` starts with:

```jsx
const emptyAdjustment = { type: 'none', mode: 'fixed', value: 0, reason: '' }

function NewOrder({ clients, products, currency, disabled, onCancel, onCreateClient, onSubmit }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [type, setType] = useState('Entrega')
  const [orderDate, setOrderDate] = useState(toLocalDateValue())
  const [items, setItems] = useState([])
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [adjustment, setAdjustment] = useState(emptyAdjustment)
  const [quickClient, setQuickClient] = useState({ open: false, name: '', phone: '' })
  const [checkoutError, setCheckoutError] = useState('')

  const draft = { clientId, type, orderDate, items, deliveryFee: type === 'Entrega' ? deliveryFee : 0, adjustment }
  const preview = calculateOrderPreview(draft)
```

When type changes away from `Entrega`, immediately call `setDeliveryFee(0)`. Quick-create calls `onCreateClient`; if it returns a client, call `setClientId(client.id)` and close/reset only the mini-form. If it returns null, keep the cart and mini-form intact.

- [ ] **Step 3: Create searchable categorized catalog and editable cart components**

`OrderProductCatalog.jsx` derives:

```js
const categories = ['Todos', ...new Set(products.map((product) => product.category).filter(Boolean))]
const normalized = search.trim().toLowerCase()
const visible = products.filter((product) =>
  (category === 'Todos' || product.category === category) &&
  (!normalized || [product.name, product.category, product.size].join(' ').toLowerCase().includes(normalized)),
)
```

Each product click calls `onAdd(product)`.

`OrderCart.jsx` renders every line with readonly price, line total, `-`, `+`, remove, and:

```jsx
<textarea
  maxLength={300}
  value={item.note}
  placeholder="Observação deste item"
  onChange={(event) => onUpdate(item.lineId, { note: event.target.value })}
/>
```

NewOrder must call `addCartItem` and `updateCartItem` from Task 1, so a note edit can consolidate equivalent lines.

- [ ] **Step 4: Create checkout summary and wire both save paths**

`OrderCheckoutSummary.jsx` renders product subtotal, conditional fee, adjustment type/mode/value/reason and total. Percentage field uses `min="0" max="100" step="0.01"`; reason uses `maxLength={200}`.

`Salvar pedido` calls:

```js
await onSubmit(buildOrderPayload(draft))
```

`Salvar e receber` reveals a select using exactly:

```js
const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']
```

and confirms with:

```js
await onSubmit(buildOrderPayload(draft, paymentMethod))
```

If `onSubmit` returns false, preserve every state field and show a local error. Disable saves for missing client, empty cart, missing date, offline/pending state.

- [ ] **Step 5: Wire App render, add responsive CSS, validate and commit**

In `App.jsx`, both Dashboard and Orders `onNewOrder` point to `handleNewOrder`. Render:

```jsx
{activeTab === 'new-order' && (
  <NewOrder
    clients={clients}
    products={products}
    currency={currency}
    disabled={writesBlocked}
    onCancel={() => { setCheckoutKey(null); setActiveTab('orders') }}
    onCreateClient={handleQuickCreateClient}
    onSubmit={handleOrderCheckout}
  />
)}
```

Delete the old `showOrderModal` JSX entirely.

`src/new-order.css` must include:

```css
.new-order-layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, .8fr); gap: 24px; align-items: start; }
.new-order-cart-column { position: sticky; top: 20px; }
@media (max-width: 900px) {
  .new-order-layout { grid-template-columns: 1fr; }
  .new-order-cart-column { position: static; }
}
```

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/pages/NewOrder.jsx src/components/OrderProductCatalog.jsx src/components/OrderCart.jsx src/components/OrderCheckoutSummary.jsx src/new-order.css src/App.jsx
git commit -m "feat: add dedicated multi-item new order flow"
```

---

### Task 6: Render complete multi-item orders throughout operation

**Files:**
- Create: `src/components/OrderDetail.jsx`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/order-operations.css`
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/App.jsx`
- Test: `src/utils/orderCart.test.js`

**Interfaces:**
- Consumes: `getOrderItems`, `getOrderItemsSummary`, `getOrderItemsSearchText` from Task 1.
- Produces: all active items/notes visible, compact finished summaries, complete detail, item-aware search.

- [ ] **Step 1: Add presentation regression test**

Append:

```js
test('multi-item search finds any product and legacy order stays readable', () => {
  assert.match(getOrderItemsSearchText({ items: [{ name: 'Marmita G' }, { name: 'Pudim' }] }).toLowerCase(), /pudim/)
  assert.equal(getOrderItems({ productName: 'Marmita P', size: 'P', quantity: 2 })[0].quantity, 2)
})
```

Run:

```bash
node --test src/utils/orderCart.test.js
```

Expected: PASS; this locks the shared presentation contract before UI edits.

- [ ] **Step 2: Render every active item and note in Orders**

Replace the active-card single-product line with:

```jsx
<div className="order-items-list">
  {getOrderItems(order).map((item) => (
    <div className="order-item-line" key={item.id || item.lineId || `${item.productId}-${item.name}-${item.note}`}>
      <strong>{item.quantity}x {item.name}</strong>
      {item.note && <span>↳ {item.note}</span>}
    </div>
  ))}
</div>
```

Do not truncate active items. Preserve timing/status/payment/total/finalize/delete behavior.

- [ ] **Step 3: Create one complete read-only detail component for active/history**

`OrderDetail.jsx` uses existing `Modal` and renders: client, type, date/time, status, payment status/method, every item/note, subtotal, delivery fee only when > 0, adjustment label/value/reason only when non-none, and total.

In `Orders.jsx`:

```js
const [detailOrder, setDetailOrder] = useState(null)
```

Add `Ver detalhes` to active cards, make finished rows open detail, and render:

```jsx
{detailOrder && <OrderDetail order={detailOrder} currency={currency} onClose={() => setDetailOrder(null)} />}
```

Finished rows use `getOrderItemsSummary(order)`.

- [ ] **Step 4: Make Dashboard, A Receber and order search item-aware**

Replace single-product descriptions in `Dashboard.jsx` and `Receivables.jsx` with `getOrderItemsSummary(order)`.

Receivables filtering includes `getOrderItemsSearchText(order)`. App order filtering becomes:

```js
return [order.client, order.type, order.orderDate, getOrderItemsSearchText(order), order.status, order.paymentStatus, order.paymentMethod]
  .join(' ')
  .toLowerCase()
  .includes(normalizedSearch)
```

- [ ] **Step 5: Style, validate and commit operational views**

Add focused `.order-items-list`, `.order-item-line`, detail-grid and clickable-history styles without changing urgency semantics.

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/components/OrderDetail.jsx src/pages/Orders.jsx src/order-operations.css src/pages/Dashboard.jsx src/pages/Receivables.jsx src/App.jsx src/utils/orderCart.test.js
git commit -m "feat: show complete multi-item orders in operation"
```

---

### Task 7: Document and verify the complete phase before production

**Files:**
- Modify: `README.md`
- Review: all files changed by Tasks 1-6

**Interfaces:**
- Consumes: complete implementation.
- Produces: validated code ready for the existing manual production workflow, without publishing yet.

- [ ] **Step 1: Run full automated tests**

```bash
npm test
```

Expected: all old and new Node tests PASS, including cart, checkout, validation, repository, routes, auth, API client, payment and order workflow suites.

- [ ] **Step 2: Run lint, build and Worker dry-run**

```bash
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: zero lint errors, successful Vite build, successful Wrangler validation without publishing.

- [ ] **Step 3: Confirm local migration state**

```bash
npm run d1:migrate:local
```

Expected: `0003_order_checkout.sql` applies once or reports already applied; existing local rows remain intact.

- [ ] **Step 4: Update README acceptance sequence**

Add this exact manual acceptance checklist:

```text
1. Abra Novo pedido.
2. Selecione ou crie cliente apenas com nome/telefone.
3. Adicione vários produtos; itens iguais com a mesma observação agrupam.
4. Adicione o mesmo produto com outra observação e confirme linha separada.
5. Para Entrega, deixe taxa em R$ 0,00 ou informe a taxa manual.
6. Aplique desconto/acréscimo em R$ ou %, se necessário.
7. Teste Salvar pedido e Salvar e receber.
8. Confirme que pedido pago continua Em preparo.
9. Confirme todos os itens/observações na fila e no detalhe.
10. Confirme uma única pendência ou uma única entrada financeira por venda.
```

State that remote migration/deploy remain manual release steps through the existing production workflow.

- [ ] **Step 5: Commit docs and stop before publication**

```bash
git add README.md
git commit -m "docs: document multi-item order checkout"
```

Inspect `git status` and latest commits. Report exact validation results and that `0003_order_checkout.sql` is ready. Do **not** run `npm run d1:migrate:remote`, `wrangler deploy`, or dispatch the production workflow until explicit user approval.

---

## Plan self-review checklist

- **Spec coverage:** cart grouping, note limits, server-authoritative prices, optional delivery fee, fixed/percentage adjustment, quick client, pending/paid checkout, atomic write, retry idempotency, kitchen display, detail/history, Dashboard/A Receber search/summary, compatibility and pre-production validation each map to an explicit task.
- **Placeholder scan:** no `TBD`, `TODO`, generic “add error handling”, or unnamed tests remain; commands, interfaces, field units and critical code paths are explicit.
- **Type consistency:** frontend payload uses BRL/percentage numbers; `validateCheckoutInput` converts fee/fixed values to cents and percentage to basis points; repository receives normalized storage units and mappers return user-facing money/percentage.
- **Task boundaries:** every task reaches a green test/build state and an independent commit/review gate before the next task begins.
- **Release safety:** remote migration and production deployment are intentionally excluded from automatic execution until explicit approval.
