const rows = (result) => Array.isArray(result?.results) ? result.results : []

const normalizeNote = (note) => String(note || '').trim().replace(/\s+/g, ' ')

const itemKey = (row) => JSON.stringify([
  row.product_id || '',
  row.name_snapshot || '',
  row.size_snapshot || '',
  Number(row.unit_price_cents) || 0,
  normalizeNote(row.note),
  row.price_reason || '',
])

export const loadOpenTableTabDetail = async (db, businessId, tableTabId) => {
  const tab = await db.prepare(`SELECT
      tt.id, tt.tab_number, tt.opened_at,
      t.id AS table_id, t.name AS table_name,
      b.name AS business_name
    FROM table_tabs tt
    JOIN tables t ON t.id = tt.table_id AND t.business_id = tt.business_id
    JOIN businesses b ON b.id = tt.business_id
    WHERE tt.id = ? AND tt.business_id = ? AND tt.status = 'open'
    LIMIT 1`).bind(tableTabId, businessId).first()
  if (!tab) return null

  // Keep the payable projection aligned with registerTableTabPayment.
  const ordersResult = await db.prepare(`SELECT o.id, o.total_cents, o.created_at
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id
    WHERE o.business_id = ? AND o.table_tab_id = ?
      AND o.status <> 'Cancelado' AND p.id IS NULL
    ORDER BY o.created_at, o.id`).bind(businessId, tableTabId).all()

  const itemsResult = await db.prepare(`SELECT
      oi.product_id, oi.name_snapshot, oi.size_snapshot, oi.quantity,
      oi.unit_price_cents, oi.price_reason, oi.note, oi.created_at, oi.id
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND o.business_id = oi.business_id
    LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id
    WHERE o.business_id = ? AND o.table_tab_id = ?
      AND o.status <> 'Cancelado' AND p.id IS NULL
    ORDER BY o.created_at, o.id, oi.created_at, oi.id`).bind(businessId, tableTabId).all()

  const grouped = new Map()
  for (const row of rows(itemsResult)) {
    const key = itemKey(row)
    const quantity = Math.max(1, Number(row.quantity) || 1)
    const unitPriceCents = Number(row.unit_price_cents) || 0
    const current = grouped.get(key)
    if (current) {
      current.quantity += quantity
      current.lineTotalCents += unitPriceCents * quantity
    } else {
      grouped.set(key, {
        productId: row.product_id || '',
        name: row.name_snapshot || '',
        presentation: row.size_snapshot || '',
        note: normalizeNote(row.note),
        unitPriceCents,
        quantity,
        lineTotalCents: unitPriceCents * quantity,
      })
    }
  }

  const orders = rows(ordersResult)
  const items = [...grouped.values()]
  return {
    id: tab.id,
    number: Number(tab.tab_number),
    status: 'open',
    openedAt: tab.opened_at,
    businessName: tab.business_name,
    table: { id: tab.table_id, name: tab.table_name },
    orderCount: orders.length,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    totalCents: orders.reduce((sum, order) => sum + Number(order.total_cents || 0), 0),
    items,
  }
}
