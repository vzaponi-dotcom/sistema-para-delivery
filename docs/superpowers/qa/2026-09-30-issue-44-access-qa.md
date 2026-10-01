# Issue 44 — evidence and pending acceptance

Date: 2026-09-30, America/Sao_Paulo (final local gates on 2026-10-01 UTC). Worktree: `.worktrees/issue-44-users-profiles-access`; branch `feature/issue-44-users-profiles-access`. Integrated baseline: `aed142da`. Final full-test SHA: **`fa4dc07aa80de27e5415fd0d730d2867ed66707e`**. Production corrections, lint, architecture and build SHA: **`09f992f680097eea3dff6e8d1d5e4de350fee159`**. The only delta between them is the navigation test's simulated cookie state; no production, imports or build configuration changed. Exact results and their distinct SHAs are below.

Prior executable acceptance `cb5f737157a6379c0930dc7e4f5ba1374138715e` and its documentation commit `e17bd9e8a243b96724b9d50998e5aa76c9d17973` are retained as history. The whole-branch review at `e17bd9e8` identified I1, I2 and M1-M3; the single scoped fix wave is implemented and locally verified. The earlier 3,111-test pass did not cover the newly demonstrated cookie/printing continuation cases.

**Local test, lint, architecture and build gates have passing evidence at the exact SHAs stated above. Whole-system acceptance remains partial: the scoped rereview, staging, manual/device evidence and separate release approval remain pending.** No remote migration, deployment, invitation, enrollment, cutover, production change, push or merge was executed during Task 12 or this final fix wave.

## Earlier local evidence

Logs are retained in `.superpowers/sdd/2026-09-30-issue-44-users-profiles-access-plan/`; that directory is execution evidence, not a deployed artifact.

| Exact command | Exit | Actual result | Log |
|---|---:|---|---|
| `npm.cmd test` | 1 | 3,109 tests; 2,986 pass, 123 fail; 0 cancelled/skipped/todo; 126,813.1076 ms | `task-12-full-test.log` |
| `npm.cmd run lint` | 0 | 222 warning lines; no failing gate | `task-12-lint.log` |
| `npm.cmd run test:architecture` | 1 | Three boundary violations: two App access UI deep imports; access attribution test imports a printing internal | `task-12-architecture.log` |
| `npm.cmd run build` | 0 | Vite build succeeds; chunks above 500 kB warning retained | `task-12-build.log` |
| `npm.cmd run test:architecture` after authorized repair | 0 | `Frontend architecture boundaries: OK` | `task-12-architecture-fixed.log` |
| `npm.cmd run build` after authorized repair | 0 | Vite build succeeds; chunk warning retained | `task-12-build-fixed.log` |
| `node --test src/AppReceivablesPromise.test.js src/app/navigation/NavigationContext.test.js src/app/navigation/navigationExtractionContract.test.js src/domains/orders/application/useOrderPaymentPromise.test.js src/domains/access/ui/AccessRoutes.test.js src/domains/access/ui/InvitationAccept.test.js src/domains/access/ui/Attribution.test.js src/domains/printing/ui/printQueueAttribution.test.js src/domains/printing/ui/PrintQueueOwnership.test.js` | 0 | 19/19 pass; 0 failures/skips; 8,008.7963 ms | `task-12-boundary-covering.log` |
| `npm.cmd test` — prior SHA `cb5f7371` | 0 | **3,111/3,111 pass**; 0 failures/cancelled/skipped/todo; 1 suite; 132,095.1062 ms | `task-12-full-test-final.log` |
| `npm.cmd run lint` — prior SHA `cb5f7371` | 0 | 224 warning lines retained; no failing gate | `task-12-lint-final.log` |
| `npm.cmd run test:architecture` — prior SHA `cb5f7371` | 0 | `Frontend architecture boundaries: OK` | `task-12-architecture-final.log` |
| `npm.cmd run build` — prior SHA `cb5f7371` | 0 | Vite build succeeds in 1.49s; chunks above 500 kB warning retained | `task-12-build-final.log` |

For the prior `cb5f7371` gate, source stayed frozen until the full test process ended. That authorized repair adds the Access public entry, changes App imports to that entry and moves the print attribution assertion to its printing owner. Three stale test contracts were reconciled: navigation now exposes trusted `authenticated`, the payment-promise response preserves all authoritative effects (including `deletedOrderIds`, asserted by its behavioral hook test), and the obsolete unguarded sync source shape was retired. No production session, cookie or actor behavior changed in this repair.

The initial 123 failures and their owning groups are preserved in `task-12-full-test.log` and `task-12-failure-index.md`. Backend corrections `a66f2508..adfdfd59` used migrated SQLite/real audit DDL and faithful D1 behavior, with reviewed 81/81 plus allocation-validation 1/1 evidence. UI corrections `adfdfd59..cb5f7371` reconciled verified session/legacy fixtures and old contracts, with reviewed 141/141 plus cleanup 20/20 evidence. They also corrected a concrete production UI convention defect: TeamAccess and ActivityLog native selectors now use the existing SystemSelect, with role/filter behavior covered. The prior full gate above verified those corrections together; no tests were skipped and production permission/audit guards were preserved. The isolated owner suites were not repeated during that prior Task 12 run.

React renderer/deprecation/act and Node SQLite experimental warnings are existing deferred environment debt, preserved in logs. Prior lint retained 224 warning lines (222 in the initial checkpoint), including React refs/effect/global warnings and unused variables. The passing build retains its large-chunk warning. No blanket warning suppression was applied.

## Final scoped fix wave and verification

`09f992f6` fixes ordinary login/logout cookie settlement after other-tab invalidation, preserving newer request locks and rediscovering confirmed or uncertain cookie changes without replay. It captures access/generation across explicit printing and equivalent recovery/second-copy/attempt-intent continuations while preserving submitted physical outcome reporting. It also gates past dates by `orders.backdate` and presents Portuguese grant/action/outcome labels without changing machine values. The QA/plan chronology distinguishes the already completed evidence commit from executable acceptance (M3).

The targeted freeze run passed 129/129 tests (`final-fix-targeted-freeze.log`). The first full test gate on `09f992f6` found one additional fixture mismatch: `navigationContext.test.js` always returned an authenticated GET after its mocked logout. The test-only commit `fa4dc07a` models logout as anonymous legacy and relogin as the new trusted context; all query continuity, reset and stale-callback assertions remain. Its covering file passed 6/6 before commit (`final-fix-navigation-fixture-green.log`).

| Exact command and SHA | Exit | Actual result | Log |
|---|---:|---|---|
| `npm.cmd test` at `09f992f6` | 1 | 3,133 tests; 3,132 pass, 1 fail; no cancelled/skipped/todo; 134,348.6884 ms; navigation cookie fixture above | `final-fix-full-test.log` |
| `npm.cmd run lint` at `09f992f6` | 0 | 229 warning lines; no failing gate | `final-fix-lint.log` |
| `npm.cmd run test:architecture` at `09f992f6` | 0 | `Frontend architecture boundaries: OK` | `final-fix-architecture.log` |
| `npm.cmd run build` at `09f992f6` | 0 | Vite build in 1.36 s; existing chunks above 500 kB warning | `final-fix-build.log` |
| `npm.cmd test` at `fa4dc07a` | 0 | **3,133/3,133 pass**, 0 failed/cancelled/skipped/todo; 1 suite; **132,989.464 ms** | `final-fix-full-test-final.log` |

All four initial gates ran once on the committed frozen source. Only the failed full test gate was repeated after the one-file fixture reconciliation. The other gates remain applicable to unchanged production/import/configuration source; they were not rerun or represented as executions on `fa4dc07a`. After that full-test process ended, only these QA/plan evidence documents were edited.

The lint delta is five additional `react(globals)` warnings in test probes: assignments to `current` and `key` in `useSessionRuntime.test.js`, and three `current` assignments in `printingSessionOwner.test.js`. Comparing warning identities after removing line/column numbers found no additional production warning. Existing React renderer/act and SQLite warnings remain in the full logs; no suppression or optional cleanup was applied. Detailed red/green evidence, harness corrections, source freeze and per-finding self-review are retained in `final-fix-report.md`.

## Migration and transport state

| Migration | SHA-256 | Actual state |
|---|---|---|
| `0035_users_profiles_access.sql` | `b533648fabf4a3484d7c74770b88e1914a5fe0970192fde6a289f9911c991fea` | Present in source after integrated 0034; additive access schema; no Task 12 remote application |
| `0036_audit_resource_attribution.sql` | `d6f1834c86b9c496ab1128e5dff1ed9cec8b7cbaa15a79e3ccee984642cc1574` | Present in source; resource/time audit index; no Task 12 remote application |

Task 11 already recorded a local, actual Wrangler 4.128.0 `getPlatformProxy` D1 proof (`remoteBindings:false`, `persist:false`): two rows committed, and a preceding insert rolled back on NOT NULL failure. Task 12 did not repeat that proof. Node SQLite migration/domain tests and this local proxy proof do not establish deployed schema, remote credentials, backup/restore or staging behavior. Remote migration/auth mode/database state has not been inspected or changed by Task 12.

## Route reconciliation

Policy baseline is Spec §7 and §11 plus the plan Appendix A endpoint inventory. The literal dispatch review covered `worker/index.js`, `orderPrintingApi.js`, `settingsApi.js`, `businessProfileApi.js`, `reporting/api.js`, `kitchenTvApi.js`, the delegated `tableReservationApi.js`, and `access/api.js`/authentication adapters. `git diff 2eb32b0f..cb5f7371 --` those exact route-owner files is empty: route policies and literals did not change during the owner corrections, so the reviewed matrix remained applicable to that tested SHA. The final fix wave changes only frontend source/tests and evidence; the server route policy matrix is unchanged. The matrix below retains the Appendix A operational rows and explicitly adds the authentication adapter rows. No additional unmapped implementation route was found. Grouped rows enumerate each supported method/path; parameter names denote server-scoped resources.

The method/path policy coverage lives in `worker/access/routeCoverage.test.js` (real dispatcher, manager/operator/no-grant, compound payloads and foreign resources), `worker/access/printingAuthorization.test.js` (printing method/path table and resource eligibility), `worker/access/api.test.js`, `activityApi.test.js`, `sessions.test.js`, `invitations.test.js` and `worker/kitchenTvApi.test.js`. Raw response projection/attribution assertions live in `projections.test.js`, `attribution.test.js` and `businessAudit.test.js`. These tests are included in the passing final full gate. This source/test mapping is local evidence, not deployed route acceptance.

| Adapter route | Required policy / response exception | Existing evidence |
|---|---|---|
| `POST /api/auth/login` | Same-origin; identifier/password; persisted account/origin limits; shared default 12h/personal 7d; non-enumerating error; explicit legacy/enrollment state only for PIN | `sessions.test.js`, `loginThrottle.test.js`, `credentials.test.js` |
| `POST /api/auth/logout` | Same-origin; revoke current session; no-store response and expired cookie | `sessions.test.js`, `auth.test.js`, `businessAudit.test.js` |
| `GET /api/auth/session` | Trusted current account/known grants/auth mode; anonymous response reveals no private collections; revalidate before response; no-store | `sessions.test.js`, `AppSessionAccess.test.js` |
| `POST /api/access/invitations/accept` | Same-origin; hashed one-use 24h token; fixed server business; password activation creates no session | `invitations.test.js`, `InvitationAccept.test.js` |

For every authenticated operational request, the Worker fixes the business server-side, loads persisted current grants, denies enrollment users outside access administration, revalidates after handling and records bounded denials/actor effects. Accepted official effects can survive response refusal and must reconcile without automatic replay. Bootstrap/effective settings are per-grant projections; logo explicitly permits any authenticated human; these are deliberate exceptions to a blanket no-grant 403. TV public routes use only the dedicated TV state machine and credential, and never authenticate human APIs. Successful operational JSON may contain bounded actor metadata; it must not expose the unrestricted manager activity stream or sensitive audit/session fields to operators.

| Method and path | Required policy |
|---|---|
| `GET /api/bootstrap` | Per-grant projection; no private collection without its read grant. |
| `POST /api/tables`; `PUT /api/tables/order`; `PATCH /api/tables/:id` | `tables.manage`. |
| `POST /api/tables/:id/transfer` | `comandas.transfer`. |
| `POST /api/clients`; `PATCH /api/clients/:id`; `DELETE /api/clients/:id` | `clients.create`; `clients.update`; `clients.delete`, respectively. |
| `POST /api/clients/:id/receivables/payment` | `payments.receive` + `clients.view`; project returned effects without finance collections. |
| `GET /api/orders` | `orders.view` for active, `orders.history` for terminal; deny if neither. |
| `POST /api/orders` | `orders.create`; additional `payments.receive`, `orders.discount`, `orders.backdate` based on payload. |
| `PATCH /api/orders/:id/status`; `POST /api/orders/:id/payment` | `orders.finalize`; `payments.receive`. |
| `PATCH /api/orders/:id/payment-promise`; `POST /api/orders/:id/cancel`; `POST /api/orders/:id/refund` | `finance.promises.manage`; `orders.cancel`; `payments.refund`. |
| `GET /api/table-tabs/:id`; `POST /api/table-tabs/:id/payment` | `comandas.view`; `comandas.view` + `payments.receive`. |
| `GET /api/table-reservations`, `/api/table-reservations/:id`; `PUT /api/table-reservations/:id`; `POST /api/table-reservations/:id/confirm-arrival`; `POST /api/table-reservations/:id/(cancel|no-show)` | Order/comanda read grants; `orders.create` with compound payload checks; `orders.create`; `orders.cancel` plus `payments.refund` if requested. |
| `GET /api/table-tabs/:id/print-document`; `POST /api/table-tabs/:id/print-jobs` | `comandas.view` + `printing.execute`. |
| `POST /api/movements`; `PATCH/DELETE /api/movements/:id`; `PUT /api/finance-settings` | `finance.movements.manage`. |
| `POST /api/products`; `PATCH/DELETE /api/products/:id` | `products.manage`. |
| `GET /api/settings/effective` | Authenticated, grant-filtered config. |
| `GET /api/settings/receipts/:id` | Manage grant of specified resource. |
| `GET/PUT /api/settings/operations`, `/payment-methods`, `/cancellation-reasons`, `/finance-categories` | Matching descriptor view/manage grant. |
| `GET/PUT /api/settings/business-profile`; `GET /api/business/logo` | `business.profile.view/manage`; any authenticated human for logo. |
| `GET/PUT /api/printing/settings`; `GET /api/printing/stations`; `PUT /api/printing/stations/:id`; `POST /api/printing/stations/:id/make-primary` | `printing.settings.view/printing.settings`; `printing.station.view`; `printing.station.configure`; `printing.station.configure`. |
| `GET /api/reporting/overview`, `/operation`, `/sales`, `/products`, `/orders`, `/orders/:id`; `POST /api/reporting/export-model` | `reports.view`; `reports.export`. |
| `GET /api/kitchen-tv/settings`; `POST /api/kitchen-tv/approve`, `/revoke` | `orders.settings.view`; `orders.settings.manage`. |
| `GET /api/kitchen-tv/control`; `PATCH /api/kitchen-tv/control/page`, `/modality`; `PUT/DELETE /api/kitchen-tv/control/orders/:id/hidden` | `orders.view`; `orders.kitchen.control` for mutations (manager only in V1). |
| `POST /api/kitchen-tv/pairing-request`; `GET/POST /api/kitchen-tv/pairing-status`; `GET /api/kitchen-tv/state`; `POST /api/kitchen-tv/report` | Dedicated TV credential/state machine only; never human profile fallback. |
| `GET /api/printing/jobs`, `/jobs/summary` | `printing.queue`. |
| `GET /api/orders/:id/print-document`; `POST /api/orders/:id/print-jobs` | Matching order read grant + `printing.execute`. |
| `GET /api/printing/qz/certificate`; `POST /api/printing/qz/sign`; `POST /api/printing/test-jobs` | `printing.execute` and existing station/job eligibility. |
| `POST /api/printing/stations/:id/heartbeat`, `/recovery` | `printing.execute` and station business/affinity. |
| `POST /api/printing/jobs/claim-next`, `/claim-recovery-next`; `POST /api/printing/jobs/:id/(claim|complete|fail|retry)` | `printing.execute` and job/station eligibility. |
| `POST /api/printing/jobs/:id/attempts`; `POST /api/printing/attempts/:id/submitting`, `/events` | `printing.execute` and job/station eligibility. |
| `POST /api/printing/jobs/:id/resolve-outcome`, `/second-copy-prompt`, `/request-second-copy`, `/skip-second-copy`, `/reprint` | `printing.execute` and job/station eligibility. |
| `POST /api/printing/jobs/discard-pending`; `POST /api/printing/jobs/discard-operational`; `POST /api/printing/jobs/:id/discard` | `printing.discard`. |
| `POST /api/printing/jobs/:id/prioritize`, `/force-print` | `printing.force`. |
| `GET/POST /api/access/users`, `PATCH /api/access/users/:id`, `POST /api/access/users/:id/reset`, `GET /api/access/activity` | `access.users.view/manage` by method; `access.audit.view` for activity. |
| `POST /api/access/me/password`; `POST /api/access/invitations/accept` | Authenticated user + current password; single-use invitation token, respectively. |

## Actor, browser and device acceptance matrix

All rows below are **unexecuted in staging**. Actual local/model evidence is identified explicitly; no row is a physical or browser-cookie proof. The release operator must record environment URL, approved final SHA, deployed migration/auth mode, actor identifiers, browser/device/OS versions, QZ version/printer/station, TV model/browser, execution timestamp and expected-versus-actual evidence without passwords/tokens.

| Scenario / setup | Expected | Actual evidence and remaining action |
|---|---|---|
| Manager, desktop browser, shared mode | Full granted operations/access/audit; absolute 12h expiry | Node route/session/UI models exist; staging raw JSON/direct URLs/expiry pending |
| Operator, desktop shared browser | All operational orders/comandas, per-order money/payment; create/finalize/receive/client create/update/routine print; no manager collections/actions | Node grant/projection/UI models exist; staging raw network/deep-link checks pending |
| Manager/operator, personal browser | Explicit opt-in 7d absolute expiry; multiple sessions allowed | Session model assertions exist; real cookies and multi-device expiry pending |
| No-grant human / enrollment human | No operational private read/write; permitted account/access administration only | 19-test covering run includes actual App enrollment models; staging pending |
| Operator direct forbidden APIs and URLs | 403/API and guarded UI for cancel/refund/discount/backdate/transfer/delete client/business config/force/discard/users/audit/reports | Literal route/UI tests exist; staging requests and response body inspection pending |
| Hidden compound checkout fields | Reject payment/discount/backdate/refund without corresponding grants | Dispatcher model tests exist; staging pending |
| Rename, deactivate, change role or revoke user during shift | Revalidate persisted account/grants immediately; stale responses masked; no accepted write replay | Node backend/runtime models exist; real Worker/browser race pending |
| Two last usable managers concurrently demoted/deactivated | At least one usable active manager with access.users.manage remains | Transactional user tests exist; concurrent deployed D1 exercise pending |
| Invitation accepted twice/expired/reissued | One use, 24h, no autosession, pasted POST token absent from URL/history/storage | Node backend/UI models exist; real delivery/activation/recovery pending |
| Password rotation delayed after accepted server write; screen unmounted/navigate/switch/logout | Local voluntary identity exits blocked through settlement and verified cookie discovery | Task 10 runtime/App models exist; real cookie/headers timing pending |
| Rotation response after other-tab login/invalidation | Every confirmed cookie change publishes opaque invalidation; all tabs immediately mask previous private owner and rediscover current accepted cookie without replay | Task 10 model tests exist; actual response headers/browser cookie order pending |
| Ordinary login/logout delayed cookie response after other-tab invalidation | Displayed identity and current browser cookie stay coherent through existing invalidation/discovery contract | I1 confirmed by review and fixed at `09f992f6`; six hook/API confirmed/interrupted response regressions plus lock/draft cleanup checks pass; real browser timing proof pending |
| Shared browser switch with drafts, accepted payment, unknown physical print | Guard exit, clear old private state/drafts, preserve accepted/unknown effects for reconciliation; never replay | Task 9 model tests exist; real supported browser/payment/QZ pending |
| Password reset / emergency last-manager recovery | Revoke credentials/sessions/old invites atomically; one-use reissued invitation; retain user_only | Task 11 local transaction/proxy proof; actual approved staging operator procedure pending |
| Explicit print test/retry, second copy, recovery and attempt intent after identity/generation change | Stop new mutations from an expired owner; retain reconciliation for submitted effects without replay | I2 fixed at `09f992f6`; real hook/API continuation regressions pass; real device/browser timing pending |
| Physical station/QZ, routine/automatic print | Human session required; proper station affinity; trusted actor; physical page observed | Node printing models exist; supported browser/QZ/printer run pending |
| QZ/network interruption during submit, spooler completion/recovery/reprint | Preserve uncertain physical outcome, explicit reconciliation, no automatic duplicates | Node intent/observed outcome/idempotency models exist; real physical interruption proof pending |
| Kitchen TV pairing/approval/revoke, including actual target TV browser | TV restricted credential; human cookie does not substitute; manager-only administration/control mutations | Node dedicated TV protocol tests exist; device pairing/revoke/control pending |
| Concurrent PBKDF2 Worker login load | Verify 100,000-iteration SHA256 under representative concurrent load; record p50/p95/p99, errors/rate-limit counts and latency budget | No deployed latency measurement; Node duration is not Worker latency evidence |
| Desktop/mobile, keyboard/focus, themes | Usable login/account/team/activity/activation; no private stale content | Node UI models exist; visual/manual staging QA pending |
| Backup/isolated restore/cutover rehearsal | Restricted backup verified; approved cutover rechecks manager/grants atomically and never silently restores PIN | Runbook/local tests exist; real staging restore/rehearsal pending |

Cookie authority limitation accepted in Task 10: the **currently accepted browser cookie** is authoritative. Newest-initiated login across tabs is not guaranteed; reordered responses can select an earlier-requested account and require a manual switch. The acceptance criterion is coherent trusted identity, immediate masking in all tabs and no replay, not a new cross-tab ordering protocol. Node hooks cannot prove real Set-Cookie application, BroadcastChannel/storage delivery or physical output.

## Release handoff and open risks

Use [the controlled cutover runbook](../../operations/issue-44-access-cutover.md) for approved staging first, then separate production approval. It preserves infrastructure identity/backup, actual remote D1 batch preflight/cutover, first-manager invitation delivery in a private interactive terminal **once**, and explicit emergency invitation recovery. Do not log tokens in chat/CI/screenshots or automate uncertain issuance. Initial acceptance never logs the recipient in; recovery retains user_only and cannot restore PIN.

Local status: Task 12 Steps 1–2 complete; local Step 4 evidence records full tests at `fa4dc07a` and lint/architecture/build at `09f992f6`. The independent whole-branch review at `e17bd9e8` is complete; its scoped fixes are locally verified. Open gates: one scoped rereview of the complete fix range; approved staging migrations/deploy/preflight/enrollment/cutover; real browser cookie order and revocation; raw operator projections/direct API/URL checks; physical QZ/TV; Worker PBKDF latency; backup/restore and emergency recovery; separate release approval. No production readiness claim is supported until those observed outcomes replace the pending rows. Task 12 Step 3/manual acceptance, remote Step 4 evidence and Step 5 release approval remain pending.
