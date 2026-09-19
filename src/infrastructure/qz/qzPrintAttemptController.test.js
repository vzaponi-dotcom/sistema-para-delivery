import assert from 'node:assert/strict'
import test from 'node:test'
import { executeQzPrintAttempt } from './qzPrintAttemptController.js'
import { renderEscPos58mm } from '../../domains/printing/index.js'

const job = { id: 'job-1', document: { type: 'order' }, copiesRequested: 2, copiesPrinted: 0 }
const attempt = { id: 'attempt-1', spoolJobName: 'GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1' }

const tableTabDocument = {
  version: 1,
  type: 'table-tab',
  business: { name: 'Restaurante A' },
  tableTab: { id: 'tab-17', number: 17, tableName: 'Mesa 7' },
  items: [],
  financial: { totalCents: 0 },
}

for (const scenario of [
  { name: '1/1', copiesRequested: 1, copiesPrinted: 0, expectedCopy: 1 },
  { name: '1/2', copiesRequested: 2, copiesPrinted: 0, expectedCopy: 1 },
  { name: '2/2', copiesRequested: 2, copiesPrinted: 1, expectedCopy: 2 },
]) {
  test(`QZ renders comanda ${scenario.name} once and records the matching attempt`, async () => {
    const calls = []
    const tableTabJob = {
      id: 'job-tab',
      document: tableTabDocument,
      copiesRequested: scenario.copiesRequested,
      copiesPrinted: scenario.copiesPrinted,
    }
    const tableTabAttempt = {
      id: `attempt-${scenario.expectedCopy}`,
      spoolJobName: `GESTAO-DELIVERY:job-tab:COPY:${scenario.expectedCopy}:ATTEMPT:1`,
    }

    const result = await executeQzPrintAttempt({
      job: tableTabJob,
      stationId: 'station-1',
      renderer: renderEscPos58mm,
      createAttempt: async (jobId, stationId, copyNumber) => {
        calls.push(['attempt', jobId, stationId, copyNumber])
        return tableTabAttempt
      },
      markSubmitting: async () => tableTabAttempt,
      awaitOutcome: async () => ({ statusText: 'COMPLETE', jobName: tableTabAttempt.spoolJobName }),
      sendBytes: async (bytes) => calls.push(['transport', bytes.length > 0]),
      recordEvent: async () => ({ ...tableTabAttempt, status: 'complete' }),
      markUnknown: async () => assert.fail('confirmed comanda must not become unknown'),
    })

    assert.equal(result.status, 'confirmed')
    assert.deepEqual(calls, [
      ['attempt', 'job-tab', 'station-1', scenario.expectedCopy],
      ['transport', true],
    ])
  })
}

test('QZ attempt persists submission risk before sending and confirms only from a persisted COMPLETE event', async () => {
  const calls = []
  let releaseOutcome
  const outcome = new Promise((resolve) => { releaseOutcome = resolve })
  const resultPromise = executeQzPrintAttempt({
    job,
    stationId: 'station-1',
    renderer: (_document, options) => { calls.push(`render:${options.copyNumber}`); return new Uint8Array([1]) },
    createAttempt: async (jobId, stationId, copyNumber) => { calls.push(`create:${jobId}:${stationId}:${copyNumber}`); return attempt },
    markSubmitting: async (attemptId, stationId) => { calls.push(`submitting:${attemptId}:${stationId}`); return attempt },
    awaitOutcome: (jobName) => { calls.push(`wait:${jobName}`); return outcome },
    sendBytes: async (bytes, options) => { calls.push(`send:${bytes[0]}:${options.jobName}`) },
    recordEvent: async (attemptId, stationId, event) => { calls.push(`event:${attemptId}:${stationId}:${event.type}`); return { ...attempt, status: 'complete' } },
    markUnknown: async () => assert.fail('confirmed event must not become unknown'),
  })

  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(calls, [
    'render:1', 'create:job-1:station-1:1', 'submitting:attempt-1:station-1',
    'wait:GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1', 'send:1:GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1',
  ])
  releaseOutcome({ statusText: 'COMPLETE', jobName: attempt.spoolJobName, jobId: 44 })
  const result = await resultPromise
  assert.equal(result.status, 'confirmed')
  assert.equal(result.attempt.status, 'complete')
  assert.deepEqual(calls.at(-1), 'event:attempt-1:station-1:COMPLETE')
})

test('QZ attempt never retries a post-submission failure and persists it as unknown', async () => {
  const failure = Object.assign(new Error('QZ closed'), { code: 'QZ_OBSERVATION_LOST' })
  let sends = 0
  let unknown = null
  const result = await executeQzPrintAttempt({
    job,
    stationId: 'station-1',
    renderer: () => new Uint8Array([1]),
    createAttempt: async () => attempt,
    markSubmitting: async () => attempt,
    awaitOutcome: async () => { throw failure },
    sendBytes: async () => { sends += 1 },
    recordEvent: async () => assert.fail('no complete event after observation loss'),
    markUnknown: async (receivedAttempt, stationId, error) => { unknown = { receivedAttempt, stationId, error } },
  })

  assert.equal(result.status, 'unknown')
  assert.equal(result.error, failure)
  assert.equal(sends, 1)
  assert.deepEqual(unknown, { receivedAttempt: attempt, stationId: 'station-1', error: failure })
})

test('QZ attempt resumes the same durable attempt when submitting committed but its response was lost', async () => {
  let submittingCalls = 0
  let sends = 0
  const result = await executeQzPrintAttempt({
    job,
    stationId: 'station-1',
    renderer: () => new Uint8Array([1]),
    createAttempt: async () => attempt,
    markSubmitting: async () => {
      submittingCalls += 1
      if (submittingCalls === 1) throw Object.assign(new Error('response lost'), { code: 'NETWORK_ERROR' })
      return { ...attempt, status: 'submitting', submissionStartedAt: '2026-09-10T12:00:00.000Z' }
    },
    awaitOutcome: async () => ({ statusText: 'COMPLETE', jobName: attempt.spoolJobName, jobId: 45 }),
    sendBytes: async () => { sends += 1 },
    recordEvent: async () => ({ ...attempt, status: 'complete' }),
    markUnknown: async () => assert.fail('a resumed submission must complete normally'),
  })

  assert.equal(result.status, 'confirmed')
  assert.equal(submittingCalls, 2)
  assert.equal(sends, 1)
})
