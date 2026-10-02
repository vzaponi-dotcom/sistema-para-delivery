// Owned by the application lifetime, above session discovery and form mounting.
// Each account can only reconcile its own immutable request. Nothing is posted
// automatically, and no payload is written to shared browser storage.
export function createProvisioningAttempts() {
  const attempts = new Map(), listeners = new Set()
  const publish = (accountId, value) => { attempts.set(accountId, Object.freeze(value)); for (const listener of listeners) listener() }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot(accountId) { return attempts.get(accountId) || null },
    isBlocking(accountId) { return ['pending', 'uncertain'].includes(attempts.get(accountId)?.status) },
    hasUnresolved() { return [...attempts.values()].some(value => ['pending', 'uncertain'].includes(value.status)) },
    async run(accountId, api, input, randomUUID) {
      const previous = attempts.get(accountId)
      if (previous?.status === 'pending') return null
      if (previous?.status === 'confirmed') return previous.result
      const captured = previous?.status === 'uncertain' ? previous : { key: randomUUID(), input: Object.freeze({ ...input }) }
      publish(accountId, { ...captured, status: 'pending', error: '' })
      try {
        const result = await api.createBusiness(captured.input, captured.key)
        if (!result?.businessId) throw new Error('Cadastro não confirmado.')
        publish(accountId, { ...captured, status: 'confirmed', error: '', result })
        return result
      } catch (cause) {
        const definitive = Number.isInteger(cause?.status) && cause.status >= 400 && cause.status < 500 && cause.status !== 409
        publish(accountId, { ...captured, status: definitive ? 'rejected' : 'uncertain', error: definitive ? cause.message : 'Não foi possível confirmar o cadastro. Verifique esta mesma tentativa antes de criar outra empresa.' })
        return null
      }
    },
    acknowledge(accountId, key) { if (attempts.get(accountId)?.status === 'confirmed' && attempts.get(accountId).key === key) { attempts.delete(accountId); for (const listener of listeners) listener() } },
  }
}
