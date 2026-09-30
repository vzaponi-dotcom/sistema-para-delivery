import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText, buttonNamed } from './renderWorkspace.js'
export { act, nodeText, buttonNamed }
export const manager = { user: { id: 'm', displayName: 'Maria' }, capabilities: ['access.users.view', 'access.users.manage', 'access.audit.view'] }
export const users = [{ id: 'm', displayName: 'Maria', identifier: 'maria', roleId: 'manager', active: true, credentialState: 'active' }, { id: 'o', displayName: 'Otávio', identifier: 'otavio', roleId: 'operator', active: true, credentialState: 'active' }]
export const roles = [{ id: 'manager', name: 'Gerente', capabilities: ['access.users.manage'] }, { id: 'operator', name: 'Operador', capabilities: ['clients.create', 'clients.update'] }]
export const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })
export async function setup(t, component, props, fetcher) {
  const h = await workspaceHarness(t)
  globalThis.fetch = fetcher
  const { default: Component } = await h.load(`/src/domains/access/ui/${component}.jsx`)
  const screen = await h.render(Component, props)
  return { h, screen, Component }
}
export async function fill(screen, name, value) {
  await act(async () => screen.root.findAllByType('input').find(n => n.props.name === name).props.onChange({ target: { value } }))
}
export async function submit(screen) { await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} })) }
