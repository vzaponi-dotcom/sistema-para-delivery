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
  // One statement keeps tab eligibility, payable orders and items in the same
  // read snapshot. Keep the pending predicate aligned with registerTableTabPayment.
  const result = await db.prepare(`SELECT
      tt.id, tt.tab_number, tt.opened_at,
      t.id AS table_id, t.name AS table_name,
      b.name AS business_name,
      o.id AS order_id, o.total_cents AS order_total_cents,
      oi.id AS item_id, oi.product_id, oi.name_snapshot, oi.size_snapshot,
      oi.quantity, oi.unit_price_cents, oi.price_reason, oi.note
    FROM table_tabs tt
    JOIN tables t ON t.id = tt.table_id AND t.business_id = tt.business_id
    JOIN businesses b ON b.id = tt.business_id
    LEFT JOIN orders o
      ON o.table_tab_id = tt.id AND o.business_id = tt.business_id
      AND o.status <> 'Cancelado'
      AND NOT EXISTS (
        SELECT 1 FROM payments p
        WHERE p.order_id = o.id AND p.business_id = o.business_id
      )
    LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.business_id = o.business_id
    WHERE tt.id = ? AND tt.business_id = ? AND tt.status = 'open'
    ORDER BY o.created_at, o.id, oi.created_at, oi.id`).bind(tableTabId, businessId).all()
  const detailRows = rows(result)
  const tab = detailRows[0]
  if (!tab) return null

  const orderTotals = new Map()
  const grouped = new Map()
  for (const row of detailRows) {
    // The join repeats an order's payable total for every item. Deduplicate by
    // order identity, never by amount; orders without items still contribute.
    if (row.order_id != null) {
      orderTotals.set(row.order_id, Number(row.order_total_cents) || 0)
    }
    if (row.item_id == null) continue
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

  const items = [...grouped.values()]
  return {
    id: tab.id,
    number: Number(tab.tab_number),
    status: 'open',
    openedAt: tab.opened_at,
    businessName: tab.business_name,
    table: { id: tab.table_id, name: tab.table_name },
    orderCount: orderTotals.size,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    totalCents: [...orderTotals.values()].reduce((sum, total) => sum + total, 0),
    items,
  }
}
