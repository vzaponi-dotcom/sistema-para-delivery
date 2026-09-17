# Spec C3 — Settings Surface and Versioned Policy Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Settings into `src/app/surfaces/settings`, extract the reusable versioned-edit engine into `src/app/policy-editing`, remove concrete Settings resource knowledge from `App.jsx` and `app/navigation`, and preserve every existing Spec B behavior and visual contract.

**Architecture:** The application-level `PolicyEditingProvider` owns generic versioned edit state, pending recovery, conflict lifecycle, abandonment risk, and the narrow navigation bridge. The Settings surface owns concrete policy metadata/adapters, route-to-policy mapping, conflict presentation, device preferences, and editor composition. `useEffectiveBusinessConfig` stays application-owned and refreshes only after a policy mutation is confirmed. Printing keeps the existing physical/QZ runtime and UI contract; C3 only replaces its versioned-settings source.

**Tech Stack:** React 19.2.8, Vite 8.2.2, Node 22 `node:test`, `react-test-renderer` 19.2.8, oxlint 1.79.0, Cloudflare Worker/D1, QZ Tray 2.2.6, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-frontend-modularization-c3-settings-surface-design.md`

## Global Constraints

- Work only on `feature/spec-c3-settings-surface`; never implement directly on `master`.
- Base contract is `master` at `de24b2ceb807440d4c339200b44ae2ed6583b27a`, plus the approved C3 design/plan documentation commits on the feature branch.
- Use a fresh isolated worktree for execution. Do not reuse a dirty or divergent worktree.
- Strict TDD for every behavioral boundary: add or move the test so it fails first, run it and observe the expected failure, implement the minimum behavior, rerun to green, then refactor only while green.
- Preserve all current visible UI, copy, capabilities, mobile behavior, light/dark behavior, endpoints, request payloads, response envelopes, D1 schema, and Worker contracts.
- Preserve Spec B semantics: explicit save, optimistic revision, mutation identity, pending recovery, 409 conflict review, unknown-result reconciliation, read-only mode, load failure/retry, stale-owner protection, and abandonment guards.
- Preserve C2 navigation semantics. In particular, Operations ↔ Modalities must remain prompt-free when sharing the same draft; `saving`/`unconfirmed` must not become ordinary internal dirty-exit prompts; browser reload/close must still be guarded for dirty/saving/unconfirmed state.
- Keep backend responses authoritative. Do not add an independent official client store.
- Do not create `domains/orders`, `domains/finance`, or `domains/printing` in C3. Concrete policy adapters stay temporarily in the Settings surface until C4/C6/C9.
- Do not refactor QZ, print queue, second-copy flow, heartbeat, station business rules, or physical printer health in C3.
- Do not add Redux, Zustand, React Router, WebSocket/SSE, or new dependencies.
- Keep current root CSS files in place unless an import path must change mechanically. C3 is not a CSS relocation slice.
- Temporary compatibility reexports are allowed only inside intermediate commits. Before staging, every C3-created compatibility facade must be deleted unless a demonstrated blocker is recorded in `docs/superpowers/qa/spec-c-compatibility-facades.md`.
- No production deploy is part of C3. Merge and production each require separate explicit user authorization.

## Execution preflight

Before Task 1:

- [ ] Create/select an isolated worktree for `feature/spec-c3-settings-surface` using `superpowers:using-git-worktrees`.
- [ ] Run `git status --short` and require a clean worktree.
- [ ] Run `git branch --show-current` and require `feature/spec-c3-settings-surface`.
- [ ] Run `git merge-base HEAD origin/master` and require `de24b2ceb807440d4c339200b44ae2ed6583b27a` unless `master` was intentionally advanced before execution; if it advanced, stop and re-plan/rebase from the new approved base instead of silently continuing.
- [ ] Run `git log --oneline origin/master..HEAD` and verify the branch contains only the approved C3 documentation commits before implementation starts.
- [ ] Run the current baseline: `npm test`, `npm run test:architecture`, `npm run lint`, `npm run build`.
- [ ] If any baseline command fails before C3 code changes, stop and diagnose the baseline; do not mix an unrelated pre-existing failure into C3.

## Final ownership map

The implementation should end with this ownership shape. Filenames can only vary if a concrete current-code constraint requires it; ownership and public contracts must not vary.

```text
src/app/
  policy-editing/
    PolicyEditingProvider.jsx
    PolicyEditingProvider.test.js
    policyEditingContext.js
    policyEditingController.js
    policyEditingController.test.js
    policyEditingState.js
    policyEditingState.test.js
    policyConflict.js
    policyConflict.test.js
    policyPendingStorage.js
    policyPendingStorage.test.js
    policyNavigationBridge.js
    policyNavigationBridge.test.js

  surfaces/
    settings/
      SettingsPolicyBoundary.jsx
      SettingsPolicyBoundary.test.js
      SettingsSurface.jsx
      SettingsSurface.test.js
      SettingsHome.jsx
      SettingsHome.test.js
      SettingsTablePolish.test.js
      OperationSettings.jsx
      OperationSettings.test.js
      PaymentSettings.jsx
      PaymentSettings.test.js
      PaymentSettings.menuInactive.test.js
      CancellationSettings.jsx
      CancellationSettings.test.js
      CancellationSettings.redesign.test.js
      FinanceCategorySettings.jsx
      FinanceCategorySettings.test.js
      FinanceCategorySettings.redesign.test.js
      paymentSettingsModel.js
      printingSettingsAdapter.js
      printingSettingsAdapter.test.js

      components/
        SettingsBackAndSwitchControls.jsx
        SettingsEditorShell.jsx
        SettingsItemDialog.jsx
        SettingsItemList.jsx
        SettingsPrimitives.test.js
        SettingsConflictReview.jsx
        SettingsConflictReview.test.js
        SettingsConflictReview.sharedUx.test.js

      conflicts/
        settingsConflictPresentation.js

      local/
        DevicePreferences.jsx
        DevicePreferences.test.js
        devicePreferences.js
        devicePreferences.test.js

      policies/
        policyHttp.js
        operationsPolicy.js
        paymentMethodsPolicy.js
        cancellationReasonsPolicy.js
        financeCategoriesPolicy.js
        printingPolicy.js
        registry.js
        policyAdapters.test.js
        navigation.js
        navigation.test.js

src/app/navigation/
  draftExitGuard.js
  draftExitGuard.test.js
  useNavigationController.js
  ...existing C2 navigation modules...

src/api/
  effectiveConfigClient.js
  effectiveConfigClient.test.js
  ...existing legacy API files until their later slices...
```

Files intentionally left in their current printing owner for C9 include:

```text
src/components/PrintingSettings.jsx
src/components/PrintingSettingsContent.jsx
src/components/PrintingSettings.test.js
src/components/PrintingSettingsRedesign.test.js
src/components/PrintingConflictRecovery.test.js
src/printing/**
```

Root CSS such as `src/settings.css`, `src/settings-controls.css`, `src/settings-table-polish.css`, `src/settings-save-feedback.css`, `src/area-navigation.css`, and printing CSS remain where they are for C3.

### Spec consistency note

`settingsConflictPresentation.js` is intentionally placed under `app/surfaces/settings/conflicts/`, not under `app/policy-editing/`. Its current schemas know concrete resources such as operations, payment methods, cancellation reasons, finance categories and printing. Keeping those schemas in the generic engine would violate the approved rule that `app/policy-editing` must not know concrete Settings policies. The generic conflict merge algorithm moves to `policy-editing`; the human-readable Settings presentation stays in the surface.

### Persistence compatibility note

The browser/session-storage wire format for in-flight settings mutations is an existing behavioral contract. Moving it to `policyPendingStorage.js` must preserve:

- the storage prefix `settings-pending:`;
- stored `resource`, optional `scopeId`, `mutationId`, `payloadHash`, `startedAt`, and `contextId` fields;
- the 24-hour TTL;
- compatibility with pointers written by the pre-C3 implementation.

Do not rename the persisted prefix or pointer fields in C3. Internal function names may become generic while the persisted representation stays compatible.

---

## Task 1 — Relocate the pure versioned-edit primitives

**Files:**

- Create: `src/app/policy-editing/policyEditingState.js`
- Create: `src/app/policy-editing/policyEditingState.test.js`
- Create: `src/app/policy-editing/policyConflict.js`
- Create: `src/app/policy-editing/policyConflict.test.js`
- Create: `src/app/policy-editing/policyPendingStorage.js`
- Create: `src/app/policy-editing/policyPendingStorage.test.js`
- Modify temporarily: `src/app/settingsState.js`
- Modify temporarily: `src/app/settingsConflict.js`
- Modify temporarily: `src/app/settingsPendingStorage.js`
- Delete the three temporary reexports in Task 12.

**Interfaces:**

- `policyEditingState.js` produces the same state-machine semantics currently implemented by `settingsState.js`. Prefer generic exports `createPolicyEditingState()` and `policyEditingReducer()`; the temporary old module may alias these to the old export names.
- `policyConflict.js` produces the same pure merge/review algorithm currently in `settingsConflict.js`. Prefer `buildPolicyConflict()` / `resolvePolicyConflict()`; the temporary old module may alias old names.
- `policyPendingStorage.js` produces `readPending`, `writePending`, `clearPending`, `clearPendingContext`, and `POLICY_PENDING_TTL_MS`, while keeping the persisted `settings-pending:` format exactly compatible.
- None of these modules may import React, Settings UI, concrete policy adapters, API endpoints, QZ, or browser DOM APIs beyond receiving a storage object as an argument.

- [ ] **RED:** Move/copy the existing state tests to `src/app/policy-editing/policyEditingState.test.js`, change their imports to the new generic path/exports, and run `node --test src/app/policy-editing/policyEditingState.test.js`. Confirm failure because the new module/exports do not exist yet.
- [ ] Implement `policyEditingState.js` by relocating the current reducer/state logic without changing statuses, dirty/base/confirmed/draft rules, stale-revision behavior, later-draft preservation, or error behavior.
- [ ] Run `node --test src/app/policy-editing/policyEditingState.test.js` and require green.
- [ ] **RED:** Move/copy the conflict tests to `src/app/policy-editing/policyConflict.test.js`, point them at `policyConflict.js`, run `node --test src/app/policy-editing/policyConflict.test.js`, and confirm the missing-module/export failure.
- [ ] Implement `policyConflict.js` by relocating the pure conflict builder/resolver only. Do not move the concrete human-readable schemas from `settingsConflictPresentation.js` here.
- [ ] Run `node --test src/app/policy-editing/policyConflict.test.js` and require green.
- [ ] **RED:** Move/copy pending-storage tests to `src/app/policy-editing/policyPendingStorage.test.js`; add one explicit compatibility test that preloads a legacy key such as `settings-pending:context-1:operations` with the old pointer shape and expects the new module to recover it. Run `node --test src/app/policy-editing/policyPendingStorage.test.js` and confirm failure before implementation.
- [ ] Implement `policyPendingStorage.js` with generic internal naming while preserving the legacy storage prefix, pointer shape and TTL exactly.
- [ ] Replace `src/app/settingsState.js`, `src/app/settingsConflict.js`, and `src/app/settingsPendingStorage.js` with temporary reexports/aliases so the still-unmigrated application remains green during the slice.
- [ ] Run `node --test src/app/policy-editing/policyEditingState.test.js src/app/policy-editing/policyConflict.test.js src/app/policy-editing/policyPendingStorage.test.js`.
- [ ] Run the existing Settings conflict/pending consumers that still import the temporary paths: `node --test src/components/SettingsConflictReview.test.js src/components/SettingsConflictReview.sharedUx.test.js src/app/useBusinessSettingsController.test.js`.
- [ ] Commit with message: `refactor: extract policy editing primitives`.

---

## Task 2 — Generalize the versioned policy controller behind a transport contract

**Files:**

- Create: `src/app/policy-editing/policyEditingController.js`
- Move/adapt: `src/app/useBusinessSettingsController.test.js` → `src/app/policy-editing/policyEditingController.test.js`
- Modify temporarily: `src/app/useBusinessSettingsController.js`
- Delete temporary facade in Task 12.

**Interfaces:**

The generic controller consumes a transport with exactly these responsibilities:

```js
transport.load(policyId, scopeId?)
transport.save(policyId, { expectedRevision, mutationId, data }, scopeId?)
transport.loadReceipt(policyId, mutationId, scopeId?)
```

The controller continues to expose the behavior equivalent to:

```js
getResources()
setContext(context)
load(policyId, scopeId?)
edit(policyId, draft, scopeId?)
discard(policyId, scopeId?)
reviewConflict(policyId, scopeId?)
acceptConflictReview(review, candidate)
save(policyId, scopeId?)
reconcile(policyId, scopeId?)
reset()
```

`policyResourceKey(policyId, scopeId?)` remains the single key function for scoped/unscoped state. The generic context should use `contextId`; the Settings boundary later maps the backend's `settingsContextId` into it.

`onPolicyCommitted({ policyId, resourceKey, scopeId })` fires only when a mutation becomes confirmed, whether confirmation happens in the immediate save response or later reconciliation. It must not fire on ordinary loads, known failures, 409 conflict, transition to `unconfirmed`, discard, or expired pending cleanup.

- [ ] **RED:** Move the current controller test suite to `src/app/policy-editing/policyEditingController.test.js`; replace fake `getSettings/putSettings/getSettingsReceipt` injection with a fake `transport.load/save/loadReceipt`; point imports at the new controller path. Run `node --test src/app/policy-editing/policyEditingController.test.js` and confirm the expected missing-module/API failure.
- [ ] Implement `policyEditingController.js` by moving the current controller algorithm and replacing concrete settings-client calls with the three generic transport methods. Preserve canonical hashing, mutation reservation, stale read/write owner guards, same-context recovery, scoped state keys, 401 reset, 409 review, unknown-result semantics, receipt/current reconciliation, and reset behavior.
- [ ] Add a focused RED test in the controller suite for `onPolicyCommitted`: immediate confirmed save emits once; `unconfirmed` emits zero times; a later successful reconcile emits once; load/discard emit zero times. Run that test and confirm failure before adding the callback behavior.
- [ ] Add the minimum callback invocation at the point where the reducer/controller has authoritative confirmation. Do not make effective-config refresh part of the generic controller.
- [ ] Add a focused test that a context change invalidates stale async reads/writes and does not reuse the previous `contextId` pending pointer. Preserve the existing stale-owner assertions from the old suite.
- [ ] Convert `src/app/useBusinessSettingsController.js` into a temporary compatibility facade. It may map the old `api.getSettings/putSettings/getSettingsReceipt` shape to the new transport and expose the old hook/controller names, but it must not contain a second copy of the editing algorithm.
- [ ] Run `node --test src/app/policy-editing/policyEditingController.test.js` and require every migrated controller case green.
- [ ] Run `node --test src/app/policy-editing/*.test.js`.
- [ ] Commit with message: `refactor: generalize policy editing controller`.

---

## Task 3 — Replace the central settings client with concrete surface adapters

**Files:**

- Create: `src/app/surfaces/settings/policies/policyHttp.js`
- Create: `src/app/surfaces/settings/policies/operationsPolicy.js`
- Create: `src/app/surfaces/settings/policies/paymentMethodsPolicy.js`
- Create: `src/app/surfaces/settings/policies/cancellationReasonsPolicy.js`
- Create: `src/app/surfaces/settings/policies/financeCategoriesPolicy.js`
- Create: `src/app/surfaces/settings/policies/printingPolicy.js`
- Create: `src/app/surfaces/settings/policies/registry.js`
- Create: `src/app/surfaces/settings/policies/policyAdapters.test.js`
- Create: `src/api/effectiveConfigClient.js`
- Create: `src/api/effectiveConfigClient.test.js`
- Modify: `src/app/useEffectiveBusinessConfig.js`
- Keep temporarily: `src/api/settingsClient.js`, then delete it in Task 12.

**Interfaces:**

Each concrete policy definition exports metadata and an adapter. The adapter contract consumed by the boundary/provider is:

```js
{
  id,
  load(scopeId?),
  save({ expectedRevision, mutationId, data }, scopeId?),
  loadReceipt(mutationId, scopeId?)
}
```

Surface metadata also carries destination/capability information where applicable. Keep the existing identifiers exactly:

- `operations`
- `paymentMethods`
- `cancellationReasons`
- `financeCategories`
- `printingPolicy`
- `stationConfiguration`
- `stationPrimary`

Endpoint/envelope contracts remain exactly:

- `operations` → `/api/settings/operations`
- `paymentMethods` → `/api/settings/payment-methods`
- `cancellationReasons` → `/api/settings/cancellation-reasons`
- `financeCategories` → `/api/settings/finance-categories`
- `printingPolicy` → `/api/printing/settings`, using the existing `settings` envelope
- `stationConfiguration` → scoped station load/save under `/api/printing/stations`, preserving `configRevision` normalization and station metadata
- `stationPrimary` → `/api/printing/stations` plus existing `make-primary` write semantics
- receipts → existing `/api/settings/receipts/:mutationId?resource=...&scopeId=...` contract
- effective config → existing `/api/settings/effective?knownVersion=...`

- [ ] **RED:** Create `policyAdapters.test.js` by splitting the typed-resource cases currently in `src/api/settingsClient.test.js`. Assert all seven resource adapters use the same paths, methods, URL encoding, envelopes, scope validation and normalized station shape as today. Run `node --test src/app/surfaces/settings/policies/policyAdapters.test.js` and confirm failure.
- [ ] Implement `policyHttp.js` only for genuinely shared HTTP mechanics: JSON GET/PUT, receipt URL construction, scope validation helper, and envelope extraction. It may import `apiRequest` / `withJson` from the existing `src/api/client.js`; C3 does not move the generic HTTP client.
- [ ] Implement operations/payment/cancellation/finance adapters as thin concrete modules with their exact current paths and no UI logic.
- [ ] Implement printing/station adapters with the current special GET normalization and `make-primary` behavior. Do not import QZ or `src/printing/**` into these policy modules.
- [ ] Implement `registry.js` as the only Settings-surface registry for concrete policy definitions. It may export `getSettingsPolicy(id)`, `createSettingsPolicyAdapters()`, and immutable metadata consumed by Settings Home/navigation mapping.
- [ ] Run `node --test src/app/surfaces/settings/policies/policyAdapters.test.js` and require green.
- [ ] **RED:** Create `src/api/effectiveConfigClient.test.js` from the effective-config case in `settingsClient.test.js`; point it at `effectiveConfigClient.js`, run it, and confirm failure.
- [ ] Implement `getEffectiveConfig(knownVersion)` in `src/api/effectiveConfigClient.js` with the exact existing URL/query behavior. Update only the import in `src/app/useEffectiveBusinessConfig.js`; do not change its cache/owner/revision semantics.
- [ ] Run `node --test src/api/effectiveConfigClient.test.js src/app/effectiveBusinessConfig.test.js`.
- [ ] Keep `src/api/settingsClient.js` temporarily so unmigrated compatibility code still works; do not add new consumers to it after this task.
- [ ] Commit with message: `refactor: extract settings policy adapters`.

---

## Task 4 — Add the application-level PolicyEditingProvider and narrow bridge

**Files:**

- Create: `src/app/policy-editing/policyEditingContext.js`
- Create: `src/app/policy-editing/PolicyEditingProvider.jsx`
- Create: `src/app/policy-editing/PolicyEditingProvider.test.js`
- Create: `src/app/policy-editing/policyNavigationBridge.js`
- Create: `src/app/policy-editing/policyNavigationBridge.test.js`

**Interfaces:**

`PolicyEditingProvider` accepts generic dependencies only:

```jsx
<PolicyEditingProvider
  transport={transport}
  context={{ businessId, generation, contextId, capabilities }}
  storage={sessionStorageLike}
  navigationBridge={bridge}
  resolveNavigationDraft={(resources, destination) => draftOrNull}
  onFeedback={fn}
  onSessionExpired={fn}
  onPolicyCommitted={fn}
>
  {children}
</PolicyEditingProvider>
```

`usePolicyEditing()` exposes policy state/actions needed by Settings:

```js
resources
load
edit
save
discard
reconcile
reviewConflict
activeConflict
acceptActiveConflict
dismissActiveConflict
reset
```

`createPolicyNavigationBridge()` exposes stable methods for code that sits above/outside the provider in `App.jsx`:

```js
getNavigationDraft(destination)
discardNavigationDraft(resourceKey)
hasUnloadRisk()
connect(contract)
disconnect(contract)
```

The bridge never exposes the raw resources map.

- [ ] **RED:** Add `policyNavigationBridge.test.js` proving a disconnected bridge returns `null`/`false`, delegates to the currently connected contract, rejects stale disconnects, and never exposes a `resources` property. Run it and confirm failure.
- [ ] Implement the small bridge object with stable delegating methods and connection identity protection.
- [ ] Run `node --test src/app/policy-editing/policyNavigationBridge.test.js`.
- [ ] **RED:** Add provider tests with a fake transport proving load/edit/save delegation, active conflict ownership, manual conflict reopen, accept/dismiss flow, context reset, and `onPolicyCommitted` forwarding. Run `node --test src/app/policy-editing/PolicyEditingProvider.test.js` and confirm failure.
- [ ] Implement `policyEditingContext.js` and `PolicyEditingProvider.jsx` on top of the generic controller. The provider, not `App.jsx`, owns `activeConflict`.
- [ ] Add a provider test that discarding the resource represented by the active conflict clears that active modal state only after discard succeeds.
- [ ] **RED:** Add provider tests for browser abandonment: clean resources do not register/prevent unload; dirty, `saving`, and `unconfirmed` resources do. Run and confirm failure before adding the listener.
- [ ] Implement the provider-owned `beforeunload` listener using a generic `hasUnloadRisk` selector over resources. Keep internal navigation rules separate from browser-abandonment rules.
- [ ] Connect the provider's narrow `getNavigationDraft`, `discardNavigationDraft`, and `hasUnloadRisk` functions to `navigationBridge` without leaking the resources map.
- [ ] Run `node --test src/app/policy-editing/*.test.js`.
- [ ] Commit with message: `feat: add policy editing provider`.

---

## Task 5 — Remove concrete Settings knowledge from app/navigation

**Files:**

- Create: `src/app/navigation/draftExitGuard.js`
- Create: `src/app/navigation/draftExitGuard.test.js`
- Create: `src/app/surfaces/settings/policies/navigation.js`
- Create: `src/app/surfaces/settings/policies/navigation.test.js`
- Modify: `src/app/navigation/useNavigationController.js`
- Modify: `src/settingsDraftNavigation.test.js`
- Modify: `src/navigationContext.test.js`
- Modify minimally: `src/App.jsx` only where the discard-dialog kind label must accept the generic `policy` kind during this task.
- Keep temporarily: `src/app/navigation/settingsDraftGuard.js`, delete in Task 12 after App is fully migrated.

**Interfaces:**

`draftExitGuard.js` is generic and consumes an already-resolved draft:

```js
shouldConfirmDraftExit(draft, activeDestination, nextDestination)
```

It knows only `dirty`, `status`, and a `destinations` set. It does not map Settings routes to policy IDs.

`app/surfaces/settings/policies/navigation.js` owns the concrete route mapping:

```text
settings-operations       -> operations
settings-modalities       -> operations
settings-payments         -> paymentMethods
settings-cancellations    -> cancellationReasons
settings-finance-categories -> financeCategories
settings-printing         -> printingPolicy
```

It deliberately does not use station configuration/primary station as separate navigation guards, preserving current behavior.

- [ ] **RED:** Move the pure `shouldConfirmSettingsExit` assertions into `draftExitGuard.test.js`, rename the target to `shouldConfirmDraftExit`, run `node --test src/app/navigation/draftExitGuard.test.js`, and confirm failure.
- [ ] Implement the generic predicate with the exact current rule: confirm only when `dirty === true`, status is neither `saving` nor `unconfirmed`, the active destination belongs to the draft's destination set, and the next destination does not.
- [ ] **RED:** Add `policies/navigation.test.js` proving Operations/Modalities share one operations draft, payment/cancellation/finance/printing resolve to their current resource keys, device/home resolve to no versioned draft, and unload risk is not part of this concrete route map. Run and confirm failure.
- [ ] Implement the Settings-side mapping using registry metadata plus the provider resources passed to the resolver. Returned draft must include `resourceKey`, `resource`/policy identifier, `scopeId` when applicable, `dirty`, `status`, and `destinations`.
- [ ] Update `useNavigationController` to consume the narrow names `getNavigationDraft` and `discardNavigationDraft`, use `shouldConfirmDraftExit`, and report pending Settings-edit confirmation internally as kind `policy` rather than embedding resource mapping. During this intermediate commit, accept the old prop names as compatibility aliases so current `App.jsx` remains functional until Task 11.
- [ ] Remove the Settings-specific explicit `discardSettingsAndNavigate` behavior from the final intended controller API. During this task it may remain as a compatibility alias solely because the old Settings page still calls it; Task 11 must remove the alias and caller.
- [ ] Update `settingsDraftNavigation.test.js` to exercise the new generic prop names and `policy` kind. Preserve all current cases: cancel keeps draft, capability revocation revalidation, duplicate decision idempotence, same-resource navigation, saving/unconfirmed pass-through, and one discard on confirmation.
- [ ] Update the Settings-related case in `navigationContext.test.js` so the test injects a pre-resolved draft instead of importing `settingsDraftGuard.js`. Navigation tests must no longer need concrete Settings resource mapping.
- [ ] Update the discard dialog condition in `App.jsx` from the internal kind `settings` to `policy` while keeping the exact Portuguese text unchanged.
- [ ] Run `node --test src/app/navigation/draftExitGuard.test.js src/app/surfaces/settings/policies/navigation.test.js src/settingsDraftNavigation.test.js src/navigationContext.test.js`.
- [ ] Commit with message: `refactor: decouple navigation from settings resources`.

---

## Task 6 — Move Settings-only primitives and conflict presentation into the surface

**Files:**

- Move: `src/components/SettingsControls.jsx` → `src/app/surfaces/settings/components/SettingsBackAndSwitchControls.jsx`
- Move: `src/components/SettingsEditorShell.jsx` → `src/app/surfaces/settings/components/SettingsEditorShell.jsx`
- Move: `src/components/SettingsItemDialog.jsx` → `src/app/surfaces/settings/components/SettingsItemDialog.jsx`
- Move: `src/components/SettingsItemList.jsx` → `src/app/surfaces/settings/components/SettingsItemList.jsx`
- Move/adapt: `src/components/SettingsPrimitives.test.js` → `src/app/surfaces/settings/components/SettingsPrimitives.test.js`
- Move: `src/components/SettingsConflictReview.jsx` → `src/app/surfaces/settings/components/SettingsConflictReview.jsx`
- Move/adapt: `src/components/SettingsConflictReview.test.js` → `src/app/surfaces/settings/components/SettingsConflictReview.test.js`
- Move/adapt: `src/components/SettingsConflictReview.sharedUx.test.js` → `src/app/surfaces/settings/components/SettingsConflictReview.sharedUx.test.js`
- Move: `src/app/settingsConflictPresentation.js` → `src/app/surfaces/settings/conflicts/settingsConflictPresentation.js`
- Add temporary reexports at old component paths only until all consumers move; delete them in Task 12.

**Interfaces:**

- Settings-only primitives keep their existing JSX props and copy exactly.
- `SettingsConflictReview` consumes generic `resolvePolicyConflict()` plus the Settings-specific presentation formatter.
- The presentation formatter may know concrete policy identifiers and `paymentLabel`; `app/policy-editing` may not.
- Shared primitives `Button`, `Modal`, `PageHeader`, `Icon`, `SystemSelect` remain shared and must not be copied into the surface.

- [ ] **RED:** Move the Settings primitive test to its new surface path and update its workspace-harness imports to load the new component paths. Run `node --test src/app/surfaces/settings/components/SettingsPrimitives.test.js` and confirm failure before moving implementation files.
- [ ] Move the four Settings-only primitive components, fix relative imports to shared Button/Modal/Icon and existing root CSS, and add short-lived old-path reexports where unmigrated pages still import them.
- [ ] Run the moved primitive test and require green with the exact existing labels, disabled states, overflow/menu behavior and CSS contracts.
- [ ] **RED:** Move both conflict-review test files to the surface path and update them to import the generic conflict builder/resolver plus the new surface component. Run both and confirm failure.
- [ ] Move `SettingsConflictReview.jsx` and concrete `settingsConflictPresentation.js`; update imports so conflict merging comes from `app/policy-editing/policyConflict.js` while human-readable schemas remain under the Settings surface.
- [ ] Preserve all existing conflict UX tests: friendly operation labels, no raw JSON, no destructive default, protected-action behavior, primary-station copy, printing-compatible merge copy, station labels, focus behavior, overflow behavior, and double-click single acceptance.
- [ ] Add temporary old-path reexports for `SettingsConflictReview` only while `App.jsx` still imports it. Do not create a reexport for `settingsConflictPresentation.js` once all moved conflict UI imports use the surface path.
- [ ] Run `node --test src/app/surfaces/settings/components/SettingsPrimitives.test.js src/app/surfaces/settings/components/SettingsConflictReview.test.js src/app/surfaces/settings/components/SettingsConflictReview.sharedUx.test.js`.
- [ ] Commit with message: `refactor: move settings surface primitives`.

---

## Task 7 — Move Settings Home and the four business-policy editors

**Files:**

- Move: `src/pages/SettingsHome.jsx` → `src/app/surfaces/settings/SettingsHome.jsx`
- Move/adapt: `src/pages/SettingsHome.test.js` → `src/app/surfaces/settings/SettingsHome.test.js`
- Move/adapt: `src/pages/SettingsTablePolish.test.js` → `src/app/surfaces/settings/SettingsTablePolish.test.js`
- Move: `src/pages/OperationSettings.jsx` → `src/app/surfaces/settings/OperationSettings.jsx`
- Move/adapt: `src/pages/OperationSettings.test.js` → `src/app/surfaces/settings/OperationSettings.test.js`
- Move: `src/pages/PaymentSettings.jsx` → `src/app/surfaces/settings/PaymentSettings.jsx`
- Move: `src/pages/paymentSettingsModel.js` → `src/app/surfaces/settings/paymentSettingsModel.js`
- Move/adapt: `src/pages/PaymentSettings.test.js` → `src/app/surfaces/settings/PaymentSettings.test.js`
- Move/adapt: `src/pages/PaymentSettings.menuInactive.test.js` → `src/app/surfaces/settings/PaymentSettings.menuInactive.test.js`
- Move: `src/pages/CancellationSettings.jsx` → `src/app/surfaces/settings/CancellationSettings.jsx`
- Move/adapt: `src/pages/CancellationSettings.test.js` → `src/app/surfaces/settings/CancellationSettings.test.js`
- Move/adapt: `src/pages/CancellationSettings.redesign.test.js` → `src/app/surfaces/settings/CancellationSettings.redesign.test.js`
- Move: `src/pages/FinanceCategorySettings.jsx` → `src/app/surfaces/settings/FinanceCategorySettings.jsx`
- Move/adapt: `src/pages/FinanceCategorySettings.test.js` → `src/app/surfaces/settings/FinanceCategorySettings.test.js`
- Move/adapt: `src/pages/FinanceCategorySettings.redesign.test.js` → `src/app/surfaces/settings/FinanceCategorySettings.redesign.test.js`
- Keep temporary page reexports only until `SettingsSurface` replaces the old root page; delete in Task 12.

**Interfaces:**

- Editor prop contracts remain unchanged in this task: `resourceState`, `readOnly`, edit/save/discard/reconcile/reload/review callbacks, and navigation-home callback.
- Settings Home retains existing visibility rules/capabilities and one Operation card representing Operations + Modalities.
- The editors now import Settings-only primitives from their co-located `components/` directory.
- No endpoint, capability, text, visual, menu, active/inactive styling or mobile table behavior changes.

- [ ] **RED:** Move the Settings Home tests to the target path first, update `workspaceHarness` module targets to `/src/app/surfaces/settings/SettingsHome.jsx`, run them, and confirm failure because the component has not moved yet.
- [ ] Move `SettingsHome.jsx`, fix shared imports and preserve the exact card registry/implemented/capability filtering. Run `SettingsHome.test.js` and `SettingsTablePolish.test.js` green.
- [ ] **RED:** For Operation Settings, move its test first and point it at the new path. Run it and confirm failure.
- [ ] Move `OperationSettings.jsx`, update primitive imports only, and run its test green.
- [ ] **RED:** Move both Payment Settings tests plus `paymentSettingsModel.js` target imports, run and confirm failure.
- [ ] Move `PaymentSettings.jsx` and `paymentSettingsModel.js`, update primitive imports, and preserve the approved three-dot menu behavior: choosing an option closes the menu; inactive block text remains visually de-emphasized as currently implemented. Run both payment tests green.
- [ ] **RED:** Move cancellation editor tests, run and confirm failure; then move the editor and make only import-path adjustments required for green.
- [ ] **RED:** Move finance-category editor tests, run and confirm failure; then move the editor and make only import-path adjustments required for green.
- [ ] Add short-lived old page reexports so the still-old `src/pages/Settings.jsx` can continue rendering these moved editors until Task 9.
- [ ] Run `node --test src/app/surfaces/settings/SettingsHome.test.js src/app/surfaces/settings/SettingsTablePolish.test.js src/app/surfaces/settings/OperationSettings.test.js src/app/surfaces/settings/PaymentSettings.test.js src/app/surfaces/settings/PaymentSettings.menuInactive.test.js src/app/surfaces/settings/CancellationSettings.test.js src/app/surfaces/settings/CancellationSettings.redesign.test.js src/app/surfaces/settings/FinanceCategorySettings.test.js src/app/surfaces/settings/FinanceCategorySettings.redesign.test.js`.
- [ ] Commit with message: `refactor: move settings editors into surface`.

---

## Task 8 — Extract local device preferences outside the versioned engine

**Files:**

- Create: `src/app/surfaces/settings/local/devicePreferences.js`
- Create: `src/app/surfaces/settings/local/devicePreferences.test.js`
- Create: `src/app/surfaces/settings/local/DevicePreferences.jsx`
- Create: `src/app/surfaces/settings/local/DevicePreferences.test.js`
- Source to characterize: current device section/helper code in `src/pages/Settings.jsx`

**Interfaces:**

`devicePreferences.js` owns only local/browser helpers equivalent to the current implementation:

```js
DEVICE_PREFERENCES_UPDATED_AT_KEY
getBrowserLabel(userAgent)
readDevicePreferencesUpdatedAt(storage?)
getLocalStorageUsageBytes(storage?)
formatStorageUsage(bytes)
formatDeviceTimestamp(value)
writeDevicePreferencesUpdatedAt(storage, isoTimestamp)
```

`DevicePreferences.jsx` consumes:

```jsx
<DevicePreferences
  soundEnabled={boolean}
  onSoundEnabledChange={fn}
/>
```

It continues to read/set theme through the existing theme context. It does not import or call `usePolicyEditing`.

- [ ] **RED:** Add pure helper tests that capture current browser-label detection, `Indisponível`, byte/KB formatting, invalid timestamp fallback, and the exact storage key `delivery-device-preferences-updated-at`. Run and confirm failure.
- [ ] Implement `devicePreferences.js` by extracting the current helper logic without changing formatting/copy or storage keys. Keep storage failures best-effort exactly as now.
- [ ] Run `node --test src/app/surfaces/settings/local/devicePreferences.test.js`.
- [ ] **RED:** Add `DevicePreferences.test.js` using the workspace harness to capture the existing headings, Claro/Escuro/Automático options, kitchen sound switch, local diagnostics, save feedback, persistence-error feedback, and theme/sound callback behavior. Run and confirm failure.
- [ ] Extract the current device JSX/state from `src/pages/Settings.jsx` into `DevicePreferences.jsx`, using the moved Settings switch control and shared `PageHeader`/`Icon`/theme context. Do not route theme/sound through the policy provider.
- [ ] Run both local-device tests green.
- [ ] Commit with message: `refactor: extract local device settings`.

---

## Task 9 — Build SettingsPolicyBoundary and the new SettingsSurface

**Files:**

- Create: `src/app/surfaces/settings/SettingsPolicyBoundary.jsx`
- Create: `src/app/surfaces/settings/SettingsPolicyBoundary.test.js`
- Create: `src/app/surfaces/settings/SettingsSurface.jsx`
- Create: `src/app/surfaces/settings/SettingsSurface.test.js`
- Reference only: old `src/pages/Settings.jsx` until Task 12 deletion.

**Interfaces:**

`SettingsPolicyBoundary` is the only composition module that knows both the generic provider and the Settings adapter registry. It accepts application dependencies:

```jsx
<SettingsPolicyBoundary
  effectiveConfigOwner={owner}
  storage={sessionStorageLike}
  navigationBridge={bridge}
  onFeedback={fn}
  onSessionExpired={fn}
  onPolicyCommitted={fn}
>
  {children}
</SettingsPolicyBoundary>
```

It maps `effectiveConfigOwner.settingsContextId` to the generic provider's `contextId`, creates the transport from `registry.js`, and passes the Settings navigation-draft resolver to `PolicyEditingProvider`.

`SettingsSurface` accepts only legitimate surface/application inputs:

```jsx
<SettingsSurface
  section={activeTab}
  printing={printingRuntime}
  granted={granted}
  implemented={IMPLEMENTED_DESTINATIONS}
  onNavigate={requestNavigation}
  soundEnabled={kitchenSoundEnabled}
  onSoundEnabledChange={handleKitchenSoundEnabledChange}
  onSuccessMessage={showSuccessMessage}
/>
```

It must not accept `businessSettings`, `operationSettings`, `settingsConflictReview`, a raw resources map, or App-owned save/discard functions.

- [ ] **RED:** Add `SettingsPolicyBoundary.test.js` proving the boundary maps `settingsContextId` to provider `contextId`, gives the provider the concrete adapter transport/navigation resolver, and resets state when owner/generation/context/capabilities change. Run and confirm failure.
- [ ] Implement `SettingsPolicyBoundary.jsx` as composition only; do not duplicate provider logic inside it.
- [ ] **RED:** Add `SettingsSurface.test.js` that renders each destination with a controlled provider/transport and asserts: Home renders; Operation and Modalities load `operations`; Payments loads `paymentMethods`; Cancellations loads `cancellationReasons`; Finance Categories loads `financeCategories`; Printing loads policy plus permitted station resources; Device renders without loading any versioned policy. Run and confirm failure.
- [ ] Implement `SettingsSurface.jsx` by porting the current `Settings.jsx` route composition to `usePolicyEditing()`. Keep the current success messages exactly: operation, payment, cancellation and finance-category messages remain unchanged.
- [ ] Implement explicit editor cancel inside the surface as: call the matching policy `discard`; if it returns `false`, stay in place; otherwise navigate to `settings-home`. This replaces the old App-level `discardSettingsAndNavigate` dependency without changing UX.
- [ ] Wire manual conflict-review buttons to the provider wrapper so a returned review becomes `activeConflict`; render the moved `SettingsConflictReview` from the surface using `activeConflict`, `acceptActiveConflict`, and `dismissActiveConflict`.
- [ ] Add/retain tests that closing the conflict modal only dismisses the presentation and leaves the resource in conflict so “Revisar alterações” can reopen it.
- [ ] Render `DevicePreferences` for `settings-device`; verify no policy load/edit/save call occurs for theme or sound.
- [ ] Keep printing rendering on the existing `PrintingSettingsContent`; Task 10 supplies its provider-backed adapter.
- [ ] Run `node --test src/app/surfaces/settings/SettingsPolicyBoundary.test.js src/app/surfaces/settings/SettingsSurface.test.js` plus all moved editor/home/local/conflict tests.
- [ ] Commit with message: `feat: compose settings application surface`.

---

## Task 10 — Adapt Printing Settings to PolicyEditingProvider without touching QZ runtime

**Files:**

- Create: `src/app/surfaces/settings/printingSettingsAdapter.js`
- Create: `src/app/surfaces/settings/printingSettingsAdapter.test.js`
- Modify: `src/app/surfaces/settings/SettingsSurface.jsx`
- Modify only if required for a mechanical callback cleanup: `src/components/PrintingSettingsContent.jsx`
- Regression tests: `src/components/PrintingSettings.test.js`, `src/components/PrintingSettingsRedesign.test.js`, `src/components/PrintingConflictRecovery.test.js`
- Retire later: `src/app/usePrintingSettingsController.js` in Task 12.

**Interfaces:**

The surface printing adapter must preserve the public contract that `PrintingSettingsContent` already consumes:

```js
policyState()
stationState()
primaryState()
loadPolicy()/reloadPolicy()/reviewPolicy()
editPolicy()/savePolicy()/discardPolicy()/reconcilePolicy()
loadStation()/reloadStation()/reviewStation()
editStation()/saveStation()/discardStation()/reconcileStation()
reviewPrimary()
makePrimary()
savePrinter()
refreshPrinters()
testPrint()
```

Versioned operations route through `usePolicyEditing`; local physical operations continue to delegate to the existing `printing` runtime. Station scope stays `printing.localStation.id`.

- [ ] **RED:** Move the adapter behavior currently covered around `createPrintingSettingsAdapter` into `printingSettingsAdapter.test.js`. Use a fake policy-editing API plus fake printing runtime and assert exact policy IDs/scopes and local-operation delegation. Run and confirm failure.
- [ ] Implement the adapter without importing QZ, queue internals or `usePrintingManager`; it receives the existing printing runtime as a dependency.
- [ ] Ensure `makePrimary()` edits/saves `stationPrimary` using the same current station ID and does not bypass optimistic revision/conflict semantics.
- [ ] Ensure `reviewPolicy`, `reviewStation`, and `reviewPrimary` use the provider's review wrapper so active conflict ownership remains in the provider. `PrintingSettingsContent` may continue its existing “reopen conflict” flow; avoid a second App callback.
- [ ] Update `SettingsSurface` printing route to construct/use this adapter and pass it to `PrintingSettingsContent` with the same `printing` and `granted` props.
- [ ] Run `node --test src/app/surfaces/settings/printingSettingsAdapter.test.js src/components/PrintingSettings.test.js src/components/PrintingSettingsRedesign.test.js src/components/PrintingConflictRecovery.test.js`.
- [ ] Run any existing printing station/policy API tests touched by imports; no physical printer is required for this task.
- [ ] Commit with message: `refactor: bridge printing settings to policy editing`.

---

## Task 11 — Integrate the new boundary into App and remove App-owned Settings internals

**Files:**

- Modify: `src/App.jsx`
- Modify: `src/app/navigation/useNavigationController.js`
- Modify: `src/settingsDraftNavigation.test.js`
- Modify: `src/navigationContext.test.js`
- Add or modify a focused App contract test, preferably `src/settingsDraftNavigation.test.js` or a new `src/settingsSurfaceIntegration.test.js` if rendering the full App is clearer.

**Interfaces after this task:**

`App.jsx` may know:

- `SettingsPolicyBoundary`
- `SettingsSurface`
- generic `createPolicyNavigationBridge`
- effective-config owner/refresh
- printing runtime
- granted/implemented destinations
- local sound preference/callback
- global feedback/session callbacks

`App.jsx` must no longer know:

- `useBusinessSettingsController`
- `businessSettings.resources`
- `businessSettingsRef`
- `usePrintingSettingsController`
- `getSettingsDraftForDestination`
- `hasSettingsUnloadRisk`
- `settingsConflictReview` state
- `SettingsConflictReview` rendering
- individual settings resource names for navigation/save/discard

- [ ] **RED:** Add a source-contract test that reads `src/App.jsx` and asserts it does not import/use `useBusinessSettingsController`, `usePrintingSettingsController`, `settingsConflictReview`, `getSettingsDraftForDestination`, `hasSettingsUnloadRisk`, or the old `src/pages/Settings` path, while requiring `SettingsPolicyBoundary`, `SettingsSurface`, and the generic navigation bridge. Run it and confirm failure.
- [ ] In `App.jsx`, create one stable `policyNavigationBridge` with `useMemo` (or `useRef` around a bridge created once). Pass only `bridge.getNavigationDraft` and `bridge.discardNavigationDraft` into `useNavigationController` using the final generic prop names.
- [ ] Remove `businessSettingsRef`, App-owned beforeunload Settings effect, `businessSettings`, `printingSettings`, Settings conflict state, `acceptSettingsConflict`, and conflict modal rendering.
- [ ] Wrap the authenticated application/navigation subtree with `SettingsPolicyBoundary`, passing the effective-config owner mapped by the boundary, `window.sessionStorage`, feedback/session callbacks, the bridge, and `onPolicyCommitted={() => effectiveConfig.refresh()}`. The App must not inspect the commit payload to apply business rules.
- [ ] Replace old `<Settings ...>` with `<SettingsSurface ...>` using only the approved surface props. Remove `operationSettings`, `businessSettings`, conflict callback, and App-level cancel callbacks.
- [ ] Remove the unreachable legacy `showPrintingSettings` state/render/import. On the current C3 base there is no code path that ever sets it to `true`; the live print-queue entry already navigates to `settings-printing`. Do not remove `src/components/PrintingSettings.jsx` itself because C9 owns printing UI cleanup.
- [ ] Remove the compatibility `getSettingsDraft/onDiscardSettings` aliases and `discardSettingsAndNavigate` return from `useNavigationController`; keep only `getNavigationDraft` / `discardNavigationDraft`. Ensure pending kind remains generic `policy` and user-facing discard copy is unchanged.
- [ ] Update `settingsDraftNavigation.test.js` so it proves the final controller API has no `discardSettingsAndNavigate` method and still preserves all C2 behavior.
- [ ] Update the full-App navigation case in `navigationContext.test.js` so session reset/context changes still work with the provider boundary.
- [ ] Add an integration assertion that a confirmed settings save invokes effective-config refresh, while a 409 conflict or unconfirmed save does not report a confirmed policy until reconciliation succeeds.
- [ ] Add an integration assertion that the provider-owned beforeunload guard appears for dirty/saving/unconfirmed policy state and disappears after successful discard/confirmation/reset.
- [ ] Run `node --test src/settingsDraftNavigation.test.js src/navigationContext.test.js src/app/policy-editing/PolicyEditingProvider.test.js src/app/surfaces/settings/SettingsSurface.test.js` and all Settings editor/printing tests.
- [ ] Run `npm test` once at this architectural integration checkpoint. Fix only C3-related regressions before continuing.
- [ ] Commit with message: `refactor: integrate settings policy boundary`.

---

## Task 12 — Remove all C3 compatibility facades and tighten architecture gates

**Files to delete after proving no consumers remain:**

- `src/pages/Settings.jsx`
- `src/pages/SettingsHome.jsx`
- `src/pages/OperationSettings.jsx`
- `src/pages/PaymentSettings.jsx`
- `src/pages/CancellationSettings.jsx`
- `src/pages/FinanceCategorySettings.jsx`
- `src/pages/paymentSettingsModel.js`
- old page test paths already moved in Task 7
- `src/app/settingsState.js`
- `src/app/settingsConflict.js`
- `src/app/settingsConflictPresentation.js`
- `src/app/settingsPendingStorage.js`
- `src/app/useBusinessSettingsController.js`
- `src/app/usePrintingSettingsController.js`
- `src/app/navigation/settingsDraftGuard.js`
- `src/api/settingsClient.js`
- temporary old-path Settings component reexports under `src/components/` for `SettingsControls`, `SettingsConflictReview`, `SettingsEditorShell`, `SettingsItemDialog`, `SettingsItemList`
- old moved component test paths already removed in Task 6

**Files to modify/add:**

- Modify: `scripts/architecture/check-import-boundaries.mjs`
- Add or modify architecture fixture/tests only if the current checker supports fixtures; otherwise encode deterministic source rules in the existing checker.
- Modify imports throughout `src/**` and tests until no legacy path remains.

**Final architecture rules to enforce in C3:**

1. `src/app/policy-editing/**` must not import `src/app/surfaces/settings/**`, `src/pages/**`, `src/printing/**`, or concrete Settings UI.
2. `src/app/navigation/**` must not import `src/app/surfaces/settings/**` or any concrete Settings policy registry.
3. `src/App.jsx` must not import the deleted legacy Settings owners/controllers or concrete policy modules; it may import the surface boundary/surface and generic navigation bridge.
4. No new QZ import is allowed outside existing approved printing/infrastructure allowances.
5. The deleted C3 legacy owner files must not remain as silent reexports when staging begins.

- [ ] **RED:** Add architecture-check assertions for policy-editing → Settings-surface prohibition and navigation → Settings-surface prohibition. Add a source/file-ownership assertion for the legacy paths above. Run `npm run test:architecture` and confirm failure while facades still exist or forbidden edges remain.
- [ ] Use `rg` to find every legacy import before deletion. Required scans include: `rg "pages/Settings|useBusinessSettingsController|usePrintingSettingsController|settingsDraftGuard|api/settingsClient|app/settingsState|app/settingsConflict|settingsPendingStorage|components/SettingsControls|components/SettingsConflictReview|components/SettingsEditorShell|components/SettingsItemDialog|components/SettingsItemList" src test-support scripts`.
- [ ] Update legitimate remaining imports to final paths. Do not add a new blanket barrel file solely to hide prohibited cross-layer imports.
- [ ] Delete all temporary C3 facades/legacy owners listed above.
- [ ] Split/delete `src/api/settingsClient.test.js`: every typed-policy case must already live in `policyAdapters.test.js`, and effective-config coverage must already live in `effectiveConfigClient.test.js`. There must be no orphan test importing the removed client.
- [ ] Run the same `rg` scan again and require no legacy-owner matches except intentional historical strings in documentation or test descriptions that do not import code.
- [ ] Run `npm run test:architecture` and require green.
- [ ] Run focused Settings suite: `node --test src/app/policy-editing/*.test.js src/app/surfaces/settings/**/*.test.js src/settingsDraftNavigation.test.js src/navigationContext.test.js src/components/PrintingSettings.test.js src/components/PrintingSettingsRedesign.test.js src/components/PrintingConflictRecovery.test.js src/app/effectiveBusinessConfig.test.js src/api/effectiveConfigClient.test.js`.
- [ ] Inspect `docs/superpowers/qa/spec-c-compatibility-facades.md`. If all temporary C3 facades are gone, do not add a C3 debt row. If execution uncovered a genuine blocker that forces one to survive, stop before staging and obtain design approval before recording it; the approved plan expects zero surviving C3 facade.
- [ ] Commit with message: `refactor: close c3 settings ownership`.

---

## Task 13 — Full regression gates, diff review, staging, and C3 QA record

**Files:**

- Create after executable gates pass: `docs/superpowers/qa/spec-c3-settings-surface-qa.md`
- Modify after evidence exists: `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
- Modify only if a real surviving facade was separately approved: `docs/superpowers/qa/spec-c-compatibility-facades.md`
- No production workflow change.

### 13A — Local/full automated gates

- [ ] Run `git status --short`; require only intentional C3 changes before final executable commit review.
- [ ] Run `git diff --check`.
- [ ] Run `npm test`.
- [ ] Run `npm run test:architecture`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm run d1:migrate:local` even though C3 should have no D1 changes; this protects the existing migration gate.
- [ ] Run `git diff --name-status origin/master...HEAD` and verify there are no Worker/D1/schema/QZ implementation changes outside approved mechanical Settings import updates.
- [ ] Run `git diff origin/master...HEAD -- worker migrations src/printing` and inspect any output. Expected Worker/migrations diff is empty; printing runtime logic must be unchanged.
- [ ] Run source scans proving `App.jsx` no longer contains concrete Settings engine/resource internals and `src/app/navigation/` no longer contains Settings route→resource mapping.
- [ ] Run source scans proving `src/app/policy-editing/` does not contain concrete policy endpoint paths or policy-specific labels such as payment/cancellation/printing copy.

### 13B — GitHub Validate gate

- [ ] Push the exact executable HEAD to `feature/spec-c3-settings-surface`.
- [ ] Wait for the normal `Validate` workflow on that exact SHA.
- [ ] Require all existing jobs green, including tests, architecture gate, lint, build, production Worker dry-run, staging Worker dry-run, local D1 migration and Spec B D1 clean-install/upgrade gates.
- [ ] Record workflow run ID, workflow run number, exact SHA, and every job result in the QA record. Do not call the slice validated if the workflow is still queued/running or tied to a different SHA.

### 13C — Staging deployment

- [ ] Trigger staging manually with `workflow_dispatch` for the exact validated C3 executable SHA/branch. Do not add a broad `feature/**` auto-deploy trigger as part of C3.
- [ ] Require staging migration, deploy and real staging login verification steps green.
- [ ] Record deployment workflow ID/number, exact deployed SHA and staging URL in the QA record.
- [ ] Confirm production was not deployed.

### 13D — Manual staging homologation matrix

Execute and record each item as `PASS`, `FAIL`, or `BLOCKED` based only on what was actually observable. Automated evidence may be cited as complementary evidence but must not convert an unobservable manual scenario from `BLOCKED` to `PASS`.

- [ ] Settings Home: cards/visibility/capabilities unchanged.
- [ ] Operations: load, edit, save, cancel, success feedback.
- [ ] Modalities: load/edit behavior shares the operations draft.
- [ ] Operations → Modalities and Modalities → Operations with a dirty draft: no discard prompt.
- [ ] Leaving Operations/Modalities for another resource with a dirty draft: discard confirmation appears; cancel preserves draft; confirm discards exactly once.
- [ ] Payment Methods: active/inactive controls, three-dot menu closes after choosing an action, save/cancel, read-only behavior.
- [ ] Cancellation Reasons: add/edit/active ordering/current visuals, save/cancel/read-only.
- [ ] Finance Categories: add/edit/type/active ordering/current visuals, save/cancel/read-only.
- [ ] Printing Policy: 1/2-copy policy edit/save/cancel and current notices.
- [ ] Printing Station: name, platform, auto-print, primary station flows remain visually/behaviorally unchanged.
- [ ] Local printer controls: discovery/selection/status/test-print controls remain available according to current QZ/runtime state. C3 does not require a new physical-print hardware round unless execution unexpectedly changes physical printing code.
- [ ] Device Preferences: light/dark/system theme, kitchen sound preference, local diagnostics, autosave/error feedback; verify no backend policy write occurs.
- [ ] Light theme on desktop and mobile widths.
- [ ] Dark theme on desktop and mobile widths.
- [ ] Known load failure/retry when reproducible in staging.
- [ ] 409 conflict review when reproducible: friendly diff, no raw JSON, apply review returns to draft and requires explicit save again.
- [ ] Unknown-result/unconfirmed reconciliation when reproducible.
- [ ] Browser reload/close abandonment prompt for dirty draft.
- [ ] Browser reload/close abandonment risk for `saving`/`unconfirmed` when reproducible.
- [ ] Internal navigation from `saving`/`unconfirmed` does not introduce a second ordinary discard decision, preserving C2 behavior.
- [ ] Confirmed policy save refreshes effective business config; downstream current behavior uses backend-authoritative config.
- [ ] Logout/login or context change does not leak the previous business/session's policy state/conflict/pending UI.
- [ ] No unexpected console errors attributable to C3 during the pass.

### 13E — QA/rollout documentation and merge-readiness checkpoint

- [ ] Create `docs/superpowers/qa/spec-c3-settings-surface-qa.md` with: base SHA, executable SHA, focused/local gate results, Validate run evidence, staging run evidence, manual matrix, BLOCKED rationale where applicable, diff/ownership audit, facade audit, and explicit statement that production is untouched.
- [ ] Update `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md` so the current-status block reflects the actual C2 merged state and C3's actual stage/evidence. Do not change later slice contracts.
- [ ] If documentation changes are made after the homologated executable SHA, create a docs-only commit and run Validate on that docs HEAD. Keep the QA record explicit about which SHA was executable/homologated and which SHA is docs-only.
- [ ] Compare the final branch against `master`. Verify executable changes are limited to C3 ownership/refactor scope plus QA/docs evidence.
- [ ] Do not merge. Present exact branch HEAD, executable homologated SHA, Validate evidence, staging evidence, manual PASS/FAIL/BLOCKED counts, and remaining risks to the user for explicit merge authorization.

---

## Required regression inventory before merge readiness

The final `npm test` run is mandatory, but these suites are especially relevant and must be individually green during the tasks that touch them:

```text
src/app/policy-editing/policyEditingState.test.js
src/app/policy-editing/policyConflict.test.js
src/app/policy-editing/policyPendingStorage.test.js
src/app/policy-editing/policyEditingController.test.js
src/app/policy-editing/policyNavigationBridge.test.js
src/app/policy-editing/PolicyEditingProvider.test.js

src/app/surfaces/settings/SettingsPolicyBoundary.test.js
src/app/surfaces/settings/SettingsSurface.test.js
src/app/surfaces/settings/SettingsHome.test.js
src/app/surfaces/settings/SettingsTablePolish.test.js
src/app/surfaces/settings/OperationSettings.test.js
src/app/surfaces/settings/PaymentSettings.test.js
src/app/surfaces/settings/PaymentSettings.menuInactive.test.js
src/app/surfaces/settings/CancellationSettings.test.js
src/app/surfaces/settings/CancellationSettings.redesign.test.js
src/app/surfaces/settings/FinanceCategorySettings.test.js
src/app/surfaces/settings/FinanceCategorySettings.redesign.test.js
src/app/surfaces/settings/components/SettingsPrimitives.test.js
src/app/surfaces/settings/components/SettingsConflictReview.test.js
src/app/surfaces/settings/components/SettingsConflictReview.sharedUx.test.js
src/app/surfaces/settings/local/devicePreferences.test.js
src/app/surfaces/settings/local/DevicePreferences.test.js
src/app/surfaces/settings/policies/policyAdapters.test.js
src/app/surfaces/settings/policies/navigation.test.js
src/app/surfaces/settings/printingSettingsAdapter.test.js

src/app/navigation/draftExitGuard.test.js
src/settingsDraftNavigation.test.js
src/navigationContext.test.js
src/app/effectiveBusinessConfig.test.js
src/api/effectiveConfigClient.test.js

src/components/PrintingSettings.test.js
src/components/PrintingSettingsRedesign.test.js
src/components/PrintingConflictRecovery.test.js
```

Also retain broader capability/App regression coverage through the full test run, especially `src/actionCapabilities.test.js`, `src/AppNewOrderGuard.test.js`, and any existing Spec B settings integration tests discovered by `npm test`.

## Expected deletion audit before staging

The following command should return no live source imports and the listed legacy canonical owner files should no longer exist:

```bash
rg "pages/Settings|useBusinessSettingsController|usePrintingSettingsController|settingsDraftGuard|api/settingsClient|app/settingsState|app/settingsConflict|settingsPendingStorage|components/SettingsControls|components/SettingsConflictReview|components/SettingsEditorShell|components/SettingsItemDialog|components/SettingsItemList" src test-support scripts
```

Interpretation rules:

- A match in historical documentation is irrelevant to this command because the scan is scoped to source/test tooling.
- A test description containing a plain-English legacy term is acceptable only if it is not an import/path dependency.
- A live import from one of the deleted paths is a blocker.
- A compatibility facade at an old path is a blocker before staging unless separately approved and ledgered.

## Completion criteria

C3 is implementation-complete only when all of the following are true:

1. Settings UI canonical ownership is `src/app/surfaces/settings/`.
2. Generic versioned edit ownership is `src/app/policy-editing/` and contains no concrete Settings resource/endpoint/presentation knowledge.
3. `src/api/settingsClient.js` is gone; effective-config transport is independent and concrete policy endpoints live in surface adapters.
4. `App.jsx` no longer owns raw Settings resources, Settings conflict state, Settings save/discard/reconcile mechanics, or Settings unload-risk computation.
5. `src/app/navigation/` no longer maps Settings destinations to concrete resource IDs.
6. Provider owns conflict lifecycle and browser abandonment risk; navigation consumes only the narrow bridge.
7. Operations/Modalities shared-draft navigation semantics are preserved.
8. Device preferences remain local and outside versioned policy editing.
9. Printing Settings uses provider-backed versioned policies while QZ/physical/runtime behavior remains untouched.
10. All temporary C3 facades are gone or a separately approved blocker is explicitly ledgered.
11. Focused tests, full tests, architecture, lint, build, Worker dry-runs and D1 gates are green.
12. Exact executable SHA is deployed to staging and manual homologation is recorded truthfully.
13. Production remains untouched.
14. Merge is not performed until the user explicitly authorizes it.
