import { apiError, assertSameOriginMutation, json, readJson } from './http.js'
import { loadOrderPrintDocument } from './orderPrintDocumentRepository.js'
import {
  claimNextAutomaticPrintJob,
  claimPrintJob,
  createManualOrderPrintJob,
  createTestPrintJob,
  listPrintJobs,
  listPrintStations,
  loadBusinessPrintSettings,
  markPrintJobFailed,
  markPrintJobPrinted,
  retryPrintJob,
  saveBusinessPrintSettings,
  setPrimaryPrintStation,
  upsertPrintStation,
} from './orderPrintingRepository.js'
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
    const limit = Number(url.searchParams.get('limit') || 100)
    return json({ jobs: await listPrintJobs(env.DB, businessId, { orderId, limit }) })
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
    const job = await claimNextAutomaticPrintJob(env.DB, businessId, stationIdFromBody(body))
    return json({ job })
  }

  const jobActionMatch = url.pathname.match(/^\/api\/printing\/jobs\/([^/]+)\/(claim|complete|fail|retry)$/)
  if (jobActionMatch && request.method === 'POST') {
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const jobId = decodeURIComponent(jobActionMatch[1])
    const action = jobActionMatch[2]
    const stationId = stationIdFromBody(body)

    if (action === 'claim') {
      return json({ job: await claimPrintJob(env.DB, businessId, jobId, stationId) })
    }
    if (action === 'complete') {
      return json({ job: await markPrintJobPrinted(env.DB, businessId, jobId, stationId, printCopies(body.copiesPrinted, 'copiesPrinted')) })
    }
    if (action === 'fail') {
      return json({ job: await markPrintJobFailed(env.DB, businessId, jobId, stationId, {
        code: requiredText(body.code, 'code', 'Código da falha é obrigatório.'),
        message: requiredText(body.message, 'message', 'Mensagem da falha é obrigatória.'),
        uncertain: Boolean(body.uncertain),
      }) })
    }
    if (action === 'retry') {
      return json({ job: await retryPrintJob(env.DB, businessId, jobId) })
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
