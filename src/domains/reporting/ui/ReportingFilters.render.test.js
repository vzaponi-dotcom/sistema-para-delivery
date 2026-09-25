import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('filters render period presets and view-applicable controls with functional change events', async (t) => {
  const harness = await workspaceHarness(t)
  const { ReportingFilters } = await harness.load('/src/domains/reporting/ui/ReportingFilters.jsx')
  const changes = []
  const renderer = await harness.render(ReportingFilters, { query: { view: 'sales', period: 'current-month', from: '2026-09-01', to: '2026-09-25' }, onChange: (patch) => changes.push(patch) })
  assert.match(nodeText(renderer.root), /Mês atual/)
  assert.match(nodeText(renderer.root), /Forma de pagamento/)
  renderer.root.findAllByType('button').find((button) => nodeText(button) === '7 dias').props.onClick()
  assert.deepEqual(changes.at(-1), { period: '7-days' })
  const method = renderer.root.findAllByProps({ role: 'combobox' }).find((select) => select.props['aria-label'] === 'Forma de pagamento')
  assert.ok(method)
})

test('visual product filter sends a historical name instead of a canonical identity', async (t) => {
  const harness = await workspaceHarness(t)
  const { ReportingFilters } = await harness.load('/src/domains/reporting/ui/ReportingFilters.jsx')
  const changes = []
  const renderer = await harness.render(ReportingFilters, {
    query: { view: 'products', period: 'custom', from: '2026-09-01', to: '2026-09-25', product: 'catalog-id' },
    onChange: (patch) => changes.push(patch),
  })
  const nameInput = renderer.root.findAllByType('input').find((input) => input.props.placeholder === 'Nome histórico')
  assert.ok(nameInput)
  nameInput.props.onChange({ target: { value: 'X-Bacon' } })
  assert.deepEqual(changes.at(-1), { productName: 'X-Bacon', product: null })
})
