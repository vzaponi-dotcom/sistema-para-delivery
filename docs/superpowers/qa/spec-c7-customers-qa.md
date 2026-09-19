# Spec C7 — Customers QA

**Date:** 2026-09-19  
**Slice:** C7 — Customers  
**Branch:** `feature/spec-c7-customers`  
**PR:** #51 (draft)  
**Base/master SHA:** `5b101800fe29d02dd4543e184cca9e06d659a445`  
**Final executable / homologated SHA:** `c01d90c6ea3a286a601f8efea51ec5ee28ff52d3`  
**Last code-changing SHA:** `6402496c078ca817572e6e375beec9f4ffbe557a`  
**Production deployment:** **NO**

## Gate summary

C7 staging homologation completed with **29 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**. The merge gate requires **0 FAIL**, which is satisfied. The single BLOCKED item is explicitly documented and is not treated as PASS.

The staging SHA includes only the documentation checkpoint after the final code-changing SHA. No Worker, schema, migration, Finance or Table Service functional changes were introduced by C7. The Orders production diff is limited to consuming Customers duplicate rules/UI through the Customers public entry. No CSS file was changed.

## Automated evidence

### Final pre-staging / homologated-head Validate application

- Workflow: **Validate application**
- Run: **#1420 / 35457535163**
- SHA: `c01d90c6ea3a286a601f8efea51ec5ee28ff52d3`
- Result: **SUCCESS**
- Tests: **1,807 total / 1,806 pass / 0 fail / 1 skipped**
- Frontend architecture boundaries: **PASS**
- Lint: **PASS**
- Build: **PASS**
- Production Worker dry-run: **PASS**
- Staging Worker dry-run: **PASS**
- Local D1 migrations: **PASS**
- Spec B D1 clean-install/upgrade gate: **PASS**

The final code-changing SHA `6402496c078ca817572e6e375beec9f4ffbe557a` also passed Validate #1419 / run `35456801774` with the same test counts and all gates green.

### Deploy staging

- Workflow: **Deploy staging**
- Run: **#185 / 35457821403**
- Event: `workflow_dispatch`
- SHA: `c01d90c6ea3a286a601f8efea51ec5ee28ff52d3`
- Result: **SUCCESS**
- Tests: **1,807 total / 1,806 pass / 0 fail / 1 skipped**
- Architecture/lint/build/local D1/staging Worker dry-run: **PASS**
- Remote staging migration list: **no migrations to apply**
- Remote staging migration apply: **no migrations to apply**
- Staging deployment: **SUCCESS**
- Cloudflare version ID: `c404e7b9-d32d-4faa-baaf-21e2f0e4f52d`
- Readiness: **attempt 1/6**
- Real staging login smoke: **HTTP 200**
- Staging URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`

## Manual staging matrix

| # | Case | Result | Evidence |
|---:|---|---|---|
| 1 | Clientes desktop opens normally | PASS | User confirmed the Clientes surface loaded normally in staging. |
| 2 | Search by name | PASS | User confirmed name search/filter behavior. |
| 3 | Search by phone | PASS | User confirmed phone search/filter behavior. |
| 4 | Search by address | PASS | User confirmed address search/filter behavior. |
| 5 | Sort Nome A–Z | PASS | User confirmed ascending name ordering. |
| 6 | Sort Nome Z–A | PASS | User confirmed descending name ordering. |
| 7 | Create unique client | PASS | User confirmed unique customer creation, close and success flow. |
| 8 | Blank address keeps `Sem endereço` behavior | PASS | User confirmed blank-address creation preserved the normal-editor fallback. |
| 9 | Edit client | PASS | User confirmed edit/save behavior and reflected changes. |
| 10 | Keep own phone while editing | PASS | User confirmed the edited client may retain its own phone without false duplicate blocking. |
| 11 | Another client's phone is blocked | PASS | User confirmed duplicate-phone blocking in the normal editor. |
| 12 | Cancel delete confirmation | PASS | User confirmed cancel leaves the client intact. |
| 13 | Confirm delete | PASS | User confirmed delete removes the client and completes normally. |
| 14 | Action sheet behavior after delete attempt | PASS | User confirmed no stuck/incorrect action-sheet state. |
| 15 | Duplicate name → Cancel | PASS | User confirmed duplicate-name cancel path. |
| 16 | Duplicate name → Use existing | PASS | User confirmed editor closes and list targets the existing client. |
| 17 | Duplicate name → Register anyway | PASS | User confirmed duplicate-name override creation. |
| 18 | Mobile editor input/autocomplete behavior | PASS | User confirmed mobile editor behavior remained usable. |
| 19 | Mobile list 320–640px | PASS | User confirmed no material clipping/touch regression. |
| 20 | Offline read/search; writes blocked | PASS | User confirmed read/search remains usable while create/edit/delete are blocked offline. |
| 21 | New Order quick-create unique client | PASS | User confirmed quick-created client is created and selected. |
| 22 | Quick-create blank address behavior | PASS | User confirmed quick-create continues without an address field requirement. |
| 23 | Quick-create duplicate phone inline error | PASS | User confirmed the inline duplicate-phone path. |
| 24 | Quick-create duplicate name → Use existing | PASS | User confirmed existing client selection and quick-create closure. |
| 25 | Quick-create duplicate name → Register anyway | PASS | User confirmed duplicate-name override in New Order. |
| 26 | Cancel quick-create preserves rest of draft | PASS | User confirmed the remaining New Order draft is preserved. |
| 27 | Global write/request busy blocking | PASS | User confirmed customer mutations cannot be repeatedly submitted while pending. |
| 28 | Official runtime/bootstrap reconciliation | PASS | User confirmed create/edit/delete state remains correct after reload. |
| 29 | Logout/login does not resurrect editor/duplicate modal | PASS | User confirmed transient customer UI state does not cross sessions. |
| 30 | Capability/read-only behavior | BLOCKED | Staging has no suitable restricted/read-only identity/session for end-to-end manual verification. Automated capability coverage remains green. |

## Compatibility state

- Customer CRUD `updateCollection('clients', ...)` usage: **REMOVED IN C7** and architecture-enforced.
- Legacy customer API exports from `src/api/client.js`: **REMOVED** and architecture-enforced.
- Legacy `src/pages/Clients.jsx` and `src/components/ClientDuplicateModal.jsx`: **REMOVED** with no compatibility reexport.
- External Customers deep imports: architecture-rejected.
- Orders ↔ Customers internal imports: architecture-rejected; public entry is the supported cross-domain contract.
- Frontend duplicate/name rules in `shared/clientIdentity.js`: architecture-rejected.
- `shared/clientIdentity.js` phone normalization/formatting primitives: **permanent cross-runtime contract**, not a facade.
- C7 surviving temporary compatibility facades: **none**.
- Global `updateCollection` escape hatch: Catalog/products remain C8 debt.
- Generic/auth `src/api/client.js` reexports: remain C10 debt.
- Production deployment: **NO**.

## Merge gate

- Manual staging failures: **0**
- Manual staging blocked: **1**, with explicit reason above.
- Manual staging pending: **0**
- Master drift before closure: **none**; master remains `5b101800fe29d02dd4543e184cca9e06d659a445`.
- Homologated SHA: `c01d90c6ea3a286a601f8efea51ec5ee28ff52d3`
- Homologated-head Validate: **#1420 / 35457535163 — SUCCESS**
- Deploy staging: **#185 / 35457821403 — SUCCESS**
- Production touched: **NO**
- Merge authorization: **NOT YET GRANTED**

This QA/ledger closure commit changes the Git SHA by definition. The exact docs-only HEAD created after this file must itself receive a successful **Validate application** before merge. That exact final validation is reported in the PR/merge handoff without creating an infinite self-referential documentation loop.

Do not merge C7 until that exact current branch HEAD has a successful Validate and the user explicitly authorizes the merge.
