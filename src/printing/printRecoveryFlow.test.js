import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveRecoveryView,
  nextRecoveryState,
  runSingleRecoveryCopy,
} from './printRecoveryFlow.js'

test('a ready pending safe backlog prompts once while deferred recovery stays closed until a new cycle', () => {
  assert.deepEqual(deriveRecoveryView({ recoveryState: 'pending', physicalReady: true, safeBacklog: 2 }), {
    recoveryState: 'pending', recoveryPendingCount: 2, recoveryPromptEligible: true,
  })
  assert.equal(deriveRecoveryView({ recoveryState: 'pending', physicalReady: false, safeBacklog: 2 }).recoveryPromptEligible, false)
  assert.equal(deriveRecoveryView({ recoveryState: 'deferred', physicalReady: true, safeBacklog: 2 }).recoveryPromptEligible, false)
  assert.equal(nextRecoveryState({ recoveryState: 'normal', wasPhysicalReady: false, physicalReady: true, safeBacklog: 1 }), 'pending')
  assert.equal(nextRecoveryState({ recoveryState: 'deferred', wasPhysicalReady: false, physicalReady: true, safeBacklog: 1 }), 'deferred')
})

test('recovery transitions preserve a manual one-copy pace', () => {
  assert.equal(nextRecoveryState({ recoveryState: 'pending', action: 'start' }), 'active')
  assert.equal(nextRecoveryState({ recoveryState: 'active', action: 'defer' }), 'deferred')
  assert.equal(nextRecoveryState({ recoveryState: 'deferred', action: 'resume' }), 'active')
  assert.equal(nextRecoveryState({ recoveryState: 'active', action: 'complete' }), 'deferred')
})

test('a recovery action claims and executes exactly one first copy without firing its second copy', async () => {
  const calls = []
  const firstCopy = { id: 'first', copiesRequested: 2, copiesPrinted: 0 }
  const result = await runSingleRecoveryCopy({
    recoveryState: 'active',
    physicalReady: true,
    busyJobId: null,
    claimNext: async () => {
      calls.push('claim')
      return { job: firstCopy }
    },
    executeJob: async (job) => {
      calls.push(`execute:${job.id}:${job.copiesPrinted}`)
      return { status: 'printed', job: { ...job, status: 'awaiting_second_copy', copiesPrinted: 1 } }
    },
  })

  assert.equal(result.status, 'printed')
  assert.equal(result.jobId, 'first')
  assert.deepEqual(calls, ['claim', 'execute:first:0'])
})

test('recovery delegates durable affinity scheduling to the server and executes nothing when it stays blocked', async () => {
  let claims = 0
  const result = await runSingleRecoveryCopy({
    recoveryState: 'active',
    recoveryJobId: 'first',
    physicalReady: true,
    busyJobId: null,
    claimNext: async () => { claims += 1; return null },
    executeJob: async () => assert.fail('an unresolved affinity must not execute another job'),
  })

  assert.equal(result, null)
  assert.equal(claims, 1)
})

test('recovery never claims while it is deferred, offline, or already printing', async () => {
  let claims = 0
  for (const input of [
    { recoveryState: 'deferred', physicalReady: true, busyJobId: null },
    { recoveryState: 'active', physicalReady: false, busyJobId: null },
    { recoveryState: 'active', physicalReady: true, busyJobId: 'job-in-flight' },
  ]) {
    const result = await runSingleRecoveryCopy({
      ...input,
      claimNext: async () => { claims += 1; return { job: { id: 'unexpected' } } },
      executeJob: async () => assert.fail('an ineligible recovery must not execute'),
    })
    assert.equal(result, null)
  }
  assert.equal(claims, 0)
})
