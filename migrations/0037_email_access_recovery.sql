-- Additive only. Fresh staging accounts are prepared explicitly, never here.
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE user_credentials ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1);

CREATE TABLE auth_email_challenges (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('activation','password_reset')),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  token_hash TEXT NOT NULL UNIQUE,
  expected_revision INTEGER CHECK (expected_revision IS NULL OR expected_revision >= 1),
  issued_by_user_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  revoked_at TEXT,
  delivery_status TEXT CHECK (delivery_status IS NULL OR delivery_status IN ('accepted','rejected','uncertain','private')),
  provider_id TEXT,
  UNIQUE (business_id,id),
  FOREIGN KEY (business_id,user_id) REFERENCES users(business_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id,issued_by_user_id) REFERENCES users(business_id,id) ON DELETE RESTRICT,
  CHECK ((purpose='activation' AND expected_revision IS NULL) OR (purpose='password_reset' AND expected_revision IS NOT NULL))
);
CREATE INDEX auth_email_challenges_user_idx ON auth_email_challenges(business_id,user_id,created_at DESC);
CREATE INDEX auth_email_challenges_cleanup_idx ON auth_email_challenges(expires_at,id);

CREATE TABLE auth_email_requests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  account_key TEXT NOT NULL,
  origin_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX auth_email_requests_account_idx ON auth_email_requests(business_id,account_key,created_at);
CREATE INDEX auth_email_requests_origin_idx ON auth_email_requests(business_id,origin_key,created_at);
CREATE INDEX auth_email_requests_cleanup_idx ON auth_email_requests(created_at,id);

-- This budget covers the environment's database, across businesses and isolates.
CREATE TABLE auth_email_deliveries (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (business_id,user_id) REFERENCES users(business_id,id) ON DELETE RESTRICT
);
CREATE INDEX auth_email_deliveries_user_idx ON auth_email_deliveries(business_id,user_id,created_at);
CREATE INDEX auth_email_deliveries_daily_idx ON auth_email_deliveries(created_at,id);

-- Ephemeral assertions belong to a batch. Failure rolls back every mutation.
CREATE TABLE auth_email_tx_assertions (
  id TEXT PRIMARY KEY,
  ok INTEGER NOT NULL CHECK (ok=1)
);

CREATE TABLE auth_email_staging_bootstraps (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  manager_user_id TEXT NOT NULL,
  previous_user_ids_json TEXT NOT NULL CHECK (json_valid(previous_user_ids_json) AND json_type(previous_user_ids_json)='array'),
  prepared_at TEXT NOT NULL,
  finalized_at TEXT,
  FOREIGN KEY (business_id,manager_user_id) REFERENCES users(business_id,id) ON DELETE RESTRICT
);
