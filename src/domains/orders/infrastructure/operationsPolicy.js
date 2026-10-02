import { createPathPolicyAdapter } from '../../../infrastructure/api/policyHttp.js'

export const createOperationsPolicy = ({ request } = {}) => createPathPolicyAdapter({
  request,
  id: 'operations',
  path: '/api/settings/operations',
  destinations: Object.freeze(['settings-operations', 'settings-modalities']),
  capability: 'operations.settings.view',
})

export const operationsPolicy = createOperationsPolicy()
