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

## C4 status — checkpoint after Task 8 — 2026-09-17

- Active branch: `feature/spec-c4-orders`, draft PR #48.
- Last fully validated executable checkpoint: `52619afa04b9ee0b94370f341e9ca83ca826d162`.
- Validate #1250 / run `35292926495` — PASS.
- No C4 Orders compatibility facade survives through Task 8.
- Core order rules, kitchen rules/hooks, lifecycle API, Orders-owned policies, New Order draft/commands, and New Order UI were moved to their planned Orders owners rather than left behind as old-path facades.
- `getOrders`, `createOrder`, `updateOrderStatus`, and `cancelOrder` are no longer lifecycle exports of the legacy `src/api/client.js`; payment/refund/payment-promise APIs intentionally remain for C6.
- The operational data runtime payment-receipt bridge remains intentionally active until C6.
- The operational data runtime table-commit bridge remains intentionally active until C5.
- Generic/auth `src/api/client.js` compatibility reexports remain scheduled for C10 at latest.
- `updateCollection` remains for later Customers/Catalog migration, with the existing C8/C10 removal schedule.
- Task 9 has not started. The C4 final boundary/facade audit belongs to Task 10 and may further tighten this ledger.

Do not remove or broaden these compatibility paths opportunistically. Their removal belongs to the scheduled slice unless a separately approved architectural change updates this ledger first.

