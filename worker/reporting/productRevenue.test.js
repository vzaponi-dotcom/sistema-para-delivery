import test from 'node:test'
import assert from 'node:assert/strict'

test('allocates merchandise revenue in deterministic integer cents without delivery fee', async () => {
  const { allocateMerchandiseRevenue } = await import('./productRevenue.js')
  const result = allocateMerchandiseRevenue({ totalCents: 1001, deliveryFeeCents: 100, items: [
    { id: 'a', quantity: 1, unitPriceCents: 500 }, { id: 'b', quantity: 1, unitPriceCents: 500 },
  ] })
  assert.deepEqual(result, [{ id: 'a', revenueCents: 451 }, { id: 'b', revenueCents: 450 }])
  assert.equal(result.reduce((sum, item) => sum + item.revenueCents, 0), 901)
})
