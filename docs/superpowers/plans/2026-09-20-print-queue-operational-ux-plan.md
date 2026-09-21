# Print Queue Operational UX — Implementation Plan

> **Execution mode:** implement task-by-task with explicit RED → GREEN evidence. Do not collapse semantic-state work and visual polish into one unreviewable commit.

**Status:** **DRAFT — autorrevisado; aguardando aprovação explícita antes da Task 1**

**Goal:** Fazer a Fila de impressão representar o estado operacional da estação principal do negócio, corrigir falsos estados de QZ/impressora em dispositivos queue-only e melhorar a hierarquia mobile, reutilizando a mesma projeção no terceiro card de Configurações → Impressão sem tocar no pipeline físico.

**Architecture:** Introduzir uma projeção pura e React-free dentro de `domains/printing` para resolver estação principal + saúde operacional. A Fila e Settings consomem essa projeção em vez de remontar regras locais. UI/CSS mudam depois da semântica estar provada por testes. QZ, Worker, APIs, storage, heartbeat, jobs, recovery e segunda via permanecem intactos.

**Tech Stack:** React 19, Node 22 / `node:test`, Vite 8, oxlint, Cloudflare Workers/D1, QZ Tray existente.

**Spec:** `docs/superpowers/specs/2026-09-20-print-queue-operational-ux-design.md`

**Implementation branch:** `feature/print-queue-operational-ux`

**Master baseline:** `341881482389e872e6039b42395dbaee92fc81b2` — merge da C10 / PR #54.

**Approved-spec checkpoint:** `007838e8eb5df70b55128621ec93a1c4d1180332`.

---

## 1. Global constraints

- Não desenvolver diretamente em `master`.
- Não fazer deploy de produção.
- Não executar ou alterar o gate físico C9/P1–P20 nesta slice; ele continua `DEFERRED-PRODUCTION` e hard blocker do release candidate final.
- Não modificar Worker, D1, migrations, endpoints ou payloads.
- Não modificar `PRINT_JOB_POLL_MS = 2000`, `PRINT_STATE_POLL_MS = 5000` ou `STATION_HEARTBEAT_MS = 15000`.
- Não modificar criação, claim, complete, fail, retry, reprint, force print ou discard de jobs.
- Não modificar recovery, recovery affinity, unknown-outcome ou state machine de segunda via.
- Não modificar QZ signing/security, transport, spool observer ou renderer ESC/POS.
- Não modificar storage keys de Printing.
- Não transformar nome da impressora em configuração global.
- Preservar `orderDefaultCopies` e `tableTabDefaultCopies`, ambos com 1 ou 2 vias.
- Preservar capabilities existentes.
- Preservar filtros `Impresso` e `Descartado`.
- Não criar uma segunda tela de configurações.
- Não criar compatibility facade/migration allowlist.
- Toda árvore de decisão de saúde deve existir em um único contrato reutilizável; Queue e Settings não podem possuir implementações divergentes.
- Ausência de informação não equivale a offline.
- Saúde de estação secundária não pode derrubar o estado global.
- CSS do cabeçalho mobile deve ser escopado a `.print-queue-page`; não alterar globalmente todas as instâncias de `PageHeader`.

## 2. Current confirmed baseline

Na base atual:

- `src/domains/printing/ui/PrintQueue.jsx` lê `printing.localStation`;
- `getPrintStationSummary(localStation)` expõe Online/Offline, QZ e fila da estação local;
- o card contém `Cozinha PC` hardcoded;
- o banner de indisponibilidade usa `printing.printerHealth` local;
- Android/other usam `transportKind = queue-only`;
- apenas Windows principal QZ envia heartbeat físico;
- `printing.stations` já está disponível no manager;
- a projeção de saúde da estação exposta pelo backend deriva `online` do heartbeat/last-seen e carrega `qzReady`, `printerReady` e estado físico;
- o nome QZ continua local em `delivery-qz-printer-name:<stationId>`;
- Settings já separa policy, station e local printing, portanto será refinado, não duplicado.

## 3. Target contracts

### 3.1 Pure operational state

Create:

`src/domains/printing/domain/printOperationalStatus.js`

Primary API:

~~~js
derivePrintOperationalStatus({
  stations = [],
  localStation = null,
  transportKind = 'queue-only',
  printerState = null,
  qzConnected = false,
  configuredPrinterName = null,
  printerQueueFound = false,
  printerHealth = null,
})
~~~

Return shape:

~~~js
{
  code:
    | 'ready'
    | 'no_primary'
    | 'primary_offline'
    | 'qz_unavailable'
    | 'printer_unconfigured'
    | 'printer_unavailable'
    | 'verifying',
  primaryStation: object | null,
  isLocalPrimary: boolean,
  source: 'local' | 'heartbeat' | 'none',
  physicalState: string | null,
}
~~~

This helper is deterministic and must not:

- import React;
- read browser globals;
- read localStorage;
- call QZ;
- call APIs;
- count jobs;
- produce side effects.

### 3.2 View projection

Create:

`src/domains/printing/ui/printOperationalView.js`

API:

~~~js
buildPrintOperationalView(status, {
  pendingCount = 0,
  localPrinterName = null,
} = {})
~~~

Return:

~~~js
{
  code,
  tone,          // success | warning | danger | neutral
  title,
  description,
  helper,
  primaryStationName,
}
~~~

Queue and Settings must share this mapping so titles/tone/wording do not drift.

### 3.3 Primary resolution

The pure resolver must:

1. use `stations.find(station => station.isPrimary)`;
2. fall back to `localStation` only when `localStation.isPrimary === true`;
3. never promote a secondary local station;
4. return `no_primary` when no principal is known.

### 3.4 Remote precedence

For a viewer that is not the primary physical station:

- missing `health` or non-boolean `health.online` → `verifying`;
- `health.online === false` → `primary_offline`;
- online + `qzReady === false` → `qz_unavailable`;
- online + qz ready + `printerReady === true` → `ready`;
- online + qz ready + `printerReady === false` → `printer_unavailable`;
- missing QZ/printer readiness evidence → `verifying`.

`physicalState` may refine the explanatory copy but must not invent a cause when unavailable.

### 3.5 Local-primary precedence

When `primaryStation.id === localStation.id` and `transportKind === 'qz'`, prefer richer runtime state:

- `printerState === 'connecting'` → `verifying`;
- `printerState === 'disconnected'` → `qz_unavailable`;
- QZ connected + no configured printer → `printer_unconfigured`;
- QZ connected + configured printer + queue not found → `printer_unavailable`;
- queue found + physical `ready` → `ready`;
- queue found + physical `printer_offline` / `printer_attention` → `printer_unavailable`;
- physical `verifying` → `verifying`;
- initial ambiguous state must prefer `verifying`, not a false “offline” or “not configured”.

This task does **not** change how the manager derives those underlying runtime values.

---

## 4. Execution preparation — only after this plan is approved

- [ ] Re-fetch `master` and `feature/print-queue-operational-ux`.
- [ ] Confirm master remains at or descends from `341881482389e872e6039b42395dbaee92fc81b2`.
- [ ] Confirm feature branch contains only expected documentation commits before code begins.
- [ ] Confirm working target is the feature branch, never master.
- [ ] Create/reuse a single **draft PR** to `master`; do not create duplicates.
- [ ] Record the PR number and documentary SHA in `docs/superpowers/qa/print-queue-operational-ux-execution.md`.
- [ ] Let the PR trigger **Validate application** and record run id/result before Task 1.
- [ ] Baseline must be green or any unrelated failure must be investigated before code work.
- [ ] No staging deploy during preparation.
- [ ] No production action.

---

# Task 1 — Introduce the pure operational-status contract

**Purpose:** Prove the semantic fix independently from JSX and CSS.

**Files:**

- Create: `src/domains/printing/domain/printOperationalStatus.js`
- Create: `src/domains/printing/domain/printOperationalStatus.test.js`
- No production UI changes in this task.

### RED

- [ ] Add tests for primary resolution:
  - healthy primary from `stations`;
  - local-primary fallback;
  - secondary local station is never promoted;
  - no primary → `no_primary`.
- [ ] Add remote-health matrix:
  - healthy → `ready`;
  - explicit offline → `primary_offline`;
  - QZ false → `qz_unavailable`;
  - printer false → `printer_unavailable`;
  - missing health → `verifying`.
- [ ] Add explicit Android regression:
  - local Android/queue-only with local QZ values false;
  - remote Windows primary healthy;
  - result **must be `ready`**.
- [ ] Add secondary-offline regression:
  - primary healthy + secondary offline;
  - result stays `ready`.
- [ ] Add local-primary matrix for `connecting`, `disconnected`, unconfigured, queue missing, physical ready/offline/attention/verifying.
- [ ] Run:
  - `node --test src/domains/printing/domain/printOperationalStatus.test.js`
- [ ] Record expected RED reason: module/contract not implemented.

### GREEN

- [ ] Implement the smallest pure resolver satisfying the matrix.
- [ ] Avoid Portuguese copy/UI tone in the domain helper.
- [ ] Do not read `printing.jobs` or pending count here.
- [ ] Run focused test again.
- [ ] Run domain-adjacent regression:
  - `node --test src/domains/printing/domain/*.test.js`
- [ ] Run full `npm test`.
- [ ] Commit only Task 1 code/tests.

**Task 1 acceptance:**

- Android false local QZ cannot override healthy primary heartbeat.
- Unknown is not offline.
- No production UI changed yet.
- No manager/QZ/backend code touched.

---

# Task 2 — Build one shared operational view and integrate Print Queue semantics

**Purpose:** Remove the incorrect local-station presentation from Queue before visual polish.

**Files:**

- Create: `src/domains/printing/ui/printOperationalView.js`
- Create or extend tests: `src/domains/printing/ui/printOperationalView.test.js`
- Modify: `src/domains/printing/ui/PrintQueue.jsx`
- Modify: `src/domains/printing/ui/PrintQueue.test.js`
- Modify: `src/domains/printing/ui/printQueueSummary.js`
- Remove `getPrintStationSummary` if no longer used.

### RED

- [ ] Test view mapping for every canonical status:
  - title;
  - tone;
  - description;
  - pending helper.
- [ ] Test remote ready copy names the primary station, not local viewer.
- [ ] Test local ready view may include configured printer name.
- [ ] Update Queue source/render tests to require:
  - no literal `Cozinha PC`;
  - no old station-health block;
  - status derives from `derivePrintOperationalStatus`;
  - status copy derives from shared view;
  - old banner condition `!physicalReady && summary.pending > 0` is absent;
  - queue still renders four summary counters.
- [ ] Render Queue with:
  - local Android secondary;
  - healthy Windows primary;
  - local printer health not ready;
  - assert UI says **Impressão disponível** and does not say QZ disconnected/offline.
- [ ] Render Queue with explicit remote primary offline + pending jobs and assert affected-jobs messaging.
- [ ] Run focused UI tests and capture RED.

### GREEN

- [ ] Add shared view builder.
- [ ] Replace `getPrintStationSummary(localStation)` use in Queue.
- [ ] Pass manager values to the pure resolver without mutating them.
- [ ] Replace old station card with semantic operational-card markup.
- [ ] Remove old local-only offline banner; backlog impact belongs to the operational view/card.
- [ ] Preserve recovery banner as a separate concern.
- [ ] Delete obsolete `getPrintStationSummary` and its tests rather than leave a compatibility facade.
- [ ] Run:
  - focused Queue/view tests;
  - full `npm test`;
  - `npm run test:architecture`.
- [ ] Commit Task 2 separately.

**Task 2 acceptance:**

- Queue semantics are correct before CSS redesign.
- Jobs/actions/filters are unchanged.
- Recovery remains unchanged.
- Zero compatibility shims.

---

# Task 3 — Mobile-first Print Queue visual hierarchy

**Purpose:** Implement the approved top-of-page UX without changing semantics.

**Files:**

- Modify: `src/domains/printing/ui/PrintQueue.jsx`
- Modify: `src/domains/printing/ui/print-queue.css`
- Modify: `src/domains/printing/ui/PrintQueue.test.js`
- Do not modify global `PageHeader` CSS unless a failing test proves a scoped implementation is impossible.

### RED

- [ ] Add structural/style assertions requiring:
  - compact operational card classes;
  - status tone classes;
  - queue-specific scoped mobile header override;
  - settings button fixed/compact width on mobile;
  - four summary cards remain 2×2 on mobile;
  - zero-value summary class;
  - attention-positive class;
  - no horizontal overflow in the queue-owned sections.
- [ ] Assert the settings button keeps:
  - `aria-label="Configurações, Impressão"` or equivalent;
  - navigation callback to existing settings destination.
- [ ] Assert no global rule change such as making every `.page-actions .button` compact.
- [ ] Run focused test and record RED.

### GREEN

- [ ] Keep `PageHeader` usage unless there is a demonstrated blocker.
- [ ] Scope mobile layout under `.print-queue-page`:
  - title/copy and gear occupy a compact top composition;
  - gear is approximately 36–40 px;
  - text label can remain visually hidden on mobile;
  - desktop keeps readable action text.
- [ ] Style operational status with semantic tokens:
  - success;
  - warning;
  - danger;
  - neutral.
- [ ] Add summary classes from values:
  - `is-zero` for 0;
  - `has-value` for non-zero;
  - `has-attention` when attention > 0.
- [ ] Do not modify `StatCard` globally unless strictly necessary; prefer scoped className.
- [ ] Preserve table/card switch, filters and detail modal.
- [ ] Run focused tests, `npm test`, lint and build.
- [ ] Commit Task 3 separately.

**Task 3 manual review checklist before moving on:**

- mobile first fold is header → operational status → 2×2 summary → jobs;
- gear is no longer a large loose block;
- zero counters are visually quiet;
- attention count is visibly stronger;
- desktop still uses the same information architecture.

---

# Task 4 — Make Printing Settings contextual and reuse the same status projection

**Purpose:** Remove the misleading “Impressora local (QZ Tray)” framing on queue-only devices without creating another settings surface.

**Files:**

- Modify: `src/domains/printing/ui/PrintingSettingsContent.jsx`
- Modify: `src/domains/printing/ui/PrintingSettingsContent.test.js`
- Modify: `src/domains/printing/ui/printing.css` only where required.
- Reuse:
  - `derivePrintOperationalStatus`;
  - `buildPrintOperationalView`.

### RED

- [ ] Queue-only Settings test requires title **Impressão do negócio**.
- [ ] Queue-only healthy-primary fixture requires operational view of primary station.
- [ ] Queue-only test forbids:
  - `Impressora local (QZ Tray)`;
  - `Impressora configurada: Fila central`;
  - local QZ status;
  - Testar impressão;
  - Trocar impressora;
  - printer selector.
- [ ] Queue-only text must state that this station accompanies the central queue and does not execute physical printing.
- [ ] QZ/Windows fixture requires title **Impressão nesta estação** and preserves:
  - configured printer;
  - local health;
  - Testar impressão;
  - Trocar impressora;
  - refresh/save printer flow.
- [ ] Existing policy tests must still prove Pedidos and Mesas/Comandas independently accept 1/2 copies.
- [ ] Existing station tests must still prove principal confirmation and auto-print eligibility behavior.
- [ ] Run focused tests and capture RED.

### GREEN

- [ ] Compute shared operational state/view once near the current Settings derived values.
- [ ] For `isQz`:
  - render local physical controls and local printer identity;
  - keep all current action handlers/adapters.
- [ ] For queue-only:
  - render central operational status;
  - show primary station name when known;
  - show waiting counts;
  - explain no local physical execution.
- [ ] Do not change `printingSettingsAdapter.js` unless a test demonstrates a missing existing contract.
- [ ] Do not add a diagnosis route.
- [ ] Run focused tests, full tests and architecture check.
- [ ] Commit Task 4 separately.

**Task 4 acceptance:**

- Queue and Settings share one status tree.
- QZ controls remain only where meaningful.
- Policy/station resources remain independent.

---

# Task 5 — Regression hardening, accessibility and stale-state cases

**Purpose:** Ensure the UX fix does not create misleading edge states or regress operational controls.

**Files:**

- Extend:
  - `src/domains/printing/domain/printOperationalStatus.test.js`
  - `src/domains/printing/ui/printOperationalView.test.js`
  - `src/domains/printing/ui/PrintQueue.test.js`
  - `src/domains/printing/ui/PrintingSettingsContent.test.js`
- Modify production code only for failures found by these tests.

### Required edge cases

- [ ] stations empty + local secondary → `no_primary`, not offline.
- [ ] primary known but health absent → `verifying`.
- [ ] primary online but readiness fields absent → `verifying`.
- [ ] primary online + qz false → qz warning.
- [ ] primary qz ready + printer not ready + no specific physical cause → generic printer unavailable.
- [ ] local primary `connecting` does not flash “impressora não configurada”.
- [ ] local primary `disconnected` reports QZ unavailable.
- [ ] local primary QZ connected + no configured printer reports unconfigured.
- [ ] local primary configured + printer health `printer_attention` reports printer unavailable/attention copy.
- [ ] secondary offline is ignored while primary is ready.
- [ ] pending=0 vs pending>0 changes urgency/helper but not canonical code.
- [ ] recovery banner still renders and actions remain wired.
- [ ] offline app mutation guard remains unchanged.
- [ ] execute/discard capability guards remain unchanged.
- [ ] history filters still include `Impresso` and `Descartado`.
- [ ] settings gear retains keyboard/focus accessible button semantics.
- [ ] status includes text, not color-only semantics.
- [ ] no literal `undefined` / `null` leaks into UI copy.

### Gates

- [ ] `npm test`
- [ ] `npm run test:architecture`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Commit only actual hardening changes, if any; if no production changes are needed, use a test-only commit.

---

# Task 6 — Documentary closure, PR gates and staging deployment

**Purpose:** Prepare a reviewable release candidate for functional QA while keeping production blocked.

**Files:**

- Create/update: `docs/superpowers/qa/print-queue-operational-ux-execution.md`
- Update this plan status/evidence.
- Update PR body.

### Before staging

- [ ] Ensure branch is clean and pushed.
- [ ] Ensure no migration/backend/Worker production behavior files were changed unexpectedly.
- [ ] Compare branch against master and review changed-file list.
- [ ] Confirm no compatibility facade or allowlist was introduced.
- [ ] Confirm the exact code SHA under test.
- [ ] Validate PR through **Validate application**:
  - npm tests;
  - frontend architecture;
  - lint;
  - build;
  - Worker production dry-run;
  - Worker staging dry-run;
  - local D1 migrations;
  - Spec B D1 clean install/upgrade.
- [ ] Require SUCCESS before staging.

### Staging

- [ ] Deploy **staging only** through the project’s existing deployment procedure.
- [ ] Record staging SHA/deployment id.
- [ ] Do not run production deploy or production migrations.

### Manual QA — Android / queue-only

- [ ] Open Fila de impressão.
- [ ] Gear is compact beside/near title, not a full-width loose button.
- [ ] No false local `QZ desconectado`.
- [ ] Status reflects Windows primary.
- [ ] Healthy primary displays **Impressão disponível**.
- [ ] Verify pending counters.
- [ ] Verify attention hierarchy.
- [ ] Open Settings through gear.
- [ ] Third card says **Impressão do negócio**.
- [ ] It names primary when available.
- [ ] It explains this device does not physically print.
- [ ] No Testar/Trocar printer controls.

### Manual QA — Windows primary

- [ ] Queue shows coherent local operational state.
- [ ] Configured printer name may be shown locally.
- [ ] Settings third card says **Impressão nesta estação**.
- [ ] Testar impressão control still exists.
- [ ] Trocar impressora flow still exists.
- [ ] Do **not** convert this functional check into completion of physical C9/P1–P20 unless the final RC/hardware gate is explicitly being executed.

### Manual QA — responsive/theme

- [ ] Mobile dark.
- [ ] Mobile light.
- [ ] Desktop dark.
- [ ] Desktop light.
- [ ] No horizontal overflow.
- [ ] 2×2 counters on mobile.
- [ ] 4 counters in one row when desktop width allows.
- [ ] Jobs table/cards/filters/details still work.
- [ ] `Impresso` and `Descartado` history filters still work.

### Closure

- [ ] Record PASS/FAIL/BLOCKED rows.
- [ ] Any physical-only row not executed remains explicitly separate from this slice’s functional QA.
- [ ] Final Validate on the exact homologated SHA.
- [ ] Keep PR draft/open until user authorizes merge.
- [ ] **No merge without explicit authorization.**
- [ ] **No production deployment.**
- [ ] C9/P1–P20 remain `DEFERRED-PRODUCTION`.

---


## 5. Plan self-review

The plan was reconciled against the current post-C10 code before execution.

Confirmed:

- `PrintQueue.jsx` currently has the exact local-station coupling the spec intends to remove.
- `usePrintingManager` already returns every input required by the resolver: `transportKind`, `localStation`, `stations`, `printerState`, `configuredPrinterName`, `qzConnected`, `printerQueueFound` and `printerHealth`.
- No manager API extension is required.
- Remote state can rely on the server-projected `station.health`; no new heartbeat payload is required.
- `PrintingSettingsContent` already receives `printing`, so it can reuse the same resolver/view without changing the Settings adapter.
- `StatCard` already accepts `className`, so zero/attention hierarchy can be implemented without changing the shared component.
- The current global mobile rule makes page-action buttons full width, but a queue-scoped override is sufficient; no shared `PageHeader` API change is required.
- Removing `getPrintStationSummary` is preferred to retaining a dead facade.
- The plan does not require Worker, D1, migrations, QZ infrastructure or App navigation changes.
- The separation between this slice's staging QA and C9/P1–P20 physical QA is explicit.

Review adjustment:

- “online” is not a field produced directly by `buildPrintStationHeartbeatHealth`; the backend station-health projection derives online/offline from heartbeat freshness. The plan therefore treats `primaryStation.health.online` as server-projected state and does not alter heartbeat payloads.

No implementation blocker was found.

---

## 6. Expected commit sequence

Names can vary slightly, but preserve task boundaries:

1. `test/feat: derive print operational status`
2. `feat: use primary operational status in print queue`
3. `style: refine print queue mobile operational layout`
4. `feat: contextualize printing settings status`
5. `test: harden print operational ux regressions` (only if Task 5 creates changes)
6. `docs: close print queue operational ux qa`

Do not squash RED evidence away during task execution. Merge strategy can be decided only at final PR closure.

## 7. Rollback strategy

Because no backend/schema contract changes are allowed, rollback is frontend-only:

- revert Queue semantic/UI commits if operational status presentation fails;
- revert Settings contextual card independently if needed;
- pure resolver/view helper can be removed with their consumers;
- no D1 rollback;
- no QZ storage migration;
- no Worker rollback expected.

A rollback must not alter jobs already created or physical printing state because this slice does not own those transitions.

## 8. Risk review

### Risk A — stale remote heartbeat

Remote health is best-effort. The UI must say what the backend currently knows, not claim physical certainty. Missing data → verifying.

### Risk B — startup flash on local Windows

The manager initializes asynchronously. `printerState=connecting` or ambiguous initial local state must map to verifying rather than false unconfigured/offline.

### Risk C — duplicate status logic

Queue and Settings drifting would recreate the problem. Shared resolver + shared view is mandatory.

### Risk D — global mobile header regression

Existing global CSS makes page-action buttons full width on small screens. Override only under `.print-queue-page`.

### Risk E — accidental physical-scope expansion

Do not “fix” QZ, heartbeat, printer name persistence or backend while working on this UX. Any genuine physical bug discovered becomes a separately documented blocker/change request.

### Risk F — confusing physical gate status

Passing this slice does not mean C9/P1–P20 passed. Documentation must continue to distinguish functional UX QA from final hardware QA.

## 9. Definition of done for this slice

The slice is merge-ready, subject to explicit user authorization, when:

- pure operational resolver tests are green;
- Android healthy-primary regression is green;
- Queue no longer reads local physical health as global truth;
- `Cozinha PC` hardcoded is gone;
- old local-only offline banner is gone;
- mobile header gear is compact and scoped;
- summary hierarchy is approved in staging;
- Settings is contextual without duplicate page/config source;
- QZ Windows controls are preserved;
- queue-only controls are non-physical;
- all automated gates are green;
- staging functional QA is green;
- final Validate is green on exact SHA;
- PR remains unmerged until explicit authorization;
- production remains blocked by C9/P1–P20.
