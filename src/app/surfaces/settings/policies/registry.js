import { cancellationReasonsPolicy, operationsPolicy, createCancellationReasonsPolicy, createOperationsPolicy } from '../../../../domains/orders/index.js'
import { financeCategoriesPolicy, paymentMethodsPolicy, createFinanceCategoriesPolicy, createPaymentMethodsPolicy } from '../../../../domains/finance/index.js'
import { printingPolicy, stationConfigurationPolicy, stationPrimaryPolicy, createPrintingPolicy, createStationConfigurationPolicy, createStationPrimaryPolicy } from '../../../../domains/printing/index.js'
import { businessProfilePolicy, createBusinessProfilePolicy } from '../business-profile/businessProfilePolicy.js'

const policies = Object.freeze([
  businessProfilePolicy,
  operationsPolicy, paymentMethodsPolicy, cancellationReasonsPolicy, financeCategoriesPolicy,
  printingPolicy, stationConfigurationPolicy, stationPrimaryPolicy,
])
const policiesById = Object.freeze(Object.fromEntries(policies.map((policy) => [policy.id, policy])))

export const getSettingsPolicy = (id) => policiesById[id] || null
export const createSettingsPolicyAdapters = (client) => client ? Object.fromEntries([createBusinessProfilePolicy, createOperationsPolicy, createPaymentMethodsPolicy, createCancellationReasonsPolicy, createFinanceCategoriesPolicy, createPrintingPolicy, createStationConfigurationPolicy, createStationPrimaryPolicy].map(factory => { const policy = factory(client); return [policy.id, policy] })) : ({ ...policiesById })
export const settingsPolicies = policies
