ALTER TABLE orders ADD COLUMN scheduled_for TEXT;
ALTER TABLE orders ADD COLUMN is_backdated INTEGER NOT NULL DEFAULT 0 CHECK (is_backdated IN (0,1));

UPDATE orders SET is_backdated = 1
WHERE status = 'Finalizado'
  AND finished_at = created_at
  AND created_at = order_date || 'T15:00:00.000Z';

ALTER TABLE print_jobs ADD COLUMN available_at TEXT;
UPDATE print_jobs SET available_at = created_at WHERE available_at IS NULL;

CREATE INDEX orders_business_schedule_idx ON orders (business_id, scheduled_for);
CREATE INDEX print_jobs_available_idx ON print_jobs (business_id, status, trigger, available_at);
