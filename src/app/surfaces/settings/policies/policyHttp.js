import { apiRequest, withJson } from '../../../../api/client.js'

export const policyClientError = (code, message) => Object.assign(new Error(message), { code })

export const validatePolicyScope = ({ scoped = false }, scopeId) => {
  if (scoped && !scopeId) throw policyClientError('SETTINGS_SCOPE_REQUIRED', 'Informe o escopo da esta\u00e7\u00e3o.')
  if (!scoped && scopeId) throw policyClientError('SETTINGS_SCOPE_INVALID', 'Este recurso n\u00e3o aceita escopo.')
}

export const extractEnvelope = (payload, envelope) => envelope ? payload?.[envelope] : payload
export const getJson = (path) => apiRequest(path)
export const putJson = (path, input, method = 'PUT') => apiRequest(path, withJson(method, input))

export const loadPolicyReceipt = (resource, mutationId, scopeId) => {
  const params = new URLSearchParams({ resource })
  if (scopeId) params.set('scopeId', scopeId)
  return apiRequest(`/api/settings/receipts/${encodeURIComponent(mutationId)}?${params}`)
}

export const createPathPolicyAdapter = ({ id, path, envelope, ...metadata }) => Object.freeze({
  id,
  ...metadata,
  load: async (scopeId) => {
    validatePolicyScope(metadata, scopeId)
    return extractEnvelope(await getJson(path), envelope)
  },
  save: async (input, scopeId) => {
    validatePolicyScope(metadata, scopeId)
    const payload = await putJson(path, input)
    return { resource: extractEnvelope(payload, envelope || 'resource'), receipt: payload?.receipt }
  },
  loadReceipt: (mutationId, scopeId) => {
    validatePolicyScope(metadata, scopeId)
    return loadPolicyReceipt(id, mutationId, scopeId)
  },
})
