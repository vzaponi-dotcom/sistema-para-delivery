import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
const settings = await readFile(new URL('./PrintingSettingsContent.jsx', import.meta.url), 'utf8')
const orders = await readFile(new URL('../pages/Orders.jsx', import.meta.url), 'utf8')
const manager = await readFile(new URL('../printing/usePrintingManager.js', import.meta.url), 'utf8')
const css = await readFile(new URL('../printing/printing.css', import.meta.url), 'utf8')

// Execute the real JSX and handlers with a small hook scheduler; browser-only
// modal/transport dependencies stay outside this business-settings test boundary.
const compiled = await transformWithOxc(settings.replace(/^import .*\r?\n/gm, '').replace('export default PrintingSettingsContent', 'return PrintingSettingsContent'), 'PrintingSettingsContent.jsx', {
  jsx: { runtime: 'classic', pragma: 'element', pragmaFrag: 'Fragment' },
})
const makeSettings = new Function('useState', 'useEffect', 'element', 'Fragment', 'Button', 'ConfirmationDialog', 'SystemSelect', compiled.code)
const mountSettings = (printing, controller = {}) => {
  const resources = controller.resources || {
    'business-copies': { status: 'idle', confirmedValue: 1, error: '' },
    'station-config': { status: 'idle', confirmedValue: printing?.localStation ?? null, error: '' },
    'local-printer': { status: 'idle', confirmedValue: printing?.configuredPrinterName ?? null, error: '' },
  }
  const settingsController = {
    resources,
    reload: async () => true,
    saveCopies: async () => true,
    saveStation: async () => true,
    makePrimary: async () => true,
    selectPrinter: async () => true,
    ...controller,
  }
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
  const Component = makeSettings(useState, useEffect, element, 'Fragment', 'Button', 'ConfirmationDialog', 'SystemSelect')
  const view = {
    tree: null,
    render(nextPrinting = printing) {
      printing = nextPrinting
      cursor = 0
      view.tree = Component({ printing, settings: settingsController, granted: new Set(['printing.settings', 'printing.station.configure']) })
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
const renderedText = (node) => {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node || typeof node !== 'object') return ''
  return (node.children || []).map(renderedText).join('')
}
const visibleText = (view) => renderedText(view.tree)
const testPrintButton = (view) => view.nodes((node) => node.type === 'Button' && JSON.stringify(node.children).includes('Testar impressão'))[0]

test('shared content delegates business and station saves to the session controller', async () => {
  const copiesWrites = []
  const stationWrites = []
  const printing = {
    transportKind: 'qz',
    localStation: { id: 's1', name: 'PC', platform: 'windows', defaultCopies: 2, autoPrintEnabled: false },
  }
  const view = mountSettings(printing, {
    saveCopies: async (value) => { copiesWrites.push(value); return true },
    saveStation: async (value) => { stationWrites.push(value); return true },
  })
  try {
    assert.equal(radio(view, 1).props.checked, true)
    assert.equal(copiesField(view).props.disabled, false)
    await radio(view, 2).props.onChange({ target: { value: '2' } })
    assert.deepEqual(copiesWrites, [2])
    await view.nodes((node) => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } })
    assert.equal(stationWrites[0].autoPrintEnabled, true)
    assert.equal(Object.hasOwn(stationWrites[0], 'defaultCopies'), false)
    assert.match(viewText(view), /negócio/)
    assert.match(viewText(view), /Entrega.*Retirada/)
    assert.match(viewText(view), /[Mm]esa.*consumo local.*1 via/)
  } finally { view.unmount() }
})

test('an authenticated device without a printer station can edit confirmed central copies', async () => {
  const view = mountSettings({ localStation: null, supported: false }, {
    resources: {
      'business-copies': { status: 'idle', confirmedValue: 2, error: '' },
      'station-config': { status: 'idle', confirmedValue: null, error: '' },
      'local-printer': { status: 'idle', confirmedValue: null, error: '' },
    },
  })
  try {
    assert.equal(copiesField(view).props.disabled, false)
    assert.equal(radio(view, 2).props.checked, true)
  } finally { view.unmount() }
})

test('a conclusive controller error keeps the confirmed business value visible and editable', () => {
  const view = mountSettings({ localStation: { id: 's1', defaultCopies: 2 } }, {
    resources: {
      'business-copies': { status: 'error', confirmedValue: 1, error: 'Falha ao salvar vias' },
      'station-config': { status: 'idle', confirmedValue: { id: 's1' }, error: '' },
      'local-printer': { status: 'idle', confirmedValue: null, error: '' },
    },
  })
  try {
    assert.equal(radio(view, 1).props.checked, true)
    assert.equal(copiesField(view).props.disabled, false)
    assert.match(viewText(view), /Falha ao salvar vias/)
  } finally { view.unmount() }
})

test('an unconfirmed result remains blocked and offers an explicit requery', async () => {
  const reloads = []
  const view = mountSettings({ localStation: { id: 's1', defaultCopies: 2 } }, {
    resources: {
      'business-copies': { status: 'unconfirmed', confirmedValue: 1, error: 'Sem conexão com o servidor' },
      'station-config': { status: 'idle', confirmedValue: { id: 's1' }, error: '' },
      'local-printer': { status: 'idle', confirmedValue: null, error: '' },
    },
    reload: async (resource) => { reloads.push(resource); return true },
  })
  try {
    assert.equal(copiesField(view).props.disabled, true)
    assert.match(viewText(view), /Sem conexão com o servidor/)
    const retry = view.nodes((node) => node.type === 'Button' && JSON.stringify(node.children).includes('Reconsultar'))[0]
    assert.ok(retry)
    await retry.props.onClick()
    assert.deepEqual(reloads, ['business-copies'])
  } finally { view.unmount() }
})

test('uncertain station and printer errors expose resource-specific read-only requery actions', async () => {
  const reloads = []
  const view = mountSettings({
    transportKind: 'qz',
    supported: true,
    localStation: { id: 's1', name: 'PC', platform: 'windows', autoPrintEnabled: false },
    configuredPrinterName: 'Fila A',
  }, {
    resources: {
      'business-copies': { status: 'idle', confirmedValue: 1, error: '' },
      'station-config': { status: 'unconfirmed', confirmedValue: { id: 's1', name: 'PC', platform: 'windows' }, error: 'Estação não confirmada' },
      'local-printer': { status: 'unconfirmed', confirmedValue: 'Fila A', error: 'Impressora não confirmada' },
    },
    reload: async (resource) => { reloads.push(resource); return true },
  })
  try {
    const retries = view.nodes((node) => node.type === 'Button' && renderedText(node) === 'Reconsultar')
    assert.equal(retries.length, 2)
    await retries[0].props.onClick()
    await retries[1].props.onClick()
    assert.deepEqual(reloads, ['station-config', 'local-printer'])
  } finally { view.unmount() }
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

test('QZ copy keeps queue diagnostics distinct from physical readiness', () => {
  assert.match(settings, /QZ Tray conectado/)
  assert.match(settings, /QZ Tray desconectado/)
  assert.match(settings, /Fila encontrada/)
  assert.match(settings, /Fila configurada/)
  assert.match(settings, /Pronta para imprimir/)
  assert.doesNotMatch(settings, /Pronta para enviar/)
  assert.doesNotMatch(settings, /Impressora disponÃ­vel/)
})

test('shared physical health is the primary operational state and gates the physical test control', () => {
  const printing = {
    transportKind: 'qz',
    supported: true,
    localStation: { id: 'kitchen', name: 'Cozinha', platform: 'windows', isPrimary: true, autoPrintEnabled: true },
    qzConnected: true,
    configuredPrinterName: 'MPT-II',
    printerQueueFound: true,
    transportReady: true,
    jobs: [{ id: 'p1', status: 'pending' }, { id: 'p2', status: 'pending' }, { id: 'p3', status: 'pending' }, { id: 'p4', status: 'pending' }, { id: 'wait', status: 'awaiting_confirmation' }],
    printerHealth: { state: 'printer_offline', statusText: 'Offline', statusCode: 7 },
  }
  const view = mountSettings(printing)
  try {
    assert.match(visibleText(view), /Impressora desligada ou desconectada/)
    assert.match(visibleText(view), /Há 4 trabalhos aguardando impressão/)
    assert.match(visibleText(view), /1 via enviada à impressora aguardando confirmação/)
    assert.equal(testPrintButton(view).props.disabled, true)

    view.render({ ...printing, printerHealth: { state: 'ready', statusText: 'OK', statusCode: 0 } })
    assert.match(visibleText(view), /Pronta para imprimir/)
    assert.equal(testPrintButton(view).props.disabled, false)
  } finally { view.unmount() }
})

test('physical health labels fail closed while QZ and queue diagnostics remain secondary', () => {
  const base = {
    transportKind: 'qz', localStation: { id: 'kitchen', platform: 'windows' },
    qzConnected: true, printerQueueFound: true, configuredPrinterName: 'MPT-II', transportReady: true,
  }
  const view = mountSettings(base)
  try {
    for (const [state, label] of [
      ['verifying', 'Verificando impressora…'],
      ['printer_attention', 'Atenção necessária na impressora'],
      ['ready', 'Pronta para imprimir'],
    ]) {
      view.render({ ...base, printerHealth: { state } })
      assert.match(viewText(view), new RegExp(label))
    }
    view.render({ ...base, printerHealth: { state: 'ready' }, qzConnected: false })
    assert.match(viewText(view), /QZ Tray indisponível/)
    view.render({ ...base, printerHealth: { state: 'ready' }, printerQueueFound: false })
    assert.match(viewText(view), /Impressora não encontrada/)
    view.render({ ...base, printerHealth: { state: 'ready' }, configuredPrinterName: '' })
    assert.match(viewText(view), /Impressora não configurada/)
  } finally { view.unmount() }
})

test('Android is queue-only and does not expose a physical printer control', () => {
  assert.doesNotMatch(settings, /isRawBt|transportKind === 'rawbt'|RawBT/)
  assert.match(settings, /fila central.*impressão física/i)
})

test('queue-only settings hide physical controls and use a semantic queue status while retaining central copies', () => {
  assert.doesNotMatch(settings, /Navegador incompatível/)
  assert.match(settings, /Fila central/)
  assert.match(settings, /Somente solicitações|somente solicitações/i)
  assert.match(settings, /\{isQz && canConfigureStation && \([\s\S]*Testar impressão[\s\S]*\)\}/)
  assert.match(settings, /\{isQz && canConfigureStation && \([\s\S]*Imprimir novos pedidos automaticamente[\s\S]*\)\}/)
  assert.match(settings, /\{isQz && canConfigureStation && !station\?\.isPrimary && \([\s\S]*Tornar estação principal[\s\S]*\)\}/)
  assert.match(settings, /printing-copy-options/)
})

test('QZ printer discovery adapts queue names to SystemSelect option objects', () => {
  assert.match(settings, /qzPrinterOptions\s*=\s*qzPrinters\.map\(\(printerName\)\s*=>\s*\(\{\s*value:\s*printerName,\s*label:\s*printerName,?\s*\}\)\)/s)
  assert.match(settings, /options=\{qzPrinterOptions\}/)
})

test('settings actions use the session controller and persist only one or two copies', () => {
  assert.match(settings, /testPrint/)
  assert.match(settings, /settings\.saveStation/)
  assert.match(settings, /settings\.makePrimary/)
  assert.match(settings, /settings\.selectPrinter/)
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
  assert.match(css, /\.printing-health-card[\s\S]*background:\s*var\(--surface-soft\)/)
  assert.match(css, /\.printing-health-card[\s\S]*\.printing-state/)
})
