-- Normalize payment composition without changing the current writers yet.
-- Historical rows keep their original IDs, amounts, timestamps and method bytes.

CREATE TABLE payments_0026_backup AS
SELECT id, business_id, order_id, amount_cents, method, paid_at, created_at
FROM payments;

CREATE TABLE movements_0026_backup AS
SELECT id, business_id, type, category, description, value_cents, source,
  order_id, payment_id, movement_date, created_at, payment_method, updated_at, deleted_at
FROM movements;

CREATE TABLE payment_receipts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_tab_id TEXT REFERENCES table_tabs(id) ON DELETE SET NULL,
  total_cents INTEGER NOT NULL CHECK (typeof(total_cents) = 'integer' AND total_cents > 0),
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, id)
);

CREATE INDEX payment_receipts_business_paid_idx
ON payment_receipts (business_id, paid_at DESC);

CREATE INDEX payment_receipts_business_table_tab_idx
ON payment_receipts (business_id, table_tab_id)
WHERE table_tab_id IS NOT NULL;

CREATE TABLE payment_allocations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  receipt_id TEXT NOT NULL,
  method_code TEXT,
  method_label TEXT NOT NULL CHECK (length(trim(method_label)) BETWEEN 1 AND 80),
  amount_cents INTEGER NOT NULL CHECK (typeof(amount_cents) = 'integer' AND amount_cents > 0),
  created_at TEXT NOT NULL,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, receipt_id)
    REFERENCES payment_receipts(business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, method_code)
    REFERENCES business_payment_methods(business_id, code)
);

CREATE INDEX payment_allocations_receipt_idx
ON payment_allocations (business_id, receipt_id);

CREATE INDEX payment_allocations_business_method_idx
ON payment_allocations (business_id, method_code, created_at DESC);

CREATE UNIQUE INDEX payment_allocations_receipt_method_idx
ON payment_allocations (business_id, receipt_id, method_code)
WHERE method_code IS NOT NULL;

INSERT INTO payment_receipts (
  id, business_id, table_tab_id, total_cents, paid_at, created_at
)
SELECT
  'legacy-receipt:' || id,
  business_id,
  NULL,
  amount_cents,
  paid_at,
  created_at
FROM payments_0026_backup;

INSERT INTO payment_allocations (
  id, business_id, receipt_id, method_code, method_label, amount_cents, created_at
)
SELECT
  'legacy-allocation:' || payment.id,
  payment.business_id,
  'legacy-receipt:' || payment.id,
  CASE lower(trim(payment.method))
    WHEN 'pix' THEN 'pix'
    WHEN 'cash' THEN 'cash'
    WHEN 'dinheiro' THEN 'cash'
    WHEN 'debit_card' THEN 'debit_card'
    WHEN 'debito' THEN 'debit_card'
    WHEN 'débito' THEN 'debit_card'
    WHEN 'cartao de debito' THEN 'debit_card'
    WHEN 'cartão de débito' THEN 'debit_card'
    WHEN 'credit_card' THEN 'credit_card'
    WHEN 'credito' THEN 'credit_card'
    WHEN 'crédito' THEN 'credit_card'
    WHEN 'cartao de credito' THEN 'credit_card'
    WHEN 'cartão de crédito' THEN 'credit_card'
    WHEN 'transfer' THEN 'transfer'
    WHEN 'transferencia' THEN 'transfer'
    WHEN 'transferência' THEN 'transfer'
    WHEN 'other' THEN 'other'
    WHEN 'outro' THEN 'other'
    ELSE NULL
  END,
  payment.method,
  payment.amount_cents,
  payment.created_at
FROM payments_0026_backup AS payment;

-- Drop the child table first so replacing payments cannot trigger ON DELETE SET NULL
-- against the historical movement rows.
DROP TABLE movements;
DROP TABLE payments;

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  receipt_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  method TEXT,
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (business_id, receipt_id)
    REFERENCES payment_receipts(business_id, id) ON DELETE CASCADE
);

INSERT INTO payments (
  id, business_id, order_id, receipt_id, amount_cents, method, paid_at, created_at
)
SELECT
  id,
  business_id,
  order_id,
  'legacy-receipt:' || id,
  amount_cents,
  method,
  paid_at,
  created_at
FROM payments_0026_backup;

CREATE INDEX payments_business_paid_idx
ON payments (business_id, paid_at DESC);

-- Recreate the lifecycle trigger that belonged to the replaced payments table.
CREATE TRIGGER table_tab_payment_insert_guard
BEFORE INSERT ON payments
WHEN EXISTS (
    SELECT 1
    FROM orders
    WHERE id = NEW.order_id
      AND table_tab_id IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM orders
    JOIN table_tabs
      ON table_tabs.id = orders.table_tab_id
     AND table_tabs.business_id = orders.business_id
    LEFT JOIN payments existing_payment
      ON existing_payment.order_id = orders.id
     AND existing_payment.business_id = orders.business_id
    WHERE orders.id = NEW.order_id
      AND orders.business_id = NEW.business_id
      AND orders.status <> 'Cancelado'
      AND table_tabs.status = 'open'
      AND existing_payment.id IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'TABLE_TAB_PAYMENT_INVALID');
END;

CREATE TABLE movements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  value_cents INTEGER NOT NULL CHECK (value_cents > 0),
  source TEXT NOT NULL DEFAULT 'manual',
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  movement_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payment_method TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  receipt_id TEXT,
  payment_allocation_id TEXT,
  FOREIGN KEY (business_id, receipt_id)
    REFERENCES payment_receipts(business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, payment_allocation_id)
    REFERENCES payment_allocations(business_id, id) ON DELETE CASCADE
);

INSERT INTO movements (
  id, business_id, type, category, description, value_cents, source,
  order_id, payment_id, movement_date, created_at, payment_method, updated_at, deleted_at,
  receipt_id, payment_allocation_id
)
SELECT
  movement.id,
  movement.business_id,
  movement.type,
  movement.category,
  movement.description,
  movement.value_cents,
  movement.source,
  movement.order_id,
  movement.payment_id,
  movement.movement_date,
  movement.created_at,
  movement.payment_method,
  movement.updated_at,
  movement.deleted_at,
  CASE
    WHEN movement.source = 'order-payment' AND movement.payment_id IS NOT NULL
      THEN 'legacy-receipt:' || movement.payment_id
    ELSE NULL
  END,
  CASE
    WHEN movement.source = 'order-payment' AND movement.payment_id IS NOT NULL
      THEN 'legacy-allocation:' || movement.payment_id
    ELSE NULL
  END
FROM movements_0026_backup AS movement;

CREATE INDEX movements_business_created_idx
ON movements (business_id, created_at DESC);

CREATE UNIQUE INDEX idx_movements_one_order_refund
ON movements (business_id, order_id)
WHERE source = 'order-refund' AND order_id IS NOT NULL;

CREATE INDEX movements_business_date_active_idx
ON movements (business_id, movement_date DESC)
WHERE deleted_at IS NULL;

DROP TABLE movements_0026_backup;
DROP TABLE payments_0026_backup;
