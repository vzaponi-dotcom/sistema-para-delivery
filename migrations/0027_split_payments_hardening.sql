-- Make the receipt/allocation model mandatory for every new sale payment.
-- Historical rows were normalized by 0026 before these guards are installed.

CREATE TRIGGER split_payment_insert_guard
BEFORE INSERT ON payments
WHEN NEW.receipt_id IS NULL OR NEW.method IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'SPLIT_PAYMENT_REQUIRED');
END;

CREATE TRIGGER split_payment_update_guard
BEFORE UPDATE OF receipt_id, method ON payments
WHEN NEW.receipt_id IS NULL OR NEW.method IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'SPLIT_PAYMENT_REQUIRED');
END;

CREATE TRIGGER split_payment_movement_insert_guard
BEFORE INSERT ON movements
WHEN NEW.source = 'order-payment'
  AND (NEW.receipt_id IS NULL OR NEW.payment_allocation_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'SPLIT_PAYMENT_MOVEMENT_REQUIRED');
END;

CREATE TRIGGER split_payment_movement_update_guard
BEFORE UPDATE OF source, receipt_id, payment_allocation_id ON movements
WHEN NEW.source = 'order-payment'
  AND (NEW.receipt_id IS NULL OR NEW.payment_allocation_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'SPLIT_PAYMENT_MOVEMENT_REQUIRED');
END;
