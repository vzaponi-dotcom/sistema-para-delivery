import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useComandaSelection } from './useComandaSelection.js'

const tabA = { id: 'tab-A', number: 41 }
const tabB = { id: 'tab-B', number: 42 }

const sourceTables = [
  { id: 'table-1', name: 'Mesa 1', isActive: true, occupancy: 'occupied', sortOrder: 1, openTableTab: tabA },
  { id: 'table-5', name: 'Mesa 5', isActive: true, occupancy: 'free', sortOrder: 2, openTableTab: null },
]

const transferredTables = [
  { ...sourceTables[0], occupancy: 'free', openTableTab: null },
  { ...sourceTables[1], occupancy: 'occupied', openTableTab: tabA },
]

const replacementTables = [
  { ...sourceTables[0], openTableTab: tabB },
  sourceTables[1],
]

const mountProbe = async (props) => {
  let latest
  let renderer
  function Probe(currentProps) {
    latest = useComandaSelection(currentProps)
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

test('selection stays stable for equivalent snapshots, follows a transfer, and invalidates on replacement', async () => {
  const probe = await mountProbe({ tables: sourceTables })

  await act(async () => {
    assert.equal(probe.getLatest().selectComanda({ tableId: 'table-1', tableTabId: 'tab-A' }), true)
  })
  assert.deepEqual(probe.getLatest().selection, { tableId: 'table-1', tableTabId: 'tab-A' })
  const generationA = probe.getLatest().selectionGeneration

  await probe.update({ tables: structuredClone(sourceTables) })
  assert.deepEqual(probe.getLatest().selection, { tableId: 'table-1', tableTabId: 'tab-A' })
  assert.equal(probe.getLatest().selectionGeneration, generationA)

  await probe.update({ tables: transferredTables })
  assert.deepEqual(probe.getLatest().selection, { tableId: 'table-5', tableTabId: 'tab-A' })
  assert.equal(probe.getLatest().selectionGeneration, generationA)

  await probe.update({ tables: replacementTables })
  assert.equal(probe.getLatest().selection, null)
  assert.equal(probe.getLatest().selectionGeneration, generationA + 1)

  probe.unmount()
})

test('explicit reselection and reset retire older selection owners', async () => {
  const probe = await mountProbe({ tables: sourceTables })

  await act(async () => {
    assert.equal(probe.getLatest().selectComanda({ tableId: 'table-1', tableTabId: 'tab-A' }), true)
  })
  const firstOwner = probe.getLatest().getComandaSelectionOwner()

  await act(async () => {
    assert.equal(probe.getLatest().selectComanda({ tableId: 'table-1', tableTabId: 'tab-A' }), true)
  })
  assert.equal(probe.getLatest().ownsComandaSelection(firstOwner), false)

  const ownerBeforeReset = probe.getLatest().getComandaSelectionOwner()
  const generationBeforeReset = probe.getLatest().selectionGeneration
  await act(async () => probe.getLatest().resetComandaSelection())

  assert.equal(probe.getLatest().selection, null)
  assert.equal(probe.getLatest().selectionGeneration, generationBeforeReset + 1)
  assert.equal(probe.getLatest().ownsComandaSelection(ownerBeforeReset), false)

  probe.unmount()
})

test('invalid explicit target neither selects nor advances the generation', async () => {
  const probe = await mountProbe({ tables: sourceTables })
  const generation = probe.getLatest().selectionGeneration

  await act(async () => {
    assert.equal(probe.getLatest().selectComanda({ tableId: 'table-1', tableTabId: 'tab-B' }), false)
  })

  assert.equal(probe.getLatest().selection, null)
  assert.equal(probe.getLatest().selectionGeneration, generation)
  assert.equal(probe.getLatest().clearComandaSelection(), false)

  probe.unmount()
})
