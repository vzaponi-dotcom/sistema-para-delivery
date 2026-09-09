import assert from 'node:assert/strict'
import test from 'node:test'
import * as client from './client.js'

test('prioritizePrintJob uses the central endpoint without station or printer data', async () => {
  assert.equal(typeof client.prioritizePrintJob, 'function')
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (...args) => {
    calls.push(args)
    return Response.json({ job: { id: 'job 1', status: 'pending', priority: 1 } })
  }

  try {
    const result = await client.prioritizePrintJob('job 1')
    assert.equal(result.job.priority, 1)
    assert.equal(calls.length, 1)
    const [path, options] = calls[0]
    assert.equal(path, '/api/printing/jobs/job%201/prioritize')
    assert.equal(options.method, 'POST')
    assert.equal(options.credentials, 'same-origin')
    assert.equal(options.body, undefined)
  } finally {
    globalThis.fetch = original
  }
})
