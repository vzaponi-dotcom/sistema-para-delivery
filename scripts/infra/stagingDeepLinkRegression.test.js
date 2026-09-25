import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

test('staging smoke requests the reporting deep link, SPA assets and auto-runs for the reporting branch', async () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy-staging.yml', import.meta.url), 'utf8')
  const smokeStep = workflow.split('- name: Verify staging deep links')[1]
  assert.ok(smokeStep, 'staging deep-link step is missing')
  const script = /node --input-type=module <<'NODE'\r?\n([\s\S]*?)\r?\n\s+NODE/.exec(smokeStep)?.[1]
  assert.ok(script, 'staging deep-link script is missing')
  const baseUrl = 'https://staging.example.test'
  const requested = []
  const fetch = async (url) => {
    requested.push(String(url))
    if (String(url).endsWith('.js')) return { ok: true, headers: { get: () => 'application/javascript' } }
    return {
      status: 200, headers: { get: () => 'text/html' },
      text: async () => '<div id="root"></div><script src="/assets/app.js"></script>',
    }
  }
  await runInNewContext(`(async () => { ${script} })()`, {
    process: { env: { STAGING_URL: baseUrl, STAGING_READY_ATTEMPTS: '1' }, exit: (code) => { throw new Error(`Smoke exited ${code}`) } },
    fetch, URL, console: { log() {}, error() {} },
  })
  assert.ok(requested.includes(`${baseUrl}/relatorios`))
  assert.ok(requested.includes(`${baseUrl}/assets/app.js`))
  assert.doesNotMatch(workflow.split('workflow_dispatch:')[0], /feature\/issue-34-reporting-center/)
})
