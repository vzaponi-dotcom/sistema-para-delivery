import test from 'node:test'
import assert from 'node:assert/strict'
import { handleBusinessProfileApi } from './businessProfileApi.js'
import { resolveSettingsAccess } from './settingsAccess.js'
import { validateBusinessLogo } from './businessLogoStorage.js'
import { createSettingsDb } from './test-support/settingsDb.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-24T04:20:00.000Z')
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
])
const WEBP_2 = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x08, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
])

class FakeBucket {
  constructor() {
    this.objects = new Map()
    this.puts = []
    this.gets = []
    this.deletes = []
    this.failPut = false
    this.failGet = false
    this.failDelete = false
  }

  async put(key, bytes, options) {
    if (this.failPut) throw new Error('put failed')
    const body = new Uint8Array(bytes)
    this.puts.push({ key, body, options })
    this.objects.set(key, {
      key,
      body,
      httpMetadata: options?.httpMetadata || {},
      etag: `etag-${this.puts.length}`,
    })
    return { key, etag: `etag-${this.puts.length}` }
  }

  async get(key) {
    this.gets.push(key)
    if (this.failGet) throw new Error('get failed')
    const value = this.objects.get(key)
    if (!value) return null
    return {
      key,
      etag: value.etag,
      httpMetadata: value.httpMetadata,
      arrayBuffer: async () => value.body.slice().buffer,
    }
  }

  async delete(key) {
    this.deletes.push(key)
    if (this.failDelete) throw new Error('delete failed')
    this.objects.delete(key)
  }
}

const emptyAddress = () => ({
  line: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  postalCode: '',
})

const profileData = (name = 'Amor & Sabor Centro') => ({
  name,
  phone: '(19) 99999-9999',
  address: {
    line: 'Rua das Flores',
    number: '123',
    complement: '',
    neighborhood: 'Centro',
    city: 'Monte Mor',
    state: 'SP',
    postalCode: '13190000',
  },
})

const payload = ({
  expectedRevision = 1,
  mutationId = 'profile-put',
  data = profileData(),
  logoAction = 'keep',
  ...extra
} = {}) => ({
  expectedRevision,
  mutationId,
  data,
  logoAction,
  ...extra,
})

const formRequest = (payloadValue, { logo, logoType = 'image/webp', extraParts = [] } = {}) => {
  const form = new FormData()
  form.append('payload', JSON.stringify(payloadValue))
  if (logo) form.append('logo', new Blob([logo], { type: logoType }), 'logo.webp')
  for (const [name, value] of extraParts) form.append(name, value)
  return new Request('https://delivery.test/api/settings/business-profile', {
    method: 'PUT',
    headers: { origin: 'https://delivery.test' },
    body: form,
  })
}

const jsonRequest = () => new Request('https://delivery.test/api/settings/business-profile', {
  method: 'PUT',
  headers: { origin: 'https://delivery.test', 'content-type': 'application/json' },
  body: JSON.stringify(payload()),
})

async function manager(sessionId = 'manager') {
  return resolveSettingsAccess(
    { businessId: BUSINESS, sessionId },
    new Set(['business.profile.manage']),
  )
}

async function reader(sessionId = 'reader') {
  return resolveSettingsAccess(
    { businessId: BUSINESS, sessionId },
    new Set(['business.profile.view']),
  )
}

async function noProfileAccess(sessionId = 'no-profile') {
  return resolveSettingsAccess(
    { businessId: BUSINESS, sessionId },
    new Set(),
  )
}

const put = (request, env, context) => handleBusinessProfileApi(request, env, context, new URL(request.url))
const getLogo = (env, context, path = '/api/business/logo') => {
  const request = new Request(`https://delivery.test${path}`)
  return handleBusinessProfileApi(request, env, context, new URL(request.url))
}

async function seedLogo(sqlite, bucket, {
  key = 'businesses/amor-e-sabor/logo/old.webp',
  bytes = WEBP,
  at = '2026-09-24T04:00:00.000Z',
} = {}) {
  const validated = await validateBusinessLogo(bytes, 'image/webp')
  sqlite.prepare(`UPDATE business_profiles SET logo_object_key = ?, logo_content_type = 'image/webp',
    logo_sha256 = ?, logo_size_bytes = ?, logo_updated_at = ?, updated_at = ?
    WHERE business_id = ?`)
    .run(key, validated.sha256, validated.sizeBytes, at, at, BUSINESS)
  bucket.objects.set(key, {
    key,
    body: bytes.slice(),
    httpMetadata: { contentType: 'image/webp' },
    etag: 'etag-old',
  })
  return { key, ...validated, updatedAt: at }
}

test('PUT requires manage, same-origin multipart and rejects forged or inconsistent form parts', async (t) => {
  const { db, close } = createSettingsDb()
  t.after(close)
  const env = { DB: db, BUSINESS_ASSETS: new FakeBucket() }

  await assert.rejects(put(formRequest(payload()), env, await reader()), { status: 403, code: 'FORBIDDEN' })
  await assert.rejects(put(jsonRequest(), env, await manager('json')), { status: 400, code: 'BUSINESS_PROFILE_INVALID' })

  for (const request of [
    formRequest(payload({ businessId: 'other' })),
    formRequest(payload({ logoAction: 'replace' })),
    formRequest(payload({ logoAction: 'keep' }), { logo: WEBP }),
    formRequest(payload({ logoAction: 'remove' }), { logo: WEBP }),
    formRequest(payload({ logoAction: 'made-up' })),
    formRequest(payload(), { extraParts: [['unexpected', 'x']] }),
  ]) {
    await assert.rejects(put(request, env, await manager(crypto.randomUUID())), {
      status: 400,
      code: 'BUSINESS_PROFILE_INVALID',
    })
  }

  const wrongOrigin = formRequest(payload())
  const forged = new Request(wrongOrigin, { headers: { origin: 'https://evil.test' } })
  await assert.rejects(put(forged, env, await manager('origin')), { status: 403, code: 'ORIGIN_NOT_ALLOWED' })
})

test('replace uploads first, commits profile plus logo metadata, and returns only safe logo projection', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  const bucket = new FakeBucket()
  const response = await put(
    formRequest(payload({ logoAction: 'replace' }), { logo: WEBP }),
    { DB: db, BUSINESS_ASSETS: bucket, businessProfileNow: () => NOW, businessLogoId: () => 'new-logo' },
    await manager(),
  )

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.resource.revision, 2)
  assert.deepEqual(body.resource.data.logo, { present: true, version: NOW.toISOString() })
  assert.equal(JSON.stringify(body).includes('new-logo'), false)
  assert.equal(bucket.puts.length, 1)
  assert.equal(bucket.puts[0].key, 'businesses/amor-e-sabor/logo/new-logo.webp')

  const stored = sqlite.prepare(`SELECT logo_object_key, logo_content_type, logo_sha256, logo_size_bytes,
    logo_updated_at FROM business_profiles WHERE business_id = ?`).get(BUSINESS)
  assert.equal(stored.logo_object_key, 'businesses/amor-e-sabor/logo/new-logo.webp')
  assert.equal(stored.logo_content_type, 'image/webp')
  assert.equal(stored.logo_updated_at, NOW.toISOString())
  assert.equal(sqlite.prepare('SELECT name FROM businesses WHERE id = ?').get(BUSINESS).name, 'Amor & Sabor Centro')
})

test('successful replace cleans the old object best-effort after D1 points to the new object', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  const bucket = new FakeBucket()
  const old = await seedLogo(sqlite, bucket)

  const response = await put(
    formRequest(payload({ logoAction: 'replace' }), { logo: WEBP_2 }),
    { DB: db, BUSINESS_ASSETS: bucket, businessProfileNow: () => NOW, businessLogoId: () => 'replacement' },
    await manager(),
  )
  assert.equal(response.status, 200)
  assert.equal(bucket.deletes.includes(old.key), true)
  assert.equal(bucket.objects.has(old.key), false)
  assert.equal(bucket.objects.has('businesses/amor-e-sabor/logo/replacement.webp'), true)
  assert.equal(
    sqlite.prepare('SELECT logo_object_key FROM business_profiles WHERE business_id = ?').get(BUSINESS).logo_object_key,
    'businesses/amor-e-sabor/logo/replacement.webp',
  )
})

test('definitive D1 failure after upload cleans the new object and preserves the old profile', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  const bucket = new FakeBucket()
  const old = await seedLogo(sqlite, bucket)
  sqlite.exec(`CREATE TRIGGER fail_profile_receipt AFTER INSERT ON settings_mutation_receipts
    WHEN NEW.resource_key = 'businessProfile' BEGIN SELECT RAISE(ABORT, 'definitive profile failure'); END`)

  await assert.rejects(
    put(
      formRequest(payload({ logoAction: 'replace' }), { logo: WEBP_2 }),
      { DB: db, BUSINESS_ASSETS: bucket, businessProfileNow: () => NOW, businessLogoId: () => 'doomed' },
      await manager(),
    ),
    { status: 503, code: 'BUSINESS_PROFILE_UNAVAILABLE' },
  )

  assert.equal(bucket.deletes.includes('businesses/amor-e-sabor/logo/doomed.webp'), true)
  assert.equal(bucket.objects.has('businesses/amor-e-sabor/logo/doomed.webp'), false)
  assert.equal(bucket.objects.has(old.key), true)
  assert.equal(sqlite.prepare('SELECT logo_object_key FROM business_profiles WHERE business_id = ?').get(BUSINESS).logo_object_key, old.key)
})

test('cleanup failure after a confirmed replace never rolls back the confirmed D1 state', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  const bucket = new FakeBucket()
  const old = await seedLogo(sqlite, bucket)
  bucket.failDelete = true

  const response = await put(
    formRequest(payload({ logoAction: 'replace' }), { logo: WEBP_2 }),
    { DB: db, BUSINESS_ASSETS: bucket, businessProfileNow: () => NOW, businessLogoId: () => 'confirmed' },
    await manager(),
  )

  assert.equal(response.status, 200)
  assert.equal(bucket.deletes.includes(old.key), true)
  assert.equal(
    sqlite.prepare('SELECT logo_object_key FROM business_profiles WHERE business_id = ?').get(BUSINESS).logo_object_key,
    'businesses/amor-e-sabor/logo/confirmed.webp',
  )
})

test('remove commits null logo metadata before deleting the old object', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  const bucket = new FakeBucket()
  const old = await seedLogo(sqlite, bucket)

  const response = await put(
    formRequest(payload({ logoAction: 'remove' })),
    { DB: db, BUSINESS_ASSETS: bucket, businessProfileNow: () => NOW },
    await manager(),
  )
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.resource.data.logo, { present: false, version: null })
  assert.equal(sqlite.prepare('SELECT logo_object_key FROM business_profiles WHERE business_id = ?').get(BUSINESS).logo_object_key, null)
  assert.equal(bucket.deletes.includes(old.key), true)
})

test('replacing with identical bytes reuses current metadata, skips R2 write and remains a D1 no-op when profile data is unchanged', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  const bucket = new FakeBucket()
  const current = await seedLogo(sqlite, bucket)
  const before = { ...sqlite.prepare('SELECT * FROM business_profiles WHERE business_id = ?').get(BUSINESS) }
  const existing = {
    name: 'Amor & Sabor',
    phone: '',
    address: emptyAddress(),
  }

  const response = await put(
    formRequest(payload({ mutationId: 'same-logo', data: existing, logoAction: 'replace' }), { logo: WEBP }),
    { DB: db, BUSINESS_ASSETS: bucket, businessProfileNow: () => NOW, businessLogoId: () => 'must-not-write' },
    await manager(),
  )

  const body = await response.json()
  assert.equal(body.resource.revision, 1)
  assert.equal(bucket.puts.length, 0)
  assert.equal(bucket.deletes.length, 0)
  assert.deepEqual({ ...sqlite.prepare('SELECT * FROM business_profiles WHERE business_id = ?').get(BUSINESS) }, before)
  assert.equal(sqlite.prepare(`SELECT committed_revision FROM settings_mutation_receipts
    WHERE business_id = ? AND resource_key = 'businessProfile' AND mutation_id = 'same-logo'`).get(BUSINESS).committed_revision, 1)
  assert.deepEqual(body.resource.data.logo, { present: true, version: current.updatedAt })
})

test('unknown D1 outcome is not retried and keeps the new object available for a possible late commit', async (t) => {
  const { db, close } = createSettingsDb()
  t.after(close)
  const bucket = new FakeBucket()
  let batches = 0
  const uncertainDb = {
    ...db,
    async batch(statements) {
      batches += 1
      throw Object.assign(new Error('transport timeout before confirmation'), { transportUnknown: true })
    },
  }

  await assert.rejects(
    put(
      formRequest(payload({ logoAction: 'replace' }), { logo: WEBP }),
      { DB: uncertainDb, BUSINESS_ASSETS: bucket, businessProfileNow: () => NOW, businessLogoId: () => 'uncertain' },
      await manager(),
    ),
    { status: 503, code: 'BUSINESS_PROFILE_UNAVAILABLE', outcome: 'unconfirmed' },
  )

  assert.equal(batches, 1)
  assert.equal(bucket.puts.length, 1)
  assert.equal(bucket.deletes.includes('businesses/amor-e-sabor/logo/uncertain.webp'), false)
  assert.equal(bucket.objects.has('businesses/amor-e-sabor/logo/uncertain.webp'), true)
})

test('GET /api/business/logo requires only an authenticated context, ignores forged business query and returns private cache metadata', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  const bucket = new FakeBucket()
  const current = await seedLogo(sqlite, bucket)

  const response = await getLogo(
    { DB: db, BUSINESS_ASSETS: bucket },
    await noProfileAccess(),
    '/api/business/logo?businessId=other&v=for-cache-only',
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/webp')
  assert.equal(response.headers.get('cache-control'), 'private')
  assert.ok(response.headers.get('etag'))
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [...WEBP])
  assert.deepEqual(bucket.gets, [current.key])
})

test('GET /api/business/logo returns 404 without a logo and storage errors remain functional 503s', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)

  await assert.rejects(
    getLogo({ DB: db, BUSINESS_ASSETS: new FakeBucket() }, await noProfileAccess('missing')),
    { status: 404, code: 'BUSINESS_LOGO_NOT_FOUND' },
  )

  const bucket = new FakeBucket()
  await seedLogo(sqlite, bucket)
  bucket.failGet = true
  await assert.rejects(
    getLogo({ DB: db, BUSINESS_ASSETS: bucket }, await noProfileAccess('storage')),
    { status: 503, code: 'BUSINESS_LOGO_STORAGE_UNAVAILABLE' },
  )
})
