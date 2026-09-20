# Spec C10 — Architecture Closure Execution

**Branch:** `feature/spec-c10-architecture-closure`  
**Base/master:** `2b5060c8293fec6756b286627212b740b3147e53`  
**Status:** **DESIGN APPROVED / PLAN DRAFT FOR APPROVAL / NOT STARTED**  
**Production:** NO DEPLOY

## C9 handoff

- C9 PR #53 merged to master at `2b5060c8293fec6756b286627212b740b3147e53`.
- Post-merge Validate #1513 / run `35514989203`: SUCCESS.
- Suite: **1,911 tests / 1,910 pass / 0 fail / 1 skipped**.
- C9 functional QA: **24 PASS / 0 FAIL / 1 BLOCKED / 12 DEFERRED-PRODUCTION / 0 PENDING**.
- Physical P1–P20: **20 DEFERRED-PRODUCTION**.
- Production remains blocked until the final post-C10 staging candidate passes the deferred C9 release gate.

## Initial C10 dependency audit

Remaining production ownership debts:
- `src/api/client.js` and `src/api/effectiveConfigClient.js`;
- `src/pages/Dashboard.jsx` and `src/utils/dashboardAnalytics.js`;
- generic production ownership still split across `src/components/`, `src/hooks/` and `src/utils/`;
- `src/hooks/useMediaQuery.js` is a frontend-shared hook candidate;
- `src/utils/formFormatting.js` is a pure multi-domain helper and is currently imported by Catalog `domain/`;
- `src/utils/dataSync.js` is runtime-owned;
- login/theme/connection presentation in `src/components/` is app-shell-owned;
- payment/printing/Dashboard-only presentation modules in `src/components/` have clear domain/surface owners;
- `src/utils/bodyScrollLock.js` had zero production consumers in the initial audit and must be reconfirmed before deletion;
- Dashboard provider dependency inside `AppShell`;
- App direct `localStorage/sessionStorage` access;
- six clearly-owned root CSS files;
- empty `legacy-import-allowlist.json`;
- architecture checker lacks final generic legacy-root, frontend-shared, generic domain browser/fetch purity and domain-cycle rules.

Already clean:
- six domain roots established;
- no production `src/printing/*`;
- QZ isolated under infrastructure;
- cross-domain internal allowlist empty;
- direct QZ allowlist empty;
- repository-level semantic `shared/` modules have real Worker consumers and remain cross-runtime by design.

## Next action

- C10 design: **APPROVED** by the user on 2026-09-20.
- Implementation plan: **DRAFT FOR APPROVAL**, fully realigned to the approved design.
- Implementation: **NOT STARTED**.
- Next permitted action: obtain explicit approval of the implementation plan, then begin Task 1.

Design refinement commit: `0c0e8fea5321cd0519d8b2849915e1ff6eb6b472`.
Plan realignment commit: `a70d15232d9dfaedd6a9f84256b478b4d4302608`.
