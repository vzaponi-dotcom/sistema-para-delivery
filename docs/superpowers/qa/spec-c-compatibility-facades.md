# Spec C — compatibility facade ledger

Temporary compatibility paths and bridges introduced during Spec C must be removed by the listed slice or explicitly promoted to a documented permanent contract.

| Old path/bridge | New owner/path | Remaining consumers | Removal slice |
|---|---|---|---|
| `src/api/client.js` generic/auth reexports | `src/infrastructure/api/httpClient.js` + `src/infrastructure/auth/sessionApi.js` | legacy frontend imports during domain migration | C10 at latest |
| operational data runtime payment-receipt bridge | App-owned payment reconciliation | C1 legacy payment workflow | C6 |
| operational data runtime table-commit bridge | App-owned comanda selection reconciliation | C1 legacy table-service workflow | C5 |
| `updateCollection` runtime escape hatch | temporary legacy App CRUD handlers | clients/products handlers not migrated yet | C8, with final enforcement C10 |

## C1 Task 5 status — 2026-09-16

- All three Task 5 compatibility bridges remain intentional and active after the `useOperationalDataRuntime` integration.
- No additional facade/bridge was introduced while fixing the post-integration regression tests.
- Validate application #1175 (run `35054633792`) was fully green on executable HEAD `8212a8ee61c9f1eca2c3fe5fc74bc84c412d6166`.
- Do not remove the payment bridge before C6, the table-commit bridge before C5, or the `updateCollection` escape hatch before its C8/C10 migration targets.
