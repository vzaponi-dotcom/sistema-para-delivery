const normalizeContext = ({ returnDestination = 'orders', tableId = '', expectedTableTabId = '' } = {}) => ({
  returnDestination,
  tableId,
  expectedTableTabId,
})

export const createNewOrderDraftController = ({ randomUUID = () => crypto.randomUUID() } = {}) => {
  let generation = 0
  let current = null
  const snapshot = () => ({
    context: current ? { ...current.context } : null,
    dirty: Boolean(current?.dirty),
    renderKey: current ? `new-order:${current.generation}` : null,
  })
  const invalidate = () => { generation += 1; current = null }
  return Object.freeze({
    snapshot,
    open(context) {
      generation += 1
      current = { generation, context: normalizeContext(context), dirty: false, idempotencyKey: randomUUID() }
      return snapshot()
    },
    discard() { invalidate(); return snapshot() },
    setDirty(value) { if (current) current.dirty = Boolean(value); return snapshot() },
    beginSubmit() {
      if (!current) return null
      return Object.freeze({ generation: current.generation, idempotencyKey: current.idempotencyKey, context: { ...current.context } })
    },
    isCurrent(token) { return Boolean(current && token?.generation === current.generation) },
    complete(token) {
      if (!current || token?.generation !== current.generation) return false
      invalidate()
      return true
    },
  })
}
