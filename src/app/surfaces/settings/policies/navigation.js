import { settingsPolicies } from './registry.js'

const navigationPolicies = settingsPolicies.filter((policy) => Array.isArray(policy.destinations))

export function resolveSettingsPolicyNavigationDraft(resources, destination) {
  const policy = navigationPolicies.find(({ destinations }) => destinations.includes(destination))
  const state = policy && resources?.[policy.id]
  if (!state) return null
  return {
    resourceKey: policy.id,
    resource: policy.id,
    scopeId: state.scopeId,
    dirty: state.dirty,
    status: state.status,
    destinations: new Set(policy.destinations),
  }
}
