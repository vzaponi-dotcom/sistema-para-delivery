export function createExportModel({ items = [] }) {
  return { columns: ['Pedido', 'Total'], rows: items.map((item) => [String(item.order_number || item.id), item.total_cents]) }
}
