import test from 'node:test'
import assert from 'node:assert/strict'

const loadFormatting = async () => {
  try {
    return await import('./formFormatting.js')
  } catch {
    return {}
  }
}

test('phone formatter applies the same Brazilian mobile mask used by client registration', async () => {
  const formatting = await loadFormatting()
  assert.equal(typeof formatting.formatPhone, 'function')
  assert.equal(formatting.formatPhone('11987654321'), '(11) 98765-4321')
  assert.equal(formatting.formatPhone('(11) 98765-4321'), '(11) 98765-4321')
})

test('BRL input formatter keeps a visible currency mask while typing', async () => {
  const formatting = await loadFormatting()
  assert.equal(typeof formatting.formatBRLCurrencyInput, 'function')
  assert.equal(formatting.formatBRLCurrencyInput('1234'), 'R$ 12,34')
  assert.equal(formatting.formatBRLCurrencyInput('R$ 32,00'), 'R$ 32,00')
})

test('BRL helpers convert product numbers to and from the formatted input', async () => {
  const formatting = await loadFormatting()
  assert.equal(typeof formatting.formatBRLCurrencyValue, 'function')
  assert.equal(typeof formatting.parseBRLCurrencyInput, 'function')
  assert.equal(formatting.formatBRLCurrencyValue(32), 'R$ 32,00')
  assert.equal(formatting.parseBRLCurrencyInput('R$ 1.234,56'), 1234.56)
})
