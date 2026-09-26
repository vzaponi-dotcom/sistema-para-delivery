import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('receivable action uses the shared reporting button pattern', async (t) => {
  const harness = await workspaceHarness(t)
  const { ReportingReceivableLink } = await harness.load('/src/domains/reporting/ui/ReportingReceivableLink.jsx')
  const renderer = await harness.render(ReportingReceivableLink, {})
  const link = renderer.root.findByProps({ href: '/financeiro/a-receber' })
  assert.match(link.props.className, /reporting-receivable-link/)
  assert.match(link.props.className, /secondary-button/)
  assert.match(nodeText(renderer.root), /Gerenciar em A receber/)
})
