import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')

test('local orders offer name table or registered client identity modes', () => {
  assert.match(source, /guest_name/)
  assert.match(source, /table/)
  assert.match(source, /registered_client/)
  assert.match(source, /Nome/)
  assert.match(source, /Mesa/)
  assert.match(source, /Cliente cadastrado/)
})

test('registered client remains mandatory outside local orders', () => {
  assert.match(source, /type === 'Local'/)
  assert.match(source, /customerIdentity/)
  assert.match(source, /canSubmit/)
})
