import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTableServiceApi,
  tableServiceApi,
} from './tableServiceApi.js'

test('table service api preserves exact routes and payloads', async () => {
  const calls = []
  const request = async (path, options = {}) => {
    calls.push([path, options])
    return path.includes('/table-tabs/')
      ? { tableTab: { id: 'tab / A' } }
      : { tables: [] }
  }
  const json = (method, body) => ({ method, body: JSON.stringify(body) })
  const api = createTableServiceApi({ request, json })

  await api.createTable({ name: 'Varanda' })
  await api.updateTable('mesa / 1', { isActive: false })
  await api.reorderTables(['mesa-2', 'mesa-1'])
  await api.transferTableTab('mesa / 1', 'mesa-2', 'tab-A')
  await api.getTableTabDetail('tab / A')

  assert.deepEqual(calls.map(([path, options]) => [path, options.method || 'GET']), [
    ['/api/tables', 'POST'],
    ['/api/tables/mesa%20%2F%201', 'PATCH'],
    ['/api/tables/order', 'PUT'],
    ['/api/tables/mesa%20%2F%201/transfer', 'POST'],
    ['/api/table-tabs/tab%20%2F%20A', 'GET'],
  ])
  assert.deepEqual(JSON.parse(calls[0][1].body), { name: 'Varanda' })
  assert.deepEqual(JSON.parse(calls[1][1].body), { isActive: false })
  assert.deepEqual(JSON.parse(calls[2][1].body), { tableIds: ['mesa-2', 'mesa-1'] })
  assert.deepEqual(JSON.parse(calls[3][1].body), {
    destinationTableId: 'mesa-2',
    expectedTableTabId: 'tab-A',
  })
})

test('default detail adapter preserves structured HTTP errors from generic infrastructure', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      code: 'TABLE_TAB_NOT_FOUND',
      message: 'Comanda aberta não encontrada.',
    },
  }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  })

  try {
    await assert.rejects(
      () => tableServiceApi.getTableTabDetail('tab / missing'),
      (error) => {
        assert.equal(error.status, 404)
        assert.equal(error.code, 'TABLE_TAB_NOT_FOUND')
        assert.equal(error.message, 'Comanda aberta não encontrada.')
        return true
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
