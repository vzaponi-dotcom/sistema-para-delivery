# Spec C6 Finance and Cross-Domain Payment Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish `domains/finance`, extract order/table-tab payment and refund workflows from `App.jsx`/runtime, remove the operational payment-receipt bridge, and preserve all current finance/payment behavior without backend or UX changes.

**Architecture:** Pure finance rules, finance-specific Settings content, finance APIs, finance UI, and finance commands move under `src/domains/finance`. Cross-domain payment/refund operations live under `src/app/workflows`; app-owned surfaces compose Finance with Orders without creating `finance -> orders` or `finance -> table-service` dependencies. `useOperationalDataRuntime` remains the sole owner of official collections/polling but becomes payment-agnostic.

**Tech Stack:** React 19, Vite 8, Node 22 `node:test`, oxlint, Cloudflare Worker/D1, GitHub Actions, existing Spec B policy editor, existing operational runtime.

**Spec:** `docs/superpowers/specs/2026-09-18-frontend-modularization-c6-finance-workflows-design.md`

## Approved base and branch

- Base `master`: `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`
- Base post-merge Validate: #1342 / run `35401628448` — SUCCESS
- Work branch: `feature/spec-c6-finance-workflows`
- Design approval recorded on this branch before this plan.
- Production deployment: **NO** unless separately authorized.
- Task 1 evidence: RED `9476b0b74d7c18305466eb6079314f8b24d8ae00` → Validate #1344 / run `35403401486` failed for intended missing Finance modules; GREEN `2fa0ce1e27e4992d4eb904cce6a85cbb89ea0eaf` → Validate #1345 / run `35403573350` SUCCESS with **1,729 tests / 1,728 pass / 0 fail / 1 skipped** and all remaining gates green.
- Task 2 evidence: RED `bc52cdb8b60e8c79a6390b51b5b973fbe0ee8ef4` → Validate #1349 / run `35404405552` failed for the intended missing Finance Settings ownership. GREEN candidate `68ba38df6165171686ab91a27550b410df5ba892` → Validate #1350 exposed only stale path contracts and the need for a Node-safe `.js` public surface wrapper. Fix `1f38c21c56af2d2dda7ed292365c9685b5ce6ad5` → Validate #1351 / run `35405016988` SUCCESS with **1,731 tests / 1,730 pass / 0 fail / 1 skipped** and all remaining gates green.
- Task 3 evidence: RED `8bfc9926e6f9718fb461e41f59ce54a351fd2f8d` → Validate #1353 / run `35405851531` failed for the intended missing `cashFlow.js` and `receivables.js` modules. GREEN `54dcbd1ff44f2dc715a469bc60c78c458ac42318` → Validate #1354 / run `35406034390` SUCCESS with **1,745 tests / 1,744 pass / 0 fail / 1 skipped** and all remaining gates green. Ruling: Finance receivable helpers receive `isOrderCancelled`, `isOrderPaid`, and `getPendingAmount` as injected rules instead of importing Orders; this preserves the no-cycle spec and keeps Orders lifecycle ownership intact.
- Task 4 evidence: RED `f5fe1563d871c3cb5135cb06e86be58e80f57877` → Validate #1356 / run `35407256910` failed for the intended missing `financeApi`, `useFinanceCommands`, and `FinanceWorkspace` owners. GREEN candidate `9974799a3440ae9bbe59ba0e80d28c9b70b5112e` → Validate #1357 exposed stale extraction/UI/capability characterizations after the ownership move. Fix `2665e82a97207eb118497b8f3e2cf44cda5ccc39` aligned extraction/UI tests but Validate #1358 still found two capability characterizations tied to App-local handlers. Final fix `f76b223245f1a2fcaaf981694d052365e5ca9ffb` aligned those capability contracts; Validate #1359 / run `35408051011` SUCCESS with **1,750 tests / 1,749 pass / 0 fail / 1 skipped** and all remaining gates green.

## Global Constraints

- Preserve current visual behavior and business behavior; no redesign, new UX, new feature, or deliberate rule change.
- Do not introduce Redux, Zustand, React Router, WebSocket/SSE, or microservices.
- Do not refactor the Worker unless an existing frontend contract cannot be preserved without a minimal backend correction; stop and justify before doing so.
- Backend/bootstrap responses remain the source of truth; no independent official Finance/payment store.
- Keep current polling semantics.
- Keep QZ/printing ownership unchanged; C9 remains responsible for printing.
- Preserve Spec B settings guarantees: explicit save, optimistic revision, conflict review, unknown-result reconciliation, pending recovery, and abandonment guards.
- Preserve accepted-payment reconciliation, stale target protection, double-submit prevention, 409 refresh behavior, movement effects, payment promises, opening balance, and refunds.
- `domains/finance/**` must not import Orders or Table Service internals.
- Cross-domain payment/refund coordination belongs in `app/workflows/**`, never in Finance, Orders, Table Service, or the operational runtime.
- Strict TDD: create a RED that fails for the intended missing boundary/behavior before each implementation task, then prove GREEN.
- Do not accept a RED caused by syntax/parser/test-harness defects.
- Each GREEN task gets a normal commit; never force-push.
- Because `Validate application` is PR-triggered, create/retain a draft PR to `master` before the first code RED so every pushed task SHA can be checked remotely.
- If the execution environment has no trustworthy local worktree, do not claim local command results. Use exact-SHA GitHub runner evidence and record it as runner evidence.
- Do not deploy staging until Tasks 1–10 are GREEN and the full pre-staging gate is green.
- Production remains untouched.

## Target file map

### Finance domain

```text
src/domains/finance/
  index.js
  domain/
    cashFlow.js
    cashFlow.test.js
    receivables.js
    receivables.test.js
    paymentMethods.js
    paymentMethods.test.js
    financeCategories.js
    financeCategories.test.js
  application/
    useFinanceCommands.js
    useFinanceCommands.test.js
  infrastructure/
    financeApi.js
    financeApi.test.js
    paymentMethodsPolicy.js
    financeCategoriesPolicy.js
  ui/
    Finance.jsx
    FinanceWorkspace.jsx
    FinanceWorkspace.test.js
    Receivables.jsx
    Receivables.test.js
    MovementDialog.jsx
    OpeningBalanceDialog.jsx
    PaymentPromiseDialog.jsx
    ReceivableDetail.jsx
    ReceivablesForecastDialog.jsx
    ReceivablesQuickPaymentDialog.jsx
    settings/
      PaymentSettings.jsx
      FinanceCategorySettings.jsx
      paymentSettingsModel.js
```

### App workflows / surfaces

```text
src/app/workflows/
  payments/
    paymentApi.js
    paymentApi.test.js
    order/
      OrderPaymentDialog.jsx
      useOrderPaymentWorkflow.js
      useOrderPaymentWorkflow.test.js
    table-tab/
      TableTabPaymentDialog.jsx
      tableTabPaymentReconciliation.js
      tableTabPaymentReconciliation.test.js
      useTableTabPaymentWorkflow.js
      useTableTabPaymentWorkflow.test.js
  refunds/
    refundApi.js
    refundApi.test.js
    RegisterRefundDialog.jsx
    useRefundWorkflow.js
    useRefundWorkflow.test.js

src/app/surfaces/finance/
  ReceivablesSurface.jsx
  ReceivablesSurface.test.js
```

### Orders extension

```text
src/domains/orders/
  infrastructure/ordersApi.js
  application/useOrderPaymentPromise.js
  application/useOrderPaymentPromise.test.js
  index.js
```

### Permanent enforcement / integration

```text
src/App.jsx
src/app/runtime/data/useOperationalDataRuntime.js
src/app/runtime/data/useOperationalDataRuntime.test.js
src/app/runtime/runtimeExtractionContract.test.js
src/domains/table-service/tableServiceExtractionContract.test.js
src/app/surfaces/settings/SettingsSurface.jsx
src/app/surfaces/settings/policies/registry.js
src/app/surfaces/table-service/TableServiceExternalActions.jsx
scripts/architecture/check-import-boundaries.mjs
scripts/architecture/check-import-boundaries.test.mjs
docs/superpowers/qa/spec-c-compatibility-facades.md
docs/superpowers/qa/spec-c-execution-ledger.md
docs/superpowers/qa/spec-c6-finance-workflows-qa.md
docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md
```

## Execution setup before Task 1

- [ ] Verify exact branch and base:

```bash
git fetch origin
git switch feature/spec-c6-finance-workflows
git status --short
git rev-parse HEAD
git merge-base HEAD origin/master
git rev-parse origin/master
```

Expected before functional code:
- working tree clean;
- branch is `feature/spec-c6-finance-workflows`;
- `origin/master` is `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3` unless GitHub proves an intentional later merge;
- branch contains only approved C6 docs/planning commits beyond that base.

- [x] If PR #50 (or another C6 PR) does not exist, open a **draft** PR from `feature/spec-c6-finance-workflows` to `master`. The PR body must state that it exists early for exact-SHA TDD runner evidence and must not be merged before staging/manual QA and explicit authorization.

- [ ] Run baseline focused/full checks only if a reliable local worktree exists:

```bash
npm test
npm run test:architecture
npm run lint
npm run build
```

Expected: exit 0. If local execution is unavailable, rely on the already-green post-C5 base plus future exact-SHA PR Validate runs; do not fabricate local PASS.

---

### Task 1: Establish the Finance public boundary, payment-method ownership, and finance-category ownership — COMPLETE / GREEN

**Files:**
- Create: `src/domains/finance/index.js`
- Create: `src/domains/finance/domain/paymentMethods.js`
- Create: `src/domains/finance/domain/paymentMethods.test.js`
- Create: `src/domains/finance/domain/financeCategories.js`
- Create: `src/domains/finance/domain/financeCategories.test.js`
- Create: `src/domains/finance/infrastructure/paymentMethodsPolicy.js`
- Create: `src/domains/finance/infrastructure/financeCategoriesPolicy.js`
- Create: `src/domains/finance/financePublicContract.test.js`
- Modify later consumers only enough to prove the new boundary; do not delete legacy utils/policies yet.

**Interfaces:**
- Consumes: `DEFAULT_PAYMENT_METHODS`, `paymentLabel` from `shared/businessPolicies.js`; `createPathPolicyAdapter` from `infrastructure/api/policyHttp.js`.
- Produces:
  - `PAYMENT_METHOD_OPTIONS`
  - `paymentOptionsFromEffective(config)`
  - `paymentDefaultFromEffective(config)`
  - `paymentSelectionNeedsReview(options, value)`
  - `paymentOptionsWithSelection(options, value)`
  - `financeCategoryOptionsFromEffective(config, type?)`
  - `financeCategoryRevisionFromEffective(config)`
  - `financeCategorySelectionNeedsReview(options, type, value)`
  - `financeCategoryOptionsWithSelection(options, type, value, label?)`
  - `paymentMethodsPolicy`
  - `financeCategoriesPolicy`

- [x] **Step 1: Write the RED public-boundary tests**

Create `src/domains/finance/financePublicContract.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

test('Finance exposes payment and finance-category public contracts', async () => {
  const finance = await import('./index.js')
  for (const name of [
    'paymentOptionsFromEffective',
    'paymentDefaultFromEffective',
    'paymentSelectionNeedsReview',
    'paymentOptionsWithSelection',
    'financeCategoryOptionsFromEffective',
    'financeCategoryRevisionFromEffective',
    'financeCategorySelectionNeedsReview',
    'financeCategoryOptionsWithSelection',
    'paymentMethodsPolicy',
    'financeCategoriesPolicy',
  ]) assert.equal(typeof finance[name] === 'function' || typeof finance[name] === 'object', true, name)
})
```

Create `src/domains/finance/domain/paymentMethods.test.js` with the current no-fallback/inactive-selection contract:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  paymentDefaultFromEffective,
  paymentOptionsFromEffective,
  paymentOptionsWithSelection,
  paymentSelectionNeedsReview,
} from './paymentMethods.js'

const config = {
  paymentMethods: {
    methods: [
      { code: 'cash', value: 'Dinheiro', label: 'Dinheiro', active: true },
      { code: 'pix', value: 'Pix', label: 'Pix', active: false },
    ],
    defaultMethod: 'cash',
  },
}

test('effective payment projection preserves ordering and never invents Pix', () => {
  assert.deepEqual(paymentOptionsFromEffective(config), [
    { code: 'cash', value: 'Dinheiro', label: 'Dinheiro' },
  ])
  assert.equal(paymentDefaultFromEffective(config), 'Dinheiro')
  assert.deepEqual(paymentOptionsFromEffective(null), [])
  assert.equal(paymentDefaultFromEffective(null), '')
})

test('inactive open selection is preserved only as a review option', () => {
  const active = paymentOptionsFromEffective(config)
  assert.equal(paymentSelectionNeedsReview(active, 'Transferência'), true)
  assert.deepEqual(paymentOptionsWithSelection(active, 'Transferência')[0], {
    value: 'Transferência', label: 'Transferência (inativo)', code: null, inactive: true,
  })
})
```

- [x] **Step 2: Run RED**

```bash
node --test src/domains/finance/financePublicContract.test.js src/domains/finance/domain/paymentMethods.test.js
```

Expected: FAIL because `src/domains/finance/index.js` and domain modules do not exist.

- [x] **Step 3: Commit and push authoritative RED**

```bash
git add src/domains/finance
git commit -m "test: define finance public boundary"
git push origin feature/spec-c6-finance-workflows
```

Expected remote Validate: fail for the intended missing Finance modules, not parser/config reasons. Record run number/SHA in the execution ledger.

- [x] **Step 4: Implement payment-method and finance-category modules**

Move the existing behavior without changing semantics. `paymentMethods.js` must contain:

```js
import { DEFAULT_PAYMENT_METHODS, paymentLabel } from '../../../../shared/businessPolicies.js'

export const PAYMENT_METHOD_OPTIONS = DEFAULT_PAYMENT_METHODS.methods.map(({ code }) => {
  const value = paymentLabel(code)
  return { value, label: value, code }
})

export function paymentOptionsFromEffective(config) {
  if (!Array.isArray(config?.paymentMethods?.methods)) return []
  return config.paymentMethods.methods
    .filter((method) => method?.active !== false
      && typeof method?.code === 'string'
      && typeof method?.value === 'string'
      && typeof method?.label === 'string')
    .map(({ value, label, code }) => ({ value, label, code }))
}

export function paymentDefaultFromEffective(config) {
  const options = paymentOptionsFromEffective(config)
  const code = config?.paymentMethods?.defaultMethod
  return options.find((option) => option.code === code)?.value || ''
}

export const paymentSelectionNeedsReview = (options, value) => Boolean(value)
  && !options.some((option) => option.value === value)

export function paymentOptionsWithSelection(options, value) {
  if (!paymentSelectionNeedsReview(options, value)) return options
  return [{ value, label: `${value} (inativo)`, code: null, inactive: true }, ...options]
}
```

`financeCategories.js` must preserve the current functions from `src/utils/financeCategoryOptions.js` byte-for-behavior.

Create policies:

```js
// paymentMethodsPolicy.js
import { createPathPolicyAdapter } from '../../../infrastructure/api/policyHttp.js'

export const paymentMethodsPolicy = createPathPolicyAdapter({
  id: 'paymentMethods',
  path: '/api/settings/payment-methods',
  destinations: Object.freeze(['settings-payments']),
  capability: 'payments.settings.view',
})
```

```js
// financeCategoriesPolicy.js
import { createPathPolicyAdapter } from '../../../infrastructure/api/policyHttp.js'

export const financeCategoriesPolicy = createPathPolicyAdapter({
  id: 'financeCategories',
  path: '/api/settings/finance-categories',
  destinations: Object.freeze(['settings-finance-categories']),
  capability: 'finance.categories.view',
})
```

Export only the contracts above from the initial `domains/finance/index.js`.

- [x] **Step 5: Run focused GREEN**

```bash
node --test src/domains/finance/financePublicContract.test.js src/domains/finance/domain/paymentMethods.test.js src/domains/finance/domain/financeCategories.test.js
npm run test:architecture
```

Expected: PASS.

- [x] **Step 6: Commit GREEN and obtain exact-SHA Validate**

```bash
git add src/domains/finance
git commit -m "feat: establish finance domain boundary"
git push origin feature/spec-c6-finance-workflows
```

Expected: Validate application SUCCESS before Task 2.

---

### Task 2: Move Finance-owned Settings content behind the Finance public entry — COMPLETE / GREEN

**Files:**
- Move: `src/app/surfaces/settings/PaymentSettings.jsx` → `src/domains/finance/ui/settings/PaymentSettings.jsx`
- Move: `src/app/surfaces/settings/FinanceCategorySettings.jsx` → `src/domains/finance/ui/settings/FinanceCategorySettings.jsx`
- Move: `src/app/surfaces/settings/paymentSettingsModel.js` → `src/domains/finance/ui/settings/paymentSettingsModel.js`
- Move/update the corresponding PaymentSettings and FinanceCategorySettings tests to the new owner.
- Modify: `src/domains/finance/index.js`
- Modify: `src/app/surfaces/settings/SettingsSurface.jsx`
- Modify: `src/app/surfaces/settings/policies/registry.js`
- Delete after consumers migrate:
  - `src/app/surfaces/settings/policies/paymentMethodsPolicy.js`
  - `src/app/surfaces/settings/policies/financeCategoriesPolicy.js`

**Interfaces:**
- Consumes: generic Spec B policy editing state and Settings editor components.
- Produces: public `PaymentSettings`, `FinanceCategorySettings`, `paymentMethodsPolicy`, `financeCategoriesPolicy`.
- Does not move generic `SettingsEditorShell`, conflict review, pending recovery, or policy engine into Finance.

- [x] **Step 1: Write RED ownership tests**

Add to `financePublicContract.test.js`:

```js
test('Finance publicly owns its Settings editors', async () => {
  const finance = await import('./index.js')
  assert.equal(typeof finance.PaymentSettings, 'function')
  assert.equal(typeof finance.FinanceCategorySettings, 'function')
})
```

Create a path-contract test:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('legacy app-owned Finance settings owners are absent', () => {
  for (const path of [
    new URL('../../app/surfaces/settings/PaymentSettings.jsx', import.meta.url),
    new URL('../../app/surfaces/settings/FinanceCategorySettings.jsx', import.meta.url),
    new URL('../../app/surfaces/settings/paymentSettingsModel.js', import.meta.url),
  ]) assert.equal(fs.existsSync(path), false, String(path))
})
```

- [x] **Step 2: Run RED and commit it**

```bash
node --test src/domains/finance/financePublicContract.test.js
```

Expected: FAIL because public UI exports/new paths are absent.

Commit/push RED:

```bash
git add src/domains/finance
git commit -m "test: require finance settings ownership"
git push origin feature/spec-c6-finance-workflows
```

Remote RED must fail for the intended missing ownership.

- [x] **Step 3: Move Settings UI and fix only import paths**

Use `git mv` for ownership-preserving moves. Update moved files to import generic controls via relative paths back to `src/app/surfaces/settings/components/**` and finance rules via `../../domain/**`.

Update `src/domains/finance/index.js`:

```js
export { default as PaymentSettings } from './ui/settings/PaymentSettings.jsx'
export { default as FinanceCategorySettings } from './ui/settings/FinanceCategorySettings.jsx'
export { paymentMethodsPolicy } from './infrastructure/paymentMethodsPolicy.js'
export { financeCategoriesPolicy } from './infrastructure/financeCategoriesPolicy.js'
```

Update Settings composition:

```js
import {
  FinanceCategorySettings,
  PaymentSettings,
} from '../../../domains/finance/index.js'
```

Update policy registry:

```js
import {
  financeCategoriesPolicy,
  paymentMethodsPolicy,
} from '../../../../domains/finance/index.js'
```

Do not change the existing read-only capabilities, save messages, reconcile callbacks, or navigation behavior.

- [x] **Step 4: Run Settings regressions**

```bash
node --test   src/app/surfaces/settings/PaymentSettings.test.js   src/app/surfaces/settings/PaymentSettings.menuInactive.test.js   src/app/surfaces/settings/FinanceCategorySettings.test.js   src/app/surfaces/settings/FinanceCategorySettings.redesign.test.js   src/settingsSaveAndFinanceOrderRegression.test.js   src/businessPaymentOptions.test.js
npm run test:architecture
```

Run the moved tests at `src/domains/finance/ui/settings/PaymentSettings.test.js`, `src/domains/finance/ui/settings/PaymentSettings.menuInactive.test.js`, `src/domains/finance/ui/settings/FinanceCategorySettings.test.js`, and `src/domains/finance/ui/settings/FinanceCategorySettings.redesign.test.js`. Expected: PASS with the same assertions, not rewritten weaker assertions.

- [x] **Step 5: Commit GREEN and validate exact SHA**

```bash
git add -A src/domains/finance src/app/surfaces/settings
git commit -m "refactor: move finance settings ownership"
git push origin feature/spec-c6-finance-workflows
```

Expected Validate: SUCCESS.

---

### Task 3: Move pure cash-flow, receivable, and payment metrics into Finance — COMPLETE / GREEN

**Files:**
- Create: `src/domains/finance/domain/cashFlow.js`
- Create/move: `src/domains/finance/domain/cashFlow.test.js`
- Create: `src/domains/finance/domain/receivables.js`
- Create/move: `src/domains/finance/domain/receivables.test.js`
- Modify: `src/domains/finance/index.js`
- Modify known consumers:
  - `src/App.jsx`
  - future moved Finance/Receivables files as they are created
- Keep legacy `src/utils/finance.js`, `src/utils/receivables.js`, and `src/utils/paymentWorkflow.js` until all consumers migrate in Task 9.

**Interfaces:**
- Produces from `cashFlow.js`:
  - `getFinancePeriodRange`
  - `filterMovementsByPeriod`
  - `summarizeFinancePeriod`
  - `calculateCurrentBalance`
  - `filterFinanceHistory`
  - `hasFinanceSecondaryFilters`
  - `calculateReceivedToday`
- Produces from `receivables.js`:
  - existing pending/paid/timing/forecast/group/sort helpers from legacy `utils/receivables.js`.
- Orders lifecycle remains owned by Orders; do not move `isOrderPaid`, `getPendingAmount`, or order normalization into Finance merely to avoid imports.

- [x] **Step 1: Write RED for the new Finance rule imports**

Create tests under `src/domains/finance/domain` that reproduce the current `src/utils/finance.test.js` and `src/utils/receivables.test.js` assertions, importing the new paths.

Add:

```js
test('received today is net payments minus same-day refunds', () => {
  const movements = [
    { type: 'entrada', source: 'order-payment', value: 100, createdAt: '2026-09-18T10:00:00.000Z' },
    { type: 'saida', source: 'order-refund', value: 30, createdAt: '2026-09-18T11:00:00.000Z' },
    { type: 'entrada', source: 'manual', value: 999, createdAt: '2026-09-18T12:00:00.000Z' },
  ]
  assert.equal(calculateReceivedToday(movements, '2026-09-18'), 70)
})
```

- [x] **Step 2: Run RED, commit, push**

```bash
node --test src/domains/finance/domain/cashFlow.test.js src/domains/finance/domain/receivables.test.js
```

Expected: missing modules/functions.

Commit message:

```bash
git commit -am "test: define finance pure rules"
```

Use `git add` for new files before commit; push and record intended RED.

- [x] **Step 3: Implement by moving existing pure behavior, not rewriting it**

For `calculateReceivedToday`, preserve:

```js
export const calculateReceivedToday = (movements = [], dateValue = toLocalDateValue()) =>
  (Array.isArray(movements) ? movements : []).reduce((total, movement) => {
    const createdAt = parseDate(movement?.createdAt)
    if (!createdAt || toLocalDateValue(createdAt) !== dateValue) return total
    const value = Math.max(0, Number(movement?.value) || 0)
    if (movement?.type === 'entrada' && movement?.source === 'order-payment') return total + value
    if (movement?.type === 'saida' && movement?.source === 'order-refund') return total - value
    return total
  }, 0)
```

Use `getBusinessDate` from `shared/finance.js` for the financial calendar date used by `calculateReceivedToday`; do not import `toLocalDateValue` or any other Orders internal into Finance.

- [x] **Step 4: Export rules through Finance public entry and migrate App metrics**

Update `src/domains/finance/index.js` with the public calculations actually consumed outside Finance.

Change App imports from legacy `utils/finance.js` / `utils/paymentWorkflow.js` to `domains/finance/index.js` for finance-owned functions only.

Keep Orders-owned `isOrderPaid`/pending eligibility in Orders.

- [x] **Step 5: Run focused GREEN**

```bash
node --test   src/domains/finance/domain/cashFlow.test.js   src/domains/finance/domain/receivables.test.js   src/financeRealtimeRegression.test.js   src/pages/ReceivablesConsumer.test.js   src/pages/ReceivablesForecast.test.js
npm run test:architecture
```

Expected: PASS.

- [x] **Step 6: Commit GREEN + Validate**

```bash
git add -A src/domains/finance src/App.jsx
git commit -m "refactor: move finance rules into domain"
git push origin feature/spec-c6-finance-workflows
```

Expected exact-SHA Validate: SUCCESS.

---

### Task 4: Create Finance API/commands and migrate Finance UI, movement dialogs, and opening balance — COMPLETE / GREEN

**Files:**
- Create: `src/domains/finance/infrastructure/financeApi.js`
- Create: `src/domains/finance/infrastructure/financeApi.test.js`
- Create: `src/domains/finance/application/useFinanceCommands.js`
- Create: `src/domains/finance/application/useFinanceCommands.test.js`
- Move: `src/pages/Finance.jsx` → `src/domains/finance/ui/Finance.jsx`
- Move: `src/components/MovementDialog.jsx` → `src/domains/finance/ui/MovementDialog.jsx`
- Move: `src/components/OpeningBalanceDialog.jsx` → `src/domains/finance/ui/OpeningBalanceDialog.jsx`
- Create: `src/domains/finance/ui/FinanceWorkspace.jsx`
- Create: `src/domains/finance/ui/FinanceWorkspace.test.js`
- Modify: `src/domains/finance/index.js`
- Modify: `src/App.jsx`
- Keep refund dialog outside Finance; Task 8 moves it to the refund workflow.

**Interfaces:**
- `financeApi.createMovement(payload)`
- `financeApi.updateMovement(id, payload)`
- `financeApi.deleteMovement(id)`
- `financeApi.saveFinanceSettings(payload)`
- `useFinanceCommands({...})` returns:
  - `movementDialog` = `{ open, movement }`
  - `openingBalanceOpen`
  - `openNewMovement()`
  - `openEditMovement(movement)`
  - `closeMovementDialog()`
  - `saveMovement(payload)`
  - `deleteMovement(id)`
  - `openOpeningBalance()`
  - `closeOpeningBalance()`
  - `saveOpeningBalance(payload)`
- `FinanceWorkspace` owns movement/opening UI state and uses official effects only.

- [x] **Step 1: Write RED API contract**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createFinanceApi } from './financeApi.js'

test('financeApi preserves current routes and payloads', async () => {
  const calls = []
  const api = createFinanceApi({
    request: async (...args) => { calls.push(args); return {} },
    json: (method, body) => ({ method, body: JSON.stringify(body) }),
  })
  await api.createMovement({ value: 10 })
  await api.updateMovement('m 1', { value: 20 })
  await api.deleteMovement('m 1')
  await api.saveFinanceSettings({ openingBalance: -10, openingDate: '2026-09-01' })
  assert.deepEqual(calls.map(([url, options]) => [url, options.method]), [
    ['/api/movements', 'POST'],
    ['/api/movements/m%201', 'PATCH'],
    ['/api/movements/m%201', 'DELETE'],
    ['/api/finance-settings', 'PUT'],
  ])
})
```

Write command tests that prove:
- edit rejects non-manual movement;
- create/update applies returned `movement`;
- delete applies `deletedMovementId`;
- settings applies returned `financeSettings`;
- disabled/capability returns false without API calls.

- [x] **Step 2: Run RED and commit**

```bash
node --test src/domains/finance/infrastructure/financeApi.test.js src/domains/finance/application/useFinanceCommands.test.js
```

Expected: missing API/controller.

Commit/push authoritative RED.

- [x] **Step 3: Implement Finance API**

```js
import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createFinanceApi = ({ request = apiRequest, json = withJson } = {}) => Object.freeze({
  createMovement: (movement) => request('/api/movements', json('POST', movement)),
  updateMovement: (id, movement) => request(`/api/movements/${encodeURIComponent(id)}`, json('PATCH', movement)),
  deleteMovement: (id) => request(`/api/movements/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  saveFinanceSettings: (settings) => request('/api/finance-settings', json('PUT', settings)),
})

export const financeApi = createFinanceApi()
```

- [x] **Step 4: Implement commands with injected official-effect/feedback ports**

The hook must use this dependency shape:

```js
export function useFinanceCommands({
  api = financeApi,
  applyOfficialEffects,
  writesBlocked,
  canManageMovements,
  setRequestKey,
  onSuccess,
  onError,
}) { /* state + commands */ }
```

For save movement, preserve official-only application:

```js
const { movement } = movementId
  ? await api.updateMovement(movementId, payload)
  : await api.createMovement(payload)
applyOfficialEffects({ movement })
```

For delete:

```js
const { deletedMovementId } = await api.deleteMovement(movementId)
applyOfficialEffects({ deletedMovementId })
```

For opening balance:

```js
const { financeSettings } = await api.saveFinanceSettings(payload)
applyOfficialEffects({ financeSettings })
```

- [x] **Step 5: Move Finance UI and create FinanceWorkspace**

`Finance.jsx` must stop importing Orders. Add a `formatCancellationDate` prop and use it when rendering pending refunds.

It must also stop rendering `RegisterRefundDialog`; instead call:

```jsx
<Button
  type="button"
  variant="secondary"
  className="button-danger-outline"
  onClick={() => onRequestRefund?.(order)}
  disabled={writeDisabled}
>
  Registrar estorno
</Button>
```

`FinanceWorkspace` computes `financialTotals` and `currentFinanceBalance`, instantiates `useFinanceCommands`, renders `Finance`, `MovementDialog`, and `OpeningBalanceDialog`.

- [x] **Step 6: Replace App movement/opening ownership**

In `App.jsx`:
- remove `movementDialogOpen`, `editingMovement`, `openingBalanceDialogOpen`;
- remove movement/opening handlers;
- remove direct finance API imports;
- render `FinanceWorkspace` from the Finance public entry;
- pass `applyOfficialEffects`, capabilities, payment/category projections, feedback callbacks, and `formatCancellationDate`; keep the existing App `handleRegisterRefund` as the temporary `onRequestRefund` callback only until Task 8 removes it.

- [x] **Step 7: Run focused regressions**

```bash
node --test   src/domains/finance/infrastructure/financeApi.test.js   src/domains/finance/application/useFinanceCommands.test.js   src/domains/finance/ui/FinanceWorkspace.test.js   src/components/MovementDialog.test.js   src/components/OpeningBalanceDialog.test.js   src/financeRealtimeRegression.test.js   src/api/financeClientContract.test.js
npm run test:architecture
```

Run moved UI tests at `src/domains/finance/ui/MovementDialog.test.js` and `src/domains/finance/ui/OpeningBalanceDialog.test.js`. Keep `src/api/financeClientContract.test.js` unchanged through Task 8 because the legacy exports remain temporarily present until Task 9.

- [x] **Step 8: Commit GREEN + Validate**

Commit:

```bash
git add -A src/domains/finance src/App.jsx src/pages src/components
git commit -m "refactor: move finance workspace into domain"
git push origin feature/spec-c6-finance-workflows
```

Expected Validate: SUCCESS.

---

### Task 5: Migrate Receivables UI and payment-promise ownership without Finance → Orders imports

**Files:**
- Move: `src/pages/Receivables.jsx` → `src/domains/finance/ui/Receivables.jsx`
- Move finance-exclusive supporting UI:
  - `src/components/PaymentPromiseDialog.jsx`
  - `src/components/ReceivableDetail.jsx`
  - `src/components/ReceivablesForecastDialog.jsx`
  - `src/components/ReceivablesQuickPaymentDialog.jsx`
  into `src/domains/finance/ui/`
- Move/update Receivables tests to the new paths.
- Create: `src/app/surfaces/finance/ReceivablesSurface.jsx`
- Create: `src/app/surfaces/finance/ReceivablesSurface.test.js`
- Modify: `src/domains/orders/infrastructure/ordersApi.js`
- Create: `src/domains/orders/application/useOrderPaymentPromise.js`
- Create: `src/domains/orders/application/useOrderPaymentPromise.test.js`
- Modify: `src/domains/orders/index.js`
- Modify: `src/domains/finance/index.js`
- Modify: `src/App.jsx`

**Interfaces:**
- `ordersApi.updatePaymentPromise(id, promisedPaymentDate)`
- `useOrderPaymentPromise({ applyOfficialEffects, writesBlocked, canManagePaymentPromises, setRequestKey, onSuccess, onError })`
- `Receivables` accepts a cross-domain `orderPresentation` object instead of importing Orders:
  - `formatOrderDate(orderDate)`
  - `getOrderItemsSearchText(order)`
  - `getOrderItemsSummary(order)`
  - `formatOrderDisplayNumber(order)` may stay shared directly
- `Receivables` accepts `renderOrderDetail(order, onClose)` instead of importing `OrderDetail`.
- `ReceivablesSurface` is app-owned and imports public Finance + public Orders contracts.

- [ ] **Step 1: Write RED proving Finance no longer owns Orders imports**

Create `ReceivablesSurface.test.js` that renders the surface with one pending order and proves "Ver pedido" reaches the supplied Orders detail.

Add a source contract:

```js
test('Finance Receivables does not import Orders', async () => {
  const source = await readFile(new URL('../../../domains/finance/ui/Receivables.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /domains\/orders/)
})
```

Add Orders API RED:

```js
test('ordersApi owns payment-promise writes', async () => {
  const calls = []
  const api = createOrdersApi({
    request: async (...args) => { calls.push(args); return { order: { id: 'o1' } } },
    json: (method, body) => ({ method, body: JSON.stringify(body) }),
    randomUUID: () => 'unused',
  })
  await api.updatePaymentPromise('o 1', '2026-09-20')
  assert.equal(calls[0][0], '/api/orders/o%201/payment-promise')
  assert.equal(calls[0][1].method, 'PATCH')
})
```

- [ ] **Step 2: Run RED, commit, push**

```bash
node --test   src/app/surfaces/finance/ReceivablesSurface.test.js   src/domains/orders/application/useOrderPaymentPromise.test.js   src/domains/orders/infrastructure/ordersApi.test.js
```

Expected missing new surface/hook/API method.

- [ ] **Step 3: Extend Orders API and implement payment-promise command**

Add to `createOrdersApi`:

```js
updatePaymentPromise: (id, promisedPaymentDate) => request(
  `/api/orders/${encodeURIComponent(id)}/payment-promise`,
  json('PATCH', { promisedPaymentDate }),
),
```

The hook applies only:

```js
const { order } = await ordersApi.updatePaymentPromise(orderId, promisedPaymentDate)
applyOfficialEffects({ order })
```

and emits the existing messages:
- `Data prometida atualizada`
- `Data prometida removida`

- [ ] **Step 4: Move Receivables and replace Orders imports with injected presentation**

At the top of Finance-owned Receivables, there must be no Orders import. Use:

```js
const {
  formatOrderDate,
  getOrderItemsSearchText,
  getOrderItemsSummary,
} = orderPresentation
```

Replace inline `<OrderDetail ... />` with:

```jsx
{detailOrder && renderOrderDetail?.(detailOrder, () => setDetailOrder(null))}
```

- [ ] **Step 5: Create app-owned ReceivablesSurface**

The surface imports:

```js
import { Receivables } from '../../../domains/finance/index.js'
import {
  OrderDetail,
  formatOrderDate,
  getOrderItemsSearchText,
  getOrderItemsSummary,
  useOrderPaymentPromise,
} from '../../../domains/orders/index.js'
```

It instantiates `useOrderPaymentPromise` and passes an `orderPresentation` object plus:

```jsx
renderOrderDetail={(order, onClose) => (
  <OrderDetail
    order={order}
    currency={currency}
    canExecutePrinting={canExecutePrinting}
    onClose={onClose}
  />
)}
```

It receives `onRegisterPayment` from the order-payment workflow (Task 6 will replace the temporary App callback).

- [ ] **Step 6: Replace App Receivables composition**

App renders `ReceivablesSurface` and no longer owns `handleUpdatePaymentPromise`.

- [ ] **Step 7: Run full Receivables regression set**

```bash
node --test   src/app/surfaces/finance/ReceivablesSurface.test.js   src/domains/orders/application/useOrderPaymentPromise.test.js   src/AppReceivablesPromise.test.js   src/pages/ReceivablesConsumer.test.js   src/pages/ReceivablesDetails.test.js   src/pages/ReceivablesForecast.test.js   src/pages/ReceivablesMobile.test.js   src/pages/ReceivablesRedesign.test.js
npm run test:architecture
```

Use moved test paths where files were moved. Expected: PASS and no Finance → Orders import.

- [ ] **Step 8: Commit GREEN + Validate**

```bash
git add -A src/domains/finance src/domains/orders src/app/surfaces/finance src/App.jsx src/pages src/components
git commit -m "refactor: move receivables behind app composition"
git push origin feature/spec-c6-finance-workflows
```

Expected Validate: SUCCESS.

---

### Task 6: Extract the standalone order-payment workflow and modal from App

**Files:**
- Create: `src/app/workflows/payments/paymentApi.js`
- Create: `src/app/workflows/payments/paymentApi.test.js`
- Create: `src/app/workflows/payments/order/OrderPaymentDialog.jsx`
- Create: `src/app/workflows/payments/order/useOrderPaymentWorkflow.js`
- Create: `src/app/workflows/payments/order/useOrderPaymentWorkflow.test.js`
- Modify: `src/App.jsx`
- Modify: `src/app/surfaces/finance/ReceivablesSurface.jsx`
- Update characterization: `src/operationalPayment.test.js`
- Do not yet remove table-tab payment from legacy API; Task 7 handles it.

**Interfaces:**
- `paymentApi.registerOrderPayment(id, method)`
- `paymentApi.registerTableTabPayment(id, method)` may be created now for shared adapter ownership but only order path is wired in this task.
- `useOrderPaymentWorkflow({...})` returns:
  - `open(orderId, source?)`
  - `close()`
  - `dialog` = `{ order, method, setMethod, visibleOptions, needsReview, submitting, submit }` or null
- `OrderPaymentDialog` owns current standalone payment modal markup.
- Consumers call `orderPayment.open(orderId, source)`.

- [ ] **Step 1: Write behavioral RED by extracting current operational-payment cases into hook tests**

The hook harness must prove:
- double submit → one API call;
- result after navigation still applies official effects;
- response A cannot close/change B;
- stale session guard ignores result;
- 409 → refresh, no repeat POST;
- network/5xx → refresh, no optimistic paid state.

A representative test:

```js
test('double submit sends one request and applies official response once', async () => {
  const pending = deferred()
  const calls = []
  const { result } = await renderPaymentWorkflow({
    api: { registerOrderPayment: (...args) => { calls.push(args); return pending.promise } },
    orders: [pendingOrder],
  })
  act(() => result.current.open(pendingOrder.id, 'orders'))
  let first
  await act(async () => {
    first = result.current.submit()
    void result.current.submit()
  })
  assert.equal(calls.length, 1)
  pending.resolve({ order: paidOrder, movement })
  await act(async () => first)
  assert.deepEqual(applied, [{ order: paidOrder, movement }])
})
```

- [ ] **Step 2: Run RED + authoritative remote RED**

```bash
node --test src/app/workflows/payments/paymentApi.test.js src/app/workflows/payments/order/useOrderPaymentWorkflow.test.js
```

Expected missing modules.

Commit/push RED and record run.

- [ ] **Step 3: Implement paymentApi**

```js
import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createPaymentApi = ({ request = apiRequest, json = withJson } = {}) => Object.freeze({
  registerOrderPayment: (id, method) => request(
    `/api/orders/${encodeURIComponent(id)}/payment`,
    json('POST', { method }),
  ),
  registerTableTabPayment: (id, method) => request(
    `/api/table-tabs/${encodeURIComponent(id)}/payment`,
    json('POST', { method }),
  ),
})

export const paymentApi = createPaymentApi()
```

- [ ] **Step 4: Implement owner-based order workflow**

Use owner objects rather than component-global booleans:

```js
const owner = {
  token: ++sequenceRef.current,
  guard: getSyncGuard(),
  orderId,
  source: operational ? source : null,
  submitting: false,
  requestKey: null,
  method: null,
}
```

Submit must preserve current conflict/unknown-result behavior:

```js
try {
  const { order, movement, tableTab } = await api.registerOrderPayment(owner.orderId, owner.method)
  if (owner.guard !== getSyncGuard()) return false
  applyOfficialEffects({ order, movement, tableTab })
  if (dialogOwnerRef.current === owner) {
    close(owner)
    onSuccess(`Pagamento recebido via ${owner.method}`)
  }
  return true
} catch (error) {
  if (owner.guard !== getSyncGuard()) return false
  if (error?.status === 409 || !Number.isInteger(error?.status) || error.status >= 500) {
    await refreshOfficialData()
  }
  if (owner.guard === getSyncGuard() && dialogOwnerRef.current === owner) onError(error)
  return false
}
```

Use `canReceiveStandaloneOrder` only for sources `orders`/`history`; A Receber passes no operational source.

- [ ] **Step 5: Move modal markup to OrderPaymentDialog**

Preserve exact existing text:
- title `Registrar pagamento`;
- summary client/order/total;
- `O pagamento será lançado automaticamente como entrada no Financeiro.`;
- inactive method warning;
- Cancelar / Confirmar pagamento.

- [ ] **Step 6: Wire App + ReceivablesSurface to the workflow**

App may instantiate the workflow hook, but must not contain the refs/submit logic. Pass:
- `orderPayment.open` to Orders/History;
- an app-surface callback to Receivables with no operational source;
- render `{orderPayment.dialog && <OrderPaymentDialog dialog={orderPayment.dialog} currency={currency} />}`; `dialog` contains the current order, selected method, visible options, review/submitting state, and its `onClose`/`onSubmit` callbacks.

Delete from App:
- `paymentTarget`;
- `paymentMethod`;
- `paymentDialogRef`;
- `paymentAttemptRef`;
- `paymentSequenceRef`;
- `openPaymentModal`;
- `closePaymentModal`;
- `handleRegisterPayment`.

- [ ] **Step 7: Run operational payment regressions**

```bash
node --test   src/app/workflows/payments/paymentApi.test.js   src/app/workflows/payments/order/useOrderPaymentWorkflow.test.js   src/operationalPayment.test.js   src/businessPaymentOptions.test.js
npm run test:architecture
```

Expected: PASS, including all old race cases.

- [ ] **Step 8: Commit GREEN + Validate**

```bash
git add -A src/app/workflows/payments src/app/surfaces/finance src/App.jsx src/operationalPayment.test.js
git commit -m "refactor: extract order payment workflow"
git push origin feature/spec-c6-finance-workflows
```

Expected Validate: SUCCESS.

---

### Task 7: Extract table-tab payment reconciliation and remove the runtime payment-receipt bridge

**Files:**
- Create: `src/app/workflows/payments/table-tab/tableTabPaymentReconciliation.js`
- Create: `src/app/workflows/payments/table-tab/tableTabPaymentReconciliation.test.js`
- Create: `src/app/workflows/payments/table-tab/useTableTabPaymentWorkflow.js`
- Create: `src/app/workflows/payments/table-tab/useTableTabPaymentWorkflow.test.js`
- Move: `src/components/TableTabPaymentDialog.jsx` → `src/app/workflows/payments/table-tab/TableTabPaymentDialog.jsx`
- Move/update: `src/components/TableTabPaymentDialog.test.js`
- Modify: `src/app/surfaces/table-service/TableServiceExternalActions.jsx`
- Modify: `src/app/runtime/data/useOperationalDataRuntime.js`
- Modify: `src/app/runtime/data/useOperationalDataRuntime.test.js`
- Modify: `src/App.jsx`
- Modify: `src/app/runtime/runtimeExtractionContract.test.js`
- Modify: `src/domains/table-service/tableServiceExtractionContract.test.js`

**Interfaces:**
- `settleTableTabPayment(owner, receipt)` returns:
  - `{ settled: false }`, or
  - `{ settled: true, nextTables, replaced }`
- `useTableTabPaymentWorkflow({...})` returns:
  - `pay(tableTabId, method, intent)`
  - `syncState` = null or `{ status, tableId, tabId }`
  - `retrySync()`
  - `busy`
- The hook consumes `refreshOfficialData()` which returns the runtime receipt already returned by `refreshBootstrapSilently()`.
- No callback from runtime back into payment workflow.

- [ ] **Step 1: Write RED pure settlement tests**

```js
test('settlement requires all payment collections and authoritative closed tab', () => {
  const owner = {
    tabId: 'tab-1',
    tableId: 'table-1',
    result: {
      orders: [{ id: 'o1' }],
      movements: [{ id: 'm1' }],
    },
  }
  const receipt = {
    applied: ['orders', 'movements', 'tableTabs', 'tables'],
    data: {
      orders: [{ id: 'o1', paymentStatus: 'Pago' }],
      movements: [{ id: 'm1' }],
      tableTabs: [{ id: 'tab-1', status: 'closed' }],
      tables: [{ id: 'table-1', occupancy: 'free', openTableTab: null }],
    },
  }
  assert.deepEqual(settleTableTabPayment(owner, receipt), {
    settled: true,
    nextTables: receipt.data.tables,
    replaced: false,
  })
})
```

Add cases:
- missing collection → not settled;
- stale unpaid order → not settled;
- missing movement → not settled;
- old tab still open → not settled;
- table reoccupied with a different tab → settled with `replaced: true`.

- [ ] **Step 2: Write RED runtime bridge-removal test**

Replace the current runtime test that expects capture/settle with:

```js
test('bootstrap refresh is payment-agnostic and returns its official receipt', async (t) => {
  const harness = await mountHarness(t, { api: { getBootstrap: async () => bootstrapFixture(), getOrders: async () => ({ orders: [] }) } })
  const receipt = await harness.getCurrent().refreshBootstrapSilently()
  assert.ok(receipt.applied.includes('orders'))
  assert.ok(receipt.applied.includes('movements'))
  assert.ok(receipt.applied.includes('tableTabs'))
  assert.ok(receipt.applied.includes('tables'))
})
```

and a source assertion that `legacyBridges`, `capturePaymentOwners`, and `settlePaymentOwners` are absent from `useOperationalDataRuntime.js`.

- [ ] **Step 3: Run RED, commit, push**

```bash
node --test   src/app/workflows/payments/table-tab/tableTabPaymentReconciliation.test.js   src/app/workflows/payments/table-tab/useTableTabPaymentWorkflow.test.js   src/app/runtime/data/useOperationalDataRuntime.test.js
```

Expected: missing workflow plus runtime bridge test failure.

- [ ] **Step 4: Implement pure settlement**

Do not read global UI selection in the pure function. Validate only receipt authority and owner/result identity.

Import `isOrderPaid` from `src/domains/orders/index.js` in the app-owned table-tab payment workflow and use it to verify every returned order in the authoritative receipt. Finance remains free of Orders imports.

- [ ] **Step 5: Implement reconciliation hook preserving the two-read race**

Core logic:

```js
const reconcileOwner = async (owner) => {
  if (!isLive(owner)) return false
  owner.syncStatus = 'syncing'
  publish()

  const firstReceipt = await refreshOfficialData()
  if (trySettle(owner, firstReceipt)) return true
  if (!isLive(owner)) return false

  const secondReceipt = await refreshOfficialData()
  if (trySettle(owner, secondReceipt)) return true
  if (!isLive(owner)) return false

  owner.syncStatus = 'error'
  publish()
  return false
}
```

The first call may await a read already on the wire from before payment. The second read is mandatory if the first receipt does not prove settlement.

Payment mutation:

```js
const result = await api.registerTableTabPayment(tableTabId, method)
owner.paid = true
owner.result = result
owner.tableIdentifier = result.tableTab.tableIdentifier
owner.syncStatus = 'syncing'
acceptedOwnersRef.current.add(owner)

if (revision === getOfficialRevision()) {
  const receipt = applyOfficialEffects({
    orders: result.orders,
    movements: result.movements,
    tableTab: result.tableTab,
    tables: result.tables,
  })
  trySettle(owner, receipt)
}
if (!owner.settled) await reconcileOwner(owner)
return true
```

- [ ] **Step 6: Remove runtime payment bridge**

From `useOperationalDataRuntime`:
- remove `legacyBridges` argument/ref;
- remove payment-owner capture before reads;
- remove settlement callback after reads;
- keep receipt creation/return intact.

From App:
- remove `operationalLegacyBridges`;
- remove `operationalBridgeTargetsRef.settlePaymentOwners`;
- remove `tableTabPaymentRef`;
- remove `paymentSyncRef`;
- remove `tableTabSync`;
- remove `publishPaymentSync`;
- remove `settleAcceptedPayment`;
- remove `reconcileTableTabPayment`;
- remove `handleRegisterTableTabPayment`.

Instantiate/use the table-tab workflow and pass its public callbacks/state into `TableServiceExternalActions` / `Comandas`.

- [ ] **Step 7: Move TableTabPaymentDialog to workflow ownership**

Update `TableServiceExternalActions` import to:

```js
import TableTabPaymentDialog from '../../workflows/payments/table-tab/TableTabPaymentDialog.jsx'
```

Preserve all current focus-lock, default-method, inactive-selection, and double-submit tests.

- [ ] **Step 8: Run focused race/regression suite**

```bash
node --test   src/app/workflows/payments/table-tab/tableTabPaymentReconciliation.test.js   src/app/workflows/payments/table-tab/useTableTabPaymentWorkflow.test.js   src/app/workflows/payments/table-tab/TableTabPaymentDialog.test.js   src/app/runtime/data/useOperationalDataRuntime.test.js   src/app/runtime/runtimeExtractionContract.test.js   src/domains/table-service/tableServiceExtractionContract.test.js   src/comandasAppWiring.test.js   src/actionCapabilities.test.js
npm run test:architecture
```

Expected: PASS and zero runtime payment bridge tokens.

- [ ] **Step 9: Commit GREEN + Validate**

```bash
git add -A src/app/workflows/payments src/app/runtime src/app/surfaces/table-service src/domains/table-service src/App.jsx src/components
git commit -m "refactor: extract table tab payment reconciliation"
git push origin feature/spec-c6-finance-workflows
```

Expected Validate: SUCCESS before Task 8.

---

### Task 8: Extract refund workflow and refund dialog from Finance/App

**Files:**
- Create: `src/app/workflows/refunds/refundApi.js`
- Create: `src/app/workflows/refunds/refundApi.test.js`
- Move: `src/components/RegisterRefundDialog.jsx` → `src/app/workflows/refunds/RegisterRefundDialog.jsx`
- Move/update: `src/components/RegisterRefundDialog.test.js`
- Create: `src/app/workflows/refunds/useRefundWorkflow.js`
- Create: `src/app/workflows/refunds/useRefundWorkflow.test.js`
- Modify: `src/domains/finance/ui/FinanceWorkspace.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- `refundApi.refundOrder(id, payload)`
- `useRefundWorkflow({...})` returns:
  - `request(order)`
  - `close()`
  - `refundOrder` current target or null
  - `submitting`
  - `confirm(payload)`
- Finance emits `onRequestRefund(order)`; workflow owns target/dialog/API/effect application.

- [ ] **Step 1: Write RED API/workflow tests**

API:

```js
test('refundApi posts the existing refund payload', async () => {
  const calls = []
  const api = createRefundApi({
    request: async (...args) => { calls.push(args); return { order: {}, movement: {} } },
    json: (method, body) => ({ method, body: JSON.stringify(body) }),
  })
  await api.refundOrder('o 1', { refundMethod: 'Dinheiro' })
  assert.equal(calls[0][0], '/api/orders/o%201/refund')
  assert.equal(calls[0][1].method, 'POST')
})
```

Workflow test proves official `order + movement` are both applied and double confirm is blocked by `submitting`.

- [ ] **Step 2: Run RED + commit/push**

```bash
node --test src/app/workflows/refunds/refundApi.test.js src/app/workflows/refunds/useRefundWorkflow.test.js
```

Expected: missing modules.

- [ ] **Step 3: Implement API and workflow**

API:

```js
export const createRefundApi = ({ request = apiRequest, json = withJson } = {}) => Object.freeze({
  refundOrder: (id, payload) => request(
    `/api/orders/${encodeURIComponent(id)}/refund`,
    json('POST', payload),
  ),
})
```

Confirm:

```js
const { order, movement } = await api.refundOrder(target.id, payload)
applyOfficialEffects({ order, movement })
onSuccess('Estorno registrado com sucesso')
setTarget(null)
return true
```

Use capability/offline guard passed into the hook. On error, preserve target and call existing error feedback.

- [ ] **Step 4: Move dialog and compose it outside Finance**

Move the existing dialog byte-for-behavior, preserving:
- original payment method suggestion;
- inactive historical method warning;
- read-only full amount;
- method-only payload;
- no partial refund.

Render the workflow dialog from App/app workflow composition, while Finance receives only `onRequestRefund={refund.request}`.

Delete App `handleRegisterRefund`.

- [ ] **Step 5: Run refund/finance regressions**

```bash
node --test   src/app/workflows/refunds/refundApi.test.js   src/app/workflows/refunds/useRefundWorkflow.test.js   src/app/workflows/refunds/RegisterRefundDialog.test.js   src/businessPaymentOptions.test.js   src/domains/finance/domain/cashFlow.test.js
npm run test:architecture
```

Expected: PASS.

- [ ] **Step 6: Commit GREEN + Validate**

```bash
git add -A src/app/workflows/refunds src/domains/finance src/App.jsx src/components
git commit -m "refactor: extract refund workflow"
git push origin feature/spec-c6-finance-workflows
```

Expected Validate: SUCCESS.

---

### Task 9: Remove C6 legacy API exports, legacy utility owners, and stale paths

**Files:**
- Modify: `src/api/client.js`
- Delete once `rg` proves zero production consumers:
  - `src/utils/paymentMethodOptions.js`
  - `src/utils/financeCategoryOptions.js`
  - `src/utils/finance.js`
  - `src/utils/receivables.js`
  - `src/utils/paymentWorkflow.js`
  - legacy moved Finance/Receivables/components/Settings files that remain after `git mv`.
- Update tests whose only purpose is the old path, replacing them with new-owner contract tests.
- Modify: `src/api/financeClientContract.test.js`
- Modify: `src/AppReceivablesPromise.test.js`
- Modify: `src/financeRealtimeRegression.test.js`
- Modify: `src/businessPaymentOptions.test.js`

**Interfaces:**
- Legacy API client must no longer export:
  - `registerPayment`
  - `registerTableTabPayment`
  - `refundOrder`
  - `createMovement`
  - `updateMovement`
  - `deleteMovement`
  - `saveFinanceSettings`
  - `updateOrderPaymentPromise`
- Generic/auth exports remain.

- [ ] **Step 1: Audit consumers before deleting**

Run:

```bash
rg -n "registerPayment|registerTableTabPayment|refundOrder|createMovement|updateMovement|deleteMovement|saveFinanceSettings|updateOrderPaymentPromise" src --glob '!src/api/client.js'
rg -n "utils/(paymentMethodOptions|financeCategoryOptions|finance|receivables|paymentWorkflow)" src
rg -n "pages/(Finance|Receivables)|components/(MovementDialog|OpeningBalanceDialog|PaymentPromiseDialog|ReceivableDetail|ReceivablesForecastDialog|ReceivablesQuickPaymentDialog|RegisterRefundDialog|TableTabPaymentDialog)" src
```

Expected before deletion: only new-owner tests or stale imports explicitly scheduled to be corrected in this task.

- [ ] **Step 2: Write RED extraction contract**

Create/update a source contract:

```js
test('legacy api client has no C6 migrated exports', async () => {
  const source = await readFile(new URL('./api/client.js', import.meta.url), 'utf8')
  for (const name of [
    'registerPayment',
    'registerTableTabPayment',
    'refundOrder',
    'createMovement',
    'updateMovement',
    'deleteMovement',
    'saveFinanceSettings',
    'updateOrderPaymentPromise',
  ]) assert.doesNotMatch(source, new RegExp(`export\\s+const\\s+${name}\\b`), name)
})
```

Add absence assertions for each physically moved legacy owner.

Run it before deletion; expected FAIL.

- [ ] **Step 3: Commit/push RED**

Commit only extraction tests; remote RED must fail because legacy exports/owners still exist.

- [ ] **Step 4: Delete exports/files and migrate final consumers**

Remove exactly the C6 exports from `src/api/client.js`; do not touch printing/generic/auth/client/product exports scheduled later.

Remove legacy files only after `rg` proves production consumers are migrated.

Update test imports to the new public contracts; do not weaken business assertions.

- [ ] **Step 5: Re-run audits and focused suite**

```bash
rg -n "registerPayment|registerTableTabPayment|refundOrder|createMovement|updateMovement|deleteMovement|saveFinanceSettings|updateOrderPaymentPromise" src/api/client.js
rg -n "utils/(paymentMethodOptions|financeCategoryOptions|finance|receivables|paymentWorkflow)" src
npm test
npm run test:architecture
```

Expected:
- first two audits return no prohibited production matches;
- full tests PASS.

- [ ] **Step 6: Commit GREEN + Validate**

```bash
git add -A src
git commit -m "refactor: remove c6 legacy finance facades"
git push origin feature/spec-c6-finance-workflows
```

Expected Validate: SUCCESS.

---

### Task 10: Permanently enforce C6 architecture and App/runtime extraction

**Files:**
- Modify: `scripts/architecture/check-import-boundaries.mjs`
- Modify: `scripts/architecture/check-import-boundaries.test.mjs`
- Create: `src/domains/finance/financeExtractionContract.test.js`
- Modify: `src/app/runtime/runtimeExtractionContract.test.js`
- Modify: `src/domains/table-service/tableServiceExtractionContract.test.js`
- Modify: `src/App.jsx` only if the RED finds a real remaining C6 owner.
- Modify: `src/domains/finance/index.js` only to reduce public exports to actual external consumers.

**Interfaces / rules to enforce:**
- external Finance consumers use `domains/finance/index.js`;
- Finance cannot import Orders or Table Service, including their public entries;
- C6 legacy UI owners cannot reappear;
- legacy C6 API exports cannot reappear in `src/api/client.js`;
- operational runtime cannot contain payment-owner bridge tokens;
- `App.jsx` cannot own C6 payment/finance handlers/refs;
- app payment workflows cannot be placed under domains;
- Finance/payment workflows cannot import `qz-tray` or legacy printing internals.

- [ ] **Step 1: Write architecture RED fixtures**

Add tests:

```js
test('external consumers cannot deep import Finance internals', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/App.jsx', "import Finance from './domains/finance/ui/Finance.jsx'\n")
  await write('src/domains/finance/ui/Finance.jsx', 'export default function Finance() {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((item) => item.startsWith('finance-deep-import:')))
})

test('Finance cannot import Orders even through its public entry', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/finance/ui/x.js', "import { Orders } from '../../orders/index.js'\n")
  await write('src/domains/orders/index.js', 'export const Orders = () => null\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((item) => item.startsWith('finance-orders-import:')))
})

test('Finance cannot import Table Service', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/domains/finance/ui/x.js', "import { Tables } from '../../table-service/index.js'\n")
  await write('src/domains/table-service/index.js', 'export const Tables = () => null\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.some((item) => item.startsWith('finance-table-service-import:')))
})

test('legacy API client cannot reintroduce C6 exports', async (t) => {
  const { rootDir, write } = await createFixture(t)
  await write('src/api/client.js', 'export const registerPayment = () => {}\n')
  const violations = await findArchitectureViolations({ rootDir, allowlist: {} })
  assert.ok(violations.includes('c6-legacy-finance-api: src/api/client.js'))
})
```

Add legacy-owner fixture for `src/pages/Finance.jsx`.

- [ ] **Step 2: Write App/runtime extraction RED**

`financeExtractionContract.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8')
const runtime = readFileSync(new URL('../../app/runtime/data/useOperationalDataRuntime.js', import.meta.url), 'utf8')

test('App no longer owns C6 finance/payment implementation', () => {
  for (const token of [
    'paymentDialogRef',
    'paymentAttemptRef',
    'paymentSequenceRef',
    'tableTabPaymentRef',
    'paymentSyncRef',
    'settleAcceptedPayment',
    'reconcileTableTabPayment',
    'handleRegisterTableTabPayment',
    'handleRegisterPayment',
    'handleSaveMovement',
    'handleDeleteMovement',
    'handleSaveFinanceSettings',
    'handleUpdatePaymentPromise',
    'handleRegisterRefund',
  ]) assert.equal(app.includes(token), false, token)
})

test('operational runtime is payment agnostic', () => {
  for (const token of ['legacyBridges', 'capturePaymentOwners', 'settlePaymentOwners']) {
    assert.equal(runtime.includes(token), false, token)
  }
})
```

- [ ] **Step 3: Run architecture RED and commit/push**

```bash
node --test scripts/architecture/check-import-boundaries.test.mjs src/domains/finance/financeExtractionContract.test.js
```

Expected: new architecture fixture failures until checker rules are implemented; extraction failures only if real ownership remains.

- [ ] **Step 4: Implement checker rules**

Add `C6_LEGACY_FINANCE_OWNERS` for actual moved paths, including at least:
- `src/pages/Finance.jsx`
- `src/pages/Receivables.jsx`
- moved finance-exclusive dialogs/settings owners.

Add migrated API pattern:

```js
const migratedFinanceApiPattern =
  /export\s+const\s+(registerPayment|registerTableTabPayment|refundOrder|createMovement|updateMovement|deleteMovement|saveFinanceSettings|updateOrderPaymentPromise)\b/
if (migratedFinanceApiPattern.test(legacyApiClient)) {
  violations.push('c6-legacy-finance-api: src/api/client.js')
}
```

Add import-edge rules:
- `finance-deep-import`;
- `finance-orders-import`;
- `finance-table-service-import`.

Do not ban app surfaces/workflows from public domain imports.

- [ ] **Step 5: Tighten public Finance entry**

Audit:

```bash
rg -n "domains/finance/index" src --glob '!src/domains/finance/index.js'
```

Keep only exports consumed by those external callers. Internal Finance UI should deep-import its own domain/application files.

- [ ] **Step 6: Run final architecture/focused GREEN**

```bash
node --test   scripts/architecture/check-import-boundaries.test.mjs   src/domains/finance/financeExtractionContract.test.js   src/app/runtime/runtimeExtractionContract.test.js   src/domains/table-service/tableServiceExtractionContract.test.js
npm run test:architecture
npm test
```

Expected: all PASS.

- [ ] **Step 7: Commit GREEN + exact-SHA Validate**

```bash
git add scripts/architecture src/domains/finance src/app/runtime src/domains/table-service src/App.jsx
git commit -m "test: enforce finance workflow architecture"
git push origin feature/spec-c6-finance-workflows
```

Require Validate SUCCESS before Task 11.

---

### Task 11: Full gates, staging deployment, manual homologation, QA record, and merge handoff

**Files:**
- Create: `docs/superpowers/qa/spec-c6-finance-workflows-qa.md`
- Modify: `docs/superpowers/qa/spec-c-execution-ledger.md`
- Modify: `docs/superpowers/qa/spec-c-compatibility-facades.md`
- Modify: `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
- Modify: this plan's checkboxes/status only to reflect evidence actually reached.

**Interfaces:**
- No new runtime interfaces.
- Produces exact evidence for merge authorization.
- Payment-receipt bridge must be marked **REMOVED IN C6** only after physical/architecture audits pass.

- [ ] **Step 1: Verify final diff scope**

```bash
git status --short
git diff --check origin/master...HEAD
git diff --name-status origin/master...HEAD
git log --oneline origin/master..HEAD
```

Expected:
- no uncommitted files;
- no whitespace errors;
- no Worker/migration change unless separately justified and approved;
- no printing/QZ ownership moved;
- no Customer/Catalog implementation.

- [ ] **Step 2: Run complete local gates where a reliable worktree exists**

```bash
npm test
npm run test:architecture
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
```

Record exact test totals and intentional skips. If not run locally, label them runner-only; do not claim local PASS.

- [ ] **Step 3: Validate exact executable HEAD in GitHub**

Push normally. Require `Validate application` SUCCESS on the exact branch SHA.

Record:
- SHA;
- run number/id;
- test totals;
- architecture;
- lint;
- build;
- Worker dry-runs;
- local D1;
- Spec B D1.

Any failure stops staging.

- [ ] **Step 4: Deploy exact validated SHA to staging**

Dispatch `Deploy staging` manually using `feature/spec-c6-finance-workflows`.

Require the workflow to prove:
- checkout exact SHA;
- tests/gates required by staging workflow;
- remote staging migration check/application;
- deploy success;
- readiness;
- real login smoke.

Do not deploy production.

- [ ] **Step 5: Execute manual staging matrix**

Record each as PASS, FAIL, or BLOCKED:

1. payment from Cozinha;
2. payment from Histórico;
3. payment from A Receber;
4. cancel payment modal preserves context;
5. rapid/double confirmation does not duplicate;
6. offline disables payment;
7. effective default method is correct;
8. method deactivated during an open flow requires review;
9. table-tab/comanda payment;
10. paid comanda closes and table becomes free;
11. new comanda reoccupying same table is not cleared by old payment;
12. payment sync pending/error/retry behavior;
13. create manual movement;
14. edit manual movement;
15. delete manual movement;
16. opening balance;
17. Receivables filters + forecast;
18. payment promise add/change/remove;
19. pending refund visibility;
20. register full refund;
21. Settings payment methods;
22. Settings finance categories;
23. read-only/capability behavior if staging has a suitable restricted identity;
24. console has no new runtime errors.

A BLOCKED item remains BLOCKED with reason. Automated coverage does not convert it to manual PASS.

- [ ] **Step 6: Write QA evidence**

`spec-c6-finance-workflows-qa.md` must include:
- C6 base SHA `e8ec2304...`;
- executable SHA;
- Validate run;
- staging run;
- test totals;
- manual matrix totals;
- every BLOCKED reason;
- production deployment: **NO**;
- explicit architecture evidence that payment bridge is absent.

- [ ] **Step 7: Reconcile compatibility ledger**

Mark:
- operational payment-receipt bridge: **REMOVED IN C6**;
- table-commit bridge: still removed C5;
- generic/auth legacy reexports: remain C10;
- `updateCollection`: remains for C7/C8/C10.

Do not declare a bridge removed from intent alone; cite the architecture/source audit.

- [ ] **Step 8: Reconcile execution ledger/rollout**

At successful staging homologation with 0 FAIL:
- C6 = **HOMOLOGATED / AWAITING EXPLICIT MERGE AUTHORIZATION**;
- C7 = NOT STARTED;
- production = NO;
- record exact executable SHA and QA totals.

- [ ] **Step 9: Validate final docs-only HEAD**

After QA/ledger commits, run/observe `Validate application` on the exact final branch HEAD. A previous executable SHA is not the final merge gate.

If a final status-only commit is created after recording a prior docs validation, validate that exact status-only HEAD and report it in the PR handoff rather than creating an infinite self-referential documentation loop.

- [ ] **Step 10: Stop at merge authorization**

Present:
- final branch HEAD;
- final Validate;
- staging run;
- manual QA totals;
- BLOCKED reasons;
- compatibility ledger state;
- PR mergeable state;
- explicit statement: production untouched;
- C7 not started.

Do **not** merge until the user explicitly authorizes it.

---

## Plan self-review checklist

Before calling this plan ready:

- [ ] Every C6 spec requirement maps to a task.
- [ ] No Task moves printing/QZ ownership.
- [ ] No Task allows Finance → Orders/Table Service imports.
- [ ] Payment promise stays Orders-owned.
- [ ] Accepted table-tab payment reconciliation survives UI/selection changes and handles the pre-payment read race.
- [ ] Runtime payment-receipt bridge is removed only after a replacement workflow is GREEN.
- [ ] Legacy API exports are removed only after new owners exist.
- [ ] Settings generic policy engine remains app-owned.
- [ ] Every behavioral extraction has an intended RED.
- [ ] No unfinished placeholder, vague deferred step, or unowned interface remains.
- [ ] Final staging/manual QA and exact-HEAD validation are required before merge.
