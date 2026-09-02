ALTER TABLE orders ADD COLUMN customer_identity_type TEXT NOT NULL DEFAULT 'registered_client';

UPDATE orders
SET customer_identity_type = 'guest_name'
WHERE client_id IS NULL;
