import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('Finance renders receipt-grouped order payments with one visible total and payment breakdown', async () => {
  const source = await read('./Finance.jsx')

  assert.match(source, /groupFinanceMovementsForDisplay/)
  assert.match(source, /displayMovements\.length/)
  assert.match(source, /paymentBreakdown/)
  assert.match(source, /movement-payment-breakdown/)
  assert.match(source, /formas/)
})

test('Finance mobile styles keep the receipt breakdown readable without duplicating rows', async () => {
  const css = await read('./finance-mobile.css')

  assert.match(css, /\.movement-payment-breakdown\s*\{/)
  assert.match(css, /flex-wrap:\s*wrap/)
  assert.match(css, /\.movement-payment-part\s*\{/)
})
