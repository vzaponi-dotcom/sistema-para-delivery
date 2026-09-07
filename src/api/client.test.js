import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient, createMovement, createOrder, createProduct, deleteClient, deleteProduct, getBootstrap, getSession, login, logout, registerPayment, registerTableTabPayment, updateClient, updateOrderStatus, updateProduct } from './client.js'
import * as tableClient from './client.js'

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

test('order helper sends the cart unchanged with one stable idempotency key', async () => {
  const calls = []
  await withFetch(async (...args) => {
    calls.push(args)
    const path = args[0]
    if (path === '/api/orders') return new Response(JSON.stringify({ order: { id: 'o1' } }), { status: 201, headers: { 'content-type': 'application/json' } })
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  }, async () => {
    await createOrder({
      clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01',
      items: [{ productId: 'p1', quantity: 2, note: 'sem cebola' }],
      deliveryFee: 8,
      adjustment: { type: 'discount', mode: 'percentage', value: 10, reason: '' },
      paymentMethod: 'Pix',
    }, 'checkout-key')
    await updateOrderStatus('o1', 'Finalizado')
    await registerPayment('o1', 'Pix')
    await createMovement({ type: 'saida', category: 'Insumos', description: 'Arroz', value: 20 })
  })

  const [orderPath, orderOptions] = calls[0]
  assert.equal(orderPath, '/api/orders')
  assert.equal(orderOptions.headers['idempotency-key'], 'checkout-key')
  assert.equal(orderOptions.headers['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(orderOptions.body).items, [{ productId: 'p1', quantity: 2, note: 'sem cebola' }])
  assert.equal(JSON.parse(orderOptions.body).paymentMethod, 'Pix')
  assert.deepEqual(calls.slice(1).map(([path, options]) => [path, options.method]), [
    ['/api/orders/o1/status', 'PATCH'],
    ['/api/orders/o1/payment', 'POST'],
    ['/api/movements', 'POST'],
  ])
})

test('table tab payment helper encodes the id and posts the payment method', async () => {
  const calls = []
  await withFetch(async (...args) => {
    calls.push(args)
    return new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } })
  }, async () => {
    await registerTableTabPayment('tab 1', 'Pix')
  })

  const [path, options] = calls.at(-1)
  assert.equal(path, '/api/table-tabs/tab%201/payment')
  assert.equal(options.method, 'POST')
  assert.deepEqual(JSON.parse(options.body), { method: 'Pix' })
})

test('table management helpers use encoded authenticated API routes and exact payloads', async () => {
  const calls = []
  await withFetch(async (...args) => {
    calls.push(args)
    return new Response(JSON.stringify({ tables: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }, async () => {
    await tableClient.createTable({ name: 'Varanda' })
    await tableClient.updateTable('mesa 1', { isActive: false })
    await tableClient.reorderTables(['mesa-2', 'mesa-1'])
    await tableClient.transferTableTab('mesa 1', 'mesa-2')
  })

  assert.deepEqual(calls.map(([path, options]) => [path, options.method, JSON.parse(options.body)]), [
    ['/api/tables', 'POST', { name: 'Varanda' }],
    ['/api/tables/mesa%201', 'PATCH', { isActive: false }],
    ['/api/tables/order', 'PUT', { tableIds: ['mesa-2', 'mesa-1'] }],
    ['/api/tables/mesa%201/transfer', 'POST', { destinationTableId: 'mesa-2' }],
  ])
})
