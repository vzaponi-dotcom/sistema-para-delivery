import test from 'node:test'
import assert from 'node:assert/strict'

const pagingPromise = import('./kitchenDisplayPaging.js').catch(() => ({}))

test('bootstrap always starts on page one while baselining the current control revision', async () => {
  const paging = await pagingPromise
  assert.equal(typeof paging.createKitchenDisplayPagingState, 'function')
  assert.deepEqual(
    paging.createKitchenDisplayPagingState({ revision: 7, requestedPage: 3 }),
    { currentPage: 1, appliedRevision: 7 },
  )
})

test('only a newer revision changes page and requests are clamped to available pages', async () => {
  const paging = await pagingPromise
  const initial = { currentPage: 1, appliedRevision: 7 }

  assert.deepEqual(
    paging.reconcileKitchenDisplayPaging(initial, {
      control: { revision: 7, requestedPage: 3 },
      pageCount: 4,
      hasArrivals: false,
    }),
    initial,
  )

  assert.deepEqual(
    paging.reconcileKitchenDisplayPaging(initial, {
      control: { revision: 8, requestedPage: 99 },
      pageCount: 4,
      hasArrivals: false,
    }),
    { currentPage: 4, appliedRevision: 8 },
  )
})

test('queue shrink clamps current page without manufacturing a new revision', async () => {
  const paging = await pagingPromise
  assert.deepEqual(
    paging.reconcileKitchenDisplayPaging(
      { currentPage: 4, appliedRevision: 8 },
      {
        control: { revision: 8, requestedPage: 4 },
        pageCount: 2,
        hasArrivals: false,
      },
    ),
    { currentPage: 2, appliedRevision: 8 },
  )
})

test('new arrival wins over a simultaneous or stale page command and consumes that revision', async () => {
  const paging = await pagingPromise
  assert.deepEqual(
    paging.reconcileKitchenDisplayPaging(
      { currentPage: 2, appliedRevision: 8 },
      {
        control: { revision: 9, requestedPage: 3 },
        pageCount: 3,
        hasArrivals: true,
      },
    ),
    { currentPage: 1, appliedRevision: 9 },
  )

  assert.deepEqual(
    paging.reconcileKitchenDisplayPaging(
      { currentPage: 1, appliedRevision: 9 },
      {
        control: { revision: 9, requestedPage: 3 },
        pageCount: 3,
        hasArrivals: false,
      },
    ),
    { currentPage: 1, appliedRevision: 9 },
  )
})
