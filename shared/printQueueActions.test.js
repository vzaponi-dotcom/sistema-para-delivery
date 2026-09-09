import assert from 'node:assert/strict'
import test from 'node:test'
import { getPrintJobActions } from './printQueueActions.js'

const actions = (job) => getPrintJobActions(job).map((action) => action.key)

test('queued jobs expose print now and discard, but prioritized jobs only expose discard', () => {
  assert.deepEqual(actions({ status: 'pending', priority: 0 }), ['printNow', 'discard'])
  assert.deepEqual(actions({ status: 'pending', priority: 1 }), ['discard'])
})

test('processing and awaiting second copy expose no generic operational actions', () => {
  assert.deepEqual(actions({ status: 'processing' }), [])
  assert.deepEqual(actions({ status: 'awaiting_second_copy' }), [])
})

test('recoverable attention exposes retry and discard', () => {
  assert.deepEqual(actions({ status: 'requires_attention', lastError: { code: 'QZ_PRINT_FAILED' } }), ['retry', 'discard'])
})

test('finalized and cancelled attention expose force print and discard, never retry', () => {
  assert.deepEqual(actions({ status: 'requires_attention', lastError: { code: 'ORDER_FINALIZED_BEFORE_PRINT' } }), ['forcePrint', 'discard'])
  assert.deepEqual(actions({ status: 'requires_attention', lastError: { code: 'ORDER_CANCELLED_BEFORE_PRINT' } }), ['forcePrint', 'discard'])
})

test('uncertain attention and terminal jobs expose no actions', () => {
  assert.deepEqual(actions({ status: 'requires_attention', lastError: { code: 'PROCESSING_OUTCOME_UNKNOWN' } }), [])
  assert.deepEqual(actions({ status: 'printed' }), [])
  assert.deepEqual(actions({ status: 'discarded' }), [])
})
