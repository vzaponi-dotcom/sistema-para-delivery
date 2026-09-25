import { allocateMerchandiseRevenue } from './productRevenue.js'

const round = (value) => Number(value.toFixed(2))
export const productIdentity = (row) => row.product_id || JSON.stringify([row.category_snapshot, row.name_snapshot, row.size_snapshot])

export function calculateProducts(lines, query = {}) {
  const orders = new Map()
  for (const line of lines) {
    const order = orders.get(line.order_id) || { totalCents: line.total_cents, deliveryFeeCents: line.delivery_fee_cents, items: [] }
    order.items.push({
      id: line.item_id, quantity: line.quantity, unitPriceCents: line.unit_price_cents, source: line,
    })
    orders.set(line.order_id, order)
  }
  const products = new Map()
  const categories = new Map()
  const presentations = new Map()
  let unitsSold = 0
  let mealsSold = 0
  let merchandiseRevenueCents = 0
  for (const order of orders.values()) {
    const allocated = new Map(allocateMerchandiseRevenue(order).map(({ id, revenueCents }) => [id, revenueCents]))
    for (const item of order.items) {
      const line = item.source
      const id = productIdentity(line)
      if (query.category && line.category_snapshot.toLowerCase() !== query.category.toLowerCase()) continue
      if (query.product && id !== query.product) continue
      const revenueCents = allocated.get(item.id) || 0
      const quantity = Number(line.quantity)
      const existing = products.get(id) || {
        id, productId: line.product_id, name: line.name_snapshot,
        category: line.category_snapshot, size: line.size_snapshot,
        quantity: 0, revenueCents: 0,
      }
      existing.name = line.name_snapshot // last historical snapshot, not current catalog
      existing.quantity += quantity
      existing.revenueCents += revenueCents
      products.set(id, existing)
      const category = categories.get(line.category_snapshot) || { category: line.category_snapshot, quantity: 0, revenueCents: 0 }
      category.quantity += quantity
      category.revenueCents += revenueCents
      categories.set(category.category, category)
      const sizeKey = `${id}|${line.size_snapshot}`
      const presentation = presentations.get(sizeKey) || { productId: id, name: line.name_snapshot, size: line.size_snapshot, quantity: 0, revenueCents: 0 }
      presentation.quantity += quantity
      presentation.revenueCents += revenueCents
      presentations.set(sizeKey, presentation)
      unitsSold += quantity
      if (['refeições', 'marmita'].includes(line.category_snapshot.toLowerCase())) mealsSold += quantity
      merchandiseRevenueCents += revenueCents
    }
  }
  const ranking = [...products.values()].map((item) => ({ ...item, sharePercent: merchandiseRevenueCents ? round(item.revenueCents * 100 / merchandiseRevenueCents) : 0 }))
    .sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity || a.id.localeCompare(b.id))
  return {
    unitsSold, mealsSold, merchandiseRevenueCents,
    ranking, top10: ranking.slice(0, 10),
    categories: [...categories.values()].sort((a, b) => b.revenueCents - a.revenueCents || a.category.localeCompare(b.category)),
    presentations: [...presentations.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
  }
}
