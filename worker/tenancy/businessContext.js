import { apiError } from '../http.js'
import { contextChanged } from '../identity/sessions.js'
import { PLATFORM_CAPABILITIES } from '../../shared/companyAccess.js'

export function requireIdentityContext(request, context) {
  if (!context) throw apiError(401, 'UNAUTHENTICATED', 'Sua sessão expirou. Entre novamente.')
  if (!context.contextId || request.headers.get('X-Mesiva-Context') !== context.contextId) throw contextChanged()
  return context
}

export function requireBusinessContext(request, context) {
  requireIdentityContext(request, context)
  if (context.scope !== 'business' || !context.businessId || !context.userId || !context.sessionId) throw apiError(403, 'FORBIDDEN', 'Você não tem acesso a esse destino.')
  return context
}

export function requirePlatformContext(request, context, capability) {
  requireIdentityContext(request, context)
  if (context.scope !== 'platform' || !PLATFORM_CAPABILITIES.includes(capability) || !context.platformGranted?.has(capability)) throw apiError(403, 'FORBIDDEN', 'Você não tem acesso ao painel Mesiva.')
  return context
}
