import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

const moduleUrl = new URL('./catalogApi.js', import.meta.url)
const loadApi = async () => {
  assert.equal(existsSync(moduleUrl), true, 'Catalog API boundary is missing')
  return import('./catalogApi.js')
}

test('Catalog API preserves product routes, encoded ids and payloads', async () => {
  const { createCatalogApi } = await loadApi()
  const calls = []
  const api = createCatalogApi({
    request: async (...args) => { calls.push(args); return { deleted: true } },
    json: (method, body) => ({ method, body: JSON.stringify(body) }),
  })

  await api.createProduct({ name: 'Água', price: 3 })
  await api.updateProduct('p / 1', { name: 'Água', price: 4 })
  await api.deleteProduct('p / 1')

  assert.deepEqual(calls.map(([url, options]) => [url, options.method]), [
    ['/api/products', 'POST'],
    ['/api/products/p%20%2F%201', 'PATCH'],
    ['/api/products/p%20%2F%201', 'DELETE'],
  ])
  assert.deepEqual(JSON.parse(calls[0][1].body), { name: 'Água', price: 3 })
  assert.deepEqual(JSON.parse(calls[1][1].body), { name: 'Água', price: 4 })
})

test('default Catalog API uses the generic same-origin HTTP client', async () => {
  const { catalogApi } = await loadApi()
  const originalFetch = globalThis.fetch
  let call
  globalThis.fetch = async (...args) => {
    call = args
    return new Response(JSON.stringify({ product: { id: 'p1', name: 'Água', price: 3 } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const result = await catalogApi.createProduct({ name: 'Água', price: 3 })
    assert.equal(call[0], '/api/products')
    assert.equal(call[1].method, 'POST')
    assert.equal(call[1].credentials, 'same-origin')
    assert.equal(call[1].headers['content-type'], 'application/json')
    assert.deepEqual(JSON.parse(call[1].body), { name: 'Água', price: 3 })
    assert.equal(result.product.id, 'p1')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Catalog API propagates adapter errors unchanged', async () => {
  const { createCatalogApi } = await loadApi()
  const expected = Object.assign(new Error('not found'), { status: 404, code: 'PRODUCT_NOT_FOUND' })
  const api = createCatalogApi({
    request: async () => { throw expected },
    json: (method, body) => ({ method, body: JSON.stringify(body) }),
  })

  await assert.rejects(api.deleteProduct('missing'), (error) => error === expected)
})
