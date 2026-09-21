import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePrintQueueSummary } from './printQueueSummary.js'

test('QA regression: normalizes backend awaitingSecondCopy to the UI waitingSecondCopy counter', () => {
  assert.deepEqual(normalizePrintQueueSummary({
    pending: 3,
    awaitingConfirmation: 0,
    awaitingSecondCopy: 0,
    attention: 8,
  }), {
    pending: 3,
    awaitingConfirmation: 0,
    waitingSecondCopy: 0,
    attention: 8,
  })
})
