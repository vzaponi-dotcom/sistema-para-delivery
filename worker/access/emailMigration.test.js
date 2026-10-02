import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { createSettingsDb } from '../test-support/settingsDb.js'

const BUSINESS = 'amor-e-sabor'
const NOW = '2026-10-02T12:00:00.000Z'
const directory = new URL('../../migrations/', import.meta.url)
const migration = new URL('0037_email_access_recovery.sql', directory)
const role = (sqlite, business, id) => sqlite.prepare('INSERT INTO roles(id,business_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,business,id,id,NOW,NOW)
const user = (sqlite, business, id, roleId) => sqlite.prepare('INSERT INTO users(id,business_id,display_name,login_normalized,role_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id,business,id,`${id}@example.test`,roleId,NOW,NOW)

test('email migration preserves existing account state, sessions, orders and audit references', t => {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  for (const file of readdirSync(directory).filter(name => name.endsWith('.sql') && Number(name.slice(0,4)) < 37).sort()) sqlite.exec(readFileSync(new URL(file, directory),'utf8'))
  role(sqlite,BUSINESS,'manager')
  user(sqlite,BUSINESS,'old-manager','manager')
  sqlite.prepare('INSERT INTO user_credentials(business_id,user_id,password_verifier,password_changed_at,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(BUSINESS,'old-manager','existing-verifier',NOW,NOW,NOW)
  sqlite.prepare('INSERT INTO sessions(id,business_id,token_hash,user_id,device_mode,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?)').run('session',BUSINESS,'hash','old-manager','personal',NOW,'2026-10-09T12:00:00.000Z',NOW)
  sqlite.prepare('INSERT INTO orders(id,business_id,client_name_snapshot,type,order_date,status,subtotal_cents,total_cents,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run('order',BUSINESS,'Synthetic','Retirada','2026-10-02','Pendente',100,100,NOW)
  sqlite.prepare('INSERT INTO audit_events(id,business_id,occurred_at,actor_type,actor_user_id,actor_name,session_id,action,result) VALUES(?,?,?,?,?,?,?,?,?)').run('audit',BUSINESS,NOW,'user','old-manager','Synthetic','session','orders.create','success')
  const snapshots = Object.fromEntries(['users','user_credentials','sessions','orders','audit_events','business_auth_state'].map(table => [table, sqlite.prepare(`SELECT * FROM ${table}`).all().map(row => ({...row}))]))
  sqlite.exec(readFileSync(migration,'utf8'))
  for (const [table, rows] of Object.entries(snapshots)) {
    const after = sqlite.prepare(`SELECT * FROM ${table}`).all().map(row => {
      const copy = {...row}; delete copy.email_verified_at; delete copy.revision; return copy
    })
    assert.deepEqual(after,rows,table)
  }
  assert.equal(sqlite.prepare('SELECT email_verified_at FROM users WHERE id=?').get('old-manager').email_verified_at,null)
  assert.equal(sqlite.prepare('SELECT revision,version FROM user_credentials').get().revision,1)
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[])
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM auth_email_staging_bootstraps').get().n,0)
})

test('email challenges reject cross-business references, duplicate hashes and invalid state', t => {
  const {sqlite,close} = createSettingsDb(); t.after(close)
  sqlite.prepare('INSERT INTO businesses(id,slug,name,created_at,updated_at) VALUES(?,?,?,?,?)').run('other','other','Other',NOW,NOW)
  role(sqlite,BUSINESS,'r1'); role(sqlite,'other','r2')
  user(sqlite,BUSINESS,'u1','r1'); user(sqlite,'other','u2','r2')
  const insert = sqlite.prepare('INSERT INTO auth_email_challenges(id,business_id,user_id,purpose,email,token_hash,expected_revision,issued_by_user_id,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
  insert.run('valid',BUSINESS,'u1','activation','u1@example.test','hash',null,null,NOW,'2026-10-03T12:00:00.000Z')
  assert.throws(() => insert.run('foreign',BUSINESS,'u2','activation','u2@example.test','foreign',null,null,NOW,NOW),/FOREIGN KEY/)
  assert.throws(() => insert.run('foreign-issuer',BUSINESS,'u1','activation','u1@example.test','issuer',null,'u2',NOW,NOW),/FOREIGN KEY/)
  assert.throws(() => insert.run('duplicate',BUSINESS,'u1','activation','u1@example.test','hash',null,null,NOW,NOW),/UNIQUE/)
  assert.throws(() => insert.run('purpose',BUSINESS,'u1','login','u1@example.test','purpose',null,null,NOW,NOW),/CHECK/)
  assert.throws(() => insert.run('revision',BUSINESS,'u1','password_reset','u1@example.test','revision',0,null,NOW,NOW),/CHECK/)
  assert.throws(() => sqlite.exec("INSERT INTO auth_email_tx_assertions(id,ok) VALUES('invalid',0)"),/CHECK/)
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[])
})
