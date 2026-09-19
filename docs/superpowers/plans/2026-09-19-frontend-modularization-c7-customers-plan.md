# Spec C7 Customers Implementation Plan

> **STATUS: STAGING HOMOLOGATED — Tasks 1–9 COMPLETE; Task 10 closure/merge handoff active. Design and plan approved 2026-09-19.**
>
> Normative design: `docs/superpowers/specs/2026-09-19-frontend-modularization-c7-customers-design.md`
>
> Tasks 1–9 are complete. Staging homologation closed at 29 PASS / 0 FAIL / 1 BLOCKED. Task 10 is preparing the final exact-head merge gate; no merge occurs without explicit authorization.

**Goal:** Establish `src/domains/customers` as the frontend owner of customer duplicate rules, CRUD/API, customer list/editor UI and customer commands; remove customer CRUD/editor/duplicate orchestration from `App.jsx`; preserve quick-create integration with Orders without allowing Orders to own Customers infrastructure.

**Architecture:** Customers is a single domain. Shared cross-runtime phone primitives remain in `shared/clientIdentity.js` because the Worker consumes them. Frontend-only name normalization and duplicate lookup move to Customers. Customers exposes a deliberate public entry, including the customer-specific duplicate modal because Orders is a real external consumer. Customer mutations use `customersApi` + application commands and official runtime effects. Delete is represented by `deletedClientId`, not `updateCollection('clients', ...)` and not a callback bridge.

**Tech stack:** React 19, Vite 8, Node 22 `node:test`, oxlint, Cloudflare Worker/D1, GitHub Actions, existing operational runtime.

## Normative references

- `docs/superpowers/specs/2026-09-19-frontend-modularization-c7-customers-design.md` — **APPROVED**
- `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`
- `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
- `docs/superpowers/qa/spec-c-execution-ledger.md`
- `docs/superpowers/qa/spec-c-compatibility-facades.md`

## Approved base and branch

- C6 PR #50 merged to `master` at `5b101800fe29d02dd4543e184cca9e06d659a445`.
- Final C6 exact-head Validate: #1391 / run `35448041000` — SUCCESS.
- Post-merge `master` Validate: #1392 / run `35448223721` — SUCCESS.
- Work branch: `feature/spec-c7-customers`.
- C7 design approval commit: `ba8ffe3f196332334b8d9d0c6d8a352fe7ae0248`.
- Functional implementation: **Tasks 1–9 COMPLETE; STAGING HOMOLOGATED; Task 10 closure active**.
- Production deployment: **NO** unless separately authorized.

## Task 1 evidence

- Draft PR: #51 — `Spec C7: Customers domain extraction`.
- RED commit: `6202678292c36deb7f76f9ed48478458af33c7cd`.
- RED Validate: #1394 / run `35450264188` — **FAIL as intended** at Test with exactly two C7 missing-boundary failures:
  - missing `src/domains/customers/index.js`;
  - missing `src/domains/customers/domain/clientDuplicates.js`.
- RED failure class: `ERR_MODULE_NOT_FOUND`; no parser/test-harness defect.
- GREEN commit: `7c3a9842be653dec619263b595cd4b54003a3bcc`.
- GREEN Validate: #1395 / run `35450437897` — **SUCCESS**.
- GREEN suite: **1,774 tests / 1,773 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, production Worker dry-run, staging Worker dry-run, local D1 and Spec B D1: **all green**.
- Delivered boundary:
  - Customers now owns frontend `normalizeClientName` + `findClientDuplicates`;
  - App and Orders consume duplicate rules via `src/domains/customers/index.js`;
  - `shared/clientIdentity.js` retains only the cross-runtime phone primitives used by the Worker;
  - no Worker/schema/API behavior changed.
- Task 2: **NOT STARTED**.

## Task 2 evidence

- RED commit: `d83abfcd8f88ef3e620a9519b77ac52eb184a6c0`.
- RED Validate: #1398 / run `35450909294` — **FAIL as intended**, **1,778 tests / 1,773 pass / 4 fail / 1 skipped**.
- RED failures were limited to the intended Task 2 debt:
  - missing `customersApi.js`;
  - missing `useCustomerCommands.js`;
  - legacy customer CRUD exports/App collection ownership still present;
  - runtime did not yet apply/protect `deletedClientId`.
- GREEN candidate: `048d2c0048f6a54d4a4d2620f2ba655216573907`.
- Candidate Validate: #1399 / run `35451130365` — implementation tests passed; one stale characterization remained in `confirmationFlowRegression.test.js`, which still expected client deletion success feedback inside `App.jsx`.
- Test-ownership alignment: `7431745d6ff817b76126dc7da090b270ccf57268` moved that assertion to `useCustomerCommands.js` without changing production behavior.
- Final GREEN Validate: #1400 / run `35451281055` — **SUCCESS**, **1,779 tests / 1,778 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, production Worker dry-run, staging Worker dry-run, local D1 and Spec B D1: **all green**.
- Delivered ownership:
  - customer POST/PATCH/DELETE now belong to `domains/customers/infrastructure/customersApi.js`;
  - `useCustomerCommands` owns create/quick-create/update/delete request keys, official effects and success/error routing;
  - `src/api/client.js` no longer exports customer CRUD;
  - delete applies `{ deletedClientId }` through `applyOfficialEffects`, and the runtime marks/protects/removes the client from the official collection;
  - App no longer directly calls customer APIs or `updateCollection('clients', ...)`;
  - no Worker/schema/API contract changed.
- Task 3: **NOT STARTED**.

## Task 3 evidence

- RED commit: `e2f1e7c07abb935697da5c76c97ee40e56d11456`.
- RED Validate: #1402 / run `35451679029` — **FAIL as intended**, with 5 Task 3 failures:
  - missing `clientList.js`;
  - `Clients` absent from Customers public entry;
  - legacy `src/pages/Clients.jsx` still present;
  - moved UI path absent;
  - App still owned the inline list projection.
- GREEN production candidate: `3865590fea1552d28279c30b84513c770663db66`.
- Candidate Validate #1403 exposed only stale tests that still loaded `/src/pages/Clients.jsx`, plus an over-literal Task 3 contract that rejected the local variable name `filteredClients` even though the filtering logic had moved.
- Test/path alignment: `f86201b4cb032d7740e9ecc080fbad3e9d40f9d3`; Validate #1404 reduced the remaining failure to one dynamically generated legacy Clients path inside `actionCapabilities.test.js`.
- Final test-path alignment: `36cbdbd325a1614fb95b2bb3b80de8f3f51589bc`.
- Final GREEN Validate: #1405 / run `35452215359` — **SUCCESS**, **1,785 tests / 1,784 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, production Worker dry-run, staging Worker dry-run, local D1 and Spec B D1: **all green**.
- Delivered ownership:
  - `filterAndSortClients` now belongs to `domains/customers/domain/clientList.js`;
  - App delegates the existing search/sort semantics to that domain projection;
  - `Clients.jsx` moved from `src/pages` to `src/domains/customers/ui`;
  - Customers exports `Clients` through a Node-safe `customerSurfaces.js` wrapper;
  - legacy `src/pages/Clients.jsx` is removed;
  - phonebook/action-sheet/delete-confirmation markup and current CSS file location remain unchanged.
- Task 4: **COMPLETE / GREEN**.

## Task 4 evidence

- RED commit: `4dc6cc388c88314f036635ad9f1de49660a9421c`.
- RED Validate: #1408 / run `35452912084` — **FAIL as intended** at Test with 3 Task 4 boundary failures: missing `useCustomerEditor.js`, missing `CustomerEditorDialog.jsx`, and the Customers public UI/moved duplicate-modal contract not yet present.
- GREEN candidate: `88b9294769e3be1009439c5fe97c58dfa153fc46`; Validate #1409 exposed a real session-cleanup regression because `clearBusinessData` still called removed editor setters, plus source-characterization tests that still pointed at the old owner.
- Final fix/alignment: `9ede1b45a1748a48c155162e1db99253083eb819`.
- Final GREEN Validate: #1410 / run `35453407335` — **SUCCESS**, **1,792 tests / 1,791 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, production Worker dry-run, staging Worker dry-run, local D1 and Spec B D1: **all green**.
- Delivered ownership:
  - `useCustomerEditor` owns editor state, payload rules and duplicate flow;
  - `CustomerEditorDialog.jsx` owns the editor UI with unchanged labels/input semantics/phone formatting;
  - `ClientDuplicateModal.jsx` moved under Customers and is public because Orders is a real consumer;
  - App no longer owns `newClient`, `editingClientId`, `showClientForm` or `duplicateClientDialog`;
  - Orders imports the duplicate modal only through `domains/customers/index.js`.
- Task 5: **COMPLETE / GREEN**.

## Task 5 evidence

- RED commit: `09b75fca20173c4ecccdbab0dd04fd7b22336caf`.
- RED Validate: #1411 / run `35453671174` — **FAIL as intended** with exactly 2 Task 5 failures: missing `CustomersWorkspace` and list projection still owned by App.
- GREEN commit: `e483b95dcc69aa9c18f5ff6d15d73f7851c44e0b`.
- GREEN Validate: #1412 / run `35453918508` — **SUCCESS**, **1,795 tests / 1,794 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, production Worker dry-run, staging Worker dry-run, local D1 and Spec B D1: **all green**.
- Delivered ownership:
  - public `CustomersWorkspace` composes Clients + editor + duplicate modal + customer commands;
  - filter/sort projection, delete coordination and transient customer UI state no longer belong to App;
  - App retains capability derivation, navigation query state and injected runtime/feedback dependencies;
  - editor/duplicate state now disappears naturally when the Customers workspace unmounts across session transitions; no customer reset bridge survives.
- Task 6: **COMPLETE / GREEN**.

## Task 6 evidence

- Initial RED commits: `c0374e71d2039d2effbfc1fcb084f0a0f9fda7ec` and `666ea1e3f20af47dd4562454b86cac17d5a94609`; Validate #1414 / run `35454118807` exposed the intended missing quick-create boundary plus one invalid test assumption about the current Orders selection setter.
- Test-characterization alignment: `7c940bf2f7687cbe129a7d75d7e64a104c202278`.
- Authoritative RED Validate: #1415 / run `35454263216` — **FAIL as intended**, **1,799 tests / 1,795 pass / 3 fail / 1 skipped**, limited to missing public quick-create command and App-owned quick-create orchestration.
- GREEN commit: `07206c58a967970def07654851a919d0ff2aa99c`.
- GREEN Validate: #1416 / run `35454440071` — **SUCCESS**, **1,800 tests / 1,799 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, production Worker dry-run, staging Worker dry-run, local D1 and Spec B D1: **all green**.
- Delivered ownership:
  - `useQuickCreateCustomerCommand` is a minimal Customers public mutation contract;
  - App no longer defines `handleQuickCreateClient` or consumes `useCustomerCommands` for this flow;
  - quick-create preserves `name.trim()`, `phone || ''`, `address: ''` and request key `client:create:quick`;
  - Orders keeps duplicate UI/rules through the Customers public entry and owns no Customers HTTP/infrastructure.
- Task 7: **COMPLETE / GREEN**.

## Task 7 evidence

- Initial RED commit: `35205baeccaaced0dd1b759a34f087c2ddb3e61a`; Validate #1417 / run `35456538694` failed on the seven new architecture protections.
- RED path alignment: `86c43cc1de46652a684a998473f53bed6c07df58` corrected the cross-runtime contract path to root-level `shared/clientIdentity.js`.
- Authoritative RED Validate: #1418 / run `35456631629` — **FAIL as intended**, **1,807 tests / 1,799 pass / 7 fail / 1 skipped**, exactly on:
  - external Customers deep imports;
  - Customers ↔ Orders internal imports;
  - legacy Customers UI/API owners;
  - customer ownership returning to App;
  - `updateCollection('clients', ...)` in App/Customers;
  - frontend duplicate/name rules returning to `shared/clientIdentity.js`;
  - domain-layer imports of infrastructure.
- GREEN commit: `6402496c078ca817572e6e375beec9f4ffbe557a`.
- GREEN Validate: #1419 / run `35456801774` — **SUCCESS**, **1,807 tests / 1,806 pass / 0 fail / 1 skipped**.
- Architecture, lint, build, production Worker dry-run, staging Worker dry-run, local D1 and Spec B D1: **all green**.
- No architecture allowlist expansion was introduced.
- Permanent C7 enforcement now rejects all seven regression classes above.
- Compatibility result:
  - Customers use of `updateCollection` is removed and architecture-enforced;
  - Catalog/product use remains C8 debt;
  - generic/auth legacy API reexports remain C10 debt;
  - root `shared/clientIdentity.js` is a permanent cross-runtime phone contract, not a compatibility facade.
- Task 8: **COMPLETE / GREEN**.

## Task 8 evidence

- Exact candidate SHA: `6402496c078ca817572e6e375beec9f4ffbe557a`.
- Validate #1419 / run `35456801774` serves as the exact-SHA full pre-staging gate and is **SUCCESS**.
- Full gate: **1,807 tests / 1,806 pass / 0 fail / 1 skipped**, architecture, lint, build, production/staging Worker dry-runs, local D1 and Spec B D1 all green.
- Diff audit against C7 base `5b101800fe29d02dd4543e184cca9e06d659a445`:
  - no Worker functional files changed;
  - no schema or migration files changed;
  - no Finance or Table Service functional files changed;
  - Orders production change is limited to consuming `findClientDuplicates` + `ClientDuplicateModal` from the Customers public entry;
  - no customer visual redesign and no CSS file changes;
  - no new compatibility facade or architecture allowlist entry;
  - App contains no customer editor/list/CRUD/duplicate business ownership.
- Staging deployment: **COMPLETE / SUCCESS** at homologated SHA `c01d90c6ea3a286a601f8efea51ec5ee28ff52d3`; Deploy staging #185 / run `35457821403`.
- Staging Worker version: `c404e7b9-d32d-4faa-baaf-21e2f0e4f52d`; readiness attempt 1/6; real login smoke HTTP 200; no remote migrations pending.
- Manual homologation: **29 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**. Item 30 is BLOCKED because staging has no suitable restricted/read-only identity; automated capability coverage remains green.
- Task 9: **COMPLETE / HOMOLOGATED**.
- Task 10: **CLOSURE ACTIVE — QA/docs + final exact-head Validate + explicit merge authorization**.

## Current ownership/debt snapshot

At C7 start:

- `src/pages/Clients.jsx` owns customer list/action-sheet UI.
- `src/components/ClientDuplicateModal.jsx` is shared by App and Orders.
- `shared/clientIdentity.js` mixes true cross-runtime phone primitives with frontend-only duplicate/name logic.
- `src/api/client.js` exports `createClient`, `updateClient`, `deleteClient`.
- `App.jsx` owns customer editor state, duplicate flow, create/update/delete handlers and quick-create API orchestration.
- `App.jsx` directly calls `updateCollection('clients', ...)` on delete.
- Orders imports `findClientDuplicates` from shared and imports the legacy duplicate modal path.
- Query state belongs to navigation/composition, but the customer filter/sort projection is still in App.

## Behavior that must not change

- duplicate phone blocks create/update; own phone is allowed during edit;
- duplicate name opens Cancel / Use existing / Register anyway modal;
- editor and quick-create keep their **different** phone-duplicate feedback channels;
- editor normal payload keeps blank address as `Sem endereço`;
- quick-create keeps `address: ''`;
- normal editor keeps `name.trim()`;
- quick-create keeps current name/phone behavior;
- "use existing" in Clientes closes editor and searches by existing name;
- "use existing" in quick-create selects existing client and closes quick-create;
- current request keys remain:
  - `client:create`
  - `client:create:quick`
  - `client:update:<id>`
  - `client:delete:<id>`
- those request keys continue participating in global write blocking;
- list search/sort and mobile/desktop UI remain visually equivalent;
- current delete action-sheet closure semantics remain unchanged;
- `clients.manage` and offline guards remain unchanged;
- Worker/schema/routes remain unchanged.

## Target structure

```text
src/domains/customers/
  index.js
  customersPublicContract.test.js
  domain/
    clientDuplicates.js
    clientDuplicates.test.js
    clientList.js
    clientList.test.js
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
    ClientDuplicateModal.jsx
    CustomerEditorDialog.jsx
    CustomersWorkspace.jsx
    customerSurfaces.js
```

`customerSurfaces.js` is the Node-safe public UI wrapper if direct JSX exports are incompatible with the Node test harness, following the existing Orders/Table Service/Finance pattern.

Do **not** create `app/surfaces/customers` unless execution proves a real cross-domain composition need.

## Execution setup before Task 1

Before any functional RED:

```bash
git fetch origin
git switch feature/spec-c7-customers
git status --short
git rev-parse HEAD
git rev-parse origin/master
git merge-base HEAD origin/master
```

Required state:

- working tree clean in the execution environment used;
- branch is `feature/spec-c7-customers`;
- `origin/master` remains `5b101800fe29d02dd4543e184cca9e06d659a445` unless GitHub proves an intentional later master change that must be reconciled first;
- merge-base is the approved C7 base;
- branch contains only C7 documentation/planning commits beyond that base before Task 1.

Before pushing the authoritative Task 1 RED:

- open a **draft PR** `feature/spec-c7-customers -> master` if one does not exist;
- state in the PR body that it exists early for exact-SHA TDD runner evidence;
- do not mark ready/merge before staging, QA, final exact-head Validate and explicit merge authorization.

If a trustworthy local worktree exists, baseline:

```bash
npm test
npm run test:architecture
npm run lint
npm run build
```

If local execution is unavailable/untrustworthy, use the green post-C6 master Validate #1392 as base evidence and future exact-SHA GitHub runs; never invent local PASS.

---

## Global execution rules

- Strict TDD RED → GREEN.
- RED must fail for the intended missing boundary/behavior, not parser/config reasons.
- Each authoritative RED and GREEN gets a normal commit; no force-push.
- Exact-SHA GitHub Validate evidence is required for each completed implementation task.
- Open/retain a draft PR before the first functional RED so PR-triggered validation runs on every task SHA.
- No staging until Tasks 1–7 and the full pre-staging gate are green.
- No production deploy.
- No Worker/schema/migration change is expected or approved.

---

## Task 1 — Establish Customers public boundary and frontend duplicate rules — COMPLETE / GREEN

**Files**
- Create `src/domains/customers/index.js`
- Create `src/domains/customers/domain/clientDuplicates.js`
- Create `src/domains/customers/domain/clientDuplicates.test.js`
- Create `src/domains/customers/customersPublicContract.test.js`
- Modify `shared/clientIdentity.js`
- Modify `shared/clientIdentity.test.js`
- Modify App/Orders imports only enough to consume the new public duplicate contract.

### RED

Write tests proving:

- Customers public entry exposes `normalizeClientName` and `findClientDuplicates`;
- name normalization preserves trim, repeated-space collapse, case-insensitive and accent-insensitive semantics;
- duplicate lookup distinguishes duplicate name and phone;
- duplicate lookup excludes the edited client id;
- phone matching uses `normalizeClientPhone` from the shared cross-runtime contract;
- `shared/clientIdentity.js` remains responsible for `normalizeClientPhone` and `formatClientPhone`;
- external production consumers do not deep-import Customers domain internals.

Expected RED: Customers domain/public entry does not yet exist.

### GREEN

- Move `normalizeClientName` and `findClientDuplicates` to Customers.
- Keep `normalizeClientPhone` and `formatClientPhone` in `shared/clientIdentity.js` because Worker imports them.
- Migrate App and Orders duplicate-rule imports through `src/domains/customers/index.js`.
- Do not touch Worker imports or backend behavior.

### Focused gate

```bash
node --test   src/domains/customers/domain/clientDuplicates.test.js   src/domains/customers/customersPublicContract.test.js   shared/clientIdentity.test.js   src/clientDuplicateUi.test.js   src/quickClientCancel.test.js \
  worker/clientUniqueness.test.js
npm run test:architecture
```

---

## Task 2 — Move Customers API/commands and add official delete effect — COMPLETE / GREEN

**Files**
- Create `src/domains/customers/infrastructure/customersApi.js`
- Create `src/domains/customers/infrastructure/customersApi.test.js`
- Create `src/domains/customers/application/useCustomerCommands.js`
- Create `src/domains/customers/application/useCustomerCommands.test.js`
- Modify `src/app/runtime/data/useOperationalDataRuntime.js`
- Modify runtime tests
- Modify `src/api/client.js`
- Modify `src/domains/customers/index.js`
- Modify `App.jsx` only enough to consume commands.

### RED

Prove:

- Customers owns:
  - POST `/api/clients`
  - PATCH `/api/clients/:id`
  - DELETE `/api/clients/:id`
- commands preserve the exact request keys:
  - create;
  - quick create;
  - update id;
  - delete id;
- commands refuse writes without capability/offline or while `writesBlocked`;
- create/update apply `{ client }` through `applyOfficialEffects`;
- delete applies `{ deletedClientId: id }`;
- runtime recognizes `deletedClientId`, marks `clients` mutated and removes the id;
- App no longer needs `updateCollection('clients', ...)`;
- legacy customer CRUD exports are absent from `src/api/client.js`.

Expected RED: new API/commands/effect do not exist and legacy exports/use remain.

### GREEN

- Implement `customersApi` using `httpClient.js`.
- Implement `useCustomerCommands` with injected:
  - `applyOfficialEffects`;
  - `writesBlocked`;
  - `canManageClients`;
  - `setRequestKey`;
  - `onSuccess`;
  - `onError`.
- Preserve global request-key semantics; do not replace with domain-only pending.
- Extend `applyOfficialEffects` with `deletedClientId` following the existing `deletedMovementId` pattern.
- Remove customer CRUD exports from legacy `src/api/client.js`.
- No customer-specific runtime callback bridge.

### Focused gate

```bash
node --test   src/domains/customers/infrastructure/customersApi.test.js   src/domains/customers/application/useCustomerCommands.test.js   src/app/runtime/data/useOperationalDataRuntime.test.js
npm run test:architecture
```

---

## Task 3 — Move Clients UI and customer list projection — COMPLETE / GREEN

**Files**
- Create `src/domains/customers/domain/clientList.js`
- Create `src/domains/customers/domain/clientList.test.js`
- Move `src/pages/Clients.jsx` → `src/domains/customers/ui/Clients.jsx`
- Move/align relevant list tests.
- Modify Customers public UI wrapper/index.
- Modify App consumer.
- Keep `src/clients-phonebook.css` in place unless import-only relocation is proven safe.

### RED

Prove:

- `filterAndSortClients` or equivalent belongs to Customers;
- search matches name, phone and address;
- search trim/case behavior matches current App;
- sort `name-asc` / `name-desc` preserves current `localeCompare` semantics;
- Customers public entry exposes Clients through a Node-safe UI export;
- legacy `src/pages/Clients.jsx` is not the production owner;
- current action sheet, delete confirmation, empty state, offline and capability behavior are characterized.

### GREEN

- Move the list UI with no copy/markup/design change.
- Move filter/sort projection out of App.
- Keep query state in navigation/composition and pass `search`/`sort` + callbacks into Customers.
- Preserve action sheet behavior, including closure after delete callback completion.

---

## Task 4 — Move customer editor and make duplicate modal a public Customers UI contract — COMPLETE / GREEN

**Files**
- Move `src/components/ClientDuplicateModal.jsx` → `src/domains/customers/ui/ClientDuplicateModal.jsx`
- Create `CustomerEditorDialog.jsx`
- Create `useCustomerEditor.js`
- Add tests.
- Modify Customers public wrapper/index.
- Modify `App.jsx`.
- Modify Orders duplicate-modal import to Customers public entry.

### RED

Characterize:

- new editor opens blank;
- edit preloads name/phone/address;
- cancel clears editor + duplicate state;
- normal editor:
  - `name.trim()`;
  - blank phone → `''`;
  - blank address → `Sem endereço`;
- duplicate phone uses global feedback `Telefone já cadastrado para <nome>.`;
- duplicate name opens public Customers modal;
- confirm duplicate continues the original create/update;
- "use existing" in Clientes:
  - closes duplicate dialog/editor;
  - requests customer search = existing name;
- current labels, placeholders, input types, inputMode and autocomplete remain identical;
- App no longer owns `newClient`, `editingClientId`, `showClientForm`, `duplicateClientDialog`;
- Orders imports `ClientDuplicateModal` only from Customers public entry.

### GREEN

- Move editor state/validation to Customers.
- Publicly export the duplicate modal because Orders is a real external consumer.
- Use a Node-safe public wrapper where required by test harness.
- Preserve phone typing formatter behavior and all current copy.

---

## Task 5 — Compose CustomersWorkspace and finish App customer ownership removal — COMPLETE / GREEN

**Files**
- Create `src/domains/customers/ui/CustomersWorkspace.jsx`
- Create tests.
- Modify Customers public wrapper/index.
- Modify `src/App.jsx`.

### RED

Assert App no longer owns:

- `validateClientIdentity`
- `resetClientForm`
- `openNewClient`
- `handleEditClient`
- `clientPayload`
- `persistNewClient`
- `persistClientUpdate`
- `handleAddClient`
- `handleSaveClient`
- `handleUseExistingClient`
- `handleConfirmDuplicateClient`
- `handleDeleteClient`
- `handleCancelClientEdit`
- inline customer editor/modal markup
- customer list filter/sort projection.

Also prove:

- App still derives `canManageClients`;
- App still owns navigation query state;
- feedback/runtime dependencies are injected;
- logout/session transition cannot preserve editor/duplicate state across sessions.

### GREEN

- App renders public `CustomersWorkspace`.
- Workspace composes Clients + editor + duplicate modal + commands.
- Customers owns its transient UI state.
- Prefer natural unmount/reset on auth/session transitions; do not add reset bridge unless tests prove it necessary.

---

## Task 6 — Remove App-owned quick-create API orchestration while preserving Orders behavior — COMPLETE / GREEN

**Files**
- Modify Customers command/public contract as needed.
- Modify `src/domains/orders/ui/NewOrder.jsx`.
- Modify `src/App.jsx`.
- Add focused integration/contract tests.

### RED

Prove:

- App no longer defines `handleQuickCreateClient`;
- Orders never imports `customersApi.js` or Customers internals;
- quick-create receives a public mutation command/callback by composition;
- quick-create still sends:
  - `name.trim()`;
  - `phone || ''`;
  - `address: ''`;
- quick duplicate phone keeps the inline message:
  `Telefone já cadastrado para <nome>. Selecione esse cliente na busca acima.`;
- duplicate name uses the public Customers duplicate modal;
- "use existing" selects existing client and closes quick-create;
- "register anyway" creates and selects the new client;
- Cancel clears only quick-client open/name/phone/error/duplicate state;
- order items/type/date/delivery fee/adjustment remain untouched;
- request key remains `client:create:quick`;
- offline/capability guards remain.

### GREEN

- Expose a minimal public quick-create command/callback from Customers composition.
- App passes that command to `NewOrderRoute` as composition only.
- Orders uses Customers public duplicate rule/UI but does not own HTTP or customer mutation logic.
- No duplicated duplicate algorithm inside Orders.

---

## Task 7 — Permanent C7 architecture enforcement and compatibility-ledger cleanup — COMPLETE / GREEN

**Files**
- Modify `scripts/architecture/check-import-boundaries.mjs`
- Modify `scripts/architecture/check-import-boundaries.test.mjs`
- Modify `scripts/architecture/legacy-import-allowlist.json` only if needed.
- Modify `docs/superpowers/qa/spec-c-compatibility-facades.md`
- Add a C7 extraction/public contract test if useful.

### RED

Add permanent failures for:

- external Customers deep imports;
- Customers → Orders internals;
- Orders → Customers internals/infrastructure;
- legacy `src/pages/Clients.jsx`;
- legacy `src/components/ClientDuplicateModal.jsx`;
- legacy customer CRUD exports in `src/api/client.js`;
- customer editor/CRUD/duplicate ownership tokens reintroduced in App;
- `updateCollection('clients', ...)` in App/Customers;
- frontend duplicate lookup/name normalization remaining in `shared/clientIdentity.js`;
- Customers domain layer importing React/UI/infrastructure, consistent with global rules.

Explicitly permit the documented cross-runtime shared primitives:

- `normalizeClientPhone`;
- `formatClientPhone`.

### GREEN

- Tighten architecture checker.
- Update compatibility ledger:
  - customer use of `updateCollection` = removed in C7;
  - product use remains for C8;
  - generic/auth reexports remain C10 debt;
  - `shared/clientIdentity.js` is documented as permanent cross-runtime contract, not a facade.
- Do not mark global `updateCollection` removed while Catalog still consumes it.

---

## Task 8 — Full pre-staging gate and diff audit — COMPLETE / GREEN

Run on exact candidate SHA:

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
```

Require the existing production/staging Worker dry-runs and Spec B D1 checks from `Validate application`.

Audit:

- no Worker functional diff;
- no migrations/schema diff;
- no printing/QZ ownership change;
- no Finance/Table Service behavior change;
- Orders changes limited to Customers public-contract import/composition;
- no customer visual redesign;
- no CSS reorganization beyond path-safe imports;
- no unexplained compatibility facade;
- App contains no C7-owned business/UI state.

---

## Task 9 — Staging deployment and manual homologation — COMPLETE / HOMOLOGATED

After exact-SHA Validate is green, manually dispatch `Deploy staging` for `feature/spec-c7-customers`.

Record exact SHA/run and execute:

1. Clientes desktop opens normally.
2. Search by name.
3. Search by phone.
4. Search by address.
5. Sort Nome A–Z.
6. Sort Nome Z–A.
7. Create unique client.
8. Create with blank address and verify current `Sem endereço` behavior.
9. Edit client.
10. Keep own phone while editing.
11. Attempt another client's phone — blocked.
12. Open delete confirmation and cancel.
13. Confirm delete.
14. Confirm action sheet behavior remains current after delete attempt.
15. Duplicate name → Cancel.
16. Duplicate name → Use existing; editor closes and list search targets existing name.
17. Duplicate name → Register anyway.
18. Mobile editor input/autocomplete behavior.
19. Mobile list at 320–640px without clipping/touch regression.
20. Offline: read/search works, create/edit/delete blocked.
21. New Order: quick-create unique client.
22. Verify quick-create sends/behaves with blank address as before.
23. New Order: duplicate phone inline error.
24. New Order: duplicate name → Use existing.
25. New Order: duplicate name → Register anyway.
26. New Order: Cancel quick-create preserves rest of draft.
27. Verify global write blocking/request busy behavior during customer mutation.
28. Verify create/update/delete reconcile into official runtime/bootstrap state.
29. Logout/login does not resurrect customer editor/duplicate modal.
30. Capability/read-only behavior if a restricted identity exists; otherwise record **BLOCKED**, not PASS.

No production deployment.

---

## Task 10 — C7 closure and merge handoff — ACTIVE

- Create/update `docs/superpowers/qa/spec-c7-customers-qa.md`.
- Update execution ledger with every RED/GREEN SHA/run.
- Update compatibility ledger.
- Record staging exact SHA/run and manual QA totals.
- Run final status-only exact-HEAD Validate after docs closure.
- Request explicit user merge authorization.
- Merge only after authorization + green exact-head Validate.
- Record post-merge `master` Validate.
- Do not deploy production as part of normal C7.
- C8 starts only from the merged/validated C7 `master`.

## Approval checkpoint

The C7 design is **APPROVED**. This plan has now been reconciled with that design.

**Plan approved by the user on 2026-09-19. Task 1 may begin under strict RED → GREEN TDD.**

## Formal plan self-review — 2026-09-19

The reconciled plan was reviewed against the approved C7 design and the current post-C6 code. Review outcomes:

1. Task ordering is dependency-safe: public duplicate boundary → API/official effects → list UI → editor/public modal → workspace/App cleanup → Orders quick-create → architecture enforcement → staging/closure.
2. No task requires a Worker/schema/migration change.
3. The Worker dependency on shared phone primitives is explicitly protected and its uniqueness test is included in focused Task 1 evidence.
4. The plan does not create a mandatory app Customers surface; the public workspace remains single-domain.
5. Delete cleanup uses `deletedClientId` official effects and removes customer-specific `updateCollection` usage without claiming the Catalog debt is already gone.
6. Orders consumes Customers only through the public entry and receives mutation capability by composition; no Customers infrastructure import is permitted.
7. `ClientDuplicateModal` is deliberately public because Orders is a real consumer.
8. Global customer request keys and global write blocking are preserved.
9. Normal-editor and quick-create address payload differences are explicitly tested.
10. Existing duplicate-phone feedback differences are explicitly tested.
11. Node-safe public UI wrappers are planned to avoid repeating the direct-JSX export problem encountered in prior slices.
12. Execution setup now requires base verification + draft PR before the first authoritative RED.
13. No implementation task begins before explicit plan approval.

No known planning blocker remains after this review.
