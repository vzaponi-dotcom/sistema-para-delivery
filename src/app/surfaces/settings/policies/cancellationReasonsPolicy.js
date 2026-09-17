import { createPathPolicyAdapter } from './policyHttp.js'

export const cancellationReasonsPolicy = createPathPolicyAdapter({
  id: 'cancellationReasons', path: '/api/settings/cancellation-reasons',
  destinations: Object.freeze(['settings-cancellations']), capability: 'orders.settings.view',
})
