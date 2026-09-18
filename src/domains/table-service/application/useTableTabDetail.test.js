import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useTableTabDetail } from './useTableTabDetail.js'

const selectionA = { tableId: 'table-1', tableTabId: 'tab-A' }
const selectionB = { tableId: 'table-2', tableTabId: 'tab-B' }

const tablesA = [
  { id: 'table-1', isActive: true, occupancy: 'occupied', sortOrder: 1, openTableTab: { id: 'tab-A' } },
]
const tablesB = [
  { id: 'table-2', isActive: true, occupancy: 'occupied', sortOrder: 1, openTableTab: { id: 'tab-B' } },
]

const detailA = {
  id: 'tab-A',
  number: 41,
  status: 'open',
  table: { id: 'table-1', name: 'Mesa 1' },
  orderCount: 1,
  itemCount: 1,
  totalCents: 2500,
  items: [],
}
const detailB = {
  ...detailA,
  id: 'tab-B',
  number: 42,
  table: { id: 'table-2', name: 'Mesa 2' },
}

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const apiError = (status, message) => Object.assign(new Error(message), { status })

const mountProbe = async (props) => {
  let latest
  let renderer
  function Probe(currentProps) {
    latest = useTableTabDetail(currentProps)
    return null
  }
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe, props))
  })
  return {
    getLatest: () => latest,
    update: async (nextProps) => act(async () => {
      renderer.update(React.createElement(Probe, nextProps))
    }),
    unmount: () => renderer.unmount(),
  }
}

test('initial detail load publishes only the exact open selected comanda', async () => {
  const pending = deferred()
  const api = { getTableTabDetail: () => pending.promise }
  const probe = await mountProbe({ selection: selectionA, officialTables: tablesA, api })

  assert.equal(probe.getLatest().loading, true)
  assert.equal(probe.getLatest().detail, null)

  await act(async () => pending.resolve({ tableTab: detailA }))

  assert.equal(probe.getLatest().loading, false)
  assert.equal(probe.getLatest().error, null)
  assert.deepEqual(probe.getLatest().detail, detailA)
  probe.unmount()
})

test('initial failure is actionable and retry can publish a later successful snapshot', async () => {
  const first = deferred()
  const second = deferred()
  let calls = 0
  const api = {
    getTableTabDetail: () => {
      calls += 1
      return calls === 1 ? first.promise : second.promise
    },
  }
  const probe = await mountProbe({ selection: selectionA, officialTables: tablesA, api })

  await act(async () => first.reject(apiError(500, 'Detalhe indisponível')))
  assert.equal(probe.getLatest().loading, false)
  assert.match(probe.getLatest().error, /Detalhe indisponível/)
  assert.equal(probe.getLatest().detail, null)

  let retryPromise
  await act(async () => {
    retryPromise = probe.getLatest().retry()
    await Promise.resolve()
  })
  assert.equal(calls, 2)
  assert.equal(probe.getLatest().loading, true)

  await act(async () => {
    second.resolve({ tableTab: detailA })
    await retryPromise
  })
  assert.deepEqual(probe.getLatest().detail, detailA)
  assert.equal(probe.getLatest().error, null)
  probe.unmount()
})

test('background refresh retains the current detail while the next read is pending', async () => {
  const refresh = deferred()
  let calls = 0
  const updated = { ...detailA, totalCents: 5000 }
  const api = {
    getTableTabDetail: async () => {
      calls += 1
      if (calls === 1) return { tableTab: detailA }
      return refresh.promise
    },
  }
  const probe = await mountProbe({ selection: selectionA, officialTables: tablesA, api })
  assert.deepEqual(probe.getLatest().detail, detailA)

  await probe.update({ selection: selectionA, officialTables: structuredClone(tablesA), api })
  assert.equal(calls, 2)
  assert.deepEqual(probe.getLatest().detail, detailA)
  assert.equal(probe.getLatest().loading, false)

  await act(async () => refresh.resolve({ tableTab: updated }))
  assert.deepEqual(probe.getLatest().detail, updated)
  probe.unmount()
})

test('same-owner official refreshes coalesce to one pending read plus one follow-up', async () => {
  const pending = deferred()
  let calls = 0
  const latest = { ...detailA, totalCents: 7500 }
  const api = {
    getTableTabDetail: async () => {
      calls += 1
      if (calls === 1) return { tableTab: detailA }
      if (calls === 2) return pending.promise
      return { tableTab: latest }
    },
  }
  const probe = await mountProbe({ selection: selectionA, officialTables: tablesA, api })
  assert.equal(calls, 1)

  await probe.update({ selection: selectionA, officialTables: structuredClone(tablesA), api })
  assert.equal(calls, 2)
  await probe.update({ selection: selectionA, officialTables: [{ ...tablesA[0], sortOrder: 2 }], api })
  await probe.update({ selection: selectionA, officialTables: [{ ...tablesA[0], sortOrder: 3 }], api })
  assert.equal(calls, 2)

  await act(async () => {
    pending.resolve({ tableTab: { ...detailA, totalCents: 5000 } })
    await pending.promise
    await Promise.resolve()
  })
  assert.equal(calls, 3)
  assert.deepEqual(probe.getLatest().detail, latest)
  probe.unmount()
})

test('late success from selection A cannot replace selection B detail', async () => {
  const reads = new Map([
    ['tab-A', deferred()],
    ['tab-B', deferred()],
  ])
  const api = { getTableTabDetail: (id) => reads.get(id).promise }
  const probe = await mountProbe({ selection: selectionA, officialTables: tablesA, api })

  await probe.update({ selection: selectionB, officialTables: tablesB, api })
  await act(async () => reads.get('tab-B').resolve({ tableTab: detailB }))
  assert.deepEqual(probe.getLatest().detail, detailB)

  await act(async () => reads.get('tab-A').resolve({ tableTab: detailA }))
  assert.deepEqual(probe.getLatest().detail, detailB)
  assert.equal(probe.getLatest().error, null)
  probe.unmount()
})

test('stale 401 from retired selection is ignored and cannot expire the current UI', async () => {
  const reads = new Map([
    ['tab-A', deferred()],
    ['tab-B', deferred()],
  ])
  const unauthorized = []
  const api = { getTableTabDetail: (id) => reads.get(id).promise }
  const probe = await mountProbe({
    selection: selectionA,
    officialTables: tablesA,
    api,
    onUnauthorized: (error) => unauthorized.push(error),
  })

  await probe.update({
    selection: selectionB,
    officialTables: tablesB,
    api,
    onUnauthorized: (error) => unauthorized.push(error),
  })
  await act(async () => reads.get('tab-B').resolve({ tableTab: detailB }))
  await act(async () => reads.get('tab-A').reject(apiError(401, 'Sessão antiga')))

  assert.deepEqual(probe.getLatest().detail, detailB)
  assert.equal(unauthorized.length, 0)
  probe.unmount()
})

test('current-owner 401 is forwarded once through the session error port', async () => {
  const pending = deferred()
  const unauthorized = []
  const api = { getTableTabDetail: () => pending.promise }
  const probe = await mountProbe({
    selection: selectionA,
    officialTables: tablesA,
    api,
    onUnauthorized: (error) => unauthorized.push(error),
  })

  const error = apiError(401, 'Sessão expirada')
  await act(async () => pending.reject(error))

  assert.equal(unauthorized.length, 1)
  assert.strictEqual(unauthorized[0], error)
  assert.match(probe.getLatest().error, /Sessão expirada/)
  probe.unmount()
})

for (const [kind, tableTab] of [
  ['closed', { ...detailA, status: 'closed' }],
  ['wrong tab', { ...detailA, id: 'tab-X' }],
  ['wrong table', { ...detailA, table: { id: 'table-X', name: 'Outra' } }],
]) {
  test(`rejects a current-owner detail with ${kind} identity`, async () => {
    const api = { getTableTabDetail: async () => ({ tableTab }) }
    const probe = await mountProbe({ selection: selectionA, officialTables: tablesA, api })

    assert.equal(probe.getLatest().detail, null)
    assert.equal(probe.getLatest().loading, false)
    assert.match(probe.getLatest().error, /indisponível|encerrada|transferida/i)
    probe.unmount()
  })
}
