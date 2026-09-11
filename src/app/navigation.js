import { hasCapability } from './access.js'

export const NAVIGATION_DESTINATIONS = Object.freeze([
  Object.freeze({
    id: 'orders',
    area: 'orders',
    label: 'Cozinha',
    mobileEntry: 'orders',
    capability: 'orders.view',
  }),
  Object.freeze({
    id: 'history',
    area: 'orders',
    label: 'Histórico',
    mobileEntry: 'orders',
    capability: 'orders.history',
  }),
  Object.freeze({
    id: 'new-order',
    area: 'orders',
    label: 'Novo pedido',
    mobileEntry: null,
    capability: 'orders.create',
  }),
  Object.freeze({
    id: 'comandas',
    area: 'comandas',
    label: 'Comandas',
    mobileEntry: 'comandas',
    capability: 'comandas.view',
  }),
  Object.freeze({
    id: 'print-queue',
    area: 'print-queue',
    label: 'Fila de impressão',
    mobileEntry: 'more',
    capability: 'printing.queue',
  }),
  Object.freeze({
    id: 'dashboard',
    area: 'finance',
    label: 'Visão geral',
    mobileEntry: 'finance',
    capability: 'finance.overview',
  }),
  Object.freeze({
    id: 'receivables',
    area: 'finance',
    label: 'A receber',
    mobileEntry: 'finance',
    capability: 'finance.receivables',
  }),
  Object.freeze({
    id: 'finance',
    area: 'finance',
    label: 'Movimentações',
    mobileEntry: 'finance',
    capability: 'finance.movements',
  }),
  Object.freeze({
    id: 'clients',
    area: 'clients',
    label: 'Clientes',
    mobileEntry: 'more',
    capability: 'clients.view',
  }),
  Object.freeze({
    id: 'products',
    area: 'products',
    label: 'Produtos e preços',
    mobileEntry: 'more',
    capability: 'products.view',
  }),
  Object.freeze({
    id: 'tables',
    area: 'tables',
    label: 'Mesas',
    mobileEntry: 'more',
    capability: 'tables.view',
  }),
  Object.freeze({
    id: 'settings-printing',
    area: 'settings',
    label: 'Impressão',
    mobileEntry: 'more',
    anyCapability: Object.freeze([
      'printing.settings',
      'printing.station.configure',
    ]),
  }),
  Object.freeze({
    id: 'settings-device',
    area: 'settings',
    label: 'Preferências deste dispositivo',
    mobileEntry: 'more',
    capability: 'preferences.local',
  }),
])

export const destinations = NAVIGATION_DESTINATIONS

const destinationById = new Map(
  NAVIGATION_DESTINATIONS.map((destination) => [destination.id, destination]),
)

const areaDestinations = Object.freeze({
  orders: Object.freeze(['orders', 'history']),
  finance: Object.freeze(['dashboard', 'receivables', 'finance']),
  settings: Object.freeze(['settings-printing', 'settings-device']),
})

function canAccess(destination, granted) {
  if (destination.capability) {
    return hasCapability(granted, destination.capability)
  }

  return destination.anyCapability.some((key) => hasCapability(granted, key))
}

export function resolveArea(area, granted, implemented) {
  const candidates = areaDestinations[area]
  if (!candidates || !(implemented instanceof Set)) return null

  for (const id of candidates) {
    const destination = destinationById.get(id)
    if (implemented.has(id) && canAccess(destination, granted)) return id
  }

  return null
}

export function resolveDestination(id, granted, implemented) {
  const destination = destinationById.get(id)
  if (!destination) return { status: 'unknown' }
  if (!canAccess(destination, granted)) return { status: 'denied' }
  if (!(implemented instanceof Set) || !implemented.has(id)) {
    return { status: 'unavailable' }
  }

  return { status: 'allowed', id }
}

export function decideNavigation({
  allowed,
  checkoutPending,
  dirtyOrder,
  leavingOrder,
}) {
  if (!allowed) return 'reject'
  if (checkoutPending) return 'blocked'
  if (dirtyOrder && leavingOrder) return 'confirm'
  return 'navigate'
}
