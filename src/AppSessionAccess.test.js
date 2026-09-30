import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed, nodeText } from './test-support/renderWorkspace.js'
import { comandaDetail } from './test-support/comandaFixtures.js'

test('human enrollment lands on an allowed account context without requesting operational data', async (t) => {
  const h = await workspaceHarness(t)
  const prior = globalThis.fetch
  const paths = []
  globalThis.fetch = async (path) => {
    paths.push(path)
    assert.equal(path, '/api/auth/session')
    return { ok: true, json: async () => ({ authenticated: true, user: { id: 'u', displayName: 'Ana', roleName: 'operator' }, capabilities: [], businessId: 'b', settingsContextId: 's', authMode: 'enrollment', deviceMode: 'shared' }) }
  }
  t.after(() => { globalThis.fetch = prior })
  const { default: App } = await h.load('/src/App.jsx')
  const { renderer, router } = await h.renderAdminApp(App)
  assert.match(nodeText(renderer.root), /acesso operacional aguarda liberação/)
  assert.equal(router.state.location.pathname, '/minha-conta')
  assert.deepEqual(paths, ['/api/auth/session'])
  assert.equal(buttonNamed(renderer.root, 'Novo pedido'), undefined)
})

const operationalSession = { authenticated: true, user: { id: 'u', displayName: 'Ana', roleName: 'operator' }, capabilities: ['orders.view', 'orders.create', 'preferences.local'], businessId: 'b', settingsContextId: 's', authMode: 'user_only', deviceMode: 'shared' }
const bootstrap = { business: { id: 'b', name: 'Loja' }, tables: [], tableTabs: [], orders: [], clients: [], products: [], movements: [], financeSettings: null, effectiveBusinessConfig: { version: 'v', revisions: { operations: 1 }, operations: { enabledModalities: ['Entrega', 'Retirada', 'Local'], defaultModality: 'Entrega', timing: { scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15, immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 40 } } } }
async function operation(t, jobs = []) {
  const h = await workspaceHarness(t)
  const previous = globalThis.fetch
  let revocations = 0
  globalThis.fetch = async (path) => {
    if (path === '/api/auth/logout') { revocations++; return { ok: true, json: async () => ({ authenticated: false }) } }
    const payload = path === '/api/auth/session' ? operationalSession : path === '/api/bootstrap' ? bootstrap : path === '/api/orders' ? { orders: [] } : path === '/api/printing/stations' ? { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] } : String(path).startsWith('/api/printing/jobs?') ? { jobs } : path === '/api/printing/jobs/summary' ? { summary: {} } : null
    assert.ok(payload, `Unexpected ${path}`)
    return { ok: true, json: async () => payload?.jobs ? { ...payload, jobs: [...payload.jobs] } : payload }
  }
  t.after(() => { globalThis.fetch = previous })
  const { default: App } = await h.load('/src/App.jsx')
  const { renderer } = await h.renderAdminApp(App)
  return { h, renderer, revocations: () => revocations }
}
const switchUser = async (renderer) => {
  await act(async () => buttonNamed(renderer.root, 'Loja, operação atual').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Trocar usuário').props.onClick())
}

test('delayed discard confirmation checks the current uncertain print queue before revoking', async (t) => {
  const jobs = []
  const { h, renderer, revocations } = await operation(t, jobs)
  const { default: PrintingOverlays } = await h.load('/src/domains/printing/ui/PrintingOverlays.jsx')
  await act(async () => buttonNamed(renderer.root, 'Novo pedido').props.onClick())
  await act(async () => buttonNamed(renderer.root.findByProps({ 'aria-label': 'Tipo do pedido' }), 'Retirada').props.onClick())
  await switchUser(renderer)
  jobs.push({ id: 'j', status: 'awaiting_confirmation', physicalOutcome: 'unknown' })
  await act(async () => { await renderer.root.findByType(PrintingOverlays).props.printing.refresh() })
  assert.equal(renderer.root.findByType(PrintingOverlays).props.printing.jobs.length, 1)
  await act(async () => buttonNamed(renderer.root, 'Descartar venda').props.onClick())
  assert.equal(revocations(), 0)
  assert.match(nodeText(renderer.root), /Conclua a reconciliação/)
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Tipo do pedido' }).length, 1)
})
test('switch confirms the current dirty order before revocation and clears private wizard state', async (t) => {
  const { renderer, revocations } = await operation(t)
  await act(async () => buttonNamed(renderer.root, 'Novo pedido').props.onClick())
  await act(async () => buttonNamed(renderer.root.findByProps({ 'aria-label': 'Tipo do pedido' }), 'Retirada').props.onClick())
  await switchUser(renderer)
  assert.equal(revocations(), 0)
  assert.match(nodeText(renderer.root), /Descartar venda em andamento/)
  await act(async () => buttonNamed(renderer.root, 'Descartar venda').props.onClick())
  assert.equal(revocations(), 1)
  assert.equal(renderer.root.findAllByProps({ autoComplete: 'username' }).length, 1)
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Tipo do pedido' }).length, 0)
  assert.doesNotMatch(nodeText(renderer.root), /Ana|Loja/)
})

test('switch waits for explicit uncertain printing reconciliation without revocation or replay', async (t) => {
  const { renderer, revocations } = await operation(t, [{ id: 'j', status: 'awaiting_confirmation', physicalOutcome: 'unknown' }])
  await switchUser(renderer)
  assert.equal(revocations(), 0)
  assert.match(nodeText(renderer.root), /Conclua a reconciliação/)
  assert.equal(renderer.root.findAllByProps({ autoComplete: 'username' }).length, 0)
})

test('actual App switch cannot revoke while an accepted comanda payment still needs reconciliation', async (t) => {
  const h = await workspaceHarness(t), previous = globalThis.fetch
  const table = { id: 'occupied', name: 'Mesa 7', isActive: true, occupancy: 'occupied', openTableTab: { id: 'tab-42', number: 42, itemCount: 3, totalCents: 12345 } }
  let payments = 0, revocations = 0
  globalThis.fetch = async (path) => {
    let payload
    if (path === '/api/auth/session') payload = { ...operationalSession, capabilities: ['comandas.view', 'payments.receive', 'preferences.local'] }
    else if (path === '/api/bootstrap') payload = { ...bootstrap, tables: [table], tableTabs: [{ id: 'tab-42', status: 'open' }] }
    else if (path === '/api/table-tabs/tab-42') payload = { tableTab: comandaDetail }
    else if (path === '/api/table-tabs/tab-42/payment') { payments++; payload = { orders: [], movements: [], tableTab: { id: 'tab-42', tableIdentifier: '7', status: 'closed' } } }
    else if (path === '/api/auth/logout') { revocations++; payload = {} }
    else if (path === '/api/printing/stations') payload = { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] }
    else if (String(path).startsWith('/api/printing/jobs?')) payload = { jobs: [] }
    else if (path === '/api/printing/jobs/summary') payload = { summary: {} }
    assert.ok(payload, `Unexpected ${path}`)
    return { ok: true, json: async () => payload }
  }
  t.after(() => { globalThis.fetch = previous })
  const { default: App } = await h.load('/src/App.jsx')
  const { Comandas } = await h.load('/src/domains/table-service/index.js')
  const { default: TableServiceExternalActions } = await h.load('/src/app/surfaces/table-service/TableServiceExternalActions.jsx')
  const { renderer } = await h.renderAdminApp(App, {}, { initialEntries: ['/comandas'] })
  await act(async () => renderer.root.findByType(Comandas).props.onSelectComanda({ tableId: 'occupied', tableTabId: 'tab-42' }))
  const page = renderer.root.findByType(Comandas)
  const owner = { ...page.props.selection, selectionGeneration: page.props.selectionGeneration }
  await act(async () => renderer.root.findByType(TableServiceExternalActions).props.onPay('tab-42', [{ methodCode: 'pix', amountCents: 12345 }], owner))
  assert.equal(payments, 1)
  assert.ok(renderer.root.findByType(Comandas).props.paymentSync)
  await act(async () => buttonNamed(renderer.root, 'Loja, operação atual').props.onClick())
  const action = buttonNamed(renderer.root, 'Trocar usuário')
  assert.equal(action.props.disabled, false)
  await act(async () => action.props.onClick())
  assert.equal(revocations, 0)
  assert.equal(payments, 1)
  assert.match(nodeText(renderer.root), /Conclua a reconciliação/)
})
