export const CAPABILITIES = Object.freeze([
  'orders.view',
  'orders.history',
  'orders.analysis',
  'comandas.view',
  'printing.queue',
  'finance.overview',
  'finance.receivables',
  'finance.movements',
  'clients.view',
  'products.view',
  'tables.view',
  'printing.settings',
  'preferences.local',
  'orders.create',
  'orders.finalize',
  'orders.cancel',
  'orders.discount',
  'payments.receive',
  'payments.refund',
  'comandas.transfer',
  'clients.manage',
  'products.manage',
  'tables.manage',
  'finance.movements.manage',
  'finance.promises.manage',
  'printing.execute',
  'printing.discard',
  'printing.station.configure',
])

const knownCapabilities = new Set(CAPABILITIES)

export function hasCapability(granted, key) {
  return (
    granted instanceof Set &&
    knownCapabilities.has(key) &&
    granted.has(key)
  )
}

export function legacyCapabilities(authenticated) {
  return authenticated ? new Set(CAPABILITIES) : new Set()
}
