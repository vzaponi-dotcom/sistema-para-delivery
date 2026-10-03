import test from 'node:test'
import assert from 'node:assert/strict'
import { runMultiCompanyStagingAdmin } from './multi-company-staging-admin.mjs'
import { createTenancyFixture } from '../../worker/test-support/tenancyDb.js'
const env = { CLOUDFLARE_API_TOKEN: 'synthetic-private-token', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), RESEND_API_KEY: 'synthetic-private-key' }
test('recovery emits link once only to the private output port; public logs contain no token or secrets', async t => {
  const f = await createTenancyFixture(t), logs = [], links = []
  await runMultiCompanyStagingAdmin(['issue-account-recovery', '--env', 'staging', '--account-id', f.accounts.alice, '--ownership-verified', '--show-link-once'], { env, isTTY: true, connect: async () => ({ db: f.db, dispose() {} }), log: value => logs.push(value), emitPrivateLink: value => links.push(value) })
  assert.equal(links.length, 1)
  const token = new URLSearchParams(new URL(links[0]).hash.slice(1)).get('token')
  assert.ok(token)
  assert.ok(!logs.join('').includes(token))
  assert.ok(!logs.join('').includes(env.RESEND_API_KEY))
})
test('infrastructure errors are sanitized before reaching caller or log', async () => {
  const logs = []
  await assert.rejects(runMultiCompanyStagingAdmin(['check-ready', '--env', 'staging', '--admin-account-id', 'a', '--business-id', 'b', '--manager-account-id', 'm'], { env, connect: async () => { throw new Error(env.CLOUDFLARE_API_TOKEN) }, log: value => logs.push(value) }), error => !error.message.includes(env.CLOUDFLARE_API_TOKEN))
  assert.deepEqual(logs, [])
})
test('private CLI refuses production and recovery without ownership, TTY and explicit one-time emission', async () => {
  const options = { connect: () => assert.fail('must refuse before infrastructure connection'), env: {}, log: () => assert.fail('secret log') }
  for (const args of [['check-ready', '--env', 'production'], ['issue-account-recovery', '--env', 'staging', '--account-id', 'a'], ['issue-account-recovery', '--env', 'staging', '--account-id', 'a', '--ownership-verified', '--show-link-once']]) await assert.rejects(runMultiCompanyStagingAdmin(args, { ...options, isTTY: false }))
})
