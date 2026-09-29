export const KITCHEN_TV_MODALITIES = Object.freeze(['all', 'delivery', 'pickup', 'table'])

const MODALITY_ORDER_TYPE = Object.freeze({
  delivery: 'Entrega',
  pickup: 'Retirada',
  table: 'Local',
})

export const normalizeKitchenTvModality = (value) => (
  KITCHEN_TV_MODALITIES.includes(value) ? value : 'all'
)

export const matchesKitchenTvModality = (order, modality = 'all') => {
  const normalized = normalizeKitchenTvModality(modality)
  return normalized === 'all' || String(order?.type || '') === MODALITY_ORDER_TYPE[normalized]
}

export const filterKitchenTvOrders = (orders = [], modality = 'all') => (
  orders.filter((order) => matchesKitchenTvModality(order, modality))
)

export const countKitchenTvModalities = (orders = []) => {
  const counts = { all: 0, delivery: 0, pickup: 0, table: 0 }
  for (const order of orders) {
    counts.all += 1
    if (order?.type === 'Entrega') counts.delivery += 1
    else if (order?.type === 'Retirada') counts.pickup += 1
    else if (order?.type === 'Local') counts.table += 1
  }
  return counts
}
