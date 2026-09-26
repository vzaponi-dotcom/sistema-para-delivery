import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('filters render period presets and view-applicable controls with functional change events', async (t) => {
  const harness = await workspaceHarness(t)
  const { ReportingFilters } = await harness.load('/src/domains/reporting/ui/ReportingFilters.jsx')
  const changes = []
  const renderer = await harness.render(ReportingFilters, {
    query: { view: 'sales', period: 'current-month', from: '2026-09-01', to: '2026-09-25' },
    onChange: (patch) => changes.push(patch),
    exportAction: 'Exportar relatório',
  })
  assert.match(nodeText(renderer.root), /Mês atual/)
  assert.match(nodeText(renderer.root), /Forma de pagamento/)
  assert.match(nodeText(renderer.root), /Exportar relatório/)
  renderer.root.findAllByType('button').find((button) => nodeText(button) === '7 dias').props.onClick()
  assert.deepEqual(changes.at(-1), { period: '7-days' })
  const method = renderer.root.findAllByProps({ role: 'combobox' }).find((select) => select.props['aria-label'] === 'Forma de pagamento')
  assert.ok(method)
})

test('manual category and product filters stay out of the top reporting filter UI', async (t) => {
  const harness = await workspaceHarness(t)
  const { ReportingFilters } = await harness.load('/src/domains/reporting/ui/ReportingFilters.jsx')
  const renderer = await harness.render(ReportingFilters, {
    query: { view: 'products', period: 'custom', from: '2026-09-01', to: '2026-09-25' },
    onChange: () => {},
  })
  const text = nodeText(renderer.root)
  assert.doesNotMatch(text, /Categoria/)
  assert.doesNotMatch(text, /Produto por nome/)
  assert.match(text, /Cliente/)
})


test('detail top toolbar keeps payment in the primary row and omits the global advanced popover', async (t) => {
  const harness = await workspaceHarness(t)
  const { ReportingFilters } = await harness.load('/src/domains/reporting/ui/ReportingFilters.jsx')
  const renderer = await harness.render(ReportingFilters, {
    query: { view: 'detail', period: '30-days', from: '2026-08-27', to: '2026-09-25', paymentMethod: null },
    onChange: () => {},
  })
  const text = nodeText(renderer.root)
  assert.match(text, /Período/)
  assert.match(text, /30 dias/)
  assert.match(text, /Forma de pagamento/)
  assert.doesNotMatch(text, /Mais filtros/)
})
