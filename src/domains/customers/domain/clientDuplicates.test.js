import test from 'node:test'
import assert from 'node:assert/strict'

import {
  findClientDuplicates,
  normalizeClientName,
} from './clientDuplicates.js'
import {
  formatClientPhone,
  normalizeClientPhone,
} from '../../../../shared/clientIdentity.js'

test('shared client identity keeps the cross-runtime Brazilian phone primitives', () => {
  assert.equal(normalizeClientPhone('(11) 98765-4321'), '11987654321')
  assert.equal(normalizeClientPhone('+55 (11) 98765-4321'), '11987654321')
  assert.equal(normalizeClientPhone('(00) 00000-0000'), '')
  assert.equal(formatClientPhone('11987654321'), '(11) 98765-4321')
})

test('Customers normalizes names without case, accents or repeated spaces', () => {
  assert.equal(normalizeClientName('  João   Silva '), 'joao silva')
  assert.equal(normalizeClientName('JOAO SILVA'), 'joao silva')
})

test('Customers duplicate lookup distinguishes name warning from blocking phone match', () => {
  const clients = [
    { id: 'c1', name: 'João Silva', phone: '(11) 98765-4321' },
    { id: 'c2', name: 'Maria', phone: '(11) 91234-5678' },
  ]

  const duplicate = findClientDuplicates(clients, {
    name: 'joao silva',
    phone: '+55 11 91234-5678',
  })

  assert.equal(duplicate.name?.id, 'c1')
  assert.equal(duplicate.phone?.id, 'c2')
})

test('Customers duplicate lookup ignores empty phone and excludes the edited client', () => {
  const clients = [
    { id: 'c1', name: 'João Silva', phone: '(11) 98765-4321' },
    { id: 'c2', name: 'Maria', phone: '' },
  ]

  const editing = findClientDuplicates(clients, clients[0], 'c1')
  assert.equal(editing.name, null)
  assert.equal(editing.phone, null)

  const emptyPhone = findClientDuplicates(clients, { name: 'Outra', phone: '(00) 00000-0000' })
  assert.equal(emptyPhone.phone, null)
})
