import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient, mapClientRow, updateClient } from './repositories.js'

class ClientDuplicateDb {
  constructor() {
    this.clients = new Map([
      ['c-existing', { id: 'c-existing', business_id: 'amor-e-sabor', name: 'Maria', phone: '11987654321', address: 'Centro' }],
      ['c-edit', { id: 'c-edit', business_id: 'amor-e-sabor', name: 'Ana', phone: '11911112222', address: 'Bairro' }],
    ])
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        return {
          async first() {
            if (sql.includes('FROM clients') && sql.includes('phone = ?') && sql.includes('id <> ?')) {
              const [businessId, phone, excludedId] = values
              return [...db.clients.values()].find((client) => client.business_id === businessId && client.phone === phone && client.id !== excludedId) ?? null
            }
            if (sql.includes('FROM clients') && sql.includes('phone = ?')) {
              const [businessId, phone] = values
              return [...db.clients.values()].find((client) => client.business_id === businessId && client.phone === phone) ?? null
            }
            if (sql.includes('FROM clients') && sql.includes('id = ?')) {
              const [id, businessId] = values
              const client = db.clients.get(id)
              return client?.business_id === businessId ? client : null
            }
            return null
          },
          async run() {
            if (sql.includes('INSERT INTO clients')) {
              const [id, businessId, name, phone, address, createdAt, updatedAt] = values
              db.clients.set(id, { id, business_id: businessId, name, phone, address, created_at: createdAt, updated_at: updatedAt })
            }
            if (sql.includes('UPDATE clients SET')) {
              const [name, phone, address, updatedAt, id, businessId] = values
              const client = db.clients.get(id)
              if (client?.business_id === businessId) Object.assign(client, { name, phone, address, updated_at: updatedAt })
            }
            return { success: true }
          },
        }
      },
    }
  }
}

test('stored client phones are returned using the normal Brazilian mask', () => {
  assert.equal(mapClientRow({ id: 'c1', name: 'Maria', phone: '11987654321', address: '' }).phone, '(11) 98765-4321')
})

test('createClient blocks a phone already used by another client and names the existing client', async () => {
  const db = new ClientDuplicateDb()
  await assert.rejects(
    createClient(db, 'amor-e-sabor', { name: 'Outra Maria', phone: '(11) 98765-4321', address: '' }),
    (error) => error?.status === 409 && error?.code === 'CLIENT_PHONE_EXISTS' && /Maria/.test(error?.message || ''),
  )
})

test('updateClient blocks taking another client phone but allows keeping its own phone', async () => {
  const db = new ClientDuplicateDb()
  await assert.rejects(
    updateClient(db, 'amor-e-sabor', 'c-edit', { name: 'Ana', phone: '+55 (11) 98765-4321', address: 'Bairro' }),
    (error) => error?.status === 409 && error?.code === 'CLIENT_PHONE_EXISTS',
  )

  const own = await updateClient(db, 'amor-e-sabor', 'c-edit', { name: 'Ana Souza', phone: '(11) 91111-2222', address: 'Bairro' })
  assert.equal(own.phone, '(11) 91111-2222')
})
