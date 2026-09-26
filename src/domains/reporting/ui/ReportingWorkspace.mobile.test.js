import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { workspaceHarness } from '../../../test-support/renderWorkspace.js'

test('mobile Reporting redirects to the existing Finance overview without mounting reporting UI', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { ReportingWorkspace } = await h.load('/src/domains/reporting/ui/ReportingWorkspace.jsx')
  const calls = []
  const granted = new Set(['finance.overview', 'reports.view', 'reports.export'])

  const renderer = await h.render(NavigationProvider, {
    activeTab: 'reports',
    granted,
    implemented: new Set(['dashboard', 'reports']),
    moreOpen: false,
    requestNavigation: (id) => calls.push(id),
    openMore() {},
    closeMore() {},
    children: React.createElement(ReportingWorkspace, { granted }),
  })

  assert.equal(renderer.root.findAllByProps({ className: 'reporting-page' }).length, 0)
  assert.deepEqual(calls, ['dashboard'])
})
