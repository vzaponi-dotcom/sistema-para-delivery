import test from 'node:test'
import assert from 'node:assert/strict'
import { createCustomersApi, customersApi } from './customersApi.js'

test('Customers API preserves the current client routes, methods and payloads', async () => {
  const calls = []
  const api = createCustomersApi({
    request: async (...args) => { calls.push(args); return {} },
    json: (method, body) => ({ method, body: JSON.stringify(body) }),
  })

  await api.createClient({ name: 'Maria', phone: '', address: '' })
  await api.updateClient('client / 1', { name: 'Maria Silva', phone: '11999999999', address: 'Centro' })
  await api.deleteClient('client / 1')

  assert.deepEqual(calls.map(([url, options]) => [url, options.method]), [
    ['/api/clients', 'POST'],
    ['/api/clients/client%20%2F%201', 'PATCH'],
    ['/api/clients/client%20%2F%201', 'DELETE'],
  ])
  assert.deepEqual(JSON.parse(calls[0][1].body), { name: 'Maria', phone: '', address: '' })
  assert.deepEqual(JSON.parse(calls[1][1].body), { name: 'Maria Silva', phone: '11999999999', address: 'Centro' })
})


test('default Customers API uses the generic same-origin HTTP client', async () => {
  const originalFetch = globalThis.fetch
  let call
  globalThis.fetch = async (...args) => {
    call = args
    return new Response(JSON.stringify({ client: { id: 'c1', name: 'Maria' } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const result = await customersApi.createClient({ name: 'Maria', phone: '', address: '' })
    assert.equal(call[0], '/api/clients')
    assert.equal(call[1].method, 'POST')
    assert.equal(call[1].credentials, 'same-origin')
    assert.equal(call[1].headers['content-type'], 'application/json')
    assert.deepEqual(JSON.parse(call[1].body), { name: 'Maria', phone: '', address: '' })
    assert.equal(result.client.id, 'c1')
  } finally {
    globalThis.fetch = originalFetch
  }
})
