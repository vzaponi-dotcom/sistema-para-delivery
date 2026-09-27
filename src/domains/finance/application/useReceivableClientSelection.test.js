import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useReceivableClientSelection } from './useReceivableClientSelection.js'

async function mountSelection() {
  let latest
  let renderer

  function Probe() {
    latest = useReceivableClientSelection()
    return null
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe))
  })

  return {
    getLatest: () => latest,
    unmount: () => renderer.unmount(),
  }
}

test('receivable client selection activates one group and never selects an order outside it', async () => {
  const probe = await mountSelection()

  await act(async () => probe.getLatest().activateGroup('client:c1', ['o1', 'o2']))
  assert.equal(probe.getLatest().activeGroupKey, 'client:c1')
  assert.deepEqual(probe.getLatest().selectedOrderIds, [])

  await act(async () => assert.equal(probe.getLatest().toggleOrder('o1'), true))
  assert.deepEqual(probe.getLatest().selectedOrderIds, ['o1'])
  await act(async () => assert.equal(probe.getLatest().toggleOrder('outside'), false))
  assert.deepEqual(probe.getLatest().selectedOrderIds, ['o1'])

  await act(async () => assert.equal(probe.getLatest().toggleOrder('o1'), true))
  assert.deepEqual(probe.getLatest().selectedOrderIds, [])
  probe.unmount()
})

test('select all uses only visible eligible ids and changing client clears the previous selection', async () => {
  const probe = await mountSelection()

  await act(async () => probe.getLatest().activateGroup('client:c1', ['o1', 'o2', 'o3']))
  await act(async () => probe.getLatest().selectAllVisible())
  assert.deepEqual(probe.getLatest().selectedOrderIds, ['o1', 'o2', 'o3'])

  await act(async () => probe.getLatest().activateGroup('client:c2', ['b1', 'b2']))
  assert.equal(probe.getLatest().activeGroupKey, 'client:c2')
  assert.deepEqual(probe.getLatest().selectedOrderIds, [])

  await act(async () => probe.getLatest().selectAllVisible())
  assert.deepEqual(probe.getLatest().selectedOrderIds, ['b1', 'b2'])
  await act(async () => probe.getLatest().deselectAll())
  assert.deepEqual(probe.getLatest().selectedOrderIds, [])
  probe.unmount()
})

test('reconcile removes selected ids that left the active filtered group', async () => {
  const probe = await mountSelection()

  await act(async () => probe.getLatest().activateGroup('client:c1', ['o1', 'o2', 'o3']))
  await act(async () => probe.getLatest().selectAllVisible())
  await act(async () => probe.getLatest().reconcile('client:c1', ['o2', 'o3']))

  assert.deepEqual(probe.getLatest().selectedOrderIds, ['o2', 'o3'])
  assert.deepEqual(probe.getLatest().visibleOrderIds, ['o2', 'o3'])

  await act(async () => probe.getLatest().reconcile('client:c2', ['b1']))
  assert.equal(probe.getLatest().activeGroupKey, null)
  assert.deepEqual(probe.getLatest().selectedOrderIds, [])
  probe.unmount()
})

test('clear resets both active client and selected orders', async () => {
  const probe = await mountSelection()

  await act(async () => probe.getLatest().activateGroup('client:c1', ['o1', 'o2']))
  await act(async () => probe.getLatest().selectAllVisible())
  await act(async () => probe.getLatest().clear())

  assert.equal(probe.getLatest().activeGroupKey, null)
  assert.deepEqual(probe.getLatest().visibleOrderIds, [])
  assert.deepEqual(probe.getLatest().selectedOrderIds, [])
  probe.unmount()
})


test('selection caps manual and select-all choices at 100 orders in visible order', async () => {
  const probe = await mountSelection()
  const ids = Array.from({ length: 105 }, (_, index) => 'o' + String(index + 1).padStart(3, '0'))

  await act(async () => probe.getLatest().activateGroup('client:c1', ids))
  await act(async () => probe.getLatest().selectAllVisible())

  assert.equal(probe.getLatest().selectionLimit, 100)
  assert.equal(probe.getLatest().selectedOrderIds.length, 100)
  assert.deepEqual(probe.getLatest().selectedOrderIds, ids.slice(0, 100))
  assert.equal(probe.getLatest().selectionLimitReached, true)

  await act(async () => assert.equal(probe.getLatest().toggleOrder(ids[100]), false))
  assert.equal(probe.getLatest().selectedOrderIds.length, 100)

  await act(async () => probe.getLatest().toggleOrder(ids[0]))
  await act(async () => assert.equal(probe.getLatest().toggleOrder(ids[100]), true))
  assert.equal(probe.getLatest().selectedOrderIds.length, 100)
  assert.ok(probe.getLatest().selectedOrderIds.includes(ids[100]))
  probe.unmount()
})
