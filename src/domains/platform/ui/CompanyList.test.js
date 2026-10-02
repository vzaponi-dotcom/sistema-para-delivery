import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'
import { act } from 'react-test-renderer'

test('linked-manager company does not claim a nonexistent invitation was accepted', async t => {
  const h = await workspaceHarness(t), { default: List } = await h.load('/src/domains/platform/ui/CompanyList.jsx')
  const renderer = await h.render(List, { api: { listBusinesses: async () => ({ items: [{ id: 'A', name: 'Cozinha A', accessStatus: 'active', firstManager: { name: 'Ana', email: 'ana@example.test', source: 'membership' }, invitation: null }], nextCursor: null }) } })
  assert.match(nodeText(renderer.root), /Ana/)
  assert.doesNotMatch(nodeText(renderer.root), /Convite aceito/)
  assert.match(nodeText(renderer.root), /Sem convite pendente/)
})
test('administrative list paginates, searches and shows registration metadata without operational data', async t => {
  const calls = [], h = await workspaceHarness(t), { default: List } = await h.load('/src/domains/platform/ui/CompanyList.jsx')
  const renderer = await h.render(List, { api: { listBusinesses: async input => { calls.push(input); return { items: [{ id: 'A', name: 'Cozinha A', accessStatus: 'pending', firstManager: { name: 'Ana', email: 'ana@example.test' }, invitation: { status: 'pending', deliveryStatus: 'uncertain' }, orders: ['PRIVATE ORDER'] }], nextCursor: input.cursor ? null : 'next' } } } })
  assert.match(nodeText(renderer.root), /Cozinha A.*Ana.*Aguardando ativação.*Envio não confirmado/s)
  assert.doesNotMatch(nodeText(renderer.root), /PRIVATE ORDER/)
  await act(async () => buttonNamed(renderer.root, 'Próxima página').props.onClick())
  assert.equal(calls[1].cursor, 'next')
})
