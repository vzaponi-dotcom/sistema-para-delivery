# Spec C9 — Printing and QZ Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Status:** **APPROVED FOR EXECUTION — TASKS 1–7 COMPLETE / GREEN; TASK 8 NOT STARTED** — Native/inline execution.

**Goal:** Establish domains/printing as the frontend owner of operational printing while isolating qz-tray under src/infrastructure/qz, preserving every current queue, copies, recovery, unknown-outcome, settings, capability and physical-print behavior.

**Architecture:** The migration is staged so every boundary is proven RED→GREEN before the next one consumes it. Pure printing rules/renderers move first, then the HTTP adapter, QZ adapter, manager/application layer, queue/settings UI and App overlays; only after all production consumers are migrated do we delete legacy owners and tighten the architecture checker. Worker routes, migrations and schema stay functionally unchanged.

**Tech Stack:** React 19, Node 22 node:test, Vite, Cloudflare Workers/D1, qz-tray, Wrangler 4.128.0, existing policy-editing engine and architecture checker.

**Spec:** docs/superpowers/specs/2026-09-19-frontend-modularization-c9-printing-design.md

## Global Constraints

- Base is master SHA 91fb5581cea1616f438c13dfac28cfb38345fa59, the validated C8 merge.
- Work only on feature/spec-c9-printing. Never implement directly on master.
- Preserve orderDefaultCopies and tableTabDefaultCopies independently; each accepts 1 or 2 copies.
- A Local order without table/tab context uses orderDefaultCopies. Table-linked orders and table-tab jobs use tableTabDefaultCopies.
- Explicit copy count remains authoritative where the current flow accepts it. A test job stays exactly one copy.
- Existing jobs preserve copies_requested when policy changes.
- Windows primary station is the only physical executor. Android/other remain queue-only.
- Preserve PRINT_JOB_POLL_MS = 2000, PRINT_STATE_POLL_MS = 5000 and STATION_HEARTBEAT_MS = 15000.
- Preserve storage keys delivery-print-station-id, delivery-qz-printer-name:<stationId> and printing-origin-order-ids.
- Preserve current endpoint URLs, HTTP methods, payloads, QZ certificate/sign flow and error codes.
- Preserve unknown physical outcome semantics: no silent retry or automatic resend after submission risk exists.
- Preserve recovery affinity: the current recovery job, including copy 2/2, is resolved before another job is consumed.
- Preserve current CSS behavior, light/dark, breakpoints and functional text. No redesign.
- Worker, migrations, D1 schema and workflows are unchanged unless a proven blocker requires a ledgered ruling.
- qz-tray production import must end exclusively under src/infrastructure/qz.
- No production deploy. Merge requires separate explicit authorization after staging and physical QA.

## Review Focus

1. **Stale async printer selection after logout/reinitialization:** a late QZ result must not persist a printer or overwrite state from a newer manager generation. Task 4 adds the stale-generation test.
2. **SPOOLING without COMPLETE / observation loss:** after submission risk is persisted, loss of observation must stay requires_attention/unknown with no silent duplicate. Task 3 and Task 4 keep a RED→GREEN persisted-attempt test.
3. **Deferred recovery on a two-copy job across refresh:** recoveryJobId must retain affinity and reclaim copy 2/2 of the same job before any next job. Task 4 and Task 7 exercise this.
4. **Policy changes while old jobs wait:** old jobs keep copies_requested while new Local/no-table and table-linked jobs resolve against the correct current default. Task 6 and staging QA exercise this.
5. **Browser/app connectivity disagreement or hidden page:** transport support alone must never claim when app offline, navigator offline, page hidden, QZ disconnected or physical readiness is not ready. Task 4 adds/retains the combined guard matrix.

## Target file map

The final ownership target is:

~~~text
src/domains/printing/
  domain/
    printingEligibility.js
    printRecovery.js
    secondCopy.js
    stationPolicy.js
    rendering/
      cp860.js
      mtp5Profile.js
      escpos58mm.js
      manualPrintDocument.js
      pdfOrderRenderer.js
  application/
    physicalOperation.js
    printingPlatform.js
    printJobRunner.js
    usePrintingManager.js
    usePrintingOverlays.js
  infrastructure/
    printingApi.js
    printingLocalPreferences.js
    printingPolicy.js
  ui/
    PrintQueue.jsx
    PrintingSettingsContent.jsx
    PrintingOverlays.jsx
    printQueueDetails.js
    printQueueFilters.js
    printQueueQuery.js
    printQueueSummary.js
    printing.css
  index.js

src/infrastructure/qz/
  qzTransport.js
  qzStatusMonitor.js
  qzPrintAttemptController.js
  qzLocalPreferences.js
~~~

Permanent cross-runtime files remain:

~~~text
shared/printQueue.js
shared/printQueueActions.js
shared/printContextPolicy.js
~~~

The Settings generic engine remains under app/policy-editing. The thin app/surfaces/settings/printingSettingsAdapter.js remains a composition bridge unless a later task proves it has no purpose; the plan does not move the generic engine.

## Interface map

Final public entry src/domains/printing/index.js must expose only real external contracts:

~~~js
export { PrintQueue } from './ui/printingSurfaces.js'
export { DEFAULT_PRINT_QUEUE_QUERY } from './ui/printQueueQuery.js'
export { default as PrintingSettingsContent } from './ui/PrintingSettingsContent.jsx'
export { default as PrintingOverlays } from './ui/PrintingOverlays.jsx'
export { usePrintingManager } from './application/usePrintingManager.js'
export {
  printingPolicy,
  stationConfigurationPolicy,
  stationPrimaryPolicy,
} from './infrastructure/printingPolicy.js'
~~~

The three policy exports are deliberate: app/surfaces/settings/policies/registry.js is a real consumer, exactly as it already consumes Orders and Finance policies from their public entries.

usePrintingManager keeps the current returned operational surface and adds one small public method needed to remove Printing storage ownership from App:

~~~ts
rememberOriginOrder(orderId: string): Set<string>
~~~

PrintingOverlays consumes:

~~~ts
{
  printing,
  orders: Order[],
  authenticated: boolean,
  canExecutePrinting: boolean,
  canDiscardPrinting: boolean,
  onError: (error: unknown) => void,
  onSuccess: (message: string) => void
}
~~~

createQzTransport is the concrete infrastructure boundary:

~~~ts
createQzTransport({
  getCertificate,
  signPayload,
  storage = globalThis.localStorage,
  qzApi = qz
}) => {
  configureSecurity(): void,
  isConnected(): boolean,
  connect(): Promise<void>,
  onClosed(callback): void,
  readiness: QzReadinessController,
  listPrinters(): Promise<string[]>,
  resolvePrinter(name: string): Promise<string>,
  print(printerName: string, bytes: Uint8Array, options?: { jobName?: string }): Promise<void>,
  createStatusMonitor(args): QzStatusMonitor,
  readPrinterName(stationId: string): string|null,
  savePrinterName(stationId: string, name: string): string,
  clearPrinterName(stationId: string): void
}
~~~

The object is intentionally small and concrete. Do not create base classes or a transport registry.

---

## Execution preparation — after this plan is approved, before Task 1

- Confirm feature/spec-c9-printing still descends from master 91fb5581cea1616f438c13dfac28cfb38345fa59 with no unexpected code commits.
- Reconcile docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md: C8 MERGED/COMPLETE and C9 active.
- Append the C9 start checkpoint to docs/superpowers/qa/spec-c-execution-ledger.md.
- Append the active C9 printing/API/QZ debt to docs/superpowers/qa/spec-c-compatibility-facades.md without marking anything removed.
- Create/reuse one draft PR for feature/spec-c9-printing. Do not create duplicate PRs.
- Validate the documentary baseline through the repository Validate workflow before Task 1.
- Record the exact baseline run and SHA in the C9 execution record created at docs/superpowers/qa/spec-c9-printing-execution.md.
- No staging or production in this preparation.

## Preparation evidence — 2026-09-19

- Draft PR: #53.
- Documentary baseline commit: `010e9ef8f46c0a46eb82dfa5c85c79d5c4bc16f1`.
- Validate #1465 / run `35473924686`: **SUCCESS**.
- Suite: **1,860 tests / 1,859 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, production/staging Worker dry-runs, local D1 and Spec B D1: green.
- Task 1 remains **NOT STARTED** until the documentation-only evidence HEAD created from this checkpoint receives exact-head Validate.

---

### Task 1: Establish Printing domain rules and rendering ownership

**Files:**
- Create: src/domains/printing/domain/printingEligibility.js
- Create: src/domains/printing/domain/printRecovery.js
- Create: src/domains/printing/domain/secondCopy.js
- Create: src/domains/printing/domain/stationPolicy.js
- Create: src/domains/printing/domain/rendering/cp860.js
- Create: src/domains/printing/domain/rendering/mtp5Profile.js
- Create: src/domains/printing/domain/rendering/escpos58mm.js
- Create: src/domains/printing/domain/rendering/manualPrintDocument.js
- Create: src/domains/printing/domain/rendering/pdfOrderRenderer.js
- Create: src/domains/printing/domain/printingDomainContract.test.js
- Move/align tests from: src/printing/printRecoveryFlow.test.js, secondCopyPromptFlow.test.js, escpos58mm.test.js, manualPrintDocument.test.js, pdfOrderRenderer.test.js, localPrintStation.test.js
- Modify: src/printing/usePrintingManager.js imports only as needed for the transitional branch
- Modify: src/App.jsx second-copy helper import only
- Create: src/domains/printing/index.js with explicitly marked temporary exports needed by current legacy consumers

**Interfaces:**
- Consumes: shared/printQueue.js, shared/printQueueActions.js and shared/printContextPolicy.js only where a pure rule genuinely needs them.
- Produces:
  - getPrintingTransportKind(platform): 'qz'|'queue-only'
  - getRendererCompatibilityMode(transportKind): 'mpt2-bitmap'|null
  - isPrintingTransportSupported(platform): boolean
  - canConsumeAutomaticPrintJob(input): boolean
  - canExecuteSecondCopy(input): boolean
  - canPresentSecondCopyPrompt(input): boolean
  - canKeepSecondCopyPromptOpen(input): boolean
  - deriveRecoveryView(input): RecoveryView
  - nextRecoveryState(input): RecoveryState
  - canRunSingleRecoveryCopy(input): boolean
  - runSingleRecoveryCopy(input): Promise<Result|null>
  - isSecondCopyPromptEligible(job, order): boolean
  - getSecondCopyPromptTitle(job, order): string
  - acknowledgeAndOpenSecondCopyPrompt(args): Promise<object>
  - findOriginSecondCopyPrompt(args): PrintJob|null
  - getDefaultPrintStationName(platform): string
  - isQzPrintStationEligible({ platform, qzPrinterName }): boolean
  - rendering exports keep their current signatures exactly.

- [ ] **Step 1: Write the failing domain ownership contract**

Create src/domains/printing/domain/printingDomainContract.test.js:

~~~js
import test from 'node:test'
import assert from 'node:assert/strict'

test('printing domain exposes pure eligibility, recovery, second-copy and rendering contracts', async () => {
  const eligibility = await import('./printingEligibility.js')
  const recovery = await import('./printRecovery.js')
  const secondCopy = await import('./secondCopy.js')
  const renderer = await import('./rendering/escpos58mm.js')

  assert.equal(eligibility.getPrintingTransportKind('windows'), 'qz')
  assert.equal(eligibility.getPrintingTransportKind('android'), 'queue-only')
  assert.equal(recovery.deriveRecoveryView({ recoveryState: 'pending', physicalReady: true, safeBacklog: 2 }).recoveryPromptEligible, true)
  assert.equal(secondCopy.isSecondCopyPromptEligible({
    status: 'awaiting_second_copy', copiesRequested: 2, copiesPrinted: 1, type: 'table-tab',
  }), true)
  assert.equal(typeof renderer.renderEscPos58mm, 'function')
})
~~~

Also add source checks proving files under domain do not mention React, qz-tray, localStorage, navigator, document, window or fetch.

- [ ] **Step 2: Run the focused RED**

Run:

~~~bash
node --test src/domains/printing/domain/printingDomainContract.test.js
~~~

Expected: FAIL because the new Printing domain modules do not exist.

- [ ] **Step 3: Move the pure modules and rendering code without changing behavior**

Move the existing implementations, preserving source logic. Extract the pure manager guards into printingEligibility.js:

~~~js
export const getPrintingTransportKind = (platform) => (
  platform === 'windows' ? 'qz' : 'queue-only'
)

export const getRendererCompatibilityMode = (transportKind) => (
  transportKind === 'qz' ? 'mpt2-bitmap' : null
)

export const isPrintingTransportSupported = (platform) => (
  getPrintingTransportKind(platform) === 'qz'
)
~~~

Keep canConsumeAutomaticPrintJob, canExecuteSecondCopy, canPresentSecondCopyPrompt, canKeepSecondCopyPromptOpen, canInitializeBackgroundPhysicalTransport and canSendPrintStationHeartbeat behavior byte-for-byte equivalent to their current manager definitions.

Split browser defaults out of localPrintStation:

~~~js
// stationPolicy.js
export const getDefaultPrintStationName = (platform) => {
  if (platform === 'windows') return 'Cozinha · Windows'
  if (platform === 'android') return 'Cozinha · Android'
  return 'Cozinha · Navegador'
}

export const isQzPrintStationEligible = ({ platform, qzPrinterName } = {}) => (
  platform === 'windows' && Boolean(String(qzPrinterName ?? '').trim())
)
~~~

Move recovery functions verbatim into printRecovery.js and second-copy pure functions into secondCopy.js. Storage functions do not move into domain.

The Task 1 transitional public entry is explicit and temporary:

~~~js
export {
  getPrintingTransportKind,
  getRendererCompatibilityMode,
  isPrintingTransportSupported,
  canConsumeAutomaticPrintJob,
  canExecuteSecondCopy,
  canPresentSecondCopyPrompt,
  canKeepSecondCopyPromptOpen,
  canInitializeBackgroundPhysicalTransport,
  canSendPrintStationHeartbeat,
} from './domain/printingEligibility.js'
export {
  deriveRecoveryView,
  nextRecoveryState,
  canRunSingleRecoveryCopy,
  runSingleRecoveryCopy,
} from './domain/printRecovery.js'
export {
  isSecondCopyPromptEligible,
  getSecondCopyPromptTitle,
  acknowledgeAndOpenSecondCopyPrompt,
  findOriginSecondCopyPrompt,
} from './domain/secondCopy.js'
export {
  getDefaultPrintStationName,
  isQzPrintStationEligible,
} from './domain/stationPolicy.js'
export { renderEscPos58mm } from './domain/rendering/escpos58mm.js'
~~~

These temporary helper exports exist only so legacy App/manager consumers can migrate without deep imports. Task 8 removes them from the public entry.

- [ ] **Step 4: Move/align the existing focused tests**

Update imports only unless the old test asserted the old owner path. Positive ownership assertions must target the new modules. Preserve every behavioral assertion, especially table-tab second-copy and renderer 1/2 behavior.

Run:

~~~bash
node --test   src/domains/printing/domain/printingDomainContract.test.js   src/domains/printing/domain/printRecovery.test.js   src/domains/printing/domain/secondCopy.test.js   src/domains/printing/domain/rendering/escpos58mm.test.js   src/domains/printing/domain/rendering/manualPrintDocument.test.js   src/domains/printing/domain/rendering/pdfOrderRenderer.test.js
~~~

Expected: PASS.

- [ ] **Step 5: Verify no accidental copy-policy regression**

Add characterization using shared/printContextPolicy.js:

~~~js
assert.equal(resolvePrintCopies({
  jobType: 'order',
  customerIdentityType: 'local',
  tableTabId: null,
  policy: { orderDefaultCopies: 2, tableTabDefaultCopies: 1 },
}), 2)

assert.equal(resolvePrintCopies({
  jobType: 'order',
  customerIdentityType: 'table',
  tableTabId: 'tab-1',
  policy: { orderDefaultCopies: 1, tableTabDefaultCopies: 2 },
}), 2)
~~~

Expected: current shared contract passes unchanged.

- [ ] **Step 6: Commit**

~~~bash
git add src/domains/printing src/printing src/App.jsx
git commit -m "refactor: establish printing domain rules"
~~~

Task completion gate: focused tests above plus existing shared/printContextPolicy.test.js and worker/printContextPolicy.test.js all GREEN.

---

### Task 2: Move Printing HTTP ownership out of src/api/client.js

**Files:**
- Create: src/domains/printing/infrastructure/printingApi.js
- Create: src/domains/printing/infrastructure/printingApi.test.js
- Modify: src/api/client.js
- Modify: src/api/client.test.js
- Remove/replace Printing-specific tests under src/api/: printingClient.test.js, printingHeartbeatClient.test.js, printingPriorityClient.test.js, printingReprintClient.test.js, qzClient.test.js, tableTabClient.test.js only after equivalent assertions exist in the new test.
- Modify: current Printing production consumers to import the new API internally; do not route external domains through printingApi.

**Interfaces:**
- Produces the existing function names and signatures exactly:
  getPrintSettings, savePrintSettings, getPrintStations, upsertPrintStation, heartbeatPrintStation, makePrimaryPrintStation, getPrintJobs, getPrintQueueSummary, createPrintAttempt, markPrintAttemptSubmitting, recordPrintAttemptEvent, resolvePrintOutcome, setPrintStationRecovery, claimNextRecoveryPrintJob, discardPendingPrintJobs, createManualPrintJob, createManualTableTabPrintJob, createTestPrintJob, claimNextPrintJob, claimPrintJob, acknowledgeSecondCopyPrompt, requestSecondCopy, skipSecondCopy, completePrintJob, failPrintJob, retryPrintJob, discardPrintJob, prioritizePrintJob, forcePrintJob, reprintPrintJob, getOrderPrintDocument, getTableTabPrintDocument, getQzCertificate, signQzPayload.
- Consumes: apiRequest, apiTextRequest and withJson from src/infrastructure/api/httpClient.js.

- [ ] **Step 1: Write the failing API ownership tests**

Create printingApi.test.js importing from the new path and copy the current route/payload assertions. Include these exact safety assertions:

~~~js
assert.deepEqual(JSON.parse(reprintCall.options.body), { copies: 2 })
assert.equal(Object.hasOwn(JSON.parse(reprintCall.options.body), 'stationId'), false)

assert.deepEqual(JSON.parse(heartbeatCall.options.body), {
  qzReady: true,
  printerReady: true,
})
~~~

Add a negative contract in src/api/client.test.js:

~~~js
for (const name of ['getPrintJobs', 'claimPrintJob', 'reprintPrintJob', 'getQzCertificate', 'signQzPayload']) {
  assert.equal(Object.hasOwn(client, name), false)
}
~~~

- [ ] **Step 2: Run RED**

Run:

~~~bash
node --test src/domains/printing/infrastructure/printingApi.test.js src/api/client.test.js
~~~

Expected: new module missing and/or legacy exports still present.

- [ ] **Step 3: Move API implementations unchanged**

printingApi.js starts with:

~~~js
import { apiRequest, apiTextRequest, withJson } from '../../../infrastructure/api/httpClient.js'
~~~

Copy the current URLSearchParams ordering and payload construction exactly. Do not change endpoint strings.

- [ ] **Step 4: Remove Printing exports from src/api/client.js and align consumers**

Remove the entire Printing API block, including table-tab print helpers and QZ certificate/sign helpers, only after all current Printing consumers point to printingApi.js.

- [ ] **Step 5: Run GREEN and API regressions**

Run:

~~~bash
node --test   src/domains/printing/infrastructure/printingApi.test.js   src/api/client.test.js   src/api/orderCancellation.test.js   src/api/financeClientContract.test.js
~~~

Expected: PASS and no Printing-specific export remains in src/api/client.js.

- [ ] **Step 6: Commit**

~~~bash
git add src/domains/printing/infrastructure src/api src/printing
git commit -m "refactor: move printing api into domain"
~~~

---

### Task 3: Isolate qz-tray under src/infrastructure/qz

**Files:**
- Create: src/infrastructure/qz/qzTransport.js
- Create: src/infrastructure/qz/qzTransport.test.js
- Create: src/infrastructure/qz/qzStatusMonitor.js
- Create: src/infrastructure/qz/qzStatusMonitor.test.js
- Create: src/infrastructure/qz/qzPrintAttemptController.js
- Create: src/infrastructure/qz/qzPrintAttemptController.test.js
- Create: src/infrastructure/qz/qzLocalPreferences.js
- Create: src/infrastructure/qz/qzLocalPreferences.test.js
- Migrate tests from src/printing/qzTrayTransport.test.js, qzStatusMonitor.test.js, qzPrintAttemptController.test.js
- Do not remove the allowlist exception yet; Task 9 owns permanent enforcement after the manager no longer imports qz-tray.

**Interfaces:**
- Consumes: getQzCertificate and signQzPayload callbacks supplied by Printing application.
- Produces: createQzTransport interface defined above.
- qzPrintAttemptController keeps executeQzPrintAttempt(args) semantics exactly.

- [ ] **Step 1: Write the failing concrete adapter test**

~~~js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createQzTransport } from './qzTransport.js'

test('qz transport hides qz-tray behind one injected adapter', async () => {
  const calls = []
  const qzApi = fakeQzApi(calls)
  const transport = createQzTransport({
    qzApi,
    getCertificate: async () => 'CERT',
    signPayload: async () => 'SIGNATURE',
    storage: new MapStorage(),
  })

  transport.configureSecurity()
  await transport.connect()
  assert.deepEqual(await transport.listPrinters(), ['MPT-II'])
  assert.equal(await transport.resolvePrinter('MPT-II'), 'MPT-II')
})
~~~

Add an adapter source contract asserting this is the only new production file that imports qz-tray.

- [ ] **Step 2: Run RED**

~~~bash
node --test src/infrastructure/qz/qzTransport.test.js
~~~

Expected: FAIL because src/infrastructure/qz does not exist.

- [ ] **Step 3: Implement createQzTransport and move current QZ modules**

qzTransport.js owns the package import:

~~~js
import qz from 'qz-tray'
import { createQzStatusMonitor } from './qzStatusMonitor.js'
import {
  getQzPrinterName,
  saveQzPrinterName,
  clearQzPrinterName,
} from './qzLocalPreferences.js'

export const createQzTransport = ({
  getCertificate,
  signPayload,
  storage = globalThis.localStorage,
  qzApi = qz,
} = {}) => {
  const readiness = createQzReadinessController()
  return {
    kind: 'qz',
    configureSecurity: () => configureQzSecurity({ qzApi, getCertificate, signPayload }),
    isConnected: () => Boolean(qzApi.websocket?.isActive?.()),
    connect: () => ensureQzConnected(qzApi),
    onClosed: (callback) => qzApi.websocket?.setClosedCallbacks?.([callback]),
    readiness,
    listPrinters: () => listQzPrinters(qzApi),
    resolvePrinter: (name) => resolveQzPrinter(qzApi, name),
    print: (printerName, bytes, options) => printQzRawBytes(qzApi, printerName, bytes, options),
    createStatusMonitor: (args) => createQzStatusMonitor({ qzApi, ...args }),
    readPrinterName: (stationId) => getQzPrinterName(storage, stationId),
    savePrinterName: (stationId, name) => saveQzPrinterName(storage, stationId, name),
    clearPrinterName: (stationId) => clearQzPrinterName(storage, stationId),
  }
}
~~~

The exact print method may instead bind printerName earlier if that keeps the manager smaller; whichever shape is chosen must stay fixed for Tasks 4–9.

- [ ] **Step 4: Preserve unknown-outcome behavior**

Move executeQzPrintAttempt verbatim first. Add/retain the critical test:

~~~js
const result = await executeQzPrintAttempt({
  ...args,
  sendBytes: async () => {},
  awaitOutcome: async () => { throw Object.assign(new Error('lost'), { code: 'QZ_OBSERVATION_LOST' }) },
})
assert.equal(result.status, 'unknown')
assert.equal(markUnknownCalls, 1)
assert.equal(resendCalls, 0)
~~~

- [ ] **Step 5: Preserve printer readiness classification**

Retain explicit tests:
- OK → ready
- OFFLINE → printer_offline
- PAPER/ERROR/INTERVENTION → printer_attention
- unknown → verifying

- [ ] **Step 6: Run GREEN**

~~~bash
node --test   src/infrastructure/qz/qzTransport.test.js   src/infrastructure/qz/qzStatusMonitor.test.js   src/infrastructure/qz/qzPrintAttemptController.test.js   src/infrastructure/qz/qzLocalPreferences.test.js
~~~

Expected: PASS.

- [ ] **Step 7: Commit**

~~~bash
git add src/infrastructure/qz src/printing
git commit -m "refactor: isolate qz transport infrastructure"
~~~

---

### Task 4: Move usePrintingManager into Printing application and inject QZ transport

**Files:**
- Create: src/domains/printing/application/physicalOperation.js
- Create: src/domains/printing/application/physicalOperation.test.js
- Create: src/domains/printing/application/printingPlatform.js
- Create: src/domains/printing/application/printingPlatform.test.js
- Create: src/domains/printing/application/printJobRunner.js
- Move/align: src/printing/printJobRunner.test.js
- Create: src/domains/printing/application/usePrintingManager.js
- Create/move: src/domains/printing/application/usePrintingManager.test.js
- Create: src/domains/printing/infrastructure/printingLocalPreferences.js
- Create: src/domains/printing/infrastructure/printingLocalPreferences.test.js
- Modify: src/domains/printing/index.js transitional public exports
- Modify: all current production consumers of usePrintingManager
- Legacy src/printing/usePrintingManager.js may remain only as a temporary compatibility facade during this task if required by tests; if created, ledger it for removal in Task 8.

**Interfaces:**
- usePrintingManager signature stays:
  usePrintingManager({ authenticated = false, isOnline = true, onPhysicalJobFailure } = {})
- It internally creates QZ transport with printingApi.getQzCertificate/signQzPayload.
- Returned properties/methods remain current ones and add rememberOriginOrder(orderId).
- printJobRunner consumes executeQzPrintAttempt from src/infrastructure/qz/qzPrintAttemptController.js.

- [ ] **Step 1: Write RED for new manager owner**

New test imports:

~~~js
import {
  usePrintingManager,
  canConsumeAutomaticPrintJob,
} from '../index.js'
~~~

Add source assertions:

~~~js
assert.doesNotMatch(managerSource, /from ['"]qz-tray['"]/)
assert.match(managerSource, /createQzTransport/)
assert.match(managerSource, /PRINT_JOB_POLL_MS = 2_000/)
assert.match(managerSource, /PRINT_STATE_POLL_MS = 5_000/)
assert.match(managerSource, /STATION_HEARTBEAT_MS = 15_000/)
~~~

- [ ] **Step 2: Run RED**

~~~bash
node --test src/domains/printing/application/usePrintingManager.test.js
~~~

Expected: FAIL because application manager path/public export does not exist.

- [ ] **Step 3: Extract physical-operation helpers**

physicalOperation.js owns:
- runExclusivePrintOperation
- createPhysicalJobFailureNotifier

Keep PRINT_OPERATION_BUSY behavior exactly.

- [ ] **Step 4: Split local preferences**

printingLocalPreferences.js owns:
- delivery-print-station-id
- printing-origin-order-ids

printingPlatform.js owns detectPrintStationPlatform(userAgent = globalThis.navigator?.userAgent || '') and detectPrintStationUiPlatform(userAgent = globalThis.navigator?.userAgent || ''). This keeps browser user-agent access out of the pure domain.

qzLocalPreferences owns:
- delivery-qz-printer-name:<stationId>

Add:

~~~js
export const rememberOriginOrderId = (orderId, storage = globalThis.localStorage) => {
  const ids = readOriginOrderIds(storage)
  if (orderId) ids.add(orderId)
  storage?.setItem?.(ORIGIN_ORDER_IDS_STORAGE_KEY, JSON.stringify([...ids]))
  return ids
}
~~~

Preserve current best-effort behavior if storage throws for origin IDs; preserve explicit DEVICE_STORAGE_UNAVAILABLE semantics for printer preference writes.

- [ ] **Step 5: Migrate manager to adapter calls**

Replace direct qz references with one concrete transport instance. No rule should change.

Critical stale-generation test:

~~~js
test('late printer resolution after manager generation change never persists the stale selection', async () => {
  // block transport.connect(), unmount/reinitialize manager, release old promise
  // assert savePrinterName was not called for the stale generation
})
~~~

Retain the combined eligibility guard matrix for authenticated, app online, navigator online, visible page, primary station, autoPrintEnabled, transportReady, qzConnected and physicalReady.

- [ ] **Step 6: Add rememberOriginOrder to manager**

~~~js
const rememberOriginOrder = useCallback((orderId) => {
  const next = rememberOriginOrderId(orderId)
  setOriginOrderIds(next)
  return next
}, [])
~~~

Expose originOrderIds only to internal Printing UI if needed; external App needs only rememberOriginOrder(orderId).

- [ ] **Step 7: Run focused GREEN**

~~~bash
node --test   src/domains/printing/application/physicalOperation.test.js   src/domains/printing/application/usePrintingManager.test.js   src/domains/printing/application/printJobRunner.test.js   src/infrastructure/qz/qzPrintAttemptController.test.js   src/domains/printing/domain/printRecovery.test.js
~~~

Expected: PASS, including recovery affinity and no overlapping physical operations.

- [ ] **Step 8: Commit**

~~~bash
git add src/domains/printing src/infrastructure/qz src/printing
git commit -m "refactor: move printing manager into domain"
~~~

---

### Task 5: Move PrintQueue and queue projections into Printing UI

**Files:**
- Create/move: src/domains/printing/ui/PrintQueue.jsx
- Create/move: src/domains/printing/ui/printQueueDetails.js
- Create/move: src/domains/printing/ui/printQueueFilters.js
- Create/move: src/domains/printing/ui/printQueueQuery.js
- Create/move: src/domains/printing/ui/printQueueSummary.js
- Move/align: src/pages/PrintQueue.test.js and src/pages/printQueueQuery.test.js to Printing UI tests
- Modify: src/App.jsx to import PrintQueue from domains/printing/index.js
- Keep src/print-queue.css in its existing path during this task if moving it would change cascade; CSS ownership is handled in Task 8 only if safe.

**Interfaces:**
- PrintQueue props stay observationally identical:
  orders, printing, onOpenPrintingSettings, onToast, queryState, onQueryChange, canExecutePrinting, canDiscardPrinting.
- Reads list/summary through Printing API, not src/api/client.js.

- [ ] **Step 1: Write RED for new owner**

~~~js
const { default: PrintQueue } = await harness.load('/src/domains/printing/ui/PrintQueue.jsx')
~~~

Add an ownership test requiring the legacy src/pages/PrintQueue.jsx not to be the positive owner after GREEN.

- [ ] **Step 2: Run RED**

~~~bash
node --test src/domains/printing/ui/PrintQueue.test.js
~~~

Expected: FAIL because the new UI path does not exist.

- [ ] **Step 3: Move queue UI/projections and update imports**

Use printingApi.getPrintJobs/getPrintQueueSummary. Keep all labels, modal actions, action order and refresh interval (10 seconds) unchanged.

- [ ] **Step 4: Preserve queue behavioral coverage**

Focused tests must cover:
- desktop row and mobile card opening same details;
- filters/search/sort/page query behavior;
- immutable ticket preview;
- request/skip second-copy toasts;
- unknown outcome language;
- priority/discard/retry/force/reprint actions;
- recovery banner;
- no qz or claim calls in the UI.

Run:

~~~bash
node --test   src/domains/printing/ui/PrintQueue.test.js   src/domains/printing/ui/printQueueQuery.test.js   src/printing/printingUi.test.js
~~~

Expected: PASS after moving any stale path assertions.

- [x] **Step 5: Commit**

~~~bash
git add src/domains/printing/ui src/pages src/App.jsx
git commit -m "refactor: move print queue into printing domain"
~~~

---

## Execution checkpoint after Task 5 — 2026-09-19

- Tasks 1–5 are **COMPLETE / GREEN**.
- Task 2: RED `7f6a6ee2...` / #1477 → GREEN `6329ea54...` / #1478 SUCCESS.
- Task 3: RED `13524d01...` / #1479 → GREEN `4674f78a...` / #1481 SUCCESS.
- Task 4: RED `fcefaa8e...` / #1482 → GREEN `17db6f5c...` / #1485 SUCCESS.
- Task 5: RED `8ab81d7a...` / #1486 → GREEN `154d934b...` / #1488 SUCCESS.
- Latest executable suite: **1,870 tests / 1,869 pass / 0 fail / 1 skipped**; architecture/lint/build/both Worker dry-runs/local D1/Spec B D1 green.
- Ruling: Printing public React UI uses a node-safe surface wrapper (`ui/printingSurfaces.js`) matching the existing Catalog/Orders/Finance/Table Service pattern.
- Ruling: `DEFAULT_PRINT_QUEUE_QUERY` is a real public contract because `app/navigation/queryContext.js` consumes it; keep it in the final public entry rather than deep-importing or duplicating it.
- Temporary C9 facades are tracked in the compatibility ledger; no new untracked facade is allowed.
- Task 6 is **NOT STARTED**.
- Staging: NO. Merge: NO. Production: NO.

---

### Task 6: Move Printing policy and Settings UI ownership

**Files:**
- Create/move: src/domains/printing/infrastructure/printingPolicy.js
- Create: src/domains/printing/infrastructure/printingPolicy.test.js
- Create/move: src/domains/printing/ui/PrintingSettingsContent.jsx
- Move: src/printing/printing.css → src/domains/printing/ui/printing.css
- Move/align: src/components/PrintingSettings.test.js, PrintingSettingsRedesign.test.js, PrintingConflictRecovery.test.js as appropriate
- Modify: src/app/surfaces/settings/policies/registry.js
- Modify: src/app/surfaces/settings/SettingsSurface.jsx
- Keep: src/app/surfaces/settings/printingSettingsAdapter.js as thin composition bridge
- Delete src/components/PrintingSettings.jsx only in Task 8 after consumer audit confirms none.

**Interfaces:**
- Public entry adds printingPolicy, stationConfigurationPolicy, stationPrimaryPolicy and PrintingSettingsContent.
- Generic policyEditing remains in app.
- SettingsSurface imports all Printing contracts only from domains/printing/index.js.

- [x] **Step 1: Write RED for policy ownership**

~~~js
import {
  printingPolicy,
  stationConfigurationPolicy,
  stationPrimaryPolicy,
  PrintingSettingsContent,
} from '../index.js'

assert.equal(printingPolicy.id, 'printingPolicy')
assert.equal(stationConfigurationPolicy.id, 'stationConfiguration')
assert.equal(stationPrimaryPolicy.id, 'stationPrimary')
~~~

- [x] **Step 2: Add current copy-policy safety test**

Assert the UI still binds the independent fields:

~~~js
assert.match(settingsSource, /orderDefaultCopies/)
assert.match(settingsSource, /tableTabDefaultCopies/)
assert.match(settingsSource, /Apenas novas solicitações de impressão/)
~~~

- [x] **Step 3: Run RED**

~~~bash
node --test   src/domains/printing/infrastructure/printingPolicy.test.js   src/domains/printing/ui/PrintingSettingsContent.test.js
~~~

Expected: FAIL because ownership has not moved.

- [x] **Step 4: Move the policies and update registry**

registry.js becomes:

~~~js
import { cancellationReasonsPolicy, operationsPolicy } from '../../../../domains/orders/index.js'
import { financeCategoriesPolicy, paymentMethodsPolicy } from '../../../../domains/finance/index.js'
import {
  printingPolicy,
  stationConfigurationPolicy,
  stationPrimaryPolicy,
} from '../../../../domains/printing/index.js'
~~~

Do not move createPathPolicyAdapter or policyEditing engine.

- [x] **Step 5: Move PrintingSettingsContent and keep three-resource independence**

Move printing.css with PrintingSettingsContent and keep the CSS import at the same component boundary so bundle order remains equivalent. Verify the existing semantic-token/responsive tests after the move.

Preserve:
- business policy card;
- station card;
- local QZ/central queue card;
- explicit make-primary confirmation;
- no saveAll transaction;
- queue-only hiding physical controls;
- physical status labels;
- responsive CSS.

- [x] **Step 6: Review Focus policy-change test**

Add a cross-runtime characterization proving resolver behavior and that UI edits do not mutate an already-created job fixture's copiesRequested.

- [x] **Step 7: Run GREEN**

~~~bash
node --test   src/domains/printing/infrastructure/printingPolicy.test.js   src/domains/printing/ui/PrintingSettingsContent.test.js   src/app/surfaces/settings/SettingsSurface.test.js   src/app/surfaces/settings/printingSettingsAdapter.test.js   shared/printContextPolicy.test.js   worker/printContextPolicy.test.js
~~~

Expected: PASS.

- [x] **Step 8: Commit**

~~~bash
git add src/domains/printing src/app/surfaces/settings src/components
git commit -m "refactor: move printing settings ownership"
~~~

---

## Execution checkpoint after Task 6 — 2026-09-19

- Task 6 is **COMPLETE / GREEN**. Task 7 is **NOT STARTED**.
- Pre-task documentary reconciliation: `4ab00cc81ad3098fbf33a411f400a4c6fcb15822`; Validate #1490 / run `35482571979` SUCCESS.
- RED: `c95f2509083aad63f47443065d28363cf6c01a80`; Validate #1491 / run `35482680005` failed with exactly **5 intended ownership failures**; totals **1,876 / 1,870 / 5 / 1**.
- GREEN: `a02b9af0612353e445bf3997095da18bff2e5118`; Validate #1492 / run `35482900556` — **SUCCESS**, **1,876 / 1,875 / 0 / 1**; architecture/lint/build/both Worker dry-runs/local D1/Spec B D1 green.
- Printing owns the three versioned Printing policies plus `PrintingSettingsContent` and `printing.css`; Settings consumes these through the Printing public entry.
- The approved `printingSettingsAdapter.js` composition bridge remains in Settings, and `src/components/PrintingSettings.jsx` remains until Task 8.
- Independent order/table copy defaults and immutable existing-job copy snapshots remain covered with no behavioral change.
- No staging, physical QA, merge or production deployment has occurred.

---

### Task 7: Extract second-copy/recovery overlays from App

**Files:**
- Create: src/domains/printing/application/usePrintingOverlays.js
- Create: src/domains/printing/application/usePrintingOverlays.test.js
- Create: src/domains/printing/ui/PrintingOverlays.jsx
- Create: src/domains/printing/ui/PrintingOverlays.test.js
- Modify: src/domains/printing/index.js
- Modify: src/App.jsx
- Modify App printing characterization tests that currently inspect second-copy/recovery source ownership.

**Interfaces:**
- PrintingOverlays props are exactly the interface listed above.
- usePrintingManager.rememberOriginOrder(orderId) replaces App localStorage ownership after a new order commit.
- App retains only composition and feedback callbacks.

- [x] **Step 1: Write RED for overlays owner**

~~~js
import { PrintingOverlays } from '../index.js'

assert.equal(typeof PrintingOverlays, 'function')
~~~

Source contract:

~~~js
for (const token of [
  'secondCopyPromptJobId',
  'originSecondCopyPromptJobId',
  'recoveryDialogMode',
  'pausedRecoverySecondCopyJobIdRef',
  'canPresentSecondCopyPrompt',
  'canKeepSecondCopyPromptOpen',
]) {
  assert.equal(appSource.includes(token), false)
}
~~~

Expected RED because App still owns these.

- [x] **Step 2: Move in-memory prompt/recovery state into usePrintingOverlays**

The hook owns:
- selected second-copy prompt;
- origin prompt;
- busy flags;
- recovery dialog mode;
- recovery discard confirm;
- dismissed origin job IDs;
- recovery prompt seen;
- paused recovery second-copy ID;
- previous recovery state.

It derives current jobs/orders from props and printing.

- [x] **Step 3: Preserve deferred recovery affinity**

Add exact regression:

~~~js
const station = {
  id: 'kitchen-primary',
  recoveryState: 'deferred',
  recoveryJobId: 'job-a',
}
const jobs = [
  { id: 'job-a', status: 'awaiting_second_copy', copiesRequested: 2, copiesPrinted: 1 },
  { id: 'job-b', status: 'pending', copiesRequested: 1, copiesPrinted: 0 },
]
// reopening/resuming chooses job-a copy 2 before job-b
~~~

- [x] **Step 4: Move dialog rendering into PrintingOverlays**

Preserve exact functional copy:
- Impressora disponível novamente
- Via impressa
- Descartar N trabalhos?
- 1ª via impressa
- Imprimir 2ª via
- Parar por agora / Depois
- Solicitar 2ª via

No redesign.

- [x] **Step 5: Replace App new-order storage call**

Change:

~~~js
setOriginOrderIds(rememberOriginOrderId(order.id, window.localStorage))
~~~

to:

~~~js
printing.rememberOriginOrder(order.id)
~~~

App does not import the storage helper.

- [x] **Step 6: Render one PrintingOverlays composition point**

App renders:

~~~jsx
<PrintingOverlays
  printing={printing}
  orders={orders}
  authenticated={authState === 'authenticated'}
  canExecutePrinting={canExecutePrinting}
  canDiscardPrinting={canDiscardPrinting}
  onError={showApiError}
  onSuccess={showSuccessMessage}
/>
~~~

- [x] **Step 7: Run GREEN**

~~~bash
node --test   src/domains/printing/application/usePrintingOverlays.test.js   src/domains/printing/ui/PrintingOverlays.test.js   src/domains/printing/application/usePrintingManager.test.js   src/printing/finalizedOrderSecondCopyPrompt.test.js   src/printRecoveryUi.test.js
~~~

If the final two tests move ownership, update their paths without deleting assertions.

- [x] **Step 8: Commit**

~~~bash
git add src/domains/printing src/App.jsx src/printing src/printRecoveryUi.test.js
git commit -m "refactor: move printing overlays out of app"
~~~

---

## Execution checkpoint after Task 7 — 2026-09-19

- Task 7 is **COMPLETE / GREEN**. Task 8 is **NOT STARTED**.
- RED: `10bc6f08a0b26eeb03291f1077d209dda1a45bb0`; Validate #1494 / run `35483743546` — expected **6 ownership failures**, totals **1,882 / 1,875 / 6 / 1**.
- Production candidate: `8636f66a68b9e3471bcf0191a15ab40bed4d1135`; Validate #1495 / run `35483978407` found only five stale App-ownership characterizations after the extraction.
- Final corrective GREEN: `7a0785ca454ecde0f0f18cce6f1370911c3edc63`; Validate #1496 / run `35484090583` — **SUCCESS**, **1,882 / 1,881 / 0 / 1**; architecture/lint/build/both Worker dry-runs/local D1/Spec B D1 green.
- `usePrintingOverlays` owns prompt/recovery state and recovery affinity; `PrintingOverlays` owns rendering; App retains only public composition and callbacks.
- New-order origin tracking now calls `printing.rememberOriginOrder(order.id)`; App no longer imports the browser-storage compatibility facade.
- Recovery affinity regression proves deferred/reopened copy 2/2 of the current recovery job is handled before another queued job.
- Callback refs preserve the former effect cadence and avoid duplicate prompt ACK from unstable App callback identity.
- No staging, physical QA, merge or production deployment has occurred.

---

### Task 8: Remove legacy Printing owners and tighten the final public entry

**Files:**
- Remove legacy production files under src/printing/**
- Remove: src/pages/PrintQueue.jsx and src/pages/printQueue*.js
- Remove: src/components/PrintingSettings.jsx
- Remove: src/components/PrintingSettingsContent.jsx
- Keep src/print-queue.css at its existing global path in C9; it is not under the legacy src/printing owner and moving it is unnecessary cascade risk.
- Modify all stale test paths/imports.
- Modify: src/domains/printing/index.js to final exports only.
- Modify: docs/superpowers/qa/spec-c-compatibility-facades.md to close any temporary C9 facade introduced in Tasks 1–7.

**Interfaces:**
Final public entry is exactly:

~~~js
export { default as PrintQueue } from './ui/PrintQueue.jsx'
export { default as PrintingSettingsContent } from './ui/PrintingSettingsContent.jsx'
export { default as PrintingOverlays } from './ui/PrintingOverlays.jsx'
export { usePrintingManager } from './application/usePrintingManager.js'
export {
  printingPolicy,
  stationConfigurationPolicy,
  stationPrimaryPolicy,
} from './infrastructure/printingPolicy.js'
~~~

No helper/recovery/QZ/renderer/API exports.

- [ ] **Step 1: Write RED cleanup contract**

Create src/domains/printing/printingPublicContract.test.js:

~~~js
test('printing public entry stays minimal', async () => {
  const mod = await import('./index.js')
  assert.deepEqual(Object.keys(mod).sort(), [
    'DEFAULT_PRINT_QUEUE_QUERY',
    'PrintQueue',
    'PrintingOverlays',
    'PrintingSettingsContent',
    'printingPolicy',
    'stationConfigurationPolicy',
    'stationPrimaryPolicy',
    'usePrintingManager',
  ].sort())
})
~~~

Create printingExtractionContract.test.js asserting legacy production paths do not exist.

- [ ] **Step 2: Run RED**

~~~bash
node --test   src/domains/printing/printingPublicContract.test.js   src/domains/printing/printingExtractionContract.test.js
~~~

Expected: FAIL because temporary exports/legacy paths still exist.

- [ ] **Step 3: Remove legacy files and update all tests**

Do not leave compatibility reexports. A test that referenced the old owner must be moved/aligned to the new owner or changed to a negative legacy assertion.

- [ ] **Step 4: Verify CSS ownership/cascade**

Confirm src/printing/printing.css is gone because it moved in Task 6. Confirm src/print-queue.css remains unchanged at its existing global path. Run the existing Printing Settings and PrintQueue responsive/style source tests to prove no token, breakpoint or action-order regression.

- [ ] **Step 5: Run GREEN**

Run the extraction/public contract tests plus all moved Printing tests.

- [ ] **Step 6: Commit**

~~~bash
git add -A src docs/superpowers/qa/spec-c-compatibility-facades.md
git commit -m "refactor: remove legacy printing owners"
~~~

---

### Task 9: Add permanent C9 architecture enforcement and remove QZ allowlist debt

**Files:**
- Modify: scripts/architecture/check-import-boundaries.mjs
- Modify: scripts/architecture/check-import-boundaries.test.mjs
- Modify: scripts/architecture/legacy-import-allowlist.json
- Modify: src/domains/printing/printingPublicContract.test.js
- Modify: src/domains/printing/printingExtractionContract.test.js

**Interfaces:**
- No production runtime API change.
- Produces permanent rules:
  - external Printing consumers use only index.js;
  - Printing domain pure layer has no React/QZ/infra/UI/browser/fetch;
  - Printing cannot depend on internals of Orders/Finance/Table Service/Customers/Catalog;
  - qz-tray only under src/infrastructure/qz;
  - QZ infra cannot import Printing domain/UI/application internals;
  - App cannot regain Printing overlay/QZ ownership;
  - src/api/client.js cannot regain Printing API exports;
  - legacy owners cannot return.

- [ ] **Step 1: Add failing checker fixtures**

Add separate fixtures for:
1. App → Printing deep import rejected.
2. Settings → Printing deep import rejected.
3. Printing domain → React rejected.
4. Printing domain → qz-tray rejected.
5. Printing → another domain internal rejected.
6. qz-tray outside src/infrastructure/qz rejected.
7. QZ infra → domains/printing/application internal rejected.
8. legacy src/printing owner rejected.
9. src/api/client.js Printing exports rejected.
10. App second-copy/recovery/QZ owner tokens rejected.
11. positive App/Settings → Printing index allowed.
12. positive Printing → shared print contracts allowed.
13. positive Printing application → src/infrastructure/qz public module allowed.

- [ ] **Step 2: Run RED**

~~~bash
node --test scripts/architecture/check-import-boundaries.test.mjs
~~~

Expected: the new negative fixtures fail because C9 rules are absent; positive fixtures pass.

- [ ] **Step 3: Implement checker rules**

Use exact path/pattern sets rather than wildcards that mask future regressions.

For legacy API detection, use the existing exportMentionsAny helper with a C9_PRINTING_API_EXPORTS set containing all names migrated in Task 2.

- [ ] **Step 4: Remove the qzDirectImports allowlist exception**

Final legacy-import-allowlist.json must not list src/printing/usePrintingManager.js. If no other migration debt remains, qzDirectImports is [] or the key is removed according to checker conventions.

Do not add src/infrastructure/qz to the allowlist; it is a first-class allowed location in the checker.

- [ ] **Step 5: Run GREEN**

~~~bash
node --test scripts/architecture/check-import-boundaries.test.mjs
npm run test:architecture
~~~

Expected: PASS and Frontend architecture boundaries: OK.

- [ ] **Step 6: Commit**

~~~bash
git add scripts/architecture src/domains/printing
git commit -m "feat: enforce printing and qz architecture boundaries"
~~~

---

### Task 10: Run the complete candidate gate and diff audit

**Files:**
- No intended production changes.
- Update only docs/superpowers/qa/spec-c9-printing-execution.md and plan checkpoint after evidence is real.

**Interfaces:**
- Consumes final implementation candidate.
- Produces exact candidate SHA, CI run IDs and diff audit.

- [ ] **Step 1: Run/obtain the exact full gate**

Required:

~~~bash
npm ci
npm test
npm run test:architecture
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
~~~

Prefer repository Validate CI as authoritative evidence. Record exact test/pass/fail/skipped counts.

- [ ] **Step 2: Audit the branch diff against 91fb5581...**

Explicitly verify:
- worker/: no functional diff;
- migrations/: no diff;
- .github/workflows/: no diff;
- package.json/package-lock.json: no dependency change;
- shared/printContextPolicy.js: no semantic change;
- shared/printQueue.js/actions: no semantic change unless a characterization-only import move is required;
- polling constants unchanged;
- storage keys unchanged;
- error codes unchanged;
- API URL/method/payload assertions unchanged;
- QZ certificate/sign flow unchanged;
- CSS order/visual behavior unchanged;
- no direct qz-tray import outside src/infrastructure/qz.

- [ ] **Step 3: Verify exact-head evidence**

PR Validate often checks a synthetic merge ref. If workflow_dispatch for the feature SHA is unavailable, compare the tested merge-ref tree to the exact feature HEAD tree and record the evidence honestly, as in C8. Never label a PR event as branch workflow_dispatch.

- [ ] **Step 4: Commit evidence-only docs if needed**

Any docs commit after the candidate changes HEAD and therefore requires its own Validate before staging.

---

### Task 11: Deploy staging and complete functional C9 QA

**Files:**
- Create: docs/superpowers/qa/spec-c9-printing-qa.md
- Update: docs/superpowers/qa/spec-c9-printing-execution.md
- Update: plan checkpoint only with real results.

**Interfaces:**
- Consumes exact validated feature HEAD.
- Produces exact staged SHA and functional QA matrix.

- [ ] **Step 1: Dispatch staging on exact feature branch**

Use .github/workflows/deploy-staging.yml via workflow_dispatch. Do not modify triggers.

Record:
- run ID;
- exact head_sha;
- migration listing/application;
- Worker version;
- readiness attempt;
- login HTTP status.

If HEAD differs from the validated candidate, validate the new SHA before treating it as staged candidate.

- [ ] **Step 2: Execute functional manual matrix**

Start every row PENDING. Record only PASS/FAIL/BLOCKED actually observed.

Minimum matrix:

| # | Case | Expected |
|---:|---|---|
| 1 | PrintQueue desktop light/dark | Current layout and states preserved |
| 2 | PrintQueue mobile | Cards/actions/modal usable |
| 3 | Search | Same order/customer/table matching |
| 4 | Status filter | Current operational statuses |
| 5 | Origin filter | Current trigger semantics |
| 6 | Sort | Immediate client ordering + backend query preserved |
| 7 | Pagination | Current page behavior |
| 8 | Job details | Status/times/station/audit preserved |
| 9 | Immutable ticket preview | Uses job snapshot |
| 10 | Prioritize | Queue priority only; remote device does not print |
| 11 | Discard | History preserved |
| 12 | Retry known failure | Same job, no confirmed-copy duplication |
| 13 | Force print eligible case | Explicit action only |
| 14 | Request second copy remotely | Enqueues request |
| 15 | Skip second copy | Terminal decision, no second output |
| 16 | Unknown → printed | Resolves without resend |
| 17 | Unknown → not printed | Explicit resend only |
| 18 | Reprint one copy | New job |
| 19 | Reprint two copies | New job + second-copy flow |
| 20 | Recovery banner | active/deferred UI preserved |
| 21 | Recovery defer/resume | State preserved |
| 22 | Printing policy order 1/2 | Saves independently |
| 23 | Printing policy table 1/2 | Saves independently |
| 24 | Local no-table | Uses order default |
| 25 | Table-linked order | Uses table default |
| 26 | Existing queued job after policy change | copies_requested unchanged |
| 27 | Station name/settings | Independent save |
| 28 | Make primary | Explicit confirmation |
| 29 | Auto print toggle | Disabled unless primary QZ |
| 30 | QZ printer selection | Existing saved queue retained |
| 31 | Test print UI | Only on eligible QZ station |
| 32 | Queue-only device | No physical controls |
| 33 | Offline | No false success/claim |
| 34 | Logout/login | No stale overlay/busy state resurrected |
| 35 | Restricted capabilities | BLOCKED if no suitable identity |
| 36 | App navigation/orders/history/table-service smoke | Printing actions still available through public contract |
| 37 | UTF-8 / light-dark / responsive smoke | No visual/copy regression |

- [ ] **Step 3: Functional closure rule**

Functional QA requires 0 FAIL / 0 PENDING. Capability-only cases may be accepted BLOCKED if the fixture does not exist. Physical cases are not part of this exception; Task 12 must execute them.

Any code fix requires RED→GREEN, new Validate, new staging and repeat affected cases.

---

### Task 12: Perform mandatory physical QZ QA and close C9 for merge

**Files:**
- Update: docs/superpowers/qa/spec-c9-printing-qa.md
- Update: docs/superpowers/qa/spec-c9-printing-execution.md
- Update: docs/superpowers/qa/spec-c-execution-ledger.md
- Update: docs/superpowers/qa/spec-c-compatibility-facades.md
- Update: docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md
- Update: this plan.
- Update PR body.

**Interfaces:**
- Consumes staging-functional GREEN candidate.
- Produces physical acceptance evidence and pre-merge handoff.
- Does not merge until separate explicit authorization.

- [ ] **Step 1: Execute the physical matrix on the exact staged SHA**

Required real hardware/QZ cases:

| # | Physical case | Required result |
|---:|---|---|
| P1 | Entrega/Retirada default 1 | Exactly one physical copy |
| P2 | Entrega/Retirada default 2 | 1/2 then 2/2 only after decision |
| P3 | Local without table | Follows orderDefaultCopies |
| P4 | Table-linked order default 1 | Exactly one copy |
| P5 | Table-linked order default 2 | 1/2 then 2/2 |
| P6 | Table-tab summary default 1 | Exactly one copy |
| P7 | Table-tab summary default 2 | 1/2 then 2/2 |
| P8 | Explicit copies 1/2 | Explicit value wins |
| P9 | Test print | Exactly one copy |
| P10 | Skip second copy | No 2/2 output |
| P11 | Known retry | Does not repeat confirmed copy |
| P12 | Unknown result | No automatic resend |
| P13 | Reprint | New job, selected 1/2 copies |
| P14 | Change policy with pending job | Old copies_requested preserved |
| P15 | QZ closed/offline | Jobs stay safe |
| P16 | QZ/printer returns | No unsafe backlog dump |
| P17 | Recovery with two jobs | Same job remains affine through 2/2/skip before next |
| P18 | Remote requester | Only primary PC prints |
| P19 | Physical non-ready state | No new claim/send |
| P20 | SPOOLING without COMPLETE | No silent retry/duplicate |

All P1–P20 must be PASS. They are not merge-acceptable BLOCKED cases.

- [ ] **Step 2: Reconcile final docs**

Record:
- last code-changing SHA;
- exact staged/homologated SHA;
- functional QA totals;
- physical QA totals;
- accepted capability BLOCKED, if any;
- no surviving C9 temporary facade;
- qz allowlist debt removed;
- no production deploy.

- [ ] **Step 3: Commit final docs and Validate the exact final HEAD**

After documentation closure, run the full Validate workflow on that exact HEAD. Reconfirm:
- PR head SHA;
- Validate SUCCESS;
- mergeable state;
- no unresolved review thread;
- master unchanged since branch base or resolve any drift before merge.

- [ ] **Step 4: Ask for explicit merge authorization**

Task/spec/plan/QA approval is not merge authorization.

Only after the user explicitly authorizes merge:
- mark PR ready if still draft;
- merge with expected_head_sha protection;
- record merge SHA;
- confirm master at that SHA;
- confirm post-merge Validate on the exact merge SHA.

- [ ] **Step 5: Stop after post-merge validation**

Do not deploy production. Do not start C10 automatically. C10 handoff uses the actual validated post-C9 master.

---

## Spec coverage map

| Spec sections | Plan tasks |
|---|---|
| 1–6 objective/ownership | 1–8 |
| 7 current debt | 1–8 |
| 8–10 structure/public/shared | 1, 5, 6, 8 |
| 11–12 QZ/security | 3–4, 9 |
| 13–15 platform/eligibility/exclusivity | 1, 4 |
| 16 copy policy | 1, 6, 11–12 |
| 17 second copy | 1, 4, 7, 11–12 |
| 18 recovery/affinity | 1, 4, 7, 11–12 |
| 19 unknown outcome | 3–4, 11–12 |
| 20 retry/reprint/force | 4–5, 11–12 |
| 21 heartbeat/readiness | 3–4, 11–12 |
| 22 polling | 4, 10 |
| 23 local storage | 3–4, 10 |
| 24 Settings/policy editing | 6 |
| 25 capabilities | 5–7, 11 |
| 26 offline | 4, 11–12 |
| 27 errors | 3–5 |
| 28 App boundary | 7–9 |
| 29 cross-domain consumers | 5, 7–9 |
| 30–32 UI/rendering | 1, 5–6, 8 |
| 33 API | 2, 9 |
| 34 Worker/schema/migrations | 10 |
| 35 CSS | 5–6, 8, 10 |
| 36 compatibility | 8, 12 |
| 37 architecture | 8–9 |
| 38–40 TDD/gates | 1–10 |
| 41–43 staging/QA | 11–12 |
| 44–47 scope/acceptance/decisions | global constraints, 10–12 |
| 48 self-review | this plan review |

## Plan self-review — 2026-09-19

### Spec coverage

Every normative spec section maps to at least one task above. No spec requirement is deferred outside C9 except explicitly out-of-scope future transport/C10 work.

### Placeholder scan

The forbidden-placeholder scan is clean: every implementation step has a concrete action, command, expected result and/or code shape; no deferred-fill markers or vague test/error-handling instructions remain.

### Type/interface consistency

- createQzTransport is produced in Task 3 and consumed by Task 4.
- printingApi is produced in Task 2 and consumed by Task 4/5.
- usePrintingManager is finalized in Task 4 and consumed by Tasks 5–7.
- rememberOriginOrder(orderId) is produced in Task 4 and consumed in Task 7.
- Printing UI and policies are produced in Tasks 5–7 and exported through the final index in Task 8.
- Task 9 enforces only paths/interfaces already established by Tasks 1–8.
- Task 11/12 consume a fully gated candidate and do not invent implementation interfaces.

### Review Focus coverage

All five Review Focus items have explicit tests or manual cases in their owning tasks:
- stale generation → Task 4;
- SPOOLING/unknown → Tasks 3–4 and P20;
- deferred recovery affinity → Tasks 4/7 and P17;
- policy change/new-context copies → Task 6 plus functional/physical QA;
- connectivity/visibility disagreement → Task 4 plus offline QA.

### Rulings embedded in the plan

1. **Policy adapters are public Printing contracts.** Settings registry is a real consumer, so printingPolicy/stationConfigurationPolicy/stationPrimaryPolicy belong in the final public entry. Cost if wrong: three stable adapter exports remain public until C10 can prove a narrower registry contract.
2. **printingSettingsAdapter stays in Settings.** It is a thin composition bridge over the generic policy engine and the Printing manager; moving it adds no domain value. Cost if wrong: one small Settings-owned adapter remains coupled to Printing public contracts.
3. **Origin-order storage is Printing infrastructure, not QZ infrastructure.** Only printer-name storage belongs to qzLocalPreferences. Cost if wrong: a small local preference helper may be relocated in C10 without changing behavior.
4. **Only Printing Settings CSS moves in C9.** src/printing/printing.css must move with its owner so the legacy src/printing tree can disappear; src/print-queue.css remains global because moving it adds cascade risk without closing a C9 ownership debt. Cost if wrong: C10 may later relocate the global queue stylesheet after a dedicated cascade audit.

## Execution handoff

This plan is not implementation authorization. After user approval, use the selected execution method and start with the preparation checkpoint, not Task 1 code.

For this plan I recommend **Native/inline execution** because the tasks have strong sequential interfaces (API → QZ adapter → manager → UI → overlays → enforcement), and the existing ledger/TDD/CI process has already worked well for C4–C8. A whole-branch fresh review remains required at the end.
