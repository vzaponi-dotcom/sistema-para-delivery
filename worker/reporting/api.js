import { apiError, assertSameOriginMutation, json, readJson } from '../http.js'
import { requireCapability } from '../settingsAccess.js'
import { parseReportingQuery } from './query.js'
import { createReportingService } from './service.js'
import { createReportingRepository } from './repository.js'

const READ_PATHS = new Map([
  ['/api/reporting/overview', 'overview'], ['/api/reporting/operation', 'operation'], ['/api/reporting/sales', 'sales'],
  ['/api/reporting/products', 'products'], ['/api/reporting/orders', 'detail'],
])
const envelope = (query, result) => ({
  generatedAt: new Date().toISOString(), timezone: 'America/Sao_Paulo', normalizedQuery: query,
  data: result.data, quality: result.quality, warnings: result.warnings || [],
})

const queryParamsFromObject = (query = {}) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query || {})) {
    if (value === null || value === undefined || value === '') continue
    params.set(key, String(value))
  }
  return params
}

export async function handleReportingApi(request, env, context, url = new URL(request.url)) {
  const expectedView = READ_PATHS.get(url.pathname)
  const service = env.reportingService || createReportingService(createReportingRepository(env.DB))
  const orderMatch = /^\/api\/reporting\/orders\/([^/]+)$/.exec(url.pathname)
  if (orderMatch && request.method === 'GET') {
    requireCapability(context, 'reports.view')
    const id = decodeURIComponent(orderMatch[1])
    const result = await service.orderDetail(context.businessId, id)
    if (!result.data) throw apiError(404, 'REPORTING_ORDER_NOT_FOUND', 'Pedido não encontrado.')
    return json({ generatedAt: new Date().toISOString(), timezone: 'America/Sao_Paulo', data: result.data, quality: result.quality, warnings: [] })
  }
  if (expectedView && request.method === 'GET') {
    requireCapability(context, 'reports.view')
    const params = new URLSearchParams(url.searchParams)
    params.set('view', expectedView)
    const query = parseReportingQuery(params)
    const result = expectedView === 'overview'
      ? await service.overview(context.businessId, query)
      : expectedView === 'operation'
        ? await service.operation(context.businessId, query)
      : expectedView === 'sales'
          ? await service.sales(context.businessId, query)
          : expectedView === 'products'
            ? await service.products(context.businessId, query)
          : expectedView === 'detail'
            ? await service.detail(context.businessId, query)
          : await service.empty(context.businessId, query)
    return json({ ...envelope(query, result), comparison: result.comparison })
  }
  if (url.pathname === '/api/reporting/export-model' && request.method === 'POST') {
    requireCapability(context, 'reports.export')
    assertSameOriginMutation(request)
    const body = await readJson(request)
    const query = parseReportingQuery(queryParamsFromObject(body.query || body))
    return json(envelope(query, await service.exportModel(context.businessId, query, body.columns)))
  }
  return null
}
