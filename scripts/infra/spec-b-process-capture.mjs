// Bounded, opt-in diagnostic. One invocation performs exactly one capture.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { Worker } from 'node:worker_threads'
import { createProbeProcessManager } from './spec-b-processes.mjs'

const mode = process.argv[2]
assert.ok(['idle', 'load', 'regression'].includes(mode), 'Expected idle, load or regression')
const runId = randomUUID()
const directory = resolve('logs', 'spec-b-process-diagnostic', `${mode}-${runId}`)
await mkdir(directory, { recursive: true })
const events = []
const started = performance.now()
const record = (event, data = {}) => events.push({ event, elapsedMs: performance.now() - started, ...data })
const alive = (pid) => { try { process.kill(pid, 0); return true } catch (error) { if (error.code === 'ESRCH') return false; throw error } }
const summary = { runId, mode, directory, pid: process.pid, clock: 'performance.now since capture start; independent clock origin', graceMs: 120, forceMs: 3000 }
let failure

async function capture() {
  const manager = createProbeProcessManager({ graceMs: 120, forceMs: 3000, diagnostics: { directory, runId } })
  const loads = []
  const stopFlag = new Int32Array(new SharedArrayBuffer(4))
  const logs = { stdout: '', stderr: '' }
  let tree
  try {
    // Identical cooperative fixture and readiness reader to the existing test.
    tree = manager.spawn(process.execPath, ['-e', "process.stdin.resume(); process.stdin.on('end',()=>process.exit(0)); console.log(JSON.stringify({pid:process.pid})); setInterval(()=>{},1000)"])
    tree.stdout.on('data', (chunk) => { logs.stdout += chunk })
    tree.stderr.on('data', (chunk) => { logs.stderr += chunk })
    let info
    let buffer = ''
    for await (const chunk of tree.stdout) {
      buffer += chunk
      if (buffer.includes('\n')) { info = JSON.parse(buffer.split('\n')[0]); break }
    }
    assert.ok(info?.pid, 'fixture exited without readiness data')
    record('fixture_ready_received', { pid: info.pid })
    if (mode === 'load') {
      const count = Math.min(4, Math.max(1, availableParallelism() - 1))
      summary.load = { workers: count, maxDurationMs: 3000, type: 'CPU worker threads owned by this capture' }
      for (let index = 0; index < count; index++) {
        const worker = new Worker(`
          const { parentPort, workerData } = require('node:worker_threads');
          const { performance } = require('node:perf_hooks');
          const stop = new Int32Array(workerData);
          const end = performance.now() + 3000;
          parentPort.postMessage('ready');
          while (!Atomics.load(stop, 0) && performance.now() < end) {
            for (let n = 0; n < 10000; n++) Math.sqrt(n);
          }
        `, { eval: true, workerData: stopFlag.buffer })
        const done = new Promise((fulfill) => worker.once('exit', (code) => { record('load_worker_exit', { index, code }); fulfill(code) }))
        const ready = new Promise((fulfill, reject) => { worker.once('message', fulfill); worker.once('error', reject); worker.once('exit', () => reject(new Error('Load worker exited before readiness'))) })
        loads.push({ worker, done, ready })
      }
      await Promise.all(loads.map(({ ready }) => ready))
      record('load_ready', { workers: count })
    }
    record('stop_called')
    summary.result = await tree.stop()
    record('stop_returned', summary.result)
    summary.childAliveAfterStop = alive(info.pid)
    summary.childExitCode = tree.exitCode
    assert.equal(summary.childAliveAfterStop, false, 'cooperating child is still alive')
    // Force is an observation in a capture, never a criterion for approving load.
  } finally {
    Atomics.store(stopFlag, 0, 1)
    // Owned workers also self-expire after 3 seconds, including on parent errors.
    const codes = await Promise.all(loads.map(({ done }) => done))
    record('load_cleanup_complete', { workers: loads.length, codes })
    try { await manager.cleanup() }
    finally {
      manager.dispose()
      await manager.flushDiagnostics()
      await writeFile(join(directory, 'fixture-output.json'), JSON.stringify(logs, null, 2))
    }
  }
}

async function regression() {
  // Original six tests, unchanged assertions, with the optional sidecars enabled.
  const child = spawn(process.execPath, ['--test', 'scripts/infra/spec-b-processes.test.js'], {
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, SPEC_B_PROCESS_TRACE_DIR: directory, SPEC_B_PROCESS_TRACE_RUN_ID: runId },
  })
  let stdout = '', stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  summary.testExitCode = await new Promise((fulfill, reject) => { child.once('error', reject); child.once('close', fulfill) })
  await writeFile(join(directory, 'tests.stdout.log'), stdout)
  await writeFile(join(directory, 'tests.stderr.log'), stderr)
  summary.tap = stdout.split(/\r?\n/).filter((line) => /^# (tests|pass|fail|cancelled|skipped|duration_ms) /.test(line))
  assert.equal(summary.testExitCode, 0, 'Existing supervision tests failed; see complete TAP log')
}

try { await (mode === 'regression' ? regression() : capture()) }
catch (error) { failure = error; summary.error = { message: error.message, stack: error.stack } }
const files = await readdir(directory)
summary.traces = []
for (const file of files.filter((name) => name.endsWith('.manager.json'))) {
  const manager = JSON.parse(await readFile(join(directory, file), 'utf8'))
  let supervisor = []
  try { supervisor = (await readFile(manager.supervisorTracePath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line)) }
  catch (error) { summary.traceError = error.message; failure ??= error }
  const complete = supervisor.some(({ event }) => event === 'trace_complete')
  if (!complete) { failure ??= new Error('Supervisor trace is incomplete'); summary.traceError ??= failure.message }
  summary.traces.push({ treeId: manager.treeId, pid: manager.pid, complete,
    forceRequests: manager.events.filter(({ event }) => event === 'force_requested'),
    forceExecutions: supervisor.filter(({ event }) => event === 'force_executed'),
  })
}
summary.events = events
summary.ok = !failure
await writeFile(join(directory, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify({ ok: summary.ok, mode, directory, result: summary.result, childExitCode: summary.childExitCode, tap: summary.tap, traces: summary.traces, error: summary.error, traceError: summary.traceError }))
if (failure) process.exitCode = 1
