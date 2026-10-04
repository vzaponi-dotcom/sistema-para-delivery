import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const workflowUrl = new URL('../../.github/workflows/prepare-mesiva-admin.yml', import.meta.url)
const runnerUrl = new URL('./prepare-mesiva-admin-actions.mjs', import.meta.url)

test('Mesiva administrator bootstrap workflow is manual, production-scoped and master-only', async () => {
  const workflow = await readFile(workflowUrl, 'utf8')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /admin_name:/)
  assert.match(workflow, /admin_email:/)
  assert.match(workflow, /ownership_confirmed:/)
  assert.match(workflow, /github\.ref == 'refs\/heads\/master'/)
  assert.match(workflow, /environment: production/)
  assert.match(workflow, /timeout-minutes:\s*15/)
  assert.match(workflow, /CLOUDFLARE_API_TOKEN:\s*\$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/)
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID:\s*\$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/)
  assert.match(workflow, /RESEND_API_KEY:\s*\$\{\{ secrets\.RESEND_API_KEY \}\}/)
  assert.match(workflow, /AUTH_PUBLIC_ORIGIN:\s*\$\{\{ vars\.AUTH_PUBLIC_ORIGIN \}\}/)
  assert.match(workflow, /AUTH_EMAIL_FROM:\s*\$\{\{ vars\.AUTH_EMAIL_FROM \}\}/)
  assert.match(workflow, /production-auth-smoke\.mjs/)
  assert.match(workflow, /prepare-mesiva-admin-actions\.mjs/)
  assert.doesNotMatch(workflow, /getPlatformProxy|multi-company-production-admin\.mjs prepare-admin/)
})

test('GitHub administrator runner uses the bounded REST D1 connector and requires accepted delivery or an already active account', async () => {
  const source = await readFile(runnerUrl, 'utf8')
  assert.match(source, /runMultiCompanyProductionAdmin/)
  assert.match(source, /connectProductionD1Rest/)
  assert.match(source, /process\.env\.ADMIN_NAME/)
  assert.match(source, /process\.env\.ADMIN_EMAIL/)
  assert.match(source, /--ownership-verified/)
  assert.match(source, /delivery\?\.status !== 'accepted'/)
  assert.match(source, /GITHUB_STEP_SUMMARY/)
  assert.doesNotMatch(source, /console\.log\([^\n]*(ADMIN_EMAIL|email)/)
})

test('D1 REST adapter binds parameters and projects first rows without exposing credentials', async () => {
  const { createD1RestDatabase } = await import('./cloudflare-d1-rest.mjs')
  const calls = []
  const token = 'test-secret-token'
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({
      success: true,
      result: [{ success: true, results: [{ mode: 'legacy' }], meta: { changes: 0 } }],
      errors: [],
      messages: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const db = createD1RestDatabase({
    accountId: '0123456789abcdef0123456789abcdef',
    databaseId: 'baa83769-4637-43f6-bf77-711f4f2ed069',
    apiToken: token,
    fetchImpl,
  })
  const row = await db.prepare('SELECT mode FROM business_auth_state WHERE business_id=?').bind('amor-e-sabor').first()
  assert.deepEqual(row, { mode: 'legacy' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/d1/database/baa83769-4637-43f6-bf77-711f4f2ed069/query')
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${token}`)
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    sql: 'SELECT mode FROM business_auth_state WHERE business_id=?',
    params: ['amor-e-sabor'],
  })
})

test('D1 REST adapter executes prepared batches in one API request', async () => {
  const { createD1RestDatabase } = await import('./cloudflare-d1-rest.mjs')
  const bodies = []
  const db = createD1RestDatabase({
    accountId: '0123456789abcdef0123456789abcdef',
    databaseId: 'baa83769-4637-43f6-bf77-711f4f2ed069',
    apiToken: 'token',
    fetchImpl: async (_url, options) => {
      bodies.push(JSON.parse(options.body))
      return new Response(JSON.stringify({
        success: true,
        result: [
          { success: true, results: [], meta: { changes: 1 } },
          { success: true, results: [{ ok: 1 }], meta: { changes: 0 } },
        ],
        errors: [],
        messages: [],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  const result = await db.batch([
    db.prepare('INSERT INTO example(id) VALUES(?)').bind('a'),
    db.prepare('SELECT 1 AS ok'),
  ])
  assert.equal(result.length, 2)
  assert.equal(result[0].success, true)
  assert.deepEqual(result[1].results, [{ ok: 1 }])
  assert.deepEqual(bodies, [{
    batch: [
      { sql: 'INSERT INTO example(id) VALUES(?)', params: ['a'] },
      { sql: 'SELECT 1 AS ok', params: [] },
    ],
  }])
})

test('D1 REST adapter returns a sanitized error on upstream failure', async () => {
  const { createD1RestDatabase } = await import('./cloudflare-d1-rest.mjs')
  const token = 'secret-that-must-not-leak'
  const db = createD1RestDatabase({
    accountId: '0123456789abcdef0123456789abcdef',
    databaseId: 'baa83769-4637-43f6-bf77-711f4f2ed069',
    apiToken: token,
    fetchImpl: async () => new Response(JSON.stringify({ success: false, errors: [{ message: token }] }), { status: 403 }),
  })
  await assert.rejects(
    db.prepare('SELECT 1').first(),
    error => error.message === 'D1 REST request failed.' && !error.message.includes(token),
  )
})
