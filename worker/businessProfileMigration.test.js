import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { createSettingsDb } from './test-support/settingsDb.js'

const migrations = new URL('../migrations/', import.meta.url)

const migrationFiles = () => readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
const readMigration = (name) => readFileSync(new URL(name, migrations), 'utf8')

const expectedColumns = [
  'business_id',
  'revision',
  'phone',
  'address_line',
  'address_number',
  'address_complement',
  'neighborhood',
  'city',
  'state',
  'postal_code',
  'logo_object_key',
  'logo_content_type',
  'logo_sha256',
  'logo_size_bytes',
  'logo_updated_at',
  'created_at',
  'updated_at',
]

test('0030 business profiles installs cleanly, upgrades 0029 and backfills every existing business without renaming it', () => {
  const files = migrationFiles()
  assert.equal(files.at(-1), '0030_business_profiles.sql')

  const clean = createSettingsDb()
  try {
    const table = clean.sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'business_profiles'").get()
    assert.ok(table?.sql)

    const columns = clean.sqlite.prepare('PRAGMA table_info(business_profiles)').all().map(({ name }) => name)
    assert.deepEqual(columns, expectedColumns)

    const fk = clean.sqlite.prepare('PRAGMA foreign_key_list(business_profiles)').all()
    assert.ok(fk.some((row) => row.table === 'businesses' && row.from === 'business_id' && row.to === 'id' && row.on_delete === 'CASCADE'))

    const profile = clean.sqlite.prepare("SELECT * FROM business_profiles WHERE business_id = 'amor-e-sabor'").get()
    assert.equal(profile.revision, 1)
    assert.equal(profile.phone, '')
    assert.equal(profile.address_line, '')
    assert.equal(profile.address_number, '')
    assert.equal(profile.address_complement, '')
    assert.equal(profile.neighborhood, '')
    assert.equal(profile.city, '')
    assert.equal(profile.state, '')
    assert.equal(profile.postal_code, '')
    assert.equal(profile.logo_object_key, null)
    assert.equal(profile.logo_content_type, null)
    assert.equal(profile.logo_sha256, null)
    assert.equal(profile.logo_size_bytes, null)
    assert.equal(profile.logo_updated_at, null)

    const business = clean.sqlite.prepare("SELECT id, slug, name FROM businesses WHERE id = 'amor-e-sabor'").get()
    assert.deepEqual(business, { id: 'amor-e-sabor', slug: 'amor-e-sabor', name: 'Amor & Sabor' })
    assert.deepEqual(clean.sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  } finally {
    clean.close()
  }

  const sqlite = new DatabaseSync(':memory:')
  try {
    for (const file of files.slice(0, -1)) sqlite.exec(readMigration(file))
    sqlite.exec("INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES ('upgrade', 'upgrade', 'Upgrade Name', '2026-09-23T00:00:00.000Z', '2026-09-23T00:00:00.000Z')")
    sqlite.exec(readMigration(files.at(-1)))

    const upgradedBusiness = sqlite.prepare("SELECT id, slug, name FROM businesses WHERE id = 'upgrade'").get()
    assert.deepEqual(upgradedBusiness, { id: 'upgrade', slug: 'upgrade', name: 'Upgrade Name' })

    const upgradedProfile = sqlite.prepare("SELECT business_id, revision, phone, address_line, logo_object_key FROM business_profiles WHERE business_id = 'upgrade'").get()
    assert.deepEqual(upgradedProfile, {
      business_id: 'upgrade',
      revision: 1,
      phone: '',
      address_line: '',
      logo_object_key: null,
    })

    const businessCount = sqlite.prepare('SELECT count(*) AS n FROM businesses').get().n
    const profileCount = sqlite.prepare('SELECT count(*) AS n FROM business_profiles').get().n
    assert.equal(profileCount, businessCount)
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  } finally {
    sqlite.close()
  }
})
