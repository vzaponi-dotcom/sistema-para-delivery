ALTER TABLE orders ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX orders_business_idempotency_idx
ON orders (business_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;
