import assert from 'node:assert/strict'
import test from 'node:test'
import * as tableService from './index.js'

test('table-service public contract exposes only real external consumers', () => {
  assert.deepEqual(
    Object.keys(tableService).sort(),
    [
    'createTableServiceApi',
      'Comandas',
      'LocalTableSelector',
      'Tables',
      'createTableReservationApi',
      'getOpenComandaCount',
      'matchesReservationDetail',
      'reservationMutationNeedsDiscount',
      'reservationOwnerKey',
      'resolveOpenComanda',
      'tableReservationApi',
      'useComandaSelection',
      'useTableReservationCommands',
      'useTableReservationDetail',
      'useTableServiceCommands',
    ].sort(),
  )
})
