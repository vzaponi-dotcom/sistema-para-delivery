import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

const hoverEvent = {
  currentTarget: {
    getBoundingClientRect: () => ({ left: 140, right: 156, top: 100, bottom: 116, width: 16, height: 16 }),
  },
}

test('reporting info uses only the custom tooltip and no native browser title', async (t) => {
  const h = await workspaceHarness(t)
  const { ReportingInfoTip } = await h.load('/src/domains/reporting/ui/ReportingInfoTip.jsx')
  const renderer = await h.render(ReportingInfoTip, { helpKey: 'P90' })
  const trigger = renderer.root.findByProps({ className: 'reporting-info-tip' })
  assert.equal(trigger.props.title, undefined)
  assert.equal(nodeText(renderer.root.findByProps({ className: 'reporting-info-trigger' })), 'i')

  await act(async () => trigger.props.onMouseEnter(hoverEvent))
  const tooltip = renderer.root.findByProps({ role: 'tooltip' })
  const copy = nodeText(tooltip)
  assert.match(copy, /P90/)
  assert.match(copy, /O que é/)
  assert.match(copy, /Como é calculado/)
  assert.match(copy, /Como interpretar/)

  await act(async () => trigger.props.onMouseLeave())
  assert.equal(renderer.root.findAllByProps({ role: 'tooltip' }).length, 0)
})

test('drill-down metric cards still open their custom help on hover', async (t) => {
  const h = await workspaceHarness(t)
  const { ReportingMetricCard } = await h.load('/src/domains/reporting/ui/ReportingMetricCard.jsx')
  const renderer = await h.render(ReportingMetricCard, { label: 'Pedidos', value: 12, kind: 'number', onDrilldown() {} })
  const trigger = renderer.root.findByProps({ className: 'reporting-info-tip' })
  await act(async () => trigger.props.onMouseEnter(hoverEvent))
  assert.equal(renderer.root.findAllByProps({ role: 'tooltip' }).length, 1)
})
