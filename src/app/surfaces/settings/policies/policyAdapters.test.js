import assert from 'node:assert/strict'
import test from 'node:test'
import { cancellationReasonsPolicy, operationsPolicy } from '../../../../domains/orders/index.js'
import { createSettingsPolicyAdapters, getSettingsPolicy } from './registry.js'

const resource = (name, revision = 1, data = {}) => ({ resource: name, revision, data, meta: {} })
const jsonResponse = (payload, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => payload })

test('settings policy adapters preserve typed resource paths, methods, envelopes and station normalization', { concurrency: false }, async (t) => {
  const calls = []
  const operations = resource('operations', 2, { timing: {} })
  const paymentMethods = resource('paymentMethods', 3, { methods: [] })
  const cancellationReasons = resource('cancellationReasons', 4, { items: [] })
  const financeCategories = resource('financeCategories', 5, { items: [] })
  const printing = resource('printingPolicy', 6, { orderDefaultCopies: 2, tableTabDefaultCopies: 1 })
  const station = { id: 'station 1', name: 'Cozinha', platform: 'windows', autoPrintEnabled: true, configRevision: 7, createdAt: 'a', updatedAt: 'b' }
  const primary = resource('stationPrimary', 8, { primaryStationId: 'station 1' })
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (path, options = {}) => {
    calls.push([String(path), options.method || 'GET', options.body ? JSON.parse(options.body) : null])
    if (path === '/api/settings/operations') return jsonResponse(options.method === 'PUT' ? { resource: operations, receipt: { mutationId: 'm-operations' } } : operations)
    if (path === '/api/settings/payment-methods') return jsonResponse(options.method === 'PUT' ? { resource: paymentMethods, receipt: { mutationId: 'm-payment' } } : paymentMethods)
    if (path === '/api/settings/cancellation-reasons') return jsonResponse(options.method === 'PUT' ? { resource: cancellationReasons, receipt: { mutationId: 'm-cancellation' } } : cancellationReasons)
    if (path === '/api/settings/finance-categories') return jsonResponse(options.method === 'PUT' ? { resource: financeCategories, receipt: { mutationId: 'm-finance' } } : financeCategories)
    if (path === '/api/printing/settings') return jsonResponse(options.method === 'PUT' ? { settings: printing, receipt: { mutationId: 'm-printing' } } : { settings: printing })
    if (path === '/api/printing/stations') return jsonResponse({ stations: [station], primary })
    if (String(path).startsWith('/api/printing/stations/station%201')) return jsonResponse({ station: options.method === 'POST' ? primary : resource('stationConfiguration', 7), receipt: { mutationId: 'm-station' } })
    if (String(path).startsWith('/api/settings/receipts/')) return jsonResponse({ status: 'confirmed', receipt: { mutationId: 'mutation / 1' } })
    throw new Error(`Unexpected request: ${path}`)
  }

  const adapters = createSettingsPolicyAdapters()
  assert.deepEqual(Object.keys(adapters).sort(), ['cancellationReasons', 'financeCategories', 'operations', 'paymentMethods', 'printingPolicy', 'stationConfiguration', 'stationPrimary'])
  assert.equal(getSettingsPolicy('operations').id, 'operations')
  assert.equal(await adapters.operations.load(), operations)
  assert.equal(await adapters.paymentMethods.load(), paymentMethods)
  assert.equal(await adapters.cancellationReasons.load(), cancellationReasons)
  assert.equal(await adapters.financeCategories.load(), financeCategories)
  assert.equal(await adapters.printingPolicy.load(), printing)
  assert.deepEqual(await adapters.stationConfiguration.load('station 1'), {
    resource: 'stationConfiguration', scopeId: 'station 1', revision: 7,
    data: { name: 'Cozinha', platform: 'windows', autoPrintEnabled: true },
    meta: { createdAt: 'a', updatedAt: 'b' },
  })
  assert.equal(await adapters.stationPrimary.load(), primary)
  await adapters.operations.save({ expectedRevision: 2, mutationId: 'm-operations', data: operations.data })
  await adapters.paymentMethods.save({ expectedRevision: 3, mutationId: 'm-payment', data: paymentMethods.data })
  await adapters.cancellationReasons.save({ expectedRevision: 4, mutationId: 'm-cancellation', data: cancellationReasons.data })
  await adapters.financeCategories.save({ expectedRevision: 5, mutationId: 'm-finance', data: financeCategories.data })
  assert.deepEqual(await adapters.printingPolicy.save({ expectedRevision: 6, mutationId: 'm-printing', data: printing.data }), { resource: printing, receipt: { mutationId: 'm-printing' } })
  await adapters.stationConfiguration.save({ expectedRevision: 7, mutationId: 'm-station', data: station }, 'station 1')
  await adapters.stationPrimary.save({ expectedRevision: 8, mutationId: 'm-primary', data: { primaryStationId: 'station 1' } })
  assert.deepEqual(await adapters.stationConfiguration.loadReceipt('mutation / 1', 'station 1'), { status: 'confirmed', receipt: { mutationId: 'mutation / 1' } })
  assert.deepEqual(calls.find(([path]) => path === '/api/printing/stations/station%201'), [
    '/api/printing/stations/station%201', 'PUT', { expectedRevision: 7, mutationId: 'm-station', data: station },
  ])
  assert.deepEqual(calls.find(([path]) => path === '/api/printing/stations/station%201/make-primary'), [
    '/api/printing/stations/station%201/make-primary', 'POST', { expectedRevision: 8, mutationId: 'm-primary', data: { primaryStationId: 'station 1' } },
  ])
  assert.deepEqual(calls.map(([path, method]) => [path, method]), [
    ['/api/settings/operations', 'GET'], ['/api/settings/payment-methods', 'GET'], ['/api/settings/cancellation-reasons', 'GET'], ['/api/settings/finance-categories', 'GET'], ['/api/printing/settings', 'GET'], ['/api/printing/stations', 'GET'], ['/api/printing/stations', 'GET'],
    ['/api/settings/operations', 'PUT'], ['/api/settings/payment-methods', 'PUT'], ['/api/settings/cancellation-reasons', 'PUT'], ['/api/settings/finance-categories', 'PUT'], ['/api/printing/settings', 'PUT'], ['/api/printing/stations/station%201', 'PUT'], ['/api/printing/stations/station%201/make-primary', 'POST'], ['/api/settings/receipts/mutation%20%2F%201?resource=stationConfiguration&scopeId=station+1', 'GET'],
  ])
})

test('station policy adapters declare backend view and manage capabilities', () => {
  const adapters = createSettingsPolicyAdapters()
  for (const id of ['stationConfiguration', 'stationPrimary']) {
    assert.deepEqual(adapters[id].capabilities, ['printing.station.view', 'printing.station.configure'])
  }
})

test('settings policy adapters reject invalid scopes and primary stations before transport', async () => {
  const adapters = createSettingsPolicyAdapters()
  await assert.rejects(() => adapters.stationConfiguration.load(), { code: 'SETTINGS_SCOPE_REQUIRED' })
  await assert.rejects(() => adapters.operations.load('station-1'), { code: 'SETTINGS_SCOPE_INVALID' })
  await assert.rejects(
    () => adapters.stationPrimary.save({ data: { primaryStationId: ' ' } }),
    { code: 'SETTINGS_SCOPE_REQUIRED', message: 'Informe a esta\u00e7\u00e3o principal.' },
  )
  assert.equal(getSettingsPolicy('madeUp'), null)
})


test('operations and cancellation policies come from Orders', () => {
  assert.equal(getSettingsPolicy('operations'), operationsPolicy)
  assert.equal(getSettingsPolicy('cancellationReasons'), cancellationReasonsPolicy)
  assert.deepEqual(operationsPolicy.destinations, ['settings-operations', 'settings-modalities'])
  assert.equal(operationsPolicy.capability, 'operations.settings.view')
  assert.equal(cancellationReasonsPolicy.capability, 'orders.settings.view')
})
