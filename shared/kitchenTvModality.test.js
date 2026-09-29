import assert from 'node:assert/strict'
import test from 'node:test'

const modalityPromise = import('./kitchenTvModality.js').catch(() => ({}))

test('Kitchen TV modality contract maps user filters to canonical order types', async () => {
  const {
    KITCHEN_TV_MODALITIES,
    filterKitchenTvOrders,
    countKitchenTvModalities,
    normalizeKitchenTvModality,
  } = await modalityPromise
  assert.deepEqual(KITCHEN_TV_MODALITIES, ['all', 'delivery', 'pickup', 'table'])
  assert.equal(normalizeKitchenTvModality('table'), 'table')
  assert.equal(normalizeKitchenTvModality('invalid'), 'all')

  const orders = [
    { id: 'd1', type: 'Entrega' },
    { id: 'd2', type: 'Entrega' },
    { id: 'p1', type: 'Retirada' },
    { id: 't1', type: 'Local' },
  ]
  assert.deepEqual(filterKitchenTvOrders(orders, 'pickup').map(({ id }) => id), ['p1'])
  assert.deepEqual(filterKitchenTvOrders(orders, 'table').map(({ id }) => id), ['t1'])
  assert.deepEqual(countKitchenTvModalities(orders), {
    all: 4,
    delivery: 2,
    pickup: 1,
    table: 1,
  })
})
