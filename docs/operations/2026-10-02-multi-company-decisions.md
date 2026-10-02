# Decisões da implementação multiempresa

Registro integral das decisões/deferimentos da execução Native, na ordem em que ocorreram. O custo/limite acompanha cada decisão.

- Task 1: Ruling: eight legacy test files used positional five-column businesses inserts — add explicit column lists to those fixtures because additive access_status makes positional inserts invalid; keep all existing assertions — cost if wrong: fixture setup could differ from the legacy schema, covered by the full suite.

- Task 2: Ruling: delivery schema did not yet track invitation emitter — extend the unpublished 0038 migration with emitter_id and scoped indexes, preserving the planned 0039 reference-guard number; no remote database has received 0038 — cost if wrong: an already migrated database would require a follow-up migration.

- Task 2: Ruling: spec requires scoped invitation quotas without defining numbers — default to 10 invitations/emitter and 30/company per 15 minutes, alongside the 80/day global quota, with service parameters for adjustment — cost if wrong: legitimate bursts may need larger configured limits.

- Task 3: Ruling: plan example uses businesses.B.id but the Task 1 fixture exposes string IDs — consume businesses.B directly, matching the declared businessId interface — cost if wrong: later examples would need the same fixture correction.

- Task 4: Ruling: automatic login selection needs the eligible-company query before Task 5 exposes memberships — introduce worker/tenancy/eligibleBusinesses.js now and reuse it from memberships later, avoiding duplicated SQL — cost if wrong: one extra helper module.

- Task 4: Ruling: one-event-loop timing assertion also blocked legitimate Web Crypto quota hashing — use the existing two-second failure watchdog while keeping private lookup/provider gates unresolved, with deterministic gate cleanup — cost if wrong: a timing regression may take up to two seconds to fail the test.

- Task 5: Ruling: concurrent new-email invitations may choose different provisional account IDs — resolve account IDs by normalized email within membership/invitation/quota SQL in the same transaction; add accountEmail quota option and require delivery account_id in unpublished 0038 — cost if wrong: schema already applied remotely would require a follow-up migration; no remote application has occurred.

- Task 5: Ruling: inactive state alone cannot distinguish never-accepted invitations — disable an invited membership via active=0 while keeping invited state; accepted memberships use inactive state, so reactivation cannot grant a never-accepted invitation — cost if wrong: UI must consistently interpret active and membershipState together.

- Task 6: Ruling: invitation preparation pre-read cannot see uncommitted company defaults — allow an internal creatingBusiness preparation only for a new pending company and its fixed built-in manager, retaining transactional SQL assertions after defaults — cost if wrong: this internal option must never become a public input.

- Task 7: Ruling: the plan example uses a minimal fixture context without hydrated platform grants — test the pure helper with explicit known grants and all API authorization against freshly loaded SQL sessions; no default grants or wildcard — cost if wrong: callers must hydrate the official context rather than reuse minimal fixture objects.

- Task 8: Ruling: new ownership/reference guards invalidate legacy tests that asserted only older constraint text or unchanged trigger inventory — accept the stronger named ownership constraint, test invalid platform shape through scope, and assert six additive print guards while preserving original schema comparison; explicitly bypass one insertion guard only inside the corrupt-state audit fixture after proving rejection — cost if wrong: that defensive fixture represents deliberately corrupted pre-guard state, not a valid post-migration database.

- Task 9: Ruling: QZ 2.2.6 passes an opaque SHA-256 hash to its signature callback (verified in installed primary source), which cannot prove tenant ownership alone — global signing requires the matched raw QZ request, authorizes print by its persisted own-company spool attempt and restricts device calls; Task 10 must capture raw payload through the supported QZ hashing hook before cutover — cost if wrong: a client without the paired payload is rejected after cutover; legacy flag-off signing stays compatible.

- Task 10: Ruling: The historical catalog/table-service/printing public-contract assertions enumerate exports exactly — expand them with the approved captured-client factories; keep all previous exports and Node-safe imports — cost if wrong: downstream consumers relying on an exact export inventory need the same additive update.

- Task 10: Ruling: Two source-ownership assertions require the historical ordersApi identifier — update only the identifier to clientsForContext.orders, retaining the official-effect, orchestration and idempotency assertions — cost if wrong: source assertions alone are weaker than the passing 45 real comanda integration cases.

- Task 13: Ruling: private existing-manager preparation also requires explicit ownershipVerified proof and can accept an already verified global identity without opening multi-company login during PREPARE — otherwise a shared administrator/manager email cannot meet pre-cutover readiness because public existing-account acceptance correctly requires a login — cost: the private operator must verify the intended manager outside the system; this exception never applies to the public panel or invitations.

- Task 13: Ruling: retire a colliding legacy login only when its exact user/company pair is in the persisted fictitious inventory; preserve its display name and historical references — unique company login otherwise prevents the explicitly authorized fresh global staging identity — cost: the old fictitious identifier no longer authenticates.

- Task 14: Ruling: real local D1 rejected the ten-term UNION preflight in unpublished 0039 although Node SQLite accepted it — split into ten individual guarded SELECT statements, preserving every foreign-reference check and atomic migration — cost if wrong: a partially applied migration must be inspected before retry; local D1 migration rollback is verified by the successful retry.

- Task 14: Ruling: four historical printing source assertions still used pre-context imported identifiers and consequently failed in the whole suite — update only the owner to api.method (including bootstrap slice anchor), preserving signed QZ, no replacement job, read-only bootstrap and no-refresh-before-popup assertions — cost if wrong: source checks are supplementary; real printing/API/QZ behavioral tests must stay green.

- Task 14: Ruling: workerd rejected the historical BUSINESS_ID constant exported by the configured Worker entry despite deploy dry-run succeeding — configure a minimal entry.js re-exporting only the default handler while preserving index.js helpers for tests/private CLI — cost if wrong: deployment tooling must use the reviewed wrangler main rather than assume index.js. New entry-contract test RED→GREEN; actual local runtime started.

- Final: Ruling: remote migration/cutover/private getPlatformProxy/readiness/logins were not judged by the reviewer — preserve explicit pending checkpoints and require private administrative credentials before remote work; local SQL preview is not remote proof — cost if wrong: delivery remains a draft until real staging acceptance.

- Final: Ruling: real Resend delivery/receipt/acceptance was not judged — no external email claimed or attempted without the private cutover process, use only the authorized inbox during acceptance — cost if wrong: provider/inbox integration may still expose a deployment issue.

- Final: Ruling: physical QZ and TV hardware were not judged — treat the automated owner/device contracts as local evidence only, retain hardware acceptance limits — cost if wrong: equipment or transport regressions remain possible.

- Final: Ruling: physical print pause and real channels across devices were not judged — preserve context-owner guards and browser/transport gates, require remote multi-tab/device acceptance — cost if wrong: timing outside simulated boundaries may need another fix before release.

- Final: Ruling: forced browser reload/closure during uncertain creation was not judged — retain account-bound attempts in application memory and the beforeunload warning; do not put names/emails in shared storage or claim forced-close recovery — cost if wrong: a user bypassing the warning loses local reconciliation state and must inspect the existing company before a new creation.

- Final: minor (deferred): Mesiva platform logo wordmark has insufficient contrast on the dark surface; visual polish deferred under the native final-review rule.

- Final: Ruling: production identity migration, billing, platform operational support and commercial suspension were not judged — keep them outside the approved onboarding scope — cost if wrong: those capabilities require a separate design and release.

- Final: Ruling: recovery of an author attempt can require returning from a newly discovered business scope to platform — allow only this authorized platform transition for an uncertain author attempt, with no pending HTTP operation or other effects, preserving the UUID and blocking normal departure — cost if wrong: this narrow transition must continue requiring official platform grants and server context validation.

- Final: Ruling: runtime flags remain off before remote acceptance — prepare the next-release editorial catalog in docs/releases rather than announce an unavailable feature in active notifications — cost if wrong: controlled release must promote that content to the active catalog before publishing.

- Final: Ruling: GitHub Spec B D1 gate compared the complete old printing schema against the additive tenant triggers and failed after all eight test shards passed — preserve all four historical data snapshots and every previous schema object exactly, then require the nine named additions to match reviewed 0039 SQL; reject missing/weakened/extra guards — cost if wrong: the explicit inventory must be deliberately updated for future approved schema changes, never broadened to ignore arbitrary triggers. Actual CI RED plus new comparator RED→GREEN 2/2; full suite and real local D1 gate rerunning.

- Final: Ruling: returning to the author after another account navigated away can leave an uncertain creation unreachable, and removed creation grants make reconciliation impossible — preserve the receipt, permit leaving when the author lacks required platform grants, and authorize only the original creation path for eligible author recovery with no other pending effects/drafts; rediscover platform normally before replay — cost if wrong: this navigation exception must remain limited to the same author and reviewed destination, with fresh server authorization for every replay. Extended real App/SQLite regression RED→GREEN in both before/after phases, including permission removal, identity-scope return, same key and one company. Whole suite rerunning.

- Remote: Ruling: staging also lacked approved email migration 0037 — apply 0037 together with additive 0038/0039 after private backup, because the reviewed bundle requires all three — cost if wrong: rollback must restore the compatible previous bundle and database checkpoint, rather than reverse flags after legacy finalization. All three applied successfully; historical row counts matched the backup.

- Remote: Ruling: Node accepts redirect:error while pinned workerd rejects it before provider I/O — use redirect:manual and reject every 3xx response, preserving fixed Resend origin and never forwarding authorization/challenge to a redirected origin — cost if wrong: future provider redirects require deliberate investigation instead of automatic forwarding. Real workerd RED→GREEN, six regressions, related 38/38, suite 3435/3435 and real Resend invitation delivery verified.

- Remote: minor (deferred): existing company linked privately to an already verified manager lacks firstManager metadata because the projection joins only an invitation row; list/detail say not prepared although access works. Ordinary panel-created company displays its manager correctly; informational bootstrap presentation item deferred.

- Remote: Ruling: disabling browser storage threw from default parameters before rendering could reach the session coordinator fallback — resolve optional storage access inside a guarded adapter, return null when unavailable, preserve failures for durable station configuration, and use it for QZ initialization and optional order-origin tracking — cost if wrong: unavailable device preferences stay unconfigured or ephemeral; automatic printing must not infer a saved printer. Real remote bundle reproduction plus Windows/Android actual-App regressions RED→GREEN, including focus-based company rediscovery; complete gates and remote repeat pending.
