import assert from 'node:assert/strict'
import test from 'node:test'
import { createPrintExecutionTicker } from './printExecutionTicker.js'

test('execution ticker prefers a dedicated worker and forwards ticks without a window timer', () => {
  const posted = []
  let terminated = 0
  let intervalCalls = 0
  const worker = {
    onmessage: null,
    onerror: null,
    postMessage(message) { posted.push(message) },
    terminate() { terminated += 1 },
  }
  const ticker = createPrintExecutionTicker({
    intervalMs: 2000,
    workerFactory: () => worker,
    setIntervalImpl: () => { intervalCalls += 1; return 7 },
    clearIntervalImpl: () => {},
  })
  let ticks = 0
  const stop = ticker.start(() => { ticks += 1 })

  assert.deepEqual(posted, [{ type: 'start', intervalMs: 2000 }])
  assert.equal(intervalCalls, 0)

  worker.onmessage({ data: { type: 'tick' } })
  worker.onmessage({ data: { type: 'ignored' } })
  assert.equal(ticks, 1)

  stop()
  assert.deepEqual(posted, [{ type: 'start', intervalMs: 2000 }, { type: 'stop' }])
  assert.equal(terminated, 1)
})

test('execution ticker falls back to the existing interval when Worker is unavailable', () => {
  let scheduled = null
  let cleared = null
  const ticker = createPrintExecutionTicker({
    intervalMs: 2000,
    workerFactory: () => null,
    setIntervalImpl: (callback, intervalMs) => {
      scheduled = { callback, intervalMs }
      return 42
    },
    clearIntervalImpl: (timer) => { cleared = timer },
  })
  let ticks = 0
  const stop = ticker.start(() => { ticks += 1 })

  assert.equal(scheduled.intervalMs, 2000)
  scheduled.callback()
  assert.equal(ticks, 1)

  stop()
  assert.equal(cleared, 42)
})

test('worker startup failure degrades to the interval instead of stopping automatic printing', () => {
  let intervalCalls = 0
  const ticker = createPrintExecutionTicker({
    intervalMs: 2000,
    workerFactory: () => { throw new Error('worker blocked') },
    setIntervalImpl: () => { intervalCalls += 1; return 9 },
    clearIntervalImpl: () => {},
  })

  const stop = ticker.start(() => {})
  assert.equal(intervalCalls, 1)
  stop()
})
