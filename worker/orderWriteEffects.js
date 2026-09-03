import { mapMovementRow, mapTableTabRow } from './repositories.js'

export const loadMovementByOrderSource = async (db, businessId, orderId, source) => {
  if (!orderId || !source) return null
  const row = await db.prepare(`SELECT id, type, category, description, value_cents, source, order_id, payment_id, movement_date, created_at
    FROM movements
    WHERE business_id = ? AND order_id = ? AND source = ?
    ORDER BY created_at DESC LIMIT 1`).bind(businessId, orderId, source).first()
  return row ? mapMovementRow(row) : null
}

export const loadTableTabById = async (db, businessId, tableTabId) => {
  if (!tableTabId) return null
  const row = await db.prepare(`SELECT id, table_identifier, status, opened_at, closed_at
    FROM table_tabs WHERE id = ? AND business_id = ? LIMIT 1`).bind(tableTabId, businessId).first()
  return row ? mapTableTabRow(row) : null
}
