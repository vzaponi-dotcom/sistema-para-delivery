import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(check, timeoutMs) {
  const end = Date.now() + timeoutMs
  while (!check()) { if (Date.now() >= end) return false; await delay(15) }
  return true
}
const groupAlive = (pid) => { try { process.kill(-pid, 0); return true } catch (error) { if (error.code === 'ESRCH') return false; throw error } }
function signalGroup(pid, signal) { try { process.kill(-pid, signal) } catch (error) { if (error.code !== 'ESRCH') throw error } }

function startTree(command, args, options, graceMs, forceMs) {
  const windows = process.platform === 'win32'
  const marker = `SPEC_B_JOB_${randomUUID()}:`
  const request = Buffer.from(JSON.stringify({ command, args, marker })).toString('base64')
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
      if (message.type === 'ready') { pid = message.pid; readyResolve() }
      if (message.type === 'exit') { exitCode = message.code; exitResolve({ code: exitCode }) }
      if (message.type === 'drained') drained = true
    }
  })
  child.on('error', (error) => { failure = error; readyResolve(); exitResolve({ error }) })
  child.stdin.on('error', (error) => { if (!['EPIPE', 'ECONNRESET'].includes(error.code)) failure = error })
  child.once('spawn', () => { if (!windows) readyResolve() })
  child.once('exit', (code, signal) => {
    if (!windows) { exitCode = code; exitResolve({ code, signal }) }
  })
  child.once('close', (code) => {
    closed = true
    if (errorBuffer) stderr.write(errorBuffer)
    stderr.end()
    // 'exit' may precede stderr delivery; only 'close' proves all status frames arrived.
    if (windows && !drained) { failure = new Error(`Windows job supervisor exited before confirming an empty job (${code})`); readyResolve(); exitResolve({ error: failure }) }
  })
  let stopping
  const stop = () => stopping ??= (async () => {
    // Windows owns an OS job even after the command exits; POSIX owns a process
    // group even after its leader exits. Do not short-circuit on command exitCode.
    if (!await until(() => pid !== null || failure, forceMs)) {
      child.stdin.end('force\n')
      if (!await until(() => closed, forceMs)) {
        child.kill('SIGKILL')
        await until(() => closed, forceMs)
      }
      throw new Error('Process supervisor did not start before cleanup deadline')
    }
    if (failure) throw failure
    const empty = () => windows ? drained && closed : !groupAlive(pid)
    if (empty()) return { forced: false }
    if (windows) child.stdin.write('stop\n')
    else child.stdin.end()
    if (await until(empty, graceMs)) return { forced: false }
    // POSIX first gets a cooperative group SIGTERM, then SIGKILL. Windows cannot
    // deliver SIGTERM; the job receives TerminateJobObject and confirms Active=0.
    if (!windows) {
      signalGroup(pid, 'SIGTERM')
      if (await until(empty, graceMs)) return { forced: false }
      signalGroup(pid, 'SIGKILL')
    } else child.stdin.write('force\n')
    if (!await until(empty, forceMs)) {
      if (windows) {
        child.kill('SIGKILL') // KILL_ON_JOB_CLOSE is the last-resort safety net.
        await until(() => closed, forceMs)
      }
      throw new Error('Process tree termination was not confirmed before deadline')
    }
    return { forced: true }
  })()
  return { child, stdout: child.stdout, stderr, ready, exited, stop,
    get pid() { return pid }, get exitCode() { return exitCode }, get failure() { return failure } }
}

export function createProbeProcessManager({ graceMs = 300, forceMs = 5000 } = {}) {
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
      const tree = startTree(command, args, options, graceMs, forceMs)
      trees.add(tree)
      return tree
    },
    cleanup,
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
