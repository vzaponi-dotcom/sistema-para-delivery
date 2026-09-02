CREATE TABLE table_tabs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  table_identifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE UNIQUE INDEX idx_table_tabs_one_open_per_table
ON table_tabs (business_id, table_identifier)
WHERE status = 'open';

CREATE INDEX idx_table_tabs_business_status
ON table_tabs (business_id, status, opened_at);

ALTER TABLE orders ADD COLUMN table_tab_id TEXT REFERENCES table_tabs(id);

CREATE INDEX idx_orders_table_tab
ON orders (business_id, table_tab_id);
