# Spec C — compatibility facade ledger

Temporary compatibility paths and bridges introduced during Spec C must be removed by the listed slice or explicitly promoted to a documented permanent contract.

| Old path/bridge | New owner/path | Remaining consumers | Removal slice |
|---|---|---|---|
| `src/api/client.js` generic/auth reexports | `src/infrastructure/api/httpClient.js` + `src/infrastructure/auth/sessionApi.js` | legacy frontend imports during domain migration | C10 at latest |
| operational data runtime payment-receipt bridge | App-owned payment reconciliation | C1 legacy payment workflow | C6 |
| operational data runtime table-commit bridge | App-owned comanda selection reconciliation | C1 legacy table-service workflow | C5 |
| `updateCollection` runtime escape hatch | temporary legacy App CRUD handlers | clients/products handlers not migrated yet | C8, with final enforcement C10 |

## C1 status — 2026-09-16

- The Task 5 compatibility bridges remain intentional and active after the `useOperationalDataRuntime` integration.
- Task 6 session extraction (`useSessionRuntime`) introduced **no new compatibility facade or cross-slice bridge**.
- Task 7 runtime-boundary cleanup and `runtimeExtractionContract.test.js` introduced **no new compatibility facade or cross-slice bridge**.
- The generic/auth reexports in `src/api/client.js` remain temporary while later Spec C slices migrate consumers.
- The payment-receipt bridge still targets removal in C6.
- The table-commit bridge still targets removal in C5.
- The `updateCollection` escape hatch still targets reduction through C4-C8 and final enforcement no later than C10.
- Validate application #1194 / run `35075714168` was green on the pre-reconciliation staging SHA `87644cba4e9b3255b92bdcff851cc7a84c17ce8e`.
- C1 is not yet closed: final-head validation, fresh manual staging dispatch and the 15-item manual homologation matrix remain Task 8 gates.

Do not remove or broaden these compatibility paths opportunistically. Their removal belongs to the scheduled slice unless a separately approved architectural change updates this ledger first.
