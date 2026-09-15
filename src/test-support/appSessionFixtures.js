import { legacyCapabilities } from '../app/access.js'

// Explicit server responses for scenarios that require a trusted settings owner.
// Tests of missing/untrusted configuration must continue supplying that absence.
export const authenticatedSession = {
  authenticated: true,
  businessId: 'amor-e-sabor',
  settingsContextId: 'test-settings-context',
  capabilities: [...legacyCapabilities(true)],
}

export const effectivePaymentConfig = {
  version: 'payment-fixture-v1',
  revisions: { paymentMethods: 1 },
  paymentMethods: {
    methods: [{ code: 'pix', label: 'Pix', value: 'Pix' }],
    defaultMethod: 'pix',
  },
}
