# Spec C — compatibility facade ledger

Temporary compatibility paths and bridges introduced during Spec C must be removed by the listed slice or explicitly promoted to a documented permanent contract.

| Old path/bridge | New owner/path | Remaining consumers | Removal slice |
|---|---|---|---|
| `src/api/client.js` generic/auth reexports | `src/infrastructure/api/httpClient.js` + `src/infrastructure/auth/sessionApi.js` | legacy frontend imports during domain migration | C10 at latest |
| operational data runtime payment-receipt bridge | App-owned payment reconciliation | **REMOVED IN C6**; architecture-enforced | C6 |
| operational data runtime table-commit bridge | Table Service controlled selection observes official `tables[]` directly | **none — removed and architecture-enforced in C5** | **C5 — REMOVED** |
| `updateCollection` runtime escape hatch | temporary legacy App CRUD handlers | **Customers removed + architecture-enforced in C7; Catalog/products remain** | C8, with final enforcement C10 |

## C1 status — 2026-09-16

- The Task 5 compatibility bridges remain intentional and active after the `useOperationalDataRuntime` integration.
- Task 6 session extraction (`useSessionRuntime`) introduced **no new compatibility facade or cross-slice bridge**.
- Task 7 runtime-boundary cleanup and `runtimeExtractionContract.test.js` introduced **no new compatibility facade or cross-slice bridge**.
- The generic/auth reexports in `src/api/client.js` remain temporary while later Spec C slices migrate consumers.
- The payment-receipt bridge is **REMOVED IN C6**; permanent architecture checks reject its legacy ownership/callback shape.
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

## C5 final status — 2026-09-18

- Branch: `feature/spec-c5-table-service`; PR #49 merged to `master` at `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`.
- Base: C4 merge/master `a0b4f5dac865ae54ad9bec7086139b280ffda5f4`.
- Written design and detailed implementation plan are **APPROVED**.
- Task 1 is **COMPLETE / GREEN** at `e8f490808900d56c2c23d6683ed5365da4921b80`; it introduced no temporary compatibility facade.
- Task 2 is **COMPLETE / GREEN** after fix `1eb0f4b51283ad2f6274720a6eaafa63156fbe00`; Validate #1298 / run `35379605815` passed.
- Task 2 physically removed the runtime `onTablesCommitted` callback and App-owned comanda selection refs. Selection now reconciles unidirectionally from official `tables[]`.
- The operational table-commit bridge is **REMOVED IN C5**. Task 10 architecture enforcement now rejects legacy owner/API reintroduction and external deep imports; there is no remaining runtime consumer.
- Task 3 is **COMPLETE / GREEN** at `4fcfff12a3357dfbeb1587142b643a0db55702bf`; Validate #1306 / run `35380450226` passed. `Comandas.jsx` no longer owns direct detail HTTP/loading.
- Task 4 is **COMPLETE / GREEN** at `7ef5fc7a68292e17372bb15a9d23131c38ecfd48`; Validate #1309 / run `35381219700` passed.
- The temporary Task 3 dependency on legacy `getTableTabDetail` is removed. Detail HTTP now belongs to `domains/table-service/infrastructure/tableServiceApi.js`.
- Task 5 is **COMPLETE / GREEN** at final fix HEAD `44f9b9e0f4410ae909873811fff70b2c5b80f083`; Validate #1313 / run `35382601189` passed.
- App table-management/transfer handlers are removed and replaced by `useTableServiceCommands`.
- C5 API debt in `src/api/client.js` is now cleared: `createTable`, `updateTable`, `reorderTables`, `transferTableTab` and `getTableTabDetail` are absent. Table-tab payment remains C6; print document/manual print job remain C9.
- Task 6 is **COMPLETE / GREEN** at `3c9fce53a594de182b7dd34948926a83cf464baa`; Validate #1320 / run `35384747211` passed.
- `src/pages/Tables.jsx`, `src/pages/Tables.test.js` and `src/components/LocalTableSelector.jsx` are removed with no compatibility reexport. Their owners are now `src/domains/table-service/ui/Tables.jsx`, `Tables.test.js` and `LocalTableSelector.jsx`.
- App and Orders consume `Tables` / `LocalTableSelector` only through `src/domains/table-service/index.js`; Task 6 introduced no surviving compatibility facade.
- Task 7 is **COMPLETE / GREEN** at `d040bf730c786af4aea815c1bcdbfb306f4e0b1e`; Validate #1326 / run `35386530872` passed.
- `src/pages/Comandas.jsx`, `src/pages/Comandas.test.js`, `src/components/ComandaDetail.jsx`, `src/components/ComandaDetail.test.js` and `src/components/TableTransferDialog.jsx` are removed with no compatibility reexport. Their owners are now under `src/domains/table-service/ui/`.
- `Comandas` is exported through the Table Service public entry. `ComandaDetail` and `TableTransferDialog` remain internal, and `useTableTabDetail` is no longer exported publicly because its only consumer is internal. Task 7 introduced no surviving compatibility facade.
- Task 8 is **COMPLETE / GREEN** at `23963386b140c2bea90eaa80c0dc60874fcf025a`; Validate #1331 / run `35388385418` passed.
- Payment-open, ticket-preview, print-feedback and print action ownership moved to `src/app/surfaces/table-service/TableServiceExternalActions.jsx`. `Comandas` now emits external intents carrying `{ tableId, tableTabId, selectionGeneration }` and has no direct payment/printing workflow ownership.
- The Table Service production tree contains no `TableTabPaymentDialog`, `TableTabTicketPreview`, `getTableTabPreviewDocument`, `printTableTab` or `registerTableTabPayment` ownership tokens. This is composition, not a compatibility facade.
- The payment-receipt bridge and accepted-payment reconciliation remain intentionally active until C6; table-tab print APIs/queue/QZ remain C9.
- Task 9 is **COMPLETE / GREEN** at `8a69d6d6b1643ae865bbf976225bbe46e237fd89`; Validate #1335 / run `35389776835` passed.
- The dead Orders route compatibility contract is removed: `tableTabsFromBootstrap` is gone, `NewOrderRoute` no longer receives a `tableTabs` prop, and no compatibility reexport was introduced. `tables`, `initialTableId` and `expectedTableTabId` remain the live route contract.
- Official runtime `tableTabs` deliberately remains for C6 payment reconciliation; this is runtime state, not an Orders compatibility facade. Orders → Table Service continues only through `src/domains/table-service/index.js`.
- Task 10 is **COMPLETE / GREEN** at `bf871adb3c21de2cd3c6143214d12a5e825c1bda`; Validate #1338 / run `35391943036` passed with **1,724 tests / 1,723 pass / 0 fail / 1 skipped**.
- The C5 architecture checker permanently rejects external Table Service deep imports, Table Service → Orders imports, recreation of the five legacy UI owners, and reintroduction of the five migrated C5 API exports. The public entry is restricted to the six real external contracts.
- Generic/auth `src/api/client.js` reexports remain scheduled for C10 at latest.
- `updateCollection` remains tracked for later Customers/Catalog cleanup and final C10 enforcement.
- C5 staging homologation completed at executable SHA `f0db4d8bc8c17196cd7070e4766363f9d66a8f7b`: Validate #1339 and Deploy staging #182 are green; manual QA is **22 PASS / 0 FAIL / 1 BLOCKED**.
- The table-commit bridge remains **REMOVED / architecture-enforced**. The payment-receipt bridge remains intentionally active for C6; generic/auth reexports remain tracked for C10; `updateCollection` remains for later Customers/Catalog cleanup and C10 enforcement.
- C5 final branch HEAD `5c86585e10ad04e36fcb507cbfee7bbc1e84c767` passed Validate #1341 / run `35400357800`; post-merge `master` `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3` passed Validate #1342 / run `35401628448`.
- C5 is **MERGED / COMPLETE**. It did not move table-tab payment APIs (C6) or table-tab printing APIs (C9).

## C6 planning status — 2026-09-18

- Branch: `feature/spec-c6-finance-workflows`.
- Base: post-C5 `master` `e8ec2304ec9613a30b9a7f9b395bc9935a3abdd3`.
- Written design `docs/superpowers/specs/2026-09-18-frontend-modularization-c6-finance-workflows-design.md` is **APPROVED**.
- The operational data runtime payment-receipt bridge is still physically present at C6 start and is the explicit compatibility debt C6 must remove.
- No replacement payment bridge is approved. Payment reconciliation moves to app-owned workflows while the operational runtime remains generic.
- Generic/auth reexports remain scheduled for C10; `updateCollection` remains for C7/C8 cleanup and final C10 enforcement.
- Detailed C6 plan is **APPROVED** and implementation is active in draft PR #50.
- Task 1 is **COMPLETE / GREEN** at `2fa0ce1e27e4992d4eb904cce6a85cbb89ea0eaf`; Validate #1345 / run `35403573350` passed with **1,729 tests / 1,728 pass / 0 fail / 1 skipped**.
- Task 1 added the new Finance public boundary and Finance-owned payment/finance-category policy adapters without removing any compatibility facade. The payment-receipt bridge remains intentionally active until Task 7.
- Task 2 is **COMPLETE / GREEN** at `1f38c21c56af2d2dda7ed292365c9685b5ce6ad5`; Validate #1351 / run `35405016988` passed with **1,731 tests / 1,730 pass / 0 fail / 1 skipped**.
- Task 2 moved Payment Settings and Finance Category Settings ownership plus their policy adapters behind the Finance public entry. The former app-owned UI/model/policy paths are removed with no compatibility reexport.
- Task 2 created no surviving temporary facade. The operational payment-receipt bridge remains intentionally active until Task 7.
- Task 3 is **COMPLETE / GREEN** at `54dcbd1ff44f2dc715a469bc60c78c458ac42318`; Validate #1354 / run `35406034390` passed with **1,745 tests / 1,744 pass / 0 fail / 1 skipped**.
- Task 3 added no compatibility facade. Finance receivable projections take Orders financial-state rules by injection, preserving the no-cycle boundary; legacy `src/utils/finance.js`, `src/utils/receivables.js`, and `src/utils/paymentWorkflow.js` remain intentionally present until Task 9 as planned.
- The operational payment-receipt bridge remains active until Task 7.
- C6 Task 4 is **COMPLETE / GREEN** at `f76b223245f1a2fcaaf981694d052365e5ca9ffb`; Validate #1359 / run `35408051011` passed with **1,750 tests / 1,749 pass / 0 fail / 1 skipped**.
- Finance UI, movement/opening-balance dialogs, Finance API and Finance commands moved to `domains/finance` with no compatibility reexport. Legacy C6 finance API exports remain intentionally present in `src/api/client.js` until Task 9, while App no longer imports or owns those finance CRUD operations.
- Refund remains a cross-domain workflow debt for Task 8; Finance only emits `onRequestRefund` intent and has no Orders import.
- C6 Task 5 is **COMPLETE / GREEN** at `895690be64baa8284b0e5b31dda1969f1f9dadb5`; Validate #1363 / run `35409732928` passed with **1,755 tests / 1,754 pass / 0 fail / 1 skipped**.
- `src/pages/Receivables.jsx` and its finance-exclusive supporting component owners are removed with no compatibility reexport. `ReceivablesSurface` is the app-owned composition boundary, while Finance receives Orders presentation/state rules by injection and contains zero Orders imports.
- Payment-promise coordination moved out of App to Orders. The legacy `updateOrderPaymentPromise` export in `src/api/client.js` remains intentionally present only until Task 9 removes all C6 legacy API exports.
- Task 5 created no runtime bridge; the operational payment-receipt bridge remains intentionally active until Task 7.
- C6 Task 6 is **COMPLETE / GREEN** at `c2ece77fe403f72f88c42af9fb060fe1352d5fe3`; Validate #1367 / run `35411096051` passed with **1,762 tests / 1,761 pass / 0 fail / 1 skipped**.
- Standalone order-payment coordination and modal ownership moved from App to `src/app/workflows/payments/order/`; `src/app/workflows/payments/paymentApi.js` owns the order payment route and already defines the table-tab route for Task 7. No replacement runtime bridge was introduced.
- Legacy `registerPayment` and `registerTableTabPayment` exports remain physically present in `src/api/client.js` until the scheduled Task 9 cleanup; App no longer consumes `registerPayment`.
- C6 Task 7 is **COMPLETE / GREEN** at `c7e2fcbc32c387eb7e52765014d00241102f19b7`; Validate #1372 / run `35413040640` passed with **1,773 tests / 1,772 pass / 0 fail / 1 skipped**.
- The operational payment-receipt bridge is **REMOVED IN C6 TASK 7**. `useOperationalDataRuntime.js` no longer accepts `legacyBridges` and contains no `capturePaymentOwners` / `settlePaymentOwners` callback path. Accepted table-tab payment obligations and two-read reconciliation now live entirely in `app/workflows/payments/table-tab/`.
- `TableTabPaymentDialog` moved to the app payment workflow with no legacy-path compatibility reexport. App no longer owns the table-tab payment refs/state/handlers. Legacy `registerTableTabPayment` remains only as scheduled API export debt in `src/api/client.js` until Task 9.
- C6 Task 8 is **COMPLETE / GREEN** at final code/docs predecessor `8848bcaff0819048fdcb175d02694b80e8d4e2eb`; Validate #1376 / run `35414468722` passed with **1,775 tests / 1,775 pass / 0 fail / 1 skipped**. Refund ownership is now `src/app/workflows/refunds/` (`refundApi`, `useRefundWorkflow`, `RegisterRefundDialog`); Finance emits only `onRequestRefund`, and App composes the workflow. No compatibility facade was introduced. Remaining C6 API/utility debt is reserved for Task 9.
- C6 Task 9 is **COMPLETE / GREEN** at `279f409c5f2322d273ea3c36b1ad16136c1c9d12`; RED `841566efc06d9b31f937c0f9140dba85823d2839` / Validate #1378 / run `35415173295` failed for the intended absence assertions, and GREEN Validate #1379 / run `35415603078` passed with **1,760 tests / 1,760 pass / 0 fail / 0 skipped**. The eight C6 legacy API exports were removed from `src/api/client.js`; `paymentMethodOptions.js`, `financeCategoryOptions.js`, `finance.js`, `receivables.js`, and `paymentWorkflow.js` plus superseded tests were removed. Final consumers use Finance/Orders public contracts and app payment/refund workflow adapters; no C6 compatibility facade survives. Generic/auth/client/catalog/printing debt scheduled for later slices remains intact.
- Production remains untouched.

Do not remove or broaden these compatibility paths opportunistically. Their removal belongs to the scheduled slice unless a separately approved architectural change updates this ledger first.


- C6 Task 10 is **COMPLETE / GREEN** at `28dbb138a8ebfca6a20ddf68d4a3bf65e77638e9`; Validate #1383 / run `35416528098` passed with **1,770 tests / 1,769 pass / 0 fail / 1 skipped**.
- C6 architecture debt is now permanently enforced: external Finance consumers must use `domains/finance/index.js`; Finance cannot import Orders or Table Service; removed C6 owners/API exports cannot reappear; cross-domain payment/refund workflows cannot move under domains; Finance/payment workflows cannot import printing/QZ internals. The Finance public entry is restricted to actual external consumers.
- Task 10 introduced no compatibility facade. With the payment-receipt bridge already removed in Task 7 and C6 legacy API/utils removed in Task 9, no temporary C6 compatibility facade remains before staging/manual QA.


## C6 homologation closure — 2026-09-19

- C6 staging homologation completed at corrected executable SHA `ebf9439d85115c422b3df8175b3d24429a77aed9`: Validate #1389 / run `35442758266` and Deploy staging #184 / run `35443025995` are **SUCCESS**.
- Manual QA closed at **23 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**. The sole BLOCKED case is restricted/read-only capability behavior because staging has no suitable restricted identity/session; it is not counted as PASS.
- The operational payment-receipt bridge remains **REMOVED IN C6 / architecture-enforced**. The table-commit bridge remains **REMOVED IN C5**.
- Generic/auth `src/api/client.js` reexports remain scheduled for **C10**.
- `updateCollection` remains for Customers/Catalog migration in **C7/C8**, with final enforcement no later than **C10**.
- No C6 compatibility facade survives. Production deployment remains **NO**.

- QA/docs closure commit `7c59972cd88f3b74d8e5f00b05353da5413896b7` passed Validate #1390 / run `35447678112`.
- Merge authorization for C6 was explicitly granted by the user on 2026-09-19. Production remains untouched.


## C7 homologation / closure status — 2026-09-19

- C7 is **MERGED / COMPLETE** by PR #51 at `a7a8285ee125d90058c739f52daba6c170921adb`; post-merge Validate #1429 / run `35459175985` passed on the exact merge SHA.
- Homologated staging SHA: `c01d90c6ea3a286a601f8efea51ec5ee28ff52d3`; final code-changing SHA: `6402496c078ca817572e6e375beec9f4ffbe557a`.
- Validate #1419 / run `35456801774` — **SUCCESS**, **1,807 tests / 1,806 pass / 0 fail / 1 skipped**; architecture/lint/build/production+staging Worker dry-runs/local D1/Spec B D1 all green.
- Customer CRUD no longer uses the `updateCollection` escape hatch. Customer delete is represented by the official `deletedClientId` effect, and Task 7 permanently rejects reintroduction of `updateCollection('clients', ...)` in App or Customers.
- The global `updateCollection` escape hatch is **not globally removed**: Catalog/product CRUD remains scheduled for C8, with final closure enforcement in C10.
- Legacy customer CRUD exports `createClient`, `updateClient`, `deleteClient` are absent from `src/api/client.js`; Task 7 rejects their reintroduction.
- Legacy UI owners `src/pages/Clients.jsx` and `src/components/ClientDuplicateModal.jsx` are removed with no compatibility reexport; their Customers owners are architecture-enforced.
- `shared/clientIdentity.js` is a **permanent cross-runtime contract**, not a compatibility facade. It deliberately retains only `normalizeClientPhone` and `formatClientPhone`, which are consumed by frontend/Worker behavior.
- Frontend-only `normalizeClientName` and `findClientDuplicates` belong to Customers and are architecture-enforced out of the shared contract.
- Generic/auth reexports in `src/api/client.js` remain scheduled for C10 at latest.
- C7 introduced **no surviving temporary compatibility facade** and did not broaden the architecture allowlist.
- C7 has no surviving temporary compatibility facade. Production remained untouched.


## C8 active status — 2026-09-19

- C8 design and plan are **APPROVED**; branch `feature/spec-c8-catalog`, draft PR #52, base `a7a8285ee125d90058c739f52daba6c170921adb`.
- Task 1 is in authoritative RED at `11e84f3badf1ffcca0fd71bb2ccd46588017e88b`; Validate #1432 failed for the intended Catalog boundary/ownership reasons.
- `updateCollection` remains an active compatibility debt for Catalog/products. It is **not removed in Task 1** and must not be marked removed before Task 6 GREEN.
- `shared/productCatalog.js` is a permanent cross-runtime contract for the exports genuinely used by the Worker; C8 Task 1 narrows frontend-only metadata into Catalog. It is not a temporary facade.
- Generic/auth reexports in `src/api/client.js` remain scheduled for C10; Printing API debt remains C9.
- C8 Task 1 introduces no compatibility reexport at the legacy Products/ProductForm paths and does not expand the architecture allowlist.
