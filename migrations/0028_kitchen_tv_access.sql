CREATE TABLE kitchen_tv_access (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  pairing_token_hash TEXT,
  pairing_expires_at TEXT,
  session_token_hash TEXT,
  session_issued_at TEXT,
  paired_at TEXT,
  last_seen_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((pairing_token_hash IS NULL) = (pairing_expires_at IS NULL)),
  CHECK ((session_token_hash IS NULL) = (session_issued_at IS NULL))
);

CREATE UNIQUE INDEX kitchen_tv_access_pairing_token_hash_unique
  ON kitchen_tv_access(pairing_token_hash)
  WHERE pairing_token_hash IS NOT NULL;

CREATE UNIQUE INDEX kitchen_tv_access_session_token_hash_unique
  ON kitchen_tv_access(session_token_hash)
  WHERE session_token_hash IS NOT NULL;
