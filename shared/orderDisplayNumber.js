export const formatOrderDisplayNumber = (order = {}) => {
  const value = Number(order?.orderNumber)
  return Number.isInteger(value) && value > 0 ? `Pedido #${value}` : 'Pedido'
}
