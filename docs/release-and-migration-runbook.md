# Release and Migration Runbook

This document is the operating procedure for changing Gestão Delivery now that production contains real business data.

## Standard release flow

```text
feature/fix branch
-> Pull Request to master
-> required Validate application / validate check
-> manual/automatic staging deployment for the approved branch
-> human acceptance in staging
-> merge to master
-> explicit Deploy production workflow
-> production smoke test
```

A merge to `master` is source-control integration, not authorization to publish production. Production is released only through the explicit **Deploy production** GitHub Actions workflow after staging acceptance and review.

## Environment boundaries

Staging uses only the Worker `sistema-para-delivery-staging` and D1 database `amor-e-sabor-delivery-staging`.

Production uses only the Worker `sistema-para-delivery` and D1 database `amor-e-sabor-delivery`.

Production data is **never copied from production into staging**. This includes customers, orders, addresses, phone numbers, payments, finance movements, sessions, print jobs, database exports, and real PINs. Staging contains fake/test data only.

## Before opening or merging a PR

Run or obtain a green result for the complete validation gate:

```bash
npm test
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
```

Branches/releases that include the Spec B settings schema/policies (`0024`/`0025`) must additionally pass the real local D1 upgrade/clean-install gate:

```bash
node scripts/infra/spec-b-d1-gate.mjs
```

The repository `Validate application` workflow runs this gate after local migrations while Spec B is being closed. A node:sqlite-only test is not a substitute for this Wrangler/D1 gate.

Any red validation check blocks the release. Fix the root cause on the branch; do not merge around a failing check.

For a behavior or infrastructure change, deploy that branch to staging and complete acceptance there before merging.

## Staging release

Use the **Deploy staging** GitHub Actions workflow. It may write only to staging resources. The workflow validates the application, applies migrations to `amor-e-sabor-delivery-staging`, configures the staging-only credential, deploys `sistema-para-delivery-staging`, and performs a staging login smoke check.

If staging deployment, migration, or acceptance fails, the production release stops. Production is not used to diagnose unfinished branch changes.

For Spec B, record the exact staging SHA and the acceptance evidence in `docs/superpowers/qa/2026-09-15-spec-b-final-closure.md`. Physical printing acceptance by context remains a separate release gate documented in `docs/superpowers/qa/2026-09-12-spec-b-physical-printing-guide.md`.

## Migration review

Every PR containing a migration must document its production impact.

Prefer forward-compatible evolution:

1. add compatible schema;
2. deploy code capable of tolerating the transition when necessary;
3. backfill or transform data;
4. move reads/writes to the new structure;
5. remove obsolete structures only in a later release after confidence is established.

Routine production migrations run only inside **Deploy production**. Ordinary CI and staging must not write to production D1.

Destructive or data-transforming migrations require a reviewed restore strategy before authorization. Confirm the expected Cloudflare D1 recovery/backup path and schema compatibility before executing the destructive step.

Automatic down-migrations are not the default database rollback strategy.

### Spec B migrations 0024/0025

`0024_business_settings_policies.sql` persists typed settings/catalogs and their revisions. `0025_print_context_copies.sql` extends printing snapshots/policies by context. Before production:

- prove clean install and upgrade through `node scripts/infra/spec-b-d1-gate.mjs`;
- preserve existing print-history rows and references;
- preserve already-created jobs and their copy snapshot when defaults change;
- do not assume an older application version remains safe after users create custom settings or two-copy jobs.

## Production release

After the PR is merged and staging acceptance is complete, explicitly start **Deploy production** from `master`.

The workflow must:

1. check out `master`;
2. run tests, lint, build, local migrations, and the production Worker dry-run;
3. list pending production D1 migrations;
4. apply production migrations through the controlled production script;
5. preserve/configure the production PIN according to the existing release rules;
6. deploy the Worker;
7. run the production login smoke check.

Do not run routine production migrations or Worker deployment directly from a feature branch.

For Spec B specifically, **do not authorize Deploy production while the physical printing-by-context matrix remains pending**. Existing physical validation of QZ/Windows infrastructure does not automatically prove the new 1/2-copy policy matrix for the current SHA.

## Production smoke test

After a successful release, verify read-only behavior first:

- login succeeds;
- products load;
- orders page loads;
- finance page loads;
- Settings home and the expected policies load;
- the expected production state remains visible.

Avoid creating fake production customers, orders, payments, movements, print jobs, or financial entries as a release test.

## Rollback

### Code rollback

Code rollback means redeploying the last known-good `master` commit/version **only after checking that the previous application version remains compatible with the current production schema and data**.

For Spec B this check is mandatory after `0024`/`0025`: custom catalogs/settings and jobs with context-specific copy snapshots may make an older application semantically incompatible even though the SQL schema is additive.

If the production smoke check fails, stop further changes and assess code rollback before touching production data. Prefer a forward fix when compatibility of the previous binary is uncertain.

### Database rollback

Database rollback normally uses a forward fix or restoration from the applicable Cloudflare D1 backup/recovery point. Do not improvise reverse SQL or automatic down-migrations after a failed release.

For destructive operations, the restoration procedure must be understood before the destructive step is authorized.

## Emergency rule

A production incident does not turn production into a development environment. Diagnose the failure, prepare the smallest safe fix on a branch, validate it, use staging whenever the incident permits, and release through the controlled production path. Any exceptional direct production operation requires explicit authorization and should be recorded in the incident/release notes.
