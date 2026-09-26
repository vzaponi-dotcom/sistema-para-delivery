import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { workspaceHarness } from '../../../test-support/renderWorkspace.js'

test('reporting search-param hook writes filters to the router URL and resets page', async (t) => {
  const h = await workspaceHarness(t)
  const { useReportingSearchParams } = await h.load('/src/domains/reporting/application/useReportingSearchParams.js')
  const api = React.createRef()

  const Probe = React.forwardRef(function Probe(_props, ref) {
    const state = useReportingSearchParams({ today: '2026-09-25' })
    React.useImperativeHandle(ref, () => state, [state])
    return React.createElement('output', null, state.query.view)
  })

  const router = createMemoryRouter([
    { path: '/relatorios', element: React.createElement(Probe, { ref: api }) },
  ], {
    initialEntries: ['/relatorios?view=detail&type=Entrega&page=4&pageSize=50'],
  })

  await h.render(RouterProvider, { router })
  assert.equal(api.current.query.view, 'detail')
  assert.equal(api.current.query.page, 4)

  await act(async () => api.current.patchQuery({ category: 'Refeições' }))
  assert.equal(api.current.query.category, 'Refeições')
  assert.equal(api.current.query.type, 'Entrega')
  assert.equal(api.current.query.page, 1)
  assert.match(router.state.location.search, /category=Refei%C3%A7%C3%B5es/)
})
