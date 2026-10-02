import { apiError } from '../http.js'
import { PLATFORM_CAPABILITIES } from '../../shared/companyAccess.js'
import { prepareCompanyIssuer } from '../tenancy/memberships.js'

export function requirePlatformCapability(context, key) {
  if (context?.scope !== 'platform' || !PLATFORM_CAPABILITIES.includes(key) || !context.platformGranted?.has(key)) throw apiError(403, 'FORBIDDEN', 'Você não tem acesso ao painel Mesiva.')
  return context
}
export async function requireCurrentPlatformCapability(db, context, key, now = new Date()) {
  if (!PLATFORM_CAPABILITIES.includes(key)) throw apiError(403, 'FORBIDDEN', 'Permissão administrativa inválida.')
  const current = await prepareCompanyIssuer(db, context, { purpose: 'first_manager', capability: key }, now)
  requirePlatformCapability(current.context, key)
  return current
}
