PRAGMA foreign_keys = ON;

ALTER TABLE orders ADD COLUMN promised_payment_date TEXT;

CREATE INDEX orders_business_promised_payment_idx
  ON orders (business_id, promised_payment_date);
