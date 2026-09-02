import test from 'node:test'
import assert from 'node:assert/strict'

const loadIdentity = async () => {
  try {
    return await import('./clientIdentity.js')
  } catch {
    return {}
  }
}

test('client identity normalizes Brazilian phone formats and ignores empty placeholders', async () => {
  const identity = await loadIdentity()
  assert.equal(typeof identity.normalizeClientPhone, 'function')
  assert.equal(identity.normalizeClientPhone('(11) 98765-4321'), '11987654321')
  assert.equal(identity.normalizeClientPhone('+55 (11) 98765-4321'), '11987654321')
  assert.equal(identity.normalizeClientPhone('(00) 00000-0000'), '')
})

test('client identity compares names without case accents or repeated spaces', async () => {
  const identity = await loadIdentity()
  assert.equal(typeof identity.normalizeClientName, 'function')
  assert.equal(identity.normalizeClientName('  João   Silva '), 'joao silva')
  assert.equal(identity.normalizeClientName('JOAO SILVA'), 'joao silva')
})

test('duplicate lookup distinguishes name warning from blocking phone match and excludes the edited client', async () => {
  const identity = await loadIdentity()
  assert.equal(typeof identity.findClientDuplicates, 'function')
  const clients = [
    { id: 'c1', name: 'João Silva', phone: '(11) 98765-4321' },
    { id: 'c2', name: 'Maria', phone: '(11) 91234-5678' },
  ]

  const duplicate = identity.findClientDuplicates(clients, { name: 'joao silva', phone: '+55 11 91234-5678' })
  assert.equal(duplicate.name?.id, 'c1')
  assert.equal(duplicate.phone?.id, 'c2')

  const editing = identity.findClientDuplicates(clients, clients[0], 'c1')
  assert.equal(editing.name, null)
  assert.equal(editing.phone, null)
})
