import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./CancelOrderDialog.jsx', import.meta.url), 'utf8').catch(() => '')

test('cancellation dialog requires a reason and consumes the effective approved reason set', () => {
  assert.match(source, /reasonOptions/)
  assert.match(source, /visibleReasonOptions/)
  assert.doesNotMatch(source, /client_changed_mind/)
  assert.match(source, /Selecione um motivo/)
})

test('descriptive note follows effective requiresNote metadata', () => {
  assert.match(source, /requiresNote/)
  assert.match(source, /Descreva o motivo/)
})

test('paid flow asks about refund and requires method only for immediate refund', () => {
  assert.match(source, /paymentStatus === 'Pago'/)
  assert.match(source, /O valor já foi devolvido ao cliente\?/)
  assert.match(source, /refundNow/)
  assert.match(source, /refundMethod/)
  assert.match(source, /paymentMethod/)
})

test('unpaid cancellation does not render the refund decision block', () => {
  assert.match(source, /isPaid &&/)
})

test('cancellation uses a second review step before invoking the write callback', () => {
  assert.match(source, /reviewPayload/)
  assert.match(source, /Revisar cancelamento/)
  assert.match(source, /Confirmar cancelamento definitivamente/)
  assert.match(source, /handleFinalConfirm/)
  assert.match(source, /onConfirm\?\.\(reviewPayload\)/)
})
