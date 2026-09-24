import { loadPolicyReceipt, policyClientError, validatePolicyScope } from '../../../../infrastructure/api/policyHttp.js'
import { requestError } from '../../../../infrastructure/api/httpClient.js'
import { sha256Blob } from './businessLogoImage.js'

const PROFILE_PATH = '/api/settings/business-profile'
const LOCAL_LOGO_VERSION = /^local:([a-f0-9]{64})$/u

const normalizeResource = (value) => {
  if (!value || typeof value !== 'object') return value
  return {
    ...value,
    data: {
      ...value.data,
      logo: value.data?.logo ? { ...value.data.logo } : { present: false, version: null },
      logoAction: 'keep',
    },
  }
}

const profileDataForServer = (data) => ({
  name: data?.name,
  phone: data?.phone,
  address: data?.address,
})

const attachmentError = (code, message) => Object.assign(new Error(message), { code })

const readJsonResponse = async (response) => {
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw requestError(response, payload)
  return payload
}

const loadProfile = async () => {
  const response = await fetch(PROFILE_PATH, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
  })
  return normalizeResource(await readJsonResponse(response))
}

const resolveReplaceBlob = async (data, transient) => {
  const match = typeof data?.logo?.version === 'string' ? data.logo.version.match(LOCAL_LOGO_VERSION) : null
  if (!match || !(transient?.logoBlob instanceof Blob) || transient.logoBlob.type !== 'image/webp') {
    throw attachmentError('BUSINESS_LOGO_TRANSIENT_MISSING', 'Selecione novamente o logo antes de salvar.')
  }
  const actual = await sha256Blob(transient.logoBlob)
  if (actual !== match[1]) {
    throw attachmentError('BUSINESS_LOGO_TRANSIENT_MISMATCH', 'O arquivo selecionado não corresponde à prévia atual.')
  }
  return transient.logoBlob
}

const saveProfile = async (input, transient) => {
  const requestedLogoAction = input?.data?.logoAction || 'keep'
  if (!['keep', 'replace', 'remove'].includes(requestedLogoAction)) {
    throw policyClientError('BUSINESS_PROFILE_INVALID', 'A ação de logo é inválida.')
  }

  const localLogo = typeof input?.data?.logo?.version === 'string'
    && LOCAL_LOGO_VERSION.test(input.data.logo.version)
  const logoAction = localLogo
    ? 'replace'
    : requestedLogoAction === 'remove' && input?.data?.logo?.present === false
      ? 'remove'
      : 'keep'

  const form = new FormData()
  form.append('payload', JSON.stringify({
    expectedRevision: input?.expectedRevision,
    mutationId: input?.mutationId,
    data: profileDataForServer(input?.data),
    logoAction,
  }))

  if (logoAction === 'replace') {
    const blob = await resolveReplaceBlob(input?.data, transient)
    form.append('logo', blob, 'logo.webp')
  }

  const response = await fetch(PROFILE_PATH, {
    method: 'PUT',
    credentials: 'same-origin',
    body: form,
  })
  const payload = await readJsonResponse(response)
  return {
    resource: normalizeResource(payload?.resource),
    receipt: payload?.receipt,
  }
}

export const businessProfilePolicy = Object.freeze({
  id: 'businessProfile',
  destinations: Object.freeze(['settings-business-profile']),
  capability: 'business.profile.view',
  load: async (scopeId) => {
    validatePolicyScope({}, scopeId)
    return loadProfile()
  },
  save: async (input, scopeId, transient) => {
    validatePolicyScope({}, scopeId)
    return saveProfile(input, transient)
  },
  loadReceipt: (mutationId, scopeId) => {
    validatePolicyScope({}, scopeId)
    return loadPolicyReceipt('businessProfile', mutationId)
  },
})

export { normalizeResource as normalizeBusinessProfileResource }
