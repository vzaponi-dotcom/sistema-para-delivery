import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useTableReservationDetail } from './useTableReservationDetail.js'

const detailA = {
  reservation: { id: 'reservation-A', status: 'reserved', revision: 2 },
  order: { id: 'order-A', tableReservationId: 'reservation-A' },
  printJob: null,
  hasManualPrintHistory: false,
}
const detailB = {
  reservation: { id: 'reservation-B', status: 'reserved', revision: 1 },
  order: { id: 'order-B', tableReservationId: 'reservation-B' },
  printJob: null,
  hasManualPrintHistory: true,
}

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const mountProbe = async (props) => {
  let latest
  let renderer
  function Probe(currentProps) {
    latest = useTableReservationDetail(currentProps)
    return null
  }
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe, props))
  })
  return {
    getLatest: () => latest,
    update: async (nextProps) => act(async () => renderer.update(React.createElement(Probe, nextProps))),
    unmount: () => renderer.unmount(),
  }
}

test('reservation detail publishes only the exact selected reservation and supports retry', async () => {
  const first = deferred()
  const second = deferred()
  let calls = 0
  const api = {
    getReservation: () => {
      calls += 1
      return calls === 1 ? first.promise : second.promise
    },
  }
  const probe = await mountProbe({
    selection: { reservationId: 'reservation-A' },
    officialTables: [],
    api,
  })
  assert.equal(probe.getLatest().loading, true)

  await act(async () => first.resolve({
    reservation: { id: 'reservation-wrong' },
    order: { id: 'wrong' },
  }))
  assert.equal(probe.getLatest().detail, null)
  assert.match(probe.getLatest().error, /indisponível|alterada/i)

  let retry
  await act(async () => {
    retry = probe.getLatest().retry()
    await Promise.resolve()
  })
  await act(async () => {
    second.resolve(detailA)
    await retry
  })
  assert.deepEqual(probe.getLatest().detail, detailA)
  assert.equal(probe.getLatest().error, null)
  probe.unmount()
})

test('late detail response from retired reservation cannot replace the current selection', async () => {
  const reads = new Map([
    ['reservation-A', deferred()],
    ['reservation-B', deferred()],
  ])
  const api = { getReservation: (id) => reads.get(id).promise }
  const probe = await mountProbe({
    selection: { reservationId: 'reservation-A' },
    officialTables: [],
    api,
  })
  await probe.update({
    selection: { reservationId: 'reservation-B' },
    officialTables: [],
    api,
  })

  await act(async () => reads.get('reservation-B').resolve(detailB))
  assert.deepEqual(probe.getLatest().detail, detailB)

  await act(async () => reads.get('reservation-A').resolve(detailA))
  assert.deepEqual(probe.getLatest().detail, detailB)
  probe.unmount()
})

test('official table changes refresh the current reservation while retaining the published detail', async () => {
  const pending = deferred()
  let calls = 0
  const updated = { ...detailA, reservation: { ...detailA.reservation, revision: 3 } }
  const api = {
    getReservation: async () => {
      calls += 1
      if (calls === 1) return detailA
      return pending.promise
    },
  }
  const probe = await mountProbe({
    selection: { reservationId: 'reservation-A' },
    officialTables: [{ id: 'table-1', nextReservation: { id: 'reservation-A' } }],
    api,
  })
  assert.deepEqual(probe.getLatest().detail, detailA)

  await probe.update({
    selection: { reservationId: 'reservation-A' },
    officialTables: [{ id: 'table-1', nextReservation: null }],
    api,
  })
  assert.equal(calls, 2)
  assert.deepEqual(probe.getLatest().detail, detailA)

  await act(async () => pending.resolve(updated))
  assert.deepEqual(probe.getLatest().detail, updated)
  probe.unmount()
})
