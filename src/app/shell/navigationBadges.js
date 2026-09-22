const normalizedCount = (value) => {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

const copy = {
  orders: (count) => `${count} ${count === 1 ? 'pedido em andamento' : 'pedidos em andamento'}`,
  comandas: (count) => `${count} ${count === 1 ? 'comanda aberta' : 'comandas abertas'}`,
}

export const getNavigationBadge = (entry, badges = {}) => {
  const formatter = copy[entry?.id]
  if (!formatter) return null
  const count = normalizedCount(badges[entry.id])
  if (!count) return null
  return { count, text: count > 99 ? '99+' : String(count), ariaLabel: `${entry.label}, ${formatter(count)}` }
}
