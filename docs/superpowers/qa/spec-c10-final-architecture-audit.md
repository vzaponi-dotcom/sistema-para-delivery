# Spec C10 — final architecture audit

**Status:** Task 10 audit in progress — public-contract reduction GREEN locally; final Validate remains required.  
**Audited HEAD:** `e35b606` plus the uncommitted Task 10 working tree.  
**Scope:** production source only; tests are not counted as public consumers.

**Completion:** Task 10 is **COMPLETE / GREEN**. The final documentary Validate is pending; Task 11 has not started.

## Public domain entries

| Domain | Deliberate public contract | External production consumers | Ruling |
| --- | --- | --- | --- |
| Catalog | `CatalogWorkspace`, `PRODUCT_CATEGORIES`, `CATEGORY_ICON_NAMES`, `categoryForUi`, `formatProductPresentation` | App; Orders cart, product catalog and order-cart domain rules | Keep: the four presentation contracts are real Orders→Catalog public-entry edges; workspace is App composition. |
| Customers | `CustomersWorkspace`, `useQuickCreateCustomerCommand`, `ClientDuplicateModal`, `findClientDuplicates` | App; Orders new-order UI | Reduced: six internal/test-only exports removed. |
| Finance | effective payment/category option derivation, finance policies/settings UI, `calculateReceivedToday`, `formatTableIdentifierLabel`, `FinanceWorkspace`, `Receivables` | App; Dashboard; Settings; payment/refund workflows | Keep: every export has an app-surface/workflow consumer. |
| Orders | order UI/routes, operational API/policies/hooks, payment eligibility, history/dashboard selectors, and the limited presentation/identity helpers consumed by Dashboard, Receivables and payment workflows | App; Dashboard; Settings registry; runtime data; payment workflows; Receivables | Reduced: cart mutation, step-flow, internal lifecycle/timing, kitchen, factory and test-only exports removed. |
| Printing | manager, policy adapters, queue query/UI, settings/overlays and the three presentation contracts | App; navigation; Settings; Table Service; Orders | Keep: all exports bridge a real external app/domain composition. |
| Table Service | `Comandas`, `Tables`, `LocalTableSelector`, selection/command hooks and `resolveOpenComanda` | App; Orders new-order UI | Keep: all exports have an external consumer. |

The focused RED contract failed because Orders exposed 40 unused names and Customers exposed six. The focused GREEN contract now fixes their public entry shapes. No compatibility reexport was added. Architecture enforcement now explicitly excludes `*.test.*` files from domain deep-import findings: production imports remain protected, while a unit test may exercise an internal module without promoting it to the runtime public API.

## Frontend shared layer

`src/shared` has no domain imports (enforced by `c10SharedOwnership.test.js` and the final architecture gate). `ui` primitives have real multi-owner use across app shell/surfaces and the Catalog, Customers, Finance, Orders, Printing and Table Service UIs. `DashboardBarChart` and `DashboardPeriodSelector` are shared by Dashboard and Orders operational history. `formFormatting` is used by Catalog, Customers, Finance and Orders and remains pure. `useMediaQuery` is a generic React/browser-subscription adapter; it currently has one production consumer (Comandas), but it deliberately remains the single generic hook owner rather than recreating a domain hook or a legacy root.

No domain rule was moved into frontend shared for reuse: business/date/order/print policies remain in repository-level `shared` or their domain, while UI primitives stay domain-independent.

## Cross-runtime shared contracts

Repository-level `shared/` remains the correct cross-runtime boundary. Frontend and Worker consumers continue to use:

- `businessPolicies`, `settingsAccess` and `settingsCatalogs` for settings/policy contracts;
- `clientIdentity`, `orderCustomerIdentity`, `productCatalog` and `finance` for identities, catalog and finance/date semantics;
- `orderDisplayNumber` and `orderTiming` for order display/timing;
- `orderPrintDocument`, `printContextPolicy`, `printQueue`, `printQueueActions`, `printStationHealth` and `tableTabPrintDocument` for document, queue, action and health semantics.

These modules are used from both `src/` and `worker/`; moving them into frontend shared would break the cross-runtime contract. No migration is warranted.

## App boundary

`App.jsx` composes public domain entries and app workflows only. It contains no endpoint implementation, CRUD implementation, Dashboard calculation, QZ/recovery internals, direct browser-storage mechanics, legacy-root production import or deep domain import. Kitchen preference and session storage are accessed through infrastructure adapters; printing is composed solely through the Printing public entry.

## Commands recorded so far

- Focused RED: `node --test src/c10FinalArchitectureAudit.test.js` — failed on the expected surplus Orders and Customers exports.
- Focused GREEN: `node --test src/c10FinalArchitectureAudit.test.js src/domains/orders/ordersPublicContract.test.js src/domains/customers/customersPublicContract.test.js src/domains/customers/customersTask4Contract.test.js` — 7 pass, 0 fail.
- Architecture unit suite: `node --test scripts/architecture/check-import-boundaries.test.mjs` — 57 pass, 0 fail.
- Architecture: `npm.cmd run test:architecture` — `Frontend architecture boundaries: OK`.
- Full suite: `npm.cmd test -- --test-reporter=dot` — exit 0.
- Lint: `npm.cmd run lint` — exit 0 (pre-existing warnings only).
- Build: `npm.cmd run build` — exit 0.
- Local D1: `npm.cmd run d1:migrate:local` — no migrations to apply.
- Spec B D1 gate: `node scripts/infra/spec-b-d1-gate.mjs` — 25 migrations; all checks true.

The production and staging Worker dry-runs still require explicit authorization for external Cloudflare egress. They have not been run and are not represented as green.

Task 10 is not complete until the full Validate-equivalent gates pass on the final executable Task 10 SHA. Rollout, execution ledger, plan and PR remain intentionally unchanged until then.
