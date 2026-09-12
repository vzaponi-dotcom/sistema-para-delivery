import test from 'node:test'
import assert from 'node:assert/strict'
import { MOBILE_SECTION_IDS } from './mobileNavigation.js'

test('mobile sections keep the approved navigation order for page transitions', () => {
  assert.deepEqual(MOBILE_SECTION_IDS, [
    'orders',
    'history',
    'comandas',
    'dashboard',
    'receivables',
    'finance',
    'print-queue',
    'clients',
    'products',
    'tables',
    'settings-printing',
    'settings-device',
  ])
})
