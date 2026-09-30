import { apiError } from '../http.js'
import { canReadOrder, projectPrintJobMetadata } from './projections.js'

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
