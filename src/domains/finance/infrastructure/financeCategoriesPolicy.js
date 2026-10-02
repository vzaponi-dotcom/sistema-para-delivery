import { createPathPolicyAdapter } from '../../../infrastructure/api/policyHttp.js'

export const createFinanceCategoriesPolicy = ({ request } = {}) => createPathPolicyAdapter({
  request,
  id: 'financeCategories',
  path: '/api/settings/finance-categories',
  destinations: Object.freeze(['settings-finance-categories']),
  capability: 'finance.categories.view',
})

export const financeCategoriesPolicy = createFinanceCategoriesPolicy()
