# Windows QZ Tray Silent Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Windows MPT-II Web Serial path with a signed QZ Tray RAW transport that prints automatically without per-order clicks, while preserving Android RawBT, bitmap rendering, copy/cut flow, and the existing print-job queue.

**Architecture:** The existing print-job runner remains the shared orchestration layer. Android continues to dispatch the renderer's bytes through RawBT; Windows dispatches the same MPT-II bitmap ESC/POS bytes through a focused QZ Tray adapter to the locally configured Windows queue. QZ protected requests are signed by authenticated Cloudflare Worker endpoints so the private key never enters browser code.

**Tech Stack:** React 19, Vite 8, Node test runner, Cloudflare Workers/Web Crypto, D1, `qz-tray@2.2.6`, QZ Tray 2.2.6, ESC/POS, RawBT.

**Spec:** `docs/superpowers/specs/2026-09-06-windows-qz-silent-printing-design.md`

## Global Constraints

- Work only on `feature/android-rawbt-printing` / staging until physical homologation is explicitly approved.
- Do not merge to `master` and do not deploy production during this plan.
- Android transport remains RawBT.
- Windows transport becomes QZ Tray; Windows must not depend on `navigator.serial` for the MPT-II path.
- Pin the browser library to `qz-tray@2.2.6`.
- Android RawBT and Windows QZ both use renderer compatibility mode `mpt2-bitmap`.
- QZ printer selection is local to the browser/workstation, not D1.
- The private QZ signing key must exist only in Worker secrets and must never be committed, logged, returned by an API, or embedded in client JavaScript.
- QZ signatures use RSA PKCS#1 v1.5 with SHA-512.
- `POST /api/printing/qz/sign` is authenticated, same-origin protected, and limited to 1 MiB UTF-8 payloads.
- Existing queue claim/complete/fail/retry behavior and two-copy continuation semantics must not change.
- A two-copy job prints only `CÓPIA 1/2`, waits for explicit continuation, then prints only `CÓPIA 2/2`.
- Final MPT-II feed remains exactly one line.
- Strict TDD: every production change starts with a focused failing test, then minimal implementation, then focused GREEN before moving on.

---

## File Structure

### New files

- `src/printing/qzTrayTransport.js` — QZ security setup, websocket lifecycle, printer discovery, queue resolution, RAW Base64 dispatch, normalized QZ errors.
- `src/printing/qzTrayTransport.test.js` — unit tests for QZ connection, discovery, byte preservation, and error normalization using an injected fake QZ API.
- `worker/qzSigning.js` — PEM parsing, PKCS#8 key import, SHA-512/RSA signing, certificate/config validation, and signing payload-size validation.
- `worker/qzSigning.test.js` — cryptographic verification and configuration/error tests using test-only generated key material.
- `docs/operations/windows-qz-tray-printing.md` — operator runbook for Windows queue, QZ trust/provisioning, staging smoke test, and recovery.

### Existing files to modify

- `package.json` and lockfile — add pinned `qz-tray@2.2.6`.
- `src/api/client.js` — add plain-text authenticated QZ certificate/signing API helpers.
- `src/printing/localPrintStation.js` — persist selected QZ queue by local station ID.
- `src/printing/localPrintStation.test.js` — selected-queue storage tests.
- `src/printing/usePrintingManager.js` — map Windows to QZ, own QZ readiness/printer state, route all manual/automatic/second-copy jobs through QZ, and use bitmap mode.
- `src/printing/usePrintingManager.test.js` — create a focused pure-contract test file for exported platform/readiness/renderer helper functions.
- `src/components/PrintingSettings.jsx` — Windows/QZ status, printer selection, setup and test-print UX.
- `src/printing/printing.css` — only the minimal styles needed for the QZ printer selector/status; follow existing printing settings visual patterns.
- `src/printing/printingUi.test.js` — extend/create source-contract UI tests for QZ labels/actions while preserving RawBT labels.
- `worker/orderPrintingApi.js` — authenticated QZ certificate/sign endpoints before ordinary print-job routes.
- `worker/orderPrintingApi.test.js` — create focused handler tests for QZ route auth/config/input behavior if no equivalent route test exists on the feature branch.
- `worker/index.js` only if needed to keep QZ routing inside the authenticated printing handler; do not duplicate route logic in `index.js`.

---

### Task 1: Add the pinned QZ dependency and a binary-safe QZ transport adapter

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/printing/qzTrayTransport.js`
- Create: `src/printing/qzTrayTransport.test.js`

**Interfaces:**
- Consumes: QZ Tray JS API from `qz-tray@2.2.6`; browser callbacks `getCertificate(): Promise<string>` and `signPayload(toSign: string): Promise<string>`.
- Produces:
  - `configureQzSecurity({ qzApi, getCertificate, signPayload }): void`
  - `ensureQzConnected(qzApi): Promise<void>`
  - `listQzPrinters(qzApi): Promise<string[]>`
  - `resolveQzPrinter(qzApi, printerName): Promise<string>`
  - `printQzRawBytes(qzApi, printerName, bytes): Promise<void>`
  - normalized errors with codes `QZ_UNAVAILABLE`, `QZ_PRINTER_NOT_FOUND`, `QZ_PRINT_FAILED`.

- [ ] **Step 1: Pin QZ Tray and install the lockfile change**

Run:

```bash
npm install --save-exact qz-tray@2.2.6
```

Expected: `package.json` contains exactly `"qz-tray": "2.2.6"` and the lockfile records the same version.

- [ ] **Step 2: Write failing adapter tests before creating the adapter**

Create `src/printing/qzTrayTransport.test.js` with injected fakes covering at least:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  configureQzSecurity,
  ensureQzConnected,
  listQzPrinters,
  resolveQzPrinter,
  printQzRawBytes,
} from './qzTrayTransport.js'

test('QZ RAW transport preserves Uint8Array bytes as base64', async () => {
  let captured
  const qzApi = {
    websocket: { isActive: () => true },
    configs: { create: (printer) => ({ printer }) },
    print: async (config, data) => { captured = { config, data } },
  }
  const bytes = Uint8Array.from([0x1b, 0x40, 0x00, 0xff, 0x0a])

  await printQzRawBytes(qzApi, 'MPT-II', bytes)

  assert.equal(captured.config.printer, 'MPT-II')
  assert.deepEqual(captured.data, [{
    type: 'raw',
    format: 'command',
    flavor: 'base64',
    data: Buffer.from(bytes).toString('base64'),
  }])
})

test('QZ printer resolution rejects a missing saved queue', async () => {
  const qzApi = { printers: { find: async () => ['Microsoft Print to PDF'] } }
  await assert.rejects(
    () => resolveQzPrinter(qzApi, 'MPT-II'),
    (error) => error.code === 'QZ_PRINTER_NOT_FOUND',
  )
})
```

Also cover security callback registration, `websocket.connect()` only when inactive, printer list normalization, and QZ print rejection.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
node --test src/printing/qzTrayTransport.test.js
```

Expected: FAIL because `qzTrayTransport.js` does not exist / exports are missing.

- [ ] **Step 4: Implement the minimal QZ adapter**

Implement `src/printing/qzTrayTransport.js` with dependency injection and no React knowledge. The RAW path must use Base64, never binary-to-text decoding:

```js
const qzError = (code, message, cause) => Object.assign(new Error(message), { code, cause })

const bytesToBase64 = (bytes) => {
  if (!(bytes instanceof Uint8Array)) throw qzError('QZ_PRINT_FAILED', 'Dados de impressão inválidos.')
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return globalThis.btoa(binary)
}

export const configureQzSecurity = ({ qzApi, getCertificate, signPayload }) => {
  qzApi.security.setCertificatePromise((resolve, reject) => {
    getCertificate().then(resolve, reject)
  })
  qzApi.security.setSignatureAlgorithm('SHA512')
  qzApi.security.setSignaturePromise((toSign) => (resolve, reject) => {
    signPayload(toSign).then(resolve, reject)
  })
}

export const ensureQzConnected = async (qzApi) => {
  if (qzApi.websocket.isActive()) return
  try { await qzApi.websocket.connect() }
  catch (cause) { throw qzError('QZ_UNAVAILABLE', 'QZ Tray não está disponível. Abra o QZ Tray e tente novamente.', cause) }
}

export const listQzPrinters = async (qzApi) => {
  await ensureQzConnected(qzApi)
  return qzApi.printers.find()
}

export const resolveQzPrinter = async (qzApi, printerName) => {
  const printers = await listQzPrinters(qzApi)
  if (!printerName || !printers.includes(printerName)) {
    throw qzError('QZ_PRINTER_NOT_FOUND', 'A impressora configurada não foi encontrada no QZ Tray.')
  }
  return printerName
}

export const printQzRawBytes = async (qzApi, printerName, bytes) => {
  await resolveQzPrinter(qzApi, printerName)
  try {
    const config = qzApi.configs.create(printerName)
    await qzApi.print(config, [{ type: 'raw', format: 'command', flavor: 'base64', data: bytesToBase64(bytes) }])
  } catch (cause) {
    if (cause?.code) throw cause
    throw qzError('QZ_PRINT_FAILED', 'O QZ Tray não conseguiu enviar a impressão para a MPT-II.', cause)
  }
}
```

Use a browser-safe Base64 helper in production; tests may compare against `Buffer` only inside test code.

- [ ] **Step 5: Run focused tests GREEN**

Run:

```bash
node --test src/printing/qzTrayTransport.test.js
```

Expected: PASS.

- [ ] **Step 6: Run lint for the new adapter**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add package.json package-lock.json src/printing/qzTrayTransport.js src/printing/qzTrayTransport.test.js
git commit -m "feat: add QZ Tray raw printing transport"
```

---

### Task 2: Persist and resolve the Windows QZ printer locally

**Files:**
- Modify: `src/printing/localPrintStation.js`
- Modify: `src/printing/localPrintStation.test.js`

**Interfaces:**
- Consumes: existing local station ID and `localStorage` pattern.
- Produces:
  - `getQzPrinterName(storage, stationId): string | null`
  - `saveQzPrinterName(storage, stationId, printerName): string`
  - `clearQzPrinterName(storage, stationId): void`

- [ ] **Step 1: Add failing storage tests**

Append focused tests such as:

```js
test('QZ printer name is scoped by local station id', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }

  saveQzPrinterName(storage, 'station-a', 'MPT-II')

  assert.equal(getQzPrinterName(storage, 'station-a'), 'MPT-II')
  assert.equal(getQzPrinterName(storage, 'station-b'), null)
})
```

Also assert whitespace-only names are not persisted and clear removes the value.

- [ ] **Step 2: Run focused tests RED**

```bash
node --test src/printing/localPrintStation.test.js
```

Expected: FAIL because the QZ storage helpers are missing.

- [ ] **Step 3: Implement the local-storage helpers**

Use the exact key form approved in the spec:

```js
const qzPrinterKey = (stationId) => `delivery-qz-printer-name:${stationId}`
```

Trim stored names; return `null` for missing/blank values.

- [ ] **Step 4: Run focused tests GREEN**

```bash
node --test src/printing/localPrintStation.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/printing/localPrintStation.js src/printing/localPrintStation.test.js
git commit -m "feat: persist local QZ printer selection"
```

---

### Task 3: Add authenticated server-side QZ certificate and SHA-512 signing endpoints

**Files:**
- Create: `worker/qzSigning.js`
- Create: `worker/qzSigning.test.js`
- Modify: `worker/orderPrintingApi.js`
- Create/Modify: `worker/orderPrintingApi.test.js`
- Modify: `src/api/client.js`

**Interfaces:**
- Consumes Worker env values `QZ_DIGITAL_CERTIFICATE` and `QZ_SIGNING_PRIVATE_KEY`.
- Produces:
  - `getConfiguredQzCertificate(env): string`
  - `signQzPayload(env, toSign): Promise<string>` returning Base64 signature
  - `GET /api/printing/qz/certificate` -> authenticated `text/plain`
  - `POST /api/printing/qz/sign` body `{ "toSign": "..." }` -> authenticated `text/plain`
  - client `getQzCertificate(): Promise<string>`
  - client `signQzPayload(toSign): Promise<string>`

- [ ] **Step 1: Write crypto RED tests with generated test-only RSA keys**

Create `worker/qzSigning.test.js`. Generate a 2048-bit keypair inside test setup using `crypto.subtle.generateKey`, export the private key as PKCS#8 PEM and public key as SPKI, then assert:

```js
test('signQzPayload returns a SHA-512 RSA signature that verifies', async () => {
  const { privatePem, publicKey } = await createTestKeyPair()
  const env = {
    QZ_DIGITAL_CERTIFICATE: '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----',
    QZ_SIGNING_PRIVATE_KEY: privatePem,
  }
  const payload = 'call=print&timestamp=123'

  const signature = await signQzPayload(env, payload)
  const verified = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    publicKey,
    Uint8Array.from(atob(signature), (char) => char.charCodeAt(0)),
    new TextEncoder().encode(payload),
  )

  assert.equal(verified, true)
})
```

Add tests for missing certificate, missing private key, blank `toSign`, and UTF-8 payload larger than `1_048_576` bytes.

- [ ] **Step 2: Run signing tests RED**

```bash
node --test worker/qzSigning.test.js
```

Expected: FAIL because `qzSigning.js` does not exist.

- [ ] **Step 3: Implement `worker/qzSigning.js` minimally**

Implement strict PEM parsing and Web Crypto import:

```js
const QZ_SIGN_MAX_BYTES = 1_048_576

const pemToBytes = (pem, label) => {
  const normalized = String(pem || '')
    .replace(`-----BEGIN ${label}-----`, '')
    .replace(`-----END ${label}-----`, '')
    .replace(/\s+/g, '')
  if (!normalized) throw apiError(503, 'QZ_SIGNING_UNAVAILABLE', 'Assinatura QZ não configurada neste ambiente.')
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0))
}

export const signQzPayload = async (env, toSign) => {
  const payload = String(toSign ?? '')
  const bytes = new TextEncoder().encode(payload)
  if (!payload || bytes.byteLength > QZ_SIGN_MAX_BYTES) {
    throw apiError(400, 'INVALID_QZ_SIGN_PAYLOAD', 'Payload de assinatura QZ inválido.')
  }
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(env.QZ_SIGNING_PRIVATE_KEY, 'PRIVATE KEY'),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, bytes)
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}
```

Import and use the existing `apiError` helper rather than inventing a parallel Worker error shape.

- [ ] **Step 4: Run signing tests GREEN**

```bash
node --test worker/qzSigning.test.js
```

Expected: PASS.

- [ ] **Step 5: Write route RED tests before changing `orderPrintingApi.js`**

Cover:

```js
GET /api/printing/qz/certificate
POST /api/printing/qz/sign
```

The handler is already called only after `getAuthenticatedSession` succeeds in `worker/index.js`; nevertheless route tests must assert controlled missing-config errors and that `POST` calls `assertSameOriginMutation`. If an existing worker routing test harness is present, reuse it; otherwise test `handlePrintingApi` directly with a fake session and minimal env.

Expected response headers:

```text
content-type: text/plain; charset=UTF-8
cache-control: no-store
```

- [ ] **Step 6: Run route tests RED**

```bash
node --test worker/orderPrintingApi.test.js
```

Expected: FAIL because QZ routes do not exist.

- [ ] **Step 7: Add QZ routes inside `handlePrintingApi`**

Add them near the top of the authenticated printing handler, before station/job route matching:

```js
if (url.pathname === '/api/printing/qz/certificate' && request.method === 'GET') {
  return new Response(getConfiguredQzCertificate(env), {
    headers: { 'content-type': 'text/plain; charset=UTF-8', 'cache-control': 'no-store' },
  })
}

if (url.pathname === '/api/printing/qz/sign' && request.method === 'POST') {
  assertSameOriginMutation(request)
  const { toSign } = await readJson(request)
  return new Response(await signQzPayload(env, toSign), {
    headers: { 'content-type': 'text/plain; charset=UTF-8', 'cache-control': 'no-store' },
  })
}
```

Do not add a second authentication layer inside `qzSigning.js`; rely on the existing authenticated API boundary in `worker/index.js`.

- [ ] **Step 8: Add plain-text client helpers with RED source/unit coverage if the client already has contract tests**

Implement a small `textRequest` sibling to `apiRequest` that keeps `credentials: 'same-origin'`, throws the same error fields on non-2xx responses, and does not call `.json()` on successful text endpoints:

```js
export const getQzCertificate = () => textRequest('/api/printing/qz/certificate')
export const signQzPayload = (toSign) => textRequest('/api/printing/qz/sign', withJson('POST', { toSign }))
```

- [ ] **Step 9: Run focused Worker/client tests GREEN**

```bash
node --test worker/qzSigning.test.js worker/orderPrintingApi.test.js
```

Expected: PASS.

- [ ] **Step 10: Commit Task 3**

```bash
git add worker/qzSigning.js worker/qzSigning.test.js worker/orderPrintingApi.js worker/orderPrintingApi.test.js src/api/client.js
git commit -m "feat: sign QZ requests in the Worker"
```

---

### Task 4: Route Windows printing through QZ and make automatic claiming readiness-safe

**Files:**
- Modify: `src/printing/usePrintingManager.js`
- Create: `src/printing/usePrintingManager.test.js`
- Modify: `src/printing/localPrintStation.js` only if a helper import is needed, not behavior.

**Interfaces:**
- Consumes Task 1 QZ adapter, Task 2 local printer persistence, Task 3 certificate/signing clients, existing `renderEscPos58mm`, existing `runClaimedPrintJob`.
- Produces/exports pure helpers for testability:
  - `getPrintingTransportKind(platform)` returns `qz` for Windows, `rawbt` for Android, existing fallback for other platforms.
  - `getRendererCompatibilityMode(transportKind)` returns `mpt2-bitmap` for `qz` and `rawbt`, otherwise `null`.
  - `canConsumeAutomaticPrintJob({... transportReady })` requires `transportReady === true`.
- Hook adds QZ state/actions:
  - `availablePrinters: string[]`
  - `configuredPrinterName: string | null`
  - `refreshPrinters(): Promise<string[]>`
  - `selectPrinter(name): Promise<string>`

- [ ] **Step 1: Write RED pure-helper tests**

Create `src/printing/usePrintingManager.test.js`:

```js
test('Windows uses QZ and both MPT-II local transports use bitmap rendering', () => {
  assert.equal(getPrintingTransportKind('windows'), 'qz')
  assert.equal(getPrintingTransportKind('android'), 'rawbt')
  assert.equal(getRendererCompatibilityMode('qz'), 'mpt2-bitmap')
  assert.equal(getRendererCompatibilityMode('rawbt'), 'mpt2-bitmap')
})

test('automatic consumer does not claim while local transport is not ready', () => {
  assert.equal(canConsumeAutomaticPrintJob({
    authenticated: true,
    isOnline: true,
    supported: true,
    visible: true,
    browserOnline: true,
    busyJobId: null,
    printerBlocked: false,
    transportReady: false,
    station: { isPrimary: true, autoPrintEnabled: true },
  }), false)
})
```

Also assert the same input with `transportReady: true` returns true.

- [ ] **Step 2: Run manager helper tests RED**

```bash
node --test src/printing/usePrintingManager.test.js
```

Expected: FAIL because Windows still maps to Web Serial and transport readiness is not modeled.

- [ ] **Step 3: Change only the pure helpers and rerun GREEN**

Implement:

```js
export const getPrintingTransportKind = (platform) => {
  if (platform === 'android') return 'rawbt'
  if (platform === 'windows') return 'qz'
  return 'web-serial'
}

export const getRendererCompatibilityMode = (transportKind) => (
  ['rawbt', 'qz'].includes(transportKind) ? 'mpt2-bitmap' : null
)
```

Add `transportReady` to `canConsumeAutomaticPrintJob`.

Run:

```bash
node --test src/printing/usePrintingManager.test.js
```

Expected: PASS.

- [ ] **Step 4: Write RED source/behavior tests for QZ manager integration**

Add tests that assert the manager imports `qz-tray`, QZ adapter functions, QZ API certificate/sign helpers, and does not call `navigator.serial` for the Windows/QZ branch. The key behavioral contract to enforce is:

```js
renderer: (document, options) => renderEscPos58mm(document, {
  ...options,
  compatibilityMode: getRendererCompatibilityMode(transportKind),
})
```

and the QZ transport invokes `printQzRawBytes(qz, configuredPrinterName, bytes)`.

- [ ] **Step 5: Integrate QZ lifecycle into the hook minimally**

At initialization on Windows:

1. Configure QZ security once using `getQzCertificate` and `signQzPayload`.
2. Attempt `ensureQzConnected(qz)`.
3. Load saved printer name for this local station.
4. Query printers and verify the saved name exists.
5. If no saved name and exactly one exact `MPT-II` exists, select it only as part of explicit `refreshPrinters` / setup interaction, not silently during background queue consumption.
6. Set `transportReady` only after QZ is connected and the saved queue is resolved.

Replace the Windows transport closure inside `executeClaimedJob` with QZ RAW printing. Preserve RawBT and fallback Web Serial branches:

```js
transport: transportKind === 'rawbt'
  ? (_port, bytes) => dispatchRawBtBytes(bytes)
  : transportKind === 'qz'
    ? (_port, bytes) => printQzRawBytes(qz, configuredPrinterNameRef.current, bytes)
    : (port, bytes) => writeSerialBytes(port, bytes, MTP5_PROFILE.serial)
```

For QZ, `getExplicitPort()` must return `null` only after QZ/printer readiness is established; it must never invoke `requestPrinterPort()`.

- [ ] **Step 6: Make queue polling readiness-safe**

Pass `transportReady` into `canConsumeAutomaticPrintJob`. A closed QZ instance, signing failure, or missing saved printer must leave the job `pending` because `claimNextPrintJob` is not called.

If QZ fails after a job is claimed, preserve the existing `runClaimedPrintJob -> failJob` path and set the local blocked state for operator-recoverable QZ codes.

- [ ] **Step 7: Run printing unit tests**

```bash
node --test src/printing/usePrintingManager.test.js src/printing/printJobRunner.test.js src/printing/escpos58mm.test.js src/printing/qzTrayTransport.test.js src/printing/localPrintStation.test.js
```

Expected: PASS, including existing first-copy/second-copy and bitmap tests.

- [ ] **Step 8: Commit Task 4**

```bash
git add src/printing/usePrintingManager.js src/printing/usePrintingManager.test.js
git commit -m "feat: route Windows printing through QZ Tray"
```

---

### Task 5: Update Printing Settings UX for Windows QZ without regressing Android RawBT

**Files:**
- Modify: `src/components/PrintingSettings.jsx`
- Modify: `src/printing/printing.css`
- Create/Modify: `src/printing/printingUi.test.js`

**Interfaces:**
- Consumes manager properties/actions from Task 4.
- Produces Windows UX with QZ-specific connection labels, queue selector, setup action, and test-print action; Android UI remains unchanged.

- [ ] **Step 1: Write UI RED contract tests**

Use the repository's current lightweight source-contract testing style (Node test runner, no new React testing dependency). Assert that `PrintingSettings.jsx` contains Windows/QZ copy and retains RawBT copy:

```js
assert.match(source, /QZ Tray/)
assert.match(source, /Configurar impressora|Trocar impressora/)
assert.match(source, /MPT-II/)
assert.match(source, /RawBT/)
assert.doesNotMatch(source, /Windows \+ Chrome com Web Serial disponível/)
```

Also assert an available-printer `<select>` is bound to `printing.selectPrinter` and `printing.availablePrinters` for the QZ branch only.

- [ ] **Step 2: Run UI tests RED**

```bash
node --test src/printing/printingUi.test.js
```

Expected: FAIL because Windows UI still advertises Web Serial and has no QZ selector.

- [ ] **Step 3: Implement Windows/QZ UI**

Add state labels such as:

```js
'qz-connected': 'QZ Tray conectado',
'qz-unavailable': 'QZ Tray não encontrado',
'qz-unconfigured': 'Impressora não configurada',
'qz-ready': 'MPT-II pronta',
'qz-signing-error': 'Assinatura QZ indisponível',
```

For `transportKind === 'qz'`:

- Driver card shows `QZ Tray`.
- Show saved queue name or `Não configurada`.
- `Configurar impressora` calls `printing.refreshPrinters()`.
- Render the selector when printer options are available.
- Selecting a printer calls `printing.selectPrinter(event.target.value)`.
- Keep `Testar impressão`, auto-print toggle, copy count, primary-station control.
- Show operator help: `O QZ Tray deve permanecer aberto no Windows para impressão automática.`

For Android, retain `RawBT pronto` and existing RawBT help.

- [ ] **Step 4: Add only minimal CSS using existing tokens/classes**

Add a focused selector/status row; do not redesign the printing modal.

- [ ] **Step 5: Run UI + printing tests GREEN**

```bash
node --test src/printing/printingUi.test.js src/printing/usePrintingManager.test.js src/printing/localPrintStation.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/components/PrintingSettings.jsx src/printing/printing.css src/printing/printingUi.test.js
git commit -m "feat: add QZ Tray printer setup UX"
```

---

### Task 6: Add regression coverage for copies, accents, feed, and QZ transport failure safety

**Files:**
- Modify: `src/printing/escpos58mm.test.js`
- Modify: `src/printing/printJobRunner.test.js`
- Modify: `src/printing/usePrintingManager.test.js`
- Modify: `src/printing/qzTrayTransport.test.js`

**Interfaces:**
- Consumes all prior tasks.
- Produces explicit regression proof that transport work did not alter ticket/copy semantics.

- [ ] **Step 1: Add regression assertions before any production change**

Ensure tests explicitly cover:

```js
assert.equal(MTP5_PROFILE.feedLinesAfterJob, 1)
```

Bitmap rendering of representative Portuguese text:

```text
Sanduíche
Endereço
João
Acréscimo
Observação
CÓPIA 1/2
CÓPIA 2/2
```

Runner progression:

```text
copiesRequested=2, copiesPrinted=0 -> renderer called for copy 1 only -> complete with 1
copiesRequested=2, copiesPrinted=1 -> renderer called for copy 2 only -> complete with 2
```

QZ failure:

```text
qz.print rejects -> transport throws QZ_PRINT_FAILED -> runner calls failJob -> completeJob is not called
```

- [ ] **Step 2: Run focused regression suite**

```bash
node --test src/printing/escpos58mm.test.js src/printing/printJobRunner.test.js src/printing/qzTrayTransport.test.js src/printing/usePrintingManager.test.js
```

Expected: PASS. If any new assertion is RED, fix only the concrete regression and rerun the focused test before continuing.

- [ ] **Step 3: Commit any test-only regression additions**

```bash
git add src/printing/escpos58mm.test.js src/printing/printJobRunner.test.js src/printing/usePrintingManager.test.js src/printing/qzTrayTransport.test.js
git commit -m "test: cover QZ printing safety regressions"
```

---

### Task 7: Write the Windows operator runbook and complete the full CI gate

**Files:**
- Create: `docs/operations/windows-qz-tray-printing.md`
- Modify: no production code unless the full gate exposes a concrete regression.

**Interfaces:**
- Consumes completed feature.
- Produces exact workstation setup/recovery instructions and a green validation commit ready for staging provisioning.

- [ ] **Step 1: Write the operator runbook**

Document these exact validated workstation facts and setup steps:

```text
Windows USB device: YICHIP - printer demo
Windows queue: MPT-II
Driver: Generic / Text Only
Port: USB001
QZ Tray: 2.2.6
Transport: RAW / ESC-POS bytes supplied by Gestão Delivery
```

Include:

1. Verify Windows test print.
2. Verify QZ sample page finds `MPT-II`.
3. QZ Site Manager certificate/trust provisioning.
4. Required staging secrets: `QZ_DIGITAL_CERTIFICATE`, `QZ_SIGNING_PRIVATE_KEY`.
5. Gestão Delivery printer selection.
6. Test print.
7. Enable primary station + automatic print.
8. Recovery steps when QZ is closed or the USB queue disappears.
9. Explicit warning: never commit or paste the private key into client code, GitHub issues, screenshots, or chat logs.

- [ ] **Step 2: Run the complete application test suite**

```bash
npm test
```

Expected: all tests PASS, zero failures.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Validate both Worker bundles and local migrations using the repository's existing CI-equivalent commands/workflow**

Run the same commands used by `.github/workflows/validate.yml` for:

```text
Validate production Worker bundle
Validate staging Worker bundle
Apply migrations to local D1
```

Expected: all PASS. No new D1 migration should be generated by this feature.

- [ ] **Step 6: Commit the runbook**

```bash
git add docs/operations/windows-qz-tray-printing.md
git commit -m "docs: add Windows QZ printing runbook"
```

- [ ] **Step 7: Push branch and verify GitHub Actions GREEN before staging**

```bash
git push origin feature/android-rawbt-printing
```

Expected: `Validate application` finishes successfully for the exact pushed HEAD.

---

### Task 8: Provision staging and physically homologate Windows without touching production

**Files:**
- No repository file changes expected.
- Staging-only Worker secrets and local QZ trust configuration.

**Interfaces:**
- Consumes Task 7 green branch and operator runbook.
- Produces physical evidence that the target Windows PC can run the full queue automatically and safely.

- [ ] **Step 1: Generate/provision the QZ development certificate for the target Windows PC**

Use QZ Tray 2.2.6 `Advanced -> Site Manager` on the kitchen PC. Keep private key material out of Git and browser storage.

- [ ] **Step 2: Configure staging Worker secrets only**

Set:

```text
QZ_DIGITAL_CERTIFICATE
QZ_SIGNING_PRIVATE_KEY
```

Do not configure or deploy production secrets in this task.

- [ ] **Step 3: Deploy `feature/android-rawbt-printing` to staging**

Use the existing `Deploy staging` workflow and confirm the deployed SHA equals the validated feature HEAD.

- [ ] **Step 4: Configure the Windows station in Gestão Delivery**

Expected UI:

```text
Plataforma: Windows
Driver: QZ Tray
Impressora: MPT-II
Estado: pronta/conectada
```

Set the station primary and enable automatic printing only after `Testar impressão` succeeds.

- [ ] **Step 5: Physical automatic-print test**

Create one controlled test order containing at least:

```text
R$ 18,00
Sanduíche
Endereço
João
Acréscimo
Observação
```

Expected:

- first copy prints automatically with no per-order QZ confirmation;
- values are correct;
- accents/special characters are correct;
- bottom feed is one line;
- only `CÓPIA 1/2` prints initially.

- [ ] **Step 6: Physical second-copy modal test**

Expected:

1. Global modal appears after copy 1.
2. Cut paper.
3. Click `Imprimir 2ª via`.
4. Only `CÓPIA 2/2` prints.
5. Canceling the modal leaves the second copy available in order details.

- [ ] **Step 7: Transport-loss safety test**

Close QZ Tray before creating a controlled new order.

Expected: the Windows station does not claim/lose the pending automatic job while QZ is unavailable. Reopen QZ, recover readiness, and verify the job can then print safely.

- [ ] **Step 8: Android regression smoke test**

On the existing Samsung/RawBT setup, print one controlled ticket.

Expected: RawBT automatic first copy, bitmap accents, one-line feed, and second-copy cut flow remain working.

- [ ] **Step 9: Stop at the production gate**

Record physical homologation outcome. Do **not** merge PR #8, do not deploy production, and do not configure production QZ secrets until the user explicitly approves the normal production path.

---

## Plan Self-Review

### Spec coverage

- Windows QZ transport: Tasks 1, 4, 5.
- Local printer selection/persistence: Tasks 2, 4, 5.
- Server-side signing/security: Task 3.
- Bitmap accents for Windows and Android: Tasks 4, 6, 8.
- Automatic queue safety: Tasks 4, 6, 8.
- Two-copy/cut modal semantics: Tasks 4, 6, 8.
- One-line feed: Tasks 6, 8.
- Operator UX/runbook: Tasks 5, 7.
- Full gates/staging-only rollout: Tasks 7, 8.
- Production remains untouched: Global Constraints and Task 8 stop gate.

### Placeholder scan

No `TBD`, `TODO`, `implement later`, or unspecified error-handling steps remain. Every new error category, endpoint, local-storage key, dependency version, signing algorithm, payload ceiling, test command, and staging gate is explicit.

### Type/interface consistency

The plan consistently uses `Uint8Array` from renderer to QZ transport, string printer names, `mpt2-bitmap` compatibility mode for `rawbt` and `qz`, authenticated plain-text signing responses, and the same existing print job object/copy counters. No task introduces a parallel print queue or alternate ticket document.