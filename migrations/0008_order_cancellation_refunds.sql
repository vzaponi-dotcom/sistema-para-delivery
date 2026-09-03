ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE orders ADD COLUMN cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN cancel_reason_note TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_movements_one_order_refund
ON movements (business_id, order_id)
WHERE source = 'order-refund' AND order_id IS NOT NULL;
