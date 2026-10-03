import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { ContextApi } from './ContextApi.js'
import { useContextBlob } from './useContextBlob.js'

test('logo blob uses captured transport, discards late company image and revokes owned URLs', async t => {
  let current, resolveA
  const revoked = []
  const urlApi = { createObjectURL: blob => `blob:${blob.name}`, revokeObjectURL: url => revoked.push(url) }
  const a = { contextId: 'A', blob: async () => new Promise(resolve => { resolveA = resolve }) }
  const b = { contextId: 'B', blob: async () => ({ name: 'B' }) }
  function Harness() { current = useContextBlob('/api/business/logo', { urlApi }); return null }
  let renderer
  const view = client => React.createElement(ContextApi.Provider, { value: client }, React.createElement(Harness))
  await act(async () => { renderer = create(view(a)) })
  await act(async () => { renderer.update(view(b)) })
  assert.equal(current, 'blob:B')
  await act(async () => { resolveA({ name: 'A' }) })
  assert.equal(current, 'blob:B')
  await act(async () => renderer.unmount())
  assert.deepEqual(revoked, ['blob:B'])
})
