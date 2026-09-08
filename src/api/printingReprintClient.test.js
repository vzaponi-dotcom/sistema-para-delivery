import assert from 'node:assert/strict'
import test from 'node:test'
import * as client from './client.js'

const withFetch = async (callback) => {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (...args) => {
    calls.push(args)
    return Response.json({ job: { id: 'reprint-1' } })
  }
  try {
    await callback(calls)
  } finally {
    globalThis.fetch = original
  }
}

test('reprint client posts only the requested copy count to the encoded centralized job route', async () => {
  assert.equal(typeof client.reprintPrintJob, 'function')

  await withFetch(async (calls) => {
    await client.reprintPrintJob('job 1', 2)

    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], '/api/printing/jobs/job%201/reprint')
    assert.equal(calls[0][1].method, 'POST')
    assert.equal(calls[0][1].credentials, 'same-origin')
    assert.deepEqual(JSON.parse(calls[0][1].body), { copies: 2 })
    assert.equal(Object.hasOwn(JSON.parse(calls[0][1].body), 'stationId'), false)
  })
})
