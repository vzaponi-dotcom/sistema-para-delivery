import assert from 'node:assert/strict'
import test from 'node:test'
import { workspaceHarness } from '../../test-support/renderWorkspace.js'

test('Task 2 RED: workspace harness exposes one Router-aware admin mounting path', async (t) => {
  const h = await workspaceHarness(t)
  assert.equal(typeof h.renderAdminApp, 'function')
})
