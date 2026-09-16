# Spec C — Execution Ledger

This file is the canonical execution handoff for Spec C. It complements, but does not replace:

- `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`
- `docs/superpowers/plans/2026-09-15-frontend-modularization-rollout-plan.md`
- the detailed plan for the currently active slice
- `docs/superpowers/qa/spec-c-compatibility-facades.md`

A new implementation session should read those documents plus this ledger before changing code.

## Global program status

| Slice | Scope | Status | Branch / PR | Detailed plan |
|---|---|---|---|---|
| C1 | Runtime central, generic HTTP/auth, architecture gate | IN PROGRESS | `feature/spec-c1-runtime` / PR #45 | `docs/superpowers/plans/2026-09-15-frontend-modularization-c1-runtime-plan.md` |
| C2 | Navigation and App composition | NOT STARTED | — | Write only after C1 is merged and the new `master` is inspected |
| C3 | Settings surface and generic policy editing engine | NOT STARTED | — | Write after C2 merge |
| C4 | Orders | NOT STARTED | — | Write after C3 merge |
| C5 | Table Service | NOT STARTED | — | Write after C4 merge |
| C6 | Finance and cross-domain payment workflows | NOT STARTED | — | Write after C5 merge |
| C7 | Customers | NOT STARTED | — | Write after C6 merge |
| C8 | Catalog | NOT STARTED | — | Write after C7 merge |
| C9 | Printing domain and QZ separation | NOT STARTED | — | Write after C8 merge |
| C10 | Architectural closure, facades/shared/CSS cleanup and final gates | NOT STARTED | — | Write after C9 merge |

Do not freeze detailed C2-C10 implementation plans ahead of the preceding merges. Each detailed plan must be written from the real post-merge `master` tree.

---

## C1 — Runtime Centralization

### Current Git state

- Branch: `feature/spec-c1-runtime`
- Pull request: #45 — `Spec C1: centralizar runtime do frontend`
- PR state: draft, open, not merged
- PR base: `master`
- C1 base SHA: `af8266549603fc2d392880c812bc1c0d608a6dbc`
- Last verified executable HEAD before this ledger: `894e4b3273eb98232bb826a153a650c2dcefa567`
- Last fully green validation at that executable HEAD: Validate application #1162
- Production deploy: **NO**
- Staging homologation: **NOT STARTED**

The Spec C documentation was not yet merged to `master` when C1 began, so PR #45 also contains the approved Spec C spec/rollout/C1-plan documentation. Do not recreate or re-brainstorm those documents.

### C1 task status

| Task | Status | Notes |
|---|---|---|
| Task 1 — generic HTTP + session infrastructure | DONE | RED #1153, GREEN #1154 |
| Task 2 — permanent architecture gate | DONE | Final GREEN #1158 |
| Task 3 — online/offline runtime | PARTIAL | Hook/test implemented and green; **not yet wired into `App.jsx`** |
| Task 4 — feedback runtime | PARTIAL | Hook/test implemented and green; **not yet wired into `App.jsx`** |
| Task 5 — operational data runtime | NEXT | No Task 5 commit exists yet |
| Task 6 — session lifecycle runtime | NOT STARTED | Must follow Task 5 |
| Task 7 — App runtime extraction contract + cleanup | NOT STARTED | Must follow Task 6 |
| Task 8 — full gates, staging, manual QA evidence | NOT STARTED | No production deploy |

### Task 1 completed

Created:

- `src/infrastructure/api/httpClient.js`
- `src/infrastructure/api/httpClient.test.js`
- `src/infrastructure/auth/sessionApi.js`
- `src/infrastructure/auth/sessionApi.test.js`

`src/api/client.js` remains a temporary compatibility facade for generic/auth exports while later Spec C slices migrate consumers.

Compatibility tracking lives in:

- `docs/superpowers/qa/spec-c-compatibility-facades.md`

Validation evidence:

- RED: Validate application #1153
- GREEN: Validate application #1154
- tests/lint/build/Worker dry-runs/local D1/Spec B D1 gate all passed on GREEN

### Task 2 completed

Created:

- `scripts/architecture/check-import-boundaries.mjs`
- `scripts/architecture/check-import-boundaries.test.mjs`
- `scripts/architecture/legacy-import-allowlist.json`

Added permanent command:

- `npm run test:architecture`

Integrated in:

- `.github/workflows/validate.yml`
- `.github/workflows/deploy-staging.yml`

Current protected rules include:

- pure domain layer cannot import React/React DOM/QZ/infrastructure;
- `shared` cannot import `domains`;
- cross-domain imports must use the target domain public `index.js`;
- direct production `qz-tray` imports are restricted to `src/infrastructure/qz/**` or an exact temporary allowlist entry.

Current production QZ allowlist contains exactly:

- `src/printing/usePrintingManager.js`

During Task 2, `src/printing/usePrintingManager.test.js` was found to import `qz-tray`. That is a test dependency, not a production coupling. A RED test was added and the checker was corrected so the `qz-direct` production rule ignores `*.test.*` / `*.spec.*`; the production allowlist was **not expanded**.

Final Task 2 commit:

- `a6f56c57fec66773eb77f8c4cc9bae2ce0293f3a`

Final validation:

- Validate application #1158 — fully green

### Task 3 partially completed

Implemented and green:

- `src/app/runtime/network/useOnlineStatus.js`
- `src/app/runtime/network/useOnlineStatus.test.js`

Commit:

- `f181261179a6ab1b846f8fdef839c1797a35ab64`

TDD evidence:

- RED: Validate #1159
- GREEN: Validate #1160

**Still pending:** connect `useOnlineStatus()` to `src/App.jsx` and remove App-owned `isOnline` state plus `online`/`offline` browser listeners.

Do not change any write-blocking semantics when wiring this hook.

### Task 4 partially completed

Implemented and green:

- `src/app/runtime/feedback/useFeedbackRuntime.js`
- `src/app/runtime/feedback/useFeedbackRuntime.test.js`

Preserved behavior:

- toast dismiss: `2600 ms`
- success dismiss: `1800 ms`
- default success copy: `Ação salva com sucesso`

TDD evidence:

- RED: Validate #1161
- GREEN: Validate #1162

**Still pending:** wire the hook into `src/App.jsx` and remove App-owned feedback state/timer implementation while keeping portal markup and visible UX unchanged.

### Exact resume point — Task 5

Resume from the current C1 branch. Ignore any previously created but unattached Git blob from the interrupted session; no Task 5 commit was added to the branch.

Task 5 creates:

- `src/app/runtime/data/useOperationalDataRuntime.js`
- `src/app/runtime/data/useOperationalDataRuntime.test.js`

It must extract, without semantic simplification:

- official collections: clients/products/orders/tables/tableTabs/movements/financeSettings;
- `bootstrapState`;
- `bootstrapEffectiveConfig`;
- collection sync guard;
- bootstrap in-flight protection;
- orders-only in-flight protection;
- official revision tracking;
- official tables snapshot;
- bootstrap application;
- `applyOfficialEffects`;
- global bootstrap refresh;
- orders-only refresh;
- operational reset;
- polling/subscription mechanics.

Timing invariants are locked:

- global synchronization: `5000 ms`
- Cozinha-only order synchronization: `2000 ms`

Do not alter those values in C1.

Before implementation, RED tests must cover at minimum:

1. polling runs immediately;
2. interval refresh;
3. hidden document suppresses interval refresh;
4. visible transition refresh;
5. focus refresh;
6. unsubscribe cleanup;
7. bootstrap loads all official collections;
8. stale bootstrap cannot overwrite a newer official mutation;
9. payment owners are captured at read start and that same snapshot is settled;
10. table commit bridge updates official table snapshot;
11. order-only refresh changes only orders;
12. reset clears data, replaces sync guard, and zeroes official revision.

Temporary C1 bridges approved by the plan:

- payment receipt bridge → remove in C6;
- table/comanda selection bridge → remove in C5;
- `updateCollection` escape hatch for legacy handlers → reduce through C4-C8, mandatory removal by C10.

Every bridge must be recorded in `docs/superpowers/qa/spec-c-compatibility-facades.md` in the same implementation round that introduces it.

### App.jsx integration constraint

`src/App.jsx` is large (~89 KB), and the GitHub Contents API replaces the whole file. Tasks 3 and 4 were intentionally tested in isolation first to avoid repeatedly rewriting the file.

When Task 5 reaches App integration, integrate these together in one carefully reviewed App change where practical:

- `useOnlineStatus()`;
- `useFeedbackRuntime()`;
- `useOperationalDataRuntime()`.

Preserve everything outside C1 exactly in behavior and presentation.

C1 must not redesign or migrate:

- payment workflows;
- comanda workflows;
- customer/product/order/table/finance domain CRUD handlers;
- printing workflows;
- navigation architecture beyond what is necessary for runtime preservation;
- CSS/layout/copy;
- React Router;
- Redux/Zustand;
- WebSocket/SSE;
- Worker/backend architecture.

### After Task 5

Task 6: create `src/app/runtime/session/useSessionRuntime.js` + tests and move session check/login/logout/expiry lifecycle while preserving:

- auth states: `checking | anonymous | authenticated`;
- expiry copy: `Sua sessão expirou. Entre novamente.`;
- invalid PIN copy: `PIN inválido. Confira e tente novamente.`.

Task 7: create `src/app/runtime/runtimeExtractionContract.test.js` and prove `App.jsx` no longer owns C1 runtime implementation tokens while still retaining explicitly deferred domain/workflow handlers.

Task 8: run full gates, review actual diff, deploy the exact C1 branch to staging, execute the approved 15-item manual matrix, and only then write `docs/superpowers/qa/spec-c1-runtime-qa.md` from real evidence.

Required C1 final gates:

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
```

Then require Validate application success, successful manual staging workflow, and manual C1 homologation.

**Do not deploy production.**

---

## Cross-slice rules

These rules remain in force for every C slice:

- one architectural Spec C, multiple independently homologable PR slices;
- each new slice starts from the merged `master` produced by the previous slice;
- strict behavior **and** visual preservation unless a separate approved spec explicitly changes behavior;
- TDD RED → GREEN for behavioral changes/extractions;
- focused tests during development, full gates before homologation/merge;
- no direct work on `master` for implementation;
- staging before merge/release decisions;
- production only with explicit authorization;
- domain internals are not cross-imported;
- temporary compatibility facades/bridges must be tracked and removed by their target slice;
- C10 cannot close with unexplained temporary facades, prohibited imports or architecture violations.

## How a new chat/session should resume

Before changing code:

1. read the Spec C design;
2. read the rollout plan;
3. read this execution ledger;
4. read the detailed plan for the active slice;
5. inspect the actual GitHub branch/PR HEAD and current CI state;
6. compare the ledger with the branch before assuming a task status;
7. continue from the `NEXT` task using the existing TDD/gate discipline.

The repository, not chat history, is the source of truth for Spec C execution continuity.
