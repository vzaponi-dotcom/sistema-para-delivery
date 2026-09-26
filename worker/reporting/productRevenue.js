export function allocateMerchandiseRevenue({ totalCents, deliveryFeeCents = 0, items = [] }) {
  const revenue = Number(totalCents || 0) - Number(deliveryFeeCents || 0)
  const bases = items.map((item, index) => ({ item, index, base: Number(item.quantity || 0) * Number(item.unitPriceCents || 0) }))
  const totalBase = bases.reduce((sum, entry) => sum + entry.base, 0)
  if (!Number.isInteger(revenue) || revenue < 0 || totalBase <= 0) return []
  const allocated = bases.map((entry) => ({ ...entry, revenueCents: Math.floor((revenue * entry.base) / totalBase) }))
  let remainder = revenue - allocated.reduce((sum, entry) => sum + entry.revenueCents, 0)
  for (const entry of allocated.sort((left, right) => right.base - left.base || left.index - right.index)) {
    if (!remainder) break
    entry.revenueCents += 1
    remainder -= 1
  }
  return allocated.sort((left, right) => left.index - right.index).map(({ item, revenueCents }) => ({ id: item.id, revenueCents }))
}
