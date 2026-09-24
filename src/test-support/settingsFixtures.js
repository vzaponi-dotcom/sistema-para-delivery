import { DEFAULT_OPERATIONS } from '../../shared/businessPolicies.js'

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) freeze(child)
  return Object.freeze(value)
}

export const adminFixture = freeze({
  resource: 'operations',
  revision: 1,
  data: structuredClone(DEFAULT_OPERATIONS),
  meta: {
    createdAt: '2026-09-12T12:00:00.000Z',
    updatedAt: '2026-09-12T12:00:00.000Z',
  },
})

export const draftFixture = freeze({
  ...structuredClone(DEFAULT_OPERATIONS),
  timing: {
    ...DEFAULT_OPERATIONS.timing,
    scheduledPrepLeadMinutes: 40,
  },
})

export const settingsGrants = new Set([
  'business.profile.view',
  'business.profile.manage',
  'operations.settings.view',
  'operations.settings.manage',
  'payments.settings.view',
  'payments.settings.manage',
  'orders.settings.view',
  'orders.settings.manage',
  'finance.categories.view',
  'finance.categories.manage',
  'printing.settings.view',
  'printing.settings',
  'printing.station.view',
  'printing.station.configure',
  'preferences.local',
])
