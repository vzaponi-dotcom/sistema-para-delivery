import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./CancelOrderDialog.jsx', import.meta.url), 'utf8').catch(() => '')

test('cancellation dialog requires a reason and supports the approved reason set', () => {
  assert.match(source, /client_changed_mind/)
  assert.match(source, /duplicate_order/)
  assert.match(source, /product_unavailable/)
  assert.match(source, /entry_error/)
  assert.match(source, /other/)
  assert.match(source, /Selecione um motivo/)
})

test('other reason requires descriptive note', () => {
  assert.match(source, /reason === 'other'/)
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
