import test from 'node:test'
import assert from 'node:assert/strict'
import { runClaimedPrintJob } from './printJobRunner.js'
import { createPhysicalJobFailureNotifier } from './usePrintingManager.js'

const baseJob = {
  id: 'job-1',
  document: { version: 1, type: 'order' },
  copiesRequested: 2,
  copiesPrinted: 0,
}

test('successful first pass of a two-copy job renders and completes only copy 1/2', async () => {
  const calls = { renderer: 0, transport: 0, complete: 0, fail: 0 }
  const bytes = new Uint8Array([1, 2, 3])
  const renderer = (document, options) => {
    calls.renderer += 1
    assert.equal(document, baseJob.document)
    assert.deepEqual(options, { copies: 1, copyNumber: 1, totalCopies: 2 })
    return bytes
  }
  const transport = async (port, receivedBytes) => {
    calls.transport += 1
    assert.equal(port, 'port-1')
    assert.equal(receivedBytes, bytes)
  }
  const completeJob = async (jobId, stationId, copiesPrinted) => {
    calls.complete += 1
    assert.equal(jobId, 'job-1')
    assert.equal(stationId, 'station-1')
    assert.equal(copiesPrinted, 1)
  }
  const failJob = async () => { calls.fail += 1 }

  const result = await runClaimedPrintJob({
    job: baseJob,
    stationId: 'station-1',
    port: 'port-1',
    completeJob,
    failJob,
    renderer,
    transport,
  })

  assert.deepEqual(result, { status: 'printed' })
  assert.deepEqual(calls, { renderer: 1, transport: 1, complete: 1, fail: 0 })
})

test('second pass resumes a two-copy job at copy 2/2 without reprinting the first copy', async () => {
  const resumedJob = { ...baseJob, copiesPrinted: 1 }
  const bytes = new Uint8Array([4, 5, 6])
  let completePayload = null

  const result = await runClaimedPrintJob({
    job: resumedJob,
    stationId: 'station-1',
    port: 'port-1',
    completeJob: async (jobId, stationId, copiesPrinted) => {
      completePayload = { jobId, stationId, copiesPrinted }
    },
    failJob: async () => assert.fail('second copy must not fail'),
    renderer: (document, options) => {
      assert.equal(document, resumedJob.document)
      assert.deepEqual(options, { copies: 1, copyNumber: 2, totalCopies: 2 })
      return bytes
    },
    transport: async (_port, receivedBytes) => assert.equal(receivedBytes, bytes),
  })

  assert.deepEqual(result, { status: 'printed' })
  assert.deepEqual(completePayload, { jobId: 'job-1', stationId: 'station-1', copiesPrinted: 2 })
})

test('one-copy job keeps a single physical pass labeled 1/1', async () => {
  const job = { ...baseJob, copiesRequested: 1, copiesPrinted: 0 }
  let completedCopies = null

  await runClaimedPrintJob({
    job,
    stationId: 'station-1',
    port: 'port-1',
    completeJob: async (_jobId, _stationId, copiesPrinted) => { completedCopies = copiesPrinted },
    failJob: async () => assert.fail('one-copy job must not fail'),
    renderer: (_document, options) => {
      assert.deepEqual(options, { copies: 1, copyNumber: 1, totalCopies: 1 })
      return new Uint8Array([7])
    },
    transport: async () => {},
  })

  assert.equal(completedCopies, 1)
})

test('failure before serial write reports a known failed outcome once', async () => {
  const error = Object.assign(new Error('Não foi possível conectar à impressora.'), { code: 'SERIAL_OPEN_FAILED' })
  let failPayload = null
  let completeCalls = 0

  const result = await runClaimedPrintJob({
    job: baseJob,
    stationId: 'station-1',
    port: 'port-1',
    completeJob: async () => { completeCalls += 1 },
    failJob: async (jobId, stationId, payload) => { failPayload = { jobId, stationId, payload } },
    renderer: () => new Uint8Array([1]),
    transport: async () => { throw error },
  })

  assert.equal(result.status, 'failed')
  assert.equal(result.error, error)
  assert.equal(completeCalls, 0)
  assert.deepEqual(failPayload, {
    jobId: 'job-1',
    stationId: 'station-1',
    payload: {
      code: 'SERIAL_OPEN_FAILED',
      message: 'Não foi possível conectar à impressora.',
      uncertain: false,
    },
  })
})

test('mid-write failure reports uncertain physical outcome once and never retries', async () => {
  const error = Object.assign(new Error('A conexão caiu durante a impressão. O resultado físico é incerto.'), { code: 'SERIAL_WRITE_UNCERTAIN' })
  let renderCalls = 0
  let transportCalls = 0
  let failCalls = 0
  let completeCalls = 0

  const result = await runClaimedPrintJob({
    job: baseJob,
    stationId: 'station-1',
    port: 'port-1',
    completeJob: async () => { completeCalls += 1 },
    failJob: async (_jobId, _stationId, payload) => {
      failCalls += 1
      assert.equal(payload.uncertain, true)
      assert.equal(payload.code, 'SERIAL_WRITE_UNCERTAIN')
    },
    renderer: () => {
      renderCalls += 1
      return new Uint8Array([1])
    },
    transport: async () => {
      transportCalls += 1
      throw error
    },
  })

  assert.equal(result.status, 'requires_attention')
  assert.equal(result.error, error)
  assert.equal(renderCalls, 1)
  assert.equal(transportCalls, 1)
  assert.equal(failCalls, 1)
  assert.equal(completeCalls, 0)
})

test('unexpected errors are normalized without scheduling hidden retries', async () => {
  const originalSetTimeout = globalThis.setTimeout
  let timerCalls = 0
  globalThis.setTimeout = (...args) => {
    timerCalls += 1
    return originalSetTimeout(...args)
  }
  try {
    let failPayload = null
    const result = await runClaimedPrintJob({
      job: baseJob,
      stationId: 'station-1',
      port: 'port-1',
      completeJob: async () => {},
      failJob: async (_jobId, _stationId, payload) => { failPayload = payload },
      renderer: () => { throw new Error('boom') },
      transport: async () => assert.fail('transport must not run after renderer failure'),
    })

    assert.equal(result.status, 'failed')
    assert.deepEqual(failPayload, {
      code: 'PRINT_FAILED',
      message: 'boom',
      uncertain: false,
    })
    assert.equal(timerCalls, 0)
  } finally {
    globalThis.setTimeout = originalSetTimeout
  }
})

test('test print renders without selected-copy options and completes one physical pass', async () => {
  const job = {
    id: 'job-test-1',
    document: { version: 1, type: 'test' },
    copiesRequested: 1,
    copiesPrinted: 0,
  }
  const bytes = new Uint8Array([9, 9])
  let completedCopies = null

  const result = await runClaimedPrintJob({
    job,
    stationId: 'station-1',
    port: null,
    completeJob: async (_jobId, _stationId, copiesPrinted) => { completedCopies = copiesPrinted },
    failJob: async () => assert.fail('test print must not fail'),
    renderer: (document, options) => {
      assert.equal(document, job.document)
      assert.deepEqual(options, { copies: 1 })
      return bytes
    },
    transport: async (_port, receivedBytes) => assert.equal(receivedBytes, bytes),
  })

  assert.deepEqual(result, { status: 'printed' })
  assert.equal(completedCopies, 1)
})

test('known and uncertain failures persist once and produce one toast each without modal state', async () => {
  const notifier = createPhysicalJobFailureNotifier()
  const persisted = []
  const ui = { toasts: [], modal: null }
  const scenarios = [
    { id: 'known-job', code: 'SERIAL_OPEN_FAILED', status: 'failed', uncertain: false },
    { id: 'uncertain-job', code: 'SERIAL_WRITE_UNCERTAIN', status: 'requires_attention', uncertain: true },
  ]

  for (const scenario of scenarios) {
    const job = { ...baseJob, id: scenario.id }
    const error = Object.assign(new Error(`${scenario.id} failed`), { code: scenario.code })
    const result = await runClaimedPrintJob({
      job,
      stationId: 'kitchen-primary',
      port: null,
      completeJob: async () => assert.fail('failed physical job must not complete'),
      failJob: async (jobId, stationId, payload) => { persisted.push({ jobId, stationId, payload }) },
      renderer: () => new Uint8Array([1]),
      transport: async () => { throw error },
    })

    assert.equal(result.status, scenario.status)
    assert.equal(notifier.notify({
      job,
      status: result.status,
      error: result.error,
      onNotify: () => { ui.toasts.push('Impressão requer atenção na fila') },
    }), true)
    assert.equal(notifier.notify({ job, status: result.status, error: result.error, onNotify: () => ui.toasts.push('duplicate') }), false)
  }

  assert.deepEqual(persisted.map(({ jobId, stationId, payload }) => ({ jobId, stationId, code: payload.code, uncertain: payload.uncertain })), [
    { jobId: 'known-job', stationId: 'kitchen-primary', code: 'SERIAL_OPEN_FAILED', uncertain: false },
    { jobId: 'uncertain-job', stationId: 'kitchen-primary', code: 'SERIAL_WRITE_UNCERTAIN', uncertain: true },
  ])
  assert.deepEqual(ui.toasts, ['Impressão requer atenção na fila', 'Impressão requer atenção na fila'])
  assert.equal(ui.modal, null)
})
