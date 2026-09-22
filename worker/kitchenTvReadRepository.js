import { loadOperations } from './operationSettingsRepository.js'

const rows = (result) => Array.isArray(result?.results) ? result.results : []

const ACTIVE_ORDERS_SELECT = `SELECT id, order_number, client_name_snapshot, type,
  status, order_date, created_at, scheduled_for
  FROM orders
  WHERE business_id = ?
    AND status NOT IN ('Finalizado', 'Cancelado', 'Entregue', 'Despachado')
    AND finished_at IS NULL
    AND cancelled_at IS NULL
  ORDER BY created_at ASC, id ASC`

const ACTIVE_ITEMS_SELECT = `SELECT i.order_id, i.quantity, i.name_snapshot, i.note
  FROM order_items i
  INNER JOIN orders o ON o.id = i.order_id AND o.business_id = i.business_id
  WHERE i.business_id = ?
    AND o.status NOT IN ('Finalizado', 'Cancelado', 'Entregue', 'Despachado')
    AND o.finished_at IS NULL
    AND o.cancelled_at IS NULL
  ORDER BY i.created_at ASC, i.id ASC`

export async function loadKitchenTvState(db, businessId) {
  const [operations, ordersResult, itemsResult] = await Promise.all([
    loadOperations(db, businessId),
    db.prepare(ACTIVE_ORDERS_SELECT).bind(businessId).all(),
    db.prepare(ACTIVE_ITEMS_SELECT).bind(businessId).all(),
  ])
  const itemsByOrder = new Map()
  for (const row of rows(itemsResult)) {
    const items = itemsByOrder.get(row.order_id) ?? []
    items.push({ quantity: row.quantity, name: row.name_snapshot, note: row.note || '' })
    itemsByOrder.set(row.order_id, items)
  }

  return {
    timing: { ...operations.data.timing },
    orders: rows(ordersResult).map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      client: row.client_name_snapshot,
      type: row.type,
      status: row.status,
      orderDate: row.order_date,
      createdAt: row.created_at,
      scheduledFor: row.scheduled_for,
      items: itemsByOrder.get(row.id) ?? [],
    })),
  }
}
