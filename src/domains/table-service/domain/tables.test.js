import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getActiveTables,
  isActiveTable,
  isFreeTable,
  isOccupiedTable,
  orderTables,
} from './tables.js'

const tabA = { id: 'tab-A', number: 41 }
const occupiedA = { id: 'table-1', name: 'Mesa 1', isActive: true, occupancy: 'occupied', sortOrder: 2, openTableTab: tabA }
const free = { id: 'table-2', name: 'Mesa 2', isActive: true, occupancy: 'free', sortOrder: 1, openTableTab: null }
const inactive = { id: 'table-3', name: 'Mesa 3', isActive: false, occupancy: 'free', sortOrder: 3, openTableTab: null }

test('table projections keep official sort order and operational state semantics', () => {
  assert.deepEqual(orderTables([occupiedA, free]).map((table) => table.id), ['table-2', 'table-1'])
  assert.deepEqual(getActiveTables([occupiedA, free, inactive]).map((table) => table.id), ['table-2', 'table-1'])
  assert.equal(isActiveTable(occupiedA), true)
  assert.equal(isActiveTable(inactive), false)
  assert.equal(isOccupiedTable(occupiedA), true)
  assert.equal(isFreeTable(free), true)
  assert.equal(isFreeTable(inactive), false)
})

test('occupied state requires an active table with an open tab identity', () => {
  assert.equal(isOccupiedTable({ ...occupiedA, isActive: false }), false)
  assert.equal(isOccupiedTable({ ...occupiedA, openTableTab: null }), false)
  assert.equal(isOccupiedTable({ ...occupiedA, occupancy: 'free' }), false)
})
