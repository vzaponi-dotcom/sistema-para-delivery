import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useOrderArrivals } from './useOrderArrivals.js'

const activeOrder = (id) => ({ id, status: 'Em preparo', orderDate: '2026-09-17' })

test('arrival baseline does not alert, then a new order alerts once and highlights', async () => {
  const sounds = []
  const timers = []
  let latest
  let renderer
  function Probe(props) {
    latest = useOrderArrivals({
      ...props,
      setTimeoutFn: (fn) => { timers.push(fn); return timers.length },
      clearTimeoutFn: () => {},
    })
    return null
  }

  await act(async () => {
    renderer = TestRenderer.create(<Probe active orders={[activeOrder('1')]} now={new Date('2026-09-17T12:00:00-03:00')} soundEnabled playSound={() => sounds.push('sound')} />)
  })
  assert.deepEqual([...latest.newOrderIds], [])

  await act(async () => {
    renderer.update(<Probe active orders={[activeOrder('1'), activeOrder('2')]} now={new Date('2026-09-17T12:00:01-03:00')} soundEnabled playSound={() => sounds.push('sound')} />)
  })
  assert.deepEqual([...latest.newOrderIds], ['2'])
  assert.equal(sounds.length, 1)

  await act(async () => { timers.at(-1)() })
  assert.deepEqual([...latest.newOrderIds], [])
  renderer.unmount()
})
