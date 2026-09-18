import { cancellationReasonsPolicy, operationsPolicy } from '../../../../domains/orders/index.js'
import { financeCategoriesPolicy } from './financeCategoriesPolicy.js'
import { paymentMethodsPolicy } from './paymentMethodsPolicy.js'
import { printingPolicy, stationConfigurationPolicy, stationPrimaryPolicy } from './printingPolicy.js'

const policies = Object.freeze([
  operationsPolicy, paymentMethodsPolicy, cancellationReasonsPolicy, financeCategoriesPolicy,
  printingPolicy, stationConfigurationPolicy, stationPrimaryPolicy,
])
const policiesById = Object.freeze(Object.fromEntries(policies.map((policy) => [policy.id, policy])))

export const getSettingsPolicy = (id) => policiesById[id] || null
export const createSettingsPolicyAdapters = () => ({ ...policiesById })
export const settingsPolicies = policies
