import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = async () => readFile(new URL('./MovementDialog.jsx', import.meta.url), 'utf8')

test('movement dialog uses finance categories, BRL mask, date, payment method and review confirmation', async () => {
  const source = await readSource()
  assert.match(source, /getManualMovementCategoryOptions/)
  assert.match(source, /formatBRLCurrencyInput/)
  assert.match(source, /parseBRLCurrencyInput/)
  assert.match(source, /paymentMethod/)
  assert.match(source, /movementDate/)
  assert.match(source, /Revisar movimento|Revisar alterações/)
  assert.match(source, /ConfirmationDialog/)
  assert.match(source, /max=\{today\}/)
})

test('new movement defaults are neutral and changing type clears an incompatible category', async () => {
  const source = await readSource()
  assert.match(source, /type:\s*movement\?\.type\s*\|\|\s*'entrada'/)
  assert.match(source, /category:\s*movement\?\.source\s*===\s*'manual'\s*\?\s*movement\.category\s*\|\|\s*''\s*:\s*''/)
  assert.match(source, /paymentMethod:\s*movement\?\.paymentMethod\s*\|\|\s*''/)
  assert.match(source, /formatBRLCurrencyValue\(movement\?\.value\s*\?\?\s*0\)/)
  assert.match(source, /isManualMovementCategory/)
  assert.match(source, /category:\s*isManualMovementCategory\(nextType, current\.category\)\s*\?\s*current\.category\s*:\s*''/s)
})
