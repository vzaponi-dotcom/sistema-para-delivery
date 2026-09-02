ALTER TABLE orders ADD COLUMN delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0);
ALTER TABLE order_items ADD COLUMN note TEXT NOT NULL DEFAULT '';
