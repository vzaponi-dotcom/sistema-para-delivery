import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { getPrintSettings, savePrintSettings } from '../api/client.js'

const settings = await readFile(new URL('./PrintingSettings.jsx', import.meta.url), 'utf8')
const orders = await readFile(new URL('../pages/Orders.jsx', import.meta.url), 'utf8')
const manager = await readFile(new URL('../printing/usePrintingManager.js', import.meta.url), 'utf8')
const css = await readFile(new URL('../printing/printing.css', import.meta.url), 'utf8')

// Execute the real JSX and handlers with a small hook scheduler; browser-only
// modal/transport dependencies stay outside this business-settings test boundary.
const compiled = await transformWithOxc(settings.replace(/^import .*\r?\n/gm, '').replace('export default PrintingSettings', 'return PrintingSettings'), 'PrintingSettings.jsx', {
  jsx: { runtime: 'classic', pragma: 'element', pragmaFrag: 'Fragment' },
})
const makeSettings = new Function('useState', 'useEffect', 'element', 'Fragment', 'Button', 'ConfirmationDialog', 'Modal', 'SystemSelect', 'getPrintSettings', 'savePrintSettings', compiled.code)
const mountSettings = (printing) => {
  const state = [], effects = []
  let cursor = 0
  let queuedEffects = []
  const useState = (initial) => {
    const index = cursor++
    if (!(index in state)) state[index] = initial
    return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next }]
  }
  const useEffect = (action, dependencies) => {
    const index = cursor++
    if (!effects[index] || dependencies.some((value, at) => !Object.is(value, effects[index].dependencies[at]))) {
      queuedEffects.push(() => {
        effects[index]?.cleanup?.()
        effects[index] = { dependencies, cleanup: action() }
      })
    }
  }
  const element = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) })
  const Component = makeSettings(useState, useEffect, element, 'Fragment', 'Button', 'ConfirmationDialog', 'Modal', 'SystemSelect', getPrintSettings, savePrintSettings)
  const view = {
    tree: null,
    render(nextPrinting = printing) {
      printing = nextPrinting
      cursor = 0
      view.tree = Component({ printing, onClose() {} })
      const pending = queuedEffects
      queuedEffects = []
      pending.forEach((effect) => effect())
      return view
    },
    async settle() {
      await new Promise((resolve) => setImmediate(resolve))
      view.render()
      await new Promise((resolve) => setImmediate(resolve))
      return view.render()
    },
    nodes(predicate) {
      const found = []
      const visit = (node) => {
        if (!node || typeof node !== 'object') return
        if (predicate(node)) found.push(node)
        node.children.forEach(visit)
      }
      visit(view.tree)
      return found
    },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()) },
  }
  return view.render()
}
const copiesField = (view) => view.nodes((node) => node.type === 'fieldset')[0]
const radio = (view, copies) => view.nodes((node) => node.type === 'input' && node.props.value === copies)[0]
const viewText = (view) => JSON.stringify(view.tree)

test('copies load from the business and save centrally while local station changes preserve the central value', async () => {
  const originalFetch = globalThis.fetch
  const calls = [], stationWrites = []
  let persistedCopies = 1
  globalThis.fetch = async (path, options) => {
    calls.push([path, options])
    if (options.method === 'PUT') persistedCopies = JSON.parse(options.body).defaultCopies
    return Response.json({ settings: { defaultCopies: persistedCopies } })
  }
  const printing = {
    transportKind: 'qz',
    localStation: { id: 's1', name: 'PC', platform: 'windows', defaultCopies: 2, autoPrintEnabled: false },
    saveStationSettings: async (value) => { stationWrites.push(value) },
  }
  const view = mountSettings(printing)
  try {
    await view.settle()
    assert.equal(radio(view, 1).props.checked, true)
    assert.equal(copiesField(view).props.disabled, false)
    view.render({ ...printing, localStation: { ...printing.localStation, defaultCopies: 1 } })
    await view.settle()
    await radio(view, 2).props.onChange({ target: { value: '2' } })
    await view.settle()
    assert.equal(persistedCopies, 2)
    assert.equal(radio(view, 2).props.checked, true)
    assert.equal(stationWrites.length, 0)
    assert.deepEqual(calls.map(([path, options]) => [path, options.method || 'GET']), [
      ['/api/printing/settings', 'GET'], ['/api/printing/settings', 'PUT'],
    ])
    await view.nodes((node) => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } })
    await view.settle()
    assert.equal(stationWrites[0].autoPrintEnabled, true)
    assert.equal(Object.hasOwn(stationWrites[0], 'defaultCopies'), false)
    assert.equal(radio(view, 2).props.checked, true)
    assert.match(viewText(view), /negócio/)
    assert.match(viewText(view), /Entrega.*Retirada/)
    assert.match(viewText(view), /[Mm]esa.*consumo local.*1 via/)
  } finally { view.unmount(); globalThis.fetch = originalFetch }
})

test('an authenticated device without a printer station can edit central copies after loading', async () => {
  const originalFetch = globalThis.fetch
  let finishLoading
  globalThis.fetch = async (_path, options) => options.method === 'PUT'
    ? Response.json({ settings: { defaultCopies: 1 } })
    : new Promise((resolve) => { finishLoading = resolve })
  const view = mountSettings({ localStation: null, supported: false })
  try {
    assert.equal(copiesField(view).props.disabled, true)
    assert.equal(radio(view, 2).props.checked, false)
    finishLoading(Response.json({ settings: { defaultCopies: 2 } }))
    await view.settle()
    assert.equal(copiesField(view).props.disabled, false)
    await radio(view, 1).props.onChange({ target: { value: '1' } })
    await view.settle()
    assert.equal(radio(view, 1).props.checked, true)
  } finally { view.unmount(); globalThis.fetch = originalFetch }
})

test('failed central saves restore the confirmed business value and report the server error', async () => {
  const originalFetch = globalThis.fetch
  let rejectSave
  globalThis.fetch = async (_path, options) => options.method === 'PUT'
    ? new Promise((resolve) => { rejectSave = () => resolve(Response.json({ error: { message: 'Falha ao salvar vias' } }, { status: 503 })) })
    : Response.json({ settings: { defaultCopies: 1 } })
  const view = mountSettings({ localStation: { id: 's1', defaultCopies: 2 } })
  try {
    await view.settle()
    const saving = radio(view, 2).props.onChange({ target: { value: '2' } })
    view.render()
    assert.equal(copiesField(view).props.disabled, true)
    rejectSave()
    await saving
    await view.settle()
    assert.equal(radio(view, 1).props.checked, true)
    assert.equal(copiesField(view).props.disabled, false)
    assert.match(viewText(view), /Falha ao salvar vias/)
  } finally { view.unmount(); globalThis.fetch = originalFetch }
})

test('failed central loading leaves copies unavailable and offers a working retry', async () => {
  const originalFetch = globalThis.fetch
  let attempts = 0
  globalThis.fetch = async () => ++attempts === 1
    ? Response.json({ error: { message: 'Sem conexão com o servidor' } }, { status: 503 })
    : Response.json({ settings: { defaultCopies: 1 } })
  const view = mountSettings({ localStation: { id: 's1', defaultCopies: 2 } })
  try {
    await view.settle()
    assert.equal(copiesField(view).props.disabled, true)
    assert.match(viewText(view), /Sem conexão com o servidor/)
    const retry = view.nodes((node) => node.type === 'Button' && JSON.stringify(node.children).includes('Tentar novamente'))[0]
    assert.ok(retry)
    await retry.props.onClick()
    await view.settle()
    assert.equal(copiesField(view).props.disabled, false)
    assert.equal(radio(view, 1).props.checked, true)
  } finally { view.unmount(); globalThis.fetch = originalFetch }
})

test('Orders header keeps only the focused kitchen actions', () => {
  assert.doesNotMatch(orders, />Configurações</)
  assert.match(orders, />Impressão</)
  assert.match(orders, /onNavigateHistory/)
  assert.match(orders, />Novo pedido</)
})

test('printing settings expose honest connection, station and transport states', () => {
  for (const label of ['QZ Tray conectado', 'QZ Tray desconectado', 'Impressora QZ não configurada']) {
    assert.match(settings, new RegExp(label))
  }
  for (const label of ['Estação', 'Plataforma', 'Driver', 'Estação principal', 'Impressão automática', 'Cópias por pedido']) {
    assert.match(settings, new RegExp(label))
  }
  assert.match(settings, /Windows/)
  assert.doesNotMatch(settings, /Web Serial/)
  assert.match(settings, /Android/)
  assert.doesNotMatch(settings, /RawBT/)
  assert.doesNotMatch(settings, /MPT-II/)
})

test('QZ copy separates Tray connection from queue discovery and send readiness', () => {
  assert.match(settings, /QZ Tray conectado/)
  assert.match(settings, /QZ Tray desconectado/)
  assert.match(settings, /Fila encontrada/)
  assert.match(settings, /Fila configurada/)
  assert.match(settings, /Pronta para enviar/)
  assert.doesNotMatch(settings, /Impressora disponÃ­vel/)
})

test('Android is queue-only and does not expose a physical printer control', () => {
  assert.doesNotMatch(settings, /isRawBt|transportKind === 'rawbt'|RawBT/)
  assert.match(settings, /fila central.*impressão física/i)
})

test('queue-only settings hide physical controls and use a semantic queue status while retaining central copies', () => {
  assert.doesNotMatch(settings, /Navegador incompatível/)
  assert.match(settings, /Fila central/)
  assert.match(settings, /Somente solicitações|somente solicitações/i)
  assert.match(settings, /\{isQz && \([\s\S]*Testar impressão[\s\S]*\)\}/)
  assert.match(settings, /\{isQz && \([\s\S]*Imprimir novos pedidos automaticamente[\s\S]*\)\}/)
  assert.match(settings, /\{isQz && \([\s\S]*Tornar estação principal[\s\S]*\)\}/)
  assert.match(settings, /printing-copy-options/)
})

test('QZ printer discovery adapts queue names to SystemSelect option objects', () => {
  assert.match(settings, /qzPrinterOptions\s*=\s*qzPrinters\.map\(\(printerName\)\s*=>\s*\(\{\s*value:\s*printerName,\s*label:\s*printerName,?\s*\}\)\)/s)
  assert.match(settings, /options=\{qzPrinterOptions\}/)
})

test('settings actions use the printing manager and persist only one or two copies', () => {
  assert.match(settings, /connectPrinter/)
  assert.match(settings, /testPrint/)
  assert.match(settings, /saveStationSettings/)
  assert.match(settings, /makePrimary/)
  assert.match(settings, /defaultCopies/)
  assert.match(settings, /value=\{1\}/)
  assert.match(settings, /value=\{2\}/)
  assert.match(settings, /Imprimir novos pedidos automaticamente/)
})

test('making a station primary requires the shared confirmation dialog with exclusivity warning', () => {
  assert.match(settings, /ConfirmationDialog/)
  assert.match(settings, /Tornar estação principal/)
  assert.match(settings, /única estação responsável pela impressão automática/)
  assert.match(settings, /confirmLabel="Tornar principal"/)
})

test('manager distinguishes queue-only and QZ connection states honestly', () => {
  assert.match(manager, /'unsupported'/)
  assert.match(manager, /'unconfigured'/)
  assert.match(manager, /'disconnected'/)
  assert.match(manager, /'connected'/)
  assert.doesNotMatch(manager, /getPrinterFingerprint|navigator\.serial/)
})

test('printing settings expose stable themed hooks without changing control semantics', () => {
  for (const className of [
    'printing-status-card',
    'printing-info-card',
    'printing-actions-row',
    'printing-toggle-row',
    'printing-copy-options',
    'printing-primary-card',
    'printing-compatibility',
  ]) assert.match(settings, new RegExp(className))

  assert.match(settings, /type="checkbox"/)
  assert.match(settings, /type="radio"/)
  assert.match(settings, /value=\{1\}/)
  assert.match(settings, /value=\{2\}/)
})

test('printing settings styling uses semantic tokens and complete interaction states', () => {
  assert.doesNotMatch(css, /var\(--[^,]+,\s*#[0-9a-f]{3,8}\)/i)
  assert.match(css, /\.printing-status-card[\s\S]*background:\s*var\(--surface-soft\)/)
  assert.match(css, /\.printing-info-card[\s\S]*background:\s*var\(--surface\)/)
  assert.match(css, /\.printing-toggle-row input[\s\S]*accent-color:\s*var\(--primary\)/)
  assert.match(css, /\.printing-settings[^}]*color:\s*var\(--text\)/)
  assert.match(css, /\.printing-settings[\s\S]*:focus-visible/)
  assert.match(css, /\.printing-settings[\s\S]*:hover/)
  assert.match(css, /\.printing-settings[\s\S]*:disabled/)
  assert.match(css, /cursor:\s*not-allowed/)
  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.printing-actions-row[\s\S]*width:\s*100%/)
})
