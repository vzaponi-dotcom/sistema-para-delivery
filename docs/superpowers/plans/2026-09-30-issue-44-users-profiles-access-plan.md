# Issue 44 — Users, Profiles, and Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared business PIN with individual accounts, two fixed initial profiles, Worker-enforced authorization, trustworthy actor audit, and a controlled single cutover.

**Architecture:** D1 stores users, credentials, roles, grants, sessions, invitations, and audit events. The Worker resolves the current user and grants for each request, enforces capabilities at each endpoint, and projects responses before serialization. React consumes that context for navigation and workflows; access administration is a new bounded frontend domain.

**Tech Stack:** React 19, React Router 8, Cloudflare Worker, D1/SQLite migrations, Web Crypto PBKDF2-SHA256, Node `node:test`, existing `node:sqlite` D1 test harness.

**Spec:** `docs/superpowers/specs/2026-09-30-issue-44-users-profiles-access-design.md` (commit `0233615e`). Read it before Task 1. Its approved product decisions override implementation conveniences in this plan.

## Global Constraints

- Start implementation from the then-current integrated `master`, record its SHA, and reconcile this plan with routes added after `4c9dc297`. The issue #34 branch used for design was unmerged when the Spec was written.
- One business is configured server-side; never trust a client-supplied `business_id`. No multi-business selector.
- Profiles are `manager` and `operator` in V1; persist role grants for future editing, but expose no grant editor. Every grant is a known semantic capability, not a `roleName` check.
- Operator sees all operational orders/comandas, including per-order money and payment state, and may create/finalize/receive, create/update clients, and print routinely. Manager alone may cancel, refund, discount, backdate, transfer, delete clients, manage business data, discard/force printing, manage users, and view audit.
- Human login is identifier plus password. Minimum 15 characters, maximum at least 64, no arbitrary composition rules, local versioned blocklist, PBKDF2-SHA256 at 100,000 iterations with a unique 16-byte salt. Rate-limit by account and origin with a non-enumerating public error.
- Shared mode is the login default and expires absolutely after 12 hours; opt-in personal mode expires after seven days. Server decides expiration. Multiple sessions per user are allowed.
- Invitations last 24 hours, can be used once, store only token hashes, and do not authenticate the user upon acceptance. Mutations keep same-origin checks.
- Kitchen TV authentication remains separate. Automatic printing still requires a human session; no autonomous station credential in V1.
- Preserve existing order/payment/printing idempotency and uncertain-result recovery. No automatic replay on logout, role change, or session expiry.
- No old actor backfill. No production cutover, remote migration, merge, or deployment without their normal review and explicit release approval.

## Review Focus

These five cases are easy to miss when implementing the Spec. Their owning tasks contain explicit tests.

1. Two managers simultaneously try to remove each other's manager access: one request must fail and one active account with `access.users.manage` must remain (Task 4).
2. The same invitation is accepted twice concurrently or after a replacement invitation: exactly one credential change succeeds (Task 2).
3. An operator payment succeeds but its response or subsequent bootstrap includes raw `movements` or `financeSettings`: the operation succeeds and those fields remain absent (Task 6).
4. A forged `actorLabel` on a print recovery request or a session switch during an uncertain print: audit keeps the authenticated actor and no second physical submission occurs (Tasks 7–8).
5. A role is changed between route resolution and an in-flight response: the Worker denies later requests, and the frontend discards the previous user's stale response rather than painting protected data (Tasks 3, 9).

---

## File and interface map

| Unit | Files | Responsibility |
|---|---|---|
| Schema/catalog | `migrations/0035_users_profiles_access.sql`, `shared/settingsAccess.js`, `worker/access/roles.js` | Tenant-bound records, explicit default role grants, known capability keys. |
| Credentials/invites | `worker/access/credentials.js`, `worker/access/invitations.js`, `worker/access/passwordBlocklist.js` | Password verification and single-use enrollment/reset. |
| Sessions | `worker/auth.js`, `worker/access/sessions.js`, `worker/index.js` | Business auth mode, human cookie, user context, revocation and legacy isolation. |
| Access administration | `worker/access/users.js`, `worker/access/api.js` | Manager user operations, own password change, invariants, invitations. |
| Authorization | `worker/access/authorization.js`, `worker/index.js`, existing domain API handlers | Per-method grants and compound payload checks; deny by default. |
| Data projection | `worker/access/projections.js`, `worker/repositories.js`, response call sites | Restrict bootstrap, orders/history and mutation effects before serialization. |
| Printing | `worker/orderPrintingApi.js`, printing repositories | Routine versus discard/force grants; authoritative actor; station/job eligibility. |
| Audit | `worker/access/audit.js`, affected mutation repositories | Atomic event statement, actor attribution, manager activity query. |
| Frontend runtime | `src/infrastructure/auth/sessionApi.js`, `src/app/runtime/session/useSessionRuntime.js`, `src/app/shell/*`, `src/App.jsx` | Human login, shared/personal choice, switch, expiry, stale-response clearing. |
| Frontend access | `src/domains/access/*`, `src/app/navigation/*`, `src/app/surfaces/settings/*` | Team, profile read-only summary, own password, activity, route guards. |
| Cutover | `worker/access/cutover.js`, `scripts/infra/issue-44-*`, QA record | Enrollment preflight, one-way cutover, emergency invite and staging evidence. |

No new dependency is needed for V1. Use the existing `createSettingsDb()` migration harness and request-level Worker tests; keep the access subsystem inside `worker/access` instead of enlarging `worker/index.js` with new business rules.

## Task order and production boundary

Tasks 1–10 are independently testable commits, but do not enable `user_only` on production. Task 11 implements and tests the switch. Task 12 is the release gate. Keep the legacy code path only under explicit `legacy`/`enrollment` state; delete broad fallback behavior for `user_only`. No partial production release with only hidden buttons.

### Task 1: D1 schema and explicit built-in role grants

**Files:** Create `migrations/0035_users_profiles_access.sql`, `worker/access/roles.js`, `worker/access/roles.test.js`, `worker/access/migration.test.js`; modify `shared/settingsAccess.js`.

**Interfaces:** `normalizeLogin(input: string): string`; `seedBuiltinRoles(db, businessId: string, now: Date): Promise<void>`; `loadRoleGrants(db, businessId: string, roleId: string): Promise<Set<string>>`. Seed `manager` with every known grant explicitly and `operator` with the exact Spec §6 list. Add `clients.create/update/delete`, `printing.force`, `orders.backdate`, `access.users.view/manage`, `access.audit.view`; retire `clients.manage` only after consumers migrate.

- [ ] **Step 1: Write failing schema/role tests.** Assert existing businesses start in `legacy`; tables, tenant FKs, unique normalized login and indexes exist; manager/operator seed is idempotent; unknown grants are ignored; operator has `payments.receive` but not `payments.refund` or `finance.movements`.
- [ ] **Step 2: Run red.** `node --test worker/access/migration.test.js worker/access/roles.test.js` → FAIL for missing migration/modules.
- [ ] **Step 3: Implement migration and interfaces.** Include `users`, `user_credentials`, `roles`, `role_capabilities`, `access_invites`, `login_attempts`, `audit_events`, `business_auth_state`, nullable `sessions.user_id` and `sessions.device_mode`. Use tenant-scoped composite keys/FKs where cross-business assignment is possible; index bounded login-attempt cleanup and audit queries.
- [ ] **Step 4: Run green.** Same command → PASS; `node --test worker/businessProfileMigration.test.js` → PASS.
- [ ] **Step 5: Commit.** `git add migrations/0035_users_profiles_access.sql shared/settingsAccess.js worker/access/roles.js worker/access/roles.test.js worker/access/migration.test.js`; `git commit -m "feat(access): add users and role grants schema"`.

### Task 2: Passwords, invites and initial manager enrollment

**Files:** Create `worker/access/credentials.js`, `worker/access/invitations.js`, `worker/access/passwordBlocklist.js` and their `*.test.js`; modify `worker/index.js` only to dispatch the narrow invitation acceptance endpoint.

**Interfaces:** `hashHumanPassword(password: string): Promise<string>` and `verifyHumanPassword(password: string, verifier: string): Promise<boolean>` preserve version/salt/cost; `issueAccessInvite(db, { businessId, userId, purpose, issuedBy, now }): Promise<{ token, expiresAt }>`; `consumeAccessInvite(db, { token, password, now }): Promise<{ userId }>`; `POST /api/access/invitations/accept` accepts one token and password, sets credential atomically, and never creates a session.

- [ ] **Step 1: Write failing tests.** Assert 14-character and blocked passwords fail; 15-character valid password verifies; wrong password fails; accepted invite cannot be reused, expired, or replaced; two concurrent accepts produce one success; no token/password appears in persisted or returned account data.
- [ ] **Step 2: Run red.** `node --test worker/access/credentials.test.js worker/access/invitations.test.js` → FAIL.
- [ ] **Step 3: Implement credential hashing, local versioned blocklist and atomic invite use.** One-use token is random, hashed, valid 24 hours, and delivered only once to caller; initial manager invite is generated through the controlled Task 11 command, not by knowledge of the shared PIN.
- [ ] **Step 4: Run green.** Same command → PASS; add request test for generic invalid/expired invitation and same-origin mutation in `worker/access/invitations.test.js` → PASS.
- [ ] **Step 5: Commit.** Commit only Task 2 files with `feat(access): add password and invitation lifecycle`.

### Task 3: User-bound login, session modes and revocation

**Files:** Create `worker/access/sessions.js`, `worker/access/sessions.test.js`, `worker/access/loginThrottle.js`, `worker/access/loginThrottle.test.js`, the minimal `worker/access/audit.js` security-event helper and its focused test; modify `worker/auth.js`, `worker/auth.test.js`, `worker/index.js`, `worker/settingsAccess.js`. Task 8 extends the same audit module for business events.

**Interfaces:** `createUserSession(env, { businessId, userId, deviceMode, now }): Promise<{ token, sessionId, expiresAt }>`; `authenticateHumanRequest(request, env, now): Promise<AccessContext|null>` where `AccessContext = { businessId, userId, sessionId, displayName, roleName, granted: Set<string>, deviceMode }`; `revokeUserSessions(db, businessId, userId, now): Promise<void>`; `checkLoginThrottle(db, { businessId, normalizedLogin, originKey, now }): Promise<{ allowed, retryAfterSeconds }>` records account/origin attempts without account enumeration. `/api/auth/login` accepts `{ identifier, password, deviceMode }` in `enrollment`/`user_only`; `/api/auth/session` returns user and current grants. Legacy PIN is accepted only in `legacy`/`enrollment`, with no `access.*` grants.

- [ ] **Step 1: Write failing tests.** `shared` expires exactly at login +12 hours, `personal` at +7 days; inactive/changed-role user is denied on the next request; reset revokes all devices; voluntary logout revokes only current session; `enrollment` manager can reach access administration but not operations; `user_only` rejects a legacy cookie and PIN. Failed logins throttle per normalized account and origin without confirming account existence or blocking every coworker; success, failure and block emit secret-free security events.
- [ ] **Step 2: Run red.** `node --test worker/access/sessions.test.js worker/access/loginThrottle.test.js worker/auth.test.js` → FAIL.
- [ ] **Step 3: Implement session/context resolution and login throttling.** Keep secure opaque cookie/hash. Revalidate active user and grants each request. Remove the all-capabilities fallback for a `user_only` session; keep a constrained legacy adapter only for pre-cutover modes. Replace the business-wide limiter as the sole human-login defense.
- [ ] **Step 4: Run green.** Same command → PASS; `node --test worker/settingsApi.test.js` → PASS after updating legacy fixtures to explicit auth mode.
- [ ] **Step 5: Commit.** Commit Task 3 files with `feat(access): bind sessions to active users`.

### Task 4: Team administration and last-manager invariant

**Files:** Create `worker/access/users.js`, `worker/access/api.js`, `worker/access/users.test.js`, `worker/access/api.test.js`; modify `worker/index.js`.

**Interfaces:** `handleAccessApi(request, env, context, url): Promise<Response|null>` exposes `GET/POST /api/access/users`, `PATCH /api/access/users/:id` (name, role or active state), `POST /api/access/users/:id/reset`, `POST /api/access/me/password`; `listUsers`, `createUser`, `updateUser`, `requestCredentialReset`, `changeOwnPassword` in `users.js`. Only manager capabilities govern other users; own password requires current password. No user deletion.

- [ ] **Step 1: Write failing tests.** Operator gets 403; manager creates account/invite, reassigns, disables, resets; user/role from another business gets 404; same identifier after trim/case normalization gets 409; two managers concurrently remove each other's access and at least one remains. An invited or reset-pending manager cannot substitute for the last activated manager. Own reset cannot bypass the current-password requirement; own password change revokes other sessions and rotates current token; concurrent credential change makes the old-password operation roll back.
- [ ] **Step 2: Run red.** `node --test worker/access/users.test.js worker/access/api.test.js` → FAIL.
- [ ] **Step 3: Implement API and transactional invariant.** Check active users with active credentials and roles containing `access.users.manage` inside the D1 write transaction; role change/disable/reset revokes target sessions. Compose invite/session/audit prepared statements in the same batch. Never trust `businessId` or actor ID in request body; only modify fields actually requested, preserving concurrent unrelated changes.
- [ ] **Step 4: Run green.** Same command → PASS, including concurrent final-manager test.
- [ ] **Step 5: Commit.** Commit Task 4 files with `feat(access): administer individual users`.

### Task 5: Guard every operational mutation and sensitive read

**Files:** Create `worker/access/authorization.js`, `worker/access/authorization.test.js`, `worker/access/routeCoverage.test.js`; modify `worker/index.js`, `worker/settingsApi.js`, `worker/businessProfileApi.js`, `worker/reporting/api.js`, `worker/kitchenTvApi.js` only where coverage or context needs adjustment; update existing request tests.

**Interfaces:** `requireCapability(context, key: string): void`; `requireAnyCapability(context, keys: string[]): void`; `authorizeOrderCreate(context, input): void` enforces `orders.create` plus `payments.receive` for allocations, `orders.discount` whenever a price adjustment is included, `orders.backdate` for retroactive orders. The route coverage test owns the exact core/settings/reporting/Kitchen TV methods in Appendix A.

**Task 5 ruling (2026-09-30):** The canonical `adjustment.type = 'none'` envelope represents no adjustment and remains allowed for operators, including its usual zero value. Every `discount` or `surcharge` adjustment requires `orders.discount`, including an explicit zero value. Retroactivity is checked from the server's São Paulo business date as well as an explicit `isBackdated` request. Reservation edits apply the same compound checks, and cancellation with `refundNow` also requires `payments.refund`.

- [ ] **Step 1: Write failing request-table tests.** For each Appendix A core route, assert operator allow/deny, manager allow, empty grants 403, wrong business cannot access target. Direct `POST /api/orders` with payment, any adjustment including zero-valued, or `isBackdated` must fail when only `orders.create` is granted. `POST /api/clients` and PATCH pass for operator, DELETE fails.
- [ ] **Step 2: Run red.** `node --test worker/access/authorization.test.js worker/access/routeCoverage.test.js` → FAIL on currently session-only endpoints.
- [ ] **Step 3: Add checks at the Worker handlers before reads/writes.** Split client CRUD grants end-to-end and keep descriptor-specific settings/reporting grants. Unknown route/method yields 404; known but ungranted route yields 403. No frontend-only authorization.
- [ ] **Step 4: Run green.** Same command plus `node --test worker/settingsApi.test.js worker/reporting/api.test.js worker/kitchenTvApi.test.js` → PASS.
- [ ] **Step 5: Commit.** Commit Task 5 files with `feat(access): enforce operational route capabilities`.

### Task 6: Project bootstrap and mutation effects before serialization

**Files:** Create `worker/access/projections.js`, `worker/access/projections.test.js`; modify `worker/repositories.js`, `worker/index.js`, `worker/effectiveBusinessConfig.js`, `src/app/runtime/data/useOperationalDataRuntime.js` and focused tests.

**Interfaces:** `projectBootstrap(payload, granted: Set<string>): object`; `projectOrderList(orders, granted): object[]`; `projectMutationEffects(payload, granted): object`. `orders.view` exposes active orders, `orders.history` terminal orders; `comandas.view` controls table tabs; no finance `movements`, `financeSettings`, balances, reports or receipt collection for operator. Per-order amount/payment state remains.

- [ ] **Step 1: Write failing raw-JSON tests.** Operator bootstrap and payment response omit `movements`/`financeSettings`, even when payment succeeded; empty grants omit all private collections; history-only role sees no active orders; `businessId=other` query does not change owner; role change while bootstrap is in flight cannot paint old data in UI.
- [ ] **Step 2: Run red.** `node --test worker/access/projections.test.js src/app/runtime/data/useOperationalDataRuntime.test.js` → FAIL.
- [ ] **Step 3: Implement server projections and frontend effect adaptation.** Project before `json(...)`, not after sending broad payload; key effective config/cache by user and grants. Preserve payment confirmation without exposing movement rows.
- [ ] **Step 4: Run green.** Same command plus `node --test worker/businessPolicyIntegration.test.js` → PASS.
- [ ] **Step 5: Commit.** Commit Task 6 files with `feat(access): project operational data by grant`.

### Task 7: Printing permission split and trusted actor source

**Files:** Modify `worker/orderPrintingApi.js`, `worker/orderPrintingRepository.js`, `worker/orderPrintingCentralClaim.js`, `worker/access/projections.js`, the two comanda print handlers in `worker/index.js`, printing HTTP/physical regression tests, `src/domains/printing/ui/PrintQueue.jsx` and its tests, and the minimal `src/App.jsx` -> orders/history -> `OrderDetail.jsx` force-grant consumers/tests. Add `worker/access/printingAuthorization.js`, `worker/access/printingAuthorization.test.js` and `worker/access/printingTestSupport.js`. Existing `worker/printAttemptRepository.js` receives the trusted label through its unchanged interface; Task 8 owns transactional stable identity events.

**Interfaces:** `printing.execute` grants claim/attempt/complete/fail/retry/reprint/routine recovery and QZ signing; full operational documents also require their matching current order/comanda read grant in every document-bearing response. `printing.queue` grants safe queue metadata, without implicitly granting a complete print snapshot; `printing.discard` grants all discard forms; `printing.force` grants force-print and prioritize; `printing.station.configure` grants configuration. Actor for manual actions is `context.userId/displayName`, never `body.actorLabel`. Automatic actions retain `system` plus station context.

- [ ] **Step 1: Write failing tests for every printing route in Appendix A.** Operator may reprint and resolve an uncertain outcome, but gets 403 for discard, force, prioritize, station configuration; no grant gets 403 for QZ sign/certificate; forged `actorLabel` cannot become stored actor; invalid station/job ownership still fails. Queue-only grants expose safe metadata; execute without the matching active/history/comanda read grant cannot expose a complete operational document through queue, claim, recovery or mutation responses.
- [ ] **Step 2: Run red.** `node --test worker/access/printingAuthorization.test.js worker/orderPrintingHttp.test.js` → FAIL for unguarded routes.
- [ ] **Step 3: Apply guards and authoritative actor context.** Do not relax existing station affinity, two-copy, physical confirmation or uncertain-result state transitions; client labels may remain presentation-only legacy fields, not audit identity.
- [ ] **Step 4: Run green.** Same command plus `node --test worker/orderPrintingReprintHttp.test.js worker/orderPrintingPriorityHttp.test.js worker/kitchenTvSecurityRegression.test.js` → PASS.
- [ ] **Step 5: Commit.** Commit Task 7 files with `feat(access): guard printing and bind manual actors`.

### Task 8: Transactional audit and manager activity API

**Files:** Extend `worker/access/audit.js` and its tests from Task 3; create `worker/access/activityApi.test.js`, `worker/access/attribution.js`, `worker/access/attribution.test.js`, `worker/access/businessAudit.test.js`, `shared/auditActions.js`, `migrations/0036_audit_resource_attribution.sql` (resource lookup index only) and `worker/test-support/auditSchema.js`; modify `worker/access/api.js`, `worker/index.js`, `worker/auth.js`, `worker/access/invitations.js`, `worker/access/users.js`, permitted order/payment/printing read projections and mutation repositories for orders, payments, cancellations, table transfers, reservations, clients, products, finance, settings, kitchen TV, users and printing, plus their affected tests and SQLite fixture support.

**Interfaces:** `prepareAuditEvent(db, context, { action, resourceType, resourceId, outcome, metadata, now }): D1PreparedStatement`; `listActivity(db, businessId, { userId, from, to, type, cursor, limit }): Promise<{ items, nextCursor }>`; `loadOrderAttributions(db, businessId, orderIds): Promise<Map<string, object>>` loads only actor type/ID/display snapshot for creation, finalization and payment of already-permitted orders. Permitted printing details also project bounded actor type/ID/display snapshots from resource-linked events; report the exact response interface for Task 10. `GET /api/access/activity` requires `access.audit.view`. Human ID comes from context; historical records with no actor show legacy/unknown; automatic print uses system actor with validated registered station context. Operational attribution never exposes session IDs or the unrestricted activity feed.

- [ ] **Step 1: Write failing tests.** Mutation and event either both commit or both roll back; created order/payment/refund/transfer/print action retains stable actor ID and display snapshot; password/token never appears in event; operator cannot query activity; paging/filtering stays within business. Permitted order details expose creation/payment/finalization actors after renaming/deactivation without exposing the activity feed; legacy and system actors remain truthful. Include forged `actorLabel` and repeated idempotency key: no duplicate business event. Failed login, blocked login, session revocation and access denial create minimal security events without secrets.
- [ ] **Step 2: Run red.** `node --test worker/access/audit.test.js worker/access/activityApi.test.js` → FAIL.
- [ ] **Step 3: Add audit statements to existing D1 transactions.** Keep event payload small. Official D1 mutation and audit must share the same batch and fail together; compensation cannot replace that atomicity. Preserve adjacent credential-consumption and recovery station-CAS/job-claim statement pairs that use `changes()`; append audit after each pair. Fix the existing bulk-discard station cleanup exceeding 100 D1 binds for more than 98 jobs while keeping all mutations/events atomic, with a realistic bulk regression. Bound attribution lookups by the same platform limit. Physical print effects record intent and observed outcome separately without claiming uncertain delivery was confirmed. Read activity through indexed, bounded queries.
- [ ] **Step 4: Run green.** Same command plus `node --test worker/orderCancellationHttp.test.js worker/orderPrintingHttp.test.js` → PASS.
- [ ] **Step 5: Commit.** Commit Task 8 files with `feat(access): record authoritative action history`.

### Task 9: Human login, switch and session-safe frontend runtime

**Files:** Modify `src/infrastructure/auth/sessionApi.js`, `src/app/runtime/session/useSessionRuntime.js`, `src/app/shell/LoginScreen.jsx`, `src/app/shell/AppRoot.jsx`, `src/app/shell/OperationMenu.jsx`, `src/app/shell/AppShell.jsx`, `src/App.jsx` and adjacent tests. Also modify `src/app/shell/AppTopBar.jsx`, navigation registry/resolution/controller/context/route gate, `src/app/useEffectiveBusinessConfig.js`, operational runtime error dispatch, existing order/customer/catalog/finance/table-service command owners, existing payment/refund workflows, existing printing manager ownership, browser session coordination and adjacent behavioral/regression tests.

**Interfaces:** `login({ identifier, password, deviceMode })`; `src/App.jsx` composes `handleSwitchUser` through the existing draft/payment/print guards before the session runtime revokes and clears the current login; session context carries user, grants and generation. Operation menu shows name, Minha conta, Trocar usuário and Sair. Anonymous screen never shows previous user's data.

- [ ] **Step 1: Write failing UI/runtime tests.** Login defaults shared and sends identifier/password/mode; personal is opt-in; permission change and 401/403 navigation cannot flash restricted page; switch with dirty order asks before discarding; accepted payment and uncertain print are not replayed; stale response from former user is ignored.
- [ ] **Step 2: Run red.** `node --test src/infrastructure/auth/sessionApi.test.js src/app/runtime/session/useSessionRuntime.test.js src/app/shell/OperationMenu.test.js` → FAIL.
- [ ] **Step 3: Implement login/switch and context propagation.** Reuse current route guards, data reset, generation and print recovery contracts rather than mounting a second app runtime.
- [ ] **Step 4: Run green.** Same command plus `node --test src/actionCapabilities.test.js src/app/shell/AppShell.test.js` → PASS.
- [ ] **Step 5: Commit.** Commit Task 9 files with `feat(access): add individual login and safe user switch`.

### Task 10: Team, own account and activity surfaces

**Files:** Create `src/domains/access/infrastructure/accessApi.js`, `src/domains/access/ui/TeamAccess.jsx`, `src/domains/access/ui/ActivityLog.jsx`, `src/domains/access/ui/MyAccount.jsx`, `src/domains/access/ui/InvitationAccept.jsx` and focused tests; modify `src/app/navigation/registry.js`, `src/app/surfaces/settings/SettingsHome.jsx`, `src/app/surfaces/settings/SettingsSurface.jsx`, `src/app/shell/OperationMenu.jsx`, `src/App.jsx`, customer UI command gates, `src/domains/orders/ui/components/OrderDetail.jsx`, `src/domains/printing/ui/printQueueDetails.js` and their attribution tests.

**Interfaces:** Routes `/configuracoes/equipe`, `/configuracoes/atividades`, `/minha-conta`, public `/ativar-conta`; access API covers users, invitation/reset acceptance, own password and filtered activity. Invitation page accepts a pasted one-use token and password, then returns to login without authentication. Team page shows immutable V1 profile grant summary, account status and one-time invitation. Activity page paginates/filter server data. Customer create/update controls use separate grants; delete remains manager-only. Order/payment/print details present the server attribution from Task 8 with distinct legacy/system labels.

- [ ] **Step 1: Write failing UI tests.** Operator cannot see team/activity controls or open direct URLs; manager can create/deactivate/reset; last-manager 409 preserves view; invite token shown once; anonymous recipient sets password with valid invitation and returns to login, invalid/expired/reused tokens produce recoverable feedback; activity filters by user/date/type; both roles can change own password; operator can quick-create/edit client but cannot delete.
- [ ] **Step 2: Run red.** `node --test src/domains/access/ui/TeamAccess.test.js src/domains/access/ui/ActivityLog.test.js src/domains/access/ui/MyAccount.test.js src/actionCapabilities.test.js` → FAIL.
- [ ] **Step 3: Implement screens, API adapters and route composition.** Preserve focus, mobile layout, light/dark styles and existing settings draft guards; no profile editor or client-side role authorization.
- [ ] **Step 4: Run green.** Same command plus `node --test src/app/navigation/registry.test.js src/app/surfaces/settings/SettingsSurface.test.js` → PASS.
- [ ] **Step 5: Commit.** Commit Task 10 files with `feat(access): add team and activity management UI`.

### Task 11: Enrollment preflight, one-way cutover and emergency recovery

**Files:** Create `worker/access/cutover.js`, `worker/access/cutover.test.js`, `scripts/infra/issue-44-access-admin.mjs`, `scripts/infra/issue-44-access-admin.test.js`; modify `worker/index.js` and deployment runbook under `docs/operations/`.

**Interfaces:** `preflightCutover(db, businessId): Promise<{ ready, failures: string[] }>` checks persisted identity and grant state; `cutoverBusinessAuth(db, businessId, now): Promise<void>` switches `enrollment` → `user_only` and revokes all null-user sessions atomically; CLI commands `issue-initial-manager`, `preflight`, `cutover`, `issue-emergency-invite` require infrastructure administrator access and log non-secret action. Route coverage and response projection are separate required code/QA gates in Tasks 5–6 and 12. No CLI command prints a password or re-enables the legacy PIN.

- [ ] **Step 1: Write failing tests.** Cutover refuses zero activated managers, incomplete credentials, or empty grants; successful cutover revokes old sessions and rejects old PIN; retry is idempotent; emergency invite is one-use and audited; simulated failure leaves auth mode/legacy sessions unchanged.
- [ ] **Step 2: Run red.** `node --test worker/access/cutover.test.js scripts/infra/issue-44-access-admin.test.js` → FAIL.
- [ ] **Step 3: Implement controlled CLI, preflight and atomic state transition.** Recheck activated-manager and grant readiness within the same write transaction that changes auth mode and revokes legacy sessions. Run migration/enrollment on staging first; document exact operator steps, communication to employees, backup and no automatic PIN rollback.
- [ ] **Step 4: Run green.** Same command plus `node --test worker/access/sessions.test.js` → PASS.
- [ ] **Step 5: Commit.** Commit Task 11 files with `feat(access): add controlled account cutover`.

### Task 12: Whole-system and staging acceptance

**Files:** Create `docs/superpowers/qa/2026-09-30-issue-44-access-qa.md`; update only findings-driven tests/fixes in their owning files.

**Interfaces:** QA ledger records exact implementation SHA, migration state, actor matrix, device setup, date, expected/actual result and unresolved risks. Do not mark production ready from automated tests alone.

- [ ] **Step 1: Run the full local gate.** `npm test`, `npm run lint`, `npm run test:architecture`, `npm run build` → all exit 0. Fix concrete failures in their owning task; rerun the failed gate.
- [ ] **Step 2: Review Appendix A against the implementation SHA.** Every `worker/index.js`, `orderPrintingApi.js`, `settingsApi.js`, `businessProfileApi.js`, `reporting/api.js` and `kitchenTvApi.js` route is mapped; new routes are added to the matrix and tests before cutover.
- [ ] **Step 3: Homologate staging.** Exercise manager/operator and shared/personal browsers; inspect raw bootstrap/network responses, direct forbidden APIs/URLs, immediate revocation, invitation/recovery, last-manager race, Kitchen TV pairing, physical print/recovery, payment idempotency and expiry during a shift. Measure login verification latency under representative concurrent load.
- [ ] **Step 4: Record evidence and reconcile.** Save outcomes in the QA ledger, fix observed defects, rerun relevant tests, and record the exact SHA. Commit only the ledger and verified fixes.
- [ ] **Step 5: Release handoff.** Ask for separate approval before merge, remote production migration or production cutover. Preserve the first-manager invitation delivery and emergency recovery procedure in the operations runbook.

## Appendix A — endpoint policy inventory to test

The test in Task 5 is a literal method/path table, not a text search for `requireCapability`. The printing set is owned by Task 7. For every row, assert grant and no-grant behavior, plus business scoping for parameterized resources. Authentication endpoints have their own session/enrollment tests. If a handler gains a route after the recorded base SHA, append it here before writing its guard.

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
| `POST /api/printing/jobs/discard-pending`, `/discard-operational`, `/jobs/:id/discard` | `printing.discard`. |
| `POST /api/printing/jobs/:id/prioritize`, `/force-print` | `printing.force`. |
| `GET/POST /api/access/users`, `PATCH /api/access/users/:id`, `POST /api/access/users/:id/reset`, `GET /api/access/activity` | `access.users.view/manage` by method; `access.audit.view` for activity. |
| `POST /api/access/me/password`; `POST /api/access/invitations/accept` | Authenticated user + current password; single-use invitation token, respectively. |

## Handoff

The implementation path is one integrated sequence because session identity, API protection and projection must all pass before the PIN cutover. Code may be developed and tested in earlier tasks, but production activation is atomic at Task 11. After this plan is reviewed, choose native or subagent-driven execution; do not start implementation from the document branch.
