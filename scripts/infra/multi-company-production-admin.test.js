import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = () => readFile(new URL('./multi-company-production-admin.mjs', import.meta.url), 'utf8')

test('production multi-company CLI is production-only and environment-aware', async () => {
  const text = await source()
  assert.match(text, /options\['--env'\] !== environment/)
  assert.match(text, /const environment = 'production'/)
  assert.match(text, /environment,/)
  assert.match(text, /finalizeMultiCompanyEnvironment/)
  assert.match(text, /platform_bootstraps WHERE environment=\?/)
  assert.doesNotMatch(text, /environment='staging'/)
})

test('production multi-company CLI requires explicit ownership and login verification flags', async () => {
  const text = await source()
  assert.match(text, /'prepare-admin': \['--name', '--email', '--ownership-verified'\]/)
  assert.match(text, /'prepare-business-manager': \['--business-id', '--name', '--email', '--ownership-verified'\]/)
  assert.match(text, /'inspect-inventory': \['--admin-account-id'\]/)\n  assert.match(text, /'finalize-legacy': \['--admin-account-id', '--business-id', '--manager-account-id', '--login-verified', '--inventory-reviewed'\]/)
  assert.match(text, /issue-account-recovery.*ownership-verified.*show-link-once/s)
  assert.match(text, /inventoryReviewed: options\['--inventory-reviewed'\] === true/)\n  assert.match(text, /!isTTY/)
})
