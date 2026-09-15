import test from 'node:test'
import assert from 'node:assert/strict'
import { createProbeProcessManager } from './spec-b-processes.mjs'

const alive = (pid) => { try { process.kill(pid, 0); return true } catch (error) { if (error.code === 'ESRCH') return false; throw error } }
async function line(stream) {
  let buffer = ''
  for await (const chunk of stream) { buffer += chunk; if (buffer.includes('\n')) return JSON.parse(buffer.split('\n')[0]) }
  throw new Error('fixture exited without readiness data')
}
const stubborn = "process.stdin.resume(); process.on('SIGTERM',()=>{}); console.log(JSON.stringify({pid:process.pid})); setInterval(()=>{},1000)"
function fixture(t, script) {
  const diagnostics = process.env.SPEC_B_PROCESS_TRACE_DIR
    ? { directory: process.env.SPEC_B_PROCESS_TRACE_DIR, runId: process.env.SPEC_B_PROCESS_TRACE_RUN_ID }
    : null
  const manager = createProbeProcessManager({ graceMs: 120, forceMs: 3000, diagnostics })
  const tree = manager.spawn(process.execPath, ['-e', script])
  const known = []
  t.after(async () => {
    try { await manager.cleanup() }
    finally {
      // Emergency cleanup only of exact fixture PIDs, even if the manager rejects.
      for (const pid of [...known, tree.pid, tree.child.pid]) if (pid && alive(pid)) process.kill(pid, 'SIGKILL')
      manager.dispose()
      await manager.flushDiagnostics()
    }
  })
  return { manager, tree, known }
}

test('cleanup terminates a descendant after its main process has exited', async (t) => {
  const script = `const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e',${JSON.stringify(stubborn.replace('process.stdin.resume();', ''))}],{detached:process.platform==='win32',stdio:['ignore','pipe','ignore']}); child.stdout.once('data',()=>{ console.log(JSON.stringify({pid:process.pid,descendant:child.pid})); process.exit(0); });`
  const { tree, known } = fixture(t, script)
  const info = await line(tree.stdout)
  known.push(info.descendant)
  await tree.exited
  assert.equal(alive(info.descendant), true)
  await tree.stop()
  assert.equal(alive(info.descendant), false, 'descendant survived cleanup after the main process exited')
})

test('cooperative shutdown is awaited and does not require force', async (t) => {
  const { tree } = fixture(t, "process.stdin.resume(); process.stdin.on('end',()=>process.exit(0)); console.log(JSON.stringify({pid:process.pid})); setInterval(()=>{},1000)")
  const info = await line(tree.stdout)
  const result = await tree.stop()
  assert.equal(alive(info.pid), false, 'cooperating child is still alive')
  assert.equal(result.forced, false)
})

test('post-drain supervisor cleanup is awaited without classifying cooperative shutdown as forced', { skip: process.platform !== 'win32' }, async (t) => {
  const manager = createProbeProcessManager({ graceMs: 120, forceMs: 3000, supervisorCloseDelayMs: 250 })
  const tree = manager.spawn(process.execPath, ['-e', "process.stdin.resume(); process.stdin.on('end',()=>process.exit(0)); console.log(JSON.stringify({pid:process.pid})); setInterval(()=>{},1000)"])
  const info = await line(tree.stdout)
  t.after(async () => { await manager.cleanup(); manager.dispose() })
  const result = await tree.stop()
  assert.equal(alive(info.pid), false)
  assert.equal(result.forced, false)
})

test('uncooperative child hits the grace deadline then is killed and confirmed stopped', async (t) => {
  const { tree } = fixture(t, stubborn)
  const info = await line(tree.stdout)
  const started = Date.now()
  const result = await tree.stop()
  assert.equal(alive(info.pid), false, 'uncooperative child is still alive')
  assert.equal(result.forced, true)
  assert.ok(Date.now() - started >= 100, 'grace period was bypassed')
})

test('concurrent cleanup is idempotent and covers every supervised process', async (t) => {
  const { manager, tree, known } = fixture(t, stubborn)
  const info = await line(tree.stdout)
  const second = manager.spawn(process.execPath, ['-e', stubborn])
  const secondInfo = await line(second.stdout)
  known.push(secondInfo.pid, second.child.pid)
  const calls = [manager.cleanup(), manager.cleanup()]
  await Promise.all(calls)
  assert.equal(alive(info.pid), false)
  assert.equal(alive(secondInfo.pid), false)
  await manager.cleanup()
  assert.throws(() => manager.spawn(process.execPath, ['-e', stubborn]), /closing|closed/)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`${signal} aborts waiting work and awaits cleanup before final output`, async (t) => {
    const { manager, tree } = fixture(t, stubborn)
    const info = await line(tree.stdout)
    const waiting = manager.wait(new Promise(() => {}))
    // process.emit invokes the same installed Node signal handler on Windows too;
    // Windows kill(SIGTERM) itself is forceful and cannot deliver a catchable signal.
    process.emit(signal)
    const result = await Promise.race([waiting.then(() => 'resolved', (error) => error.message), new Promise((resolve) => setTimeout(() => resolve('not interrupted'), 500))])
    assert.match(result, new RegExp(signal))
    await manager.cleanup()
    assert.equal(alive(info.pid), false, 'signal returned before process cleanup')
  })
}
