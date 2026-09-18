
# Spec C5 — Table Service Domain Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish `src/domains/table-service` as the single frontend owner for Tables, Comandas, table-tab identity/selection/detail/transfer behavior and table-management commands while preserving the central runtime as the only official owner of `tables` and `tableTabs`.

**Architecture:** Extract Table Service behind a deliberate `src/domains/table-service/index.js` boundary. Keep `app/runtime` responsible for official collections, bootstrap/polling/sync guards; Table Service receives those collections and narrow mutation/refresh ports. Keep payment and printing outside the domain through `src/app/surfaces/table-service/TableServiceExternalActions.jsx` until C6/C9.

**Tech Stack:** React 19.2.8, React DOM 19.2.8, Vite 8.2.2, Node 22 `node:test`, `react-test-renderer` 19.2.8, oxlint 1.79.0, Cloudflare Worker/D1, GitHub Actions, QZ Tray 2.2.6 unchanged.

**Spec:** `docs/superpowers/specs/2026-09-18-frontend-modularization-c5-table-service-design.md`

## Planning baseline — 2026-09-18

- Repository: `vzaponi-dotcom/sistema-para-delivery`.
- Branch: `feature/spec-c5-table-service`.
- Approved C5 base/master SHA: `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`.
- Remote branch HEAD verified before plan authoring: `b3847d3e003e57801c70559283af908b7c2a662e`.
- The branch was 2 commits ahead / 0 behind master and contained documentation changes only.
- C4 is merged and complete. C6 is not started.
- The written C5 spec and this implementation plan were explicitly approved by the user on 2026-09-18.
- Production deploy is not part of C5 implementation or homologation.

## Execution status — current checkpoint — 2026-09-18

- Task 1: **COMPLETE / GREEN**.
  - RED: `9d247b31e2ff15589eddc84d4da8b3cf96ee91aa`; Validate #1293 / run `35377843427`.
  - GREEN: `e8f490808900d56c2c23d6683ed5365da4921b80`; Validate #1294 / run `35378133967` — **1,698 tests / 1,697 pass / 0 fail / 1 skipped**.
- Task 2: **COMPLETE / GREEN**.
  - Authoritative RED: `de43919b3395eab52b1518b099b79b4225cb69aa`; Validate #1296 / run `35378772513`.
  - First GREEN candidate `ec6e8c3a12ace35745e9fa4bb70345f13235df45` exposed one payment visual-ownership regression in Validate #1297.
  - Root-cause fix: `1eb0f4b51283ad2f6274720a6eaafa63156fbe00`.
  - Final GREEN: Validate #1298 / run `35379605815` — **1,702 tests / 1,701 pass / 0 fail / 1 skipped**; remaining gates green.
- Task 3: **COMPLETE / GREEN**.
  - RED: `8f460f139845e2288abe1d454d5d83c89643fb7b`; Validate #1300 / run `35380071895` failed for the intended missing-`useTableTabDetail.js` boundary.
  - During GREEN publication the branch advanced with docs-only progress commits; they were preserved and the implementation was reapplied by normal fast-forward, without force push or history rewrite.
  - GREEN: `4fcfff12a3357dfbeb1587142b643a0db55702bf`; Validate #1306 / run `35380450226` — **1,712 tests / 1,711 pass / 0 fail / 1 skipped**; architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green.
  - `Comandas.jsx` no longer owns direct detail HTTP/loading. `useTableTabDetail` owns request generation, stale-result/401 rejection, retry and same-owner refresh coalescing.
  - Intentional intermediate dependency: the controller defaults to the legacy `getTableTabDetail` helper only until Task 4 moves the endpoint into `tableServiceApi.js`.
- Task 4: **COMPLETE / GREEN**.
  - RED: `78d246915eed7847b3db9719e5c2e02137d996c7`; Validate #1308 / run `35380889353` failed for the intended missing-`tableServiceApi.js` reason.
  - GREEN: `7ef5fc7a68292e17372bb15a9d23131c38ecfd48`; Validate #1309 / run `35381219700` — **1,711 tests / 1,710 pass / 0 fail / 1 skipped**; remaining gates green.
  - `useTableTabDetail` now defaults to `tableServiceApi`; legacy `getTableTabDetail` is removed; C6/C9 APIs remain in the legacy client.
- Task 5: **COMPLETE / GREEN**.
  - RED: `ec27b99d4528d9e0ae4af2eed5d369f04658eeaa`; Validate #1311 failed for the intended missing-`useTableServiceCommands.js` reason.
  - GREEN candidate: `aab6ca4ccb0461510a65bbb3a079808174229d4d`; all new command tests passed, but Validate #1312 exposed one stale `tablesNavigation.test.js` source-contract.
  - Final test-only alignment: `44f9b9e0f4410ae909873811fff70b2c5b80f083`; Validate #1313 / run `35382601189` — **1,716 tests / 1,715 pass / 0 fail / 1 skipped**; architecture/lint/build/Worker dry-runs/local D1/Spec B D1 all green.
  - App no longer owns create/rename/active/reorder/transfer handlers. Legacy C5 API exports are removed; C6/C9 endpoints remain untouched.
- Task 6: **NOT STARTED / NEXT**.
- Tasks 7–11: **NOT STARTED**.
- C6: **NOT STARTED**.
- Staging/production deploy for C5: **NO**.

## Global Constraints

- Work only on `feature/spec-c5-table-service` in a fresh isolated worktree created from the current remote branch using `superpowers:using-git-worktrees`; never implement directly on `master`.
- Before editing code, re-verify the remote branch HEAD and confirm it descends from `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`. Investigate unexpected movement before modifying files.
- Preserve current user-visible behavior and visuals. C5 is an architectural extraction, not a redesign, UX change, feature addition, or business-rule change.
- Keep Worker routes, response envelopes, D1 schema, migrations, polling cadence, storage semantics, capabilities and existing functional copy unchanged.
- Keep the central operational runtime as the single official owner of `tables[]` and `tableTabs[]`. Do not add a Table Service bootstrap, store, provider, polling loop, WebSocket or SSE.
- The canonical open-comanda identity is `{ tableId, tableTabId }`. `tableTabId` is the durable identity; `tableId` alone is never sufficient.
- A transfer of the same `tableTabId` follows the same selection without advancing selection generation; close/replacement/disappearance or a fresh explicit selection retires the previous generation.
- Table Service domain files must remain pure: no React, UI, fetch, storage, browser APIs, QZ, Finance internals, or Orders internals.
- Move exactly `createTable`, `updateTable`, `reorderTables`, `transferTableTab` and `getTableTabDetail` into Table Service API ownership. Leave `registerTableTabPayment` for C6 and `getTableTabPrintDocument` / `createManualTableTabPrintJob` for C9.
- Remove the runtime `onTablesCommitted` bridge in C5. Keep the payment-receipt runtime bridge until C6.
- Payment and printing remain external integrations. Any external intent that may outlive the click carries `tableId`, `tableTabId` and `selectionGeneration`.
- Accepted financial obligations continue reconciling globally even if their original visual selection retires.
- Outside `src/domains/table-service/`, consume Table Service only through `src/domains/table-service/index.js` after the relevant migration task closes. Orders may depend on that public entry; Table Service may not import Orders, including its public entry.
- Keep existing CSS files physically in place unless an import-path change is mechanically required. Do not reorder styles for cleanup.
- Use strict RED → GREEN for behavioral boundaries and characterization tests for moves. Every task must finish green before the next task starts.
- Do not force-push, reset, clean, stash/discard unrelated work, merge to master, or deploy production without explicit user authorization.

---

## File ownership map locked by this plan

`src/domains/table-service/domain/tables.js` owns active/free/occupied interpretation and stable sort projection.

`src/domains/table-service/domain/comandaIdentity.js` owns exact open-comanda resolution, durable `tableTabId` lookup, same-comanda equality, transfer-following reconciliation, and close/reuse invalidation.

`src/domains/table-service/domain/tableTransfer.js` owns valid destination projection and pure source/destination/expected-tab validation.

`src/domains/table-service/application/useComandaSelection.js` owns controlled selection, selection generation, official-table reconciliation, explicit reselection, reset and current-owner checks.

`src/domains/table-service/application/useTableTabDetail.js` owns detail load/refresh/retry, retained current detail, request ownership, coalesced refresh, stale-result rejection and current-owner unauthorized forwarding.

`src/domains/table-service/application/useTableServiceCommands.js` owns create/rename/activate/deactivate/reorder/transfer orchestration through narrow ports.

`src/domains/table-service/infrastructure/tableServiceApi.js` owns the five C5 HTTP contracts.

`src/domains/table-service/ui/` owns Tables, Comandas, ComandaDetail, TableTransferDialog and LocalTableSelector.

`src/app/surfaces/table-service/TableServiceExternalActions.jsx` owns table-service payment/preview/print overlay/action state without owning table-service business rules or accepted-payment reconciliation.

`src/domains/table-service/index.js` is the only supported Table Service import path for code outside the domain. It exports deliberate public rules/controllers/surfaces only.

---

### Task 1: Establish the Table Service public boundary and pure domain rules

**Files:**
- Create: `src/domains/table-service/index.js`
- Create: `src/domains/table-service/tableServicePublicContract.test.js`
- Create/Test: `src/domains/table-service/domain/tables.js`
- Create/Test: `src/domains/table-service/domain/tables.test.js`
- Create/Test: `src/domains/table-service/domain/comandaIdentity.js`
- Create/Test: `src/domains/table-service/domain/comandaIdentity.test.js`
- Create/Test: `src/domains/table-service/domain/tableTransfer.js`
- Create/Test: `src/domains/table-service/domain/tableTransfer.test.js`

**Interfaces:**
- Produces `orderTables(tables)`, `getActiveTables(tables)`, `isActiveTable(table)`, `isOccupiedTable(table)`, `isFreeTable(table)`.
- Produces `findOpenTableByTabId(tables, tableTabId)`, `resolveOpenComanda(tables, target)`, `reconcileComandaSelection(tables, selection)` and `sameComandaIdentity(left, right)`. `resolveOpenComanda` remains the one pure helper intentionally needed by App composition for pre-navigation stale-target validation; the other pure helpers become internal-only by the final architecture task.
- Produces `getTransferDestinations(tables, sourceTableId)` and `validateTransferIntent(tables, intent)`.
- No React/application/UI/API dependency is introduced.

- [x] **Step 1: Write the failing public-contract and domain tests**

Create `src/domains/table-service/tableServicePublicContract.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getTransferDestinations,
  reconcileComandaSelection,
  resolveOpenComanda,
} from './index.js'

test('table-service public contract exposes canonical identity and transfer rules', () => {
  assert.equal(typeof resolveOpenComanda, 'function')
  assert.equal(typeof reconcileComandaSelection, 'function')
  assert.equal(typeof getTransferDestinations, 'function')
})
```

Create fixtures in the three domain tests with:

```js
const tabA = { id: 'tab-A', number: 41 }
const tabB = { id: 'tab-B', number: 42 }
const occupiedA = { id: 'table-1', name: 'Mesa 1', isActive: true, occupancy: 'occupied', sortOrder: 2, openTableTab: tabA }
const free = { id: 'table-2', name: 'Mesa 2', isActive: true, occupancy: 'free', sortOrder: 1, openTableTab: null }
const inactive = { id: 'table-3', name: 'Mesa 3', isActive: false, occupancy: 'free', sortOrder: 3, openTableTab: null }
```

The tests must prove all of these exact cases:

```js
assert.deepEqual(orderTables([occupiedA, free]).map((table) => table.id), ['table-2', 'table-1'])
assert.deepEqual(getActiveTables([occupiedA, free, inactive]).map((table) => table.id), ['table-2', 'table-1'])
assert.equal(isOccupiedTable(occupiedA), true)
assert.equal(isFreeTable(free), true)
assert.deepEqual(resolveOpenComanda([occupiedA], { tableId: 'table-1', tableTabId: 'tab-A' }), { tableId: 'table-1', tableTabId: 'tab-A' })
assert.equal(resolveOpenComanda([{ ...occupiedA, openTableTab: tabB }], { tableId: 'table-1', tableTabId: 'tab-A' }), null)
assert.deepEqual(
  reconcileComandaSelection([{ ...free, id: 'table-5', occupancy: 'occupied', openTableTab: tabA }], { tableId: 'table-1', tableTabId: 'tab-A' }),
  { tableId: 'table-5', tableTabId: 'tab-A' },
)
assert.equal(reconcileComandaSelection([{ ...occupiedA, openTableTab: tabB }], { tableId: 'table-1', tableTabId: 'tab-A' }), null)
assert.deepEqual(getTransferDestinations([occupiedA, free, inactive], 'table-1').map((table) => table.id), ['table-2'])
assert.equal(validateTransferIntent([occupiedA, free], { sourceTableId: 'table-1', destinationTableId: 'table-2', expectedTableTabId: 'tab-A' })?.source.id, 'table-1')
assert.equal(validateTransferIntent([{ ...occupiedA, openTableTab: tabB }, free], { sourceTableId: 'table-1', destinationTableId: 'table-2', expectedTableTabId: 'tab-A' }), null)
```

- [x] **Step 2: Run RED**

```bash
node --test   src/domains/table-service/tableServicePublicContract.test.js   src/domains/table-service/domain/tables.test.js   src/domains/table-service/domain/comandaIdentity.test.js   src/domains/table-service/domain/tableTransfer.test.js
```

Expected: FAIL because the Table Service public entry and pure rule files do not exist.

- [x] **Step 3: Implement the pure table projections**

Create `src/domains/table-service/domain/tables.js`:

```js
export const orderTables = (tables = []) => [...tables].sort(
  (left, right) => Number(left?.sortOrder ?? 0) - Number(right?.sortOrder ?? 0),
)

export const isActiveTable = (table) => Boolean(table?.isActive)

export const isOccupiedTable = (table) => Boolean(
  table?.isActive
  && table?.occupancy === 'occupied'
  && table?.openTableTab?.id,
)

export const isFreeTable = (table) => Boolean(
  table?.isActive
  && table?.occupancy === 'free',
)

export const getActiveTables = (tables = []) => orderTables(tables).filter(isActiveTable)
```

- [x] **Step 4: Implement canonical comanda identity rules**

Create `src/domains/table-service/domain/comandaIdentity.js`:

```js
import { isOccupiedTable } from './tables.js'

export const sameComandaIdentity = (left, right) => (
  left?.tableId === right?.tableId
  && left?.tableTabId === right?.tableTabId
)

export const findOpenTableByTabId = (tables = [], tableTabId) => {
  if (!tableTabId) return null
  return tables.find((table) => isOccupiedTable(table) && table.openTableTab.id === tableTabId) ?? null
}

export const resolveOpenComanda = (tables = [], target) => {
  if (!target?.tableId || !target?.tableTabId) return null
  const table = tables.find((item) => item.id === target.tableId)
  if (!isOccupiedTable(table) || table.openTableTab.id !== target.tableTabId) return null
  return { tableId: table.id, tableTabId: table.openTableTab.id }
}

export const reconcileComandaSelection = (tables = [], selection) => {
  if (!selection?.tableTabId) return null
  const table = findOpenTableByTabId(tables, selection.tableTabId)
  return table ? { tableId: table.id, tableTabId: selection.tableTabId } : null
}
```

- [x] **Step 5: Implement pure transfer validation**

Create `src/domains/table-service/domain/tableTransfer.js`:

```js
import { resolveOpenComanda } from './comandaIdentity.js'
import { isFreeTable, orderTables } from './tables.js'

export const getTransferDestinations = (tables = [], sourceTableId) => orderTables(tables)
  .filter((table) => table.id !== sourceTableId && isFreeTable(table))

export const validateTransferIntent = (tables = [], {
  sourceTableId,
  destinationTableId,
  expectedTableTabId,
} = {}) => {
  const identity = resolveOpenComanda(tables, { tableId: sourceTableId, tableTabId: expectedTableTabId })
  if (!identity || !destinationTableId || destinationTableId === sourceTableId) return null
  const source = tables.find((table) => table.id === sourceTableId) ?? null
  const destination = tables.find((table) => table.id === destinationTableId) ?? null
  if (!source || !isFreeTable(destination)) return null
  return { identity, source, destination }
}
```

- [x] **Step 6: Create the first deliberate public entry**

Create `src/domains/table-service/index.js` with only the pure public contract at this point:

```js
export {
  getActiveTables,
  isActiveTable,
  isFreeTable,
  isOccupiedTable,
  orderTables,
} from './domain/tables.js'
export {
  findOpenTableByTabId,
  reconcileComandaSelection,
  resolveOpenComanda,
  sameComandaIdentity,
} from './domain/comandaIdentity.js'
export {
  getTransferDestinations,
  validateTransferIntent,
} from './domain/tableTransfer.js'
```

- [x] **Step 7: Run GREEN and architecture smoke**

```bash
node --test   src/domains/table-service/tableServicePublicContract.test.js   src/domains/table-service/domain/tables.test.js   src/domains/table-service/domain/comandaIdentity.test.js   src/domains/table-service/domain/tableTransfer.test.js
npm run test:architecture
```

Expected: PASS and `Frontend architecture boundaries: OK`.

- [x] **Step 8: Commit**

```bash
git add src/domains/table-service
git commit -m "feat: establish table service domain rules"
```

---

### Task 2: Extract controlled comanda selection and remove the runtime table-commit bridge

**Files:**
- Create/Test: `src/domains/table-service/application/useComandaSelection.js`
- Create/Test: `src/domains/table-service/application/useComandaSelection.test.js`
- Modify: `src/domains/table-service/index.js`
- Modify: `src/App.jsx`
- Modify/Test: `src/app/runtime/data/useOperationalDataRuntime.js`
- Modify/Test: `src/app/runtime/data/useOperationalDataRuntime.test.js`
- Modify/Test: `src/app/runtime/runtimeExtractionContract.test.js`
- Regression: `src/comandasTransferNavigation.test.js`
- Regression: `src/comandasAppWiring.test.js`

**Interfaces:**
- `useComandaSelection({ tables })` returns:
  - `selection`
  - `selectionGeneration`
  - `selectComanda(target) -> boolean`
  - `clearComandaSelection()`
  - `resetComandaSelection()`
  - `ownsComandaSelection(owner) -> boolean`
  - `getComandaSelectionOwner() -> { tableId, tableTabId, selectionGeneration } | null`
- Official snapshots reconcile by `tableTabId`; a table move does not advance generation.
- Explicit selection, invalidation and reset advance generation.
- Runtime `legacyBridges` keeps payment reconciliation callbacks but no longer supports `onTablesCommitted`.

- [x] **Step 1: Write RED tests for selection generations**

Create `src/domains/table-service/application/useComandaSelection.test.js` using the same `react-test-renderer` probe pattern as `useOrderCommands.test.js`.

The test matrix must assert:

```js
await act(async () => assert.equal(probe.getLatest().selectComanda({ tableId: 'table-1', tableTabId: 'tab-A' }), true))
assert.deepEqual(probe.getLatest().selection, { tableId: 'table-1', tableTabId: 'tab-A' })
const generationA = probe.getLatest().selectionGeneration

await probe.update({ tables: transferredTables })
assert.deepEqual(probe.getLatest().selection, { tableId: 'table-5', tableTabId: 'tab-A' })
assert.equal(probe.getLatest().selectionGeneration, generationA)

await probe.update({ tables: replacementTables })
assert.equal(probe.getLatest().selection, null)
assert.equal(probe.getLatest().selectionGeneration, generationA + 1)

await probe.update({ tables: sourceTables })
await act(async () => probe.getLatest().selectComanda({ tableId: 'table-1', tableTabId: 'tab-A' }))
const firstOwner = probe.getLatest().getComandaSelectionOwner()
await act(async () => probe.getLatest().selectComanda({ tableId: 'table-1', tableTabId: 'tab-A' }))
assert.equal(probe.getLatest().ownsComandaSelection(firstOwner), false)

const ownerBeforeReset = probe.getLatest().getComandaSelectionOwner()
await act(async () => probe.getLatest().resetComandaSelection())
assert.equal(probe.getLatest().selection, null)
assert.equal(probe.getLatest().ownsComandaSelection(ownerBeforeReset), false)
```

Also assert an equivalent cloned tables snapshot leaves both selection and generation unchanged.

- [x] **Step 2: Change the runtime characterization to expect no table-commit callback**

Replace the current runtime test named `table commits notify the bridge and update the official tables snapshot` with a test named `table commits update the official snapshot without invoking domain behavior`.

Mount with a `legacyBridges.onTablesCommitted` function that throws if called:

```js
const harness = await mountHarness(t, {
  api: { getBootstrap: async () => bootstrap, getOrders: async () => ({ orders: [] }) },
  legacyBridges: {
    onTablesCommitted: () => assert.fail('runtime must not call Table Service behavior'),
  },
})
await act(async () => { await harness.getCurrent().refreshBootstrap() })
assert.deepEqual(harness.getCurrent().getOfficialTables().map(({ id }) => id), ['table-1'])
```

This test is expected to fail before the bridge is removed.

- [x] **Step 3: Run RED**

```bash
node --test   src/domains/table-service/application/useComandaSelection.test.js   src/app/runtime/data/useOperationalDataRuntime.test.js
```

Expected: FAIL because the hook does not exist and the runtime still invokes `onTablesCommitted`.

- [x] **Step 4: Implement `useComandaSelection`**

Use refs for synchronous current-owner reads and React state for rendering. The core shape is:

```js
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  reconcileComandaSelection,
  resolveOpenComanda,
  sameComandaIdentity,
} from '../domain/comandaIdentity.js'

export function useComandaSelection({ tables = [] } = {}) {
  const tablesRef = useRef(tables)
  const selectionRef = useRef(null)
  const generationRef = useRef(0)
  const [selection, setSelection] = useState(null)
  const [selectionGeneration, setSelectionGeneration] = useState(0)
  tablesRef.current = tables

  const publish = useCallback((nextSelection, { advanceGeneration }) => {
    if (advanceGeneration) generationRef.current += 1
    selectionRef.current = nextSelection
    setSelection(nextSelection)
    setSelectionGeneration(generationRef.current)
  }, [])

  const selectComanda = useCallback((target) => {
    const resolved = resolveOpenComanda(tablesRef.current, target)
    if (!resolved) return false
    publish(resolved, { advanceGeneration: true })
    return true
  }, [publish])

  const clearComandaSelection = useCallback(() => {
    if (!selectionRef.current) return false
    publish(null, { advanceGeneration: true })
    return true
  }, [publish])

  const resetComandaSelection = useCallback(() => {
    publish(null, { advanceGeneration: true })
  }, [publish])

  const ownsComandaSelection = useCallback((owner) => Boolean(
    owner
    && owner.selectionGeneration === generationRef.current
    && owner.tableId === selectionRef.current?.tableId
    && owner.tableTabId === selectionRef.current?.tableTabId
  ), [])

  const getComandaSelectionOwner = useCallback(() => selectionRef.current ? {
    ...selectionRef.current,
    selectionGeneration: generationRef.current,
  } : null, [])

  useEffect(() => {
    const current = selectionRef.current
    if (!current) return
    const reconciled = reconcileComandaSelection(tables, current)
    if (!reconciled) {
      publish(null, { advanceGeneration: true })
      return
    }
    if (!sameComandaIdentity(current, reconciled)) {
      publish(reconciled, { advanceGeneration: false })
    }
  }, [publish, tables])

  return {
    selection,
    selectionGeneration,
    selectComanda,
    clearComandaSelection,
    resetComandaSelection,
    ownsComandaSelection,
    getComandaSelectionOwner,
  }
}
```

- [x] **Step 5: Integrate selection into App without changing payment semantics**

Export `useComandaSelection` from `src/domains/table-service/index.js`.

In `App.jsx` remove:
- `selectedComanda` / `selectedComandaGeneration` local `useState` ownership;
- `comandaSelectionRef`;
- `comandaIdentityRef`;
- `selectComanda` implementation;
- `resolveOpenComanda` implementation;
- `onTablesCommitted` implementation and assignment.

After `tables` comes from `useOperationalDataRuntime`, compose:

```js
const {
  selection: selectedComanda,
  selectionGeneration: selectedComandaGeneration,
  selectComanda,
  clearComandaSelection,
  resetComandaSelection,
  ownsComandaSelection,
  getComandaSelectionOwner,
} = useComandaSelection({ tables })
```

Import `resolveOpenComanda` from the Table Service public entry and use it only as a pure pre-navigation/pre-New-Order validation against `getOfficialTables()`. Keep current stale-target feedback by refusing the action before navigation when resolution fails, showing the existing message and calling `refreshBootstrapSilently()`. Once a target is resolved, pass that exact identity to `selectComanda`; do not recreate the resolution rule in App.

Change payment visual ownership checks from App-owned refs to the hook owner:

```js
const ownsPaymentSelection = (owner) => owner?.guard === getSyncGuard()
  && ownsComandaSelection({
    tableId: owner.tableId,
    tableTabId: owner.tabId,
    selectionGeneration: owner.selectionGeneration,
  })
```

When creating a payment owner, capture `getComandaSelectionOwner()` once and store its `selectionGeneration`.

In `clearBusinessData` call `resetComandaSelection()` instead of manipulating selection refs.

- [x] **Step 6: Remove the runtime callback**

In `useOperationalDataRuntime.js` make `commitTables` only update official state:

```js
const commitTables = useCallback((nextTables) => {
  officialTablesRef.current = nextTables
  setTables(nextTables)
}, [])
```

Remove `onTablesCommitted` from `operationalBridgeTargetsRef` in App. Keep `capturePaymentOwners` / `settlePaymentOwners` behavior unchanged.

- [x] **Step 7: Tighten the runtime extraction test**

In `src/app/runtime/runtimeExtractionContract.test.js` add these forbidden App tokens:

```js
'comandaSelectionRef',
'comandaIdentityRef',
'const onTablesCommitted',
```

Do not remove payment tokens such as `settleAcceptedPayment` or `handleRegisterTableTabPayment`; they remain C6 responsibilities.

- [x] **Step 8: Run GREEN regressions**

```bash
node --test   src/domains/table-service/application/useComandaSelection.test.js   src/app/runtime/data/useOperationalDataRuntime.test.js   src/app/runtime/runtimeExtractionContract.test.js   src/comandasTransferNavigation.test.js   src/comandasAppWiring.test.js
```

Expected: PASS. In particular, the existing `official transfer keeps the selected tab...` and replacement/payment-isolation tests stay green.

- [x] **Step 9: Commit**

```bash
git add src/domains/table-service src/App.jsx src/app/runtime
git commit -m "refactor: extract comanda selection ownership"
```

---

### Task 3: Extract table-tab detail loading from Comandas

**Files:**
- Create/Test: `src/domains/table-service/application/useTableTabDetail.js`
- Create/Test: `src/domains/table-service/application/useTableTabDetail.test.js`
- Modify: `src/domains/table-service/index.js`
- Modify: `src/pages/Comandas.jsx`
- Regression: `src/pages/Comandas.test.js`
- Regression: `src/comandasAppWiring.test.js`

**Interfaces:**
- `useTableTabDetail({ selection, officialTables, api, onUnauthorized })` returns `{ detail, loading, error, retry }`.
- For this intermediate task, `api` is injectable and defaults to the existing legacy `getTableTabDetail` helper inside the application hook; Task 4 immediately replaces that temporary dependency with the Table Service infrastructure adapter.
- New selection starts a new owner immediately even if an older request is still pending.
- Same-owner refreshes coalesce to one in-flight read plus at most one queued follow-up.
- Initial failure exposes an error; failed background refresh retains the current detail.
- A stale success/error/401 has no visual/session effect.

- [x] **Step 1: Write RED hook tests**

Use an injectable `api.getTableTabDetail` and deferred promises. Prove:

1. initial loading → exact open detail;
2. retry after initial error;
3. retained detail during background refresh;
4. repeated `officialTables` updates while pending queue one follow-up;
5. selection A request resolving after selection B cannot overwrite B;
6. stale A 401 does not call `onUnauthorized`;
7. current-owner 401 calls `onUnauthorized` once;
8. closed, wrong-tab or wrong-table detail is rejected as unavailable.

The owner-validation assertion must use:

```js
const valid = tableTab
  && tableTab.id === selection.tableTabId
  && tableTab.status === 'open'
  && tableTab.table?.id === selection.tableId
```

- [x] **Step 2: Run RED**

```bash
node --test src/domains/table-service/application/useTableTabDetail.test.js
```

Expected: FAIL because `useTableTabDetail.js` does not exist.

- [x] **Step 3: Implement request ownership and coalescing**

Implement a per-selection owner counter and per-owner request state. For this single intermediate task, import `getTableTabDetail as legacyGetTableTabDetail` from `../../../api/client.js` and default the hook's `api` parameter to `{ getTableTabDetail: legacyGetTableTabDetail }`. This keeps HTTP ownership out of `Comandas` while every commit remains green; Task 4 removes this temporary legacy application dependency before architecture enforcement. The load path must follow this ordering:

```js
const runLoad = async (owner) => {
  const identity = owner.selection
  try {
    const { tableTab } = await apiRef.current.getTableTabDetail(identity.tableTabId)
    if (ownerRef.current !== owner) return false
    if (!tableTab
      || tableTab.id !== identity.tableTabId
      || tableTab.status !== 'open'
      || tableTab.table?.id !== identity.tableId) {
      throw new Error('Comanda indisponível, encerrada ou transferida. Atualize a consulta.')
    }
    setSnapshot({ detail: tableTab, loading: false, error: undefined })
    return true
  } catch (error) {
    if (ownerRef.current !== owner) return false
    setSnapshot((current) => current.detail
      ? { ...current, loading: false, error: undefined }
      : { detail: null, loading: false, error: error?.message || 'Não foi possível carregar a comanda.' })
    if (error?.status === 401) onUnauthorizedRef.current?.(error)
    return false
  }
}
```

Use a second effect keyed by `officialTables` to request a refresh for the current owner. If that owner already has a read in flight, set `queued = true`; the current owner's `finally` runs exactly one follow-up.

When the selection identity changes:
- increment the owner generation;
- replace the owner object and request state;
- clear old detail and enter initial loading;
- start the new request without waiting for the old owner.

- [x] **Step 4: Replace direct HTTP ownership in legacy Comandas**

In `src/pages/Comandas.jsx`:
- remove `getTableTabDetail` import;
- remove `refreshRef` / direct request effect from `SelectedComanda`;
- call `useTableTabDetail({ selection: { tableId, tableTabId: tabId }, officialTables: tables, onUnauthorized: onApiError })`;
- map `loading/error/detail/retry` back to the same rendered text and retry button;
- keep payment/printing overlays temporarily unchanged in this task.

Export the hook from `src/domains/table-service/index.js` but keep the legacy UI importing only the hook from the public entry while it is outside the domain.

- [x] **Step 5: Run GREEN detail and UI regressions**

```bash
node --test   src/domains/table-service/application/useTableTabDetail.test.js   src/pages/Comandas.test.js   src/comandasAppWiring.test.js
```

Expected: PASS, including the current tests for slow refresh coalescing, stale detail, transfer/mismatch, current selection and session reset.

- [x] **Step 6: Verify no detail HTTP call remains in Comandas**

```bash
rg "getTableTabDetail|/api/table-tabs/" src/pages/Comandas.jsx
```

Expected: no output.

- [x] **Step 7: Commit**

```bash
git add src/domains/table-service src/pages/Comandas.jsx src/pages/Comandas.test.js src/comandasAppWiring.test.js
git commit -m "refactor: extract table tab detail controller"
```

---

### Task 4: Move C5 HTTP contracts into Table Service infrastructure

**Files:**
- Create/Test: `src/domains/table-service/infrastructure/tableServiceApi.js`
- Create/Test: `src/domains/table-service/infrastructure/tableServiceApi.test.js`
- Modify: `src/domains/table-service/application/useTableTabDetail.js`
- Modify: `src/api/tableTabClient.test.js`
- Modify: `src/api/client.test.js`
- Modify later in Task 5: `src/api/client.js` for the four command exports still consumed by App.

**Interfaces:**
- `createTableServiceApi({ request = apiRequest, json = withJson })`.
- Default frozen instance: `tableServiceApi`.
- Exact methods: `createTable`, `updateTable`, `reorderTables`, `transferTableTab`, `getTableTabDetail`.
- No raw `fetch` outside generic HTTP infrastructure.

- [x] **Step 1: Write RED API contract test**

Create `src/domains/table-service/infrastructure/tableServiceApi.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { createTableServiceApi } from './tableServiceApi.js'

test('table service api preserves exact routes and payloads', async () => {
  const calls = []
  const request = async (path, options = {}) => {
    calls.push([path, options])
    return path.includes('/table-tabs/')
      ? { tableTab: { id: 'tab / A' } }
      : { tables: [] }
  }
  const json = (method, body) => ({ method, body: JSON.stringify(body) })
  const api = createTableServiceApi({ request, json })

  await api.createTable({ name: 'Varanda' })
  await api.updateTable('mesa / 1', { isActive: false })
  await api.reorderTables(['mesa-2', 'mesa-1'])
  await api.transferTableTab('mesa / 1', 'mesa-2', 'tab-A')
  await api.getTableTabDetail('tab / A')

  assert.deepEqual(calls.map(([path, options]) => [path, options.method || 'GET']), [
    ['/api/tables', 'POST'],
    ['/api/tables/mesa%20%2F%201', 'PATCH'],
    ['/api/tables/order', 'PUT'],
    ['/api/tables/mesa%20%2F%201/transfer', 'POST'],
    ['/api/table-tabs/tab%20%2F%20A', 'GET'],
  ])
  assert.deepEqual(JSON.parse(calls[3][1].body), {
    destinationTableId: 'mesa-2',
    expectedTableTabId: 'tab-A',
  })
})
```

- [x] **Step 2: Run RED**

```bash
node --test src/domains/table-service/infrastructure/tableServiceApi.test.js
```

Expected: FAIL because the adapter does not exist.

- [x] **Step 3: Implement the adapter**

Create `src/domains/table-service/infrastructure/tableServiceApi.js`:

```js
import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'

export const createTableServiceApi = ({
  request = apiRequest,
  json = withJson,
} = {}) => Object.freeze({
  createTable: (table) => request('/api/tables', json('POST', table)),
  updateTable: (id, patch) => request(
    `/api/tables/${encodeURIComponent(id)}`,
    json('PATCH', patch),
  ),
  reorderTables: (tableIds) => request('/api/tables/order', json('PUT', { tableIds })),
  transferTableTab: (sourceTableId, destinationTableId, expectedTableTabId) => request(
    `/api/tables/${encodeURIComponent(sourceTableId)}/transfer`,
    json('POST', { destinationTableId, expectedTableTabId }),
  ),
  getTableTabDetail: (id) => request(`/api/table-tabs/${encodeURIComponent(id)}`),
})

export const tableServiceApi = createTableServiceApi()
```

- [x] **Step 4: Make detail loading use the domain adapter**

In `useTableTabDetail.js`, remove the temporary `../../../api/client.js` import from Task 3 and default the injectable `api` to `tableServiceApi` with an internal relative import. Do not expose the adapter from the public index solely for UI use.

- [x] **Step 5: Split legacy table-tab client tests by ownership**

In `src/api/tableTabClient.test.js` keep only the C6/C9 contracts:
- `getTableTabPrintDocument`;
- `createManualTableTabPrintJob`.

Remove `getTableTabDetail` and `transferTableTab` imports/tests from that legacy file because the new adapter test owns them.

In `src/api/client.test.js` remove the `table management helpers...` test that calls `tableClient.createTable/updateTable/reorderTables/transferTableTab`; the new domain adapter test replaces it.

Do not remove the five legacy function declarations from `src/api/client.js` yet in this task except `getTableTabDetail` if no remaining consumer exists. The remaining four are removed atomically with App command migration in Task 5 so each commit stays green.

- [x] **Step 6: Run GREEN**

```bash
node --test   src/domains/table-service/infrastructure/tableServiceApi.test.js   src/domains/table-service/application/useTableTabDetail.test.js   src/api/tableTabClient.test.js   src/api/client.test.js   src/pages/Comandas.test.js
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/domains/table-service src/api src/pages/Comandas.jsx
git commit -m "refactor: move table service api ownership"
```

---

### Task 5: Extract table-management and transfer commands from App

**Files:**
- Create/Test: `src/domains/table-service/application/useTableServiceCommands.js`
- Create/Test: `src/domains/table-service/application/useTableServiceCommands.test.js`
- Modify: `src/domains/table-service/index.js`
- Modify: `src/App.jsx`
- Modify: `src/api/client.js`
- Modify/Test: `src/tablesAppWiring.test.js`
- Modify/Test: `src/tableTabsAppWiring.test.js`
- Regression: `src/tableTransferIdentityUi.test.js`
- Regression: `src/comandasTransferNavigation.test.js`

**Interfaces:**
- `useTableServiceCommands({ api, getOfficialTables, applyOfficialEffects, refreshOfficialData, writesBlocked, canManageTables, canTransfer, setRequestKey, onSuccess, onError, onStaleTarget })`.
- Returns `createTable`, `renameTable`, `setTableActive`, `reorderTables`, `transferTableTab`.
- All mutation results apply backend-authoritative tables; transfer applies `{ tables, tableTab }` together.
- A client-side stale transfer target triggers current stale feedback + official refresh and no request.
- 409 triggers one refresh, surfaces the API error and never retries.

- [x] **Step 1: Write RED command tests**

Use an injectable API and `getOfficialTables` function. Cover:
- each management command is blocked when `writesBlocked` or missing `canManageTables`;
- transfer is blocked when missing `canTransfer`;
- create/rename/activate/deactivate/reorder each call `applyOfficialEffects({ tables: result.tables })`;
- transfer sends exactly source/destination/expected tab and applies `{ tables: result.tables, tableTab: result.tableTab }`;
- invalid source/destination calls `onStaleTarget` and `refreshOfficialData` without calling API;
- 409 calls `refreshOfficialData` exactly once and `onError` exactly once, with one transfer request total;
- request keys are set to the current strings and cleared in `finally`.

The transfer test must assert:

```js
assert.deepEqual(calls, [['table-1', 'table-5', 'tab-A']])
assert.deepEqual(commits.at(-1), { tables: returnedTables, tableTab: returnedTab })
assert.equal(refreshCalls, 0)
```

The 409 test must assert:

```js
assert.equal(calls.length, 1)
assert.equal(refreshCalls, 1)
assert.equal(errors[0].status, 409)
```

- [x] **Step 2: Run RED**

```bash
node --test src/domains/table-service/application/useTableServiceCommands.test.js
```

Expected: FAIL because the hook does not exist.

- [x] **Step 3: Implement the command hook**

Use `tableServiceApi` by default and the pure `validateTransferIntent` before transfer. Preserve current success copies exactly:

```js
const successMessages = {
  create: 'Mesa adicionada com sucesso',
  rename: 'Mesa renomeada com sucesso',
  activate: 'Mesa ativada com sucesso',
  deactivate: 'Mesa desativada com sucesso',
  transfer: 'Comanda transferida com sucesso',
}
```

The transfer body must follow:

```js
const validated = validateTransferIntent(getOfficialTables(), {
  sourceTableId,
  destinationTableId,
  expectedTableTabId,
})
if (!validated) {
  onStaleTarget('A comanda ou a mesa de destino mudou. Atualizamos a consulta.')
  void refreshOfficialData()
  return false
}

setRequestKey(`table:transfer:${sourceTableId}`)
try {
  const result = await api.transferTableTab(sourceTableId, destinationTableId, expectedTableTabId)
  applyOfficialEffects({ tables: result.tables, tableTab: result.tableTab })
  onSuccess('Comanda transferida com sucesso')
  return true
} catch (error) {
  if (error?.status === 409) await refreshOfficialData()
  onError(error)
  return false
} finally {
  setRequestKey(null)
}
```

Use analogous `try/catch/finally` blocks for create/rename/active/reorder, preserving current request keys.

- [x] **Step 4: Compose the hook in App**

Instantiate once with:
- `getOfficialTables` from runtime;
- `applyOfficialEffects`;
- `refreshBootstrapSilently`;
- current capability booleans;
- current `writesBlocked` input used before table commands;
- `setRequestKey`;
- `showSuccessMessage`;
- `showApiError`;
- stale target callback to `setToastMessage`.

Replace `handleCreateTable`, `handleRenameTable`, `handleSetTableActive`, `handleReorderTables` and `handleTransferTableTab` with the returned command functions.

- [x] **Step 5: Remove C5 command exports from legacy API client**

Delete these declarations from `src/api/client.js`:

```text
createTable
updateTable
reorderTables
transferTableTab
getTableTabDetail
```

Do not touch `registerTableTabPayment`, `getTableTabPrintDocument` or `createManualTableTabPrintJob`.

Remove their App imports.

- [x] **Step 6: Update source-contract tests to the new owner**

Change `src/tablesAppWiring.test.js` so it no longer expects handler implementations in App. Instead assert App imports/uses `useTableServiceCommands` and still passes returned callbacks to the Tables surface.

Change `src/tableTabsAppWiring.test.js` so the transfer test no longer source-matches App implementation; assert the legacy API still exposes `registerTableTabPayment` only and run the command hook test for authoritative transfer effects.

- [x] **Step 7: Run GREEN**

```bash
node --test   src/domains/table-service/application/useTableServiceCommands.test.js   src/domains/table-service/infrastructure/tableServiceApi.test.js   src/tablesAppWiring.test.js   src/tableTabsAppWiring.test.js   src/tableTransferIdentityUi.test.js   src/comandasTransferNavigation.test.js   src/api/client.test.js   src/api/tableTabClient.test.js
```

Expected: PASS.

- [x] **Step 8: Audit App/API ownership**

```bash
rg "createTableApi|updateTableApi|reorderTablesApi|transferTableTabApi|handleCreateTable|handleRenameTable|handleSetTableActive|handleReorderTables|handleTransferTableTab" src/App.jsx
rg "export const (createTable|updateTable|reorderTables|transferTableTab|getTableTabDetail)" src/api/client.js
```

Expected: no output.

- [x] **Step 9: Commit**

```bash
git add src/domains/table-service src/App.jsx src/api src/tablesAppWiring.test.js src/tableTabsAppWiring.test.js src/tableTransferIdentityUi.test.js src/comandasTransferNavigation.test.js
git commit -m "refactor: extract table service commands"
```

---

### Task 6: Move Tables and LocalTableSelector into Table Service UI

**Files:**
- Create: `src/domains/table-service/ui/tableServiceSurfaces.js`
- Move: `src/pages/Tables.jsx` → `src/domains/table-service/ui/Tables.jsx`
- Move/Test: `src/pages/Tables.test.js` → `src/domains/table-service/ui/Tables.test.js`
- Move: `src/components/LocalTableSelector.jsx` → `src/domains/table-service/ui/LocalTableSelector.jsx`
- Modify: `src/domains/table-service/index.js`
- Modify: `src/App.jsx`
- Modify: `src/domains/orders/ui/components/NewOrderCustomerStep.jsx`
- Modify/Test: `src/tableTabNewOrderUi.test.js`
- Modify/Test: `src/tablesAppWiring.test.js`
- Modify/Test: `src/comandasTransferNavigation.test.js`

**Interfaces:**
- Public `Tables(props)` and `LocalTableSelector(props)` are Vite-safe wrappers exported by `tableServiceSurfaces.js`.
- Orders imports `LocalTableSelector` only from `../../../table-service/index.js`.
- No legacy reexport remains at `src/pages/Tables.jsx` or `src/components/LocalTableSelector.jsx`.

- [ ] **Step 1: Add RED public UI contract**

Extend `tableServicePublicContract.test.js` only with Node-safe type checks after introducing the wrapper module:

```js
import { LocalTableSelector, Tables } from './index.js'
assert.equal(typeof Tables, 'function')
assert.equal(typeof LocalTableSelector, 'function')
```

Run it before adding exports; expected FAIL because those exports do not exist.

- [ ] **Step 2: Move the files and tests**

```bash
mkdir -p src/domains/table-service/ui
git mv src/pages/Tables.jsx src/domains/table-service/ui/Tables.jsx
git mv src/pages/Tables.test.js src/domains/table-service/ui/Tables.test.js
git mv src/components/LocalTableSelector.jsx src/domains/table-service/ui/LocalTableSelector.jsx
```

Update relative imports in `Tables.jsx`:
- CSS → `../../../table-management.css`;
- generic components → `../../../components/...`.

Update the moved test harness load path to `/src/domains/table-service/ui/Tables.jsx`.

- [ ] **Step 3: Add Vite-safe public wrappers**

Create `src/domains/table-service/ui/tableServiceSurfaces.js`:

```js
import React from 'react'

const load = (path) => {
  const modules = import.meta.glob(['./Tables.jsx', './LocalTableSelector.jsx'], { eager: true })
  return modules[path]?.default
}

export function Tables(props) {
  const Component = load('./Tables.jsx')
  return React.createElement(Component, props)
}

export function LocalTableSelector(props) {
  const Component = load('./LocalTableSelector.jsx')
  return React.createElement(Component, props)
}
```

Do not export `Comandas` until its file is moved in Task 7; the glob may include it once present.

Export `Tables` and `LocalTableSelector` from `src/domains/table-service/index.js`.

- [ ] **Step 4: Migrate external consumers**

In App:

```js
import {
  Tables,
  resolveOpenComanda,
  useComandaSelection,
  useTableServiceCommands,
} from './domains/table-service/index.js'
```

Do not import the moved JSX directly.

In `NewOrderCustomerStep.jsx`:

```js
import { LocalTableSelector } from '../../../table-service/index.js'
```

This establishes the allowed Orders → Table Service public dependency.

- [ ] **Step 5: Update characterization tests**

`src/tableTabNewOrderUi.test.js` must read `src/domains/table-service/ui/LocalTableSelector.jsx` for the existing “Comanda aberta” copy and assert the Orders customer step imports the public Table Service entry rather than a deep path.

`src/comandasTransferNavigation.test.js` must obtain `Tables` from `/src/domains/table-service/index.js` instead of `/src/pages/Tables.jsx`.

- [ ] **Step 6: Run GREEN**

```bash
node --test   src/domains/table-service/tableServicePublicContract.test.js   src/domains/table-service/ui/Tables.test.js   src/tableTabNewOrderUi.test.js   src/tablesAppWiring.test.js   src/comandasTransferNavigation.test.js
```

Expected: PASS.

- [ ] **Step 7: Verify legacy owner paths are absent**

```bash
test ! -e src/pages/Tables.jsx
test ! -e src/components/LocalTableSelector.jsx
rg "pages/Tables|components/LocalTableSelector" src
```

Expected: both `test` commands exit 0 and `rg` prints no production import.

- [ ] **Step 8: Commit**

```bash
git add src/domains/table-service src/App.jsx src/domains/orders src/tableTabNewOrderUi.test.js src/tablesAppWiring.test.js src/comandasTransferNavigation.test.js
git commit -m "refactor: move tables ui into table service"
```

---

### Task 7: Move Comandas, ComandaDetail and TableTransferDialog into Table Service UI

**Files:**
- Move: `src/pages/Comandas.jsx` → `src/domains/table-service/ui/Comandas.jsx`
- Move/Test: `src/pages/Comandas.test.js` → `src/domains/table-service/ui/Comandas.test.js`
- Move: `src/components/ComandaDetail.jsx` → `src/domains/table-service/ui/ComandaDetail.jsx`
- Move/Test: `src/components/ComandaDetail.test.js` → `src/domains/table-service/ui/ComandaDetail.test.js`
- Move: `src/components/TableTransferDialog.jsx` → `src/domains/table-service/ui/TableTransferDialog.jsx`
- Modify: `src/domains/table-service/ui/tableServiceSurfaces.js`
- Modify: `src/domains/table-service/index.js`
- Modify: `src/App.jsx`
- Modify integration tests that currently load `/src/pages/Comandas.jsx` or `/src/components/TableTransferDialog.jsx`.

**Interfaces:**
- Public `Comandas(props)` is exported through the wrapper module.
- `ComandaDetail` and `TableTransferDialog` remain Table Service internals.
- `Comandas` uses internal relative imports for Table Service internals and application hooks.
- Generic primitives/hooks stay outside the domain.

- [ ] **Step 1: Add RED public surface expectation**

Extend `tableServicePublicContract.test.js`:

```js
import { Comandas } from './index.js'
assert.equal(typeof Comandas, 'function')
```

Expected RED before the wrapper export exists.

- [ ] **Step 2: Move the UI owners physically**

```bash
git mv src/pages/Comandas.jsx src/domains/table-service/ui/Comandas.jsx
git mv src/pages/Comandas.test.js src/domains/table-service/ui/Comandas.test.js
git mv src/components/ComandaDetail.jsx src/domains/table-service/ui/ComandaDetail.jsx
git mv src/components/ComandaDetail.test.js src/domains/table-service/ui/ComandaDetail.test.js
git mv src/components/TableTransferDialog.jsx src/domains/table-service/ui/TableTransferDialog.jsx
```

- [ ] **Step 3: Repair imports without moving CSS**

In moved `Comandas.jsx`:
- `../../../comandas.css`;
- `../../../comandas-table-list-polish.css`;
- generic `Button/Icon/PageHeader/Modal/TableTabPaymentDialog/TableTabTicketPreview` from `../../../components/`;
- `useMediaQuery` from `../../../hooks/useMediaQuery.js`;
- `ComandaDetail` and `TableTransferDialog` by same-directory relative import;
- `useTableTabDetail` by `../application/useTableTabDetail.js`.

Because the hook is now consumed only inside Table Service, remove the temporary `useTableTabDetail` export from `src/domains/table-service/index.js` in this task.

In moved `ComandaDetail.jsx` use generic components from `../../../components/`.

In moved `TableTransferDialog.jsx` use generic components from `../../../components/` and use `getTransferDestinations` from `../domain/tableTransfer.js` for destination projection.

- [ ] **Step 4: Add Comandas to the Vite-safe public surface**

Extend the `import.meta.glob` list in `tableServiceSurfaces.js` to include `./Comandas.jsx`, then add:

```js
export function Comandas(props) {
  const Component = load('./Comandas.jsx')
  return React.createElement(Component, props)
}
```

Export `Comandas` from `src/domains/table-service/index.js`. App imports `Comandas` only from that index.

- [ ] **Step 5: Rewrite test load paths according to responsibility**

Domain UI tests:
- load `/src/domains/table-service/ui/Comandas.jsx`;
- load `/src/domains/table-service/ui/ComandaDetail.jsx`.

App/integration tests that inspect the component type:
- load `/src/domains/table-service/index.js` and use its named `Comandas`/`Tables` wrappers, matching what App actually renders.

`src/tableTransferIdentityUi.test.js` may load the internal dialog directly because it is a Table Service component-level test embedded in a broader integration file; update that path to `/src/domains/table-service/ui/TableTransferDialog.jsx`.

- [ ] **Step 6: Run the migrated UI suite**

```bash
node --test   src/domains/table-service/tableServicePublicContract.test.js   src/domains/table-service/ui/Tables.test.js   src/domains/table-service/ui/Comandas.test.js   src/domains/table-service/ui/ComandaDetail.test.js   src/comandasAppWiring.test.js   src/comandasTransferNavigation.test.js   src/tableTransferIdentityUi.test.js   src/comandaResponsiveDensity.test.js   src/comandasTableListPolish.test.js
```

Expected: PASS with desktop/mobile focus, back, scroll, detail, transfer and styling characterization unchanged.

- [ ] **Step 7: Verify the moved legacy paths are gone**

```bash
for path in   src/pages/Comandas.jsx   src/components/ComandaDetail.jsx   src/components/TableTransferDialog.jsx; do
  test ! -e "$path"
done
```

Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/domains/table-service src/App.jsx src/comandasAppWiring.test.js src/comandasTransferNavigation.test.js src/tableTransferIdentityUi.test.js src/comandaResponsiveDensity.test.js src/comandasTableListPolish.test.js
git commit -m "refactor: move comandas ui into table service"
```

---

### Task 8: Move payment/printing overlay ownership to the app surface

**Files:**
- Create/Test: `src/app/surfaces/table-service/TableServiceExternalActions.jsx`
- Create/Test: `src/app/surfaces/table-service/TableServiceExternalActions.test.js`
- Modify/Test: `src/domains/table-service/ui/Comandas.jsx`
- Modify/Test: `src/domains/table-service/ui/Comandas.test.js`
- Modify: `src/App.jsx`
- Regression: `src/comandasAppWiring.test.js`
- Regression: `src/components/TableTabPaymentDialog.test.js`
- Regression: `src/components/overlayScrollLock.test.js`
- Regression: `src/printing/usePrintingManager.test.js`

**Interfaces:**
- The app surface owns payment-open state, preview document, print feedback, printing action owner/token and duplicate suppression.
- It receives current `selection` and `selectionGeneration` and rejects visual results whose captured owner no longer matches.
- Render-prop children receive:
  - `requestPayment({ tableId, tableTabId, selectionGeneration, detail })`
  - `requestPreview({ tableId, tableTabId, selectionGeneration })`
  - `requestPrint({ tableId, tableTabId, selectionGeneration })`
  - `printingBusy`
  - `printingFeedback`
  - `printingAvailable`
- App payment callback receives the captured owner as a third argument but accepted-payment reconciliation remains in App until C6.

- [ ] **Step 1: Move owner-specific regression expectations into a RED app-surface test**

Create `TableServiceExternalActions.test.js`. Re-home the behavior currently proved inside `Comandas.test.js` for:
- canonical ticket preview;
- preview failure and retry;
- duplicate manual print suppression and retry;
- late preview/print success ignored after selection replacement;
- late 401/error ignored after selection replacement;
- replacement closes old preview;
- payment and preview overlays release only their own shared scroll locks.

Add a payment owner test:

```js
const ownerA = { tableId: 'table-1', tableTabId: 'tab-A', selectionGeneration: 4, detail }
requestPayment(ownerA)
assert.equal(dialogCount(), 1)

await rerender({ selection: { tableId: 'table-1', tableTabId: 'tab-B' }, selectionGeneration: 5 })
assert.equal(dialogCount(), 0)
```

Add a late preview test where A resolves after B is current and assert no A modal/error appears and B's busy state is not cleared.

- [ ] **Step 2: Run RED**

```bash
node --test src/app/surfaces/table-service/TableServiceExternalActions.test.js
```

Expected: FAIL because the app surface does not exist.

- [ ] **Step 3: Implement the app-owned surface**

Use a ref-backed owner comparison so an async closure created for selection A reads the newest selection after a rerender:

```js
const currentVisualOwnerRef = useRef({ selection, selectionGeneration })
currentVisualOwnerRef.current = { selection, selectionGeneration }

const isCurrentOwner = (intent) => {
  const current = currentVisualOwnerRef.current
  return Boolean(
    intent
    && intent.selectionGeneration === current.selectionGeneration
    && intent.tableId === current.selection?.tableId
    && intent.tableTabId === current.selection?.tableTabId
  )
}
```

Do not compare late results against render-time `selection` variables captured by the old async callback.

Payment request stores the captured detail only when current. Preview/print create an action owner:

```js
const runPrintingAction = async (kind, intent, operation) => {
  if (!isCurrentOwner(intent) || actionRef.current || disabled) return false
  const owner = { token: ++sequenceRef.current, ...intent, kind }
  actionRef.current = owner
  setActiveAction(owner)
  setPrintingFeedback(null)
  const ownsVisualAction = () => mountedRef.current
    && actionRef.current === owner
    && isCurrentOwner(owner)

  try {
    const result = await operation(intent.tableTabId)
    if (!ownsVisualAction()) return false
    if (kind === 'preview') {
      if (result?.type !== 'table-tab' || result.tableTab?.id !== intent.tableTabId) {
        throw new Error('O ticket recebido não corresponde à comanda selecionada. Tente novamente.')
      }
      setPreviewDocument(result)
    } else {
      onToast?.('Impressão enviada para a fila')
    }
    return true
  } catch (error) {
    if (!ownsVisualAction()) return false
    setPrintingFeedback({
      type: 'error',
      message: error?.message || 'Não foi possível concluir a impressão da comanda. Tente novamente.',
    })
    if (error?.status === 401) onApiError?.(error)
    return false
  } finally {
    if (actionRef.current === owner) {
      actionRef.current = null
      setActiveAction((current) => current === owner ? null : current)
    }
  }
}
```

On selection/generation change, close payment/preview state that no longer belongs to the current owner and retire old visual action ownership without touching accepted payment reconciliation. Use an effect keyed by `selection?.tableId`, `selection?.tableTabId` and `selectionGeneration` that clears only intents/actions for which `isCurrentOwner` is false; if `actionRef.current` is that retired action, null the ref before clearing its rendered busy state.

Render `TableTabPaymentDialog` and ticket `Modal` in this surface. Keep those existing components in their current paths.

- [ ] **Step 4: Turn Comandas into an intent-emitting presentation surface**

Remove from `Comandas.jsx`:
- `paymentOpen`;
- `previewDocument`;
- `printingFeedback` ownership;
- `activeAction/actionRef/actionSequenceRef`;
- direct calls to `printing.getTableTabPreviewDocument` / `printing.printTableTab`;
- `TableTabPaymentDialog`, `TableTabTicketPreview` and preview `Modal` imports.

For the selected canonical detail build:

```js
const owner = {
  tableId,
  tableTabId: tabId,
  selectionGeneration,
}
```

Emit:
- `onRequestPayment({ ...owner, detail })`;
- `onRequestPreview(owner)`;
- `onRequestPrint(owner)`;
- `onAddOrder(owner)`.

Render `printingFeedback` supplied by composition and use supplied `printingBusy` / `printingAvailable` to preserve the same button disable behavior.

Keep transfer state/dialog inside Table Service.

- [ ] **Step 5: Compose the app surface around Comandas**

In App, render the current Comandas branch conceptually as:

```jsx
<TableServiceExternalActions
  selection={selectedComanda}
  selectionGeneration={selectedComandaGeneration}
  disabled={writesBlocked || Boolean(tableTabSync)}
  paymentOptions={paymentOptions}
  defaultPaymentMethod={defaultPaymentMethod}
  currency={currency}
  onPay={handleRegisterTableTabPayment}
  onApiError={showApiError}
  onToast={setToastMessage}
  printing={printing}
>
  {(externalActions) => (
    <Comandas
      tables={tables}
      selection={selectedComanda}
      selectionGeneration={selectedComandaGeneration}
      onSelectComanda={selectCurrentComanda}
      onAddOrder={(owner) => handleNewOrder({
        tableId: owner.tableId,
        expectedTableTabId: owner.tableTabId,
        returnTab: 'comandas',
      })}
      canTransfer={canTransferComanda}
      onTransfer={tableServiceCommands.transferTableTab}
      paymentSync={tableTabSync}
      onRetryPaymentSync={() => reconcileTableTabPayment()}
      currency={currency}
      disabled={writesBlocked}
      canCreateOrders={canCreateOrders}
      canExecutePrinting={canExecutePrinting}
      {...externalActions}
    />
  )}
</TableServiceExternalActions>
```

Adapt the exact prop names to the interface above; do not pass the entire `printing` object into Table Service UI after this task.

- [ ] **Step 6: Capture payment identity/generation at submission**

Change `handleRegisterTableTabPayment` to accept `(tableTabId, method, intent)`.

Before the POST, require:
- `ownsComandaSelection(intent)`;
- the current official table still carries `intent.tableTabId` at `intent.tableId`.

Create the payment owner using the captured `intent.selectionGeneration`. After the request is accepted, its financial reconciliation stays in `paymentSyncRef` even if `ownsComandaSelection(owner)` later becomes false. Visual success/clearing still requires current ownership.

- [ ] **Step 7: Run GREEN external-action/payment/printing regressions**

```bash
node --test   src/app/surfaces/table-service/TableServiceExternalActions.test.js   src/domains/table-service/ui/Comandas.test.js   src/comandasAppWiring.test.js   src/comandasTransferNavigation.test.js   src/components/TableTabPaymentDialog.test.js   src/components/overlayScrollLock.test.js   src/printing/usePrintingManager.test.js
```

Expected: PASS. Existing accepted-payment-after-selection-change tests remain green.

- [ ] **Step 8: Audit Table Service for forbidden workflow ownership**

```bash
rg "TableTabPaymentDialog|TableTabTicketPreview|getTableTabPreviewDocument|printTableTab|registerTableTabPayment" src/domains/table-service
```

Expected: no production-code matches. Test text may be excluded with `--glob '!*.test.js'` if needed for the final audit:

```bash
rg "TableTabPaymentDialog|TableTabTicketPreview|getTableTabPreviewDocument|printTableTab|registerTableTabPayment" src/domains/table-service --glob '!*.test.js'
```

Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add src/app/surfaces/table-service src/domains/table-service src/App.jsx src/comandasAppWiring.test.js src/comandasTransferNavigation.test.js
git commit -m "refactor: externalize table service actions"
```

---

### Task 9: Clean the Orders ↔ Table Service integration and remove the dead tableTabs prop

**Files:**
- Modify/Test: `src/domains/orders/ui/NewOrderRoute.js`
- Modify: `src/domains/orders/ui/NewOrderRoute.jsx`
- Modify/Test: `src/domains/orders/ui/NewOrderRoute.test.js`
- Modify: `src/App.jsx`
- Modify/Test: `src/comandasAppWiring.test.js`
- Modify/Test: `src/tableTabNewOrderUi.test.js`
- Modify/Test: `src/domains/orders/ordersPublicUi.test.js`
- Regression: `src/domains/orders/ui/NewOrder.test.js`
- Regression: `src/domains/orders/ui/NewOrderMobile.test.js`

**Interfaces:**
- New Order continues to receive `tables`, `initialTableId` and `expectedTableTabId`.
- `tableTabs` and `tableTabsFromBootstrap` disappear from the Orders route contract.
- Runtime `tableTabs` remains intact for C6 payment reconciliation.
- Orders uses `LocalTableSelector` through `src/domains/table-service/index.js` only.

- [ ] **Step 1: Turn the existing route characterization RED**

Rewrite `NewOrderRoute.test.js` to pass only live props and assert no dead tableTabs prop is forwarded:

```js
const tables = [{ id: 'table-7', isActive: true, occupancy: 'occupied', openTableTab: { id: 'tab-42' } }]
const { NewOrderRoute } = await vite.ssrLoadModule('/src/domains/orders/ui/NewOrderRoute.jsx')
await act(async () => {
  renderer = TestRenderer.create(React.createElement(NewOrderRoute, {
    NewOrderComponent: Probe,
    tables,
    initialTableId: 'table-7',
    expectedTableTabId: 'tab-42',
  }))
})
assert.strictEqual(receivedProps.tables, tables)
assert.equal(receivedProps.initialTableId, 'table-7')
assert.equal(receivedProps.expectedTableTabId, 'tab-42')
assert.equal(Object.hasOwn(receivedProps, 'tableTabs'), false)
```

Before implementation, also assert the module no longer exports `tableTabsFromBootstrap`; this is RED while the helper still exists.

- [ ] **Step 2: Run RED**

```bash
node --test src/domains/orders/ui/NewOrderRoute.test.js
```

Expected: FAIL because `tableTabsFromBootstrap` / old route expectations still exist.

- [ ] **Step 3: Remove the dead route helper**

Make `NewOrderRoute.js` contain only:

```js
import React from 'react'

const loadDefaultNewOrder = () => {
  const modules = import.meta.glob('./NewOrder.jsx', { eager: true })
  return modules['./NewOrder.jsx']?.default
}

export function NewOrderRoute({ NewOrderComponent, ...newOrderProps }) {
  const Component = NewOrderComponent || loadDefaultNewOrder()
  return React.createElement(Component, newOrderProps)
}
```

Make `NewOrderRoute.jsx`:

```js
export { NewOrderRoute } from './NewOrderRoute.js'
```

- [ ] **Step 4: Remove tableTabs from App route wiring**

Change the `NewOrderRoute` render in `App.jsx` to stop passing `tableTabs={tableTabs}`. Keep `tables`, `initialTableId` and `expectedTableTabId`.

Do not remove `tableTabs` from `useOperationalDataRuntime` destructuring if payment reconciliation still consumes it.

- [ ] **Step 5: Update App/payment integration assertions**

In `src/comandasAppWiring.test.js` replace any assertion that expects `NewOrderRoute.props.tableTabs` with:

```js
const route = r.root.findByType(NewOrderRoute)
assert.equal(Object.hasOwn(route.props, 'tableTabs'), false)
assert.equal(route.props.expectedTableTabId, expectedTabId)
```

Retain the existing tests proving:
- occupied Comanda → add order preselects exact table/tab;
- cancel returns to Comandas;
- successful local checkout returns to authoritative selected comanda;
- stale occupied-comanda checkout preserves draft and refreshes official tables.

- [ ] **Step 6: Verify Orders dependency direction**

`src/tableTabNewOrderUi.test.js` must assert:

```js
assert.match(customerStep, /from ['"]\.\.\/\.\.\/\.\.\/table-service\/index\.js['"]/)
assert.doesNotMatch(customerStep, /table-service\/(domain|application|infrastructure|ui)\//)
```

- [ ] **Step 7: Run GREEN Orders/Table Service integration suite**

```bash
node --test   src/domains/orders/ui/NewOrderRoute.test.js   src/domains/orders/ordersPublicUi.test.js   src/domains/orders/ui/NewOrder.test.js   src/domains/orders/ui/NewOrderMobile.test.js   src/tableTabNewOrderUi.test.js   src/comandasAppWiring.test.js   src/comandasTransferNavigation.test.js
```

Expected: PASS.

- [ ] **Step 8: Audit dead contract removal**

```bash
rg "tableTabsFromBootstrap|tableTabs=\{tableTabs\}" src
```

Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx src/domains/orders src/tableTabNewOrderUi.test.js src/comandasAppWiring.test.js src/comandasTransferNavigation.test.js
git commit -m "refactor: clean table service orders integration"
```

---

### Task 10: Make the C5 architecture boundary permanent and remove all legacy ownership

**Files:**
- Modify/Test: `scripts/architecture/check-import-boundaries.mjs`
- Modify/Test: `scripts/architecture/check-import-boundaries.test.mjs`
- Create/Test: `src/domains/table-service/tableServiceExtractionContract.test.js`
- Modify: `docs/superpowers/qa/spec-c-compatibility-facades.md` only after the architecture tests prove the bridge/paths are removed.
- Audit: `src/App.jsx`
- Audit: `src/api/client.js`
- Audit: all `src/domains/table-service/**` imports.

**Interfaces:**
- Reject any external deep import into `src/domains/table-service/`.
- Reject all Table Service → Orders imports, including `orders/index.js`.
- Permit Orders/app → `src/domains/table-service/index.js`.
- Reject reappearance of the five exact C5 legacy owner paths.
- Reject reintroduction of the five C5 API declarations in `src/api/client.js`.

- [ ] **Step 1: Add architecture fixtures first**

Add `C5_LEGACY_TABLE_SERVICE_OWNERS` fixture expectations for:
- `src/pages/Tables.jsx`;
- `src/pages/Comandas.jsx`;
- `src/components/ComandaDetail.jsx`;
- `src/components/TableTransferDialog.jsx`;
- `src/components/LocalTableSelector.jsx`.

Add tests proving:
1. `src/App.jsx -> ./domains/table-service/ui/Comandas.jsx` is rejected as `table-service-deep-import`;
2. `src/domains/orders/ui/x.js -> ../../table-service/index.js` is allowed;
3. `src/domains/table-service/ui/x.js -> ../../orders/index.js` is rejected as `table-service-orders-import`;
4. re-created legacy owner is rejected;
5. legacy API declaration `export const transferTableTab = ...` is rejected as `c5-legacy-table-service-api`.

- [ ] **Step 2: Run architecture RED**

```bash
node --test scripts/architecture/check-import-boundaries.test.mjs
```

Expected: FAIL because the checker does not yet know the C5 rules.

- [ ] **Step 3: Extend the checker**

Add:

```js
const C5_LEGACY_TABLE_SERVICE_OWNERS = new Set([
  'src/pages/Tables.jsx',
  'src/pages/Comandas.jsx',
  'src/components/ComandaDetail.jsx',
  'src/components/TableTransferDialog.jsx',
  'src/components/LocalTableSelector.jsx',
])
```

Add legacy API detection:

```js
const migratedTableServiceApiPattern = /export\s+const\s+(createTable|updateTable|reorderTables|transferTableTab|getTableTabDetail)\b/
if (migratedTableServiceApiPattern.test(legacyApiClient)) {
  violations.push('c5-legacy-table-service-api: src/api/client.js')
}
```

Add import rules:

```js
if (!edge.from.startsWith('src/domains/table-service/')
  && edge.resolvedPath?.startsWith('src/domains/table-service/')
  && edge.resolvedPath !== 'src/domains/table-service/index.js') {
  violations.push(`table-service-deep-import: ${edge.from} -> ${edge.resolvedPath}`)
}

if (edge.from.startsWith('src/domains/table-service/')
  && edge.resolvedPath?.startsWith('src/domains/orders/')) {
  violations.push(`table-service-orders-import: ${edge.from} -> ${edge.resolvedPath}`)
}
```

Loop through `C5_LEGACY_TABLE_SERVICE_OWNERS` like the C3/C4 owner sets and emit `c5-legacy-table-service-owner: <path>`.

- [ ] **Step 4: Add an App exit-contract test**

Create `src/domains/table-service/tableServiceExtractionContract.test.js` reading `../../App.jsx` and assert none of these implementation tokens remain:

```js
const forbidden = [
  'comandaSelectionRef',
  'comandaIdentityRef',
  'const resolveOpenComanda =',
  'onTablesCommitted',
  'handleCreateTable',
  'handleRenameTable',
  'handleSetTableActive',
  'handleReorderTables',
  'handleTransferTableTab',
  'createTableApi',
  'updateTableApi',
  'reorderTablesApi',
  'transferTableTabApi',
  'getTableTabDetail',
]
```

Also assert intentional deferred ownership still exists:

```js
for (const token of [
  'handleRegisterTableTabPayment',
  'settleAcceptedPayment',
  'registerTableTabPaymentApi',
]) {
  assert.equal(source.includes(token), true, token)
}
```

Do not require printing API names in App because printing is already behind `usePrintingManager`.

- [ ] **Step 5: Trim the Table Service public entry to actual external consumers**

By this point, `src/domains/table-service/index.js` must export only contracts with a real external consumer:

```js
export { resolveOpenComanda } from './domain/comandaIdentity.js'
export { useComandaSelection } from './application/useComandaSelection.js'
export { useTableServiceCommands } from './application/useTableServiceCommands.js'
export { Comandas, LocalTableSelector, Tables } from './ui/tableServiceSurfaces.js'
```

Update `tableServicePublicContract.test.js` to import the module namespace and assert its sorted keys equal exactly:

```js
[
  'Comandas',
  'LocalTableSelector',
  'Tables',
  'resolveOpenComanda',
  'useComandaSelection',
  'useTableServiceCommands',
].sort()
```

Pure/internal helpers remain covered by their direct domain tests; do not keep them public only for test convenience.

- [ ] **Step 6: Run architecture GREEN**

```bash
node --test   scripts/architecture/check-import-boundaries.test.mjs   src/domains/table-service/tableServiceExtractionContract.test.js
npm run test:architecture
```

Expected: PASS and `Frontend architecture boundaries: OK`.

- [ ] **Step 7: Run physical ownership audits**

```bash
for path in   src/pages/Tables.jsx   src/pages/Comandas.jsx   src/components/ComandaDetail.jsx   src/components/TableTransferDialog.jsx   src/components/LocalTableSelector.jsx; do
  test ! -e "$path"
done

rg "export const (createTable|updateTable|reorderTables|transferTableTab|getTableTabDetail)" src/api/client.js
rg "domains/table-service/(domain|application|infrastructure|ui)" src --glob '!src/domains/table-service/**'
rg "domains/orders" src/domains/table-service
```

Expected: all old paths absent and all three `rg` commands print no prohibited production imports.

- [ ] **Step 8: Update the compatibility ledger only after evidence exists**

In `docs/superpowers/qa/spec-c-compatibility-facades.md` mark the operational data runtime table-commit bridge as **removed in C5**. Keep:
- payment-receipt bridge → C6;
- generic/auth `src/api/client.js` compatibility → C10 at latest;
- `updateCollection` escape hatch → later Customers/Catalog cleanup and C10 enforcement.

Do not delete or broaden another row.

- [ ] **Step 9: Run the focused C5 regression bundle**

```bash
node --test   src/domains/table-service/**/*.test.js   src/app/surfaces/table-service/*.test.js   src/comandasAppWiring.test.js   src/comandasTransferNavigation.test.js   src/tableTransferIdentityUi.test.js   src/tableTabNewOrderUi.test.js   src/tablesAppWiring.test.js   src/tableTabsAppWiring.test.js   src/components/TableTabPaymentDialog.test.js   src/printing/usePrintingManager.test.js   scripts/architecture/check-import-boundaries.test.mjs
```

If the shell does not expand `**`, enumerate the Table Service test files explicitly rather than changing test coverage.

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add scripts/architecture src/domains/table-service docs/superpowers/qa/spec-c-compatibility-facades.md
git commit -m "test: enforce table service architecture"
```

---

### Task 11: Full gates, staging homologation, QA evidence and merge gate

**Files:**
- Create: `docs/superpowers/qa/spec-c5-table-service-qa.md` with real evidence as the checks are executed.
- Modify: `docs/superpowers/qa/spec-c-execution-ledger.md`
- Modify: `docs/superpowers/qa/spec-c-compatibility-facades.md` if final evidence changes its status text only.
- Modify: this plan only to mark executed task checkboxes/status after evidence exists.
- No production code changes are permitted merely to make documentation look complete.

**Interfaces:**
- Automated result vocabulary: exact command/run status.
- Manual staging result vocabulary: only **PASS**, **FAIL**, **BLOCKED**.
- Any FAIL stops merge preparation.
- BLOCKED requires an explicit reason and is never converted to PASS.
- Production remains untouched.

- [ ] **Step 1: Verify final diff scope before full gates**

```bash
git status --short
git diff --check
git diff --name-status a0b4f5dac865ae54ad9bec7086139b280ffda5f4...HEAD
git diff --name-only a0b4f5dac865ae54ad9bec7086139b280ffda5f4...HEAD -- worker migrations
```

Expected:
- worktree clean after committed tasks;
- `git diff --check` clean;
- no unexpected `worker/` or `migrations/` changes;
- no broad printing/payment implementation migration beyond the approved C5 composition boundary.

If `master` advanced after the C5 base, stop merge preparation and reconcile the new master deliberately before staging/merge decisions.

- [ ] **Step 2: Run the complete local/runner gate set**

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

Expected: every command exits 0. Record the exact test totals and any intentional skips. Do not claim a local PASS for commands that were not actually executed locally.

- [ ] **Step 3: Create/update the draft PR and obtain exact GitHub Validate evidence**

Push the branch normally, never force-push.

If no PR exists, open a draft PR from `feature/spec-c5-table-service` to `master` summarizing:
- Table Service domain boundary;
- runtime bridge removal;
- API/commands/UI migration;
- external payment/printing composition;
- Orders cleanup;
- architecture enforcement;
- production not deployed.

Run/observe `Validate application` on the exact branch SHA. Record:
- exact SHA;
- workflow run ID/number;
- SUCCESS/FAILURE;
- test total from the workflow.

A failed run must be investigated before staging.

- [ ] **Step 4: Manually deploy the exact validated branch to staging**

Dispatch `Deploy staging` with `feature/spec-c5-table-service` selected.

Require the workflow to complete its existing:
- tests;
- architecture gate;
- lint;
- build;
- local D1;
- staging Worker dry-run;
- remote staging migration check/application;
- staging deploy;
- real login smoke.

Record the exact deployment run and exact deployed SHA in `spec-c5-table-service-qa.md`.

- [ ] **Step 5: Execute the C5 manual staging matrix**

Record each case as PASS, FAIL or BLOCKED with concise evidence/reason:

1. Tables — create.
2. Tables — rename.
3. Tables — activate/deactivate.
4. Tables — reorder.
5. Occupied table — “Ver comanda” opens the exact current comanda.
6. Comandas — open occupied table.
7. Free table — begin New Order.
8. Comanda — Add order.
9. New Order — cancel/complete returns to the same authoritative comanda.
10. Transfer comanda.
11. Selection follows transfer with the same `tableTabId`.
12. Transfer conflict / stale identity, if safely reproducible; otherwise BLOCKED with reason.
13. Closing a comanda clears selection.
14. Reusing the same table does not resurrect the previous comanda.
15. Full comanda payment still works.
16. Payment synchronization/retry behavior still works when exercised.
17. View ticket still works.
18. Print comanda still works.
19. Capability/read-only behavior.
20. Desktop light theme and dark theme.
21. Mobile/narrow light theme and dark theme.
22. Mobile detail focus/back/list-scroll behavior.
23. Browser console has no new C5-attributable runtime error.

Do not infer manual PASS from automated tests.

- [ ] **Step 6: Write the QA record with exact evidence**

`docs/superpowers/qa/spec-c5-table-service-qa.md` must include:
- base SHA;
- final branch SHA;
- PR number;
- Validate workflow evidence;
- staging deployment evidence;
- automated command results;
- manual matrix result count;
- each BLOCKED reason;
- explicit `0 FAIL` requirement;
- production deployment: **NO**.

- [ ] **Step 7: Reconcile Spec C ledgers**

Update `spec-c-execution-ledger.md` only to the state actually reached. At successful homologation before merge, record C5 as homologated / awaiting merge authorization, the exact SHA and QA totals.

Keep C6 **NOT STARTED**.

Update the compatibility ledger to confirm:
- table-commit bridge removed;
- payment-receipt bridge still active for C6;
- generic/auth reexports still tracked;
- `updateCollection` remains only for later slices.

- [ ] **Step 8: Validate the final docs-only HEAD**

After QA/ledger commits, re-run `Validate application` on the exact final branch HEAD. A previous executable SHA validation is not sufficient for the final merge gate.

- [ ] **Step 9: Stop at explicit merge authorization**

Present:
- final branch HEAD;
- PR;
- automated gate evidence;
- staging run;
- manual PASS/FAIL/BLOCKED totals;
- any BLOCKED reasons;
- confirmation that production was untouched;
- master drift status.

Do not merge until the user explicitly authorizes the C5 merge.

---

## Self-review checklist for this plan

Before execution, verify all of the following remain true:

- Tasks 1–5 establish pure rules, selection, detail, API and commands before UI ownership moves.
- Task 2 removes `onTablesCommitted` and preserves the payment bridge.
- Task 3 removes direct detail HTTP ownership from Comandas.
- Task 5 removes all five approved C5 API exports from the legacy client by the end of the task.
- Tasks 6–7 physically remove every legacy C5 owner path; no compatibility facade survives.
- Task 8 puts payment/preview/print overlay state outside Table Service while accepted payment reconciliation remains C6-bound.
- Task 9 removes only the dead New Order `tableTabs` route contract, not runtime `tableTabs`.
- Task 10 permanently rejects deep imports, Table Service → Orders, legacy owners and legacy C5 API declarations.
- The plan leaves payment API ownership for C6 and printing API/queue/QZ ownership for C9.
- No task changes Worker routes, D1 schema, polling, CSS architecture, business rules or navigation technology.
- Task 11 requires exact-HEAD validation, staging and manual evidence and stops before merge/production.
