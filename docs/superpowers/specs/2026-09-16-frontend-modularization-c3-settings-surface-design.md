# Spec C3 — Settings Surface and Versioned Policy Editing Design

**Date:** 2026-09-16
**Branch:** `feature/spec-c3-settings-surface`
**Base:** `master` at `de24b2ceb807440d4c339200b44ae2ed6583b27a`
**Status:** Design approved in brainstorming; implementation not started

## 1. Purpose

C3 turns Settings into an application surface and separates the generic versioned policy-editing engine from the concrete settings UI and resource adapters, while preserving all existing Spec B behavior and the navigation composition introduced by C2.

This is an architectural extraction only. It does not redesign Settings, change copy, change backend contracts, alter capabilities, modify QZ behavior, or introduce new business rules.

The intended end state is:

- `src/app/surfaces/settings/` owns the Settings UI and composition;
- `src/app/policy-editing/` owns the generic versioned edit engine;
- concrete policy adapters temporarily live beside the Settings surface until their real domains are created in later slices;
- local device preferences remain visually inside Settings but outside the versioned policy engine;
- App and Navigation consume only narrow contracts instead of knowing Settings resource internals.

## 2. Rollout alignment

This spec refines the C3 contract in `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`.

C3 is responsible for the Settings surface and generic policy-editing engine only. It must not pre-create `domains/orders`, `domains/finance`, or `domains/printing`; those owners are established by C4, C6, and C9 respectively.

Temporary ownership during C3 is deliberate:

- operation/modalities and cancellation adapters remain under the Settings surface until C4;
- payment-method and finance-category adapters remain under the Settings surface until C6;
- printing policy/station adapters remain under the Settings surface until C9;
- local device preferences remain application/infrastructure concerns.

## 3. Goals

C3 must:

1. make `Settings` a coherent application surface;
2. preserve a generic versioned policy-editing engine independently testable from UI;
3. remove concrete Settings resource knowledge from `App.jsx`;
4. remove Settings resource mapping from `app/navigation`;
5. preserve all Spec B save/cancel/conflict/reconcile/pending/abandonment semantics;
6. preserve the C2 navigation contracts and destination behavior;
7. preserve printing behavior while avoiding premature C9 extraction;
8. preserve current light/dark/mobile visual behavior exactly;
9. eliminate temporary C3 compatibility facades before staging unless a real blocker is recorded in the compatibility ledger.

## 4. Non-goals

C3 does not:

- redesign Settings;
- change texts or labels;
- change Worker/API contracts;
- change D1 schemas or migrations;
- change policy business rules;
- change capabilities or authorization semantics;
- change public routes;
- change polling semantics;
- refactor the QZ transport or print queue;
- create domain folders that belong to C4/C6/C9;
- replace the backend as source of truth;
- introduce Redux, Zustand, React Router, WebSocket/SSE, or new state-management infrastructure.

## 5. Chosen architecture

The approved approach is an **equilibrated extraction**:

```text
src/app/
  policy-editing/
    PolicyEditingProvider.jsx
    usePolicyEditing.js
    policyEditingController.js
    policyEditingState.js
    policyConflict.js
    policyConflictPresentation.js
    policyPendingStorage.js
    policyNavigationGuard.js

  surfaces/
    settings/
      SettingsSurface.jsx
      SettingsHome.jsx
      OperationSettings.jsx
      PaymentSettings.jsx
      CancellationSettings.jsx
      FinanceCategorySettings.jsx

      policies/
        operationsPolicy.js
        paymentMethodsPolicy.js
        cancellationReasonsPolicy.js
        financeCategoriesPolicy.js
        printingPolicy.js

      local/
        DevicePreferences.jsx
        devicePreferences.js
```

Names may be adjusted during the implementation plan if the current code shape justifies a more precise filename, but ownership boundaries must remain unchanged.

### 5.1 `app/policy-editing`

This area is generic. It may know concepts such as:

- resource/policy identifier;
- scope identifier;
- confirmed/base/draft snapshots;
- dirty state;
- optimistic revision;
- mutation ID;
- request payload hash;
- pending mutation storage;
- loading/saving/unconfirmed/conflict/error states;
- conflict construction and presentation data;
- receipt lookup and reconciliation;
- abandonment risk.

It must not know what payment methods, cancellation reasons, operations, finance categories, printing copies, QZ, or specific Settings destinations mean.

### 5.2 `app/surfaces/settings`

This area owns the user-facing Settings experience and knows which concrete policy is shown for each Settings destination. It may know capabilities, routes, editor-specific copy and temporary policy adapters.

The surface must not reimplement the generic revision/conflict/pending algorithms.

## 6. Policy-editing lifecycle

The existing Spec B state machine is preserved semantically:

```text
idle
  -> loading
  -> ready
  -> edit / dirty
  -> saving
       -> confirmed/ready on confirmed success
       -> conflict on 409
       -> unconfirmed on unknown result
       -> error on known failure
```

The engine continues to distinguish:

- `confirmed`: last backend-confirmed value;
- `base`: revision/value on which the current edit is based;
- `draft`: current user edit.

A save continues to:

1. capture the expected revision;
2. generate a mutation ID;
3. hash the submitted payload;
4. persist pending mutation metadata;
5. submit through the policy adapter;
6. treat 409 as conflict;
7. treat network/timeout/ambiguous 5xx outcomes as `unconfirmed` when the result may have reached the backend;
8. reconcile using receipt/current resource before declaring confirmation;
9. preserve later local edits when an earlier submitted mutation is confirmed, exactly as the existing state reducer does.

## 7. Generic transport contract and policy adapters

`src/api/settingsClient.js` must stop being the central concrete resource registry.

The generic engine works against a small adapter/transport contract conceptually equivalent to:

```text
load(context, scope?)
save(context, scope?, { expectedRevision, mutationId, data })
loadReceipt(context, mutationId, scope?)
```

Concrete adapters under `app/surfaces/settings/policies/` temporarily define:

- resource/policy ID;
- supported destinations;
- capabilities required for view/manage;
- endpoint/envelope translation;
- optional scope handling;
- response normalization.

The engine must not switch on concrete resource names.

The following existing resources must remain supported:

- operations;
- payment methods;
- cancellation reasons;
- finance categories;
- printing policy;
- station configuration;
- primary station.

## 8. Provider and public contracts

A `PolicyEditingProvider` lives at application level, above the Settings surface, because navigation and browser-abandonment protection need access to policy state while leaving the page.

The provider owns the generic engine state and the currently active conflict review.

Its full internal API may include operations similar to:

```text
load(policyId, scopeId?)
edit(policyId, draft, scopeId?)
save(policyId, scopeId?)
discard(policyId, scopeId?)
reconcile(policyId, scopeId?)
reviewConflict(policyId, scopeId?)
acceptConflict(...)
dismissConflict(...)
reset()
```

Consumers should receive narrower hooks/contracts where appropriate rather than all internals.

### 8.1 Navigation contract

Navigation must consume only a narrow abstraction such as:

```text
getNavigationDraft(destination)
discardNavigationDraft(resourceKey)
hasUnloadRisk
```

The route-to-policy mapping belongs on the Settings/policy side, not in `app/navigation`.

The existing distinction is preserved:

- internal navigation confirmation applies when a relevant draft is dirty and the user is leaving that resource;
- `saving` and `unconfirmed` are not converted into ordinary internal dirty-exit prompts;
- browser reload/close protection still treats dirty, saving, and unconfirmed resources as abandonment risk;
- moving between `settings-operations` and `settings-modalities`, which share the same operations resource, remains prompt-free.

### 8.2 Effective business config contract

`useEffectiveBusinessConfig` remains owned by the application for C3.

The policy-editing provider must not become owner of effective config. After a policy mutation is actually confirmed, it emits a generic application event/callback conceptually equivalent to:

```text
onPolicyCommitted({ policyId, resourceKey })
```

The application uses this only as a signal to refresh the backend-authoritative effective config. The policy engine does not apply business rules itself.

### 8.3 Conflict review contract

The provider owns `activeConflict` and conflict actions. `SettingsSurface` renders the current conflict-review UI.

`App.jsx` must no longer own Settings-specific conflict state or render the Settings conflict modal directly.

## 9. Settings surface ownership

The following visual modules move into `src/app/surfaces/settings/` during C3:

- Settings root/composition;
- Settings home;
- operations/modalities editor;
- payment-method editor;
- cancellation-reason editor;
- finance-category editor;
- controls/components exclusive to the Settings surface;
- their UI-focused tests.

Shared UI primitives remain in shared/component locations when they are genuinely reused outside Settings.

`SettingsSurface` becomes the internal surface resolver for:

```text
settings-home
settings-operations
settings-modalities
settings-payments
settings-cancellations
settings-finance-categories
settings-printing
settings-device
```

It does not own a second versioned data store. It consumes policy state/actions from the provider.

## 10. Local device preferences

Theme, kitchen sound, and other local-device-only Settings remain visible in the Settings surface but stay outside the versioned policy engine.

Their flow is intentionally simple:

```text
UI -> local adapter/controller -> localStorage/browser state -> visual feedback
```

They do not use revision, mutation ID, pending receipt, conflict review, or reconciliation.

This separation prevents the policy engine from modeling local preferences as if they were backend-versioned business settings.

## 11. Printing boundary

Printing is the most sensitive C3 seam because the current Settings content combines:

1. versioned business printing policy;
2. versioned station configuration / primary station;
3. local QZ printer discovery, selection, health and test-print operations.

C3 must not perform the C9 printing-domain extraction.

Instead, C3 introduces/preserves a Settings-side printing adapter that presents the contract currently expected by the printing Settings UI while sourcing versioned pieces through `PolicyEditingProvider` and leaving local/physical operations on the existing printing runtime.

Conceptually the compatibility contract continues to provide:

```text
policyState()
stationState()
primaryState()

load/reload policy and station
edit/save/discard/reconcile policy
edit/save/discard/reconcile station
review conflicts
make primary

local printer discovery/selection/test operations
```

`PrintingSettingsContent` should remain behaviorally and visually unchanged unless a mechanical import/prop adjustment is necessary for ownership.

No QZ security, signing, queue, retry, second-copy, physical-health, or primary-station business rule is changed in C3.

## 12. App boundary after C3

At C3 completion, `App.jsx` should treat Settings as one application surface and should not know:

- the internal `businessSettings.resources` map;
- concrete policy resource names for navigation;
- Settings conflict-review state;
- individual settings save/discard/reconcile mechanics;
- the mapping from Settings destinations to policy resources.

The App may still provide legitimate application dependencies such as:

- granted capabilities;
- navigation destination;
- global feedback/session callbacks;
- effective-config refresh callback;
- printing runtime needed for local physical actions;
- kitchen sound preference and setter;
- other shared app context already owned outside Settings.

## 13. Navigation boundary after C3

`src/app/navigation/` remains responsible for deciding navigation behavior, but it must not embed knowledge that `settings-payments` maps to `paymentMethods`, or equivalent Settings details.

The current Settings-specific resource mapping moves to the Settings/policy side. Navigation receives functions/data through an injected contract.

This preserves C2's architecture: Navigation controls transitions; Settings controls the meaning of its own drafts.

## 14. Compatibility and migration strategy

The implementation may use temporary reexports/facades within intermediate commits so that each TDD step remains reviewable and green.

Before staging:

- old canonical owners must no longer be required by application imports;
- C3-created temporary facades must be removed;
- any facade that cannot be removed due to a demonstrated blocker must be recorded explicitly in `docs/superpowers/qa/spec-c-compatibility-facades.md` with rationale and removal slice.

Expected legacy paths to be relocated or retired include the equivalents of:

```text
src/pages/Settings.jsx
src/pages/SettingsHome.jsx
src/pages/OperationSettings.jsx
src/pages/PaymentSettings.jsx
src/pages/CancellationSettings.jsx
src/pages/FinanceCategorySettings.jsx

src/app/useBusinessSettingsController.js
src/app/settingsState.js
src/app/settingsConflict.js
src/app/settingsConflictPresentation.js
src/app/settingsPendingStorage.js
src/app/usePrintingSettingsController.js
src/api/settingsClient.js
```

The exact implementation plan must verify every import before deleting any path.

## 15. Error and context behavior to preserve

C3 must preserve the current behavior for:

- initial load failure and retry;
- read-only capability paths;
- save failure with known result;
- 401/session-expiration reset behavior;
- stale load/write ownership guards;
- context/generation changes;
- 409 conflict review;
- acceptance of conflict review without losing intended edits;
- unknown save result -> `unconfirmed`;
- receipt-based reconciliation;
- current-resource reconciliation fallback;
- pending mutation recovery after reload;
- expiration/cleanup of stale pending metadata;
- discard restrictions during saving/unconfirmed states;
- preserving a newer local draft when an older submitted save becomes confirmed.

## 16. TDD and test strategy

All behavioral changes or newly exposed architectural boundaries use strict TDD: RED test first, minimal GREEN implementation, then refactor while green.

Characterization tests are required before risky extraction where the current behavior is not already isolated.

Coverage must include four levels.

### 16.1 Generic engine

Test:

- state transitions;
- confirmed/base/draft semantics;
- dirty detection;
- expected revision;
- mutation ID and submitted payload identity;
- pending storage;
- 409 conflict;
- unknown result/unconfirmed;
- reconcile success/failure;
- later-draft preservation;
- context reset/stale owner protection.

### 16.2 Provider/contracts

Test:

- load/edit/save/discard delegation;
- active conflict ownership;
- conflict accept/dismiss flow;
- `onPolicyCommitted` only after confirmed mutation;
- navigation draft lookup;
- same-resource destination behavior;
- unload risk for dirty/saving/unconfirmed;
- reset on Settings context change/session change.

### 16.3 Adapters/surface

Test:

- destination -> correct temporary policy adapter;
- capabilities/read-only behavior;
- load/save/cancel/retry actions;
- Settings home visibility rules;
- operations/modalities shared resource behavior;
- printing adapter compatibility;
- local-device preference isolation.

### 16.4 Integration/regression

Preserve and rerun relevant tests for:

- C2 navigation guards;
- App composition contracts;
- effective business config refresh;
- printing Settings;
- Spec B settings state/conflict/pending/reconcile behavior;
- theme/light/dark and mobile rendering contracts where currently covered.

## 17. Homologation in staging

Staging homologation must cover at least:

- Settings home;
- Operations;
- Modalities;
- Payment methods;
- Cancellation reasons;
- Finance categories;
- Printing policy;
- Station configuration and primary station;
- local printer controls relevant to Settings;
- Device preferences;
- save and cancel;
- reload after save;
- load error/retry when reproducible;
- conflict review when reproducible;
- unconfirmed/reconciliation when reproducible;
- dirty navigation prompt;
- prompt-free Operations <-> Modalities navigation;
- saving/unconfirmed abandonment semantics;
- browser reload/close guard;
- effective config refresh after confirmed save;
- context/session change without state leakage;
- desktop/mobile;
- light/dark themes.

As with C2, scenarios that cannot be truthfully observed in staging are recorded as BLOCKED rather than converted to PASS from automated evidence alone.

No production deployment is part of C3 homologation.

## 18. Gates before merge readiness

Before C3 can be proposed for merge:

- focused TDD tests are green;
- relevant regression tests are green;
- `npm test` is green;
- `npm run lint` is green;
- `npm run test:architecture` is green;
- `npm run build` is green;
- production and staging Worker dry-runs are green through the normal Validate pipeline;
- `npm run d1:migrate:local` is green;
- Spec B D1 clean-install/upgrade gates are green;
- diff review confirms no accidental business/visual/backend changes;
- exact executable SHA is deployed to staging;
- proportional manual homologation is recorded;
- compatibility ledger is updated only if a facade legitimately survives;
- production remains untouched without separate explicit authorization.

## 19. Acceptance criteria

C3 is architecturally complete when all of the following are true:

1. Settings UI is owned by `app/surfaces/settings`.
2. Versioned editing mechanics are owned by `app/policy-editing` and are independently testable without Settings UI imports.
3. The engine has no switches/imports for concrete Settings business resources.
4. `App.jsx` no longer owns Settings conflict state or inspects the settings resource map.
5. `app/navigation` no longer maps Settings destinations to concrete settings resources.
6. Navigation still preserves dirty-draft and same-resource behavior from C2.
7. `beforeunload` risk still includes dirty, saving, and unconfirmed policy state.
8. Effective config remains backend-authoritative and refreshes after confirmed policy writes.
9. Local device preferences remain outside the versioned policy engine.
10. Printing Settings preserve current behavior without moving QZ/domain ownership early.
11. Existing Spec B behavior and current visual UX remain unchanged.
12. Temporary C3 facades are gone before staging unless a blocker is explicitly ledgered.
13. Full validation gates and staging homologation pass to the extent observable, with BLOCKED scenarios recorded honestly.
14. No production deployment occurs without a separate explicit authorization.

## 20. Implementation discipline

The detailed implementation plan must be written from this exact post-C2 base and must decompose extraction into small TDD tasks. It must not start implementation before this design document receives final user review approval.
