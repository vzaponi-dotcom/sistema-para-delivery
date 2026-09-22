UPDATE kitchen_tv_access
SET pairing_token_hash = NULL,
    pairing_expires_at = NULL
WHERE pairing_token_hash IS NOT NULL;

CREATE TABLE kitchen_tv_pairing_requests (
  request_token_hash TEXT PRIMARY KEY,
  pairing_code TEXT NOT NULL UNIQUE,
  approved_business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  consumed_at TEXT,
  CHECK (length(pairing_code) = 6 AND pairing_code GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]'),
  CHECK ((approved_business_id IS NULL) = (approved_at IS NULL))
);

CREATE INDEX kitchen_tv_pairing_requests_business_idx
  ON kitchen_tv_pairing_requests(approved_business_id, consumed_at, expires_at);
