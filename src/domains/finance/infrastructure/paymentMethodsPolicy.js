import { createPathPolicyAdapter } from '../../../infrastructure/api/policyHttp.js'

export const createPaymentMethodsPolicy = ({ request } = {}) => createPathPolicyAdapter({
  request,
  id: 'paymentMethods',
  path: '/api/settings/payment-methods',
  destinations: Object.freeze(['settings-payments']),
  capability: 'payments.settings.view',
})

export const paymentMethodsPolicy = createPaymentMethodsPolicy()
