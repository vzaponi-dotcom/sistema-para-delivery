PRAGMA foreign_keys = OFF;

ALTER TABLE print_stations ADD COLUMN qz_ready INTEGER NOT NULL DEFAULT 0 CHECK (qz_ready IN (0, 1));
ALTER TABLE print_stations ADD COLUMN printer_ready INTEGER NOT NULL DEFAULT 0 CHECK (printer_ready IN (0, 1));
ALTER TABLE print_stations ADD COLUMN last_ready_at TEXT;

CREATE TABLE business_print_settings (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  default_copies INTEGER NOT NULL DEFAULT 2 CHECK (default_copies IN (1, 2)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO business_print_settings (business_id, default_copies, created_at, updated_at)
SELECT
  businesses.id,
  COALESCE(
    (
      SELECT print_stations.default_copies
      FROM print_stations
      WHERE print_stations.business_id = businesses.id
        AND print_stations.is_primary = 1
        AND print_stations.default_copies IN (1, 2)
      ORDER BY print_stations.updated_at DESC, print_stations.id
      LIMIT 1
    ),
    2
  ),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM businesses;

DROP INDEX IF EXISTS print_jobs_pending_idx;
DROP INDEX IF EXISTS print_jobs_order_history_idx;
DROP INDEX IF EXISTS print_jobs_one_auto_order_idx;
DROP INDEX IF EXISTS print_jobs_available_idx;

CREATE TABLE print_jobs_next (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order', 'test')),
  trigger TEXT NOT NULL CHECK (trigger IN ('automatic', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'printed', 'failed', 'requires_attention', 'discarded')),
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority IN (0, 1)),
  parent_job_id TEXT REFERENCES print_jobs_next(id) ON DELETE SET NULL,
  copies_requested INTEGER NOT NULL CHECK (copies_requested IN (1, 2)),
  copies_printed INTEGER NOT NULL DEFAULT 0 CHECK (copies_printed >= 0 AND copies_printed <= 2),
  station_id TEXT REFERENCES print_stations(id) ON DELETE SET NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  available_at TEXT,
  processing_started_at TEXT,
  processed_at TEXT,
  discarded_at TEXT,
  attention_reason TEXT,
  action_actor_label TEXT,
  action_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  CHECK (
    (type = 'order' AND order_id IS NOT NULL)
    OR (type = 'test' AND order_id IS NULL)
  )
);

INSERT INTO print_jobs_next (
  id,
  business_id,
  order_id,
  type,
  trigger,
  status,
  priority,
  parent_job_id,
  copies_requested,
  copies_printed,
  station_id,
  snapshot_json,
  created_at,
  available_at,
  processing_started_at,
  processed_at,
  discarded_at,
  attention_reason,
  action_actor_label,
  action_at,
  last_error_code,
  last_error_message
)
SELECT
  id,
  business_id,
  order_id,
  type,
  trigger,
  status,
  0,
  NULL,
  copies_requested,
  copies_printed,
  station_id,
  snapshot_json,
  created_at,
  available_at,
  processing_started_at,
  processed_at,
  NULL,
  NULL,
  NULL,
  NULL,
  last_error_code,
  last_error_message
FROM print_jobs;

DROP TABLE print_jobs;
ALTER TABLE print_jobs_next RENAME TO print_jobs;

CREATE INDEX print_jobs_pending_idx
  ON print_jobs (business_id, status, trigger, created_at);

CREATE INDEX print_jobs_order_history_idx
  ON print_jobs (business_id, order_id, created_at DESC);

CREATE UNIQUE INDEX print_jobs_one_auto_order_idx
  ON print_jobs (business_id, order_id)
  WHERE type = 'order' AND trigger = 'automatic';

CREATE INDEX print_jobs_available_idx
  ON print_jobs (business_id, status, trigger, available_at);

CREATE INDEX print_jobs_active_priority_idx
  ON print_jobs (business_id, priority DESC, available_at, created_at)
  WHERE status IN ('pending', 'processing', 'requires_attention');

CREATE INDEX print_jobs_parent_history_idx
  ON print_jobs (business_id, parent_job_id, created_at DESC);

PRAGMA foreign_keys = ON;
