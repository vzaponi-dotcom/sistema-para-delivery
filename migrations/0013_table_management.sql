CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_tables_business_name_key
ON tables (business_id, name_key);

CREATE INDEX idx_tables_business_sort
ON tables (business_id, sort_order, name);

WITH seed(number) AS (
  VALUES (1), (2), (3), (4), (5), (6), (7)
)
INSERT OR IGNORE INTO tables (
  id, business_id, name, name_key, sort_order, is_active, created_at, updated_at
)
SELECT
  lower(hex(randomblob(16))),
  businesses.id,
  'Mesa ' || seed.number,
  'MESA ' || seed.number,
  seed.number,
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM businesses
CROSS JOIN seed
WHERE NOT EXISTS (
  SELECT 1
  FROM tables existing
  WHERE existing.business_id = businesses.id
    AND existing.name_key = 'MESA ' || seed.number
);

ALTER TABLE table_tabs ADD COLUMN table_id TEXT REFERENCES tables(id) ON DELETE RESTRICT;

UPDATE table_tabs
SET table_id = (
  SELECT seeded.id
  FROM tables seeded
  WHERE seeded.business_id = table_tabs.business_id
    AND seeded.name_key = CASE upper(trim(table_tabs.table_identifier))
      WHEN '1' THEN 'MESA 1'
      WHEN '01' THEN 'MESA 1'
      WHEN 'MESA 1' THEN 'MESA 1'
      WHEN '2' THEN 'MESA 2'
      WHEN '02' THEN 'MESA 2'
      WHEN 'MESA 2' THEN 'MESA 2'
      WHEN '3' THEN 'MESA 3'
      WHEN '03' THEN 'MESA 3'
      WHEN 'MESA 3' THEN 'MESA 3'
      WHEN '4' THEN 'MESA 4'
      WHEN '04' THEN 'MESA 4'
      WHEN 'MESA 4' THEN 'MESA 4'
      WHEN '5' THEN 'MESA 5'
      WHEN '05' THEN 'MESA 5'
      WHEN 'MESA 5' THEN 'MESA 5'
      WHEN '6' THEN 'MESA 6'
      WHEN '06' THEN 'MESA 6'
      WHEN 'MESA 6' THEN 'MESA 6'
      WHEN '7' THEN 'MESA 7'
      WHEN '07' THEN 'MESA 7'
      WHEN 'MESA 7' THEN 'MESA 7'
    END
  LIMIT 1
)
WHERE table_id IS NULL
  AND upper(trim(table_identifier)) IN (
    '1', '01', 'MESA 1',
    '2', '02', 'MESA 2',
    '3', '03', 'MESA 3',
    '4', '04', 'MESA 4',
    '5', '05', 'MESA 5',
    '6', '06', 'MESA 6',
    '7', '07', 'MESA 7'
  );

WITH RECURSIVE normalized_legacy(business_id, name, name_key) AS (
  SELECT business_id, trim(table_identifier), upper(trim(table_identifier))
  FROM table_tabs
  WHERE table_id IS NULL

  UNION ALL

  SELECT business_id, replace(name, '  ', ' '), replace(name_key, '  ', ' ')
  FROM normalized_legacy
  WHERE instr(name, '  ') > 0
),
legacy_names AS (
  SELECT business_id, name, name_key
  FROM normalized_legacy
  WHERE instr(name, '  ') = 0
  GROUP BY business_id, name_key
),
ordered_legacy AS (
  SELECT
    business_id,
    name,
    name_key,
    row_number() OVER (PARTITION BY business_id ORDER BY name_key) AS position
  FROM legacy_names
)
INSERT OR IGNORE INTO tables (
  id, business_id, name, name_key, sort_order, is_active, created_at, updated_at
)
SELECT
  lower(hex(randomblob(16))),
  ordered_legacy.business_id,
  ordered_legacy.name,
  ordered_legacy.name_key,
  COALESCE((
    SELECT max(existing.sort_order)
    FROM tables existing
    WHERE existing.business_id = ordered_legacy.business_id
  ), 0) + ordered_legacy.position,
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM ordered_legacy
WHERE NOT EXISTS (
  SELECT 1
  FROM tables existing
  WHERE existing.business_id = ordered_legacy.business_id
    AND existing.name_key = ordered_legacy.name_key
);

WITH RECURSIVE normalized_tabs(tab_id, business_id, name_key) AS (
  SELECT id, business_id, upper(trim(table_identifier))
  FROM table_tabs
  WHERE table_id IS NULL

  UNION ALL

  SELECT tab_id, business_id, replace(name_key, '  ', ' ')
  FROM normalized_tabs
  WHERE instr(name_key, '  ') > 0
)
UPDATE table_tabs
SET table_id = (
  SELECT matched.id
  FROM normalized_tabs normalized
  JOIN tables matched
    ON matched.business_id = normalized.business_id
   AND matched.name_key = normalized.name_key
  WHERE normalized.tab_id = table_tabs.id
    AND instr(normalized.name_key, '  ') = 0
  LIMIT 1
)
WHERE table_id IS NULL;

DROP INDEX IF EXISTS idx_table_tabs_one_open_per_table;

CREATE UNIQUE INDEX idx_table_tabs_one_open_per_table_id
ON table_tabs (business_id, table_id)
WHERE status = 'open';

CREATE INDEX idx_table_tabs_table_id
ON table_tabs (business_id, table_id, status);
