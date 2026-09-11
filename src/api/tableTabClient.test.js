import assert from 'node:assert/strict'
import test from 'node:test'
import { createManualTableTabPrintJob, getTableTabDetail, getTableTabPrintDocument, transferTableTab } from './client.js'

const withFetch = async (implementation, callback) => {
  const original = globalThis.fetch
  globalThis.fetch = implementation
  try {
    await callback()
  } finally {
    globalThis.fetch = original
  }
}

test('table tab read helpers encode ids and use authenticated GET requests', async () => {
  const calls = []
  await withFetch(async (...args) => {
    calls.push(args)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
  }, async () => {
    await getTableTabDetail('tab / one')
    await getTableTabPrintDocument('tab / one')
  })

  assert.deepEqual(calls.map(([path, options]) => [path, options.method || 'GET', options.credentials]), [
    ['/api/table-tabs/tab%20%2F%20one', 'GET', 'same-origin'],
    ['/api/table-tabs/tab%20%2F%20one/print-document', 'GET', 'same-origin'],
  ])
})

test('table tab read helpers preserve structured API errors', async () => {
  await withFetch(async () => new Response(JSON.stringify({ error: { code: 'TABLE_TAB_NOT_FOUND', message: 'Comanda aberta n\u00e3o encontrada.' } }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  }), async () => {
    await assert.rejects(() => getTableTabDetail('missing'), (error) => {
      assert.equal(error.status, 404)
      assert.equal(error.code, 'TABLE_TAB_NOT_FOUND')
      return true
    })
  })
})

test('table tab print helper queues one consolidated comanda through an encoded same-origin mutation', async () => {
  const calls = []
  await withFetch(async (...args) => {
    calls.push(args)
    return new Response(JSON.stringify({ job: { id: 'job-42', type: 'table-tab' } }), { status: 201, headers: { 'content-type': 'application/json' } })
  }, async () => {
    assert.deepEqual(await createManualTableTabPrintJob('tab / one'), { job: { id: 'job-42', type: 'table-tab' } })
  })

  assert.equal(calls[0][0], '/api/table-tabs/tab%20%2F%20one/print-jobs')
  assert.equal(calls[0][1].method, 'POST')
  assert.equal(calls[0][1].credentials, 'same-origin')
  assert.deepEqual(JSON.parse(calls[0][1].body), {})
})

test('table transfer sends exactly the captured tab identity', async () => {
  const calls = []
  await withFetch(async (...args) => {
    calls.push(args)
    return new Response(JSON.stringify({ tableTab: { id: 'tab-A' }, tables: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }, async () => {
    await transferTableTab('mesa / 1', 'mesa-2', 'tab-A')
  })

  assert.equal(calls[0][0], '/api/tables/mesa%20%2F%201/transfer')
  assert.equal(calls[0][1].method, 'POST')
  assert.deepEqual(JSON.parse(calls[0][1].body), { destinationTableId: 'mesa-2', expectedTableTabId: 'tab-A' })
})
