import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness } from '../test-support/renderWorkspace.js'

for (const mountOrder of ['modal-sheet', 'sheet-modal']) {
  for (const firstRelease of [0, 1]) test(`overlay locks: ${mountOrder}, release ${firstRelease} first`, async (t) => {
    const h = await workspaceHarness(t, { mobile: true })
    const { default: Modal } = await h.load('/src/components/Modal.jsx')
    const { default: Sheet } = await h.load('/src/components/BottomSheet.jsx')
    h.document.body.style.overflow = 'scroll'
    const components = mountOrder === 'modal-sheet' ? [Modal, Sheet] : [Sheet, Modal]
    const mounted = []
    for (const Component of components) mounted.push(await h.render(Component, { title: 'Overlay', open: true, onClose() {} }))
    assert.equal(h.document.body.style.overflow, 'hidden')
    await act(async () => mounted[firstRelease].unmount())
    assert.equal(h.document.body.style.overflow, 'hidden', 'the surviving overlay still owns a lock')
    await act(async () => mounted[1 - firstRelease].unmount())
    assert.equal(h.document.body.style.overflow, 'scroll', 'the last release restores the original value')
  })
}

for (const order of ['modal-sheet', 'sheet-modal']) test(`simultaneous overlay teardown restores original overflow (${order})`, async (t) => {
  const h = await workspaceHarness(t)
  const { default: Modal } = await h.load('/src/components/Modal.jsx')
  const { default: Sheet } = await h.load('/src/components/BottomSheet.jsx')
  h.document.body.style.overflow = 'auto'
  const components = order === 'modal-sheet' ? [Modal, Sheet] : [Sheet, Modal]
  function Overlays() { return React.createElement(React.Fragment, null, ...components.map((Component, index) => React.createElement(Component, { key: index, title: 'Overlay', open: true, onClose() {} }))) }
  const r = await h.render(Overlays)
  await act(async () => r.unmount())
  assert.equal(h.document.body.style.overflow, 'auto')
})
