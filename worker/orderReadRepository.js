import { mapOrderItemRow, mapOrderRow } from './repositories.js'

const rows = (result) => Array.isArray(result?.results) ? result.results : []

const orderSelect = `SELECT o.id, o.client_id, o.client_name_snapshot, o.customer_identity_type, o.table_tab_id, o.type, o.order_date, o.status, o.subtotal_cents, o.delivery_fee_cents, o.adjustment_type, o.adjustment_mode, o.adjustment_value, o.adjustment_amount_cents, o.adjustment_reason, o.total_cents, o.created_at, o.finished_at, p.id AS payment_id, p.method AS payment_method, p.paid_at, p.amount_cents AS paid_amount_cents FROM orders o LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id`
const itemSelect = `SELECT id, order_id, product_id, name_snapshot, category_snapshot, size_snapshot, quantity, catalog_price_cents, unit_price_cents, price_reason, note, created_at FROM order_items`

export const listOrders = async (db, businessId) => {
  const ordersResult = await db.prepare(`${orderSelect} WHERE o.business_id = ? ORDER BY o.created_at DESC`).bind(businessId).all()
  const itemsResult = await db.prepare(`${itemSelect} WHERE business_id = ? ORDER BY created_at ASC`).bind(businessId).all()
  const itemsByOrder = new Map()

  for (const itemRow of rows(itemsResult)) {
    const current = itemsByOrder.get(itemRow.order_id) ?? []
    current.push(mapOrderItemRow(itemRow))
    itemsByOrder.set(itemRow.order_id, current)
  }

  return rows(ordersResult).map((orderRow) => mapOrderRow(orderRow, itemsByOrder.get(orderRow.id) ?? []))
}
