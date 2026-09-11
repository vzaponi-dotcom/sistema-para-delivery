import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { buttonNamed, nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const flush = () => new Promise((resolve) => setImmediate(resolve))
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
const response = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
})

async function mountController(t, { printing = {}, sessionKey = 'session-1', onFeedback = () => {} } = {}) {
  const requestedFetch = globalThis.fetch
  const h = await workspaceHarness(t)
  globalThis.fetch = requestedFetch
  const { usePrintingSettingsController } = await h.load('/src/app/usePrintingSettingsController.js')
  const api = React.createRef()

  const Probe = React.forwardRef(function Probe({ currentSessionKey = sessionKey, visible = true }, ref) {
    const settings = usePrintingSettingsController({
      authenticated: true,
      sessionKey: currentSessionKey,
      printing,
      granted: new Set(['printing.settings', 'printing.station.configure']),
      onFeedback,
    })
    React.useImperativeHandle(ref, () => settings, [settings])
    return visible ? React.createElement('output', null, settings.resources['business-copies'].status) : null
  })

  const renderer = await h.render(Probe, { ref: api })
  await act(flush)
  return { h, api, renderer, Probe }
}

test('App permite sair durante o save de vias, voltar pendente e impede PUT conflitante', async (t) => {
  const h = await workspaceHarness(t)
  const save = deferred()
  const requests = []
  globalThis.fetch = async (path, options = {}) => {
    const url = String(path)
    const method = options.method || 'GET'
    requests.push([url, method])
    if (url === '/api/auth/session') return response({ authenticated: true })
    if (url === '/api/bootstrap') return response({ tables: [], tableTabs: [], orders: [], clients: [], products: [], movements: [], financeSettings: null })
    if (url === '/api/printing/stations') return response({ stations: [{ id: 'test-station', name: 'Cozinha', platform: 'other', isPrimary: false, autoPrintEnabled: false }] })
    if (url.startsWith('/api/printing/jobs?')) return response({ jobs: [] })
    if (url === '/api/printing/jobs/summary') return response({ summary: { safeBacklog: 1 } })
    if (url === '/api/printing/settings' && method === 'GET') return response({ settings: { defaultCopies: 1 } })
    if (url === '/api/printing/settings' && method === 'PUT') return save.promise
    throw new Error(`Unexpected request: ${url} ${method}`)
  }

  const { default: App } = await h.load('/src/App.jsx')
  const renderer = await h.render(App)
  const navigate = async (id) => act(async () => h.window.dispatchEvent(Object.assign(new Event('app:navigate'), { detail: id })))
  await navigate('settings-printing')
  const copies = () => renderer.root.findAllByType('input').find((node) => node.props.type === 'radio' && node.props.value === 2)
  const fieldset = () => renderer.root.findByType('fieldset')

  let pending
  await act(async () => { pending = copies().props.onChange({ target: { value: '2' } }); await flush() })
  assert.equal(fieldset().props.disabled, true)
  await navigate('clients')
  assert.equal(buttonNamed(renderer.root.findByProps({ 'aria-label': 'Menu principal' }), 'Clientes').props['aria-current'], 'page')
  await navigate('settings-printing')
  assert.equal(fieldset().props.disabled, true)
  await act(async () => copies().props.onChange({ target: { value: '2' } }))
  assert.equal(requests.filter(([url, method]) => url === '/api/printing/settings' && method === 'PUT').length, 1)

  await navigate('clients')
  save.resolve(response({ settings: { defaultCopies: 2 } }))
  await act(async () => { await pending; await flush() })
  await navigate('settings-printing')
  assert.equal(copies().props.checked, true)
  assert.equal(fieldset().props.disabled, false)
})

test('GET antigo não sobrescreve PUT mais recente', async (t) => {
  const oldRead = deferred()
  let reads = 0
  globalThis.fetch = async (_path, options = {}) => {
    if ((options.method || 'GET') === 'PUT') return response({ settings: { defaultCopies: 2 } })
    reads += 1
    return reads === 1 ? response({ settings: { defaultCopies: 1 } }) : oldRead.promise
  }
  const { api } = await mountController(t)
  let reload
  await act(async () => { reload = api.current.reload('business-copies'); await flush() })
  await act(async () => api.current.saveCopies(2))
  oldRead.resolve(response({ settings: { defaultCopies: 1 } }))
  await act(async () => { await reload; await flush() })
  assert.equal(api.current.resources['business-copies'].confirmedValue, 2)
})

test('sucesso conclui com a página fechada e publica feedback identificado', async (t) => {
  const save = deferred()
  const feedback = []
  globalThis.fetch = async (_path, options = {}) => (options.method === 'PUT'
    ? save.promise
    : response({ settings: { defaultCopies: 1 } }))
  const { api, renderer, Probe } = await mountController(t, { onFeedback: (value) => feedback.push(value) })
  let pending
  await act(async () => { pending = api.current.saveCopies(2); await flush() })
  await act(async () => renderer.update(React.createElement(Probe, { ref: api, visible: false })))
  save.resolve(response({ settings: { defaultCopies: 2 } }))
  await act(async () => { await pending; await flush() })
  assert.equal(api.current.resources['business-copies'].confirmedValue, 2)
  assert.match(String(feedback.at(-1)), /vias|impressão/i)
})

test('erro conclusivo preserva último valor confirmado e libera edição', async (t) => {
  globalThis.fetch = async (_path, options = {}) => options.method === 'PUT'
    ? response({ error: { message: 'Vias inválidas', code: 'INVALID_COPIES' } }, 422)
    : response({ settings: { defaultCopies: 1 } })
  const { api } = await mountController(t)
  await act(async () => api.current.saveCopies(2))
  const resource = api.current.resources['business-copies']
  assert.equal(resource.status, 'error')
  assert.equal(resource.confirmedValue, 1)
  assert.match(resource.error, /Vias inválidas/)
})

test('timeout, rede ou 5xx deixa resultado não confirmado e faz uma reconsulta sem repetir PUT', async (t) => {
  let reads = 0
  let writes = 0
  globalThis.fetch = async (_path, options = {}) => {
    if (options.method === 'PUT') { writes += 1; return response({ error: { message: 'Tempo esgotado' } }, 503) }
    reads += 1
    return response({ settings: { defaultCopies: reads === 1 ? 1 : 2 } })
  }
  const { api } = await mountController(t)
  await act(async () => api.current.saveCopies(2))
  assert.equal(api.current.resources['business-copies'].status, 'idle')
  assert.equal(api.current.resources['business-copies'].confirmedValue, 2)
  assert.equal(reads, 2)
  assert.equal(writes, 1)
})

test('reconsulta falha mantém edição bloqueada e só Reconsultar lê novamente', async (t) => {
  let reads = 0
  let writes = 0
  globalThis.fetch = async (_path, options = {}) => {
    if (options.method === 'PUT') { writes += 1; throw new TypeError('network') }
    reads += 1
    if (reads === 1) return response({ settings: { defaultCopies: 1 } })
    throw new TypeError('offline')
  }
  const { api } = await mountController(t)
  await act(async () => api.current.saveCopies(2))
  assert.equal(api.current.resources['business-copies'].status, 'unconfirmed')
  await act(async () => api.current.saveCopies(2))
  assert.equal(writes, 1)
  await act(async () => api.current.reload('business-copies'))
  assert.equal(reads, 3)
  assert.equal(api.current.resources['business-copies'].status, 'unconfirmed')
})

test('logout ou nova sessão ignora conclusão antiga', async (t) => {
  const save = deferred()
  let reads = 0
  globalThis.fetch = async (_path, options = {}) => options.method === 'PUT'
    ? save.promise
    : response({ settings: { defaultCopies: ++reads === 1 ? 1 : 2 } })
  const { api, renderer, Probe } = await mountController(t)
  let pending
  await act(async () => { pending = api.current.saveCopies(2); await flush() })
  await act(async () => { await renderer.update(React.createElement(Probe, { ref: api, currentSessionKey: 'session-2' })); await flush() })
  save.resolve(response({ settings: { defaultCopies: 1 } }))
  await act(async () => { await pending; await flush() })
  assert.equal(api.current.resources['business-copies'].confirmedValue, 2)
})

test('manager não aplica resposta antiga de estação depois que sua geração de sessão mudou', async (t) => {
  const h = await workspaceHarness(t, { userAgent: 'Android' })
  const stationWrite = deferred()
  const station = { id: 'test-station', name: 'Cozinha', platform: 'android', autoPrintEnabled: false, isPrimary: false }
  globalThis.fetch = async (path, options = {}) => {
    const url = String(path)
    if (url.startsWith('/api/printing/stations/') && options.method === 'PUT') return stationWrite.promise
    if (url === '/api/printing/stations') return response({ stations: [station] })
    if (url.startsWith('/api/printing/jobs?')) return response({ jobs: [] })
    if (url === '/api/printing/jobs/summary') return response({ summary: { safeBacklog: 0 } })
    throw new Error(`Unexpected request: ${url}`)
  }
  const { usePrintingManager } = await h.load('/src/printing/usePrintingManager.js')
  const api = React.createRef()
  const Probe = React.forwardRef(function Probe({ authenticated }, ref) {
    const printing = usePrintingManager({ authenticated, isOnline: true })
    React.useImperativeHandle(ref, () => printing, [printing])
    return React.createElement('output', null, printing.localStation?.autoPrintEnabled ? 'on' : 'off')
  })
  const renderer = await h.render(Probe, { ref: api, authenticated: true })
  await act(flush)
  let pending
  await act(async () => { pending = api.current.saveStationSettings({ autoPrintEnabled: true }); await flush() })
  await act(async () => renderer.update(React.createElement(Probe, { ref: api, authenticated: false })))
  stationWrite.resolve(response({ station: { ...station, autoPrintEnabled: true } }))
  await act(async () => { await pending; await flush() })
  assert.equal(api.current.localStation, null)
})

test('estação e impressora local têm bloqueios independentes por recurso', async (t) => {
  const stationSave = deferred()
  const printerSave = deferred()
  let stationWrites = 0
  let printerWrites = 0
  globalThis.fetch = async () => response({ settings: { defaultCopies: 1 } })
  const printing = {
    localStation: { id: 'test-station', name: 'Cozinha', platform: 'windows', autoPrintEnabled: false },
    configuredPrinterName: 'Fila A',
    saveStationSettings: () => { stationWrites += 1; return stationSave.promise },
    selectPrinter: () => { printerWrites += 1; return printerSave.promise },
  }
  const { api } = await mountController(t, { printing })
  let stationPending
  let printerPending
  await act(async () => {
    stationPending = api.current.saveStation({ autoPrintEnabled: true })
    printerPending = api.current.selectPrinter('Fila B')
    await flush()
  })
  await act(async () => api.current.saveStation({ autoPrintEnabled: false }))
  assert.equal(stationWrites, 1)
  assert.equal(printerWrites, 1)
  stationSave.resolve({ ...printing.localStation, autoPrintEnabled: true })
  printerSave.resolve('Fila B')
  await act(async () => { await Promise.all([stationPending, printerPending]); await flush() })
  assert.equal(api.current.resources['station-config'].confirmedValue.autoPrintEnabled, true)
  assert.equal(api.current.resources['local-printer'].confirmedValue, 'Fila B')
})

test('falha de reconsulta da estação mantém bloqueio e reconsulta manual não repete a escrita', async (t) => {
  let writes = 0
  let reads = 0
  const originalStation = { id: 'test-station', name: 'Cozinha', platform: 'windows', autoPrintEnabled: false }
  const confirmedStation = { ...originalStation, autoPrintEnabled: true }
  globalThis.fetch = async () => response({ settings: { defaultCopies: 1 } })
  const printing = {
    localStation: originalStation,
    saveStationSettings: async () => { writes += 1; throw new TypeError('network') },
    refresh: async () => {
      reads += 1
      if (reads === 1) throw new TypeError('offline')
      return { stations: [confirmedStation] }
    },
  }
  const { api } = await mountController(t, { printing })

  await act(async () => api.current.saveStation({ autoPrintEnabled: true }))
  assert.equal(api.current.resources['station-config'].status, 'unconfirmed')
  await act(async () => api.current.saveStation({ autoPrintEnabled: false }))
  assert.equal(writes, 1)

  await act(async () => api.current.reload('station-config'))
  assert.equal(writes, 1)
  assert.equal(reads, 2)
  assert.equal(api.current.resources['station-config'].status, 'idle')
  assert.deepEqual(api.current.resources['station-config'].confirmedValue, confirmedStation)
})

test('retorno stale da seleção reconcilia somente a impressora local oficial e não publica sucesso falso', async (t) => {
  let writes = 0
  let reads = 0
  const feedback = []
  globalThis.fetch = async () => response({ settings: { defaultCopies: 1 } })
  const printing = {
    localStation: { id: 'test-station', name: 'Cozinha', platform: 'windows' },
    configuredPrinterName: 'Fila A',
    selectPrinter: async () => { writes += 1; return null },
    refreshPrinters: async () => { reads += 1 },
    readConfiguredPrinter: () => 'Fila A',
  }
  const { api } = await mountController(t, { printing, onFeedback: (value) => feedback.push(value) })

  let saved
  await act(async () => { saved = await api.current.selectPrinter('Fila B') })

  assert.equal(saved, false)
  assert.equal(writes, 1)
  assert.equal(reads, 1)
  assert.equal(api.current.resources['local-printer'].confirmedValue, 'Fila A')
  assert.equal(feedback.some((value) => /Fila B configurada/.test(String(value))), false)
})

test('teste físico ou job pendente não bloqueia navegação', async (t) => {
  const h = await workspaceHarness(t)
  const { useNavigationController } = await h.load('/src/app/useNavigationController.js')
  const api = React.createRef()
  const Probe = React.forwardRef(function Probe(_props, ref) {
    const navigation = useNavigationController({
      granted: new Set(['orders.view', 'clients.view']),
      implemented: new Set(['orders', 'clients']),
      checkoutPending: false,
      dirtyOrder: false,
      onDiscardOrder() {},
      onFeedback() {},
    })
    React.useImperativeHandle(ref, () => navigation, [navigation])
    return React.createElement('output', null, `${navigation.activeTab}:job-pending`)
  })
  const renderer = await h.render(Probe, { ref: api })
  await act(async () => api.current.requestNavigation('clients'))
  assert.equal(nodeText(renderer.root.findByType('output')), 'clients:job-pending')
})

test('tema e som continuam locais e sincronizados com as origens atuais', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  const { ThemeProvider } = await h.load('/src/components/ThemeProvider.jsx')
  const { default: App } = await h.load('/src/App.jsx')
  globalThis.fetch = async (path) => {
    const url = String(path)
    if (url === '/api/auth/session') return response({ authenticated: true })
    if (url === '/api/bootstrap') return response({ tables: [], tableTabs: [], orders: [], clients: [], products: [], movements: [], financeSettings: null })
    if (url === '/api/printing/stations') return response({ stations: [{ id: 'test-station', platform: 'other', autoPrintEnabled: false }] })
    if (url.startsWith('/api/printing/jobs?')) return response({ jobs: [] })
    if (url === '/api/printing/jobs/summary') return response({ summary: { safeBacklog: 0 } })
    if (url === '/api/printing/settings') return response({ settings: { defaultCopies: 1 } })
    throw new Error(`Unexpected request: ${url}`)
  }
  const Root = () => React.createElement(ThemeProvider, null, React.createElement(App))
  const renderer = await h.render(Root)
  await act(async () => h.window.dispatchEvent(Object.assign(new Event('app:navigate'), { detail: 'settings-device' })))
  const dark = buttonNamed(renderer.root, 'Escuro')
  await act(async () => dark.props.onClick())
  assert.equal(h.window.localStorage.getItem('delivery-theme'), 'dark')
  const sound = renderer.root.findAllByType('input').find((node) => node.props.type === 'checkbox')
  await act(async () => sound.props.onChange({ target: { checked: false } }))
  assert.equal(h.window.localStorage.getItem('kitchen-sound-enabled'), 'false')
  await act(async () => h.window.dispatchEvent(Object.assign(new Event('app:navigate'), { detail: 'orders' })))
  assert.equal(buttonNamed(renderer.root, 'Som desligado').props['aria-pressed'], false)
})
