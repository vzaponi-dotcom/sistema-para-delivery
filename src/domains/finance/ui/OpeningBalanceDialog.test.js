import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = async () => readFile(new URL('./OpeningBalanceDialog.jsx', import.meta.url), 'utf8')

test('opening balance dialog supports signed BRL, opening date and reviewed recalculation', async () => {
  const source = await readSource()
  assert.match(source, /formatSignedBRLCurrencyInput/)
  assert.match(source, /parseSignedBRLCurrencyInput/)
  assert.match(source, /openingDate/)
  assert.match(source, /saldo atual.*recalcul|recalcul.*saldo atual/is)
  assert.match(source, /ConfirmationDialog/)
  assert.match(source, /max=\{today\}/)
})

test('editing opening balance review shows current and new values', async () => {
  const source = await readSource()
  assert.match(source, /settings\?\.openingBalance/)
  assert.match(source, /settings\?\.openingDate/)
  assert.match(source, /Valor atual|Saldo atual/i)
  assert.match(source, /Novo valor|Novo saldo/i)
})
