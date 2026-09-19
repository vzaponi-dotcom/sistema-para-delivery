import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatClientPhone,
  normalizeClientPhone,
} from './clientIdentity.js'

test('client identity normalizes Brazilian phone formats and ignores empty placeholders', () => {
  assert.equal(normalizeClientPhone('(11) 98765-4321'), '11987654321')
  assert.equal(normalizeClientPhone('+55 (11) 98765-4321'), '11987654321')
  assert.equal(normalizeClientPhone('(00) 00000-0000'), '')
})

test('client identity formats normalized Brazilian phones for the shared Worker/frontend contract', () => {
  assert.equal(formatClientPhone('11987654321'), '(11) 98765-4321')
  assert.equal(formatClientPhone(''), '')
})
