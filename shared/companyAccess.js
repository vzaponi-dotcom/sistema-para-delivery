export const COMPANY_ACCESS_STATES = Object.freeze(['legacy', 'pending', 'active'])
export const MEMBERSHIP_STATES = Object.freeze(['historical', 'invited', 'active', 'inactive'])
export const PLATFORM_CAPABILITIES = Object.freeze(['platform.businesses.view', 'platform.businesses.create', 'platform.invitations.resend'])

export function hasPlatformCapability(session, capability) {
  return session?.scope === 'platform' && PLATFORM_CAPABILITIES.includes(capability) && session.capabilities?.includes(capability) === true
}

export function sessionHasBusinessAccess(session) {
  return session?.scope === 'business' && Boolean(session.businessId && session.userId && session.contextId)
}
