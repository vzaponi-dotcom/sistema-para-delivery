CREATE TABLE table_reservations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  table_name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'converted', 'cancelled', 'no_show')),
  scheduled_for TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  converted_table_tab_id TEXT REFERENCES table_tabs(id) ON DELETE RESTRICT,
  converted_at TEXT,
  cancelled_at TEXT,
  no_show_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (scheduled_for < ends_at),
  CHECK (
    (status = 'reserved'
      AND converted_table_tab_id IS NULL
      AND converted_at IS NULL
      AND cancelled_at IS NULL
      AND no_show_at IS NULL)
    OR
    (status = 'converted'
      AND converted_table_tab_id IS NOT NULL
      AND converted_at IS NOT NULL
      AND cancelled_at IS NULL
      AND no_show_at IS NULL)
    OR
    (status = 'cancelled'
      AND converted_table_tab_id IS NULL
      AND converted_at IS NULL
      AND cancelled_at IS NOT NULL
      AND no_show_at IS NULL)
    OR
    (status = 'no_show'
      AND converted_table_tab_id IS NULL
      AND converted_at IS NULL
      AND cancelled_at IS NULL
      AND no_show_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_table_reservations_business_order
ON table_reservations (business_id, order_id);

CREATE INDEX idx_table_reservations_business_status_schedule
ON table_reservations (business_id, status, scheduled_for);

CREATE INDEX idx_table_reservations_business_table_status_schedule
ON table_reservations (business_id, table_id, status, scheduled_for);

CREATE INDEX idx_table_reservations_converted_tab
ON table_reservations (business_id, converted_table_tab_id)
WHERE converted_table_tab_id IS NOT NULL;

-- IDs are globally unique in the current schema, but the reservation boundary must
-- still reject a valid order/table identifier owned by another business.
CREATE TRIGGER table_reservations_scope_insert_guard
BEFORE INSERT ON table_reservations
WHEN NOT EXISTS (
    SELECT 1
    FROM orders
    WHERE id = NEW.order_id
      AND business_id = NEW.business_id
      AND type = 'Local'
  )
  OR NOT EXISTS (
    SELECT 1
    FROM tables
    WHERE id = NEW.table_id
      AND business_id = NEW.business_id
  )
  OR (
    NEW.converted_table_tab_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM table_tabs
      WHERE id = NEW.converted_table_tab_id
        AND business_id = NEW.business_id
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'TABLE_RESERVATION_SCOPE_MISMATCH');
END;

CREATE TRIGGER table_reservations_scope_update_guard
BEFORE UPDATE OF business_id, order_id, table_id, converted_table_tab_id
ON table_reservations
WHEN NOT EXISTS (
    SELECT 1
    FROM orders
    WHERE id = NEW.order_id
      AND business_id = NEW.business_id
      AND type = 'Local'
  )
  OR NOT EXISTS (
    SELECT 1
    FROM tables
    WHERE id = NEW.table_id
      AND business_id = NEW.business_id
  )
  OR (
    NEW.converted_table_tab_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM table_tabs
      WHERE id = NEW.converted_table_tab_id
        AND business_id = NEW.business_id
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'TABLE_RESERVATION_SCOPE_MISMATCH');
END;

-- Half-open interval semantics: [scheduled_for, ends_at).
-- Touching reservations (20:00-22:00 and 22:00-00:00) are valid.
CREATE TRIGGER table_reservations_overlap_insert_guard
BEFORE INSERT ON table_reservations
WHEN NEW.status = 'reserved'
  AND EXISTS (
    SELECT 1
    FROM table_reservations existing
    WHERE existing.business_id = NEW.business_id
      AND existing.table_id = NEW.table_id
      AND existing.status = 'reserved'
      AND NEW.scheduled_for < existing.ends_at
      AND existing.scheduled_for < NEW.ends_at
  )
BEGIN
  SELECT RAISE(ABORT, 'TABLE_RESERVATION_CONFLICT');
END;

CREATE TRIGGER table_reservations_overlap_update_guard
BEFORE UPDATE OF business_id, table_id, status, scheduled_for, ends_at
ON table_reservations
WHEN NEW.status = 'reserved'
  AND EXISTS (
    SELECT 1
    FROM table_reservations existing
    WHERE existing.id <> OLD.id
      AND existing.business_id = NEW.business_id
      AND existing.table_id = NEW.table_id
      AND existing.status = 'reserved'
      AND NEW.scheduled_for < existing.ends_at
      AND existing.scheduled_for < NEW.ends_at
  )
BEGIN
  SELECT RAISE(ABORT, 'TABLE_RESERVATION_CONFLICT');
END;

CREATE TRIGGER table_reservations_terminal_status_guard
BEFORE UPDATE OF status ON table_reservations
WHEN OLD.status IN ('converted', 'cancelled', 'no_show')
  AND NEW.status <> OLD.status
BEGIN
  SELECT RAISE(ABORT, 'TABLE_RESERVATION_TERMINAL');
END;
