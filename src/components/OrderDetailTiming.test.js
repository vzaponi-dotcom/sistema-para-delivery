import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOrderDetailTimingRows } from './OrderDetailTiming.js'

const finishedDelivery = {
  type: 'Entrega',
  createdAt: '2026-09-04T21:10:00.000Z',
  scheduledFor: '2026-09-04T23:42:00.000Z',
  finishedAt: '2026-09-04T23:10:00.000Z',
}

const finishedPickup = {
  type: 'Retirada',
  createdAt: '2026-09-04T21:10:00.000Z',
  finishedAt: '2026-09-04T21:35:00.000Z',
}

test('builds operational timing rows in the business timezone', () => {
  assert.deepEqual(buildOrderDetailTimingRows(finishedDelivery), [
    { key: 'desired', label: 'Horário desejado', value: '20:42' },
    { key: 'operational-start', label: 'Início operacional', value: '04/09/2026 às 19:52' },
    { key: 'duration', label: 'Tempo até sair para entrega', value: '18 min' },
  ])
})

test('labels a completed pickup duration by finalization', () => {
  assert.equal(buildOrderDetailTimingRows(finishedPickup).at(-1).label, 'Tempo até finalização')
})

