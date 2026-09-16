import { createPathPolicyAdapter } from './policyHttp.js'

export const financeCategoriesPolicy = createPathPolicyAdapter({
  id: 'financeCategories', path: '/api/settings/finance-categories',
  destinations: Object.freeze(['settings-finance-categories']), capability: 'finance.categories.view',
})
