ALTER TABLE orders ADD COLUMN order_number INTEGER;

WITH numbered_orders AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id
      ORDER BY created_at ASC, id ASC
    ) AS order_number
  FROM orders
)
UPDATE orders
SET order_number = (
  SELECT numbered_orders.order_number
  FROM numbered_orders
  WHERE numbered_orders.id = orders.id
);

CREATE UNIQUE INDEX orders_business_order_number_idx
ON orders (business_id, order_number);

CREATE TABLE order_sequences (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  last_order_number INTEGER NOT NULL CHECK (last_order_number >= 0)
);

INSERT INTO order_sequences (business_id, last_order_number)
SELECT business_id, MAX(order_number)
FROM orders
GROUP BY business_id;
