# Spec C10 — final architecture audit

**Status:** Tasks 1–12 **COMPLETE / GREEN**; exact executable candidate, staging and manual homologation recorded.
**Audited implementation HEAD:** `6b0512efda1bc3e20c28770c23e91c7a4301204f`.
**Comparison base:** post-C9 `2b5060c8293fec6756b286627212b740b3147e53`.
**Scope:** production source, architecture contracts, test ownership, release evidence and the 18 criteria from parent Spec C §28.

Task 12 deployed only staging on the exact executable candidate and completed the manual C10 matrix at **23 PASS / 0 FAIL / 0 BLOCKED / 0 PENDING**. No pending remote staging migration, production deployment or merge is claimed by this audit.

## Spec C §28 — 18 success criteria

| # | Status | Evidence | Notes |
| --- | --- | --- | --- |
| 1 | **PASS** | `src/App.jsx`, `src/app/shell/AppRoot.jsx`, `src/c10FinalArchitectureAudit.test.js`; focused architecture/audit suite 69/69. | App/AppRoot retain high-level session/navigation/capability/workflow/surface composition. App has no endpoint, CRUD, Dashboard calculation, storage or QZ implementation. |
| 2 | **PASS** | Six domain trees under `src/domains/`; domain application/infrastructure/UI tests; C4–C9 extraction guards in `check-import-boundaries.mjs`. | Customer, Catalog, Finance, Table Service and Orders mutations/rules are outside App; printing rules are owned by Printing. |
| 3 | **PASS** | `src/app/runtime/{session,data,network,feedback}`, `src/app/navigation`; 13 co-located runtime/navigation tests. | Session, official synchronization, navigation and global feedback have separate owners and contracts. |
| 4 | **PASS** | `src/domains/{orders,table-service,finance,customers,catalog,printing}` and each public `index.js`; domain public-contract tests. | All six approved domain roots are established. |
| 5 | **PASS** | `src/app/surfaces/dashboard/DashboardSurface.jsx`, `src/app/surfaces/settings/SettingsSurface.jsx`, `c10DashboardOwnership.test.js`. | There is no `domains/dashboard` or artificial Settings domain. |
| 6 | **PASS** | `src/app/workflows/payments/{order,table-tab}`, `src/app/workflows/refunds`; architecture rule `cross-domain-workflow-owner`. | Payment/refund coordination is explicitly app-owned and outside the participating domains. |
| 7 | **PASS** | `src/infrastructure/api/{httpClient,bootstrapApi,effectiveConfigApi}.js`, domain/workflow adapters; `c10ApiOwnership.test.js`. | `src/api/client.js` and `src/api/effectiveConfigClient.js` are physically absent and guarded from returning. |
| 8 | **PASS** | `src/infrastructure/qz/**`; unchanged QZ core diff against C9; `qz-tray` production import only in `qzTransport.js`; architecture QZ rules. | Printing application consumes the transport adapter; the domain does not import QZ. |
| 9 | **PASS** | `src/shared/{ui,hooks,utils}`, repository-level cross-runtime `shared/`, `c10SharedOwnership.test.js`. | Frontend shared has no domain imports; semantic modules retained at repository `shared/` have real frontend + Worker consumers. |
| 10 | **PASS** | Six domain `index.js` files; `c10FinalArchitectureAudit.test.js`; domain-specific public-contract tests. | Task 10 removed 40 unused Orders exports and six unused Customers exports; every remaining public export has a production consumer. |
| 11 | **PASS** | `scripts/architecture/check-import-boundaries.mjs`; 57/57 architecture unit tests; `npm run test:architecture` = `Frontend architecture boundaries: OK`. | Generic gates cover legacy roots, App imports, shared boundary, domain purity/browser/fetch, external public entries, QZ confinement and deterministic domain cycles. |
| 12 | **PASS** | Co-located test counts: runtime 6, navigation 7, surfaces 18, workflows 8, Orders 32, Table Service 12, Finance 21, Customers 12, Catalog 15, Printing 27, infrastructure 13, frontend shared 3, checker 1. | Architecture tests remain with the checker; cross-owner integration tests remain global where appropriate. No aesthetic mass move was made. |
| 13 | **PASS** | `spec-c-compatibility-facades.md`; `c10ResidualOwnership.test.js`; deleted migration allowlist. | Active compatibility facades = 0; migration allowlists = 0; legacy production roots contain 0 JS/JSX/MJS owners. |
| 14 | **PASS** | Local Task 11 gates below; exact candidate `060468703f39c716d997025ab0ed99063cdd2fae`; Validate #1550/run `35541850517` **SUCCESS**. | Authoritative GitHub gates passed: 1,933 tests / 1,932 pass / 0 fail / 1 skipped, architecture, lint, build, both Worker dry-runs, local D1 and Spec B D1. |
| 15 | **PASS** | Deploy staging #190 / run `35544795652` on exact executable SHA `060468703f39c716d997025ab0ed99063cdd2fae`; readiness 1/6; login HTTP 200; manual C10 matrix 23/23 PASS. | Staging had no pending migration (`No migrations to apply`). This PASS closes the Spec C architecture gate only; the separate C9 physical release gate remains `DEFERRED-PRODUCTION` and blocks production. |
| 16 | **PASS** | Base-to-candidate diff audit below; 1,933/1,933 tests; CSS blob identity; no Worker/schema/package/polling/capability/QZ-core diff. | No unauthorized functional or visual change was found. Physical output is not inferred. |
| 17 | **PASS** | Parent Spec C §25; open Issues #43/#44; rollout and C9 QA records. | React Router (#43) and users/profiles (#44) remain explicitly deferred; Kitchen TV, Spec D and professional-printer evolution remain out of scope. C9 hardware and restricted-identity limitations remain truthfully recorded. |
| 18 | **PASS** | Final map below; generic architecture cycle/public-entry gate; zero legacy production roots. | Dependencies are owner-local and predictable: app composition → public domain entries/workflows; domain UI/application → own internals; generic infrastructure/shared boundaries are explicit. |

There are **18 PASS**, **0 FAIL**, **0 PENDING**. Spec C architectural closure is complete through Task 12 and awaits explicit merge authorization.

## Public domain entries

| Domain | Deliberate public contract | External production consumers | Ruling |
| --- | --- | --- | --- |
| Catalog | `CatalogWorkspace`, `PRODUCT_CATEGORIES`, `CATEGORY_ICON_NAMES`, `categoryForUi`, `formatProductPresentation` | App; Orders cart/catalog rules and UI | Keep: all five contracts have real consumers. |
| Customers | `CustomersWorkspace`, `useQuickCreateCustomerCommand`, `ClientDuplicateModal`, `findClientDuplicates` | App; Orders new-order UI | Reduced in Task 10: six internal/test-only exports removed. |
| Finance | payment/category projections and policies, settings UI, `calculateReceivedToday`, `formatTableIdentifierLabel`, `FinanceWorkspace`, `Receivables` | App; Dashboard; Settings; payment/refund workflows | Keep: each bridges a real surface/workflow consumer. |
| Orders | UI/routes, operational API/policies/hooks, payment eligibility, history/dashboard selectors and limited presentation/identity helpers | App; Dashboard; Settings; runtime; payment workflows; Receivables | Reduced in Task 10: 40 surplus exports removed. |
| Printing | manager, policy adapters, queue/settings/overlay UI and the three presentation contracts | App; navigation; Settings; Orders; Table Service app surface | Keep: all exports have real external composition consumers. |
| Table Service | `Comandas`, `Tables`, `LocalTableSelector`, selection/command hooks and `resolveOpenComanda` | App; Orders new-order UI | Keep: all exports have real external consumers. |

Tests may import their internal owner module directly. The architecture checker excludes `*.test.*` from production deep-import findings without weakening production enforcement.

## Final dependency map

- App/runtime owns session, capabilities, official bootstrap/sync, navigation, feedback and high-level composition.
- App surfaces own Dashboard, Settings, Finance/Receivables and Table Service cross-domain presentation composition.
- App workflows own order payment, table-tab payment/reconciliation and refund coordination.
- Production peer-domain public-entry edges are one-way and acyclic: Orders → Catalog, Customers, Finance, Table Service and Printing. No reverse edge was found.
- Domain internals remain owner-local; external and peer-domain consumers enter through `domains/<domain>/index.js`.
- Frontend `src/shared` owns generic UI/hooks/formatting and imports no domain.
- Repository `shared/` remains the frontend/Worker contract boundary for business policies, identities, finance/date, order timing/display/print, print queue/actions/health, product/settings and table-tab document contracts.
- `src/infrastructure/api`, `auth`, `storage` and `qz` own environmental details. Production `qz-tray` is confined to `src/infrastructure/qz/qzTransport.js`.
- `src/api`, `pages`, `printing`, `components`, `hooks` and `utils` contain **0 production JS/JSX/MJS owners**.
- Architecture cycle detection builds the production domain graph deterministically and rejects a public-entry A → B → A fixture.

## Test ownership audit

Important new/final owners have focused tests beside them: runtime/navigation, Dashboard and Settings surfaces, payment/refund workflows, all six domains, API/auth/storage/QZ infrastructure, frontend shared modules and the architecture checker. Global files such as `actionCapabilities.test.js`, app wiring, responsive/visual contracts and cross-domain integration tests remain global because they intentionally span owners. No mass relocation was performed merely for path aesthetics.

## Diff audit against post-C9 base

| Area | Result | Evidence |
| --- | --- | --- |
| Worker | **PASS** | `git diff 2b5060c..HEAD -- worker` is empty. No Worker functional file changed. |
| Migrations / D1 schema | **PASS** | Diff under `migrations/` and `wrangler.jsonc` is empty. During Task 11, local Wrangler 4.128.0 reported no migrations to apply and no remote command ran. Task 12 then listed and invoked the staging application step, both reporting `No migrations to apply`; no migration was applied. |
| API contracts | **PASS** | All domain/workflow/auth HTTP adapters outside the removed facade are unchanged. Bootstrap remains `GET /api/bootstrap?knownEffectiveConfigVersion=...`; effective config remains `GET /api/settings/effective?knownVersion=...`; focused adapter tests preserve method/query/error semantics. |
| Polling | **PASS** | No polling-related production diff. Global `5_000`, Kitchen/orders `2_000`, printing job `2_000`, state `5_000`, heartbeat `15_000` and Print Queue `10_000` remain unchanged. |
| Storage keys | **PASS** | `kitchen-sound-enabled` moved verbatim behind `kitchenSoundPreference.js`; `delivery-theme`, `delivery-device-preferences-updated-at`, `delivery-print-station-id`, `delivery-qz-printer-name:<stationId>` and `printing-origin-order-ids` are unchanged. |
| Capabilities | **PASS** | No diff in `src/app/access.js`, navigation resolution, session runtime or session API. Capability-related production diff is limited to removing unused public exports; the full action-capability suite is green. |
| QZ / printing semantics | **PASS** | Zero diff in `src/infrastructure/qz`, Printing application/domain/infrastructure. Copy selection, primary-station, retry/recovery and unknown-outcome logic are unchanged; UI changes are owner/import relocations. Physical hardware behavior is not inferred. |
| CSS | **PASS** | All moved CSS blobs are byte-identical to base: Dashboard, New Order, Customer duplicate, Product form, Finance mobile, Print Queue, local-order identity, UI polish and payment. Import ownership changed without selector/declaration edits. |
| Packages | **PASS** | `package.json` and `package-lock.json` blob hashes equal the base; no dependency drift. |
| UTF-8 / functional copy | **PASS** | No mojibake-like line was introduced by the C10 diff. Existing mojibake in historical test names predates C10; production functional copy changes were not found. Full copy/source contracts pass. |

## Task 11 local gates

| Gate | Result |
| --- | --- |
| `npm test` | **PASS** — 1,933 tests / 1,933 pass / 0 fail / 0 skipped. |
| Focused final audit | **PASS** — 69/69. |
| `npm run lint` | **PASS** — exit 0, no errors; existing warnings remain non-blocking. |
| `npm run test:architecture` | **PASS** — `Frontend architecture boundaries: OK`. |
| `npm run build` | **PASS** — 499 modules transformed. |
| `npx --yes wrangler@4.128.0 deploy --dry-run` | **PASS** — production bindings inspected; exited at `--dry-run`, no deploy. |
| `npx --yes wrangler@4.128.0 deploy --dry-run --env staging` | **PASS** — isolated staging D1 binding inspected; exited at `--dry-run`, no deploy. |
| `npm run d1:migrate:local` | The npm wrapper reached `npx` but the sandbox denied its registry/cache access before Wrangler started. The already-cached exact Wrangler 4.128.0 then ran the same local migration target directly and **PASS**ed with `No migrations to apply`. Exact npm-script execution remains covered by candidate GitHub Validate. |
| `node scripts/infra/spec-b-d1-gate.mjs` | **PASS** — D1 local Worker; 25 migrations; all concurrency/receipt/rollback/schema/print-context checks true. |

## Deferred decisions and release gates

- Issue #43, **open**: React Router/navigation modernization after Spec C.
- Issue #44, **open**: users, profiles and granular authorization.
- Kitchen TV remains a future surface consuming Orders public rules.
- Spec D remains the future extensible Catalog model.
- Professional-printer transport remains a future adapter evolution.
- Historical C9 capability case #35 remains BLOCKED because that C9 round had no suitable restricted identity; it is not promoted or re-inferred. Separately, C10 restricted-capability case #23 was executed with a suitable staging identity and is **PASS**.
- C9 functional rows #12, #14–21, #24, #30 and #31 remain **DEFERRED-PRODUCTION**.
- C9 physical P1–P20 remain **DEFERRED-PRODUCTION**. Before production, the exact final post-C10 staging candidate must pass all 12 deferred functional rows and all 20 physical rows.

## Candidate handoff

The Task 11 audit found no architecture FAIL and required no implementation fix. The immutable executable candidate is `060468703f39c716d997025ab0ed99063cdd2fae`; Validate application #1550 / run `35541850517` completed **SUCCESS** on that exact SHA with **1,933 tests / 1,932 pass / 0 fail / 1 skipped** and every workflow gate green. Deploy staging #190 / run `35544795652` then deployed that same executable SHA, reported no pending remote migration, produced Worker version `f0f8c6a0-5e55-4894-9250-29d4b76aeae8`, passed readiness on attempt 1/6 and login smoke with HTTP 200. Manual homologation closed at **23 PASS / 0 FAIL / 0 BLOCKED / 0 PENDING**, including the restricted-capability case. Documentation-only successor commits do not replace the staged executable SHA.

Tasks 1–12 are **COMPLETE / GREEN**. Active compatibility facades and migration allowlists remain **0**. PR #54 remains open pending explicit merge authorization; production is **NO DEPLOY** and merge is **NOT EXECUTED**.
