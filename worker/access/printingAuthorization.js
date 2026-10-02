import { apiError } from '../http.js'
import { canReadOrder, projectPrintJobMetadata } from './projections.js'
import { sha256Hex } from '../auth.js'

// Only server-established workflows may pass automatic=true. HTTP body flags are never forwarded.
export const printingActor = (context, { automatic = false, stationId = null } = {}) => {
  if (automatic && !stationId) throw apiError(400, 'PRINT_STATION_ID_REQUIRED', 'Identificador da estação é obrigatório.')
  return automatic
    ? { businessId: context.businessId, actorType: 'system', userId: null, displayName: 'Sistema', sessionId: context.sessionId, stationId }
    : { businessId: context.businessId, actorType: context.legacy ? 'legacy' : 'user', userId: context.legacy ? null : context.userId,
      displayName: context.legacy ? 'Acesso legado' : context.displayName, sessionId: context.sessionId, stationId }
}

export const canReadPrintJob = async (db, context, job, currentOrders) => {
  if (!job || !context.granted.has('printing.execute')) return false
  if (job.type === 'test') return true
  if (job.type === 'table-tab') return context.granted.has('comandas.view')
  if (job.type !== 'order' || !job.orderId) return false
  const order = currentOrders instanceof Map ? currentOrders.get(job.orderId)
    : await db.prepare('SELECT status FROM orders WHERE id = ? AND business_id = ? LIMIT 1').bind(job.orderId, context.businessId).first()
  return canReadOrder(order, context.granted)
}

export const requirePrintJobRead = async (db, context, job) => {
  if (!job) throw apiError(404, 'PRINT_JOB_NOT_FOUND', 'Trabalho de impressão não encontrado.')
  if (!job.id && job.type === 'order' && !await db.prepare('SELECT status FROM orders WHERE id = ? AND business_id = ? LIMIT 1').bind(job.orderId, context.businessId).first()) {
    throw apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
  }
  if (!await canReadPrintJob(db, context, job)) throw apiError(403, 'FORBIDDEN', 'Você não pode consultar este documento de impressão.')
}

const QZ_DEVICE_READ_CALLS = new Set(['printers.find', 'printers.getDefault', 'printers.startListening', 'printers.stopListening', 'printers.getStatus', 'websocket.getNetworkInfo'])
export async function requireCompanyQzRequest(db, context, { toSign, payload }) {
  if (typeof payload !== 'string' || new TextEncoder().encode(payload).length > 1_048_576
    || typeof toSign !== 'string' || !/^[a-f0-9]{64}$/.test(toSign) || await sha256Hex(payload) !== toSign) {
    throw apiError(400, 'INVALID_QZ_SIGN_PAYLOAD', 'A assinatura exige a requisição QZ correspondente.')
  }
  let message
  try { message = JSON.parse(payload) } catch { throw apiError(400, 'INVALID_QZ_SIGN_PAYLOAD', 'Requisição QZ inválida.') }
  if (!message || typeof message !== 'object' || !Number.isSafeInteger(message.timestamp) || message.timestamp < 1) throw apiError(400, 'INVALID_QZ_SIGN_PAYLOAD', 'Requisição QZ inválida.')
  if (QZ_DEVICE_READ_CALLS.has(message.call) && !message.params?.jobData) return
  if (message.call !== 'print') throw apiError(403, 'QZ_CALL_NOT_ALLOWED', 'Esta operação QZ não está disponível.')
  const name = message.params?.options?.jobName
  if (typeof name !== 'string' || !name || name.length > 300) throw apiError(400, 'PRINT_ATTEMPT_REQUIRED', 'A impressão exige uma tentativa física registrada.')
  const job = await db.prepare(`SELECT j.id,j.type,j.order_id FROM print_job_attempts a
    JOIN print_jobs j ON j.id = a.job_id AND j.business_id = a.business_id
    JOIN print_stations s ON s.id = a.station_id AND s.business_id = a.business_id
    WHERE a.business_id = ? AND a.spool_job_name = ? AND a.status = 'submitting' AND a.submission_started_at IS NOT NULL
      AND a.resolution IS NULL AND j.status = 'awaiting_confirmation' AND j.station_id = a.station_id`).bind(context.businessId, name).first()
  if (!job) throw apiError(404, 'PRINT_ATTEMPT_NOT_FOUND', 'Tentativa de impressão não encontrada para esta operação.')
  await requirePrintJobRead(db, context, { id: job.id, type: job.type, orderId: job.order_id })
}

export const projectPrintingPayload = async (db, context, payload) => {
  const jobs = [payload.job, ...(Array.isArray(payload.jobs) ? payload.jobs : [])].filter(Boolean)
  const orderIds = context.granted.has('printing.execute')
    ? [...new Set(jobs.filter(job => job.type === 'order' && job.orderId).map(job => job.orderId))] : []
  const currentOrders = new Map()
  // D1 allows 100 bound parameters. Reserve one for the trusted business ID.
  for (let offset = 0; offset < orderIds.length; offset += 99) {
    const ids = orderIds.slice(offset, offset + 99)
    const found = await db.prepare(`SELECT id,status FROM orders WHERE business_id = ? AND id IN (${ids.map(() => '?').join(',')})`)
      .bind(context.businessId, ...ids).all()
    for (const order of found.results || []) currentOrders.set(order.id, order)
  }
  const projectJob = async (job) => await canReadPrintJob(db, context, job, currentOrders) ? job : projectPrintJobMetadata(job)
  const result = { ...payload }
  if (Object.hasOwn(result, 'job')) result.job = await projectJob(result.job)
  if (Array.isArray(result.jobs)) result.jobs = await Promise.all(result.jobs.map(projectJob))
  return result
}

// Predicates are built only from known server grants and applied before claim/lock.
export const printDocumentEligibilitySql = (granted) => {
  if (!(granted instanceof Set)) return '1 = 1' // internal repository callers preserve their established contract
  if (!granted.has('printing.execute')) return '0 = 1'
  const statuses = []
  if (granted.has('orders.view')) statuses.push("'Em preparo'", "'Agendado'")
  if (granted.has('orders.history')) statuses.push("'Finalizado'", "'Cancelado'")
  return `(print_jobs.type = 'test' ${granted.has('comandas.view') ? "OR print_jobs.type = 'table-tab'" : ''}
    ${statuses.length ? `OR (print_jobs.type = 'order' AND EXISTS (SELECT 1 FROM orders WHERE orders.id = print_jobs.order_id AND orders.business_id = print_jobs.business_id AND orders.status IN (${statuses.join(',')})))` : ''})`
}
