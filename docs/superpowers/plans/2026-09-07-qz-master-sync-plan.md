# QZ Printing Master Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebase the Windows QZ Tray implementation from PR #8 onto the current `master` without regressing the printing, table-management, scheduled-order, or mobile changes already merged after PR #8 branched.

**Architecture:** Start from the current `master` on the isolated branch `integration/qz-printing-master-sync`. Reapply only the QZ-specific delta: QZ dependency, local queue persistence, QZ transport/security, Worker signing endpoints, Windows manager routing, and QZ settings UX. Keep newer `master` implementations for shared printing behavior such as copy progression, test-job rendering, scheduled-order behavior, and table-management wiring.

**Tech Stack:** React 19, Vite 8, Node test runner, Cloudflare Workers/Web Crypto, D1, `qz-tray@2.2.6`, ESC/POS, RawBT.

**Spec:** `docs/superpowers/specs/2026-09-06-windows-qz-silent-printing-design.md`

## Global Constraints

- Do not modify or deploy production.
- Preserve all current `master` behavior added after commit `c906e823fa58bc6a4081e8da492ecb4ff0cce997`.
- Windows uses QZ Tray; Android remains RawBT; other supported platforms retain Web Serial fallback.
- QZ private signing key stays only in Worker secrets.
- Automatic queue claiming requires local transport readiness.
- Existing two-copy continuation and one-line-feed behavior must remain unchanged.
- Staging physical homologation is required before production merge.

---

### Task 1: Restore QZ dependency and isolated transport/storage primitives

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/printing/localPrintStation.js`
- Modify: `src/printing/localPrintStation.test.js`
- Create: `src/printing/qzTrayTransport.js`
- Create: `src/printing/qzTrayTransport.test.js`

**Interfaces:**
- Produces `getQzPrinterName`, `saveQzPrinterName`, `clearQzPrinterName` and QZ connect/discover/resolve/RAW-print helpers.

- [ ] Add the QZ storage and transport tests from PR #8 on top of current `master`.
- [ ] Verify those tests fail because QZ support is absent.
- [ ] Add pinned `qz-tray@2.2.6`, storage helpers, and QZ transport.
- [ ] Verify focused tests pass.

### Task 2: Add authenticated Worker certificate/signing endpoints

**Files:**
- Modify: `src/api/client.js`
- Modify: `src/api/client.test.js`
- Modify: `worker/orderPrintingApi.js`
- Create: `worker/qzSigning.js`
- Create: `worker/qzSigning.test.js`
- Create: `worker/qzSigningRoutes.test.js`

**Interfaces:**
- `GET /api/printing/qz/certificate` returns authenticated certificate text.
- `POST /api/printing/qz/sign` returns SHA-512/RSA signature text for authenticated same-origin requests.
- Client exports `getQzCertificate()` and `signQzPayload(toSign)`.

- [ ] Add focused QZ API/signing tests and verify RED.
- [ ] Add text-response client helper without removing current table/order APIs.
- [ ] Add Worker signing module/routes while preserving current print-job routes.
- [ ] Verify focused signing/API tests GREEN.

### Task 3: Route Windows manager through QZ while preserving current master printing behavior

**Files:**
- Modify: `src/printing/usePrintingManager.js`
- Create: `src/printing/usePrintingManager.test.js`
- Modify: `src/printing/printingManagerRegression.test.js`

**Interfaces:**
- `getPrintingTransportKind('windows') === 'qz'`.
- QZ must be connected and the explicitly saved queue must resolve before `transportReady` becomes true.
- Automatic claim must remain blocked when `transportReady` is false.
- Android remains `rawbt` and fallback remains `web-serial`.

- [ ] Add QZ transport/readiness tests against current manager behavior and verify RED.
- [ ] Integrate QZ imports, lifecycle, explicit queue selection, readiness gating, and RAW dispatch into the current master manager.
- [ ] Preserve current test-job rendering and copy-flow behavior from master.
- [ ] Verify manager/runner/regression tests GREEN.

### Task 4: Restore Windows QZ settings UX without overwriting newer UI changes

**Files:**
- Modify: `src/components/PrintingSettings.jsx`
- Modify: `src/components/PrintingSettings.test.js`
- Modify: `src/printing/printingUi.test.js`

**Interfaces:**
- Windows shows `Driver: QZ Tray`, queue selector, `Configurar impressora`/`Trocar impressora`, and test-print gating.
- Android keeps RawBT copy and behavior.

- [ ] Add QZ UI contract tests to the current tests and verify RED.
- [ ] Add only the QZ-specific settings branch to the current component.
- [ ] Verify printing UI tests GREEN.

### Task 5: Restore runbook and run full integration gate

**Files:**
- Create/restore: `docs/operations/windows-qz-tray-printing.md`

- [ ] Confirm current master already contains the approved bitmap renderer, RawBT transport, two-copy flow, and one-line feed; do not replace newer implementations with older PR snapshots.
- [ ] Restore the Windows/QZ runbook.
- [ ] Run full `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run CI-equivalent Worker bundle/migration validation.
- [ ] Only after all checks are green, move the PR #8 head to the integrated branch state or otherwise update PR #8 to the conflict-free integrated history.
- [ ] Deploy only to staging for physical Windows/QZ and Android/RawBT homologation.

## Self-Review

- QZ runtime, storage, signing, manager, and UI are all covered.
- Newer master behavior is explicitly preserved instead of replacing shared files wholesale.
- No production deployment is authorized by this plan.
- Physical homologation remains the final gate before production.