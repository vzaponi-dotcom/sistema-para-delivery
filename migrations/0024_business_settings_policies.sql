-- Typed settings only: historical operational records and print_jobs stay intact.
CREATE TABLE business_order_modalities (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code IN ('Entrega', 'Retirada', 'Local')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  PRIMARY KEY (business_id, code),
  UNIQUE (business_id, code, active)
);

CREATE TABLE business_operation_settings (
  business_id TEXT NOT NULL PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  scheduled_prep_lead_minutes INTEGER NOT NULL DEFAULT 50
    CHECK (typeof(scheduled_prep_lead_minutes) = 'integer' AND scheduled_prep_lead_minutes BETWEEN 0 AND 240),
  scheduled_late_grace_minutes INTEGER NOT NULL DEFAULT 15
    CHECK (typeof(scheduled_late_grace_minutes) = 'integer' AND scheduled_late_grace_minutes BETWEEN 0 AND 120),
  immediate_late_after_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (typeof(immediate_late_after_minutes) = 'integer' AND immediate_late_after_minutes BETWEEN 1 AND 180),
  immediate_very_late_after_minutes INTEGER NOT NULL DEFAULT 40
    CHECK (typeof(immediate_very_late_after_minutes) = 'integer' AND immediate_very_late_after_minutes BETWEEN 1 AND 240
      AND immediate_very_late_after_minutes > immediate_late_after_minutes),
  default_modality TEXT NOT NULL DEFAULT 'Entrega' CHECK (default_modality IN ('Entrega', 'Retirada', 'Local')),
  default_active INTEGER NOT NULL DEFAULT 1 CHECK (default_active = 1),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(revision) = 'integer' AND revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- The final aggregate must have an active default; allow updates in either order.
  FOREIGN KEY (business_id, default_modality, default_active)
    REFERENCES business_order_modalities(business_id, code, active) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE business_payment_methods (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code IN ('pix', 'cash', 'debit_card', 'credit_card', 'transfer', 'other')),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 80),
  name_key TEXT NOT NULL CHECK (length(trim(name_key)) BETWEEN 1 AND 80),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  is_system INTEGER NOT NULL DEFAULT 1 CHECK (is_system = 1),
  sort_order INTEGER NOT NULL CHECK (typeof(sort_order) = 'integer' AND sort_order BETWEEN 0 AND 5),
  first_used_at TEXT,
  PRIMARY KEY (business_id, code),
  UNIQUE (business_id, code, active),
  UNIQUE (business_id, name_key)
);

CREATE TABLE business_payment_settings (
  business_id TEXT NOT NULL PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  default_method TEXT NOT NULL DEFAULT 'pix' CHECK (default_method IN ('pix', 'cash', 'debit_card', 'credit_card', 'transfer', 'other')),
  default_active INTEGER NOT NULL DEFAULT 1 CHECK (default_active = 1),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(revision) = 'integer' AND revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (business_id, default_method, default_active)
    REFERENCES business_payment_methods(business_id, code, active) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE business_cancellation_settings (
  business_id TEXT NOT NULL PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(revision) = 'integer' AND revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE business_cancel_reasons (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  id TEXT NOT NULL CHECK (length(trim(id)) BETWEEN 1 AND 120),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 80),
  name_key TEXT NOT NULL CHECK (length(trim(name_key)) BETWEEN 1 AND 80),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  is_system INTEGER NOT NULL CHECK (is_system IN (0, 1)),
  requires_note INTEGER NOT NULL DEFAULT 0 CHECK (requires_note IN (0, 1)),
  sort_order INTEGER NOT NULL CHECK (typeof(sort_order) = 'integer' AND sort_order >= 0),
  first_used_at TEXT,
  PRIMARY KEY (business_id, id),
  UNIQUE (business_id, name_key),
  CHECK (is_system = CASE WHEN id IN ('client_changed_mind', 'duplicate_order', 'product_unavailable', 'entry_error', 'other') THEN 1 ELSE 0 END),
  CHECK (requires_note = CASE WHEN id = 'other' THEN 1 ELSE 0 END),
  CHECK (id <> 'other' OR active = 1)
);

CREATE TABLE business_finance_category_settings (
  business_id TEXT NOT NULL PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(revision) = 'integer' AND revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE business_finance_categories (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  id TEXT NOT NULL CHECK (length(trim(id)) BETWEEN 1 AND 120 AND id NOT IN ('sales', 'refunds')),
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 80),
  name_key TEXT NOT NULL CHECK (length(trim(name_key)) BETWEEN 1 AND 80 AND name_key NOT IN ('vendas', 'estornos')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  is_system INTEGER NOT NULL CHECK (is_system IN (0, 1)),
  sort_order INTEGER NOT NULL CHECK (typeof(sort_order) = 'integer' AND sort_order >= 0),
  first_used_at TEXT,
  PRIMARY KEY (business_id, id),
  UNIQUE (business_id, type, name_key)
);

ALTER TABLE business_print_settings ADD COLUMN table_tab_default_copies INTEGER NOT NULL DEFAULT 1 CHECK (table_tab_default_copies IN (1, 2));
ALTER TABLE business_print_settings ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(revision) = 'integer' AND revision >= 1);
ALTER TABLE print_stations ADD COLUMN config_revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(config_revision) = 'integer' AND config_revision >= 1);
ALTER TABLE orders ADD COLUMN timing_policy_snapshot_json TEXT;

CREATE UNIQUE INDEX print_stations_business_id_id_idx ON print_stations (business_id, id);
CREATE TABLE business_print_topology_settings (
  business_id TEXT NOT NULL PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  primary_station_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(revision) = 'integer' AND revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (business_id, primary_station_id) REFERENCES print_stations(business_id, id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE settings_mutation_receipts (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  resource_key TEXT NOT NULL CHECK (length(trim(resource_key)) > 0),
  mutation_id TEXT NOT NULL CHECK (length(trim(mutation_id)) > 0),
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) > 0),
  committed_revision INTEGER NOT NULL CHECK (typeof(committed_revision) = 'integer' AND committed_revision >= 1),
  committed_at TEXT NOT NULL,
  PRIMARY KEY (business_id, resource_key, mutation_id)
);

CREATE TABLE settings_tx_assertions (
  tx_id TEXT NOT NULL,
  check_key TEXT NOT NULL,
  valid INTEGER NOT NULL CHECK (valid = 1),
  PRIMARY KEY (tx_id, check_key)
);

CREATE TRIGGER settings_tx_assertions_insert_guard BEFORE INSERT ON settings_tx_assertions
WHEN NEW.valid IS NOT 1
BEGIN SELECT RAISE(ABORT, 'SETTINGS_TX_ASSERTION_FAILED'); END;
CREATE TRIGGER settings_tx_assertions_update_guard BEFORE UPDATE ON settings_tx_assertions
WHEN NEW.valid IS NOT 1
BEGIN SELECT RAISE(ABORT, 'SETTINGS_TX_ASSERTION_FAILED'); END;

INSERT INTO business_order_modalities (business_id, code, active)
SELECT businesses.id, native.code, 1 FROM businesses CROSS JOIN (
  SELECT 'Entrega' AS code UNION ALL SELECT 'Retirada' UNION ALL SELECT 'Local'
) native;
INSERT INTO business_operation_settings (business_id, created_at, updated_at)
SELECT id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM businesses;

WITH native(code, label, name_key, sort_order) AS (VALUES
  ('pix', 'Pix', 'pix', 0), ('cash', 'Dinheiro', 'dinheiro', 1),
  ('debit_card', 'Cartão de débito', 'cartao de debito', 2),
  ('credit_card', 'Cartão de crédito', 'cartao de credito', 3),
  ('transfer', 'Transferência', 'transferencia', 4), ('other', 'Outro', 'outro', 5)
), historical AS (
  SELECT business_id, method AS method, paid_at AS used_at FROM payments
  UNION ALL
  SELECT business_id, payment_method, created_at FROM movements
)
INSERT INTO business_payment_methods (business_id, code, label, name_key, active, is_system, sort_order, first_used_at)
SELECT businesses.id, native.code, native.label, native.name_key, 1, 1, native.sort_order,
  (SELECT min(used_at) FROM historical WHERE historical.business_id = businesses.id AND historical.method IN (native.code, native.label))
FROM businesses CROSS JOIN native;
INSERT INTO business_payment_settings (business_id, created_at, updated_at)
SELECT id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM businesses;

INSERT INTO business_cancellation_settings (business_id, created_at, updated_at)
SELECT id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM businesses;
WITH native(id, label, name_key, sort_order, requires_note) AS (VALUES
  ('client_changed_mind', 'Cliente desistiu', 'cliente desistiu', 0, 0),
  ('duplicate_order', 'Pedido duplicado', 'pedido duplicado', 1, 0),
  ('product_unavailable', 'Produto indisponível', 'produto indisponivel', 2, 0),
  ('entry_error', 'Erro no lançamento', 'erro no lancamento', 3, 0),
  ('other', 'Outro', 'outro', 4, 1)
)
INSERT INTO business_cancel_reasons (business_id, id, label, name_key, active, is_system, sort_order, requires_note, first_used_at)
SELECT businesses.id, native.id, native.label, native.name_key, 1, 1, native.sort_order, native.requires_note,
  (SELECT min(coalesce(cancelled_at, created_at)) FROM orders WHERE orders.business_id = businesses.id AND orders.cancel_reason = native.id)
FROM businesses CROSS JOIN native;

INSERT INTO business_finance_category_settings (business_id, created_at, updated_at)
SELECT id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM businesses;
WITH native(id, type, label, name_key, sort_order) AS (VALUES
  ('contribution', 'entrada', 'Aporte', 'aporte', 0),
  ('other_income', 'entrada', 'Outros recebimentos', 'outros recebimentos', 1),
  ('supplies', 'saida', 'Insumos', 'insumos', 0),
  ('packaging', 'saida', 'Embalagens', 'embalagens', 1),
  ('delivery_costs', 'saida', 'Delivery / Frete', 'delivery / frete', 2),
  ('gas', 'saida', 'Gás', 'gas', 3), ('water', 'saida', 'Água', 'agua', 4),
  ('electricity', 'saida', 'Energia', 'energia', 5), ('rent', 'saida', 'Aluguel', 'aluguel', 6),
  ('maintenance', 'saida', 'Manutenção', 'manutencao', 7), ('fees', 'saida', 'Taxas', 'taxas', 8),
  ('owner_draw', 'saida', 'Retirada', 'retirada', 9), ('other_expense', 'saida', 'Outros', 'outros', 10)
), historical AS (
  -- Same legacy aliases as normalizeMovementCategory; soft-deleted references count.
  SELECT business_id, type, created_at,
    CASE trim(category)
      WHEN 'Insumos' THEN 'supplies' WHEN 'Delivery' THEN 'delivery_costs' WHEN 'Despesas' THEN 'other_expense'
      WHEN 'Outros' THEN CASE type WHEN 'entrada' THEN 'other_income' ELSE 'other_expense' END
      ELSE trim(category)
    END AS category
  FROM movements
)
INSERT INTO business_finance_categories (business_id, id, type, label, name_key, active, is_system, sort_order, first_used_at)
SELECT businesses.id, native.id, native.type, native.label, native.name_key, 1, 1, native.sort_order,
  (SELECT min(created_at) FROM historical WHERE historical.business_id = businesses.id AND historical.type = native.type AND historical.category = native.id)
FROM businesses CROSS JOIN native;

-- Fill only missing headers; never overwrite any pre-B copy-count override.
INSERT INTO business_print_settings (business_id, default_copies, created_at, updated_at)
SELECT id, 2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM businesses WHERE NOT EXISTS (SELECT 1 FROM business_print_settings existing WHERE existing.business_id = businesses.id);
INSERT INTO business_print_topology_settings (business_id, primary_station_id, created_at, updated_at)
SELECT businesses.id,
  (SELECT id FROM print_stations WHERE business_id = businesses.id AND is_primary = 1),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM businesses;

-- First-use evidence survives edits/removal of operational references.
CREATE TRIGGER business_payment_methods_usage_guard BEFORE UPDATE OF first_used_at ON business_payment_methods
WHEN OLD.first_used_at IS NOT NULL AND NEW.first_used_at IS NOT OLD.first_used_at
BEGIN SELECT RAISE(ABORT, 'SETTINGS_USAGE_PERMANENT'); END;
CREATE TRIGGER business_cancel_reasons_usage_guard BEFORE UPDATE OF first_used_at ON business_cancel_reasons
WHEN OLD.first_used_at IS NOT NULL AND NEW.first_used_at IS NOT OLD.first_used_at
BEGIN SELECT RAISE(ABORT, 'SETTINGS_USAGE_PERMANENT'); END;
CREATE TRIGGER business_finance_categories_usage_guard BEFORE UPDATE OF first_used_at ON business_finance_categories
WHEN OLD.first_used_at IS NOT NULL AND NEW.first_used_at IS NOT OLD.first_used_at
BEGIN SELECT RAISE(ABORT, 'SETTINGS_USAGE_PERMANENT'); END;

CREATE TRIGGER business_payment_methods_identity_guard BEFORE UPDATE ON business_payment_methods
WHEN NEW.business_id IS NOT OLD.business_id OR NEW.code IS NOT OLD.code
  OR NEW.label IS NOT OLD.label OR NEW.name_key IS NOT OLD.name_key OR NEW.is_system IS NOT OLD.is_system
BEGIN SELECT RAISE(ABORT, 'SETTINGS_CATALOG_IDENTITY_PROTECTED'); END;
CREATE TRIGGER business_cancel_reasons_identity_guard BEFORE UPDATE ON business_cancel_reasons
WHEN NEW.business_id IS NOT OLD.business_id OR NEW.id IS NOT OLD.id OR NEW.is_system IS NOT OLD.is_system
  OR ((OLD.is_system = 1 OR OLD.first_used_at IS NOT NULL) AND (NEW.label IS NOT OLD.label OR NEW.name_key IS NOT OLD.name_key))
BEGIN SELECT RAISE(ABORT, 'SETTINGS_CATALOG_IDENTITY_PROTECTED'); END;
CREATE TRIGGER business_finance_categories_identity_guard BEFORE UPDATE ON business_finance_categories
WHEN NEW.business_id IS NOT OLD.business_id OR NEW.id IS NOT OLD.id OR NEW.is_system IS NOT OLD.is_system OR NEW.type IS NOT OLD.type
  OR ((OLD.is_system = 1 OR OLD.first_used_at IS NOT NULL) AND (NEW.label IS NOT OLD.label OR NEW.name_key IS NOT OLD.name_key))
BEGIN SELECT RAISE(ABORT, 'SETTINGS_CATALOG_IDENTITY_PROTECTED'); END;

-- Business deletion may still cascade; catalog mutation cannot remove native/used identities.
CREATE TRIGGER business_payment_methods_delete_guard BEFORE DELETE ON business_payment_methods
WHEN EXISTS (SELECT 1 FROM businesses WHERE id = OLD.business_id)
BEGIN SELECT RAISE(ABORT, 'SETTINGS_CATALOG_IDENTITY_PROTECTED'); END;
CREATE TRIGGER business_cancel_reasons_delete_guard BEFORE DELETE ON business_cancel_reasons
WHEN (OLD.is_system = 1 OR OLD.first_used_at IS NOT NULL) AND EXISTS (SELECT 1 FROM businesses WHERE id = OLD.business_id)
BEGIN SELECT RAISE(ABORT, 'SETTINGS_CATALOG_IDENTITY_PROTECTED'); END;
CREATE TRIGGER business_finance_categories_delete_guard BEFORE DELETE ON business_finance_categories
WHEN (OLD.is_system = 1 OR OLD.first_used_at IS NOT NULL) AND EXISTS (SELECT 1 FROM businesses WHERE id = OLD.business_id)
BEGIN SELECT RAISE(ABORT, 'SETTINGS_CATALOG_IDENTITY_PROTECTED'); END;
