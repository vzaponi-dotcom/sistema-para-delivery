PRAGMA defer_foreign_keys = ON;

ALTER TABLE print_stations ADD COLUMN physical_state TEXT NOT NULL DEFAULT 'verifying'
  CHECK (physical_state IN ('ready','verifying','printer_offline','printer_attention','qz_unavailable','printer_not_found','unconfigured','unsupported'));
ALTER TABLE print_stations ADD COLUMN physical_status_text TEXT;
ALTER TABLE print_stations ADD COLUMN physical_status_code INTEGER;
ALTER TABLE print_stations ADD COLUMN physical_status_at TEXT;
ALTER TABLE print_stations ADD COLUMN last_offline_at TEXT;
ALTER TABLE print_stations ADD COLUMN recovery_state TEXT NOT NULL DEFAULT 'normal'
  CHECK (recovery_state IN ('normal','pending','active','deferred'));

DROP INDEX IF EXISTS print_jobs_pending_idx;
DROP INDEX IF EXISTS print_jobs_order_history_idx;
DROP INDEX IF EXISTS print_jobs_one_auto_order_idx;
DROP INDEX IF EXISTS print_jobs_available_idx;
DROP INDEX IF EXISTS print_jobs_active_priority_idx;
DROP INDEX IF EXISTS print_jobs_parent_history_idx;

CREATE TABLE print_jobs_next (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order', 'test')),
  trigger TEXT NOT NULL CHECK (trigger IN ('automatic', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'awaiting_confirmation', 'awaiting_second_copy', 'printed', 'failed', 'requires_attention', 'discarded')),
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
  second_copy_prompted_at TEXT,
  second_copy_requested_at TEXT,
  second_copy_skipped_at TEXT,
  CHECK (
    (type = 'order' AND order_id IS NOT NULL)
    OR (type = 'test' AND order_id IS NULL)
  )
);

INSERT INTO print_jobs_next (
  id, business_id, order_id, type, trigger, status, priority, parent_job_id,
  copies_requested, copies_printed, station_id, snapshot_json, created_at,
  available_at, processing_started_at, processed_at, discarded_at,
  attention_reason, action_actor_label, action_at, last_error_code,
  last_error_message, second_copy_prompted_at, second_copy_requested_at,
  second_copy_skipped_at
)
SELECT
  id, business_id, order_id, type, trigger, status, priority, parent_job_id,
  copies_requested, copies_printed, station_id, snapshot_json, created_at,
  available_at, processing_started_at, processed_at, discarded_at,
  attention_reason, action_actor_label, action_at, last_error_code,
  last_error_message, second_copy_prompted_at, second_copy_requested_at,
  second_copy_skipped_at
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
  WHERE status IN ('pending', 'processing', 'awaiting_confirmation', 'awaiting_second_copy', 'requires_attention');

CREATE INDEX print_jobs_parent_history_idx
  ON print_jobs (business_id, parent_job_id, created_at DESC);

CREATE TABLE print_job_attempts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
  copy_number INTEGER NOT NULL CHECK (copy_number IN (1, 2)),
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  station_id TEXT REFERENCES print_stations(id) ON DELETE SET NULL,
  spool_job_name TEXT NOT NULL UNIQUE,
  spool_job_id INTEGER,
  status TEXT NOT NULL CHECK (status IN ('prepared','submitting','spooling','printing','complete','failed','unknown')),
  submission_started_at TEXT,
  submitted_at TEXT,
  last_event_at TEXT,
  completed_at TEXT,
  resolution TEXT CHECK (resolution IS NULL OR resolution IN ('manual_printed','manual_not_printed')),
  resolution_actor_label TEXT,
  resolved_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (job_id, copy_number, attempt_number)
);

CREATE INDEX print_job_attempts_business_idx
  ON print_job_attempts (business_id, created_at);

CREATE INDEX print_job_attempts_station_idx
  ON print_job_attempts (station_id, created_at);

PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = OFF;
