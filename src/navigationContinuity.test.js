import assert from 'node:assert/strict'
import test from 'node:test'
import { act } from 'react-test-renderer'

import { workspaceHarness } from './test-support/renderWorkspace.js'
import { deferred } from './test-support/comandaFixtures.js'

const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => structuredClone(data) })

function appApi(state) {
  return async (path, options = {}) => {
    const method = options.method || 'GET'
    state.requests.push({ path: String(path), method })
    if (path === '/api/auth/session') return response({ authenticated: true })
    if (path === '/api/bootstrap') return response({ tables: [], tableTabs: [], orders: [], clients: [], products: [], movements: [], financeSettings: null })
    if (path === '/api/printing/stations') return response({ stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] })
    if (path === '/api/printing/jobs?limit=100') return response({ jobs: [] })
    if (path === '/api/printing/jobs/summary') return response({ summary: { safeBacklog: 0 } })
    if (path === '/api/printing/settings') {
      if (method === 'PUT') {
        state.settingsWrites += 1
        return state.settingsSave ? state.settingsSave.promise : response({ settings: { defaultCopies: 2 } })
      }
      return response({ settings: { defaultCopies: state.copies } })
    }
    if (path === '/api/orders') return response({ orders: [] })
    throw new Error(`Unexpected request: ${path} ${method}`)
  }
}

async function navigate(h, target) {
  await act(async () => h.window.dispatchEvent(Object.assign(new Event('app:navigate'), { detail: target })))
}

test('A9 keeps navigation continuity across repeated page cycles', async (t) => {
  const h = await workspaceHarness(t)
  const state = { copies: 1, requests: [], settingsWrites: 0, settingsSave: null }
  globalThis.fetch = appApi(state)
  const { default: App } = await h.load('/src/App.jsx')
  const renderer = await h.render(App, {}, {
    createNodeMock: (element) => element.props.className?.includes('app-content') ? { focus: () => h.recordFocus() } : {},
  })

  const baseline = h.activitySnapshot({ ignoreFocus: true })
  let steadyActivity = null
  const routes = ['settings-printing', 'clients', 'comandas', 'orders']
  for (let cycle = 0; cycle < 10; cycle += 1) {
    for (const route of routes) await navigate(h, route)
    const currentActivity = h.activitySnapshot({ ignoreFocus: true })
    assert.ok(currentActivity.listeners <= baseline.listeners && currentActivity.timers <= baseline.timers, `cycle ${cycle + 1} added a global effect`)
    if (steadyActivity) assert.deepEqual(currentActivity, steadyActivity, `cycle ${cycle + 1} leaked a global effect`)
    else steadyActivity = currentActivity
  }

  const focusAfterNavigation = h.activitySnapshot().focus
  h.setVisibility('hidden')
  await act(async () => h.fireAllIntervals())
  h.setVisibility('visible')
  await act(async () => h.document.dispatchEvent(new Event('visibilitychange')))
  assert.equal(h.activitySnapshot().focus, focusAfterNavigation, 'polling and visibility sync must not steal focus')
  assert.equal(state.requests.filter((request) => request.method === 'POST').length, 0, 'navigation must not submit a payment or physical print')

  await navigate(h, 'settings-printing')
  const secondCopy = renderer.root.findAllByType('input').find((input) => input.props.type === 'radio' && input.props.value === 2)
  state.settingsSave = deferred()
  await act(async () => { void secondCopy.props.onChange({ target: { value: 2 } }) })
  await navigate(h, 'clients')
  await act(async () => { state.settingsSave.resolve(response({ settings: { defaultCopies: 2 } })); await Promise.resolve() })
  await navigate(h, 'settings-printing')
  assert.equal(state.settingsWrites, 1, 'leaving Settings must not resend its pending save')
  assert.equal(renderer.root.findAllByType('input').find((input) => input.props.type === 'radio' && input.props.value === 2).props.checked, true)

  await navigate(h, 'orders')
  const search = renderer.root.findByProps({ placeholder: 'Buscar cliente, pedido, produto ou tipo' })
  await act(async () => search.props.onChange({ target: { value: 'maria' } }))
  await navigate(h, 'clients')
  await navigate(h, 'orders')
  assert.equal(renderer.root.findByProps({ placeholder: 'Buscar cliente, pedido, produto ou tipo' }).props.value, 'maria', 'internal navigation must preserve approved query context')
})
