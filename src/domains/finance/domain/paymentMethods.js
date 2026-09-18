import { DEFAULT_PAYMENT_METHODS, paymentLabel } from '../../../../shared/businessPolicies.js'

export const PAYMENT_METHOD_OPTIONS = DEFAULT_PAYMENT_METHODS.methods.map(({ code }) => {
  const value = paymentLabel(code)
  return { value, label: value, code }
})

export function paymentOptionsFromEffective(config) {
  if (!Array.isArray(config?.paymentMethods?.methods)) return []
  return config.paymentMethods.methods
    .filter((method) => method?.active !== false
      && typeof method?.code === 'string'
      && typeof method?.value === 'string'
      && typeof method?.label === 'string')
    .map(({ value, label, code }) => ({ value, label, code }))
}

export function paymentDefaultFromEffective(config) {
  const options = paymentOptionsFromEffective(config)
  const code = config?.paymentMethods?.defaultMethod
  return options.find((option) => option.code === code)?.value || ''
}

export const paymentSelectionNeedsReview = (options, value) => Boolean(value)
  && !options.some((option) => option.value === value)

export function paymentOptionsWithSelection(options, value) {
  if (!paymentSelectionNeedsReview(options, value)) return options
  return [{ value, label: `${value} (inativo)`, code: null, inactive: true }, ...options]
}
