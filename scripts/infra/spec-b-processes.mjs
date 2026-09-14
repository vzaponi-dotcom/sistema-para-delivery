import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(check, timeoutMs) {
  const end = Date.now() + timeoutMs
  while (!check()) { if (Date.now() >= end) return false; await delay(15) }
  return true
}
const groupAlive = (pid) => { try { process.kill(-pid, 0); return true } catch (error) { if (error.code === 'ESRCH') return false; throw error } }
function signalGroup(pid, signal) { try { process.kill(-pid, signal) } catch (error) { if (error.code !== 'ESRCH') throw error } }

function startTree(command, args, options, graceMs, forceMs, diagnostics, supervisorCloseDelayMs) {
  const windows = process.platform === 'win32'
  const treeId = randomUUID()
  const marker = `SPEC_B_JOB_${treeId}:`
  const started = diagnostics ? process.hrtime.bigint() : null
  const events = []
  const trace = (event, data = {}) => {
    if (diagnostics) events.push({ event, elapsedMs: Number(process.hrtime.bigint() - started) / 1e6, ...data })
  }
  const supervisorTracePath = diagnostics && join(diagnostics.directory, `${treeId}.supervisor.jsonl`)
  const request = Buffer.from(JSON.stringify({ command, args, marker, supervisorCloseDelayMs,
    ...(diagnostics ? { tracePath: supervisorTracePath, runId: diagnostics.runId, treeId } : {}) })).toString('base64')
  const child = windows
    ? spawn(join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./spec-b-windows-job.ps1', import.meta.url)), request], { ...options, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    : spawn(command, args, { ...options, detached: true, stdio: ['pipe', 'pipe', 'pipe'] })
  const stderr = new PassThrough()
  let pid = windows ? null : child.pid
  let exitCode = null
  let drained = false
  let closed = false
  let failure
  let readyResolve
  let exitResolve
  const ready = new Promise((resolve) => { readyResolve = resolve })
  const exited = new Promise((resolve) => { exitResolve = resolve })
  let errorBuffer = ''
  child.stderr.on('data', (chunk) => {
    if (!windows) { stderr.write(chunk); return }
    errorBuffer += chunk
    let newline
    while ((newline = errorBuffer.indexOf('\n')) >= 0) {
      const line = errorBuffer.slice(0, newline).trimEnd(); errorBuffer = errorBuffer.slice(newline + 1)
      if (!line.startsWith(marker)) { stderr.write(`${line}\n`); continue }
      const message = JSON.parse(line.slice(marker.length))
      trace('status_received', { status: message.type, ...message })
      if (message.type === 'ready') { pid = message.pid; readyResolve() }
      if (message.type === 'exit') { exitCode = message.code; exitResolve({ code: exitCode }) }
      if (message.type === 'drained') drained = true
    }
  })
  child.on('error', (error) => { failure = error; readyResolve(); exitResolve({ error }) })
  child.stdin.on('error', (error) => { trace('control_pipe_error_received', { code: error.code }); if (!['EPIPE', 'ECONNRESET'].includes(error.code)) failure = error })
  child.once('spawn', () => { if (!windows) readyResolve() })
  child.once('exit', (code, signal) => {
    trace(windows ? 'supervisor_exit_received' : 'process_exit_received', { code, signal })
    if (!windows) { exitCode = code; exitResolve({ code, signal }) }
  })
  child.once('close', (code) => {
    closed = true
    trace(windows ? 'supervisor_close_received' : 'process_close_received', { code, drained })
    if (errorBuffer) stderr.write(errorBuffer)
    stderr.end()
    // 'exit' may precede stderr delivery; only 'close' proves all status frames arrived.
    if (windows && !drained) { failure = new Error(`Windows job supervisor exited before confirming an empty job (${code})`); readyResolve(); exitResolve({ error: failure }) }
  })
  let stopping
  const stop = () => stopping ??= (async () => {
    trace('stop_called')
    // Windows owns an OS job even after the command exits; POSIX owns a process
    // group even after its leader exits. Do not short-circuit on command exitCode.
    if (!await until(() => pid !== null || failure, forceMs)) {
      trace('force_requested', { reason: 'startup_deadline', pid, drained, closed, exitCode })
      child.stdin.end('force\n')
      if (!await until(() => closed, forceMs)) {
        trace('supervisor_kill_requested', { reason: 'startup_deadline' })
        child.kill('SIGKILL')
        await until(() => closed, forceMs)
      }
      throw new Error('Process supervisor did not start before cleanup deadline')
    }
    if (failure) throw failure
    const empty = () => windows ? drained : !groupAlive(pid)
    const awaitSupervisorClose = async () => {
      if (!windows || closed) return
      if (!await until(() => closed, forceMs)) throw new Error('Process supervisor did not close after confirming an empty job')
      if (failure) throw failure
    }
    if (empty()) { await awaitSupervisorClose(); return { forced: false } }
    trace('stop_requested', { pid, graceMs, drained, closed, exitCode })
    if (windows) child.stdin.write('stop\n')
    else child.stdin.end()
    if (await until(empty, graceMs)) { await awaitSupervisorClose(); return { forced: false } }
    trace('grace_expired', { pid, drained, closed, exitCode })
    // POSIX first gets a cooperative group SIGTERM, then SIGKILL. Windows cannot
    // deliver SIGTERM; the job receives TerminateJobObject and confirms Active=0.
    if (!windows) {
      signalGroup(pid, 'SIGTERM')
      if (await until(empty, graceMs)) return { forced: false }
      trace('force_requested', { signal: 'SIGKILL', pid })
      signalGroup(pid, 'SIGKILL')
    } else {
      trace('force_requested', { pid, drained, closed, exitCode })
      child.stdin.write('force\n')
    }
    if (!await until(empty, forceMs)) {
      if (windows) {
        trace('supervisor_kill_requested', { reason: 'termination_deadline' })
        child.kill('SIGKILL') // KILL_ON_JOB_CLOSE is the last-resort safety net.
        await until(() => closed, forceMs)
      }
      throw new Error('Process tree termination was not confirmed before deadline')
    }
    await awaitSupervisorClose()
    return { forced: true }
  })()
  // Flush only after cleanup: no filesystem writes in the timed manager path.
  const flushDiagnostics = async () => {
    if (!diagnostics) return
    trace('diagnostics_flushed', { pid, drained, closed, exitCode })
    await writeFile(join(diagnostics.directory, `${treeId}.manager.json`), JSON.stringify({
      runId: diagnostics.runId, treeId, source: 'manager', clock: 'hrtime since startTree; not comparable to supervisor clock',
      managerPid: process.pid, supervisorPid: windows ? child.pid : null, pid, supervisorTracePath,
      events,
    }, null, 2))
  }
  return { child, stdout: child.stdout, stderr, ready, exited, stop,
    flushDiagnostics,
    get pid() { return pid }, get exitCode() { return exitCode }, get failure() { return failure } }
}

export function createProbeProcessManager({ graceMs = 300, forceMs = 5000, diagnostics = null, supervisorCloseDelayMs = 0 } = {}) {
  const trees = new Set()
  const controller = new AbortController()
  let cleanupPromise
  let closing = false
  const cleanup = () => cleanupPromise ??= (async () => {
    closing = true
    const results = await Promise.allSettled([...trees].map((tree) => tree.stop()))
    const failed = results.find(({ status }) => status === 'rejected')
    if (failed) throw failed.reason
  })()
  const handlers = new Map(['SIGINT', 'SIGTERM'].map((signal) => [signal, () => {
    controller.abort(new Error(`Probe interrupted by ${signal}`))
    void cleanup().catch(() => {}) // Final runner cleanup observes and reports the rejection.
  }]))
  for (const [signal, handler] of handlers) process.on(signal, handler)
  return {
    spawn(command, args, options = {}) {
      if (closing) throw new Error('Process manager is closing')
      const tree = startTree(command, args, options, graceMs, forceMs, diagnostics, supervisorCloseDelayMs)
      trees.add(tree)
      return tree
    },
    cleanup,
    flushDiagnostics() { return Promise.all([...trees].map((tree) => tree.flushDiagnostics())) },
    signal: controller.signal,
    wait(promise) {
      if (controller.signal.aborted) return Promise.reject(controller.signal.reason)
      return new Promise((resolve, reject) => {
        const abort = () => reject(controller.signal.reason)
        controller.signal.addEventListener('abort', abort, { once: true })
        Promise.resolve(promise).then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', abort))
      })
    },
    dispose() { for (const [signal, handler] of handlers) process.off(signal, handler) },
  }
}
