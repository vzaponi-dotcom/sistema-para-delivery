PRAGMA foreign_keys = ON;

ALTER TABLE orders ADD COLUMN client_phone_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN client_address_snapshot TEXT NOT NULL DEFAULT '';

CREATE TABLE print_stations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('windows', 'android', 'other')),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  auto_print_enabled INTEGER NOT NULL DEFAULT 0 CHECK (auto_print_enabled IN (0, 1)),
  default_copies INTEGER NOT NULL DEFAULT 2 CHECK (default_copies IN (1, 2)),
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX print_stations_business_idx
  ON print_stations (business_id, updated_at DESC);

CREATE UNIQUE INDEX print_stations_one_primary_idx
  ON print_stations (business_id)
  WHERE is_primary = 1;

CREATE TABLE print_jobs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order', 'test')),
  trigger TEXT NOT NULL CHECK (trigger IN ('automatic', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'printed', 'failed', 'requires_attention')),
  copies_requested INTEGER NOT NULL CHECK (copies_requested IN (1, 2)),
  copies_printed INTEGER NOT NULL DEFAULT 0 CHECK (copies_printed >= 0 AND copies_printed <= 2),
  station_id TEXT REFERENCES print_stations(id) ON DELETE SET NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  processing_started_at TEXT,
  processed_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  CHECK (
    (type = 'order' AND order_id IS NOT NULL)
    OR (type = 'test' AND order_id IS NULL)
  )
);

CREATE INDEX print_jobs_pending_idx
  ON print_jobs (business_id, status, trigger, created_at);

CREATE INDEX print_jobs_order_history_idx
  ON print_jobs (business_id, order_id, created_at DESC);

CREATE UNIQUE INDEX print_jobs_one_auto_order_idx
  ON print_jobs (business_id, order_id)
  WHERE type = 'order' AND trigger = 'automatic';
