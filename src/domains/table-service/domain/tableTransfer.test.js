import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getTransferDestinations,
  validateTransferIntent,
} from './tableTransfer.js'

const tabA = { id: 'tab-A', number: 41 }
const tabB = { id: 'tab-B', number: 42 }
const source = { id: 'table-1', name: 'Mesa 1', isActive: true, occupancy: 'occupied', sortOrder: 3, openTableTab: tabA }
const freeLater = { id: 'table-2', name: 'Mesa 2', isActive: true, occupancy: 'free', sortOrder: 2, openTableTab: null }
const freeFirst = { id: 'table-4', name: 'Mesa 4', isActive: true, occupancy: 'free', sortOrder: 1, openTableTab: null }
const inactive = { id: 'table-3', name: 'Mesa 3', isActive: false, occupancy: 'free', sortOrder: 4, openTableTab: null }

test('transfer destinations contain only other active free tables in official order', () => {
  assert.deepEqual(
    getTransferDestinations([source, freeLater, inactive, freeFirst], 'table-1').map((table) => table.id),
    ['table-4', 'table-2'],
  )
})

test('transfer validation captures exact source tab and a currently free destination', () => {
  const result = validateTransferIntent(
    [source, freeLater],
    { sourceTableId: 'table-1', destinationTableId: 'table-2', expectedTableTabId: 'tab-A' },
  )
  assert.equal(result?.source.id, 'table-1')
  assert.equal(result?.destination.id, 'table-2')
  assert.deepEqual(result?.identity, { tableId: 'table-1', tableTabId: 'tab-A' })
})

test('transfer validation rejects stale source, occupied/inactive destination and self-transfer', () => {
  const staleSource = { ...source, openTableTab: tabB }
  const occupiedDestination = { ...freeLater, occupancy: 'occupied', openTableTab: tabB }
  assert.equal(
    validateTransferIntent([staleSource, freeLater], { sourceTableId: 'table-1', destinationTableId: 'table-2', expectedTableTabId: 'tab-A' }),
    null,
  )
  assert.equal(
    validateTransferIntent([source, occupiedDestination], { sourceTableId: 'table-1', destinationTableId: 'table-2', expectedTableTabId: 'tab-A' }),
    null,
  )
  assert.equal(
    validateTransferIntent([source, inactive], { sourceTableId: 'table-1', destinationTableId: 'table-3', expectedTableTabId: 'tab-A' }),
    null,
  )
  assert.equal(
    validateTransferIntent([source], { sourceTableId: 'table-1', destinationTableId: 'table-1', expectedTableTabId: 'tab-A' }),
    null,
  )
})
