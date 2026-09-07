# Gestão Delivery — Windows QZ Tray Silent Printing Design

Date: 2026-09-06
Status: approved design awaiting written-spec review
Branch: `feature/android-rawbt-printing`

## 1. Goal

Add a production-quality Windows printing transport for the existing Gestão Delivery print queue using QZ Tray, while preserving the current Android RawBT flow and the shared order-printing behavior.

The target Windows flow is:

`new order -> existing print queue -> Gestão Delivery browser -> QZ Tray -> Windows printer queue MPT-II -> USB001 -> MPT-II`

The target Android flow remains:

`new order -> existing print queue -> Gestão Delivery browser -> RawBT -> Bluetooth -> MPT-II`

The Windows experience must support automatic printing with no per-order click after the workstation has been provisioned and trusted.

## 2. Physical validation already completed

The following facts were validated on the target Windows workstation before implementation:

- The MPT-II is detected by Windows over USB as `YICHIP - printer demo`.
- Windows does not expose this printer as a serial COM port; the existing Web Serial transport is therefore not the correct production path for this hardware.
- A Windows printer queue named `MPT-II` was created with the native `Generic / Text Only` driver on `USB001`.
- The Windows test page printed successfully through this queue.
- QZ Tray 2.2.6 is installed and its sample page connects successfully.
- QZ Tray finds the Windows queue `MPT-II`.
- QZ Tray RAW printing to `MPT-II` printed successfully on the physical printer.

These validations establish QZ Tray as the Windows transport for this MPT-II installation.

## 3. Scope

### In scope

- Windows transport changes from Web Serial to QZ Tray.
- QZ Tray connection lifecycle and printer discovery.
- Local selection/persistence of the Windows printer queue.
- Server-side QZ message signing for silent/trusted operation.
- Delivery of the existing ESC/POS bytes through QZ RAW printing.
- MPT-II bitmap compatibility mode on both Android RawBT and Windows QZ, so Portuguese accents do not depend on the printer code page.
- Existing automatic-print queue behavior.
- Existing one-copy/two-copy behavior.
- Existing `1/2 -> cut paper -> print second copy` flow and global second-copy modal.
- Printing settings UI for Windows/QZ status and setup.
- Staging-first deployment and physical homologation.

### Out of scope

- Replacing RawBT on Android.
- Supporting arbitrary Windows printers in this first iteration.
- Network printing, print servers, shared printers, macOS, or Linux.
- Paid QZ certificate licensing.
- Reworking the ticket business document, totals, kitchen layout, or order queue semantics.
- Production deployment before explicit physical approval.

## 4. Transport selection

The application continues to detect the local platform and maps it to a printing transport:

- `android` -> `rawbt`
- `windows` -> `qz`
- other platforms retain the existing behavior only where already supported; no new support is added by this change.

Windows no longer depends on `navigator.serial` for the MPT-II path.

The transport abstraction remains below the existing print-job runner. Queue claim, document retrieval, copy progress, completion, failure, and retry semantics stay shared.

## 5. Ticket rendering

The physical MPT-II failed to render Portuguese accented characters reliably when using its firmware code-page interpretation. `FS .` plus CP860 did not solve the physical symptom.

The renderer now has an MPT-II bitmap compatibility mode. This mode is already used by Android RawBT and must also be used by Windows QZ.

Therefore:

- Android RawBT -> `mpt2-bitmap`
- Windows QZ -> `mpt2-bitmap`
- Existing Web Serial/non-MPT-II path, if retained, keeps the current textual ESC/POS mode unless explicitly configured otherwise.

The resulting value passed to the transport remains a `Uint8Array` containing ESC/POS-compatible bytes. QZ will spool those bytes as RAW data instead of re-rendering the receipt through a Windows graphics driver.

This preserves exact control over 384-dot width, text appearance, monetary values, copy labels, and final feed behavior.

## 6. QZ client adapter

Create a focused adapter, e.g. `src/printing/qzTrayTransport.js`, responsible only for QZ-specific behavior.

Responsibilities:

1. Configure QZ certificate and signature callbacks before opening the websocket.
2. Connect to the local QZ Tray websocket.
3. Report connected/disconnected state.
4. Discover printer queues through QZ.
5. Resolve the configured printer queue.
6. Send the provided bytes as RAW data to that queue.
7. Disconnect/reconnect safely when needed.
8. Normalize QZ errors into application printer errors.

The printing manager must not contain low-level QZ protocol details.

The official QZ client library should be pinned as a project dependency rather than loaded from an arbitrary CDN at runtime.

## 7. Windows printer selection and persistence

Printer identity is local to the workstation, so it must not be stored as a global D1 setting.

Follow the same principle as the existing Web Serial fingerprint storage: persist the selected QZ printer name in local browser storage, scoped by the local print-station ID.

Suggested key shape:

`delivery-qz-printer-name:<stationId>`

Initial setup behavior:

- If no local QZ printer is configured, query QZ printers.
- If exactly one printer named `MPT-II` exists, the UI may offer/choose it directly as part of an explicit setup action.
- If not uniquely resolvable, show the available printers and require user selection.
- Never silently select a different printer just because it is the Windows default.

Normal startup behavior:

- Reconnect QZ.
- Resolve the saved queue name.
- Mark printing ready only if both QZ and the saved queue are available.

No database migration is required for printer selection.

## 8. Silent printing and signing architecture

QZ requires signed messages to suppress warning dialogs. The private signing key must never be shipped to browser JavaScript, committed to Git, stored in D1, or placed in a public asset.

Use server-side signing in the Cloudflare Worker.

### Worker configuration

Use environment-specific values:

- `QZ_DIGITAL_CERTIFICATE` — public x509 certificate text used by the browser/QZ handshake.
- `QZ_SIGNING_PRIVATE_KEY` — PKCS#8 2048-bit private key stored as a Worker secret.

Staging and production receive their configuration separately. Production secrets are not configured or used as part of staging implementation unless explicitly approved later.

### API endpoints

Add authenticated printing endpoints such as:

- `GET /api/printing/qz/certificate`
  - returns the configured public QZ certificate as plain text;
  - requires an authenticated Gestão Delivery session;
  - returns a clear configuration error if the environment is not provisioned.

- `POST /api/printing/qz/sign`
  - accepts the QZ `toSign` payload;
  - requires an authenticated Gestão Delivery session;
  - validates presence/type and enforces a reasonable payload-size limit;
  - signs with SHA-512 using the configured RSA private key;
  - returns a Base64 signature as plain text;
  - never returns or logs private-key contents.

The implementation should use Web Crypto available in the Worker and avoid introducing a server dependency solely for RSA signing.

QZ client configuration uses `setCertificatePromise`, `setSignatureAlgorithm('SHA512')`, and `setSignaturePromise` so QZ can request the certificate and a fresh server-side signature for protected API calls.

### Current single-workstation certificate scope

For the first deployment, use a QZ Tray Demo/custom certificate generated from `QZ Tray -> Advanced -> Site Manager` on the target Windows kitchen PC and install it into that QZ instance's trusted override as supported by QZ.

This is intentionally scoped to the currently validated workstation. Adding additional Windows stations later requires an explicit certificate/provisioning design rather than assuming this local demo trust automatically scales to every PC.

## 9. QZ RAW payload

The QZ transport receives the renderer's `Uint8Array` and submits it as a RAW command payload to the selected `MPT-II` queue.

Use a binary-safe representation such as Base64 when building the QZ data object. Do not convert the ESC/POS bytes to JavaScript text because arbitrary binary sequences must remain unchanged.

Conceptually:

- create QZ config for saved printer name;
- build a `raw / command / base64` payload from the `Uint8Array`;
- call `qz.print(config, data)`;
- resolve only when QZ accepts/spools the request;
- surface QZ rejection as a print transport failure.

Do not use QZ Pixel Printing for the order ticket. The application already owns bitmap generation and must continue sending the resulting ESC/POS bytes RAW.

## 10. Manager lifecycle and automatic queue safety

The existing automatic print consumer must only claim a pending job when the local Windows transport is actually ready.

For Windows/QZ, readiness means all of the following:

- authenticated application session;
- page eligible for automatic consumption under existing rules;
- this station is primary;
- automatic printing is enabled;
- QZ websocket is connected;
- signing configuration is available;
- saved `MPT-II` queue is found;
- no print job is currently busy or locally blocked.

If QZ is closed, disconnected, untrusted, not provisioned, or the saved printer is missing, the automatic consumer must not claim a new pending job.

If QZ fails after a job has already been claimed, use the existing failure/retry path so the job is not silently marked printed.

Reconnect attempts should be bounded and driven by the existing state polling/focus lifecycle; do not create aggressive independent loops.

## 11. Copies and cut flow

Transport changes must not alter copy semantics.

For a two-copy job:

1. Existing runner renders/prints only copy `1/2`.
2. Backend records `copiesPrinted = 1` and the job remains available for explicit second-copy continuation.
3. Global UI shows the already-designed modal telling the operator to cut the paper.
4. `Imprimir 2ª via` explicitly reclaims the same job.
5. Runner renders/prints only copy `2/2`.
6. Canceling the modal does not discard the second copy; it remains available in order details.

Both RawBT and QZ must use this same behavior.

## 12. Printing settings UX

Update the existing Printing Settings UI for Windows:

- Driver: `QZ Tray`
- Connection states:
  - `QZ Tray conectado`
  - `QZ Tray não encontrado`
  - `Impressora não configurada`
  - `MPT-II conectada/pronta`
  - configuration/signing error where applicable
- Show configured queue name, normally `MPT-II`.
- Provide an explicit `Configurar impressora` / `Trocar impressora` action.
- Keep `Testar impressão`.
- Keep station-primary, automatic-print, and copy-count controls unchanged.
- Explain that QZ Tray must be running on Windows for automatic printing.

Android UI remains RawBT-specific.

## 13. Error model

Normalize at least these Windows/QZ failure categories:

- `QZ_UNAVAILABLE` — QZ Tray not running/reachable.
- `QZ_SIGNING_UNAVAILABLE` — server signing configuration unavailable or rejected.
- `QZ_PRINTER_NOT_CONFIGURED` — no local queue saved.
- `QZ_PRINTER_NOT_FOUND` — saved queue no longer exists.
- `QZ_PRINT_FAILED` — QZ rejected or failed to spool the RAW payload.

Errors must be useful to the operator and must not expose cryptographic material or raw sensitive internals.

Automatic printing should block locally after errors that require operator intervention and recover after an explicit successful connect/test or a confirmed reconnect, consistent with the existing printer-block behavior.

## 14. Security

- Private signing key exists only as a Worker secret.
- Never log the private key.
- Never return it from an API.
- Certificate/signing endpoints require authentication.
- Signing endpoint accepts only the field required for QZ signing and enforces a payload-size ceiling.
- Use POST for signing to avoid placing QZ signed payloads in URLs/logs.
- Return `Cache-Control: no-store` on certificate/signature responses where appropriate.
- Do not weaken QZ local security or disable warnings globally as a shortcut.
- Do not use client-side private-key signing.
- A staging certificate/key setup must not cause a production deploy.

## 15. Test strategy

Strict TDD applies to each relevant change.

Required coverage includes:

### QZ transport unit tests

- QZ connects before printer discovery/printing.
- configured printer is resolved correctly.
- missing QZ produces `QZ_UNAVAILABLE`.
- missing configured printer produces correct error.
- bytes are sent through a binary-safe RAW/Base64 payload without mutation.
- QZ print rejection becomes `QZ_PRINT_FAILED`.

### Platform/manager tests

- Windows maps to `qz`.
- Android remains `rawbt`.
- Windows QZ uses `mpt2-bitmap` renderer mode.
- Android continues using `mpt2-bitmap`.
- automatic job claim is prevented while QZ/printer is not ready.
- automatic job claim resumes when QZ/printer is ready.
- manual test/print uses the QZ transport on Windows.
- second-copy path reuses the same job and QZ transport.

### Worker signing tests

- unauthenticated certificate/sign endpoints are rejected.
- missing environment configuration produces controlled error.
- valid test PKCS#8 key signs a known payload with SHA-512/RSA and signature verifies with its public key.
- malformed/oversized sign requests are rejected.
- private key never appears in response.

Use generated or test-only key material for automated tests; no staging/production private key is committed to the repository.

### UI tests

- Windows labels QZ Tray rather than Web Serial.
- setup/test actions reflect QZ readiness.
- Android RawBT labels remain unchanged.
- existing auto-print/copy controls remain present.

### Full gates

- `npm test`
- `npm run lint`
- `npm run build`
- production Worker bundle validation
- staging Worker bundle validation
- local D1 migration gate, even though no migration is expected

## 16. Deployment and homologation

All implementation remains on the current feature/staging path. Do not merge to `master` and do not deploy production as part of this work.

Staging rollout order:

1. Generate/install the QZ demo/custom signing certificate on the target Windows PC through QZ Site Manager.
2. Configure staging Worker `QZ_DIGITAL_CERTIFICATE` and `QZ_SIGNING_PRIVATE_KEY` securely.
3. Deploy the feature branch to staging.
4. Open staging on the Windows kitchen PC with QZ Tray running.
5. Configure/select `MPT-II`.
6. Run test print.
7. Enable the station as primary and automatic printing.
8. Create one controlled test order.
9. Verify automatic first copy prints with no per-order QZ confirmation.
10. Verify monetary values and Portuguese accents.
11. Verify one-line final feed.
12. Verify the global cut modal.
13. Cut paper and trigger second copy.
14. Verify only `CÓPIA 2/2` prints.
15. Close QZ Tray and verify a new automatic job is not consumed/lost while transport is unavailable.
16. Reopen QZ, recover the station, and verify printing resumes safely.
17. Repeat Android RawBT smoke test to ensure no regression.

Only after physical homologation and explicit user approval may the normal production path be considered.

## 17. Success criteria

The feature is accepted when, on the validated Windows PC:

- QZ Tray recognizes and uses the `MPT-II` Windows queue on `USB001`.
- Gestão Delivery shows QZ as the Windows printing driver.
- New orders print automatically on the primary Windows station without a per-order click.
- Printed Portuguese accented characters are correct because the MPT-II bitmap renderer is used.
- Currency values remain correct.
- Final feed remains one line.
- Two-copy jobs stop after copy 1, show the cut modal, and print copy 2 only after explicit confirmation.
- Closing/disconnecting QZ does not silently consume pending automatic print jobs.
- Android RawBT behavior remains working.
- No private QZ signing key is exposed in client code, repository contents, logs, or API responses.
- CI is fully green before staging deployment.
- Production remains untouched until explicit approval.
