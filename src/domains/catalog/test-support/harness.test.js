import test from 'node:test'
import assert from 'node:assert/strict'
import React, { useState } from 'react'
import { act, create } from 'react-test-renderer'
import { createUiHarness, mountHook } from './harness.js'

test('Catalog hook harness can mount and rerender an existing React hook without JSX', async (t) => {
  const h = await mountHook(t, ({ initial }) => useState(initial), { initial: 'initial' })
  assert.equal(h.current()[0], 'initial')
  await act(async () => { h.current()[1]('changed') })
  await h.rerender({ initial: 'ignored' })
  assert.equal(h.current()[0], 'changed')
})

test('Catalog UI harness loads an existing Button through Vite and cleans up', async (t) => {
  const h = await createUiHarness(t)
  const { default: Button } = await h.load('/src/shared/ui/Button.jsx')
  let renderer
  let clicks = 0
  await act(async () => {
    renderer = create(React.createElement(Button, { onClick: () => { clicks += 1 } }, 'Harness check'))
  })
  t.after(async () => { await act(async () => renderer.unmount()) })
  await act(async () => { renderer.root.findByType('button').props.onClick() })
  assert.equal(clicks, 1)
})
