import { assertSameOriginMutation, apiError, json, readJson } from './http.js'
import { requireCapability } from './settingsAccess.js'
import { loadOperations, saveOperations } from './operationSettingsRepository.js'
import { loadPaymentMethods, savePaymentMethods } from './paymentSettingsRepository.js'
import { loadCancellationReasons, saveCancellationReasons } from './cancellationSettingsRepository.js'
import { loadFinanceCategories, saveFinanceCategories } from './financeCategoryRepository.js'
import { loadEffectiveBusinessConfig } from './effectiveBusinessConfig.js'
import { readSettingsReceipt } from './settingsTransactions.js'

const RESOURCES = Object.freeze({
  operations: { path: 'operations', view: 'operations.settings.view', manage: 'operations.settings.manage', load: loadOperations, save: saveOperations },
  paymentMethods: { path: 'payment-methods', view: 'payments.settings.view', manage: 'payments.settings.manage', load: loadPaymentMethods, save: savePaymentMethods },
  cancellationReasons: { path: 'cancellation-reasons', view: 'orders.settings.view', manage: 'orders.settings.manage', load: loadCancellationReasons, save: saveCancellationReasons },
  financeCategories: { path: 'finance-categories', view: 'finance.categories.view', manage: 'finance.categories.manage', load: loadFinanceCategories, save: saveFinanceCategories },
})
const byPath = new Map(Object.entries(RESOURCES).map(([resource, descriptor]) => [descriptor.path, { resource, ...descriptor }]))
const receiptCapability = Object.freeze({
  operations: 'operations.settings.manage', paymentMethods: 'payments.settings.manage', cancellationReasons: 'orders.settings.manage',
  financeCategories: 'finance.categories.manage', printingPolicy: 'printing.settings', stationConfiguration: 'printing.station.configure', stationPrimary: 'printing.station.configure',
})

export async function handleSettingsApi(request, env, context, url = new URL(request.url)) {
  if (url.pathname === '/api/settings/effective' && request.method === 'GET') {
    const effective = await loadEffectiveBusinessConfig(env.DB, context.businessId, context.granted)
    return json(url.searchParams.get('knownVersion') === effective.version
      ? { effectiveConfigVersion: effective.version }
      : effective)
  }
  const receiptMatch = url.pathname.match(/^\/api\/settings\/receipts\/([^/]+)$/)
  if (receiptMatch && request.method === 'GET') {
    const resource = url.searchParams.get('resource') || ''
    const capability = receiptCapability[resource]
    if (!capability) throw apiError(400, 'SETTINGS_INVALID', 'Recurso de configura\u00e7\u00e3o inv\u00e1lido.')
    requireCapability(context, capability)
    const scopeId = url.searchParams.get('scopeId')
    if (resource === 'stationConfiguration' && !scopeId) throw apiError(400, 'SETTINGS_INVALID', 'Informe o escopo da esta\u00e7\u00e3o.')
    if (resource !== 'stationConfiguration' && scopeId) throw apiError(400, 'SETTINGS_INVALID', 'Este recurso n\u00e3o aceita escopo.')
    const resourceKey = scopeId ? `${resource}:${scopeId}` : resource
    const receipt = await readSettingsReceipt(env.DB, context.businessId, resourceKey, decodeURIComponent(receiptMatch[1]))
    return json(receipt ? { status: 'confirmed', receipt } : { status: 'unconfirmed' })
  }
  const match = url.pathname.match(/^\/api\/settings\/([^/]+)$/)
  if (!match) return null
  const descriptor = byPath.get(match[1])
  if (!descriptor) return null
  if (request.method === 'GET') {
    requireCapability(context, descriptor.view)
    return json(await descriptor.load(env.DB, context.businessId))
  }
  if (request.method === 'PUT') {
    requireCapability(context, descriptor.manage)
    assertSameOriginMutation(request)
    return json(await descriptor.save(env.DB, context.businessId, await readJson(request)))
  }
  return null
}
