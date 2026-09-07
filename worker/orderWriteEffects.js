import { mapMovementRow } from './financeRepository.js'
import { mapTableTabRow } from './repositories.js'

export const loadMovementByOrderSource = async (db, businessId, orderId, source) => {
  if (!orderId || !source) return null
  const row = await db.prepare(`SELECT m.id, m.type, m.category, m.description, m.value_cents, m.source, m.order_id, m.payment_id,
    CASE WHEN m.source = 'order-payment' THEN COALESCE(m.payment_method, p.method) ELSE m.payment_method END AS payment_method,
    m.movement_date, m.created_at, m.updated_at
    FROM movements m
    LEFT JOIN payments p ON p.id = m.payment_id AND p.business_id = m.business_id
    WHERE m.business_id = ? AND m.order_id = ? AND m.source = ? AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC LIMIT 1`).bind(businessId, orderId, source).first()
  return row ? mapMovementRow(row) : null
}

export const loadTableTabById = async (db, businessId, tableTabId) => {
  if (!tableTabId) return null
  const row = await db.prepare(`SELECT id, table_id, table_identifier, status, opened_at, closed_at
    FROM table_tabs WHERE id = ? AND business_id = ? LIMIT 1`).bind(tableTabId, businessId).first()
  return row ? mapTableTabRow(row) : null
}
