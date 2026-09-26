import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'))
const validateWorkflow = readFileSync('.github/workflows/validate.yml', 'utf8')
const stagingWorkflow = readFileSync('.github/workflows/deploy-staging.yml', 'utf8').replace(/\r\n/g, '\n')

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

test('staging workflow provisions only the staging R2 bucket idempotently and can auto-run for this branch', () => {
  assert.match(stagingWorkflow, /branches:\s*\n(?:\s*- .*\n)*\s*- feature\/operation-identity-settings/m)
  assert.match(stagingWorkflow, /STAGING_R2_BUCKET:\s*mesiva-business-assets-staging/)
  assert.match(stagingWorkflow, /wrangler@4\.128\.0 r2 bucket info "\$STAGING_R2_BUCKET" --json --env staging/)
  assert.match(stagingWorkflow, /wrangler@4\.128\.0 r2 bucket create "\$STAGING_R2_BUCKET" --env staging/)
  assert.match(stagingWorkflow, /['"]\/configuracoes\/identidade['"]/)
  assert.doesNotMatch(stagingWorkflow, /r2 bucket delete/)
  assert.doesNotMatch(stagingWorkflow, /mesiva-business-assets(?:["']|\s*$)/m)
})
