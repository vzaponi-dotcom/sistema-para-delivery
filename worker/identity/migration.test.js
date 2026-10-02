import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { createTenancyFixture } from '../test-support/tenancyDb.js'

test('0038 preserves existing actors and sessions', (t) => {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close())
  const directory = new URL('../../migrations/', import.meta.url)
  for (const file of readdirSync(directory).filter((f) => f.endsWith('.sql') && Number(f.slice(0, 4)) <= 37).sort()) sqlite.exec(readFileSync(new URL(file, directory), 'utf8'))
  sqlite.exec('PRAGMA foreign_keys = ON')
  const now = '2026-10-02T12:00:00.000Z'
  sqlite.prepare("INSERT INTO roles(id,business_id,code,name,created_at,updated_at) VALUES('old-role','amor-e-sabor','manager','Gerente',?,?)").run(now, now)
  sqlite.prepare("INSERT INTO users(id,business_id,display_name,login_normalized,role_id,created_at,updated_at) VALUES('old-user','amor-e-sabor','Old','old','old-role',?,?)").run(now, now)
  sqlite.prepare("INSERT INTO sessions(id,business_id,token_hash,created_at,expires_at,last_seen_at,user_id,device_mode) VALUES('old-session','amor-e-sabor','old-hash',?,?,?,'old-user','shared')").run(now, '2026-10-03T00:00:00.000Z', now)
  sqlite.prepare("INSERT INTO user_credentials(business_id,user_id,password_verifier,password_changed_at,created_at,updated_at) VALUES('amor-e-sabor','old-user','old-verifier',?,?,?)").run(now, now, now)
  sqlite.prepare("INSERT INTO audit_events(id,business_id,actor_user_id,actor_name,actor_type,session_id,action,result,metadata_json,occurred_at) VALUES('old-event','amor-e-sabor','old-user','Old','user','old-session','login','success','{}',?)").run(now)
  const snapshot = (table) => sqlite.prepare(`SELECT * FROM ${table}`).all()
  const before = Object.fromEntries(['sessions', 'user_credentials', 'audit_events'].map((name) => [name, snapshot(name)]))
  sqlite.exec(readFileSync(new URL('0038_global_identity_tenancy.sql', directory), 'utf8'))
  for (const [name, rows] of Object.entries(before)) assert.deepEqual(snapshot(name), rows)
  assert.equal(snapshot('users')[0].id, 'old-user')
  assert.equal(snapshot('users')[0].account_id, null)
  assert.equal(snapshot('users')[0].membership_state, 'historical')
  assert.equal(snapshot('businesses')[0].access_status, 'legacy')
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

test('global identity and membership keys reject invalid shapes', async (t) => {
  const { sqlite, accounts, businesses, members, now } = await createTenancyFixture(t)
  const timestamp = now.toISOString()
  assert.throws(() => sqlite.prepare('INSERT INTO accounts(id,email_normalized,display_name,created_at,updated_at) SELECT ?,email_normalized,display_name,created_at,updated_at FROM accounts WHERE id = ?').run('duplicate', accounts.alice), /UNIQUE/)
  assert.throws(() => sqlite.prepare("INSERT INTO users(id,business_id,display_name,login_normalized,role_id,account_id,membership_state,created_at,updated_at) VALUES('duplicate-member',?,'Alice','other',?,?, 'active',?,?)").run(businesses.A, `${businesses.A}:manager`, accounts.alice, timestamp, timestamp), /UNIQUE/)
  assert.throws(() => sqlite.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(`${businesses.B}:manager`, members.aliceA), /FOREIGN KEY/)
  assert.throws(() => sqlite.prepare('UPDATE identity_sessions SET business_id = ? WHERE account_id = ? AND scope = ?').run(businesses.B, accounts.alice, 'business'), /FOREIGN KEY/)
  assert.throws(() => sqlite.prepare("UPDATE identity_sessions SET business_id = ? WHERE scope = 'platform'").run(businesses.A), /CHECK/)
  assert.throws(() => sqlite.prepare('UPDATE account_credentials SET revision = 0 WHERE account_id = ?').run(accounts.alice), /CHECK/)
  assert.throws(() => sqlite.prepare("INSERT INTO platform_grants(account_id,capability,created_at) VALUES(?,'*',?)").run(accounts.admin, timestamp), /CHECK/)
  assert.throws(() => sqlite.prepare("UPDATE identity_session_families SET current_identity_session_id = 'identity-session-carolB' WHERE id = 'family-aliceA'").run(), /FOREIGN KEY/)
  assert.throws(() => sqlite.prepare("INSERT INTO identity_challenges(id,account_id,purpose,email_normalized,token_hash,expected_revision,created_at,expires_at) VALUES('bad-challenge',?,'activation','alice@example.test','challenge-hash',1,?,?)").run(accounts.alice, timestamp, '2026-10-03T00:00:00.000Z'), /CHECK/)
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})
