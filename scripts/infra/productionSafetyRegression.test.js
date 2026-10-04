import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const wrangler = readFileSync('wrangler.jsonc', 'utf8')
const validateWorkflow = readFileSync('.github/workflows/validate.yml', 'utf8')
const stagingWorkflowPath = '.github/workflows/deploy-staging.yml'
const productionWorkflow = readFileSync('.github/workflows/deploy-production.yml', 'utf8')
const prTemplate = readFileSync('.github/pull_request_template.md', 'utf8')
const runbook = readFileSync('docs/release-and-migration-runbook.md', 'utf8')

const productionDatabaseId = 'baa83769-4637-43f6-bf77-711f4f2ed069'

test('production and staging have isolated Mesiva custom domains while workers.dev remains available', () => {
  const config = JSON.parse(wrangler)
  assert.equal(config.workers_dev, true)
  assert.deepEqual(config.routes, [{ pattern: 'app.mesiva.com.br', custom_domain: true }])
  assert.equal(config.env.staging.workers_dev, true)
  assert.deepEqual(config.env.staging.routes, [{ pattern: 'staging.mesiva.com.br', custom_domain: true }])
  assert.notDeepEqual(config.routes, config.env.staging.routes, 'production and staging must never share the same custom domain')
  assert.equal(config.env.staging.d1_databases[0].database_id, '73a1c0c1-142f-4247-8ffc-e858ab2ac400')
  assert.equal(config.env.staging.r2_buckets[0].bucket_name, 'mesiva-business-assets-staging')
})

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

test('generic validation runs before merge and performs no remote writes', () => {
  assert.match(validateWorkflow, /pull_request:/)
  assert.match(validateWorkflow, /branches:\s*\n\s*- master/)
  assert.match(validateWorkflow, /npm run d1:migrate:local/)
  assert.match(validateWorkflow, /deploy --dry-run --env staging/)
  assert.doesNotMatch(validateWorkflow, /d1:migrate:production/)
  assert.doesNotMatch(validateWorkflow, /d1:migrate:staging/)
  assert.doesNotMatch(validateWorkflow, /--remote/)
})

test('staging workflow targets only staging resources', () => {
  const workflow = readFileSync(stagingWorkflowPath, 'utf8')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /environment: staging/)
  assert.match(workflow, /npm run d1:migrate:staging/)
  assert.match(workflow, /wrangler@4\.128\.0 deploy --env staging/)
  assert.match(workflow, /STAGING_PIN/)
  assert.match(workflow, /STAGING_URL:\s*https:\/\/staging\.mesiva\.com\.br/)
  assert.doesNotMatch(workflow, /sistema-para-delivery-staging\.vzaponi\.workers\.dev/)
  assert.doesNotMatch(workflow, /npm run d1:migrate:production/)
  assert.doesNotMatch(workflow, /npm run deploy:production/)
  assert.doesNotMatch(workflow, /amor-e-sabor-delivery --remote/)
})

test('staging smoke stops after its configured propagation window', async () => {
  const { verifyStagingAuth } = await import('./staging-auth-smoke.mjs')
  let reads = 0
  const delays = []
  await assert.rejects(verifyStagingAuth({ baseUrl: 'https://staging.test', attempts: 3,
    fetchImpl: async () => { reads++; return new Response('', { status: 503 }) },
    sleep: async ms => delays.push(ms), log() {},
  }), /bounded propagation window/)
  assert.equal(reads, 3)
  assert.deepEqual(delays, [5000, 5000])
})

test('production deploy is manual, master-only, and validates locally before remote writes', () => {
  assert.match(productionWorkflow, /workflow_dispatch:/)
  assert.match(productionWorkflow, /github\.ref == 'refs\/heads\/master'/)
  assert.match(productionWorkflow, /ref: \$\{\{ github\.sha \}\}/)
  assert.match(productionWorkflow, /npm run d1:migrate:local/)
  assert.match(productionWorkflow, /npm run d1:migrate:production/)
  assert.match(productionWorkflow, /npm run deploy:production/)
  assert.doesNotMatch(productionWorkflow, /npm run d1:migrate:remote/)
  assert.doesNotMatch(productionWorkflow, /npm run deploy\s*$/m)
})

test('production smoke defaults to the official app.mesiva.com.br origin', () => {
  assert.match(productionWorkflow, /PRODUCTION_URL:\s*\$\{\{ vars\.PRODUCTION_URL \|\| 'https:\/\/app\.mesiva\.com\.br' \}\}/)
  assert.doesNotMatch(productionWorkflow, /sistema-para-delivery\.vzaponi\.workers\.dev/)
})

test('production auth-state guard runs only after the schema exists and before auth mutations', () => {
  const migrations = productionWorkflow.indexOf('- name: Apply D1 migrations')
  const authStateGuard = productionWorkflow.indexOf('- name: Guard requested phase against current production auth state')
  const pin = productionWorkflow.indexOf('- name: Configure production PIN only in legacy phase')
  const emailSecret = productionWorkflow.indexOf('- name: Configure production e-mail secret for account phases')
  const deploy = productionWorkflow.indexOf('- name: Deploy')

  for (const index of [migrations, authStateGuard, pin, emailSecret, deploy]) assert.notEqual(index, -1)
  assert.ok(migrations < authStateGuard, 'business_auth_state must not be queried before its migration can create the table')
  assert.ok(authStateGuard < pin, 'auth-state guard must block legacy PIN recreation before credential writes')
  assert.ok(authStateGuard < emailSecret, 'auth-state guard must run before account-phase secret changes')
  assert.ok(authStateGuard < deploy, 'auth-state guard must run before production publish')
})

test('production auth-state guard uses bounded Wrangler D1 query instead of getPlatformProxy', () => {
  const start = productionWorkflow.indexOf('- name: Guard requested phase against current production auth state')
  const end = productionWorkflow.indexOf('- name: Configure production PIN only in legacy phase')
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  const guard = productionWorkflow.slice(start, end)
  assert.match(guard, /timeout 60s npx --yes wrangler@4\.128\.0 d1 execute amor-e-sabor-delivery --remote --yes/)
  assert.match(guard, /SELECT mode FROM business_auth_state WHERE business_id='amor-e-sabor' LIMIT 1/)
  assert.match(guard, /--json/)
  assert.doesNotMatch(guard, /connectInfrastructure|getPlatformProxy|issue-44-access-admin/)
})

test('production records a D1 Time Travel restore point before migrations or deployment', () => {
  const checkpoint = productionWorkflow.indexOf('- name: Record production D1 restore point')
  const checkpoints = productionWorkflow.indexOf('- name: Require cutover checkpoints')
  const migrations = productionWorkflow.indexOf('- name: Apply D1 migrations')
  const deploy = productionWorkflow.indexOf('- name: Deploy')

  for (const index of [checkpoint, checkpoints, migrations, deploy]) assert.notEqual(index, -1)
  assert.match(productionWorkflow, /d1 time-travel info amor-e-sabor-delivery/)
  assert.match(productionWorkflow, /PRODUCTION_D1_BOOKMARK/)
  assert.match(productionWorkflow, /printf 'Production D1 restore bookmark recorded before account-phase changes: `%s`\\n'/)
  assert.doesNotMatch(productionWorkflow, /echo "Production D1 restore bookmark[^"]*`\$bookmark`"/)
  assert.ok(checkpoint < checkpoints, 'restore point must be recorded before the human checkpoint is accepted')
  assert.ok(checkpoint < migrations, 'restore point must be recorded before production migrations')
  assert.ok(checkpoint < deploy, 'restore point must be recorded before production publish')
})

test('production auth cutover is explicit, phased, and never recreates PIN outside legacy mode', () => {
  assert.match(productionWorkflow, /auth_phase:/)
  assert.match(productionWorkflow, /- legacy[\s\S]*- prepare[\s\S]*- multi_company/)
  assert.match(productionWorkflow, /AUTH_MULTI_COMPANY_PREPARE_ENABLED = phase === 'prepare' \? 'true' : 'false'/)
  assert.match(productionWorkflow, /AUTH_MULTI_COMPANY_ENABLED = phase === 'multi_company' \? 'true' : 'false'/)
  assert.match(productionWorkflow, /Configure production PIN only in legacy phase[\s\S]*if: inputs\.auth_phase == 'legacy'/)
  assert.match(productionWorkflow, /Configure production e-mail secret for account phases[\s\S]*if: inputs\.auth_phase != 'legacy'/)
  assert.match(productionWorkflow, /backup_confirmed:/)
  assert.match(productionWorkflow, /readiness_confirmed:/)
  assert.match(productionWorkflow, /Require cutover checkpoints/)
  assert.match(productionWorkflow, /Guard requested phase against current production auth state/)
  assert.match(productionWorkflow, /current_mode.*user_only[\s\S]*legacy\/prepare deployment is blocked/s)
  assert.match(productionWorkflow, /production-auth-smoke\.mjs/)
  assert.match(productionWorkflow, /Do not finalize legacy access until real administrator and manager logins are manually verified/)
  const config = JSON.parse(wrangler)
  assert.equal(config.vars.AUTH_MULTI_COMPANY_ENABLED, 'false')
  assert.equal(config.vars.AUTH_MULTI_COMPANY_PREPARE_ENABLED, 'false')
  assert.equal(config.vars.AUTH_EMAIL_ENABLED, 'false')
})

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
