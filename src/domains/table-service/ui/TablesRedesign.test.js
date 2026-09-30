import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, workspaceHarness } from '../../../test-support/renderWorkspace.js'

const tables = () => [
  { id: 'occupied', name: 'Mesa 1', sortOrder: 0, isActive: true, occupancy: 'occupied', openTableTab: { id: 'tab-1', number: 41 } },
  { id: 'reserved', name: 'Varanda', sortOrder: 1, isActive: true, occupancy: 'free', nextReservation: { clientName: 'Hugo', scheduledFor: '2026-09-30T15:00:00Z' } },
  { id: 'free', name: 'Salão', sortOrder: 2, isActive: true, occupancy: 'free' },
  { id: 'inactive', name: 'Mesa 8', sortOrder: 3, isActive: false, occupancy: 'free' },
]
const row = (screen, id) => screen.root.findByProps({ 'data-table-id': id })
const ids = (screen) => screen.root.findAllByType('article').map(n => n.props['data-table-id'])
async function setup(t, extra = {}) {
  const h = await workspaceHarness(t)
  const { default: Tables } = await h.load('/src/domains/table-service/ui/Tables.jsx')
  const props = { tables: tables(), disabled: false, onCreate: async () => true, onRename: async () => true, onSetActive: async () => true, onReorder: async () => true, ...extra }
  return { h, Tables, props, screen: await h.render(Tables, props) }
}
test('search and active filters retain independent reservation and occupancy information', async t => {
  const { screen } = await setup(t)
  assert.equal(screen.root.findAllByType('form').length, 0)
  assert.match(nodeText(row(screen, 'reserved')), /Livre agora.*Reserva.*Hugo.*30\/09\/2026.*12:00/s)
  assert.doesNotMatch(nodeText(row(screen, 'inactive')), /Livre/)
  await act(async () => screen.root.findByProps({ 'aria-label': 'Buscar pelo nome da mesa' }).props.onChange({ target: { value: 'salao' } }))
  assert.deepEqual(ids(screen), ['free'])
  await act(async () => buttonNamed(screen.root, 'Inativas').props.onClick())
  assert.match(nodeText(screen.root), /Nenhuma mesa encontrada/)
  await act(async () => buttonNamed(screen.root, 'Limpar busca e filtros').props.onClick())
  assert.deepEqual(ids(screen), ['occupied', 'reserved', 'free', 'inactive'])
})
test('create modal keeps a failed name and closes only after successful submission', async t => {
  let succeed = false
  const calls = []
  const { screen } = await setup(t, { onCreate: async name => { calls.push(name); return succeed } })
  await act(async () => buttonNamed(screen.root, 'Nova mesa').props.onClick())
  await act(async () => screen.root.findByProps({ id: 'table-name' }).props.onChange({ target: { value: '  Jardim 1  ' } }))
  const submit = () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} })
  await act(submit)
  assert.equal(screen.root.findAllByProps({ role: 'dialog' }).length, 1)
  succeed = true
  await act(submit)
  assert.deepEqual(calls, ['Jardim 1', 'Jardim 1'])
  assert.equal(screen.root.findAllByProps({ role: 'dialog' }).length, 0)
})
test('ordering resets filters and submits all table IDs; pending writes block duplicate moves', async t => {
  const calls = []
  let resolve
  const { screen } = await setup(t, { onReorder: ids => { calls.push(ids); return new Promise(r => { resolve = r }) } })
  await act(async () => buttonNamed(screen.root, 'Ativas').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Organizar ordem').props.onClick())
  assert.equal(ids(screen).length, 4)
  const move = row(screen, 'free').props.onKeyDown
  let pending
  await act(async () => { pending = move({ altKey: true, key: 'ArrowUp', preventDefault() {} }) })
  assert.deepEqual(calls, [['occupied', 'free', 'reserved', 'inactive']])
  await act(async () => move({ altKey: true, key: 'ArrowUp', preventDefault() {} }))
  assert.equal(calls.length, 1)
  assert.equal(buttonNamed(screen.root, 'Reordenar Salão').props.disabled, true)
  await act(async () => { resolve(false); await pending })
  assert.deepEqual(ids(screen), ['occupied', 'reserved', 'free', 'inactive'], 'failed reorder must retain official order')
  assert.equal(buttonNamed(screen.root, 'Reordenar Mesa 1').props.disabled, true)
})
test('occupied and reserved tables block management; read-only users retain exact comanda link', async t => {
  const opened = []
  const { screen } = await setup(t, { canOpenComanda: true, onOpenComanda: x => opened.push(x) })
  for (const id of ['occupied', 'reserved']) {
    assert.equal(buttonNamed(row(screen, id), 'Renomear').props.disabled, true)
    assert.equal(buttonNamed(row(screen, id), 'Desativar').props.disabled, true)
  }
  await act(async () => buttonNamed(row(screen, 'occupied'), 'Ver comanda').props.onClick())
  assert.deepEqual(opened, [{ tableId: 'occupied', tableTabId: 'tab-1' }])
  const readonly = await setup(t, { canManageTables: false })
  for (const name of ['Nova mesa', 'Organizar ordem', 'Renomear', 'Desativar', 'Reativar']) assert.equal(buttonNamed(readonly.screen.root, name), undefined)
})
test('rename and deactivation revalidate a table that becomes reserved while its dialog is open', async t => {
  let writes = 0
  const { screen, Tables, props } = await setup(t, { onRename: async () => { writes++; return true }, onSetActive: async () => { writes++; return true } })
  await act(async () => buttonNamed(row(screen, 'free'), 'Renomear').props.onClick())
  const changed = props.tables.map(x => x.id === 'free' ? { ...x, nextReservation: { clientName: 'Hugo', scheduledFor: '2026-09-30T15:00:00Z' } } : x)
  const React = await import('react')
  await act(async () => screen.update(React.createElement(Tables, { ...props, tables: changed })))
  await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.equal(writes, 0)
  assert.equal(buttonNamed(screen.root, 'Salvar nome').props.disabled, true)
  await act(async () => buttonNamed(screen.root, 'Cancelar').props.onClick())
  await act(async () => screen.update(React.createElement(Tables, props)))
  await act(async () => buttonNamed(row(screen, 'free'), 'Desativar').props.onClick())
  await act(async () => screen.update(React.createElement(Tables, { ...props, tables: changed })))
  assert.equal(buttonNamed(screen.root, 'Desativar mesa').props.disabled, true)
  await act(async () => buttonNamed(screen.root, 'Desativar mesa').props.onClick())
  assert.equal(writes, 0)
})
