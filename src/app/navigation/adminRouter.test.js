import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'
import { RouterProvider } from 'react-router'
import { readFile } from 'node:fs/promises'

import { workspaceHarness } from '../../test-support/renderWorkspace.js'

test('Task 2 RED: admin data router resolves semantic destinations without remounting the root', async (t) => {
  const h = await workspaceHarness(t)
  const { createAdminMemoryRouter } = await h.load('/src/app/navigation/adminRouter.jsx')
  const { useMatchedDestination } = await h.load('/src/app/navigation/routeMatch.js')

  let mounts = 0
  let unmounts = 0

  function RootProbe() {
    const destination = useMatchedDestination()
    React.useEffect(() => {
      mounts += 1
      return () => { unmounts += 1 }
    }, [])
    return React.createElement('output', null, destination || 'unknown')
  }

  const router = createAdminMemoryRouter({
    rootElement: React.createElement(RootProbe),
    initialEntries: ['/pedidos'],
  })
  const renderer = await h.render(RouterProvider, { router })

  assert.equal(renderer.root.findByType('output').children.join(''), 'orders')
  assert.equal(mounts, 1)
  assert.equal(unmounts, 0)

  await act(async () => { await router.navigate('/clientes') })
  assert.equal(renderer.root.findByType('output').children.join(''), 'clients')
  assert.equal(mounts, 1)
  assert.equal(unmounts, 0)

  await act(async () => { await router.navigate('/financeiro/a-receber') })
  assert.equal(renderer.root.findByType('output').children.join(''), 'receivables')
  assert.equal(mounts, 1)
  assert.equal(unmounts, 0)

  await act(async () => { await router.navigate('/relatorios') })
  assert.equal(renderer.root.findByType('output').children.join(''), 'reports')
  assert.equal(mounts, 1)
  assert.equal(unmounts, 0)

  await act(async () => { await router.navigate('/configuracoes/impressao') })
  assert.equal(renderer.root.findByType('output').children.join(''), 'settings-printing')
  assert.equal(mounts, 1)
  assert.equal(unmounts, 0)

  await act(async () => { await router.navigate('/nao-existe') })
  assert.equal(renderer.root.findByType('output').children.join(''), 'unknown')
  assert.equal(mounts, 1)
  assert.equal(unmounts, 0)
})

test('Task 2 RED: AdminBootstrap mounts the persistent application through RouterProvider', async () => {
  const source = await readFile(new URL('../../admin/AdminBootstrap.jsx', import.meta.url), 'utf8')
  assert.match(source, /createAdminBrowserRouter/)
  assert.match(source, /RouterProvider/)
  assert.doesNotMatch(source, /<App\s*\/>/)
})
