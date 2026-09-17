import { createPathPolicyAdapter } from '../../../../infrastructure/api/policyHttp.js'

export const paymentMethodsPolicy = createPathPolicyAdapter({
  id: 'paymentMethods', path: '/api/settings/payment-methods',
  destinations: Object.freeze(['settings-payments']), capability: 'payments.settings.view',
})
