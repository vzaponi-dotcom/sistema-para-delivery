import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from './test-support/settingsDb.js'
import {
  loadStationConfiguration,
  loadStationPrimary,
  saveStationConfiguration,
  saveStationPrimary,
} from './printSettingsRepository.js'
import { heartbeatPrintStation, upsertPrintStation } from './orderPrintingRepository.js'
import { handlePrintingApi } from './orderPrintingApi.js'
import { resolveSettingsAccess } from './settingsAccess.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-12T16:00:00.000Z')
const setup = (t) => { const fixture = createSettingsDb(); t.after(fixture.close); return fixture }
const configInput = (id, revision = 1, data = { name: 'Cozinha nova', platform: 'windows', autoPrintEnabled: true }) => ({
  expectedRevision: revision, mutationId: id, data,
})
const primaryInput = (id, primaryStationId, revision = 1) => ({ expectedRevision: revision, mutationId: id, data: { primaryStationId } })
const addStation = (sqlite, id, businessId = BUSINESS, overrides = {}) => sqlite.prepare(`INSERT INTO print_stations
  (id, business_id, name, platform, is_primary, auto_print_enabled, default_copies, last_seen_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, businessId, overrides.name ?? id, overrides.platform ?? 'windows',
  Number(overrides.isPrimary ?? false), Number(overrides.autoPrintEnabled ?? false), overrides.defaultCopies ?? 2,
  overrides.lastSeenAt ?? NOW.toISOString(), NOW.toISOString(), NOW.toISOString())

test('heartbeat concurrent with administrative edit neither invalidates revision nor has health restored by the editor', async (t) => {
  const { db, sqlite } = setup(t)
  addStation(sqlite, 'kitchen', BUSINESS, { name: 'Antiga', isPrimary: true, lastSeenAt: new Date(+NOW - 5000).toISOString() })
  sqlite.prepare('UPDATE business_print_topology_settings SET primary_station_id = ? WHERE business_id = ?').run('kitchen', BUSINESS)
  const before = await loadStationConfiguration(db, BUSINESS, 'kitchen')
  const heartbeatAt = new Date(+NOW + 1000)
  await heartbeatPrintStation(db, BUSINESS, 'kitchen', { qzReady: true, printerReady: true, physicalState: 'ready' }, heartbeatAt)
  const saved = await saveStationConfiguration(db, BUSINESS, 'kitchen', configInput('station-1', before.revision), new Date(+NOW + 2000))
  const row = sqlite.prepare("SELECT config_revision, last_seen_at, qz_ready, printer_ready, default_copies FROM print_stations WHERE id = 'kitchen'").get()
  assert.equal(saved.resource.revision, 2)
  assert.deepEqual(saved.resource.data, { name: 'Cozinha nova', platform: 'windows', autoPrintEnabled: true })
  assert.deepEqual({ ...row }, { config_revision: 2, last_seen_at: heartbeatAt.toISOString(), qz_ready: 1, printer_ready: 1, default_copies: 2 })
})

test('station configuration no-op, replay, mutation reuse and station/business isolation use scoped receipts', async (t) => {
  const { db, sqlite } = setup(t)
  addStation(sqlite, 'a')
  addStation(sqlite, 'b')
  sqlite.exec("INSERT INTO businesses VALUES ('other-business', 'other-business', 'Other', '2026-09-12', '2026-09-12')")
  const original = (await loadStationConfiguration(db, BUSINESS, 'a')).data
  const noOp = await saveStationConfiguration(db, BUSINESS, 'a', configInput('same-id', 1, original), NOW)
  assert.equal(noOp.resource.revision, 1)
  assert.equal((await saveStationConfiguration(db, BUSINESS, 'a', configInput('same-id', 1, original), NOW)).receipt.replayed, true)
  await saveStationConfiguration(db, BUSINESS, 'b', configInput('same-id', 1), NOW)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM settings_mutation_receipts WHERE mutation_id = 'same-id'").get().n, 2)
  await assert.rejects(saveStationConfiguration(db, BUSINESS, 'a', configInput('same-id', 1, { ...original, name: 'Outra' }), NOW),
    { status: 409, code: 'SETTINGS_MUTATION_REUSED' })
  await assert.rejects(loadStationConfiguration(db, 'other-business', 'a'), { status: 404, code: 'PRINT_STATION_NOT_FOUND' })
})

test('two primary elections at one topology revision have one winner and keep pointer and flags consistent', async (t) => {
  const { db, sqlite } = setup(t)
  addStation(sqlite, 'a')
  addStation(sqlite, 'b')
  const results = await Promise.allSettled([
    saveStationPrimary(db, BUSINESS, primaryInput('elect-a', 'a'), NOW),
    saveStationPrimary(db, BUSINESS, primaryInput('elect-b', 'b'), NOW),
  ])
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
  assert.equal(results.find(({ status }) => status === 'rejected').reason.code, 'SETTINGS_REVISION_CONFLICT')
  const current = await loadStationPrimary(db, BUSINESS)
  assert.equal(current.revision, 2)
  assert.equal(sqlite.prepare('SELECT primary_station_id FROM business_print_topology_settings WHERE business_id = ?').get(BUSINESS).primary_station_id,
    current.data.primaryStationId)
  assert.deepEqual(sqlite.prepare('SELECT id FROM print_stations WHERE business_id = ? AND is_primary = 1').all(BUSINESS).map(({ id }) => id),
    [current.data.primaryStationId])
})

test('topology failure rolls back old/new flags, topology and receipt', async (t) => {
  const { db, sqlite } = setup(t)
  addStation(sqlite, 'a', BUSINESS, { isPrimary: true })
  addStation(sqlite, 'b')
  sqlite.exec(`UPDATE business_print_topology_settings SET primary_station_id = 'a' WHERE business_id = '${BUSINESS}';
    CREATE TRIGGER fail_topology BEFORE UPDATE ON business_print_topology_settings BEGIN SELECT RAISE(ABORT, 'injected topology failure'); END;`)
  await assert.rejects(saveStationPrimary(db, BUSINESS, primaryInput('elect-b', 'b'), NOW), { status: 503, code: 'SETTINGS_UNAVAILABLE' })
  assert.equal(sqlite.prepare('SELECT primary_station_id, revision FROM business_print_topology_settings WHERE business_id = ?').get(BUSINESS).primary_station_id, 'a')
  assert.deepEqual(sqlite.prepare('SELECT id FROM print_stations WHERE business_id = ? AND is_primary = 1').all(BUSINESS).map(({ id }) => id), ['a'])
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM settings_mutation_receipts WHERE resource_key = 'stationPrimary'").get().n, 0)
})

test('repeated bootstrap registration returns the stored station without overwriting administrative configuration', async (t) => {
  const { db, sqlite } = setup(t)
  await upsertPrintStation(db, BUSINESS, { id: 'kitchen', name: 'Inicial', platform: 'windows', autoPrintEnabled: false, defaultCopies: 1 }, NOW)
  await saveStationConfiguration(db, BUSINESS, 'kitchen', configInput('admin-1'), new Date(+NOW + 1000))
  const repeated = await upsertPrintStation(db, BUSINESS, { id: 'kitchen', name: 'Default cliente', platform: 'android', autoPrintEnabled: false, defaultCopies: 1 }, new Date(+NOW + 2000))
  assert.equal(repeated.name, 'Cozinha nova')
  assert.equal(repeated.platform, 'windows')
  assert.equal(repeated.autoPrintEnabled, true)
  assert.equal(sqlite.prepare("SELECT config_revision FROM print_stations WHERE id = 'kitchen'").get().config_revision, 2)
})

test('printing endpoints expose canonical resources, retain the GET alias and reject legacy administrative overwrite', async (t) => {
  const { db, sqlite } = setup(t)
  addStation(sqlite, 'kitchen')
  const context = await resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'station-test' })
  const call = (path, method = 'GET', body) => handlePrintingApi(new Request(`https://delivery.example${path}`, {
    method, headers: { origin: 'https://delivery.example', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db }, context, new URL(`https://delivery.example${path}`))

  const getPolicy = await call('/api/printing/settings')
  const policy = (await getPolicy.json()).settings
  assert.equal(policy.defaultCopies, 2)
  assert.equal(policy.resource, 'printingPolicy')
  assert.deepEqual(policy.data, { orderDefaultCopies: 2, tableTabDefaultCopies: 1 })
  const stations = await call('/api/printing/stations')
  const stationsBody = await stations.json()
  assert.equal(stationsBody.stations[0].configRevision, 1)
  assert.equal(stationsBody.primary.resource, 'stationPrimary')
  assert.equal(stationsBody.primary.revision, 1)

  await assert.rejects(call('/api/printing/stations/rogue', 'PUT', {
    name: 'Rogue', platform: 'windows', autoPrintEnabled: false, defaultCopies: 1, businessId: 'other-business',
  }), { status: 400, code: 'INVALID_PRINT_STATION' })

  for (const [path, body] of [
    ['/api/printing/settings', { defaultCopies: 1 }],
    ['/api/printing/stations/kitchen', { name: 'Legado', platform: 'windows', autoPrintEnabled: false, defaultCopies: 1 }],
    ['/api/printing/stations/kitchen/make-primary', {}],
  ]) {
    await assert.rejects(call(path, path.endsWith('make-primary') ? 'POST' : 'PUT', body), { status: 400, code: 'SETTINGS_CLIENT_UPDATE_REQUIRED' })
  }

  const saved = await call('/api/printing/stations/kitchen', 'PUT', configInput('api-station'))
  assert.equal((await saved.json()).station.resource, 'stationConfiguration')
  await assert.rejects(call('/api/printing/stations/kitchen/make-primary', 'POST', {
    expectedRevision: 1, mutationId: 'forged-primary', businessId: 'other-business',
  }), { status: 400, code: 'SETTINGS_INVALID' })
  const elected = await call('/api/printing/stations/kitchen/make-primary', 'POST', primaryInput('api-primary', 'kitchen'))
  assert.equal((await elected.json()).station.data.primaryStationId, 'kitchen')
})
