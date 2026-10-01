import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

test('staging smoke requests SPA deep links/assets and preserves approved automatic staging branches', async () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy-staging.yml', import.meta.url), 'utf8')
  const smokeStep = workflow.split('- name: Verify staging deep links')[1]
  assert.ok(smokeStep, 'staging deep-link step is missing')
  const script = /node --input-type=module <<'NODE'\r?\n([\s\S]*?)\r?\n\s+NODE/.exec(smokeStep)?.[1]
  assert.ok(script, 'staging deep-link script is missing')
  const baseUrl = 'https://staging.example.test'
  const requested = []
  const fetch = async (url) => {
    requested.push(String(url))
    const parsed = new URL(String(url), baseUrl)
    if (parsed.pathname.endsWith('.js')) {
      return { ok: true, status: 200, headers: { get: () => 'application/javascript' } }
    }
    if (parsed.pathname.endsWith('.css')) {
      return { ok: true, status: 200, headers: { get: () => 'text/css' } }
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      text: async () => '<div id="root"></div><script src="/assets/app.js"></script>',
    }
  }
  await runInNewContext(`(async () => { ${script} })()`, {
    process: { env: { STAGING_URL: baseUrl, STAGING_READY_ATTEMPTS: '1' }, exit: (code) => { throw new Error(`Smoke exited ${code}`) } },
    fetch,
    URL,
    Date,
    console: { log() {}, error() {} },
  })
  const paths = requested.map((value) => new URL(value, baseUrl).pathname)
  assert.ok(paths.includes('/relatorios'))
  assert.ok(paths.includes('/pedidos/controle-da-tv'))
  for (const path of ['/minha-conta', '/configuracoes/equipe', '/configuracoes/atividades', '/ativar-conta']) {
    assert.ok(paths.includes(path), `access deep link ${path} must be checked`)
  }
  assert.ok(paths.includes('/assets/app.js'))
  const pushSection = workflow.split('workflow_dispatch:')[0]
  assert.match(pushSection, /feature\/issue-34-reporting-center/)
  assert.match(pushSection, /feature\/kitchen-tv-control-center/)
})
