import test from 'node:test'
import assert from 'node:assert/strict'
import {
  runExclusivePrintOperation,
  createPhysicalJobFailureNotifier,
} from './physicalOperation.js'

test('exclusive physical operation rejects overlap and releases ownership', async () => {
  let active = null
  const acquire = () => {
    if (active) return null
    active = { token: 1 }
    return active
  }
  const release = (owner) => {
    if (owner === active) active = null
  }
  let finish
  const pending = new Promise((resolve) => { finish = resolve })
  const first = runExclusivePrintOperation({ acquire, release, operation: () => pending })
  await Promise.resolve()
  await assert.rejects(
    () => runExclusivePrintOperation({ acquire, release, operation: async () => 'duplicate' }),
    (error) => error.code === 'PRINT_OPERATION_BUSY',
  )
  finish('done')
  assert.equal(await first, 'done')
  assert.equal(await runExclusivePrintOperation({ acquire, release, operation: async () => 'next' }), 'next')
})

test('physical failure notifier emits once per persisted failure state', () => {
  const notifier = createPhysicalJobFailureNotifier()
  const events = []
  const job = { id: 'job-1' }
  assert.equal(notifier.notify({ job, status: 'failed', error: new Error('x'), onNotify: () => events.push('failed') }), true)
  assert.equal(notifier.notify({ job, status: 'failed', error: new Error('x'), onNotify: () => events.push('duplicate') }), false)
  notifier.synchronize([])
  assert.equal(notifier.notify({ job, status: 'failed', error: new Error('x'), onNotify: () => events.push('failed-again') }), true)
  assert.deepEqual(events, ['failed', 'failed-again'])
})
