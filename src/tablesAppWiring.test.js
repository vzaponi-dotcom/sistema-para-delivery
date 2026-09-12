import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { act } from 'react-test-renderer'
import { workspaceHarness, workspaceTables, nodeText, buttonNamed } from './test-support/renderWorkspace.js'
import { deferred } from './test-support/comandaFixtures.js'

const app = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

async function tablesWorkspace(t) {
  const h = await workspaceHarness(t)
  const state = { tables: workspaceTables, expired: false, writes: [], pending: deferred() }
  globalThis.fetch = async (path, options = {}) => {
    if (path === '/api/tables' && options.method === 'POST') { state.writes.push(JSON.parse(options.body)); return state.pending.promise }
    if (path === '/api/bootstrap' && state.expired) return { ok: false, status: 401, json: async () => ({ error: { message: 'Sessão expirada' } }) }
    const responses = {
      '/api/auth/session': { authenticated: true }, '/api/auth/login': {},
      '/api/bootstrap': { tables: state.tables, orders: [], movements: [], products: [], clients: [], tableTabs: [], financeSettings: null },
      '/api/printing/stations': { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] },
      '/api/printing/jobs?limit=100': { jobs: [] },
    }
    assert.ok(Object.hasOwn(responses, path), path)
    return { ok: true, json: async () => structuredClone(responses[path]) }
  }
  const { default: App } = await h.load('/src/App.jsx')
  const r = await h.render(App)
  const navigate = async () => act(async () => buttonNamed(r.root.findByProps({ 'aria-label': 'Menu principal' }), 'Mesas').props.onClick())
  await navigate()
  return { h, r, state, navigate }
}

test('App consumes official bootstrap tables and clears old business tables on session reset', async (t) => {
  const { h, r, state, navigate } = await tablesWorkspace(t)
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Lista de mesas' })), /Mesa 7AtivaOcupada/)
  state.expired = true
  await act(async () => h.window.dispatchEvent(new Event('focus')))
  assert.equal(r.root.findAllByProps({ 'aria-label': 'Lista de mesas' }).length, 0)
  state.expired = false; state.tables = []
  await act(async () => r.root.findByProps({ placeholder: 'Digite o PIN' }).props.onChange({ target: { value: '1234' } }))
  await act(async () => r.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await navigate()
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Lista de mesas' })), /Nenhuma mesa cadastrada/)
  assert.doesNotMatch(nodeText(r.root), /Mesa 7|Varanda/)
})

test('table creation applies the returned official list without predicting name or occupancy', async (t) => {
  const { r, state } = await tablesWorkspace(t)
  await act(async () => r.root.findByProps({ placeholder: 'Ex: Varanda 1' }).props.onChange({ target: { value: 'Nome solicitado' } }))
  await act(async () => { void r.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
  assert.deepEqual(state.writes, [{ name: 'Nome solicitado' }])
  assert.ok(buttonNamed(r.root, 'Adicionar').props.disabled)
  assert.doesNotMatch(nodeText(r.root.findByProps({ 'aria-label': 'Lista de mesas' })), /Nome solicitado|Nome oficial/)
  const returned = [{ id: 'new', name: 'Nome oficial', isActive: true, sortOrder: 1, occupancy: 'occupied', openTableTab: { id: 'tab-new', number: 99, itemCount: 1, totalCents: 2000 } }]
  await act(async () => state.pending.resolve({ ok: true, json: async () => ({ tables: returned }) }))
  const list = r.root.findByProps({ 'aria-label': 'Lista de mesas' })
  assert.match(nodeText(list), /Nome oficialAtivaOcupada/)
  assert.doesNotMatch(nodeText(list), /Mesa 7|Varanda|Nome solicitado/)
  assert.ok(buttonNamed(list, 'Ver comanda'))
})

test('App prepares table mutation handlers using official API responses and request keys', () => {
  for (const alias of ['createTableApi', 'updateTableApi', 'reorderTablesApi', 'transferTableTabApi']) {
    assert.match(app, new RegExp(alias))
  }
  for (const handler of ['handleCreateTable', 'handleRenameTable', 'handleSetTableActive', 'handleReorderTables', 'handleTransferTableTab']) {
    assert.match(app, new RegExp(`const ${handler} = async`))
  }
  assert.match(app, /transferTableTabApi\(sourceTableId, destinationTableId, expectedTableTabId\)[\s\S]*?applyOfficialEffects\(\{ tables: result\.tables, tableTab: result\.tableTab \}\)/)
})

test('NewOrder receives the official tables collection for registered table selection', () => {
  assert.match(app, /<NewOrder[\s\S]*?tables=\{tables\}/)
})
