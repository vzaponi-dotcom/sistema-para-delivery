import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const migrationsUrl = new URL('../migrations/', import.meta.url)

const loadClientPhoneMigration = () => {
  const file = readdirSync(migrationsUrl).find((name) => name.includes('client_phone_uniqueness'))
  assert.ok(file, 'client phone uniqueness migration must exist')
  return readFileSync(new URL(file, migrationsUrl), 'utf8')
}

test('database migration prevents duplicate client phones on insert and phone changes', () => {
  const migration = loadClientPhoneMigration()

  assert.match(migration, /CREATE TRIGGER clients_phone_unique_insert/)
  assert.match(migration, /CREATE TRIGGER clients_phone_unique_update/)
  assert.match(migration, /RAISE\(ABORT, 'CLIENT_PHONE_DUPLICATE'\)/)
  assert.match(migration, /UPDATE clients\s+SET phone/s)
})
