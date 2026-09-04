# Order Printing ESC/POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable 58 mm ESC/POS order printing to Gestão Delivery with one canonical customer-safe ticket, automatic/manual print jobs, one primary print station, Chrome Web Serial support on Windows and Android, HTML preview, and downloadable PDF.

**Architecture:** Keep order creation authoritative in the Cloudflare Worker/D1 backend. Persist station configuration and immutable print jobs centrally, but keep Bluetooth/Web Serial permission local to each browser/device. The Worker creates the canonical `OrderPrintDocument`; the frontend renders that same document to ESC/POS, HTML preview, and PDF. A focused printing manager mounted once in `App.jsx` polls/claims official jobs and never infers printing from “new order” array detection.

**Tech Stack:** React 19.2.8, Vite 8.2.2, Node 22 test runner (`node --test`), Cloudflare Worker, D1/SQLite, Wrangler 4.128.0, Chrome Web Serial, ESC/POS, jsPDF 4.2.1, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-03-order-printing-escpos-design.md`

## Global Constraints

- Strict TDD for every behavior change: write the failing test, run it and confirm the intended RED, implement the minimum production change, run GREEN, then refactor only while green.
- Initial hardware profile: Goldensky MTP5, 58 mm paper, 48 mm printable width, 384 dots/line, 203 DPI, ESC/POS, Bluetooth Classic SPP/RFCOMM.
- Chrome desktop target is 117+ for Bluetooth RFCOMM Web Serial. Chrome Android target is 138+.
- Deployed Web Serial use requires a secure context (HTTPS).
- Standard Bluetooth SPP devices are enumerated by normal `navigator.serial.requestPort()` after OS pairing. Do not require a custom RFCOMM Service Class ID for the MTP5 unless real-hardware acceptance proves its firmware exposes a non-standard service.
- First printer selection must come from a user gesture through `requestPort()`. Automatic printing may reuse only an already-authorized port returned by `getPorts()`.
- One logical Ticket Oficial is used for kitchen, package, preview, and PDF. It contains values, payment status/method when available, item observations, and `Obrigado pela compra! Agradecemos a preferência.`
- Physical copies are identical. `default_copies` is 1 or 2 and defaults to 2.
- Only one `print_stations` row may be primary per business. Only the primary station may consume jobs automatically.
- A newly created current kitchen order gets at most one automatic job if, at creation time, the primary station has automatic printing enabled. Historical/backdated orders do not auto-print.
- Turning automatic printing on later never backfills older orders.
- Reload, polling, focus, visibility changes, and cross-device synchronization never create automatic jobs.
- Reprinting creates a new manual job/new snapshot and requires confirmation. Retrying a failed/attention job preserves the same job id and immutable snapshot.
- No repeated automatic retry after failure.
- Automatic `pending` jobs older than 10 minutes become `requires_attention` before any new claim.
- `processing` jobs older than 2 minutes become `requires_attention`; an uncertain physical outcome is never automatically reprinted.
- `printed` means the browser completed the serial write without a reported error. The UI must not claim physical-paper certainty that the hardware cannot provide.
- Failure before serial writing starts is `failed`; failure after writing starts is `requires_attention` because some bytes may have reached the printer.
- After `PRINTER_NOT_AUTHORIZED` or `SERIAL_OPEN_FAILED`, the automatic manager must stop claiming additional jobs until an explicit successful connect/test action clears the local block. This prevents a disconnected printer from turning every queued order into a separate failed job.
- Bluetooth pairing PIN/password, browser permission objects, session cookies, and auth tokens never enter D1.
- The MTP5 profile owns all hardware constants. Font A is 12 dots/character, so the 384-dot line yields 32 logical columns.
- Initial Portuguese code-page assumption is CP860 / `ESC t 3`, based on the supplied table ordering. Real-hardware acceptance is authoritative; any correction stays isolated to the printer profile/encoder.
- No paper-cut command in V1.
- PDF is included. Automatic WhatsApp sending is not.
- No native Android wrapper, local print agent, multiple printer routing, fiscal printing, kitchen-sector routing, or automatic failover in V1.
- Production deploy and remote D1 migration require separate explicit user authorization.
- Final software verification: `npm test`, `npm run lint`, `npm run build`, `npx --yes wrangler@4.128.0 deploy --dry-run`.
- Final product acceptance also requires the physical MTP5 on Chrome/Windows and Chrome Android 138+.

---

## File Structure

### Create

- `migrations/0009_order_printing.sql`
- `worker/orderPrintingMigration.test.js`
- `shared/orderPrintDocument.js`
- `shared/orderPrintDocument.test.js`
- `worker/orderPrintDocumentRepository.js`
- `worker/orderPrintDocumentRepository.test.js`
- `worker/orderPrintingRepository.js`
- `worker/orderPrintingRepository.test.js`
- `worker/orderPrintingHttp.test.js`
- `src/printing/mtp5Profile.js`
- `src/printing/cp860.js`
- `src/printing/escpos58mm.js`
- `src/printing/escpos58mm.test.js`
- `src/printing/localPrintStation.js`
- `src/printing/localPrintStation.test.js`
- `src/printing/webSerialTransport.js`
- `src/printing/webSerialTransport.test.js`
- `src/printing/printJobRunner.js`
- `src/printing/printJobRunner.test.js`
- `src/printing/usePrintingManager.js`
- `src/printing/printingManagerRegression.test.js`
- `src/printing/pdfOrderRenderer.js`
- `src/printing/pdfOrderRenderer.test.js`
- `src/components/PrintStatusBadge.jsx`
- `src/components/PrintingSettings.jsx`
- `src/components/PrintingSettings.test.js`
- `src/components/OrderTicketPreview.jsx`
- `src/components/OrderTicketPreview.test.js`
- `src/printing/printing.css`
- `src/printing/printingUi.test.js`
- `docs/order-printing-mtp5-acceptance.md`

### Modify

- `worker/repositories.js`
- `worker/orderReadSql.js`
- `worker/multiItemCheckoutRepository.test.js`
- `worker/index.js`
- `src/api/client.js`
- `src/api/client.test.js`
- `src/App.jsx`
- `src/pages/Orders.jsx`
- `src/components/OrderDetail.jsx`
- `package.json`
- `package-lock.json`
- `README.md`

---

### Task 1: Add D1 persistence for ticket snapshots, stations, and jobs

**Files:** Create `migrations/0009_order_printing.sql`, `worker/orderPrintingMigration.test.js`.

**Produces:** immutable customer-contact snapshots on orders, central station records, central print jobs, database invariants for one primary station and one automatic job per order.

- [ ] **Step 1: Write RED migration-contract tests**

```js
const sql = await readFile(new URL('../migrations/0009_order_printing.sql', import.meta.url), 'utf8').catch(() => '')
assert.match(sql, /client_phone_snapshot/)
assert.match(sql, /client_address_snapshot/)
assert.match(sql, /CREATE TABLE print_stations/)
assert.match(sql, /CREATE TABLE print_jobs/)
assert.match(sql, /WHERE is_primary = 1/)
assert.match(sql, /WHERE type = 'order' AND trigger = 'automatic'/)
```

Run:

```bash
node --test worker/orderPrintingMigration.test.js
```

Expected RED: migration file is absent.

- [ ] **Step 2: Implement `0009_order_printing.sql`**

Use this schema contract:

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
  copies_printed INTEGER NOT NULL DEFAULT 0 CHECK (copies_printed BETWEEN 0 AND 2),
  station_id TEXT REFERENCES print_stations(id) ON DELETE SET NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  processing_started_at TEXT,
  processed_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  CHECK ((type = 'order' AND order_id IS NOT NULL) OR (type = 'test' AND order_id IS NULL))
);
CREATE INDEX print_jobs_pending_idx ON print_jobs (business_id, status, trigger, created_at);
CREATE INDEX print_jobs_order_history_idx ON print_jobs (business_id, order_id, created_at DESC);
CREATE UNIQUE INDEX print_jobs_one_auto_order_idx
  ON print_jobs (business_id, order_id)
  WHERE type = 'order' AND trigger = 'automatic';
```

- [ ] **Step 3: GREEN + local migration check**

```bash
node --test worker/orderPrintingMigration.test.js
npm run d1:migrate:local
```

- [ ] **Step 4: Commit**

```bash
git add migrations/0009_order_printing.sql worker/orderPrintingMigration.test.js
git commit -m "feat: add printing persistence schema"
```

---

### Task 2: Define the single canonical `OrderPrintDocument`

**Files:** Create `shared/orderPrintDocument.js`, `shared/orderPrintDocument.test.js`.

**Produces:** `ORDER_PRINT_DOCUMENT_VERSION`, `ORDER_PRINT_THANK_YOU`, `createOrderPrintDocument`, `createTestPrintDocument`, `formatPrintMoneyCents`, `getFriendlyOrderNumber`.

- [ ] **Step 1: Write RED ticket-contract tests**

Use one fixture containing Entrega, customer contact, multiple items, notes, fee, discount, total and paid Pix. Assert:

```js
assert.equal(document.version, 1)
assert.equal(document.type, 'order')
assert.equal(document.order.number, '0184')
assert.equal(document.customer.phone, '(11) 99876-5432')
assert.equal(document.items[0].lineTotalCents, 6000)
assert.equal(document.financial.totalCents, 8750)
assert.deepEqual(document.payment, { status: 'Pago', method: 'Pix' })
assert.equal(document.message, 'Obrigado pela compra! Agradecemos a preferência.')
assert.equal(formatPrintMoneyCents(8750), 'R$ 87,50')
```

Also cover pending payment, Retirada/Local, blank optional contact fields and `createTestPrintDocument()`.

Run and expect RED:

```bash
node --test shared/orderPrintDocument.test.js
```

- [ ] **Step 2: Implement a JSON-safe cents-based contract**

The stable shape is:

```js
{
  version: 1,
  type: 'order',
  business: { name },
  order: { id, number, orderDate, createdAt, type, note: '' },
  customer: { name, phone, address },
  items: [{ name, presentation, quantity, note, unitPriceCents, lineTotalCents }],
  financial: {
    subtotalCents,
    deliveryFeeCents,
    adjustment: { type: 'none|discount|surcharge', amountCents, reason },
    totalCents,
  },
  payment: { status: 'Pago|Pendente', method },
  message: ORDER_PRINT_THANK_YOU,
}
```

`order.note` remains optional/empty until the order domain has an official order-level observation; item notes are already official and must print now. Do not invent a second source of truth only for printing.

- [ ] **Step 3: GREEN + commit**

```bash
node --test shared/orderPrintDocument.test.js
git add shared/orderPrintDocument.js shared/orderPrintDocument.test.js
git commit -m "feat: define canonical order print document"
```

---

### Task 3: Implement station/job repository semantics and current-document loading

**Files:** Create `worker/orderPrintingRepository.js`, `worker/orderPrintingRepository.test.js`, `worker/orderPrintDocumentRepository.js`, `worker/orderPrintDocumentRepository.test.js`.

**Produces:**

```text
listPrintStations
upsertPrintStation
setPrimaryPrintStation
touchPrintStation
loadPrimaryAutomaticPrintStation
listPrintJobs
loadPrintJob
loadAutomaticPrintJobForOrder
createManualOrderPrintJob
createTestPrintJob
prepareAutomaticPrintJobStatement
claimNextAutomaticPrintJob
claimPrintJob
markPrintJobPrinted
markPrintJobFailed
retryPrintJob
loadOrderPrintDocument
```

- [ ] **Step 1: Write RED tests for station invariants**

Cover upsert, 1/2 copies validation, business isolation, one primary, and auto-enabled lookup. Explicitly assert that making `station-b` primary clears `station-a`.

- [ ] **Step 2: Write RED tests for atomic claim and transitions**

Required cases:

- two calls to `claimNextAutomaticPrintJob()` cannot claim the same job;
- a secondary station cannot use automatic claim-next;
- `claimPrintJob()` claims one exact pending job only for an explicit/manual execution path;
- `markPrintJobPrinted()` only accepts the claiming station and `processing` state;
- known failure => `failed`;
- uncertain failure => `requires_attention`;
- `retryPrintJob()` preserves `id` and `snapshot_json`, clears claim/error timestamps, returns `pending`;
- 10-minute automatic pending and 2-minute processing jobs age to `requires_attention`;
- no query crosses `business_id`.

Run and expect RED:

```bash
node --test worker/orderPrintingRepository.test.js worker/orderPrintDocumentRepository.test.js
```

- [ ] **Step 3: Implement primary-station switching as one batch**

Validate the selected station belongs to the business, then:

```js
await db.batch([
  db.prepare('UPDATE print_stations SET is_primary = 0, updated_at = ? WHERE business_id = ? AND is_primary = 1')
    .bind(timestamp, businessId),
  db.prepare('UPDATE print_stations SET is_primary = 1, updated_at = ? WHERE id = ? AND business_id = ?')
    .bind(timestamp, stationId, businessId),
])
```

The partial unique index remains the final race-protection layer.

- [ ] **Step 4: Implement atomic claim-next in one SQL mutation**

Use a single statement rather than SELECT-then-UPDATE:

```sql
UPDATE print_jobs
SET status = 'processing', station_id = ?, processing_started_at = ?, processed_at = NULL,
    last_error_code = NULL, last_error_message = NULL
WHERE id = (
  SELECT id FROM print_jobs
  WHERE business_id = ? AND trigger = 'automatic' AND status = 'pending'
  ORDER BY created_at ASC LIMIT 1
)
AND business_id = ? AND status = 'pending'
RETURNING *;
```

Before claim/list, run centralized aging with:

```js
export const PRINT_PENDING_MAX_AGE_MS = 10 * 60 * 1000
export const PRINT_PROCESSING_MAX_AGE_MS = 2 * 60 * 1000
```

- [ ] **Step 5: Implement current document reconstruction**

`loadOrderPrintDocument(db, businessId, orderId)` reads raw D1 integer money columns plus items/payment/contact snapshots, then calls the shared builder. Legacy rows with blank new contact columns remain valid with blank phone/address; do not infer historical contact data.

- [ ] **Step 6: GREEN + commit**

```bash
node --test worker/orderPrintingRepository.test.js worker/orderPrintDocumentRepository.test.js shared/orderPrintDocument.test.js
git add worker/orderPrintingRepository.js worker/orderPrintingRepository.test.js worker/orderPrintDocumentRepository.js worker/orderPrintDocumentRepository.test.js
git commit -m "feat: add printing job repository"
```

---

### Task 4: Create the automatic print job in the same checkout transaction

**Files:** Modify `worker/repositories.js`, `worker/orderReadSql.js`, `worker/multiItemCheckoutRepository.test.js`; create `worker/orderAutomaticPrintJob.test.js`.

**Consumes:** Task 2 builder and Task 3 `loadPrimaryAutomaticPrintStation` + `prepareAutomaticPrintJobStatement`.

- [ ] **Step 1: Write RED cases**

Assert a paid delivery checkout with an auto-enabled primary station produces:

```js
assert.equal(order.clientPhone, '(11) 99876-5432')
assert.equal(order.clientAddress, 'Rua das Flores, 123')
assert.equal(db.printJobs.size, 1)
assert.equal(job.trigger, 'automatic')
assert.equal(job.status, 'pending')
assert.equal(job.copies_requested, 2)
assert.equal(JSON.parse(job.snapshot_json).payment.status, 'Pago')
```

Also prove no automatic job for: auto disabled, no primary station, historical/backdated order. Repeating the same checkout idempotency key must still leave one order and one auto job.

Run RED:

```bash
node --test worker/orderAutomaticPrintJob.test.js worker/multiItemCheckoutRepository.test.js
```

- [ ] **Step 2: Persist immutable customer contact snapshots**

Extend canonical order SELECT/map with:

```sql
o.client_phone_snapshot,
o.client_address_snapshot
```

Registered-client checkout must select `id, name, phone, address`; guest/table identities use empty contact snapshots. Add those two values to the existing `INSERT INTO orders`.

- [ ] **Step 3: Build and append the auto job to the existing `db.batch()`**

Only when `status === 'Em preparo'` and `loadPrimaryAutomaticPrintStation()` returns a primary+auto-enabled station, build the canonical document from the exact checkout inputs/server prices and append one `prepareAutomaticPrintJobStatement(...)` to the same batch as order/items/payment/movement.

The pending job has `station_id = NULL`; ownership begins only at claim.

- [ ] **Step 4: Update existing fake checkout DB parsers**

Adjust `worker/multiItemCheckoutRepository.test.js` for the new order INSERT arity and print job row. Its forced batch-failure test must assert that order, items, payment, movement **and print job** all roll back together.

- [ ] **Step 5: GREEN + commit**

```bash
node --test worker/orderAutomaticPrintJob.test.js worker/multiItemCheckoutRepository.test.js worker/orderReadRepository.test.js
git add worker/repositories.js worker/orderReadSql.js worker/multiItemCheckoutRepository.test.js worker/orderAutomaticPrintJob.test.js
git commit -m "feat: enqueue automatic order print jobs"
```

---

### Task 5: Expose authenticated printing APIs

**Files:** Modify `worker/index.js`, `src/api/client.js`, `src/api/client.test.js`; create `worker/orderPrintingHttp.test.js`.

**Routes:**

```text
GET  /api/printing/stations
PUT  /api/printing/stations/:id
POST /api/printing/stations/:id/make-primary
GET  /api/printing/jobs?orderId=<id>&limit=<n>
POST /api/orders/:id/print-jobs
POST /api/printing/test-jobs
POST /api/printing/jobs/claim-next
POST /api/printing/jobs/:id/claim
POST /api/printing/jobs/:id/complete
POST /api/printing/jobs/:id/fail
POST /api/printing/jobs/:id/retry
GET  /api/orders/:id/print-document
```

- [ ] **Step 1: Write HTTP RED tests using the existing authenticated-cookie pattern**

Use `worker/orderCancellationHttp.test.js` as the structural model. Cover authentication, same-origin mutation protection, business isolation, station update, primary switch, manual job creation, test job, automatic claim, exact claim, complete, known/uncertain fail, retry, job listing, and print-document read.

- [ ] **Step 2: Write API-client RED tests**

Require these exports:

```text
getPrintStations
upsertPrintStation
makePrimaryPrintStation
getPrintJobs
createManualPrintJob
createTestPrintJob
claimNextPrintJob
claimPrintJob
completePrintJob
failPrintJob
retryPrintJob
getOrderPrintDocument
```

Assert URL encoding and payloads in `src/api/client.test.js`.

Run RED:

```bash
node --test worker/orderPrintingHttp.test.js src/api/client.test.js
```

- [ ] **Step 3: Implement narrow route branches in `worker/index.js`**

All writes call `assertSameOriginMutation()`. Never accept `businessId` from request payload; always use `session.businessId`. Validate copies as 1|2, platform as `windows|android|other`, and invalid state transitions as 409.

Sanitize persisted error fields to short stable codes/messages; never store stack traces or arbitrary serialized exceptions.

- [ ] **Step 4: Make order creation return its auto-job summary explicitly**

After `createOrder()` returns, call:

```js
const printJob = await loadAutomaticPrintJobForOrder(env.DB, session.businessId, order.id)
```

Return `{ order, movement, tableTab, printJob }` where `printJob` may be `null`. This function name is part of the repository contract from Task 3.

- [ ] **Step 5: GREEN + commit**

```bash
node --test worker/orderPrintingHttp.test.js src/api/client.test.js worker/index.test.js
git add worker/index.js worker/orderPrintingHttp.test.js src/api/client.js src/api/client.test.js
git commit -m "feat: expose printing APIs"
```

---

### Task 6: Render deterministic MTP5 ESC/POS bytes

**Files:** Create `src/printing/mtp5Profile.js`, `src/printing/cp860.js`, `src/printing/escpos58mm.js`, `src/printing/escpos58mm.test.js`.

**Produces:** `MTP5_PROFILE`, `encodeCp860`, `wrapPrintText`, `renderEscPos58mm`.

- [ ] **Step 1: Write RED renderer/encoding tests**

```js
assert.equal(MTP5_PROFILE.dotsPerLine, 384)
assert.equal(MTP5_PROFILE.fontAColumns, 32)
assert.equal(MTP5_PROFILE.codePage, 3)
assert.deepEqual([...encodeCp860('João Ç')], [74, 111, 132, 111, 32, 128])
```

Verify CP860 fixtures for `ã`, `ç`, `é`, `ó`, `ê`, `Á`; unsupported Unicode such as emoji becomes `?`. Verify 1 and 2 copies, `CÓPIA 1/2`, `CÓPIA 2/2`, total, paid/pending, fee/adjustment, thank-you, long address/item note wrapping, and no logical normal-font line over 32 columns.

Run RED:

```bash
node --test src/printing/escpos58mm.test.js
```

- [ ] **Step 2: Define the isolated profile**

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

The baud rate is isolated because Web Serial requires one; physical acceptance may change the profile value without changing job/document logic.

- [ ] **Step 3: Implement named ESC/POS helpers**

Use helpers for initialization, alignment, bold, character size and code page. Render each physical copy independently. Only headings such as order number and total may use enlarged font; reset to normal before 32-column wrapping. End with line feeds, not a cut command.

- [ ] **Step 4: GREEN + commit**

```bash
node --test src/printing/escpos58mm.test.js shared/orderPrintDocument.test.js
git add src/printing/mtp5Profile.js src/printing/cp860.js src/printing/escpos58mm.js src/printing/escpos58mm.test.js
git commit -m "feat: render MTP5 ESC POS tickets"
```

---

### Task 7: Add local station identity and Web Serial transport

**Files:** Create `src/printing/localPrintStation.js`, `src/printing/localPrintStation.test.js`, `src/printing/webSerialTransport.js`, `src/printing/webSerialTransport.test.js`.

**Produces:**

```text
getOrCreateLocalPrintStationId(storage)
detectPrintPlatform(userAgent)
defaultPrintStationName(platform)
savePrinterFingerprint(storage, stationId, port)
findAuthorizedPrinterPort(serial, storage, stationId)
isWebSerialSupported(serial)
requestPrinterPort(serial)
probeSerialPort(port, serialOptions)
writeSerialBytes(port, bytes, serialOptions)
```

Stable error codes: `WEB_SERIAL_UNSUPPORTED`, `PRINTER_NOT_AUTHORIZED`, `SERIAL_OPEN_FAILED`, `SERIAL_WRITE_UNCERTAIN`.

- [ ] **Step 1: Write RED local identity/platform tests**

Assert stable UUID reuse, `Android` -> `android`, `Windows` -> `windows`, fallback -> `other`, deterministic default station names, fingerprint matching, one-port fallback and ambiguous multi-port => no automatic match.

- [ ] **Step 2: Write RED transport tests**

Cover unsupported browser, request-port success/cancel, successful `probeSerialPort()` open+close without writes, probe open failure, successful write, and mid-write failure => `SERIAL_WRITE_UNCERTAIN`.

Run RED:

```bash
node --test src/printing/localPrintStation.test.js src/printing/webSerialTransport.test.js
```

- [ ] **Step 3: Implement standard-SPP user selection**

```js
export const requestPrinterPort = async (serial = globalThis.navigator?.serial) => {
  if (!serial?.requestPort) throw printingError('WEB_SERIAL_UNSUPPORTED', 'Este navegador não oferece impressão Bluetooth compatível.')
  return serial.requestPort()
}
```

The MTP5 must already be paired in the OS. Persist only the station id and a JSON fingerprint derived from `port.getInfo()`; never serialize the `SerialPort` object.

- [ ] **Step 4: Implement explicit probe and one-shot write**

`probeSerialPort()` opens with `MTP5_PROFILE.serial` and closes without writing. `writeSerialBytes()` opens, gets one writer, sets `writeStarted = true` immediately before `writer.write(bytes)`, releases the lock, then closes. If an error occurs after `writeStarted`, throw `SERIAL_WRITE_UNCERTAIN`; before it, `SERIAL_OPEN_FAILED`. Never retry internally.

- [ ] **Step 5: GREEN + commit**

```bash
node --test src/printing/localPrintStation.test.js src/printing/webSerialTransport.test.js
git add src/printing/localPrintStation.js src/printing/localPrintStation.test.js src/printing/webSerialTransport.js src/printing/webSerialTransport.test.js
git commit -m "feat: add Web Serial printer transport"
```

---

### Task 8: Orchestrate exactly one claimed job

**Files:** Create `src/printing/printJobRunner.js`, `src/printing/printJobRunner.test.js`.

**Produces:** `runClaimedPrintJob({ job, stationId, port, completeJob, failJob, renderer, transport })`.

- [ ] **Step 1: Write RED one-shot tests**

Success must call renderer once, transport once, complete once. `SERIAL_OPEN_FAILED` calls `failJob(..., { uncertain:false })`; `SERIAL_WRITE_UNCERTAIN` calls `failJob(..., { uncertain:true })`. No branch invokes a timer or retries transport.

Run RED:

```bash
node --test src/printing/printJobRunner.test.js
```

- [ ] **Step 2: Implement minimum one-shot runner**

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

- [ ] **Step 3: GREEN + commit**

```bash
node --test src/printing/printJobRunner.test.js src/printing/escpos58mm.test.js src/printing/webSerialTransport.test.js
git add src/printing/printJobRunner.js src/printing/printJobRunner.test.js
git commit -m "feat: orchestrate print job execution"
```

---

### Task 9: Mount one printing manager and consume automatic jobs safely

**Files:** Create `src/printing/usePrintingManager.js`, `src/printing/printingManagerRegression.test.js`; modify `src/App.jsx`.

**Produces manager surface:**

```js
{
  supported,
  localStation,
  stations,
  jobs,
  latestJobByOrderId,
  printerState,
  printerBlocked,
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

- [ ] **Step 1: Write RED regression tests**

Require the hook to use print-job APIs and `runClaimedPrintJob`, but never `getNewActiveOrderIds`. Require App to mount the hook exactly once and pass `printing={printing}` to `Orders`. Existing order highlight/sound continues independently.

Run RED:

```bash
node --test src/printing/printingManagerRegression.test.js
```

- [ ] **Step 2: Implement station registration/state refresh**

Named intervals:

```js
const PRINT_JOB_POLL_MS = 2_000
const PRINT_STATE_POLL_MS = 5_000
const STATION_HEARTBEAT_MS = 15_000
```

On authentication: generate/reuse local station id, detect platform/name, upsert the station, refresh stations/jobs, then locate an authorized local port. When idle, probe that port once to establish `printerState = 'connected'|'disconnected'`; no probe may overlap a print.

Refresh server station/job state every 5 seconds while visible, on focus, and after print mutations. Heartbeat every 15 seconds.

- [ ] **Step 3: Implement the automatic claim loop**

Every 2 seconds while visible/online/authenticated, call `claimNextPrintJob(localStation.id)` **only if**:

- server says local station is primary;
- `autoPrintEnabled === true`;
- no job is in flight;
- `printerBlocked === false`;
- an already-authorized local port is resolved.

Never call `requestPort()` from this loop.

If the authorized port disappears before/after claim or opening fails, persist the claimed job as known failure, set `printerBlocked = true`, show one alert, and stop claiming subsequent jobs. Only successful `connectPrinter()` + probe or successful `testPrint()` clears this block.

- [ ] **Step 4: Implement user-gesture manual actions**

- `connectPrinter()` -> `requestPort()` -> save fingerprint -> `probeSerialPort()` -> update state/block.
- `printOrder(orderId,copies)` -> create new manual job -> exact claim -> one-shot runner.
- `retryJob(jobId)` -> backend retry same snapshot -> exact claim -> one-shot runner.
- `testPrint()` -> create persisted test job -> exact claim -> one-shot runner.
- `getPreviewDocument(orderId)` -> current canonical document API.

Manual explicit actions may exact-claim their own pending jobs on a non-primary station; only automatic `claim-next` is restricted to the primary station.

- [ ] **Step 5: Wire App without moving order ownership**

Do not add print jobs to existing `DATA_COLLECTIONS`. Do not change the 2-second `/api/orders` polling to enqueue or trigger printing.

- [ ] **Step 6: GREEN + commit**

```bash
node --test src/printing/printingManagerRegression.test.js src/realtimeSyncRegression.test.js src/orderRealtime.test.js
git add src/printing/usePrintingManager.js src/printing/printingManagerRegression.test.js src/App.jsx
git commit -m "feat: consume automatic print jobs"
```

---

### Task 10: Generate the digital PDF from the same canonical document

**Files:** Modify `package.json`, `package-lock.json`; create `src/printing/pdfOrderRenderer.js`, `src/printing/pdfOrderRenderer.test.js`.

- [ ] **Step 1: Write RED PDF tests before installing the dependency**

Assert `%PDF-` signature, stable `pedido-0184.pdf` filename, and via injected jsPDF factory that business name, order number, items/notes, `TOTAL`, payment and thank-you are written.

Run RED:

```bash
node --test src/printing/pdfOrderRenderer.test.js
```

- [ ] **Step 2: Install the pinned current version**

```bash
npm install jspdf@4.2.1 --save
```

- [ ] **Step 3: Implement a text-native A5 renderer**

Use:

```js
new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })
```

Render the same semantic content/order as the thermal ticket with `splitTextToSize()` and page breaks. Do not render physical `CÓPIA n/N` labels in the PDF.

Provide:

```js
getOrderPdfFilename(document) => `pedido-${document.order.number}.pdf`
renderOrderPdf(document) => ArrayBuffer
downloadOrderPdf(document, deps)
```

The download helper must `createObjectURL`, click an `<a download>`, and always `revokeObjectURL`.

- [ ] **Step 4: GREEN + immediate browser build**

```bash
node --test src/printing/pdfOrderRenderer.test.js
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/printing/pdfOrderRenderer.js src/printing/pdfOrderRenderer.test.js
git commit -m "feat: generate digital order PDFs"
```

---

### Task 11: Add printing settings, connection test, and mobile-safe UX

**Files:** Create `src/components/PrintingSettings.jsx`, `src/components/PrintingSettings.test.js`, `src/printing/printing.css`; modify `src/pages/Orders.jsx`, `src/App.jsx`.

- [ ] **Step 1: Write RED UI-contract tests**

Require: `Impressão` action in Orders header, `Conectar/Trocar impressora`, `Testar impressão`, station name/platform, primary status, automatic toggle, 1/2 copies, browser compatibility message, and primary-station confirmation.

Run RED:

```bash
node --test src/components/PrintingSettings.test.js
```

- [ ] **Step 2: Implement honest connection states**

The UI has four external states:

- `Conectada`: an authorized port has successfully completed a current-session probe or print;
- `Desconectada`: a configured/authorized printer exists but probe/open failed;
- `Não configurada`: no selected/authorized printer can be matched;
- `Navegador incompatível`: Web Serial unavailable.

Finding a port in `getPorts()` alone is not enough to label it connected; use the probe from Task 7.

- [ ] **Step 3: Implement settings actions**

- Connect/Trocar -> `printing.connectPrinter()` from direct click.
- Testar -> `printing.testPrint()` through real persisted test job/renderer/transport.
- 1/2 copies and auto toggle -> `printing.saveStationSettings()`.
- Make primary -> existing `ConfirmationDialog` with clear text that this device becomes the only automatic printer.

- [ ] **Step 4: Mobile-safe CSS**

At 320–480 px, stack controls/actions, no fixed width wider than viewport, keep modal scrollable and buttons touch-friendly. Reuse current modal primitives rather than inventing a second overlay system.

- [ ] **Step 5: GREEN + commit**

```bash
node --test src/components/PrintingSettings.test.js src/mobileOverlayRegression.test.js src/pages/Orders*.test.js
git add src/components/PrintingSettings.jsx src/components/PrintingSettings.test.js src/printing/printing.css src/pages/Orders.jsx src/App.jsx
git commit -m "feat: add printing station settings"
```

---

### Task 12: Add order print status, preview, PDF, print/reprint, and retry actions

**Files:** Create `src/components/PrintStatusBadge.jsx`, `src/components/OrderTicketPreview.jsx`, `src/components/OrderTicketPreview.test.js`, `src/printing/printingUi.test.js`; modify `src/pages/Orders.jsx`, `src/components/OrderDetail.jsx`, `src/App.jsx`, `src/printing/printing.css`.

- [ ] **Step 1: Write RED preview/status/action tests**

Preview must consume only `document.*`, not rebuild from raw `order` fields. Require friendly states:

```text
Pendente de impressão
Imprimindo
Impresso
Falha na impressão
Requer atenção
```

Require actions `Visualizar ticket`, `Gerar PDF`, `Imprimir pedido`/`Reimprimir`, and `Tentar novamente`/`Imprimir agora` when appropriate.

Run RED:

```bash
node --test src/components/OrderTicketPreview.test.js src/printing/printingUi.test.js
```

- [ ] **Step 2: Add compact status to kitchen cards**

Use `printing.latestJobByOrderId`. No job means no badge and is a valid state when auto-print was disabled at creation.

- [ ] **Step 3: Add a dedicated `Impressão do pedido` section in `OrderDetail`**

- Preview -> fetch current canonical document and open `OrderTicketPreview`.
- PDF -> fetch the same current document and call `downloadOrderPdf()`.
- First manual print -> new manual job.
- Reprint after a successful prior print -> require confirmation before creating the new manual job.
- Failed -> `Tentar novamente` same job/snapshot.
- Attention -> `Imprimir agora` same job/snapshot after explicit user action.

Do not mix these buttons into status/finalization/cancellation semantics.

- [ ] **Step 4: Confirm reprints using actual copy count**

Example copy:

```text
Este pedido já foi impresso. Deseja imprimir mais 2 cópias?
```

A retry of the same failed/attention job does not need a second confirmation; pressing the explicit intervention button is the confirmation.

- [ ] **Step 5: Show sanitized diagnostics only**

Display persisted `lastError.message`, last attempt/processed time and station when available. Never render browser exceptions/stacks.

- [ ] **Step 6: GREEN + commit**

```bash
node --test src/components/OrderTicketPreview.test.js src/printing/printingUi.test.js src/pages/Orders*.test.js src/pages/OrderHistory.test.js
git add src/components/PrintStatusBadge.jsx src/components/OrderTicketPreview.jsx src/components/OrderTicketPreview.test.js src/printing/printingUi.test.js src/pages/Orders.jsx src/components/OrderDetail.jsx src/App.jsx src/printing/printing.css
git commit -m "feat: add order printing actions and status"
```

---

### Task 13: Harden duplicate prevention and uncertain-outcome regressions

**Files:** Modify `src/printing/printingManagerRegression.test.js`, `worker/orderAutomaticPrintJob.test.js`, `worker/orderPrintingRepository.test.js`, `src/printing/printingUi.test.js` and only production files required by failing regressions.

- [ ] **Step 1: Add RED regressions for reload/sync**

Assert no print side effect is reachable from the `detectedIds`/`getNewActiveOrderIds` sound-highlight path. Repeat the same order idempotency key after its auto job exists and prove one auto job. Enable auto after an order created with it off and prove no backfill.

- [ ] **Step 2: Add RED regressions for uncertainty**

Simulate a job claimed at `20:00:00`, no callback, maintenance at `20:02:01`; it must become `requires_attention`, disappear from automatic claim-next, and require explicit `retryPrintJob()` before exact claim.

Simulate a disconnected primary printer: after the first known serial failure, `printerBlocked` prevents claim-next for subsequent jobs until successful connect/test.

- [ ] **Step 3: Run focused suite and make only minimal corrections**

```bash
node --test src/printing/printingManagerRegression.test.js worker/orderAutomaticPrintJob.test.js worker/orderPrintingRepository.test.js src/printing/printingUi.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/printing/printingManagerRegression.test.js worker/orderAutomaticPrintJob.test.js worker/orderPrintingRepository.test.js src/printing/printingUi.test.js src/App.jsx src/printing/usePrintingManager.js worker/orderPrintingRepository.js
git commit -m "test: harden printing duplicate protection"
```

Only stage production files if a RED regression required a real fix.

---

### Task 14: Document setup, verify software, and prepare physical acceptance

**Files:** Create `docs/order-printing-mtp5-acceptance.md`; modify `README.md`.

- [ ] **Step 1: Create the hardware acceptance checklist**

Required sections:

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

Each functional item gets `[ ] PASS  [ ] FAIL` plus notes. State explicitly that green software checks are not the same as physical product acceptance.

- [ ] **Step 2: Update README operator setup**

Document: pair MTP5 in OS -> current Chrome -> `Pedidos > Impressão` -> `Conectar impressora` -> `Testar impressão` -> make kitchen device primary -> enable automatic printing -> choose 1/2 copies.

Document limitations: no Safari/Firefox guarantee, no auto retry loop, no WhatsApp sending, no automatic secondary-station failover.

- [ ] **Step 3: Run complete software verification**

```bash
npm test
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npm run d1:migrate:local
```

Expected: all commands exit 0; the local migration command reports the schema current/applied without touching remote D1.

- [ ] **Step 4: Commit docs**

```bash
git add README.md docs/order-printing-mtp5-acceptance.md
git commit -m "docs: add MTP5 printing setup and acceptance"
```

---

## Manual Hardware Acceptance Gate

After software tasks are green, execute `docs/order-printing-mtp5-acceptance.md` with the real Goldensky MTP5.

Hardware-specific corrections are allowed only behind the printing abstraction (`mtp5Profile.js`, `cp860.js`, ESC/POS command details, Web Serial transport details). Do not silently change ticket business rules.

Required physical outcomes:

1. Windows Chrome prints 1 and 2 copies.
2. Android Chrome 138+ prints 1 and 2 copies via Bluetooth RFCOMM/SPP.
3. `João`, `Observação`, `Acréscimo`, `preferência`, `ç`, `ã`, `é` print legibly.
4. Long customer/address/item-note text wraps without silent truncation.
5. `TOTAL` and order number have readable emphasis.
6. No cut command emits garbage.
7. Powered-off/disconnected printer produces one visible failed job and blocks further automatic claims until operator action.
8. A mid-write uncertain outcome does not auto-print again.
9. Reprint creates a distinct history entry and is confirmed first.
10. Preview/PDF contain the same customer-safe information and values as the physical ticket.

If either platform cannot communicate with this exact MTP5 despite browser RFCOMM support, stop before adding a native wrapper/local agent. Record the hardware/Chrome behavior and return to brainstorming for the smallest fallback transport; those fallbacks remain outside this V1 plan.
