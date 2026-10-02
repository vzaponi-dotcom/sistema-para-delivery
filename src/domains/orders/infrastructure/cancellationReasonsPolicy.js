import { createPathPolicyAdapter } from '../../../infrastructure/api/policyHttp.js'

export const createCancellationReasonsPolicy = ({ request } = {}) => createPathPolicyAdapter({
  request,
  id: 'cancellationReasons',
  path: '/api/settings/cancellation-reasons',
  destinations: Object.freeze(['settings-cancellations']),
  capability: 'orders.settings.view',
})

export const cancellationReasonsPolicy = createCancellationReasonsPolicy()
