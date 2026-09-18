import assert from 'node:assert/strict'
import test from 'node:test'
import { createNewOrderDraftController } from './newOrderDraft.js'

test('draft owns generation, idempotency, dirtiness, and stale invalidation', () => {
  const ids = ['key-1', 'key-2']
  const controller = createNewOrderDraftController({ randomUUID: () => ids.shift() })
  assert.deepEqual(controller.snapshot(), { context: null, dirty: false, renderKey: null })
  controller.open({ returnDestination: 'orders' })
  controller.setDirty(true)
  const first = controller.beginSubmit()
  assert.equal(first.idempotencyKey, 'key-1')
  assert.equal(controller.isCurrent(first), true)
  controller.open({ returnDestination: 'comandas', tableId: 't-1', expectedTableTabId: 'tab-1' })
  assert.equal(controller.isCurrent(first), false)
  assert.equal(controller.snapshot().dirty, false)
  assert.equal(controller.beginSubmit().idempotencyKey, 'key-2')
})

test('complete clears only the current draft', () => {
  const controller = createNewOrderDraftController({ randomUUID: () => 'key' })
  controller.open({ returnDestination: 'orders' })
  const token = controller.beginSubmit()
  assert.equal(controller.complete(token), true)
  assert.equal(controller.isCurrent(token), false)
  assert.equal(controller.snapshot().context, null)
})
