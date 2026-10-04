import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed } from '../../test-support/renderWorkspace.js'

for (const inDialog of [true, false]) test(`selection reveals its expanded list only inside a dialog (${inDialog})`, async t => {
  const h = await workspaceHarness(t)
  const { default: SystemSelect } = await h.load('/src/shared/ui/SystemSelect.jsx')
  const scrolls = []
  const dropdown = { closest: () => inDialog ? {} : null, scrollIntoView: options => scrolls.push(options) }
  const renderer = await h.render(SystemSelect, { label: 'Motivo', options: [{ value: 'first', label: 'Primeiro' }, { value: 'last', label: 'Último' }], value: '', onChange() {} }, { createNodeMock: element => element.props.role === 'listbox' ? dropdown : null })
  assert.equal(scrolls.length, 0)
  await act(async () => buttonNamed(renderer.root, 'Motivo').props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'option' }).length, 2)
  assert.deepEqual(scrolls, inDialog ? [{ block: 'nearest', inline: 'nearest' }] : [])
})
