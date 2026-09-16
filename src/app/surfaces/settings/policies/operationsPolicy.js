import { createPathPolicyAdapter } from './policyHttp.js'

export const operationsPolicy = createPathPolicyAdapter({
  id: 'operations', path: '/api/settings/operations',
  destinations: Object.freeze(['settings-operations', 'settings-modalities']), capability: 'operations.settings.view',
})
