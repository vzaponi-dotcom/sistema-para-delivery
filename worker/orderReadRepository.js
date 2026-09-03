import { mapOrderItemRow, mapOrderRow } from './repositories.js'
import { ORDER_ITEM_SELECT, ORDER_SELECT } from './orderReadSql.js'

const rows = (result) => Array.isArray(result?.results) ? result.results : []

export const listOrders = async (db, businessId) => {
  const ordersResult = await db.prepare(`${ORDER_SELECT} WHERE o.business_id = ? ORDER BY o.created_at DESC`).bind(businessId).all()
  const itemsResult = await db.prepare(`${ORDER_ITEM_SELECT} WHERE business_id = ? ORDER BY created_at ASC`).bind(businessId).all()
  const itemsByOrder = new Map()

  for (const itemRow of rows(itemsResult)) {
    const current = itemsByOrder.get(itemRow.order_id) ?? []
    current.push(mapOrderItemRow(itemRow))
    itemsByOrder.set(itemRow.order_id, current)
  }

  return rows(ordersResult).map((orderRow) => mapOrderRow(orderRow, itemsByOrder.get(orderRow.id) ?? []))
}
