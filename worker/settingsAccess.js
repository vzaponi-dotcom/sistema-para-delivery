import { APPLICATION_CAPABILITIES, SETTINGS_MANAGE_TO_VIEW } from '../shared/settingsAccess.js'
import { apiError } from './http.js'

const known = new Set(APPLICATION_CAPABILITIES)
const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

export async function resolveSettingsAccess(session, trustedGrants) {
  if (!session?.businessId || !session?.sessionId) throw apiError(401, 'UNAUTHENTICATED', 'Sua sess\u00e3o expirou. Entre novamente.')
  const legacy = arguments.length < 2
  const source = legacy ? APPLICATION_CAPABILITIES : trustedGrants instanceof Set ? [...trustedGrants] : []
  const granted = new Set(source.filter((capability) => known.has(capability)))
  for (const [manage, view] of Object.entries(SETTINGS_MANAGE_TO_VIEW)) if (granted.has(manage)) granted.add(view)
  const ordered = [...granted].sort()
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${session.sessionId}\n${ordered.join('\n')}`))
  return Object.freeze({
    businessId: session.businessId,
    sessionId: session.sessionId,
    settingsContextId: hex(new Uint8Array(digest)).slice(0, 24),
    granted: new Set(ordered),
    legacy,
  })
}

export const requireCapability = (context, capability) => {
  if (!context?.granted?.has(capability)) throw apiError(403, 'FORBIDDEN', 'Voc\u00ea n\u00e3o pode acessar estas configura\u00e7\u00f5es.')
}
