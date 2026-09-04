ALTER TABLE movements ADD COLUMN payment_method TEXT;
ALTER TABLE movements ADD COLUMN updated_at TEXT;
ALTER TABLE movements ADD COLUMN deleted_at TEXT;
UPDATE movements SET updated_at = created_at WHERE updated_at IS NULL;

CREATE TABLE finance_settings (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  opening_balance_cents INTEGER NOT NULL,
  opening_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX movements_business_date_active_idx
  ON movements (business_id, movement_date DESC)
  WHERE deleted_at IS NULL;
