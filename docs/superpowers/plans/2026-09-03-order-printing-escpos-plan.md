# Order Printing ESC/POS Implementation Plan

> **SUPERSEDED (2026-09-08):** Documento histórico substituído pela arquitetura QZ centralizada. Consulte `docs/superpowers/specs/2026-09-08-centralized-qz-print-queue-design.md` e `docs/superpowers/plans/2026-09-08-centralized-qz-print-queue-plan.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable 58 mm ESC/POS order printing to Gestão Delivery with one canonical customer-safe ticket, automatic/manual print jobs, one primary print station, Chrome Web Serial support on Windows and Android, HTML preview, and downloadable PDF.

**Architecture:** Order creation remains authoritative in the Cloudflare Worker/D1 backend. Station configuration and immutable print jobs are central; Bluetooth/Web Serial permission stays local to each browser/device. The Worker creates one canonical `OrderPrintDocument`; the frontend renders that document to ESC/POS, HTML preview, and PDF. One printing manager mounted in `App.jsx` polls/claims official jobs and never infers print work from “new order” array detection.

**Tech Stack:** React 19.2.8, Vite 8.2.2, Node 22 (`node --test`), Cloudflare Worker, D1/SQLite, Wrangler 4.128.0, Chrome Web Serial, ESC/POS, jsPDF 4.2.1, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-03-order-printing-escpos-design.md`

## Global Constraints

- Strict TDD for every behavior change: RED test first, verify intended failure, minimum implementation, GREEN, then safe refactor.
- Initial hardware profile: Goldensky MTP5, 58 mm paper, 48 mm printable width, 384 dots/line, 203 DPI, ESC/POS, Bluetooth Classic SPP/RFCOMM.
- Chrome desktop target: 117+. Chrome Android target: 138+. Deployed Web Serial requires HTTPS.
- Standard SPP devices are available through normal `navigator.serial.requestPort()` after OS pairing. Do not treat the standard SPP UUID as a custom service unless physical testing proves this MTP5 firmware behaves differently.
- First printer selection requires a user gesture. Automatic printing may reuse only an already-authorized port from `navigator.serial.getPorts()`.
- One logical Ticket Oficial powers kitchen, package, preview and PDF. It contains values, payment status/method when available, item observations, and `Obrigado pela compra! Agradecemos a preferência.`
- Physical copies are identical. Supported count is 1 or 2; default is 2.
- At most one primary print station per business. Only it may claim automatic jobs.
- A newly created current operational order gets at most one automatic job when the primary station has auto-print enabled **at creation time**. Historical/backdated orders do not auto-print.
- Enabling auto-print later never backfills old orders. Reload, polling, focus, visibility and cross-device sync never create jobs.
- Reprint = new manual job + new snapshot + confirmation. Retry = same job id + same immutable snapshot.
- No automatic retry loop after failure.
- Automatic `pending` > 10 min becomes `requires_attention`. `processing` > 2 min becomes `requires_attention` because physical outcome is uncertain.
- `printed` means serial write completed without reported error, not guaranteed paper output.
- Failure before write starts => `failed`. Failure after write begins => `requires_attention`.
- After `PRINTER_NOT_AUTHORIZED` or `SERIAL_OPEN_FAILED`, stop claiming additional automatic jobs locally until an explicit successful connect/test clears the block.
- Never persist pairing PINs, browser permission objects, session cookies/tokens or raw exception stacks.
- MTP5 hardware constants live only in its profile. Font A is 12 dots/character => 32 normal-text columns at 384 dots.
- Initial Portuguese code-page assumption: CP860 / `ESC t 3`; physical acceptance is authoritative and any correction stays behind profile/encoder boundaries.
- No cut command in V1.
- PDF is included. Automatic WhatsApp delivery is out of scope.
- No native Android wrapper, print agent, multi-printer routing, fiscal output, kitchen-sector routing or automatic secondary-station failover in V1.
- Production deploy and remote D1 migration require separate explicit user authorization.
- Software exit gate: `npm test`, `npm run lint`, `npm run build`, `npx --yes wrangler@4.128.0 deploy --dry-run`.
- Product acceptance additionally requires the real MTP5 on Chrome/Windows and Chrome Android 138+.

## File Structure

**Create**
- `migrations/0009_order_printing.sql`
- `worker/orderPrintingMigration.test.js`
- `shared/orderPrintDocument.js`
- `shared/orderPrintDocument.test.js`
- `worker/orderPrintDocumentRepository.js`
- `worker/orderPrintDocumentRepository.test.js`
- `worker/orderPrintingRepository.js`
- `worker/orderPrintingRepository.test.js`
- `worker/orderPrintingHttp.test.js`
- `worker/orderAutomaticPrintJob.test.js`
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

**Modify**
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

### Task 1: Add D1 persistence for order contact snapshots, stations and jobs

**Files:** Create `migrations/0009_order_printing.sql`, `worker/orderPrintingMigration.test.js`.

- [ ] **RED:** assert the migration adds `orders.client_phone_snapshot`, `orders.client_address_snapshot`, `print_stations`, `print_jobs`, a partial unique index for one primary station, and a partial unique index for one automatic order job.

```bash
node --test worker/orderPrintingMigration.test.js
```

Expected: FAIL because migration does not exist.

- [ ] **Implement:** use this contract:

```sql
ALTER TABLE orders ADD COLUMN client_phone_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN client_address_snapshot TEXT NOT NULL DEFAULT '';

CREATE TABLE print_stations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('windows', 'android', 'other')),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  auto_print_enabled INTEGER NOT NULL DEFAULT 0 CHECK (auto_print_enabled IN (0,1)),
  default_copies INTEGER NOT NULL DEFAULT 2 CHECK (default_copies IN (1,2)),
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX print_stations_one_primary_idx
  ON print_stations (business_id) WHERE is_primary = 1;

CREATE TABLE print_jobs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order','test')),
  trigger TEXT NOT NULL CHECK (trigger IN ('automatic','manual')),
  status TEXT NOT NULL CHECK (status IN ('pending','processing','printed','failed','requires_attention')),
  copies_requested INTEGER NOT NULL CHECK (copies_requested IN (1,2)),
  copies_printed INTEGER NOT NULL DEFAULT 0 CHECK (copies_printed BETWEEN 0 AND 2),
  station_id TEXT REFERENCES print_stations(id) ON DELETE SET NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  processing_started_at TEXT,
  processed_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  CHECK ((type='order' AND order_id IS NOT NULL) OR (type='test' AND order_id IS NULL))
);
CREATE INDEX print_jobs_pending_idx ON print_jobs (business_id,status,trigger,created_at);
CREATE INDEX print_jobs_order_history_idx ON print_jobs (business_id,order_id,created_at DESC);
CREATE UNIQUE INDEX print_jobs_one_auto_order_idx ON print_jobs (business_id,order_id)
  WHERE type='order' AND trigger='automatic';
```

- [ ] **GREEN:**

```bash
node --test worker/orderPrintingMigration.test.js
npm run d1:migrate:local
```

- [ ] **Commit:** `feat: add printing persistence schema`.

---

### Task 2: Define the canonical `OrderPrintDocument`

**Files:** Create `shared/orderPrintDocument.js`, `shared/orderPrintDocument.test.js`.

**Public interface:** `ORDER_PRINT_DOCUMENT_VERSION`, `ORDER_PRINT_THANK_YOU`, `createOrderPrintDocument`, `createTestPrintDocument`, `formatPrintMoneyCents`, `getFriendlyOrderNumber`.

- [ ] **RED:** fixture with Entrega, customer contact, multiple items/notes, fee, adjustment, total and paid Pix. Assert version, friendly order number, cents, line totals, payment and exact thank-you message. Cover pending payment, Retirada, Local and blank optional contact.

```bash
node --test shared/orderPrintDocument.test.js
```

- [ ] **Implement:** stable JSON-safe shape:

```js
{
  version: 1,
  type: 'order',
  business: { name },
  order: { id, number, orderDate, createdAt, type, note: '' },
  customer: { name, phone, address },
  items: [{ name, presentation, quantity, note, unitPriceCents, lineTotalCents }],
  financial: { subtotalCents, deliveryFeeCents, adjustment: { type, amountCents, reason }, totalCents },
  payment: { status: 'Pago|Pendente', method },
  message: 'Obrigado pela compra! Agradecemos a preferência.',
}
```

`order.note` remains empty until the order domain has an official order-level observation field; current item notes are printed now. Do not create a print-only second source of truth.

- [ ] **GREEN + Commit:**

```bash
node --test shared/orderPrintDocument.test.js
git add shared/orderPrintDocument.js shared/orderPrintDocument.test.js
git commit -m "feat: define canonical order print document"
```

---

### Task 3: Implement station/job repository semantics and current-document loading

**Files:** Create `worker/orderPrintingRepository.js/.test.js`, `worker/orderPrintDocumentRepository.js/.test.js`.

**Required functions:**

```text
listPrintStations, upsertPrintStation, setPrimaryPrintStation, touchPrintStation,
loadPrimaryAutomaticPrintStation,
listPrintJobs, loadPrintJob, loadAutomaticPrintJobForOrder,
createManualOrderPrintJob, createTestPrintJob, prepareAutomaticPrintJobStatement,
claimNextAutomaticPrintJob, claimPrintJob,
markPrintJobPrinted, markPrintJobFailed, retryPrintJob,
loadOrderPrintDocument
```

- [ ] **RED:** prove one primary, station business isolation, copies validation, primary+auto lookup, atomic exclusive claim, secondary cannot claim-next, exact manual claim, valid state transitions, known vs uncertain failure, retry preserves id/snapshot, 10-minute pending aging, 2-minute processing aging.

```bash
node --test worker/orderPrintingRepository.test.js worker/orderPrintDocumentRepository.test.js
```

- [ ] **Implement primary switch:** verify station belongs to business, then one D1 batch clears old primary and sets selected primary. Database partial unique index remains race protection.

- [ ] **Implement atomic claim-next:** one mutation, not SELECT-then-UPDATE:

```sql
UPDATE print_jobs
SET status='processing', station_id=?, processing_started_at=?, processed_at=NULL,
    last_error_code=NULL, last_error_message=NULL
WHERE id=(
  SELECT id FROM print_jobs
  WHERE business_id=? AND trigger='automatic' AND status='pending'
  ORDER BY created_at ASC LIMIT 1
)
AND business_id=? AND status='pending'
RETURNING *;
```

Central constants:

```js
export const PRINT_PENDING_MAX_AGE_MS = 10 * 60 * 1000
export const PRINT_PROCESSING_MAX_AGE_MS = 2 * 60 * 1000
```

- [ ] **Implement `loadOrderPrintDocument`:** read raw D1 integer money values + canonical items/payment/contact snapshots and call Task 2 builder. Legacy blank contact snapshots stay blank.

- [ ] **GREEN + Commit:**

```bash
node --test worker/orderPrintingRepository.test.js worker/orderPrintDocumentRepository.test.js shared/orderPrintDocument.test.js
git add worker/orderPrintingRepository.js worker/orderPrintingRepository.test.js worker/orderPrintDocumentRepository.js worker/orderPrintDocumentRepository.test.js
git commit -m "feat: add printing job repository"
```

---

### Task 4: Create an automatic job atomically with checkout

**Files:** Modify `worker/repositories.js`, `worker/orderReadSql.js`, `worker/multiItemCheckoutRepository.test.js`; create `worker/orderAutomaticPrintJob.test.js`.

- [ ] **RED:** paid current Entrega + primary auto station creates exactly one pending automatic job with configured copies and paid snapshot. No job for auto-off, no-primary or historical order. Same idempotency key still yields one order/one auto job.

```bash
node --test worker/orderAutomaticPrintJob.test.js worker/multiItemCheckoutRepository.test.js
```

- [ ] **Persist contact snapshots:** registered-client checkout selects `id,name,phone,address`; write phone/address next to `client_name_snapshot`; guest/table use blanks. Add both fields to canonical order SELECT/map.

- [ ] **Append job to existing checkout `db.batch()`:** current code already computes `historical`, `status`, server prices and totals. Only when `status === 'Em preparo'` and `loadPrimaryAutomaticPrintStation()` returns a primary+auto station, build the canonical document and append `prepareAutomaticPrintJobStatement(...)` to the same batch. Pending job has `station_id=NULL` until claim.

- [ ] **Update existing fake DB:** adjust INSERT arity and prove forced checkout batch failure rolls back order/items/payment/movement/print job together.

- [ ] **GREEN + Commit:**

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

- [ ] **RED HTTP tests:** reuse authenticated login-cookie pattern from `worker/orderCancellationHttp.test.js`; cover auth, same-origin writes, isolation, station update/primary switch, manual/test jobs, claim-next, exact claim, complete, known/uncertain fail, retry, listing and print-document read.

- [ ] **RED client tests:** require exports `getPrintStations`, `upsertPrintStation`, `makePrimaryPrintStation`, `getPrintJobs`, `createManualPrintJob`, `createTestPrintJob`, `claimNextPrintJob`, `claimPrintJob`, `completePrintJob`, `failPrintJob`, `retryPrintJob`, `getOrderPrintDocument`; assert encoded routes and payloads.

```bash
node --test worker/orderPrintingHttp.test.js src/api/client.test.js
```

- [ ] **Implement:** every write calls `assertSameOriginMutation()`. Always scope by `session.businessId`; never accept business id from body. Validate copies 1|2, platform `windows|android|other`, invalid transitions => 409. Persist only sanitized error code/message.

- [ ] **Order-create response:** after `createOrder()`, call:

```js
const printJob = await loadAutomaticPrintJobForOrder(env.DB, session.businessId, order.id)
```

Return `{ order, movement, tableTab, printJob }`; `printJob` may be null.

- [ ] **GREEN + Commit:**

```bash
node --test worker/orderPrintingHttp.test.js src/api/client.test.js worker/index.test.js
git add worker/index.js worker/orderPrintingHttp.test.js src/api/client.js src/api/client.test.js
git commit -m "feat: expose printing APIs"
```

---

### Task 6: Render deterministic 58 mm ESC/POS for MTP5

**Files:** Create `src/printing/mtp5Profile.js`, `cp860.js`, `escpos58mm.js`, `escpos58mm.test.js`.

- [ ] **RED:** assert profile `384` dots, `32` Font-A columns, code page `3`, CP860 fixture `João Ç -> [74,111,132,111,32,128]`; cover `ã ç é ó ê Á`, unsupported Unicode -> `?`, 1/2 copies, copy labels, long wrapping, Entrega/Retirada/Local, fee/adjustment, paid/pending, total and thank-you.

```bash
node --test src/printing/escpos58mm.test.js
```

- [ ] **Profile:**

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

Baud rate is isolated because Web Serial requires one; physical acceptance may change profile only.

- [ ] **Renderer:** named helpers for `ESC @`, code page, align, bold, size. Each copy renders independently and receives `CÓPIA n/N`. Enlarged font only for short order/total headings; reset before normal 32-column text. No cut command.

- [ ] **GREEN + Commit:**

```bash
node --test src/printing/escpos58mm.test.js shared/orderPrintDocument.test.js
git add src/printing/mtp5Profile.js src/printing/cp860.js src/printing/escpos58mm.js src/printing/escpos58mm.test.js
git commit -m "feat: render MTP5 ESC POS tickets"
```

---

### Task 7: Add local station identity and Web Serial transport

**Files:** Create `src/printing/localPrintStation.js/.test.js`, `webSerialTransport.js/.test.js`.

**Public functions:**

```text
getOrCreateLocalPrintStationId(storage)
detectPrintPlatform(userAgent)
defaultPrintStationName(platform)
savePrinterFingerprint(storage,stationId,port)
findAuthorizedPrinterPort(serial,storage,stationId)
isWebSerialSupported(serial)
requestPrinterPort(serial)
probeSerialPort(port,serialOptions)
writeSerialBytes(port,bytes,serialOptions)
```

Stable errors: `WEB_SERIAL_UNSUPPORTED`, `PRINTER_NOT_AUTHORIZED`, `SERIAL_OPEN_FAILED`, `SERIAL_WRITE_UNCERTAIN`.

- [ ] **RED local tests:** stable station id, Android/Windows/other detection, deterministic default names, fingerprint matching, single authorized-port fallback, ambiguous multiple ports => no automatic match.

- [ ] **RED serial tests:** unsupported browser, request success/cancel, probe open+close with zero writes, probe failure, successful write, mid-write rejection => uncertain.

```bash
node --test src/printing/localPrintStation.test.js src/printing/webSerialTransport.test.js
```

- [ ] **Implement standard SPP selection:** MTP5 is paired in OS; direct click calls `navigator.serial.requestPort()` without custom-service filtering. Save only JSON fingerprint from `port.getInfo()` plus local station id; never persist `SerialPort` object.

- [ ] **Implement probe/write:** probe = open+close only. Write = open -> one writer -> set `writeStarted=true` immediately before `writer.write(bytes)` -> release -> close. Error after write start => `SERIAL_WRITE_UNCERTAIN`; before => `SERIAL_OPEN_FAILED`. No retries.

- [ ] **GREEN + Commit:**

```bash
node --test src/printing/localPrintStation.test.js src/printing/webSerialTransport.test.js
git add src/printing/localPrintStation.js src/printing/localPrintStation.test.js src/printing/webSerialTransport.js src/printing/webSerialTransport.test.js
git commit -m "feat: add Web Serial printer transport"
```

---

### Task 8: Orchestrate one claimed job with no hidden retry

**Files:** Create `src/printing/printJobRunner.js/.test.js`.

- [ ] **RED:** renderer once, transport once, complete once on success. Known open failure calls fail with `uncertain:false`; mid-write calls fail with `uncertain:true`. No timers/retry invocation.

```bash
node --test src/printing/printJobRunner.test.js
```

- [ ] **Implement:**

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

- [ ] **GREEN + Commit:**

```bash
node --test src/printing/printJobRunner.test.js src/printing/escpos58mm.test.js src/printing/webSerialTransport.test.js
git add src/printing/printJobRunner.js src/printing/printJobRunner.test.js
git commit -m "feat: orchestrate print job execution"
```

---

### Task 9: Mount one printing manager and consume automatic jobs safely

**Files:** Create `src/printing/usePrintingManager.js`, `src/printing/printingManagerRegression.test.js`; modify `src/App.jsx`.

**Manager surface:** `supported`, `localStation`, `stations`, `jobs`, `latestJobByOrderId`, `printerState`, `printerBlocked`, `busyJobId`, `refresh`, `connectPrinter`, `saveStationSettings`, `makePrimary`, `testPrint`, `printOrder`, `retryJob`, `getPreviewDocument`.

- [ ] **RED regression:** manager uses job APIs/runner but never `getNewActiveOrderIds`; App mounts one hook and passes `printing={printing}` to Orders. Existing sound/highlight remains separate.

```bash
node --test src/printing/printingManagerRegression.test.js
```

- [ ] **Station lifecycle:** use constants `PRINT_JOB_POLL_MS=2000`, `PRINT_STATE_POLL_MS=5000`, `STATION_HEARTBEAT_MS=15000`. On authentication generate/reuse station id, detect platform/name, upsert station, refresh server state, resolve an authorized port and—when no print is active—probe once to set honest connected/disconnected state. Server state refreshes every 5s while visible and on focus; heartbeat every 15s.

- [ ] **Automatic claim loop:** every 2s only when authenticated/online/visible, local station is server primary, auto enabled, no job in flight, `printerBlocked=false`, and an authorized port is resolved. Never call `requestPort()` here.

If the port disappears or open fails around a claimed job, mark that job failed, set `printerBlocked=true`, alert once, and stop claiming more. A successful explicit connect+probe or test print clears the block.

- [ ] **Manual methods:** `connectPrinter` = requestPort+fingerprint+probe; `printOrder` = new manual job+exact claim+one-shot runner; `retryJob` = same job/snapshot+exact claim+runner; `testPrint` = persisted test job+exact claim+runner; `getPreviewDocument` = current-document API. Explicit exact claims may run on non-primary stations; only claim-next is primary-only.

- [ ] **App wiring:** do not add jobs to existing `DATA_COLLECTIONS`; do not change the 2-second `/api/orders` polling into a print trigger.

- [ ] **GREEN + Commit:**

```bash
node --test src/printing/printingManagerRegression.test.js src/realtimeSyncRegression.test.js src/utils/dataSync.test.js
git add src/printing/usePrintingManager.js src/printing/printingManagerRegression.test.js src/App.jsx
git commit -m "feat: consume automatic print jobs"
```

---

### Task 10: Generate the digital PDF from the same document

**Files:** Modify `package.json`, `package-lock.json`; create `src/printing/pdfOrderRenderer.js/.test.js`.

- [ ] **RED:** assert PDF `%PDF-` signature, `pedido-0184.pdf` filename, and via injected jsPDF factory that business, order number, items/notes, total, payment and thank-you are written.

```bash
node --test src/printing/pdfOrderRenderer.test.js
```

- [ ] **Install pinned current version:**

```bash
npm install jspdf@4.2.1 --save
```

- [ ] **Implement text-native A5:** `new jsPDF({orientation:'portrait',unit:'mm',format:'a5'})`, wrapped text/page breaks, same semantic content as thermal document. No physical `CÓPIA n/N` label in PDF.

Provide `getOrderPdfFilename`, `renderOrderPdf(document): ArrayBuffer`, `downloadOrderPdf`. Download helper must create URL, click `<a download>`, then revoke URL.

- [ ] **GREEN + build + Commit:**

```bash
node --test src/printing/pdfOrderRenderer.test.js
npm run build
git add package.json package-lock.json src/printing/pdfOrderRenderer.js src/printing/pdfOrderRenderer.test.js
git commit -m "feat: generate digital order PDFs"
```

---

### Task 11: Add printing settings and connection-test UX

**Files:** Create `src/components/PrintingSettings.jsx/.test.js`, `src/printing/printing.css`; modify `src/pages/Orders.jsx`, `src/App.jsx`.

- [ ] **RED:** require Orders-header `Impressão` action; Connect/Trocar, Testar, station/platform, primary state, auto toggle, 1/2 copies, compatibility text and primary confirmation.

```bash
node --test src/components/PrintingSettings.test.js
```

- [ ] **Honest external states:**
  - `Conectada` = authorized port completed a current-session probe or print;
  - `Desconectada` = configured/authorized printer exists but probe/open failed;
  - `Não configurada` = no selected/authorized printer match;
  - `Navegador incompatível` = no Web Serial.

Finding a port in `getPorts()` alone does not equal connected.

- [ ] **Actions:** Connect/Trocar directly calls manager connect; Testar uses persisted test job; 1/2 copies and auto toggle save station; Make-primary uses existing `ConfirmationDialog` explaining this becomes the only automatic station.

- [ ] **Mobile:** 320–480 px stack controls/actions; no oversized fixed widths; reuse current modal primitives.

- [ ] **GREEN + Commit:**

```bash
node --test src/components/PrintingSettings.test.js src/mobileOverlayRegression.test.js
git add src/components/PrintingSettings.jsx src/components/PrintingSettings.test.js src/printing/printing.css src/pages/Orders.jsx src/App.jsx
git commit -m "feat: add printing station settings"
```

---

### Task 12: Add order print status, preview, PDF, print/reprint and retry actions

**Files:** Create `src/components/PrintStatusBadge.jsx`, `OrderTicketPreview.jsx/.test.js`, `src/printing/printingUi.test.js`; modify `src/pages/Orders.jsx`, `src/components/OrderDetail.jsx`, `src/App.jsx`, `src/printing/printing.css`.

- [ ] **RED:** preview consumes only `document.*`; require friendly labels `Pendente de impressão`, `Imprimindo`, `Impresso`, `Falha na impressão`, `Requer atenção`; require `Visualizar ticket`, `Gerar PDF`, `Imprimir pedido|Reimprimir`, `Tentar novamente|Imprimir agora`.

```bash
node --test src/components/OrderTicketPreview.test.js src/printing/printingUi.test.js
```

- [ ] **Cards:** badge from `printing.latestJobByOrderId`; no job => no badge, valid when auto-print was disabled.

- [ ] **OrderDetail `Impressão do pedido`:** Preview and PDF fetch current canonical document. First manual print creates manual job. Reprint after success requires confirmation then new manual job. Failed uses same-job retry. Attention uses explicit same-job `Imprimir agora`. Keep printing controls separate from finalization/cancellation.

- [ ] **Reprint confirmation:** mention actual 1/2-copy count. Same-job retry needs no second confirmation because the explicit retry button is the intervention.

- [ ] **Diagnostics:** show sanitized persisted message, attempt/processed time and station; never raw exceptions/stacks.

- [ ] **GREEN + Commit:**

```bash
node --test src/components/OrderTicketPreview.test.js src/printing/printingUi.test.js src/pages/OrderHistory.test.js
git add src/components/PrintStatusBadge.jsx src/components/OrderTicketPreview.jsx src/components/OrderTicketPreview.test.js src/printing/printingUi.test.js src/pages/Orders.jsx src/components/OrderDetail.jsx src/App.jsx src/printing/printing.css
git commit -m "feat: add order printing actions and status"
```

---

### Task 13: Harden duplicate prevention and uncertain outcomes

**Files:** Modify printing regression tests plus only production files required by failing tests.

- [ ] **RED reload/sync:** prove no print call is reachable from `detectedIds`/`getNewActiveOrderIds`; repeated checkout idempotency key leaves one auto job; enabling auto after an auto-off order does not backfill.

- [ ] **RED uncertainty:** claimed at `20:00:00`, no callback, maintenance at `20:02:01` => `requires_attention`; claim-next cannot return it; explicit retry required. Also prove disconnected printer blocks subsequent claim-next locally after first known failure until connect/test succeeds.

```bash
node --test src/printing/printingManagerRegression.test.js worker/orderAutomaticPrintJob.test.js worker/orderPrintingRepository.test.js src/printing/printingUi.test.js
```

- [ ] **Minimal fixes only**, then rerun same command GREEN.

- [ ] **Commit:** `test: harden printing duplicate protection`.

---

### Task 14: Document setup, verify software and prepare physical acceptance

**Files:** Create `docs/order-printing-mtp5-acceptance.md`; modify `README.md`.

- [ ] **Acceptance checklist sections:** `Pré-requisitos`, `Windows + Chrome`, `Android + Chrome 138+`, `Pareamento MTP5`, `Conectar impressora no Gestão Delivery`, `Teste de 1 cópia`, `Teste de 2 cópias`, `Acentos e CP860`, `Pedido longo e quebra de linha`, `Impressora desligada`, `Queda durante escrita / resultado incerto`, `Retomada manual sem duplicidade`, `Preview e PDF`, `Resultado final Windows`, `Resultado final Android`. Every functional item gets `[ ] PASS [ ] FAIL` and notes.

- [ ] **README:** pair MTP5 in OS -> current Chrome -> `Pedidos > Impressão` -> Connect -> Test -> make primary -> auto on -> copies. State limitations: no Safari/Firefox guarantee, no auto retry, no WhatsApp sending, no secondary-station failover.

- [ ] **Full software gate:**

```bash
npm test
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npm run d1:migrate:local
```

All exit 0; local migration remains local only.

- [ ] **Commit:**

```bash
git add README.md docs/order-printing-mtp5-acceptance.md
git commit -m "docs: add MTP5 printing setup and acceptance"
```

## Manual Hardware Acceptance Gate

After software is green, execute `docs/order-printing-mtp5-acceptance.md` with the real Goldensky MTP5. Hardware-specific corrections are allowed only behind `mtp5Profile.js`, `cp860.js`, ESC/POS command composition or Web Serial transport; do not silently alter ticket business rules.

Required physical outcomes:

1. Windows Chrome prints 1 and 2 copies.
2. Android Chrome 138+ prints 1 and 2 copies via RFCOMM/SPP.
3. `João`, `Observação`, `Acréscimo`, `preferência`, `ç`, `ã`, `é` print legibly.
4. Long customer/address/item-note text wraps without silent truncation.
5. Total/order number emphasis is readable.
6. No cut command emits garbage.
7. Powered-off/disconnected printer produces one visible failure and blocks further automatic claims until operator action.
8. Mid-write uncertainty never auto-prints again.
9. Reprint creates distinct history and requires confirmation.
10. Preview/PDF contain the same customer-safe information and values as the thermal ticket.

If either platform cannot communicate with this exact MTP5 despite browser RFCOMM support, stop before adding a native wrapper/local agent. Record the observed hardware/Chrome behavior and return to brainstorming for the smallest fallback transport; those fallbacks remain outside this V1 plan.
