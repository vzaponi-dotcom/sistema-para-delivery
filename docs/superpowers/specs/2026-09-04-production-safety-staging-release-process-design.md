# Gestão Delivery — Production Safety, Staging and Release Process Design

Date: 2026-09-04
Status: Approved design pending written-spec review
Repository: `vzaponi-dotcom/sistema-para-delivery`
Production branch: `master`

## 1. Goal

The system is now carrying real operational data. From this point forward, production must stop being the place where new work is first exercised.

This design introduces a professional but lightweight delivery process that keeps development fast while reducing the chance that a code change, migration, or deployment affects real users or real business data unexpectedly.

The target flow is:

`feature branch -> pull request -> CI -> staging -> human acceptance -> merge master -> explicit production release -> smoke test`

## 2. Current state and risks found

The repository currently has these relevant characteristics:

- `master` is not protected.
- `.github/workflows/validate.yml` validates only pushes to `master` and manual runs; it does not currently gate pull requests before merge.
- `.github/workflows/deploy-production.yml` is already manual through `workflow_dispatch`, which is a good base for controlled production releases.
- `deploy-production.yml` currently runs tests, lint, build, Wrangler dry-run, applies remote D1 migrations, deploys the Worker, and verifies production login.
- `wrangler.jsonc` contains only the production Worker and production D1 binding.
- Production D1 is `amor-e-sabor-delivery`.
- Production Worker is `sistema-para-delivery`.
- A separate Cloudflare Git integration has been observed publishing after `master` changes. That path must be disabled so production is changed only by the controlled GitHub Actions workflow.

The main risks are therefore not a lack of tests, but lack of isolation and enforcement before code reaches production.

## 3. Selected architecture

### 3.1 Environments

There will be two persistent environments.

#### Production

- Worker: `sistema-para-delivery`
- D1: `amor-e-sabor-delivery`
- Source branch: `master`
- Contains real business data.
- Deployment is explicit and manual.
- Remote D1 migrations are never run by ordinary CI or staging jobs.

#### Staging

- Worker: `sistema-para-delivery-staging`
- D1: `amor-e-sabor-delivery-staging`
- Uses a distinct PIN/credential from production.
- Contains only fake/test operational data.
- Must never be populated by copying production customers, orders, addresses, phone numbers, payments, or financial movements.
- The product catalog may be manually represented with non-sensitive test data; automatic cloning from production is not required.

The application code is the same in both environments. Only runtime bindings and secrets differ.

### 3.2 Wrangler configuration

`wrangler.jsonc` remains the canonical Cloudflare configuration.

The top-level configuration continues to describe production. A Wrangler `env.staging` block will override at least:

- Worker name;
- D1 database name and database ID;
- staging-specific rate-limit namespace if required by Wrangler/Cloudflare.

This lets the same codebase use commands such as:

- production: `wrangler deploy`
- staging: `wrangler deploy --env staging`

No production database ID may be reused inside the staging environment.

### 3.3 Git workflow

All new work starts outside `master`.

Preferred branch names:

- `feature/<description>`
- `fix/<description>`
- `chore/<description>`

Every product or infrastructure change is merged through a Pull Request to `master`.

Direct development on `master` stops.

## 4. CI before merge

`.github/workflows/validate.yml` will be generalized to run on:

- `pull_request` targeting `master`;
- pushes to `master` as a post-merge verification;
- `workflow_dispatch` for manual diagnostics.

The required validation gate is:

1. `npm ci`
2. `npm test`
3. `npm run lint`
4. `npm run build`
5. Wrangler production bundle dry-run
6. local D1 migration application

Feature-specific workflows may remain, but the generic validation workflow is the minimum merge gate for all PRs.

CI must never contact production D1 with a write operation.

## 5. Staging deployment

A dedicated `.github/workflows/deploy-staging.yml` will deploy to the staging Worker and staging D1.

For the current single-developer workflow, staging is a shared persistent environment. A PR targeting `master` may deploy its current head to staging after validation succeeds.

The workflow must use concurrency so two staging deployments cannot run at the same time. The most recent accepted PR head becomes the content of shared staging.

If multiple developers or several concurrent PRs become common later, this design can evolve to ephemeral per-PR Workers. That complexity is intentionally deferred for now.

Staging deployment steps:

1. checkout the PR head;
2. install dependencies;
3. run the same validation gate;
4. verify Cloudflare credentials;
5. apply migrations only to `amor-e-sabor-delivery-staging`;
6. ensure staging auth credential exists using a `STAGING_PIN` secret;
7. deploy with `wrangler deploy --env staging`;
8. run a staging login/smoke check;
9. report the staging URL in the workflow summary.

Staging failures never trigger production changes.

## 6. Production release

Production remains an explicit release action using `.github/workflows/deploy-production.yml`.

The workflow will be hardened so that:

- it can deploy only the `master` branch;
- it uses the GitHub `production` environment;
- tests and build must pass before any production write;
- pending migrations are shown before application;
- a D1 export/safety snapshot is attempted before applying pending production migrations when supported by Wrangler;
- production migrations are applied only inside this workflow;
- the Worker is deployed only after successful migration;
- smoke checks run after deployment.

The external Cloudflare Git auto-deploy from `master` must be disabled. After that change, a merge to `master` updates source control and CI only; it does not by itself publish production.

## 7. Database migration policy

Production migrations must follow a forward-compatible policy.

Preferred order for schema evolution:

1. add compatible schema;
2. deploy code that can work with the old and new state when necessary;
3. migrate/backfill data;
4. switch reads/writes to the new state;
5. remove obsolete structures only in a later release after confidence is established.

Rules:

- no ad-hoc `DELETE`, destructive `ALTER`, or table recreation against production as part of ordinary development;
- no production customer data may be copied into staging;
- destructive or large data transformations require an explicit backup/export strategy before execution;
- rollback planning focuses on forward-compatible DB changes because code can be rolled back more easily than schema/data;
- every PR containing a migration must explain its production impact in the PR description.

## 8. Branch protection

`master` should be protected with repository rules.

Desired protections:

- require a Pull Request before merge;
- required approvals: 0 for now, because this is currently a single-developer repository;
- require the generic validation status check;
- require conversations to be resolved;
- block force pushes;
- block branch deletion.

The required approval count can be raised when a second regular reviewer exists.

The currently connected GitHub integration can read branch state but does not expose repository-admin writes for branch protection, so enabling these rules may require one explicit GitHub Settings action outside the code change.

## 9. GitHub environments and secrets

Use two GitHub environments:

### `staging`

Expected secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `STAGING_PIN`

### `production`

Existing/expected secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `AMOR_PIN`

Production secrets are not used in pull-request validation.

Where GitHub supports it for the current plan/account, the `production` environment should require an explicit reviewer/approval before the deploy job starts. If environment approvals are not available, `workflow_dispatch` remains the explicit release gate.

## 10. Feature flags

A generic feature-flag subsystem will not be introduced now.

For a future large or high-risk feature, a narrow feature-specific flag may be added so code can be deployed disabled and activated later. This will be decided per feature to avoid unnecessary infrastructure.

## 11. Release checklist

A repository document will define the production checklist.

Before production:

- PR merged to `master`;
- generic CI green;
- staging deployment green;
- acceptance completed in staging;
- migration impact reviewed;
- backup/export requirement decided;
- rollback path known.

During production release:

- deploy is started explicitly;
- only `master` is deployable;
- migrations are listed before application;
- safety snapshot is captured when applicable;
- migrations succeed;
- Worker deploy succeeds.

After production:

- login works;
- product list loads;
- order read/create critical path is smoke-tested without generating misleading real business data where possible;
- finance and orders pages load;
- deployment and workflow remain green.

## 12. Rollback strategy

### Code rollback

If the new Worker version causes a regression, redeploy the last known-good `master` release/commit after confirming database compatibility.

### Database rollback

Automatic down-migrations are not the default. Production migrations must instead be designed to remain compatible with the previous application version during the release window whenever practical.

For destructive data operations, restoration is based on a pre-operation export/backup, with the restoration procedure reviewed before the destructive step is authorized.

## 13. Operational ownership between ChatGPT and Codex

The process does not require Codex for every change.

Recommended split:

- ChatGPT: product reasoning, UX/business rules, architecture, specifications, release review, operational checks;
- Codex: larger repository implementations, refactors, TDD-heavy changes, systematic debugging, and execution of approved implementation plans;
- GitHub Actions: objective test/build/deploy gates;
- human owner: staging acceptance and explicit production release decision.

Small, bounded repository changes may still be performed directly through the GitHub workflow as long as they use a feature branch, PR, CI, staging, and controlled production release.

## 14. Implementation scope for this hardening round

This round includes:

1. create staging D1;
2. configure staging Worker environment;
3. add staging package scripts;
4. make generic CI run for PRs and local migrations;
5. add staging deployment workflow;
6. harden production deployment workflow;
7. add release/migration documentation;
8. verify staging end-to-end;
9. disable Cloudflare Git automatic production deployment;
10. enable `master` protection rules.

Items 9 and 10 may require one-time account/admin configuration outside repository files if the connected integrations do not expose the required administrative write APIs.

## 15. Non-goals

This hardening round does not:

- change customer-facing business behavior;
- redesign application screens;
- copy production data into staging;
- introduce a general feature-flag service;
- add multi-region environments;
- introduce Kubernetes, containers, or other infrastructure that is unnecessary for the current scale.

## 16. Success criteria

The hardening is complete when all of the following are true:

- a PR receives the complete validation gate before merge;
- staging has a separate Worker and a separate D1 database;
- a branch/PR can be deployed and tested in staging without touching production data;
- merging to `master` no longer automatically publishes production through Cloudflare Git integration;
- production deploy requires an explicit action;
- production D1 writes happen only in the controlled production workflow or a separately authorized operational procedure;
- `master` is protected from normal direct pushes/force pushes;
- a documented release and rollback checklist exists;
- production remains functional after the process change.
