import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NAVIGATION_DESTINATIONS,
  AREA_DESTINATION_IDS,
  DESKTOP_NAV_GROUPS,
  MOBILE_DIRECT_ENTRIES,
  MOBILE_MORE_ENTRIES,
  MOBILE_SECTION_IDS,
} from './registry.js'

test('C2 preserva IDs, fallbacks e menus atuais', () => {
  assert.deepEqual(NAVIGATION_DESTINATIONS.map(({ id }) => id), [
    'settings-home', 'settings-operations', 'settings-modalities',
    'settings-payments', 'settings-cancellations', 'settings-finance-categories',
    'orders', 'history', 'new-order', 'comandas', 'print-queue',
    'dashboard', 'receivables', 'finance', 'clients', 'products', 'tables',
    'settings-printing', 'settings-device',
  ])
  assert.deepEqual(AREA_DESTINATION_IDS, {
    orders: ['orders', 'history'],
    finance: ['dashboard', 'receivables', 'finance'],
    settings: [
      'settings-home', 'settings-operations', 'settings-modalities',
      'settings-payments', 'settings-cancellations',
      'settings-finance-categories', 'settings-printing', 'settings-device',
    ],
  })
  assert.deepEqual(DESKTOP_NAV_GROUPS.map(({ label }) => label), ['OPERAÇÃO', 'FINANCEIRO', 'CADASTROS', 'CONFIGURAÇÕES'])
  assert.deepEqual(MOBILE_DIRECT_ENTRIES.map((item) => item.area || item.id), ['orders', 'comandas', 'finance'])
  assert.deepEqual(MOBILE_MORE_ENTRIES.map((item) => item.area || item.id), ['print-queue', 'clients', 'products', 'tables', 'settings'])
  assert.deepEqual(MOBILE_SECTION_IDS, [
    'orders', 'history', 'comandas', 'dashboard', 'receivables', 'finance',
    'print-queue', 'clients', 'products', 'tables', 'settings-printing', 'settings-device',
  ])
})
