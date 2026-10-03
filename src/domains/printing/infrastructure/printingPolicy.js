import { apiRequest, withJson } from '../../../infrastructure/api/httpClient.js'
import { createPathPolicyAdapter, extractEnvelope, loadPolicyReceipt, policyClientError, validatePolicyScope } from '../../../infrastructure/api/policyHttp.js'

export const createPrintingPolicy = ({ request = apiRequest } = {}) => createPathPolicyAdapter({
  request,
  id: 'printingPolicy', path: '/api/printing/settings', envelope: 'settings',
  destinations: Object.freeze(['settings-printing']), capabilities: Object.freeze(['printing.settings.view', 'printing.settings']),
})

const stationConfigurationMeta = Object.freeze({ scoped: true, capabilities: Object.freeze(['printing.station.view', 'printing.station.configure']) })
const normalizeStation = (station, scopeId) => {
  if (!station) throw policyClientError('PRINT_STATION_NOT_FOUND', 'Esta\u00e7\u00e3o de impress\u00e3o n\u00e3o encontrada.')
  return {
    resource: 'stationConfiguration', scopeId, revision: station.configRevision,
    data: { name: station.name, platform: station.platform, autoPrintEnabled: station.autoPrintEnabled },
    meta: { createdAt: station.createdAt, updatedAt: station.updatedAt },
  }
}

export const createStationConfigurationPolicy = ({ request = apiRequest } = {}) => Object.freeze({
  id: 'stationConfiguration', ...stationConfigurationMeta,
  load: async (scopeId) => {
    validatePolicyScope(stationConfigurationMeta, scopeId)
    return normalizeStation((await request('/api/printing/stations'))?.stations?.find(({ id }) => id === scopeId), scopeId)
  },
  save: async (input, scopeId) => {
    validatePolicyScope(stationConfigurationMeta, scopeId)
    const payload = await request(`/api/printing/stations/${encodeURIComponent(scopeId)}`, withJson('PUT', input))
    return { resource: extractEnvelope(payload, 'station'), receipt: payload?.receipt }
  },
  loadReceipt: (mutationId, scopeId) => {
    validatePolicyScope(stationConfigurationMeta, scopeId)
    return loadPolicyReceipt('stationConfiguration', mutationId, scopeId, request)
  },
})

export const createStationPrimaryPolicy = ({ request = apiRequest } = {}) => Object.freeze({
  id: 'stationPrimary', capabilities: Object.freeze(['printing.station.view', 'printing.station.configure']),
  load: async (scopeId) => {
    validatePolicyScope({}, scopeId)
    return extractEnvelope(await request('/api/printing/stations'), 'primary')
  },
  save: async (input, scopeId) => {
    validatePolicyScope({}, scopeId)
    const stationId = input?.data?.primaryStationId
    if (typeof stationId !== 'string' || !stationId.trim()) throw policyClientError('SETTINGS_SCOPE_REQUIRED', 'Informe a esta\u00e7\u00e3o principal.')
    const payload = await request(`/api/printing/stations/${encodeURIComponent(stationId)}/make-primary`, withJson('POST', input))
    return { resource: extractEnvelope(payload, 'station'), receipt: payload?.receipt }
  },
  loadReceipt: (mutationId, scopeId) => {
    validatePolicyScope({}, scopeId)
    return loadPolicyReceipt('stationPrimary', mutationId, undefined, request)
  },
})

export const printingPolicy = createPrintingPolicy()

export const stationConfigurationPolicy = createStationConfigurationPolicy()

export const stationPrimaryPolicy = createStationPrimaryPolicy()
