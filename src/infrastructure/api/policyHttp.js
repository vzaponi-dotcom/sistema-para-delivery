import { apiRequest, withJson } from './httpClient.js'

export const policyClientError = (code, message) => Object.assign(new Error(message), { code })

export const validatePolicyScope = ({ scoped = false }, scopeId) => {
  if (scoped && !scopeId) throw policyClientError('SETTINGS_SCOPE_REQUIRED', 'Informe o escopo da esta\u00e7\u00e3o.')
  if (!scoped && scopeId) throw policyClientError('SETTINGS_SCOPE_INVALID', 'Este recurso n\u00e3o aceita escopo.')
}

export const extractEnvelope = (payload, envelope) => envelope ? payload?.[envelope] : payload
export const getJson = (path) => apiRequest(path)
export const putJson = (path, input, method = 'PUT') => apiRequest(path, withJson(method, input))

export const loadPolicyReceipt = (resource, mutationId, scopeId, request = apiRequest) => {
  const params = new URLSearchParams({ resource })
  if (scopeId) params.set('scopeId', scopeId)
  return request(`/api/settings/receipts/${encodeURIComponent(mutationId)}?${params}`)
}

export const createPathPolicyAdapter = ({ id, path, envelope, request = apiRequest, ...metadata }) => Object.freeze({
  id,
  ...metadata,
  load: async (scopeId) => {
    validatePolicyScope(metadata, scopeId)
    return extractEnvelope(await request(path), envelope)
  },
  save: async (input, scopeId) => {
    validatePolicyScope(metadata, scopeId)
    const payload = await request(path, withJson('PUT', input))
    return { resource: extractEnvelope(payload, envelope || 'resource'), receipt: payload?.receipt }
  },
  loadReceipt: (mutationId, scopeId) => {
    validatePolicyScope(metadata, scopeId)
    return loadPolicyReceipt(id, mutationId, scopeId, request)
  },
})
