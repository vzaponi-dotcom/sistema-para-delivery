-- Keep table-tab lifecycle checks at the SQLite write boundary so D1 batches
-- cannot commit an order against a closed tab or close over unpaid work.
-- This migration depends only on the tables introduced by 0001 and 0007;
-- it intentionally has no dependency on printing migrations 0014-0019.

CREATE TRIGGER table_tab_order_insert_guard
BEFORE INSERT ON orders
WHEN NEW.table_tab_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM table_tabs
    WHERE id = NEW.table_tab_id
      AND business_id = NEW.business_id
      AND status = 'open'
  )
BEGIN
  SELECT RAISE(ABORT, 'TABLE_TAB_NOT_OPEN');
END;

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

CREATE TRIGGER table_tab_close_guard
BEFORE UPDATE OF status ON table_tabs
WHEN OLD.status = 'open'
  AND NEW.status = 'closed'
  AND EXISTS (
    SELECT 1
    FROM orders
    LEFT JOIN payments
      ON payments.order_id = orders.id
     AND payments.business_id = orders.business_id
    WHERE orders.business_id = OLD.business_id
      AND orders.table_tab_id = OLD.id
      AND orders.status <> 'Cancelado'
      AND payments.id IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'TABLE_TAB_HAS_UNPAID_ORDERS');
END;
