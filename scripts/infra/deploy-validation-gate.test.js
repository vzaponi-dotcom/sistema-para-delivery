import assert from 'node:assert/strict'
import test from 'node:test'

const repository = 'vzaponi-dotcom/Mesiva'
const commit = '0c450afb1ee094151ff3fef84953da652554d456'
const run = (overrides = {}) => ({
  id: 20, run_attempt: 1, path: '.github/workflows/validate.yml', event: 'push',
  head_branch: 'master', head_sha: commit, status: 'completed', conclusion: 'success',
  run_started_at: '2026-10-05T12:00:00Z',
  repository: { full_name: repository }, head_repository: { full_name: repository }, ...overrides,
})
const staging = (overrides = {}) => run({ id: 30, path: '.github/workflows/deploy-staging.yml', ...overrides })
const response = (workflow_runs, extra = {}) => new Response(JSON.stringify({ total_count: workflow_runs.length, workflow_runs, ...extra }))
const verify = async options => {
  const { verifyDeployValidation } = await import('./deploy-validation-gate.mjs')
  return verifyDeployValidation({ repository, commit, ref: 'refs/heads/master', environment: 'staging', token: 'synthetic-token', log() {}, ...options })
}

test('staging accepts successful validation of the exact master commit', async () => {
  const result = await verify({ fetchImpl: async url => {
    const parsed = new URL(url)
    assert.equal(parsed.pathname, '/repos/vzaponi-dotcom/Mesiva/actions/workflows/validate.yml/runs')
    assert.equal(parsed.searchParams.get('head_sha'), commit)
    return response([run()])
  } })
  assert.deepEqual(result, { commit, validationRunId: 20 })
})

test('production requires successful staging of the same master commit', async () => {
  const result = await verify({ environment: 'production', fetchImpl: async url => response([url.includes('deploy-staging.yml') ? staging() : run()]) })
  assert.deepEqual(result, { commit, validationRunId: 20, stagingRunId: 30 })
})

for (const [name, overrides] of [
  ['another commit', { head_sha: 'a'.repeat(40) }],
  ['another workflow', { path: '.github/workflows/other.yml' }],
  ['another branch', { head_branch: 'feature/example' }],
  ['PR validation before the master merge', { event: 'pull_request' }],
  ['fork code', { head_repository: { full_name: 'other/fork' } }],
  ['another repository', { repository: { full_name: 'other/repository' } }],
]) test(`staging rejects evidence for ${name}`, async () => {
  await assert.rejects(verify({ fetchImpl: async () => response([run(overrides)]) }), /No eligible validation/)
})

for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out', 'neutral', 'action_required', null]) {
  test(`completed validation with ${conclusion} blocks deploy`, async () => {
    await assert.rejects(verify({ fetchImpl: async () => response([run({ conclusion })]) }), /not successful/)
  })
}

test('a newer failed run cannot be bypassed with an older successful run', async () => {
  await assert.rejects(verify({ fetchImpl: async () => response([run({ id: 19 }), run({ id: 21, conclusion: 'failure' })]) }), /not successful/)
})

test('a pending rerun cannot reuse the previous successful attempt', async () => {
  let time = 0
  await assert.rejects(verify({ timeoutMs: 20, pollIntervalMs: 10, now: () => time, sleep: async ms => { time += ms },
    fetchImpl: async () => response([run({ run_attempt: 1 }), run({ run_attempt: 2, status: 'queued', conclusion: null })]),
  }), /timed out/)
})

test('a recently rerun older workflow blocks a newer ID with stale success', async () => {
  let time = 0
  await assert.rejects(verify({ timeoutMs: 20, pollIntervalMs: 10, now: () => time, sleep: async ms => { time += ms },
    fetchImpl: async () => response([
      run({ id: 21 }),
      run({ id: 20, run_attempt: 2, run_started_at: '2026-10-05T12:05:00Z', status: 'in_progress', conclusion: null }),
    ]),
  }), /timed out/)
})

test('a truncated run history cannot conceal a recently rerun older workflow', async () => {
  await assert.rejects(verify({ fetchImpl: async () => response(Array.from({ length: 100 }, (_, i) => run({ id: i + 1 })), { total_count: 101 }) }), /Incomplete GitHub workflow history/)
})

test('same-second run ordering cannot bypass a failed older-ID rerun', async () => {
  await assert.rejects(verify({ fetchImpl: async () => response([run({ id: 21 }), run({ id: 20, run_attempt: 2, conclusion: 'failure' })]) }), /not successful/)
})

test('same-second run ordering cannot bypass a pending older-ID rerun', async () => {
  let time = 0
  await assert.rejects(verify({ timeoutMs: 20, pollIntervalMs: 10, now: () => time, sleep: async ms => { time += ms },
    fetchImpl: async () => response([run({ id: 21 }), run({ id: 20, run_attempt: 2, status: 'in_progress', conclusion: null })]),
  }), /timed out/)
})

test('successful evidence arriving after the deadline cannot approve deploy', async () => {
  let time = 0
  await assert.rejects(verify({ timeoutMs: 10, now: () => time,
    fetchImpl: async () => { time = 20; return response([run()]) },
  }), /timed out/)
})

test('production rechecks CI while waiting for staging and rejects a subsequent CI failure', async () => {
  let time = 0
  await assert.rejects(verify({ environment: 'production', timeoutMs: 30, pollIntervalMs: 10, now: () => time,
    sleep: async ms => { time += ms },
    fetchImpl: async url => response([url.includes('deploy-staging.yml')
      ? staging(time === 0 ? { status: 'in_progress', conclusion: null } : {})
      : run(time === 0 ? {} : { conclusion: 'failure', run_attempt: 2 })]),
  }), /validation.*not successful/)
})

test('queued validation is awaited within a bounded window and then accepted', async () => {
  let time = 0
  const result = await verify({ timeoutMs: 30, pollIntervalMs: 10, now: () => time, sleep: async ms => { time += ms },
    fetchImpl: async () => response([run(time === 0 ? { status: 'in_progress', conclusion: null } : {})]),
  })
  assert.equal(time, 10)
  assert.equal(result.validationRunId, 20)
})

test('absence of a CI run is awaited only until the bounded deadline', async () => {
  let time = 0
  await assert.rejects(verify({ timeoutMs: 20, pollIntervalMs: 10, now: () => time, sleep: async ms => { time += ms },
    fetchImpl: async () => response([]),
  }), /No eligible validation/)
  assert.equal(time, 20)
})

for (const status of [401, 403, 429, 500]) test(`GitHub API HTTP ${status} blocks deploy`, async () => {
  await assert.rejects(verify({ fetchImpl: async () => new Response('private response', { status }) }), new RegExp(`GitHub API HTTP ${status}`))
})

test('GitHub network failures are sanitized and block deploy', async () => {
  await assert.rejects(verify({ fetchImpl: async () => { throw new Error('synthetic-token private detail') } }), error => {
    assert.match(error.message, /GitHub API request failed/)
    assert.doesNotMatch(error.message, /synthetic-token|private detail/)
    return true
  })
})

test('an API request that hangs is aborted instead of waiting indefinitely', async () => {
  await assert.rejects(verify({ requestTimeoutMs: 5, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }) }), /GitHub API request failed/)
})

for (const body of ['not json', '{}', '{"workflow_runs":null}', '{"workflow_runs":[{}]}']) test(`unexpected API response blocks deploy: ${body}`, async () => {
  await assert.rejects(verify({ fetchImpl: async () => new Response(body) }), /Invalid GitHub API response/)
})

test('feature staging accepts head validation in its own open PR context', async () => {
  const result = await verify({ ref: 'refs/heads/feature/clients-relationship',
    fetchImpl: async () => response([run({ head_branch: 'feature/clients-relationship', event: 'pull_request' })]),
  })
  assert.equal(result.validationRunId, 20)
})

test('production refuses a feature branch even with green CI and staging', async () => {
  await assert.rejects(verify({ environment: 'production', ref: 'refs/heads/feature/clients-relationship', fetchImpl: async () => response([run()]) }), /Production requires master/)
})

test('production blocks staging failure or a staging release of another SHA', async () => {
  for (const stage of [staging({ conclusion: 'failure' }), staging({ head_sha: 'b'.repeat(40) })]) {
    await assert.rejects(verify({ environment: 'production', timeoutMs: 1, pollIntervalMs: 1, now: () => 0,
      fetchImpl: async url => response([url.includes('deploy-staging.yml') ? stage : run()]),
    }), /staging.*not successful|No eligible staging/)
  }
})

test('missing token or malformed deployment identity blocks before any API call', async () => {
  for (const options of [{ token: '' }, { commit: 'master' }, { ref: 'refs/tags/v1' }, { repository: 'bad/repo/path' }, { environment: 'preview' }]) {
    await assert.rejects(verify({ ...options, fetchImpl: async () => { assert.fail('must not query API') } }), /required|Invalid/)
  }
})
