# Spec C7 Customers Implementation Plan

> **For agentic workers:** implement task-by-task with strict RED → GREEN TDD. Do not start functional code before this plan is explicitly approved.

**Goal:** Establish `src/domains/customers` as the owner of customer identity, duplicate detection, customer CRUD/API, customer list UI and customer edit/create workflow; remove customer CRUD/duplicate orchestration from `App.jsx`; preserve current customer behavior and UI exactly.

**Architecture:** Customers becomes a domain with pure identity rules, a customer-specific API adapter, application commands/controller, and customer UI. Orders may consume only the Customers public entry for duplicate/identity semantics needed by quick customer creation. The app remains the composition layer and may pass public customer commands into Orders, but must not own customer CRUD rules/state after C7.

**Tech stack:** React 19, Vite 8, Node 22 `node:test`, oxlint, Cloudflare Worker/D1, GitHub Actions, existing operational runtime.

**Normative references:**
- `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`
- `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
- `docs/superpowers/qa/spec-c-execution-ledger.md`
- `docs/superpowers/qa/spec-c-compatibility-facades.md`

## Approved base and branch

- C6 PR #50 merged to `master` at `5b101800fe29d02dd4543e184cca9e06d659a445`.
- Final C6 exact-head Validate: #1391 / run `35448041000` — SUCCESS on `d59fe0d804ec77de02fd0f34e1342e3189e35339`.
- Post-merge `master` Validate: #1392 / run `35448223721` — SUCCESS on `5b101800fe29d02dd4543e184cca9e06d659a445`.
- Work branch: `feature/spec-c7-customers`, created directly from that merge SHA.
- Production deployment: **NO** unless separately authorized.

## Current ownership/debt snapshot

At C7 start:

- `src/pages/Clients.jsx` owns the customer list/search/sort/action-sheet UI.
- `src/components/ClientDuplicateModal.jsx` owns the duplicate-name modal UI.
- `shared/clientIdentity.js` owns customer-name/phone normalization, formatting and duplicate detection even though these rules have a clear Customers owner.
- `src/api/client.js` still exports `createClient`, `updateClient`, and `deleteClient`.
- `App.jsx` still owns:
  - customer form state;
  - create/edit modal state;
  - duplicate-dialog state;
  - duplicate validation;
  - create/update/delete handlers;
  - success/error orchestration;
  - direct use of `updateCollection('clients', ...)` after delete;
  - quick-create API orchestration passed into Orders.
- Orders quick-client UI uses the same duplicate semantics and currently imports the shared customer identity helpers directly.
- The compatibility ledger still tracks `updateCollection` for Customers/Catalog cleanup and final C10 enforcement.

## Must preserve

- duplicate phone blocks customer creation/update and shows the existing customer's name;
- duplicate name opens the existing in-app modal with Cancel / Use existing / Register anyway;
- quick customer creation inside New Order preserves the same duplicate semantics;
- "use existing" behavior and search handoff;
- create, update and delete behavior and current success/error feedback;
- customer list search and name sort;
- current mobile/desktop visual behavior;
- offline and `clients.manage` capability guards;
- official runtime/bootstrap collections remain source of truth;
- no backend contract or Worker/D1 behavior change.

## Target file map

```text
src/domains/customers/
  index.js
  domain/
    clientIdentity.js
    clientIdentity.test.js
  infrastructure/
    customersApi.js
    customersApi.test.js
  application/
    useCustomerCommands.js
    useCustomerCommands.test.js
    useCustomerEditor.js
    useCustomerEditor.test.js
  ui/
    Clients.jsx
    Clients.test.js
    ClientDuplicateModal.jsx
    CustomerEditorDialog.jsx
    CustomersWorkspace.jsx
    CustomersWorkspace.test.js

src/app/surfaces/customers/
  CustomersSurface.jsx
  CustomersSurface.test.js
```

Names may be adjusted during RED if the existing composition proves a smaller public surface is safer. Do not create abstractions without a live consumer.

## Global constraints

- No redesign and no intentional UX/business-rule change.
- No backend/Worker migration unless a frontend contract is impossible to preserve without a minimal correction.
- No new official customer store; runtime `clients[]` remains authoritative.
- Domains must not import internals of other domains.
- Orders may import Customers only through `src/domains/customers/index.js`.
- Customers must not import Orders internals.
- Strict RED → GREEN; a parser/configuration failure is not an acceptable RED.
- Every GREEN task gets a normal commit and exact-SHA CI evidence.
- No force-push.
- Keep the draft PR open during execution so `Validate application` runs on task commits.
- Staging only after implementation/architecture tasks are green.
- Production remains untouched.

---

### Task 1 — Establish Customers public boundary and move pure identity rules

**Files**
- Create `src/domains/customers/index.js`
- Create `src/domains/customers/domain/clientIdentity.js`
- Create `src/domains/customers/domain/clientIdentity.test.js`
- Create `src/domains/customers/customersPublicContract.test.js`
- Modify Orders customer/quick-create imports only after RED proves the boundary.

**RED**
- Assert the Customers public entry exposes:
  - `normalizeClientName`
  - `normalizeClientPhone`
  - `formatClientPhone`
  - `findClientDuplicates`
- Characterize accent/case/whitespace name matching, BR country-code normalization, empty phone handling, excluded edit id, duplicate phone and duplicate name selection.
- Assert external production consumers do not need to deep-import the domain module.

Expected RED: Customers modules do not yet exist.

**GREEN**
- Move behavior byte-for-behavior from `shared/clientIdentity.js`.
- Export only live customer identity contracts.
- Migrate App and Orders consumers to the Customers public entry.
- Remove `shared/clientIdentity.js` only when no live consumer remains; do not leave a compatibility reexport unless a real consumer requires it.

**Focused gate**
```bash
node --test src/domains/customers/domain/clientIdentity.test.js src/domains/customers/customersPublicContract.test.js src/clientDuplicateUi.test.js src/quickClientCancel.test.js
npm run test:architecture
```

---

### Task 2 — Add Customers API adapter and command owner

**Files**
- Create `src/domains/customers/infrastructure/customersApi.js`
- Create `src/domains/customers/infrastructure/customersApi.test.js`
- Create `src/domains/customers/application/useCustomerCommands.js`
- Create `src/domains/customers/application/useCustomerCommands.test.js`
- Modify `src/domains/customers/index.js`
- Modify `src/api/client.js`
- Modify App composition only enough to consume the new command owner.

**RED**
- Assert Customers owns POST `/api/clients`, PATCH `/api/clients/:id`, DELETE `/api/clients/:id`.
- Assert App no longer directly imports `createClient/updateClient/deleteClient` from legacy `src/api/client.js`.
- Assert command behavior applies official create/update effects through injected runtime effect application and removes deleted ids through an injected collection updater until that legacy escape hatch is eliminated in a later task.

**GREEN**
- Implement `customersApi` using `infrastructure/api/httpClient.js`.
- Implement customer commands with injected:
  - `applyOfficialEffects`;
  - temporary collection-update callback for delete;
  - feedback/error callbacks if required by current composition.
- Remove `createClient`, `updateClient`, `deleteClient` exports from `src/api/client.js` once all consumers move.
- Do not broaden the generic client compatibility surface.

---

### Task 3 — Move customer list UI into the Customers domain

**Files**
- Move `src/pages/Clients.jsx` → `src/domains/customers/ui/Clients.jsx`
- Move/align list characterization tests under the domain.
- Keep CSS import/cascade stable; do not relocate `src/clients-phonebook.css` yet unless path-only relocation is risk-free.
- Update external consumer to use Customers public entry.

**RED**
- Assert Customers public entry exposes `Clients`.
- Assert legacy `src/pages/Clients.jsx` is no longer the production owner.
- Preserve current action sheet, delete confirmation, search, sort, empty state, capability and offline behavior.

**GREEN**
- Move component with no markup/copy/layout change.
- Keep `ClientDuplicateModal` and App editor ownership untouched until Task 4.

---

### Task 4 — Move duplicate modal and customer editor state out of App

**Files**
- Move `src/components/ClientDuplicateModal.jsx` → `src/domains/customers/ui/ClientDuplicateModal.jsx`
- Create `CustomerEditorDialog.jsx`
- Create `useCustomerEditor.js`
- Create tests.
- Modify `App.jsx`.

**RED**
- Characterize:
  - add opens blank form;
  - edit populates current values;
  - cancel clears edit/duplicate state;
  - duplicate phone blocks and reports existing name;
  - duplicate name opens modal;
  - confirm duplicate continues intended create/update;
  - use existing closes editor and requests search for existing client;
  - current labels/copy/inputMode/autocomplete remain unchanged.
- Assert App no longer owns `newClient`, `editingClientId`, `showClientForm`, `duplicateClientDialog` after GREEN.

**GREEN**
- Move editor/duplicate state and validation to Customers application/UI.
- Preserve `formatClientPhone` behavior and all current labels.
- Keep navigation/search handoff as an explicit callback to the app surface instead of importing navigation internals into Customers.

---

### Task 5 — Create Customers surface and remove CRUD orchestration from App

**Files**
- Create `src/app/surfaces/customers/CustomersSurface.jsx`
- Create surface tests.
- Modify `src/App.jsx`.

**RED**
- Assert App composes `CustomersSurface` rather than owning customer form CRUD/duplicate handlers.
- Assert App has none of:
  - `validateClientIdentity`
  - `persistNewClient`
  - `persistClientUpdate`
  - `handleAddClient`
  - `handleSaveClient`
  - `handleDeleteClient`
  - `handleConfirmDuplicateClient`
  - `handleUseExistingClient`
- Assert current query/search/sort and capability inputs are still wired.

**GREEN**
- Surface composes official `clients[]`, Customers commands/editor and query callbacks.
- App keeps only route/surface composition.
- Preserve success and error feedback through existing feedback runtime.

---

### Task 6 — Remove App-owned quick-create customer CRUD while preserving Orders flow

**Files**
- Modify Customers public application contract.
- Modify `src/domains/orders/ui/NewOrder.jsx` and/or route composition only as required.
- Modify `src/App.jsx`.
- Add focused cross-domain integration tests.

**RED**
- Assert App no longer defines `handleQuickCreateClient`.
- Assert Orders does not call legacy customer API.
- Assert quick create still:
  - blocks duplicate phone;
  - offers existing/continue options for duplicate name;
  - returns the created/existing client to the order flow;
  - keeps its explicit cancel action;
  - respects offline/capability state.

**GREEN**
- Expose a small public Customers quick-create command or Customers command object.
- App passes the public command into Orders as composition only, or Orders consumes the Customers public entry if doing so keeps the dependency one-way and explicit.
- Do not duplicate identity logic in Orders.

---

### Task 7 — Eliminate C7 compatibility debt and tighten architecture rules

**Files**
- Modify `scripts/architecture/check-import-boundaries.mjs`
- Modify `scripts/architecture/check-import-boundaries.test.mjs`
- Modify `scripts/architecture/legacy-import-allowlist.json` only if current entries require C7 cleanup.
- Modify `docs/superpowers/qa/spec-c-compatibility-facades.md`.

**RED**
Add permanent checks that fail while legacy C7 ownership remains:
- external Customers deep imports;
- Customers → Orders internals;
- legacy `src/pages/Clients.jsx`;
- legacy `src/components/ClientDuplicateModal.jsx`;
- customer CRUD exports in `src/api/client.js`;
- customer CRUD/duplicate orchestration tokens in `App.jsx`;
- `shared/clientIdentity.js` if fully migrated;
- App use of `updateCollection('clients', ...)`.

**GREEN**
- Remove the temporary customer use of `updateCollection`.
- For delete, add/consume a generic official-effects mechanism only if the current runtime already supports an appropriate deletion effect; otherwise keep the smallest app-runtime collection callback at the surface boundary and document it for C8/C10 rather than inventing backend behavior.
- Update compatibility ledger accurately; do not mark `updateCollection` globally removed while Catalog still depends on it.
- Keep architecture rules scoped to actual C7 ownership.

---

### Task 8 — Full C7 pre-staging gate and diff audit

Run on the exact candidate SHA:

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
```

Also require existing production/staging Worker dry-runs used by `Validate application`.

Audit:
- no Worker/D1 behavioral diff unless separately justified;
- no printing/QZ ownership change;
- no Finance/Table Service/Orders behavioral change beyond customer public-contract imports/composition;
- no CSS visual redesign;
- no unexplained temporary facade;
- all App customer CRUD/editor/duplicate ownership removed as planned.

---

### Task 9 — Staging homologation

After exact-SHA Validate is green, manually dispatch `Deploy staging` for `feature/spec-c7-customers`.

Record exact SHA/run and execute this matrix:

1. Open Clientes desktop.
2. Search by name.
3. Search by phone.
4. Search by address.
5. Sort Nome A–Z.
6. Sort Nome Z–A.
7. Create a customer with unique name/phone.
8. Edit that customer.
9. Delete a customer with confirmation.
10. Cancel delete confirmation.
11. Try duplicate phone and confirm it is blocked with existing-client feedback.
12. Try duplicate name and cancel.
13. Try duplicate name and use existing.
14. Try duplicate name and register anyway.
15. Validate customer form mobile input/autocomplete behavior.
16. Validate 320–640px customer list wrapping/touch targets.
17. Validate offline write blocking while read/search remains usable.
18. From Novo Pedido, quick-create a unique customer.
19. From Novo Pedido, duplicate phone behavior.
20. From Novo Pedido, duplicate name → use existing.
21. From Novo Pedido, duplicate name → continue registration.
22. Quick-create Cancel clears only quick-customer state.
23. Verify customer changes reconcile into official bootstrap/runtime state.
24. Capability/read-only behavior if a restricted identity exists; otherwise record BLOCKED, not PASS.

No production deployment.

---

### Task 10 — C7 closure and merge handoff

- Create/update `docs/superpowers/qa/spec-c7-customers-qa.md`.
- Reconcile `docs/superpowers/qa/spec-c-execution-ledger.md` with:
  - C6 merged state;
  - C7 base/branch/PR;
  - RED/GREEN evidence;
  - staging SHA/run;
  - manual QA counts;
  - remaining BLOCKED items;
  - facade ledger status.
- Update rollout only if execution evidence materially changes the planned contract.
- Run final exact-HEAD Validate after status-only docs commit.
- Request explicit merge authorization.
- Merge C7 only after authorization and green exact-head validation.
- Run/record post-merge `master` Validate.
- Do not deploy production as part of C7.

## Approval checkpoint

This plan is the required C7 planning checkpoint from the rollout. **Do not begin Task 1 until the user explicitly approves this plan.**
