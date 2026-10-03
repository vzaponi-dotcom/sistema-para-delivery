import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'
import { act } from 'react-test-renderer'
test('double click registers one creation while its response is pending', async t => {
  const h = await workspaceHarness(t), { default: Screen } = await h.load('/src/domains/platform/ui/NewCompany.jsx')
  let calls = 0, resolve
  const renderer = await h.render(Screen, { api: { createBusiness: () => { calls++; return new Promise(done => { resolve = done }) } } })
  for (const [name, value] of Object.entries({ name: 'A', managerName: 'Ana', managerEmail: 'ana@example.test' })) await act(async () => renderer.root.findAllByType('input').find(node => node.props.name === name).props.onChange({ target: { value } }))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  const click = buttonNamed(renderer.root, 'Criar empresa e enviar convite').props.onClick
  let pending
  await act(async () => { pending = click(); await click() })
  assert.equal(calls, 1)
  await act(async () => { resolve({ businessId: 'A' }); await pending })
})
test('three fields are reviewed before creation and an uncertain response retains one UUID and original payload', async t => {
  const calls = [], h = await workspaceHarness(t), { default: NewCompany } = await h.load('/src/domains/platform/ui/NewCompany.jsx')
  const renderer = await h.render(NewCompany, { api: { createBusiness: async (input, key) => { calls.push([input, key]); if (calls.length === 1) throw new Error('lost response'); return { businessId: 'A', created: false } } }, randomUUID: () => 'stable-attempt', onCreated: id => assert.equal(id, 'A') })
  for (const [name, value] of Object.entries({ name: 'Cozinha A', managerName: 'Ana', managerEmail: 'ANA@EXAMPLE.TEST' })) await act(async () => renderer.root.findAllByType('input').find(node => node.props.name === name).props.onChange({ target: { value } }))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.deepEqual(calls, [])
  assert.match(nodeText(renderer.root), /Confira o cadastro/)
  await act(async () => buttonNamed(renderer.root, 'Criar empresa e enviar convite').props.onClick())
  assert.match(nodeText(renderer.root), /Não foi possível confirmar/)
  await act(async () => buttonNamed(renderer.root, 'Verificar cadastro').props.onClick())
  assert.deepEqual(calls[0], calls[1])
  assert.equal(calls[0][1], 'stable-attempt')
  assert.equal(calls[0][0].managerEmail, 'ana@example.test')
})
