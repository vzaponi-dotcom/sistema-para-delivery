# Spec C — compatibility facade ledger

Temporary compatibility paths and bridges introduced during Spec C must be removed by the listed slice or explicitly promoted to a documented permanent contract.

| Old path/bridge | New owner/path | Remaining consumers | Removal slice |
|---|---|---|---|
| `src/api/client.js` generic/auth reexports | `src/infrastructure/api/httpClient.js` + `src/infrastructure/auth/sessionApi.js` | legacy frontend imports during domain migration | C10 at latest |
| operational data runtime payment-receipt bridge | App-owned payment reconciliation | C1 legacy payment workflow | C6 |
| operational data runtime table-commit bridge | App-owned comanda selection reconciliation | C1 legacy table-service workflow | C5 |
| `updateCollection` runtime escape hatch | temporary legacy App CRUD handlers | clients/products handlers not migrated yet | C8, with final enforcement C10 |
