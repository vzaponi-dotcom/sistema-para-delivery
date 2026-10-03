import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { createSettingsDb } from '../test-support/settingsDb.js'

const BUSINESS = 'amor-e-sabor'
const NOW = '2026-09-30T12:00:00.000Z'
const migrations = new URL('../../migrations/', import.meta.url)
const setup = (t) => { const fixture = createSettingsDb(); t.after(fixture.close); return fixture }
const insertRole = (sqlite, id, businessId) => sqlite.prepare('INSERT INTO roles (id, business_id, code, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, businessId, id, id, NOW, NOW)
const insertUser = (sqlite, id, businessId, login, roleId) => sqlite.prepare('INSERT INTO users (id, business_id, display_name, login_normalized, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, businessId, id, login, roleId, NOW, NOW)
const seedTenants = (sqlite) => {
  sqlite.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('other', 'other', 'Other', NOW, NOW)
  insertRole(sqlite, 'r1', BUSINESS)
  insertRole(sqlite, 'r2', 'other')
  insertUser(sqlite, 'u1', BUSINESS, 'ana', 'r1')
  insertUser(sqlite, 'u2', 'other', 'ana', 'r2')
}

test('0035 installs access tables and upgrades existing businesses and sessions without cutover or actor backfill', (t) => {
  const files = readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
  const index = files.indexOf('0035_users_profiles_access.sql')
  assert.ok(index > 0, 'access migration exists after the integrated baseline')
  assert.match(files[index - 1], /^0034_/)
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  for (const file of files.slice(0, index)) sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
  sqlite.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('upgrade', 'upgrade', 'Upgrade', NOW, NOW)
  sqlite.prepare('INSERT INTO sessions (id, business_id, token_hash, created_at, expires_at, last_seen_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('legacy', BUSINESS, 'legacy-hash', NOW, '2026-10-07T12:00:00.000Z', NOW, null)
  const legacySession = { ...sqlite.prepare('SELECT * FROM sessions WHERE id = ?').get('legacy') }
  sqlite.exec('BEGIN')
  sqlite.exec(readFileSync(new URL(files[index], migrations), 'utf8'))
  sqlite.exec('COMMIT')
  const upgraded = { ...sqlite.prepare('SELECT * FROM sessions WHERE id = ?').get('legacy') }
  assert.deepEqual(upgraded, { ...legacySession, user_id: null, device_mode: null })
  assert.deepEqual(sqlite.prepare('SELECT business_id, mode, cutover_at FROM business_auth_state ORDER BY business_id').all().map((row) => ({ ...row })), [
    { business_id: BUSINESS, mode: 'legacy', cutover_at: null },
    { business_id: 'upgrade', mode: 'legacy', cutover_at: null },
  ])
  for (const table of ['users', 'user_credentials', 'roles', 'role_capabilities', 'access_invites', 'login_attempts', 'audit_events', 'business_auth_state']) assert.ok(sqlite.prepare('SELECT name FROM sqlite_master WHERE type = ? AND name = ?').get('table', table), table)
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0)
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM audit_events').get().n, 0)
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

test('0040 grants order adjustments to existing built-in operators only', (t) => {
  const files = readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
  const index = files.indexOf('0040_operator_order_adjustments.sql')
  assert.ok(index > 0, 'operator adjustment migration exists')
  assert.equal(files[index - 1], '0039_tenant_reference_guards.sql')
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  for (const file of files.slice(0, index)) sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))

  sqlite.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('operator-migration', 'operator-migration', 'Operator Migration', NOW, NOW)
  sqlite.prepare('INSERT INTO roles (id, business_id, code, name, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('operator-builtin', 'operator-migration', 'operator', 'Operador', 1, NOW, NOW)
  sqlite.prepare('INSERT INTO roles (id, business_id, code, name, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('manager-builtin', 'operator-migration', 'manager', 'Gerente', 1, NOW, NOW)

  sqlite.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('custom-role-business', 'custom-role-business', 'Custom Role', NOW, NOW)
  sqlite.prepare('INSERT INTO roles (id, business_id, code, name, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('operator-custom', 'custom-role-business', 'operator', 'Operador customizado', 0, NOW, NOW)

  const migration = readFileSync(new URL(files[index], migrations), 'utf8')
  sqlite.exec(migration)
  sqlite.exec(migration)

  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM role_capabilities WHERE business_id = ? AND role_id = ? AND capability = 'orders.discount'").get('operator-migration', 'operator-builtin').n, 1)
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM role_capabilities WHERE business_id = ? AND role_id = ? AND capability = 'orders.discount'").get('operator-migration', 'manager-builtin').n, 0)
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM role_capabilities WHERE business_id = ? AND role_id = ? AND capability = 'orders.discount'").get('custom-role-business', 'operator-custom').n, 0)
})

test('access schema enforces unique normalized login within each business and tenant-bound role assignment', (t) => {
  const { sqlite } = setup(t)
  seedTenants(sqlite)
  assert.throws(() => insertUser(sqlite, 'duplicate', BUSINESS, 'ana', 'r1'), /UNIQUE constraint/)
  assert.throws(() => insertUser(sqlite, 'cross-tenant', BUSINESS, 'other-login', 'r2'), /FOREIGN KEY constraint/)
  assert.throws(() => insertUser(sqlite, 'empty', BUSINESS, '  ', 'r1'), /CHECK constraint/)
  assert.throws(() => sqlite.prepare('INSERT INTO role_capabilities (business_id, role_id, capability) VALUES (?, ?, ?)').run(BUSINESS, 'r2', 'orders.view'), /FOREIGN KEY constraint/)
})

test('credentials, invitation subjects and issuers, sessions and audit actors cannot reference another business', (t) => {
  const { sqlite } = setup(t)
  seedTenants(sqlite)
  const credential = sqlite.prepare('INSERT INTO user_credentials (business_id, user_id, password_verifier, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
  credential.run(BUSINESS, 'u1', 'encoded-verifier', NOW, NOW, NOW)
  assert.throws(() => credential.run(BUSINESS, 'u2', 'encoded-verifier', NOW, NOW, NOW), /FOREIGN KEY constraint/)
  assert.throws(() => credential.run(BUSINESS, 'u1', 'second-verifier', NOW, NOW, NOW), /UNIQUE constraint/)
  const invite = sqlite.prepare('INSERT INTO access_invites (id, business_id, user_id, purpose, token_hash, expires_at, issued_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  invite.run('invite', BUSINESS, 'u1', 'activation', 'invite-hash', '2026-10-01T12:00:00.000Z', 'u1', NOW)
  assert.throws(() => invite.run('bad-subject', BUSINESS, 'u2', 'activation', 'hash2', NOW, 'u1', NOW), /FOREIGN KEY constraint/)
  assert.throws(() => invite.run('bad-issuer', BUSINESS, 'u1', 'reset', 'hash3', NOW, 'u2', NOW), /FOREIGN KEY constraint/)
  const session = sqlite.prepare('INSERT INTO sessions (id, business_id, token_hash, user_id, device_mode, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  session.run('human', BUSINESS, 'session-hash', 'u1', 'shared', NOW, '2026-10-01T00:00:00.000Z', NOW)
  session.run('human2', BUSINESS, 'session-hash2', 'u1', 'personal', NOW, '2026-10-07T12:00:00.000Z', NOW)
  assert.throws(() => session.run('wrong-business', BUSINESS, 'hash4', 'u2', 'shared', NOW, NOW, NOW), /FOREIGN KEY constraint/)
  assert.throws(() => session.run('no-mode', BUSINESS, 'hash5', 'u1', null, NOW, NOW, NOW), /CHECK constraint/)
  const audit = sqlite.prepare('INSERT INTO audit_events (id, business_id, occurred_at, actor_type, actor_user_id, actor_name, session_id, action, resource_type, resource_id, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  audit.run('audit', BUSINESS, NOW, 'user', 'u1', 'Ana', 'human', 'orders.create', 'order', 'order-id', 'success')
  assert.throws(() => audit.run('bad-actor', BUSINESS, NOW, 'user', 'u2', 'Other', null, 'orders.create', 'order', 'order-id', 'success'), /FOREIGN KEY constraint/)
  assert.throws(() => audit.run('bad-session', 'other', NOW, 'user', 'u2', 'Other', 'human', 'orders.create', 'order', 'order-id', 'success'), /FOREIGN KEY constraint/)
  assert.throws(() => sqlite.prepare('DELETE FROM users WHERE id = ?').run('u1'), /FOREIGN KEY constraint/)
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

test('access enums reject invalid states and audit actor shapes', (t) => {
  const { sqlite } = setup(t)
  seedTenants(sqlite)
  assert.throws(() => sqlite.prepare('UPDATE users SET active = 2 WHERE id = ?').run('u1'), /CHECK constraint/)
  assert.throws(() => sqlite.prepare('UPDATE roles SET version = 0 WHERE id = ?').run('r1'), /CHECK constraint/)
  assert.throws(() => sqlite.prepare('UPDATE business_auth_state SET mode = ? WHERE business_id = ?').run('invalid', BUSINESS), /CHECK constraint/)
  const invite = sqlite.prepare('INSERT INTO access_invites (id, business_id, user_id, purpose, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  assert.throws(() => invite.run('invalid', BUSINESS, 'u1', 'login', 'hash', NOW, NOW), /CHECK constraint/)
  const audit = sqlite.prepare('INSERT INTO audit_events (id, business_id, occurred_at, actor_type, actor_user_id, actor_name, action, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  audit.run('system', BUSINESS, NOW, 'system', null, 'System', 'access.recovery', 'success')
  audit.run('legacy', BUSINESS, NOW, 'legacy', null, 'Legacy', 'access.cutover', 'success')
  assert.throws(() => audit.run('user-missing', BUSINESS, NOW, 'user', null, 'Ana', 'access.login', 'failure'), /CHECK constraint/)
  assert.throws(() => audit.run('system-user', BUSINESS, NOW, 'system', 'u1', 'System', 'access.login', 'failure'), /CHECK constraint/)
})

test('login cleanup, account/origin limiting and activity filters use bounded indexes', (t) => {
  const { sqlite } = setup(t)
  const plan = (query, ...bindings) => sqlite.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...bindings).map(({ detail }) => detail).join('\n')
  assert.match(plan('SELECT id FROM login_attempts WHERE created_at < ? ORDER BY created_at LIMIT 100', NOW), /login_attempts_cleanup_idx/)
  assert.match(plan('SELECT COUNT(*) FROM login_attempts WHERE business_id = ? AND account_key = ? AND created_at >= ?', BUSINESS, 'account-hash', NOW), /login_attempts_account_idx/)
  assert.match(plan('SELECT COUNT(*) FROM login_attempts WHERE business_id = ? AND origin_key = ? AND created_at >= ?', BUSINESS, 'origin-hash', NOW), /login_attempts_origin_idx/)
  assert.match(plan('SELECT * FROM audit_events WHERE business_id = ? AND occurred_at >= ? ORDER BY occurred_at DESC, id DESC LIMIT 50', BUSINESS, NOW), /audit_events_business_time_idx/)
  assert.match(plan('SELECT * FROM audit_events WHERE business_id = ? AND actor_user_id = ? AND occurred_at >= ? ORDER BY occurred_at DESC, id DESC LIMIT 50', BUSINESS, 'u1', NOW), /audit_events_actor_time_idx/)
  assert.match(plan('SELECT * FROM audit_events WHERE business_id = ? AND action = ? AND occurred_at >= ? ORDER BY occurred_at DESC, id DESC LIMIT 50', BUSINESS, 'access.login', NOW), /audit_events_action_time_idx/)
  assert.match(plan('SELECT * FROM sessions WHERE business_id = ? AND expires_at < ?', BUSINESS, NOW), /sessions_business_expires_idx/)
})
