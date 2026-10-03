import assert from 'node:assert/strict'
import test from 'node:test'
import { makeEnv } from './access/printingTestSupport.js'
import { createSession, sessionCookie } from './auth.js'
import { handleRequest } from './index.js'

const mutationHeaders = (cookie) => ({
  origin: 'https://delivery.example',
  'content-type': 'application/json',
  cookie,
})
const loginCookie = async (env) => {
  const response = await handleRequest(new Request('https://delivery.example/api/auth/login', {
    method: 'POST',
    headers: { origin: 'https://delivery.example', 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '4827' }),
  }), env)
  assert.equal(response.status, 200)
  return response.headers.get('set-cookie').split(';')[0]
}
let mutationSequence = 0
const jsonRequest = (path, method, cookie, body) => {
  if (method === 'POST' && path.endsWith('/make-primary') && body === undefined) {
    const revision = currentEnv.DB.sqlite.prepare('SELECT revision FROM business_print_topology_settings WHERE business_id = ?').get('amor-e-sabor').revision
    body = { expectedRevision: revision, mutationId: `operational-primary-${++mutationSequence}` }
  }
  return handleRequest(new Request(`https://delivery.example${path}`, {
    method,
    headers: mutationHeaders(cookie),
    body: body === undefined ? undefined : JSON.stringify(body),
  }), currentEnv)
}

let currentEnv

test('central copies are shared by authenticated devices and isolated by the session business', async () => {
  currentEnv = await makeEnv()
  currentEnv.DB.exec(`INSERT INTO business_print_settings
    (business_id, default_copies, created_at, updated_at, table_tab_default_copies, revision) VALUES
    ('amor-e-sabor', 1, '2026-09-08T10:00:00.000Z', '2026-09-08T10:00:00.000Z', 1, 1),
    ('other-business', 2, '2026-09-08T10:00:00.000Z', '2026-09-08T10:00:00.000Z', 1, 1)`)
  const firstDevice = await loginCookie(currentEnv)
  const secondDevice = await loginCookie(currentEnv)
  const other = await createSession(currentEnv, 'other-business')
  const otherCookie = sessionCookie(other.token, 3600).split(';')[0]
  const read = (cookie) => jsonRequest('/api/printing/settings', 'GET', cookie)

  const migrated = await read(firstDevice)
  assert.equal(migrated.status, 200)
  assert.equal((await migrated.json()).settings.defaultCopies, 1)
  for (const [cookie, defaultCopies, expectedRevision] of [[secondDevice, 2, 1], [firstDevice, 1, 2]]) {
    const saved = await jsonRequest('/api/printing/settings', 'PUT', cookie, {
      expectedRevision, mutationId: `copies-${expectedRevision}`, data: { orderDefaultCopies: defaultCopies, tableTabDefaultCopies: 1 },
    })
    assert.equal(saved.status, 200)
    assert.equal((await saved.json()).settings.defaultCopies, defaultCopies)
    assert.equal((await (await read(secondDevice)).json()).settings.defaultCopies, defaultCopies)
  }
  assert.equal((await read(otherCookie)).status, 401)
  const savedOther = await jsonRequest('/api/printing/settings', 'PUT', otherCookie, {
    expectedRevision: 1, mutationId: 'other-copies', data: { orderDefaultCopies: 1, tableTabDefaultCopies: 1 },
  })
  assert.equal(savedOther.status, 401)
  assert.equal((await jsonRequest('/api/printing/settings', 'PUT', firstDevice, {
    expectedRevision: 3, mutationId: 'final-copies', data: { orderDefaultCopies: 2, tableTabDefaultCopies: 1 },
  })).status, 200)
  assert.equal(currentEnv.DB.sqlite.prepare('SELECT default_copies FROM business_print_settings WHERE business_id = ?').get('other-business').default_copies, 2)
  assert.equal(currentEnv.DB.sqlite.prepare('SELECT created_at FROM business_print_settings WHERE business_id = ?').get('amor-e-sabor').created_at, '2026-09-08T10:00:00.000Z')
})

test('central settings default to two for a new business and persist independently of station updates and existing jobs', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  const defaults = await jsonRequest('/api/printing/settings', 'GET', cookie)
  assert.equal(defaults.status, 200)
  assert.equal((await defaults.json()).settings.defaultCopies, 2)
  const job = (await (await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 2 })).json()).job
  const before = currentEnv.DB.sqlite.prepare('SELECT * FROM print_jobs WHERE id = ?').get(job.id)
  assert.equal((await jsonRequest('/api/printing/settings', 'PUT', cookie, {
    expectedRevision: 0, mutationId: 'new-policy', data: { orderDefaultCopies: 1, tableTabDefaultCopies: 1 },
  })).status, 200)
  await jsonRequest('/api/printing/stations/legacy', 'PUT', cookie, {
    name: 'Legacy', platform: 'windows', autoPrintEnabled: true, defaultCopies: 2,
  })
  await jsonRequest('/api/printing/stations/legacy/make-primary', 'POST', cookie)
  assert.equal((await (await jsonRequest('/api/printing/settings', 'GET', cookie)).json()).settings.defaultCopies, 1)
  assert.deepEqual(currentEnv.DB.sqlite.prepare('SELECT * FROM print_jobs WHERE id = ?').get(job.id), before)
})

test('central settings reject legacy writes and invalid canonical copy counts without changing persisted settings', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  for (const body of [{}, { defaultCopies: 1 }, { defaultCopies: 1, businessId: 'other-business' }]) {
    const response = await jsonRequest('/api/printing/settings', 'PUT', cookie, body)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'SETTINGS_CLIENT_UPDATE_REQUIRED')
  }
  for (const defaultCopies of [0, 3, -1, 1.5, '1', '2', true, false, null, [], {}]) {
    const response = await jsonRequest('/api/printing/settings', 'PUT', cookie, {
      expectedRevision: 0, mutationId: `invalid-${JSON.stringify(defaultCopies)}`, data: { orderDefaultCopies: defaultCopies, tableTabDefaultCopies: 1 },
    })
    assert.equal(response.status, 400, JSON.stringify({ defaultCopies }))
    assert.equal((await response.json()).error.code, 'SETTINGS_INVALID')
  }
  for (const body of [undefined, null, [], 'invalid']) {
    const response = await jsonRequest('/api/printing/settings', 'PUT', cookie, body)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'INVALID_JSON')
  }
  assert.equal(currentEnv.DB.sqlite.prepare('SELECT count(*) AS count FROM business_print_settings').get().count, 0)
})

test('central settings require authentication for reads and writes and same origin for writes', async () => {
  currentEnv = await makeEnv()
  for (const method of ['GET', 'PUT']) {
    const response = await jsonRequest('/api/printing/settings', method, '', method === 'PUT' ? { defaultCopies: 1 } : undefined)
    assert.equal(response.status, 401)
  }
  const cookie = await loginCookie(currentEnv)
  const response = await handleRequest(new Request('https://delivery.example/api/printing/settings', {
    method: 'PUT', headers: { cookie, origin: 'https://other.example', 'content-type': 'application/json' },
    body: JSON.stringify({ defaultCopies: 1 }),
  }), currentEnv)
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'ORIGIN_NOT_ALLOWED')
})

test('authenticated printing API configures a primary station and completes a manual order job', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)

  const empty = await handleRequest(new Request('https://delivery.example/api/printing/stations', { headers: { cookie } }), currentEnv)
  assert.equal(empty.status, 200)
  assert.deepEqual((await empty.json()).stations, [])

  const station = await jsonRequest('/api/printing/stations/station%20a', 'PUT', cookie, {
    name: 'PC da cozinha', platform: 'windows', autoPrintEnabled: true, defaultCopies: 2,
  })
  assert.equal(station.status, 200)
  assert.equal((await station.json()).station.id, 'station a')

  const primary = await jsonRequest('/api/printing/stations/station%20a/make-primary', 'POST', cookie)
  assert.equal(primary.status, 200)
  assert.equal((await primary.json()).station.data.primaryStationId, 'station a')

  const manual = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 2 })
  assert.equal(manual.status, 201)
  const job = (await manual.json()).job
  assert.equal(job.trigger, 'manual')
  assert.equal(job.status, 'pending')
  assert.equal(job.document.customer.phone, '(11) 99876-5432')

  const claimed = await jsonRequest(`/api/printing/jobs/${job.id}/claim`, 'POST', cookie, { stationId: 'station a' })
  assert.equal(claimed.status, 200)
  assert.equal((await claimed.json()).job.status, 'processing')

  const firstCompleted = await jsonRequest(`/api/printing/jobs/${job.id}/complete`, 'POST', cookie, { stationId: 'station a', copiesPrinted: 1 })
  assert.equal(firstCompleted.status, 200)
  assert.equal((await firstCompleted.json()).job.status, 'awaiting_second_copy')

  const acknowledged = await jsonRequest(`/api/printing/jobs/${job.id}/second-copy-prompt`, 'POST', cookie, { stationId: 'station a' })
  assert.equal(acknowledged.status, 200)
  assert.equal((await acknowledged.json()).promptPresented, true)
  const repeatedAcknowledgment = await jsonRequest(`/api/printing/jobs/${job.id}/second-copy-prompt`, 'POST', cookie, { stationId: 'station a' })
  assert.equal(repeatedAcknowledgment.status, 200)
  assert.equal((await repeatedAcknowledgment.json()).promptPresented, false)

  const claimedSecondCopy = await jsonRequest(`/api/printing/jobs/${job.id}/claim`, 'POST', cookie, { stationId: 'station a' })
  assert.equal(claimedSecondCopy.status, 200)
  const completed = await jsonRequest(`/api/printing/jobs/${job.id}/complete`, 'POST', cookie, { stationId: 'station a', copiesPrinted: 2 })
  assert.equal(completed.status, 200)
  assert.equal((await completed.json()).job.status, 'printed')

  const jobs = await handleRequest(new Request('https://delivery.example/api/printing/jobs?orderId=o1&limit=20', { headers: { cookie } }), currentEnv)
  assert.equal(jobs.status, 200)
  assert.equal((await jobs.json()).jobs[0].status, 'printed')

  const document = await handleRequest(new Request('https://delivery.example/api/orders/o1/print-document', { headers: { cookie } }), currentEnv)
  assert.equal(document.status, 200)
  assert.equal((await document.json()).document.order.id, 'o1')
})

test('HTTP manual lifecycle preserves a future automatic job unchanged', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  const future = new Date(Date.now() + 5 * 60 * 1000)
  const createdAt = new Date().toISOString()
  const automaticId = 'future-auto-http'

  await jsonRequest('/api/printing/stations/primary', 'PUT', cookie, {
    name: 'Cozinha', platform: 'windows', autoPrintEnabled: true, defaultCopies: 2,
  })
  await jsonRequest('/api/printing/stations/primary/make-primary', 'POST', cookie)
  currentEnv.DB.sqlite.prepare(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed, station_id,
      snapshot_json, created_at, available_at, processing_started_at, processed_at, last_error_code, last_error_message
    ) VALUES (?, ?, ?, 'order', 'automatic', 'pending', 2, 0, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`)
    .run(automaticId, 'amor-e-sabor', 'o1', JSON.stringify({ version: 1, type: 'order', order: { id: 'o1' } }), createdAt, future.toISOString())

  const manualResponse = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 2 })
  assert.equal(manualResponse.status, 201)
  const manual = (await manualResponse.json()).job
  await jsonRequest(`/api/printing/jobs/${manual.id}/claim`, 'POST', cookie, { stationId: 'primary' })
  const completed = await jsonRequest(`/api/printing/jobs/${manual.id}/complete`, 'POST', cookie, { stationId: 'primary', copiesPrinted: 2 })
  assert.equal((await completed.json()).job.status, 'printed')

  const jobsResponse = await handleRequest(new Request('https://delivery.example/api/printing/jobs?orderId=o1&limit=20', { headers: { cookie } }), currentEnv)
  const jobs = (await jobsResponse.json()).jobs
  const automatic = jobs.find((job) => job.id === automaticId)
  assert.notEqual(manual.id, automatic.id)
  assert.equal(jobs.some((job) => job.id === manual.id), true)
  assert.equal(automatic.status, 'pending')
  assert.equal(automatic.availableAt, future.toISOString())

  const claimAt = async (at) => {
    const SystemDate = Date
    globalThis.Date = class extends SystemDate {
      constructor(...args) { super(...(args.length ? args : [at])) }
      static now() { return at.getTime() }
    }
    try {
      const heartbeat = await jsonRequest('/api/printing/stations/primary/heartbeat', 'POST', cookie, {
        qzReady: true,
        printerReady: true,
        physicalState: 'ready',
      })
      assert.equal(heartbeat.status, 200)
      await jsonRequest('/api/printing/stations/primary/recovery', 'POST', cookie, { state: 'normal' })
      return await jsonRequest('/api/printing/jobs/claim-next', 'POST', cookie, { stationId: 'primary' })
    } finally {
      globalThis.Date = SystemDate
    }
  }

  const before = new Date(future.getTime() - 1)
  const earlyClaim = await claimAt(before)
  assert.equal(earlyClaim.status, 200)
  assert.equal((await earlyClaim.json()).job, null)

  const exactClaim = await claimAt(future)
  assert.equal(exactClaim.status, 200)
  assert.equal((await exactClaim.json()).job?.id, automaticId)
})

test('claim-next rejects a secondary station and accepts only the primary automatic station', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  for (const id of ['primary', 'secondary']) {
    const response = await jsonRequest(`/api/printing/stations/${id}`, 'PUT', cookie, {
      name: id, platform: 'windows', autoPrintEnabled: true, defaultCopies: 2,
    })
    assert.equal(response.status, 200)
  }
  await jsonRequest('/api/printing/stations/primary/make-primary', 'POST', cookie)
  currentEnv.DB.sqlite.prepare(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed, station_id,
      snapshot_json, created_at, available_at, processing_started_at, processed_at, last_error_code, last_error_message
    ) VALUES (?, ?, ?, 'order', 'automatic', 'pending', 2, 0, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`)
    .run('auto-1', 'amor-e-sabor', 'o1', JSON.stringify({ version: 1, type: 'order', order: { id: 'o1' } }), new Date().toISOString(), new Date().toISOString())

  const rejected = await jsonRequest('/api/printing/jobs/claim-next', 'POST', cookie, { stationId: 'secondary' })
  assert.equal(rejected.status, 409)
  assert.equal((await rejected.json()).error.code, 'PRINT_STATION_NOT_PRIMARY')

  const heartbeat = await jsonRequest('/api/printing/stations/primary/heartbeat', 'POST', cookie, {
    qzReady: true,
    printerReady: true,
    physicalState: 'ready',
  })
  assert.equal(heartbeat.status, 200)

  const claimed = await jsonRequest('/api/printing/jobs/claim-next', 'POST', cookie, { stationId: 'primary' })
  assert.equal(claimed.status, 200)
  assert.equal((await claimed.json()).job.id, 'auto-1')
})

test('force-print authorized finalized automatic job can be claimed by the QZ station', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  await jsonRequest('/api/printing/stations/primary', 'PUT', cookie, {
    name: 'PC', platform: 'windows', autoPrintEnabled: false, defaultCopies: 1,
  })
  await jsonRequest('/api/printing/stations/primary/make-primary', 'POST', cookie)
  await jsonRequest('/api/printing/stations/primary/heartbeat', 'POST', cookie, { qzReady: true, printerReady: true, physicalState: 'ready' })
  currentEnv.DB.sqlite.prepare(`UPDATE orders SET status = 'Finalizado' WHERE id = 'o1'`).run()
  currentEnv.DB.sqlite.prepare(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed, station_id,
      snapshot_json, created_at, available_at, processing_started_at, processed_at, last_error_code, last_error_message
    ) VALUES (?, ?, ?, 'order', 'automatic', 'requires_attention', 1, 0, NULL, ?, ?, ?, NULL, NULL, ?, ?)`)
    .run('authorized-finalized', 'amor-e-sabor', 'o1', JSON.stringify({ version: 1, type: 'order', order: { id: 'o1' } }), new Date().toISOString(), new Date().toISOString(), 'ORDER_FINALIZED_BEFORE_PRINT', 'Pedido finalizado antes da impressao.')

  const forced = await jsonRequest('/api/printing/jobs/authorized-finalized/force-print', 'POST', cookie, { actorLabel: 'Caixa 1' })
  assert.equal(forced.status, 200)
  assert.equal((await forced.json()).job.status, 'pending')

  const claimed = await jsonRequest('/api/printing/jobs/claim-next', 'POST', cookie, { stationId: 'primary' })
  assert.equal(claimed.status, 200)
  const claimedBody = await claimed.json()
  assert.equal(claimedBody.job.id, 'authorized-finalized')
  assert.equal(claimedBody.job.status, 'processing')
})

test('uncertain failure requires attention and rejects unsafe retry', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  await jsonRequest('/api/printing/stations/s1', 'PUT', cookie, {
    name: 'PC', platform: 'windows', autoPrintEnabled: false, defaultCopies: 1,
  })
  await jsonRequest('/api/printing/stations/s1/make-primary', 'POST', cookie)
  const manual = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 1 })
  const original = (await manual.json()).job
  await jsonRequest(`/api/printing/jobs/${original.id}/claim`, 'POST', cookie, { stationId: 's1' })

  const failed = await jsonRequest(`/api/printing/jobs/${original.id}/fail`, 'POST', cookie, {
    stationId: 's1', code: 'SERIAL_WRITE_UNCERTAIN', message: 'queda durante escrita', uncertain: true,
  })
  assert.equal(failed.status, 200)
  assert.equal((await failed.json()).job.status, 'requires_attention')

  const retried = await jsonRequest(`/api/printing/jobs/${original.id}/retry`, 'POST', cookie, { stationId: 's1' })
  assert.equal(retried.status, 409)
  assert.equal((await retried.json()).error.code, 'PRINT_JOB_RETRY_NOT_ALLOWED')
})

test('recoverable retry can be requested remotely without station and remains unclaimed', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  await jsonRequest('/api/printing/stations/s1', 'PUT', cookie, {
    name: 'PC', platform: 'windows', autoPrintEnabled: false, defaultCopies: 1,
  })
  await jsonRequest('/api/printing/stations/s1/make-primary', 'POST', cookie)
  const manual = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 1 })
  const original = (await manual.json()).job
  await jsonRequest(`/api/printing/jobs/${original.id}/claim`, 'POST', cookie, { stationId: 's1' })
  await jsonRequest(`/api/printing/jobs/${original.id}/fail`, 'POST', cookie, {
    stationId: 's1', code: 'QZ_PRINT_FAILED', message: 'falha recuperável', uncertain: false,
  })

  const retried = await jsonRequest(`/api/printing/jobs/${original.id}/retry`, 'POST', cookie, {})
  assert.equal(retried.status, 200)
  const retryJob = (await retried.json()).job
  assert.equal(retryJob.id, original.id)
  assert.deepEqual(retryJob.document, original.document)
  assert.equal(retryJob.status, 'pending')
  assert.equal(retryJob.stationId, null)
  assert.equal(retryJob.actionActorLabel, 'Acesso legado')
  assert.equal(typeof retryJob.actionAt, 'string')
})

test('printing endpoints require authentication and never expose another business jobs', async () => {
  currentEnv = await makeEnv()
  const unauthorized = await handleRequest(new Request('https://delivery.example/api/printing/stations'), currentEnv)
  assert.equal(unauthorized.status, 401)

  const cookie = await loginCookie(currentEnv)
  currentEnv.DB.sqlite.prepare(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed, station_id,
      snapshot_json, created_at, available_at, processing_started_at, processed_at, last_error_code, last_error_message
    ) VALUES (?, ?, NULL, 'test', 'manual', 'pending', 1, 0, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`)
    .run('other-job', 'other-business', JSON.stringify({ version: 1, type: 'test' }), new Date().toISOString(), new Date().toISOString())
  const response = await handleRequest(new Request('https://delivery.example/api/printing/jobs', { headers: { cookie } }), currentEnv)
  const jobs = (await response.json()).jobs
  assert.equal(jobs.some((job) => job.id === 'other-job'), false)
})

test('discard endpoint preserves history and audit without requiring a print station', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  const manual = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 2 })
  const original = (await manual.json()).job
  const beforeCount = currentEnv.DB.sqlite.prepare('SELECT count(*) AS count FROM print_jobs').get().count

  const discardedResponse = await jsonRequest(`/api/printing/jobs/${original.id}/discard`, 'POST', cookie, { actorLabel: 'Caixa 1' })
  assert.equal(discardedResponse.status, 200)
  const discarded = (await discardedResponse.json()).job
  assert.equal(discarded.status, 'discarded')
  assert.equal(discarded.actionActorLabel, 'Acesso legado')
  assert.equal(typeof discarded.discardedAt, 'string')
  assert.equal(discarded.actionAt, discarded.discardedAt)
  assert.deepEqual(discarded.document, original.document)
  assert.equal(currentEnv.DB.sqlite.prepare('SELECT count(*) AS count FROM print_jobs').get().count, beforeCount)

  const repeatedResponse = await jsonRequest(`/api/printing/jobs/${original.id}/discard`, 'POST', cookie, { actorLabel: 'Outro dispositivo' })
  assert.equal(repeatedResponse.status, 200)
  const repeated = (await repeatedResponse.json()).job
  assert.equal(repeated.discardedAt, discarded.discardedAt)
  assert.equal(repeated.actionAt, discarded.actionAt)
  assert.equal(repeated.actionActorLabel, 'Acesso legado')

  const jobs = (await (await jsonRequest('/api/printing/jobs?orderId=o1&limit=20', 'GET', cookie)).json()).jobs
  assert.equal(jobs.find((job) => job.id === original.id)?.status, 'discarded')
})

test('discard endpoint rejects a fully printed job with a stable conflict code', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  await jsonRequest('/api/printing/stations/s1', 'PUT', cookie, {
    name: 'PC', platform: 'windows', autoPrintEnabled: false, defaultCopies: 1,
  })
  await jsonRequest('/api/printing/stations/s1/make-primary', 'POST', cookie)
  const manual = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 1 })
  const job = (await manual.json()).job
  await jsonRequest(`/api/printing/jobs/${job.id}/claim`, 'POST', cookie, { stationId: 's1' })
  await jsonRequest(`/api/printing/jobs/${job.id}/complete`, 'POST', cookie, { stationId: 's1', copiesPrinted: 1 })

  const response = await jsonRequest(`/api/printing/jobs/${job.id}/discard`, 'POST', cookie, { actorLabel: 'Sistema' })
  assert.equal(response.status, 409)
  assert.equal((await response.json()).error.code, 'PRINT_JOB_DISCARD_NOT_ALLOWED')
})

test('HTTP second-copy request resumes and completes the same job without creating another job', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  await jsonRequest('/api/printing/stations/qz', 'PUT', cookie, { name: 'Cozinha', platform: 'windows', autoPrintEnabled: true, defaultCopies: 2 })
  await jsonRequest('/api/printing/stations/qz/make-primary', 'POST', cookie)
  await jsonRequest('/api/printing/stations/qz/heartbeat', 'POST', cookie, { qzReady: true, printerReady: true, physicalState: 'ready' })
  const created = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 2 })
  const original = (await created.json()).job
  await jsonRequest(`/api/printing/jobs/${original.id}/claim`, 'POST', cookie, { stationId: 'qz' })
  const first = await jsonRequest(`/api/printing/jobs/${original.id}/complete`, 'POST', cookie, { stationId: 'qz', copiesPrinted: 1 })
  assert.equal((await first.json()).job.status, 'awaiting_second_copy')

  const requested = await jsonRequest(`/api/printing/jobs/${original.id}/request-second-copy`, 'POST', cookie, {})
  const requestedJob = (await requested.json()).job
  assert.equal(requestedJob.id, original.id)
  assert.equal(requestedJob.status, 'pending')
  assert.equal(requestedJob.copiesPrinted, 1)
  assert.ok(requestedJob.secondCopyRequestedAt)
  const claimed = await jsonRequest('/api/printing/jobs/claim-next', 'POST', cookie, { stationId: 'qz' })
  const claimedJob = (await claimed.json()).job
  assert.equal(claimedJob.id, original.id)
  assert.equal(claimedJob.status, 'processing')
  const completed = await jsonRequest(`/api/printing/jobs/${original.id}/complete`, 'POST', cookie, { stationId: 'qz', copiesPrinted: 2 })
  assert.equal((await completed.json()).job.status, 'printed')
  const jobs = (await (await jsonRequest('/api/printing/jobs?orderId=o1&limit=20', 'GET', cookie)).json()).jobs
  assert.equal(jobs.length, 1)
})

test('HTTP second-copy skip is terminal, authenticated, and business isolated', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  await jsonRequest('/api/printing/stations/qz', 'PUT', cookie, { name: 'Cozinha', platform: 'windows', autoPrintEnabled: true, defaultCopies: 2 })
  await jsonRequest('/api/printing/stations/qz/make-primary', 'POST', cookie)
  await jsonRequest('/api/printing/stations/qz/heartbeat', 'POST', cookie, { qzReady: true, printerReady: true, physicalState: 'ready' })
  const original = (await (await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 2 })).json()).job
  await jsonRequest(`/api/printing/jobs/${original.id}/claim`, 'POST', cookie, { stationId: 'qz' })
  await jsonRequest(`/api/printing/jobs/${original.id}/complete`, 'POST', cookie, { stationId: 'qz', copiesPrinted: 1 })

  assert.equal((await jsonRequest(`/api/printing/jobs/${original.id}/skip-second-copy`, 'POST', '', {})).status, 401)
  const other = await createSession(currentEnv, 'other-business')
  const otherCookie = sessionCookie(other.token, 3600).split(';')[0]
  assert.equal((await jsonRequest(`/api/printing/jobs/${original.id}/request-second-copy`, 'POST', otherCookie, {})).status, 401)
  assert.equal((await jsonRequest(`/api/printing/jobs/${original.id}/skip-second-copy`, 'POST', otherCookie, {})).status, 401)

  const skipped = await jsonRequest(`/api/printing/jobs/${original.id}/skip-second-copy`, 'POST', cookie, {})
  const job = (await skipped.json()).job
  assert.equal(job.id, original.id)
  assert.equal(job.status, 'discarded')
  assert.equal(job.copiesRequested, 2)
  assert.equal(job.copiesPrinted, 1)
  assert.ok(job.secondCopySkippedAt)
  assert.equal((await (await jsonRequest('/api/printing/jobs/claim-next', 'POST', cookie, { stationId: 'qz' })).json()).job, null)
})

test('operational printing API exposes scoped views and physical attempt routes with correlation boundaries', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  await jsonRequest('/api/printing/stations/s1', 'PUT', cookie, { name: 'Cozinha', platform: 'windows', autoPrintEnabled: true, defaultCopies: 1 })
  await jsonRequest('/api/printing/stations/s1/make-primary', 'POST', cookie)
  const offline = await jsonRequest('/api/printing/stations/s1/heartbeat', 'POST', cookie, {
    qzReady: true, printerReady: true, physicalState: 'printer_offline',
  })
  assert.equal((await offline.json()).station.health.ready, false)
  const health = await jsonRequest('/api/printing/stations/s1/heartbeat', 'POST', cookie, {
    qzReady: true, printerReady: true, physicalState: 'ready', physicalStatusText: 'online', physicalStatusCode: 200,
  })
  assert.equal(health.status, 200)
  assert.equal((await health.json()).station.health.ready, true)
  const invalidHealth = await jsonRequest('/api/printing/stations/s1/heartbeat', 'POST', cookie, { qzReady: true, printerReady: true, ignored: true })
  assert.equal(invalidHealth.status, 400)

  const created = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 1 })
  const job = (await created.json()).job
  const jobs = await jsonRequest('/api/printing/jobs?scope=operational&page=0&pageSize=99&sortBy=invalid&sortDir=up&status=&trigger=&search=', 'GET', cookie)
  const jobsBody = await jobs.json()
  assert.equal(jobs.status, 200)
  assert.deepEqual(Object.keys(jobsBody).sort(), ['jobs', 'pageInfo'])
  assert.deepEqual(Object.keys(jobsBody.pageInfo).sort(), ['page', 'pageSize', 'totalItems', 'totalPages'])
  assert.equal(jobsBody.pageInfo.page, 1)
  assert.equal(jobsBody.pageInfo.pageSize, 10)
  assert.ok(jobsBody.jobs.some((item) => item.id === job.id))
  const summary = await jsonRequest('/api/printing/jobs/summary', 'GET', cookie)
  assert.deepEqual(Object.keys((await summary.json()).summary).sort(), ['active', 'attention', 'awaitingConfirmation', 'awaitingSecondCopy', 'completedToday', 'discardable', 'pending', 'safeBacklog'].sort())

  const forbidden = await handleRequest(new Request(`https://delivery.example/api/printing/jobs/${job.id}/attempts`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ stationId: 's1', copyNumber: 1 }),
  }), currentEnv)
  assert.equal(forbidden.status, 403)

  await jsonRequest(`/api/printing/jobs/${job.id}/claim`, 'POST', cookie, { stationId: 's1' })
  const attemptResponse = await jsonRequest(`/api/printing/jobs/${job.id}/attempts`, 'POST', cookie, { stationId: 's1', copyNumber: 1 })
  assert.equal(attemptResponse.status, 201)
  const attempt = (await attemptResponse.json()).attempt
  const submitting = await jsonRequest(`/api/printing/attempts/${attempt.id}/submitting`, 'POST', cookie, { stationId: 's1' })
  assert.equal((await submitting.json()).attempt.status, 'submitting')

  await jsonRequest('/api/printing/stations/s2', 'PUT', cookie, { name: 'Caixa', platform: 'windows', autoPrintEnabled: false, defaultCopies: 1 })
  const wrongStation = await jsonRequest(`/api/printing/attempts/${attempt.id}/events`, 'POST', cookie, {
    stationId: 's2', event: { type: 'SPOOLING', jobName: attempt.spoolJobName, spoolJobId: 1 },
  })
  assert.equal(wrongStation.status, 409)
  assert.equal((await wrongStation.json()).error.code, 'PRINT_ATTEMPT_STATION_MISMATCH')
  const otherSession = await createSession(currentEnv, 'other-business')
  const otherCookie = sessionCookie(otherSession.token, 3600).split(';')[0]
  const otherBusiness = await jsonRequest(`/api/printing/attempts/${attempt.id}/events`, 'POST', otherCookie, {
    stationId: 's1', event: { type: 'SPOOLING', jobName: attempt.spoolJobName, spoolJobId: 1 },
  })
  assert.equal(otherBusiness.status, 401)

  const badName = await jsonRequest(`/api/printing/attempts/${attempt.id}/events`, 'POST', cookie, {
    stationId: 's1', event: { type: 'SPOOLING', jobName: 'other', spoolJobId: 1 },
  })
  assert.equal(badName.status, 409)
  assert.equal((await badName.json()).error.code, 'PRINT_ATTEMPT_JOB_NAME_MISMATCH')
  const unknown = await jsonRequest(`/api/printing/attempts/${attempt.id}/events`, 'POST', cookie, {
    stationId: 's1', event: { type: 'OFFLINE', jobName: attempt.spoolJobName, spoolJobId: 1 },
  })
  assert.equal((await unknown.json()).attempt.status, 'unknown')
  const resolved = await jsonRequest(`/api/printing/jobs/${job.id}/resolve-outcome`, 'POST', cookie, {
    attemptId: attempt.id, resolution: 'manual_not_printed', actorLabel: 'Caixa 1',
  })
  assert.equal((await resolved.json()).attempt.resolution, 'manual_not_printed')

  const recoveryJob = (await (await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 1 })).json()).job
  assert.equal((await jsonRequest('/api/printing/stations/s1/recovery', 'POST', cookie, { state: 'pending' })).status, 200)
  assert.equal((await jsonRequest('/api/printing/stations/s1/recovery', 'POST', cookie, { state: 'active' })).status, 200)
  const recovered = await jsonRequest('/api/printing/jobs/claim-recovery-next', 'POST', cookie, { stationId: 's1' })
  assert.equal((await recovered.json()).job.id, recoveryJob.id)

  const pending = (await (await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 1 })).json()).job
  const discarded = await jsonRequest('/api/printing/jobs/discard-pending', 'POST', cookie, { actorLabel: 'Caixa 1' })
  assert.ok((await discarded.json()).jobs.some((item) => item.id === pending.id))
})


test('bulk operational discard HTTP endpoint returns discarded and retained counts', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  const created = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 1 })
  const pending = (await created.json()).job

  const response = await jsonRequest('/api/printing/jobs/discard-operational', 'POST', cookie, { actorLabel: 'Operador' })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.discardedCount, 1)
  assert.equal(body.retainedCount, 0)
  assert.ok(body.jobs.some((job) => job.id === pending.id && job.status === 'discarded'))
})
