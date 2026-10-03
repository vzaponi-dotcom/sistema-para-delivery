import { createSettingsDb } from './test-support/settingsDb.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient, mapClientRow, updateClient } from './repositories.js'

const setup = (t) => {
  const fixture=createSettingsDb();t.after(fixture.close)
  for(const [id,name,phone] of [['c-existing','Maria','11987654321'],['c-edit','Ana','11911112222']])
    fixture.sqlite.prepare("INSERT INTO clients(id,business_id,name,phone,address,created_at,updated_at) VALUES(?,'amor-e-sabor',?,?,'Bairro','2026-09-30','2026-09-30')").run(id,name,phone)
  return fixture.db
}

test('stored client phones are returned using the normal Brazilian mask', () => {
  assert.equal(mapClientRow({ id: 'c1', name: 'Maria', phone: '11987654321', address: '' }).phone, '(11) 98765-4321')
})

test('createClient blocks a phone already used by another client and names the existing client', async t => {
  const db = setup(t)
  await assert.rejects(
    createClient(db, 'amor-e-sabor', { name: 'Outra Maria', phone: '(11) 98765-4321', address: '' }),
    (error) => error?.status === 409 && error?.code === 'CLIENT_PHONE_EXISTS' && /Maria/.test(error?.message || ''),
  )
})

test('updateClient blocks taking another client phone but allows keeping its own phone', async t => {
  const db = setup(t)
  await assert.rejects(
    updateClient(db, 'amor-e-sabor', 'c-edit', { name: 'Ana', phone: '+55 (11) 98765-4321', address: 'Bairro' }),
    (error) => error?.status === 409 && error?.code === 'CLIENT_PHONE_EXISTS',
  )

  const own = await updateClient(db, 'amor-e-sabor', 'c-edit', { name: 'Ana Souza', phone: '(11) 91111-2222', address: 'Bairro' })
  assert.equal(own.phone, '(11) 91111-2222')
})
