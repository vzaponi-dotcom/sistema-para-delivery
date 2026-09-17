# Spec C3 — Settings Surface and Versioned Policy Editing — QA Record

## Execution identity

- Slice: **C3 — Settings surface and versioned policy editing**
- Branch: `feature/spec-c3-settings-surface`
- Base SHA: `de24b2ceb807440d4c339200b44ae2ed6583b27a`
- Executable SHA: `17673b66774a1b532fc22972603407dcbb932bad` (`refactor: close c3 settings ownership`)
- Staging-deployed docs HEAD: `471d377f973864be6d3037e47a743a02f6a59df0`; the executable code is unchanged from `17673b66774a1b532fc22972603407dcbb932bad`.
- Last fully validated docs-only HEAD before this manual-homologation update: `c4be4642afcfd53fd4eed2ba50e56c1d5c05e8a4`.
- Docs-only history after the executable commit contains QA/rollout/ledger status updates only; no runtime code changed after the executable SHA.
- Production deploy: **NO**
- Merge: **NO**

## Local automated gate evidence

All commands below ran from `C:\Projetos\sistema-para-delivery\.worktrees\spec-c3-settings-surface` on the exact executable SHA.

| Command | Result | Evidence |
|---|---|---|
| `git status --short` | PASS | Only the pre-existing, ignored-by-Git SDD working ledger was untracked: `.superpowers/sdd/2026-09-16-frontend-modularization-c3-settings-surface-plan/`. |
| `git diff --check` | PASS | Exit code 0. |
| `npm.cmd test` | PASS | Exit code 0; full suite 1671/1671. |
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
| Exact executable SHA pushed | PASS | Executable `17673b66774a1b532fc22972603407dcbb932bad` is present in the remote branch history. |
| Validate workflow after executable QA docs | PASS | `Validate application` #1216 / run `35176245887`, `workflow_dispatch`, head SHA `8b01af19a4f74fd4725394860edd6a85d50d4915`; all jobs green. |
| Post-documentation Validate | PASS | `Validate application` #1217 / run `35176750253`, `workflow_dispatch`, head SHA `7dc646b`; all jobs green. |
| Final pre-manual-QA Validate | PASS | `Validate application` #1218 / run `35176938021`, `workflow_dispatch`, head SHA `c4be4642afcfd53fd4eed2ba50e56c1d5c05e8a4`; all jobs green. |

Validate #1218 covered tests, architecture, lint, build, production/staging Worker dry-runs, local D1 migration, and the Spec B D1 clean-install/upgrade gate. This manual-homologation record update is docs-only; its resulting HEAD should receive one final Validate before PR/merge authorization.

## Staging deployment

- Configured staging target: `https://sistema-para-delivery-staging.vzaponi.workers.dev`.
- Deployment workflow: **PASS**, #179 / run `35176387507`, `workflow_dispatch`, deployed SHA `471d377f973864be6d3037e47a743a02f6a59df0`.
- `471d377f973864be6d3037e47a743a02f6a59df0` differs from executable `17673b66774a1b532fc22972603407dcbb932bad` only by documentation; staging therefore runs the exact C3 executable code under review.
- Automated staging login verification: **PASS**.
- No production workflow, deploy, or configuration change was made.

## Manual staging homologation matrix

Manual staging verification was resumed with direct user observation. The user confirmed that the pre-existing, ordinary Settings flows and visuals exercised in scenarios 1–14 continue to behave exactly as before the C3 ownership refactor. No regression was observed in those scenarios. Higher-risk/error/transient scenarios 15–23 were not deliberately reproduced in this manual pass; automated coverage remains complementary evidence only and does not convert them from `BLOCKED` to `PASS`.

| # | Scenario | Result | Evidence / limitation |
|---|---|---|---|
| 1 | Settings Home cards, visibility, and capabilities | PASS | Direct staging observation; existing behavior unchanged. |
| 2 | Operations load/edit/save/cancel/success feedback | PASS | Direct staging observation; existing behavior unchanged. |
| 3 | Modalities share the Operations draft | PASS | Direct staging observation within the existing Operations/Modalities flow; no regression reported. |
| 4 | Operations ↔ Modalities dirty navigation has no discard prompt | PASS | Direct staging observation of the existing navigation behavior; no regression reported. |
| 5 | Leaving a dirty Operations/Modalities draft prompts and discards once | PASS | Direct staging observation of the existing dirty-exit behavior; no regression reported. |
| 6 | Payment Methods controls/menu/save/cancel/read-only | PASS | Direct staging observation; existing behavior unchanged. |
| 7 | Cancellation Reasons add/edit/order/save/cancel/read-only | PASS | Direct staging observation; existing behavior unchanged. |
| 8 | Finance Categories add/edit/type/order/save/cancel/read-only | PASS | Direct staging observation; existing behavior unchanged. |
| 9 | Printing Policy copy policy edit/save/cancel/notices | PASS | Direct staging observation; existing behavior unchanged. |
| 10 | Printing Station name/platform/auto-print/primary flows | PASS | Direct staging observation; existing behavior unchanged. |
| 11 | Local printer discovery/selection/status/test-print controls | PASS | Direct staging observation of the existing local-printing controls; no regression reported. |
| 12 | Device Preferences theme/sound/diagnostics/local autosave | PASS | Direct staging observation; existing local-preference behavior unchanged. |
| 13 | Light theme at desktop and mobile widths | PASS | Direct staging observation; existing visual behavior unchanged. |
| 14 | Dark theme at desktop and mobile widths | PASS | Direct staging observation; existing visual behavior unchanged. |
| 15 | Known load failure and retry | BLOCKED | Controlled load failure/retry was not deliberately induced in this manual pass. |
| 16 | 409 conflict review | BLOCKED | Concurrent stale-revision/409 scenario was not deliberately reproduced in this manual pass. |
| 17 | Unknown-result/unconfirmed reconciliation | BLOCKED | Unknown-result transport failure was not deliberately induced in staging. |
| 18 | Browser reload/close dirty-draft abandonment prompt | BLOCKED | This specific reload/close path was not separately exercised during the manual pass. |
| 19 | Browser reload/close saving/unconfirmed abandonment risk | BLOCKED | Transient `saving`/`unconfirmed` timing was not reproducibly exercised manually. |
| 20 | Internal navigation while saving/unconfirmed | BLOCKED | Transient `saving`/`unconfirmed` timing was not reproducibly exercised manually. |
| 21 | Confirmed save refreshes effective business config | BLOCKED | Cross-surface effective-config refresh was not separately isolated and observed in this manual pass. |
| 22 | Logout/login or context changes do not leak policy state | BLOCKED | Session-switch isolation was not separately exercised in this manual pass. |
| 23 | No C3-attributable console errors | BLOCKED | Browser console was not explicitly inspected as a dedicated QA scenario. |

## Matrix summary and merge readiness

- PASS: **14**
- FAIL: **0**
- BLOCKED: **9**

The ordinary functional and visual Settings flows covered by scenarios 1–14 are manually homologated in staging with no observed regression. The nine remaining scenarios are exceptional/error/transient/session-observability cases that were not manually reproduced; their automated tests remain complementary evidence and they stay explicitly `BLOCKED`.

C3 has passed the full automated gate set, architecture/facade audits, staging deployment/login verification, and the manually observable ordinary Settings regression pass with **0 FAIL**. After a final Validate on the docs-only HEAD produced by this homologation update, the branch can move to PR/merge-gate review. Merge still requires explicit user authorization. Production remains untouched.
