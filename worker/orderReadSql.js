export const ORDER_SELECT = `SELECT o.id, o.client_id, o.client_name_snapshot,
  o.client_phone_snapshot, o.client_address_snapshot,
  o.customer_identity_type, o.table_tab_id, o.type, o.order_date, o.status,
  o.scheduled_for, o.is_backdated, o.subtotal_cents, o.delivery_fee_cents, o.adjustment_type, o.adjustment_mode,
  o.adjustment_value, o.adjustment_amount_cents, o.adjustment_reason, o.total_cents,
  o.created_at, o.finished_at, o.cancelled_at, o.cancel_reason, o.cancel_reason_note,
  p.id AS payment_id, p.method AS payment_method, p.paid_at,
  p.amount_cents AS paid_amount_cents,
  r.id AS refund_movement_id, r.created_at AS refund_created_at
  FROM orders o
  LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id
  LEFT JOIN movements r ON r.order_id = o.id AND r.business_id = o.business_id
    AND r.source = 'order-refund'`

export const ORDER_ITEM_SELECT = `SELECT id, order_id, product_id, name_snapshot,
  category_snapshot, size_snapshot, quantity, catalog_price_cents, unit_price_cents,
  price_reason, note, created_at FROM order_items`
