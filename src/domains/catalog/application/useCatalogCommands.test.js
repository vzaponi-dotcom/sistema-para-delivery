import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mountHook } from '../test-support/harness.js'

const moduleUrl = new URL('./useCatalogCommands.js', import.meta.url)
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const read = (path) => readFileSync(new URL(path, `file://${root}/`), 'utf8')

const loadHook = async () => {
  assert.equal(existsSync(moduleUrl), true, 'Catalog commands boundary is missing')
  return (await import('./useCatalogCommands.js')).useCatalogCommands
}

test('catalog commands use authoritative products, request keys and official delete effect', async (t) => {
  const useCatalogCommands = await loadHook()
  const calls = []
  const effects = []
  const keys = []
  const successes = []
  const draftCreate = { id: 'draft-create', name: 'Rascunho', price: 1 }
  const draftUpdate = { id: 'draft-update', name: 'Rascunho editado', price: 2 }
  const created = { id: 'p-new', name: 'Oficial criado', price: 3 }
  const updated = { id: 'p-1', name: 'Oficial editado', price: 4 }

  const hook = await mountHook(t, useCatalogCommands, {
    api: {
      createProduct: async (payload) => { calls.push(['createProduct', payload]); return { product: created } },
      updateProduct: async (id, payload) => { calls.push(['updateProduct', id, payload]); return { product: updated } },
      deleteProduct: async (id) => { calls.push(['deleteProduct', id]); return { deleted: true } },
    },
    writesBlocked: false,
    canManageProducts: true,
    applyOfficialEffects: (effect) => effects.push(effect),
    setRequestKey: (key) => keys.push(key),
    onSuccess: (message) => successes.push(message),
    onError(error) { assert.fail(error?.message || 'unexpected error') },
  })

  assert.strictEqual(await hook.current().createProduct(draftCreate), created)
  assert.strictEqual(await hook.current().updateProduct('p-1', draftUpdate), updated)
  assert.equal(await hook.current().deleteProduct('p-1'), true)

  assert.deepEqual(calls, [
    ['createProduct', draftCreate],
    ['updateProduct', 'p-1', draftUpdate],
    ['deleteProduct', 'p-1'],
  ])
  assert.deepEqual(effects, [
    { product: created },
    { product: updated },
    { deletedProductId: 'p-1' },
  ])
  assert.deepEqual(keys, [
    'product:create', null,
    'product:update:p-1', null,
    'product:delete:p-1', null,
  ])
  assert.deepEqual(successes, [
    'Produto adicionado com sucesso',
    'Produto atualizado com sucesso',
    'Produto excluído com sucesso',
  ])
})

test('catalog commands refuse all writes while globally blocked or without products.manage', async (t) => {
  const useCatalogCommands = await loadHook()
  let apiCalls = 0
  let effectCalls = 0
  let keyCalls = 0
  let successCalls = 0
  let errorCalls = 0
  const api = {
    createProduct: async () => { apiCalls += 1; return {} },
    updateProduct: async () => { apiCalls += 1; return {} },
    deleteProduct: async () => { apiCalls += 1; return {} },
  }

  for (const props of [
    { writesBlocked: true, canManageProducts: true },
    { writesBlocked: false, canManageProducts: false },
  ]) {
    const hook = await mountHook(t, useCatalogCommands, {
      api,
      ...props,
      applyOfficialEffects: () => { effectCalls += 1 },
      setRequestKey: () => { keyCalls += 1 },
      onSuccess: () => { successCalls += 1 },
      onError: () => { errorCalls += 1 },
    })
    assert.equal(await hook.current().createProduct({ name: 'X' }), null)
    assert.equal(await hook.current().updateProduct('p-1', { name: 'X' }), null)
    assert.equal(await hook.current().deleteProduct('p-1'), false)
  }

  assert.equal(apiCalls, 0)
  assert.equal(effectCalls, 0)
  assert.equal(keyCalls, 0)
  assert.equal(successCalls, 0)
  assert.equal(errorCalls, 0)
})

test('catalog command errors preserve the original error and never apply success effects', async (t) => {
  const useCatalogCommands = await loadHook()
  const notFound = Object.assign(new Error('missing'), { status: 404, code: 'PRODUCT_NOT_FOUND' })
  const unauthorized = Object.assign(new Error('expired'), { status: 401, code: 'UNAUTHORIZED' })
  const network = new TypeError('network down')
  const effects = []
  const successes = []
  const errors = []
  const keys = []

  const hook = await mountHook(t, useCatalogCommands, {
    api: {
      createProduct: async () => { throw notFound },
      updateProduct: async () => { throw unauthorized },
      deleteProduct: async () => { throw network },
    },
    writesBlocked: false,
    canManageProducts: true,
    applyOfficialEffects: (effect) => effects.push(effect),
    setRequestKey: (key) => keys.push(key),
    onSuccess: (message) => successes.push(message),
    onError: (error) => errors.push(error),
  })

  assert.equal(await hook.current().createProduct({ name: 'X' }), null)
  assert.equal(await hook.current().updateProduct('p-1', { name: 'Y' }), null)
  assert.equal(await hook.current().deleteProduct('p-1'), false)

  assert.deepEqual(errors, [notFound, unauthorized, network])
  assert.deepEqual(effects, [])
  assert.deepEqual(successes, [])
  assert.deepEqual(keys, [
    'product:create', null,
    'product:update:p-1', null,
    'product:delete:p-1', null,
  ])
})

test('Task 2 removes product HTTP and collection mutation ownership from App and legacy API', async () => {
  await loadHook()
  const app = read('src/App.jsx')
  const legacyApi = read('src/api/client.js')

  assert.match(app, /useCatalogCommands/)
  assert.doesNotMatch(app, /\b(?:createProductApi|updateProductApi|deleteProductApi)\b/)
  assert.doesNotMatch(app, /updateCollection\s*\(\s*['"]products['"]/)
  assert.match(app, /handleAddProduct/)
  assert.match(app, /handleDeleteProduct/)

  for (const name of ['createProduct', 'updateProduct', 'deleteProduct']) {
    assert.doesNotMatch(legacyApi, new RegExp(`export\\s+(?:const|function)\\s+${name}\\b`))
  }
})
