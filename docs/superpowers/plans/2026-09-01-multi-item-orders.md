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
- Modify `src/api/client.js` — keep explicit checkout idempotency key and send the new payload unchanged.
- Modify `src/api/client.test.js` — exact multi-item payload/idempotency test.

### Frontend UI

- Create `src/pages/NewOrder.jsx` — dedicated sale-draft screen and orchestration of its focused components.
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
- Consumes: product objects shaped `{ id, name, category, size, price }` and order objects already returned by bootstrap.
- Produces: `normalizeItemNote(note)`, `addCartItem(items, product, note)`, `updateCartItem(items, lineId, patch)`, `removeCartItem(items, lineId)`, `calculateOrderPreview(draft)`, `buildOrderPayload(draft, paymentMethod)`, `getOrderItems(order)`, `getOrderItemsSummary(order)`, `getOrderItemsSearchText(order)`.

- [ ] **Step 1: Write failing cart grouping and mutation tests**

Create `src/utils/orderCart.test.js` with focused cases:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addCartItem,
  buildOrderPayload,
  calculateOrderPreview,
  getOrderItemsSearchText,
  getOrderItemsSummary,
  removeCartItem,
  updateCartItem,
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

test('different notes stay in separate lines and editing can consolidate', () => {
  let items = addCartItem([], marmita, 'sem cebola')
  items = addCartItem(items, marmita, 'sem salada')
  const secondId = items[1].lineId
  items = updateCartItem(items, secondId, { note: '  SEM CEBOLA ' })
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

Run:

```bash
node --test src/utils/orderCart.test.js
```

Expected: FAIL because `src/utils/orderCart.js` does not exist.

- [ ] **Step 3: Implement grouping, preview, payload and presentation helpers**

Create `src/utils/orderCart.js` around this exact public contract:

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

Implement `updateCartItem` so quantity is clamped to at least 1 and a note edit reconsolidates equivalent lines. Implement `calculateOrderPreview` with product subtotal, delivery fee only for `Entrega`, fixed/percentage adjustment over products only, discount capped at product subtotal, then total. Implement `buildOrderPayload` so it sends only `productId`, `quantity`, `note`, order metadata, delivery fee, adjustment and optional `paymentMethod`; do not send prices. Implement `getOrderItems` with legacy fallback from top-level `productName/size/quantity`, plus compact summary and search text helpers.

- [ ] **Step 4: Add calculation/payload/presentation assertions and verify green**

Append these tests:

```js
test('percentage discount excludes delivery fee and payload contains no price', () => {
  const items = [
    ...addCartItem([], marmita, ''),
    ...addCartItem([], coca, ''),
  ]
  const draft = {
    clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items,
    deliveryFee: 8, adjustment: { type: 'discount', mode: 'percentage', value: 10, reason: ' fidelidade ' },
  }
  assert.deepEqual(calculateOrderPreview(draft), {
    subtotal: 40, deliveryFee: 8, adjustmentAmount: 4, total: 44,
  })
  const payload = buildOrderPayload(draft, 'Pix')
  assert.equal(payload.items[0].unitPrice, undefined)
  assert.equal(payload.paymentMethod, 'Pix')
  assert.equal(payload.adjustment.reason, 'fidelidade')
})

test('summary and search use every item with legacy fallback', () => {
  const order = { items: [{ name: 'Marmita G', quantity: 2 }, { name: 'Coca-Cola', quantity: 1 }] }
  assert.match(getOrderItemsSummary(order), /Marmita G/)
  assert.match(getOrderItemsSummary(order), /Coca-Cola/)
  assert.match(getOrderItemsSearchText(order).toLowerCase(), /coca-cola/)
  assert.match(getOrderItemsSummary({ productName: 'Pudim', quantity: 1, size: '' }), /Pudim/)
})
```

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
- Consumes: raw request body plus `idempotency-key`; product-priced item rows shaped `{ quantity, priceCents }`.
- Produces: `validateCheckoutInput(body, idempotencyKey)` and `calculateCheckoutTotals(pricedItems, deliveryFeeCents, adjustment)`.

- [ ] **Step 1: Write failing validation/calculation tests**

Create `worker/orderCheckout.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCheckoutTotals, validateCheckoutInput } from './orderCheckout.js'

test('checkout normalizes notes, fixed money and percentage basis points', () => {
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
  assert.equal(input.paymentMethod, 'Pix')
})

test('checkout rejects empty cart, long note, invalid percentage and non-delivery fee', () => {
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [] }, 'k'))
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1, note: 'x'.repeat(301) }] }, 'k'))
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1 }], adjustment: { type: 'discount', mode: 'percentage', value: 100.01 } }, 'k'))
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Retirada', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1 }], deliveryFee: 5 }, 'k'))
})

test('server percentage applies to products only and discount cannot consume fee', () => {
  assert.deepEqual(calculateCheckoutTotals(
    [{ quantity: 2, priceCents: 3200 }, { quantity: 1, priceCents: 800 }],
    800,
    { type: 'discount', mode: 'percentage', storedValue: 1000 },
  ), { subtotalCents: 7200, adjustmentAmountCents: 720, totalCents: 7280 })
})
```

- [ ] **Step 2: Run checkout tests and verify red**

```bash
node --test worker/orderCheckout.test.js
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement exact input/storage normalization**

Create `worker/orderCheckout.js` and reuse current validators from `worker/validation.js`. Add a bounded-text helper to `validation.js`:

```js
export const optionalTextMax = (value, maxLength, field = 'value') => {
  const text = optionalText(value)
  if (text.length > maxLength) throw validationError(field, `O campo ${field} aceita no máximo ${maxLength} caracteres.`)
  return text
}
```

In `orderCheckout.js`, represent fixed adjustment `storedValue` in cents and percentage in basis points:

```js
const ADJUSTMENT_TYPES = new Set(['none', 'discount', 'surcharge'])
const ADJUSTMENT_MODES = new Set(['fixed', 'percentage'])

const percentageToBasisPoints = (value) => {
  const number = Number(value ?? 0)
  const scaled = Math.round((number + Number.EPSILON) * 100)
  if (!Number.isFinite(number) || number < 0 || number > 100 || Math.abs(number * 100 - scaled) > 1e-7) {
    throw Object.assign(new Error('Percentual inválido.'), { status: 400, code: 'VALIDATION_ERROR', field: 'adjustment.value' })
  }
  return scaled
}
```

`validateCheckoutInput` must require the idempotency key, validate every product id/quantity/note, merge duplicate payload lines by `productId + normalized lowercase note`, force absent delivery fee to zero, reject nonzero delivery fee for non-`Entrega`, validate optional payment method, and cap adjustment reason at 200 characters.

`calculateCheckoutTotals` must use integer cents only:

```js
const subtotalCents = pricedItems.reduce((sum, item) => sum + item.quantity * item.priceCents, 0)
const rawAdjustment = adjustment.type === 'none' ? 0
  : adjustment.mode === 'fixed'
    ? adjustment.storedValue
    : Math.round(subtotalCents * adjustment.storedValue / 10000)
const adjustmentAmountCents = adjustment.type === 'discount' ? Math.min(rawAdjustment, subtotalCents) : rawAdjustment
const adjusted = adjustment.type === 'discount' ? subtotalCents - adjustmentAmountCents : subtotalCents + adjustmentAmountCents
return { subtotalCents, adjustmentAmountCents, totalCents: adjusted + deliveryFeeCents }
```

- [ ] **Step 4: Run focused and existing validation tests**

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
- Consumes: normalized checkout from `validateCheckoutInput`.
- Produces: existing `createOrder(db, businessId, input, now)` now accepts `items[]`, `deliveryFeeCents`, normalized `adjustment`, optional `paymentMethod`, and returns the complete normalized order.

- [ ] **Step 1: Write failing mapper and repository checkout tests**

Extend `worker/repositories.test.js`:

```js
test('order/item mapping exposes delivery fee, note and friendly adjustment value', () => {
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

Extend `worker/orderRepositories.test.js` with a second product and tests equivalent to:

```js
test('createOrder writes multiple priced snapshots, fee and adjustment from server prices', async () => {
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

test('paid checkout batches order items payment and one movement and retry duplicates nothing', async () => {
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

- [ ] **Step 2: Run repository tests and verify red**

```bash
node --test worker/repositories.test.js worker/orderRepositories.test.js
```

Expected: FAIL because fee/note mapping and multi-item creation are not implemented.

- [ ] **Step 3: Add migration and refactor repository writes**

Create `migrations/0003_order_checkout.sql`:

```sql
ALTER TABLE orders ADD COLUMN delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0);
ALTER TABLE order_items ADD COLUMN note TEXT NOT NULL DEFAULT '';
```

Update all order/item SELECTs to include `o.delivery_fee_cents` and `order_items.note`. Update mappers:

```js
export const mapOrderItemRow = (row) => ({
  id: row.id, productId: row.product_id ?? null, name: row.name_snapshot,
  category: row.category_snapshot || '', size: row.size_snapshot || '', quantity: Number(row.quantity) || 1,
  catalogPrice: centsToMoney(row.catalog_price_cents), unitPrice: centsToMoney(row.unit_price_cents),
  priceReason: row.price_reason || '', note: row.note || '',
})
```

Map `deliveryFee` with `centsToMoney`. Map friendly `adjustment.value` with `centsToMoney(row.adjustment_value)` for `fixed`, and `Number(row.adjustment_value || 0) / 100` for `percentage`.

Refactor `createOrder` to load each active product in the session business, build priced items exclusively from `price_cents`, call `calculateCheckoutTotals`, then build one `db.batch([...])` containing: one order insert; one insert per item; and, when `paymentMethod` exists, exactly one payment insert and one automatic `movements` insert. Keep the current pre-check and unique-conflict recovery by `idempotency_key`. `unit_price_cents` equals catalog price and `price_reason` stays empty.

If any statement fails, D1 batch/fake batch rollback must leave no order/payment/movement partial state.

- [ ] **Step 4: Apply the migration locally and run repository suites**

```bash
npm run d1:migrate:local
node --test worker/repositories.test.js worker/orderRepositories.test.js
```

Expected: migration applies successfully and tests PASS.

- [ ] **Step 5: Commit persistence changes**

```bash
git add migrations/0003_order_checkout.sql worker/repositories.js worker/repositories.test.js worker/orderRepositories.test.js
git commit -m "feat: persist atomic multi-item checkout"
```

---

### Task 4: Evolve the order API contract without weakening route guards

**Files:**
- Modify: `worker/index.js`
- Modify: `worker/orderRoutes.test.js`

**Interfaces:**
- Consumes: `validateCheckoutInput(body, request.headers.get('idempotency-key'))`.
- Produces: `POST /api/orders` returns `{ order }`, status 201, for pending or paid checkout; all existing auth/same-origin protections remain.

- [ ] **Step 1: Add failing route validation tests**

Update the create-order route test to send cart payloads and add invalid cases:

```js
test('order checkout route rejects invalid cart fields before repository writes', async () => {
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

  const invalidFee = await handleRequest(new Request('https://delivery.example/api/orders', {
    method: 'POST', headers: { ...headers(cookie), 'idempotency-key': 'k2' },
    body: JSON.stringify({ ...base, type: 'Retirada', deliveryFee: 5 }),
  }), env)
  assert.equal(invalidFee.status, 400)
})
```

Also assert invalid `paymentMethod: 'Cheque'` and percentage `100.01` return `VALIDATION_ERROR`.

- [ ] **Step 2: Run route tests and verify red**

```bash
node --test worker/orderRoutes.test.js
```

Expected: at least the new cart-validation expectations fail.

- [ ] **Step 3: Route order creation through checkout validation**

Replace the old single-product `orderInput` usage with:

```js
import { validateCheckoutInput } from './orderCheckout.js'

if (url.pathname === '/api/orders' && request.method === 'POST') {
  assertSameOriginMutation(request)
  const input = validateCheckoutInput(await readJson(request), request.headers.get('idempotency-key'))
  const order = await createOrder(env.DB, session.businessId, input)
  return json({ order }, { status: 201 })
}
```

Remove the old `productId`/single `quantity` order-input parser but keep payment/status/delete routes unchanged.

- [ ] **Step 4: Run Worker route/auth/repository tests**

```bash
node --test worker/orderRoutes.test.js worker/index.test.js worker/orderCheckout.test.js worker/orderRepositories.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit API contract**

```bash
git add worker/index.js worker/orderRoutes.test.js
git commit -m "feat: accept cart checkout on orders API"
```

---

### Task 5: Make the frontend API and App preserve one logical checkout retry

**Files:**
- Modify: `src/api/client.js`
- Modify: `src/api/client.test.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `buildOrderPayload` output and a stable checkout key.
- Produces: `createOrder(payload, idempotencyKey)`; App callbacks `onSubmitOrder(payload)` and `onQuickCreateClient({ name, phone })` for `NewOrder`.

- [ ] **Step 1: Strengthen the API client test around exact cart payload and key**

Replace the old one-product create-order payload in `src/api/client.test.js` with:

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

- [ ] **Step 2: Run API client test**

```bash
node --test src/api/client.test.js
```

Expected: PASS with the current generic helper; this is a characterization gate confirming the client can already carry the new shape unchanged.

- [ ] **Step 3: Replace old order-modal controller state with stable checkout state**

In `src/App.jsx`, remove `form`, `showOrderModal`, `selectedProduct`, `openOrderModal`, and `handleOrderSubmit`. Add:

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
    setOrders((current) => current.some((item) => item.id === order.id) ? current.map((item) => item.id === order.id ? order : item) : [order, ...current])
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

Do not reset `checkoutKey` in the catch path. A server/network failure leaves the draft page mounted and reuses the same key.

Add quick client creation that does not use address in the sale:

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

- [ ] **Step 4: Wire a temporary `new-order` render seam and remove old modal JSX**

Import `NewOrder` in preparation for Task 6 and render it only for that state:

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

Update both Dashboard and Orders `onNewOrder` props to `handleNewOrder`. `NewOrder.jsx` will be created in Task 6 in the same implementation sequence before this commit is considered green.

Run after Task 6 files exist:

```bash
node --test src/api/client.test.js
npm run lint
npm run build
```

- [ ] **Step 5: Commit App/API integration together with Task 6 UI files**

Do not commit a broken import. Task 5 and Task 6 share one integration commit boundary after Task 6 reaches green:

```bash
git add src/api/client.js src/api/client.test.js src/App.jsx src/pages/NewOrder.jsx src/components/OrderProductCatalog.jsx src/components/OrderCart.jsx src/components/OrderCheckoutSummary.jsx src/new-order.css
git commit -m "feat: add dedicated multi-item new order flow"
```

---

### Task 6: Build the dedicated New Order screen

**Files:**
- Create: `src/pages/NewOrder.jsx`
- Create: `src/components/OrderProductCatalog.jsx`
- Create: `src/components/OrderCart.jsx`
- Create: `src/components/OrderCheckoutSummary.jsx`
- Create: `src/new-order.css`
- Modify: `src/App.jsx` as described in Task 5

**Interfaces:**
- Consumes: cart helpers from Task 1; `clients`, `products`, `currency`, `disabled`, `onCancel`, `onCreateClient`, `onSubmit`.
- Produces: a complete draft payload to App only after user chooses pending or paid checkout.

- [ ] **Step 1: Create the page state and quick-client flow**

`NewOrder.jsx` owns only draft UI state:

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

Quick-create calls `onCreateClient`; only clear its mini-form when a client object is returned. Never clear `items` on client-create failure.

- [ ] **Step 2: Build search + categories product catalog**

`OrderProductCatalog.jsx` owns `search` and selected category. Derive categories from current products, prepend `Todos`, and filter by both values:

```jsx
const categories = ['Todos', ...new Set(products.map((product) => product.category).filter(Boolean))]
const normalized = search.trim().toLowerCase()
const visible = products.filter((product) =>
  (category === 'Todos' || product.category === category) &&
  (!normalized || [product.name, product.category, product.size].join(' ').toLowerCase().includes(normalized)),
)
```

Each product button displays name, optional size/category and `currency(product.price)` and calls `onAdd(product)`.

- [ ] **Step 3: Build cart editor with per-line note and consolidation**

`OrderCart.jsx` receives `items` and callback functions. For each line render readonly unit price, line total, `-`/`+`, remove, and:

```jsx
<textarea
  maxLength={300}
  value={item.note}
  placeholder="Observação deste item"
  onChange={(event) => onUpdate(item.lineId, { note: event.target.value })}
/>
```

Use the Task 1 `updateCartItem` helper in `NewOrder` so changing the note can merge equivalent lines.

- [ ] **Step 4: Build checkout summary and two completion paths**

`OrderCheckoutSummary.jsx` renders product subtotal, conditional delivery fee, adjustment controls, total, and two actions. Percentage input must use `min="0"`, `max="100"`, `step="0.01"`; adjustment reason uses `maxLength={200}`.

`Salvar pedido` calls:

```js
onSubmit(buildOrderPayload(draft))
```

`Salvar e receber` first reveals one select populated with the existing methods:

```js
const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']
```

then confirms with:

```js
onSubmit(buildOrderPayload(draft, paymentMethod))
```

Disable both paths when there is no client, cart is empty, offline/pending, or date is missing. If `onSubmit` resolves `false`, keep every draft field untouched and show `Não foi possível salvar. Revise os dados e tente novamente.` inside the page.

- [ ] **Step 5: Add responsive CSS and validate the integrated screen**

In `src/new-order.css`, use a two-column layout on wide screens and stacked content below 900px:

```css
.new-order-layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, .8fr); gap: 24px; align-items: start; }
.new-order-cart-column { position: sticky; top: 20px; }
@media (max-width: 900px) {
  .new-order-layout { grid-template-columns: 1fr; }
  .new-order-cart-column { position: static; }
}
```

Import the stylesheet from `NewOrder.jsx`, complete the Task 5 App wiring, then run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands PASS. Commit using Task 5 Step 5.

---

### Task 7: Render multi-item orders everywhere the operation needs them

**Files:**
- Create: `src/components/OrderDetail.jsx`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/order-operations.css`
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/pages/Receivables.jsx`
- Modify: `src/App.jsx` search helper usage
- Test: `src/utils/orderCart.test.js`

**Interfaces:**
- Consumes: `getOrderItems`, `getOrderItemsSummary`, `getOrderItemsSearchText` from Task 1 and normalized order fields from backend.
- Produces: complete active kitchen cards and read-only detail view.

- [ ] **Step 1: Add presentation regression tests for legacy/new orders**

Extend `src/utils/orderCart.test.js`:

```js
test('multi-item search text finds any product and legacy order remains readable', () => {
  assert.match(getOrderItemsSearchText({ items: [{ name: 'Marmita G' }, { name: 'Pudim' }] }).toLowerCase(), /pudim/)
  assert.equal(getOrderItems({ productName: 'Marmita P', size: 'P', quantity: 2 })[0].quantity, 2)
})
```

Run:

```bash
node --test src/utils/orderCart.test.js
```

Expected: PASS before UI work; this is the shared presentation contract.

- [ ] **Step 2: Render every active kitchen item and note**

In `Orders.jsx`, replace the single product span inside active cards with:

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

Do not truncate active items. Keep timing/status/payment/total actions unchanged.

- [ ] **Step 3: Add complete read-only detail for active and finished orders**

Create `OrderDetail.jsx` that uses the existing `Modal` and renders client/type/date/status/payment, all item lines, subtotal, delivery fee when > 0, adjustment when non-none, reason when present, and total.

In `Orders.jsx`:

```js
const [detailOrder, setDetailOrder] = useState(null)
```

Add a `Ver detalhes` action to active cards and make finished rows open the same detail. Render:

```jsx
{detailOrder && <OrderDetail order={detailOrder} currency={currency} onClose={() => setDetailOrder(null)} />}
```

Finished rows use `getOrderItemsSummary(order)` instead of `productName`.

- [ ] **Step 4: Update Dashboard, Receivables and global order search**

In `Dashboard.jsx` and `Receivables.jsx`, replace single-product descriptions with `getOrderItemsSummary(order)`.

In `Receivables` filtering include `getOrderItemsSearchText(order)`. In App's order filtering use the shared helper:

```js
return [order.client, order.type, order.orderDate, getOrderItemsSearchText(order), order.status, order.paymentStatus, order.paymentMethod]
  .join(' ')
  .toLowerCase()
  .includes(normalizedSearch)
```

- [ ] **Step 5: Style and validate operational screens, then commit**

Add focused CSS for `.order-items-list`, `.order-item-line` and detail summary rows without changing existing urgency colors/layout rules. Run:

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

### Task 8: Full compatibility, documentation and pre-production verification

**Files:**
- Modify: `README.md`
- Review: all files changed by Tasks 1-7

**Interfaces:**
- Consumes: complete feature implementation.
- Produces: a validated master branch ready for the existing manual production workflow, without publishing yet.

- [ ] **Step 1: Run the complete automated suite**

```bash
npm test
```

Expected: all current and newly added Node tests PASS, including auth, validation, repository, API client, cart and order workflow tests.

- [ ] **Step 2: Run static/build/Worker validation**

```bash
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: lint reports zero errors, Vite builds successfully, and Wrangler dry-run validates Worker bindings/assets without publishing.

- [ ] **Step 3: Reapply local migrations from the current local database state**

```bash
npm run d1:migrate:local
```

Expected: `0003_order_checkout.sql` is applied once or reported as already applied; existing local rows remain intact.

- [ ] **Step 4: Update README acceptance instructions**

Document the new operational flow exactly:

```text
1. Abra Novo pedido.
2. Selecione ou crie cliente apenas com nome/telefone.
3. Adicione vários produtos; itens iguais com a mesma observação agrupam.
4. Confirme observações diferentes em linhas separadas.
5. Para Entrega, deixe a taxa em R$ 0,00 ou informe a taxa manual.
6. Aplique desconto/acréscimo em R$ ou %, se necessário.
7. Teste Salvar pedido e Salvar e receber.
8. Confirme que pedido pago continua Em preparo.
9. Confirme todos os itens/observações na fila e no detalhe.
10. Confirme uma única pendência ou uma única entrada financeira por venda.
```

Also state that the production workflow applies migrations before deploy and that remote migration/deploy are manual release steps.

- [ ] **Step 5: Commit docs and stop before production publication**

```bash
git add README.md
git commit -m "docs: document multi-item order checkout"
```

Then inspect `git status` and the latest commits. Report the exact validation results and the migration file ready for production. Do **not** run `npm run d1:migrate:remote`, `wrangler deploy`, or dispatch the production workflow until the user explicitly approves publication.

---

## Plan self-review checklist

- Spec coverage: cart grouping, note limits, server-authoritative prices, optional fee, fixed/percentage adjustment, quick client, pending/paid checkout, atomic write, retry idempotency, kitchen display, detail/history, Dashboard/A Receber search/summary, compatibility and pre-production validation are each assigned to a task.
- Placeholder scan: implementation steps specify concrete files, exported interfaces, commands, payload shapes and critical code paths; there are no `TBD`, `TODO`, or unspecified error-handling steps.
- Type consistency: frontend payload uses user-facing BRL/percentage numbers; `validateCheckoutInput` converts fee/fixed values to cents and percentage to basis points; repository receives normalized cents/basis points and returns user-facing money/percentage through existing mappers.
- Release safety: remote migration and production deployment are intentionally outside automatic plan execution until explicit user approval.
