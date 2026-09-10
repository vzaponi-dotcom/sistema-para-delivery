import { apiError, assertSameOriginMutation, json, readJson } from './http.js'
import { loadOrderPrintDocument } from './orderPrintDocumentRepository.js'
import { claimNextPrintJob } from './orderPrintingCentralClaim.js'
import {
  acknowledgeSecondCopyPrompt,
  claimPrintJob,
  createManualOrderPrintJob,
  createTestPrintJob,
  discardPrintJob,
  forcePrintJob,
  getPrintQueueSummary,
  heartbeatPrintStation,
  listPrintJobs,
  listPrintStations,
  loadBusinessPrintSettings,
  loadPrintJob,
  markPrintJobFailed,
  markPrintJobPrinted,
  prioritizePrintJob,
  reprintPrintJob,
  retryPrintJob,
  requestSecondCopy,
  saveBusinessPrintSettings,
  setPrintRecoveryState,
  setPrimaryPrintStation,
  upsertPrintStation,
  skipSecondCopy,
  claimNextRecoveryPrintJob,
  discardPendingPrintJobs,
} from './orderPrintingRepository.js'
import {
  createPrintJobAttempt,
  markPrintAttemptSubmitting,
  recordPrintAttemptEvent,
  resolveUnknownPrintAttempt,
} from './printAttemptRepository.js'
import { getConfiguredQzCertificate, signQzPayload } from './qzSigning.js'

const requiredText = (value, field, message = `${field} é obrigatório.`) => {
  const text = String(value ?? '').trim()
  if (!text) throw apiError(400, 'VALIDATION_ERROR', message)
  return text
}

const printCopies = (value, field = 'copies') => {
  const copies = Number(value)
  if (copies !== 1 && copies !== 2) throw apiError(400, 'INVALID_PRINT_COPIES', `${field} deve ser 1 ou 2.`)
  return copies
}

const stationPlatform = (value) => {
  if (!['windows', 'android', 'other'].includes(value)) {
    throw apiError(400, 'INVALID_PRINT_PLATFORM', 'Plataforma de impressão inválida.')
  }
  return value
}

const stationIdFromBody = (body) => requiredText(body.stationId, 'stationId', 'Identificador da estação é obrigatório.')

export const handlePrintingApi = async (request, env, session, url) => {
  const businessId = session.businessId

  if (url.pathname === '/api/printing/settings') {
    // TODO: apply role-based authorization here when roles exist. Today every
    // authenticated device may view/update its business settings, without a station requirement.
    if (request.method === 'GET') {
      return json({ settings: await loadBusinessPrintSettings(env.DB, businessId) })
    }
    if (request.method === 'PUT') {
      assertSameOriginMutation(request)
      const body = await readJson(request)
      const keys = Object.keys(body)
      if (keys.length !== 1 || keys[0] !== 'defaultCopies') {
        throw apiError(400, 'INVALID_PRINT_SETTINGS', 'Informe somente defaultCopies.')
      }
      return json({ settings: await saveBusinessPrintSettings(env.DB, businessId, body) })
    }
  }

  if (url.pathname === '/api/printing/qz/certificate' && request.method === 'GET') {
    return new Response(getConfiguredQzCertificate(env), {
      headers: {
        'content-type': 'text/plain; charset=UTF-8',
        'cache-control': 'no-store',
      },
    })
  }

  if (url.pathname === '/api/printing/qz/sign' && request.method === 'POST') {
    assertSameOriginMutation(request)
    const { toSign } = await readJson(request)
    return new Response(await signQzPayload(env, toSign), {
      headers: {
        'content-type': 'text/plain; charset=UTF-8',
        'cache-control': 'no-store',
      },
    })
  }

  if (url.pathname === '/api/printing/stations' && request.method === 'GET') {
    return json({ stations: await listPrintStations(env.DB, businessId) })
  }

  const heartbeatMatch = url.pathname.match(/^\/api\/printing\/stations\/([^/]+)\/heartbeat$/)
  if (heartbeatMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const keys = Object.keys(body).sort()
    if (keys.some((key) => !['physicalState', 'physicalStatusCode', 'physicalStatusText', 'printerReady', 'qzReady'].includes(key))) {
      throw apiError(400, 'INVALID_PRINT_STATION_HEALTH', 'Informe somente os campos aprovados de saúde da impressora.')
    }
    const station = await heartbeatPrintStation(
      env.DB,
      businessId,
      decodeURIComponent(heartbeatMatch[1]),
      {
        qzReady: Boolean(body.qzReady),
        printerReady: Boolean(body.printerReady) && body.physicalState === 'ready',
        ...(Object.hasOwn(body, 'physicalState') ? { physicalState: body.physicalState } : {}),
        ...(Object.hasOwn(body, 'physicalStatusText') ? { physicalStatusText: body.physicalStatusText } : {}),
        ...(Object.hasOwn(body, 'physicalStatusCode') ? { physicalStatusCode: body.physicalStatusCode } : {}),
      },
    )
    return json({ station })
  }

  const stationMatch = url.pathname.match(/^\/api\/printing\/stations\/([^/]+)$/)
  if (stationMatch && request.method === 'PUT') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const station = await upsertPrintStation(env.DB, businessId, {
      id: decodeURIComponent(stationMatch[1]),
      name: requiredText(body.name, 'name', 'Nome da estação é obrigatório.'),
      platform: stationPlatform(body.platform),
      autoPrintEnabled: Boolean(body.autoPrintEnabled),
      defaultCopies: printCopies(body.defaultCopies, 'defaultCopies'),
    })
    return json({ station })
  }

  const primaryMatch = url.pathname.match(/^\/api\/printing\/stations\/([^/]+)\/make-primary$/)
  if (primaryMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const station = await setPrimaryPrintStation(env.DB, businessId, decodeURIComponent(primaryMatch[1]))
    return json({ station })
  }

  if (url.pathname === '/api/printing/jobs' && request.method === 'GET') {
    const orderId = url.searchParams.get('orderId') || ''
    if (orderId) {
      const limit = Number(url.searchParams.get('limit') || 100)
      const jobs = await listPrintJobs(env.DB, businessId, { orderId, limit })
      return json({ jobs, pageInfo: { page: 1, pageSize: jobs.length, totalItems: jobs.length, totalPages: 1 } })
    }
    return json(await listPrintJobs(env.DB, businessId, {
      scope: url.searchParams.get('scope') || 'operational',
      page: url.searchParams.get('page'),
      pageSize: url.searchParams.get('pageSize'),
      sortBy: url.searchParams.get('sortBy') || '',
      sortDir: url.searchParams.get('sortDir') || '',
      status: url.searchParams.get('status') || '',
      trigger: url.searchParams.get('trigger') || '',
      search: url.searchParams.get('search') || '',
    }))
  }

  if (url.pathname === '/api/printing/jobs/summary' && request.method === 'GET') {
    return json({ summary: await getPrintQueueSummary(env.DB, businessId) })
  }

  const manualOrderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/print-jobs$/)
  if (manualOrderMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const orderId = decodeURIComponent(manualOrderMatch[1])
    const document = await loadOrderPrintDocument(env.DB, businessId, orderId)
    if (!document) throw apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
    const job = await createManualOrderPrintJob(env.DB, businessId, {
      orderId,
      copies: printCopies(body.copies),
      document,
    })
    return json({ job }, { status: 201 })
  }

  if (url.pathname === '/api/printing/test-jobs' && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const stationId = stationIdFromBody(body)
    const business = await env.DB.prepare('SELECT name FROM businesses WHERE id = ? LIMIT 1').bind(businessId).first()
    const job = await createTestPrintJob(env.DB, businessId, {
      stationId,
      businessName: business?.name || 'Amor & Sabor',
    })
    return json({ job }, { status: 201 })
  }

  if (url.pathname === '/api/printing/jobs/claim-next' && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const job = await claimNextPrintJob(env.DB, businessId, stationIdFromBody(body))
    return json({ job })
  }

  if (url.pathname === '/api/printing/jobs/claim-recovery-next' && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    return json({ job: await claimNextRecoveryPrintJob(env.DB, businessId, stationIdFromBody(body)) })
  }

  if (url.pathname === '/api/printing/jobs/discard-pending' && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    return json({ jobs: await discardPendingPrintJobs(env.DB, businessId, body.actorLabel) })
  }

  const recoveryMatch = url.pathname.match(/^\/api\/printing\/stations\/([^/]+)\/recovery$/)
  if (recoveryMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    return json({ station: await setPrintRecoveryState(env.DB, businessId, decodeURIComponent(recoveryMatch[1]), body.state) })
  }

  const createAttemptMatch = url.pathname.match(/^\/api\/printing\/jobs\/([^/]+)\/attempts$/)
  if (createAttemptMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const attempt = await createPrintJobAttempt(env.DB, businessId, {
      jobId: decodeURIComponent(createAttemptMatch[1]), stationId: stationIdFromBody(body), copyNumber: Number(body.copyNumber),
    })
    return json({ attempt }, { status: 201 })
  }

  const submittingAttemptMatch = url.pathname.match(/^\/api\/printing\/attempts\/([^/]+)\/submitting$/)
  if (submittingAttemptMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    return json({ attempt: await markPrintAttemptSubmitting(env.DB, businessId, decodeURIComponent(submittingAttemptMatch[1]), stationIdFromBody(body)) })
  }

  const eventAttemptMatch = url.pathname.match(/^\/api\/printing\/attempts\/([^/]+)\/events$/)
  if (eventAttemptMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    return json({ attempt: await recordPrintAttemptEvent(env.DB, businessId, decodeURIComponent(eventAttemptMatch[1]), stationIdFromBody(body), body.event) })
  }

  const resolveOutcomeMatch = url.pathname.match(/^\/api\/printing\/jobs\/([^/]+)\/resolve-outcome$/)
  if (resolveOutcomeMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    return json({ attempt: await resolveUnknownPrintAttempt(
      env.DB, businessId, decodeURIComponent(resolveOutcomeMatch[1]), requiredText(body.attemptId, 'attemptId'), body.resolution, body.actorLabel,
    ) })
  }

  const secondCopyPromptMatch = url.pathname.match(/^\/api\/printing\/jobs\/([^/]+)\/second-copy-prompt$/)
  if (secondCopyPromptMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    return json(await acknowledgeSecondCopyPrompt(env.DB, businessId, decodeURIComponent(secondCopyPromptMatch[1]), stationIdFromBody(body)))
  }

  const requestSecondCopyMatch = url.pathname.match(/^\/api\/printing\/jobs\/([^/]+)\/request-second-copy$/)
  if (requestSecondCopyMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    return json({ job: await requestSecondCopy(env.DB, businessId, decodeURIComponent(requestSecondCopyMatch[1]), body.actorLabel) })
  }
  const skipSecondCopyMatch = url.pathname.match(/^\/api\/printing\/jobs\/([^/]+)\/skip-second-copy$/)
  if (skipSecondCopyMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    return json({ job: await skipSecondCopy(env.DB, businessId, decodeURIComponent(skipSecondCopyMatch[1]), body.actorLabel) })
  }

  const discardMatch = url.pathname.match(/^\/api\/printing\/jobs\/([^/]+)\/discard$/)
  if (discardMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const actorLabel = String(body.actorLabel ?? '').trim() || 'Sistema'
    const job = await discardPrintJob(env.DB, businessId, decodeURIComponent(discardMatch[1]), actorLabel)
    return json({ job })
  }

  const prioritizeMatch = url.pathname.match(/^\/api\/printing\/jobs\/([^/]+)\/prioritize$/)
  if (prioritizeMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const job = await prioritizePrintJob(env.DB, businessId, decodeURIComponent(prioritizeMatch[1]))
    return json({ job })
  }

  const forcePrintMatch = url.pathname.match(/^\/api\/printing\/jobs\/([^/]+)\/force-print$/)
  if (forcePrintMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const actorLabel = String(body.actorLabel ?? '').trim() || 'Sistema'
    const job = await forcePrintJob(env.DB, businessId, decodeURIComponent(forcePrintMatch[1]), actorLabel)
    return json({ job })
  }

  const reprintMatch = url.pathname.match(/^\/api\/printing\/jobs\/([^/]+)\/reprint$/)
  if (reprintMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const jobId = decodeURIComponent(reprintMatch[1])
    const original = await loadPrintJob(env.DB, businessId, jobId)
    if (!original) throw apiError(404, 'PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
    const document = original.orderId
      ? await loadOrderPrintDocument(env.DB, businessId, original.orderId)
      : null
    if (!document) throw apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
    const job = await reprintPrintJob(
      env.DB,
      businessId,
      jobId,
      printCopies(body.copies),
      document,
    )
    return json({ job }, { status: 201 })
  }

  const jobActionMatch = url.pathname.match(/^\/api\/printing\/jobs\/([^/]+)\/(claim|complete|fail|retry)$/)
  if (jobActionMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const jobId = decodeURIComponent(jobActionMatch[1])
    const action = jobActionMatch[2]

    if (action === 'claim') {
      return json({ job: await claimPrintJob(env.DB, businessId, jobId, stationIdFromBody(body)) })
    }
    if (action === 'complete') {
      return json({ job: await markPrintJobPrinted(env.DB, businessId, jobId, stationIdFromBody(body), printCopies(body.copiesPrinted, 'copiesPrinted')) })
    }
    if (action === 'fail') {
      return json({ job: await markPrintJobFailed(env.DB, businessId, jobId, stationIdFromBody(body), {
        code: requiredText(body.code, 'code', 'Código da falha é obrigatório.'),
        message: requiredText(body.message, 'message', 'Mensagem da falha é obrigatória.'),
        uncertain: Boolean(body.uncertain),
      }) })
    }
    if (action === 'retry') {
      return json({ job: await retryPrintJob(env.DB, businessId, jobId, new Date(), String(body.actorLabel ?? '').trim() || 'Sistema') })
    }
  }

  const documentMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/print-document$/)
  if (documentMatch && request.method === 'GET') {
    const document = await loadOrderPrintDocument(env.DB, businessId, decodeURIComponent(documentMatch[1]))
    if (!document) throw apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
    return json({ document })
  }

  return null
}
