import assert from 'node:assert/strict'
import test from 'node:test'
import { businessProfilePolicy } from './businessProfilePolicy.js'
import { sha256Blob } from './businessLogoImage.js'

const profileResource = {
  resource: 'businessProfile',
  revision: 3,
  data: {
    name: 'Amor & Sabor',
    phone: '(19) 99999-9999',
    address: {
      line: 'Rua A',
      number: '10',
      complement: '',
      neighborhood: 'Centro',
      city: 'Monte Mor',
      state: 'SP',
      postalCode: '13190000',
    },
    logo: { present: false, version: null },
  },
  meta: { createdAt: '2026-09-24T00:00:00.000Z', updatedAt: '2026-09-24T00:00:00.000Z' },
}

const jsonResponse = (payload, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => payload,
})

const payloadFromForm = (form) => JSON.parse(form.get('payload'))

test('business profile adapter normalizes load/save state and builds keep/remove multipart without serializing UI-only logo fields', { concurrency: false }, async (t) => {
  const calls = []
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (path, options = {}) => {
    calls.push([String(path), options])
    if (String(path).startsWith('/api/settings/receipts/')) {
      return jsonResponse({ status: 'confirmed', receipt: { mutationId: 'receipt-1' } })
    }
    if (path !== '/api/settings/business-profile') throw new Error(`Unexpected request: ${path}`)
    if (options.method === 'PUT') return jsonResponse({ resource: { ...profileResource, revision: 4 }, receipt: { mutationId: 'save-1' } })
    return jsonResponse(profileResource)
  }

  const loaded = await businessProfilePolicy.load()
  assert.equal(loaded.data.logoAction, 'keep')
  assert.deepEqual(loaded.data.logo, { present: false, version: null })

  const keep = await businessProfilePolicy.save({
    expectedRevision: 3,
    mutationId: 'save-keep',
    data: loaded.data,
  })
  assert.equal(keep.resource.data.logoAction, 'keep')
  const keepForm = calls.find(([, options]) => options.method === 'PUT')[1].body
  assert.ok(keepForm instanceof FormData)
  assert.equal(keepForm.get('logo'), null)
  assert.deepEqual(payloadFromForm(keepForm), {
    expectedRevision: 3,
    mutationId: 'save-keep',
    data: {
      name: 'Amor & Sabor',
      phone: '(19) 99999-9999',
      address: profileResource.data.address,
    },
    logoAction: 'keep',
  })

  calls.length = 0
  await businessProfilePolicy.save({
    expectedRevision: 3,
    mutationId: 'save-remove',
    data: {
      ...loaded.data,
      logo: { present: false, version: null },
      logoAction: 'remove',
    },
  })
  const removeForm = calls.find(([, options]) => options.method === 'PUT')[1].body
  assert.equal(removeForm.get('logo'), null)
  assert.equal(payloadFromForm(removeForm).logoAction, 'remove')

  assert.deepEqual(await businessProfilePolicy.loadReceipt('receipt-1'), {
    status: 'confirmed',
    receipt: { mutationId: 'receipt-1' },
  })
})

test('replace requires the exact transient WebP bytes referenced by local SHA and sends them once as multipart', { concurrency: false }, async (t) => {
  const calls = []
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (path, options = {}) => {
    calls.push([String(path), options])
    return jsonResponse({ resource: { ...profileResource, revision: 4, data: { ...profileResource.data, logo: { present: true, version: 'server-v4' } } }, receipt: { mutationId: 'save-replace' } })
  }

  const logoBlob = new Blob(['normalized-logo'], { type: 'image/webp' })
  const sha = await sha256Blob(logoBlob)
  const input = {
    expectedRevision: 3,
    mutationId: 'save-replace',
    data: {
      ...profileResource.data,
      logo: { present: true, version: `local:${sha}` },
      logoAction: 'replace',
    },
  }

  const result = await businessProfilePolicy.save(input, undefined, { logoBlob })
  assert.equal(result.resource.data.logoAction, 'keep')
  assert.deepEqual(result.resource.data.logo, { present: true, version: 'server-v4' })

  const form = calls[0][1].body
  const payload = payloadFromForm(form)
  assert.equal(payload.logoAction, 'replace')
  assert.equal(Object.hasOwn(payload.data, 'logo'), false)
  assert.equal(Object.hasOwn(payload.data, 'logoAction'), false)
  const sentLogo = form.get('logo')
  assert.equal(sentLogo.type, 'image/webp')
  assert.equal(await sha256Blob(sentLogo), sha)

  await assert.rejects(
    () => businessProfilePolicy.save(input),
    { code: 'BUSINESS_LOGO_TRANSIENT_MISSING' },
  )
  await assert.rejects(
    () => businessProfilePolicy.save({
      ...input,
      data: { ...input.data, logo: { present: true, version: 'local:' + '0'.repeat(64) } },
    }, undefined, { logoBlob }),
    { code: 'BUSINESS_LOGO_TRANSIENT_MISMATCH' },
  )
})

test('business profile adapter rejects station scope because the operation profile is business-wide', async () => {
  await assert.rejects(() => businessProfilePolicy.load('station-1'), { code: 'SETTINGS_SCOPE_INVALID' })
})


test('conflict-merged logo intent is normalized from the final logo token before multipart save', { concurrency: false }, async (t) => {
  const calls = []
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (path, options = {}) => {
    calls.push([String(path), options])
    return jsonResponse({ resource: { ...profileResource, revision: 4 }, receipt: { mutationId: 'conflict-save' } })
  }

  const logoBlob = new Blob(['conflict-normalized-logo'], { type: 'image/webp' })
  const sha = await sha256Blob(logoBlob)

  await businessProfilePolicy.save({
    expectedRevision: 3,
    mutationId: 'conflict-local',
    data: {
      ...profileResource.data,
      logo: { present: true, version: `local:${sha}` },
      logoAction: 'keep',
    },
  }, undefined, { logoBlob })
  let payload = payloadFromForm(calls.at(-1)[1].body)
  assert.equal(payload.logoAction, 'replace')
  assert.ok(calls.at(-1)[1].body.get('logo'))

  await businessProfilePolicy.save({
    expectedRevision: 3,
    mutationId: 'conflict-current',
    data: {
      ...profileResource.data,
      logo: { present: true, version: 'server-current' },
      logoAction: 'replace',
    },
  }, undefined, { logoBlob })
  payload = payloadFromForm(calls.at(-1)[1].body)
  assert.equal(payload.logoAction, 'keep')
  assert.equal(calls.at(-1)[1].body.get('logo'), null)
})
