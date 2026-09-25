import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('products render ranking, categories and drill-down from API data', async (t) => {
  const harness = await workspaceHarness(t)
  const { ProductsReport } = await harness.load('/src/domains/reporting/ui/views/ProductsReport.jsx')
  const drilled = []
  const item = { id: 'p1', name: 'X-Bacon', size: 'Grande', category: 'Lanches', quantity: 3, revenueCents: 4500, sharePercent: 100, growthPercent: 50 }
  const renderer = await harness.render(ProductsReport, { state: {
    data: { unitsSold: 3, mealsSold: 0, merchandiseRevenueCents: 4500, ranking: [item], top10: [item], categories: [{ category: 'Lanches', quantity: 3, revenueCents: 4500 }], presentations: [{ productId: 'p1', name: 'X-Bacon', size: 'Grande', quantity: 3, revenueCents: 4500 }] },
    loading: false,
  }, onDrilldown: (id) => drilled.push(id) })
  assert.match(nodeText(renderer.root), /Top 10 produtos/)
  assert.match(nodeText(renderer.root), /Receita por categoria/)
  assert.match(nodeText(renderer.root), /Ranking completo/)
  assert.match(nodeText(renderer.root), /R\$\s*45,00/)
  renderer.root.findAllByType('button').find((button) => nodeText(button).startsWith('X-Bacon')).props.onClick()
  assert.deepEqual(drilled, ['p1'])
})
