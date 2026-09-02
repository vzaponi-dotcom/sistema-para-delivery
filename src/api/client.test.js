import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient, createProduct, deleteClient, deleteProduct, getBootstrap, getSession, login, logout, updateClient, updateProduct } from './client.js'

const withFetch = async (implementation, callback) => {
  const original = globalThis.fetch
  globalThis.fetch = implementation
  try {
    await callback()
  } finally {
    globalThis.fetch = original
  }
}

test('createClient posts JSON to same-origin API', async () => {
  let call
  await withFetch(async (...args) => {
    call = args
    return new Response(JSON.stringify({ client: { id: 'c1', name: 'Maria' } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }, async () => {
    const result = await createClient({ name: 'Maria', phone: '', address: '' })
    assert.equal(call[0], '/api/clients')
    assert.equal(call[1].method, 'POST')
    assert.equal(call[1].credentials, 'same-origin')
    assert.equal(call[1].headers['content-type'], 'application/json')
    assert.deepEqual(JSON.parse(call[1].body), { name: 'Maria', phone: '', address: '' })
    assert.equal(result.client.id, 'c1')
  })
})

test('API errors preserve status and code', async () => {
  await withFetch(async () => new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Sessão expirada' } }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  }), async () => {
    await assert.rejects(() => getBootstrap(), (error) => {
      assert.equal(error.status, 401)
      assert.equal(error.code, 'UNAUTHENTICATED')
      assert.equal(error.message, 'Sessão expirada')
      return true
    })
  })
})

test('auth and CRUD endpoint helpers use the expected routes and methods', async () => {
  const calls = []
  await withFetch(async (...args) => {
    calls.push(args)
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  }, async () => {
    await getSession()
    await login('4827')
    await logout()
    await getBootstrap()
    await updateClient('c1', { name: 'Maria', phone: '', address: '' })
    await deleteClient('c1')
    await createProduct({ category: 'Bebida', size: '350ml', name: 'Coca', price: 8.5 })
    await updateProduct('p1', { category: 'Bebida', size: 'Lata', name: 'Coca', price: 9 })
    await deleteProduct('p1')
  })

  assert.deepEqual(calls.map(([path, options]) => [path, options?.method || 'GET']), [
    ['/api/auth/session', 'GET'],
    ['/api/auth/login', 'POST'],
    ['/api/auth/logout', 'POST'],
    ['/api/bootstrap', 'GET'],
    ['/api/clients/c1', 'PATCH'],
    ['/api/clients/c1', 'DELETE'],
    ['/api/products', 'POST'],
    ['/api/products/p1', 'PATCH'],
    ['/api/products/p1', 'DELETE'],
  ])
})
