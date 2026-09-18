import assert from 'node:assert/strict'
import test from 'node:test'
import { createManualTableTabPrintJob, getTableTabPrintDocument } from './client.js'

const withFetch = async (implementation, callback) => {
  const original = globalThis.fetch
  globalThis.fetch = implementation
  try {
    await callback()
  } finally {
    globalThis.fetch = original
  }
}

test('table tab print document helper encodes ids and uses authenticated GET requests', async () => {
  const calls = []
  await withFetch(async (...args) => {
    calls.push(args)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }, async () => {
    await getTableTabPrintDocument('tab / one')
  })

  assert.deepEqual(calls.map(([path, options]) => [path, options.method || 'GET', options.credentials]), [
    ['/api/table-tabs/tab%20%2F%20one/print-document', 'GET', 'same-origin'],
  ])
})

test('table tab print helper queues one consolidated comanda through an encoded same-origin mutation', async () => {
  const calls = []
  await withFetch(async (...args) => {
    calls.push(args)
    return new Response(JSON.stringify({ job: { id: 'job-42', type: 'table-tab' } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }, async () => {
    assert.deepEqual(
      await createManualTableTabPrintJob('tab / one'),
      { job: { id: 'job-42', type: 'table-tab' } },
    )
  })

  assert.equal(calls[0][0], '/api/table-tabs/tab%20%2F%20one/print-jobs')
  assert.equal(calls[0][1].method, 'POST')
  assert.equal(calls[0][1].body, '{}')
  assert.equal(calls[0][1].credentials, 'same-origin')
  assert.deepEqual(JSON.parse(calls[0][1].body), {})
})
