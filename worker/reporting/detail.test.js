import test from 'node:test'
import assert from 'node:assert/strict'

test('detail keeps server pagination and totals separate', async () => {
  const { createReportingService } = await import('./service.js')
  const repository = { async listDetail() { return { total: 3, items: [{ id: 'two' }] } } }
  const result = await createReportingService(repository).detail('business-a', { page: 2, pageSize: 1 })
  assert.deepEqual(result.data, { total: 3, page: 2, pageSize: 1, totalPages: 3, items: [{ id: 'two' }] })
})
