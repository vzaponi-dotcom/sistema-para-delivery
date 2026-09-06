import test from 'node:test'
import assert from 'node:assert/strict'
import { MOBILE_SECTION_IDS } from './mobileNavigation.js'

test('mobile sections keep the approved navigation order for page transitions', () => {
  assert.deepEqual(MOBILE_SECTION_IDS, [
    'dashboard',
    'orders',
    'clients',
    'products',
    'receivables',
    'finance',
  ])
})
