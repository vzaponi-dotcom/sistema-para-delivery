import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findOpenTableByTabId,
  reconcileComandaSelection,
  resolveOpenComanda,
  sameComandaIdentity,
} from './comandaIdentity.js'

const tabA = { id: 'tab-A', number: 41 }
const tabB = { id: 'tab-B', number: 42 }
const occupiedA = { id: 'table-1', name: 'Mesa 1', isActive: true, occupancy: 'occupied', sortOrder: 1, openTableTab: tabA }

test('exact open-comanda resolution requires both table and tab identity', () => {
  assert.deepEqual(
    resolveOpenComanda([occupiedA], { tableId: 'table-1', tableTabId: 'tab-A' }),
    { tableId: 'table-1', tableTabId: 'tab-A' },
  )
  assert.equal(
    resolveOpenComanda([{ ...occupiedA, openTableTab: tabB }], { tableId: 'table-1', tableTabId: 'tab-A' }),
    null,
  )
  assert.equal(
    resolveOpenComanda([{ ...occupiedA, isActive: false }], { tableId: 'table-1', tableTabId: 'tab-A' }),
    null,
  )
})

test('selection follows the same tableTabId across a table transfer without becoming a new comanda', () => {
  const transferred = {
    id: 'table-5',
    name: 'Mesa 5',
    isActive: true,
    occupancy: 'occupied',
    sortOrder: 5,
    openTableTab: tabA,
  }
  assert.deepEqual(findOpenTableByTabId([transferred], 'tab-A'), transferred)
  assert.deepEqual(
    reconcileComandaSelection([transferred], { tableId: 'table-1', tableTabId: 'tab-A' }),
    { tableId: 'table-5', tableTabId: 'tab-A' },
  )
  assert.equal(
    sameComandaIdentity(
      { tableId: 'table-1', tableTabId: 'tab-A' },
      { tableId: 'table-5', tableTabId: 'tab-A' },
    ),
    false,
  )
})

test('selection is invalidated when the tab closes, disappears or the table is reused by another tab', () => {
  const selection = { tableId: 'table-1', tableTabId: 'tab-A' }
  assert.equal(reconcileComandaSelection([], selection), null)
  assert.equal(
    reconcileComandaSelection([{ ...occupiedA, occupancy: 'free', openTableTab: null }], selection),
    null,
  )
  assert.equal(
    reconcileComandaSelection([{ ...occupiedA, openTableTab: tabB }], selection),
    null,
  )
  assert.equal(sameComandaIdentity(selection, { ...selection }), true)
})
