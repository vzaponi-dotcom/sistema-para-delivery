import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'))
const validateWorkflow = readFileSync('.github/workflows/validate.yml', 'utf8')
const stagingWorkflow = readFileSync('.github/workflows/deploy-staging.yml', 'utf8')

const byBinding = (bindings, name) => bindings?.find((item) => item.binding === name)

test('operation assets R2 binding is isolated between production and staging', () => {
  const production = byBinding(wrangler.r2_buckets, 'BUSINESS_ASSETS')
  const staging = byBinding(wrangler.env?.staging?.r2_buckets, 'BUSINESS_ASSETS')

  assert.deepEqual(production, {
    binding: 'BUSINESS_ASSETS',
    bucket_name: 'mesiva-business-assets',
  })
  assert.deepEqual(staging, {
    binding: 'BUSINESS_ASSETS',
    bucket_name: 'mesiva-business-assets-staging',
  })
  assert.notEqual(production.bucket_name, staging.bucket_name)

  const stagingBlock = JSON.stringify(wrangler.env.staging)
  assert.equal(stagingBlock.includes('"bucket_name":"mesiva-business-assets"'), false)
})

test('generic Validate keeps both dry-runs and the 0030 operation-profile migration gate', () => {
  assert.match(validateWorkflow, /wrangler@4\.128\.0 deploy --dry-run\s*$/m)
  assert.match(validateWorkflow, /wrangler@4\.128\.0 deploy --dry-run --env staging/)
  assert.match(validateWorkflow, /node scripts\/infra\/operation-profile-d1-gate\.mjs/)
  assert.doesNotMatch(validateWorkflow, /r2 bucket create|r2 bucket delete/)
})

test('staging workflow smoke covers the operation identity deep link without creating production R2 resources', () => {
  assert.match(stagingWorkflow, /['"]\/configuracoes\/identidade['"]/)
  assert.doesNotMatch(stagingWorkflow, /r2 bucket create|r2 bucket delete/)
  assert.doesNotMatch(stagingWorkflow, /bucket_name\s*=\s*['"]mesiva-business-assets['"]/)
})
