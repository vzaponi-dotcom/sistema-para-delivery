# Spec C3 — Settings Surface and Versioned Policy Editing — QA Record

## Execution identity

- Slice: **C3 — Settings surface and versioned policy editing**
- Branch: `feature/spec-c3-settings-surface`
- Base SHA: `de24b2ceb807440d4c339200b44ae2ed6583b27a`
- Executable SHA: `17673b66774a1b532fc22972603407dcbb932bad` (`refactor: close c3 settings ownership`)
- Remote branch verification: `git fetch origin feature/spec-c3-settings-surface` returned the exact executable SHA.
- Docs-only history: `8b01af19a4f74fd4725394860edd6a85d50d4915` contains the QA record and rollout-status update; this correction is a subsequent docs-only commit.
- Production deploy: **NO**
- Merge: **NO**

## Local automated gate evidence

All commands below ran from `C:\Projetos\sistema-para-delivery\.worktrees\spec-c3-settings-surface` on the exact executable SHA.

| Command | Result | Evidence |
|---|---|---|
| `git status --short` | PASS | Only the pre-existing, ignored-by-Git SDD working ledger was untracked: `.superpowers/sdd/2026-09-16-frontend-modularization-c3-settings-surface-plan/`. |
| `git diff --check` | PASS | Exit code 0. |
| `npm.cmd test` | PASS | Exit code 0. |
| `npm.cmd run test:architecture` | PASS | `Frontend architecture boundaries: OK`. |
| `npm.cmd run lint` | PASS | Exit code 0; warnings only, including pre-existing React/unused-variable warnings. |
| `npm.cmd run build` | PASS | Exit code 0; existing Vite large-chunk advisory only. |
| `npm.cmd run d1:migrate:local` | PASS | Exit code 0; all migrations `0001_initial.sql` through `0025_print_context_copies.sql` applied to the local D1 state. |

Focused Settings/policy/navigation/printing regression coverage was green during Task 12 (205/205); the fresh full suite above also passed on the executable SHA.

## Diff, ownership, and facade audit

- `git diff --name-status origin/master...HEAD` was inspected.
- `git diff origin/master...HEAD -- worker migrations src/printing` produced no output: Worker, migrations, and the C9-owned printing runtime were untouched.
- `src/App.jsx` imports only the public `SettingsPolicyBoundary`, `SettingsSurface`, and generic `createPolicyNavigationBridge`; it has no concrete policy-adapter or legacy Settings-owner import.
- `src/app/navigation/` has no Settings route-to-resource mapping and `src/app/policy-editing/` has no concrete policy endpoint or presentation-label match.
- The C3 legacy owner audit found none of the deleted page/controller/client/guard/component facade paths present.
- `docs/superpowers/qa/spec-c-compatibility-facades.md` contains no C3 debt row because no C3 compatibility facade survives.

## GitHub Validate gate

| Item | Result | Evidence |
|---|---|---|
| Exact executable SHA pushed | PASS | Remote `feature/spec-c3-settings-surface` resolves to `17673b66774a1b532fc22972603407dcbb932bad`. |
| Validate workflow on exact SHA | BLOCKED | The workflow YAML has no push trigger for this C3 branch. Public GitHub API query for the exact SHA returned HTTP 200 with `total_count: 0`. `gh auth status` reported the active `vzaponi-dotcom` token invalid, and no authenticated browser was available. |
| Validate workflow ID/number/jobs | BLOCKED | A manual `workflow_dispatch` cannot be authorized or inspected without a valid GitHub credential. No run ID, number, or job result exists for this SHA. |

## Staging deployment

- Configured staging target: `https://sistema-para-delivery-staging.vzaponi.workers.dev`.
- Deployment workflow ID/number and deployed SHA: **BLOCKED / not created**.
- Reason: staging is intentionally manual (`workflow_dispatch`); the GitHub credential needed to dispatch and inspect the workflow is invalid, and no authenticated browser surface is available.
- No production workflow, deploy, or configuration change was made.

## Manual staging homologation matrix

The exact executable SHA was not deployed to staging. To avoid attributing an older deployment to C3, no scenario was exercised against the existing staging URL. Automated evidence is complementary only and does not convert a manual result to PASS.

| # | Scenario | Result | Evidence / limitation |
|---|---|---|---|
| 1 | Settings Home cards, visibility, and capabilities | BLOCKED | Exact C3 staging deployment unavailable. |
| 2 | Operations load/edit/save/cancel/success feedback | BLOCKED | Exact C3 staging deployment unavailable. |
| 3 | Modalities share the Operations draft | BLOCKED | Exact C3 staging deployment unavailable. |
| 4 | Operations ↔ Modalities dirty navigation has no discard prompt | BLOCKED | Exact C3 staging deployment unavailable. |
| 5 | Leaving a dirty Operations/Modalities draft prompts and discards once | BLOCKED | Exact C3 staging deployment unavailable. |
| 6 | Payment Methods controls/menu/save/cancel/read-only | BLOCKED | Exact C3 staging deployment unavailable. |
| 7 | Cancellation Reasons add/edit/order/save/cancel/read-only | BLOCKED | Exact C3 staging deployment unavailable. |
| 8 | Finance Categories add/edit/type/order/save/cancel/read-only | BLOCKED | Exact C3 staging deployment unavailable. |
| 9 | Printing Policy copy policy edit/save/cancel/notices | BLOCKED | Exact C3 staging deployment unavailable. |
| 10 | Printing Station name/platform/auto-print/primary flows | BLOCKED | Exact C3 staging deployment unavailable. |
| 11 | Local printer discovery/selection/status/test-print controls | BLOCKED | Exact C3 staging deployment unavailable. |
| 12 | Device Preferences theme/sound/diagnostics/local autosave | BLOCKED | Exact C3 staging deployment unavailable. |
| 13 | Light theme at desktop and mobile widths | BLOCKED | Exact C3 staging deployment unavailable. |
| 14 | Dark theme at desktop and mobile widths | BLOCKED | Exact C3 staging deployment unavailable. |
| 15 | Known load failure and retry | BLOCKED | Exact C3 staging deployment unavailable. |
| 16 | 409 conflict review | BLOCKED | Exact C3 staging deployment unavailable. |
| 17 | Unknown-result/unconfirmed reconciliation | BLOCKED | Exact C3 staging deployment unavailable. |
| 18 | Browser reload/close dirty-draft abandonment prompt | BLOCKED | Exact C3 staging deployment unavailable. |
| 19 | Browser reload/close saving/unconfirmed abandonment risk | BLOCKED | Exact C3 staging deployment unavailable. |
| 20 | Internal navigation while saving/unconfirmed | BLOCKED | Exact C3 staging deployment unavailable. |
| 21 | Confirmed save refreshes effective business config | BLOCKED | Exact C3 staging deployment unavailable. |
| 22 | Logout/login or context changes do not leak policy state | BLOCKED | Exact C3 staging deployment unavailable. |
| 23 | No C3-attributable console errors | BLOCKED | Exact C3 staging deployment unavailable. |

## Matrix summary and merge readiness

- PASS: 0
- FAIL: 0
- BLOCKED: 23

The C3 executable is locally validated but is not staging-homologated and is not ready for merge authorization. The remaining external blocker is a valid GitHub credential/session capable of dispatching and inspecting `Validate application` and `Deploy staging` for the exact branch/SHA. Production remains untouched.
