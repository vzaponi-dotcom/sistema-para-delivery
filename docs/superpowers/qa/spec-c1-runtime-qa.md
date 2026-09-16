# Spec C1 — Runtime Centralization QA

Date: 2026-09-16

## Scope

Manual homologation record for Spec C1 — Runtime Centralization. This slice extracts session, online/network status, feedback, bootstrap/official-data synchronization and architecture enforcement while preserving existing UX and business behavior.

## Git / CI / staging evidence

- Branch: `feature/spec-c1-runtime`
- Base branch: `master`
- Base SHA: `af8266549603fc2d392880c812bc1c0d608a6dbc`
- Homologated final HEAD: `b6e8de4bf3c64652dff7352e4ff744017cff10e5`
- PR: #45 — `Spec C1: centralizar runtime do frontend`
- Validate application: #1201 / run `35104869996` — **PASS** on `b6e8de4bf3c64652dff7352e4ff744017cff10e5`
- Deploy staging: #177 / run `35105946795` — **PASS**
- Deploy event: `workflow_dispatch`
- Deploy branch: `feature/spec-c1-runtime`
- Deploy SHA: `b6e8de4bf3c64652dff7352e4ff744017cff10e5`
- Staging URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`
- Staging workflow also passed tests, architecture validation, lint, build, D1 migration checks/application, staging Worker deployment and real staging login smoke test.
- Production deploy from C1: **NO**

## Manual homologation matrix

The product owner executed the approved C1 staging matrix on 2026-09-16 and reported all items working correctly.

| # | Check | Result | Evidence / observation |
|---|---|---|---|
| 1 | Authenticated reload loads the current operation normally | PASS | Reload while authenticated preserved the normal operational state and data load. |
| 2 | Anonymous session displays Login | PASS | Anonymous/logged-out access returned to Login as expected. |
| 3 | Invalid PIN preserves the current error behavior/copy | PASS | Invalid-PIN path behaved as expected. |
| 4 | Valid login reaches the same post-bootstrap destination | PASS | Successful login/bootstrap preserved the existing destination and behavior. |
| 5 | Logout clears business state and returns to Login | PASS | Logout returned to Login without stale operational state. |
| 6 | 401/session expiry returns to Login with the current expiry behavior/copy | PASS | Session-expiry path was exercised and behaved correctly. |
| 7 | Offline banner/write blocking remain equivalent | PASS | Offline mode was exercised through browser DevTools and existing offline handling remained correct. |
| 8 | Reconnect/focus/visibility global refresh remains correct | PASS | Reconnect/focus/visibility refresh behavior remained operational. |
| 9 | Cozinha receives order updates while active with current behavior | PASS | Order updates continued to arrive while Cozinha was active. |
| 10 | Leaving Cozinha stops its dedicated order refresh while global sync remains operational | PASS | DevTools Network showed `orders` polling about every 2 seconds in Cozinha; after leaving Cozinha that dedicated polling stopped while other global/background requests continued. |
| 11 | Clients, Products, Finance and Comandas show bootstrap data correctly | PASS | All representative operational surfaces loaded their current data correctly. |
| 12 | Representative comanda payment settles/reconciles without stale-selection regression | PASS | Representative payment flow completed without stale-selection behavior. |
| 13 | Settings effective config/draft/save behavior remains unchanged | PASS | Representative Settings draft/save behavior remained equivalent to the previously homologated flow. |
| 14 | Opening Cozinha and Fila de impressão shows no new printing-runtime initialization error | PASS | Both surfaces opened without a new QZ/printing runtime initialization regression. |
| 15 | No visible desktop/mobile/light/dark regression attributable to C1 | PASS | General visual pass found no C1-attributable regression across the approved view/theme coverage. |

## Compatibility paths still intentionally open

These are not C1 defects; they are tracked migration bridges with later removal slices:

- `src/api/client.js` generic/auth reexports → remove by C10 at latest;
- operational data runtime payment-receipt bridge → remove in C6;
- operational data runtime table-commit bridge → remove in C5;
- `updateCollection` runtime escape hatch → reduce through C4-C8 and enforce final removal no later than C10.

No new compatibility facade or cross-slice bridge was introduced by the Task 6 session extraction or Task 7 runtime-boundary cleanup.

## Homologation result

- Automated validation on the homologated HEAD: **PASS**
- Exact-HEAD manual staging deploy: **PASS**
- Manual 15-item staging matrix: **15/15 PASS**
- Production touched: **NO**
- Physical printing full hardware matrix: **not required for C1**; this slice only verified absence of a new printing-runtime initialization regression.

C1 is manually homologated. Any commit after `b6e8de4bf3c64652dff7352e4ff744017cff10e5` that only records QA/documentation must be proven docs-only and receive normal PR validation; staging does not need to be redeployed solely for documentation-only commits.
