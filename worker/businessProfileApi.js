import { parseBusinessProfile } from '../shared/businessProfile.js'
import { apiError, assertSameOriginMutation, json } from './http.js'
import { requireCapability } from './settingsAccess.js'
import {
  loadBusinessProfile,
  loadBusinessProfileStorageState,
  saveBusinessProfile,
} from './businessProfileRepository.js'
import {
  deleteBusinessLogo,
  readBusinessLogo,
  storeBusinessLogo,
  validateBusinessLogo,
} from './businessLogoStorage.js'

const invalid = (field = 'profile') => Object.assign(new Error('Dados da operação inválidos.'), {
  status: 400,
  code: 'BUSINESS_PROFILE_INVALID',
  field,
})

const validateMutationEnvelope = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw invalid()
  const allowed = new Set(['expectedRevision', 'mutationId', 'data', 'logoAction'])
  for (const key of Object.keys(payload)) if (!allowed.has(key)) throw invalid(key)
  if (!Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 0 || payload.expectedRevision >= Number.MAX_SAFE_INTEGER) {
    throw invalid('expectedRevision')
  }
  if (typeof payload.mutationId !== 'string' || !payload.mutationId.trim() || payload.mutationId.length > 120) {
    throw invalid('mutationId')
  }
  if (!['keep', 'replace', 'remove'].includes(payload.logoAction)) throw invalid('logoAction')
  return {
    expectedRevision: payload.expectedRevision,
    mutationId: payload.mutationId,
    data: parseBusinessProfile(payload.data),
    logoAction: payload.logoAction,
  }
}

const readMultipartMutation = async (request) => {
  const contentType = request.headers.get('content-type') || ''
  if (!/^multipart\/form-data\b/iu.test(contentType)) throw invalid('contentType')

  let form
  try {
    form = await request.formData()
  } catch {
    throw invalid('form')
  }

  for (const key of form.keys()) if (!['payload', 'logo'].includes(key)) throw invalid(key)
  const payloadParts = form.getAll('payload')
  const logoParts = form.getAll('logo')
  if (payloadParts.length !== 1 || typeof payloadParts[0] !== 'string') throw invalid('payload')
  if (logoParts.length > 1) throw invalid('logo')

  let parsed
  try {
    parsed = JSON.parse(payloadParts[0])
  } catch {
    throw invalid('payload')
  }

  const mutation = validateMutationEnvelope(parsed)
  const logoPart = logoParts[0]

  if (mutation.logoAction === 'replace') {
    if (!logoPart || typeof logoPart.arrayBuffer !== 'function') throw invalid('logo')
  } else if (logoPart !== undefined) {
    throw invalid('logo')
  }

  return { mutation, logoPart }
}

const nowFromEnv = (env) => {
  const value = typeof env.businessProfileNow === 'function' ? env.businessProfileNow() : new Date()
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw apiError(503, 'BUSINESS_PROFILE_UNAVAILABLE', 'Não foi possível confirmar o horário da alteração.')
  }
  return value
}

const objectBody = async (object) => {
  if (object?.body) return object.body
  if (typeof object?.arrayBuffer === 'function') return object.arrayBuffer()
  throw apiError(503, 'BUSINESS_LOGO_STORAGE_UNAVAILABLE', 'O armazenamento do logo está indisponível. Tente novamente.')
}

const etagHeader = (object) => {
  const value = object?.httpEtag || object?.etag
  if (typeof value !== 'string' || !value) return null
  return value.startsWith('"') ? value : `"${value}"`
}

async function getBusinessLogo(env, context) {
  const current = await loadBusinessProfileStorageState(env.DB, context.businessId)
  if (!current.internalLogo) throw apiError(404, 'BUSINESS_LOGO_NOT_FOUND', 'Esta operação ainda não possui logo.')

  const object = await readBusinessLogo(env.BUSINESS_ASSETS, current.internalLogo.objectKey)
  if (!object) {
    throw apiError(503, 'BUSINESS_LOGO_STORAGE_UNAVAILABLE', 'O logo configurado não está disponível no armazenamento.')
  }

  const headers = new Headers({
    'content-type': object.httpMetadata?.contentType || current.internalLogo.contentType,
    'cache-control': 'private',
  })
  const etag = etagHeader(object)
  if (etag) headers.set('etag', etag)
  return new Response(await objectBody(object), { status: 200, headers })
}

async function saveBusinessProfileMutation(request, env, context) {
  requireCapability(context, 'business.profile.manage')
  assertSameOriginMutation(request)
  const { mutation, logoPart } = await readMultipartMutation(request)
  const now = nowFromEnv(env)
  const before = await loadBusinessProfileStorageState(env.DB, context.businessId)
  const repositoryInput = {
    expectedRevision: mutation.expectedRevision,
    mutationId: mutation.mutationId,
    data: mutation.data,
  }

  let resolvedLogo
  let uploadedLogo = null

  if (mutation.logoAction === 'remove') {
    resolvedLogo = null
  } else if (mutation.logoAction === 'replace') {
    const validated = await validateBusinessLogo(await logoPart.arrayBuffer(), logoPart.type)
    if (before.internalLogo?.sha256 === validated.sha256) {
      resolvedLogo = before.internalLogo
    } else {
      uploadedLogo = await storeBusinessLogo(env.BUSINESS_ASSETS, context.businessId, validated, {
        createId: typeof env.businessLogoId === 'function' ? env.businessLogoId : () => crypto.randomUUID(),
        now: () => now,
      })
      resolvedLogo = uploadedLogo
    }
  }

  let saved
  try {
    saved = await saveBusinessProfile(env.DB, context.businessId, repositoryInput, resolvedLogo, now)
  } catch (error) {
    if (uploadedLogo && error?.outcome !== 'unconfirmed') {
      await deleteBusinessLogo(env.BUSINESS_ASSETS, uploadedLogo.objectKey)
    }
    throw error
  }

  // Cleanup is intentionally derived from the confirmed current D1 state. This
  // keeps lost-response recovery safe and avoids deleting objects referenced by
  // a later commit when an old mutation is replayed.
  try {
    const after = await loadBusinessProfileStorageState(env.DB, context.businessId)
    const oldKey = before.internalLogo?.objectKey || null
    if (uploadedLogo) {
      if (after.internalLogo?.objectKey === uploadedLogo.objectKey) {
        if (oldKey && oldKey !== uploadedLogo.objectKey) await deleteBusinessLogo(env.BUSINESS_ASSETS, oldKey)
      } else {
        await deleteBusinessLogo(env.BUSINESS_ASSETS, uploadedLogo.objectKey)
      }
    } else if (mutation.logoAction === 'remove'
      && after.resource.revision === saved.resource.revision
      && after.internalLogo === null
      && oldKey) {
      await deleteBusinessLogo(env.BUSINESS_ASSETS, oldKey)
    }
  } catch {
    // Confirmed D1 state wins. Cleanup is best-effort by design.
  }

  return json(saved)
}

export async function handleBusinessProfileApi(request, env, context, url = new URL(request.url)) {
  if (url.pathname === '/api/business/logo' && request.method === 'GET') {
    return getBusinessLogo(env, context)
  }

  if (url.pathname !== '/api/settings/business-profile') return null
  if (request.method === 'GET') {
    requireCapability(context, 'business.profile.view')
    return json(await loadBusinessProfile(env.DB, context.businessId))
  }
  if (request.method === 'PUT') return saveBusinessProfileMutation(request, env, context)
  return null
}
