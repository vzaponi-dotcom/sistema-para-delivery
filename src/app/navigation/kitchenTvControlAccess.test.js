import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { hasCapability, legacyCapabilities } from '../access.js'
import {
  AREA_DESTINATION_IDS,
  MOBILE_DIRECT_ENTRIES,
  MOBILE_MORE_ENTRIES,
  MOBILE_SECTION_IDS,
  NAVIGATION_DESTINATIONS,
} from './registry.js'
import { resolveDestination } from './resolution.js'

test('Kitchen TV control has a read route separated from its action capability', () => {
  const destination = NAVIGATION_DESTINATIONS.find(({ id }) => id === 'kitchen-tv-control')
  assert.deepEqual(destination, {
    id: 'kitchen-tv-control',
    path: '/pedidos/controle-da-tv',
    area: 'orders',
    label: 'Controle da TV',
    mobileEntry: 'orders',
    capability: 'orders.view',
  })

  const implemented = new Set(NAVIGATION_DESTINATIONS.map(({ id }) => id))
  assert.deepEqual(
    resolveDestination('kitchen-tv-control', new Set(['orders.view']), implemented),
    { status: 'allowed', id: 'kitchen-tv-control' },
  )
  assert.equal(hasCapability(new Set(['orders.view']), 'orders.kitchen.control'), false)
  assert.equal(hasCapability(new Set(['orders.kitchen.control']), 'orders.kitchen.control'), true)
})

test('legacy authenticated access includes Kitchen TV control without adding a global mobile entry', () => {
  assert.equal(hasCapability(legacyCapabilities(true), 'orders.kitchen.control'), true)
  assert.equal(legacyCapabilities(false).has('orders.kitchen.control'), false)

  assert.deepEqual(AREA_DESTINATION_IDS.orders, ['orders', 'history', 'kitchen-tv-control'])
  assert.equal(MOBILE_DIRECT_ENTRIES.some((item) => item.id === 'kitchen-tv-control'), false)
  assert.equal(MOBILE_MORE_ENTRIES.some((item) => item.id === 'kitchen-tv-control'), false)
  assert.equal(MOBILE_SECTION_IDS.includes('kitchen-tv-control'), true)
})

test('App marks Kitchen TV control as an implemented destination before the surface arrives', async () => {
  const source = await readFile(new URL('../../App.jsx', import.meta.url), 'utf8')
  assert.match(source, /IMPLEMENTED_DESTINATIONS[^\n]+['"]kitchen-tv-control['"]/)
})
