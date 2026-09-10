import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed, nodeText } from './test-support/renderWorkspace.js'

for (const component of ['Sidebar', 'MobileNavigation']) {
  test(`${component} opens Comandas directly after Pedidos and marks it current`, async (t) => {
    const harness = await workspaceHarness(t)
    const { default: Navigation } = await harness.load(`/src/components/${component}.jsx`)
    const destinations = []
    const renderer = await harness.render(Navigation, { activeTab: 'comandas', onNavigate: (id) => destinations.push(id) })
    const nav = renderer.root.findByType('nav')
    const labels = nav.findAllByType('button').map(nodeText)
    assert.equal(labels[labels.indexOf('Pedidos') + 1], 'Comandas')
    const comandas = buttonNamed(nav, 'Comandas')
    assert.equal(comandas.props['aria-current'], 'page')
    await act(async () => comandas.props.onClick())
    assert.deepEqual(destinations, ['comandas'])
    if (component === 'MobileNavigation') {
      assert.deepEqual(labels, ['Dashboard', 'Pedidos', 'Comandas', 'Clientes', 'Mais'])
      assert.equal(buttonNamed(nav, 'Mais').props['aria-current'], undefined)
    }
  })
}
