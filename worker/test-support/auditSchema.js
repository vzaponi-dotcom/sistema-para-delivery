import { readFileSync } from 'node:fs'

// Older focused fixtures only model their domain. Add the real audit migration
// and its identity FK parents rather than weakening production audit behavior.
export function installAuditSchema(sqlite) {
  if(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='audit_events'").get())return
  sqlite.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,business_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,business_id TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS audit_fixture_users_scope ON users(business_id,id);
    CREATE UNIQUE INDEX IF NOT EXISTS audit_fixture_sessions_scope ON sessions(business_id,id);`)
  const migration=readFileSync(new URL('../../migrations/0035_users_profiles_access.sql',import.meta.url),'utf8')
  sqlite.exec(migration.slice(migration.indexOf('CREATE TABLE audit_events')))
  sqlite.exec(readFileSync(new URL('../../migrations/0036_audit_resource_attribution.sql',import.meta.url),'utf8'))
}
