import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getEffectiveConfig,
  getSettings,
  getSettingsReceipt,
  putSettings,
} from './settingsClient.js'

const resource = (name, revision = 1, data = {}) => ({ resource: name, revision, data, meta: {} })
const jsonResponse = (payload, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => payload })

test('settings client maps typed resources to the existing endpoints and normalizes their envelopes', { concurrency: false }, async (t) => {
  const calls = []
  const operations = resource('operations', 2, { timing: {} })
  const printing = resource('printingPolicy', 3, { orderDefaultCopies: 2, tableTabDefaultCopies: 1 })
  const station = { id: 'station 1', name: 'Cozinha', platform: 'windows', autoPrintEnabled: true, configRevision: 4, createdAt: 'a', updatedAt: 'b' }
  const primary = resource('stationPrimary', 5, { primaryStationId: 'station 1' })
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (path, options = {}) => {
    calls.push([String(path), options.method || 'GET', options.body ? JSON.parse(options.body) : null])
    if (path === '/api/settings/operations') return jsonResponse(options.method === 'PUT' ? { resource: operations, receipt: { mutationId: 'm-1' } } : operations)
    if (path === '/api/printing/settings') return jsonResponse(options.method === 'PUT' ? { settings: printing, receipt: { mutationId: 'm-2' } } : { settings: printing })
    if (path === '/api/printing/stations') return jsonResponse({ stations: [station], primary })
    if (String(path).startsWith('/api/printing/stations/station%201')) return jsonResponse({ station: options.method === 'POST' ? primary : resource('stationConfiguration', 4, {}, { scopeId: 'station 1' }), receipt: { mutationId: 'm-3' } })
    if (String(path).startsWith('/api/settings/receipts/')) return jsonResponse({ status: 'confirmed', receipt: { mutationId: 'mutation / 1' } })
    if (String(path).startsWith('/api/settings/effective')) return jsonResponse({ effectiveConfigVersion: 'opaque/version' })
    throw new Error(`Unexpected request: ${path}`)
  }

  assert.equal(await getSettings('operations'), operations)
  assert.equal(await getSettings('printingPolicy'), printing)
  assert.deepEqual(await getSettings('stationConfiguration', 'station 1'), {
    resource: 'stationConfiguration', scopeId: 'station 1', revision: 4,
    data: { name: 'Cozinha', platform: 'windows', autoPrintEnabled: true },
    meta: { createdAt: 'a', updatedAt: 'b' },
  })
  assert.equal(await getSettings('stationPrimary'), primary)
  assert.deepEqual(await putSettings('operations', { expectedRevision: 2, mutationId: 'm-1', data: operations.data }), { resource: operations, receipt: { mutationId: 'm-1' } })
  assert.deepEqual(await putSettings('printingPolicy', { expectedRevision: 3, mutationId: 'm-2', data: printing.data }), { resource: printing, receipt: { mutationId: 'm-2' } })
  await putSettings('stationConfiguration', {
    expectedRevision: 4,
    mutationId: 'm-3',
    data: { name: station.name, platform: station.platform, autoPrintEnabled: station.autoPrintEnabled },
  }, 'station 1')
  await putSettings('stationPrimary', { expectedRevision: 5, mutationId: 'm-4', data: { primaryStationId: 'station 1' } })
  assert.deepEqual(await getSettingsReceipt('stationConfiguration', 'mutation / 1', 'station 1'), { status: 'confirmed', receipt: { mutationId: 'mutation / 1' } })
  assert.deepEqual(await getEffectiveConfig('opaque/version'), { effectiveConfigVersion: 'opaque/version' })

  assert.deepEqual(calls.map(([path, method]) => [path, method]), [
    ['/api/settings/operations', 'GET'],
    ['/api/printing/settings', 'GET'],
    ['/api/printing/stations', 'GET'],
    ['/api/printing/stations', 'GET'],
    ['/api/settings/operations', 'PUT'],
    ['/api/printing/settings', 'PUT'],
    ['/api/printing/stations/station%201', 'PUT'],
    ['/api/printing/stations/station%201/make-primary', 'POST'],
    ['/api/settings/receipts/mutation%20%2F%201?resource=stationConfiguration&scopeId=station+1', 'GET'],
    ['/api/settings/effective?knownVersion=opaque%2Fversion', 'GET'],
  ])
})

test('settings client rejects invalid resource and scope combinations before transport', async () => {
  await assert.rejects(() => getSettings('madeUp'), { code: 'SETTINGS_RESOURCE_INVALID' })
  await assert.rejects(() => getSettings('stationConfiguration'), { code: 'SETTINGS_SCOPE_REQUIRED' })
  await assert.rejects(() => getSettings('operations', 'station-1'), { code: 'SETTINGS_SCOPE_INVALID' })
  await assert.rejects(() => putSettings('stationPrimary', { data: { primaryStationId: 'station-1' } }, 'station-1'), { code: 'SETTINGS_SCOPE_INVALID' })
})
