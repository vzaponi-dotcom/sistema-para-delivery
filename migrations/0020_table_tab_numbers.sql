ALTER TABLE table_tabs ADD COLUMN tab_number INTEGER;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY business_id ORDER BY opened_at, created_at, id) AS assigned_number
  FROM table_tabs
)
UPDATE table_tabs
SET tab_number = (
  SELECT ranked.assigned_number
  FROM ranked
  WHERE ranked.id = table_tabs.id
);

CREATE UNIQUE INDEX idx_table_tabs_business_number
ON table_tabs (business_id, tab_number);

CREATE TABLE table_tab_counters (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TEXT NOT NULL
);

INSERT INTO table_tab_counters (business_id, last_number, updated_at)
SELECT
  businesses.id,
  COALESCE(max(table_tabs.tab_number), 0),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM businesses
LEFT JOIN table_tabs ON table_tabs.business_id = businesses.id
GROUP BY businesses.id;
