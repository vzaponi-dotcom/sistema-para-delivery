CREATE TABLE business_profiles (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),

  phone TEXT NOT NULL DEFAULT '',
  address_line TEXT NOT NULL DEFAULT '',
  address_number TEXT NOT NULL DEFAULT '',
  address_complement TEXT NOT NULL DEFAULT '',
  neighborhood TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',

  logo_object_key TEXT,
  logo_content_type TEXT,
  logo_sha256 TEXT,
  logo_size_bytes INTEGER CHECK (logo_size_bytes IS NULL OR logo_size_bytes >= 0),
  logo_updated_at TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO business_profiles (
  business_id,
  revision,
  phone,
  address_line,
  address_number,
  address_complement,
  neighborhood,
  city,
  state,
  postal_code,
  logo_object_key,
  logo_content_type,
  logo_sha256,
  logo_size_bytes,
  logo_updated_at,
  created_at,
  updated_at
)
SELECT
  id,
  1,
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  created_at,
  updated_at
FROM businesses;
