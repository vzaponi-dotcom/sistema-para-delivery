import test from 'node:test'
import assert from 'node:assert/strict'
import { getOpenComandaCount } from './comandaActivity.js'

const occupied = (tableId, tabId) => ({ id: tableId, isActive: true, occupancy: 'occupied', openTableTab: { id: tabId } })

test('counts distinct open comandas and ignores free or identity-less tables', () => {
  assert.equal(getOpenComandaCount([
    occupied('table-1', 'tab-A'), occupied('table-2', 'tab-B'),
    { id: 'free', isActive: true, occupancy: 'free', openTableTab: null },
    { id: 'broken', isActive: true, occupancy: 'occupied', openTableTab: null },
  ], [{ id: 'tab-A', status: 'open' }, { id: 'tab-B', status: 'open' }]), 2)
})

test('transfer or duplicate projections of the same tableTabId count once', () => {
  assert.equal(getOpenComandaCount([occupied('old-table', 'tab-A'), occupied('new-table', 'tab-A')], [{ id: 'tab-A', status: 'open' }]), 1)
})

test('known closed tab vetoes a stale occupied table projection', () => {
  assert.equal(getOpenComandaCount([occupied('table-1', 'tab-A')], [{ id: 'tab-A', status: 'closed' }]), 0)
})

test('missing tableTabs projection can temporarily trust the valid occupied table identity', () => {
  assert.equal(getOpenComandaCount([occupied('table-1', 'tab-A')], []), 1)
})
