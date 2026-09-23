import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'

import { workspaceHarness } from '../../test-support/renderWorkspace.js'

test('Task 5 RED: New Order installs beforeunload only while dirty or checkout is pending', async (t) => {
  const h = await workspaceHarness(t)
  const { useNewOrderUnloadGuard } = await h.load('/src/app/navigation/useNewOrderUnloadGuard.js')

  function Probe({ active, dirty, checkoutPending }) {
    useNewOrderUnloadGuard({ active, dirty, checkoutPending })
    return null
  }

  const renderer = await h.render(Probe, {
    active: true,
    dirty: false,
    checkoutPending: false,
  })

  const dispatchUnload = () => {
    const event = new Event('beforeunload', { cancelable: true })
    h.window.dispatchEvent(event)
    return event.defaultPrevented
  }

  const baseline = h.activitySnapshot({ ignoreFocus: true }).listeners
  assert.equal(dispatchUnload(), false)

  await act(async () => renderer.update(React.createElement(Probe, {
    active: true,
    dirty: true,
    checkoutPending: false,
  })))
  assert.equal(h.activitySnapshot({ ignoreFocus: true }).listeners, baseline + 1)
  assert.equal(dispatchUnload(), true)

  await act(async () => renderer.update(React.createElement(Probe, {
    active: true,
    dirty: false,
    checkoutPending: true,
  })))
  assert.equal(h.activitySnapshot({ ignoreFocus: true }).listeners, baseline + 1)
  assert.equal(dispatchUnload(), true)

  await act(async () => renderer.update(React.createElement(Probe, {
    active: false,
    dirty: true,
    checkoutPending: true,
  })))
  assert.equal(h.activitySnapshot({ ignoreFocus: true }).listeners, baseline)
  assert.equal(dispatchUnload(), false)
})
