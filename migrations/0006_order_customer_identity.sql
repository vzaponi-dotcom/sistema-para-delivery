ALTER TABLE orders ADD COLUMN customer_identity_type TEXT NOT NULL DEFAULT 'registered_client';
ALTER TABLE orders ADD COLUMN guest_name TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN table_label TEXT NOT NULL DEFAULT '';

UPDATE orders
SET customer_identity_type = 'registered_client',
    guest_name = '',
    table_label = '';
