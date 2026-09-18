# Spec C — compatibility facade ledger

Temporary compatibility paths and bridges introduced during Spec C must be removed by the listed slice or explicitly promoted to a documented permanent contract.

| Old path/bridge | New owner/path | Remaining consumers | Removal slice |
|---|---|---|---|
| `src/api/client.js` generic/auth reexports | `src/infrastructure/api/httpClient.js` + `src/infrastructure/auth/sessionApi.js` | legacy frontend imports during domain migration | C10 at latest |
| operational data runtime payment-receipt bridge | App-owned payment reconciliation | C1 legacy payment workflow | C6 |
| operational data runtime table-commit bridge | Table Service controlled selection observes official `tables[]` directly | no remaining runtime consumer on current C5 branch; final removal evidence pending C5 closure | C5 |
| `updateCollection` runtime escape hatch | temporary legacy App CRUD handlers | clients/products handlers not migrated yet | C8, with final enforcement C10 |

## C1 status — 2026-09-16

- The Task 5 compatibility bridges remain intentional and active after the `useOperationalDataRuntime` integration.
- Task 6 session extraction (`useSessionRuntime`) introduced **no new compatibility facade or cross-slice bridge**.
- Task 7 runtime-boundary cleanup and `runtimeExtractionContract.test.js` introduced **no new compatibility facade or cross-slice bridge**.
- The generic/auth reexports in `src/api/client.js` remain temporary while later Spec C slices migrate consumers.
- The payment-receipt bridge still targets removal in C6.
- The table-commit bridge still targets removal in C5.
- The `updateCollection` escape hatch still targets reduction through C4-C8 and final enforcement no later than C10.
- Homologated C1 HEAD `b6e8de4bf3c64652dff7352e4ff744017cff10e5` passed Validate application #1201 / run `35104869996`.
- Manual Deploy staging #177 / run `35105946795` passed via `workflow_dispatch` on that exact HEAD.
- The approved 15-item C1 manual staging matrix completed **15/15 PASS** on 2026-09-16; evidence is recorded in `docs/superpowers/qa/spec-c1-runtime-qa.md`.
- No compatibility path changed as a result of homologation. The rows above remain the canonical removal schedule for later slices.
- Production was not deployed from C1.

## C3 status — 2026-09-17

- C3 merged by PR #47 at `737beeac2150aabeb39024af823f2f60fee25108`.
- C3 created no surviving compatibility facade. Its temporary Settings ownership paths were removed before merge.
- The generic/auth reexports, payment-receipt bridge, table-commit bridge and `updateCollection` escape hatch remain governed by the table above.
- Final C3 branch Validate #1219 / run `35232989249` passed before merge.

## C4 final status — 2026-09-18

- PR #48 merged at `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`.
- C4 left no Orders legacy-path compatibility facade.
- Final branch Validate #1290 / run `35357003475` passed.
- Post-merge Validate #1291 / run `35357630853` passed on the exact merge commit.
- The operational data runtime payment-receipt bridge remains intentionally active until C6.
- The operational data runtime table-commit bridge remains intentionally active and is the specific compatibility debt C5 must remove.
- Generic/auth `src/api/client.js` reexports remain scheduled for C10 at latest.
- `updateCollection` remains for later Customers/Catalog migration, with final enforcement no later than C10.

## C5 execution status — 2026-09-18

- Branch: `feature/spec-c5-table-service`; draft PR #49.
- Base: C4 merge/master `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`.
- Written design and detailed implementation plan are **APPROVED**.
- Task 1 is **COMPLETE / GREEN** at `e8f490808900d56c2c23d6683ed5365da4921b80`; it introduced no temporary compatibility facade.
- Task 2 is **COMPLETE / GREEN** after fix `1eb0f4b51283ad2f6274720a6eaafa63156fbe00`; Validate #1298 / run `35379605815` passed.
- Task 2 physically removed the runtime `onTablesCommitted` callback and App-owned comanda selection refs. Selection now reconciles unidirectionally from official `tables[]`.
- The table-commit bridge row remains visible only until final C5 architecture/closure evidence records its removal; there is no remaining runtime consumer on the current branch.
- Task 3 is **COMPLETE / GREEN** at `4fcfff12a3357dfbeb1587142b643a0db55702bf`; Validate #1306 / run `35380450226` passed. `Comandas.jsx` no longer owns direct detail HTTP/loading.
- Task 4 is **COMPLETE / GREEN** at `7ef5fc7a68292e17372bb15a9d23131c38ecfd48`; Validate #1309 / run `35381219700` passed.
- The temporary Task 3 dependency on legacy `getTableTabDetail` is removed. Detail HTTP now belongs to `domains/table-service/infrastructure/tableServiceApi.js`.
- Task 5 is **COMPLETE / GREEN** at final fix HEAD `44f9b9e0f4410ae909873811fff70b2c5b80f083`; Validate #1313 / run `35382601189` passed.
- App table-management/transfer handlers are removed and replaced by `useTableServiceCommands`.
- C5 API debt in `src/api/client.js` is now cleared: `createTable`, `updateTable`, `reorderTables`, `transferTableTab` and `getTableTabDetail` are absent. Table-tab payment remains C6; print document/manual print job remain C9.
- The payment-receipt bridge remains intentionally active until C6.
- Generic/auth `src/api/client.js` reexports remain scheduled for C10 at latest.
- `updateCollection` remains tracked for later Customers/Catalog cleanup and final C10 enforcement.
- C5 must not opportunistically move table-tab payment APIs (C6) or table-tab printing APIs (C9).

Do not remove or broaden these compatibility paths opportunistically. Their removal belongs to the scheduled slice unless a separately approved architectural change updates this ledger first.

