import { appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pendingStatuses = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested'])

export async function verifyDeployValidation({
  repository, commit, ref, environment, token, apiUrl = 'https://api.github.com',
  timeoutMs = 600000, pollIntervalMs = 15000, requestTimeoutMs = 30000,
  fetchImpl = fetch, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log,
}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('Invalid GitHub repository.')
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Invalid deployment commit.')
  if (!ref?.startsWith('refs/heads/') || !ref.slice(11)) throw new Error('Invalid deployment branch.')
  if (!['staging', 'production'].includes(environment)) throw new Error('Invalid deployment environment.')
  if (!token) throw new Error('GitHub Actions read token is required.')
  if (environment === 'production' && ref !== 'refs/heads/master') throw new Error('Production requires master.')
  const api = new URL(apiUrl)
  if (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash) throw new Error('Invalid GitHub API URL.')
  for (const value of [timeoutMs, pollIntervalMs, requestTimeoutMs]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 900000) throw new Error('Invalid validation wait interval.')
  }
  const branch = ref.slice(11)
  const deadline = now() + timeoutMs

  const listRuns = async workflow => {
    const url = new URL(`${api.href.replace(/\/$/, '')}/repos/${repository}/actions/workflows/${workflow}/runs`)
    url.searchParams.set('head_sha', commit)
    url.searchParams.set('per_page', '100')
    const controller = new AbortController()
    let timer
    let result
    try {
      result = await Promise.race([
        (async () => {
          const response = await fetchImpl(url.href, {
            headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
            cache: 'no-store', redirect: 'error', signal: controller.signal,
          })
          return { ok: response.ok, status: response.status, body: response.ok ? await response.text() : '' }
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('API timeout')) }, Math.min(requestTimeoutMs, Math.max(1, deadline - now())))
        }),
      ])
    } catch {
      throw new Error('GitHub API request failed; deployment is blocked.')
    } finally {
      clearTimeout(timer)
    }
    if (!result.ok) throw new Error(`GitHub API HTTP ${result.status}; deployment is blocked.`)
    let data
    try { data = JSON.parse(result.body) } catch { throw new Error('Invalid GitHub API response.') }
    if (!Array.isArray(data.workflow_runs) || !Number.isSafeInteger(data.total_count) || data.total_count < data.workflow_runs.length) throw new Error('Invalid GitHub API response.')
    if (data.total_count > data.workflow_runs.length) throw new Error('Incomplete GitHub workflow history; deployment is blocked.')
    for (const run of data.workflow_runs) {
      if (!Number.isSafeInteger(run.id) || run.id < 1 || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1
        || typeof run.path !== 'string' || typeof run.event !== 'string' || typeof run.head_branch !== 'string'
        || !/^[a-f0-9]{40}$/.test(run.head_sha || '') || typeof run.repository?.full_name !== 'string'
        || typeof run.head_repository?.full_name !== 'string' || typeof run.run_started_at !== 'string'
        || !Number.isFinite(Date.parse(run.run_started_at)) || (run.status !== 'completed' && !pendingStatuses.has(run.status))) {
        throw new Error('Invalid GitHub API response.')
      }
    }
    return data.workflow_runs
  }

  const requirements = [{ workflow: 'validate.yml', label: 'validation', resultKey: 'validationRunId' }]
  if (environment === 'production') requirements.push({ workflow: 'deploy-staging.yml', label: 'staging', resultKey: 'stagingRunId' })

  while (true) {
    // Recheck both approvals on every round: CI may be rerun while staging is pending.
    const samples = await Promise.all(requirements.map(({ workflow }) => listRuns(workflow)))
    const result = { commit }
    const approved = []
    let ready = true
    for (const [index, { workflow, label, resultKey }] of requirements.entries()) {
      const runs = samples[index]
      const eligible = runs.filter(run => run.path === `.github/workflows/${workflow}` && run.head_sha === commit
        && run.head_branch === branch && run.repository.full_name === repository && run.head_repository.full_name === repository
        && (branch === 'master' ? (workflow === 'validate.yml' ? run.event === 'push' : ['push', 'workflow_dispatch'].includes(run.event))
          : ['pull_request', 'push', 'workflow_dispatch'].includes(run.event)))
      // A rerun retains its original ID; run_started_at describes the current attempt.
      eligible.sort((a, b) => Date.parse(b.run_started_at) - Date.parse(a.run_started_at) || b.id - a.id || b.run_attempt - a.run_attempt)
      const run = eligible[0]
      if (!run && (runs.length || now() >= deadline)) throw new Error(`No eligible ${label} run for the deployment commit.`)
      if (now() >= deadline) throw new Error(`${label} validation timed out; deployment is blocked.`)
      // GitHub timestamps have second precision: every equally recent candidate must pass.
      const latest = eligible.filter(candidate => candidate.run_started_at === run?.run_started_at)
      for (const candidate of latest) {
        if (candidate.status === 'completed' && candidate.conclusion !== 'success') throw new Error(`${label} run ${candidate.id} is not successful; deployment is blocked.`)
      }
      if (run && latest.every(candidate => candidate.status === 'completed')) {
        result[resultKey] = run.id
        approved.push({ label, run })
      } else {
        ready = false
        log(`Waiting for ${label} approval of commit ${commit}.`)
      }
    }
    if (ready) {
      for (const { label, run } of approved) log(`Approved ${label} run ${run.id} (attempt ${run.run_attempt}) for commit ${commit}.`)
      return result
    }
    await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - now())))
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyDeployValidation({
      repository: process.env.GITHUB_REPOSITORY, commit: process.env.GITHUB_SHA, ref: process.env.GITHUB_REF,
      environment: process.env.DEPLOY_ENVIRONMENT, token: process.env.GH_TOKEN, apiUrl: process.env.GITHUB_API_URL,
    })
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `Deployment prerequisites for \`${result.commit}\`: CI run ${result.validationRunId}${result.stagingRunId ? `; staging run ${result.stagingRunId}` : ''}.\n`)
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
