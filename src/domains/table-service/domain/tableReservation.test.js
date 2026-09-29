import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  matchesReservationDetail,
  reservationMutationNeedsDiscount,
  reservationOwnerKey,
} from './tableReservation.js'

test('reservation domain derives stable owner identity and exact detail ownership', () => {
  assert.equal(reservationOwnerKey({ reservationId: 'reservation-1' }), 'reservation-1')
  assert.equal(reservationOwnerKey({ reservationId: '' }), '')
  assert.equal(matchesReservationDetail('reservation-1', {
    reservation: { id: 'reservation-1', status: 'reserved' },
    order: { id: 'order-1' },
  }), true)
  assert.equal(matchesReservationDetail('reservation-1', {
    reservation: { id: 'reservation-2', status: 'reserved' },
  }), false)
  assert.equal(matchesReservationDetail('', { reservation: { id: 'reservation-1' } }), false)
})

test('reservation edit capability detects only real financial adjustments', () => {
  assert.equal(reservationMutationNeedsDiscount({ adjustment: { type: 'none' } }), false)
  assert.equal(reservationMutationNeedsDiscount({ adjustment: { type: 'discount' } }), true)
  assert.equal(reservationMutationNeedsDiscount({ adjustment: { type: 'surcharge' } }), true)
})

test('table-service public entry owns reservation boundary without deep importing Orders', async () => {
  const [indexSource, commandsSource, detailSource] = await Promise.all([
    readFile(new URL('../index.js', import.meta.url), 'utf8'),
    readFile(new URL('../application/useTableReservationCommands.js', import.meta.url), 'utf8'),
    readFile(new URL('../application/useTableReservationDetail.js', import.meta.url), 'utf8'),
  ])
  assert.match(indexSource, /useTableReservationDetail/)
  assert.match(indexSource, /useTableReservationCommands/)
  assert.match(indexSource, /tableReservationApi/)
  assert.match(indexSource, /reservationOwnerKey/)
  assert.doesNotMatch(commandsSource, /domains\/orders|\.\.\/\.\.\/orders|\.\.\/\.\.\/\.\.\/orders/)
  assert.doesNotMatch(detailSource, /domains\/orders|\.\.\/\.\.\/orders|\.\.\/\.\.\/\.\.\/orders/)
})
