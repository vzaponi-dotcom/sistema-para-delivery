export const NAVIGATION_DESTINATIONS = Object.freeze([
  Object.freeze({ id: 'settings-home', area: 'settings', label: 'Configurações', mobileEntry: 'more', anyCapability: Object.freeze(['operations.settings.view', 'payments.settings.view', 'orders.settings.view', 'finance.categories.view', 'printing.settings.view', 'printing.settings', 'printing.station.view', 'preferences.local']) }),
  Object.freeze({ id: 'settings-operations', area: 'settings', label: 'Operação', mobileEntry: 'more', capability: 'operations.settings.view' }),
  Object.freeze({ id: 'settings-modalities', area: 'settings', label: 'Modalidades de pedido', mobileEntry: 'more', capability: 'operations.settings.view' }),
  Object.freeze({ id: 'settings-payments', area: 'settings', label: 'Formas de pagamento', mobileEntry: 'more', capability: 'payments.settings.view' }),
  Object.freeze({ id: 'settings-cancellations', area: 'settings', label: 'Motivos de cancelamento', mobileEntry: 'more', capability: 'orders.settings.view' }),
  Object.freeze({ id: 'settings-finance-categories', area: 'settings', label: 'Categorias financeiras', mobileEntry: 'more', capability: 'finance.categories.view' }),
  Object.freeze({ id: 'settings-kitchen-tv', area: 'settings', label: 'TV da Cozinha', mobileEntry: 'more', capability: 'orders.settings.view' }),
  Object.freeze({ id: 'orders', area: 'orders', label: 'Cozinha', mobileEntry: 'orders', capability: 'orders.view' }),
  Object.freeze({ id: 'history', area: 'orders', label: 'Histórico', mobileEntry: 'orders', capability: 'orders.history' }),
  Object.freeze({ id: 'new-order', area: 'orders', label: 'Novo pedido', mobileEntry: null, capability: 'orders.create' }),
  Object.freeze({ id: 'comandas', area: 'comandas', label: 'Comandas', mobileEntry: 'comandas', capability: 'comandas.view' }),
  Object.freeze({ id: 'print-queue', area: 'print-queue', label: 'Fila de impressão', mobileEntry: 'more', capability: 'printing.queue' }),
  Object.freeze({ id: 'dashboard', area: 'finance', label: 'Visão geral', mobileEntry: 'finance', capability: 'finance.overview' }),
  Object.freeze({ id: 'receivables', area: 'finance', label: 'A receber', mobileEntry: 'finance', capability: 'finance.receivables' }),
  Object.freeze({ id: 'finance', area: 'finance', label: 'Movimentações', mobileEntry: 'finance', capability: 'finance.movements' }),
  Object.freeze({ id: 'clients', area: 'clients', label: 'Clientes', mobileEntry: 'more', capability: 'clients.view' }),
  Object.freeze({ id: 'products', area: 'products', label: 'Produtos e preços', mobileEntry: 'more', capability: 'products.view' }),
  Object.freeze({ id: 'tables', area: 'tables', label: 'Mesas', mobileEntry: 'more', capability: 'tables.view' }),
  Object.freeze({ id: 'settings-printing', area: 'settings', label: 'Impressão', mobileEntry: 'more', anyCapability: Object.freeze(['printing.settings.view', 'printing.settings', 'printing.station.view', 'printing.station.configure']) }),
  Object.freeze({ id: 'settings-device', area: 'settings', label: 'Preferências deste dispositivo', mobileEntry: 'more', capability: 'preferences.local' }),
])

export const destinationById = new Map(NAVIGATION_DESTINATIONS.map((item) => [item.id, item]))

export const AREA_DESTINATION_IDS = Object.freeze({
  orders: Object.freeze(['orders', 'history']),
  finance: Object.freeze(['dashboard', 'receivables', 'finance']),
  settings: Object.freeze(['settings-home', 'settings-operations', 'settings-modalities', 'settings-payments', 'settings-cancellations', 'settings-finance-categories', 'settings-kitchen-tv', 'settings-printing', 'settings-device']),
})

export const HOME_AREA_ORDER = Object.freeze(['orders', 'finance', 'settings'])
export const AREA_LABELS = Object.freeze({ orders: 'Pedidos', finance: 'Financeiro', settings: 'Configurações' })

export const DESKTOP_NAV_GROUPS = Object.freeze([
  Object.freeze({ label: 'OPERAÇÃO', items: Object.freeze([{ area: 'orders', label: 'Pedidos', icon: 'orders' }, { id: 'comandas', label: 'Comandas', icon: 'clipboard' }, { id: 'print-queue', label: 'Fila de impressão', icon: 'printer' }]) }),
  Object.freeze({ label: 'FINANCEIRO', items: Object.freeze([{ id: 'dashboard', label: 'Visão geral', icon: 'dashboard' }, { id: 'receivables', label: 'A receber', icon: 'wallet' }, { id: 'finance', label: 'Movimentações', icon: 'finance' }]) }),
  Object.freeze({ label: 'CADASTROS', items: Object.freeze([{ id: 'clients', label: 'Clientes', icon: 'clients' }, { id: 'products', label: 'Produtos e preços', icon: 'products' }, { id: 'tables', label: 'Mesas', icon: 'table' }]) }),
])

export const MOBILE_DIRECT_ENTRIES = Object.freeze([
  Object.freeze({ area: 'orders', label: 'Pedidos', icon: 'orders' }),
  Object.freeze({ id: 'comandas', label: 'Comandas', icon: 'clipboard' }),
  Object.freeze({ area: 'finance', label: 'Financeiro', icon: 'finance' }),
])

export const MOBILE_MORE_ENTRIES = Object.freeze([
  Object.freeze({ id: 'print-queue', icon: 'printer' }),
  Object.freeze({ id: 'clients', icon: 'clients' }),
  Object.freeze({ id: 'products', icon: 'products' }),
  Object.freeze({ id: 'tables', icon: 'table' }),
  Object.freeze({ area: 'settings', icon: 'settings', label: 'Configurações' }),
])

export const MOBILE_SECTION_IDS = Object.freeze([
  'orders', 'history', 'comandas', 'dashboard', 'receivables', 'finance',
  'print-queue', 'clients', 'products', 'tables', 'settings-kitchen-tv', 'settings-printing', 'settings-device',
])
