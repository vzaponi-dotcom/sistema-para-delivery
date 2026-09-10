import assert from 'node:assert/strict'
import test from 'node:test'
import { getPrintJobActions } from './printQueueActions.js'

const actions = (job, options) => getPrintJobActions(job, options).map((action) => action.key)

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

test('eligible physically-uncertain attention exposes reprint and discard, while unknown attention remains safely discard-only', () => {
  assert.deepEqual(actions({ type: 'order', status: 'requires_attention', lastError: { code: 'PROCESSING_OUTCOME_UNKNOWN' } }), ['reprint', 'discard'])
  assert.deepEqual(actions({ type: 'order', status: 'requires_attention', lastError: { code: 'SERIAL_WRITE_UNCERTAIN' } }), ['reprint', 'discard'])
  assert.deepEqual(actions({ status: 'requires_attention', lastError: { code: 'UNRECOGNIZED_FAILURE' } }), ['discard'])
  assert.deepEqual(actions({ status: 'requires_attention', lastError: { code: 'ORDER_NOT_PRINTABLE' } }), ['discard'])
})

test('unknown physical outcome exposes only explicit manual confirmation actions', () => {
  assert.deepEqual(getPrintJobActions({
    status: 'requires_attention',
    type: 'order',
    lastError: { code: 'PRINT_OUTCOME_UNKNOWN' },
  }), [
    { key: 'confirmPrinted', label: 'A via foi impressa' },
    { key: 'confirmNotPrinted', label: 'N\u00e3o foi impressa \u2014 reenviar' },
  ])
})

test('completed and discarded order jobs expose reprint unless the official order is cancelled', () => {
  assert.deepEqual(actions({ type: 'order', status: 'printed' }), ['reprint'])
  assert.deepEqual(actions({ type: 'order', status: 'printed' }, { order: { status: 'Finalizado' } }), ['reprint'])
  assert.deepEqual(actions({ type: 'order', status: 'discarded' }), ['reprint'])
  assert.deepEqual(actions({ type: 'order', status: 'discarded' }, { order: { status: 'Finalizado' } }), ['reprint'])
  assert.deepEqual(actions({ type: 'order', status: 'printed' }, { order: { status: 'Cancelado' } }), [])
  assert.deepEqual(actions({ type: 'order', status: 'discarded' }, { order: { status: 'Cancelado' } }), [])
})
