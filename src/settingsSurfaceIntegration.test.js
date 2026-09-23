import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'

import { buttonNamed, workspaceHarness } from './test-support/renderWorkspace.js'

const flush = async () => {
  for (let index = 0; index < 30; index += 1) await Promise.resolve()
}

const resource = (revision = 1) => ({
  revision,
  data: {
    enabledModalities: ['Entrega', 'Retirada', 'Local'],
    defaultModality: 'Entrega',
    timing: {
      scheduledPrepLeadMinutes: 50,
      scheduledLateGraceMinutes: 15,
      immediateLateAfterMinutes: 30,
      immediateVeryLateAfterMinutes: 40,
    },
  },
})

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => structuredClone(body),
})

async function mountOperationsApp(t, saveMode) {
  const h = await workspaceHarness(t)
  const effectiveRefreshes = []
  let operationsRevision = 1
  const initial = resource()
  const current = resource(2)
  current.data.timing.scheduledPrepLeadMinutes = 41

  globalThis.fetch = async (path, options = {}) => {
    const url = String(path)
    if (url === '/api/auth/session') return response({
      authenticated: true,
      businessId: 'business-1',
      settingsContextId: 'settings-context-1',
      capabilities: ['orders.view', 'operations.settings.view', 'operations.settings.manage'],
    })
    if (url === '/api/bootstrap') return response({
      tables: [], tableTabs: [], orders: [], clients: [], products: [], movements: [], financeSettings: null,
      effectiveBusinessConfig: { version: 'v1', revisions: { operations: 1 }, operations: initial.data },
    })
    if (url === '/api/printing/stations') return response({ stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] })
    if (url === '/api/printing/jobs?limit=100') return response({ jobs: [] })
    if (url === '/api/printing/jobs/summary') return response({ summary: { safeBacklog: 0 } })
    if (url === '/api/settings/operations' && (options.method || 'GET') === 'GET') return response(operationsRevision === 1 ? initial : current)
    if (url === '/api/settings/operations' && options.method === 'PUT') {
      if (saveMode === 'confirmed') return response({ resource: current, receipt: { committedRevision: 2 } })
      if (saveMode === 'conflict') return response({ message: 'revisão desatualizada' }, 409)
      return response({ message: 'resultado desconhecido' }, 503)
    }
    if (url.startsWith('/api/settings/receipts/')) return response({ status: 'confirmed', receipt: { committedRevision: 2 } })
    if (url.startsWith('/api/settings/effective')) {
      effectiveRefreshes.push(url)
      return response({ version: 'v2', revisions: { operations: 2 }, operations: current.data })
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  const { default: App } = await h.load('/src/App.jsx')
  const { renderer } = await h.renderAdminApp(App)
  await act(flush)
  await act(async () => {
    h.window.dispatchEvent(Object.assign(new Event('app:navigate'), { detail: 'settings-operations' }))
    await flush()
  })
  return { h, renderer, effectiveRefreshes, setReconciled() { operationsRevision = 2 } }
}

async function saveOperations(renderer) {
  const input = renderer.root.findByProps({ name: 'scheduledPrepLeadMinutes' })
  await act(async () => input.props.onChange({ target: { value: '41' } }))
  await act(async () => buttonNamed(renderer.root, 'Salvar alterações').props.onClick())
}

test('a confirmed Settings policy save refreshes effective config through the App boundary', async (t) => {
  const fixture = await mountOperationsApp(t, 'confirmed')

  await saveOperations(fixture.renderer)

  assert.deepEqual(fixture.effectiveRefreshes, ['/api/settings/effective?knownVersion=v1'])
})

test('a Settings policy conflict does not refresh effective config', async (t) => {
  const conflict = await mountOperationsApp(t, 'conflict')
  await saveOperations(conflict.renderer)
  assert.deepEqual(conflict.effectiveRefreshes, [])
})

test('an unconfirmed Settings policy save refreshes effective config only after reconciliation', async (t) => {
  const unconfirmed = await mountOperationsApp(t, 'unconfirmed')
  await saveOperations(unconfirmed.renderer)
  assert.deepEqual(unconfirmed.effectiveRefreshes, [])

  unconfirmed.setReconciled()
  await act(async () => buttonNamed(unconfirmed.renderer.root, 'Reconsultar').props.onClick())
  assert.deepEqual(unconfirmed.effectiveRefreshes, ['/api/settings/effective?knownVersion=v1'])
})
