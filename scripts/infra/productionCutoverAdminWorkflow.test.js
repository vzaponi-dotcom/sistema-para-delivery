import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const workflowUrl = new URL('../../.github/workflows/manage-production-cutover.yml', import.meta.url)
const runnerUrl = new URL('./manage-production-cutover-actions.mjs', import.meta.url)

test('production cutover administration workflow exposes only safe pre-cutover actions', async () => {
  const workflow = await readFile(workflowUrl, 'utf8')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /cutover_action:/)
  assert.match(workflow, /inspect_inventory/)
  assert.match(workflow, /prepare_business_manager/)
  assert.match(workflow, /check_ready/)
  assert.doesNotMatch(workflow, /finalize_legacy|multi_company/)
  assert.match(workflow, /github\.ref == 'refs\/heads\/master'/)
  assert.match(workflow, /environment: production/)
  assert.match(workflow, /timeout-minutes:\s*15/)
  assert.match(workflow, /BUSINESS_ID:\s*amor-e-sabor/)
  assert.match(workflow, /manage-production-cutover-actions\.mjs/)
  assert.match(workflow, /production-auth-smoke\.mjs/)
})

test('production cutover runner uses the bounded D1 REST connector and validates inputs per action', async () => {
  const source = await readFile(runnerUrl, 'utf8')
  assert.match(source, /connectProductionD1Rest/)
  assert.match(source, /runMultiCompanyProductionAdmin/)
  assert.match(source, /inspect_inventory/)
  assert.match(source, /prepare_business_manager/)
  assert.match(source, /check_ready/)
  assert.match(source, /ADMIN_ACCOUNT_ID/)
  assert.match(source, /MANAGER_NAME/)
  assert.match(source, /MANAGER_EMAIL/)
  assert.match(source, /MANAGER_ACCOUNT_ID/)
  assert.match(source, /OWNERSHIP_CONFIRMED/)
  assert.match(source, /amor-e-sabor/)
  assert.doesNotMatch(source, /finalize-legacy|issue-account-recovery/)
})

test('manager preparation requires accepted delivery unless the account was already activated', async () => {
  const source = await readFile(runnerUrl, 'utf8')
  assert.match(source, /delivery\?\.status !== 'accepted'/)
  assert.match(source, /already-active/)
  assert.match(source, /Nenhum acesso legado foi finalizado/)
})

test('readiness output is surfaced without secrets and only as identifiers and boolean state', async () => {
  const source = await readFile(runnerUrl, 'utf8')
  assert.match(source, /result\.ready/)
  assert.match(source, /managerAccountId/)
  assert.match(source, /adminAccountId/)
  assert.match(source, /GITHUB_STEP_SUMMARY/)
  assert.doesNotMatch(source, /RESEND_API_KEY.*console|CLOUDFLARE_API_TOKEN.*console/)
})
