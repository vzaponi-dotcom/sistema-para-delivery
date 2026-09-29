import assert from 'node:assert/strict'
import test from 'node:test'
import { createTableReservationApi } from './tableReservationApi.js'

const json = (method, body) => ({ method, body: JSON.stringify(body) })

test('reservation api uses the dedicated paths, methods and payloads', async () => {
  const calls = []
  const request = async (...args) => { calls.push(args); return { ok: true } }
  const api = createTableReservationApi({ request, json, randomUUID: () => 'mutation-1' })

  await api.listReservations({
    status: 'reserved',
    from: '2026-10-10T00:00:00.000Z',
    to: '2026-10-12T00:00:00.000Z',
    tableId: 'mesa 1',
  })
  await api.getReservation('reservation/1', { signal: 'detail-signal' })
  await api.updateReservation('reservation/1', { expectedRevision: 2, type: 'Local' })
  await api.confirmArrival('reservation/1', 2)
  await api.cancelReservation('reservation/1', { expectedRevision: 2, reason: 'other' })
  await api.markNoShow('reservation/1', { expectedRevision: 2, reason: 'other' })

  assert.deepEqual(calls, [
    ['/api/table-reservations?status=reserved&from=2026-10-10T00%3A00%3A00.000Z&to=2026-10-12T00%3A00%3A00.000Z&tableId=mesa+1', undefined],
    ['/api/table-reservations/reservation%2F1', { signal: 'detail-signal' }],
    ['/api/table-reservations/reservation%2F1', { method: 'PUT', body: JSON.stringify({ expectedRevision: 2, type: 'Local' }) }],
    ['/api/table-reservations/reservation%2F1/confirm-arrival', {
      method: 'POST', body: JSON.stringify({ expectedRevision: 2, mutationId: 'mutation-1' }),
    }],
    ['/api/table-reservations/reservation%2F1/cancel', {
      method: 'POST', body: JSON.stringify({ expectedRevision: 2, reason: 'other' }),
    }],
    ['/api/table-reservations/reservation%2F1/no-show', {
      method: 'POST', body: JSON.stringify({ expectedRevision: 2, reason: 'other' }),
    }],
  ])
})

test('reservation api omits empty list filters and accepts explicit arrival mutation id', async () => {
  const calls = []
  const api = createTableReservationApi({
    request: async (...args) => { calls.push(args); return {} },
    json,
    randomUUID: () => 'generated',
  })
  await api.listReservations({ status: '', from: null, to: undefined, tableId: '' })
  await api.confirmArrival('r1', 4, 'explicit-id')
  assert.deepEqual(calls, [
    ['/api/table-reservations', undefined],
    ['/api/table-reservations/r1/confirm-arrival', {
      method: 'POST', body: JSON.stringify({ expectedRevision: 4, mutationId: 'explicit-id' }),
    }],
  ])
})
