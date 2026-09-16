const SETTINGS_DRAFT_ROUTES = Object.freeze({
  'settings-operations': Object.freeze({ resource: 'operations', destinations: new Set(['settings-operations', 'settings-modalities']) }),
  'settings-modalities': Object.freeze({ resource: 'operations', destinations: new Set(['settings-operations', 'settings-modalities']) }),
  'settings-payments': Object.freeze({ resource: 'paymentMethods', destinations: new Set(['settings-payments']) }),
  'settings-cancellations': Object.freeze({ resource: 'cancellationReasons', destinations: new Set(['settings-cancellations']) }),
  'settings-finance-categories': Object.freeze({ resource: 'financeCategories', destinations: new Set(['settings-finance-categories']) }),
  'settings-printing': Object.freeze({ resource: 'printingPolicy', destinations: new Set(['settings-printing']) }),
})

export function getSettingsDraftForDestination(resources, destination) {
  const route = SETTINGS_DRAFT_ROUTES[destination]
  const state = route ? resources?.[route.resource] : null
  return state ? {
    ...route,
    resourceKey: route.resource,
    dirty: state.dirty,
    status: state.status,
    scopeId: state.scopeId,
  } : null
}

export const shouldConfirmSettingsExit = (draft, active, destination) => Boolean(
  draft?.dirty
  && !['saving', 'unconfirmed'].includes(draft.status)
  && draft.destinations instanceof Set
  && draft.destinations.has(active)
  && !draft.destinations.has(destination),
)

export function hasSettingsUnloadRisk(resources) {
  return Object.values(resources || {}).some((resource) => (
    resource?.dirty === true || ['saving', 'unconfirmed'].includes(resource?.status)
  ))
}
