-- Adds identity contracts without cutting over the existing shared login.
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_builtin INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (business_id, id),
  UNIQUE (business_id, code)
);

CREATE TABLE role_capabilities (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  PRIMARY KEY (business_id, role_id, capability),
  FOREIGN KEY (business_id, role_id) REFERENCES roles(business_id, id) ON DELETE CASCADE
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  login_normalized TEXT NOT NULL CHECK (length(trim(login_normalized)) > 0),
  role_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (business_id, id),
  UNIQUE (business_id, login_normalized),
  FOREIGN KEY (business_id, role_id) REFERENCES roles(business_id, id) ON DELETE RESTRICT
);
CREATE INDEX users_business_role_active_idx ON users (business_id, role_id, active);

-- The versioned encoded verifier carries algorithm, iterations and individual salt.
CREATE TABLE user_credentials (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  password_verifier TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  password_changed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (business_id, user_id) REFERENCES users(business_id, id) ON DELETE RESTRICT
);

-- Rebuild to add the composite tenant/user FK; all legacy values and indexes survive.
CREATE TABLE sessions_with_users (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  user_id TEXT,
  device_mode TEXT,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, user_id) REFERENCES users(business_id, id) ON DELETE RESTRICT,
  CHECK ((user_id IS NULL AND device_mode IS NULL) OR
    (user_id IS NOT NULL AND device_mode IS NOT NULL AND device_mode IN ('shared', 'personal')))
);
INSERT INTO sessions_with_users (id, business_id, token_hash, created_at, expires_at, last_seen_at, revoked_at)
SELECT id, business_id, token_hash, created_at, expires_at, last_seen_at, revoked_at FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_with_users RENAME TO sessions;
CREATE INDEX sessions_business_expires_idx ON sessions (business_id, expires_at);
CREATE INDEX sessions_business_user_idx ON sessions (business_id, user_id, revoked_at);

CREATE TABLE access_invites (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('activation', 'reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  revoked_at TEXT,
  issued_by_user_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (business_id, user_id) REFERENCES users(business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, issued_by_user_id) REFERENCES users(business_id, id) ON DELETE RESTRICT
);
CREATE INDEX access_invites_business_user_idx ON access_invites (business_id, user_id, consumed_at, revoked_at);

-- account_key and origin_key contain digests, never passwords or raw origin data.
CREATE TABLE login_attempts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  account_key TEXT NOT NULL,
  origin_key TEXT NOT NULL,
  succeeded INTEGER NOT NULL DEFAULT 0 CHECK (succeeded IN (0, 1)),
  created_at TEXT NOT NULL
);
CREATE INDEX login_attempts_account_idx ON login_attempts (business_id, account_key, created_at);
CREATE INDEX login_attempts_origin_idx ON login_attempts (business_id, origin_key, created_at);
CREATE INDEX login_attempts_cleanup_idx ON login_attempts (created_at, id);

CREATE TABLE business_auth_state (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'legacy' CHECK (mode IN ('legacy', 'enrollment', 'user_only')),
  cutover_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO business_auth_state (business_id, mode, cutover_at, created_at, updated_at)
SELECT id, 'legacy', NULL, created_at, updated_at FROM businesses;

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'legacy')),
  actor_user_id TEXT,
  actor_name TEXT NOT NULL,
  session_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  result TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json) AND json_type(metadata_json) = 'object'),
  FOREIGN KEY (business_id, actor_user_id) REFERENCES users(business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, session_id) REFERENCES sessions(business_id, id) ON DELETE RESTRICT,
  CHECK ((actor_type = 'user' AND actor_user_id IS NOT NULL) OR
    (actor_type IN ('system', 'legacy') AND actor_user_id IS NULL))
);
CREATE INDEX audit_events_business_time_idx ON audit_events (business_id, occurred_at DESC, id DESC);
CREATE INDEX audit_events_actor_time_idx ON audit_events (business_id, actor_user_id, occurred_at DESC, id DESC);
CREATE INDEX audit_events_action_time_idx ON audit_events (business_id, action, occurred_at DESC, id DESC);
