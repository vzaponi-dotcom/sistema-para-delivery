# Production Safety, Staging and Release Process Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a safe delivery pipeline where feature work is validated before merge, can be exercised against an isolated staging Worker/D1, and reaches production only through an explicit controlled release.

**Architecture:** Keep one codebase and one canonical `wrangler.jsonc`, with the existing top-level configuration remaining production and a named `env.staging` overriding the Worker name and all non-inheritable bindings. GitHub Actions becomes the enforcement layer: generic PR CI performs no remote writes, staging deploy writes only to the staging D1, and production deploy is manual, master-only, and the only ordinary workflow allowed to write production D1.

**Tech Stack:** React 19, Vite 8, Node.js 22, Node test runner, Oxlint, Cloudflare Workers, Wrangler 4.128.0, Cloudflare D1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-04-production-safety-staging-release-process-design.md`

## Global Constraints

- Production Worker remains `sistema-para-delivery`.
- Production D1 remains `amor-e-sabor-delivery`.
- Staging Worker is `sistema-para-delivery-staging`.
- Staging D1 is `amor-e-sabor-delivery-staging`.
- Production D1 data must never be copied into staging.
- Production remains the top-level Wrangler environment; staging is the named `staging` environment.
- Staging must use its own rate-limit namespace; use namespace ID `2026090401`.
- `master` is the production source branch.
- Ordinary PR validation must never perform a remote D1 write.
- Production deployment stays explicit/manual.
- Wrangler stays pinned at `4.128.0` in repository scripts/workflows.
- Node.js stays at version 22 in GitHub Actions.
- Production migrations must remain forward-compatible whenever practical; automatic down-migrations are not introduced.
- No production PIN, staging PIN, D1 export, customer data, order data, payment data, phone numbers, or addresses may be committed to Git.
- A Cloudflare D1 migration apply already captures a backup; do not export real production data into a GitHub Actions artifact merely to create a second backup copy.

---

## File Structure

Final persistent files created or modified by this plan:

- Modify: `wrangler.jsonc` — production config plus isolated `env.staging` bindings.
- Modify: `package.json` — explicit local/staging/production scripts with ambiguous remote/deploy aliases removed.
- Create: `scripts/infra/productionSafetyRegression.test.js` — executable safety contract for config and workflow invariants.
- Modify: `.github/workflows/validate.yml` — required generic PR/post-merge validation gate.
- Create: `.github/workflows/deploy-staging.yml` — manual staging deployment after the workflow exists on `master`.
- Modify: `.github/workflows/deploy-production.yml` — master-only production release with local migration validation before any remote write.
- Create: `.github/pull_request_template.md` — release/migration impact checklist.
- Create: `docs/release-and-migration-runbook.md` — operator-facing staging, release, rollback and migration procedure.
- Modify: `README.md` — point routine operations to the safe workflow instead of ad-hoc production commands.

Temporary files used only during bootstrap/acceptance and removed before merge:

- `.github/workflows/bootstrap-staging-d1-once.yml`
- `.github/workflows/staging-acceptance-once.yml`

---

### Task 1: Bootstrap isolated staging D1 and lock the environment contract

**Files:**
- Create: `scripts/infra/productionSafetyRegression.test.js`
- Temporary create/delete: `.github/workflows/bootstrap-staging-d1-once.yml`
- Modify: `wrangler.jsonc`
- Modify: `package.json`

**Interfaces:**
- Consumes: production D1 name `amor-e-sabor-delivery`, production database UUID already present in `wrangler.jsonc`.
- Produces: a real remote D1 named `amor-e-sabor-delivery-staging`; `wrangler.jsonc.env.staging`; scripts `d1:migrate:staging`, `d1:migrate:production`, `deploy:staging`, `deploy:production`.

- [ ] **Step 1: Write the failing infrastructure safety test**

Create `scripts/infra/productionSafetyRegression.test.js` with these initial checks:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const wrangler = readFileSync('wrangler.jsonc', 'utf8')

const productionDatabaseId = 'baa83769-4637-43f6-bf77-711f4f2ed069'

test('staging uses an isolated Worker, D1 database, and rate-limit namespace', () => {
  assert.match(wrangler, /"staging"\s*:\s*\{/)
  assert.match(wrangler, /"name"\s*:\s*"sistema-para-delivery-staging"/)
  assert.match(wrangler, /"database_name"\s*:\s*"amor-e-sabor-delivery-staging"/)
  assert.match(wrangler, /"namespace_id"\s*:\s*"2026090401"/)

  const stagingStart = wrangler.indexOf('"staging"')
  assert.notEqual(stagingStart, -1)
  const stagingBlock = wrangler.slice(stagingStart)
  assert.doesNotMatch(stagingBlock, new RegExp(productionDatabaseId))
})

test('package scripts make staging and production targets explicit', () => {
  assert.equal(
    packageJson.scripts['d1:migrate:staging'],
    'npx --yes wrangler@4.128.0 d1 migrations apply amor-e-sabor-delivery-staging --remote --env staging',
  )
  assert.equal(
    packageJson.scripts['d1:migrate:production'],
    'npx --yes wrangler@4.128.0 d1 migrations apply amor-e-sabor-delivery --remote',
  )
  assert.equal(
    packageJson.scripts['deploy:staging'],
    'npm run build && npx --yes wrangler@4.128.0 deploy --env staging',
  )
  assert.equal(
    packageJson.scripts['deploy:production'],
    'npm run build && npx --yes wrangler@4.128.0 deploy',
  )
  assert.equal(packageJson.scripts['d1:migrate:remote'], undefined)
  assert.equal(packageJson.scripts.deploy, undefined)
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test scripts/infra/productionSafetyRegression.test.js
```

Expected: FAIL because `env.staging` and the explicit staging/production scripts do not exist yet.

- [ ] **Step 3: Create the staging D1 idempotently through a one-time branch-only workflow**

Create `.github/workflows/bootstrap-staging-d1-once.yml` on `chore/production-safety-hardening` with:

```yaml
name: Bootstrap staging D1 once

on:
  push:
    branches:
      - chore/production-safety-hardening
    paths:
      - .github/workflows/bootstrap-staging-d1-once.yml

permissions:
  contents: read

jobs:
  bootstrap:
    runs-on: ubuntu-latest
    environment: production
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Create staging database only when absent
        shell: bash
        run: |
          set -euo pipefail
          npx --yes wrangler@4.128.0 d1 list --json > /tmp/d1-list.json
          STAGING_DATABASE_ID="$(node --input-type=module <<'NODE'
          import fs from 'node:fs'
          const list = JSON.parse(fs.readFileSync('/tmp/d1-list.json', 'utf8'))
          const match = list.find((db) => db.name === 'amor-e-sabor-delivery-staging')
          process.stdout.write(match?.uuid || match?.id || '')
          NODE
          )"

          if [ -z "$STAGING_DATABASE_ID" ]; then
            npx --yes wrangler@4.128.0 d1 create amor-e-sabor-delivery-staging
            npx --yes wrangler@4.128.0 d1 list --json > /tmp/d1-list.json
            STAGING_DATABASE_ID="$(node --input-type=module <<'NODE'
            import fs from 'node:fs'
            const list = JSON.parse(fs.readFileSync('/tmp/d1-list.json', 'utf8'))
            const match = list.find((db) => db.name === 'amor-e-sabor-delivery-staging')
            process.stdout.write(match?.uuid || match?.id || '')
            NODE
            )"
          fi

          if [ -z "$STAGING_DATABASE_ID" ]; then
            echo 'Could not resolve staging D1 database ID.' >&2
            exit 1
          fi

          echo "STAGING_DATABASE_ID=$STAGING_DATABASE_ID"
```

Push only this workflow change, wait for the run to finish green, and read the actual `STAGING_DATABASE_ID` from the job log. The workflow must not call `d1 migrations`, `d1 execute`, or `wrangler deploy`.

- [ ] **Step 4: Add the real staging environment to `wrangler.jsonc`**

Using the actual UUID returned by Step 3, add this named environment while leaving the existing top-level production binding unchanged:

```jsonc
"env": {
  "staging": {
    "name": "sistema-para-delivery-staging",
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "amor-e-sabor-delivery-staging",
        "database_id": "the exact UUID returned by Step 3",
        "migrations_dir": "migrations"
      }
    ],
    "ratelimits": [
      {
        "name": "LOGIN_RATE_LIMITER",
        "namespace_id": "2026090401",
        "simple": {
          "limit": 5,
          "period": 60
        }
      }
    ]
  }
}
```

The committed file must contain the resolved literal UUID; the quoted wording above is an instruction in this plan, not content to commit.

- [ ] **Step 5: Replace ambiguous remote/deploy package scripts with explicit targets**

Change `package.json` scripts to keep existing local commands and use these production/staging names:

```json
{
  "d1:migrate:local": "npx --yes wrangler@4.128.0 d1 migrations apply amor-e-sabor-delivery --local",
  "d1:migrate:staging": "npx --yes wrangler@4.128.0 d1 migrations apply amor-e-sabor-delivery-staging --remote --env staging",
  "d1:migrate:production": "npx --yes wrangler@4.128.0 d1 migrations apply amor-e-sabor-delivery --remote",
  "deploy:staging": "npm run build && npx --yes wrangler@4.128.0 deploy --env staging",
  "deploy:production": "npm run build && npx --yes wrangler@4.128.0 deploy"
}
```

Remove the old ambiguous `d1:migrate:remote` and `deploy` aliases.

- [ ] **Step 6: Run focused and bundle validation**

Run:

```bash
node --test scripts/infra/productionSafetyRegression.test.js
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Expected: all PASS; both dry-runs bundle successfully and do not deploy.

- [ ] **Step 7: Remove the one-time bootstrap workflow and commit the task**

Delete `.github/workflows/bootstrap-staging-d1-once.yml`, then commit:

```bash
git add package.json wrangler.jsonc scripts/infra/productionSafetyRegression.test.js .github/workflows/bootstrap-staging-d1-once.yml
git commit -m "chore: isolate staging Cloudflare resources"
```

---

### Task 2: Make generic validation a real pre-merge gate

**Files:**
- Modify: `scripts/infra/productionSafetyRegression.test.js`
- Modify: `.github/workflows/validate.yml`

**Interfaces:**
- Consumes: scripts from Task 1.
- Produces: one generic CI job that is safe to require in branch protection.

- [ ] **Step 1: Extend the safety test for CI invariants**

Append:

```js
const validateWorkflow = readFileSync('.github/workflows/validate.yml', 'utf8')

test('generic validation runs before merge and performs no remote writes', () => {
  assert.match(validateWorkflow, /pull_request:/)
  assert.match(validateWorkflow, /branches:\s*\n\s*- master/)
  assert.match(validateWorkflow, /npm run d1:migrate:local/)
  assert.match(validateWorkflow, /deploy --dry-run --env staging/)
  assert.doesNotMatch(validateWorkflow, /d1:migrate:production/)
  assert.doesNotMatch(validateWorkflow, /d1:migrate:staging/)
  assert.doesNotMatch(validateWorkflow, /--remote/)
})
```

- [ ] **Step 2: Run focused test and confirm RED**

```bash
node --test scripts/infra/productionSafetyRegression.test.js
```

Expected: FAIL because `validate.yml` has no PR trigger or local migration step.

- [ ] **Step 3: Update `.github/workflows/validate.yml`**

Use this trigger/gate shape:

```yaml
name: Validate application

on:
  pull_request:
    branches:
      - master
  push:
    branches:
      - master
  workflow_dispatch:

jobs:
  validate:
    name: validate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Test
        run: npm test
      - name: Lint
        run: npm run lint
      - name: Build
        run: npm run build
      - name: Validate production Worker bundle
        run: npx --yes wrangler@4.128.0 deploy --dry-run
      - name: Validate staging Worker bundle
        run: npx --yes wrangler@4.128.0 deploy --dry-run --env staging
      - name: Apply migrations to local D1
        run: npm run d1:migrate:local
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node --test scripts/infra/productionSafetyRegression.test.js
npm test
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Expected: all commands PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/validate.yml scripts/infra/productionSafetyRegression.test.js
git commit -m "ci: validate pull requests before merge"
```

---

### Task 3: Add controlled staging deployment

**Files:**
- Modify: `scripts/infra/productionSafetyRegression.test.js`
- Create: `.github/workflows/deploy-staging.yml`

**Interfaces:**
- Consumes: `env.staging`, `d1:migrate:staging`, `deploy:staging`, existing `scripts/generate-pin-hash.mjs`.
- Produces: manual reusable staging deployment workflow using GitHub environment `staging` and secret `STAGING_PIN`.

- [ ] **Step 1: Add a failing safety contract for staging deploy**

Append:

```js
const stagingWorkflowPath = '.github/workflows/deploy-staging.yml'

test('staging workflow targets only staging resources', () => {
  const workflow = readFileSync(stagingWorkflowPath, 'utf8')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /environment: staging/)
  assert.match(workflow, /npm run d1:migrate:staging/)
  assert.match(workflow, /npm run deploy:staging/)
  assert.match(workflow, /STAGING_PIN/)
  assert.match(workflow, /sistema-para-delivery-staging\.vzaponi\.workers\.dev/)
  assert.doesNotMatch(workflow, /npm run d1:migrate:production/)
  assert.doesNotMatch(workflow, /npm run deploy:production/)
  assert.doesNotMatch(workflow, /amor-e-sabor-delivery --remote/)
})
```

- [ ] **Step 2: Run the test and confirm RED**

```bash
node --test scripts/infra/productionSafetyRegression.test.js
```

Expected: FAIL with `ENOENT` for `.github/workflows/deploy-staging.yml`.

- [ ] **Step 3: Create `.github/workflows/deploy-staging.yml`**

Use a manual workflow with `concurrency.group: staging-deploy`, `cancel-in-progress: false`, `environment: staging`, repository Cloudflare credentials, and `STAGING_PIN`. Steps, in order:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
- run: npm ci
- run: npm test
- run: npm run lint
- run: npm run build
- run: npm run d1:migrate:local
- run: npx --yes wrangler@4.128.0 deploy --dry-run --env staging
- name: Check staging credentials
  shell: bash
  run: |
    test -n "$CLOUDFLARE_API_TOKEN"
    test -n "$CLOUDFLARE_ACCOUNT_ID"
    test -n "$STAGING_PIN"
- name: Show pending staging migrations
  run: npx --yes wrangler@4.128.0 d1 migrations list amor-e-sabor-delivery-staging --remote --env staging
- name: Apply staging migrations
  run: npm run d1:migrate:staging
- name: Configure staging PIN
  shell: bash
  run: |
    VERIFIER="$(PIN="$STAGING_PIN" node scripts/generate-pin-hash.mjs)"
    echo "::add-mask::$VERIFIER"
    VERIFIER="$VERIFIER" node --input-type=module <<'NODE'
    import fs from 'node:fs'
    const verifier = process.env.VERIFIER
    if (!verifier) throw new Error('Staging PIN verifier was not generated.')
    const escaped = verifier.replaceAll("'", "''")
    fs.writeFileSync('/tmp/staging-pin.sql', `INSERT INTO auth_credentials (business_id, pin_hash, created_at, updated_at)\nVALUES ('amor-e-sabor', '${escaped}', datetime('now'), datetime('now'))\nON CONFLICT(business_id) DO UPDATE SET pin_hash = excluded.pin_hash, updated_at = datetime('now');\n`, { mode: 0o600 })
    NODE
    npx --yes wrangler@4.128.0 d1 execute amor-e-sabor-delivery-staging --remote --env staging --yes --file /tmp/staging-pin.sql
    rm -f /tmp/staging-pin.sql
    unset VERIFIER
- name: Deploy staging
  run: npm run deploy:staging
- name: Verify staging login
  env:
    STAGING_URL: https://sistema-para-delivery-staging.vzaponi.workers.dev
  run: |
    node --input-type=module <<'NODE'
    const baseUrl = process.env.STAGING_URL
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ pin: process.env.STAGING_PIN }),
    })
    if (!response.ok) {
      console.error(`Staging login failed with HTTP ${response.status}`)
      process.exit(1)
    }
    console.log(`Staging login HTTP ${response.status}`)
    NODE
```

Declare job-level env entries for `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `STAGING_PIN` from GitHub secrets. Add a final step that writes the staging URL to `$GITHUB_STEP_SUMMARY`.

- [ ] **Step 4: Run static and local validation**

```bash
node --test scripts/infra/productionSafetyRegression.test.js
npm test
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Expected: all PASS. Do not attempt the remote staging workflow until the `staging` GitHub environment and `STAGING_PIN` exist.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy-staging.yml scripts/infra/productionSafetyRegression.test.js
git commit -m "ci: add controlled staging deployment"
```

---

### Task 4: Harden production deployment against branch mistakes and pre-release regressions

**Files:**
- Modify: `scripts/infra/productionSafetyRegression.test.js`
- Modify: `.github/workflows/deploy-production.yml`

**Interfaces:**
- Consumes: `d1:migrate:production`, `deploy:production`, existing `AMOR_PIN` behavior.
- Produces: manual master-only production release workflow.

- [ ] **Step 1: Add failing production workflow invariants**

Append:

```js
const productionWorkflow = readFileSync('.github/workflows/deploy-production.yml', 'utf8')

test('production deploy is manual, master-only, and validates locally before remote writes', () => {
  assert.match(productionWorkflow, /workflow_dispatch:/)
  assert.match(productionWorkflow, /github\.ref == 'refs\/heads\/master'/)
  assert.match(productionWorkflow, /ref: master/)
  assert.match(productionWorkflow, /npm run d1:migrate:local/)
  assert.match(productionWorkflow, /npm run d1:migrate:production/)
  assert.match(productionWorkflow, /npm run deploy:production/)
  assert.doesNotMatch(productionWorkflow, /npm run d1:migrate:remote/)
  assert.doesNotMatch(productionWorkflow, /npm run deploy\s*$/m)
})
```

- [ ] **Step 2: Confirm RED**

```bash
node --test scripts/infra/productionSafetyRegression.test.js
```

Expected: FAIL because the current production workflow has no master ref guard/local migration gate and uses the old script names.

- [ ] **Step 3: Harden `.github/workflows/deploy-production.yml`**

Make these exact structural changes:

```yaml
jobs:
  deploy:
    name: Deploy Cloudflare Worker
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    environment: production
```

Change checkout to:

```yaml
- name: Checkout master
  uses: actions/checkout@v4
  with:
    ref: master
```

Insert before `Check Cloudflare credentials`:

```yaml
- name: Apply migrations to local D1
  run: npm run d1:migrate:local
```

Keep the existing production migration listing step, but change the apply command to:

```yaml
- name: Apply D1 migrations
  run: npm run d1:migrate:production
```

Change the final deploy command to:

```yaml
- name: Deploy
  run: npm run deploy:production
```

Keep the existing production PIN upsert and login smoke check. Do not add `d1 export` to GitHub Actions: Wrangler 4.128.0 migration application captures a Cloudflare backup, and copying the full production database into a GitHub artifact would unnecessarily duplicate real customer/business data outside D1.

- [ ] **Step 4: Verify GREEN**

```bash
node --test scripts/infra/productionSafetyRegression.test.js
npm test
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: all PASS. Do not dispatch the production workflow in this task.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy-production.yml scripts/infra/productionSafetyRegression.test.js
git commit -m "ci: harden explicit production releases"
```

---

### Task 5: Add release governance to Pull Requests and operator documentation

**Files:**
- Modify: `scripts/infra/productionSafetyRegression.test.js`
- Create: `.github/pull_request_template.md`
- Create: `docs/release-and-migration-runbook.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: workflows/scripts from Tasks 1-4.
- Produces: a repeatable human release checklist and migration impact declaration.

- [ ] **Step 1: Add documentation safety assertions**

Append:

```js
const prTemplate = readFileSync('.github/pull_request_template.md', 'utf8')
const runbook = readFileSync('docs/release-and-migration-runbook.md', 'utf8')

test('PR template requires migration and rollback review', () => {
  assert.match(prTemplate, /Migration impact/)
  assert.match(prTemplate, /Rollback/)
  assert.match(prTemplate, /Staging/)
  assert.match(prTemplate, /Production data/)
})

test('release runbook documents staging before explicit production release', () => {
  assert.match(runbook, /feature\/fix branch/i)
  assert.match(runbook, /staging/i)
  assert.match(runbook, /Deploy production/)
  assert.match(runbook, /rollback/i)
  assert.match(runbook, /never.*production.*staging/i)
})
```

- [ ] **Step 2: Confirm RED**

```bash
node --test scripts/infra/productionSafetyRegression.test.js
```

Expected: FAIL because the template/runbook do not exist.

- [ ] **Step 3: Create `.github/pull_request_template.md`**

The template must contain these checkboxes/headings:

```markdown
## Summary

## Validation
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run d1:migrate:local`
- [ ] Staging deployment/acceptance completed when behavior or infrastructure changed

## Migration impact
- [ ] No migration in this PR
- [ ] Migration is additive/forward-compatible
- [ ] Data backfill/transformation reviewed
- [ ] Production data is not copied into staging

## Rollback
Describe the last known-good code version and whether the previous application version remains compatible with the resulting schema.

## Production data
Confirm this PR does not contain customer/order/payment exports, real PINs, addresses, phone numbers, or database dumps.
```

- [ ] **Step 4: Create `docs/release-and-migration-runbook.md`**

Document the exact routine:

```text
feature/fix branch
-> PR to master
-> required Validate application check
-> manual Deploy staging on the feature branch
-> human acceptance
-> merge to master
-> explicit Deploy production workflow
-> smoke test
```

The runbook must also state:

- staging uses `amor-e-sabor-delivery-staging` only;
- production uses `amor-e-sabor-delivery` only;
- production data is never copied into staging;
- routine production migrations run only in `Deploy production`;
- destructive/data-transforming migrations require a reviewed restore strategy before authorization;
- code rollback means redeploying the last known-good master commit only after checking schema compatibility;
- database rollback defaults to forward fixes/restoration from Cloudflare backup rather than automatic down-migrations;
- if staging deployment fails, production release stops;
- if production smoke check fails, stop further changes and assess code rollback before touching data.

- [ ] **Step 5: Update `README.md` deployment guidance**

Replace the current routine that tells operators to run remote migrations and `npm run deploy` manually. Point routine production releases to `.github/workflows/deploy-production.yml` and staging to `.github/workflows/deploy-staging.yml`. Keep local validation commands. List the new explicit package scripts and mark `d1:migrate:production` / `deploy:production` as release-workflow commands rather than normal developer commands.

- [ ] **Step 6: Verify and commit**

```bash
node --test scripts/infra/productionSafetyRegression.test.js
npm test
npm run lint
npm run build
```

Expected: all PASS.

Commit:

```bash
git add .github/pull_request_template.md docs/release-and-migration-runbook.md README.md scripts/infra/productionSafetyRegression.test.js
git commit -m "docs: define safe release and migration process"
```

---

### Task 6: Configure staging credentials and perform one-time pre-merge staging acceptance

**Files:**
- Temporary create/delete: `.github/workflows/staging-acceptance-once.yml`
- No persistent product code changes expected.

**Interfaces:**
- Consumes: real staging D1 from Task 1, staging config/workflow semantics from Tasks 1-3.
- Produces: verified remote staging database, staging Worker URL, successful staging login smoke check.

- [ ] **Step 1: Configure the one required staging secret outside Git**

In GitHub repository settings, create environment `staging` and set `STAGING_PIN` to a PIN distinct from production. Reuse the existing repository-level `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` if they are already repository secrets; do not copy `AMOR_PIN` into staging.

No PIN value is written into chat, Git, workflow YAML, logs, or the plan.

- [ ] **Step 2: Add a temporary branch-only staging acceptance workflow**

Because `workflow_dispatch` only becomes manually runnable after `deploy-staging.yml` exists on the default branch, create `.github/workflows/staging-acceptance-once.yml` on the hardening branch with a `push` trigger restricted to `chore/production-safety-hardening` and to that workflow path. Its job body must be the same staging sequence defined in Task 3 and must use `environment: staging`.

- [ ] **Step 3: Run and verify the one-time staging acceptance workflow**

The run must prove all of these in its logs:

```text
npm test: pass
npm run lint: pass
npm run build: pass
npm run d1:migrate:local: pass
staging D1 migrations: applied/no pending migrations
staging PIN row: configured
staging Worker deploy: success
staging login: HTTP 2xx
```

Verify the deployed URL is exactly:

```text
https://sistema-para-delivery-staging.vzaponi.workers.dev
```

Do not query or modify `amor-e-sabor-delivery` in this workflow.

- [ ] **Step 4: Remove the one-time acceptance workflow**

Delete `.github/workflows/staging-acceptance-once.yml` and commit the deletion before opening the PR.

---

### Task 7: Final branch verification and Pull Request

**Files:**
- No new file required unless verification finds a defect.

**Interfaces:**
- Consumes: all persistent repository changes from Tasks 1-5 and remote staging proof from Task 6.
- Produces: reviewable PR to `master` with objective CI evidence.

- [ ] **Step 1: Run the complete local-equivalent gate**

```bash
npm test
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Expected: every command exits 0.

- [ ] **Step 2: Review branch diff for production references**

Confirm:

```text
production database UUID appears only in the top-level production D1 binding
staging block contains a different D1 UUID
staging workflow contains no production migration/deploy command
validate workflow contains no --remote command
production workflow is workflow_dispatch + master-only
no PIN verifier/plain PIN/database dump was added
one-time workflows are absent
```

- [ ] **Step 3: Open Pull Request to `master`**

Use title:

```text
chore: harden staging and production release process
```

PR body must complete the new template and explicitly note that this infrastructure PR changes no customer-facing business behavior.

- [ ] **Step 4: Wait for generic CI and feature workflows that apply**

Required outcome: `Validate application / validate` green. Any red check is investigated and fixed on the branch; do not merge around it.

---

### Task 8: Perform the two external administration gates before/after merge

**Files:**
- No repository files.

**Interfaces:**
- Consumes: green hardening PR.
- Produces: no automatic Cloudflare publication from `master`, then protected `master`.

- [ ] **Step 1: Disable Cloudflare Git auto-deploy before merging the hardening PR**

In the Cloudflare Workers project currently linked to `vzaponi-dotcom/sistema-para-delivery`, disable automatic production deployment/build on `master`. Keep the Worker itself and its production D1 binding intact.

Verification criterion: a new commit pushed/merged to `master` must no longer cause Cloudflare Git integration to publish production automatically. GitHub Actions `Deploy production` remains the authorized release path.

- [ ] **Step 2: Merge the hardening PR only after CI is green and Cloudflare auto-deploy is disabled**

Do not dispatch `Deploy production` as part of this merge; the application code has not changed and production should remain on its last known-good Worker version.

- [ ] **Step 3: Enable `master` branch protection after the workflow exists on default branch**

Configure repository branch/rules settings with:

```text
Require a pull request before merging: enabled
Required approvals: 0
Require status checks before merging: enabled
Required check: Validate application / validate
Require conversation resolution: enabled
Allow force pushes: disabled
Allow deletion: disabled
```

If GitHub requires at least one approval for the chosen rule type, use the closest single-developer-compatible rule that still blocks ordinary direct pushes and requires the validation check; record the exact resulting rule in the PR/operations notes.

- [ ] **Step 4: Verify branch state via GitHub API**

Confirm `master` reports protection/rules enabled and the required validation check is present. If repository plan limitations prevent a specific rule, document that limitation and retain the strongest available settings rather than silently skipping protection.

---

### Task 9: Post-hardening operational proof

**Files:**
- No persistent code changes expected.

**Interfaces:**
- Consumes: merged workflow/configuration and administrative gates.
- Produces: evidence that the new process works without changing production.

- [ ] **Step 1: Manually run `Deploy staging` from `master`**

After the workflow exists on the default branch, use the GitHub Actions branch selector to run `Deploy staging` on `master`. Expected: green staging deployment and login smoke test.

- [ ] **Step 2: Confirm production did not deploy from the merge**

Compare the production Worker deployment/version timestamp before and after the hardening merge. Expected: no automatic new production deployment from Git integration.

- [ ] **Step 3: Confirm production application still responds normally**

Perform read-only smoke checks where possible:

```text
login page loads
existing production PIN login succeeds
products page/list loads
orders page loads with real production state unchanged
finance page loads with real production state unchanged
```

Do not create fake production customers, orders, payments, movements, print jobs, or finance entries for this verification.

- [ ] **Step 4: Final completion report**

Report:

```text
staging D1 database name + UUID
staging Worker URL
hardening PR number + merge SHA
Validate application run ID/result
staging deployment run ID/result
master protection result
Cloudflare Git auto-deploy disabled: yes/no with evidence
production deploy triggered by hardening: no
remaining manual limitation, if any
```

The hardening is complete only when staging is usable, PR validation is a required gate, production is not auto-published from Git integration, and `master` is protected as strongly as the repository/account supports.
