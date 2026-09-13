import { apiRequest, withJson } from './client.js'

const RESOURCES = Object.freeze({
  operations: { path: '/api/settings/operations' },
  paymentMethods: { path: '/api/settings/payment-methods' },
  cancellationReasons: { path: '/api/settings/cancellation-reasons' },
  financeCategories: { path: '/api/settings/finance-categories' },
  printingPolicy: { path: '/api/printing/settings', envelope: 'settings' },
  stationConfiguration: { scoped: true },
  stationPrimary: { path: '/api/printing/stations', envelope: 'primary' },
})

const clientError = (code, message) => Object.assign(new Error(message), { code })

const descriptorFor = (resource, scopeId) => {
  const descriptor = RESOURCES[resource]
  if (!descriptor) throw clientError('SETTINGS_RESOURCE_INVALID', 'Recurso de configurações inválido.')
  if (descriptor.scoped && !scopeId) throw clientError('SETTINGS_SCOPE_REQUIRED', 'Informe o escopo da estação.')
  if (!descriptor.scoped && scopeId) throw clientError('SETTINGS_SCOPE_INVALID', 'Este recurso não aceita escopo.')
  return descriptor
}

const normalizeStation = (station, scopeId) => {
  if (!station) throw clientError('PRINT_STATION_NOT_FOUND', 'Estação de impressão não encontrada.')
  return {
    resource: 'stationConfiguration',
    scopeId,
    revision: station.configRevision,
    data: { name: station.name, platform: station.platform, autoPrintEnabled: station.autoPrintEnabled },
    meta: { createdAt: station.createdAt, updatedAt: station.updatedAt },
  }
}

export async function getSettings(resource, scopeId) {
  const descriptor = descriptorFor(resource, scopeId)
  if (resource === 'stationConfiguration') {
    const payload = await apiRequest('/api/printing/stations')
    return normalizeStation(payload?.stations?.find(({ id }) => id === scopeId), scopeId)
  }
  const payload = await apiRequest(descriptor.path)
  return descriptor.envelope ? payload?.[descriptor.envelope] : payload
}

export async function putSettings(resource, input, scopeId) {
  descriptorFor(resource, scopeId)
  let path
  let envelope = 'resource'
  let method = 'PUT'
  if (resource === 'printingPolicy') {
    path = '/api/printing/settings'
    envelope = 'settings'
  } else if (resource === 'stationConfiguration') {
    path = `/api/printing/stations/${encodeURIComponent(scopeId)}`
    envelope = 'station'
  } else if (resource === 'stationPrimary') {
    const stationId = input?.data?.primaryStationId
    if (typeof stationId !== 'string' || !stationId.trim()) throw clientError('SETTINGS_SCOPE_REQUIRED', 'Informe a estação principal.')
    path = `/api/printing/stations/${encodeURIComponent(stationId)}/make-primary`
    envelope = 'station'
    method = 'POST'
  } else {
    path = RESOURCES[resource].path
  }
  const payload = await apiRequest(path, withJson(method, input))
  return { resource: payload?.[envelope], receipt: payload?.receipt }
}

export async function getSettingsReceipt(resource, mutationId, scopeId) {
  descriptorFor(resource, scopeId)
  const params = new URLSearchParams({ resource })
  if (scopeId) params.set('scopeId', scopeId)
  return apiRequest(`/api/settings/receipts/${encodeURIComponent(mutationId)}?${params}`)
}

export function getEffectiveConfig(knownVersion) {
  const params = new URLSearchParams()
  if (knownVersion) params.set('knownVersion', knownVersion)
  return apiRequest(`/api/settings/effective${params.size ? `?${params}` : ''}`)
}
