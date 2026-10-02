-- Additive identity layer. Historical operational actor/session IDs are retained.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL UNIQUE CHECK(email_normalized = lower(trim(email_normalized)) AND length(email_normalized) > 3),
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 200),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  email_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE account_credentials (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id),
  password_verifier TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  password_changed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE businesses ADD COLUMN access_status TEXT NOT NULL DEFAULT 'legacy' CHECK(access_status IN ('legacy','pending','active'));
ALTER TABLE users ADD COLUMN account_id TEXT REFERENCES accounts(id);
ALTER TABLE users ADD COLUMN membership_state TEXT NOT NULL DEFAULT 'historical' CHECK(membership_state IN ('historical','invited','active','inactive'));
CREATE UNIQUE INDEX users_business_account_idx ON users(business_id,account_id);
CREATE UNIQUE INDEX users_account_business_id_idx ON users(account_id,business_id,id);
CREATE UNIQUE INDEX sessions_business_user_id_idx ON sessions(business_id,user_id,id);

CREATE TABLE identity_session_families (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  device_mode TEXT NOT NULL CHECK(device_mode IN ('shared','personal')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  current_identity_session_id TEXT,
  UNIQUE(account_id,id),
  FOREIGN KEY(account_id,id,current_identity_session_id) REFERENCES identity_sessions(account_id,family_id,id) DEFERRABLE INITIALLY DEFERRED,
  CHECK(expires_at > created_at)
);
CREATE TABLE identity_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  credential_revision INTEGER NOT NULL CHECK(credential_revision >= 1),
  family_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  context_id TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL CHECK(scope IN ('identity','business','platform')),
  business_id TEXT,
  user_id TEXT,
  business_session_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(account_id,family_id,id),
  FOREIGN KEY(account_id,family_id) REFERENCES identity_session_families(account_id,id),
  FOREIGN KEY(account_id,business_id,user_id) REFERENCES users(account_id,business_id,id),
  FOREIGN KEY(business_id,user_id,business_session_id) REFERENCES sessions(business_id,user_id,id),
  CHECK((scope = 'business' AND business_id IS NOT NULL AND user_id IS NOT NULL AND business_session_id IS NOT NULL) OR
        (scope IN ('identity','platform') AND business_id IS NULL AND user_id IS NULL AND business_session_id IS NULL)),
  CHECK(expires_at > created_at)
);
CREATE INDEX identity_sessions_account_expires_idx ON identity_sessions(account_id,expires_at);
CREATE TABLE identity_challenges (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  purpose TEXT NOT NULL CHECK(purpose IN ('activation','password_reset')),
  email_normalized TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expected_revision INTEGER CHECK(expected_revision >= 1),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  revoked_at TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending','accepted','rejected','uncertain')),
  provider_id TEXT,
  CHECK((purpose = 'activation' AND expected_revision IS NULL) OR (purpose = 'password_reset' AND expected_revision IS NOT NULL)),
  CHECK(expires_at > created_at)
);
CREATE INDEX identity_challenges_account_idx ON identity_challenges(account_id,purpose,created_at);
CREATE TABLE identity_login_attempts (
  id TEXT PRIMARY KEY,
  account_hash TEXT NOT NULL,
  origin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX identity_login_account_idx ON identity_login_attempts(account_hash,created_at);
CREATE INDEX identity_login_origin_idx ON identity_login_attempts(origin_hash,created_at);
CREATE TABLE identity_recovery_requests (
  id TEXT PRIMARY KEY,
  account_hash TEXT NOT NULL,
  origin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX identity_recovery_account_idx ON identity_recovery_requests(account_hash,created_at);
CREATE INDEX identity_recovery_origin_idx ON identity_recovery_requests(origin_hash,created_at);
CREATE TABLE identity_email_deliveries (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id),
  business_id TEXT REFERENCES businesses(id),
  kind TEXT NOT NULL CHECK(kind IN ('activation','password_reset','company_invitation')),
  created_at TEXT NOT NULL
);
CREATE INDEX identity_email_deliveries_created_idx ON identity_email_deliveries(created_at);
CREATE TABLE identity_audit_events (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id),
  session_id TEXT REFERENCES identity_sessions(id),
  action TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('success','denied','failure')),
  created_at TEXT NOT NULL
);
CREATE INDEX identity_audit_account_created_idx ON identity_audit_events(account_id,created_at);
CREATE TABLE company_invitations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  user_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  role_id TEXT NOT NULL,
  expected_role_version INTEGER NOT NULL CHECK(expected_role_version >= 1),
  issued_by_account_id TEXT NOT NULL REFERENCES accounts(id),
  issuer_scope TEXT NOT NULL CHECK(issuer_scope IN ('business','platform')),
  purpose TEXT NOT NULL CHECK(purpose IN ('first_manager','team')),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  revoked_at TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending','accepted','rejected','uncertain')),
  provider_id TEXT,
  FOREIGN KEY(account_id,business_id,user_id) REFERENCES users(account_id,business_id,id),
  FOREIGN KEY(business_id,role_id) REFERENCES roles(business_id,id),
  CHECK(expires_at > created_at),
  CHECK(purpose != 'first_manager' OR issuer_scope = 'platform')
);
CREATE INDEX company_invitations_membership_idx ON company_invitations(business_id,user_id,created_at);
CREATE TABLE platform_grants (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  capability TEXT NOT NULL CHECK(capability IN ('platform.businesses.view','platform.businesses.create','platform.invitations.resend')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(account_id,capability)
);
CREATE TABLE platform_audit_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  business_id TEXT REFERENCES businesses(id),
  action TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('success','denied','failure')),
  created_at TEXT NOT NULL
);
CREATE TABLE platform_provisioning_receipts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  business_id TEXT NOT NULL UNIQUE REFERENCES businesses(id),
  created_at TEXT NOT NULL,
  UNIQUE(account_id,idempotency_key)
);
CREATE TABLE platform_bootstraps (
  environment TEXT PRIMARY KEY CHECK(environment IN ('staging','production')),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  finalized_at TEXT,
  legacy_inventory_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(legacy_inventory_json) AND json_type(legacy_inventory_json) = 'array')
);
CREATE TABLE identity_tx_assertions (
  id TEXT PRIMARY KEY,
  ok INTEGER NOT NULL CHECK(ok = 1)
);
