# Order Printing ESC/POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable 58 mm ESC/POS order printing to Gestão Delivery with one canonical customer-safe ticket, automatic/manual jobs, one primary print station, Chrome Web Serial support on Windows and Android, preview, and downloadable PDF.

**Architecture:** Keep order creation authoritative in the Cloudflare Worker/D1 backend. Persist print stations and immutable print jobs centrally, but keep browser/device serial permission local. The Worker creates the canonical `OrderPrintDocument` snapshot; the frontend renders that same document to ESC/POS, HTML preview, and PDF. A focused printing manager mounted in `App.jsx` polls/claims official jobs and never infers printing from “new order” array detection.

**Tech Stack:** React 19.2.8, Vite 8.2.2, Node 22 test runner (`node --test`), Cloudflare Worker, D1/SQLite, Wrangler 4.128.0, Web Serial, ESC/POS, jsPDF 4.2.1, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-03-order-printing-escpos-design.md`

## Global Constraints

- Strict TDD for every behavior change: write the failing test, run it and confirm the intended RED, implement the minimum production change, run GREEN, then refactor only while green.
- The initial hardware profile is Goldensky MTP5: 58 mm paper, 48 mm printable width, 384 dots/line, 203 DPI, ESC/POS, Bluetooth Classic SPP/RFCOMM.
- Chrome desktop must support Bluetooth RFCOMM through Web Serial from version 117 onward; Chrome Android target is version 138 or newer.
- Web Serial requires HTTPS/secure context in deployed use. Unsupported browsers must receive a clear compatibility message without breaking the rest of the app.
- The first device selection uses a user-gesture `navigator.serial.requestPort()` call. Automatic printing may only reuse an already-authorized port returned by `navigator.serial.getPorts()`.
- One logical Ticket Oficial is used for kitchen, package, preview, and PDF. It includes values, payment status/method when available, observations, and `Obrigado pela compra! Agradecemos a preferência.`
- Physical copies are identical. `default_copies` is 1 or 2 and defaults to 2.
- Only one `print_stations` row may be primary for a business. Only the primary station may claim automatic jobs.
- A new current kitchen order gets at most one automatic job when the primary station has automatic printing enabled at creation time. Historical/backdated orders do not create automatic kitchen jobs.
- If automatic printing is disabled when an order is created, enabling it later must not create retroactive jobs.
- Reload, polling, visibility changes, focus, and cross-device synchronization never create automatic print jobs.
- Reprinting creates a new manual job and requires confirmation. Retrying a failed/attention job reuses the same job snapshot.
- There is no repeated automatic retry after a failure.
- Automatic jobs still `pending` after 10 minutes become `requires_attention` before they can be printed.
- A job left `processing` beyond 2 minutes is treated as physically uncertain and becomes `requires_attention`; it must not be reprinted automatically.
- `printed` means the browser completed the serial write without a reported error. Do not claim guaranteed physical paper output.
- Connection/open failures before bytes are written are safe known failures (`failed`). A serial write that starts and then rejects is physically uncertain and must become `requires_attention`.
- Bluetooth pairing PIN/password stays outside the backend. Never persist PINs, auth cookies/tokens, or browser permission material in D1 error fields.
- The MTP5 profile uses ESC/POS Font A at 12 dots/character, therefore 32 logical columns at 384 dots. Keep this value in the printer profile, not duplicated in renderers/UI.
- Use CP860 for Portuguese text in the initial MTP5 profile (`ESC t 3`) because the supplied printer character-table ordering lists OEM437, Katakana, OEM850, OEM860 in positions 0–3. Hardware acceptance is authoritative; if the real unit differs, change only the profile/encoding fixture, not ticket business logic.
- Do not send a paper-cut command; the portable MTP5 has no cutter requirement in this V1. End jobs with line feeds only.
- PDF is included in V1; automatic WhatsApp delivery is out of scope.
- No native Android wrapper, local print agent, multi-printer routing, fiscal document, per-kitchen-sector routing, or automatic failover in V1.
- Production deploy and remote D1 migration remain explicit operations. Do not run either without user authorization.
- Final software verification is `npm test`, `npm run lint`, `npm run build`, and `npx --yes wrangler@4.128.0 deploy --dry-run`.
- Final product acceptance additionally requires real MTP5 tests on current Chrome/Windows and Chrome Android 138+.

---

## File Structure

### Create

- `migrations/0009_order_printing.sql` — D1 schema for customer contact snapshots, print stations, print jobs, status/index/uniqueness constraints.
- `worker/orderPrintingMigration.test.js` — static migration contract coverage.
- `shared/orderPrintDocument.js` — canonical document version, construction, money/order-number helpers, thank-you copy.
- `shared/orderPrintDocument.test.js` — canonical ticket contract tests.
- `worker/orderPrintDocumentRepository.js` — reconstruct the current canonical document for preview/manual reprint from D1 order snapshots/items/payment.
- `worker/orderPrintDocumentRepository.test.js` — current-document/legacy optional-field tests.
- `worker/orderPrintingRepository.js` — station persistence, job creation/listing/claiming/transitions/aging/retry.
- `worker/orderPrintingRepository.test.js` — concurrency, idempotency, status, business isolation, aging tests.
- `worker/orderPrintingHttp.test.js` — authenticated printing route contracts.
- `src/printing/mtp5Profile.js` — all MTP5 paper/font/code-page/serial constants.
- `src/printing/cp860.js` — deterministic CP860 encoder with explicit replacement behavior.
- `src/printing/escpos58mm.js` — ESC/POS renderer from `OrderPrintDocument` and copy count.
- `src/printing/escpos58mm.test.js` — deterministic byte/line/copy/diacritic tests.
- `src/printing/localPrintStation.js` — stable local station id and serial-port fingerprint persistence.
- `src/printing/localPrintStation.test.js` — local identity/fingerprint matching tests.
- `src/printing/webSerialTransport.js` — Web Serial capability, request/reuse/open/write/close behavior and typed errors.
- `src/printing/webSerialTransport.test.js` — fake-serial transport tests.
- `src/printing/printJobRunner.js` — one-job orchestration with success/known-failure/uncertain-failure semantics.
- `src/printing/printJobRunner.test.js` — no-retry and completion/failure orchestration tests.
- `src/printing/usePrintingManager.js` — React integration for station registration, state polling, automatic claims, manual actions, preview/PDF requests.
- `src/printing/pdfOrderRenderer.js` — jsPDF renderer and stable filename/download helpers.
- `src/printing/pdfOrderRenderer.test.js` — PDF signature/content/filename regression tests.
- `src/components/PrintStatusBadge.jsx` — compact order print-state badge.
- `src/components/PrintingSettings.jsx` — station/printer/automatic/copies/test-print modal.
- `src/components/PrintingSettings.test.js` — source/accessibility/controls regressions.
- `src/components/OrderTicketPreview.jsx` — preview modal based on canonical document.
- `src/components/OrderTicketPreview.test.js` — customer-safe/value/payment/message content regressions.
- `src/printing/printing.css` — 320–480 px-safe print status/settings/preview styling.
- `src/printing/printingUi.test.js` — Orders/OrderDetail wiring and mobile-source regression coverage.
- `docs/order-printing-mtp5-acceptance.md` — reproducible hardware acceptance checklist.

### Modify

- `worker/repositories.js` — persist order phone/address snapshots; append automatic job to the existing checkout batch when eligible; expose contact fields in mapped order.
- `worker/orderReadSql.js` — include order contact snapshot columns in canonical reads.
- `worker/index.js` — delegate authenticated printing routes and return automatic print job summary from order creation when one exists.
- `src/api/client.js` — print station/job/document API helpers.
- `src/api/client.test.js` — print API route/method/payload contract tests.
- `src/App.jsx` — mount one printing manager and pass its public surface into the Orders screen; keep existing order-new sound behavior independent.
- `src/pages/Orders.jsx` — printing settings entry point, status badges, quick/manual action wiring.
- `src/components/OrderDetail.jsx` — Preview, PDF, Print/Reprint, retry/attention actions.
- `package.json` — add exact `jspdf` dependency.
- `package-lock.json` — npm lock update.
- `README.md` — supported browser/hardware setup and explicit limitations.

---

### Task 1: Add D1 schema for deterministic order tickets, stations, and jobs

**Files:**
- Create: `migrations/0009_order_printing.sql`
- Create: `worker/orderPrintingMigration.test.js`

**Interfaces:**
- Produces: `orders.client_phone_snapshot`, `orders.client_address_snapshot`, `print_stations`, and `print_jobs` schema used by every later task.
- Produces invariant: one automatic order job per `(business_id, order_id)` and one primary station per `business_id`.

- [ ] **Step 1: Write the failing migration contract test**

Create `worker/orderPrintingMigration.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const sql = await readFile(new URL('../migrations/0009_order_printing.sql', import.meta.url), 'utf8').catch(() => '')

test('printing migration adds immutable ticket contact snapshots and station/job tables', () => {
  assert.match(sql, /ALTER TABLE orders ADD COLUMN client_phone_snapshot TEXT NOT NULL DEFAULT ''/)
  assert.match(sql, /ALTER TABLE orders ADD COLUMN client_address_snapshot TEXT NOT NULL DEFAULT ''/)
  assert.match(sql, /CREATE TABLE print_stations/)
  assert.match(sql, /default_copies INTEGER NOT NULL DEFAULT 2 CHECK \(default_copies IN \(1, 2\)\)/)
  assert.match(sql, /CREATE UNIQUE INDEX print_stations_one_primary_idx[\s\S]*WHERE is_primary = 1/)
  assert.match(sql, /CREATE TABLE print_jobs/)
  assert.match(sql, /status TEXT NOT NULL CHECK \(status IN \('pending', 'processing', 'printed', 'failed', 'requires_attention'\)\)/)
  assert.match(sql, /snapshot_json TEXT NOT NULL/)
  assert.match(sql, /CREATE UNIQUE INDEX print_jobs_one_auto_order_idx[\s\S]*trigger = 'automatic'/)
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test worker/orderPrintingMigration.test.js
```

Expected: FAIL because `0009_order_printing.sql` does not exist.

- [ ] **Step 3: Add the migration with database-level constraints**

Create `migrations/0009_order_printing.sql` with these definitions:

```sql
PRAGMA foreign_keys = ON;

ALTER TABLE orders ADD COLUMN client_phone_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN client_address_snapshot TEXT NOT NULL DEFAULT '';

CREATE TABLE print_stations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('windows', 'android', 'other')),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  auto_print_enabled INTEGER NOT NULL DEFAULT 0 CHECK (auto_print_enabled IN (0, 1)),
  default_copies INTEGER NOT NULL DEFAULT 2 CHECK (default_copies IN (1, 2)),
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX print_stations_business_idx ON print_stations (business_id, updated_at DESC);
CREATE UNIQUE INDEX print_stations_one_primary_idx
  ON print_stations (business_id) WHERE is_primary = 1;

CREATE TABLE print_jobs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order', 'test')),
  trigger TEXT NOT NULL CHECK (trigger IN ('automatic', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'printed', 'failed', 'requires_attention')),
  copies_requested INTEGER NOT NULL CHECK (copies_requested IN (1, 2)),
  copies_printed INTEGER NOT NULL DEFAULT 0 CHECK (copies_printed >= 0 AND copies_printed <= 2),
  station_id TEXT REFERENCES print_stations(id) ON DELETE SET NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  processing_started_at TEXT,
  processed_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  CHECK ((type = 'order' AND order_id IS NOT NULL) OR (type = 'test' AND order_id IS NULL))
);

CREATE INDEX print_jobs_pending_idx
  ON print_jobs (business_id, status, trigger, created_at);
CREATE INDEX print_jobs_order_history_idx
  ON print_jobs (business_id, order_id, created_at DESC);
CREATE UNIQUE INDEX print_jobs_one_auto_order_idx
  ON print_jobs (business_id, order_id)
  WHERE type = 'order' AND trigger = 'automatic';
```

- [ ] **Step 4: Run GREEN and validate the migration locally**

Run:

```bash
node --test worker/orderPrintingMigration.test.js
npm run d1:migrate:local
```

Expected: PASS; Wrangler applies `0009_order_printing.sql` to the local D1 database without SQL/constraint errors.

- [ ] **Step 5: Commit**

```bash
git add migrations/0009_order_printing.sql worker/orderPrintingMigration.test.js
git commit -m "feat: add printing persistence schema"
```

---

### Task 2: Define one canonical `OrderPrintDocument`

**Files:**
- Create: `shared/orderPrintDocument.js`
- Create: `shared/orderPrintDocument.test.js`

**Interfaces:**
- Produces: `ORDER_PRINT_DOCUMENT_VERSION`, `ORDER_PRINT_THANK_YOU`, `createOrderPrintDocument(input)`, `createTestPrintDocument(input)`, `formatPrintMoneyCents(cents)`, `getFriendlyOrderNumber(id)`.
- `createOrderPrintDocument()` returns JSON-serializable cents-based data; later renderers must consume this object and must not read `order` objects directly.

- [ ] **Step 1: Write RED tests for the approved ticket contract**

Create `shared/orderPrintDocument.test.js` with a full fixture:

```js
const document = createOrderPrintDocument({
  businessName: 'Amor & Sabor',
  orderId: 'order-0184',
  orderDate: '2026-09-03',
  createdAt: '2026-09-03T23:31:00.000Z',
  type: 'Entrega',
  customer: { name: 'João Silva', phone: '(11) 99876-5432', address: 'Rua das Flores, 123' },
  items: [
    { name: 'X-BURGER', presentation: '', quantity: 2, note: 'Sem cebola + Bacon', unitPriceCents: 3000 },
    { name: 'BATATA', presentation: 'G', quantity: 1, note: 'Cheddar e bacon', unitPriceCents: 1200 },
  ],
  subtotalCents: 7200,
  deliveryFeeCents: 800,
  adjustment: { type: 'discount', amountCents: 0, reason: '' },
  totalCents: 8000,
  payment: { status: 'Pago', method: 'Pix' },
})

assert.equal(document.version, 1)
assert.equal(document.business.name, 'Amor & Sabor')
assert.equal(document.order.number, '0184')
assert.equal(document.customer.address, 'Rua das Flores, 123')
assert.equal(document.items[0].lineTotalCents, 6000)
assert.equal(document.payment.status, 'Pago')
assert.equal(document.message, 'Obrigado pela compra! Agradecemos a preferência.')
assert.equal(formatPrintMoneyCents(8750), 'R$ 87,50')
```

Also assert `createTestPrintDocument()` uses `type: 'test'`, the business name, `TESTE DE IMPRESSÃO`, a timestamp, and no fake order id.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test shared/orderPrintDocument.test.js
```

Expected: FAIL because the shared module does not exist.

- [ ] **Step 3: Implement the canonical JSON-safe contract**

Use this public shape in `shared/orderPrintDocument.js`:

```js
export const ORDER_PRINT_DOCUMENT_VERSION = 1
export const ORDER_PRINT_THANK_YOU = 'Obrigado pela compra! Agradecemos a preferência.'

export const getFriendlyOrderNumber = (id) => String(id ?? '').slice(-4)

export const formatPrintMoneyCents = (cents) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format((Number(cents) || 0) / 100)

export const createOrderPrintDocument = (input) => ({
  version: ORDER_PRINT_DOCUMENT_VERSION,
  type: 'order',
  business: { name: String(input.businessName || 'Amor & Sabor') },
  order: {
    id: String(input.orderId),
    number: getFriendlyOrderNumber(input.orderId),
    orderDate: String(input.orderDate),
    createdAt: String(input.createdAt),
    type: String(input.type),
  },
  customer: {
    name: String(input.customer?.name || ''),
    phone: String(input.customer?.phone || ''),
    address: String(input.customer?.address || ''),
  },
  items: (input.items || []).map((item) => ({
    name: String(item.name || ''),
    presentation: String(item.presentation || ''),
    quantity: Math.max(1, Number(item.quantity) || 1),
    note: String(item.note || ''),
    unitPriceCents: Math.max(0, Number(item.unitPriceCents) || 0),
    lineTotalCents: Math.max(0, Number(item.unitPriceCents) || 0) * Math.max(1, Number(item.quantity) || 1),
  })),
  financial: {
    subtotalCents: Math.max(0, Number(input.subtotalCents) || 0),
    deliveryFeeCents: Math.max(0, Number(input.deliveryFeeCents) || 0),
    adjustment: {
      type: input.adjustment?.type || 'none',
      amountCents: Math.max(0, Number(input.adjustment?.amountCents) || 0),
      reason: String(input.adjustment?.reason || ''),
    },
    totalCents: Math.max(0, Number(input.totalCents) || 0),
  },
  payment: {
    status: input.payment?.status === 'Pago' ? 'Pago' : 'Pendente',
    method: String(input.payment?.method || ''),
  },
  message: ORDER_PRINT_THANK_YOU,
})
```

`createTestPrintDocument({ businessName, createdAt })` must return the same version with `type: 'test'` and a small `test` payload rather than manufacturing order/customer/financial fields.

- [ ] **Step 4: Run GREEN**

Run:

```bash
node --test shared/orderPrintDocument.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/orderPrintDocument.js shared/orderPrintDocument.test.js
git commit -m "feat: define canonical order print document"
```

---

### Task 3: Implement print station and print-job repository semantics

**Files:**
- Create: `worker/orderPrintingRepository.js`
- Create: `worker/orderPrintingRepository.test.js`
- Create: `worker/orderPrintDocumentRepository.js`
- Create: `worker/orderPrintDocumentRepository.test.js`

**Interfaces:**
- Consumes: `createOrderPrintDocument()`, `createTestPrintDocument()` from Task 2 and schema from Task 1.
- Produces station API functions: `listPrintStations`, `upsertPrintStation`, `setPrimaryPrintStation`, `touchPrintStation`.
- Produces job API functions: `listPrintJobs`, `loadPrintJob`, `createManualOrderPrintJob`, `createTestPrintJob`, `claimNextAutomaticPrintJob`, `claimPrintJob`, `markPrintJobPrinted`, `markPrintJobFailed`, `retryPrintJob`.
- Produces checkout helpers: `loadPrimaryAutomaticPrintStation(db, businessId)` and `prepareAutomaticPrintJobStatement(db, businessId, input)`.
- Produces document loader: `loadOrderPrintDocument(db, businessId, orderId)`.

- [ ] **Step 1: Write RED tests for station invariants and job transitions**

In `worker/orderPrintingRepository.test.js`, use a purpose-built in-memory fake D1 and cover these exact behaviors:

```js
const primary = await upsertPrintStation(db, 'amor-e-sabor', {
  id: 'station-a', name: 'Tablet da cozinha', platform: 'android',
  autoPrintEnabled: true, defaultCopies: 2,
}, now)
await setPrimaryPrintStation(db, 'amor-e-sabor', primary.id, now)

assert.equal((await listPrintStations(db, 'amor-e-sabor')).filter((station) => station.isPrimary).length, 1)
assert.equal((await loadPrimaryAutomaticPrintStation(db, 'amor-e-sabor')).id, 'station-a')
```

Cover automatic claim exclusivity:

```js
const first = await claimNextAutomaticPrintJob(db, 'amor-e-sabor', 'station-a', now)
const second = await claimNextAutomaticPrintJob(db, 'amor-e-sabor', 'station-a', now)
assert.equal(first.id, 'job-1')
assert.equal(second, null)
```

Cover status semantics:

```js
await markPrintJobFailed(db, 'amor-e-sabor', 'job-1', 'station-a', {
  code: 'SERIAL_OPEN_FAILED', message: 'Impressora desconectada', uncertain: false,
}, now)
assert.equal((await loadPrintJob(db, 'amor-e-sabor', 'job-1')).status, 'failed')

await retryPrintJob(db, 'amor-e-sabor', 'job-1', now)
assert.equal((await loadPrintJob(db, 'amor-e-sabor', 'job-1')).status, 'pending')
```

Add tests proving: a non-primary station cannot claim automatic work; a write-uncertain failure becomes `requires_attention`; 10-minute-old pending automatic jobs become `requires_attention`; 2-minute-old processing jobs become `requires_attention`; all queries are scoped by `business_id`.

- [ ] **Step 2: Write RED tests for rebuilding a current print document**

In `worker/orderPrintDocumentRepository.test.js`, fake canonical order/item reads and assert:

```js
const document = await loadOrderPrintDocument(db, 'amor-e-sabor', 'o1')
assert.equal(document.customer.phone, '(11) 99876-5432')
assert.equal(document.customer.address, 'Rua das Flores, 123')
assert.equal(document.items[0].note, 'sem cebola')
assert.equal(document.financial.totalCents, 8750)
assert.deepEqual(document.payment, { status: 'Pago', method: 'Pix' })
```

A legacy row whose new snapshot columns are empty must still build a valid document with blank phone/address; never invent contact data.

- [ ] **Step 3: Run focused RED**

Run:

```bash
node --test worker/orderPrintingRepository.test.js worker/orderPrintDocumentRepository.test.js
```

Expected: FAIL because the repository modules do not exist.

- [ ] **Step 4: Implement centralized constants and row mappers**

At the top of `worker/orderPrintingRepository.js`:

```js
export const PRINT_PENDING_MAX_AGE_MS = 10 * 60 * 1000
export const PRINT_PROCESSING_MAX_AGE_MS = 2 * 60 * 1000

const mapStationRow = (row) => ({
  id: row.id,
  name: row.name,
  platform: row.platform,
  isPrimary: Boolean(row.is_primary),
  autoPrintEnabled: Boolean(row.auto_print_enabled),
  defaultCopies: Number(row.default_copies) || 2,
  lastSeenAt: row.last_seen_at ?? null,
})

const mapJobRow = (row) => ({
  id: row.id,
  orderId: row.order_id ?? null,
  type: row.type,
  trigger: row.trigger,
  status: row.status,
  copiesRequested: Number(row.copies_requested),
  copiesPrinted: Number(row.copies_printed),
  stationId: row.station_id ?? null,
  document: JSON.parse(row.snapshot_json),
  createdAt: row.created_at,
  processingStartedAt: row.processing_started_at ?? null,
  processedAt: row.processed_at ?? null,
  lastError: row.last_error_code ? { code: row.last_error_code, message: row.last_error_message || '' } : null,
})
```

Use one SQL `UPDATE ... WHERE status = 'pending'` for claims and inspect `meta.changes`/equivalent fake result before loading the claimed row. Never implement claim as separate SELECT-then-UPDATE.

- [ ] **Step 5: Implement aging before every automatic claim/list refresh**

Use server timestamps only:

```js
const pendingCutoff = new Date(now.getTime() - PRINT_PENDING_MAX_AGE_MS).toISOString()
const processingCutoff = new Date(now.getTime() - PRINT_PROCESSING_MAX_AGE_MS).toISOString()

await db.batch([
  db.prepare(`UPDATE print_jobs SET status = 'requires_attention', processed_at = ?,
    last_error_code = 'PENDING_TOO_OLD', last_error_message = 'Impressão automática aguardou mais de 10 minutos.'
    WHERE business_id = ? AND trigger = 'automatic' AND status = 'pending' AND created_at <= ?`)
    .bind(now.toISOString(), businessId, pendingCutoff),
  db.prepare(`UPDATE print_jobs SET status = 'requires_attention', processed_at = ?,
    last_error_code = 'PROCESSING_OUTCOME_UNKNOWN', last_error_message = 'A estação não confirmou o resultado da impressão.'
    WHERE business_id = ? AND status = 'processing' AND processing_started_at <= ?`)
    .bind(now.toISOString(), businessId, processingCutoff),
])
```

- [ ] **Step 6: Implement current-document loading from official order snapshots**

`worker/orderPrintDocumentRepository.js` must query the canonical order/item data and convert money back to cents for the shared builder. Do not call client-side float helpers. Use raw D1 integer columns and the persisted `client_phone_snapshot`/`client_address_snapshot` columns.

- [ ] **Step 7: Run GREEN**

Run:

```bash
node --test worker/orderPrintingRepository.test.js worker/orderPrintDocumentRepository.test.js shared/orderPrintDocument.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add worker/orderPrintingRepository.js worker/orderPrintingRepository.test.js worker/orderPrintDocumentRepository.js worker/orderPrintDocumentRepository.test.js
git commit -m "feat: add printing job repository"
```

---

### Task 4: Make checkout create the automatic job atomically and idempotently

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/orderReadSql.js`
- Modify: `worker/multiItemCheckoutRepository.test.js`
- Create: `worker/orderAutomaticPrintJob.test.js`

**Interfaces:**
- Consumes: `loadPrimaryAutomaticPrintStation()` and `prepareAutomaticPrintJobStatement()` from Task 3; `createOrderPrintDocument()` from Task 2.
- Produces: every new current kitchen order persists contact snapshots and optionally appends exactly one automatic `print_jobs` INSERT to the same D1 batch as order/items/payment/movement.

- [ ] **Step 1: Write RED coverage for contact snapshots and automation gating**

Create `worker/orderAutomaticPrintJob.test.js` around a fake checkout DB with primary-station configuration. Required cases:

```js
const order = await createOrder(db, 'amor-e-sabor', paidDeliveryInput, now)
assert.equal(order.clientPhone, '(11) 99876-5432')
assert.equal(order.clientAddress, 'Rua das Flores, 123')
assert.equal(db.printJobs.size, 1)
const job = [...db.printJobs.values()][0]
assert.equal(job.trigger, 'automatic')
assert.equal(job.status, 'pending')
assert.equal(job.copies_requested, 2)
assert.equal(JSON.parse(job.snapshot_json).payment.status, 'Pago')
```

Add cases proving:

```js
assert.equal(dbWithAutoDisabled.printJobs.size, 0)
assert.equal(dbWithNoPrimary.printJobs.size, 0)
assert.equal(dbHistoricalOrder.printJobs.size, 0)
```

Retry the same `idempotencyKey` and assert one order and one automatic job remain.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test worker/orderAutomaticPrintJob.test.js worker/multiItemCheckoutRepository.test.js
```

Expected: FAIL because orders do not persist contact snapshots or create print jobs.

- [ ] **Step 3: Extend canonical order reads/maps with contact snapshots**

Add to both canonical SELECT definitions used in the Worker:

```sql
o.client_phone_snapshot,
o.client_address_snapshot,
```

Extend `mapOrderRow()`:

```js
clientPhone: row.client_phone_snapshot || '',
clientAddress: row.client_address_snapshot || '',
```

When loading a registered client during checkout, select `phone` and `address` with `id` and `name`; guest/table orders use empty contact snapshots.

- [ ] **Step 4: Persist contact snapshots in the existing order INSERT**

Add the two columns next to `client_name_snapshot` and bind the exact values selected at checkout. Update fake DB parsers in the existing repository tests to match the new INSERT arity.

- [ ] **Step 5: Append the automatic print job to the existing checkout batch**

After `orderId`, totals, status, and optional payment are known:

```js
const primaryPrintStation = status === 'Em preparo'
  ? await loadPrimaryAutomaticPrintStation(db, businessId)
  : null

if (primaryPrintStation) {
  const business = await db.prepare('SELECT name FROM businesses WHERE id = ? LIMIT 1').bind(businessId).first()
  const printDocument = createOrderPrintDocument({
    businessName: business?.name || 'Amor & Sabor',
    orderId,
    orderDate: input.orderDate,
    createdAt,
    type: input.type,
    customer: { name: clientSnapshot, phone: clientPhoneSnapshot, address: clientAddressSnapshot },
    items: pricedItems.map((item) => ({
      name: item.product.name,
      presentation: productSnapshotSize(item.product),
      quantity: item.quantity,
      note: item.note || '',
      unitPriceCents: item.product.price_cents,
    })),
    subtotalCents: totals.subtotalCents,
    deliveryFeeCents,
    adjustment: { type: adjustment.type, amountCents: totals.adjustmentAmountCents, reason: adjustment.reason || '' },
    totalCents: totals.totalCents,
    payment: { status: input.paymentMethod ? 'Pago' : 'Pendente', method: input.paymentMethod || '' },
  })
  statements.push(prepareAutomaticPrintJobStatement(db, businessId, {
    orderId,
    copies: primaryPrintStation.defaultCopies,
    document: printDocument,
    createdAt,
  }))
}
```

Do not set `station_id` on the pending automatic job; the primary station owns it only after an atomic claim.

- [ ] **Step 6: Run GREEN and checkout regressions**

Run:

```bash
node --test worker/orderAutomaticPrintJob.test.js worker/multiItemCheckoutRepository.test.js worker/orderReadRepository.test.js
```

Expected: PASS; paid checkout rollback test also proves an inserted print job rolls back with the rest of the batch.

- [ ] **Step 7: Commit**

```bash
git add worker/repositories.js worker/orderReadSql.js worker/multiItemCheckoutRepository.test.js worker/orderAutomaticPrintJob.test.js
git commit -m "feat: enqueue automatic order print jobs"
```

---

### Task 5: Expose authenticated print station/job/document APIs

**Files:**
- Modify: `worker/index.js`
- Create: `worker/orderPrintingHttp.test.js`
- Modify: `src/api/client.js`
- Modify: `src/api/client.test.js`

**Interfaces:**
- Produces exact HTTP routes:
  - `GET /api/printing/stations`
  - `PUT /api/printing/stations/:id`
  - `POST /api/printing/stations/:id/make-primary`
  - `GET /api/printing/jobs?orderId=<id>&limit=<n>`
  - `POST /api/orders/:id/print-jobs`
  - `POST /api/printing/test-jobs`
  - `POST /api/printing/jobs/claim-next`
  - `POST /api/printing/jobs/:id/claim`
  - `POST /api/printing/jobs/:id/complete`
  - `POST /api/printing/jobs/:id/fail`
  - `POST /api/printing/jobs/:id/retry`
  - `GET /api/orders/:id/print-document`
- All mutation routes require `assertSameOriginMutation()` and all repository calls use `session.businessId` rather than a request-body business id.

- [ ] **Step 1: Write HTTP RED tests using the existing login-cookie pattern**

In `worker/orderPrintingHttp.test.js`, reuse the `hashPin()`, `handleRequest()`, `loginCookie()` shape from `worker/orderCancellationHttp.test.js`. Required assertions include:

```js
const stations = await handleRequest(new Request('https://delivery.example/api/printing/stations', {
  headers: { cookie },
}), env)
assert.equal(stations.status, 200)

const manual = await handleRequest(new Request('https://delivery.example/api/orders/o1/print-jobs', {
  method: 'POST', headers: mutationHeaders(cookie), body: JSON.stringify({ copies: 2 }),
}), env)
assert.equal(manual.status, 201)
assert.equal((await manual.json()).job.trigger, 'manual')
```

Test that `claim-next` rejects a secondary station, `complete` records `copiesPrinted`, `fail` accepts `{ uncertain: true }`, retry keeps the same job id/document, a different business cannot read another job, and unauthenticated calls return 401.

- [ ] **Step 2: Extend API-client RED coverage**

Import the new helpers from `src/api/client.js` and assert exact route/method/body pairs, including URL encoding:

```js
await upsertPrintStation('station 1', { name: 'Tablet', platform: 'android', autoPrintEnabled: true, defaultCopies: 2 })
await createManualPrintJob('order 1', 2)
await claimNextPrintJob('station 1')
await completePrintJob('job 1', 'station 1', 2)
```

Expected paths include `/api/printing/stations/station%201`, `/api/orders/order%201/print-jobs`, and `/api/printing/jobs/job%201/complete`.

- [ ] **Step 3: Run RED**

Run:

```bash
node --test worker/orderPrintingHttp.test.js src/api/client.test.js
```

Expected: FAIL because routes/helpers do not exist.

- [ ] **Step 4: Add narrow route branches in `worker/index.js`**

Validate bodies before repository calls. Use these request contracts:

```js
// PUT station
{ name, platform, autoPrintEnabled, defaultCopies }

// manual order job
{ copies }

// test job
{ stationId }

// claims/retry
{ stationId }

// complete
{ stationId, copiesPrinted }

// fail
{ stationId, code, message, uncertain }
```

Clamp/validate copies to exactly `1` or `2`; platform to `windows|android|other`; reject unknown transitions as 409 rather than silently overwriting job state.

- [ ] **Step 5: Add client helpers with stable names**

In `src/api/client.js` export:

```js
export const getPrintStations = () => apiRequest('/api/printing/stations')
export const upsertPrintStation = (id, station) => apiRequest(`/api/printing/stations/${encodeURIComponent(id)}`, withJson('PUT', station))
export const makePrimaryPrintStation = (id) => apiRequest(`/api/printing/stations/${encodeURIComponent(id)}/make-primary`, { method: 'POST' })
export const getPrintJobs = ({ orderId = '', limit = 100 } = {}) => apiRequest(`/api/printing/jobs?${new URLSearchParams({ ...(orderId ? { orderId } : {}), limit: String(limit) })}`)
export const createManualPrintJob = (orderId, copies) => apiRequest(`/api/orders/${encodeURIComponent(orderId)}/print-jobs`, withJson('POST', { copies }))
export const createTestPrintJob = (stationId) => apiRequest('/api/printing/test-jobs', withJson('POST', { stationId }))
export const claimNextPrintJob = (stationId) => apiRequest('/api/printing/jobs/claim-next', withJson('POST', { stationId }))
export const claimPrintJob = (jobId, stationId) => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/claim`, withJson('POST', { stationId }))
export const completePrintJob = (jobId, stationId, copiesPrinted) => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/complete`, withJson('POST', { stationId, copiesPrinted }))
export const failPrintJob = (jobId, stationId, failure) => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/fail`, withJson('POST', { stationId, ...failure }))
export const retryPrintJob = (jobId, stationId) => apiRequest(`/api/printing/jobs/${encodeURIComponent(jobId)}/retry`, withJson('POST', { stationId }))
export const getOrderPrintDocument = (orderId) => apiRequest(`/api/orders/${encodeURIComponent(orderId)}/print-document`)
```

- [ ] **Step 6: Return the automatic job summary from successful order creation when present**

After `createOrder()` completes, load the unique automatic job for the returned order and include `{ printJob }` in the 201 body when it exists. Existing consumers that destructure only `order`, `movement`, and `tableTab` remain compatible.

- [ ] **Step 7: Run GREEN**

Run:

```bash
node --test worker/orderPrintingHttp.test.js src/api/client.test.js worker/index.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add worker/index.js worker/orderPrintingHttp.test.js src/api/client.js src/api/client.test.js
git commit -m "feat: expose printing APIs"
```

---

### Task 6: Render deterministic 58 mm ESC/POS bytes for the MTP5

**Files:**
- Create: `src/printing/mtp5Profile.js`
- Create: `src/printing/cp860.js`
- Create: `src/printing/escpos58mm.js`
- Create: `src/printing/escpos58mm.test.js`

**Interfaces:**
- Produces `MTP5_PROFILE`.
- Produces `encodeCp860(text): Uint8Array`.
- Produces `wrapPrintText(text, columns): string[]`.
- Produces `renderEscPos58mm(document, { copies }): Uint8Array`.

- [ ] **Step 1: Write RED layout/encoding tests**

Use the canonical fixture from Task 2. Assert:

```js
assert.equal(MTP5_PROFILE.dotsPerLine, 384)
assert.equal(MTP5_PROFILE.fontAColumns, 32)
assert.equal(MTP5_PROFILE.codePage, 3)
assert.deepEqual([...encodeCp860('João Ç')], [74, 111, 132, 111, 32, 128])
```

Use CP860 byte fixtures verified against the code page for every Portuguese character included in the test (`ã`, `ç`, `é`, `ó`, `ê`, `Á`). Unknown characters such as emoji must encode as `?` (`0x3f`).

For rendering, assert:

```js
const bytes = renderEscPos58mm(document, { copies: 2 })
const printable = decodeFixtureBytesForAssertions(bytes)
assert.match(printable, /PEDIDO #0184/)
assert.match(printable, /CÓPIA 1\/2/)
assert.match(printable, /CÓPIA 2\/2/)
assert.match(printable, /TOTAL/)
assert.match(printable, /Obrigado pela compra!/)
assert.equal(longestLogicalLine(printable) <= 32, true)
```

Also test 1 copy, long address, long note, Entrega/Retirada/Local conditional contact sections, discount, surcharge, paid, and pending.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test src/printing/escpos58mm.test.js
```

Expected: FAIL because renderer/profile/encoder do not exist.

- [ ] **Step 3: Define the hardware profile in one file**

`src/printing/mtp5Profile.js`:

```js
export const MTP5_PROFILE = Object.freeze({
  paperWidthMm: 58,
  printableWidthMm: 48,
  dotsPerLine: 384,
  fontAColumns: 32,
  codePage: 3,
  serial: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
  feedLinesAfterJob: 4,
})
```

The baud rate is an API-required serial option and is intentionally isolated here so real-hardware acceptance can adjust the profile without changing renderer/business logic.

- [ ] **Step 4: Implement byte-safe ESC/POS composition**

Use named command helpers, not embedded magic arrays throughout the renderer:

```js
const ESC = 0x1b
const GS = 0x1d
const initialize = () => Uint8Array.from([ESC, 0x40])
const selectCodePage = (page) => Uint8Array.from([ESC, 0x74, page])
const align = (value) => Uint8Array.from([ESC, 0x61, value]) // 0 left, 1 center
const bold = (enabled) => Uint8Array.from([ESC, 0x45, enabled ? 1 : 0])
const size = (value) => Uint8Array.from([GS, 0x21, value])
```

Render each copy independently and insert `CÓPIA n/N` before the thank-you footer. Use `size(0x11)` only for short headings such as `PEDIDO #0184` and `TOTAL R$ 87,50`; return to `size(0x00)` before 32-column text. Do not emit a cut command.

- [ ] **Step 5: Run GREEN**

Run:

```bash
node --test src/printing/escpos58mm.test.js shared/orderPrintDocument.test.js
```

Expected: PASS with deterministic byte fixtures.

- [ ] **Step 6: Commit**

```bash
git add src/printing/mtp5Profile.js src/printing/cp860.js src/printing/escpos58mm.js src/printing/escpos58mm.test.js
git commit -m "feat: render MTP5 ESC POS tickets"
```

---

### Task 7: Add local station identity and Web Serial transport

**Files:**
- Create: `src/printing/localPrintStation.js`
- Create: `src/printing/localPrintStation.test.js`
- Create: `src/printing/webSerialTransport.js`
- Create: `src/printing/webSerialTransport.test.js`

**Interfaces:**
- Produces `getOrCreateLocalPrintStationId(storage)`, `savePrinterFingerprint(storage, stationId, port)`, `findAuthorizedPrinterPort(serial, storage, stationId)`.
- Produces `isWebSerialSupported(serial)`, `requestPrinterPort(serial)`, `writeSerialBytes(port, bytes, serialOptions)`.
- Produces errors with stable codes: `WEB_SERIAL_UNSUPPORTED`, `PRINTER_NOT_AUTHORIZED`, `SERIAL_OPEN_FAILED`, `SERIAL_WRITE_UNCERTAIN`.

- [ ] **Step 1: Write RED tests for stable local identity and ambiguous ports**

Use fake storage and fake `SerialPort.getInfo()` values:

```js
const first = getOrCreateLocalPrintStationId(storage)
const second = getOrCreateLocalPrintStationId(storage)
assert.equal(first, second)

savePrinterFingerprint(storage, first, bluetoothPort)
assert.equal(await findAuthorizedPrinterPort(serialWithOneMatch, storage, first), bluetoothPort)
assert.equal(await findAuthorizedPrinterPort(serialWithTwoIdenticalMatches, storage, first), null)
```

When exactly one authorized serial port exists and no saved fingerprint exists, permit that one port as the safe fallback; two or more unmatched ports require explicit user selection.

- [ ] **Step 2: Write RED Web Serial tests**

Cover:

```js
assert.equal(isWebSerialSupported(undefined), false)
await assert.rejects(() => requestPrinterPort(undefined), (error) => error.code === 'WEB_SERIAL_UNSUPPORTED')
```

A successful fake port must record `open(MTP5_PROFILE.serial)`, one writer `write(bytes)`, `releaseLock()`, and `close()` in order. An open rejection must throw `SERIAL_OPEN_FAILED`. A rejection after `writer.write()` begins must throw `SERIAL_WRITE_UNCERTAIN`.

- [ ] **Step 3: Run RED**

Run:

```bash
node --test src/printing/localPrintStation.test.js src/printing/webSerialTransport.test.js
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement Bluetooth SPP selection and local persistence**

Use the standard SPP service class id:

```js
export const BLUETOOTH_SPP_SERVICE_CLASS_ID = '00001101-0000-1000-8000-00805f9b34fb'

export const requestPrinterPort = async (serial = globalThis.navigator?.serial) => {
  if (!serial?.requestPort) throw printingError('WEB_SERIAL_UNSUPPORTED', 'Este navegador não oferece impressão Bluetooth compatível.')
  return serial.requestPort({
    filters: [{ bluetoothServiceClassId: BLUETOOTH_SPP_SERVICE_CLASS_ID }],
  })
}
```

Persist only a JSON fingerprint derived from `port.getInfo()` (`usbVendorId`, `usbProductId`, `bluetoothServiceClassId`) and the generated local station id. Never attempt to serialize/store the `SerialPort` object.

- [ ] **Step 5: Implement one open-write-close transaction with explicit uncertainty**

`writeSerialBytes()` must mark the stage before writing:

```js
let writeStarted = false
try {
  await port.open(serialOptions)
  const writer = port.writable.getWriter()
  try {
    writeStarted = true
    await writer.write(bytes)
  } finally {
    writer.releaseLock()
  }
  await port.close()
} catch (error) {
  if (writeStarted) throw printingError('SERIAL_WRITE_UNCERTAIN', 'A conexão caiu durante a impressão.', error)
  throw printingError('SERIAL_OPEN_FAILED', 'Não foi possível conectar à impressora.', error)
}
```

Do not retry inside this function.

- [ ] **Step 6: Run GREEN**

Run:

```bash
node --test src/printing/localPrintStation.test.js src/printing/webSerialTransport.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/printing/localPrintStation.js src/printing/localPrintStation.test.js src/printing/webSerialTransport.js src/printing/webSerialTransport.test.js
git commit -m "feat: add Web Serial printer transport"
```

---

### Task 8: Orchestrate one print job without hidden retries

**Files:**
- Create: `src/printing/printJobRunner.js`
- Create: `src/printing/printJobRunner.test.js`

**Interfaces:**
- Consumes: `renderEscPos58mm()`, `writeSerialBytes()`, and API callbacks.
- Produces `runClaimedPrintJob({ job, stationId, port, completeJob, failJob, renderer, transport }): Promise<{ status }>`.
- It processes one already-claimed job exactly once; scheduling/polling belongs to Task 9.

- [ ] **Step 1: Write RED orchestration tests**

Success:

```js
const result = await runClaimedPrintJob({
  job, stationId: 'station-a', port,
  renderer: () => Uint8Array.from([1, 2, 3]),
  transport: async () => {},
  completeJob: async (...args) => calls.push(['complete', ...args]),
  failJob: async (...args) => calls.push(['fail', ...args]),
})
assert.equal(result.status, 'printed')
assert.deepEqual(calls[0], ['complete', job.id, 'station-a', job.copiesRequested])
```

Known open failure:

```js
const error = Object.assign(new Error('offline'), { code: 'SERIAL_OPEN_FAILED' })
assert.equal((await runWithTransportReject(error)).status, 'failed')
assert.equal(failure.uncertain, false)
```

Uncertain write failure:

```js
const error = Object.assign(new Error('mid-write'), { code: 'SERIAL_WRITE_UNCERTAIN' })
assert.equal((await runWithTransportReject(error)).status, 'requires_attention')
assert.equal(failure.uncertain, true)
```

Assert the transport is called exactly once in every case and that no timer/retry function is used.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test src/printing/printJobRunner.test.js
```

Expected: FAIL because runner does not exist.

- [ ] **Step 3: Implement the smallest one-shot runner**

```js
export const runClaimedPrintJob = async ({ job, stationId, port, completeJob, failJob, renderer, transport }) => {
  try {
    const bytes = renderer(job.document, { copies: job.copiesRequested })
    await transport(port, bytes)
    await completeJob(job.id, stationId, job.copiesRequested)
    return { status: 'printed' }
  } catch (error) {
    const uncertain = error?.code === 'SERIAL_WRITE_UNCERTAIN'
    await failJob(job.id, stationId, {
      code: error?.code || 'PRINT_FAILED',
      message: error?.message || 'Não foi possível imprimir o pedido.',
      uncertain,
    })
    return { status: uncertain ? 'requires_attention' : 'failed', error }
  }
}
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
node --test src/printing/printJobRunner.test.js src/printing/escpos58mm.test.js src/printing/webSerialTransport.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/printing/printJobRunner.js src/printing/printJobRunner.test.js
git commit -m "feat: orchestrate print job execution"
```

---

### Task 9: Mount a printing manager that registers the station, polls state, and consumes automatic jobs

**Files:**
- Create: `src/printing/usePrintingManager.js`
- Create: `src/printing/printingManagerRegression.test.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes API helpers from Task 5, local serial helpers from Task 7, job runner from Task 8.
- Produces a single manager object passed to `Orders`:

```js
{
  supported,
  localStation,
  stations,
  jobs,
  latestJobByOrderId,
  printerState,
  busyJobId,
  refresh,
  connectPrinter,
  saveStationSettings,
  makePrimary,
  testPrint,
  printOrder,
  retryJob,
  getPreviewDocument,
}
```

- [ ] **Step 1: Write RED source/behavior regression tests**

`src/printing/printingManagerRegression.test.js` must require:

```js
assert.match(managerSource, /claimNextPrintJob/)
assert.match(managerSource, /runClaimedPrintJob/)
assert.match(managerSource, /getAuthorizedPrinterPort|findAuthorizedPrinterPort/)
assert.match(managerSource, /document\.visibilityState === 'visible'/)
assert.doesNotMatch(managerSource, /getNewActiveOrderIds/)
assert.doesNotMatch(managerSource, /setInterval\([^,]+,\s*[0-9]+\)[\s\S]*retry/i)
```

`App.jsx` must import/mount the hook exactly once and pass `printing={printing}` to `Orders`. The existing `getNewActiveOrderIds` behavior remains only for highlight/sound.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test src/printing/printingManagerRegression.test.js
```

Expected: FAIL because the manager does not exist and App is not wired.

- [ ] **Step 3: Implement local station registration and state polling**

Use these cadences as named constants:

```js
const PRINT_JOB_POLL_MS = 2_000
const PRINT_STATE_POLL_MS = 5_000
const STATION_HEARTBEAT_MS = 15_000
```

The hook must:

1. generate/reuse one local station id;
2. upsert its platform/name/settings when authenticated;
3. refresh stations + recent jobs immediately, every 5 seconds while visible, on focus, and after print mutations;
4. touch/upsert `last_seen_at` every 15 seconds while authenticated/online;
5. only call `claimNextPrintJob(localStation.id)` when the server says this local station is primary and `autoPrintEnabled === true`;
6. after a claim, find an already-authorized port via `navigator.serial.getPorts()`; never call `requestPort()` from the automatic loop;
7. if no authorized port can be resolved, fail that claimed job with `PRINTER_NOT_AUTHORIZED` and show one visible printing alert through manager state;
8. execute a claimed job once via `runClaimedPrintJob()`;
9. refresh job state after completion/failure.

Guard overlapping claim loops with a ref such as `automaticClaimInFlightRef`.

- [ ] **Step 4: Implement user-gesture manual methods**

`connectPrinter()` calls `requestPrinterPort()` directly from the UI click handler path, saves the fingerprint, then updates `printerState`.

`printOrder(orderId, copies)` creates a manual job, claims that exact returned job with the local station id, resolves the authorized port, and runs it once.

`retryJob(jobId)` calls the backend retry endpoint for the same job, claims the same job locally, and executes the unchanged snapshot.

`testPrint()` creates a persisted `type=test` job for the local station, claims it, and sends it through the same ESC/POS + transport runner.

- [ ] **Step 5: Wire App without moving order ownership**

Mount:

```js
const printing = usePrintingManager({
  authenticated: authState === 'authenticated' && bootstrapState === 'ready',
  online: isOnline,
  onAlert: setToastMessage,
})
```

Pass only the manager to `Orders`; do not add `printJobs` to `DATA_COLLECTIONS`, and do not alter the 2-second order polling to create/claim jobs.

- [ ] **Step 6: Run GREEN and realtime regressions**

Run:

```bash
node --test src/printing/printingManagerRegression.test.js src/realtimeSyncRegression.test.js src/orderRealtime.test.js
```

Expected: PASS; order sound/highlight still operates independently from print jobs.

- [ ] **Step 7: Commit**

```bash
git add src/printing/usePrintingManager.js src/printing/printingManagerRegression.test.js src/App.jsx
git commit -m "feat: consume automatic print jobs"
```

---

### Task 10: Generate the approved digital PDF from the same document

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/printing/pdfOrderRenderer.js`
- Create: `src/printing/pdfOrderRenderer.test.js`

**Interfaces:**
- Consumes canonical `OrderPrintDocument` only.
- Produces `renderOrderPdf(document): ArrayBuffer` and `downloadOrderPdf(document, { documentRef, urlApi })`.
- Produces stable filename `pedido-<friendly-number>.pdf`.

- [ ] **Step 1: Add RED tests before the dependency/renderer exists**

Create the test with expectations:

```js
const buffer = renderOrderPdf(document)
const signature = new TextDecoder('latin1').decode(new Uint8Array(buffer).slice(0, 5))
assert.equal(signature, '%PDF-')
assert.equal(getOrderPdfFilename(document), 'pedido-0184.pdf')
```

Also inspect the jsPDF command/text surface through an injected document factory so the test can assert `Amor & Sabor`, `PEDIDO #0184`, `TOTAL`, `Pix`, and the thank-you message are written without parsing PDF internals.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test src/printing/pdfOrderRenderer.test.js
```

Expected: FAIL because `jspdf` and the renderer are absent.

- [ ] **Step 3: Install exactly jsPDF 4.2.1**

Run:

```bash
npm install jspdf@4.2.1 --save
```

This must update both `package.json` and `package-lock.json`.

- [ ] **Step 4: Implement a text-native A5 PDF, not an HTML screenshot**

Use `new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })`. Implement a small `writeWrapped(text, options)` helper using `doc.splitTextToSize()` and page-break when `y > 190`. Render the same semantic order as the thermal ticket: business/header, customer, items/notes, financial summary, payment, thank-you.

Do not include `CÓPIA 1/2` in the PDF because copy numbering is physical-job presentation, not digital document content.

- [ ] **Step 5: Implement a browser-only download helper with stable cleanup**

```js
export const getOrderPdfFilename = (document) => `pedido-${document.order.number}.pdf`

export const downloadOrderPdf = (document, { documentRef = globalThis.document, urlApi = globalThis.URL } = {}) => {
  const blob = new Blob([renderOrderPdf(document)], { type: 'application/pdf' })
  const url = urlApi.createObjectURL(blob)
  const link = documentRef.createElement('a')
  link.href = url
  link.download = getOrderPdfFilename(document)
  link.click()
  urlApi.revokeObjectURL(url)
}
```

- [ ] **Step 6: Run GREEN and build immediately to catch browser bundling issues**

Run:

```bash
node --test src/printing/pdfOrderRenderer.test.js
npm run build
```

Expected: PASS; Vite bundles jsPDF without Node-only polyfill errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/printing/pdfOrderRenderer.js src/printing/pdfOrderRenderer.test.js
git commit -m "feat: generate digital order PDFs"
```

---

### Task 11: Add printing settings and printer test UX

**Files:**
- Create: `src/components/PrintingSettings.jsx`
- Create: `src/components/PrintingSettings.test.js`
- Create: `src/printing/printing.css`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes the manager from Task 9.
- Produces an Orders-header `Impressão` action and a modal that can connect/trocar printer, print test, set primary, toggle automatic printing, choose 1/2 copies, and display compatibility/connection state.

- [ ] **Step 1: Write RED UI contract tests**

The component source test must require all approved controls/copy:

```js
assert.match(source, /Conectar impressora|Trocar impressora/)
assert.match(source, /Testar impressão/)
assert.match(source, /Estação principal/)
assert.match(source, /Impressão automática/)
assert.match(source, /1 cópia/)
assert.match(source, /2 cópias/)
assert.match(source, /Web Serial|Chrome/)
```

Orders source must expose an `Impressão` header action that opens settings without navigating away from the kitchen queue.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test src/components/PrintingSettings.test.js
```

Expected: FAIL because settings UI does not exist.

- [ ] **Step 3: Implement status-first settings UI**

The top summary must show one of exactly:

- `Conectada` — authorized port resolved;
- `Desconectada` — station exists but authorized port cannot be opened/resolved;
- `Não configurada` — no fingerprint/authorized selection;
- `Navegador incompatível` — no Web Serial.

Disable `Testar impressão` until the browser is supported and a selected/authorized port is available. `Conectar impressora` remains the user-gesture action that calls `printing.connectPrinter()`.

- [ ] **Step 4: Require an explicit confirmation before making this device primary**

Reuse the existing `ConfirmationDialog`:

```jsx
<ConfirmationDialog
  title="Definir estação principal"
  message="Somente esta estação passará a imprimir novos pedidos automaticamente."
  confirmLabel="Definir como principal"
  onConfirm={handleMakePrimary}
  onClose={closeConfirmation}
/>
```

Changing automatic on/off or 1/2 copies does not require a destructive confirmation; save via `printing.saveStationSettings()`.

- [ ] **Step 5: Make the modal mobile-safe**

In `src/printing/printing.css`, use the existing modal container and add only feature-scoped layouts. At `max-width: 480px`, controls stack vertically, buttons use full available width, and no fixed pixel width exceeds the viewport.

- [ ] **Step 6: Run GREEN and mobile regressions**

Run:

```bash
node --test src/components/PrintingSettings.test.js src/mobileOverlayRegression.test.js src/pages/Orders*.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/PrintingSettings.jsx src/components/PrintingSettings.test.js src/printing/printing.css src/pages/Orders.jsx src/App.jsx
git commit -m "feat: add printing station settings"
```

---

### Task 12: Show print state and add Preview, PDF, Print/Reprint, Retry actions to orders

**Files:**
- Create: `src/components/PrintStatusBadge.jsx`
- Create: `src/components/OrderTicketPreview.jsx`
- Create: `src/components/OrderTicketPreview.test.js`
- Create: `src/printing/printingUi.test.js`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/components/OrderDetail.jsx`
- Modify: `src/App.jsx`
- Modify: `src/printing/printing.css`

**Interfaces:**
- Consumes `printing.latestJobByOrderId`, `printing.printOrder`, `printing.retryJob`, `printing.getPreviewDocument`, and `downloadOrderPdf()`.
- Produces friendly states: `Pendente de impressão`, `Imprimindo`, `Impresso`, `Falha na impressão`, `Requer atenção`.

- [ ] **Step 1: Write RED state and content tests**

`OrderTicketPreview.test.js` must verify that preview source renders canonical fields from `document` and never reaches back into a raw `order` object for ticket data:

```js
assert.match(source, /document\.business\.name/)
assert.match(source, /document\.financial\.totalCents/)
assert.match(source, /document\.payment\.status/)
assert.match(source, /document\.message/)
assert.doesNotMatch(source, /order\.items/)
```

`printingUi.test.js` must require all five friendly status labels, `Visualizar ticket`, `Gerar PDF`, `Imprimir pedido|Reimprimir`, confirmation before reprint, and `Tentar novamente|Imprimir agora` for failed/attention states.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test src/components/OrderTicketPreview.test.js src/printing/printingUi.test.js
```

Expected: FAIL because status/preview/actions are not implemented.

- [ ] **Step 3: Add a compact status badge to each kitchen card**

Map backend states only:

```js
const labels = {
  pending: 'Pendente de impressão',
  processing: 'Imprimindo',
  printed: 'Impresso',
  failed: 'Falha na impressão',
  requires_attention: 'Requer atenção',
}
```

No job means no badge; this is normal when automatic printing was off.

- [ ] **Step 4: Put document actions inside `OrderDetail`**

Add a dedicated `Impressão do pedido` section with:

- `Visualizar ticket` → `await printing.getPreviewDocument(order.id)` and open `OrderTicketPreview`;
- `Gerar PDF` → fetch the same current document and call `downloadOrderPdf(document)`;
- `Imprimir pedido` if no completed job exists;
- `Reimprimir` if the latest relevant job is already `printed`;
- `Tentar novamente` for `failed`;
- `Imprimir agora` for `requires_attention`.

Keep finalization/cancellation controls separate from printing controls.

- [ ] **Step 5: Confirm every reprint before creating the new manual job**

Use the actual station copy setting in the confirmation copy:

```jsx
<ConfirmationDialog
  title="Reimprimir pedido"
  message={`Este pedido já foi impresso. Deseja imprimir mais ${copies === 1 ? '1 cópia' : '2 cópias'}?`}
  confirmLabel="Reimprimir"
  onConfirm={confirmReprint}
  onClose={cancelReprint}
/>
```

Do not ask a second confirmation for retrying the same failed/attention job; the retry button itself is the explicit intervention required by the spec.

- [ ] **Step 6: Show persisted error details without leaking raw browser errors**

The UI displays `job.lastError.message` from the sanitized backend payload and the last attempt/processed time. Never render exception stacks or serialized browser objects.

- [ ] **Step 7: Run GREEN and existing kitchen regressions**

Run:

```bash
node --test src/components/OrderTicketPreview.test.js src/printing/printingUi.test.js src/pages/Orders*.test.js src/pages/OrderHistory.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/PrintStatusBadge.jsx src/components/OrderTicketPreview.jsx src/components/OrderTicketPreview.test.js src/printing/printingUi.test.js src/pages/Orders.jsx src/components/OrderDetail.jsx src/App.jsx src/printing/printing.css
git commit -m "feat: add order printing actions and status"
```

---

### Task 13: Prove no print side effect is tied to order polling/reload and close regression gaps

**Files:**
- Modify: `src/printing/printingManagerRegression.test.js`
- Modify: `worker/orderAutomaticPrintJob.test.js`
- Modify: `worker/orderPrintingRepository.test.js`
- Modify: `src/printing/printingUi.test.js`

**Interfaces:**
- Produces final regression coverage for the highest-risk duplicate-print paths.

- [ ] **Step 1: Add RED regressions for synchronization/reload duplication risks**

Require that:

```js
assert.doesNotMatch(appSource, /detectedIds[\s\S]*printOrder|detectedIds[\s\S]*createManualPrintJob/)
assert.doesNotMatch(ordersSource, /getNewActiveOrderIds[\s\S]*print/)
```

On the backend, repeat `createOrder()` with the same idempotency key after the automatic job has already been created and assert exactly one automatic job remains.

Simulate enabling automatic printing after an order was created with it disabled and assert no repository function backfills old orders.

- [ ] **Step 2: Add RED/attention regressions for uncertain physical outcomes**

Simulate:

1. job claimed at `20:00:00`;
2. no completion/failure callback;
3. next server maintenance/claim call at `20:02:01`;
4. job becomes `requires_attention`;
5. `claimNextAutomaticPrintJob()` does not return it;
6. explicit `retryPrintJob()` is required before it can be claimed again.

- [ ] **Step 3: Run the focused suite**

Run:

```bash
node --test src/printing/printingManagerRegression.test.js worker/orderAutomaticPrintJob.test.js worker/orderPrintingRepository.test.js src/printing/printingUi.test.js
```

Expected: any remaining coupling/implicit retry fails before cleanup.

- [ ] **Step 4: Make only the minimal corrections required by failing regressions**

Do not add new functionality here. Typical permitted corrections are removing an accidental print call from an order-sync effect, tightening a `WHERE status = 'pending'` claim predicate, or ensuring `retryPrintJob()` is the only path from `requires_attention` back to `pending`.

- [ ] **Step 5: Run GREEN**

Run the same command and require all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/printing/printingManagerRegression.test.js worker/orderAutomaticPrintJob.test.js worker/orderPrintingRepository.test.js src/printing/printingUi.test.js src/App.jsx src/printing/usePrintingManager.js worker/orderPrintingRepository.js
git commit -m "test: harden printing duplicate protection"
```

Only stage production files in this commit if the RED regressions required an actual minimal fix.

---

### Task 14: Document installation and execute full software verification

**Files:**
- Create: `docs/order-printing-mtp5-acceptance.md`
- Modify: `README.md`

**Interfaces:**
- Produces operator-facing setup steps and a binary pass/fail hardware checklist.

- [ ] **Step 1: Write the hardware acceptance document**

`docs/order-printing-mtp5-acceptance.md` must contain these exact sections:

```text
Pré-requisitos
Windows + Chrome
Android + Chrome 138+
Pareamento MTP5
Conectar impressora no Gestão Delivery
Teste de 1 cópia
Teste de 2 cópias
Acentos e CP860
Pedido longo e quebra de linha
Impressora desligada
Queda durante escrita / resultado incerto
Retomada manual sem duplicidade
Preview e PDF
Resultado final Windows
Resultado final Android
```

For each functional item include unchecked pass/fail fields (`[ ] PASS  [ ] FAIL`) and a notes line. Explicitly state that software completion is not product acceptance until both platform sections are executed with the real MTP5.

- [ ] **Step 2: Add concise README setup/limitations**

Document:

1. pair MTP5 in the OS;
2. use current Chrome;
3. open `Pedidos > Impressão`;
4. `Conectar impressora`;
5. `Testar impressão`;
6. make the intended kitchen device primary;
7. enable automatic printing and choose 1/2 copies.

Also state: no Safari/Firefox guarantee, no automatic retry, no WhatsApp sending, no automatic secondary-station failover.

- [ ] **Step 3: Run the complete automated verification gate**

Run:

```bash
npm test
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: all four commands exit 0.

- [ ] **Step 4: Re-apply migrations to a fresh local D1 database**

Use the project's normal local migration command after resetting only the disposable local Wrangler D1 state, then run:

```bash
npm run d1:migrate:local
npm test
```

Expected: migrations `0001` through `0009` apply in order and tests remain green.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md docs/order-printing-mtp5-acceptance.md
git commit -m "docs: add MTP5 printing setup and acceptance"
```

---

## Manual hardware acceptance gate

After the software tasks are green, use `docs/order-printing-mtp5-acceptance.md` with the real Goldensky MTP5.

Do **not** silently change ticket business rules to accommodate hardware quirks. Hardware-specific adjustments are limited to:

- `src/printing/mtp5Profile.js` serial/profile constants;
- `src/printing/cp860.js`/its verified code-page selection if the physical firmware maps the advertised table differently;
- ESC/POS command details that remain behind `renderEscPos58mm()`.

Required physical outcomes before declaring V1 accepted:

1. Windows Chrome prints 1 and 2 copies.
2. Android Chrome 138+ prints 1 and 2 copies through Bluetooth RFCOMM/SPP.
3. `João`, `Observação`, `Acréscimo`, `preferência`, `ç`, `ã`, `é` print legibly.
4. Long customer/address/item/note text wraps without silent truncation.
5. `TOTAL` and order number have readable emphasis.
6. No cut command causes garbage output.
7. A powered-off/disconnected printer produces a visible failed job without blocking the order.
8. An uncertain mid-write outcome does not automatically print again.
9. Reprint creates a distinct history entry and shows the confirmation first.
10. PDF/preview contain the same customer-safe content and values as the physical ticket.

If either platform cannot communicate with this exact unit despite the validated Chrome RFCOMM capability, stop before adding a native wrapper. Record the observed failure and re-enter brainstorming for the smallest fallback transport; a native Android app/local agent is explicitly outside this V1 plan.
