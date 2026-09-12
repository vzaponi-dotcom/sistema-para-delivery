import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed, nodeText } from './test-support/renderWorkspace.js'

const granted = new Set(['orders.view', 'comandas.view', 'finance.overview', 'printing.queue', 'clients.view', 'products.view', 'tables.view', 'printing.settings', 'preferences.local'])
const implemented = new Set(['orders', 'comandas', 'dashboard', 'print-queue', 'clients', 'products', 'tables', 'settings-printing', 'settings-device'])

for (const component of ['Sidebar', 'MobileNavigation']) {
  test(`${component} opens Comandas directly after Pedidos and marks it current`, async (t) => {
    const harness = await workspaceHarness(t)
    const { default: Navigation } = await harness.load(`/src/components/${component}.jsx`)
    const destinations = []
    const renderer = await harness.render(Navigation, { activeTab: 'comandas', granted, implemented, onNavigate: (id) => destinations.push(id) })
    const nav = renderer.root.findByType('nav')
    const labels = nav.findAllByType('button').map(nodeText)
    assert.equal(labels[labels.indexOf('Pedidos') + 1], 'Comandas')
    const comandas = buttonNamed(nav, 'Comandas')
    assert.equal(comandas.props['aria-current'], 'page')
    await act(async () => comandas.props.onClick())
    assert.deepEqual(destinations, ['comandas'])
    if (component === 'MobileNavigation') {
      assert.deepEqual(labels, ['Pedidos', 'Comandas', 'Financeiro', 'Mais'])
      assert.equal(buttonNamed(nav, 'Mais').props['aria-current'], undefined)
    }
  })
}
