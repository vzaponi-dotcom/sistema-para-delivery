import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness } from '../../test-support/renderWorkspace.js'

test('AppShell preserva direção e foco ao trocar de página', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AppShell } = await h.load('/src/app/shell/AppShell.jsx')
  const granted = new Set(['orders.view', 'orders.history'])
  const implemented = new Set(['orders', 'history'])
  const Wrapper = ({ activeTab }) => React.createElement(NavigationProvider, {
    activeTab, granted, implemented, moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(AppShell, {
      dashboardPeriod: '30d', onDashboardPeriodChange() {},
      children: React.createElement('span', null, activeTab),
    }),
  })
  const renderer = await h.render(Wrapper, { activeTab: 'orders' }, {
    createNodeMock: (element) => element.props?.className === 'app-content page-transition'
      ? { focus: h.recordFocus }
      : {},
  })
  const beforeFocus = h.activitySnapshot().focus
  await act(async () => renderer.update(React.createElement(Wrapper, { activeTab: 'history' })))
  const content = renderer.root.findByProps({ className: 'app-content page-transition' })
  assert.equal(content.props['data-direction'], 'forward')
  assert.equal(h.activitySnapshot().focus, beforeFocus + 1)
  await act(async () => renderer.update(React.createElement(Wrapper, { activeTab: 'orders' })))
  assert.equal(renderer.root.findByProps({ className: 'app-content page-transition' }).props['data-direction'], 'backward')
})
