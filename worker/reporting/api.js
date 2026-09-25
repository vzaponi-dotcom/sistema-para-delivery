import { assertSameOriginMutation, json, readJson } from '../http.js'
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

export async function handleReportingApi(request, env, context, url = new URL(request.url)) {
  const expectedView = READ_PATHS.get(url.pathname)
  const service = env.reportingService || createReportingService(createReportingRepository(env.DB))
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
        : await service.empty(context.businessId, query)
    return json({ ...envelope(query, result), comparison: result.comparison })
  }
  if (url.pathname === '/api/reporting/export-model' && request.method === 'POST') {
    requireCapability(context, 'reports.export')
    assertSameOriginMutation(request)
    const query = parseReportingQuery(new URLSearchParams(await readJson(request)))
    return json(envelope(query, await service.empty(context.businessId, query)))
  }
  return null
}
