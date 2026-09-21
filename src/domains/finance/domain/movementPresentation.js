const movementKey = (movement) => (
  movement?.source === 'order-payment' && movement?.receiptId
    ? `receipt:${movement.receiptId}`
    : null
)

const paymentPart = (movement) => ({
  movementId: movement.id,
  methodLabel: movement.paymentMethod || 'Não informado',
  value: Number(movement.value) || 0,
})

export const groupFinanceMovementsForDisplay = (movements = []) => {
  const rows = Array.isArray(movements) ? movements : []
  const receiptGroups = new Map()

  for (const movement of rows) {
    const key = movementKey(movement)
    if (!key) continue
    const current = receiptGroups.get(key) || []
    current.push(movement)
    receiptGroups.set(key, current)
  }

  const emitted = new Set()
  const display = []

  for (const movement of rows) {
    const key = movementKey(movement)
    if (!key) {
      display.push(movement)
      continue
    }
    if (emitted.has(key)) continue
    emitted.add(key)

    const group = receiptGroups.get(key) || [movement]
    if (group.length === 1) {
      display.push(movement)
      continue
    }

    display.push({
      id: key,
      source: 'order-payment',
      receiptId: movement.receiptId,
      description: movement.description,
      type: movement.type,
      category: movement.category,
      categoryLabel: movement.categoryLabel,
      date: movement.date,
      value: group.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
      paymentMethod: null,
      paymentBreakdown: group.map(paymentPart),
    })
  }

  return display
}
