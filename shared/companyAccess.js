export const COMPANY_ACCESS_STATES = Object.freeze(['legacy', 'pending', 'active'])
export const MEMBERSHIP_STATES = Object.freeze(['historical', 'invited', 'active', 'inactive'])
export const BUSINESS_LIFECYCLE_STATES = Object.freeze(['enabled', 'suspended', 'deleted'])
export const COMPANY_STATUS_FILTERS = Object.freeze(['visible', 'active', 'pending', 'suspended', 'deleted', 'all'])
export const PLATFORM_CAPABILITIES = Object.freeze(['platform.businesses.view', 'platform.businesses.create', 'platform.invitations.resend', 'platform.businesses.manage', 'platform.businesses.delete', 'platform.memberships.view', 'platform.memberships.manage', 'platform.invitations.cancel'])

export function hasPlatformCapability(session, capability) {
  return session?.scope === 'platform' && PLATFORM_CAPABILITIES.includes(capability) && session.capabilities?.includes(capability) === true
}

export function sessionHasBusinessAccess(session) {
  return session?.scope === 'business' && Boolean(session.businessId && session.userId && session.contextId)
}
