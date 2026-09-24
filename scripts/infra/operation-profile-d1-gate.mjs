import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'

const migrations = new URL('../../migrations/', import.meta.url)
const files = readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
const latest = '0030_business_profiles.sql'

const readMigration = (name) => readFileSync(new URL(name, migrations), 'utf8')
const apply = (sqlite, names) => {
  for (const name of names) sqlite.exec(readMigration(name))
  sqlite.exec('PRAGMA foreign_keys = ON')
}

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

const assertSchema = (sqlite) => {
  const table = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'business_profiles'").get()
  assert.ok(table?.sql, 'business_profiles table is missing')
  assert.deepEqual(sqlite.prepare('PRAGMA table_info(business_profiles)').all().map(({ name }) => name), expectedColumns)

  const fk = sqlite.prepare('PRAGMA foreign_key_list(business_profiles)').all()
  assert.ok(
    fk.some((row) => row.table === 'businesses' && row.from === 'business_id' && row.to === 'id' && row.on_delete === 'CASCADE'),
    'business_profiles.business_id must cascade to businesses.id',
  )
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
}

let result
try {
  assert.equal(files.at(-1), latest, '0030 must be the latest migration')

  const clean = new DatabaseSync(':memory:')
  try {
    apply(clean, files)
    assertSchema(clean)
    const business = { ...clean.prepare("SELECT id, slug, name FROM businesses WHERE id = 'amor-e-sabor'").get() }
    assert.deepEqual(business, { id: 'amor-e-sabor', slug: 'amor-e-sabor', name: 'Amor & Sabor' })

    const profile = clean.prepare("SELECT * FROM business_profiles WHERE business_id = 'amor-e-sabor'").get()
    assert.equal(profile.revision, 1)
    for (const field of ['phone', 'address_line', 'address_number', 'address_complement', 'neighborhood', 'city', 'state', 'postal_code']) {
      assert.equal(profile[field], '', `${field} must backfill empty`)
    }
    for (const field of ['logo_object_key', 'logo_content_type', 'logo_sha256', 'logo_size_bytes', 'logo_updated_at']) {
      assert.equal(profile[field], null, `${field} must backfill null`)
    }
  } finally {
    clean.close()
  }

  const upgrade = new DatabaseSync(':memory:')
  try {
    apply(upgrade, files.slice(0, -1))
    upgrade.exec("INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES ('upgrade', 'upgrade', 'Upgrade Name', '2026-09-23T00:00:00.000Z', '2026-09-23T00:00:00.000Z')")
    const before = upgrade.prepare('SELECT id, slug, name, created_at, updated_at FROM businesses ORDER BY id').all()

    upgrade.exec(readMigration(latest))
    upgrade.exec('PRAGMA foreign_keys = ON')
    assertSchema(upgrade)

    const after = upgrade.prepare('SELECT id, slug, name, created_at, updated_at FROM businesses ORDER BY id').all()
    assert.deepEqual(after, before, '0030 must not mutate business identity rows')

    const businessCount = upgrade.prepare('SELECT count(*) AS n FROM businesses').get().n
    const profileCount = upgrade.prepare('SELECT count(*) AS n FROM business_profiles').get().n
    assert.equal(profileCount, businessCount, '0030 must backfill every existing business')

    const upgraded = { ...upgrade.prepare("SELECT business_id, revision, phone, address_line, logo_object_key FROM business_profiles WHERE business_id = 'upgrade'").get() }
    assert.deepEqual(upgraded, {
      business_id: 'upgrade',
      revision: 1,
      phone: '',
      address_line: '',
      logo_object_key: null,
    })

    result = {
      ok: true,
      migration: latest,
      migrations: files.length,
      cleanInstall: true,
      upgradeFrom0029: true,
      backfilledBusinesses: businessCount,
      foreignKeys: true,
    }
  } finally {
    upgrade.close()
  }
} catch (error) {
  result = { ok: false, migration: latest, error: error.message }
  process.exitCode = 1
}

process.stdout.write(`${JSON.stringify(result)}\n`)
