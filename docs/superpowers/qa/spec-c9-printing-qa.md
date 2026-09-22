# Spec C9 — Printing staging QA

**Branch:** `feature/spec-c9-printing`  
**PR:** #53  
**Last code-changing / staged SHA:** `c90ef83775cf3ca66771c1b6ae0cc27ec4516d71`  
**Latest staging deploy:** run `35512327093` — SUCCESS  
**Worker version:** `b88c06e5-2165-428e-8af7-d6ab8271fada`  
**Staging migrations:** none pending / none applied  
**Readiness:** 1/6  
**Login smoke:** HTTP 200  
**Production:** NOT DEPLOYED

## Release-policy decision — 2026-09-20

The project explicitly changed C9 acceptance timing so architecture work can continue through C10 without immediate physical printer access.

- Hardware/QZ-dependent cases may be marked `DEFERRED-PRODUCTION` for **C9 merge and C10 execution**.
- `DEFERRED-PRODUCTION` is not PASS.
- Production is hard-blocked until the final **post-C10 release candidate** is deployed to staging and every deferred functional case plus P1–P20 passes.
- A defect found in that round requires RED→GREEN, full Validate, staging redeploy and affected-case rerun before production authorization.

## Functional matrix

| # | Case | Status | Evidence / note |
|---:|---|---|---|
| 1 | PrintQueue desktop light/dark | PASS | Layout/states manually accepted before the later queue-only improvements; no affected regression introduced. |
| 2 | PrintQueue mobile | PASS | Cards/actions/modal usable on mobile. |
| 3 | Search | PASS | Retested after 300 ms debounce/cancel optimization; correct and responsive. |
| 4 | Status filter | PASS | Operational status filtering works; terminal history is opt-in. |
| 5 | Origin filter | PASS | Automatic/manual semantics preserved. |
| 6 | Sort | PASS | Immediate display ordering preserved. |
| 7 | Pagination | PASS | Retested after adjacent-page cache/prefetch; user reported it is fast. |
| 8 | Job details | PASS | Status/times/station/audit preserved. |
| 9 | Immutable ticket preview | PASS | Uses immutable job snapshot. |
| 10 | Prioritize | PASS | Retested after refresh optimization; success feedback works. Visual list order is intentionally independent of physical priority. |
| 11 | Discard | PASS | Retested faster; discarded jobs remain queryable via `Descartado` and now show an explicit neutral badge. |
| 12 | Retry known failure | DEFERRED-PRODUCTION | No suitable known-failure fixture; paired with physical P11. |
| 13 | Force print eligible case | PASS | Explicit action only. |
| 14 | Request second copy remotely | DEFERRED-PRODUCTION | Requires 1/2 state; paired with P2/P18. |
| 15 | Skip second copy | DEFERRED-PRODUCTION | Requires 1/2 state; paired with P10. |
| 16 | Unknown → printed | DEFERRED-PRODUCTION | Requires unknown physical outcome; paired with P12. |
| 17 | Unknown → not printed | DEFERRED-PRODUCTION | Requires unknown physical outcome; paired with P12. |
| 18 | Reprint one copy | DEFERRED-PRODUCTION | Requires suitable printed/history fixture; paired with P13. |
| 19 | Reprint two copies | DEFERRED-PRODUCTION | Requires suitable printed/history fixture and second-copy flow; paired with P13. |
| 20 | Recovery banner | DEFERRED-PRODUCTION | No recovery-state fixture; paired with P17. |
| 21 | Recovery defer/resume | DEFERRED-PRODUCTION | No recovery-state fixture; paired with P17. |
| 22 | Printing policy order 1/2 | PASS | Independent order default save works. |
| 23 | Printing policy table 1/2 | PASS | Independent table default save works. |
| 24 | Local no-table | DEFERRED-PRODUCTION | Current UI requires a table for Local; verify underlying contract with controlled fixture during physical gate, paired with P3. |
| 25 | Table-linked order | PASS | Table default 1/2 observed correctly. |
| 26 | Existing queued job after policy change | PASS | Existing `copies_requested` remains unchanged. |
| 27 | Station name/settings | PASS | Independent save works. |
| 28 | Make primary | PASS | Current-station primary switch and explicit confirmation verified. |
| 29 | Auto print toggle | PASS | Eligibility behavior verified. |
| 30 | QZ printer selection | DEFERRED-PRODUCTION | Requires eligible Windows/QZ station; verify persistence on final release candidate. |
| 31 | Test print UI | DEFERRED-PRODUCTION | Queue-only negative side verified; positive eligible QZ side deferred and paired with P9. |
| 32 | Queue-only device | PASS | Mobile exposes no physical QZ controls. |
| 33 | Offline | PASS | Retested after improvement: no false success / no raw `Failed to fetch`; mutations blocked offline. |
| 34 | Logout/login | PASS | No stale overlay/busy state resurrected. |
| 35 | Restricted capabilities | BLOCKED | Staging has no suitable restricted-capability identity. |
| 36 | Navigation/orders/history/table-service smoke | PASS | Printing public-contract actions remain available. |
| 37 | UTF-8 / light-dark / responsive smoke | PASS | No copy/visual regression observed. |

**Functional totals:** **24 PASS / 0 FAIL / 1 BLOCKED / 12 DEFERRED-PRODUCTION / 0 PENDING**

### Default `Todos` behavior

The default/“Todos” queue intentionally remains **operational-only**. It excludes terminal `printed` and `discarded` jobs so completed history does not pollute the active queue. Terminal history is available explicitly through the **Impresso** and **Descartado** status filters.

## Mandatory physical pre-production matrix

All rows below are currently **DEFERRED-PRODUCTION** and must be executed on the final post-C10 staging release candidate.

| # | Physical case | Current status | Required result |
|---:|---|---|---|
| P1 | Entrega/Retirada default 1 | DEFERRED-PRODUCTION | Exactly one physical copy |
| P2 | Entrega/Retirada default 2 | DEFERRED-PRODUCTION | 1/2 then 2/2 only after decision |
| P3 | Local without table | DEFERRED-PRODUCTION | Follows orderDefaultCopies; controlled fixture allowed |
| P4 | Table-linked order default 1 | DEFERRED-PRODUCTION | Exactly one copy |
| P5 | Table-linked order default 2 | DEFERRED-PRODUCTION | 1/2 then 2/2 |
| P6 | Table-tab summary default 1 | DEFERRED-PRODUCTION | Exactly one copy |
| P7 | Table-tab summary default 2 | DEFERRED-PRODUCTION | 1/2 then 2/2 |
| P8 | Explicit copies 1/2 | DEFERRED-PRODUCTION | Explicit value wins |
| P9 | Test print | DEFERRED-PRODUCTION | Exactly one copy |
| P10 | Skip second copy | DEFERRED-PRODUCTION | No 2/2 output |
| P11 | Known retry | DEFERRED-PRODUCTION | Does not repeat confirmed copy |
| P12 | Unknown result | DEFERRED-PRODUCTION | No automatic resend |
| P13 | Reprint | DEFERRED-PRODUCTION | New job, selected 1/2 copies |
| P14 | Policy change with pending job | DEFERRED-PRODUCTION | Old `copies_requested` preserved |
| P15 | QZ closed/offline | DEFERRED-PRODUCTION | Jobs stay safe |
| P16 | QZ/printer returns | DEFERRED-PRODUCTION | No unsafe backlog dump |
| P17 | Recovery with two jobs | DEFERRED-PRODUCTION | Same job remains affine through 2/2/skip before next |
| P18 | Remote requester | DEFERRED-PRODUCTION | Only primary PC prints |
| P19 | Physical non-ready state | DEFERRED-PRODUCTION | No new claim/send |
| P20 | SPOOLING without COMPLETE | DEFERRED-PRODUCTION | No silent retry/duplicate |

**Physical totals now:** **0 PASS / 0 FAIL / 20 DEFERRED-PRODUCTION**

## Merge vs production

C9 may proceed to final docs Validate and then explicit merge authorization with the state above. C10 may then start from the validated post-C9 master.

**Production may not proceed** until all 12 deferred functional rows and all P1–P20 are PASS on the final post-C10 staging release candidate.

## Final physical pre-production closure — 2026-09-21

The previously deferred hardware-dependent Printing gate was executed manually by the user against the current official staging release candidate:

- Deploy staging: **#198** / run `35671044737` — **SUCCESS**.
- Executable SHA: `720fc0a4af160a819ff4b01b77264ff0244eeaf7`.
- Worker version: `13c4d27c-b488-4655-9626-38906b739a12`.
- Readiness: attempt 1/6.
- Login smoke: HTTP 200.
- No Printing/QZ code changed after the earlier C9/print-queue homologations; this staging candidate contains the final merged runtime lineage.

User-reported manual result:

- previously deferred functional rows #12, #14–21, #24, #30 and #31: **12 PASS / 0 FAIL / 0 DEFERRED**;
- mandatory physical matrix P1–P20: **20 PASS / 0 FAIL / 0 DEFERRED**;
- no physical-printing defect was found in the final round;
- no RED→GREEN correction or staging redeploy was required.

**Final C9 release-gate totals:** functional deferred gate **12/12 PASS**; physical P1–P20 **20/20 PASS**.

The former `DEFERRED-PRODUCTION` state above remains as historical evidence of the approved C9/C10 sequencing policy. It is superseded for production readiness by this final closure.

**Production printing gate: CLEARED.**

