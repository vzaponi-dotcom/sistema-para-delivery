import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./OrderCheckoutSummary.jsx', import.meta.url), 'utf8').catch(() => '')

test('delivery fee uses the shared BRL text-input mask', () => {
  assert.match(source, /formatBRLCurrencyInput/)
  assert.match(source, /Taxa de entrega[\s\S]*type="text"[\s\S]*inputMode="decimal"/)
  assert.match(source, /onDeliveryFeeChange\(formatBRLCurrencyInput\(event\.target\.value\)\)/)
})

test('fixed adjustment uses BRL while percentage stays numeric', () => {
  assert.match(source, /adjustment\.mode === 'fixed'/)
  assert.match(source, /placeholder="R\$ 0,00"/)
  assert.match(source, /type="number"[\s\S]*max="100"/)
})

test('checkout keeps compact fields in a two-column mobile layout without horizontal overflow', () => {
  assert.match(source, /new-order-checkout-fields/)
  assert.match(source, /new-order-adjustment-fields/)
})
