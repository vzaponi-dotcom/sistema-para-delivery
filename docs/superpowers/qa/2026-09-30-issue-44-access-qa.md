# Issue 44 — evidence and pending acceptance

Date: 2026-09-30, America/Sao_Paulo (final local gates on 2026-10-01 UTC). Worktree: `.worktrees/issue-44-users-profiles-access`; branch `feature/issue-44-users-profiles-access`. Integrated baseline: `aed142da`. Final full-test SHA: **`fa4dc07aa80de27e5415fd0d730d2867ed66707e`**. Production corrections, lint, architecture and build SHA: **`09f992f680097eea3dff6e8d1d5e4de350fee159`**. The only delta between them is the navigation test's simulated cookie state; no production, imports or build configuration changed. Exact results and their distinct SHAs are below.

Prior executable acceptance `cb5f737157a6379c0930dc7e4f5ba1374138715e` and its documentation commit `e17bd9e8a243b96724b9d50998e5aa76c9d17973` are retained as history. The whole-branch review at `e17bd9e8` identified I1, I2 and M1-M3; the single scoped fix wave is implemented and locally verified. The earlier 3,111-test pass did not cover the newly demonstrated cookie/printing continuation cases.

**Local test, lint, architecture and build gates have passing evidence at the exact SHAs stated above. The single scoped rereview of e17bd9e8..0f9e6969 approved I1, I2 and M1-M3 with no residual finding. Whole-system acceptance remains partial: manual staging/device evidence and separate release approval remain pending.** No remote migration, deployment, invitation, enrollment, cutover, production change, push or merge was executed during the initial local Task 12/final fix rounds. The authorized staging update below records subsequent remote operations.

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

The initial acceptance matrix below was **unexecuted in staging**. The authorized staging update at the end records subsequent evidence; rows not superseded there remain pending. Actual local/model evidence is identified explicitly; no row is a physical or browser-cookie proof. The release operator must record environment URL, approved final SHA, deployed migration/auth mode, actor identifiers, browser/device/OS versions, QZ version/printer/station, TV model/browser, execution timestamp and expected-versus-actual evidence without passwords/tokens.

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

Local status: Task 12 Steps 1–2 complete; local Step 4 evidence records full tests at `fa4dc07a` and lint/architecture/build at `09f992f6`. The independent whole-branch review at `e17bd9e8` is complete; its scoped fixes are locally verified. The single scoped rereview approved the complete fix range e17bd9e8..0f9e6969 with no residual finding. Open gates after the staging update below: human login/Operator preparation/cutover; real browser cookie order and revocation; raw operator projections/direct API/URL checks; physical QZ/TV; Worker PBKDF latency; backup/restore and emergency recovery; separate release approval. No production readiness claim is supported until those observed outcomes replace the pending rows. Task 12 Step 3/manual acceptance, remote Step 4 evidence and Step 5 release approval remain pending.


## Authorized staging update — 2026-09-30 America/Sao_Paulo

The responsible human explicitly authorized staging backup, migrations, deployment, initial manager enrollment and test cutover. Production and merge remain separate. Draft [PR #85](https://github.com/vzaponi-dotcom/sistema-para-delivery/pull/85) publishes the reviewed feature branch.

| Observation | Actual evidence |
|---|---|
| Base | Fresh origin/master aed142da; zero commits behind before publication. |
| Backup | Restricted storage outside the repository. Original SQL: 1,590,881 bytes; SHA256 35E398275602E3DBE0AEBF44BAD56BA03EC68D53B180D1A3C63FDE0CACF95E7D. Time Travel bookmark retained privately. No data, hashes of credentials or download links in this QA. |
| Isolated restore | Export loader encountered ordering and whole-file statement-size errors. A derived restore preserves all SQL values/definitions, creates tables and indexes before rows, and triggers afterward. Actual official local D1 binding batch restored 2770 statements; all 38 exported table counts match the SQLite reference (2654 rows), zero foreign-key errors, 34 migrations. D1 adds one internal table. Original backup remains intact. This is local isolated restoration evidence, not a remote disaster-recovery timing claim. |
| Remote administrative transport | Existing authorized Wrangler OAuth injected into child memory; actual configured staging D1 binding SELECT 1 succeeded. Infrastructure credential never printed or persisted by the operation. |
| First official deployment | [Run 36804725754](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36804725754), SHA 2cb6bd0009f791000296ea76465cb30ec60360d7. Test/architecture/lint/build/local migrations/dry-run/remote migrations/PIN configuration/deploy succeeded. Worker version 620fd27e-2523-4a6d-9c76-f313f418ef4c. The run concluded failure only at the auth smoke; later deep-link step was skipped. |
| Linux suite | 3145 tests; 3144 pass, zero fail/cancel, one existing Windows-only skip in scripts/infra/spec-b-processes.test.js:50; 192606.723546 ms. This does not replace the previously recorded Windows 3133/3133 evidence. |
| Remote schema | Read-only D1 query confirmed 0035_users_profiles_access.sql and 0036_audit_resource_attribution.sql. Mode legacy before initial invitation; no users before enrollment. |
| Smoke finding | Initial post-deploy successful HTTP response lacked the strict required header contract; later actual response is 200/no-store/no cookie/current known-mode anonymous body. The pre-fix helper immediately rejected incompatible HTTP 200 instead of consuming its propagation window. Transient old Worker propagation is inferred from baseline/current contracts and timing. Minimal helper correction committed 78af5731, 23/23 scoped tests/lint0; scoped rereview approved; official redeploy [run 36805683366](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36805683366) on executable SHA 78af573111c3a2df19d625992b961a7015eb7d4a completed successfully; details below. No Worker authentication workaround. |
| Anonymous API checks | Actual staging bootstrap/access users/access activity/reporting overview/movements all returned 401 UNAUTHENTICATED without cookies. Foreign-origin login returned 403 ORIGIN_NOT_ALLOWED. Activation SPA shell HTTP200 and its referenced JS asset passed. No human credential used; no browser-cookie/visual proof asserted. |
| Initial manager | Explicit user choice: private interactive terminal. CLI issue-initial-manager completed exit0 once; invitation delivered only there. Remote mode enrollment, one user initially without credential. Token/password absent from chat, files, QA and CI. Human found the terminal; remote invitation.accepted event and valid credential now confirm activation. Human login confirmation and Operator creation remain pending. |
| Preflight before activation | Actual remote CLI exit1, ready:false, NO_USABLE_MANAGER and INCOMPLETE_CREDENTIALS_OR_ROLES. Expected pending-account refusal. After activation, actual preflight exited0 with ready:true/no failures. No cutover executed. |

Enrollment checkpoint before the later cutover below: https://sistema-para-delivery-staging.vzaponi.workers.dev. The [Portuguese manual guide](../../operations/issue-44-staging-manual-test.md) covers activation, the two profiles and device checks. Manager activation is confirmed. Human login, Operator preparation, cutover and the remaining acceptance matrix are pending; no production or merge readiness claim.

### Successful official redeploy and current handoff

[Run 36805683366](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36805683366) completed **success** on executable SHA `78af573111c3a2df19d625992b961a7015eb7d4a`, Worker version `b4d8a5e3-4076-4ca1-a652-282c12e520e9`. All workflow gates passed, including local/remote migrations, deployment and mode-aware smoke. Linux suite: **3147 total, 3146 pass, zero fail, one existing Windows-only skip**, 216403.60793 ms. The smoke observed enrollment on readiness attempt1/6 and completed real PIN login/session/logout/revocation and anonymous boundaries. All14 deep links passed SPA shell and asset checks, including account/team/activity/activation.

The responsible human subsequently confirmed successful login and supplied a screenshot showing the expected enrollment configuration cards (Equipe e acessos/Atividades). The initial login report resolved without a credential reset or product change. Actual preflight immediately before cutover exited0, ready:true/no failures. The authorized staging cutover completed once with CLI exit0; post-cutover preflight also exited0/ready:true. Read-only D1 proof: mode user_only, cutover_at 2026-10-01T02:36:10.267Z (2026-09-30 23:36:10 America/Sao_Paulo), zero active legacy sessions, one active human session, exactly one access.auth.cutover event and one login.success event. The existing live smoke then passed user_only readiness, PIN-only rejection HTTP401, anonymous private bootstrap denial and foreign-origin login denial, without human credentials or a legacy PIN. No return to PIN, retry of the cutover or production operation.

The human refreshed the page and explicitly confirmed that operational menus (Pedidos/Comandas) appeared. Manager activation/login and basic post-cutover menu visibility are therefore observed. Raw payload and action authorization checks are still pending. Operator creation/login are recorded below. Authenticated negative permission tests, session/cookie timing, emergency recovery, login-load latency and physical QZ/TV remain pending. The deployment/enrollment/cutover portion is complete; whole Task12 manual/release acceptance remains partial.

Documentation-only commits after executable78af5731 record rollout evidence and the manual guide; they were not separately redeployed and contain no runtime/test/config changes. Exact deployed code SHA above remains authoritative.

### Operator activation and login — 2026-10-01 America/Sao_Paulo

The responsible human created an Operator invitation through Equipe e acessos and later explicitly confirmed successful login as operador-teste. Their initial invalid-login screenshot showed the invitation token entered as the login identifier; instructions corrected the identifier to operador-teste and kept the invitation acceptance flow separate. The user then confirmed success. No token or password is reproduced or saved in this QA, and no product change, password reset or new cutover was needed.

The responsible human then reported all requested UI checks passed: Pedidos/Comandas open normally; managerial destinations are hidden or blocked; direct managerial URLs display “voce nao tem acesso a esse destino”. In the same Operator window, they opened /api/access/users and /api/reporting/overview, supplied a screenshot of the error JSON (error.code FORBIDDEN, message “Você não pode acessar estas configurações.”), and explicitly confirmed both paths returned that denial. No managerial list/report payload was reported. This records human-observed authenticated API denial for those two read endpoints, together with frontend navigation denial; HTTP headers/status were not separately captured. Other forbidden APIs/actions, safe operational payload projection, additional operational writes and session/device behavior remain pending. Operator order creation and activity attribution are recorded below. Whole Task12 manual/release acceptance remains partial.

### Operator order creation and activity attribution — 2026-10-01

Following the requested Operator-create/Manager-view test, the responsible human supplied an Atividades screenshot showing actor **Operador de Teste**, action **Pedido criado**, result **Concluído**, UI timestamp **01/10/2026 10:46:52**. The same screenshot also shows an earlier access-denied entry attributed to Operador de Teste, result Negado, at10:44:09. No customer data, invitation or password is copied into this QA.

This records observed Operator order creation and Manager-visible actor attribution, plus observed denial auditing. It is not a proof of every audited mutation, forged-actor protection, transaction rollback, raw payload projection or physical printing. The two-tab logout gate is recorded below. Whole Task12 manual/release acceptance remains partial.
### Logout across two Operator tabs — 2026-10-01

Following instructions to open two tabs in the same Operator window and log out in one, the responsible human confirmed the other tab lost access without manual F5 and supplied a screenshot of the login form displaying **Sua sessão expirou. Entre novamente.** The screenshot shows empty identifier/password inputs and no previous private operation content.

This is observed basic logout invalidation/masking across two tabs. It does not establish reordered Set-Cookie responses, interrupted writes, password reset, user-switch drafts, full12-hour/7-day expiry or physical-output reconciliation. Those broader session/device gates remain pending. Next manual security check: protect the last active credentialed manager from deactivation; confirm the Manager account list/precondition before attempting it. Whole Task12 manual/release acceptance remains partial.

### Shared staging deployment regression — 2026-10-01

The user authorized autonomous tests with fictional staging data, then reported that the login screen requested and accepted PIN again. They confirmed the new domain staging.mesiva.com.br and another staging deployment. Read-only diagnosis found [run36872704286](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36872704286), successful on403e6fe19b5a060a28f35127587fccda95852ed5 from chore/staging-mesiva-domain. That branch starts at the previous master and contains domain/PIN-normalization changes without issue44. Both the new domain and the original workers.dev endpoint returned anonymous HTTP200 with the old body containing only authenticated:false and no Cache-Control header. D1 remained user_only with the original cutover timestamp; two active accounts and two unrevoked unexpired legacy sessions were observed. The domain deployment therefore replaced the approved accounts bundle; the persisted cutover was not reverted. Previous acceptance evidence above is historical, not a claim that this overwritten deployment supports profiles.

Recovery will preserve the custom domain and compatible normalization changes, restore the approved issue44 bundle through the official staging workflow, and use the reviewed idempotent cutover operation to revoke legacy sessions created during the regression. No production deployment, account reset or auth-mode rollback is authorized by this recovery. Recovery execution and live verification are recorded separately when completed.

Recovery source9f1495b4 integrated the domain configuration and compatible PIN normalization;26/26 focused tests and scoped spec/quality review passed. First recovery [run36874276694](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36874276694) stopped before remote operations at the full test gate:3150 total,3148 pass,one failure,one existing Windows-only skip,161672.237093ms. The failure was the status-specific projection fixture: orderDate fixed to2026-09-30 combined with real current time, so after the São Paulo day change all test orders became historical/finalized rather than the intended active/history mix. A deterministic fixture correction is being verified without changing the production order or authorization behavior.

Test-only correction7d36951d uses a coherent fixture clock, preserves the original permission assertions and verifies both sides of São Paulo midnight and a future day. The original failure and new boundary failures were reproduced before correction;35/35 focused projection/order/session tests then passed. Independent scoped spec/quality review approved the change. No application authorization or order behavior changed.

[Run36875200460](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36875200460), first attempt on exact SHA7d36951d533e0a4b9e424b669deff5339a48291c, passed3153 total tests/3152 pass/zero fail/one existing Windows-only skip in214031.32273ms, plus architecture/lint/build/migrations/dry-run and deployment. Worker version71a691eb-8c98-484d-bed7-7ae1cc0e0d17 was published to both staging origins. The immediate auth smoke detected user_only and rejected PIN, then failed its final anonymous-response contract; SPA checks were skipped. Subsequent actual live verification passed the same auth smoke on both https://staging.mesiva.com.br and workers.dev (user_only, no-store anonymous discovery, PIN401, anonymous bootstrap401, foreign-origin403), plus anonymous users/activity/reporting/movements401 without cookies. Mixed deployment propagation is an inference from timing and subsequent success; the failed final response body was not captured.

After the compatible bundle was restored, the reviewed idempotent cutover CLI completed exit0 to revoke the legacy sessions created by the old deployment. Actual read-only D1 proof:zero unrevoked legacy sessions,mode user_only,original cutover timestamp2026-10-01T02:36:10.267Z,exactly one cutover event,two active accounts and two active credentials. No password reset or account recreation occurred. The same failed workflow job was rerun on the unchanged exact SHA to complete the remaining official remote checks; its final result is recorded below.

### Successful domain recovery and autonomous acceptance — 2026-10-01

[Run36875200460](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36875200460), attempt2, completed **success** on unchanged executable SHA7d36951d533e0a4b9e424b669deff5339a48291c. Final Worker version7cf054e4-c67c-45b3-9094-48a0488fa354. All gates passed:3153 tests total/3152 pass/zero fail/one existing Windows-only skip,214855.895321ms; architecture/lint/build/migrations/dry-run/deployment; user_only auth smoke with PIN401; all14 SPA deep links and assets against staging.mesiva.com.br. The domain and workers.dev remain on the same configured staging Worker. Production and merge were not performed.

After browser control recovered, root observed the real Operator My account page and the blocked team destination. The user then supplied the fictional test-account credentials specifically for these tests. Root used normal login UI and the normal HTTP login API; no session injection or database credential edits. Plaintext passwords/cookies were not copied to test files or evidence. API-helper credential input used a confirmed no-echo raw terminal; sessions/cookies existed only in child memory and were logged out in cleanup.

Observed live checks:

- Normal Manager login and team list succeed; only one active credentialed account has access.users.manage (read-only D1 precondition).
- UI deactivation and role downgrade of that last Manager both display “Mantenha pelo menos um gerente ativo com senha definida.” The unsaved role edit was closed. Direct normal authenticated PATCH also returns HTTP409/LAST_MANAGER; the account remains active and Manager.
- Normal Operator login succeeds. Its raw bootstrap keeps operational orders/amounts, omits movements/financeSettings/balances/reports/receipts, uses no-store and ignores a supplied different businessId.
- Operator GET users/activity/reporting returns HTTP403/FORBIDDEN. An attempted self-promotion PATCH and financial-movement POST also return403/FORBIDDEN before payload validation.
- Manager deactivates the Operator test account; the previously valid Operator session then receives401/UNAUTHENTICATED for private bootstrap. Manager reactivates it and login succeeds with the existing password. Both original roles and active credentials are preserved.
- Shared Manager/Operator cookies declare43200 seconds; personal Operator cookie declares604800 seconds. Personal-session logout causes private bootstrap401. These verify declared lifetimes and revocation, not waiting for the complete12-hour/seven-day period.
- In two authenticated Manager tabs, logout in one replaces the other with the identifier/password login form without F5 and removes the previous private account content. The screenshot shows existing browser autofill for the Operator login, including masked password dots; the inputs are not claimed to be empty. This proves basic cross-tab invalidation/masking; reordered responses and interrupted writes remain separate gates.

The first private API harness run stopped after its passing projection/read-denial checks because it mistakenly expected403 from GET/api/movements. Source inspection and a live diagnostic confirmed that method is not an API route (404/NOT_FOUND); the real route is POST. The harness then resumed only the remaining checks with fresh normal sessions; financial POST denial passed. This was a test-harness expectation error, not a product authorization defect. No managerial movement payload was exposed.

Private screenshots retain the last-Manager refusal and the cleared second tab. No orders, payments, password resets or physical print attempts were created by these autonomous checks. Physical QZ/TV, emergency recovery, full-duration expiry, adversarial cookie timing/interrupted writes and login-load percentiles remain pending; whole Task12 release acceptance is still partial.

### Physical device availability — 2026-10-01

The responsible human stated that physical printing cannot be tested with the equipment currently available, but the real TV can be tested. Physical QZ/printing remains unexecuted due to equipment unavailability, not passed. The manual staging guide now provides the exact TV pairing/settings URLs and the real-device order, reload, independent-session, profile-control and revoke/re-pair checks. TV remains pending until actual device results are supplied.

### Human TV acceptance — 2026-10-01

After receiving the physical TV staging test guide, the responsible human confirmed: “deu tudo certo, esta funcionando igual estava anteriormente”. This records a human-reported functional TV acceptance after the issue44 deployment/domain recovery, with no reported regression. The response does not provide separate outcomes for each checklist step, device/browser versions or a photo; no additional per-step evidence is inferred. Physical printing remains unexecuted due to equipment unavailability. Other previously pending recovery, timing and load gates remain unchanged; this is not production/merge approval.

### Additional autonomous staging acceptance — 2026-10-01

The responsible human authorized the remaining recovery, session timing and bounded login-load tests. The environment and configured D1 were restricted to staging. No production operation or merge occurred. Sanitized evidence is retained in restricted local operational storage; passwords, invitations, cookies and infrastructure credentials are absent from this document and the evidence files.

#### Recovery and password lifecycle

The functional harness completed **12 checks, zero cleanup failures**, from 15:19:43 to 15:20:55 UTC. It used normal public application APIs for password changes, invitation acceptance and individual login. Emergency issuance used the reviewed `runAdmin` with the configured live D1 binding and an actual private TTY. The one-time delivery callback transferred the invitation directly in memory to the ordinary activation request; this tests the emergency procedure and application acceptance, not a second human terminal-copy exercise.

- Emergency issuance revoked the last Manager's credential and all its unrevoked sessions. Preflight refused the pending state with `NO_USABLE_MANAGER`, while `user_only` stayed active. Conscious reissuance invalidated the previous invitation; only the current invitation was accepted, once, without an automatic session. Normal Manager login then succeeded.
- The initial load attempt had 4 successful and 4 invalid logins. Read-only diagnosis established that the supplied Operator password matched, but the Manager had changed its password at 14:56:16 UTC. Recovery restored the Manager to the password supplied by the responsible human. The unknown subsequently changed password was not recovered or preserved. These initial invalid logins are excluded from successful latency measurements.
- An incorrect current password was refused with `CURRENT_PASSWORD_INVALID`. Normal Operator password rotation revoked both prior sessions and refused the old password; its replacement session worked. Normal own-password change then restored the supplied Operator password and revoked that temporary session.
- A Manager's administrative reset of itself returned `OWN_RESET_FORBIDDEN`; an Operator resetting the Manager returned `FORBIDDEN`.
- Manager reset made the Operator credential pending and immediately revoked its old session. Reissuing invalidated the prior invitation. Two simultaneous accepts of the current invitation produced exactly one HTTP200 and one HTTP400/`INVALID_INVITATION`; neither issued a session cookie. Ordinary login with the restored Operator password worked.
- Final state: two active accounts and credentials, original roles, both supplied passwords usable, preflight ready, `user_only` and original cutover timestamp unchanged. Audit counts since test start: two each of emergency issuance, accepted invitations, own-password changes and administrative resets. Temporary API sessions were logged out with zero cleanup failures. No order, payment or physical print was created by this harness.

The first administrative transport attempt returned D1 code7403; the configured account/database were confirmed and a subsequent identical read-only query succeeded. The exact cause of that transient response was not established; no infrastructure credential or configuration was changed.

#### Bounded login load

Successful measurement ran from 15:24:13 to 15:25:39 UTC. Each successful login was followed by normal logout. Both ordinary account logins were also verified afterward; all temporary API sessions were cleaned up.

| Concurrent requests | Samples | Successful | HTTP429 / other errors | p50 | p95 | p99 / maximum |
|---|---:|---:|---|---:|---:|---:|
| 1 | 8 | 8 | 0 / 0 | 2364.77 ms | 2580.55 ms | 2580.55 ms |
| 2 | 12 | 12 | 0 / 0 | 2415.19 ms | 2785.14 ms | 2785.14 ms |
| 4 | 16 | 16 | 0 / 0 | 2449.20 ms | 2807.31 ms | 2807.31 ms |

Concurrency1 alternated Manager/Operator; concurrency2/4 used Operator to avoid the four existing failed Manager reservations from the earlier password drift. No failure quota or limiter state was deleted. These are external HTTPS end-to-end times including network, D1 and password verification, not isolated Worker CPU. Small-sample p99 equals the observed maximum. No production SLO or capacity beyond the tested four concurrent requests is asserted.

#### Delayed browser responses

Two real Codex browser tabs shared the staging cookie store. Specific login/logout HTTP200 responses were paused at the documented Fetch response stage and then released; interception was cleared afterward. No cookie was fabricated or installed manually.

- Held a successful Manager login response, logged in normally as Operator in the other tab, then released the older response. Both tabs rediscovered Operator, with operational UI and no managerial sidebar; Minha conta identified Operador de Teste.
- Held an Operator logout response, confirmed normal Manager login in the other tab, then released the old logout response. Both tabs rediscovered Manager; Minha conta identified Gerente responsável. The old logout did not leave the newer trusted login incoherent.
- Emergency recovery also removed old Manager UI in both tabs without F5.

These observations cover delayed response delivery and identity rediscovery. Response-stage interception does not establish the exact order in which the browser installed Set-Cookie; it is not proof of every adversarial cookie schedule, interrupted password write, full-duration expiry or payment/print reconciliation.

#### Frontend regressions discovered during acceptance

An authenticated Operator reloading `/pedidos/novo` showed unavailable modalities despite HTTP200 bootstrap containing all three confirmed modalities. The App mounted NewOrder before the effective configuration cache accepted that bootstrap; NewOrder retained its initially empty modality. Focused reproduction also found that a valid client draft entered by direct route did not participate in the existing switch-user discard guard. Both corrections are required by the approved operational and draft-isolation spec. Review, official deployment and live retest are recorded in the next checkpoint; these findings are not counted as passed in this checkpoint.

### Scoped frontend correction — 2026-10-01

Commits `b5e82a7d716d384611cc0c18451ac067ad927bff` and `8e12361a9f2f5c52960148eb4e3dd0de7a133bea` correct initial confirmed-config readiness and direct-route draft ownership respectively. Only App and the new real-App regression tests changed. Backend authentication, roles, projections and policy validation were untouched. Missing config still has no invented defaults; a previously selected disabled modality still requires explicit review. Direct entry now uses the same draft controller as Novo pedido.

Separate failing reproductions were retained, followed by a combined focused gate: **49/49 pass**, zero skips/failures, architecture exit0, focused lint exit0 with 13 existing App warnings. Tests cover a full App remount on the direct route, normal entry, configured default and pristine baseline, absent config, disabled selected modality, direct-route keep/discard confirmation and delayed former-owner config after identity rediscovery. Independent scoped review approved spec compliance and quality with no actionable finding. The source commits were pushed to PR85; official deployment and live browser acceptance follow below.

[Official run36887918691](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36887918691) completed **success** on executable SHA `8e12361a9f2f5c52960148eb4e3dd0de7a133bea`, Worker version `b4e97864-aa5e-4b03-ae36-9de700c1b5f4`. Linux suite: **3158 total, 3157 pass, zero fail/cancel, one existing Windows-only skip**, 204915.638453 ms. All architecture/lint/build/local and remote migrations/dry-run/deployment gates passed. Auth smoke observed `user_only` on attempt1/6, PIN rejection HTTP401 and anonymous boundaries; all14 SPA/deep-link/asset checks passed. No auth rollback, production change or merge occurred.

Actual browser acceptance on that deployed version passed:

- Fresh normal Operator login, Novo pedido button: all three modalities rendered, confirmed Entrega selected, no unavailable-modality alert. A fictional client and Retirada were selected, one test item added, and the wizard advanced to review. No Salvar pedido/Salvar e receber submission occurred.
- Switch-user requested discard confirmation. Continuar na venda retained the client, modality and item. Cancelar venda also requested confirmation; confirmed discard returned to Pedidos.
- Direct `/pedidos/novo` navigation and intentional reload initialized the confirmed default with no previous client. Cancelling that pristine draft returned to Pedidos without a false discard prompt.
- A new direct-route draft with a different fictional client and Retirada requested the switch-user confirmation. Continuar na venda preserved that client and modality; a subsequent explicit discard cleared private UI and returned to the individual login screen.
- Normal Manager login then opened a new order with no Operator client/items and the confirmed default. Clean cancellation returned to Pedidos. Both original accounts remain usable; the browser is left in the Manager's team screen. Temporary extra browser tabs were closed and request interception cleared.

The before/after screenshots and scoped red/green/review/deploy evidence are retained locally. PR checks [run36887907788](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36887907788) also passed all eight test shards and validate on this source SHA. The recovery/load checks remain valid for this frontend-only correction; they were not duplicated unnecessarily.

This completes the authorized recovery/password/invitation, bounded load, two delayed-response scenarios and the resulting frontend regressions in this acceptance round. Physical printing remains unexecuted; TV retains the responsible human's functional acceptance. Full-duration expiry, other adversarial cookie/write schedules, accepted-payment/uncertain-print reconciliation and the simultaneous two-last-Managers scenario are not inferred from these results. Whole Task12 release acceptance and production/merge authorization remain separate.

### Concurrency, controlled expiry and accepted-payment recovery — 2026-10-01

The responsible human explicitly authorized the proposed next staging round. Deployed source remains `8e12361a9f2f5c52960148eb4e3dd0de7a133bea`; no product source, migrations, runtime configuration or production changed in this round. Private application API/real D1 checks completed **11 checks** from 16:29:35 to 16:33:25 UTC; final payment verification completed **one additional check** from 16:38:16 to 16:39:04 UTC. Both processes exited0 with zero cleanup failures. Sanitized evidence and credential-free harness source are retained in restricted operational storage. Passwords, cookies, invitations, verifier/hash values and infrastructure credentials were held only in process memory.

#### Two last usable Managers

A temporary account was created through the normal Manager invitation API and accepted once without automatic login. Its password remained only in memory. Each round started with exactly two active credentialed Managers with `access.users.manage`, using normal individual sessions. Their cross-target PATCH requests were dispatched concurrently.

| Changes requested simultaneously | Actual response pair | Usable Managers afterward |
|---|---|---:|
| Deactivate each other | HTTP401/UNAUTHENTICATED and HTTP200 | 1 |
| Downgrade each other to Operator | HTTP200 and HTTP401/UNAUTHENTICATED | 1 |
| Deactivate temporary Manager / downgrade original Manager | HTTP200 and HTTP401/UNAUTHENTICATED | 1 |

Exactly one change succeeded in each round. The losing actor's session was revoked by the accepted change; no HTTP409 is claimed for these live pairs. The surviving Manager restored the original account through normal PATCH and login before the next round. No direct role/credential SQL bypass was used. The temporary account was finally downgraded to Operator and deactivated; its audit history remains. Original Gerente/Operador accounts, roles and supplied passwords are intact. The original browser Manager session lost private UI and returned to login without F5 when revoked by the race.

#### Concurrent and interrupted password/login responses

These cases used the temporary account, leaving the original accounts' passwords unchanged in this round:

- Two normal own-password changes from separate valid sessions, with distinct new passwords, produced one HTTP200 and one HTTP401/UNAUTHENTICATED. Both old sessions and the original password were denied; the winning password allowed ordinary login.
- A successful own-password response body was deliberately discarded after its HTTP200 headers confirmed server commitment; its replacement cookie was not installed in a browser. The old session/password were refused and normal login with the new password recovered access. This tests lost response delivery after commitment, not interruption inside the database transaction.
- An old-password login raced a password change. The change succeeded; that login returned HTTP401/INVALID_LOGIN, leaving no usable obsolete session. Ordinary login with the new password worked.

The focused command `node --test --test-name-pattern='expire|password|concurrent|revocation|atomic' worker/access/sessions.test.js worker/access/users.test.js` separately passed **11/11**, zero skips/failures. It exercises exact expiry boundaries with a controlled clock, transaction rollback on injected storage failure, concurrent last-Manager protection, credential replacement/revocation and stale session rejection. These local tests are distinguished from live observations.

#### Actual shared/personal session expiry with a shortened deadline

Real individual login created each temporary-account session. Actual D1 `created_at`/`expires_at` differences were exactly **43200 seconds** for shared mode and **604800 seconds** for personal mode; authenticated reads changed neither deadline. A narrow administrative update shortened only the known test session's deadline to six seconds, matching business/user/session/token hash and the original expiry. The session authenticated before that deadline; afterward private bootstrap returned HTTP401 and session discovery reported anonymous `user_only`. An unrelated control session stayed authenticated. Neither a browser session nor another account's session was retimed.

This is actual deployed expiration enforcement with controlled test deadlines, supplemented by exact-clock local boundary tests. **No real 12-hour or seven-day elapsed-period observation is claimed.** Browser cookie installation/expiry schedules beyond the recorded cases remain distinct.

#### Lost order reply and accepted payment during user switching

One fictional order, **#295**, Retirada, **R$18.00**, was created normally as Operator with a unique test note and idempotency key. Its committed HTTP201 response body was deliberately discarded. After logout and fresh normal login, ordinary order reads reconciled the existing unpaid order. Only then an explicit same-key create replay was performed: it returned the same order ID; actual D1 retained **one order and one automatic print job**.

In the real browser, normal Operator UI registered the order's Pix payment. Its HTTP201 response was held at Fetch response stage. A second tab performed normal Trocar usuário/logout; both tabs returned to individual login and removed the old payment dialog/private UI. Normal Manager login in the second tab was confirmed in Minha conta before releasing the old payment response. Interception was then cleared. The primary tab retained the current Manager UI without reopening the old payment dialog. Fresh order detail showed **Pago · Pix**, Criado por/Recebido por Operador de Teste and total received R$18.00.

Independent post-scenario checks confirmed Pago through a fresh Operator API session and exactly **one payment, one receipt, one order-payment movement and one print job**. An explicit duplicate payment attempt as Manager returned HTTP409/`ORDER_ALREADY_PAID` and left all counts unchanged. No automatic payment replay or additional print job was observed. The before/after delivery case does not imply every network-failure schedule; no manual cookie fabrication occurred.

Order #295 is retained as labeled test evidence, paid and in preparation. Its single automatic print job remains awaiting printing; no physical print, retry, force, discard, cancellation or refund was executed. Physical printing/uncertain hardware delivery remains unexecuted as previously agreed. The temporary browser tab was closed, request interception cleared, temporary API sessions logged out, and the original tab left as Manager in Equipe e acessos. UI confirmed both original accounts active and the temporary account deactivated. Preflight was ready and `user_only`/the original cutover timestamp stayed unchanged.

The first private infrastructure attempt failed before any account/order mutation or passed check. A read-only CLI query returned D1 code7403; listing matched the configured staging database and a subsequent SELECT1 succeeded. The cause was not established. The test phase was restarted only after confirming that no mutation had been issued; successful evidence is separate from the retained initial failure. No infrastructure authentication/configuration change was intentionally made.

All scenarios in this authorized round passed without a new product defect. Remaining evidence limits are physical printing/recovery, real elapsed 12-hour/seven-day observation and cookie/network schedules not exercised here. This updates Task12 coverage; it does not authorize merge or production release.
