# Central Persistence + PIN Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser-local business data with a shared Cloudflare Worker + D1 backend protected by a shared Amor & Sabor PIN, while keeping the current React UI operational and preparing the data model for multi-item orders and future multi-company use.

**Architecture:** Serve the existing React/Vite SPA and a same-origin `/api/*` Worker from one Cloudflare deployment. The Worker owns authentication, validation and D1 persistence; the frontend becomes an API client and keeps only transient UI state. Every business-owned row carries `business_id = 'amor-e-sabor'`, but the UI remains single-company.

**Tech Stack:** React 19.2.8, ReactDOM 19.2.8, Vite 8.2.2, Node 22 test runner, oxlint 1.79.0, Cloudflare Workers, Wrangler, Cloudflare D1, Web Crypto API.

**Spec:** `docs/superpowers/specs/2026-09-01-central-persistence-auth-design.md`

## Global Constraints

- The central persistence layer is implemented before the new multi-item order editor.
- The production source of truth for clients, products, orders, payments and movements is D1, not `localStorage`.
- No migration of current test data from `localStorage`.
- The database starts empty except for the Amor & Sabor business/auth bootstrap record.
- One shared PIN is used initially; the plaintext PIN must never be bundled into the frontend or committed to Git.
- Sessions use an opaque random token in an `HttpOnly; Secure; SameSite=Strict; Path=/` cookie; D1 stores only the SHA-256 token hash.
- All business-owned tables include `business_id`.
- IDs returned to the frontend are opaque strings; do not depend on numeric ordering or `Date.now()` IDs.
- No offline writes. Write controls must be disabled while offline and while the request is pending.
- Current operational status/payment behavior must remain unchanged during this phase.
- Current CI commands remain mandatory: `npm test`, `npm run lint`, `npm run build`.
- Do not implement post-save order editing, partial payments, multi-company UI, user accounts, or local/offline synchronization in this plan.

---

## File structure locked by this plan

### Worker / persistence

- Create `worker/index.js` — Worker entrypoint, same-origin API router, asset fallback.
- Create `worker/http.js` — JSON responses, request parsing, error normalization, origin guard.
- Create `worker/auth.js` — PBKDF2 PIN verification, session creation/lookup/revocation, cookie helpers.
- Create `worker/repositories.js` — D1 queries and row-to-domain mapping for bootstrap/CRUD.
- Create `worker/validation.js` — input validation and money/date normalization used by API routes.
- Create `worker/auth.test.js` — pure authentication helper tests.
- Create `worker/validation.test.js` — request/domain validation tests.
- Create `worker/repositories.test.js` — mapper/query-contract tests using small fake D1 statements where practical.
- Create `migrations/0001_initial.sql` — full initial D1 schema.
- Create `scripts/generate-pin-hash.mjs` — local-only PIN hash generator; prints a verifier string, never the PIN.
- Create `wrangler.jsonc` — Worker, static assets, SPA fallback, D1 binding.

### Frontend integration

- Create `src/api/client.js` — single same-origin fetch wrapper and typed endpoint functions.
- Create `src/api/client.test.js` — fetch-wrapper behavior tests.
- Create `src/components/LoginScreen.jsx` — shared-PIN login UI.
- Create `src/components/ConnectionBanner.jsx` — offline feedback.
- Modify `src/App.jsx` — bootstrap from API, auth gate, async CRUD, request pending state, no business `localStorage`.
- Modify `src/App.css` — login/offline/loading/error states.

### Project/config/docs

- Modify `package.json` and `package-lock.json` — add Wrangler and deployment/dev scripts.
- Modify `vite.config.js` only if required by chosen Worker/Vite integration after the first Worker smoke test; keep the current React plugin and port behavior unless Cloudflare integration requires a precise change.
- Modify `.github/workflows/validate.yml` — validate Worker tests/config in the normal test/lint/build flow without deploying.
- Modify `README.md` — local D1 setup, PIN bootstrap, migrations and deploy commands.

---

### Task 1: Add Worker/D1 project scaffold and initial schema

**Files:**
- Create: `wrangler.jsonc`
- Create: `migrations/0001_initial.sql`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: existing `npm test`, `npm run lint`, `npm run build`

**Interfaces:**
- Consumes: existing Vite output in `dist/`.
- Produces: D1 binding named `DB`; Worker entry path `worker/index.js`; migration schema consumed by all later tasks.

- [ ] **Step 1: Add Wrangler as a development dependency and scripts**

Run:

```bash
npm install --save-dev wrangler
```

Update `package.json` scripts to include:

```json
{
  "dev:worker": "wrangler dev",
  "d1:migrate:local": "wrangler d1 migrations apply amor-e-sabor-delivery --local",
  "d1:migrate:remote": "wrangler d1 migrations apply amor-e-sabor-delivery --remote",
  "deploy": "npm run build && wrangler deploy"
}
```

Do not remove the existing `dev`, `test`, `lint`, `build` or `preview` scripts.

- [ ] **Step 2: Create the D1 database and capture its real database ID**

Run once against the authenticated Cloudflare account:

```bash
npx wrangler d1 create amor-e-sabor-delivery
```

Use the exact `database_id` printed by Wrangler in `wrangler.jsonc`; do not commit a fabricated ID.

- [ ] **Step 3: Create `wrangler.jsonc` for one SPA + API Worker**

Use this shape, inserting only the real D1 `database_id` generated in Step 2:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "sistema-para-delivery",
  "main": "./worker/index.js",
  "compatibility_date": "2026-09-01",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "amor-e-sabor-delivery",
      "database_id": "USE_THE_REAL_ID_PRINTED_BY_WRANGLER",
      "migrations_dir": "migrations"
    }
  ]
}
```

Before committing, replace the literal `USE_THE_REAL_ID_PRINTED_BY_WRANGLER` with the actual UUID. The checked-in file must contain no placeholder string.

- [ ] **Step 4: Write `migrations/0001_initial.sql`**

Create all tables in the first migration so phase 1 can already store the current one-product order as one `order_items` row:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE auth_credentials (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX sessions_business_expires_idx ON sessions (business_id, expires_at);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX clients_business_name_idx ON clients (business_id, name);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX products_business_active_name_idx ON products (business_id, active, name);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  client_name_snapshot TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Entrega', 'Retirada', 'Local')),
  order_date TEXT NOT NULL,
  status TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  adjustment_type TEXT NOT NULL DEFAULT 'none' CHECK (adjustment_type IN ('none', 'discount', 'surcharge')),
  adjustment_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (adjustment_mode IN ('fixed', 'percentage')),
  adjustment_value INTEGER NOT NULL DEFAULT 0 CHECK (adjustment_value >= 0),
  adjustment_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (adjustment_amount_cents >= 0),
  adjustment_reason TEXT NOT NULL DEFAULT '',
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX orders_business_created_idx ON orders (business_id, created_at DESC);
CREATE INDEX orders_business_date_idx ON orders (business_id, order_date DESC);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  category_snapshot TEXT NOT NULL DEFAULT '',
  size_snapshot TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  catalog_price_cents INTEGER NOT NULL CHECK (catalog_price_cents >= 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  price_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX order_items_order_idx ON order_items (order_id);
CREATE INDEX order_items_business_idx ON order_items (business_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  method TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX payments_business_paid_idx ON payments (business_id, paid_at DESC);

CREATE TABLE movements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  value_cents INTEGER NOT NULL CHECK (value_cents > 0),
  source TEXT NOT NULL DEFAULT 'manual',
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  movement_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX movements_business_created_idx ON movements (business_id, created_at DESC);

INSERT INTO businesses (id, slug, name, created_at, updated_at)
VALUES ('amor-e-sabor', 'amor-e-sabor', 'Amor & Sabor', datetime('now'), datetime('now'));
```

Do not insert a PIN hash in the migration.

- [ ] **Step 5: Apply the migration locally and inspect tables**

Run:

```bash
npm run d1:migrate:local
npx wrangler d1 execute amor-e-sabor-delivery --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected: tables include `businesses`, `auth_credentials`, `sessions`, `clients`, `products`, `orders`, `order_items`, `payments`, `movements` and Wrangler's migration table.

- [ ] **Step 6: Run the existing quality gate**

Run:

```bash
npm test && npm run lint && npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json wrangler.jsonc migrations/0001_initial.sql
git commit -m "feat: scaffold Cloudflare D1 backend"
```

---

### Task 2: Implement cryptographic PIN verification and session primitives

**Files:**
- Create: `worker/auth.js`
- Create: `worker/auth.test.js`
- Create: `scripts/generate-pin-hash.mjs`

**Interfaces:**
- Consumes: `auth_credentials.pin_hash`, `sessions`, Web Crypto.
- Produces:
  - `hashPin(pin, saltBytes?) -> Promise<string>`
  - `verifyPin(pin, verifier) -> Promise<boolean>`
  - `createSession(env, businessId, now?) -> Promise<{ token, expiresAt }>`
  - `getAuthenticatedSession(request, env, now?) -> Promise<{ businessId, sessionId } | null>`
  - `revokeSession(request, env) -> Promise<void>`
  - `sessionCookie(token, maxAgeSeconds) -> string`
  - `clearSessionCookie() -> string`

- [ ] **Step 1: Write failing auth tests**

In `worker/auth.test.js`, cover verifier round-trip, wrong PIN, session cookie flags and token hashing:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { hashPin, verifyPin, sessionCookie } from './auth.js'

test('hashPin verifier accepts the original PIN and rejects a different PIN', async () => {
  const verifier = await hashPin('4827', new Uint8Array(16).fill(7))
  assert.equal(await verifyPin('4827', verifier), true)
  assert.equal(await verifyPin('9999', verifier), false)
})

test('session cookie is HttpOnly, Secure and Strict', () => {
  const cookie = sessionCookie('opaque-token', 604800)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
  assert.match(cookie, /Path=\//)
  assert.match(cookie, /Max-Age=604800/)
})
```

- [ ] **Step 2: Run the test and verify red**

Run:

```bash
node --test worker/auth.test.js
```

Expected: FAIL because `worker/auth.js` does not exist.

- [ ] **Step 3: Implement PBKDF2 verifier helpers**

Use verifier format `pbkdf2-sha256$210000$<base64-salt>$<base64-derived-key>`. Derive 32 bytes with `crypto.subtle.deriveBits`, SHA-256 and 210,000 iterations. Compare derived bytes with a constant-time XOR loop instead of comparing strings.

Export exactly:

```js
export const hashPin = async (pin, saltBytes = crypto.getRandomValues(new Uint8Array(16))) => { /* implementation */ }
export const verifyPin = async (pin, verifier) => { /* implementation */ }
```

Reject malformed verifier strings by returning `false`.

- [ ] **Step 4: Implement session token helpers**

Generate 32 random bytes for the raw token, encode URL-safe base64 without padding, and persist only `sha256(token)` in D1. Use a 7-day expiry.

Cookie output must be equivalent to:

```text
amor_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
```

`getAuthenticatedSession()` must return `null` for missing, expired or revoked sessions.

- [ ] **Step 5: Add the PIN hash generator script**

`scripts/generate-pin-hash.mjs` reads only `process.env.PIN`, exits non-zero if absent, calls `hashPin(PIN)` and prints only the verifier string.

Example safe operator flow:

```bash
read -s AMOR_PIN
PIN="$AMOR_PIN" node scripts/generate-pin-hash.mjs
unset AMOR_PIN
```

The plaintext PIN must not be written to a file.

- [ ] **Step 6: Run auth tests**

Run:

```bash
node --test worker/auth.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/auth.js worker/auth.test.js scripts/generate-pin-hash.mjs
git commit -m "feat: add PIN authentication primitives"
```

---

### Task 3: Add HTTP helpers, validation and authenticated API shell

**Files:**
- Create: `worker/http.js`
- Create: `worker/validation.js`
- Create: `worker/validation.test.js`
- Create: `worker/index.js`

**Interfaces:**
- Consumes: Task 2 auth helpers, `env.ASSETS`, `env.DB`.
- Produces same-origin API contract:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/session`
  - authenticated placeholder router for later `/api/*` resources.

- [ ] **Step 1: Write failing validation tests**

Cover at minimum:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { moneyToCents, requireNonEmpty, validateOrderType } from './validation.js'

test('moneyToCents rounds BRL values to integer cents', () => {
  assert.equal(moneyToCents(32.1), 3210)
  assert.equal(moneyToCents('8.99'), 899)
})

test('moneyToCents rejects negative and invalid values', () => {
  assert.throws(() => moneyToCents(-1))
  assert.throws(() => moneyToCents('abc'))
})

test('order type accepts only current operational values', () => {
  assert.equal(validateOrderType('Entrega'), 'Entrega')
  assert.throws(() => validateOrderType('Motoboy'))
})

test('requireNonEmpty trims valid strings', () => {
  assert.equal(requireNonEmpty('  Maria  ', 'name'), 'Maria')
})
```

- [ ] **Step 2: Run validation tests and verify red**

```bash
node --test worker/validation.test.js
```

Expected: FAIL because module/functions do not exist.

- [ ] **Step 3: Implement `worker/http.js`**

Export:

```js
export const json = (data, init = {}) => { /* JSON Response + content-type */ }
export const readJson = async (request) => { /* object-only JSON body, throw 400-style error otherwise */ }
export const apiError = (status, code, message) => Object.assign(new Error(message), { status, code })
export const handleError = (error) => { /* {error:{code,message}}; hide internal stack */ }
export const assertSameOriginMutation = (request) => { /* POST/PATCH/PUT/DELETE Origin must equal request URL origin */ }
```

Same-origin requests avoid CORS entirely.

- [ ] **Step 4: Implement validation helpers**

Use integer cents at persistence boundaries. Export `moneyToCents`, `centsToMoney`, `requireNonEmpty`, `optionalText`, `validateOrderType`, `validatePaymentMethod`, `validateIsoDate` and `validatePositiveInteger`.

`validatePaymentMethod` accepts exactly the existing UI values: `Pix`, `Dinheiro`, `Cartão de débito`, `Cartão de crédito`, `Transferência`, `Outro`.

- [ ] **Step 5: Implement `worker/index.js` auth routes and asset fallback**

Routing behavior:

```js
if (url.pathname === '/api/auth/login' && request.method === 'POST') { /* verify PIN, create session */ }
if (url.pathname === '/api/auth/logout' && request.method === 'POST') { /* revoke + clear cookie */ }
if (url.pathname === '/api/auth/session' && request.method === 'GET') { /* {authenticated,businessId} */ }
if (url.pathname.startsWith('/api/')) { /* require session, then resource router */ }
return env.ASSETS.fetch(request)
```

Login reads `{ "pin": "..." }`, loads the Amor & Sabor verifier from `auth_credentials`, returns 401 with code `INVALID_PIN` on mismatch, and returns no token in JSON; the token is cookie-only.

- [ ] **Step 6: Run tests and Worker local smoke test**

Run:

```bash
npm test
npm run build
npx wrangler dev
```

In a second shell:

```bash
curl -i http://127.0.0.1:8787/api/auth/session
```

Expected before login: `200` JSON with `authenticated: false`.

- [ ] **Step 7: Commit**

```bash
git add worker/http.js worker/validation.js worker/validation.test.js worker/index.js
git commit -m "feat: add authenticated Worker API shell"
```

---

### Task 4: Implement D1 repositories and bootstrap read model

**Files:**
- Create: `worker/repositories.js`
- Create: `worker/repositories.test.js`
- Modify: `worker/index.js`

**Interfaces:**
- Consumes: D1 schema from Task 1.
- Produces:
  - `loadBootstrap(db, businessId) -> { clients, products, orders, movements }`
  - `GET /api/bootstrap`
  - domain objects shaped closely enough to the current frontend that Dashboard/Orders/Receivables/Finance calculations continue working.

- [ ] **Step 1: Write mapper tests first**

Test row conversions directly so cents and payment snapshots cannot drift:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { mapProductRow, mapOrderRow, mapMovementRow } from './repositories.js'

test('product row maps integer cents to current frontend price number', () => {
  assert.deepEqual(mapProductRow({ id: 'p1', category: 'Bebida', size: '350ml', name: 'Coca', price_cents: 850 }), {
    id: 'p1', category: 'Bebida', size: '350ml', name: 'Coca', price: 8.5,
  })
})

test('order row exposes current payment fields', () => {
  const order = mapOrderRow({
    id: 'o1', client_name_snapshot: 'Maria', type: 'Entrega', status: 'Em preparo',
    order_date: '2026-09-01', total_cents: 4200, created_at: '2026-09-01T20:00:00.000Z',
    finished_at: null, payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null,
  })
  assert.equal(order.paymentStatus, 'Pendente')
  assert.equal(order.total, 42)
})
```

- [ ] **Step 2: Run repository tests and verify red**

```bash
node --test worker/repositories.test.js
```

- [ ] **Step 3: Implement row mappers and `loadBootstrap`**

`loadBootstrap` must scope every query by `business_id = ?` and return newest orders/movements first. For each order, include its current single-item representation from `order_items`:

```js
{
  id,
  client,
  type,
  status,
  productName,
  size,
  quantity,
  total,
  orderDate,
  date,
  createdAt,
  finishedAt,
  paymentStatus,
  paymentMethod,
  paidAt,
  paidAmount,
  items: [{ id, productId, name, category, size, quantity, catalogPrice, unitPrice, priceReason }]
}
```

The `items` field is included now so the next multi-item phase can build on the same API model.

- [ ] **Step 4: Add authenticated `GET /api/bootstrap`**

Return:

```json
{
  "business": { "id": "amor-e-sabor", "name": "Amor & Sabor" },
  "clients": [],
  "products": [],
  "orders": [],
  "movements": []
}
```

A clean database should naturally return empty arrays.

- [ ] **Step 5: Apply local migration, seed a verifier, log in and smoke-test bootstrap**

Generate verifier safely, then execute an insert/update into local D1. Use SQL parameter-safe quoting in the shell or Wrangler input file; never commit the generated verifier.

After login, call `/api/bootstrap` with the cookie jar and expect the empty business dataset.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/repositories.js worker/repositories.test.js worker/index.js
git commit -m "feat: add D1 bootstrap read model"
```

---

### Task 5: Implement authenticated CRUD for clients and products

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/repositories.test.js`
- Modify: `worker/index.js`
- Create: `src/api/client.js`
- Create: `src/api/client.test.js`

**Interfaces:**
- Produces Worker endpoints:
  - `POST /api/clients`
  - `PATCH /api/clients/:id`
  - `DELETE /api/clients/:id`
  - `POST /api/products`
  - `PATCH /api/products/:id`
  - `DELETE /api/products/:id`
- Produces frontend methods with the same names at the API-client layer: `createClient`, `updateClient`, `deleteClient`, `createProduct`, `updateProduct`, `deleteProduct`, plus `getSession`, `login`, `logout`, `getBootstrap`.

- [ ] **Step 1: Write failing frontend API client tests**

Mock `globalThis.fetch` and assert credentials, JSON and error handling:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from './client.js'

test('createClient posts JSON to same-origin API', async () => {
  let call
  globalThis.fetch = async (...args) => {
    call = args
    return new Response(JSON.stringify({ client: { id: 'c1', name: 'Maria' } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }
  const result = await createClient({ name: 'Maria', phone: '', address: '' })
  assert.equal(call[0], '/api/clients')
  assert.equal(call[1].method, 'POST')
  assert.equal(call[1].credentials, 'same-origin')
  assert.equal(result.client.id, 'c1')
})
```

Also test that 401 throws an error object with `status === 401` and API `code` preserved.

- [ ] **Step 2: Run client tests and verify red**

```bash
node --test src/api/client.test.js
```

- [ ] **Step 3: Implement `src/api/client.js`**

Create one internal request helper:

```js
const apiRequest = async (path, options = {}) => {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Não foi possível concluir a operação.')
    error.status = response.status
    error.code = payload?.error?.code || 'REQUEST_FAILED'
    throw error
  }
  return payload
}
```

Export endpoint functions; no React state logic belongs here.

- [ ] **Step 4: Add repository CRUD with business scoping**

Use `crypto.randomUUID()` for new IDs. Update/delete queries must include both `id = ?` and `business_id = ?`.

Client delete should be allowed even if old orders reference the client because `orders.client_id` is `ON DELETE SET NULL` and `client_name_snapshot` preserves history.

Product delete should be a soft delete (`active = 0`) so historical references remain intact. `/api/bootstrap` returns only active products.

- [ ] **Step 5: Add routes with validation and same-origin mutation guard**

Client payload:

```json
{ "name": "Maria", "phone": "(11) 99999-9999", "address": "Centro" }
```

Product payload:

```json
{ "category": "Marmita", "size": "M", "name": "Marmita Média", "price": 42 }
```

Return 404 if an ID is not owned by the authenticated business.

- [ ] **Step 6: Run focused and full tests**

```bash
node --test src/api/client.test.js worker/repositories.test.js worker/validation.test.js
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/index.js worker/repositories.js worker/repositories.test.js src/api/client.js src/api/client.test.js
git commit -m "feat: add central clients and products API"
```

---

### Task 6: Implement orders, status transitions, payments and movements atomically at API level

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/repositories.test.js`
- Modify: `worker/index.js`
- Modify: `src/api/client.js`
- Modify: `src/api/client.test.js`

**Interfaces:**
- Produces endpoints:
  - `POST /api/orders`
  - `PATCH /api/orders/:id/status`
  - `DELETE /api/orders/:id`
  - `POST /api/orders/:id/payment`
  - `POST /api/movements`
- Produces frontend methods: `createOrder`, `updateOrderStatus`, `deleteOrder`, `registerPayment`, `createMovement`.

- [ ] **Step 1: Add failing repository tests for order totals and payment idempotency contract**

Test a current single-product order payload is converted into one order + one item and integer cents:

```js
const payload = {
  clientId: 'c1',
  productId: 'p1',
  type: 'Entrega',
  quantity: 2,
  orderDate: '2026-09-01',
}
```

Expected repository-level result after product price 32.00: subtotal/total `6400` cents and item quantity `2`.

Test repository logic refuses a second payment for the same order with conflict code `ORDER_ALREADY_PAID`.

- [ ] **Step 2: Run tests and verify red**

```bash
node --test worker/repositories.test.js
```

- [ ] **Step 3: Implement `createOrder` repository operation**

The server, not the frontend, looks up the client/product by `(id, business_id)`, snapshots names/prices and calculates total. It must ignore any client-supplied total.

For the current UI, one saved order creates exactly one `order_items` row:

```js
{
  productId,
  nameSnapshot: product.name,
  categorySnapshot: product.category,
  sizeSnapshot: product.size,
  quantity,
  catalogPriceCents: product.price_cents,
  unitPriceCents: product.price_cents,
  priceReason: ''
}
```

Backdated order behavior remains: `orderDate < today` => `status = 'Finalizado'`, `created_at` and `finished_at` at local-noon-equivalent operational timestamp generated consistently by the server contract. Current-day order => `Em preparo`.

- [ ] **Step 4: Implement finalization and delete operations**

Status route accepts only the current final transition to `Finalizado` and sets `finished_at` once. Delete removes the order and its dependent item/payment while preventing orphan automatic movement rows through an explicit repository batch or schema-safe sequence.

- [ ] **Step 5: Implement payment + automatic movement as one repository operation**

The server determines amount from `orders.total_cents`, inserts one `payments` row and one `movements` row with:

```text
source = order-payment
category = Vendas
description = Pagamento pedido #<short order id> · <client snapshot>
value_cents = order.total_cents
```

A unique payment per `order_id` is the database-level duplicate guard. A repeated request returns HTTP 409 and must not create a second movement.

- [ ] **Step 6: Implement manual movement create**

Validate `type`, non-empty category/description and `value > 0`; persist integer cents and server timestamp.

- [ ] **Step 7: Add routes and API client methods**

Keep JSON return shapes focused on the authoritative updated resource, e.g. `{ order }`, `{ payment, movement, order }`, `{ movement }`.

- [ ] **Step 8: Run full tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add worker/index.js worker/repositories.js worker/repositories.test.js src/api/client.js src/api/client.test.js
git commit -m "feat: add central orders payments and finance API"
```

---

### Task 7: Replace business localStorage with authenticated API state in React

**Files:**
- Create: `src/components/LoginScreen.jsx`
- Create: `src/components/ConnectionBanner.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes all `src/api/client.js` methods from Tasks 5–6.
- Produces a UI that loads one shared D1 dataset on desktop/mobile and never writes business data to `localStorage`.

- [ ] **Step 1: Add auth/bootstrap state to `App.jsx` before changing CRUD**

Introduce explicit states:

```js
const [authState, setAuthState] = useState('checking') // checking | anonymous | authenticated
const [bootstrapState, setBootstrapState] = useState('idle') // idle | loading | ready | error
const [requestKey, setRequestKey] = useState(null)
const [isOnline, setIsOnline] = useState(() => navigator.onLine)
```

Initialize business arrays as empty:

```js
const [products, setProducts] = useState([])
const [clients, setClients] = useState([])
const [orders, setOrders] = useState([])
const [movements, setMovements] = useState([])
```

Delete `STORAGE_KEYS`, `readStorage`, test seed arrays used as persistence fallback, and all `localStorage.setItem(...)` effects.

- [ ] **Step 2: Add session check and bootstrap effect**

On mount:

```text
GET /api/auth/session
anonymous -> LoginScreen
authenticated -> GET /api/bootstrap -> populate arrays -> normal app
```

On any API 401 during normal usage, reset to `anonymous` and clear operational arrays.

- [ ] **Step 3: Implement `LoginScreen.jsx`**

The screen contains the existing brand identity, one password-style PIN field, submit button, loading state and Portuguese invalid-PIN message. It calls `login(pin)` then `getBootstrap()`.

Do not persist the PIN in state beyond what is required to submit; clear it on success and failure.

- [ ] **Step 4: Convert client/product handlers to async API writes**

Pattern for every write:

```js
if (!isOnline || requestKey) return
setRequestKey('client:create')
try {
  const { client } = await createClient(payload)
  setClients((current) => [client, ...current])
  showSuccessMessage('Cliente adicionado com sucesso')
} catch (error) {
  showApiError(error)
} finally {
  setRequestKey(null)
}
```

Do not optimistically invent IDs in the frontend.

- [ ] **Step 5: Convert order/status/delete/payment/movement handlers to API writes**

Use returned server resources to update React state. Payment handling must insert the returned movement exactly once and replace the returned order; do not call the old local `createOrderPaymentMovement()` in the write path.

Preserve existing UI copy and operational behavior where possible.

- [ ] **Step 6: Add offline banner and write blocking**

Listen for browser `online`/`offline` events. `ConnectionBanner` text:

```text
Sem conexão. Consultas já carregadas continuam visíveis, mas novos registros e alterações ficam bloqueados até a internet voltar.
```

Disable submit/action buttons for writes while `!isOnline` or matching `requestKey` is active. The current loaded data may remain visible.

- [ ] **Step 7: Add loading and retry states**

During initial authenticated bootstrap show a clear centered loading state. On bootstrap network/server failure, show `Não foi possível carregar os dados` plus a `Tentar novamente` button that calls `getBootstrap()` again.

- [ ] **Step 8: Remove local-only payment/movement write dependencies**

If `createOrderPaymentMovement` is no longer needed outside tests/legacy helpers, remove the import from `App.jsx`. Keep payment normalization utilities only where still required by current rendering/domain compatibility.

- [ ] **Step 9: Run quality gate**

```bash
npm test && npm run lint && npm run build
```

Expected: PASS.

- [ ] **Step 10: Manual cross-browser check against local Worker**

Open two separate browsers/profiles against the same `wrangler dev` instance, log in with the same PIN, create a client/order in one, reload the other and verify the same central records appear.

- [ ] **Step 11: Commit**

```bash
git add src/App.jsx src/App.css src/components/LoginScreen.jsx src/components/ConnectionBanner.jsx
git commit -m "feat: switch frontend to central authenticated data"
```

---

### Task 8: Harden deployment, CI and operator setup

**Files:**
- Modify: `.github/workflows/validate.yml`
- Modify: `README.md`
- Modify: `wrangler.jsonc` if smoke testing proves a routing/config correction is required

**Interfaces:**
- Consumes completed Worker/frontend.
- Produces repeatable local setup and production rollout procedure.

- [ ] **Step 1: Add a CI configuration validation step**

Keep existing Node 22/Test/Lint/Build steps. After build, add a non-deploying Wrangler validation command supported by the installed Wrangler version, or at minimum run:

```bash
npx wrangler deploy --dry-run
```

Expected: Worker bundle/config validates without contacting production data for writes.

- [ ] **Step 2: Document clean database bootstrap in `README.md`**

Document exact operator sequence:

```bash
npm ci
npm run build
npm run d1:migrate:remote
read -s AMOR_PIN
PIN="$AMOR_PIN" node scripts/generate-pin-hash.mjs
unset AMOR_PIN
```

Then document using the printed verifier in a one-time D1 `INSERT ... ON CONFLICT(business_id) DO UPDATE` statement for `business_id = 'amor-e-sabor'`. State explicitly that the raw PIN is never committed.

- [ ] **Step 3: Apply remote migration**

Run:

```bash
npm run d1:migrate:remote
```

Expected: `0001_initial.sql` applied successfully to `amor-e-sabor-delivery`.

- [ ] **Step 4: Configure the production PIN verifier**

Generate a verifier locally and write only that verifier to `auth_credentials`. Verify the row exists with:

```sql
SELECT business_id, length(pin_hash) AS verifier_length FROM auth_credentials WHERE business_id = 'amor-e-sabor';
```

Do not print the verifier back into CI logs after setup.

- [ ] **Step 5: Run final local verification**

```bash
npm test
npm run lint
npm run build
npx wrangler deploy --dry-run
```

Expected: all pass.

- [ ] **Step 6: Deploy**

Run:

```bash
npm run deploy
```

- [ ] **Step 7: Perform production acceptance test from desktop and phone**

Verify all of the following against the public URL:

```text
1. Both devices require the PIN before business data appears.
2. Create a client on desktop; refresh phone; client appears.
3. Create a product on phone; refresh desktop; product appears.
4. Create a current-day order; it appears as Em preparo on both.
5. Finalize the order; refresh the other device; final status appears.
6. Register payment; A Receber decreases and Finance gets exactly one automatic entry.
7. Turn one device offline; write controls are blocked with the offline message.
8. Reconnect; reload/bootstrap succeeds and no duplicate order/payment was created.
9. Log out; `/api/bootstrap` returns 401 for that browser session.
```

- [ ] **Step 8: Commit docs/CI**

```bash
git add .github/workflows/validate.yml README.md wrangler.jsonc
git commit -m "chore: document and validate central deployment"
```

---

## Self-review results

### Spec coverage

- Central React → Worker → D1 architecture: Tasks 1, 3, 4.
- D1 as source of truth; localStorage removed for business data: Task 7.
- Shared PIN with no plaintext in frontend/Git: Tasks 2, 3, 8.
- Secure persistent sessions with token hash: Task 2.
- `business_id` preparation for future multi-company use: Task 1 schema and every repository task.
- Empty clean start with no localStorage import: Tasks 1 and 7.
- Clients/products/orders/payments/movements central persistence: Tasks 5–7.
- Multi-item-ready schema: Task 1 `order_items`, Task 4 bootstrap `items`.
- No offline writes: Task 7.
- Duplicate submission/payment protection: Tasks 6–7.
- IDs independent of `Date.now()`: Tasks 5–6.
- Existing current operational/payment behavior preserved: Tasks 6–7 acceptance tests.
- CI/build/deployment/operator documentation: Task 8.

### Placeholder scan

The plan contains no `TODO`, `TBD`, “implement later”, or unspecified test requirements. The only runtime-generated value is the Cloudflare D1 database UUID; Task 1 explicitly requires obtaining it from `wrangler d1 create` and forbids committing the illustrative marker.

### Interface/type consistency

- D1 stores money as integer `*_cents`; repository mappers expose current frontend BRL numbers.
- Frontend IDs are strings throughout new API operations.
- Session business identity is obtained from the authenticated server-side session, never accepted from request JSON.
- Orders expose both current compatibility fields and `items[]`, allowing the later multi-item plan to reuse the contract without a second persistence redesign.
