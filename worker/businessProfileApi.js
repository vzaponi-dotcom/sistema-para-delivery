import { json } from './http.js'
import { requireCapability } from './settingsAccess.js'
import { loadBusinessProfile } from './businessProfileRepository.js'

export async function handleBusinessProfileApi(request, env, context, url = new URL(request.url)) {
  if (url.pathname !== '/api/settings/business-profile') return null
  if (request.method !== 'GET') return null

  requireCapability(context, 'business.profile.view')
  return json(await loadBusinessProfile(env.DB, context.businessId))
}
