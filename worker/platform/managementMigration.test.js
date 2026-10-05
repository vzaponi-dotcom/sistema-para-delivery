import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'

const directory = new URL('../../migrations/', import.meta.url)
const files = readdirSync(directory).filter(name => name.endsWith('.sql')).sort()
const apply = (db, names) => {
  for (const name of names) {
    if (Number(name.slice(0, 4)) < 24) db.exec(readFileSync(new URL(name, directory), 'utf8'))
    else { db.exec('BEGIN'); try { db.exec(readFileSync(new URL(name, directory), 'utf8')); db.exec('COMMIT') } catch (error) { db.exec('ROLLBACK'); throw error } }
  }
  db.exec('PRAGMA foreign_keys=ON')
}

test('clean install keeps company activation independent from administrative lifecycle', () => {
  const db = new DatabaseSync(':memory:')
  try {
    apply(db, files)
    const business = db.prepare("SELECT * FROM businesses WHERE id='amor-e-sabor'").get()
    assert.equal(business.lifecycle_status, 'enabled')
    assert.equal(business.management_revision, 0)
    assert.equal(business.access_status, 'legacy')
    assert.throws(() => db.prepare("UPDATE businesses SET lifecycle_status='unknown'").run(), /CHECK/)
    assert.throws(() => db.prepare('UPDATE businesses SET management_revision=-1').run(), /CHECK/)
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
  } finally { db.close() }
})

test('upgrade preserves companies and existing grants and only extends bootstrapped administrators', () => {
  const db = new DatabaseSync(':memory:')
  try {
    apply(db, files.filter(name => Number(name.slice(0, 4)) <= 40))
    const at = '2026-10-05T12:00:00.000Z'
    for (const id of ['root','delegated']) {
      db.prepare('INSERT INTO accounts(id,email_normalized,display_name,created_at,updated_at) VALUES(?,?,?,?,?)').run(id, `${id}@example.test`, id, at, at)
      for (const capability of ['platform.businesses.view','platform.businesses.create','platform.invitations.resend']) db.prepare('INSERT INTO platform_grants VALUES(?,?,?)').run(id, capability, at)
    }
    db.prepare("INSERT INTO platform_bootstraps(environment,account_id,created_at) VALUES('staging','root',?)").run(at)
    db.prepare("INSERT INTO platform_audit_events(id,account_id,business_id,action,result,created_at) VALUES('old-event','root','amor-e-sabor','business.created','success',?)").run(at)
    const before = {...db.prepare("SELECT * FROM businesses WHERE id='amor-e-sabor'").get()}
    apply(db, files.filter(name => Number(name.slice(0, 4)) > 40))
    const after = {...db.prepare("SELECT * FROM businesses WHERE id='amor-e-sabor'").get()}
    assert.equal(after.lifecycle_status, 'enabled')
    assert.equal(after.management_revision, 0)
    delete after.lifecycle_status; delete after.management_revision
    assert.deepEqual(after, before)
    assert.equal(db.prepare("SELECT count(*) n FROM platform_grants WHERE account_id='root'").get().n, 8)
    assert.equal(db.prepare("SELECT count(*) n FROM platform_grants WHERE account_id='delegated'").get().n, 3)
    const old = db.prepare("SELECT * FROM platform_audit_events WHERE id='old-event'").get()
    assert.equal(old.reason, null)
    assert.deepEqual(JSON.parse(old.metadata_json), {})
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
  } finally { db.close() }
})
