import { legacyCapabilities } from '../app/access.js'
import { SYSTEM_NOTIFICATIONS } from '../app/notifications/notificationCatalog.js'

export const markSystemNotificationsRead = (harness, businessId = 'amor-e-sabor') => {
  const ids = SYSTEM_NOTIFICATIONS.map(({ id }) => id)
  harness.localStorage.setItem(`delivery-notifications:v1:${businessId}`, JSON.stringify({ version: 1, knownIds: ids, presentedIds: ids, readIds: ids }))
}

// Explicit server responses for scenarios that require a trusted settings owner.
// Tests of missing/untrusted configuration must continue supplying that absence.
export const authenticatedSession = {
  authenticated: true,
  authMode: 'legacy',
  deviceMode: null,
  user: null,
  businessId: 'amor-e-sabor',
  settingsContextId: 'test-settings-context',
  capabilities: [...legacyCapabilities(true)].filter(capability => !capability.startsWith('access.')),
}

export const effectivePaymentConfig = {
  version: 'payment-fixture-v1',
  revisions: { paymentMethods: 1 },
  paymentMethods: {
    methods: [{ code: 'pix', label: 'Pix', value: 'Pix' }],
    defaultMethod: 'pix',
  },
}
