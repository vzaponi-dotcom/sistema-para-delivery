import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const APPROVED_REFERENCE_SHA256 = 'c25ae0712931260a49e903ad5833861e2237a230b14d5e8a2cfa90a6da43d801'

test('versions the exact approved 32 inch Kitchen TV reference', async () => {
  const reference = await readFile(new URL('../../docs/superpowers/references/kitchen-tv-32-approved-reference.jpg', import.meta.url))

  assert.equal(createHash('sha256').update(reference).digest('hex'), APPROVED_REFERENCE_SHA256)
})

test('consumes queue and arrival rules through the Orders public entry', async () => {
  const orders = await import('../domains/orders/index.js')

  assert.equal(typeof orders.buildKitchenQueueModel, 'function')
  assert.deepEqual(
    orders.buildKitchenQueueModel([], new Date('2026-09-22T12:00:00-03:00'), '', {}),
    {
      allActive: [],
      preparing: [],
      scheduled: [],
      totalVisible: 0,
      counts: { preparing: 0, scheduled: 0, late: 0, finishedToday: 0 },
    },
  )

  assert.equal(typeof orders.detectOperationalArrivals, 'function')
  const arrivals = orders.detectOperationalArrivals(undefined, [], new Date('2026-09-22T12:00:00-03:00'))
  assert.deepEqual([...arrivals.currentIds], [])
  assert.deepEqual(arrivals.newIds, [])
})
